// backend/src/routes/auth.ts
import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { authenticate, JwtPayload } from "../middleware/auth";
import {
  issueAuthToken,
  checkEmailCode,
  consumeAuthToken,
  lastTokenAgeMs,
} from "../lib/authTokens";
import {
  sendVerificationCodeEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../lib/email";
import { verifyRecaptcha } from "../lib/recaptcha";
import { emailLooksValid, isDisposableEmail } from "../lib/emailGuards";
import { signupMeta } from "../lib/signupMeta";

const RESEND_COOLDOWN_S = parseInt(process.env.EMAIL_RESEND_COOLDOWN || "60");
const APP_URL = process.env.PUBLIC_APP_URL || "http://localhost:5173";

function normLang(lang: unknown): string {
  return lang === "pl" ? "pl" : "en";
}

export async function authRoutes(app: FastifyInstance) {
  // ━━━ POST /api/auth/register ━━━
  // Creates an UNVERIFIED account and emails a 6-digit code.
  // No tokens are returned until the email is confirmed.
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, name, recaptchaToken, company, lang } =
      request.body as any;

    // Honeypot: real users never see/fill this field
    if (typeof company === "string" && company.trim() !== "") {
      return reply.send({ success: true, data: { requiresVerification: true } });
    }

    if (!email || !emailLooksValid(email)) {
      return reply
        .status(400)
        .send({ success: false, error: "Valid email required" });
    }
    if (isDisposableEmail(email)) {
      return reply
        .status(400)
        .send({ success: false, error: "Disposable email addresses are not allowed" });
    }
    if (!password || password.length < 8) {
      return reply
        .status(400)
        .send({ success: false, error: "Password must be at least 8 characters" });
    }

    // The mobile app cannot run reCAPTCHA Enterprise (web). It identifies
    // itself with an app key instead; the key is a shared secret in the app
    // binary (MOBILE_APP_KEY) — not bulletproof, but on par with the
    // honeypot + disposable-email guards above, and Play-signed builds
    // are the only ones that get it.
    const appKey = request.headers["x-app-key"];
    const mobileOk =
      typeof appKey === "string" &&
      !!process.env.MOBILE_APP_KEY &&
      appKey === process.env.MOBILE_APP_KEY;
    const captcha = mobileOk
      ? { ok: true, reason: "mobile_app_key" }
      : await verifyRecaptcha(recaptchaToken, "register", {
          strict: true,
        });
    if (!captcha.ok) {
      return reply
        .status(400)
        .send({ success: false, error: "Verification failed — please retry" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Unverified leftover account → allow re-registration (refresh password + code)
      if (!existing.emailVerified && existing.passwordHash && !existing.googleId) {
        const passwordHash = await bcrypt.hash(password, 12);
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, name: name || existing.name },
        });
        const code = await issueAuthToken(existing.id, "EMAIL_VERIFY");
        sendVerificationCodeEmail(email, code, normLang(lang));
        return reply.send({
          success: true,
          data: { requiresVerification: true, email },
        });
      }
      return reply
        .status(409)
        .send({ success: false, error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        ...signupMeta(request, (request.body as any)?.attribution),
      },
    });
    const code = await issueAuthToken(user.id, "EMAIL_VERIFY");
    sendVerificationCodeEmail(email, code, normLang(lang));

    return reply
      .status(201)
      .send({ success: true, data: { requiresVerification: true, email } });
  });

  // ━━━ POST /api/auth/verify-email ━━━
  // Confirms the 6-digit code and logs the user in.
  app.post("/api/auth/verify-email", async (request, reply) => {
    const { email, code, lang } = request.body as any;
    if (!email || !code) {
      return reply
        .status(400)
        .send({ success: false, error: "Email and code required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(400).send({ success: false, error: "Invalid code" });
    }
    if (user.emailVerified) {
      return reply
        .status(400)
        .send({ success: false, error: "Already verified — just log in" });
    }

    const result = await checkEmailCode(user.id, String(code));
    if (result !== "ok") {
      const msg =
        result === "expired"
          ? "Code expired — request a new one"
          : result === "too_many"
            ? "Too many attempts — request a new code"
            : "Invalid code";
      return reply.status(400).send({ success: false, error: msg, code: result });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    if (process.env.WELCOME_EMAIL_ENABLED === "true") {
      sendWelcomeEmail(user.email, user.name, normLang(lang));
    }

    const tokens = generateTokens(app, {
      userId: user.id,
      email: user.email,
      type: "access",
    });
    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        ...tokens,
      },
    });
  });

  // ━━━ POST /api/auth/resend-code ━━━
  // Anti-enumeration: always { ok }. 60s cooldown per user.
  app.post("/api/auth/resend-code", async (request, reply) => {
    const { email, recaptchaToken, lang } = request.body as any;
    if (!email) {
      return reply.status(400).send({ success: false, error: "Email required" });
    }
    const captcha = await verifyRecaptcha(recaptchaToken, "resend_code");
    if (!captcha.ok) {
      return reply
        .status(400)
        .send({ success: false, error: "Verification failed — please retry" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const age = await lastTokenAgeMs(user.id, "EMAIL_VERIFY");
      if (age !== null && age < RESEND_COOLDOWN_S * 1000) {
        const retryAfter = Math.ceil((RESEND_COOLDOWN_S * 1000 - age) / 1000);
        return reply
          .status(429)
          .send({ success: false, error: `Wait ${retryAfter}s before resending`, retryAfter });
      }
      const code = await issueAuthToken(user.id, "EMAIL_VERIFY");
      sendVerificationCodeEmail(email, code, normLang(lang));
    }
    return reply.send({ success: true });
  });

  // ━━━ POST /api/auth/forgot-password ━━━
  // Anti-enumeration: always { ok }, mail sent only for existing password accounts.
  app.post("/api/auth/forgot-password", async (request, reply) => {
    const { email, recaptchaToken, lang } = request.body as any;
    if (!email) {
      return reply.status(400).send({ success: false, error: "Email required" });
    }
    const captcha = await verifyRecaptcha(recaptchaToken, "forgot_password");
    if (!captcha.ok) {
      return reply
        .status(400)
        .send({ success: false, error: "Verification failed — please retry" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.passwordHash) {
      const age = await lastTokenAgeMs(user.id, "PASSWORD_RESET");
      if (age === null || age >= RESEND_COOLDOWN_S * 1000) {
        const token = await issueAuthToken(user.id, "PASSWORD_RESET");
        const link = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        sendPasswordResetEmail(email, link, normLang(lang));
      }
    }
    return reply.send({ success: true });
  });

  // ━━━ POST /api/auth/reset-password ━━━
  app.post("/api/auth/reset-password", async (request, reply) => {
    const { email, token, password } = request.body as any;
    if (!email || !token || !password || password.length < 8) {
      return reply.status(400).send({
        success: false,
        error: "Email, token and a password of 8+ characters are required",
      });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply
        .status(400)
        .send({ success: false, error: "Invalid or expired link" });
    }
    const valid = await consumeAuthToken(user.id, "PASSWORD_RESET", String(token));
    if (!valid) {
      return reply
        .status(400)
        .send({ success: false, error: "Invalid or expired link" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // owning the mailbox proves the address
        emailVerified: user.emailVerified ?? new Date(),
      },
    });

    const tokens = generateTokens(app, {
      userId: user.id,
      email: user.email,
      type: "access",
    });
    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        ...tokens,
      },
    });
  });

  // ━━━ POST /api/auth/login ━━━
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as any;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply
        .status(401)
        .send({ success: false, error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply
        .status(401)
        .send({ success: false, error: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return reply.status(403).send({
        success: false,
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const tokens = generateTokens(app, {
      userId: user.id,
      email: user.email,
      type: "access",
    });

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        },
        ...tokens,
      },
    });
  });

  // ━━━ POST /api/auth/google ━━━
  app.post("/api/auth/google", async (request, reply) => {
    const { credential, attribution } = request.body as any;
    if (!credential) {
      return reply
        .status(400)
        .send({ success: false, error: "Missing credential" });
    }

    try {
      const { OAuth2Client } = await import("google-auth-library");
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || payload.email_verified !== true) {
        return reply
          .status(401)
          .send({ success: false, error: "Invalid Google token" });
      }

      let user = await prisma.user.findFirst({
        where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
      });

      let isNew = false;
      if (!user) {
        isNew = true;
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || null,
            googleId: payload.sub,
            avatarUrl: payload.picture || null,
            emailVerified: new Date(), // Google already verified the address
            ...signupMeta(request, attribution),
          },
        });
      } else if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: payload.sub,
            avatarUrl: user.avatarUrl || payload.picture,
            emailVerified: user.emailVerified ?? new Date(),
          },
        });
      } else if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }

      const tokens = generateTokens(app, {
        userId: user.id,
        email: user.email,
        type: "access",
      });
      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
          },
          isNew,
          ...tokens,
        },
      });
    } catch {
      return reply
        .status(401)
        .send({ success: false, error: "Google auth failed" });
    }
  });

  // ━━━ POST /api/auth/refresh ━━━
  app.post("/api/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as any;
    if (!refreshToken) {
      return reply
        .status(400)
        .send({ success: false, error: "Refresh token required" });
    }
    try {
      const decoded = app.jwt.verify<JwtPayload>(refreshToken);
      if (decoded.type !== "refresh") {
        return reply
          .status(401)
          .send({ success: false, error: "Invalid token type" });
      }
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user)
        return reply
          .status(401)
          .send({ success: false, error: "User not found" });

      const tokens = generateTokens(app, {
        userId: user.id,
        email: user.email,
        type: "access",
      });
      return reply.send({ success: true, data: tokens });
    } catch {
      return reply
        .status(401)
        .send({ success: false, error: "Invalid refresh token" });
    }
  });

  // ━━━ GET /api/auth/me ━━━
  app.get(
    "/api/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
        },
      });
      if (!user)
        return reply
          .status(404)
          .send({ success: false, error: "User not found" });
      const adminEmail = process.env.ADMIN_EMAIL;
      const isAdmin =
        !!adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
      // Generation lock removed — every user may generate.
      const generationLocked = false;
      return reply.send({
        success: true,
        data: { ...user, isAdmin, generationLocked },
      });
    },
  );
}

function generateTokens(app: FastifyInstance, payload: JwtPayload) {
  const accessToken = app.jwt.sign(
    { ...payload, type: "access" },
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" },
  );
  const refreshToken = app.jwt.sign(
    { ...payload, type: "refresh" },
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" },
  );
  return { accessToken, refreshToken };
}
