# Exoplanet Universe — Developer Guide

Instructions for contributors (human or AI). Read this before making changes.

---

## Pre-Code Checklist

Before any code change, verify:

- [ ] **Frame-rate independence:** All animation increments use `dt`. No raw `+= constant` in the render loop.
- [ ] **Touch/mobile:** New interactions work on both mouse and touch. Test with device emulation.
- [ ] **Safety boundaries:** New state variables have min/max bounds, angular values are wrapped, and a reset path exists.
- [ ] **State lifecycle:** New visual objects follow their parent's show/hide/reveal lifecycle (especially timeline-gated elements).
- [ ] **Data integrity:** No spatial collisions after coordinate transforms. Multi-object systems are deconflicted.
- [ ] **Single responsibility:** Each UI control does exactly one thing. Zoom in/out are mathematical inverses.
- [ ] **Interaction patterns:** Standard gestures are supported (Escape to dismiss, etc.).
- [ ] **Asset pipeline:** Textures match geometry UV mapping. Visually verified at multiple angles.
- [ ] **Comprehension:** A first-time user can understand what they see without explanation.
- [ ] **No hardcoded panel offsets:** Never position a panel with a literal `top`/`bottom` that assumes a neighbour's height. Read the measured custom properties (`--title-h`, `--count-h`, `--filter-btn-h`, `--left-safe`, `--right-safe`) set by `layoutPanels()`, and add the element to its ResizeObserver list if it is content-sized.

---

## Project Overview

**Name:** Exoplanet Universe
**Type:** Interactive 3D visualization of NASA exoplanet discoveries (1992-2026)
**Stack:** Single-file HTML + inline CSS/JS, Three.js r128, WebGL
**Entry point:** `app.html`
**Landing page:** `index.html`

### Architecture

| Component | Description |
|-----------|-------------|
| **Data** | 6,150 confirmed exoplanets from NASA Exoplanet Archive, loaded from `nasa_data.json`. 137 featured planets as individual textured meshes. ~6,013 as Points cloud (single draw call). |
| **Coordinate mapping** | `toXYZ(ra, dec, dist)` — RA/Dec to Cartesian, log-scaled distance. |
| **Textures** | `makePlanetTex(temp, rad, seed)` — procedural surface generation. 166 real textures lazy-loaded. |
| **Scene** | Earth at origin, featured planets as `MeshPhong` spheres, background as `ShaderMaterial` point cloud, starfield sky sphere. |
| **Filters** | Detection method, planet class, max distance (up to 10,000 ly), habitable zone toggle. |
| **Timeline** | Year slider 1992-2026, play/pause, milestone popups, screen reader announcements. |
| **Camera** | Spherical orbit state machine (5 modes: idle/orbit/pan/momentum/flyto). Celestia asymptotic zoom + infinity dolly + cursor dolly. |
| **UI** | Glassmorphic dark theme (`rgba(10,14,28,.45)`, `blur(20px) saturate(1.2)`, `border-radius:14px`), Cormorant Garamond + JetBrains Mono. |
| **Space Radio** | YouTube IFrame API music player — 76 space-themed tracks, shuffled per session. Media Session API for hardware media keys. |
| **Search** | Autocomplete across all 6,150 planets. 4-tier priority ranking (exact > starts-with > contains > host star). |
| **Labels** | Canvas Sprite per featured planet, distance-based LOD, class-colored. |
| **Accessibility** | Keyboard nav (Tab/Enter/Escape), ARIA, screen reader, landmark regions, definition lists. |

### Featured Planet Selection

137 planets chosen by data-completeness score: radius + mass + temperature + orbital data + star data known, plus bonuses for habitable zone, proximity (<50 ly), direct imaging, and famous systems. Top 30 from each class: Rocky (<1.6 R_Earth), Super-Earth (1.6-3.0), Neptune-like (3.0-8.0), Gas giant (>8.0).

### Texture Pipeline

1. **Init:** Fast procedural texture per featured planet
2. **+2 seconds:** Pre-load real textures for famous planets
3. **On demand:** Background point clicked → procedural mesh promoted → real texture swapped in
4. **Result:** Initial load ~1.1 MB (down from ~68 MB)

---

## Root Cause Analysis

Analysis of 28 bugs found during development. 67% trace to just 3 root causes. Contributors should be aware of these patterns.

| # | Category | Count | Description |
|---|----------|-------|-------------|
| 1 | Frame-rate dependency | 5 | Animations using fixed per-frame increments instead of dt-scaling |
| 2 | Missing touch/mobile support | 4 | Input built exclusively around mouse events |
| 3 | Missing safety boundaries | 5 | Camera state with no limits, no reset, no escape hatch |
| 4 | Incomplete state management | 1 | Visual objects not tied to timeline lifecycle |
| 5 | Coordinate collision | 1 | Multi-planet systems mapped to identical 3D positions |
| 6 | Conflated UI actions | 3 | One control doing two unrelated things |
| 7 | Missing interaction patterns | 4 | Expected gestures (Escape, momentum, feedback) not implemented |
| 8 | Asset pipeline issues | 1 | Wrong texture format/mapping for geometry |
| 9 | Scope gaps | 3 | Contextual features not in original scope |
| 10 | Hardcoded layout offsets | 6 | Panels positioned at literal tops that assumed a content-sized neighbour's height. Fixed 2026-08-18 by measuring in `layoutPanels()` and deriving every offset in CSS. |

### Prevention

1. **Time-based animation:** Every `+=` in `animate()` must use `dt`.
2. **Input parity:** Map every action to mouse, touch, and keyboard before coding.
3. **Camera invariants:** Camera params enforced by setters with bounds/wrapping every frame. Always include reset.
4. **Derived layout:** Anything positioned relative to a content-sized element derives its offset from a measured custom property, never a literal pixel value. Verify with the responsive sweep across phone, tablet, laptop and 4K before shipping.

---

## Open Backlog

| ID | Type | Description | Priority |
|----|------|-------------|----------|
| MISS-4 | Missing | Double-click/double-tap to zoom | P2 |
| SHARE-1 | Feature | Share URL with planet + year state (`#planet=...&year=...`) | P2 |

---

## Development History

Built in 8 phases over March 2026:

1. **Camera & interaction audit** — identified 17 issues across camera, touch, and UX
2. **Core fixes** — bounded camera state, pinch-to-zoom, frame-rate independence, keyboard support
3. **Visual polish** — distance rings, solar system indicator, Milky Way context, real planet textures, starfield
4. **NASA-informed improvements** — Celestia zoom system, fly-to with easing, expanded info panel, orbit momentum
5. **Full NASA data** — 6,150 real planets, featured selection algorithm, search, click-any-planet, 3D labels
6. **Space Radio & UI** — YouTube music player, glassmorphism overhaul, collapsible filters
7. **UX audit** — responsive mobile, cinematic intro, texture lazy loading, adaptive quality, accessibility
8. **Accessibility semantics** — heading structure, landmark regions, screen reader support, definition lists

---

## Notes

- Three.js r128 loaded from CDN + post-processing addons (EffectComposer, UnrealBloomPass). No build step.
- Test suite: `tests/test.html` (85 automated tests), `tests/test_visual.html` (15 manual checks). Run via `python3 -m http.server`.
- Deployed on Vercel as static site. See `vercel.json` for cache headers.
