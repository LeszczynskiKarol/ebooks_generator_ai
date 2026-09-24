import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import {
  extractMaterialText,
  MaterialExtractError,
  MATERIAL_EXTENSIONS,
  materialExtension,
} from "../lib/materialExtract";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
/** Files one order can carry (enforced again when the project attaches them). */
export const MAX_MATERIALS_PER_PROJECT = 10;
/** Unattached uploads older than this belong to abandoned forms. */
const ORPHAN_TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_ORPHANS_PER_USER = 30;

function publicMaterial(m: {
  id: string;
  fileName: string;
  sizeBytes: number;
  charCount: number;
  truncated: boolean;
  role?: string | null;
}) {
  return {
    id: m.id,
    fileName: m.fileName,
    sizeBytes: m.sizeBytes,
    charCount: m.charCount,
    truncated: m.truncated,
    role: m.role ?? null,
  };
}

/**
 * Attach uploaded materials to a freshly created project. Only the caller's
 * own, still-unattached uploads are taken; anything else is silently ignored.
 */
export async function attachMaterials(
  userId: string,
  projectId: string,
  ids: unknown,
): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const clean = ids
    .filter((x): x is string => typeof x === "string")
    .slice(0, MAX_MATERIALS_PER_PROJECT);
  const res = await prisma.projectMaterial.updateMany({
    where: { id: { in: clean }, userId, projectId: null },
    data: { projectId },
  });
  return res.count;
}

export async function materialRoutes(app: FastifyInstance) {
  await app.register(import("@fastify/multipart"), {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  // ━━━ POST /api/materials — upload one file, get its extracted-text stats ━━━
  app.post("/api/materials", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const userId = request.user.userId;

      await prisma.projectMaterial.deleteMany({
        where: {
          userId,
          projectId: null,
          createdAt: { lt: new Date(Date.now() - ORPHAN_TTL_MS) },
        },
      });
      const orphans = await prisma.projectMaterial.count({
        where: { userId, projectId: null },
      });
      if (orphans >= MAX_ORPHANS_PER_USER) {
        return reply.status(429).send({
          success: false,
          code: "too_many",
          error: "Too many unattached files — remove some first",
        });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ success: false, error: "No file" });
      }
      const fileName = (file.filename || "file").slice(0, 200);
      if (!(MATERIAL_EXTENSIONS as readonly string[]).includes(materialExtension(fileName))) {
        file.file.resume();
        return reply.status(400).send({
          success: false,
          code: "unsupported",
          error: `Unsupported file type. Allowed: ${MATERIAL_EXTENSIONS.join(", ")}`,
        });
      }

      const buf = await file.toBuffer();
      if (file.file.truncated) {
        return reply.status(413).send({
          success: false,
          code: "too_large",
          error: `File larger than ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        });
      }

      try {
        const { text, truncated } = await extractMaterialText(buf, fileName);
        const row = await prisma.projectMaterial.create({
          data: {
            userId,
            fileName,
            mimeType: file.mimetype || null,
            sizeBytes: buf.length,
            charCount: text.length,
            truncated,
            text,
          },
        });
        return reply.status(201).send({ success: true, data: publicMaterial(row) });
      } catch (err: any) {
        if (err instanceof MaterialExtractError) {
          return reply.status(422).send({ success: false, code: err.code, error: err.message });
        }
        request.log.error(err, "material upload failed");
        return reply.status(500).send({ success: false, error: "Upload failed" });
      }
    },
  });

  // ━━━ DELETE /api/materials/:id — only uploads not yet attached to an order ━━━
  app.delete("/api/materials/:id", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.projectMaterial.deleteMany({
        where: { id, userId: request.user.userId, projectId: null },
      });
      return reply.send({ success: true });
    },
  });

  // ━━━ GET /api/projects/:id/materials — attached files (no text) ━━━
  app.get("/api/projects/:id/materials", {
    preHandler: authenticate,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const rows = await prisma.projectMaterial.findMany({
        where: { projectId: id, userId: request.user.userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          sizeBytes: true,
          charCount: true,
          truncated: true,
          role: true,
        },
      });
      return reply.send({ success: true, data: rows.map(publicMaterial) });
    },
  });
}
