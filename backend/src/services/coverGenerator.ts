// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Cover Generator v2 (Publisher-Grade)
// Generates professional LaTeX book covers with:
//   · Subtle grid/pattern backgrounds
//   · Multi-layer geometric decorations with glow
//   · Background watermark text
//   · Chapter-derived info boxes (pillars)
//   · Decorative dots, accent strips, separators
//   · Featured badge circles with arc arrows
//   · 5 distinct layouts × any color palette
//
// Compiles with xelatex (fontspec) → fallback to pdflatex
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { prisma } from "../lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const execAsync = promisify(exec);
const BUILD_DIR = path.join(process.cwd(), "tmp", "covers");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CoverParams {
  layout: CoverLayout;
  title: string;
  subtitle?: string;
  authorName?: string;
  authorCredentials?: string; // e.g. "15+ lat doświadczenia w marketingu"
  year?: number;
  tagline?: string;
  /** Up to 3 topic pillar boxes derived from chapters */
  pillars?: CoverPillar[];
  /** Featured element — displayed in decorative circle/badge */
  featureText?: string; // e.g. "360°"
  featureSubtext?: string; // e.g. "KOMPLETNY PRZEWODNIK"
  showPageCount?: boolean;
  pageCount?: number;
  /** Optional: split title into two-color lines */
  titleLine1?: string; // e.g. "COPYWRITING" → white
  titleLine2?: string; // e.g. "360°" → primary color
}

export interface CoverPillar {
  title: string;
  description: string;
}

export type CoverLayout =
  | "techgrid" // Dark bg + subtle grid + geometric circles (flagship)
  | "luxe" // Dark elegant with ornamental frame + watermark
  | "aurora" // Gradient aurora waves with floating particles
  | "architect" // Clean white with bold sidebar + pillar boxes
  | "monolith"; // Full-bleed primary color with centered typography

interface ColorSet {
  bgDeep: string;
  bgMid: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentAlt: string;
  textBright: string;
  textMuted: string;
  textOnAccent: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Color utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shade(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [cl(r * (1 - ratio)), cl(g * (1 - ratio)), cl(b * (1 - ratio))]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function tint(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [
    cl(r + (255 - r) * ratio),
    cl(g + (255 - g) * ratio),
    cl(b + (255 - b) * ratio),
  ]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = ((h * 360 + degrees) % 360) / 360;
  if (h < 0) h += 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q;
  return [
    Math.round(hue2rgb(p2, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p2, q, h) * 255),
    Math.round(hue2rgb(p2, q, h - 1 / 3) * 255),
  ]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function strip(hex: string): string {
  return hex.replace("#", "").toUpperCase();
}

function deriveColors(customColors?: string[], stylePreset?: string): ColorSet {
  if (customColors && customColors.length > 0) {
    const p = strip(customColors[0]);
    const s =
      customColors.length >= 2 ? strip(customColors[1]) : rotateHue(p, 160);
    const t =
      customColors.length >= 3 ? strip(customColors[2]) : rotateHue(p, 80);
    return {
      bgDeep: shade(p, 0.85),
      bgMid: shade(p, 0.75),
      primary: p,
      primaryDark: shade(p, 0.3),
      primaryLight: tint(p, 0.88),
      accent: s,
      accentAlt: t,
      textBright: "FFFFFF",
      textMuted: tint(shade(p, 0.5), 0.4),
      textOnAccent: luminance(s) < 0.4 ? "FFFFFF" : "1F2937",
    };
  }

  const presets: Record<string, ColorSet> = {
    modern: {
      bgDeep: "0A1628",
      bgMid: "112240",
      primary: "7C3AED",
      primaryDark: "5B21B6",
      primaryLight: "EDE9FE",
      accent: "00C853",
      accentAlt: "00B8D4",
      textBright: "FFFFFF",
      textMuted: "8892B0",
      textOnAccent: "FFFFFF",
    },
    academic: {
      bgDeep: "0A1628",
      bgMid: "112240",
      primary: "1A73E8",
      primaryDark: "0D47A1",
      primaryLight: "E3F2FD",
      accent: "00C853",
      accentAlt: "00B8D4",
      textBright: "FFFFFF",
      textMuted: "8892B0",
      textOnAccent: "FFFFFF",
    },
    creative: {
      bgDeep: "1A0A2E",
      bgMid: "261344",
      primary: "A855F7",
      primaryDark: "7C3AED",
      primaryLight: "F3E8FF",
      accent: "F472B6",
      accentAlt: "38BDF8",
      textBright: "FFFFFF",
      textMuted: "9F8EC0",
      textOnAccent: "FFFFFF",
    },
    business: {
      bgDeep: "0C1220",
      bgMid: "15202E",
      primary: "2563EB",
      primaryDark: "1E40AF",
      primaryLight: "DBEAFE",
      accent: "10B981",
      accentAlt: "F59E0B",
      textBright: "FFFFFF",
      textMuted: "7C8BA8",
      textOnAccent: "FFFFFF",
    },
    minimal: {
      bgDeep: "FAFAFA",
      bgMid: "F3F4F6",
      primary: "374151",
      primaryDark: "1F2937",
      primaryLight: "F9FAFB",
      accent: "6B7280",
      accentAlt: "9CA3AF",
      textBright: "111827",
      textMuted: "6B7280",
      textOnAccent: "FFFFFF",
    },
  };

  return presets[stylePreset || "modern"] || presets.modern;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LaTeX escaping
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&%$#_{}]/g, (m) => "\\" + m)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/°/g, "\\textdegree{}");
}

function escUpper(text: string): string {
  return esc(text).toUpperCase();
}

/**
 * Title text for cover layouts: escaped, with a lone " - " typeset as an
 * em-dash and hyphenation disabled (a hyphenated cover title looks broken).
 */
function escTitle(text: string): string {
  // \mbox each word: hyphenation becomes impossible (TikZ nodes ignore
  // \hyphenpenalty), so the title breaks only at spaces.
  return esc(text.replace(/\s+-\s+/g, " --- "))
    .split(/\s+/)
    .map((w) => `\\mbox{${w}}`)
    .join(" ");
}

/**
 * Scale a layout's base title font size down for long titles, so the title
 * neither squeezes word spacing nor hyphenates to fill the line.
 */
function fitTitleSize(
  title: string,
  base: number,
): { size: number; leading: number } {
  const len = title.length;
  const factor = len <= 24 ? 1 : len <= 40 ? 0.78 : len <= 60 ? 0.62 : 0.5;
  const size = Math.round(base * factor);
  return { size, leading: Math.round(size * 1.18) };
}

/**
 * Auto-split a title into two display lines (the second line is set in the
 * accent color — the "COPYWRITING / 360°" pattern). Prefers an explicit
 * separator (dash/colon); falls back to peeling 1-2 trailing words.
 * Returns null when the title reads better as a single line.
 */
export function splitTitleForCover(
  title: string,
): { line1: string; line2: string } | null {
  const t = title.trim();

  const sep = t.match(/^(.{4,40}?)\s*(?:—|–|:|\s-\s)\s*(.{3,32})$/);
  if (sep) return { line1: sep[1].trim(), line2: sep[2].trim() };

  const words = t.split(/\s+/);
  if (words.length >= 3 && t.length > 18) {
    for (const take of [2, 1]) {
      if (words.length - take < 2) continue;
      const line1 = words.slice(0, -take).join(" ");
      const line2 = words.slice(-take).join(" ");
      if (line2.length >= 4 && line2.length <= 24 && line1.length <= 34) {
        return { line1, line2 };
      }
    }
  }
  return null;
}

/**
 * Badge subtext, per book language. Includes the "pages" word so the big
 * number reads as a page count — a bare "35+" looked like a target age.
 */
const GUIDE_LABEL: Record<string, string> = {
  pl: "STRON · KOMPLETNY PRZEWODNIK",
  en: "PAGES · THE COMPLETE GUIDE",
  de: "SEITEN · KOMPLETTER GUIDE",
  es: "PÁGINAS · GUÍA COMPLETA",
  fr: "PAGES · GUIDE COMPLET",
  it: "PAGINE · GUIDA COMPLETA",
  pt: "PÁGINAS · GUIA COMPLETO",
  nl: "PAGINA'S · COMPLETE GIDS",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared decorative TikZ building blocks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Subtle grid pattern overlay — like the example's siatka */
function gridPattern(spacing: number = 8): string {
  return `
  % ── Subtle grid ──
  \\begin{scope}[opacity=0.035]
    \\foreach \\x in {0,${spacing},...,210} {
      \\draw[covprimary, line width=0.2pt] (\\x, 0) -- (\\x, 297);
    }
    \\foreach \\y in {0,${spacing},...,297} {
      \\draw[covprimary, line width=0.2pt] (0, \\y) -- (210, \\y);
    }
  \\end{scope}`;
}

/** Multi-layer decorative circles at a position */
function decorCircles(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  r3: number,
): string {
  return `
  % ── Geometric circles ──
  \\draw[covprimary, line width=1pt, opacity=0.12]
    (${cx}, ${cy}) circle (${r1});
  \\draw[covprimary, line width=0.5pt, opacity=0.08]
    (${cx}, ${cy}) circle (${r2});
  \\draw[covaccentalt, line width=0.3pt, opacity=0.10]
    (${cx}, ${cy}) circle (${r3});`;
}

/** Soft glow effect — radial fill */
function glow(
  cx: number,
  cy: number,
  r: number,
  color: string = "covaccentalt",
  opacity: number = 0.05,
): string {
  return `  \\fill[${color}, opacity=${opacity}] (${cx}, ${cy}) circle (${r});`;
}

/** Accent line strip */
function accentBar(
  x: number,
  y: number,
  width: number,
  height: number = 0.8,
  color: string = "covaccent",
): string {
  return `  \\fill[${color}] (${x}, ${y}) rectangle (${x + width}, ${y + height});`;
}

/** Decorative dot column (vertical) */
function dotColumn(
  x: number,
  yStart: number,
  yEnd: number,
  step: number = 4,
): string {
  return `  \\foreach \\y in {${yStart},${yStart + step},...,${yEnd}} {
    \\fill[covprimary, opacity=0.2] (${x}, \\y) circle (0.5);
  }`;
}

/** Featured badge — circle with progress arc + arrow (like the 360° element) */
function featureBadge(
  cx: number,
  cy: number,
  r: number,
  text: string,
  subtext?: string,
  // On light layouts (architect) the default bright text is white-on-white —
  // callers pass their dark text color instead.
  textColor: string = "covtextbright",
): string {
  const fontSize = Math.max(10, Math.round(r * 0.85));
  const subY = cy - Math.round(r * 0.35);
  let tikz = `
  % ── Featured badge ──
  \\draw[covprimary!50, line width=2.5pt, opacity=0.5]
    (${cx}, ${cy}) circle (${r});
  \\draw[covaccent, line width=2.8pt, line cap=round]
    (${cx}, ${cy}) ++(90:${r}) arc (90:430:${r});
  % Grot strzałki
  \\fill[covaccent]
    ([shift={(80:${r})}]${cx},${cy}) -- ++(70:3.5) -- ++(160:3.5) -- cycle;
  % Tekst wewnątrz
  \\node[anchor=center] at (${cx}, ${cy + 2}) {%
    \\fontsize{${fontSize}}{${fontSize}}\\selectfont\\bfseries\\sffamily\\color{${textColor}}%
    ${esc(text)}%
  };`;
  if (subtext) {
    tikz += `
  \\node[anchor=center] at (${cx}, ${subY}) {%
    \\fontsize{6.5}{6.5}\\selectfont\\sffamily\\color{covtextmuted}%
    ${escUpper(subtext)}%
  };`;
  }
  return tikz;
}

/** Pillar info boxes — 2-3 topic boxes derived from chapters */
function pillarBoxes(
  pillars: CoverPillar[],
  y: number,
  boxHeight: number = 21,
): string {
  if (!pillars || pillars.length === 0) return "";
  const count = Math.min(pillars.length, 3);
  const gap = 5;
  const totalW = 154; // from x=15 to x=169
  const boxW = (totalW - (count - 1) * gap) / count;
  const startX = 15;

  let tikz = `\n  % ── Topic pillar boxes ──`;
  for (let i = 0; i < count; i++) {
    const x = Math.round(startX + i * (boxW + gap));
    const xEnd = Math.round(x + boxW);
    const p = pillars[i];
    tikz += `
  \\fill[covprimary, opacity=0.12, rounded corners=2pt]
    (${x}, ${y}) rectangle (${xEnd}, ${y + boxHeight});
  \\draw[covprimary, line width=0.6pt, rounded corners=2pt]
    (${x}, ${y}) rectangle (${xEnd}, ${y + boxHeight});
  \\node[anchor=north west] at (${x + 3}, ${y + boxHeight - 2}) {%
    \\fontsize{8}{8}\\selectfont\\bfseries\\sffamily\\color{covaccentalt}%
    ${escUpper(p.title)}%
  };
  \\node[anchor=north west, text width=${Math.round(boxW - 6)}mm] at (${x + 3}, ${y + boxHeight - 10}) {%
    \\fontsize{7}{9}\\selectfont\\sffamily\\color{covtextmuted}%
    ${esc(p.description)}%
  };`;
  }
  return tikz;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT: TECHGRID
// Dark background + subtle grid + geometric circles
// Flagship layout — matches the Copywriting 360° example
// Best for: modern, academic, business
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function layoutTechgrid(p: CoverParams, c: ColorSet): string {
  const yr = p.year || new Date().getFullYear();
  const titleWords = p.title.split(/\s+/);
  const watermark =
    p.featureText ||
    (p.pageCount
      ? `${p.pageCount}`
      : titleWords[titleWords.length - 1]?.toUpperCase() || "");

  // Two-line title support (e.g. "COPYWRITING" white + "360°" primary).
  // Lines are single hboxes (no wrapping) — size from the longest line so
  // nothing overflows the 175mm column (≈497pt; bold sans ≈0.6em/char).
  const hasTwoLineTitle = p.titleLine1 && p.titleLine2;
  const twoLine = hasTwoLineTitle
    ? (() => {
        const maxLen = Math.max(p.titleLine1!.length, p.titleLine2!.length);
        const size = Math.max(
          20,
          Math.min(44, Math.floor(497 / (0.6 * maxLen))),
        );
        return {
          size,
          leading: Math.round(size * 1.1),
          gap: Math.round(size * 0.46),
        };
      })()
    : null;

  return `
% === Background ===
\\fill[covbgdeep] (0,0) rectangle (210,297);
${gridPattern(8)}

% === Geometric circles — top-right ===
${decorCircles(175, 255, 75, 95, 110)}

% === Circles — bottom-left ===
\\draw[covprimary, line width=0.6pt, opacity=0.08] (30, 35) circle (55);
\\draw[covprimary, line width=0.3pt, opacity=0.05] (30, 35) circle (70);

% === Glow effects ===
${glow(178, 260, 45, "covaccentalt")}
${glow(35, 40, 35, "covprimary", 0.04)}

% === Background watermark ===
\\node[anchor=east, opacity=0.055] at (205, 170) {%
  \\fontsize{170}{170}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${esc(watermark)}%
};

% === Featured badge circle ===
${
  p.featureText
    ? featureBadge(105, 230, 26, p.featureText, p.featureSubtext)
    : `
\\draw[covprimary!50, line width=2pt, opacity=0.4] (105, 232) circle (22);
\\draw[covaccent, line width=2.5pt, line cap=round]
  (105, 232) ++(90:22) arc (90:410:22);`
}

% === Accent line ===
${accentBar(15, 200, 40)}

% === TITLE ===
${
  hasTwoLineTitle
    ? `
\\node[anchor=south west] at (15, 179) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.titleLine1!)}%
};
\\node[anchor=south west] at (15, ${179 - twoLine!.gap}) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${escTitle(p.titleLine2!)}%
};`
    : `
\\node[anchor=south west, text width=175mm] at (15, 172) {%
  \\fontsize{${fitTitleSize(p.title, 40).size}}{${fitTitleSize(p.title, 40).leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.title)}%
};`
}

% === Subtitle ===
${
  p.subtitle
    ? `
${accentBar(15, 152, 55, 0.7)}
\\node[anchor=north west, text width=170mm] at (15, 149) {%
  \\fontsize{16}{20}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.subtitle)}%
};`
    : ""
}

% === Topic pillar boxes ===
${pillarBoxes(p.pillars || [], 104, 21)}

% === Decorative dots (left edge) ===
${dotColumn(8, 72, 96)}

% === Separator ===
\\fill[covprimary, opacity=0.25] (15, 62) rectangle (195, 62.3);

% === Author ===
${
  p.authorName
    ? `
\\node[anchor=north west] at (15, 55) {%
  \\fontsize{15}{15}\\selectfont\\sffamily\\color{covtextbright}%
  ${esc(p.authorName)}%
};`
    : ""
}
${
  p.authorCredentials
    ? `
\\node[anchor=north west, text width=160mm] at (15, 45) {%
  \\fontsize{9}{9}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.authorCredentials)}%
};`
    : ""
}

% === Year ===
\\node[anchor=north east] at (195, 55) {%
  \\fontsize{13}{13}\\selectfont\\sffamily\\color{covprimary}%
  ${yr}%
};

% === Bottom accent bars ===
${accentBar(15, 22, 25, 0.7)}
\\fill[covprimary] (43, 22) rectangle (61, 22.7);

% === Bottom-right decoration ===
\\fill[covprimary, opacity=0.06] (182, 28) circle (14);
\\fill[covaccentalt, opacity=0.04] (188, 22) circle (7);
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT: LUXE
// Dark elegant with ornamental double frame, corner ornaments,
// diagonal line texture, centered typography, watermark
// Best for: academic, business, minimal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function layoutLuxe(p: CoverParams, c: ColorSet): string {
  const yr = p.year || new Date().getFullYear();
  // Centered two-line title (white + accent), sized to the 160mm column (≈454pt)
  const hasTwoLineTitle = p.titleLine1 && p.titleLine2;
  const twoLine = hasTwoLineTitle
    ? (() => {
        const maxLen = Math.max(p.titleLine1!.length, p.titleLine2!.length);
        const size = Math.max(
          18,
          Math.min(38, Math.floor(454 / (0.6 * maxLen))),
        );
        return {
          size,
          leading: Math.round(size * 1.1),
          gap: Math.round(size * 0.5),
        };
      })()
    : null;
  return `
% === Background ===
\\fill[covbgdeep] (0,0) rectangle (210,297);

% === Subtle diagonal lines ===
\\begin{scope}[opacity=0.025]
  \\foreach \\i in {-50,-40,...,260} {
    \\draw[covprimary, line width=0.3pt] (\\i, 0) -- ({\\i+100}, 297);
  }
\\end{scope}

% === Outer frame ===
\\draw[covtextbright!40, line width=1.2pt]
  (10, 10) rectangle (200, 287);
% === Inner frame ===
\\draw[covaccent, line width=0.5pt]
  (14, 14) rectangle (196, 283);

% === Corner ornaments ===
\\foreach \\cx/\\cy in {14/283, 196/283, 14/14, 196/14} {
  \\fill[covaccent] (\\cx, \\cy) circle (1.8);
  \\draw[covtextbright!30, line width=0.4pt] (\\cx, \\cy) circle (3.5);
}

% === Background watermark ===
\\node[anchor=center, opacity=0.04, rotate=-30] at (105, 160) {%
  \\fontsize{100}{100}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${esc(p.title.split(/\s+/).slice(0, 2).join(" "))}%
};

% === Top ornamental line ===
\\fill[covaccent] (40, 240) rectangle (170, 240.5);
\\fill[covaccent] (40, 239) circle (1.2);
\\fill[covaccent] (170, 239) circle (1.2);

${
  p.tagline
    ? `
% === Tagline ===
\\node[anchor=center] at (105, 250) {%
  \\fontsize{9}{12}\\selectfont\\scshape\\color{covtextmuted}%
  ${escUpper(p.tagline)}%
};`
    : ""
}

% === Title ===
${
  hasTwoLineTitle
    ? `
\\node[anchor=center] at (105, 215) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.titleLine1!)}%
};
\\node[anchor=center] at (105, ${215 - twoLine!.gap}) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${escTitle(p.titleLine2!)}%
};`
    : `
\\node[anchor=center, text width=160mm, align=center] at (105, 210) {%
  \\fontsize{${fitTitleSize(p.title, 38).size}}{${fitTitleSize(p.title, 38).leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.title)}%
};`
}

% === Accent rule under title ===
\\fill[covaccent] (80, 188) rectangle (130, 188.8);

${
  p.subtitle
    ? `
% === Subtitle ===
\\node[anchor=center, text width=150mm, align=center] at (105, 178) {%
  \\fontsize{14}{18}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.subtitle)}%
};`
    : ""
}

${
  p.featureText
    ? `
% === Feature badge (centered) ===
${featureBadge(105, 150, 20, p.featureText, p.featureSubtext)}`
    : ""
}

% === Pillar boxes ===
${pillarBoxes(p.pillars || [], 105, 21)}

% === Bottom ornamental line ===
\\fill[covaccent] (40, 80) rectangle (170, 80.5);

% === Author ===
${
  p.authorName
    ? `
\\node[anchor=center] at (105, 65) {%
  \\fontsize{16}{16}\\selectfont\\sffamily\\color{covtextbright}%
  ${esc(p.authorName)}%
};`
    : ""
}
${
  p.authorCredentials
    ? `
\\node[anchor=center, text width=150mm, align=center] at (105, 52) {%
  \\fontsize{8.5}{11}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.authorCredentials)}%
};`
    : ""
}

% === Year ===
\\node[anchor=center] at (105, 28) {%
  \\fontsize{11}{11}\\selectfont\\sffamily\\color{covprimary}%
  ${yr}%
};

% === Glow ===
${glow(105, 210, 50, "covprimary", 0.03)}
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT: AURORA
// Gradient aurora waves with floating particles,
// clipped grid in upper area, accent bottom bar
// Best for: creative, modern
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function layoutAurora(p: CoverParams, c: ColorSet): string {
  const yr = p.year || new Date().getFullYear();
  // Two-line title sized to the 170mm column (≈482pt)
  const hasTwoLineTitle = p.titleLine1 && p.titleLine2;
  const twoLine = hasTwoLineTitle
    ? (() => {
        const maxLen = Math.max(p.titleLine1!.length, p.titleLine2!.length);
        const size = Math.max(
          18,
          Math.min(36, Math.floor(482 / (0.6 * maxLen))),
        );
        return {
          size,
          leading: Math.round(size * 1.1),
          gap: Math.round(size * 0.46),
        };
      })()
    : null;
  return `
% === Gradient background ===
\\shade[top color=covbgmid, bottom color=covbgdeep]
  (0,0) rectangle (210,297);

% === Aurora layers ===
\\fill[covprimary, opacity=0.08]
  (0, 200) .. controls (50, 260) and (150, 240) .. (210, 280) -- (210, 297) -- (0, 297) -- cycle;
\\fill[covaccent, opacity=0.05]
  (0, 220) .. controls (70, 270) and (140, 250) .. (210, 290) -- (210, 297) -- (0, 297) -- cycle;
\\fill[covaccentalt, opacity=0.04]
  (0, 235) .. controls (60, 280) and (160, 260) .. (210, 295) -- (210, 297) -- (0, 297) -- cycle;

% === Floating particles ===
\\foreach \\x/\\y/\\r/\\o in {
  30/270/3/0.08, 75/255/2/0.06, 120/280/4/0.05,
  160/265/2.5/0.07, 185/275/1.5/0.09, 50/250/1.8/0.06,
  140/245/2.2/0.04, 25/60/3/0.05, 175/45/2/0.06,
  90/30/2.5/0.04, 55/75/1.5/0.07
} {
  \\fill[covprimary, opacity=\\o] (\\x, \\y) circle (\\r);
}

% === Subtle grid (upper area) ===
\\begin{scope}[opacity=0.02]
  \\clip (0, 150) rectangle (210, 297);
  \\foreach \\x in {0,10,...,210} {
    \\draw[covtextbright, line width=0.2pt] (\\x, 150) -- (\\x, 297);
  }
  \\foreach \\y in {150,160,...,297} {
    \\draw[covtextbright, line width=0.2pt] (0, \\y) -- (210, \\y);
  }
\\end{scope}

${
  p.tagline
    ? `
% === Tagline ===
\\node[anchor=north west] at (20, 285) {%
  \\fontsize{9}{12}\\selectfont\\scshape\\color{covaccent}%
  ${escUpper(p.tagline)}%
};`
    : ""
}

${p.featureText ? featureBadge(170, 240, 22, p.featureText, p.featureSubtext) : ""}

% === Title ===
${accentBar(20, 195, 45, 0.8)}
${
  hasTwoLineTitle
    ? `
\\node[anchor=south west] at (20, ${162 + twoLine!.gap}) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.titleLine1!)}%
};
\\node[anchor=south west] at (20, 162) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${escTitle(p.titleLine2!)}%
};`
    : `
\\node[anchor=south west, text width=170mm] at (20, 162) {%
  \\fontsize{${fitTitleSize(p.title, 42).size}}{${fitTitleSize(p.title, 42).leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.title)}%
};`
}

${
  p.subtitle
    ? `
\\node[anchor=north west, text width=165mm] at (20, 155) {%
  \\fontsize{14}{18}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.subtitle)}%
};`
    : ""
}

% === Topic pillar boxes ===
${pillarBoxes(p.pillars || [], 94, 22)}

% === Bottom area ===
\\fill[covprimary, opacity=0.15] (0, 0) rectangle (210, 70);
\\fill[covaccent, opacity=0.25] (20, 70) rectangle (190, 70.3);

% === Author ===
${
  p.authorName
    ? `
\\node[anchor=north west] at (20, 58) {%
  \\fontsize{15}{15}\\selectfont\\sffamily\\color{covtextbright}%
  ${esc(p.authorName)}%
};`
    : ""
}
${
  p.authorCredentials
    ? `
\\node[anchor=north west, text width=140mm] at (20, 46) {%
  \\fontsize{8.5}{11}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.authorCredentials)}%
};`
    : ""
}

\\node[anchor=north east] at (190, 58) {%
  \\fontsize{12}{12}\\selectfont\\sffamily\\color{covprimary}%
  ${yr}%
};

% === Bottom accents ===
${accentBar(20, 20, 30, 0.7)}
\\fill[covprimary] (55, 20) rectangle (72, 20.7);
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT: ARCHITECT
// Clean white with bold left sidebar, subtle grid, large
// background initial letter, pillar boxes, dual accent rules
// Best for: business, minimal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function layoutArchitect(p: CoverParams, c: ColorSet): string {
  const yr = p.year || new Date().getFullYear();
  const isMinimal = c.bgDeep === "FAFAFA";
  const textColor = isMinimal ? "covprimarydark" : "covbgdeep";

  // Two-line title sized to the 155mm column (≈440pt)
  const hasTwoLineTitle = p.titleLine1 && p.titleLine2;
  const twoLine = hasTwoLineTitle
    ? (() => {
        const maxLen = Math.max(p.titleLine1!.length, p.titleLine2!.length);
        const size = Math.max(
          18,
          Math.min(36, Math.floor(440 / (0.6 * maxLen))),
        );
        return {
          size,
          leading: Math.round(size * 1.1),
          gap: Math.round(size * 0.45),
        };
      })()
    : null;

  return `
% === White background ===
\\fill[white] (0,0) rectangle (210,297);

% === Bold left sidebar ===
\\fill[covprimary] (0, 0) rectangle (30, 297);

% === Sidebar accent stripe ===
\\fill[covaccent] (30, 0) rectangle (32, 297);

% === Sidebar decorative dots ===
\\foreach \\y in {240, 220, 200, 180} {
  \\fill[covtextbright, opacity=0.15] (15, \\y) circle (1.5);
}
\\draw[covtextbright, opacity=0.1, line width=0.4pt] (15, 140) -- (15, 175);

% === Subtle grid on white area ===
\\begin{scope}[opacity=0.03]
  \\clip (32, 0) rectangle (210, 297);
  \\foreach \\x in {32,42,...,210} {
    \\draw[covprimary, line width=0.15pt] (\\x, 0) -- (\\x, 297);
  }
  \\foreach \\y in {0,10,...,297} {
    \\draw[covprimary, line width=0.15pt] (32, \\y) -- (210, \\y);
  }
\\end{scope}

% === Large background initial letter ===
\\node[anchor=south east, opacity=0.035] at (205, 80) {%
  \\fontsize{200}{200}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${esc(p.title.charAt(0))}%
};

${
  p.tagline
    ? `
% === Tagline ===
\\node[anchor=north west] at (42, 278) {%
  \\fontsize{9}{12}\\selectfont\\scshape\\color{covtextmuted}%
  ${escUpper(p.tagline)}%
};`
    : ""
}

% === Title ===
${
  hasTwoLineTitle
    ? `
\\node[anchor=north west] at (42, 260) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{${textColor}}%
  ${escTitle(p.titleLine1!)}%
};
\\node[anchor=north west] at (42, ${260 - twoLine!.gap}) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
  ${escTitle(p.titleLine2!)}%
};`
    : `
\\node[anchor=north west, text width=155mm] at (42, 260) {%
  \\fontsize{${fitTitleSize(p.title, 36).size}}{${fitTitleSize(p.title, 36).leading}}\\selectfont\\bfseries\\sffamily\\color{${textColor}}%
  ${escTitle(p.title)}%
};`
}

% === Dual accent rule ===
\\fill[covprimary] (42, 208) rectangle (82, 209);
\\fill[covaccent] (84, 208) rectangle (100, 209);

${
  p.subtitle
    ? `
% === Subtitle ===
\\node[anchor=north west, text width=150mm] at (42, 200) {%
  \\fontsize{13}{17}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.subtitle)}%
};`
    : ""
}

${
  p.featureText
    ? `
% === Feature badge — below the pillar row, clear of the title block ===
${featureBadge(172, 112, 17, p.featureText, p.featureSubtext, textColor)}`
    : ""
}

% === Pillar boxes ===
${(() => {
  if (!p.pillars || p.pillars.length === 0) return "";
  const count = Math.min(p.pillars.length, 3);
  const boxW = 48;
  const gap = 5;
  const startX = 42;
  let tikz = "\n  % ── Topic boxes ──";
  for (let i = 0; i < count; i++) {
    const x = startX + i * (boxW + gap);
    const pi = p.pillars[i];
    tikz += `
  \\fill[covprimary, opacity=0.06, rounded corners=2pt]
    (${x}, 135) rectangle (${x + boxW}, 158);
  \\draw[covprimary, line width=0.5pt, opacity=0.3, rounded corners=2pt]
    (${x}, 135) rectangle (${x + boxW}, 158);
  \\node[anchor=north west] at (${x + 3}, 156) {%
    \\fontsize{7.5}{7.5}\\selectfont\\bfseries\\sffamily\\color{covprimary}%
    ${escUpper(pi.title)}%
  };
  \\node[anchor=north west, text width=${boxW - 6}mm] at (${x + 3}, 148) {%
    \\fontsize{6.5}{8.5}\\selectfont\\sffamily\\color{covtextmuted}%
    ${esc(pi.description)}%
  };`;
  }
  return tikz;
})()}

% === Separator ===
\\fill[covprimary, opacity=0.15] (42, 88) rectangle (195, 88.3);

% === Author ===
${
  p.authorName
    ? `
\\node[anchor=north west] at (42, 78) {%
  \\fontsize{15}{15}\\selectfont\\sffamily\\color{${textColor}}%
  ${esc(p.authorName)}%
};`
    : ""
}
${
  p.authorCredentials
    ? `
\\node[anchor=north west, text width=140mm] at (42, 66) {%
  \\fontsize{8.5}{11}\\selectfont\\sffamily\\color{covtextmuted}%
  ${esc(p.authorCredentials)}%
};`
    : ""
}

% === Year ===
\\node[anchor=north east] at (195, 78) {%
  \\fontsize{12}{12}\\selectfont\\sffamily\\color{covprimary}%
  ${yr}%
};

% === Author in sidebar (rotated) ===
${
  p.authorName
    ? `
\\node[anchor=center, rotate=90, opacity=0.6] at (15, 70) {%
  \\fontsize{8}{8}\\selectfont\\sffamily\\color{covtextbright}%
  ${esc(p.authorName)}%
};`
    : ""
}

% === Bottom accents ===
${accentBar(42, 30, 20, 0.7)}
\\fill[covprimary] (65, 30) rectangle (78, 30.7);
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAYOUT: MONOLITH
// Full-bleed primary color with centered type, large
// diagonal shape, ring decorations, pillar boxes
// Best for: bold/creative covers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function layoutMonolith(p: CoverParams, c: ColorSet): string {
  const yr = p.year || new Date().getFullYear();
  // Centered two-line title sized to the 160mm column (≈454pt)
  const hasTwoLineTitle = p.titleLine1 && p.titleLine2;
  const twoLine = hasTwoLineTitle
    ? (() => {
        const maxLen = Math.max(p.titleLine1!.length, p.titleLine2!.length);
        const size = Math.max(
          18,
          Math.min(42, Math.floor(454 / (0.6 * maxLen))),
        );
        return {
          size,
          leading: Math.round(size * 1.1),
          gap: Math.round(size * 0.5),
        };
      })()
    : null;
  return `
% === Full-bleed primary background ===
\\fill[covprimary] (0,0) rectangle (210,297);

% === Subtle texture dots ===
\\begin{scope}[opacity=0.04]
  \\foreach \\i in {0,5,...,300} {
    \\fill[covtextbright] ({\\i*0.7}, 0) circle (0.3);
    \\fill[covtextbright] ({210-\\i*0.7}, 297) circle (0.2);
  }
\\end{scope}

% === Large diagonal shape ===
\\fill[covprimarydark, opacity=0.3]
  (0, 0) -- (210, 0) -- (210, 140) -- (0, 180) -- cycle;

% === Ring decorations ===
\\draw[covtextbright, line width=1.5pt, opacity=0.1] (170, 260) circle (35);
\\draw[covtextbright, line width=0.8pt, opacity=0.06] (170, 260) circle (50);
\\draw[covaccent, line width=0.5pt, opacity=0.15] (40, 45) circle (25);

% === Horizontal rules ===
\\fill[covtextbright, opacity=0.2] (30, 230) rectangle (180, 230.5);
\\fill[covtextbright, opacity=0.2] (30, 108) rectangle (180, 108.5);

${
  p.tagline
    ? `
% === Tagline ===
\\node[anchor=center] at (105, 265) {%
  \\fontsize{9}{12}\\selectfont\\scshape\\color{covtextbright!70}%
  ${escUpper(p.tagline)}%
};`
    : ""
}

${p.featureText ? featureBadge(105, 250, 18, p.featureText, p.featureSubtext) : ""}

% === Title (centered) ===
${
  hasTwoLineTitle
    ? `
\\node[anchor=center] at (105, 196) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.titleLine1!)}%
};
\\node[anchor=center] at (105, ${196 - twoLine!.gap}) {%
  \\fontsize{${twoLine!.size}}{${twoLine!.leading}}\\selectfont\\bfseries\\sffamily\\color{covaccent}%
  ${escTitle(p.titleLine2!)}%
};`
    : `
\\node[anchor=center, text width=160mm, align=center] at (105, 190) {%
  \\fontsize{${fitTitleSize(p.title, 42).size}}{${fitTitleSize(p.title, 42).leading}}\\selectfont\\bfseries\\sffamily\\color{covtextbright}%
  ${escTitle(p.title)}%
};`
}

% === Accent bar ===
\\fill[covaccent] (80, 158) rectangle (130, 159);

${
  p.subtitle
    ? `
% === Subtitle ===
\\node[anchor=center, text width=155mm, align=center] at (105, 145) {%
  \\fontsize{14}{18}\\selectfont\\sffamily\\color{covtextbright!75}%
  ${esc(p.subtitle)}%
};`
    : ""
}

% === Pillar boxes (darker bg on primary) ===
${(() => {
  if (!p.pillars || p.pillars.length === 0) return "";
  const count = Math.min(p.pillars.length, 3);
  const boxW = 50;
  const gap = 5;
  const totalW = count * boxW + (count - 1) * gap;
  const startX = (210 - totalW) / 2;
  let tikz = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round(startX + i * (boxW + gap));
    const pi = p.pillars[i];
    tikz += `
  \\fill[covprimarydark, opacity=0.4, rounded corners=2pt]
    (${x}, 74) rectangle (${x + boxW}, 96);
  \\node[anchor=north west] at (${x + 3}, 94) {%
    \\fontsize{7.5}{7.5}\\selectfont\\bfseries\\sffamily\\color{covaccent}%
    ${escUpper(pi.title)}%
  };
  \\node[anchor=north west, text width=${boxW - 6}mm] at (${x + 3}, 87) {%
    \\fontsize{6.5}{8.5}\\selectfont\\sffamily\\color{covtextbright!65}%
    ${esc(pi.description)}%
  };`;
  }
  return tikz;
})()}

% === Author ===
${
  p.authorName
    ? `
\\node[anchor=center] at (105, 50) {%
  \\fontsize{16}{16}\\selectfont\\sffamily\\color{covtextbright}%
  ${esc(p.authorName)}%
};`
    : ""
}
${
  p.authorCredentials
    ? `
\\node[anchor=center, text width=150mm, align=center] at (105, 38) {%
  \\fontsize{8.5}{11}\\selectfont\\sffamily\\color{covtextbright!55}%
  ${esc(p.authorCredentials)}%
};`
    : ""
}

% === Year ===
\\node[anchor=center] at (105, 18) {%
  \\fontsize{11}{11}\\selectfont\\sffamily\\color{covtextbright!50}%
  ${yr}%
};
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Assemble full LaTeX document
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  a5: { w: 148, h: 210 },
  b5: { w: 176, h: 250 },
  a4: { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
};

const LAYOUT_FN: Record<CoverLayout, (p: CoverParams, c: ColorSet) => string> =
  {
    techgrid: layoutTechgrid,
    luxe: layoutLuxe,
    aurora: layoutAurora,
    architect: layoutArchitect,
    monolith: layoutMonolith,
  };

export function generateCoverLatex(
  params: CoverParams,
  bookFormat: string,
  language: string,
  stylePreset: string,
  customColors?: string[],
): string {
  const colors = deriveColors(customColors, stylePreset);
  const dims = PAPER_DIMS[bookFormat] || PAPER_DIMS.a5;
  const layoutFn = LAYOUT_FN[params.layout] || layoutTechgrid;
  const tikzBody = layoutFn(params, colors);

  return `% ============================================================
% BookForge — Generated Book Cover
% Compile: xelatex cover.tex (or pdflatex as fallback)
% ============================================================
\\documentclass{article}
\\usepackage[paperwidth=${dims.w}mm, paperheight=${dims.h}mm, margin=0pt]{geometry}
\\usepackage{tikz}
\\usetikzlibrary{calc,positioning}
\\usepackage{eso-pic}

% ── Font setup (xelatex preferred, pdflatex fallback) ──
\\usepackage{ifxetex}
\\ifxetex
  \\usepackage{fontspec}
  \\setmainfont{Liberation Sans}[
    BoldFont={Liberation Sans Bold},
    ItalicFont={Liberation Sans Italic}
  ]
  \\setsansfont{Liberation Sans}[
    BoldFont={Liberation Sans Bold},
    ItalicFont={Liberation Sans Italic}
  ]
\\else
  \\usepackage[utf8]{inputenc}
  \\usepackage[T1]{fontenc}
  \\usepackage{lmodern}
  \\usepackage{helvet}
  \\renewcommand{\\familydefault}{\\sfdefault}
\\fi

\\usepackage{xcolor}
\\usepackage{textcomp}
\\pagestyle{empty}
\\parindent=0pt
\\topskip=0pt

% ── Cover colors ──
\\definecolor{covbgdeep}{HTML}{${colors.bgDeep}}
\\definecolor{covbgmid}{HTML}{${colors.bgMid}}
\\definecolor{covprimary}{HTML}{${colors.primary}}
\\definecolor{covprimarydark}{HTML}{${colors.primaryDark}}
\\definecolor{covprimarylight}{HTML}{${colors.primaryLight}}
\\definecolor{covaccent}{HTML}{${colors.accent}}
\\definecolor{covaccentalt}{HTML}{${colors.accentAlt}}
\\definecolor{covtextbright}{HTML}{${colors.textBright}}
\\definecolor{covtextmuted}{HTML}{${colors.textMuted}}

% ── Page background (fills any gaps around TikZ picture) ──
${(() => {
  const pageBg: Record<string, string> = {
    techgrid: "covbgdeep",
    luxe: "covbgdeep",
    aurora: "covbgdeep",
    architect: "white",
    monolith: "covprimary",
  };
  return `\\pagecolor{${pageBg[params.layout] || "covbgdeep"}}`;
})()}

\\begin{document}%
% [remember picture, overlay] anchors the artwork at the exact page corner
% (needs the 2nd compile pass — compileCover always runs two). This fills the
% page edge-to-edge without the old +5mm paper hack, and unlike an eso-pic
% shipout hook it keeps TikZ transparency working (opacity dies in shipout BG).
\\thispagestyle{empty}%
% Layouty rysują w logicznych mm A4 (210×297). xscale/yscale + transform shape
% skalują CAŁOŚĆ — geometrię, fonty i text width węzłów — do realnego formatu.
% Samo skalowanie jednostek x/y (poprzednia wersja) zostawiało tekst w pełnym
% rozmiarze: na A5 tytuł i pillar boxy wyjeżdżały poza prawą krawędź strony.
\\begin{tikzpicture}[remember picture, overlay,
  shift={(current page.south west)},
  xscale=${(dims.w / 210).toFixed(5)}, yscale=${(dims.h / 297).toFixed(5)},
  transform shape,
  x=1mm, y=1mm]
\\clip (0,0) rectangle (210,297);

${tikzBody}

\\end{tikzpicture}%
\\end{document}
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Compile cover LaTeX → PDF
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function compileCover(projectId: string): Promise<{
  pdfPath: string;
  s3Key?: string;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      coverType: true,
      coverLatex: true,
      coverImageS3Key: true,
      coverImageLocalPath: true,
      bookFormat: true,
      language: true,
      stylePreset: true,
      customColors: true,
      title: true,
      topic: true,
      authorName: true,
      subtitle: true,
      coverParams: true,
    },
  });

  if (!project) throw new Error("Project not found");
  if ((project as any).coverType === "NONE")
    throw new Error("No cover configured");

  const coverDir = path.join(BUILD_DIR, projectId);
  if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

  // ── CUSTOM UPLOAD: convert image to PDF ──
  if ((project as any).coverType === "CUSTOM_UPLOAD") {
    return compileCoverFromImage(project, coverDir);
  }

  // ── GENERATED: compile LaTeX ──
  if (!(project as any).coverLatex) throw new Error("No cover LaTeX source");

  const texPath = path.join(coverDir, "cover.tex");
  const pdfPath = path.join(coverDir, "cover.pdf");
  fs.writeFileSync(texPath, (project as any).coverLatex, "utf-8");

  console.log(`  📕 Compiling cover for ${projectId}...`);

  // Try xelatex first (better font support), fallback to pdflatex
  let compiled = false;
  for (const engine of ["xelatex", "pdflatex"]) {
    if (compiled) break;
    for (let pass = 1; pass <= 2; pass++) {
      try {
        await execAsync(
          `${engine} -interaction=nonstopmode -output-directory="${coverDir}" "${texPath}"`,
          // cwd: custom-upload covers reference the image by relative path
          { timeout: 60000, maxBuffer: 5 * 1024 * 1024, cwd: coverDir },
        );
      } catch (err: any) {
        if (pass === 2 && !fs.existsSync(pdfPath) && engine === "pdflatex") {
          const logPath = path.join(coverDir, "cover.log");
          const logContent = fs.existsSync(logPath)
            ? fs.readFileSync(logPath, "utf-8").slice(-2000)
            : "No log";
          console.error(
            `  ❌ Cover compilation failed (${engine}):\n${logContent}`,
          );
          throw new Error("Cover LaTeX compilation failed");
        }
      }
    }
    if (fs.existsSync(pdfPath)) {
      compiled = true;
      console.log(`  ✅ Cover compiled with ${engine}`);
    }
  }

  if (!fs.existsSync(pdfPath)) throw new Error("Cover PDF not created");

  const pdfSize = fs.statSync(pdfPath).size;
  console.log(`  ✅ Cover PDF: ${(pdfSize / 1024).toFixed(0)} KB`);

  // Upload to S3
  let s3Key: string | undefined;
  if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
    s3Key = `books/${projectId}/cover.pdf`;
    await uploadToS3(pdfPath, s3Key);
    console.log(`  ☁️  Cover uploaded: ${s3Key}`);
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      coverPdfS3Key: s3Key || null,
      coverPdfLocalPath: pdfPath,
    },
  });

  return { pdfPath, s3Key };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Convert uploaded image to full-bleed PDF
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function compileCoverFromImage(
  project: any,
  coverDir: string,
): Promise<{ pdfPath: string; s3Key?: string }> {
  const imgPath = path.join(coverDir, "cover-image.jpg");
  const pdfPath = path.join(coverDir, "cover.pdf");
  const dims = PAPER_DIMS[project.bookFormat] || PAPER_DIMS.a5;

  if (
    project.coverImageS3Key &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.S3_BUCKET
  ) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || "eu-north-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: project.coverImageS3Key,
      }),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any)
      chunks.push(Buffer.from(chunk));
    fs.writeFileSync(imgPath, Buffer.concat(chunks));
  } else if (
    project.coverImageLocalPath &&
    fs.existsSync(project.coverImageLocalPath)
  ) {
    fs.copyFileSync(project.coverImageLocalPath, imgPath);
  } else {
    throw new Error("Cover image not found");
  }

  const texContent = `\\documentclass{article}
\\usepackage[paperwidth=${dims.w}mm, paperheight=${dims.h}mm, margin=0pt]{geometry}
\\usepackage{graphicx}
\\usepackage{eso-pic}
\\pagestyle{empty}
\\begin{document}
\\AddToShipoutPictureBG*{\\put(0,0){\\includegraphics[width=\\paperwidth, height=\\paperheight]{${imgPath.replace(/\\/g, "/")}}}}%
\\null
\\end{document}
`;

  const texPath = path.join(coverDir, "cover.tex");
  fs.writeFileSync(texPath, texContent, "utf-8");
  await execAsync(
    `pdflatex -interaction=nonstopmode -output-directory="${coverDir}" "${texPath}"`,
    { timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
  );

  if (!fs.existsSync(pdfPath)) throw new Error("Cover PDF from image failed");

  let s3Key: string | undefined;
  if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
    s3Key = `books/${project.id}/cover.pdf`;
    await uploadToS3(pdfPath, s3Key);
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { coverPdfS3Key: s3Key || null, coverPdfLocalPath: pdfPath },
  });

  return { pdfPath, s3Key };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Merge cover PDF + book PDF → final output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function mergeCoverWithBook(
  coverPdfPath: string,
  bookPdfPath: string,
  outputPath: string,
  bookFormat: string = "a5",
): Promise<void> {
  const dims = PAPER_DIMS[bookFormat] || PAPER_DIMS.a5;
  const coverDir = path.dirname(coverPdfPath);
  const blankTexPath = path.join(coverDir, "blank.tex");
  const blankPdfPath = path.join(coverDir, "blank.pdf");

  // ── 1. Generate a blank page PDF (same paper size as book) ──
  const blankTex = `\\documentclass{article}
\\usepackage[paperwidth=${dims.w}mm, paperheight=${dims.h}mm, margin=0pt]{geometry}
\\pagestyle{empty}
\\begin{document}
\\null\\newpage
\\end{document}
`;
  fs.writeFileSync(blankTexPath, blankTex, "utf-8");
  try {
    await execAsync(
      `pdflatex -interaction=nonstopmode -output-directory="${coverDir}" "${blankTexPath}"`,
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 },
    );
  } catch {
    // blank page compilation failed — skip blank page
    console.warn("  ⚠️  Blank page compilation failed, merging without it");
  }

  const hasBlank = fs.existsSync(blankPdfPath);
  const parts = hasBlank
    ? `"${coverPdfPath}" "${blankPdfPath}" "${bookPdfPath}"`
    : `"${coverPdfPath}" "${bookPdfPath}"`;

  // ── 2. Merge: cover + blank + book ──
  try {
    await execAsync(`pdfunite ${parts} "${outputPath}"`, { timeout: 30000 });
    console.log(
      `  📎 Cover merged with pdfunite${hasBlank ? " (+ blank page)" : ""}`,
    );
  } catch {
    try {
      const pdftk_parts = hasBlank
        ? `"${coverPdfPath}" "${blankPdfPath}" "${bookPdfPath}"`
        : `"${coverPdfPath}" "${bookPdfPath}"`;
      await execAsync(`pdftk ${pdftk_parts} cat output "${outputPath}"`, {
        timeout: 30000,
      });
      console.log(
        `  📎 Cover merged with pdftk${hasBlank ? " (+ blank page)" : ""}`,
      );
    } catch {
      console.error("  ❌ PDF merge failed — using book without cover");
      fs.copyFileSync(bookPdfPath, outputPath);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// S3 helper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function uploadToS3(filePath: string, key: string): Promise<string> {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "eu-north-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: fs.readFileSync(filePath),
      ContentType: "application/pdf",
    }),
  );
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || "eu-north-1"}.amazonaws.com/${key}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Default cover params + chapter-derived pillars
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getDefaultCoverParams(project: {
  title?: string | null;
  topic: string;
  subtitle?: string | null;
  authorName?: string | null;
  targetPages: number;
  stylePreset: string;
  language?: string | null;
}): CoverParams {
  const layoutMap: Record<string, CoverLayout> = {
    modern: "techgrid",
    academic: "luxe",
    creative: "aurora",
    business: "architect",
    minimal: "architect",
  };

  const title = project.title || project.topic;
  // No explicit subtitle → reuse the user's topic line (fills the dead space
  // under the title), unless it IS the title.
  const subtitle =
    project.subtitle ||
    (project.title && project.topic.trim() !== project.title.trim()
      ? project.topic
      : undefined);

  // Two-line title (white + accent line) — the strongest visual move of the
  // reference cover; derived automatically unless the caller overrides.
  const split = splitTitleForCover(title);

  // Center badge: page count + localized "pages · complete guide" label.
  const lang = (project.language || "en").toLowerCase();
  const featureText = project.targetPages
    ? `${project.targetPages}`
    : undefined;
  const featureSubtext = GUIDE_LABEL[lang] || GUIDE_LABEL.en;

  return {
    layout: layoutMap[project.stylePreset] || "techgrid",
    title,
    titleLine1: split?.line1,
    titleLine2: split?.line2,
    subtitle,
    authorName: project.authorName || undefined,
    featureText,
    featureSubtext,
    pageCount: project.targetPages || undefined,
    year: new Date().getFullYear(),
    pillars: [],
  };
}

/**
 * Auto-generate pillar boxes from chapter structure.
 * Called when generating cover and structure is available.
 */
export function derivePillarsFromChapters(
  chapters: { title: string; description?: string }[],
  maxPillars: number = 3,
): CoverPillar[] {
  if (!chapters || chapters.length === 0) return [];

  // Cut at a word boundary — a pillar reading "METO..." looks broken
  const cutAtWord = (text: string, max: number): string => {
    const t = text.trim();
    if (t.length <= max) return t;
    const slice = t.substring(0, max + 1);
    const lastSpace = slice.lastIndexOf(" ");
    const cut =
      lastSpace > max * 0.5
        ? slice.substring(0, lastSpace)
        : slice.substring(0, max);
    return (
      cut
        .replace(/[,;:.\s]+$/, "")
        // drop a trailing 1-2 letter word — "PRACA KAZUISTYCZNA W…" reads broken
        .replace(/\s+\p{L}{1,2}$/u, "") + "…"
    );
  };
  // Chapter titles are often "Short label: long explanation" — the label
  // alone makes the best pillar heading
  const pillarTitle = (title: string): string =>
    cutAtWord(title.split(/[:—]/)[0], 24);
  const toPillar = (ch: { title: string; description?: string }) => ({
    title: pillarTitle(ch.title),
    description: cutAtWord(ch.description || ch.title, 60),
  });

  if (chapters.length <= maxPillars) {
    return chapters.slice(0, maxPillars).map(toPillar);
  }

  // Pick evenly spaced chapters: first, middle, last
  const indices = [0, Math.floor(chapters.length / 2), chapters.length - 1];
  return indices.slice(0, maxPillars).map((i) => toPillar(chapters[i]));
}
