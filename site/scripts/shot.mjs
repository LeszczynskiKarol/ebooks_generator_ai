// Full-page screenshot via headless Chrome + CDP, with Chrome's auto dark mode
// forced off so the shot shows the real palette.
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const URL = process.argv[2] || "http://localhost:4331/pl/aplikacja-mobilna/";
const OUT = process.argv[3] || "shot.png";
const W = Number(process.argv[4] || 1280);
const H = Number(process.argv[5] || 900);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9334;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--window-size=${W},${H}`,
  "--hide-scrollbars",
  "--disable-features=WebContentsForceDark",
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await sleep(1500);
  const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: W < 600,
  });
  await send("Page.navigate", { url: URL });
  await sleep(3500);

  const r = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(OUT, Buffer.from(r.result.data, "base64"));
  console.log("wrote", OUT);
  ws.close();
} finally {
  chrome.kill();
}
