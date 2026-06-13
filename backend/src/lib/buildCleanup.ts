// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cleanup of tmp/builds and tmp/covers — these grew without bound
// (every compile leaves a full build dir behind). Final artifacts live
// in S3; the local dirs are only a working area + download fallback,
// so anything untouched for BUILD_RETENTION_DAYS is safe to drop.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import * as fs from "fs";
import * as path from "path";

const TMP_ROOTS = ["builds", "covers"].map((d) =>
  path.join(process.cwd(), "tmp", d),
);
const MAX_AGE_DAYS = Math.max(
  1,
  parseInt(process.env.BUILD_RETENTION_DAYS || "7", 10),
);

export function cleanupOldBuilds(): void {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  let removed = 0;

  for (const root of TMP_ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      const dir = path.join(root, entry);
      try {
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) continue;
        // dir mtime refreshes on every (re)compile, so active projects survive
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(dir, { recursive: true, force: true });
          removed++;
          console.log(`[CLEANUP] Removed stale build dir: ${dir}`);
        }
      } catch (err: any) {
        console.warn(`[CLEANUP] Could not clean ${dir}: ${err.message}`);
      }
    }
  }

  if (removed > 0) {
    console.log(`[CLEANUP] Removed ${removed} stale dir(s)`);
  }
}

/** Run once on startup, then daily. */
export function scheduleBuildCleanup(): void {
  try {
    cleanupOldBuilds();
  } catch (err: any) {
    console.warn(`[CLEANUP] Initial cleanup failed: ${err.message}`);
  }
  const timer = setInterval(cleanupOldBuilds, 24 * 3600 * 1000);
  timer.unref();
}
