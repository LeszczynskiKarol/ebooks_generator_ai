/**
 * Mechanical citation guards for the book pipeline — adapted from smart-edu,
 * WITHOUT the LLM judge (deliberately, to keep generation cost down). Pure
 * deterministic string processing; runs after a chapter's LaTeX is generated
 * and before it is stored/compiled.
 *
 *  1. validatePageCitations — every "s. X" / "p. X" inside a \footnote{} must
 *     point at a page that (a) exists in the page-grounded research material
 *     ("=== STRONA N ===" markers, added by the paginated scraper) and
 *     (b) lexically overlaps the sentence the footnote is attached to.
 *     Failing either → the page number is stripped (footnote kept, page gone).
 *     This mechanically enforces the prompt rule "add a page ONLY if it is
 *     visible in the research material". No-op when the research carries no
 *     page markers at all (nothing to verify against → model pages untouched).
 *  2. detectFabricatedStats — report-only: inferential statistics (r=, p<, F=,
 *     β, χ², t()) or precise %/n= claims with no footnote. Logged for review,
 *     nothing modified.
 *  3. stripEchoedPageMarkers — safety net: remove any "=== STRONA N ===" the
 *     model copied verbatim from the research material into the chapter body.
 */

const PL_MAP: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] || c);
}

/** Strip LaTeX commands/braces down to plain words for tokenisation. */
function delatex(s: string): string {
  return s
    .replace(/\\([%&$#_{}])/g, "$1") // unescape \% \& \$ \# \_ \{ \}
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ") // \cmd / \cmd[opt]
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ");
}

/** Unique normalized 7-char prefixes of words ≥5 chars — robust to PL inflection. */
function tokens(s: string): Set<string> {
  return new Set(
    normalize(delatex(s))
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5)
      .map((w) => w.substring(0, 7)),
  );
}

/** page number → concatenated page text, parsed from "=== STRONA N ===" markers. */
function pageMap(sourcesText: string): Map<number, string> {
  const map = new Map<number, string>();
  const parts = sourcesText.split(/={2,}\s*STRONA\s+(\d+)\s*={2,}\n?/);
  for (let i = 1; i < parts.length; i += 2) {
    const p = parseInt(parts[i], 10);
    if (!isNaN(p)) map.set(p, (map.get(p) || "") + (parts[i + 1] || ""));
  }
  return map;
}

/** Extract every \footnote{...} with balanced-brace matching. */
function findFootnotes(
  latex: string,
): { start: number; end: number; inner: string }[] {
  const out: { start: number; end: number; inner: string }[] = [];
  const tag = "\\footnote{";
  let i = 0;
  while ((i = latex.indexOf(tag, i)) !== -1) {
    let depth = 1;
    let j = i + tag.length;
    for (; j < latex.length && depth > 0; j++) {
      const c = latex[j];
      if (c === "\\") {
        j++; // skip the escaped character (\{, \}, \\, …)
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    // depth hit 0 at index j-1 (the closing brace); j is one past it
    out.push({ start: i, end: j, inner: latex.substring(i + tag.length, j - 1) });
    i = j;
  }
  return out;
}

const PAGE_REF_RE = /\b(?:s|p|str|pp)\.\s*\d+(?:\s*[-–—]\s*\d+)?/gi;

export interface DemotedPage {
  page: number;
  reason: "page-not-in-research" | "no-lexical-overlap";
  claim: string;
}

/**
 * Validate page citations inside \footnote{} blocks against the page-grounded
 * research material. Unsupported page numbers are removed from the footnote.
 */
export function validatePageCitations(
  latex: string,
  sourcesText: string,
): { content: string; demoted: DemotedPage[] } {
  const demoted: DemotedPage[] = [];
  const pm = pageMap(sourcesText);
  if (pm.size === 0) return { content: latex, demoted }; // nothing grounded → don't touch

  const footnotes = findFootnotes(latex);
  let content = latex;

  // process last → first so earlier offsets stay valid while we splice
  for (let k = footnotes.length - 1; k >= 0; k--) {
    const fn = footnotes[k];
    const pageRefs = fn.inner.match(PAGE_REF_RE);
    if (!pageRefs) continue;

    // claim = body text preceding the footnote (last ~2 sentences)
    const before = delatex(
      content.substring(Math.max(0, fn.start - 500), fn.start),
    );
    const sentences = before.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
    const claim = sentences.slice(-2).join(" ").trim();
    const claimToks = tokens(claim);
    const needed = Math.max(2, Math.ceil(claimToks.size * 0.15));

    let newInner = fn.inner;
    for (const ref of pageRefs) {
      const nums = (ref.match(/\d+/g) || []).map((x) => parseInt(x, 10));
      let exists = false;
      let bestOverlap = 0;
      for (const p of nums) {
        const pageText = pm.get(p);
        if (!pageText) continue;
        exists = true;
        const pToks = tokens(pageText);
        let hits = 0;
        for (const t of claimToks) if (pToks.has(t)) hits++;
        bestOverlap = Math.max(bestOverlap, hits);
      }
      if (exists && bestOverlap >= needed) continue; // verified — keep

      demoted.push({
        page: nums[0] ?? -1,
        reason: exists ? "no-lexical-overlap" : "page-not-in-research",
        claim: claim.substring(0, 160),
      });
      newInner = newInner.replace(ref, "");
    }

    if (newInner !== fn.inner) {
      const cleaned = newInner
        .replace(/,\s*\./g, ".")
        .replace(/\(\s*\)/g, "")
        .replace(/\s+([.,;])/g, "$1")
        .replace(/,\s*$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      content =
        content.substring(0, fn.start) +
        "\\footnote{" +
        cleaned +
        "}" +
        content.substring(fn.end);
    }
  }

  return { content, demoted };
}

export interface StatsFinding {
  severity: "high" | "low";
  sentence: string;
}

const HIGH_STATS_RE =
  /(\br\s*=\s*[01][,.]\d+|\bp\s*[<>=]\s*0[,.]\d+|\bF\s*=\s*\d+|β\s*=|χ²|\bt\s*\(\s*\d+\s*\))/;
const LOW_STATS_RE = /(\d+[,.]?\d*\s*%|\bn\s*=\s*\d{2,}|\bN\s*=\s*\d{2,})/;

/**
 * Flag sentences with statistical claims. "high" = inferential statistics that
 * a generated book has no business reporting unless lifted from a source;
 * "low" = %, n= with no footnote attached. Report-only.
 */
export function detectFabricatedStats(latex: string): StatsFinding[] {
  const findings: StatsFinding[] = [];
  const marked = latex.replace(/\\footnote\{[^}]*\}/g, " ⟦FN⟧ ");
  const text = delatex(marked);
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    if (sentence.length < 20) continue;
    const hasFootnote = sentence.includes("⟦FN⟧");
    const clean = sentence.replace(/⟦FN⟧/g, "").trim();
    if (HIGH_STATS_RE.test(clean)) {
      findings.push({ severity: "high", sentence: clean.substring(0, 200) });
    } else if (!hasFootnote && LOW_STATS_RE.test(clean)) {
      findings.push({ severity: "low", sentence: clean.substring(0, 200) });
    }
  }
  return findings;
}

/** Remove any "=== STRONA N ===" markers the model echoed into the body. */
export function stripEchoedPageMarkers(latex: string): string {
  return latex.replace(/={2,}\s*STRONA\s+\d+\s*={2,}\n?/gi, "");
}

export interface GuardResult {
  content: string;
  demotedPages: DemotedPage[];
  statsFindings: StatsFinding[];
}

/**
 * Run all mechanical guards on a freshly generated chapter. Returns the cleaned
 * LaTeX plus what was changed/flagged. Deterministic; never calls an LLM.
 */
export function applyCitationGuards(
  latex: string,
  sourcesText: string,
): GuardResult {
  let content = stripEchoedPageMarkers(latex);
  const { content: validated, demoted } = validatePageCitations(
    content,
    sourcesText,
  );
  content = validated;
  const statsFindings = detectFabricatedStats(content);
  return { content, demotedPages: demoted, statsFindings };
}
