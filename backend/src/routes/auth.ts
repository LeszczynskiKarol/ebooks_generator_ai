import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { authenticate, JwtPayload } from "../middleware/auth";

export async function authRoutes(app: FastifyInstance) {

  // ━━━ POST /api/auth/register ━━━
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, name } = request.body as any;

    if (!email || !password || password.length < 8) {
      return reply.status(400).send({ success: false, error: "Email and password (8+ chars) required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ success: false, error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });
    const tokens = generateTokens(app, { userId: user.id, email: user.email, type: "access" });

    return reply.status(201).send({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
        ...tokens,
      },
    });
  });

  // ━━━ POST /api/auth/login ━━━
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as any;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ success: false, error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ success: false, error: "Invalid credentials" });
    }

    const tokens = generateTokens(app, { userId: user.id, email: user.email, type: "access" });

    return reply.send({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
        ...tokens,
      },
    });
  });

  // ━━━ POST /api/auth/google ━━━
  app.post("/api/auth/google", async (request, reply) => {
    const { credential } = request.body as any;
    if (!credential) {
      return reply.status(400).send({ success: false, error: "Missing credential" });
    }

    try {
      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        return reply.status(401).send({ success: false, error: "Invalid Google token" });
      }

      let user = await prisma.user.findFirst({
        where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || null,
            googleId: payload.sub,
            avatarUrl: payload.picture || null,
          },
        });
      } else if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, avatarUrl: user.avatarUrl || payload.picture },
        });
      }

      const tokens = generateTokens(app, { userId: user.id, email: user.email, type: "access" });
      return reply.send({
        success: true,
        data: { user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }, ...tokens },
      });
    } catch {
      return reply.status(401).send({ success: false, error: "Google auth failed" });
    }
  });

  // ━━━ POST /api/auth/refresh ━━━
  app.post("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) {
      return reply.status(400).send({ success: false, error: "Refresh token required" });
    }
    try {
      const decoded = app.jwt.verify<JwtPayload>(refreshToken);
      if (decoded.type !== "refresh") {
        return reply.status(401).send({ success: false, error: "Invalid token type" });
      }
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return reply.status(401).send({ success: false, error: "User not found" });

      const tokens = generateTokens(app, { userId: user.id, email: user.email, type: "access" });
      return reply.send({ success: true, data: tokens });
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid refresh token" });
    }
  });

  // ━━━ GET /api/auth/me ━━━
  app.get("/api/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });
    return reply.send({ success: true, data: user });
  });
}

function generateTokens(app: FastifyInstance, payload: JwtPayload) {
  const accessToken = app.jwt.sign(
    { ...payload, type: "access" },
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
  const refreshToken = app.jwt.sign(
    { ...payload, type: "refresh" },
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
  return { accessToken, refreshToken };
}
