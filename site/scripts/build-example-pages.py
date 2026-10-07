# Landing pages for sample books: per-book data the Astro routes consume.
# For every entry in src/data/examples.js this script:
#   1. reads the PDF's hyperref bookmarks (chapters + sections) into an HTML-able
#      table of contents,
#   2. renders "look inside" pages as webp: the cover plus a run of pages
#      starting at the FIRST CHAPTER (skipping the title page and the printed
#      TOC, which would duplicate the HTML TOC),
#   3. writes src/data/examplePages.json + public/samples/pages/<slug>/pN.webp.
#
# Outputs are COMMITTED (like the cover thumbnails) — CI never runs this.
# Run from site/ after adding a book:  python scripts/build-example-pages.py
# Needs: pypdf, pdftoppm (poppler) and Pillow on PATH.
import hashlib, io, json, os, re, subprocess, sys, tempfile

from pypdf import PdfReader
from PIL import Image

SAMPLES = "public/samples"
OUT_PAGES = os.path.join(SAMPLES, "pages")
OUT_JSON = "src/data/examplePages.json"
TOC_OVERRIDES = json.load(io.open("src/data/tocOverrides.json", encoding="utf-8"))
PREVIEW_CONTENT_PAGES = 5  # pages rendered from the first chapter onward
WIDTH = 760                # rendered page width in px (A5 stays crisp, files small)

slugs = re.findall(r'slug:\s*"([a-z0-9-]+)"', io.open("src/data/examples.js", encoding="utf-8").read())

def walk(outline, depth=0):
    items = []
    for it in outline:
        if isinstance(it, list):
            items += walk(it, depth + 1)
        else:
            items.append((depth, it))
    return items

data = {}
for slug in slugs:
    pdf_path = os.path.join(SAMPLES, slug + ".pdf")
    if not os.path.exists(pdf_path):
        print(f"  ! missing PDF for {slug} — skipped", file=sys.stderr)
        continue
    r = PdfReader(pdf_path)

    # ── TOC from bookmarks ──
    toc, first_chapter_page = [], None
    for depth, it in walk(r.outline):
        title = (it.title or "").strip()
        if not title or title.lower() in ("spis treści", "table of contents", "contents"):
            continue
        try:
            page_idx = r.get_destination_page_number(it)
        except Exception:
            page_idx = None
        if depth == 0:
            toc.append({"title": title, "sections": []})
            if first_chapter_page is None and page_idx is not None:
                first_chapter_page = page_idx + 1  # 1-based
        elif toc:
            toc[-1]["sections"].append(title)

    # ── page renders: cover + first-chapter run ──
    start = first_chapter_page or 4
    pages_dir = os.path.join(OUT_PAGES, slug)
    os.makedirs(pages_dir, exist_ok=True)
    rendered = []
    targets = [1] + list(range(start, start + PREVIEW_CONTENT_PAGES))
    with tempfile.TemporaryDirectory() as tmp:
        for i, p in enumerate(targets, 1):
            if p > len(r.pages):
                break
            prefix = os.path.join(tmp, f"pg{i}")
            subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", str(p), "-l", str(p), pdf_path, prefix],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            src = next((os.path.join(tmp, f) for f in os.listdir(tmp) if f.startswith(f"pg{i}-")), None)
            if not src:
                continue
            out = os.path.join(pages_dir, f"p{i}.webp")
            img = Image.open(src)
            img = img.resize((WIDTH, int(img.height * WIDTH / img.width)), Image.LANCZOS)
            img.save(out, "WEBP", quality=82)
            rendered.append(f"p{i}.webp")

    # Hand-written replacements for chapter titles that carry an em dash in the
    # PDF itself: the site shows no em dashes, and a mechanical swap would turn
    # "Enough — but" into "Enough: but". src/data/tocOverrides.json, exact match.
    for ch in toc:
        ch["title"] = TOC_OVERRIDES.get(ch["title"], ch["title"])
        ch["sections"] = [TOC_OVERRIDES.get(x, x) for x in ch["sections"]]
    left = [x for ch in toc for x in [ch["title"], *ch["sections"]] if "—" in x]
    if left:
        print(f"  !! {slug}: em dash in TOC, add to src/data/tocOverrides.json: {left}")
    # PDFs are not in git (CI cannot hash them) and /samples/ is cached as
    # immutable: the pages link the PDF with ?v=<this> so a rebuilt book is
    # actually re-downloaded.
    pdf_version = hashlib.md5(open(pdf_path, "rb").read()).hexdigest()[:8]
    data[slug] = {"toc": toc, "pages": rendered, "previewFrom": start, "pdfVersion": pdf_version}
    print(f"  OK {slug}: {len(toc)} chapters, {sum(len(c['sections']) for c in toc)} sections, {len(rendered)} page renders")

io.open(OUT_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
print(f"done → {OUT_JSON}")
