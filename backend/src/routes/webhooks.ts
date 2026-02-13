import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma";

export async function webhookRoutes(app: FastifyInstance) {
  // Raw body parser for Stripe signature
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
    console.log(`\n💳 ═══ STRIPE WEBHOOK ═══ ${new Date().toISOString()}`);

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.log(
        `  ❌ Stripe not configured — missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET`,
      );
      return reply.status(500).send({ error: "Stripe not configured" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];
    if (!sig) {
      console.log(`  ❌ Missing stripe-signature header`);
      return reply.status(400).send({ error: "Missing signature" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (request as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
      console.log(`  ✅ Signature verified — event: ${event.type}`);
    } catch (err: any) {
      console.log(`  ❌ Invalid Stripe signature: ${err.message}`);
      return reply.status(400).send({ error: "Invalid signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectId = session.metadata?.projectId;
      const userId = session.metadata?.userId;

      console.log(`  💰 Payment completed:`);
      console.log(`     Session: ${session.id}`);
      console.log(`     Project: ${projectId || "MISSING!"}`);
      console.log(`     User: ${userId || "unknown"}`);
      console.log(
        `     Amount: ${session.amount_total ? (session.amount_total / 100).toFixed(2) : "?"} ${session.currency}`,
      );

      if (!projectId) {
        console.log(`  ❌ No projectId in session metadata — cannot proceed`);
        return reply.send({ received: true });
      }

      await prisma.project.update({
        where: { id: projectId },
        data: {
          paymentStatus: "PAID",
          stripePaymentId: session.payment_intent as string,
          paidAt: new Date(),
          currentStage: "STRUCTURE",
        },
      });
      console.log(`  ✅ Project marked PAID, stage → STRUCTURE`);

      // Launch pipeline: research → structure → (user approves) → content → compile
      console.log(`  🚀 Launching generation pipeline...`);
      const { generateStructure } =
        await import("../services/structureGenerator");
      generateStructure(projectId).catch((err) => {
        console.error(`  ❌ Pipeline failed for ${projectId}:`, err);
        prisma.project
          .update({
            where: { id: projectId },
            data: { currentStage: "ERROR", generationStatus: "ERROR" },
          })
          .catch(console.error);
      });
      console.log(`  ✅ Pipeline launched (background)\n`);
    } else {
      console.log(`  ℹ️  Ignoring event: ${event.type}`);
    }

    return reply.send({ received: true });
  });
}
