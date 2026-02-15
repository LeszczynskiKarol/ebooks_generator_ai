// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Version Routes (PDF + EPUB + LaTeX)
// List & download any format for any version
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import * as fs from "fs";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUILD_DIR = path.join(process.cwd(), "tmp", "builds");

const FORMAT_CONFIG: Record<
  string,
  {
    s3KeyField: "s3Key" | "epubS3Key" | "texS3Key";
    localPathField: "localPath" | "epubLocalPath" | "texLocalPath";
    contentType: string;
    extension: string;
    fallbackFilename: string;
  }
> = {
  pdf: {
    s3KeyField: "s3Key",
    localPathField: "localPath",
    contentType: "application/pdf",
    extension: ".pdf",
    fallbackFilename: "book.pdf",
  },
  epub: {
    s3KeyField: "epubS3Key",
    localPathField: "epubLocalPath",
    contentType: "application/epub+zip",
    extension: ".epub",
    fallbackFilename: "book.epub",
  },
  tex: {
    s3KeyField: "texS3Key",
    localPathField: "texLocalPath",
    contentType: "application/x-tex",
    extension: ".tex",
    fallbackFilename: "book.tex",
  },
};

export async function versionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const queryToken = (request.query as any)?.token;
    if (queryToken && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    await authenticate(request, reply);
  });

  // ━━━ GET /api/projects/:id/versions ━━━
  // List all versions with format availability
  app.get("/api/projects/:id/versions", async (request, reply) => {
    const { id } = request.params as any;

    const project = await prisma.project.findFirst({
      where: { id, userId: request.user.userId },
      select: { id: true, currentVersion: true },
    });

    if (!project) {
      return reply
        .status(404)
        .send({ success: false, error: "Project not found" });
    }

    const versions = await prisma.bookVersion.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        // PDF
        s3Key: true,
        fileSize: true,
        pageCount: true,
        // EPUB
        epubS3Key: true,
        epubFileSize: true,
        // LaTeX
        texS3Key: true,
        texFileSize: true,
        // Meta
        note: true,
        createdAt: true,
      },
    });

    // Enrich with format availability flags
    const enriched = versions.map((v) => ({
      id: v.id,
      version: v.version,
      pageCount: v.pageCount,
      note: v.note,
      createdAt: v.createdAt,
      formats: {
        pdf: {
          available: !!v.s3Key,
          fileSize: v.fileSize,
        },
        epub: {
          available: !!v.epubS3Key,
          fileSize: v.epubFileSize,
        },
        tex: {
          available: !!v.texS3Key,
          fileSize: v.texFileSize,
        },
      },
    }));

    return reply.send({
      success: true,
      data: enriched,
      meta: { currentVersion: project.currentVersion },
    });
  });

  // ━━━ GET /api/projects/:id/versions/:version/download/:format ━━━
  // Download specific format for a specific version
  // format: "pdf" | "epub" | "tex"
  app.get(
    "/api/projects/:id/versions/:version/download/:format",
    async (request, reply) => {
      const { id, version: versionStr, format } = request.params as any;
      const versionNum = parseInt(versionStr);

      if (isNaN(versionNum) || versionNum < 1) {
        return reply
          .status(400)
          .send({ success: false, error: "Invalid version number" });
      }

      const formatCfg = FORMAT_CONFIG[format];
      if (!formatCfg) {
        return reply.status(400).send({
          success: false,
          error: `Invalid format: "${format}". Use: pdf, epub, or tex`,
        });
      }

      // Verify ownership
      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
        include: { structure: true },
      });

      if (!project) {
        return reply
          .status(404)
          .send({ success: false, error: "Project not found" });
      }

      // Find the version
      const bookVersion = await prisma.bookVersion.findUnique({
        where: { projectId_version: { projectId: id, version: versionNum } },
      });

      if (!bookVersion) {
        return reply.status(404).send({
          success: false,
          error: `Version ${versionNum} not found`,
        });
      }

      // Check if this format exists for this version
      const s3Key = (bookVersion as any)[formatCfg.s3KeyField] as string | null;
      const localPath = (bookVersion as any)[formatCfg.localPathField] as
        | string
        | null;

      if (!s3Key && !localPath) {
        return reply.status(404).send({
          success: false,
          error: `${format.toUpperCase()} not available for version ${versionNum}. This format may not have been generated for this version.`,
        });
      }

      // Build filename
      const structureData = project.structure
        ? JSON.parse(project.structure.structureJson)
        : null;
      const bookTitle =
        structureData?.suggestedTitle || project.title || project.topic;
      const filename = `${sanitize(bookTitle)}_v${versionNum}${formatCfg.extension}`;

      // Try S3
      if (s3Key && process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
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
              Key: s3Key,
              ResponseContentDisposition: `attachment; filename="${filename}"`,
            }),
            { expiresIn: 3600 },
          );

          return reply.redirect(url);
        } catch (err: any) {
          console.error(
            `S3 presign failed for v${versionNum} ${format}:`,
            err.message,
          );
        }
      }

      // Fallback: local file
      // Try: versioned path → generic build path
      const searchPaths = [
        localPath,
        path.join(BUILD_DIR, id, `v${versionNum}`, formatCfg.fallbackFilename),
        path.join(BUILD_DIR, id, formatCfg.fallbackFilename),
      ].filter(Boolean) as string[];

      const found = searchPaths.find((p) => fs.existsSync(p));
      if (!found) {
        return reply.status(404).send({
          success: false,
          error: `${format.toUpperCase()} file for version ${versionNum} not found locally.`,
        });
      }

      const buffer = fs.readFileSync(found);
      return reply
        .header("Content-Type", formatCfg.contentType)
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Content-Length", buffer.length)
        .send(buffer);
    },
  );

  // ━━━ BACKWARD COMPAT: GET /api/projects/:id/versions/:version/download ━━━
  // Old URL without format → defaults to PDF
  app.get(
    "/api/projects/:id/versions/:version/download",
    async (request, reply) => {
      const { id, version } = request.params as any;
      // Redirect to new URL with /pdf
      return reply.redirect(
        `/api/projects/${id}/versions/${version}/download/pdf?token=${(request.query as any)?.token || ""}`,
      );
    },
  );
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
