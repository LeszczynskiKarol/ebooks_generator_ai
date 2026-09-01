/**
 * Catch the one typo that hurts most: a misspelled book title.
 *
 * The title is set in the largest type on the cover and on the title page, and
 * users type it fast — the topic field gets a carefully pasted brief, the title
 * gets a quick retype of the same phrase. When the two differ by a character or
 * two, one of them has a typo (real case: topic said "Przewodnik po wyprawce",
 * title said "Przwodnik po wyprawce", and the cover would have printed the
 * misspelling).
 *
 * This never rewrites anything and never blocks checkout: it only surfaces the
 * discrepancy so the author picks the spelling they meant. We deliberately do
 * NOT decide which side is correct — the topic is not automatically more
 * trustworthy than the title.
 */

/** Levenshtein distance, abandoned as soon as it exceeds `max` (keeps it cheap
 *  on every keystroke and lets us reject long/unrelated pairs immediately). */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // no cell in this row can lead to a match
    prev = cur;
  }
  return prev[b.length];
}

/** Fold case and whitespace so "  Przewodnik  po Wyprawce " ≡ "przewodnik po wyprawce". */
function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** A pasted brief is many lines, often bulleted — each line is a candidate for
 *  "the phrase the author also typed into the title". */
function candidateLines(topic: string): string[] {
  return topic
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•·*\-–—]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Returns the spelling found in the topic when it is near-identical to the
 * title but not equal — i.e. the pair that almost certainly contains a typo.
 * Returns null when there is nothing worth asking about.
 */
export function suggestTitleFix(
  title: string | undefined,
  topic: string | undefined,
): string | null {
  const t = (title ?? "").trim();
  const topicRaw = (topic ?? "").trim();
  if (!t || !topicRaw) return null;

  // Too short and a single edit stops meaning "typo" — "Ptak" vs "Ptaki" is a
  // deliberate difference, not a slip.
  if (t.length < 8) return null;

  const nt = normalize(t);
  let best: { text: string; dist: number } | null = null;

  for (const line of candidateLines(topicRaw)) {
    const nl = normalize(line);
    if (nl === nt) return null; // identical — nothing to flag anywhere
    if (nl.length < 8) continue;

    // Allow 1 edit for short phrases, 2 once the phrase is long enough that a
    // double slip is plausible without the strings being genuinely different.
    const max = nt.length >= 20 ? 2 : 1;
    const dist = boundedEditDistance(nt, nl, max);
    if (dist >= 1 && dist <= max && (!best || dist < best.dist)) {
      best = { text: line, dist };
    }
  }

  return best ? best.text : null;
}
