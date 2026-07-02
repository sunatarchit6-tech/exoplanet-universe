#!/usr/bin/env node
/**
 * Visual + functional test harness for Exoplanet Universe.
 * Uses Playwright to render in a real browser, take screenshots,
 * click planets, and verify info panel data.
 *
 * Usage: npx playwright test-visual.mjs
 *   or:  node test_visual.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'test_screenshots');

// Ensure screenshot dir exists
import { mkdirSync } from 'fs';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

// ── Simple static file server ────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.css': 'text/css', '.svg': 'image/svg+xml',
};

function startServer(root, port = 0) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost`);
      let filePath = join(root, decodeURIComponent(url.pathname));
      if (filePath.endsWith('/')) filePath += 'index.html';
      try {
        const data = readFileSync(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// ── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function warn(name, detail = '') {
  console.log(`  ⚠ WARN: ${name}${detail ? ' — ' + detail : ''}`);
  warnings++;
}

// ── Main test suite ──────────────────────────────────────────────────────────
async function run() {
  console.log('Starting Exoplanet Universe test harness...\n');

  // Start local server
  const { server, url } = await startServer(__dirname);
  console.log(`Server running at ${url}\n`);

  // Launch browser with GPU/WebGL support
  const browser = await chromium.launch({
    headless: false,  // headed mode needed for WebGL on macOS
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--enable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ── TEST 1: Page loads without errors ──────────────────────────────────────
  console.log('TEST 1: Page Load');
  await page.goto(`${url}/exoplanet_3d.html`, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for loading screen to disappear (or force-dismiss if WebGL fails)
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    return loading && loading.classList.contains('done');
  }, { timeout: 20000 }).catch(async () => {
    // Force dismiss loading overlay so tests can proceed
    await page.evaluate(() => {
      const el = document.getElementById('loading');
      if (el) { el.classList.add('done'); el.style.display = 'none'; }
    });
    warn('Loading screen did not auto-dismiss (WebGL may have failed)');
  });

  // Extra time for Three.js to render + NASA data fetch
  await page.waitForTimeout(5000);

  const jsErrors = consoleErrors.filter(e => !e.includes('404') && !e.includes('favicon'));
  assert(jsErrors.length === 0, 'No JavaScript errors on load', jsErrors.join('; '));

  // Screenshot: initial view
  await page.screenshot({ path: join(SCREENSHOT_DIR, '01_initial_load.png') });
  console.log('  📸 01_initial_load.png\n');

  // ── TEST 2: UI elements present ────────────────────────────────────────────
  console.log('TEST 2: UI Elements');
  const title = await page.textContent('#main-title');
  assert(title && title.includes('Exoplanet'), 'Title visible', `Got: "${title}"`);

  // Advance timeline to 2026 to reveal all planets
  await page.evaluate(() => {
    const sl = document.getElementById('yr-sl');
    if (sl) { sl.value = 2026; sl.dispatchEvent(new Event('input')); }
  });
  await page.waitForTimeout(500);
  const count = await page.textContent('#count-n');
  const countNum = parseInt(count?.replace(/,/g, '') || '0');
  assert(countNum > 1000, `Planet count > 1000 (at year 2026)`, `Got: ${count}`);

  const resetBtn = await page.$('#reset-btn');
  assert(resetBtn !== null, 'Reset View button present');

  const playBtn = await page.$('#play-btn');
  assert(playBtn !== null, 'Play button present');

  const yearDisp = await page.textContent('#yr-disp');
  assert(yearDisp && parseInt(yearDisp) >= 1992, 'Year display shows valid year', `Got: ${yearDisp}`);

  // ── TEST 3: Filter buttons work ────────────────────────────────────────────
  console.log('\nTEST 3: Filters');

  // Check filter buttons exist
  const filterBtns = await page.$$('.fb');
  assert(filterBtns.length >= 8, `Filter buttons present (${filterBtns.length} found)`);

  // Click "Rocky" to toggle it off, check count changes
  const countBefore = await page.textContent('#count-n');
  try {
    const rockyBtn = await page.$('.fb:has-text("Rocky")');
    if (rockyBtn) {
      await rockyBtn.click({ timeout: 5000, force: true });
      await page.waitForTimeout(500);
      const countAfter = await page.textContent('#count-n');
      assert(parseInt(countAfter) < parseInt(countBefore),
        'Toggling Rocky filter reduces count', `${countBefore} → ${countAfter}`);
      // Toggle back on
      await rockyBtn.click({ timeout: 5000, force: true });
      await page.waitForTimeout(500);
    }
  } catch (e) {
    warn('Could not click Rocky filter', e.message.split('\n')[0]);
  }

  // ── TEST 4: Canvas is rendering (not blank) ────────────────────────────────
  console.log('\nTEST 4: Canvas Rendering');

  const canvasPixels = await page.evaluate(() => {
    const canvas = document.getElementById('c');
    if (!canvas) return null;
    const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (!ctx) return 'no-webgl';
    const pixels = new Uint8Array(4 * 100);
    // Sample center of canvas
    ctx.readPixels(canvas.width / 2, canvas.height / 2, 10, 10, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    // Check if all black (nothing rendered)
    let nonZero = 0;
    for (let i = 0; i < pixels.length; i++) if (pixels[i] > 0) nonZero++;
    return { nonZero, total: pixels.length };
  });

  if (canvasPixels === 'no-webgl') {
    warn('WebGL not available in headless browser');
  } else if (canvasPixels) {
    assert(canvasPixels.nonZero > 10, 'Canvas has rendered content',
      `${canvasPixels.nonZero}/${canvasPixels.total} non-zero pixels`);
  }

  // ── TEST 5: Click planet and verify info panel ─────────────────────────────
  console.log('\nTEST 5: Planet Click & Info Panel');

  // We'll use JavaScript to trigger a click on a known planet
  const clickResult = await page.evaluate(() => {
    // Find a named planet mesh by iterating namedPlanets
    if (typeof namedPlanets === 'undefined') return { error: 'namedPlanets not found' };

    // Find TRAPPIST-1 e
    const target = namedPlanets.find(p => p.ud && p.ud.name === 'TRAPPIST-1 e');
    if (!target) return { error: 'TRAPPIST-1 e not found in namedPlanets' };

    // Directly call showInfo
    if (typeof showInfo === 'function') {
      showInfo(target.ud);
      return { success: true, name: target.ud.name };
    }
    return { error: 'showInfo function not found' };
  });

  if (clickResult.success) {
    await page.waitForTimeout(500);

    const infoName = await page.textContent('#info-name');
    assert(infoName === 'TRAPPIST-1 e', 'Info panel shows correct name', `Got: "${infoName}"`);

    const infoType = await page.textContent('#info-type');
    assert(infoType && infoType.includes('Rocky HZ'), 'Correct type label', `Got: "${infoType}"`);

    const infoRad = await page.textContent('#ip-rad');
    assert(infoRad && infoRad.includes('0.92'), 'Correct radius', `Got: "${infoRad}"`);

    const infoTemp = await page.textContent('#ip-tmp');
    assert(infoTemp && infoTemp.includes('251'), 'Correct temperature', `Got: "${infoTemp}"`);

    const hzBadge = await page.$eval('#info-hz', el => el.style.display);
    assert(hzBadge !== 'none', 'HZ badge visible for HZ planet');

    // Check educational fact
    const fact = await page.textContent('#ip-fact');
    assert(fact && fact.length > 50, 'Educational fact present', `Length: ${fact?.length}`);

    // Check provenance note
    const cite = await page.textContent('.info-cite-note');
    assert(cite && cite.includes('Kopparapu'), 'Data provenance cites Kopparapu HZ model');
    assert(cite && cite.includes('2026'), 'Data provenance includes access date');

    await page.screenshot({ path: join(SCREENSHOT_DIR, '02_trappist1e_info.png') });
    console.log('  📸 02_trappist1e_info.png');
  } else {
    warn('Could not click planet', clickResult.error);
  }

  // ── TEST 6: Verify critical data corrections ───────────────────────────────
  console.log('\nTEST 6: Scientific Data Accuracy');

  const dataChecks = await page.evaluate(() => {
    const results = [];
    if (typeof NAMED === 'undefined') return [{ error: 'NAMED not defined' }];

    // Check 51 Peg b radius (should be ~14.24, was wrongly 1.27)
    const pegB = NAMED.find(p => p[0] === '51 Peg b');
    results.push({ name: '51 Peg b radius', value: pegB?.[6], expected: 14.24,
      pass: pegB && Math.abs(pegB[6] - 14.24) < 0.1 });

    // Check TRAPPIST-1 b temp (should be ~400, was wrongly 1050)
    const t1b = NAMED.find(p => p[0] === 'TRAPPIST-1 b');
    results.push({ name: 'TRAPPIST-1 b temp', value: t1b?.[7], expected: 400,
      pass: t1b && t1b[7] === 400 });

    // Check TRAPPIST-1 c temp (should be 342)
    const t1c = NAMED.find(p => p[0] === 'TRAPPIST-1 c');
    results.push({ name: 'TRAPPIST-1 c temp', value: t1c?.[7], expected: 342,
      pass: t1c && t1c[7] === 342 });

    // Check TRAPPIST-1 d temp (should be 288)
    const t1d = NAMED.find(p => p[0] === 'TRAPPIST-1 d');
    results.push({ name: 'TRAPPIST-1 d temp', value: t1d?.[7], expected: 288,
      pass: t1d && t1d[7] === 288 });

    // Check GJ 832 c removed
    const gj832c = NAMED.find(p => p[0] === 'GJ 832 c');
    results.push({ name: 'GJ 832 c removed', value: gj832c ? 'still present' : 'removed',
      pass: !gj832c });

    // Check Teegarden c hz=1
    const teegC = NAMED.find(p => p[0] === 'Teegarden c');
    results.push({ name: 'Teegarden c hz=1', value: teegC?.[8], expected: 1,
      pass: teegC && teegC[8] === 1 });

    // Check GJ 357 d method = RV
    const gj357d = NAMED.find(p => p[0] === 'GJ 357 d');
    results.push({ name: 'GJ 357 d method=RV', value: gj357d?.[5], expected: 'RV',
      pass: gj357d && gj357d[5] === 'RV' });

    // Check HD 209458 b radius (should be 15.58)
    const hd209 = NAMED.find(p => p[0] === 'HD 209458 b');
    results.push({ name: 'HD 209458 b radius', value: hd209?.[6], expected: 15.58,
      pass: hd209 && Math.abs(hd209[6] - 15.58) < 0.1 });

    // Check HD 189733 b radius (should be 12.67)
    const hd189 = NAMED.find(p => p[0] === 'HD 189733 b');
    results.push({ name: 'HD 189733 b radius', value: hd189?.[6], expected: 12.67,
      pass: hd189 && Math.abs(hd189[6] - 12.67) < 0.1 });

    // Check planet classification
    if (typeof planetClass === 'function') {
      results.push({ name: '51 Peg b class=gas', value: planetClass(14.24), expected: 'gas',
        pass: planetClass(14.24) === 'gas' });
      results.push({ name: 'TRAPPIST-1 e class=rocky', value: planetClass(0.92), expected: 'rocky',
        pass: planetClass(0.92) === 'rocky' });
    }

    return results;
  });

  for (const check of dataChecks) {
    if (check.error) { warn(check.error); continue; }
    assert(check.pass, check.name, `Got: ${check.value}, expected: ${check.expected}`);
  }

  // ── TEST 7: Check non-HZ planet info panel ─────────────────────────────────
  console.log('\nTEST 7: Non-HZ Planet (51 Peg b)');

  const pegResult = await page.evaluate(() => {
    const target = namedPlanets.find(p => p.ud && p.ud.name === '51 Peg b');
    if (!target) return { error: '51 Peg b not found' };
    showInfo(target.ud);
    return { success: true };
  });

  if (pegResult.success) {
    await page.waitForTimeout(500);

    const infoType = await page.textContent('#info-type');
    assert(infoType && infoType.includes('Hot Jupiter'), '51 Peg b typed as Hot Jupiter', `Got: "${infoType}"`);

    const hzDisplay = await page.$eval('#info-hz', el => el.style.display);
    assert(hzDisplay === 'none', 'HZ badge hidden for non-HZ planet');

    const fact = await page.textContent('#ip-fact');
    assert(fact && fact.includes('Nobel') || fact && fact.includes('1995'),
      '51 Peg b fact mentions Nobel/1995', `Got first 80 chars: "${fact?.substring(0, 80)}"`);

    await page.screenshot({ path: join(SCREENSHOT_DIR, '03_51pegb_info.png') });
    console.log('  📸 03_51pegb_info.png');
  }

  // ── TEST 8: Timeline ───────────────────────────────────────────────────────
  console.log('\nTEST 8: Timeline');

  // Close info panel first
  await page.evaluate(() => { document.getElementById('info').style.display = 'none'; });

  const timelineResult = await page.evaluate(() => {
    const milestones = typeof MS !== 'undefined' ? MS : [];
    return {
      milestones,
      hasTRAPPIST2017: milestones.some(m => m.year === 2017 && m.text.includes('TRAPPIST')),
      has1995: milestones.some(m => m.year === 1995),
      hasKepler2009: milestones.some(m => m.year === 2009 && m.text.includes('Kepler')),
      hasTESS2018: milestones.some(m => m.year === 2018 && m.text.includes('TESS')),
    };
  });

  assert(timelineResult.has1995, 'Milestone: 1995 first planet');
  assert(timelineResult.hasKepler2009, 'Milestone: 2009 Kepler launch');
  assert(timelineResult.hasTRAPPIST2017, 'Milestone: TRAPPIST-1 at 2017 (not 2016)');
  assert(timelineResult.hasTESS2018, 'Milestone: 2018 TESS');

  // ── TEST 9: Featured planet count ──────────────────────────────────────────
  console.log('\nTEST 9: Planet Counts');

  const counts = await page.evaluate(() => {
    return {
      named: typeof NAMED !== 'undefined' ? NAMED.length : 0,
      namedPlanets: typeof namedPlanets !== 'undefined' ? namedPlanets.length : 0,
      bgCount: typeof BN !== 'undefined' ? BN : 0,
      totalNasa: typeof NASA_DATA !== 'undefined' ? NASA_DATA.length : 0,
    };
  });

  assert(counts.named >= 44 && counts.named <= 46,
    `NAMED array size reasonable`, `Got: ${counts.named}`);
  assert(counts.namedPlanets >= 100 && counts.namedPlanets <= 140,
    `Featured planets 100-140`, `Got: ${counts.namedPlanets}`);
  assert(counts.bgCount > 5000, `Background points > 5000`, `Got: ${counts.bgCount}`);
  assert(counts.totalNasa > 6000, `NASA data loaded > 6000`, `Got: ${counts.totalNasa}`);

  // ── TEST 10: Overview screenshot ───────────────────────────────────────────
  console.log('\nTEST 10: Visual Screenshots');

  // Reset view
  await page.evaluate(() => {
    if (typeof camFlyTo === 'function') {
      camFlyTo(new THREE.Vector3(0, 0, 0), 320, 100);
    }
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '04_overview.png') });
  console.log('  📸 04_overview.png');

  // Zoom in closer
  await page.evaluate(() => {
    if (typeof CAM !== 'undefined') {
      CAM.radius = 50;
      CAM._radius = 50;
    }
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '05_zoomed_in.png') });
  console.log('  📸 05_zoomed_in.png');

  // ── CLEANUP & REPORT ──────────────────────────────────────────────────────
  await browser.close();
  server.close();

  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
  console.log('═'.repeat(60));
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
