// Captures the README screenshots (docs/images) from the shop example's rulebook.html, with
// headless Chrome over the DevTools protocol. Usage: node scripts/screenshots.mjs <rulebook.html> <out dir>
// Set CHROME to the browser executable when it is not in the default Windows location.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [html, outDir] = process.argv.slice(2);
const chrome = process.env.CHROME || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-device-scale-factor=2', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch { /* starting */ }
  await wait(200);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { id += 1; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

async function shot(name, { width = 1440, height = 900, dark = false, setup = '' } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await send('Page.navigate', { url: 'file:///' + path.resolve(html).replace(/\\/g, '/') });
  await wait(600);
  await js('localStorage.clear()');
  await send('Page.reload');
  await wait(1200);
  await js(`(async () => { ${setup} })()`);
  await wait(800);
  const { result } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'));
  console.log('wrote', name);
}

const press = (label) => `(() => { const g = [...document.querySelectorAll('#view-map g[role=button]')].find((x) => x.textContent.startsWith(${JSON.stringify(label)})); g?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return !!g; })()`;
const view = (v) => `document.querySelector('.views [data-view="${v}"]').click(); await new Promise((r) => setTimeout(r, 500));`;
const step = (expr) => `${expr}; await new Promise((r) => setTimeout(r, 400));`;

await send('Page.enable');
const fit = `document.querySelector('[data-zoom="fit"]').click(); await new Promise((r) => setTimeout(r, 500));`;
await shot('document', { setup: "document.getElementById('ORD-P01').scrollIntoView({ block: 'start' }); window.scrollBy(0, -24);" });
await shot('map', { setup: view('map') + step(press('Le client peut')) + step(press('ORD-R001')) + fit });
await shot('dashboard-dark', { dark: true, setup: view('dashboard') });

ws.close();
proc.kill();
