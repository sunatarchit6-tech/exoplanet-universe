#!/usr/bin/env node
/**
 * Comprehensive featured planet audit:
 * 1. Visual: detect merged/overlapping planets, texture similarity
 * 2. Scientific: cross-reference every featured planet against NASA data
 * 3. Screenshots of problematic planets
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCREENSHOT_DIR = join(__dirname, 'test_screenshots', 'audit');
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
  console.log('  EXOPLANET UNIVERSE — FULL FEATURED PLANET AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { server, url } = await startServer(__dirname);
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Suppress console noise
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 1: MERGED PLANET DETECTION + TEXTURE SIMILARITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('PART 1: VISUAL — Merged Planets & Texture Similarity\n');

  const visualReport = await page.evaluate(() => {
    const results = {
      totalFeatured: namedPlanets.length,
      mergedPairs: [],
      closePairs: [],
      textureSimilarity: [],
      invisible: [],
    };

    // Check all pairs for overlap
    for (let i = 0; i < namedPlanets.length; i++) {
      const pi = namedPlanets[i];
      if (!pi.mesh || !pi.visible) continue;
      const posI = pi.mesh.position;
      const rI = pi.ud.R || 0.5;

      for (let j = i + 1; j < namedPlanets.length; j++) {
        const pj = namedPlanets[j];
        if (!pj.mesh || !pj.visible) continue;
        const posJ = pj.mesh.position;
        const rJ = pj.ud.R || 0.5;

        const dist = posI.distanceTo(posJ);
        const overlap = (rI + rJ) - dist;

        if (overlap > 0) {
          results.mergedPairs.push({
            a: pi.ud.name, b: pj.ud.name,
            dist: dist.toFixed(2), overlap: overlap.toFixed(2),
            rA: rI.toFixed(2), rB: rJ.toFixed(2),
          });
        } else if (dist < rI + rJ + 3) {
          results.closePairs.push({
            a: pi.ud.name, b: pj.ud.name,
            dist: dist.toFixed(2), gap: (dist - rI - rJ).toFixed(2),
          });
        }
      }

      // Check if planet is at origin (likely unfound in NASA data)
      if (posI.length() < 0.1) {
        results.invisible.push(pi.ud.name);
      }
    }

    return results;
  });

  console.log(`  Featured planets: ${visualReport.totalFeatured}`);
  console.log(`  Merged (overlapping) pairs: ${visualReport.mergedPairs.length}`);
  console.log(`  Close (gap < 3 units) pairs: ${visualReport.closePairs.length}`);
  console.log(`  Planets at origin (unfound): ${visualReport.invisible.length}`);

  if (visualReport.mergedPairs.length > 0) {
    console.log('\n  MERGED PLANETS (geometries overlap):');
    console.log('  ' + '─'.repeat(80));
    for (const p of visualReport.mergedPairs) {
      console.log(`    ${p.a} ↔ ${p.b}  dist=${p.dist}  overlap=${p.overlap}  (r=${p.rA}+${p.rB})`);
    }
  }

  if (visualReport.closePairs.length > 0) {
    console.log('\n  CLOSE PAIRS (gap < 3 scene units):');
    console.log('  ' + '─'.repeat(80));
    for (const p of visualReport.closePairs) {
      console.log(`    ${p.a} ↔ ${p.b}  dist=${p.dist}  gap=${p.gap}`);
    }
  }

  // Take screenshots of merged planets
  const mergedToScreenshot = visualReport.mergedPairs.slice(0, 10);
  for (const pair of mergedToScreenshot) {
    await page.evaluate((name) => {
      const target = namedPlanets.find(p => p.ud && p.ud.name === name);
      if (target) {
        const wp = target.mesh.position.clone();
        camFlyTo(wp, Math.max(4, target.ud.R * 5), 200);
      }
    }, pair.a);
    await page.waitForTimeout(1500);
    const safeName = pair.a.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    await page.screenshot({ path: join(SCREENSHOT_DIR, `merged_${safeName}.png`) });
    console.log(`    📸 merged_${safeName}.png`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 2: SCIENTIFIC ACCURACY — EVERY FEATURED PLANET
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n\nPART 2: SCIENTIFIC ACCURACY AUDIT\n');

  const sciReport = await page.evaluate(() => {
    // Access globals
    const results = [];

    function getClassLabel(temp, rad, hz) {
      const cls = planetClass(rad);
      if (cls === 'gas') return temp > 900 ? 'Hot Jupiter' : temp > 400 ? 'Warm gas giant' : 'Cold gas giant';
      if (temp > 1600) return 'Lava world';
      if (temp > 700) return 'Hot rock';
      if (temp > 350) return 'Venus-like';
      if (hz) return rad < 1.3 ? 'Rocky HZ world' : 'Ocean / HZ world';
      if (temp > 230) return 'Temperate rock';
      if (temp > 140) return 'Frozen rock';
      return 'Ice world';
    }

    // Build NASA lookup
    const nasaLookup = {};
    if (typeof NASA_DATA !== 'undefined') {
      NASA_DATA.forEach(p => { nasaLookup[p.n] = p; });
    }

    // Build FEAT_NAME_MAP reverse
    const nameMapRev = {};
    if (typeof FEAT_NAME_MAP !== 'undefined') {
      Object.entries(FEAT_NAME_MAP).forEach(([k, v]) => { nameMapRev[v] = k; });
    }

    for (const planet of namedPlanets) {
      const ud = planet.ud;
      if (!ud) continue;

      const name = ud.name;
      const nasaName = nameMapRev[name] || name;
      const nasa = nasaLookup[name] || nasaLookup[nasaName] || null;
      const info = (typeof PLANET_INFO !== 'undefined') ? (PLANET_INFO[name] || {}) : {};
      const hasFact = (typeof PLANET_FACTS !== 'undefined') ? !!(PLANET_FACTS[name] || PLANET_FACTS[nasaName]) : false;

      const entry = {
        name,
        // Our values
        radius: ud.radius,
        temp: ud.temp,
        method: ud.method,
        year: ud.year,
        hz: ud.hz,
        dist: ud.dist,
        cls: ud.cls,
        label: getClassLabel(ud.temp || 0, ud.radius || 1, ud.hz),
        // NASA values (from nasa_data.json)
        nasa_R: nasa ? nasa.R : null,
        nasa_T: nasa ? nasa.T : null,
        nasa_M: nasa ? nasa.M : null,
        nasa_method: nasa ? nasa.m : null,
        nasa_year: nasa ? nasa.y : null,
        nasa_dist: nasa ? nasa.d : null,
        nasa_hz: nasa ? nasa.hz : null,
        // Extended info
        has_mass: !!info.mass,
        has_orbper: !!info.orbper,
        has_sma: !!info.sma,
        has_host: !!info.host,
        has_sptype: !!info.sptype,
        has_fact: hasFact,
        // In NASA data at all?
        in_nasa: !!nasa,
        // Discrepancies
        issues: [],
      };

      // Check radius discrepancy (>20%)
      if (nasa && nasa.R && ud.radius) {
        const pct = Math.abs(nasa.R - ud.radius) / nasa.R * 100;
        if (pct > 20) {
          entry.issues.push(`Radius: ours=${ud.radius.toFixed(2)} NASA=${nasa.R.toFixed(2)} (${pct.toFixed(0)}% off)`);
        }
      }

      // Check temp discrepancy (>200K)
      if (nasa && nasa.T && ud.temp) {
        const diff = Math.abs(nasa.T - ud.temp);
        if (diff > 200) {
          entry.issues.push(`Temp: ours=${ud.temp}K NASA=${nasa.T}K (${diff}K off)`);
        }
      }

      // Check method mismatch
      if (nasa && nasa.m && ud.method) {
        const nasaM = nasa.m === 'Radial Velocity' ? 'RV' : nasa.m;
        if (nasaM !== ud.method && !(nasaM === 'RV' && ud.method === 'RV') && !(nasaM === ud.method)) {
          entry.issues.push(`Method: ours=${ud.method} NASA=${nasa.m}`);
        }
      }

      // Check year mismatch
      if (nasa && nasa.y && ud.year && nasa.y !== ud.year) {
        entry.issues.push(`Year: ours=${ud.year} NASA=${nasa.y}`);
      }

      // Check HZ mismatch
      if (nasa && nasa.hz !== undefined && nasa.hz !== null) {
        if (ud.hz !== nasa.hz) {
          entry.issues.push(`HZ: ours=${ud.hz} NASA=${nasa.hz}`);
        }
      }

      // Missing radius in NASA (we have an estimate)
      if (ud.radius && (!nasa || !nasa.R)) {
        entry.issues.push(`Radius ${ud.radius.toFixed(2)} is estimated (no NASA transit measurement)`);
      }

      // Missing temp in NASA
      if (ud.temp && ud.temp > 0 && (!nasa || !nasa.T)) {
        entry.issues.push(`Temp ${ud.temp}K is estimated (no NASA equilibrium temp)`);
      }

      // Classification check
      if (ud.radius) {
        // Standard boundaries
        let stdClass;
        if (ud.radius < 1.23) stdClass = 'Terran';
        else if (ud.radius < 2.0) stdClass = 'Super-Earth';
        else if (ud.radius < 3.5) stdClass = 'Sub-Neptune';
        else if (ud.radius < 6.0) stdClass = 'Neptune';
        else if (ud.radius < 14.3) stdClass = 'Sub-Jovian';
        else stdClass = 'Gas Giant';

        entry.stdClass = stdClass;
      }

      results.push(entry);
    }

    return results;
  });

  // ── Generate report ──────────────────────────────────────────────────────
  let issueCount = 0;
  let noIssueCount = 0;
  let missingMass = 0, missingOrbper = 0, missingHost = 0, missingFact = 0;
  const issuesByType = {};

  const reportLines = [];
  reportLines.push('# Exoplanet Scientific Accuracy Audit Report');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push(`Total featured planets: ${sciReport.length}\n`);

  // Summary stats
  const withIssues = sciReport.filter(p => p.issues.length > 0);
  const clean = sciReport.filter(p => p.issues.length === 0);

  reportLines.push(`## Summary`);
  reportLines.push(`- Clean (no issues): ${clean.length}`);
  reportLines.push(`- With issues: ${withIssues.length}`);
  reportLines.push(`- In NASA data: ${sciReport.filter(p => p.in_nasa).length}`);
  reportLines.push(`- Not in NASA data: ${sciReport.filter(p => !p.in_nasa).length}`);
  reportLines.push(`- Have curated educational fact: ${sciReport.filter(p => p.has_fact).length}`);
  reportLines.push(`- Missing mass data: ${sciReport.filter(p => !p.has_mass).length}`);
  reportLines.push(`- Missing orbital period: ${sciReport.filter(p => !p.has_orbper).length}`);
  reportLines.push('');

  // Planets with issues
  if (withIssues.length > 0) {
    reportLines.push(`## Planets With Issues (${withIssues.length})\n`);
    reportLines.push('| Planet | Issues |');
    reportLines.push('|--------|--------|');
    for (const p of withIssues.sort((a, b) => b.issues.length - a.issues.length)) {
      reportLines.push(`| ${p.name} | ${p.issues.join('; ')} |`);
    }
    reportLines.push('');
  }

  // Classification comparison
  reportLines.push(`## Classification Comparison (Our 4-tier vs Standard 6-tier)\n`);
  reportLines.push('| Planet | Radius | Our Class | Our Label | Standard Class | Diff? |');
  reportLines.push('|--------|--------|-----------|-----------|----------------|-------|');
  for (const p of sciReport) {
    const diff = (p.cls === 'rocky' && p.stdClass === 'Terran') ? '' :
                 (p.cls === 'rocky' && p.stdClass === 'Super-Earth') ? 'RECLASSED' :
                 (p.cls === 'super' && p.stdClass === 'Sub-Neptune') ? 'RECLASSED' :
                 (p.cls === 'neptune' && p.stdClass === 'Neptune') ? '' :
                 (p.cls === 'gas' && p.stdClass === 'Gas Giant') ? '' :
                 (p.cls === 'gas' && p.stdClass === 'Sub-Jovian') ? 'RECLASSED' :
                 (p.cls === p.stdClass?.toLowerCase()) ? '' :
                 (p.stdClass && p.cls) ? '~' : '';
    if (diff === 'RECLASSED') {
      reportLines.push(`| **${p.name}** | ${p.radius?.toFixed(2)} | ${p.cls} | ${p.label} | ${p.stdClass} | **${diff}** |`);
    }
  }
  reportLines.push('');

  // Full planet table
  reportLines.push(`## Full Planet Data (${sciReport.length} planets)\n`);
  reportLines.push('| # | Planet | R(Re) | T(K) | Method | Year | HZ | Class | Label | NASA R | NASA T | Fact? | Issues |');
  reportLines.push('|---|--------|-------|------|--------|------|----|-------|-------|--------|--------|-------|--------|');
  sciReport.sort((a, b) => a.name.localeCompare(b.name));
  sciReport.forEach((p, i) => {
    const iss = p.issues.length > 0 ? p.issues.length + ' issue(s)' : 'OK';
    reportLines.push(`| ${i+1} | ${p.name} | ${p.radius?.toFixed(2) || '?'} | ${p.temp || '?'} | ${p.method} | ${p.year} | ${p.hz ? 'Y' : 'N'} | ${p.cls} | ${p.label} | ${p.nasa_R?.toFixed(2) || '-'} | ${p.nasa_T || '-'} | ${p.has_fact ? 'Y' : 'N'} | ${iss} |`);
  });

  // Console summary
  console.log(`  Total featured planets: ${sciReport.length}`);
  console.log(`  Clean (no issues): ${clean.length}`);
  console.log(`  With issues: ${withIssues.length}`);
  console.log(`  Have curated fact: ${sciReport.filter(p => p.has_fact).length} / ${sciReport.length}`);
  console.log(`  Not in NASA archive: ${sciReport.filter(p => !p.in_nasa).length}`);

  if (withIssues.length > 0) {
    console.log('\n  Issues found:');
    for (const p of withIssues.sort((a, b) => b.issues.length - a.issues.length)) {
      for (const iss of p.issues) {
        console.log(`    ${p.name}: ${iss}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 3: FLY TO SAMPLE PLANETS & SCREENSHOT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n\nPART 3: VISUAL SPOT-CHECK SCREENSHOTS\n');

  // Select diverse sample: some from each class
  const samplePlanets = await page.evaluate(() => {
    const byClass = { rocky: [], super: [], neptune: [], gas: [] };
    namedPlanets.forEach(p => {
      if (p.ud && p.ud.cls && byClass[p.ud.cls]) {
        byClass[p.ud.cls].push(p.ud.name);
      }
    });
    const sample = [];
    for (const cls of ['rocky', 'super', 'neptune', 'gas']) {
      const list = byClass[cls];
      // Pick up to 5 from each class
      for (let i = 0; i < Math.min(5, list.length); i++) {
        sample.push({ name: list[i], cls });
      }
    }
    return sample;
  });

  for (const planet of samplePlanets) {
    await page.evaluate((name) => {
      const target = namedPlanets.find(p => p.ud && p.ud.name === name);
      if (target) {
        showInfo(target.ud);
        const wp = target.mesh.position.clone();
        camFlyTo(wp, Math.max(4, target.ud.R * 5), 200);
      }
    }, planet.name);
    await page.waitForTimeout(1200);
    const safeName = planet.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
    await page.screenshot({ path: join(SCREENSHOT_DIR, `planet_${planet.cls}_${safeName}.png`) });
    console.log(`  📸 [${planet.cls}] ${planet.name}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 4: TEXTURE SIMILARITY (all pairs, computed from pixel data)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n\nPART 4: TEXTURE SIMILARITY ANALYSIS\n');

  const texReport = await page.evaluate(() => {
    // We can't read texture files from the page, but we can check which planets
    // share the same texture file by reading the PLANET_TEX map and checking
    // which planets are close in 3D space
    const texMap = typeof PLANET_TEX !== 'undefined' ? PLANET_TEX : {};

    // Group planets by texture file to find shared textures
    const byTex = {};
    namedPlanets.forEach(p => {
      if (!p.ud) return;
      const tex = texMap[p.ud.name];
      if (!tex) return;
      if (!byTex[tex]) byTex[tex] = [];
      byTex[tex].push(p.ud.name);
    });

    const sharedTex = Object.entries(byTex)
      .filter(([, names]) => names.length > 1)
      .map(([tex, names]) => ({ tex, planets: names }));

    // Find close pairs with same texture
    const sameTexClose = [];
    for (const { tex, planets } of sharedTex) {
      for (let i = 0; i < planets.length; i++) {
        const pi = namedPlanets.find(p => p.ud?.name === planets[i]);
        for (let j = i + 1; j < planets.length; j++) {
          const pj = namedPlanets.find(p => p.ud?.name === planets[j]);
          if (pi && pj) {
            const dist = pi.mesh.position.distanceTo(pj.mesh.position);
            if (dist < 30) {
              sameTexClose.push({ a: planets[i], b: planets[j], tex, dist: dist.toFixed(1) });
            }
          }
        }
      }
    }

    return { sharedTex: sharedTex.length, sameTexClose };
  });

  console.log(`  Texture files shared by >1 planet: ${texReport.sharedTex}`);
  if (texReport.sameTexClose.length > 0) {
    console.log(`  Same texture AND close in 3D (< 30 units):`);
    for (const p of texReport.sameTexClose) {
      console.log(`    ${p.a} ↔ ${p.b}  tex=${p.tex}  dist=${p.dist}`);
    }
  } else {
    console.log('  No planets share the same texture file AND are close together.');
  }

  // Save the full report
  const reportPath = join(__dirname, 'AUDIT_REPORT.md');
  writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`\nFull report saved to: AUDIT_REPORT.md`);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  await browser.close();
  server.close();

  // Final summary
  console.log('\n' + '═'.repeat(63));
  console.log('  AUDIT COMPLETE');
  console.log('═'.repeat(63));
  console.log(`  Featured planets: ${sciReport.length}`);
  console.log(`  Merged/overlapping: ${visualReport.mergedPairs.length}`);
  console.log(`  Close pairs: ${visualReport.closePairs.length}`);
  console.log(`  Scientific issues: ${withIssues.length} planets with issues`);
  console.log(`  Clean planets: ${clean.length}`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  console.log('═'.repeat(63));
}

run().catch(err => { console.error('Fatal:', err); process.exit(2); });
