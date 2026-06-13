// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Cover Routes
// Generate, upload, preview, and manage book covers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  generateCoverLatex,
  compileCover,
  getDefaultCoverParams,
  type CoverParams,
  type CoverLayout,
} from "../services/coverGenerator";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_SIZE = 15 * 1024 * 1024; // 15MB for high-res covers
const VALID_LAYOUTS: CoverLayout[] = [
  "techgrid",
  "luxe",
  "aurora",
  "architect",
  "monolith",
];

export async function coverRoutes(app: FastifyInstance) {
  // Auth applied per-route (preview needs manual token from query param)

  // ━━━ GET /api/projects/:id/cover ━━━
  // Get current cover status & params
  app.get(
    "/api/projects/:id/cover",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
        select: {
          id: true,
          coverType: true,
          coverLatex: true,
          coverImageS3Key: true,
          coverPdfS3Key: true,
          coverPdfLocalPath: true,
          coverParams: true,
          title: true,
          topic: true,
          subtitle: true,
          authorName: true,
          targetPages: true,
          stylePreset: true,
          customColors: true,
          bookFormat: true,
        },
      });

      if (!project) {
        return reply.status(404).send({ success: false, error: "Not found" });
      }

      const coverParams: CoverParams | null = project.coverParams
        ? JSON.parse(project.coverParams)
        : null;

      const defaultParams = getDefaultCoverParams(project);

      return reply.send({
        success: true,
        data: {
          coverType: project.coverType,
          hasCoverPdf: !!(project.coverPdfS3Key || project.coverPdfLocalPath),
          hasCustomImage: !!project.coverImageS3Key,
          coverParams: coverParams || defaultParams,
          defaultParams,
          availableLayouts: VALID_LAYOUTS,
          // Preview URL (if cover PDF exists)
          previewUrl:
            project.coverPdfS3Key || project.coverPdfLocalPath
              ? `/api/projects/${id}/cover/preview`
              : null,
        },
      });
    },
  );

  // ━━━ POST /api/projects/:id/cover/generate ━━━
  // Generate a LaTeX cover from params
  app.post(
    "/api/projects/:id/cover/generate",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as any;
      const body = request.body as Partial<CoverParams>;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
        select: {
          id: true,
          title: true,
          topic: true,
          subtitle: true,
          authorName: true,
          targetPages: true,
          stylePreset: true,
          customColors: true,
          bookFormat: true,
          language: true,
        },
      });

      if (!project) {
        return reply.status(404).send({ success: false, error: "Not found" });
      }

      // Merge defaults with user overrides
      const defaults = getDefaultCoverParams(project);
      const params: CoverParams = {
        layout:
          body.layout && VALID_LAYOUTS.includes(body.layout)
            ? body.layout
            : defaults.layout,
        title: body.title || defaults.title,
        subtitle:
          body.subtitle !== undefined ? body.subtitle : defaults.subtitle,
        authorName:
          body.authorName !== undefined ? body.authorName : defaults.authorName,
        year: body.year || defaults.year,
        tagline: body.tagline || defaults.tagline,
        showPageCount: body.showPageCount ?? defaults.showPageCount,
        pageCount: project.targetPages,
      };

      const customColors = project.customColors
        ? JSON.parse(project.customColors)
        : undefined;

      // Generate LaTeX
      const latex = generateCoverLatex(
        params,
        project.bookFormat,
        project.language,
        project.stylePreset,
        customColors,
      );

      // Save to project
      await prisma.project.update({
        where: { id },
        data: {
          coverType: "GENERATED",
          coverLatex: latex,
          coverParams: JSON.stringify(params),
          coverUpdatedAt: new Date(),
          // Clear old custom upload data
          coverImageS3Key: null,
          coverImageLocalPath: null,
        },
      });

      // Compile to PDF
      try {
        const result = await compileCover(id);
        return reply.send({
          success: true,
          data: {
            coverType: "GENERATED",
            coverParams: params,
            previewUrl: `/api/projects/${id}/cover/preview`,
            compiled: true,
          },
        });
      } catch (err: any) {
        console.error(`Cover compilation failed:`, err.message);
        return reply.send({
          success: true,
          data: {
            coverType: "GENERATED",
            coverParams: params,
            previewUrl: null,
            compiled: false,
            error: "Cover compilation failed — will retry during book build",
          },
        });
      }
    },
  );

  // ━━━ POST /api/projects/:id/cover/upload ━━━
  // Upload a custom cover image
  app.post(
    "/api/projects/:id/cover/upload",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project) {
        return reply.status(404).send({ success: false, error: "Not found" });
      }

      // Register multipart if not already
      if (!app.hasContentTypeParser("multipart")) {
        await app.register(import("@fastify/multipart"), {
          limits: { fileSize: MAX_COVER_SIZE },
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: "No file" });
      }

      if (!ALLOWED_COVER_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: "Invalid type. Allowed: JPG, PNG, WebP",
        });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_COVER_SIZE) {
        return reply.status(400).send({
          success: false,
          error: "File too large (max 15MB)",
        });
      }

      const ext = path.extname(data.filename || ".jpg").toLowerCase() || ".jpg";
      const fileId = randomUUID();
      const s3Key = `projects/${id}/cover/${fileId}${ext}`;
      let localPath: string | null = null;

      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: s3Key,
            Body: buffer,
            ContentType: data.mimetype,
          }),
        );
        console.log(`  ☁️  Cover image uploaded: ${s3Key}`);
      } else {
        const dir = path.join(process.cwd(), "tmp", "covers", id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        localPath = path.join(dir, `cover-image${ext}`);
        fs.writeFileSync(localPath, buffer);
      }

      // Update project
      await prisma.project.update({
        where: { id },
        data: {
          coverType: "CUSTOM_UPLOAD",
          coverImageS3Key: s3Key,
          coverImageLocalPath: localPath,
          coverLatex: null, // Clear generated LaTeX
          coverParams: null,
          coverUpdatedAt: new Date(),
        },
      });

      // Compile to single-page PDF
      try {
        await compileCover(id);
        return reply.send({
          success: true,
          data: {
            coverType: "CUSTOM_UPLOAD",
            previewUrl: `/api/projects/${id}/cover/preview`,
          },
        });
      } catch (err: any) {
        return reply.send({
          success: true,
          data: {
            coverType: "CUSTOM_UPLOAD",
            previewUrl: null,
            error: "Image-to-PDF conversion failed",
          },
        });
      }
    },
  );

  // ━━━ PATCH /api/projects/:id/cover/params ━━━
  // Update cover params and recompile
  app.patch(
    "/api/projects/:id/cover/params",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as any;
      const body = request.body as Partial<CoverParams>;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
        select: {
          id: true,
          coverType: true,
          coverParams: true,
          title: true,
          topic: true,
          subtitle: true,
          authorName: true,
          targetPages: true,
          stylePreset: true,
          customColors: true,
          bookFormat: true,
          language: true,
        },
      });

      if (!project) {
        return reply.status(404).send({ success: false, error: "Not found" });
      }

      if (project.coverType !== "GENERATED") {
        return reply.status(400).send({
          success: false,
          error: "Can only update params for generated covers",
        });
      }

      const existing: CoverParams = project.coverParams
        ? JSON.parse(project.coverParams)
        : getDefaultCoverParams(project);

      const updated: CoverParams = {
        ...existing,
        ...body,
        layout:
          body.layout && VALID_LAYOUTS.includes(body.layout)
            ? body.layout
            : existing.layout,
      };

      const customColors = project.customColors
        ? JSON.parse(project.customColors)
        : undefined;

      const latex = generateCoverLatex(
        updated,
        project.bookFormat,
        project.language,
        project.stylePreset,
        customColors,
      );

      await prisma.project.update({
        where: { id },
        data: {
          coverLatex: latex,
          coverParams: JSON.stringify(updated),
          coverUpdatedAt: new Date(),
        },
      });

      try {
        await compileCover(id);
      } catch (err) {
        console.error("Cover recompile failed:", err);
      }

      return reply.send({
        success: true,
        data: {
          coverParams: updated,
          previewUrl: `/api/projects/${id}/cover/preview`,
        },
      });
    },
  );

  // ━━━ GET /api/projects/:id/cover/preview ━━━
  // Serve the compiled cover PDF (for iframe preview)
  // Manual JWT — iframe can't send Authorization header
  app.get("/api/projects/:id/cover/preview", async (request, reply) => {
    const { id } = request.params as any;

    // ── Get token from query param or header ──
    const queryToken = (request.query as any)?.token;
    const headerToken = request.headers.authorization?.replace("Bearer ", "");
    const token = queryToken || headerToken;

    if (!token) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }

    // ── Verify JWT manually ──
    let userId: string;
    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(token);
      if (decoded.type !== "access") {
        return reply
          .status(401)
          .send({ success: false, error: "Invalid token type" });
      }
      userId = decoded.userId;
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
      select: {
        coverPdfS3Key: true,
        coverPdfLocalPath: true,
      },
    });

    if (!project) {
      return reply.status(404).send({ success: false, error: "Not found" });
    }

    // Try local file first
    if (project.coverPdfLocalPath && fs.existsSync(project.coverPdfLocalPath)) {
      const buffer = fs.readFileSync(project.coverPdfLocalPath);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Cache-Control", "no-cache")
        .send(buffer);
    }

    // Try S3
    if (
      project.coverPdfS3Key &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.S3_BUCKET
    ) {
      try {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        const res = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: project.coverPdfS3Key,
          }),
        );
        const bufs: Buffer[] = [];
        for await (const chunk of res.Body as any)
          bufs.push(Buffer.from(chunk));
        return reply
          .header("Content-Type", "application/pdf")
          .header("Cache-Control", "no-cache")
          .send(Buffer.concat(bufs));
      } catch (err) {
        console.error("S3 cover fetch failed:", err);
      }
    }

    return reply
      .status(404)
      .send({ success: false, error: "Cover PDF not found" });
  });

  // ━━━ GET /api/projects/:id/cover/thumb ━━━
  // PNG thumbnail of the compiled cover (dashboard cards). Rendered once
  // with pdftoppm and cached on disk; regenerated when the PDF is newer.
  // Manual JWT via ?token= — <img> tags can't send Authorization headers.
  app.get("/api/projects/:id/cover/thumb", async (request, reply) => {
    const { id } = request.params as any;

    const queryToken = (request.query as any)?.token;
    const headerToken = request.headers.authorization?.replace("Bearer ", "");
    const token = queryToken || headerToken;
    if (!token) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }
    let userId: string;
    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(token);
      if (decoded.type !== "access") throw new Error("bad type");
      userId = decoded.userId;
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
      select: {
        coverType: true,
        coverPdfS3Key: true,
        coverPdfLocalPath: true,
      },
    });
    if (!project || project.coverType === "NONE") {
      return reply.status(404).send({ success: false, error: "No cover" });
    }

    const thumbDir = path.join(process.cwd(), "tmp", "covers", id);
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
    const thumbPath = path.join(thumbDir, "thumb.png");

    // Resolve the source PDF: local file, or a cached S3 download
    let srcPdf: string | null = null;
    if (project.coverPdfLocalPath && fs.existsSync(project.coverPdfLocalPath)) {
      srcPdf = project.coverPdfLocalPath;
    } else if (
      project.coverPdfS3Key &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.S3_BUCKET
    ) {
      const cached = path.join(thumbDir, "cover-s3.pdf");
      if (!fs.existsSync(cached)) {
        try {
          const { GetObjectCommand } = await import("@aws-sdk/client-s3");
          const s3 = new S3Client({
            region: process.env.AWS_REGION || "eu-north-1",
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          });
          const res = await s3.send(
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET!,
              Key: project.coverPdfS3Key,
            }),
          );
          const bufs: Buffer[] = [];
          for await (const chunk of res.Body as any)
            bufs.push(Buffer.from(chunk));
          fs.writeFileSync(cached, Buffer.concat(bufs));
        } catch (err) {
          console.error("S3 cover fetch for thumb failed:", err);
        }
      }
      if (fs.existsSync(cached)) srcPdf = cached;
    }
    if (!srcPdf) {
      return reply
        .status(404)
        .send({ success: false, error: "Cover PDF not found" });
    }

    const stale =
      !fs.existsSync(thumbPath) ||
      fs.statSync(thumbPath).mtimeMs < fs.statSync(srcPdf).mtimeMs;
    if (stale) {
      try {
        // pdftoppm appends .png to the output prefix
        const prefix = thumbPath.replace(/\.png$/, "");
        await execAsync(
          `pdftoppm -png -singlefile -scale-to 480 "${srcPdf}" "${prefix}"`,
          { timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
        );
      } catch (err: any) {
        console.error("Thumbnail render failed:", err.message);
      }
    }
    if (!fs.existsSync(thumbPath)) {
      return reply
        .status(404)
        .send({ success: false, error: "Thumbnail unavailable" });
    }

    return reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "private, max-age=300")
      .send(fs.readFileSync(thumbPath));
  });

  // ━━━ DELETE /api/projects/:id/cover ━━━
  // Remove cover entirely
  app.delete(
    "/api/projects/:id/cover",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as any;

      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
      });
      if (!project) {
        return reply.status(404).send({ success: false, error: "Not found" });
      }

      // Clean up S3 files if needed
      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        const keysToDelete = [
          (project as any).coverImageS3Key,
          (project as any).coverPdfS3Key,
        ].filter(Boolean);
        for (const key of keysToDelete) {
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: key,
              }),
            );
          } catch {
            /* non-fatal */
          }
        }
      }

      await prisma.project.update({
        where: { id },
        data: {
          coverType: "NONE",
          coverLatex: null,
          coverImageS3Key: null,
          coverImageLocalPath: null,
          coverPdfS3Key: null,
          coverPdfLocalPath: null,
          coverParams: null,
          coverUpdatedAt: new Date(),
        },
      });

      return reply.send({ success: true, message: "Cover removed" });
    },
  );
}
