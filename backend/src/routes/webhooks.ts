import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { generateStructure } from "../services/structureGenerator";

export async function webhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      (req as any).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err: any) {
        done(err, undefined);
      }
    },
  );

  app.post("/api/webhooks/stripe", async (request, reply) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return reply.status(500).send({ error: "Stripe not configured" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];
    if (!sig) return reply.status(400).send({ error: "Missing signature" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectId = session.metadata?.projectId;
      if (projectId) {
        console.log(`✅ Payment confirmed for project ${projectId}`);
        await prisma.project.update({
          where: { id: projectId },
          data: {
            paymentStatus: "PAID",
            stripePaymentId: session.payment_intent as string,
            paidAt: new Date(),
            currentStage: "STRUCTURE",
          },
        });

        // Generate structure in background (don't await — return webhook fast)
        generateStructure(projectId).catch((err) => {
          console.error("Structure generation failed:", err);
        });
      }
    }

    return reply.send({ received: true });
  });
}
