// Launch headless Chrome via CDP at 375px and report any element overflowing the
// viewport horizontally. Usage: node scripts/measure-overflow.mjs <url>
import { spawn } from "node:child_process";

const URL = process.argv[2] || "http://localhost:4326/pl/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  "--window-size=375,900", "--hide-scrollbars", "about:blank",
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
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: URL });
  await sleep(3500);

  const expr = `(() => {
    const iw = window.innerWidth;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > iw + 1) {
        // skip elements living inside an intentional horizontal scroller
        let scroller = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') { scroller = true; break; }
        }
        if (!scroller) out.push(Math.round(r.right) + 'px  <' + el.tagName.toLowerCase() + '> ' + (el.className||'').toString().slice(0,75));
      }
    }
    return JSON.stringify({ innerWidth: iw, docScrollWidth: document.documentElement.scrollWidth, overflowing: out.slice(0, 25) }, null, 2);
  })()`;
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(res.result?.result?.value || JSON.stringify(res));

  // accurate 375px screenshot
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 375, height: 1700, scale: 2 } });
  if (shot.result?.data) {
    const fs = await import("node:fs");
    fs.writeFileSync(process.argv[3] || "cdp-shot.png", Buffer.from(shot.result.data, "base64"));
    console.log("screenshot saved");
  }
  ws.close();
} finally {
  chrome.kill();
}
