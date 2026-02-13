import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import * as fs from "fs";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

export async function downloadRoutes(app: FastifyInstance) {
  // Auth via header OR query param (for direct download links)
  app.addHook("preHandler", async (request, reply) => {
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    return authenticate(request, reply);
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

        return reply.redirect(url);
      } catch (err) {
        console.error("S3 presign failed, falling back to local:", err);
      }
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
  return name
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}
