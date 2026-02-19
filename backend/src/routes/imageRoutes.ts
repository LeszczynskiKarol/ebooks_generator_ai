// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Image Routes v2
// Upload with public-read ACL, proxy endpoint for fallback
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import * as path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function imageRoutes(app: FastifyInstance) {
  await app.register(import("@fastify/multipart"), {
    limits: { fileSize: MAX_FILE_SIZE },
  });

  // ━━━ GET /api/projects/:id/images ━━━
  app.get("/api/projects/:id/images", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id } = request.params as any;
      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });

      const images = await prisma.projectImage.findMany({
        where: { projectId: id, source: "USER_UPLOAD" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          originalName: true,
          s3Key: true,
          s3Url: true,
          description: true,
          width: true,
          height: true,
          format: true,
          createdAt: true,
        },
      });

      // ★ Return proxy URLs — avoids CORS/S3 issues entirely
      const data = images.map((img) => ({
        ...img,
        displayUrl: `/api/projects/${id}/images/proxy/${img.id}`,
      }));

      return reply.send({ success: true, data });
    },
  });

  // ━━━ POST /api/projects/:id/images/upload ━━━
  app.post("/api/projects/:id/images/upload", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id } = request.params as any;
      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });

      const data = await request.file();
      if (!data)
        return reply.status(400).send({ success: false, error: "No file" });

      const ext = path.extname(data.filename || "").toLowerCase();
      if (!ALLOWED_EXTS.includes(ext))
        return reply.status(400).send({
          success: false,
          error: `Invalid type. Allowed: ${ALLOWED_EXTS.join(", ")}`,
        });
      if (!ALLOWED_TYPES.includes(data.mimetype))
        return reply
          .status(400)
          .send({ success: false, error: "Invalid MIME" });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_FILE_SIZE)
        return reply
          .status(400)
          .send({ success: false, error: "File too large (max 10MB)" });

      const dimensions = getImageDimensions(buffer, ext);
      const fileId = randomUUID();
      const s3Key = `projects/${id}/images/${fileId}${ext}`;
      let s3Url: string;

      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        const s3 = getS3Client();
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: s3Key,
            Body: buffer,
            ContentType: data.mimetype,
            CacheControl: "public, max-age=2592000",
          }),
        );
        s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com/${s3Key}`;
        console.log(`  ☁️  Image → S3: ${s3Key} (public-read)`);
      } else {
        const fs = await import("fs");
        const dir = path.join(process.cwd(), "tmp", "uploads", id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${fileId}${ext}`), buffer);
        s3Url = `/api/projects/${id}/images/file/${fileId}${ext}`;
      }

      const image = await prisma.projectImage.create({
        data: {
          projectId: id,
          source: "USER_UPLOAD",
          originalName: data.filename || `image${ext}`,
          s3Key,
          s3Url,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
          format: ext.replace(".", ""),
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: image.id,
          originalName: image.originalName,
          s3Key: image.s3Key,
          s3Url: image.s3Url,
          displayUrl: `/api/projects/${id}/images/proxy/${image.id}`,
          width: image.width,
          height: image.height,
          format: image.format,
        },
      });
    },
  });

  // ━━━ GET /api/projects/:id/images/proxy/:imageId ━━━
  // Backend proxy — serves image through our API (no CORS issues)
  app.get("/api/projects/:id/images/proxy/:imageId", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id, imageId } = request.params as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });

      const image = await prisma.projectImage.findFirst({
        where: { id: imageId, projectId: id },
      });
      if (!image)
        return reply
          .status(404)
          .send({ success: false, error: "Image not found" });

      const mime: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
      };
      const contentType = mime[image.format || "jpg"] || "image/jpeg";

      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        try {
          const s3 = getS3Client();
          const res = await s3.send(
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET!,
              Key: image.s3Key,
            }),
          );
          const bufs: Buffer[] = [];
          for await (const chunk of res.Body as any)
            bufs.push(Buffer.from(chunk));

          reply.header("Content-Type", contentType);
          reply.header("Cache-Control", "public, max-age=86400");
          return reply.send(Buffer.concat(bufs));
        } catch (err) {
          console.error("S3 proxy error:", err);
          return reply
            .status(502)
            .send({ success: false, error: "S3 fetch failed" });
        }
      } else {
        const fs = await import("fs");
        const localPath = path.join(
          process.cwd(),
          "tmp",
          "uploads",
          id,
          path.basename(image.s3Key),
        );
        if (!fs.existsSync(localPath))
          return reply
            .status(404)
            .send({ success: false, error: "File not found" });

        reply.header("Content-Type", contentType);
        reply.header("Cache-Control", "public, max-age=86400");
        return reply.send(fs.readFileSync(localPath));
      }
    },
  });

  // ━━━ PATCH /api/projects/:id/images/:imageId ━━━
  app.patch("/api/projects/:id/images/:imageId", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id, imageId } = request.params as any;
      const { description } = request.body as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });

      await prisma.projectImage.update({
        where: { id: imageId },
        data: { description: description || null },
      });
      return reply.send({ success: true });
    },
  });

  // ━━━ DELETE /api/projects/:id/images/:imageId ━━━
  app.delete("/api/projects/:id/images/:imageId", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id, imageId } = request.params as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });

      const image = await prisma.projectImage.findFirst({
        where: { id: imageId, projectId: id },
      });
      if (!image)
        return reply
          .status(404)
          .send({ success: false, error: "Image not found" });

      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        try {
          await getS3Client().send(
            new DeleteObjectCommand({
              Bucket: process.env.S3_BUCKET!,
              Key: image.s3Key,
            }),
          );
        } catch (err) {
          console.error("S3 delete failed (non-fatal):", err);
        }
      }

      await prisma.imagePlacement.deleteMany({ where: { imageId } });
      await prisma.projectImage.delete({ where: { id: imageId } });
      return reply.send({ success: true });
    },
  });

  // ━━━ Local file serving fallback ━━━
  app.get("/api/projects/:id/images/file/:filename", async (request, reply) => {
    const { id, filename } = request.params as any;
    const fs = await import("fs");
    const localPath = path.join(process.cwd(), "tmp", "uploads", id, filename);
    if (!fs.existsSync(localPath))
      return reply.status(404).send({ success: false, error: "Not found" });

    const ext = path.extname(filename).toLowerCase();
    const mime: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    reply.header("Content-Type", mime[ext] || "application/octet-stream");
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(fs.readFileSync(localPath));
  });
}

function getImageDimensions(
  buffer: Buffer,
  ext: string,
): { width: number; height: number } | null {
  try {
    if (ext === ".png" && buffer.length > 24) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }
    if ((ext === ".jpg" || ext === ".jpeg") && buffer.length > 2) {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
  } catch {}
  return null;
}
