// ━━━ Frontend copy of shared types ━━━

export type ProjectStage =
  | "BRIEF"
  | "PRICING"
  | "PAYMENT"
  | "STRUCTURE"
  | "STRUCTURE_REVIEW"
  | "IMAGES"
  | "GENERATING"
  | "COMPILING"
  | "COMPLETED"
  | "ERROR";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export const STAGE_LABELS: Record<ProjectStage, string> = {
  BRIEF: "Project Brief",
  PRICING: "Review Pricing",
  PAYMENT: "Payment",
  STRUCTURE: "Generating Structure",
  STRUCTURE_REVIEW: "Review Structure",
  IMAGES: "Images",
  GENERATING: "Generating Content",
  COMPILING: "Compiling Book",
  COMPLETED: "Completed",
  ERROR: "Error",
};

// ── Page size tiers (match backend) ──

export interface PageSizeTier {
  id: string;
  targetPages: number;
  minPages: number;
  maxPages: number;
  chapters: number;
  label: string;
  description: string;
}

export const PAGE_SIZE_TIERS: PageSizeTier[] = [
  {
    id: "compact",
    targetPages: 35,
    minPages: 30,
    maxPages: 40,
    chapters: 3,
    label: "Compact",
    description: "30–40 pages · 3 chapters",
  },
  {
    id: "standard",
    targetPages: 60,
    minPages: 50,
    maxPages: 70,
    chapters: 4,
    label: "Standard",
    description: "50–70 pages · 4 chapters",
  },
  {
    id: "extended",
    targetPages: 90,
    minPages: 80,
    maxPages: 100,
    chapters: 6,
    label: "Extended",
    description: "80–100 pages · 6 chapters",
  },
  {
    id: "comprehensive",
    targetPages: 140,
    minPages: 130,
    maxPages: 150,
    chapters: 8,
    label: "Comprehensive",
    description: "130–150 pages · 8 chapters",
  },
  {
    id: "complete",
    targetPages: 185,
    minPages: 170,
    maxPages: 200,
    chapters: 10,
    label: "Complete",
    description: "170–200 pages · 10 chapters",
  },
];

// ── Pricing (match backend) ──

export interface PricingTier {
  minPages: number;
  maxPages: number;
  priceUsdCents: number;
  label: string;
}

export const PRICING_TIERS: PricingTier[] = [
  { minPages: 30, maxPages: 45, priceUsdCents: 699, label: "Compact" },
  { minPages: 46, maxPages: 75, priceUsdCents: 999, label: "Standard" },
  { minPages: 76, maxPages: 115, priceUsdCents: 1499, label: "Extended" },
  { minPages: 116, maxPages: 160, priceUsdCents: 1999, label: "Comprehensive" },
  { minPages: 161, maxPages: 200, priceUsdCents: 2499, label: "Complete" },
];

export const MIN_PAGES = 30;
export const MAX_PAGES = 200;

export function calculatePrice(pages: number) {
  const clamped = Math.max(MIN_PAGES, Math.min(MAX_PAGES, pages));
  const tier =
    PRICING_TIERS.find((t) => clamped >= t.minPages && clamped <= t.maxPages) ||
    PRICING_TIERS[PRICING_TIERS.length - 1];
  return {
    tier,
    priceUsdCents: tier.priceUsdCents,
    priceUsdFormatted: `$${(tier.priceUsdCents / 100).toFixed(2)}`,
    perPageCents: Math.round(tier.priceUsdCents / clamped),
  };
}
