// backend/src/lib/signupMeta.ts
// Attribution snapshot stored on User at account creation. Answers "who is
// this and where did they come from" without a separate analytics pipeline.
import type { FastifyRequest } from "fastify";

export interface ClientAttribution {
  referrer?: unknown;
  landing?: unknown;
}

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export function signupMeta(req: FastifyRequest, attribution?: ClientAttribution) {
  const h = req.headers;
  // request.ip honours X-Forwarded-For because Fastify runs with trustProxy.
  const country = clip(h["cloudfront-viewer-country"], 2)?.toUpperCase() ?? null;
  return {
    signupIp: clip(req.ip, 64),
    signupCountry: country,
    signupUserAgent: clip(h["user-agent"], 512),
    signupReferrer: clip(attribution?.referrer, 1024),
    signupLanding: clip(attribution?.landing, 2048),
  };
}
