#!/usr/bin/env node
/**
 * Full 137-planet visual audit.
 * Flies to EVERY featured planet, takes a screenshot,
 * extracts dominant color from the rendered planet,
 * and cross-references texture appearance against scientific classification.
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'test_screenshots', 'all_planets');
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.css': 'text/css', '.svg': 'image/svg+xml',
};

function startServer(root) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      let filePath = join(root, decodeURIComponent(url.pathname));
      if (filePath.endsWith('/')) filePath += 'index.html';
      try {
        const data = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FULL 137-PLANET VISUAL AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { server, url } = await startServer(__dirname);
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', () => {});

  await page.goto(`${url}/exoplanet_3d.html`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => {
    const l = document.getElementById('loading');
    return l && l.classList.contains('done');
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Advance timeline to 2026
  await page.evaluate(() => {
    const sl = document.getElementById('yr-sl');
    if (sl) { sl.value = 2026; sl.dispatchEvent(new Event('input')); }
  });
  await page.waitForTimeout(1000);

  // ── Get all planet data ────────────────────────────────────────────────────
  const allPlanets = await page.evaluate(() => {
    return namedPlanets.map((p, idx) => {
      const ud = p.ud || {};
      const info = (typeof PLANET_INFO !== 'undefined') ? (PLANET_INFO[ud.name] || {}) : {};
      const hasFact = (typeof PLANET_FACTS !== 'undefined') ?
        !!(PLANET_FACTS[ud.name] || PLANET_FACTS[(typeof FEAT_NAME_REV !== 'undefined' ? FEAT_NAME_REV[ud.name] : '') || '']) : false;
      const tex = (typeof PLANET_TEX !== 'undefined') ? (PLANET_TEX[ud.name] || 'procedural') : 'unknown';

      // Get nearby planets (within 15 scene units)
      const pos = p.mesh ? p.mesh.position : null;
      const neighbors = [];
      if (pos) {
        namedPlanets.forEach((other, j) => {
          if (j === idx || !other.mesh) return;
          const d = pos.distanceTo(other.mesh.position);
          if (d < 15) neighbors.push({ name: other.ud?.name, dist: d.toFixed(1) });
        });
      }

      return {
        idx,
        name: ud.name,
        radius: ud.radius,
        temp: ud.temp,
        method: ud.method,
        year: ud.year,
        hz: ud.hz,
        dist: ud.dist,
        cls: ud.cls,
        R: ud.R, // scene radius
        tex,
        hasFact,
        hasInfo: !!info.host,
        neighbors,
        posLength: pos ? pos.length().toFixed(1) : '0',
      };
    });
  });

  console.log(`Total planets to audit: ${allPlanets.length}\n`);

  // ── Fly to each planet, screenshot, sample center pixel color ──────────────
  const auditResults = [];
  const startTime = Date.now();

  for (let i = 0; i < allPlanets.length; i++) {
    const planet = allPlanets[i];
    const pct = ((i + 1) / allPlanets.length * 100).toFixed(0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    // Fly to planet
    await page.evaluate(({ name }) => {
      const target = namedPlanets.find(p => p.ud && p.ud.name === name);
      if (target) {
        showInfo(target.ud);
        const wp = target.mesh.position.clone();
        // Instant camera move for speed
        CAM.center.copy(wp);
        CAM._center.copy(wp);
        CAM.radius = Math.max(3, target.ud.R * 4.5);
        CAM._radius = CAM.radius;
        CAM.theta = 0.4;
        CAM._theta = 0.4;
        CAM.phi = 1.1;
        CAM._phi = 1.1;
        CAM.mode = 'idle';
      }
    }, { name: planet.name });

    // Wait for render
    await page.waitForTimeout(400);

    // Take screenshot
    const safeName = planet.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const filename = `${String(i + 1).padStart(3, '0')}_${safeName}.png`;
    await page.screenshot({ path: join(SCREENSHOT_DIR, filename) });

    // Sample the planet's rendered color from center of canvas
    const colorSample = await page.evaluate(() => {
      const canvas = document.getElementById('c');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (!gl) return null;

      // Sample a 20x20 block from center of canvas (where the planet should be)
      const cx = Math.floor(canvas.width * 0.42); // slightly left of center (info panel on right)
      const cy = Math.floor(canvas.height * 0.5);
      const pixels = new Uint8Array(4 * 20 * 20);
      gl.readPixels(cx - 10, cy - 10, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let j = 0; j < pixels.length; j += 4) {
        // Only count non-black pixels (planet surface, not space)
        if (pixels[j] > 15 || pixels[j+1] > 15 || pixels[j+2] > 15) {
          rSum += pixels[j]; gSum += pixels[j+1]; bSum += pixels[j+2];
          count++;
        }
      }
      if (count === 0) return { r: 0, g: 0, b: 0, planetPixels: 0 };
      return {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
        planetPixels: count,
      };
    });

    // Read info panel type label
    const typeLabel = await page.textContent('#info-type').catch(() => '?');

    auditResults.push({
      ...planet,
      filename,
      color: colorSample,
      typeLabel: typeLabel?.trim(),
    });

    // Progress log every 10 planets
    if ((i + 1) % 10 === 0 || i === allPlanets.length - 1) {
      console.log(`  [${pct}%] ${i + 1}/${allPlanets.length}  (${elapsed}s)  Last: ${planet.name}`);
    }
  }

  // ── Analysis ───────────────────────────────────────────────────────────────
  console.log('\n\nANALYSIS\n');

  // 1. Color-classification consistency check
  const colorIssues = [];
  for (const p of auditResults) {
    if (!p.color || p.color.planetPixels < 10) continue;
    const { r, g, b } = p.color;
    const warmth = r - b; // positive = warm, negative = cool

    // Gas giants should not look blue (unless HD 189733 b)
    if (p.cls === 'gas' && warmth < -30 && !p.name.includes('HD 189733')) {
      colorIssues.push({ name: p.name, issue: `Gas giant looks blue (R=${r},G=${g},B=${b})`, severity: 'HIGH' });
    }

    // Ice worlds / frozen rocks should not look red/hot
    if ((p.typeLabel === 'Ice world' || p.typeLabel === 'Frozen rock') && warmth > 60) {
      colorIssues.push({ name: p.name, issue: `${p.typeLabel} looks hot (R=${r},G=${g},B=${b})`, severity: 'HIGH' });
    }

    // HZ/ocean worlds should have some blue component
    if (p.typeLabel?.includes('Ocean') && b < 40 && r > 150) {
      colorIssues.push({ name: p.name, issue: `Ocean world has no blue (R=${r},G=${g},B=${b})`, severity: 'MEDIUM' });
    }

    // Lava worlds should be warm-toned
    if (p.typeLabel === 'Lava world' && warmth < 0) {
      colorIssues.push({ name: p.name, issue: `Lava world looks cool (R=${r},G=${g},B=${b})`, severity: 'MEDIUM' });
    }

    // Very green dominant (unrealistic for any planet)
    if (g > r + 20 && g > b + 20 && g > 80) {
      colorIssues.push({ name: p.name, issue: `Unrealistically green (R=${r},G=${g},B=${b})`, severity: 'HIGH' });
    }
  }

  console.log(`Color-classification mismatches: ${colorIssues.length}`);
  if (colorIssues.length > 0) {
    for (const ci of colorIssues) {
      console.log(`  [${ci.severity}] ${ci.name}: ${ci.issue}`);
    }
  } else {
    console.log('  All planet colors match their scientific classification.');
  }

  // 2. Texture uniqueness — compare rendered colors of nearby planets
  console.log('');
  const similarNearby = [];
  for (let i = 0; i < auditResults.length; i++) {
    const pi = auditResults[i];
    if (!pi.color || pi.color.planetPixels < 10) continue;
    for (const neighbor of pi.neighbors) {
      const pj = auditResults.find(p => p.name === neighbor.name);
      if (!pj || !pj.color || pj.color.planetPixels < 10) continue;
      // Only count each pair once
      if (pi.name > pj.name) continue;
      const dr = Math.abs(pi.color.r - pj.color.r);
      const dg = Math.abs(pi.color.g - pj.color.g);
      const db = Math.abs(pi.color.b - pj.color.b);
      const colorDist = (dr + dg + db) / 3;
      if (colorDist < 15) {
        similarNearby.push({
          a: pi.name, b: pj.name,
          dist3d: neighbor.dist,
          colorDist: colorDist.toFixed(1),
          colA: `${pi.color.r},${pi.color.g},${pi.color.b}`,
          colB: `${pj.color.r},${pj.color.g},${pj.color.b}`,
        });
      }
    }
  }

  console.log(`Visually similar nearby pairs (rendered color dist < 15): ${similarNearby.length}`);
  if (similarNearby.length > 0) {
    for (const sp of similarNearby) {
      console.log(`  ${sp.a} ↔ ${sp.b}  3D=${sp.dist3d}  colorDist=${sp.colorDist}  (${sp.colA}) vs (${sp.colB})`);
    }
  } else {
    console.log('  All nearby planets are visually distinct in rendered output.');
  }

  // ── Generate full Markdown report ──────────────────────────────────────────
  console.log('\nGenerating full report...');

  const lines = [];
  lines.push('# Full 137-Planet Visual & Scientific Audit Report');
  lines.push(`Generated: ${new Date().toISOString()}\n`);

  lines.push('## Summary\n');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total featured planets | ${auditResults.length} |`);
  lines.push(`| Screenshots captured | ${auditResults.length} |`);
  lines.push(`| Color-classification mismatches | ${colorIssues.length} |`);
  lines.push(`| Visually similar nearby pairs | ${similarNearby.length} |`);
  lines.push(`| Planets with curated facts | ${auditResults.filter(p => p.hasFact).length} |`);
  lines.push(`| Planets with extended info | ${auditResults.filter(p => p.hasInfo).length} |`);
  lines.push('');

  if (colorIssues.length > 0) {
    lines.push('## Color-Classification Mismatches\n');
    lines.push('| Planet | Severity | Issue |');
    lines.push('|--------|----------|-------|');
    for (const ci of colorIssues) {
      lines.push(`| ${ci.name} | ${ci.severity} | ${ci.issue} |`);
    }
    lines.push('');
  }

  if (similarNearby.length > 0) {
    lines.push('## Visually Similar Nearby Pairs\n');
    lines.push('| Planet A | Planet B | 3D Dist | Color Dist | Colors |');
    lines.push('|----------|----------|---------|------------|--------|');
    for (const sp of similarNearby) {
      lines.push(`| ${sp.a} | ${sp.b} | ${sp.dist3d} | ${sp.colorDist} | (${sp.colA}) vs (${sp.colB}) |`);
    }
    lines.push('');
  }

  lines.push('## Full Planet Audit Table\n');
  lines.push('| # | Screenshot | Planet | Class | Type Label | R(Re) | T(K) | HZ | Method | Rendered Color | Neighbors | Fact? | Issues |');
  lines.push('|---|-----------|--------|-------|------------|-------|------|----|--------|----------------|-----------|-------|--------|');

  for (let i = 0; i < auditResults.length; i++) {
    const p = auditResults[i];
    const col = p.color ? `rgb(${p.color.r},${p.color.g},${p.color.b})` : 'N/A';
    const neighbors = p.neighbors.length > 0 ?
      p.neighbors.map(n => `${n.name}(${n.dist})`).join(', ') : 'none';
    const issues = [];

    // Check color issues
    const ci = colorIssues.find(c => c.name === p.name);
    if (ci) issues.push(ci.issue);

    // Check similar nearby
    const sn = similarNearby.filter(s => s.a === p.name || s.b === p.name);
    if (sn.length > 0) issues.push(`Similar to: ${sn.map(s => s.a === p.name ? s.b : s.a).join(', ')}`);

    const issueStr = issues.length > 0 ? issues.join('; ') : 'OK';

    lines.push(`| ${i+1} | ![](all_planets/${p.filename}) | ${p.name} | ${p.cls} | ${p.typeLabel} | ${p.radius?.toFixed(2) || '?'} | ${p.temp || '?'} | ${p.hz ? 'Y' : 'N'} | ${p.method} | ${col} | ${neighbors.substring(0, 60)} | ${p.hasFact ? 'Y' : 'N'} | ${issueStr} |`);
  }

  const reportPath = join(__dirname, 'FULL_PLANET_AUDIT.md');
  writeFileSync(reportPath, lines.join('\n'));

  // Also save a JSON for programmatic access
  const jsonPath = join(__dirname, 'test_screenshots', 'audit_data.json');
  writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2));

  await browser.close();
  server.close();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log(`\n${'═'.repeat(63)}`);
  console.log('  AUDIT COMPLETE');
  console.log('═'.repeat(63));
  console.log(`  Planets audited: ${auditResults.length}`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  console.log(`  Color mismatches: ${colorIssues.length}`);
  console.log(`  Similar nearby: ${similarNearby.length}`);
  console.log(`  Report: FULL_PLANET_AUDIT.md`);
  console.log(`  Data: test_screenshots/audit_data.json`);
  console.log(`  Time: ${totalTime}s`);
  console.log('═'.repeat(63));
}

run().catch(err => { console.error('Fatal:', err); process.exit(2); });
