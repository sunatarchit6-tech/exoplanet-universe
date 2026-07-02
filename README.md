# Exoplanet Universe

Interactive 3D visualization of 6,150 confirmed exoplanets from NASA's Exoplanet Archive. Real coordinates, real physical properties, 30-year discovery timeline.

**[Live Demo](https://planetaryscience.xyz)**

## Features

- **6,150 real exoplanets** from the NASA Exoplanet Archive (March 2026 snapshot)
- **137 featured planets** rendered as individual textured spheres, selected by research completeness
- **6,013 background planets** as a high-performance WebGL point cloud (single draw call)
- **Search** across all 6,150 planets with autocomplete and keyboard navigation
- **Click any planet** — featured meshes and background points are all interactive
- **30-year discovery timeline** (1992-2026) with play/pause and milestone popups
- **Filters** by detection method, planet class, max distance, habitable zone
- **Space Radio** — 76 space-themed ambient tracks via YouTube, with hardware media key support
- **3D labels** with distance-based LOD, class-colored, for all featured planets
- **Cinematic intro** — galaxy pull-in, timeline playback, zoom to Earth, pull back to explore
- **Adaptive quality** — auto-reduces pixel ratio, particle counts, and disables bloom on slower devices
- **Responsive** — CSS breakpoints for phone, tablet, desktop with touch-optimized controls
- **Accessible** — keyboard navigation, ARIA labels, screen reader announcements, landmark regions

## Getting Started

No build step required. The entire application is a single HTML file.

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/exoplanet-universe.git
cd exoplanet-universe

# Start any static file server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

The landing page is at `index.html`. The 3D visualization is at `app.html`.

### Requirements

- A modern browser with WebGL support (Chrome, Firefox, Safari, Edge)
- ~3 MB initial download (HTML + NASA data JSON), textures lazy-loaded on demand

## Project Structure

```
.
├── index.html              # Landing page
├── app.html                # Main 3D visualization (single-file)
├── data/
│   └── nasa_data.json      # 6,150 exoplanets (1.1MB compact JSON)
├── textures/
│   ├── planets/            # 166 planet textures (2048x1024 JPEGs, deployed)
│   ├── scene/              # Earth / Sun / Moon / starfield backdrop textures
│   ├── nasa/               # Real NASA reference textures (on-demand)
│   ├── generated/          # Procedurally generated textures
│   └── source/             # Source art / class base textures
├── tests/
│   ├── test.html           # 85 automated tests
│   └── test_visual.html    # 15 manual visual checks
├── docs/                   # DEPLOYMENT.md + audit reports
├── scripts/                # Texture generation + test tooling
├── ripple/                 # Sibling project: gravitational-wave prototypes
├── og-image.png            # Social sharing image (1200x630)
├── favicon.svg             # SVG favicon
├── favicon.ico             # ICO favicon (32x32, 16x16)
├── apple-touch-icon.png    # iOS home screen icon (180x180)
├── robots.txt              # Crawler rules
├── sitemap.xml             # Sitemap for search engines
└── vercel.json             # Vercel deployment config (cache headers, redirects)
```
(archive/ holds git-ignored, regenerable artifacts: lighthouse reports, screenshots, backup.)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Rendering | [Three.js](https://threejs.org/) r128, WebGL |
| Post-processing | UnrealBloomPass (conservative, auto-disabled on slow GPUs) |
| Data | NASA Exoplanet Archive, static JSON snapshot |
| Textures | Procedural generation + NASA/Solar System Scope base images |
| Music | YouTube IFrame API (audio-only, hidden iframe) |
| Hosting | Vercel (static) |
| Build | None — single HTML file, no bundler, no framework |

## Architecture

### Coordinate System

Planets are placed using real equatorial coordinates (Right Ascension / Declination) converted to 3D Cartesian via `toXYZ(ra, dec, dist)`. Distance is logarithmically compressed so both nearby systems (4 ly) and distant ones (10,000+ ly) are visible without a linear scale that pushes everything into a dot.

### Rendering Tiers

1. **Featured planets** (~137) — individual `MeshPhongMaterial` spheres with unique textures, 3D labels, full info panels
2. **Background planets** (~6,013) — `ShaderMaterial` point cloud, screen-space hit testing on click, promoted to textured mesh on selection
3. **Environment** — Earth/Sun/Moon at origin, distance rings (10/100/1,000 ly), starfield sky sphere

### Camera System

A custom spherical orbit camera with 5 modes (idle, orbit, pan, momentum, fly-to). Key innovations that took several iterations to get right:

- **Celestia-style asymptotic zoom** — scroll/pinch never hits a floor; instead it asymptotically approaches the target
- **Infinity dolly** — when zoom overflows, the camera center pushes forward, enabling infinite travel
- **Cursor dolly** — zoom converges toward the cursor position, not the screen center
- **Duration-based fly-to** with easing for planet selection transitions

### Texture Pipeline

Featured planets get textures assigned by physical properties. On init, a fast procedural texture is generated. After 2 seconds, famous planets pre-load real textures. On-demand planets get a procedural texture immediately, then swap to a real texture when loaded. This dropped initial page load from ~68 MB to ~1.1 MB.

## Data Sources

- **Planet data:** [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) — Planetary Systems Composite Parameters table, accessed March 21, 2026
- **Planet textures:** Base images from NASA/JPL, [Solar System Scope](https://www.solarsystemscope.com/textures/), and [OpenGameArt](https://opengameart.org/) (CC0/CC-BY), with generated variations per planet class and temperature
- **Earth texture:** NASA Visible Earth, Blue Marble
- **Moon texture:** NASA Lunar Reconnaissance Orbiter
- **Sun texture:** NASA Solar Dynamics Observatory
- **Starfield:** ESO/S. Brunier Milky Way panorama

Temperature estimates for ~72% of planets use a cascade: measured equilibrium temperature > calculated from stellar luminosity and orbital distance > estimated from stellar effective temperature. Radii for non-transiting planets use mass-radius relations from Chen & Kipping (2017). Habitable zone boundaries follow Kopparapu et al. (2013).

## Running Tests

```bash
python3 -m http.server 8000
# Open http://localhost:8000/tests/test.html for automated tests (85 tests)
# Open http://localhost:8000/tests/test_visual.html for manual visual checks
```

## Deployment

Deployed on Vercel as a static site. See `vercel.json` for cache headers and redirect config. To deploy your own instance:

```bash
npm i -g vercel
vercel
```

## Known Limitations

- Planet surface textures are illustrative, not observational — no technology can resolve exoplanet surfaces
- Distances are logarithmically compressed; spatial relationships are approximate
- Static data snapshot — does not auto-update from the NASA archive
- Single-file architecture means the HTML is large (~240KB) but loads fast with no build step

## License

[MIT](LICENSE)

## Credits

Built by [Archit Sunat](mailto:sunat.archit6@gmail.com).

Planet data from NASA's Exoplanet Archive, managed by the NASA Exoplanet Science Institute (NExScI) at Caltech/IPAC.

This project is independent and not affiliated with, endorsed by, or produced by NASA, JPL, Caltech, or any space agency.
