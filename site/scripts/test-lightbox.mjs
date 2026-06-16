// Drive a real click on a [data-zoom] mockup and screenshot the open lightbox.
import { spawn } from "node:child_process";
import fs from "node:fs";

const URL = process.argv[2] || "http://localhost:4322/pl/";
const SEL = process.argv[3] || ".js-gal-img"; // overridden below
const OUT = process.argv[4] || "lb-shot.png";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9355;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--window-size=1300,900", "--hide-scrollbars", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await sleep(1500);
  const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1300, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: URL });
  await sleep(3500);
  // click the 2nd gallery image (chapter page) via JS
  const r = await send("Runtime.evaluate", { expression: `(function(){var els=document.querySelectorAll('[data-zoom]');var t=[].slice.call(els).filter(function(x){return x.tagName!=='IMG'})[1]||els[0];if(!t)return 'none';t.scrollIntoView({block:'center'});t.click();return els.length+' zoomable; clicked '+(t.tagName);})()`, returnByValue: true });
  console.log("eval:", r.result?.result?.value);
  await sleep(700);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) { fs.writeFileSync(OUT, Buffer.from(shot.result.data, "base64")); console.log("saved", OUT); }
  ws.close();
} finally { chrome.kill(); }
