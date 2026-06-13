import { Queue, Worker } from "bullmq";
import { prisma } from "./prisma";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Durable job queue for the generation pipeline.
//
// Every long-running pipeline step (structure, content, compile, research)
// goes through this queue instead of fire-and-forget promises, so that:
//  - a backend restart/crash does not silently lose the job (BullMQ persists
//    jobs in Redis; stalled jobs are re-queued automatically),
//  - the same job cannot run twice for one project (jobId = type:projectId),
//  - the number of concurrent generations is bounded.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_NAME = "generation";

export type GenerationJobName = "structure" | "content" | "compile" | "research";

export interface GenerationJobData {
  projectId: string;
  /** content only: regenerate even chapters that are already LATEX_READY (user-edited chapters are always kept) */
  force?: boolean;
}

// BullMQ bundles its own ioredis, so we pass plain connection options
// (not an IORedis instance) and let BullMQ create the connections.
function redisOptions(extra: Record<string, unknown>) {
  const u = new URL(REDIS_URL);
  return {
    host: u.hostname,
    port: parseInt(u.port || "6379"),
    password: u.password || undefined,
    db: parseInt(u.pathname.slice(1)) || 0,
    ...extra,
  };
}

export const generationQueue = new Queue<
  GenerationJobData,
  unknown,
  GenerationJobName
>(QUEUE_NAME, {
  // Fail fast when Redis is down so HTTP handlers don't hang.
  connection: redisOptions({
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  }),
});
generationQueue.on("error", (err) => {
  console.error(`[QUEUE] Redis connection error: ${err.message}`);
});

function jobIdFor(name: GenerationJobName, projectId: string) {
  // BullMQ forbids ":" in custom job ids
  return `${name}--${projectId}`;
}

export interface EnqueueResult {
  enqueued: boolean;
  /** present when a job for this project+type already exists */
  existingState?: string;
}

/**
 * Enqueue a pipeline job. Returns { enqueued: false } when the same job
 * is already waiting or running for this project (idempotency guard).
 */
export async function enqueueGeneration(
  name: GenerationJobName,
  projectId: string,
  opts: { force?: boolean } = {},
): Promise<EnqueueResult> {
  const jobId = jobIdFor(name, projectId);

  const existing = await generationQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      return { enqueued: false, existingState: state };
    }
    // completed/failed leftover — remove so the jobId can be reused
    await existing.remove();
  }

  await generationQueue.add(
    name,
    { projectId, force: opts.force },
    {
      jobId,
      attempts: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  );
  return { enqueued: true };
}

// ━━━ Worker ━━━

async function processJob(name: GenerationJobName, data: GenerationJobData) {
  const { projectId, force } = data;
  switch (name) {
    case "structure": {
      const { generateStructure } = await import("../services/structureGenerator");
      await generateStructure(projectId);
      break;
    }
    case "content": {
      const { generateContent } = await import("../services/contentGenerator");
      await generateContent(projectId, { force });
      break;
    }
    case "compile": {
      const { compileBook } = await import("../services/bookCompiler");
      await compileBook(projectId);
      break;
    }
    case "research": {
      const { conductResearch } = await import("../services/researchService");
      await conductResearch(projectId);
      break;
    }
  }
}

export function startGenerationWorker() {
  const concurrency = parseInt(process.env.GENERATION_CONCURRENCY || "2");

  const worker = new Worker<GenerationJobData, unknown, GenerationJobName>(
    QUEUE_NAME,
    async (job) => {
      console.log(`[WORKER] ▶ ${job.name}:${job.data.projectId} started`);
      await processJob(job.name, job.data);
      console.log(`[WORKER] ✔ ${job.name}:${job.data.projectId} done`);
    },
    {
      // Workers need a blocking connection — BullMQ enforces
      // maxRetriesPerRequest: null on it.
      connection: redisOptions({ maxRetriesPerRequest: null }),
      concurrency,
    },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { projectId } = job.data;
    console.error(`[WORKER] ✖ ${job.name}:${projectId} failed:`, err);
    try {
      if (job.name === "structure" || job.name === "content") {
        await prisma.project.update({
          where: { id: projectId },
          data: { currentStage: "ERROR", generationStatus: "ERROR" },
        });
      } else if (job.name === "compile") {
        // Recompile of a finished book — revert so the user can retry.
        await prisma.project.update({
          where: { id: projectId },
          data: { currentStage: "COMPLETED", generationStatus: "COMPLETED" },
        });
      }
    } catch (e) {
      console.error(`[WORKER] Failed to mark project ${projectId}:`, e);
    }
  });

  worker.on("error", (err) => {
    console.error(`[WORKER] Worker error: ${err.message}`);
  });

  console.log(
    `[WORKER] Generation worker started (concurrency=${concurrency}, redis=${REDIS_URL})`,
  );
  return worker;
}

// ━━━ Startup recovery ━━━

/**
 * Re-enqueue work for projects stuck in a transient generation state.
 * Covers jobs that were lost before the queue existed (fire-and-forget era)
 * or when Redis was flushed. enqueueGeneration() dedupes against jobs that
 * BullMQ itself already recovered.
 */
export async function recoverInterruptedJobs() {
  const stuck = await prisma.project.findMany({
    where: {
      generationStatus: {
        in: [
          "GENERATING_STRUCTURE",
          "GENERATING_CONTENT",
          "REVIEWING_CONTENT",
          "CONTENT_READY",
          "COMPILING_LATEX",
          "COMPILING_EPUB",
        ],
      },
    },
    select: { id: true, generationStatus: true, currentStage: true },
  });

  if (stuck.length === 0) {
    console.log("[RECOVERY] No interrupted generations found");
    return;
  }

  for (const p of stuck) {
    // On-demand EPUB regeneration of a finished book: just clear the flag,
    // the user can re-trigger it (cheap), no need to rebuild the whole PDF.
    if (p.generationStatus === "COMPILING_EPUB" && p.currentStage === "COMPLETED") {
      await prisma.project.update({
        where: { id: p.id },
        data: { generationStatus: "COMPLETED" },
      });
      console.log(`[RECOVERY] ${p.id}: cleared interrupted EPUB regeneration`);
      continue;
    }

    let jobName: GenerationJobName;
    switch (p.generationStatus) {
      case "GENERATING_STRUCTURE":
        jobName = "structure";
        break;
      case "GENERATING_CONTENT":
      case "REVIEWING_CONTENT":
        jobName = "content"; // resumes — finished chapters are kept
        break;
      default:
        jobName = "compile";
        break;
    }

    const result = await enqueueGeneration(jobName, p.id);
    console.log(
      `[RECOVERY] ${p.id} (${p.generationStatus}) → ${jobName} ${
        result.enqueued ? "re-enqueued" : `already ${result.existingState}`
      }`,
    );
  }
}
