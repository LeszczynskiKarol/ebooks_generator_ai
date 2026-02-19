// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge.ai — Types & Pricing (canonical source)
// All backend files import from here: "../lib/types"
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

export type ChapterStatus =
  | "PENDING"
  | "GENERATING"
  | "GENERATED"
  | "LATEX_READY"
  | "ERROR";
export type ImageSource = "USER_UPLOAD" | "AI_GENERATED" | "STOCK";

// ── Stage helpers ──

export const STAGE_ORDER: ProjectStage[] = [
  "BRIEF",
  "PRICING",
  "PAYMENT",
  "STRUCTURE",
  "STRUCTURE_REVIEW",
  "IMAGES",
  "GENERATING",
  "COMPILING",
  "COMPLETED",
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Words per page — empirically measured from LaTeX output
// with book class, onehalfspacing, parskip, chapter breaks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const WORDS_PER_PAGE_BY_FORMAT: Record<string, number> = {
  a5: 120, // 11pt, a5paper, onehalfspacing — measured ~110-130
  b5: 180, // 11pt, b5paper, onehalfspacing
  a4: 260, // 12pt, a4paper, onehalfspacing
  letter: 260, // 12pt, letterpaper, onehalfspacing
};

// Legacy fallback
export const WORDS_PER_PAGE = 120;

export function getWordsPerPage(format: string): number {
  return WORDS_PER_PAGE_BY_FORMAT[format] || 120;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Page size tiers — discrete steps, not per-page slider
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PageSizeTier {
  id: string;
  targetPages: number;
  minPages: number;
  maxPages: number;
  chapters: number;
  sectionsPerChapter: string;
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
    sectionsPerChapter: "2-3",
    label: "Compact",
    description: "30–40 pages · 3 chapters",
  },
  {
    id: "standard",
    targetPages: 60,
    minPages: 50,
    maxPages: 70,
    chapters: 4,
    sectionsPerChapter: "3-4",
    label: "Standard",
    description: "50–70 pages · 4 chapters",
  },
  {
    id: "extended",
    targetPages: 90,
    minPages: 80,
    maxPages: 100,
    chapters: 6,
    sectionsPerChapter: "3-4",
    label: "Extended",
    description: "80–100 pages · 6 chapters",
  },
  {
    id: "comprehensive",
    targetPages: 140,
    minPages: 130,
    maxPages: 150,
    chapters: 8,
    sectionsPerChapter: "3-5",
    label: "Comprehensive",
    description: "130–150 pages · 8 chapters",
  },
  {
    id: "complete",
    targetPages: 185,
    minPages: 170,
    maxPages: 200,
    chapters: 10,
    sectionsPerChapter: "4-5",
    label: "Complete",
    description: "170–200 pages · 10 chapters",
  },
];

/** Find best matching tier for a page count */
export function getPageSizeTier(pages: number): PageSizeTier {
  if (pages <= 45) return PAGE_SIZE_TIERS[0];
  if (pages <= 75) return PAGE_SIZE_TIERS[1];
  if (pages <= 115) return PAGE_SIZE_TIERS[2];
  if (pages <= 160) return PAGE_SIZE_TIERS[3];
  return PAGE_SIZE_TIERS[4];
}

/** Alias — used by structureGenerator & projects */
export const getTierByPages = getPageSizeTier;

/** Structure generation config derived from tier */
export function getStructureConfig(pages: number) {
  const tier = getPageSizeTier(pages);
  const [secMin, secMax] = tier.sectionsPerChapter.split("-").map(Number);

  const configs: Record<
    string,
    {
      chapterCount: { min: number; max: number };
      sectionsPerChapter: { min: number; max: number };
      contentDepth: string;
    }
  > = {
    compact: {
      chapterCount: { min: 3, max: 3 },
      sectionsPerChapter: { min: secMin, max: secMax },
      contentDepth:
        "Focused, practical content. Cover essentials without filler. Each chapter should be concise and actionable.",
    },
    standard: {
      chapterCount: { min: 4, max: 5 },
      sectionsPerChapter: { min: secMin, max: secMax },
      contentDepth:
        "Balanced depth. Include examples and case studies. Cover the topic thoroughly but avoid repetition.",
    },
    extended: {
      chapterCount: { min: 5, max: 7 },
      sectionsPerChapter: { min: secMin, max: secMax },
      contentDepth:
        "In-depth coverage with detailed examples, case studies, data, and analysis. Expert-level insights on each subtopic.",
    },
    comprehensive: {
      chapterCount: { min: 7, max: 9 },
      sectionsPerChapter: { min: secMin, max: secMax },
      contentDepth:
        "Comprehensive treatment. Multiple perspectives, detailed analysis, real-world data, industry insights, tools comparison, and practical frameworks.",
    },
    complete: {
      chapterCount: { min: 9, max: 11 },
      sectionsPerChapter: { min: secMin, max: secMax },
      contentDepth:
        "Exhaustive reference-grade content. Deep-dive into every aspect, multiple case studies per chapter, detailed appendices, complete toolkits, and expert interviews.",
    },
  };

  return configs[tier.id] || configs.standard;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pricing (aligned with tiers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PricingTier {
  minPages: number;
  maxPages: number;
  priceUsdCents: number;
  label: string;
}

export const PRICING_TIERS: PricingTier[] = [
  { minPages: 30, maxPages: 45, priceUsdCents: 999, label: "Compact" },
  { minPages: 46, maxPages: 75, priceUsdCents: 1299, label: "Standard" },
  { minPages: 76, maxPages: 115, priceUsdCents: 1499, label: "Extended" },
  { minPages: 116, maxPages: 160, priceUsdCents: 1799, label: "Comprehensive" },
  { minPages: 161, maxPages: 200, priceUsdCents: 1999, label: "Complete" },
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

// ── Constants ──

export const SUPPORTED_LANGUAGES = [
  "en",
  "pl",
  "de",
  "es",
  "fr",
  "it",
  "pt",
  "nl",
] as const;
export const STYLE_PRESETS = [
  "modern",
  "academic",
  "minimal",
  "creative",
  "business",
] as const;
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
