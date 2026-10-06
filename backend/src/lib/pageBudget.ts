// Page budgets are ours to set, never the customer's: whatever the editor
// sends (added/removed chapters, sections), the server redistributes the
// ORDERED page count over the outline. Relative weights the model gave are
// kept; new items get the average weight.

interface PagedSection {
  targetPages?: number;
}
interface PagedChapter<S extends PagedSection> {
  targetPages?: number;
  sections: S[];
}

function weights(items: Array<{ targetPages?: number }>): number[] {
  const known = items
    .map((i) => Number(i.targetPages))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  return items.map((i) => {
    const n = Number(i.targetPages);
    return Number.isFinite(n) && n > 0 ? n : avg;
  });
}

/** Integer split of `total` by weights (largest remainder), each ≥ `min`. */
function split(total: number, w: number[], step: number, min: number): number[] {
  const units = Math.round(total / step);
  const minUnits = Math.round(min / step);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const raw = w.map((x) => (x / sum) * units);
  const out = raw.map((r) => Math.max(minUnits, Math.floor(r)));
  let left = units - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0 && order.length; k++, left--) {
    out[order[k % order.length].i]++;
  }
  // Minimums pushed us over (more items than pages): shave the largest.
  while (left < 0) {
    const i = out.indexOf(Math.max(...out));
    if (out[i] <= minUnits) break;
    out[i]--;
    left++;
  }
  return out.map((u) => u * step);
}

export function rebalancePages<S extends PagedSection, C extends PagedChapter<S>>(
  chapters: C[],
  totalPages: number,
): C[] {
  if (!chapters.length) return chapters;
  const chPages = split(totalPages, weights(chapters), 1, 1);
  return chapters.map((ch, ci) => {
    const secPages = ch.sections.length
      ? split(chPages[ci], weights(ch.sections), 0.5, 0.5)
      : [];
    return {
      ...ch,
      targetPages: chPages[ci],
      sections: ch.sections.map((s, si) => ({ ...s, targetPages: secPages[si] })),
    };
  });
}

interface IdItem {
  id?: string;
  title?: string;
  targetPages?: number;
}

/**
 * Page weights come from OUR stored version, never from the request: each
 * incoming chapter/section takes the stored budget of the item with the same
 * id; new items (no match) get 0 = "unknown" → average weight in
 * rebalancePages. Items without a title are dropped first so the
 * redistribution adds up.
 */
export function carryStoredPages<
  S extends IdItem,
  C extends IdItem & { sections?: S[] },
>(
  incoming: C[],
  stored: Array<IdItem & { sections?: IdItem[] }>,
): Array<C & { sections: S[] }> {
  const chPages = new Map<string, number>();
  const secPages = new Map<string, number>();
  for (const c of stored) {
    if (c.id) chPages.set(c.id, Number(c.targetPages) || 0);
    for (const s of c.sections ?? []) {
      if (s.id) secPages.set(s.id, Number(s.targetPages) || 0);
    }
  }
  return incoming
    .filter((c) => typeof c?.title === "string" && c.title.trim())
    .map((c) => ({
      ...c,
      targetPages: (c.id && chPages.get(c.id)) || 0,
      sections: (Array.isArray(c.sections) ? c.sections : [])
        .filter((s) => typeof s?.title === "string" && s.title.trim())
        .map((s) => ({ ...s, targetPages: (s.id && secPages.get(s.id)) || 0 })),
    }));
}
