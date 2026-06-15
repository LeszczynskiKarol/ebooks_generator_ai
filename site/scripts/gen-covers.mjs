// One-off: generate cover-background photos with the SAME FLUX model the app
// uses (black-forest-labs/flux-1.1-pro-ultra on Replicate), then optimize each
// to a small WebP in public/covers/. Token is read from backend/.env.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "covers");
fs.mkdirSync(OUT, { recursive: true });

// read token from backend/.env without printing it
const envText = fs.readFileSync(path.resolve(ROOT, "../backend/.env"), "utf8");
const m = envText.match(/^(?:FLUX_API|REPLICATE_API_TOKEN)=(.+)$/m);
const TOKEN = m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
if (!TOKEN) {
  console.error("No FLUX token found in backend/.env");
  process.exit(1);
}
const MODEL = "black-forest-labs/flux-1.1-pro-ultra";

// 8 backgrounds — shared across PL/EN (only the overlaid title differs).
const PROMPTS = [
  ["cover-1", "Photorealistic sleek modern startup workspace at dusk: a laptop on a wooden desk showing a glowing analytics dashboard, soft violet and indigo lighting, warm bokeh city lights through a window, shallow depth of field, cinematic premium book-cover photography, vertical composition"],
  ["cover-2", "Photorealistic minimalist morning desk by a sunlit window: a cup of coffee, an open notebook and a pen, warm golden hour light, calm and focused mood, soft shadows, cinematic premium book-cover photography, vertical composition"],
  ["cover-3", "Photorealistic cozy home office set up for video calls: a warm desk lamp, a green plant, headphones resting on a wooden desk, soft teal and amber tones, evening ambience, cinematic premium book-cover photography, vertical composition"],
  ["cover-4", "Abstract photorealistic close-up of colorful glassy modular geometric design shapes and gradient cards floating over a deep blue background, clean studio lighting, modern design-system mood, cinematic premium book-cover photography, vertical composition"],
  ["cover-5", "Photorealistic rustic mediterranean ingredients on a dark slate table: olive oil, ripe tomatoes, fresh basil and herbs, dramatic side light, rich greens and reds, food photography, cinematic premium book-cover photography, vertical composition"],
  ["cover-6", "Photorealistic serene minimalist desk with a single small plant and a notebook, soft morning haze, muted sage green and cream tones, lots of calm negative space, cinematic premium book-cover photography, vertical composition"],
  ["cover-7", "Photorealistic open laptop on a wooden cafe table near a large window, warm city street bokeh outside, inviting golden light, a coffee cup beside it, travel-and-work freelance mood, cinematic premium book-cover photography, vertical composition"],
  ["cover-8", "Photorealistic elegant flat-lay on a dark teal surface: stacks of coins, an upward line chart on paper and a clean ledger, soft studio light, premium financial mood, cinematic premium book-cover photography, vertical composition"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function flux(prompt) {
  const create = await fetch(
    `https://api.replicate.com/v1/models/${MODEL}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt: prompt + ", no text, no words, no letters, no labels, no watermark, no people faces",
          aspect_ratio: "3:4",
          raw: false,
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    },
  );
  if (!create.ok) throw new Error(`create ${create.status} ${await create.text()}`);
  let pred = await create.json();
  for (let i = 0; i < 25 && !["succeeded", "failed", "canceled"].includes(pred.status); i++) {
    await sleep(3000);
    const poll = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await poll.json();
  }
  if (pred.status !== "succeeded") throw new Error(`status ${pred.status}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const img = await fetch(url);
  return Buffer.from(await img.arrayBuffer());
}

for (const [name, prompt] of PROMPTS) {
  const dest = path.join(OUT, `${name}.webp`);
  if (fs.existsSync(dest)) {
    console.log(`skip ${name} (exists)`);
    continue;
  }
  try {
    console.log(`generating ${name}...`);
    const jpg = await flux(prompt);
    await sharp(jpg)
      .resize({ width: 480, height: 640, fit: "cover", position: "centre" })
      .webp({ quality: 70 })
      .toFile(dest);
    const kb = (fs.statSync(dest).size / 1024).toFixed(1);
    console.log(`  -> ${name}.webp  ${kb} KB`);
  } catch (e) {
    console.error(`  FAILED ${name}: ${e.message}`);
  }
}
console.log("done");
