// Dev-only: mint a short-lived session for the screenshot robot.
// Writes JSON to the path given as argv[2]; never prints tokens to stdout.
import "dotenv/config";
import { writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { createSigner } from "fast-jwt";

const out = process.argv[2];
if (!out) throw new Error("usage: tsx mintDemoSession.ts <outfile>");

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("no user");

  const sign = createSigner({
    key: process.env.JWT_SECRET!,
    expiresIn: 2 * 3600 * 1000,
  });
  const payload = { userId: user.id, email: user.email };
  const session = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    accessToken: sign({ ...payload, type: "access" }),
    refreshToken: sign({ ...payload, type: "refresh" }),
  };
  writeFileSync(out, JSON.stringify(session));
  console.log("session written for", user.email);
  await prisma.$disconnect();
}

main();
