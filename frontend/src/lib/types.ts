// ━━━ Copy of backend/shared/types.ts for frontend use ━━━

export type ProjectStage = "BRIEF" | "PRICING" | "PAYMENT" | "STRUCTURE" | "STRUCTURE_REVIEW" | "IMAGES" | "GENERATING" | "COMPILING" | "COMPLETED" | "ERROR";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export const STAGE_LABELS: Record<ProjectStage, string> = {
  BRIEF: "Project Brief", PRICING: "Review Pricing", PAYMENT: "Payment",
  STRUCTURE: "Generating Structure", STRUCTURE_REVIEW: "Review Structure",
  IMAGES: "Images", GENERATING: "Generating Content", COMPILING: "Compiling Book",
  COMPLETED: "Completed", ERROR: "Error",
};

export interface PricingTier { minPages: number; maxPages: number; priceUsdCents: number; label: string; }

export const PRICING_TIERS: PricingTier[] = [
  { minPages: 10, maxPages: 30, priceUsdCents: 699, label: "Starter" },
  { minPages: 31, maxPages: 50, priceUsdCents: 999, label: "Standard" },
  { minPages: 51, maxPages: 100, priceUsdCents: 1499, label: "Professional" },
  { minPages: 101, maxPages: 150, priceUsdCents: 1999, label: "Premium" },
  { minPages: 151, maxPages: 300, priceUsdCents: 2499, label: "Enterprise" },
];

export const MIN_PAGES = 10;
export const MAX_PAGES = 300;

export function calculatePrice(pages: number) {
  const clamped = Math.max(MIN_PAGES, Math.min(MAX_PAGES, pages));
  const tier = PRICING_TIERS.find((t) => clamped >= t.minPages && clamped <= t.maxPages) || PRICING_TIERS[PRICING_TIERS.length - 1];
  return {
    tier, priceUsdCents: tier.priceUsdCents,
    priceUsdFormatted: `$${(tier.priceUsdCents / 100).toFixed(2)}`,
    perPageCents: Math.round(tier.priceUsdCents / clamped),
  };
}

export interface ProjectSummary {
  id: string; title: string | null; topic: string; targetPages: number;
  currentStage: ProjectStage; generationProgress: number;
  paymentStatus: PaymentStatus; priceUsdCents: number | null;
  priceUsdFormatted: string | null; createdAt: string; updatedAt: string;
}
