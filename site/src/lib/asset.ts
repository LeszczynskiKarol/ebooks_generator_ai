import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// /samples/* is served with "immutable, max-age=1y", and a rebuilt cover or
// PDF keeps its file name: browsers kept showing the old file (2026-10-07,
// Excel cover). Append a content hash so every change gets a new URL.
const cache = new Map<string, string>();

export function versioned(url: string): string {
  const hit = cache.get(url);
  if (hit) return hit;
  let out = url;
  try {
    const buf = readFileSync(join(process.cwd(), "public", url.replace(/^\//, "")));
    out = `${url}?v=${createHash("md5").update(buf).digest("hex").slice(0, 8)}`;
  } catch {
    // file not in public/ (e.g. PDF only on S3): leave the URL as it is
  }
  cache.set(url, out);
  return out;
}
