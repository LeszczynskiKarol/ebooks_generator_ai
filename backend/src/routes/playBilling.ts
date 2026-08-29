// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Google Play Billing routes (mobile app)
//   GET  /api/play/products         — SKU catalog + package name (public)
//   POST /api/play/verify           — app reports a purchase; server verifies
//                                     with Play and marks the project PAID
//   POST /api/play/rtdn             — Pub/Sub push: voided purchases
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth";
import {
  PLAY_PACKAGE_NAME,
  PLAY_PRODUCTS,
  PLAY_SKUS,
  isPlayBillingConfigured,
  skuForPages,
  verifyAndApply,
  voidPurchase,
} from "../lib/playBilling";

export async function playBillingRoutes(app: FastifyInstance) {
  app.get("/api/play/products", async () => ({
    success: true,
    data: {
      configured: isPlayBillingConfigured(),
      packageName: PLAY_PACKAGE_NAME,
      skus: PLAY_SKUS,
      catalog: PLAY_PRODUCTS,
    },
  }));

  app.post(
    "/api/play/verify",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { productId, purchaseToken, projectId } = (request.body || {}) as {
        productId?: string;
        purchaseToken?: string;
        projectId?: string;
      };
      if (!productId || !purchaseToken || !projectId) {
        return reply
          .status(400)
          .send({ success: false, error: "productId, purchaseToken and projectId required" });
      }
      if (!isPlayBillingConfigured()) {
        app.log.error("Play Billing: service account not configured");
        return reply
          .status(503)
          .send({ success: false, error: "Purchase verification temporarily unavailable", retryable: true });
      }
      try {
        const result = await verifyAndApply({
          productId,
          purchaseToken,
          projectId,
          userId: request.user.userId,
        });
        console.log(
          `  🛒 Play verify ${productId} project=${projectId} → ${result.granted ? "GRANTED" : "DENIED"} (${result.reason})`,
        );
        return reply.send({ success: true, data: result });
      } catch (e: any) {
        // A Play/API failure must not look like a rejected purchase — the
        // user paid. The app keeps the purchase in the Play queue and retries.
        app.log.error(`Play verify failed (${productId}): ${e?.message}`);
        return reply.status(502).send({
          success: false,
          error: "Could not confirm the purchase yet. It will be retried automatically.",
          retryable: true,
        });
      }
    },
  );

  /** Which SKU a project needs — the app asks before opening the store sheet. */
  app.get(
    "/api/play/sku/:pages",
    { preHandler: [authenticate] },
    async (request) => {
      const pages = parseInt((request.params as any).pages) || 60;
      return { success: true, data: { sku: skuForPages(pages) } };
    },
  );

  // Pub/Sub push subscription (configure the topic in Play Console →
  // Monetization setup). Only voided purchases matter for one-time products.
  app.post("/api/play/rtdn", async (request, reply) => {
    try {
      const msg = (request.body as any)?.message?.data;
      if (!msg) return reply.send({ received: true });
      const payload = JSON.parse(Buffer.from(msg, "base64").toString("utf-8"));
      const voided = payload?.voidedPurchaseNotification?.purchaseToken;
      if (voided) await voidPurchase(voided);
      return reply.send({ received: true });
    } catch (e: any) {
      app.log.warn(`RTDN parse failed: ${e?.message}`);
      return reply.send({ received: true });
    }
  });
}
