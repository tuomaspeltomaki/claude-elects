#!/usr/bin/env node
// claude_elects chart renderer
//
//   node render.mjs                      # every preset, every size it asks for
//   node render.mjs --chart trend-fi     # one preset
//   node render.mjs --chart trend-fi --size x
//   node render.mjs --chart trend-fi --html   # dump the HTML instead of a PNG
//
// The HTML dump is the debugging route: open it in a browser and the chart is
// live, with the same code path the PNG uses.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { loadLedger } from './lib/data.mjs';
import { sizes } from './lib/theme.mjs';
import { trendPage } from './charts/trend.mjs';
import { backtestPage } from './charts/backtest.mjs';
import { presets } from './presets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '..', 'data');
const MODEL_DIR = resolve(HERE, '..', 'model');
const OUT_DIR = join(HERE, 'out');

const BUILDERS = { trend: trendPage, backtest: backtestPage };

// --- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};
const wantChart = arg('--chart');
const wantSize = arg('--size');
const htmlOnly = argv.includes('--html');

// --- fonts ----------------------------------------------------------------
// Inlined as base64 so a rendered page is self-contained: it opens correctly
// months from now, offline, with no font server in the loop.
function fontFace(family, file, weight) {
  const path = join(HERE, 'node_modules', '@fontsource', ...file);
  const b64 = readFileSync(path).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};`
    + `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

const fontCss = [
  fontFace('Libre Franklin', ['libre-franklin', 'files', 'libre-franklin-latin-400-normal.woff2'], 400),
  fontFace('Libre Franklin', ['libre-franklin', 'files', 'libre-franklin-latin-500-normal.woff2'], 500),
  fontFace('Libre Franklin', ['libre-franklin', 'files', 'libre-franklin-latin-600-normal.woff2'], 600),
  fontFace('Libre Franklin', ['libre-franklin', 'files', 'libre-franklin-latin-700-normal.woff2'], 700),
  fontFace('Libre Franklin', ['libre-franklin', 'files', 'libre-franklin-latin-800-normal.woff2'], 800),
  fontFace('Roboto Mono', ['roboto-mono', 'files', 'roboto-mono-latin-400-normal.woff2'], 400),
  fontFace('Roboto Mono', ['roboto-mono', 'files', 'roboto-mono-latin-500-normal.woff2'], 500),
].join('\n');

// --- libraries ------------------------------------------------------------
const d3Src = readFileSync(join(HERE, 'node_modules', 'd3', 'dist', 'd3.min.js'), 'utf8');
const plotSrc = readFileSync(join(HERE, 'node_modules', '@observablehq', 'plot', 'dist', 'plot.umd.min.js'), 'utf8');

// A minified bundle can contain the literal "</script>" inside a string, which
// would close the tag it is being inlined into and shred the rest of the page.
// Escaping the slash is inert inside JS but invisible to the HTML parser.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

// The replacement MUST go through a function. A plain string replacement
// treats $&, $' and friends as patterns, and a minified bundle is full of
// them -- which silently splices chunks of the file into itself.
function inlineLibs(html) {
  return html
    .replace('<script src="D3_SRC"></script>', () => `<script>${safe(d3Src)}</script>`)
    .replace('<script src="PLOT_SRC"></script>', () => `<script>${safe(plotSrc)}</script>`);
}

// --- render ---------------------------------------------------------------
if (!existsSync(DATA_DIR)) {
  console.error(`No data directory at ${DATA_DIR}. Run this from inside the repo.`);
  process.exit(1);
}

const ledger = loadLedger(DATA_DIR, MODEL_DIR);
console.log(`Ledger: ${ledger.polls.length} polls, ${ledger.predictions.length} prediction rows, `
  + `${ledger.polls[0].date.toISOString().slice(0, 10)} to ${ledger.polls.at(-1).date.toISOString().slice(0, 10)}`);
if (ledger.backtest.length) console.log(`Backtest: ${ledger.backtest.length} rows`);

mkdirSync(OUT_DIR, { recursive: true });

const jobs = [];
for (const [name, preset] of Object.entries(presets)) {
  if (wantChart && name !== wantChart) continue;
  const sizeKeys = wantSize ? [wantSize] : preset.sizes;
  for (const sizeKey of sizeKeys) {
    const size = sizes[sizeKey];
    if (!size) { console.error(`Unknown size "${sizeKey}"`); process.exit(1); }
    jobs.push({ name, preset, sizeKey, size });
  }
}

if (!jobs.length) { console.error('Nothing to render.'); process.exit(1); }

// Use a preinstalled Chromium when one is present (CI images, sandboxes),
// otherwise let Playwright resolve its own.
function chromiumPath() {
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('chromium-')) continue;
    const bin = join(root, dir, 'chrome-linux', 'chrome');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const exe = chromiumPath();
if (exe) console.log(`Chromium: ${exe}`);
const browser = htmlOnly ? null : await chromium.launch(exe ? { executablePath: exe } : {});

for (const { name, preset, sizeKey, size } of jobs) {
  const build = BUILDERS[preset.type];
  if (!build) { console.error(`Unknown chart type "${preset.type}"`); continue; }

  const html = inlineLibs(build({ ledger, config: preset, size, fontCss }));
  const stem = join(OUT_DIR, `${name}-${sizeKey}`);

  if (htmlOnly) {
    writeFileSync(`${stem}.html`, html);
    console.log(`  ${stem}.html`);
    continue;
  }

  const page = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 2, // retina; halve for smaller files
  });
  page.on('pageerror', (e) => console.error(`  ! page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`  ! console: ${m.text()}`); });
  // Via a real file rather than setContent: setContent goes through
  // document.write, which chokes on a page this size with inlined bundles.
  const tmp = `${stem}.tmp.html`;
  writeFileSync(tmp, html);
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${stem}.png` });
  await page.close();
  unlinkSync(tmp);
  console.log(`  ${stem}.png  (${size.w}x${size.h} @2x — ${size.name})`);
}

if (browser) await browser.close();
