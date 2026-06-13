// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Single-use auth tokens: 6-digit email codes & password-reset secrets.
// Pattern ported from kurs-copywritingu.pl: store SHA256 hashes only,
// short TTLs, attempt counter against brute force, atomic consumption.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "./prisma";
import type { AuthTokenType } from "@prisma/client";

const TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 15 * 60 * 1000, // 15 min
  PASSWORD_RESET: 30 * 60 * 1000, // 30 min
};
export const MAX_CODE_ATTEMPTS = 5;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Cryptographically random 6-digit code (000000–999999). */
export function generateNumericCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Issue a fresh token of the given type (invalidates previous unused ones).
 * Returns the RAW secret — the only moment it exists in plaintext.
 */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  const raw =
    type === "EMAIL_VERIFY" ? generateNumericCode() : randomBytes(32).toString("hex");

  await prisma.authToken.deleteMany({
    where: { userId, type, usedAt: null },
  });
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + TTL_MS[type]),
    },
  });
  return raw;
}

export type CodeCheckResult = "ok" | "invalid" | "expired" | "too_many";

/** Verify a 6-digit email code; counts attempts, single-use. */
export async function checkEmailCode(
  userId: string,
  code: string,
): Promise<CodeCheckResult> {
  const token = await prisma.authToken.findFirst({
    where: { userId, type: "EMAIL_VERIFY", usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return "invalid";
  if (token.expiresAt < new Date()) return "expired";
  if (token.attempts >= MAX_CODE_ATTEMPTS) return "too_many";

  if (token.tokenHash !== sha256(code.trim())) {
    await prisma.authToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return token.attempts + 1 >= MAX_CODE_ATTEMPTS ? "too_many" : "invalid";
  }

  // mark used atomically — a parallel request loses the race
  const consumed = await prisma.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1 ? "ok" : "invalid";
}

/** Consume a long token (password reset). Returns true when valid + unused. */
export async function consumeAuthToken(
  userId: string,
  type: AuthTokenType,
  raw: string,
): Promise<boolean> {
  const consumed = await prisma.authToken.updateMany({
    where: {
      userId,
      type,
      tokenHash: sha256(raw),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  return consumed.count === 1;
}

/** Age (ms) of the newest token of a type — used for resend cooldowns. */
export async function lastTokenAgeMs(
  userId: string,
  type: AuthTokenType,
): Promise<number | null> {
  const token = await prisma.authToken.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return token ? Date.now() - token.createdAt.getTime() : null;
}
