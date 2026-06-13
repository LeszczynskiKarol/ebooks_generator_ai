import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { authRoutes } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { webhookRoutes } from "./routes/webhooks";
import { adminRoutes } from "./routes/admin";
import { downloadRoutes } from "./routes/downloads";
import { versionRoutes } from "./routes/versionRoutes";
import { coverRoutes } from "./routes/coverRoutes";
import { chapterEditRoutes } from "./routes/chapterEditRoutes";
import { epubDownloadRoutes } from "./routes/epubDownloadRoutes";
import { imageRoutes } from "./routes/imageRoutes";
import {
  startGenerationWorker,
  recoverInterruptedJobs,
} from "./lib/jobQueue";
import { scheduleBuildCleanup } from "./lib/buildCleanup";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000");
const HOST = "0.0.0.0";

// JWT secret is mandatory in production — a guessable fallback would let
// anyone forge tokens.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET must be set in production");
    process.exit(1);
  }
  console.warn("⚠️  JWT_SECRET not set — using insecure dev-only secret");
}

async function start() {
  const app = Fastify({
    logger: {
      level: "error",
      transport: { target: "pino-pretty", options: { colorize: true } },
    },
    bodyLimit: 50 * 1024 * 1024,
    disableRequestLogging: true,
  });

  // ── Plugins ──
  await app.register(cors, {
    origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  // ── Routes ──
  await app.register(webhookRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(coverRoutes);
  await app.register(downloadRoutes);
  await app.register(projectRoutes);
  await app.register(chapterEditRoutes);
  await app.register(versionRoutes);
  await app.register(epubDownloadRoutes);
  await app.register(imageRoutes);

  // ── Health check ──
  app.get("/api/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  }));

  // ── Error handler ──
  app.setErrorHandler(
    (error: Error & { statusCode?: number }, request, reply) => {
      app.log.error(error);
      const statusCode = error.statusCode || 500;
      reply.status(statusCode).send({
        success: false,
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      });
    },
  );

  // ── Start ──
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`
╔══════════════════════════════════════════════╗
║  📚 BookForge.ai API                        ║
║  🌐 http://localhost:${PORT}                     ║
╚══════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Generation job worker + crash recovery ──
  const worker = startGenerationWorker();
  recoverInterruptedJobs().catch((err) => {
    console.error("[RECOVERY] Failed to recover interrupted jobs:", err);
  });
  scheduleBuildCleanup();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down...`);
    try {
      await worker.close();
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start();
