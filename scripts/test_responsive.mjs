#!/usr/bin/env node
/**
 * Responsive layout audit.
 *
 * Loads app.html at every size class (phone, phone landscape, tablet, laptop, desktop up
 * to 4K), drives the UI through its panel states, and checks every visible element for
 * overlap and for spilling outside the viewport.
 *
 * Overlaps are classified. An element inside a stacking context of z-index 50 or higher
 * sitting over ambient chrome is an overlay sheet doing its job (the mobile info sheet,
 * the landscape filter sheet) and is reported separately. Anything else, where two
 * elements at comparable stacking order occupy the same pixels, is a real collision and
 * the script exits non-zero.
 *
 * Usage: node scripts/test_responsive.mjs
 *        (needs `npm install` and `npx playwright install chromium` once)
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8939;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const VIEWPORTS = [
  ['phone',     'iPhone SE',           375,  667],
  ['phone',     'iPhone 14',           390,  844],
  ['phone',     'Pixel 7',             412,  915],
  ['phone',     'iPhone 14 Pro Max',   430,  932],
  ['phone',     'small Android',       360,  640],
  ['phone',     'iPhone 14 landscape', 844,  390],
  ['tablet',    'iPad mini',           744, 1133],
  ['tablet',    'iPad portrait',       768, 1024],
  ['tablet',    'iPad Air',            820, 1180],
  ['tablet',    'iPad landscape',     1024,  768],
  ['laptop',    'MacBook Air 13',     1280,  800],
  ['laptop',    'HD laptop',          1366,  768],
  ['laptop',    'MacBook Pro 14',     1512,  982],
  ['laptop',    'MacBook Pro 16',     1728, 1117],
  ['desktop',   'FHD 1080p',          1920, 1080],
  ['desktop',   '27in QHD',           2560, 1440],
  ['desktop',   'ultrawide',          3440, 1440],
  ['desktop',   '32in 4K',            3840, 2160],
];

// Transient or intentionally full-bleed layers. They are expected to sit over the page.
const IGNORE = ['search-results', 'credits-overlay', 'intro-card', 'milestone', 'fly-hud',
                'search-filter-toast', 'sr-announce', 'yt-player-host', 'info-btn'];

// Runs in the page. Returns every visible box, classified.
const probe = (ignore) => {
  // In-flow boxes that can overflow their parent, so they need checking too.
  const INFLOW = ['search-wrap', 'search-box', 'main-title', 'sub', 'count-n', 'count-l', 'info-close'];
  const els = [...document.querySelectorAll('#ui *')].filter((e) => {
    if (!e.id) return false;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    if (cs.position !== 'absolute' && cs.position !== 'fixed' && !INFLOW.includes(e.id)) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  });

  const rects = els.map((e) => {
    const r = e.getBoundingClientRect();
    // Effective stacking order: a child paints inside its nearest positioned ancestor's
    // context, so #info-close inherits the z-index:50 of the #info sheet.
    let z = 0;
    for (let n = e; n && n.id !== 'ui'; n = n.parentElement) {
      const v = parseInt(getComputedStyle(n).zIndex, 10);
      if (!isNaN(v)) { z = v; break; }
    }
    return { id: e.id, el: e, t: r.top, b: r.bottom, l: r.left, r: r.right, z };
  });

  const out = { collisions: [], covered: [], offscreen: [] };
  const EPS = 2;
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i];
    if (a.l < -EPS || a.t < -EPS || a.r > innerWidth + EPS || a.b > innerHeight + EPS) {
      out.offscreen.push({ id: a.id, l: +a.l.toFixed(1), t: +a.t.toFixed(1), r: +a.r.toFixed(1), b: +a.b.toFixed(1) });
    }
    for (let j = i + 1; j < rects.length; j++) {
      const c = rects[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      if (ignore.includes(a.id) || ignore.includes(c.id)) continue;
      const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
      const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
      if (ox <= EPS || oy <= EPS) continue;
      const rec = { a: a.id, b: c.id, x: +ox.toFixed(1), y: +oy.toFixed(1) };
      if (Math.max(a.z, c.z) >= 50 && Math.abs(a.z - c.z) >= 40) out.covered.push(rec);
      else out.collisions.push(rec);
    }
  }
  return out;
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = join(ROOT, decodeURIComponent(url.pathname));
    if (!existsSync(file) || !extname(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

const server = await startServer();
// Playwright normally resolves its own bundled browser. PLAYWRIGHT_CHROMIUM lets a
// machine with a different cached build point at it without reinstalling.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
);
const collisions = new Map();
const covered = new Map();
let checks = 0;

for (const [cls, name, w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => { try { sessionStorage.setItem('exo-intro-seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/app.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const states = [
    ['default', async () => {}],
    ['filters', async () => { await page.click('#filter-toggle'); await page.waitForTimeout(500); }],
    ['filters+info', async () => {
      await page.fill('#search-input', 'Kepler-22 b'); await page.waitForTimeout(700);
      await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
    }],
    ['+music', async () => { await page.click('#music-toggle'); await page.waitForTimeout(700); }],
  ];

  for (const [label, act] of states) {
    try { await act(); } catch (e) { /* control not present at this size */ }
    const res = await page.evaluate(probe, IGNORE);
    checks++;
    const tag = `${cls}/${name} ${w}x${h} [${label}]`;
    res.covered.forEach((o) => covered.set(`${o.a} over ${o.b}`, (covered.get(`${o.a} over ${o.b}`) || 0) + 1));
    if (res.collisions.length || res.offscreen.length) {
      console.log(`\n${tag}`);
      res.collisions.forEach((o) => {
        console.log(`   COLLISION  ${o.a} x ${o.b}  (${o.x} x ${o.y} px)`);
        collisions.set(`${o.a}|${o.b}`, (collisions.get(`${o.a}|${o.b}`) || 0) + 1);
      });
      res.offscreen.forEach((o) => {
        console.log(`   OFFSCREEN  ${o.id}  l=${o.l} t=${o.t} r=${o.r} b=${o.b}  (viewport ${w}x${h})`);
        collisions.set(`offscreen:${o.id}`, (collisions.get(`offscreen:${o.id}`) || 0) + 1);
      });
    }
  }
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${'='.repeat(64)}`);
console.log(`${checks} state checks across ${VIEWPORTS.length} viewports.\n`);
if (!collisions.size) {
  console.log('COLLISIONS: none. No elements outside the viewport.');
} else {
  console.log('COLLISIONS, by frequency:');
  [...collisions.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`));
}
if (covered.size) {
  console.log('\nOverlay sheets covering lower chrome (intended):');
  [...covered.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}x  ${k}`));
}
process.exit(collisions.size ? 1 : 0);
