// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Google Play Billing — server-side verification of one-time purchases.
//
// The mobile app pays for a book with a Play in-app product whose SKU maps
// to a pricing tier (same tiers as Stripe on the web). The app gets a
// purchaseToken; it is NOT trusted — only the Play Developer API says whether
// the purchase exists, is paid and for which product. This module is the only
// place that turns a token into a PAID project (the Stripe webhook is the
// only other one), so both payment paths end in the same state:
//   paymentStatus PAID, currentStage STRUCTURE, structure job enqueued.
//
// Order of operations (never reversed):
//   1. app: Play returns purchaseToken
//   2. app → POST /api/play/verify → this module verifies with Play,
//      acknowledges the purchase and marks the project PAID
//   3. app: finishTransaction({ isConsumable: true }) — the SKU is consumable
//      (one purchase = one book; the same product is bought again for the
//      next book), so consumption on the device clears the way.
//
// Required env:
//   PLAY_PACKAGE_NAME   — Android applicationId (default com.inkmagnet.app)
//   PLAY_SA_KEY_FILE    — service-account JSON with "View financial data"
//                         + "Manage orders" on the app in Play Console
//                         (or PLAY_SA_KEY_JSON inline, or ADC)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";
import { prisma } from "./prisma";
import { PRICING_TIERS, calculatePrice } from "./types";

const API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export const PLAY_PACKAGE_NAME =
  process.env.PLAY_PACKAGE_NAME || "com.inkmagnet.app";

// ── Product catalog ──
// SKU per pricing tier. IDs must be IDENTICAL to Play Console. Prices are NOT
// kept here: the app shows the store's localized displayPrice; the backend
// only cares which tier a SKU unlocks (so a cheap SKU cannot pay for a big
// book — see verifyAndApply).
export interface PlayProductSpec {
  tierLabel: string; // PRICING_TIERS[].label
  minPages: number;
  maxPages: number;
  /** Suggested store price in USD cents (for the product-creation script) */
  priceUsdCents: number;
}

export const PLAY_PRODUCTS: Record<string, PlayProductSpec> = Object.fromEntries(
  PRICING_TIERS.map((t) => [
    `book_${t.label.toLowerCase()}`,
    {
      tierLabel: t.label,
      minPages: t.minPages,
      maxPages: t.maxPages,
      priceUsdCents: t.priceUsdCents,
    },
  ]),
);

export const PLAY_SKUS = Object.keys(PLAY_PRODUCTS);

/** SKU the app must buy for a project of `pages` pages. */
export function skuForPages(pages: number): string {
  const { tier } = calculatePrice(pages);
  return `book_${tier.label.toLowerCase()}`;
}

// ── Auth ──
let _auth: GoogleAuth | null = null;
function auth(): GoogleAuth {
  if (_auth) return _auth;
  const inline = process.env.PLAY_SA_KEY_JSON;
  const file = process.env.PLAY_SA_KEY_FILE;
  if (inline) {
    _auth = new GoogleAuth({ credentials: JSON.parse(inline), scopes: [SCOPE] });
  } else if (file) {
    _auth = new GoogleAuth({
      credentials: JSON.parse(readFileSync(file, "utf-8")),
      scopes: [SCOPE],
    });
  } else {
    _auth = new GoogleAuth({ scopes: [SCOPE] }); // ADC fallback
  }
  return _auth;
}

export function isPlayBillingConfigured(): boolean {
  return !!(
    process.env.PLAY_SA_KEY_JSON ||
    process.env.PLAY_SA_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

async function callPlay<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const client = await auth().getClient();
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error("Play API: no access token");
  const res = await fetch(`${API_ROOT}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Play API ${res.status} ${path}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface PlayProductPurchase {
  purchaseState?: number; // 0 purchased, 1 canceled, 2 pending
  consumptionState?: number; // 0 yet to be consumed, 1 consumed
  acknowledgementState?: number; // 0 yet to be acknowledged, 1 acknowledged
  orderId?: string;
  productId?: string;
  purchaseTimeMillis?: string;
  purchaseType?: number; // 0 test, 1 promo, 2 rewarded
  obfuscatedExternalAccountId?: string;
  regionCode?: string;
}

export function getProductPurchase(
  productId: string,
  purchaseToken: string,
  packageName = PLAY_PACKAGE_NAME,
): Promise<PlayProductPurchase> {
  return callPlay<PlayProductPurchase>(
    `/applications/${packageName}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
  );
}

/** Acknowledge — Play refunds unacknowledged purchases after 3 days. 400 = already done. */
export async function acknowledgeProduct(
  productId: string,
  purchaseToken: string,
  packageName = PLAY_PACKAGE_NAME,
): Promise<void> {
  try {
    await callPlay(
      `/applications/${packageName}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      { method: "POST", body: {} },
    );
  } catch (e: any) {
    if (e?.status !== 400) throw e;
  }
}

export interface ApplyResult {
  granted: boolean;
  reason: string;
  projectId?: string;
  /** already granted earlier for the same token — idempotent replay */
  duplicate?: boolean;
}

/**
 * Verify the token with Play and, if it is a real paid purchase of the right
 * tier, mark the project PAID and start the pipeline. Idempotent on
 * purchaseToken (PlayPurchase.purchaseToken is unique).
 */
export async function verifyAndApply(params: {
  purchaseToken: string;
  productId: string;
  projectId: string;
  userId: string;
  packageName?: string;
}): Promise<ApplyResult> {
  const { purchaseToken, productId, projectId, userId } = params;
  const packageName = params.packageName || PLAY_PACKAGE_NAME;

  const spec = PLAY_PRODUCTS[productId];
  if (!spec) return { granted: false, reason: `Unknown product: ${productId}` };

  const existing = await prisma.playPurchase.findUnique({ where: { purchaseToken } });
  if (existing && existing.userId !== userId) {
    return { granted: false, reason: "Token belongs to another account" };
  }
  if (existing?.granted) {
    return {
      granted: true,
      duplicate: true,
      reason: "Purchase already applied",
      projectId: existing.projectId || undefined,
    };
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return { granted: false, reason: "Project not found" };
  if (project.paymentStatus === "PAID") {
    return { granted: true, duplicate: true, reason: "Project already paid", projectId };
  }

  // The SKU must cover the project's tier — a Compact purchase cannot pay
  // for a Comprehensive book.
  const requiredSku = skuForPages(project.targetPages);
  if (requiredSku !== productId) {
    return {
      granted: false,
      reason: `Product ${productId} does not match this book's tier (${requiredSku})`,
    };
  }

  const purchase = await getProductPurchase(productId, purchaseToken, packageName);

  await prisma.playPurchase.upsert({
    where: { purchaseToken },
    create: {
      purchaseToken,
      productId,
      packageName,
      orderId: purchase.orderId ?? null,
      userId,
      projectId,
      purchaseState: purchase.purchaseState ?? -1,
      acknowledged: purchase.acknowledgementState === 1,
      isTest: purchase.purchaseType === 0,
      raw: purchase as any,
    },
    update: {
      orderId: purchase.orderId ?? null,
      projectId,
      purchaseState: purchase.purchaseState ?? -1,
      acknowledged: purchase.acknowledgementState === 1,
      isTest: purchase.purchaseType === 0,
      raw: purchase as any,
    },
  });

  if (purchase.purchaseState === 2) {
    return { granted: false, reason: "Purchase is still pending" };
  }
  if (purchase.purchaseState !== 0) {
    return { granted: false, reason: "Purchase was canceled" };
  }

  if (purchase.acknowledgementState !== 1) {
    const ok = await acknowledgeProduct(productId, purchaseToken, packageName).then(
      () => true,
      () => false,
    );
    if (ok) {
      await prisma.playPurchase
        .update({ where: { purchaseToken }, data: { acknowledged: true } })
        .catch(() => {});
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      paymentStatus: "PAID",
      paidAt: new Date(),
      currentStage: "STRUCTURE",
      stripePaymentId: purchase.orderId ? `play:${purchase.orderId}` : "play",
    },
  });
  await prisma.playPurchase.update({
    where: { purchaseToken },
    data: { granted: true, grantedAt: new Date() },
  });

  // Same kick-off as the Stripe webhook: research → structure → user review.
  const { enqueueGeneration } = await import("./jobQueue");
  await enqueueGeneration("structure", projectId);

  return { granted: true, reason: "ok", projectId };
}

/**
 * Real-time developer notification: a voided (refunded/charged-back)
 * purchase. We do not claw back a generated book, but we record it so the
 * admin can see it and the project stops being treated as paid if the
 * pipeline has not started yet.
 */
export async function voidPurchase(purchaseToken: string): Promise<void> {
  const row = await prisma.playPurchase.findUnique({ where: { purchaseToken } });
  if (!row) return;
  await prisma.playPurchase.update({
    where: { purchaseToken },
    data: { voidedAt: new Date() },
  });
  if (row.projectId) {
    await prisma.project
      .updateMany({
        where: { id: row.projectId, currentStage: { in: ["STRUCTURE", "STRUCTURE_REVIEW"] } },
        data: { paymentStatus: "REFUNDED" },
      })
      .catch(() => {});
  }
}
