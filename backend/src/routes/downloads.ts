import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import * as fs from "fs";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

export async function downloadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    // Support ?token= for direct browser links (no Authorization header)
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(request, reply);
  });

  // ━━━ GET /api/projects/:id/download/pdf ━━━
  app.get("/api/projects/:id/download/pdf", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      include: { structure: true },
    });

    if (!project) return reply.status(404).send({ error: "Project not found" });
    if (project.currentStage !== "COMPLETED") {
      return reply.status(400).send({ error: "Book not ready yet" });
    }

    const structureData = project.structure
      ? JSON.parse(project.structure.structureJson)
      : null;
    const bookTitle =
      structureData?.suggestedTitle || project.title || project.topic;
    const filename = sanitize(bookTitle) + ".pdf";

    // Try S3 first
    if (
      project.outputPdfKey &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.S3_BUCKET
    ) {
      try {
        console.log(`📥 Download PDF for ${id}:`);
        console.log(`   Key: ${project.outputPdfKey}`);
        console.log(`   Bucket: ${process.env.S3_BUCKET}`);
        console.log(`   Region: ${process.env.AWS_REGION || "eu-north-1"}`);
        console.log(
          `   AWS Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`,
        );

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
            Key: project.outputPdfKey,
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          }),
          { expiresIn: 3600 },
        );

        console.log(
          `   ✅ Presigned URL generated (first 100 chars): ${url.substring(0, 100)}...`,
        );
        return reply.redirect(url);
      } catch (err: any) {
        console.error("   ❌ S3 presign failed:", err.message);
        console.error("   Falling back to local file...");
      }
    } else {
      console.log(`📥 Download PDF for ${id}: S3 not configured`);
      console.log(`   outputPdfKey: ${project.outputPdfKey || "MISSING"}`);
      console.log(
        `   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? "SET" : "MISSING"}`,
      );
      console.log(`   S3_BUCKET: ${process.env.S3_BUCKET || "MISSING"}`);
    }

    // Fallback: local file
    const localPdf = path.join(BUILD_DIR, id, "book.pdf");
    if (!fs.existsSync(localPdf)) {
      return reply
        .status(404)
        .send({ error: "PDF not found. Try regenerating." });
    }

    const pdfBuffer = fs.readFileSync(localPdf);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", pdfBuffer.length)
      .send(pdfBuffer);
  });

  // ━━━ GET /api/projects/:id/download/tex ━━━
  // Bonus: let user download the .tex source
  app.get("/api/projects/:id/download/tex", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!project) return reply.status(404).send({ error: "Not found" });

    const localTex = path.join(BUILD_DIR, id, "book.tex");
    if (!fs.existsSync(localTex)) {
      return reply.status(404).send({ error: "Source not found" });
    }

    const texContent = fs.readFileSync(localTex, "utf-8");
    const filename = sanitize(project.title || project.topic) + ".tex";

    return reply
      .header("Content-Type", "application/x-tex")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(texContent);
  });
}

function sanitize(name: string): string {
  // Replace Polish diacritics with ASCII equivalents
  const diacriticMap: Record<string, string> = {
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
    .map((ch) => diacriticMap[ch] || ch)
    .join("")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
