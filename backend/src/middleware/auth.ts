// backend/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

export interface JwtPayload {
  userId: string;
  email: string;
  type: string;
}

// Last activity for the admin users list: any authenticated request counts,
// written at most once per 10 minutes per user (fire-and-forget, in-process
// throttle) so normal app use does not turn into a DB write per request.
const ACTIVE_EVERY_MS = 10 * 60 * 1000;
const lastWrite = new Map<string, number>();
function touchActive(userId: string) {
  const now = Date.now();
  if (now - (lastWrite.get(userId) ?? 0) < ACTIVE_EVERY_MS) return;
  lastWrite.set(userId, now);
  prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } }).catch(() => {});
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
    if (request.user?.userId) touchActive(request.user.userId);
  } catch (err) {
    reply.status(401).send({ success: false, error: "Unauthorized" });
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
