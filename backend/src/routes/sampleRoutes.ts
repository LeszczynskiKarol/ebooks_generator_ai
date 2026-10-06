import fs from "fs";
import path from "path";
import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { checkPreviewLimits } from "../services/previewGenerator";
import {
  SAMPLE_DIR,
  SAMPLE_GLOBAL_DAY,
  SAMPLE_MAX_PAGES,
  canStartSample,
  readSample,
  startSample,
} from "../services/sampleGenerator";

// Free pre-payment style sample — see services/sampleGenerator.ts.
export async function sampleRoutes(app: FastifyInstance) {
  // ━━━ POST /api/projects/:id/sample ━━━  start (async; poll GET)
  app.post(
    "/api/projects/:id/sample",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as any;
      const userId = request.user.userId;
      const project = await prisma.project.findFirst({ where: { id, userId } });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });
      if (project.paymentStatus === "PAID")
        return reply.status(400).send({ success: false, error: "Already paid" });
      const pv = project.preview as any;
      if (!pv || pv.rejected || !Array.isArray(pv.chapters) || !pv.chapters.length)
        return reply.status(400).send({ success: false, error: "No preview yet" });

      const current = readSample(project.sample);
      if (!canStartSample(current)) {
        // Already running/ready (or out of retries): just report the state.
        return reply.send({ success: true, data: { sample: current } });
      }

      const admin =
        !!process.env.ADMIN_EMAIL && request.user.email === process.env.ADMIN_EMAIL;
      if (!admin) {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const samplesToday = await prisma.previewLog.count({
          where: { model: "sample", createdAt: { gte: since } },
        });
        if (samplesToday >= SAMPLE_GLOBAL_DAY) {
          return reply
            .status(429)
            .send({ success: false, code: "SAMPLE_BUSY", error: "Try later" });
        }
        const limit = await checkPreviewLimits({
          userId,
          ip: request.ip || null,
          isAdmin: false,
        });
        if (limit) {
          return reply
            .status(429)
            .send({ success: false, code: limit, error: "Limit reached" });
        }
      }

      const sample = await startSample(id, userId, request.ip || null);
      return reply.status(202).send({ success: true, data: { sample } });
    },
  );

  // ━━━ GET /api/projects/:id/sample ━━━  status
  app.get(
    "/api/projects/:id/sample",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as any;
      const project = await prisma.project.findFirst({
        where: { id, userId: request.user.userId },
        select: { sample: true },
      });
      if (!project)
        return reply.status(404).send({ success: false, error: "Not found" });
      return reply.send({ success: true, data: { sample: readSample(project.sample) } });
    },
  );

  // ━━━ GET /api/projects/:id/sample/page/:n ━━━  PNG
  // ?token= because <img> cannot send an Authorization header (as cover/thumb).
  app.get("/api/projects/:id/sample/page/:n", async (request, reply) => {
    const { id, n } = request.params as any;
    const token =
      (request.query as any)?.token ||
      request.headers.authorization?.replace("Bearer ", "");
    if (!token) return reply.status(401).send({ success: false, error: "Unauthorized" });
    let userId: string;
    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(token);
      if (decoded.type !== "access") throw new Error("bad type");
      userId = decoded.userId;
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }
    const page = parseInt(n, 10);
    if (!Number.isInteger(page) || page < 1 || page > SAMPLE_MAX_PAGES)
      return reply.status(404).send({ success: false, error: "Not found" });
    const project = await prisma.project.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!project) return reply.status(404).send({ success: false, error: "Not found" });
    const file = path.join(SAMPLE_DIR, project.id, `page-${page}.png`);
    if (!fs.existsSync(file))
      return reply.status(404).send({ success: false, error: "Not found" });
    reply.header("Content-Type", "image/png");
    reply.header("Cache-Control", "private, max-age=300");
    return reply.send(fs.createReadStream(file));
  });
}
