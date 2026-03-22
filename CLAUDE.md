# Exoplanet Universe — Project Source of Truth

> **Every agent (Driver or Navigator) MUST read this file in full before touching any code or making any decisions.**

---

## Workflow: Driver-Navigator Agent Model

### Roles

| Role | Responsibility |
|------|---------------|
| **Driver** | Heavy-lifting — writes code, implements features, fixes bugs, runs builds. Executes tasks from the to-do list. Does NOT decide what to build next without Navigator alignment. |
| **Navigator** | Code review, bug detection, requirement validation, human communication. Reads the brief, breaks work into phases/steps/todos, ensures Driver stays on track. Asks the human (orchestrator) for review at phase boundaries. |

### Rules

1. **Read-first.** Both agents read `CLAUDE.md` before every action.
2. **Phase gate.** No phase begins until the previous phase is reviewed by Navigator and approved by the human.
3. **Todo-driven.** All work is tracked as todos under the current phase. Driver picks up todos; Navigator marks them reviewed.
4. **Living document.** `CLAUDE.md` is updated after every phase completion and every significant change. The Navigator owns this update.
5. **Changelog is mandatory.** Every code change gets a changelog entry with date, description, and author (Driver/Navigator).
6. **Backlog is persistent.** Ideas, bugs, and deferred work go into the backlog — never lost, always prioritized.
7. **No silent changes.** Driver does not refactor, restyle, or "improve" anything outside the current todo scope.
8. **Navigator reviews before human.** Driver submits work to Navigator first. Navigator reviews, then presents to the human for approval.
9. **RCA on every bug.** When any bug/issue is raised, Navigator performs an RCA immediately — categorizes it into one of the 9 root cause categories (see RCA section below), logs it in the Issue Tracker, and updates the RCA section if a new pattern emerges.
10. **Pre-code RCA check.** Before writing ANY code, Driver MUST read the RCA section and actively verify the new code does not trigger any known root cause category. Navigator validates this during review.

### Pre-Code Checklist (derived from historical RCAs)

Before any code change ships, both Driver and Navigator must verify:

- [ ] **RC-1 Frame-rate:** All animation increments use `dt`. No raw `+= constant` in the render loop.
- [ ] **RC-2 Touch/mobile:** New interactions work on both mouse and touch. Tested with device emulation if touch-related.
- [ ] **RC-3 Safety boundaries:** Any new state variable has defined min/max bounds, angular values are wrapped, and a reset path exists.
- [ ] **RC-4 State lifecycle:** New visual objects follow their parent's show/hide/reveal lifecycle (especially timeline-gated elements).
- [ ] **RC-5 Data integrity:** No spatial collisions after coordinate transforms. Multi-object systems are deconflicted.
- [ ] **RC-6 Single responsibility:** Each UI control does exactly one thing. Zoom in/out are mathematical inverses.
- [ ] **RC-7 Interaction patterns:** Standard gestures are supported (Escape to dismiss, etc.). Compare with 3-5 reference apps.
- [ ] **RC-8 Asset pipeline:** Textures match geometry UV mapping. Visually verified at multiple angles.
- [ ] **RC-9 Comprehension:** A first-time user can understand what they see without explanation.

---

## Project Overview

**Name:** Exoplanet Universe
**Type:** Interactive 3D visualization of NASA exoplanet discoveries (1992–2024)
**Stack:** Single-file HTML + inline CSS/JS, Three.js r128, WebGL
**Entry point:** `app.html` (renamed from `exoplanet_3d.html`)
**Landing page:** `index.html`

### Architecture Summary

| Component | Description |
|-----------|-------------|
| **Data** | `NAMED[]` — ~50 named planets as `[name, ra, dec, dist, year, method, radius, temp, hz]`. `genBg()` — ~1,600 procedural background points (Kepler/K2/TESS/RV). |
| **Coordinate mapping** | `toXYZ(ra, dec, dist)` — RA/Dec to Cartesian, log-scaled distance. |
| **Textures** | `makePlanetTex(temp, rad, seed)` — 10 procedural surface types. Earth texture as base64 data URI. |
| **Scene** | Earth at origin, named planets as `MeshPhong` spheres, background as `ShaderMaterial` point cloud, stars + Milky Way dust. |
| **Filters** | Detection method, planet class, max distance, habitable zone toggle. |
| **Timeline** | Year slider 1992–2024, play/pause at 1.5x, milestone popups. |
| **Camera** | Spherical orbit (drag), pan (space+drag / right-drag), scroll zoom, click-to-fly-to + info panel. |
| **UI** | Glassmorphic dark theme (`rgba(10,14,28,.45)`, `blur(20px) saturate(1.2)`, `border-radius:14px`), Cormorant Garamond + JetBrains Mono. Filters collapsible on desktop. |
| **Space Radio** | YouTube IFrame API music player — 76 space-themed tracks, shuffled per session. Hidden iframe (audio-only). Media Session API for hardware media keys. Floating bar UI with play/pause/prev/next/seek. |

---

## Completed Phases

**Phase 0 — Project Setup** — `COMPLETE`

| # | Todo | Owner | Status |
|---|------|-------|--------|
| 0.1 | Copy source HTML into project directory | Driver | DONE |
| 0.2 | Create CLAUDE.md as source of truth | Driver | DONE |
| 0.3 | Human reviews and approves CLAUDE.md | Navigator | DONE |

**Phase 1 — Camera & Interaction Audit** — `COMPLETE`

| # | Todo | Owner | Status |
|---|------|-------|--------|
| 1.1–1.8 | Audit all camera/interaction subsystems | Navigator | DONE |
| 1.9 | Compile findings report | Navigator | DONE |
| 1.10 | Present findings to human | Navigator | DONE |

---

**Phase 2 — P0 & P1 Camera/Interaction Fixes** — `COMPLETE`

10 fixes across 4 steps, each Navigator-reviewed before proceeding.

| Step | Fixes | Bug IDs | Status |
|------|-------|---------|--------|
| Step 1: Core camera safety | 2.1–2.3 | BUG-5, BUG-6, MISS-3 (P0) | DONE + REVIEWED |
| Step 2: Touch device support | 2.4–2.7 | MISS-1 (P0), BUG-3, BUG-4, MISS-6 (P1) | DONE + REVIEWED |
| Step 3: Frame-rate independence | 2.8 | UX-4 (P1) | DONE + REVIEWED |
| Step 4: Info panel & keyboard | 2.9–2.10 | UX-7, MISS-2 (P1) | DONE + REVIEWED |

---

**Phase 3 — Distance Scale, Textures & Visual Polish** — `COMPLETE`

| # | Todo | Owner | Status |
|---|------|-------|--------|
| 3.1 | Distance rings (10/100/1000 ly) with labels | Driver | DONE |
| 3.2 | Solar system indicator (Sun, Moon, ring, label) | Driver | DONE |
| 3.3 | Milky Way context | Driver | DONE |
| 3.4 | Reduced Earth, added textured Sun + Moon | Driver | DONE |
| 3.5 | Removed decorative Saturn rings (no real data) | Driver | DONE |
| 3.6 | Real textures for all 46 planets (NASA + analogs + generated variations) | Driver | DONE |
| 3.7 | Textured starfield/milky way background | Driver | DONE |
| 3.8 | UI legibility fixes (fonts, colors, sizes) | Driver | DONE |
| 3.9 | Post-placement planet deconfliction | Driver | DONE |
| 3.R1 | Navigator review | Navigator | DONE — PASSED |

---

## NASA Eyes Comparison & Gap Analysis

> Comparison performed 2026-03-20 against https://eyes.nasa.gov/apps/exo/

### Where NASA has a clear edge

| Dimension | NASA | Us | Gap Severity |
|-----------|------|----|-------------|
| **3D labels** | Planet names on hover, CSS2D-projected | No labels — must click randomly | Critical |
| **Post-processing** | UnrealBloomPass — stars/sun glow | No post-processing, flat render | High |
| **Search** | Fuzzy search (Fuse.js), flies to result | No search at all | High |
| **Camera transitions** | Async flyTo with duration + easing, per-entity distance | Instant target snap, global tR clamp | High |
| **Info panel** | Size comparison, travel time, orbit viz, star data | 5 text fields | High |
| **Data volume** | 5,700+ planets from NASA API | 46 named + 1,600 procedural | Medium |
| **Materials** | MeshStandardMaterial, normal/specular maps, atmosphere shader | MeshBasicMaterial, no lighting | Medium |
| **View levels** | Galaxy → system → surface transitions | Single view only | Medium |
| **Mobile** | Full responsive CSS breakpoints | No responsive design | Medium |

### Where we hold our own

- **Timeline storytelling** — year-by-year discovery playback with milestones (NASA doesn't have this)
- **Single-file simplicity** — instant deploy, no build step
- **Typography & aesthetic** — distinctive editorial feel
- **Distance context** — concentric distance rings provide spatial intuition NASA lacks

---

## Completed Phases (continued)

**Phase 4 — NASA-Informed Improvements** — `COMPLETE`

Resolved 9 backlog items (ZOOM-1, UX-1, UX-2, BUG-1, MISS-5, UX-6, EARTH-SPIN, ADHOC-COORDS, ADHOC-DECON). Expanded info panel with full NASA data. Duration-based flyTo with easing. Bloom/materials attempted but reverted.

---

## Current Phase

**Phase 5 — Full NASA Data Integration**
Status: `COMPLETE`
Goal: Replace all procedural filler with real NASA Exoplanet Archive data (6,150 confirmed planets). Build search. Make every planet clickable. Transform from demo to real educational reference tool.

### Architecture (revised 2026-03-21)

- **Data:** 6,150 confirmed exoplanets from NASA Exoplanet Archive, loaded from `nasa_data.json` (1.1 MB compact JSON).
- **Featured planets:** ~137 most well-researched planets (top 30 per class by data-completeness score), rendered as individual textured meshes. Textures are real-image variations per temperature/type.
- **Bulk planets:** ~6,013 remaining planets as Points cloud (single draw call, existing ShaderMaterial).
- **Featured selection criteria:** Scored by data completeness (radius+mass+temp+orbital+star data known), habitable zone, nearby (<50 ly), directly imaged, famous systems. Top 30 from each of: Rocky (<1.6 R⊕), Super-Earth (1.6-3.0 R⊕), Neptune-like (3.0-8.0 R⊕), Gas giant (>8.0 R⊕).
- **Performance target:** ~140 meshes + 1 Points draw call + sky sphere. 60fps on mid-range laptop.
- **InstancedMesh approach REVERTED** — 860 same-textured spheres was unreadable. Replaced with curated 137 featured list.

### Steps

| # | Todo | Description | Owner | Status |
|---|------|-------------|-------|--------|
| 5.1 | Fetch + embed NASA data | Download 6,150 planets, compact JSON, load via fetch. Timeline extended to 2026. | Driver | DONE |
| 5.2 | Replace procedural background | Removed `genBg()`. Points cloud built from real NASA data. Distance slider extended to 10,000 ly. | Driver | DONE |
| 5.3 | Featured planet selection | Top 30 per class (120 planets) + original 46. Texture variations generated. Capped at 137 total. | Driver | DONE |
| 5.4 | Generate unique textures | PARKED — 3 approaches tried (OGA bases=too game-y, procedural=too uniform, real-base variations=still too similar). Needs fundamentally different approach: either hand-curate texture assignments, source individual textures per planet, or write a better procedural generator with more visual diversity per subtype. | Driver | PARKED |
| 5.5 | Click-to-select any planet | Screen-space hit testing on 6,013 background points. nasaToUserData/nasaToExtInfo helpers. | Driver | DONE |
| 5.6 | Dynamic texture promotion | Procedural texture mesh created on click, disposed on deselect. Real texture lazy-loaded. | Driver | DONE |
| 5.7 | Search across all planets | Text input with autocomplete, 4-tier priority ranking, 8 results, keyboard nav, rotating placeholders. | Driver | DONE |
| 5.8 | Labels for featured planets | Canvas Sprite labels with distance-based LOD (famous=200, other=80), class-colored, font-load guard. | Driver | DONE |
| 5.9 | Click empty space to deselect | Close info panel, dispose promoted mesh. 7 disposal paths. | Driver | DONE |
| 5.R | Navigator review per step | All steps reviewed with adversarial scrutiny | Navigator | DONE |

### Featured Planet List (137 total)

**Selection: top 30 by research-completeness score from each class:**
- **Rocky (<1.6 R⊕):** LHS 1140 c, K2-3 d, Kepler-62 f, L 98-59 b/c, GJ 367 b, HD 260655 b/c, LP 890-9 c, TOI-2095 c, GJ 1132 b, HD 219134 c/f, GJ 486 b, LTT 1445 A c, GJ 806 b, + more
- **Super-Earth (1.6-3.0 R⊕):** LHS 1140 b, K2-18 b, GJ 1214 b, Kepler-22 b, Kepler-62 e, L 98-59 d, AU Mic c, GJ 414 A b, TOI-4336 A b, HD 219134 b/d, K2-180/182 b, + more
- **Neptune-like (3.0-8.0 R⊕):** AU Mic b, Kepler-38 b, HD 106315 c, TOI-1231 b, TOI-1853 b, HD 191939 b/c/d, K2-25 b, TOI-2134 c, + more
- **Gas giant (>8.0 R⊕):** GJ 414 A c, HR 8799 d/e, HAT-P-18/20/23/28 b, CoRoT-5/6/10 b, WASP-59 b, Kepler-39/44/45 b, + more

### Remaining from Phase 4 (merged into Phase 5)

- 4.3 (labels) → merged into 5.8
- 4.4 (search) → merged into 5.7
- 4.8 (expanded info) → DONE
- 4.9 (hover highlight) → deferred to Phase 6
- 4.10 (click deselect) → merged into 5.9

---

**Phase 6 — Space Radio & Glassmorphism UI Overhaul** — `COMPLETE`

| # | Todo | Owner | Status |
|---|------|-------|--------|
| 6.1 | Space Radio — YouTube IFrame API music player with 76 tracks | Driver | DONE |
| 6.2 | Glassmorphism UI audit & overhaul — all surfaces use frosted glass | Driver | DONE |
| 6.3 | Filters collapsible on desktop (toggle button visible, panel hidden by default) | Driver | DONE |
| 6.4 | Fix overlap issues: info panel vs counter, distance indicator overflow, filter toggle spacing | Driver | DONE |
| 6.5 | Distance indicator restored to borderless style, repositioned to bottom:300px | Driver | DONE |
| 6.6 | Removed PAN MODE HUD overlay | Driver | DONE |
| 6.7 | Media Session API — hardware play/pause/next/prev keys + Now Playing metadata | Driver | DONE |
| 6.8 | Volume slider removed (system volume via hardware keys) | Driver | DONE |
| 6.9 | Timeline play auto-zooms to wide overview (radius 900, ~31,000 ly) | Driver | DONE |

---

## Issue Tracker

### Fixed Issues — Phase 2: Camera & Interaction (12)

| ID | Type | Description | Step | Status |
|----|------|-------------|------|--------|
| BUG-5 | Bug | Scroll fly-forward drifted `tCtr` past clicked planets | 2.1 | FIXED |
| BUG-6 | Bug | `tCtr` unbounded — users could pan into void with no recovery | 2.2 | FIXED |
| MISS-3 | Missing | No Reset View button — stranded users had no escape | 2.3 | FIXED |
| MISS-1 | Missing | No pinch-to-zoom on touch devices | 2.4 | FIXED |
| BUG-3 | Bug | Multi-touch caused erratic orbit jitter | 2.5 | FIXED |
| BUG-4 | Bug | False tap-to-select during multi-touch lift | 2.6 | FIXED |
| MISS-6 | Missing | No two-finger pan on touch devices | 2.7 | FIXED |
| UX-4 | UX | Camera smoothing was frame-rate dependent | 2.8 | FIXED |
| UX-3 | UX | AutoSpin speed was frame-rate dependent | 2.8 | FIXED |
| AD-HOC-1 | Bug | Pull-back decay was frame-rate dependent | 2.8 fixup | FIXED |
| UX-7 | UX | Info panel conflated close with camera reset | 2.9 | FIXED |
| MISS-2 | Missing | No Escape key; Space key could get stuck on blur | 2.10 | FIXED |

### Fixed Issues — Phase 3: Distance Context (3)

| ID | Type | Description | Step | Status |
|----|------|-------------|------|--------|
| PHASE3-1 | Missing | No distance scale — users couldn't gauge how far planets were | 3.1 | FIXED |
| PHASE3-2 | Missing | No solar system reference indicator | 3.2 | FIXED |
| PHASE3-3 | Missing | No Milky Way scale context | 3.3 | FIXED |

### Fixed Issues — Ad-Hoc During Development (4)

| ID | Type | Description | Status |
|----|------|-------------|--------|
| ADHOC-RINGS | Bug | Saturn rings visible before planet discovered on timeline | FIXED |
| ADHOC-ZFIGHT | Bug | 9 multi-planet systems had identical coords causing z-fighting flicker | FIXED |
| ADHOC-DT | Bug | Large dt spikes (tab background/resume) caused camera teleport | FIXED |
| ADHOC-PANTEX | Bug | Moon texture had black patches (cube map on sphere UV) + Sun had red corona patches | FIXED |

### Fixed Issues — Phase 4 (9)

| ID | Type | Description | Status |
|----|------|-------------|--------|
| ZOOM-1 | Bug | Can't zoom close enough to distant planets | FIXED — direct per-event zoom + fly-forward on tR floor |
| UX-1 | UX | Asymmetric zoom factors | FIXED — magnitude-proportional, symmetric |
| UX-2 | UX | Click-to-fly always adds +0.5 to theta | FIXED — removed |
| BUG-1 | Bug | Theta accumulates unboundedly (float drift) | FIXED — wrapped to [0, 2π), shortest-path interpolation |
| MISS-5 | Missing | No orbit momentum/inertia on drag release | FIXED — decaying velocity, dt-scaled |
| UX-6 | UX | No visual feedback during long fly-to | FIXED — "Traveling to" HUD, 2s minimum |
| EARTH-SPIN | UX | Earth/Sun rotation frame-rate dependent | FIXED — dt-scaled |
| ADHOC-COORDS | Bug | 20 planet coordinates wrong vs NASA data | FIXED — corrected from NASA Exoplanet Archive |
| ADHOC-DECON | Bug | Multi-planet systems overlapping after deconfliction | FIXED — orbital lane arrangement (sorted by period, arc spread, tilted disc) |

### Open Issues (Backlog)

| ID | Type | Description | Priority | Notes |
|----|------|-------------|----------|-------|
| MISS-4 | Missing | No double-click/double-tap to zoom | P2 | Standard 3D interaction pattern |

---

## Root Cause Analysis (RCA)

> 18 of 27 bugs (67%) trace to just 3 root causes. Addressing these 3 with the recommended practices would have prevented the majority.

### Root Cause Categories

| # | Category | Bug Count | Bug IDs |
|---|----------|-----------|---------|
| 1 | **Frame-rate dependency** — animations used fixed per-frame increments instead of dt-scaling | 5 | UX-4, UX-3, AD-HOC-1, ADHOC-DT, EARTH-SPIN |
| 2 | **Missing touch/mobile support** — input built exclusively around mouse events | 4 | MISS-1, BUG-3, BUG-4, MISS-6 |
| 3 | **Missing safety boundaries** — camera state had no limits, no reset, no escape hatch | 5 | BUG-5, BUG-6, MISS-3, ZOOM-1, BUG-1 |
| 4 | **Incomplete state management** — visual objects not tied to timeline lifecycle | 1 | ADHOC-RINGS |
| 5 | **Data integrity / coordinate collision** — multi-planet systems mapped to identical 3D positions | 1 | ADHOC-ZFIGHT |
| 6 | **Design debt / conflated UI actions** — one control doing two unrelated things | 3 | UX-7, UX-2, UX-1 |
| 7 | **Missing standard interaction patterns** — expected gestures not implemented | 4 | MISS-2, MISS-4, MISS-5, UX-6 |
| 8 | **Asset pipeline issues** — wrong texture format/mapping for geometry | 1 | ADHOC-PANTEX |
| 9 | **Scope gaps** — contextual features needed but not in original scope | 3 | PHASE3-1, PHASE3-2, PHASE3-3 |

### Why These Happened

- **Root cause 1 (frame-rate):** Prototype tested on single device at consistent fps. `requestAnimationFrame` treated as fixed-rate tick.
- **Root cause 2 (touch):** Developed/tested in desktop browser only. No input abstraction layer.
- **Root cause 3 (boundaries):** Simplest-possible camera implementation — raw variables with direct manipulation, no invariants defined.
- **Root cause 5 (z-fighting):** `toXYZ()` log-scale collapses intra-system distances to same point. No spatial deconfliction.
- **Root cause 6 (conflation):** Rapid prototyping bundled related actions ("close panel" + "reset camera") without separating concerns.

### Top 3 Prevention Recommendations

1. **Time-based animation convention** — every `+=` in animate() must use `dt`. Create helper, enforce in review. Prevents 5 bugs.
2. **Input abstraction + interaction spec** — map every action to every input method before coding. Survey comparable apps. Prevents 8 bugs.
3. **Camera state invariants** — wrap camera params in setters that enforce bounds/wrapping every frame. Always include reset. Prevents 5 bugs.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Copied `exoplanet_3d_v4 (3).html` into project as `exoplanet_3d.html` | Driver |
| 2026-03-18 | Created `CLAUDE.md` — project source of truth with workflow rules | Driver |
| 2026-03-18 | Phase 1 audit complete — 4 P0, 6 P1, 7 P2 findings | Navigator |
| 2026-03-18 | Phase 2 planned — 10 fixes in 4 steps with review gates | Navigator |
| 2026-03-18 | Step 1: Fixed scroll fly-forward (BUG-5), bounded tCtr (BUG-6), added Reset View button (MISS-3) | Driver |
| 2026-03-18 | Step 1 reviewed — PASSED, no issues | Navigator |
| 2026-03-18 | Step 2: Implemented pinch-to-zoom (MISS-1), fixed multi-touch jitter (BUG-3), false tap (BUG-4), added touch pan (MISS-6) | Driver |
| 2026-03-18 | Step 2 reviewed — PASSED, no issues | Navigator |
| 2026-03-18 | Step 3: Made camera smoothing + autoSpin dt-based (UX-4), capped dt at 100ms, fixed pull-back decay | Driver |
| 2026-03-18 | Step 3 reviewed — PASSED after one-line fixup for pull-back framerate dependency | Navigator |
| 2026-03-18 | Step 4: Added X close button on info panel (UX-7), Escape key handler, blur handler for stuck Space (MISS-2) | Driver |
| 2026-03-18 | Step 4 reviewed — PASSED, no issues. Phase 2 complete. | Navigator |
| 2026-03-19 | Attempted zoom-reach fix: increased fly-forward floor/factor, dolly-toward-cursor raycasting, lowered tR min to 0.3. User reports issue persists — parked to backlog | Driver |
| 2026-03-19 | Phase 3: Added distance rings (10/100/1000 ly), solar system indicator, Milky Way context label | Driver |
| 2026-03-19 | Phase 3 reviewed — PASSED, all features correct | Navigator |
| 2026-03-19 | Ad-hoc: Reduced Earth (5→2), added Sun (shader→texture), Moon (NASA LRO), rescaled exoplanets | Driver |
| 2026-03-19 | Ad-hoc: Removed Sun corona/halo, removed HZ green rings and particle aura | Driver |
| 2026-03-19 | Ad-hoc: Fixed z-fighting on 9 multi-planet systems (offset coordinates) | Driver |
| 2026-03-19 | Ad-hoc: Fixed Saturn rings showing before planet discovery on timeline | Driver |
| 2026-03-19 | Ad-hoc: Implemented Figma-style zoom-toward-cursor (focal plane projection) | Driver |
| 2026-03-20 | Full issue tracker added to CLAUDE.md (19 fixed, 8 open) | Navigator |
| 2026-03-20 | RCA completed — 9 root cause categories, 3 prevention recommendations | Navigator |
| 2026-03-20 | Added RCA workflow rules (9, 10) + pre-code checklist to CLAUDE.md | Navigator |
| 2026-03-20 | Saved RCA findings + workflow to project memory for future conversations | Navigator |
| 2026-03-20 | UI legibility overhaul — raised all font sizes, colors, slider/button sizes | Driver |
| 2026-03-20 | Removed decorative Saturn rings (no real data backing) | Driver |
| 2026-03-20 | Upgraded gas giant procedural textures (3 temp categories, storms, banding, turbulence) | Driver |
| 2026-03-20 | Removed gas giant atmosphere glow spheres (looked bad) | Driver |
| 2026-03-20 | Applied real textures to all 46 planets (NASA Eyes + Solar System Scope + generated variations) | Driver |
| 2026-03-20 | Replaced procedural stars/dust with textured starfield+milky way sky sphere | Driver |
| 2026-03-20 | Added post-placement planet deconfliction (replaces coordinate hacks) | Driver |
| 2026-03-20 | NASA Eyes comparison analysis completed — 9 gap dimensions, top 5 priorities identified | Navigator |
| 2026-03-20 | Phase 4 planned — 10 todos in 4 steps based on NASA gap analysis | Navigator |
| 2026-03-20 | NASA-style exponential zoom implemented (fixes ZOOM-1) — accumulated offset, smoothed factor, 2^(offset*sensitivity) | Driver |
| 2026-03-20 | Step 1: Added UnrealBloomPass + MeshStandardMaterial for exoplanets | Driver |
| 2026-03-20 | Step 1 reviewed — PASSED. Fixed script load order (EffectComposer before ShaderPass for THREE.Pass dependency) | Navigator |
| 2026-03-20 | Reverted bloom + MeshStandardMaterial — caused blown-out hemispheres | Driver |
| 2026-03-21 | Zoom rewritten: direct per-event with magnitude-proportional sensitivity + fly-forward on tR floor (ZOOM-1, UX-1) | Driver |
| 2026-03-21 | Removed click-to-fly +0.5 theta (UX-2) | Driver |
| 2026-03-21 | Theta wrapped to [0, 2π) with shortest-path interpolation (BUG-1) | Driver |
| 2026-03-21 | Added orbit momentum/inertia on drag release with dt-scaled decay (MISS-5) | Driver |
| 2026-03-21 | Added "Traveling to [name]" fly-to HUD with 2s minimum display (UX-6) | Driver |
| 2026-03-21 | Earth + Sun rotation dt-scaled (EARTH-SPIN) | Driver |
| 2026-03-21 | 20 planet coordinates corrected from NASA Exoplanet Archive (ADHOC-COORDS) | Driver |
| 2026-03-21 | Deconfliction redesigned: circular arrangement for multi-planet systems (ADHOC-DECON) | Driver |
| 2026-03-21 | Backlog cleared — all open issues resolved except MISS-4 (double-click zoom) | Navigator |
| 2026-03-21 | Phase 5.1: Downloaded 6,150 NASA exoplanets, converted to compact JSON, loaded via fetch | Driver |
| 2026-03-21 | Phase 5.2: Replaced procedural genBg() with real NASA data Points cloud. Extended timeline to 2026, distance slider to 10,000 ly | Driver |
| 2026-03-21 | Phase 5.3: InstancedMesh for 860 gas giants — REVERTED (unreadable, same textures on hundreds of planets) | Driver |
| 2026-03-21 | Phase 5.3 revised: Featured list = top 30 per class by research score (120 new + 45 original = ~137 total). 129 texture variations generated from base textures. | Driver |
| 2026-03-21 | Architecture revised: curated 137 featured meshes + 6,013 Points cloud. InstancedMesh abandoned. | Navigator |
| 2026-03-21 | Camera system fully rewritten as state machine (CAM object, 5 modes: idle/orbit/pan/momentum/flyto) | Driver |
| 2026-03-21 | Zoom rewritten: Celestia asymptotic approach (span-based, never hits floor) + infinity dolly (overflow pushes center forward) + cursor dolly (camera-controls lerpRatio). Scroll and pinch unified. | Driver |
| 2026-03-21 | Added live "You are X light-years from Earth" distance indicator with contextual facts | Driver |
| 2026-03-21 | Scene scale widened (390→900), planet sizes halved, camera far plane extended to 12000 | Driver |
| 2026-03-22 | Distance indicator fixed: uses camera.position.length() instead of CAM._center.length() for accurate ly reading | Driver |
| 2026-03-22 | Multi-planet system deconfliction: orbital lane arrangement (sorted by orbital period, arc spread, tilted disc) replaces circle layout | Driver |
| 2026-03-22 | Deconfliction grouping threshold widened (rI+rJ+8) so second pass catches already-moved planets | Driver |
| 2026-03-22 | Space Radio: YouTube IFrame API player with 76 space-themed tracks, shuffled playlist, custom floating bar UI | Driver |
| 2026-03-22 | Glassmorphism UI overhaul: all surfaces use frosted glass (blur 20-24px, saturate 1.2, rgba(10,14,28,.45), border-radius 14px) | Driver |
| 2026-03-22 | Filters collapsible on desktop — toggle button visible by default, filter panel hidden with slide-in animation | Driver |
| 2026-03-22 | Fixed overlaps: info panel moved below counter (top:110px), distance indicator overflow clipped, filter toggle spacing increased | Driver |
| 2026-03-22 | Distance indicator restored to borderless floating text, repositioned to bottom:300px (between filters and music player) | Driver |
| 2026-03-22 | Removed PAN MODE HUD overlay element | Driver |
| 2026-03-22 | Media Session API: hardware media keys (play/pause/next/prev) + Now Playing metadata (title, artist, "Space Radio") | Driver |
| 2026-03-22 | Removed volume slider from music player UI (system volume via hardware keys sufficient) | Driver |
| 2026-03-22 | Timeline play button auto-flies camera to wide overview (radius 900, ~31,000 ly) for full-scope discovery playback | Driver |
| 2026-03-22 | UX + Market Landscape dual audit conducted — scored 5.85/10 UX, identified search as critical gap | Navigator |
| 2026-03-22 | Phase 7 (audit): Click-any-planet — screen-space Points hit testing, nasaToUserData/nasaToExtInfo helpers, promoted mesh system | Driver |
| 2026-03-22 | Phase 7 (audit): Dynamic texture promotion — procedural mesh on background point click, 7 disposal paths, real texture lazy swap | Driver |
| 2026-03-22 | Phase 7 (audit): Click-empty-space to deselect — closes info panel + disposes promoted mesh | Driver |
| 2026-03-22 | Phase 7 (audit): Search with autocomplete — 4-tier priority (exact→starts-with→contains→host), 8 results, keyboard nav, rotating placeholder examples | Driver |
| 2026-03-22 | Phase 7 (audit): 3D labels — canvas Sprite per featured planet, distance-based LOD (famous=200/other=80), class-colored, font-load guard, POT canvases | Driver |
| 2026-03-22 | Phase 7 (audit): MeshPhongMaterial upgrade — featured planets respond to lighting (shininess:8), DirectionalLight 5.0→1.2, AmbientLight 3.5→0.6 | Driver |
| 2026-03-22 | Phase 7 (audit): UnrealBloomPass — conservative params (strength=0.25, threshold=0.88), auto-disable if fps<50 | Driver |
| 2026-03-22 | Phase 7 (audit): Responsive mobile — @media breakpoints for phone/tablet, bottom sheet info panel, filter toggle, 44px touch targets, safe-area-inset | Driver |
| 2026-03-22 | Phase 7 (audit): Cinematic 3-act intro — galaxy pull-in → timeline at 4x → "This is home" zoom to Earth → pull back to explore | Driver |
| 2026-03-22 | Phase 7 (audit): UX discoverability — middle-click pan, background point hover feedback (cursor+highlight), auto-play timeline on first visit | Driver |
| 2026-03-22 | Phase 7 (audit): Texture lazy loading — procedural on init, famous pre-loaded after 2s, real textures on demand. Initial load 68MB→1.1MB | Driver |
| 2026-03-22 | Phase 7 (audit): WebGL fallback — graceful error message if WebGL unavailable | Driver |
| 2026-03-22 | Phase 7 (audit): Adaptive quality — auto-reduces pixel ratio, star/dust counts, disables bloom on slow devices | Driver |
| 2026-03-22 | Phase 7 (audit): Accessibility — Tab planet navigation with focus ring, ARIA labels/roles/states, screen reader announcements, focus management, aria-pressed on filters | Driver |
| 2026-03-22 | Phase 7 (audit): Fixed timeline bug — curYr cap changed from 2024 to 2026 to match stop condition | Driver |
| 2026-03-22 | Phase 7 (audit): All 85 automated tests passing | Navigator |
| 2026-03-22 | Phase 8: Heading structure — h1 for page title, sr-only h2s for Filters, Planet Info, Space Radio, Discovery Timeline (A11Y-R1) | Driver |
| 2026-03-22 | Phase 8: Landmark regions — main wraps canvas, header for title block, aside for filters, nav for timeline controls (A11Y-R2) | Driver |
| 2026-03-22 | Phase 8: Decorative icons hidden from AT — 7 icon characters wrapped in aria-hidden spans, timeline play icon refactored to #play-icon (A11Y-R3) | Driver |
| 2026-03-22 | Phase 8: Milestone events announced to screen readers via #sr-announce live region (A11Y-R5) | Driver |
| 2026-03-22 | Phase 8: Info panel key-value pairs converted to dl/dt/dd definition lists for semantic structure (A11Y-R9) | Driver |
| 2026-03-22 | Phase C.1: Renamed exoplanet_3d.html to app.html, updated test file references | Driver |
| 2026-03-22 | Phase C.2: Created index.html landing page (30KB, glassmorphism, CSS star field, scroll reveals, full methodology docs, real dataset counts) | Driver |
| 2026-03-22 | Phase C.3: Created favicon set — SVG planet glyph, ICO 32x32/16x16, apple-touch-icon 180x180. Added link tags to both pages. | Driver |
| 2026-03-22 | Phase C.4: Created og-image.png (1200x630) for social sharing — starfield background, planet spheres, title/subtitle overlay | Driver |
| 2026-03-22 | Phase C.5: Created robots.txt and sitemap.xml with [DOMAIN] placeholders | Driver |

---

**Phase 7 — UX & Market Audit Improvements** — `COMPLETE`

Driven by a dual UX + Market Landscape audit that scored the tool 5.85/10. Implemented all MUST SHIP and SHOULD SHIP items across 6 sub-phases with Driver-Navigator adversarial review workflow.

| Sub-phase | Steps | Description | Status |
|-----------|-------|-------------|--------|
| Core Discoverability | 6.1–6.4 | Click-any-planet, promoted mesh, deselect, search with autocomplete | DONE + REVIEWED |
| Labels & Visual Quality | 7.1–7.3 | 3D labels (canvas Sprites), MeshPhongMaterial, UnrealBloomPass | DONE + REVIEWED |
| Mobile & Responsive | 8.1–8.3 | CSS breakpoints, touch targets, mobile label density | DONE + REVIEWED |
| Opening Experience | 9.1–9.2 | 3-act cinematic intro, UX discoverability fixes (hover, middle-click, placeholders) | DONE + REVIEWED |
| Accessibility | 10.1–10.3 | Keyboard planet nav, ARIA, screen reader, focus management | DONE + REVIEWED |
| Performance | 11.1–11.3 | Texture lazy loading (68MB→1.1MB), WebGL fallback, adaptive quality | DONE + REVIEWED |

**Phase 8 — Accessibility Structural Semantics** — `COMPLETE`

Goal: Improve WCAG score from ~6.5 to ~7.5/10 with zero visual changes — purely semantic HTML improvements.

| # | Todo | Owner | Status |
|---|------|-------|--------|
| 8.1 | A11Y-R1: Heading structure — h1 for title, sr-only h2s for Filters, Planet Info, Space Radio, Timeline | Driver | DONE |
| 8.2 | A11Y-R2: Landmark regions — main (canvas), header (title block), aside (filters), nav (timeline) | Driver | DONE |
| 8.3 | A11Y-R3: Decorative icons hidden from AT — 7 icon chars wrapped in span[aria-hidden], play icon refactored to #play-icon span | Driver | DONE |
| 8.4 | A11Y-R5: Milestone announcements — checkMS() pipes year+text into #sr-announce live region | Driver | DONE |
| 8.5 | A11Y-R9: Definition lists — info panel Planet/Host Star/Discovery sections converted from div/span to dl/dt/dd | Driver | DONE |

### Backlog (deferred)

| ID | Type | Description | Priority |
|----|------|-------------|----------|
| MISS-4 | Missing | Double-click/double-tap to zoom | P2 |
| SHARE-1 | Feature | Share URL with planet + year state (#planet=...&year=...) | P2 |

---

## Notes

- NASA data loaded from `nasa_data.json` (1.1 MB, 6,150 confirmed exoplanets).
- 166 planet texture files in `textures/planets/` (generated from 49 base textures via `generate_textures.py`).
- Three.js r128 loaded from CDN + post-processing addons (EffectComposer, UnrealBloomPass). No build step.
- Featured planets selected by data-completeness scoring: radius, mass, temperature, orbital data, star data, HZ status, proximity, direct imaging.
- Textures lazy-loaded: procedural on init, famous pre-loaded after 2s, real textures on demand. Initial load: ~1.1MB (was ~68MB).
- All 6,150 planets searchable and clickable (137 featured meshes + 6,013 background points with screen-space hit testing).
- Test suite: `tests/test.html` (85 automated tests), `tests/test_visual.html` (15 manual checks). Run via `python3 -m http.server`.
- Accessibility: keyboard planet navigation (Tab/Enter/Escape), ARIA labels, screen reader announcements, focus management, heading structure (h1/h2), landmark regions (main/header/aside/nav), definition lists in info panel, decorative icons hidden from AT, milestone announcements. WCAG AA ~7.5/10.
