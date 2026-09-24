// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Plain-text extraction for customer-uploaded materials (order form).
// PDF → pdftotext (poppler, already on the VPS for pdftoppm), DOCX → mammoth,
// DOC → word-extractor, ODT/ODP/PPTX → unzip + XML text nodes, RTF → own
// stripper, TXT/MD/CSV/HTML → decoded as-is. No OCR: a scanned PDF without a
// text layer is rejected with a clear message instead of feeding the model
// an empty file.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execFile } from "child_process";
import { promisify, TextDecoder } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import JSZip from "jszip";
import mammoth from "mammoth";

const execFileAsync = promisify(execFile);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WordExtractor = require("word-extractor");

export const MATERIAL_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "odt",
  "ott",
  "rtf",
  "txt",
  "md",
  "csv",
  "html",
  "htm",
  "pptx",
  "odp",
] as const;

/** Stored text per file is capped — the digest and the per-chapter selection
 *  never need more than this, and it keeps a 600-page PDF out of the DB. */
export const MAX_CHARS_PER_FILE = 150_000;

export class MaterialExtractError extends Error {
  constructor(
    public code: "unsupported" | "empty" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export function materialExtension(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase();
}

export async function extractMaterialText(
  buf: Buffer,
  fileName: string,
): Promise<{ text: string; truncated: boolean }> {
  const ext = materialExtension(fileName);
  if (!(MATERIAL_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new MaterialExtractError("unsupported", `Unsupported file type: .${ext}`);
  }

  let raw: string;
  try {
    switch (ext) {
      case "pdf":
        raw = await pdfText(buf);
        break;
      case "docx":
        raw = (await mammoth.extractRawText({ buffer: buf })).value;
        break;
      case "doc":
        raw = (await new WordExtractor().extract(buf)).getBody();
        break;
      case "odt":
      case "ott":
      case "odp":
        raw = await openDocumentText(buf);
        break;
      case "pptx":
        raw = await pptxText(buf);
        break;
      case "rtf":
        raw = rtfToText(buf.toString("latin1"));
        break;
      case "html":
      case "htm":
        raw = htmlToText(decodeText(buf));
        break;
      default:
        raw = decodeText(buf);
    }
  } catch (err: any) {
    throw new MaterialExtractError(
      "failed",
      `Could not read ${fileName}: ${err?.message || err}`,
    );
  }

  const text = normalize(raw);
  // A scanned PDF yields only page breaks / a few stray glyphs.
  if (text.replace(/\s/g, "").length < 40) {
    throw new MaterialExtractError(
      "empty",
      ext === "pdf"
        ? "No text found in this PDF (scanned document without a text layer?)"
        : "No text found in this file",
    );
  }
  if (text.length > MAX_CHARS_PER_FILE) {
    return { text: text.slice(0, MAX_CHARS_PER_FILE), truncated: true };
  }
  return { text, truncated: false };
}

// ── PDF ───────────────────────────────────────────────────────────────

async function pdfText(buf: Buffer): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "material-"));
  const file = path.join(dir, "in.pdf");
  try {
    await fs.writeFile(file, buf);
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-enc", "UTF-8", "-q", file, "-"],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
    );
    return stdout.replace(/\f/g, "\n\n");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Zip-based XML formats ─────────────────────────────────────────────

function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

async function openDocumentText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("content.xml missing — not an OpenDocument file");
  const body = xml.replace(/^[\s\S]*?<office:body>/, "");
  return xmlDecode(
    body
      .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, n) => " ".repeat(Number(n) || 1))
      .replace(/<text:tab\s*\/>/g, "\t")
      .replace(/<text:line-break\s*\/>/g, "\n")
      .replace(/<\/text:(p|h)>/g, "\n")
      .replace(/<\/table:table-cell>/g, "\t")
      .replace(/<\/draw:page>/g, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
}

async function pptxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const paras = xml
      .split(/<\/a:p>/)
      .map((p) =>
        xmlDecode((p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.slice(5, -6)).join("")),
      )
      .filter((p) => p.trim());
    if (paras.length) out.push(paras.join("\n"));
  }
  return out.join("\n\n");
}

// ── RTF ───────────────────────────────────────────────────────────────

/** Minimal RTF → text: honours \par/\line/\tab, \'hh bytes in the document
 *  code page (\ansicpgNNNN), \uN unicode escapes, and skips non-text
 *  destinations (font/color tables, pictures, \* groups). */
export function rtfToText(rtf: string): string {
  const cpMatch = rtf.match(/\\ansicpg(\d+)/);
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(cpMatch ? `windows-${cpMatch[1]}` : "windows-1252");
  } catch {
    decoder = new TextDecoder("windows-1252");
  }
  const SKIP = new Set([
    "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header",
    "footer", "headerl", "headerr", "footerl", "footerr", "listtable",
    "listoverridetable", "rsidtbl", "generator", "xmlnstbl", "themedata",
    "colorschememapping", "latentstyles", "datastore", "fldinst",
  ]);
  const out: string[] = [];
  const stack: Array<{ skip: boolean; uc: number }> = [];
  let skip = false;
  let uc = 1;
  let pendingBytes: number[] = [];
  let skipChars = 0;
  const flush = () => {
    if (pendingBytes.length) {
      if (!skip) out.push(decoder.decode(Uint8Array.from(pendingBytes)));
      pendingBytes = [];
    }
  };
  let i = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === "{") {
      flush();
      stack.push({ skip, uc });
      i++;
      if (rtf.startsWith("\\*", i)) skip = true;
      continue;
    }
    if (c === "}") {
      flush();
      const prev = stack.pop();
      if (prev) ({ skip, uc } = prev);
      i++;
      continue;
    }
    if (c === "\\") {
      const next = rtf[i + 1];
      if (next === "'") {
        const hex = rtf.substr(i + 2, 2);
        if (skipChars > 0) skipChars--;
        else pendingBytes.push(parseInt(hex, 16));
        i += 4;
        continue;
      }
      flush();
      if (next === "\\" || next === "{" || next === "}") {
        if (!skip) out.push(next);
        i += 2;
        continue;
      }
      if (next === "~") { if (!skip) out.push(" "); i += 2; continue; }
      if (next === "-" || next === "_") { i += 2; continue; }
      if (next === "\n" || next === "\r") { if (!skip) out.push("\n"); i += 2; continue; }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) { i += 2; continue; }
      const word = m[1];
      const arg = m[2] !== undefined ? Number(m[2]) : null;
      i += 1 + m[0].length;
      if (SKIP.has(word)) skip = true;
      else if (word === "uc" && arg !== null) uc = arg;
      else if (word === "u" && arg !== null) {
        if (!skip) out.push(String.fromCharCode(arg < 0 ? arg + 65536 : arg));
        skipChars = uc;
      } else if (!skip) {
        if (word === "par" || word === "line" || word === "row" || word === "sect" || word === "page") out.push("\n");
        else if (word === "tab" || word === "cell") out.push("\t");
      }
      continue;
    }
    if (c === "\r" || c === "\n") { i++; continue; }
    flush();
    if (skipChars > 0) skipChars--;
    else if (!skip) out.push(c);
    i++;
  }
  flush();
  return out.join("");
}

// ── Plain text / HTML ─────────────────────────────────────────────────

/** BOM-aware decode; non-UTF-8 files (old Windows exports) fall back to
 *  CP1250, which covers Polish and is a superset-ish of CP1252 for English. */
export function decodeText(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(buf);
  }
}

function htmlToText(html: string): string {
  return xmlDecode(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " "),
  );
}

function normalize(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/(?: ?\.){4,}/g, " … ") // table-of-contents leader dots
    .replace(/[  ]{3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
