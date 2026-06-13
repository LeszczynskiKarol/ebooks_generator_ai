// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InkMagnet — Cover Type Definitions v2
// Shared between frontend & backend
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CoverType = "NONE" | "GENERATED" | "CUSTOM_UPLOAD";

export type CoverLayout =
  | "techgrid" // Dark bg + grid + circles (flagship)
  | "luxe" // Dark elegant with ornamental frame
  | "aurora" // Gradient aurora with floating particles
  | "architect" // Clean white with bold sidebar
  | "monolith"; // Full-bleed primary color, centered type

export interface CoverPillar {
  title: string;
  description: string;
}

export interface CoverParams {
  layout: CoverLayout;
  title: string;
  subtitle?: string;
  authorName?: string;
  authorCredentials?: string;
  year?: number;
  tagline?: string;
  pillars?: CoverPillar[];
  featureText?: string;
  featureSubtext?: string;
  titleLine1?: string;
  titleLine2?: string;
  showPageCount?: boolean;
  pageCount?: number;
}

export const COVER_LAYOUTS: {
  id: CoverLayout;
  label: string;
  description: string;
}[] = [
  {
    id: "techgrid",
    label: "TechGrid",
    description:
      "Dark background with subtle grid, geometric circles, glow effects — modern & impactful",
  },
  {
    id: "luxe",
    label: "Luxe",
    description:
      "Ornamental double frame, corner dots, diagonal texture — formal & authoritative",
  },
  {
    id: "aurora",
    label: "Aurora",
    description:
      "Gradient aurora waves with floating particles — creative & atmospheric",
  },
  {
    id: "architect",
    label: "Architect",
    description:
      "Clean white with bold sidebar, accent stripe, large initial — structured & professional",
  },
  {
    id: "monolith",
    label: "Monolith",
    description:
      "Full-bleed primary color, centered typography, ring accents — bold & distinctive",
  },
];
