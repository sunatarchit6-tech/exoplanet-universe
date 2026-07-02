# Exoplanet Universe — Deployment Plan

> **Multi-session execution guide.** Each phase can be executed independently in a separate Claude Code session. Read this file + `CLAUDE.md` before starting any phase.

---

## Workflow: Driver-Navigator Agent Model

This project uses an adversarial Driver-Navigator workflow to maintain NASA-level quality.

### Roles

| Role | Responsibility |
|------|---------------|
| **Driver** | Writes code, implements features. Executes steps from the current phase. Does NOT decide what to build — follows this plan. |
| **Navigator** | Adversarial code reviewer. Reviews every Driver output against (1) this plan, (2) the UX audit findings, (3) the RCA pre-code checklist in CLAUDE.md. Scores against NASA-level standards. |

### How It Works

1. **Orchestrator** (Claude) spawns the Driver agent with the specific step instructions
2. Driver implements the step, reports what changed
3. Orchestrator spawns the Navigator agent to review
4. Navigator returns PASS / FAIL / PASS WITH CONDITIONS
5. If conditions: Orchestrator sends fixes back to Driver, repeat from step 2
6. If PASS: move to next step

### Handoff Protocol

- Driver reports: files modified, line numbers, what changed, pre-code checklist verification
- Navigator reviews: correctness, edge cases, performance, accessibility, UX quality, RCA compliance
- Navigator outputs: structured verdict with severity-rated issues and acceptance criteria

### Pre-Code Checklist (from CLAUDE.md — every change must pass)

- [ ] RC-1: All animation increments use `dt`. No raw `+= constant` in render loop.
- [ ] RC-2: New interactions work on both mouse and touch.
- [ ] RC-3: New state variables have min/max bounds and reset paths.
- [ ] RC-4: Visual objects follow parent's show/hide/reveal lifecycle.
- [ ] RC-5: No spatial collisions after coordinate transforms.
- [ ] RC-6: Each UI control does exactly one thing.
- [ ] RC-7: Standard gestures supported (Escape to dismiss, etc.).
- [ ] RC-8: Textures match geometry UV mapping.
- [ ] RC-9: A first-time user can understand what they see without explanation.

### Quality Bar

The Navigator's standard: "Would a product manager at NASA greenlight this?" Specifically:
- Scientific accuracy in all text (technical language, correct units, no marketing fluff)
- Textures remain at full 2048x1024 resolution (no downscaling)
- All interactive elements accessible via keyboard
- Screen reader announcements for dynamic content
- 60fps on mid-range laptop

---

## Current State (as of Phase A completion)

### What's Done
- Phase A (pre-deploy fixes): case-sensitivity fix, Earth texture extracted, preserveDrawingBuffer, preconnects
- Phases 1–11: Full tool feature-complete (search, click-any-planet, labels, MeshPhong, bloom, responsive mobile, cinematic intro, accessibility, performance)
- 85/85 automated tests passing
- Timeline bug fixed (curYr cap 2024→2026)

### Project Structure
```
./
├── app.html                  # Main 3D visualization (~240KB)
├── nasa_data.json            # 6,150 exoplanets (1.1MB)
├── earth_texture.jpg          # Extracted Earth texture (212KB)
├── sun_texture.jpg            # Sun texture (636KB)
├── moon_texture.jpg           # Moon texture (684KB)
├── starfield.jpg              # Starfield background (612KB)
├── textures/planets/          # 166 planet textures (74MB, 2048x1024 JPEGs)
├── textures/nasa/             # Source textures — NOT deployed (16MB)
├── textures/generated/        # Source textures — NOT deployed (3.2MB)
├── textures/*.jpg,*.webp      # Base source textures — NOT deployed (85MB)
├── tests/test.html            # Automated test runner (85 tests)
├── tests/test_visual.html     # Manual visual checklist (15 items)
├── CLAUDE.md                  # Project source of truth
├── generate_textures.py       # Texture generation script — NOT deployed
├── exoplanet_3d_backup.html   # Backup — NOT deployed
└── package.json               # Playwright dev dependency only
```

### External Dependencies (CDN)
1. Three.js r128 — `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
2. 6 Three.js post-processing scripts — `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/...`
3. Google Fonts — Cormorant Garamond (300, 400, italic 300) + JetBrains Mono (300, 400)
4. YouTube IFrame API — for Space Radio feature (async, non-blocking)

### Key Technical Details
- All JS is inline in a single `<script>` block — no modules, no build step
- Variables declared with `let`/`const` (block-scoped, not on window) — test framework uses `eval()` to access
- Camera system: `CAM` state machine with modes idle/orbit/pan/momentum/flyto
- Featured planets: `namedPlanets[]` array with mesh, label, userData
- Background points: `bgPoints` with ShaderMaterial, `bgNasaIdx` maps to NASA_DATA index
- Search: `searchIndex[]` built on NASA_DATA load, substring match with 4-tier priority
- Textures lazy-loaded: procedural on init, famous pre-loaded after 2s, rest on demand

---

## Phase A.5 — Critical Security & Integrity Fixes

**Status: DONE (2026-03-22)**

*Identified during final review. Must be completed before deployment.*

### A.5.1 Subresource Integrity (SRI) on all CDN scripts — `M`

All 7 CDN scripts (Three.js + 6 post-processing) load without integrity hashes. A CDN compromise injects arbitrary JavaScript.

**Fix:** Generate SRI hashes and add `integrity` + `crossorigin="anonymous"`:
```bash
# Generate hash for each script:
curl -s [URL] | openssl dgst -sha384 -binary | openssl base64 -A
```

Apply to all 7 script tags. Skip YouTube IFrame API (Google updates it dynamically; Space Radio is non-essential).

### A.5.2 License attribution visible in app UI — `S`

Solar System Scope textures are CC BY 4.0 — attribution is legally required.

**Fix:** Add a "Credits & Data" link in the app UI (bottom-right, near legend). Opens overlay or links to landing page credits:
```
Data: NASA Exoplanet Archive (Caltech/IPAC)
Textures: NASA/JPL-Caltech, Solar System Scope (CC BY 4.0)
Background: ESA/Gaia/DPAC
```

### A.5.3 Data timestamp visible in app UI — `S`

The nasa_data.json is a static snapshot. The tool must not imply it auto-updates.

**Fix:**
- Add "Data: NASA Exoplanet Archive, March 2026" near the legend/distance indicator in `app.html`
- Landing page methodology states: "Dataset snapshot from NASA Exoplanet Archive, accessed March 2026."

### A.5.4 CDN failure fallback for Three.js — `M`

If cdnjs/jsdelivr is down, blank page. No error message.

**Fix:** Add `onerror` on the main Three.js script tag showing "Unable to load 3D engine" message. Add secondary CDN fallback:
```html
<script>window.THREE || document.write('<script src="https://unpkg.com/three@0.128.0/build/three.min.js"><\/script>')</script>
```

---

## Phase B — Texture Optimization

**Status: SKIPPED** — User directive: "Do not over-optimize. NASA-level quality is non-negotiable." Textures remain at full 2048x1024 resolution. The lazy-loading system (procedural on init, real textures on demand) handles bandwidth.

---

## Phase C — Website Content

**Status: DONE (2026-03-22)**

### C.1 Rename `exoplanet_3d.html` → `app.html`

Simple rename. Update any internal references (test files reference `../exoplanet_3d.html`).

### C.2 Create `index.html` — Landing Page

**Design requirements:**
- Match existing dark aesthetic: background #000/#0a0e1c, Cormorant Garamond headings, JetBrains Mono body text
- Glassmorphism cards with `backdrop-filter: blur(20px)`, border-radius 14px
- Scientifically accurate, technical language — no marketing fluff
- Semantic HTML: proper `<h1>`–`<h3>`, `<main>`, `<header>`, `<footer>`, `<section>`
- Lightweight: target <50KB HTML+CSS (no Three.js on landing page)
- Same Google Fonts as the tool
- Responsive (works on mobile)

**Sections:**

#### Hero
- Title: "Exoplanet Universe" (Cormorant Garamond, large)
- Subtitle: "An interactive 3D visualization of 6,150 confirmed exoplanets from NASA's Exoplanet Archive. Spanning 30 years of discovery, from 51 Pegasi b (1995) to the TESS era."
- CTA: "Launch Visualization" → `app.html`
- CTA secondary: "Launch in Fullscreen" → `app.html#fullscreen`
- Background: dark gradient or static screenshot of the tool

#### Technical Overview (3 cards)
- **6,150 Confirmed Exoplanets** — Complete dataset from NASA's Exoplanet Archive. 137 individually textured featured planets rendered as Three.js meshes. 6,013 additional planets as a WebGL Points cloud.
- **Discovery Timeline 1992–2026** — Year-by-year playback of 30 years of exoplanet detection. Six annotated milestones including the first radial velocity detection (51 Peg b, 1995), the Kepler Space Telescope launch (2009), and the TRAPPIST-1 system (2017).
- **Real Coordinates, Real Data** — Each planet positioned using its right ascension, declination, and distance from the NASA Exoplanet Archive, mapped to 3D Cartesian coordinates with logarithmic distance scaling. Physical properties (radius, mass, equilibrium temperature, orbital elements) displayed per-planet.

#### Methodology & Data Pipeline
Technical content, written at the level of a Nature Methods paper introduction:

**Data Source and Processing:**
Source data: NASA Exoplanet Archive (Caltech/IPAC), accessed March 2026. 6,150 confirmed exoplanets with 15 fields per record: planet name, right ascension (deg), declination (deg), distance (ly), discovery year, detection method, planet radius (R⊕), equilibrium temperature (K), habitable zone flag, planet mass (M⊕), orbital period (days), semi-major axis (AU), eccentricity, host star properties (name, temperature, radius, mass, spectral type), and discovery facility.

Compact JSON format reduces the full archive from ~50MB CSV to 1.1MB, retaining all fields relevant to 3D visualization and educational display.

**Coordinate Mapping:**
Equatorial coordinates (RA, Dec) converted to 3D Cartesian via standard spherical-to-Cartesian transformation. Distance is logarithmically scaled: `d_scene = log₁₀(1 + d_ly) / log₁₀(31,001) × 900`, compressing the 0–30,000 ly range into 0–900 scene units. This preserves the relative spatial distribution of nearby systems while keeping distant discoveries visible.

**Texture Generation Pipeline:**
49 base textures sourced from NASA/JPL-Caltech imagery, Solar System Scope, and AI-generated planetary surfaces. Each base is transformed into class- and temperature-appropriate variations using 7 manipulation axes: hue rotation, brightness adjustment, color tint (per-channel RGB multiplication), contrast, saturation, horizontal wrap (longitude rotation), and vertical flip (hemisphere swap). Transformations are constrained to scientifically plausible color palettes per planet class:
- Rocky (<1.6 R⊕): grays, browns, reds, oranges (regolith, iron oxide, silicates)
- Super-Earth (1.6–3.0 R⊕): blues (ocean), whites (ice/clouds), tans, oranges
- Neptune-like (3.0–8.0 R⊕): blues, teals, cyans (methane/H₂ atmospheres)
- Gas giant (>8.0 R⊕): oranges, browns, tans, whites, deep blues (ammonia, methane bands)

166 unique textures at 2048×1024 resolution. A Halton quasi-random sequence ensures maximum visual diversity between siblings sharing a base texture.

**Temperature Estimation:**
For planets lacking measured equilibrium temperature (~40% of the dataset), a 5-tier estimation cascade provides physically motivated defaults:
1. Direct measurement from archive
2. Equilibrium temperature from semi-major axis and stellar properties: T_eq = T_star × √(R_star / 2a) × (1-A)^(1/4), assuming Bond albedo A = 0.3
3. Kepler's third law to derive semi-major axis from orbital period and stellar mass, then Tier 2
4. Host star temperature heuristic (for planets with known host but no orbital data): T_planet ≈ 0.117 × T_star
5. Detection method heuristic: Transit = 700K, RV = 500K, Imaging = 250K, Other = 400K

**Rendering Architecture:**
- Three.js r128 (WebGL). No build step, no module bundler.
- 137 featured planets: individual SphereGeometry meshes with MeshPhongMaterial (shininess 8), directional lighting (intensity 1.2), ambient fill (intensity 0.6)
- 6,013 background planets: single THREE.Points draw call with custom ShaderMaterial. Vertex shader scales point size by camera distance. Fragment shader applies radial gradient with temperature-mapped coloring.
- Post-processing: UnrealBloomPass (strength 0.25, threshold 0.88, radius 0.5) for subtle star/sun glow. Auto-disabled if average frame time exceeds 20ms.
- Labels: Canvas-texture Sprites with distance-based LOD (two tiers: 30 famous planets visible at 200 scene units, remaining 107 at 80 units). Power-of-two canvas dimensions. Font-load guard ensures JetBrains Mono renders correctly.
- Adaptive quality: pixel ratio reduction, star/dust count halving, and bloom removal triggered automatically on devices averaging <40fps after 120 frames.

**Quality Assurance:**
Driver-Navigator agent methodology: all code written by a Driver agent, reviewed by an adversarial Navigator agent against 9 root cause categories derived from 27 historical bugs. 85 automated tests covering pure functions, data integrity, search, filters, camera, DOM/accessibility, and scene metrics. 15 manual visual verification items.

#### The Dataset
- Classification breakdown with counts
- Detection method distribution
- Timeline milestones table (year, event, significance)
- Direct link to NASA Exoplanet Archive

#### Credits and Acknowledgments
- **Data:** NASA Exoplanet Archive, operated by the California Institute of Technology under contract with the National Aeronautics and Space Administration
- **Planet textures:** NASA/JPL-Caltech, Solar System Scope (CC BY 4.0), generated variations
- **Background imagery:** ESA/Gaia/DPAC
- **Technology:** Three.js (r128), WebGL
- **Fonts:** Cormorant Garamond, JetBrains Mono (Google Fonts)
- Creator credit + GitHub link

### C.3 Create Favicon Set

Generate from a minimal planet glyph:
- `favicon.svg` — SVG circle with subtle atmosphere gradient (blue-teal, 2-3 elements)
- `favicon.ico` — 32×32 + 16×16
- `apple-touch-icon.png` — 180×180

Add to both `index.html` and `app.html`:
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### C.4 Create OG Image

1200×630 PNG. Composition:
- Screenshot of the 3D visualization (the wide view showing distance rings + point cloud)
- Title "Exoplanet Universe" overlaid in Cormorant Garamond
- Subtitle "6,150 confirmed exoplanets" in JetBrains Mono
- Dark background matching the tool aesthetic

This image is used by Twitter, Facebook, LinkedIn, Slack, Discord, iMessage when the URL is shared.

### C.5 Create `robots.txt` and `sitemap.xml`

**robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://[DOMAIN]/sitemap.xml
```

**sitemap.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://[DOMAIN]/</loc><priority>1.0</priority><changefreq>monthly</changefreq></url>
  <url><loc>https://[DOMAIN]/app.html</loc><priority>0.9</priority><changefreq>monthly</changefreq></url>
</urlset>
```

Replace `[DOMAIN]` with the actual domain at deploy time.

---

## Phase D — SEO & LLM Optimization

**Status: DONE (2026-03-22)** — D.1, D.2, D.3 complete. D.4 was already done in Phase 8 accessibility work.

### D.1 Meta Tags (both pages)

**index.html:**
```html
<title>Exoplanet Universe — Interactive 3D Visualization of 6,150 Confirmed Exoplanets</title>
<meta name="description" content="Interactive 3D visualization of 6,150 confirmed exoplanets from NASA's Exoplanet Archive. Real coordinates, real physical properties, 30-year discovery timeline. Built with Three.js and WebGL.">
```

**app.html:**
```html
<title>Exoplanet Universe — Explore 6,150 Worlds in 3D</title>
<meta name="description" content="Navigate an interactive 3D map of every confirmed exoplanet. Search by name, filter by detection method or planet class, and watch 30 years of discovery unfold.">
```

### D.2 Open Graph + Twitter Cards (both pages)

```html
<meta property="og:title" content="Exoplanet Universe — 6,150 Confirmed Exoplanets in 3D">
<meta property="og:description" content="Interactive 3D visualization of every confirmed exoplanet from NASA's Exoplanet Archive. Real coordinates, 30-year discovery timeline.">
<meta property="og:image" content="https://[DOMAIN]/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta property="og:url" content="https://[DOMAIN]/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Exoplanet Universe">
<meta name="twitter:description" content="6,150 confirmed exoplanets in interactive 3D. Real NASA data.">
<meta name="twitter:image" content="https://[DOMAIN]/og-image.png">
```

### D.3 JSON-LD Structured Data (index.html only)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Exoplanet Universe",
  "description": "Interactive 3D visualization of 6,150 confirmed exoplanets from NASA's Exoplanet Archive, displaying real equatorial coordinates, physical properties, and a 30-year discovery timeline from 1992 to 2026.",
  "url": "https://[DOMAIN]/",
  "applicationCategory": "EducationApplication",
  "operatingSystem": "Any browser with WebGL support",
  "browserRequirements": "WebGL 1.0",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "creator": { "@type": "Person", "name": "[AUTHOR]" },
  "datePublished": "2026-03-22",
  "about": {
    "@type": "Thing",
    "name": "Exoplanets",
    "sameAs": "https://en.wikipedia.org/wiki/Exoplanet"
  },
  "isBasedOn": {
    "@type": "Dataset",
    "name": "NASA Exoplanet Archive",
    "url": "https://exoplanetarchive.ipac.caltech.edu/",
    "creator": { "@type": "Organization", "name": "NASA/IPAC/Caltech" }
  }
}
</script>
```

### D.4 Semantic HTML

The landing page (`index.html`) must use proper semantic structure:
- `<header>` for hero
- `<main>` wrapping all content sections
- `<section>` for each content block with descriptive `aria-label`
- `<h1>` for title (one per page), `<h2>` for section headings, `<h3>` for subsections
- `<footer>` for credits
- `<nav>` if there are internal page links

This enables both search engine understanding and LLM text extraction.

---

## Phase E — Interactive Enhancements

**Status: DONE (2026-03-22)**

### E.1 Fullscreen Toggle

Add to `app.html`:
- Button in bottom-right area (near legend/reset): `<button id="fullscreen-btn" aria-label="Toggle fullscreen">⛶ Fullscreen</button>`
- JS: `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`
- Toggle button text between "Fullscreen" / "Exit Fullscreen"
- Keyboard shortcut: F key (no existing F handler in codebase)
- Hash trigger: if `location.hash === '#fullscreen'`, auto-enter fullscreen on load

### E.2 URL Deep-Linking

Parse `location.hash` after NASA_DATA loads:
- Format: `#planet=TRAPPIST-1+e&year=2017`
- Decode planet name, search in `NASA_BY_NAME`, fly to it, open info panel
- If `year` param present, set `curYr` and update slider
- If `fullscreen` param, enter fullscreen
- Update hash on planet selection: `history.replaceState(null, '', '#planet=' + encodeURIComponent(name))`
- Landing page methodology section links to specific planets: `<a href="app.html#planet=51+Peg+b">51 Pegasi b</a>`

### E.3 Screenshot Button

Add near the fullscreen button:
- Camera icon: `<button id="screenshot-btn" aria-label="Save screenshot">📷</button>`
- JS: `renderer.domElement.toDataURL('image/png')` → create download link
- Filename: `exoplanet-universe-[planet-name-or-overview].png`
- Requires `preserveDrawingBuffer: true` (already added in Phase A.3)

### E.4 Back-to-Home Link

Small text link in the UI (near title or bottom):
- "About this project" → `index.html`
- Styled as subtle link, not prominent button

---

## Phase F — Deploy

**Status: TODO**

### F.1 Create `.gitignore`

```gitignore
# Dependencies
node_modules/

# Development artifacts
test_screenshots/
.claude/
*.py
exoplanet_3d_backup.html
AUDIT_REPORT.md
FULL_PLANET_AUDIT.md

# Source textures (not deployed — only planet/ subfolder is runtime)
textures/nasa/
textures/generated/
textures/*.jpg
textures/*.webp

# OS files
.DS_Store
Thumbs.db
```

### F.2 Initialize Git + Push to GitHub

```bash
cd exoplanet-universe
git init
git add .
git commit -m "Exoplanet Universe v1.0 — 6,150 confirmed exoplanets in interactive 3D"
# Create GitHub repo, then:
git remote add origin https://github.com/[USER]/exoplanet-universe.git
git push -u origin main
```

### F.3 Connect to Vercel

1. Go to vercel.com, import from GitHub
2. Framework: "Other" (static files)
3. Build command: (none)
4. Output directory: `.` (root)
5. Deploy

### F.4 Create `vercel.json`

```json
{
  "headers": [
    {
      "source": "/textures/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(sun_texture|moon_texture|earth_texture|starfield)\\.(jpg|png)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/nasa_data.json",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }]
    }
  ],
  "redirects": [
    { "source": "/exoplanet_3d.html", "destination": "/app.html", "permanent": true }
  ]
}
```

### F.5 Custom Domain

If a domain is available (e.g., `exoplanetuniverse.com`):
1. Add domain in Vercel dashboard
2. Update DNS: CNAME to `cname.vercel-dns.com`
3. Vercel auto-provisions HTTPS via Let's Encrypt
4. Update all `[DOMAIN]` placeholders in meta tags, sitemap, robots.txt

### F.6 Verification Checklist

- [ ] `index.html` loads, links to `app.html` work
- [ ] `app.html` loads, all textures load, search works, timeline plays
- [ ] `app.html#planet=TRAPPIST-1+e` deep-links correctly
- [ ] `app.html#fullscreen` enters fullscreen
- [ ] Mobile: iPhone Safari + Android Chrome — layout, touch, search
- [ ] OG preview: paste URL in Twitter card validator, Facebook debugger
- [ ] Lighthouse: Performance > 80, SEO > 90, Accessibility > 70
- [ ] `robots.txt` and `sitemap.xml` accessible
- [ ] HTTPS certificate active
- [ ] Texture caching: second visit loads from cache (check Network tab)

---

## Phase G — Spectacular Extras (Post-Launch)

**Status: BACKLOG**

### G.1 Hero Video
Record 10s of the cinematic intro (galaxy pull-in → formation → "This is home"), compress to WebM/MP4 (~2-3MB). Embed as `<video autoplay muted loop playsinline>` hero background on landing page.

### G.2 Planet Data Export
"Export" button in info panel. Copies formatted Markdown to clipboard:
```
## TRAPPIST-1 e
- Radius: 0.92 R⊕
- Temperature: 251 K
- Distance: 40 ly
- Discovered: 2017 (Transit)
- Habitable Zone: Yes
```

### G.3 Service Worker (Offline Support)
Cache HTML + data + loaded textures for full offline experience after first visit.

### G.4 Comparison Mode
Select two planets for side-by-side property comparison. Addresses NASA Eyes gap.

---

## Multi-Session Execution Guide

Each phase is designed to be executed in an independent Claude Code session. At the start of each session:

1. Read `CLAUDE.md` (project source of truth)
2. Read `DEPLOYMENT.md` (this file)
3. Find the first phase with status `TODO`
4. Use the Driver-Navigator workflow to implement it
5. Update the status in this file to `DONE` with date
6. Update `CLAUDE.md` changelog

### Phase Dependencies

```
Phase A   ✅ DONE (2026-03-22)
Phase A.5 ✅ DONE (2026-03-22) — SRI hashes, credits, data timestamp, CDN fallback
Phase B   — SKIPPED (user directive: no texture downscaling)
Phase C   ✅ DONE (2026-03-22)
Phase D   ✅ DONE (2026-03-22)
Phase E   ✅ DONE (2026-03-22)
Phase F   — TODO (requires: Phases A.5, C, D, E all complete)
Phase G   — BACKLOG (post-launch, no dependencies)
```

### Session Checklist

Before starting a session:
- [ ] Confirm which phase to work on
- [ ] Read CLAUDE.md and DEPLOYMENT.md
- [ ] Spawn Driver agent with step-specific instructions
- [ ] After Driver completes, spawn Navigator agent for review
- [ ] Fix any Navigator issues via Driver
- [ ] Run test suite: `python3 -m http.server 8000` then open `http://localhost:8000/tests/test.html`
- [ ] Update phase status in DEPLOYMENT.md
- [ ] Update CLAUDE.md changelog
