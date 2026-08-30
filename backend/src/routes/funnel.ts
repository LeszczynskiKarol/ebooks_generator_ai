import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

// Funnel telemetry — the app posts one row per product step so the admin can
// see where a signed-up user stopped (open form → fill → abandon → checkout).
// Whitelisted event names only; meta is a small, bounded JSON object.
export const FUNNEL_EVENTS = [
  "dashboard_empty",
  "new_project_open",
  "new_project_filled",
  "new_project_abandon",
  "checkout_start",
  "checkout_created",
] as const;

const bodySchema = z.object({
  event: z.enum(FUNNEL_EVENTS),
  meta: z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
});

export async function funnelRoutes(app: FastifyInstance) {
  app.post(
    "/api/funnel",
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: "Bad event" });
      }
      const meta = parsed.data.meta;
      if (meta && Object.keys(meta).length > 20) {
        return reply.status(400).send({ success: false, error: "Meta too large" });
      }
      await prisma.funnelEvent.create({
        data: { userId: request.user.userId, event: parsed.data.event, meta: meta ?? undefined },
      });
      return reply.status(204).send();
    },
  );
}
