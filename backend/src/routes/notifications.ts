import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

// In-app notification feed — read by the web app's bell and the mobile app.
export async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ━━━ GET /api/notifications  (latest 50 + unread count) ━━━
  app.get("/api/notifications", async (request, reply) => {
    const userId = request.user.userId;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          projectId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return reply.send({ success: true, data: { items, unread } });
  });

  // ━━━ POST /api/notifications/read  ({ids?: string[]} — omit = all) ━━━
  app.post("/api/notifications/read", async (request, reply) => {
    const userId = request.user.userId;
    const b = (request.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(b.ids)
      ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 100)
      : null;
    await prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return reply.status(204).send();
  });
}
