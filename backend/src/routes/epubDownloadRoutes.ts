// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — EPUB Download Routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import * as fs from "fs";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

export async function epubDownloadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(request, reply);
  });

  // ━━━ GET /api/projects/:id/download/epub ━━━
  app.get("/api/projects/:id/download/epub", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }

    if (!project.outputEpubKey) {
      return reply.status(404).send({
        success: false,
        error:
          "EPUB not available. The book may not have been compiled with EPUB support yet.",
      });
    }

    // Build filename
    const structureData = project.structure
      ? JSON.parse(project.structure.structureJson)
      : null;
    const bookTitle =
      structureData?.suggestedTitle || project.title || project.topic;
    const filename = `${sanitize(bookTitle)}.epub`;

    // Try S3
    if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
      try {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: project.outputEpubKey,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          }),
          { expiresIn: 3600 },
        );

        return reply.redirect(url);
      } catch (err: any) {
        console.error(`  ❌ S3 presign failed for EPUB:`, err.message);
      }
    }

    // Fallback: local file
    const localEpub = path.join(BUILD_DIR, id, `${sanitize(bookTitle)}.epub`);
    if (!fs.existsSync(localEpub)) {
      return reply.status(404).send({
        success: false,
        error: "EPUB file not found locally.",
      });
    }

    const buffer = fs.readFileSync(localEpub);
    return reply
      .header("Content-Type", "application/epub+zip")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", buffer.length)
      .send(buffer);
  });

  // ━━━ GET /api/projects/:id/epub/status ━━━
  // Check whether EPUB is available (for frontend conditional rendering)
  app.get("/api/projects/:id/epub/status", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      select: { outputEpubKey: true, generationStatus: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }

    return reply.send({
      success: true,
      data: {
        available: !!project.outputEpubKey,
        generationStatus: project.generationStatus,
      },
    });
  });

  // ━━━ POST /api/projects/:id/epub/regenerate ━━━
  // Trigger EPUB regeneration independently (e.g. after editing chapters)
  app.post("/api/projects/:id/epub/regenerate", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      select: { id: true, currentStage: true, generationStatus: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }

    if (project.currentStage !== "COMPLETED") {
      return reply.status(400).send({
        success: false,
        error: "Project must be completed before generating EPUB.",
      });
    }

    // Fire and forget — EPUB generation runs in background
    // Import dynamically to avoid circular deps
    const { compileEpub } = await import("../services/epubCompiler");

    // Update status
    await prisma.project.update({
      where: { id },
      data: { generationStatus: "COMPILING_EPUB" },
    });

    compileEpub(id)
      .then(async () => {
        await prisma.project.update({
          where: { id },
          data: { generationStatus: "COMPLETED" },
        });
      })
      .catch(async (err) => {
        console.error(`EPUB regeneration failed for ${id}:`, err);
        await prisma.project.update({
          where: { id },
          data: { generationStatus: "COMPLETED" }, // Don't break the project
        });
      });

    return reply.send({
      success: true,
      message: "EPUB generation started. This usually takes 10-30 seconds.",
    });
  });
}

function sanitize(name: string): string {
  const map: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "A",
    Ć: "C",
    Ę: "E",
    Ł: "L",
    Ń: "N",
    Ó: "O",
    Ś: "S",
    Ź: "Z",
    Ż: "Z",
    ä: "a",
    ö: "o",
    ü: "u",
    ß: "ss",
    Ä: "A",
    Ö: "O",
    Ü: "U",
    é: "e",
    è: "e",
    ê: "e",
    ë: "e",
    à: "a",
    â: "a",
    î: "i",
    ï: "i",
    ô: "o",
    û: "u",
    ù: "u",
    ç: "c",
    ñ: "n",
    á: "a",
    í: "i",
    ú: "u",
  };
  return name
    .split("")
    .map((ch) => map[ch] || ch)
    .join("")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
