// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge.ai — Shared Types & Pricing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Enums (mirror Prisma) ──

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

export type GenerationStatus =
  | "NOT_STARTED"
  | "GENERATING_STRUCTURE"
  | "STRUCTURE_READY"
  | "GENERATING_CONTENT"
  | "CONTENT_READY"
  | "COMPILING_LATEX"
  | "COMPILING_EPUB"
  | "COMPLETED"
  | "ERROR";

export type ChapterStatus = "PENDING" | "GENERATING" | "GENERATED" | "LATEX_READY" | "ERROR";
export type ImageSource = "USER_UPLOAD" | "AI_GENERATED" | "STOCK";

// ── Stage helpers ──

export const STAGE_ORDER: ProjectStage[] = [
  "BRIEF", "PRICING", "PAYMENT", "STRUCTURE", "STRUCTURE_REVIEW",
  "IMAGES", "GENERATING", "COMPILING", "COMPLETED",
];

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

// ── Pricing ──

export interface PricingTier {
  minPages: number;
  maxPages: number;
  priceUsdCents: number;
  label: string;
}

export const PRICING_TIERS: PricingTier[] = [
  { minPages: 10, maxPages: 30, priceUsdCents: 699, label: "Starter" },
  { minPages: 31, maxPages: 50, priceUsdCents: 999, label: "Standard" },
  { minPages: 51, maxPages: 100, priceUsdCents: 1499, label: "Professional" },
  { minPages: 101, maxPages: 150, priceUsdCents: 1999, label: "Premium" },
  { minPages: 151, maxPages: 300, priceUsdCents: 2499, label: "Enterprise" },
];

export const MIN_PAGES = 10;
export const MAX_PAGES = 300;
export const WORDS_PER_PAGE = 550;

export function calculatePrice(pages: number) {
  const clamped = Math.max(MIN_PAGES, Math.min(MAX_PAGES, pages));
  const tier = PRICING_TIERS.find((t) => clamped >= t.minPages && clamped <= t.maxPages)
    || PRICING_TIERS[PRICING_TIERS.length - 1];

  return {
    tier,
    priceUsdCents: tier.priceUsdCents,
    priceUsdFormatted: `$${(tier.priceUsdCents / 100).toFixed(2)}`,
    perPageCents: Math.round(tier.priceUsdCents / clamped),
  };
}

// ── Constants ──

export const SUPPORTED_LANGUAGES = ["en", "pl", "de", "es", "fr", "it", "pt", "nl"] as const;
export const STYLE_PRESETS = ["modern", "academic", "minimal", "creative", "business"] as const;
export const BOOK_FORMATS = ["a5", "b5", "letter", "a4"] as const;

// ── API Response Types ──

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProjectSummary {
  id: string;
  title: string | null;
  topic: string;
  targetPages: number;
  currentStage: ProjectStage;
  generationProgress: number;
  paymentStatus: PaymentStatus;
  priceUsdCents: number | null;
  priceUsdFormatted: string | null;
  createdAt: string;
  updatedAt: string;
}
