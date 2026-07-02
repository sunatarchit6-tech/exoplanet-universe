# Kerr — A Black Hole Laboratory

**An interactive, real-time, physically rigorous ray-tracer of curved spacetime, designed for the browser.**

Working title: *Kerr*. Audience: astrophysics students at the level of an IISc undergraduate course in general relativity, with depth that withstands review by a working relativist.

---

## 1 · One-page summary

A single web page that renders a rotating (Kerr) black hole correctly — meaning every pixel is the result of integrating a null geodesic backwards through curved spacetime to find the light ray that arrived there. The user sees a live, manipulable picture of curved spacetime: a tilted accretion disk lifted over the top of the shadow by gravitational lensing, the photon ring resolved with its first sub-ring, Doppler-beamed asymmetry from the orbital motion of disk gas, and the shadow itself with its spin-dependent shape.

A control panel binds the renderer to the physical parameters a relativist actually cares about: spin *a*/M, observer inclination, mass, observer radius, disk geometry. Two preset buttons (*M87\**, *Sgr A\**) snap the parameters to the values published by the Event Horizon Telescope collaboration and fade in the real EHT image at adjustable opacity, so the simulated silhouette can be compared directly against the photograph.

A free-fall mode detaches the camera into a Painlevé–Gullstrand falling frame and runs the same renderer from that observer; a Penrose diagram in the corner traces the worldline as it crosses the horizon. Toggleable overlays expose the ergosphere boundary, the innermost stable circular orbit, the photon sphere, and on user click, the geodesic path of any selected pixel rendered in three dimensions.

The page is a single HTML file. Three.js orchestrates the DOM and a single full-screen quad. The mathematical heart is one GLSL fragment shader that performs adaptive Runge–Kutta integration of the geodesic equation per pixel, terminating each ray on event-horizon crossing, accretion-disk intersection, or escape to the celestial sphere. No build step, no installer, no account; opens in any modern browser.

---

## 2 · Why this should exist

General relativity is the most photogenic theory in physics and the worst-served by interactive visualization. The state of the field as of 2026:

- **Special relativity** has *A Slower Speed of Light* (MIT Game Lab 2012) and its OpenRelativity toolkit, plus a long tail of academic and hobbyist simulators.
- **General relativity** has Andrew Hamilton's offline visualizations at JILA, the spacetimetravel.org gallery from the Tübingen group, Bohn et al.'s 2015 benchmark renderings, and the *Interstellar* Gargantua sequence as a one-off cinema project (James et al. 2015).
- **Interactive, browser-based, scientifically rigorous Kerr ray-tracing** is essentially absent. Shadertoy hosts a handful of attempts — almost all Schwarzschild, almost none with a real accretion disk, none with EHT comparison or pedagogical overlays.

The 2019 EHT image of M87\* and the 2022 image of Sgr A\* moved black holes from theoretical objects into observed ones. Students who grew up seeing those photographs deserve a tool that lets them recover the photograph from first principles, vary the parameters, and watch the shadow respond. Such a tool exists in research codes — GRMHD libraries used by the EHT collaboration, for instance — but not as a polished interactive page.

The project's premise is that 2026 hardware can finally do this in a browser at 60 fps, and that the gap between "researchers have it in their offline pipelines" and "an undergraduate can open it in a tab" is one polished single-file web app wide.

---

## 3 · What the page is, concretely

A first-person observer watches a Kerr black hole surrounded by a thin Novikov–Thorne accretion disk against a real astronomical background. The artifact has the following components:

### 3.1 · The renderer

A WebGL2 (with WebGPU upgrade path) fragment shader running on one full-screen quad. For each pixel:

1. Construct the initial photon 4-momentum from the camera position and pinhole geometry.
2. Integrate the null geodesic equation in Boyer–Lindquist coordinates (Boyer and Lindquist 1967) using the Carter separable form (Carter 1968) with adaptive Cash–Karp Runge–Kutta step control.
3. Terminate the ray on one of three events:
   - Crossing the outer event horizon r₊ → output the shadow color.
   - Intersecting the equatorial accretion disk between r_in and r_out → evaluate disk emission at that radius, transport back to the observer via the relativistic Doppler factor *g* = E_obs/E_emit, apply the *I/ν³* invariant for surface brightness, convolve a Planck spectrum at the disk's local temperature into RGB.
   - Escaping to *r* > r_max → sample the celestial sphere cube map in the asymptotic direction.

The shader includes a `#pragma physics` block at top documenting each conserved quantity (energy E, axial angular momentum L_z, Carter's constant Q) and each citation.

### 3.2 · The control surface

A glassmorphic right-side panel exposing every physically meaningful parameter:

| Parameter | Range | Default | Visual response |
|---|---|---|---|
| Spin *a*/M | 0 → 0.998 | 0.9 | Shadow shape squashes, photon ring brightens, ergosphere appears |
| Observer inclination *i* | 0° → 90° | 60° | Disk goes face-on to edge-on; lensed-over-top arc emerges |
| Observer radius r/r_g | 5 → 1000 | 30 | BH apparent size; far/near dominance |
| Mass M | 1 M☉ → 10¹⁰ M☉ | 6.5 × 10⁹ M☉ | Sets physical scale (Hawking temperature, Schwarzschild radius display) |
| Charge Q/M | 0 → 0.5 | 0 | Kerr–Newman; inner horizon visualization |
| Disk inner edge | ISCO (auto) or manual | ISCO | Disk truncation |
| Disk outer edge | r_out/r_g | 20 | Disk extent |
| Background | Star field / HUDF / JWST CEERS / Milky Way / CMB / EHT M87\* / EHT Sgr A\* | Star field | What the rays see when they escape |

Two preset buttons (*M87\**, *Sgr A\**), a free-fall mode toggle, and a row of overlay chips (photon ring, ergosphere, ISCO, geodesic trace, coordinate grid, sub-ring decomposition).

### 3.3 · The live stats panel

Bottom-left glass panel updating in real time as sliders move, derived from analytic formulas, not from the renderer:

- Outer event horizon r₊/r_g
- Inner horizon r₋/r_g (Cauchy horizon, for Kerr–Newman)
- Ergosphere boundary at the equator
- ISCO (prograde and retrograde)
- Photon sphere radius
- Schwarzschild radius in physical units (AU, light-years)
- Hawking temperature T_H

These let an attentive student read off the geometric structure of the spacetime without needing the renderer to tell them — and let them verify visually that the renderer agrees with the analytic prediction.

### 3.4 · The free-fall mode

A separate observer mode that switches coordinates from Boyer–Lindquist (which has an artificial singularity at the horizon) to Painlevé–Gullstrand or Kerr–Schild form, which cross the horizon smoothly. The camera falls from rest at infinity along a radial geodesic. The user watches:

- The forward-cone compression of the sky (aberration).
- The blueshift of the disk and CMB diverging as proper time elapses.
- A small Carter–Penrose diagram in a corner inset tracing the worldline crossing r₊.

This is the experience version of the renderer — same physics, observer-centered. It complements the "watch from outside" mode without duplicating it.

### 3.5 · The geodesic trace

A toggle that, when active, makes any click on the rendered image throw up a small 3D inset visualizing the actual null geodesic that delivered that pixel. The student sees the path the light took: how many times it orbited, how close it came to the photon sphere, where it originated on the disk or the celestial sphere. This is the bridge between "picture of curved spacetime" and "differential equation solved per pixel."

---

## 4 · The physics, with citations

Every formula in the renderer corresponds to a published equation. The shader source carries inline citations; the project's README lists them in Chicago author-date.

| Physics | Source |
|---|---|
| Kerr metric, axisymmetric vacuum solution | Kerr (1963) |
| Boyer–Lindquist coordinate form | Boyer and Lindquist (1967) |
| Carter's constant, separability of geodesics | Carter (1968) |
| ISCO, photon sphere, locally non-rotating frames | Bardeen, Press, and Teukolsky (1972); Bardeen (1973) |
| Standard thin accretion disk model | Novikov and Thorne (1973); Thorne (1974) |
| Penrose process, ergosphere energy extraction | Penrose (1969) |
| Photon sub-ring asymptotic structure | Gralla, Holz, and Wald (2020) |
| Painlevé–Gullstrand and river model coordinates | Hamilton and Lisle (2008) |
| Schwarzschild reference | Schwarzschild (1916) |
| Benchmark Kerr + disk visualization | Bohn et al. (2015) |
| Original visualization of Schwarzschild + disk | Luminet (1979) |
| M87\* mass and shadow | Event Horizon Telescope Collaboration (2019a, 2019b) |
| M87\* spin estimate | Tamburini, Thidé, and Della Valle (2020) |
| Sgr A\* shadow and mass | Event Horizon Telescope Collaboration (2022a, 2022b) |
| *Interstellar* Gargantua rendering technique | James et al. (2015) |
| Canonical GR reference text | Misner, Thorne, and Wheeler (1973); Wald (1984) |

---

## 5 · Data sources

Almost everything in the page is *generated*, not loaded. The data the project does need is small, public, and static.

| Asset | Source | Approximate size |
|---|---|---|
| EHT M87\* total intensity image (2019) | Event Horizon Telescope Collaboration press release | < 1 MB |
| EHT M87\* polarization image (2021) | EHT Paper VII press release | < 1 MB |
| EHT Sgr A\* image (2022) | EHT 2022 press release | < 1 MB |
| EHT Sgr A\* polarization (2024 release) | EHT 2024 announcement | < 1 MB |
| Hubble eXtreme Deep Field | Space Telescope Science Institute (STScI) | ~5 MB compressed cube map |
| JWST CEERS field | STScI / JWST archive | ~5 MB |
| Milky Way panorama | ESO GigaGalaxy Zoom | ~10 MB |
| Planck CMB temperature map | ESA Planck Legacy Archive (PR4) | ~3 MB |
| Gaia DR3 star catalog (bright subset, optional) | ESA Gaia Archive | ~500 KB JSON |
| Published BH parameters (M87\*, Sgr A\*) | EHT collaboration papers | < 1 KB JSON |

Total deployment footprint: under 30 MB. Everything else — the black hole, the disk, the lensing, the Doppler shift, the shadow — is computed in-browser from the equations.

---

## 6 · Architecture

A single HTML file in the same single-file philosophy as the existing *Exoplanet Universe* project:

```
blackhole.html
├── <head>: Three.js CDN, fonts, glassmorphic CSS
├── <body>: control panels, stats, overlays
└── <script>:
    ├── Scene setup (full-screen quad, camera, uniforms)
    ├── GLSL fragment shader (the physics — ~800 lines)
    ├── Parameter → uniform binding
    ├── Preset definitions (M87*, Sgr A*)
    ├── Stats panel calculations (analytic, decoupled from renderer)
    ├── Free-fall mode coordinate switch
    └── Background asset loading
```

Performance budget:

- 720p render buffer, upscaled to display resolution.
- ~200 Cash–Karp RK steps maximum per ray, with adaptive early termination on most pixels.
- Temporal accumulation when the camera is stationary: half-resolution renders accumulate over multiple frames, full resolution snaps in when the user lets go of the controls. This is the same technique used in the *Interstellar* renderer (James et al. 2015), scaled down.
- 60 fps target on a 2024-class laptop GPU.

The page is offline-capable after first load. No server-side dependency.

---

## 7 · Scientific accuracy — the validation plan

The project succeeds or fails on whether a relativist who opens it can trust what they see. Five layers of defense:

### 7.1 · Cite equations inline

Every formula in the shader is preceded by a comment naming its source. No uncited "good enough" approximations. Where a deliberate simplification is made (e.g., thin disk vs. thick disk physics), it is documented with rationale.

### 7.2 · Analytic limit testing

Several geometric quantities have closed-form values that can be measured against the renderer's output:

| Quantity | Analytic value | Test method |
|---|---|---|
| Schwarzschild photon sphere | r = 3M | Set *a* = 0, measure shadow radius |
| Schwarzschild critical impact parameter | b_c = 3√3 M | Same |
| Schwarzschild ISCO | r = 6M | Set *a* = 0, find inner disk edge |
| Kerr prograde ISCO at *a* = 1 | r = M | Set *a* = 0.998, measure |
| Kerr retrograde ISCO at *a* = 1 | r = 9M | Same, retrograde disk |
| Energy E along null geodesic | constant | Track per ray, measure drift |
| Axial angular momentum L_z | constant | Same |
| Carter's constant Q | constant | Same — drift quantifies numerical error |

The validation suite ships in the repo as a separate page that runs the renderer, performs the measurements, and reports drift against the analytic values.

### 7.3 · Comparison against published renderings

Side-by-side comparison sheets against:

- Luminet (1979) Figure 9 — Schwarzschild + disk.
- Bohn et al. (2015) — rigorous Kerr + disk benchmark.
- Selected EHT GRMHD library images — synthetic M87\* and Sgr A\* models from the collaboration's parameter sweep.
- Hamilton's JILA visualizations.

Differences are noted and either explained (different disk model, different observer geometry) or treated as a bug to fix.

### 7.4 · Conservation-law diagnostics in the page itself

A debug overlay, hidden by default but accessible via a keyboard shortcut, shows:

- Maximum drift of E, L_z, Q along a sampled ray.
- Step-count distribution across pixels.
- Time to convergence per frame.
- Live values of all shader uniforms.

Any user — student or expert — can verify that the integration is honest. Few browser BH renderers expose this; including it makes the page self-attesting.

### 7.5 · External review

Before any public release, the draft circulates for feedback from working GR researchers. Plausible referees: gravitational physics groups at IISc, ICTS-TIFR Bangalore, IUCAA Pune. The goal is not endorsement but error-finding. Notes received become `KNOWN_LIMITATIONS.md` in the repository.

The repository is open source from the start. External corrections accumulate.

---

## 8 · Known traps and how they're handled

These are places where naive implementations fail; each gets deliberate handling:

- **Boyer–Lindquist horizon singularity.** Not a real singularity, only the coordinates failing. The free-fall observer mode switches to Kerr–Schild or Painlevé–Gullstrand coordinates which cross r₊ smoothly.
- **Accretion disk emission.** Not "arbitrary orange gradient." Uses the Novikov–Thorne *T(r)* profile, evaluates the local Planck spectrum, transports via the relativistic Doppler factor *g*, applies the *I/ν³* invariant. The colors that appear on screen are determined by *T(r)*, not artistic choice.
- **Step size near the photon sphere.** Rays can orbit many times before escaping. Fixed-step Euler loses precision catastrophically. Cash–Karp adaptive control with per-ray error tolerance.
- **Higher-order photon rings.** The *n* = 1 sub-ring is the active research frontier post-EHT (Gralla, Holz, and Wald 2020) and resolving it requires sub-pixel resolution near the critical curve. Achieved by supersampling rays with impact parameter near b_c, or by progressive accumulation when stationary.
- **Frame dragging at extremal spin.** Numerical instabilities lurk as *a* → 1. The spin slider caps at 0.998, motivated by the Thorne limit (Thorne 1974), beyond which thin-disk accretion physics caps spin-up regardless.

---

## 9 · What is deliberately out of scope

Equally important to declare:

- **No general accretion physics.** Thin-disk Novikov–Thorne only. No GRMHD, no thick disks, no jets, no radiative transfer beyond direct emission. These would require pre-rendered libraries.
- **No binary mergers, no LIGO data.** Two-body GR is a different rendering problem; binary inspirals are best visualized through dedicated tools (e.g., the SXS catalog viewer).
- **No cosmological black holes.** No de Sitter background, no embedding in expanding spacetime.
- **No quantum effects beyond displaying T_H.** Hawking radiation is shown as a number, not rendered.
- **No interior visualization.** The renderer terminates at r₊. Inside is a separate project.

These limitations are not failures; they are the boundary that lets the project ship.

---

## 10 · Phased build plan

### v0.1 — Schwarzschild proof of concept

Single static page, *a* = 0 only, no disk. Renders the shadow against a star background using full geodesic integration. Validates against Luminet (1979) and analytic photon sphere. Goal: prove the shader works and the build pipeline is sound.

### v0.5 — Kerr + disk + controls

Add spin, inclination, disk, the full control panel. Implement EHT preset buttons and image overlay. Live stats panel. Glassmorphic UI matching the *Exoplanet Universe* aesthetic. Goal: the renderer is rich, the chrome is polished, but the validation work is not yet complete.

### v1.0 — Validated and reviewed

Run the conservation-law diagnostics. Produce the side-by-side comparison sheets. Circulate to external GR specialists for review. Publish the validation suite alongside the page. Open-source the repository with full citation table.

### v1.x — Stretch

Free-fall mode with Penrose-diagram inset. Geodesic trace on click. Sub-ring decomposition. Kerr–Newman charge. WebGPU compute-shader version for resolved sub-rings.

---

## 11 · The artifact in one sentence, again

A single web page on which a curious student can spend twenty minutes pushing sliders and end up understanding gravitational lensing, frame dragging, the photon ring, and what the EHT actually photographed — while a relativist examining the same page concludes the renderer is solving the geodesic equation honestly, with cited physics and verifiable conservation laws.

---

## References

Bardeen, James M. 1973. "Timelike and Null Geodesics in the Kerr Metric." In *Black Holes (Les Houches Lectures)*, edited by C. DeWitt and B. S. DeWitt, 215–239. New York: Gordon and Breach.

Bardeen, James M., William H. Press, and Saul A. Teukolsky. 1972. "Rotating Black Holes: Locally Nonrotating Frames, Energy Extraction, and Scalar Synchrotron Radiation." *The Astrophysical Journal* 178: 347–369.

Bohn, Andy, William Throwe, François Hébert, Katherine Henriksson, Darius Bunandar, Mark A. Scheel, and Nicholas W. Taylor. 2015. "What Does a Binary Black Hole Merger Look Like?" *Classical and Quantum Gravity* 32 (6): 065002.

Boyer, Robert H., and Richard W. Lindquist. 1967. "Maximal Analytic Extension of the Kerr Metric." *Journal of Mathematical Physics* 8 (2): 265–281.

Carter, Brandon. 1968. "Global Structure of the Kerr Family of Gravitational Fields." *Physical Review* 174 (5): 1559–1571.

Event Horizon Telescope Collaboration. 2019a. "First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole." *The Astrophysical Journal Letters* 875 (1): L1.

Event Horizon Telescope Collaboration. 2019b. "First M87 Event Horizon Telescope Results. VI. The Shadow and Mass of the Central Black Hole." *The Astrophysical Journal Letters* 875 (1): L6.

Event Horizon Telescope Collaboration. 2022a. "First Sagittarius A\* Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole in the Center of the Milky Way." *The Astrophysical Journal Letters* 930 (2): L12.

Event Horizon Telescope Collaboration. 2022b. "First Sagittarius A\* Event Horizon Telescope Results. VI. Testing the Black Hole Metric." *The Astrophysical Journal Letters* 930 (2): L17.

Gralla, Samuel E., Daniel E. Holz, and Robert M. Wald. 2020. "Black Hole Shadows, Photon Rings, and Lensing Rings." *Physical Review D* 102 (12): 124003.

Hamilton, Andrew J. S., and Jason P. Lisle. 2008. "The River Model of Black Holes." *American Journal of Physics* 76 (6): 519–532.

James, Oliver, Eugénie von Tunzelmann, Paul Franklin, and Kip S. Thorne. 2015. "Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie *Interstellar*." *Classical and Quantum Gravity* 32 (6): 065001.

Kerr, Roy P. 1963. "Gravitational Field of a Spinning Mass as an Example of Algebraically Special Metrics." *Physical Review Letters* 11 (5): 237–238.

Luminet, Jean-Pierre. 1979. "Image of a Spherical Black Hole with Thin Accretion Disk." *Astronomy and Astrophysics* 75: 228–235.

Misner, Charles W., Kip S. Thorne, and John Archibald Wheeler. 1973. *Gravitation*. San Francisco: W. H. Freeman.

Novikov, Igor D., and Kip S. Thorne. 1973. "Astrophysics of Black Holes." In *Black Holes (Les Houches Lectures)*, edited by C. DeWitt and B. S. DeWitt, 343–450. New York: Gordon and Breach.

Penrose, Roger. 1969. "Gravitational Collapse: The Role of General Relativity." *Rivista del Nuovo Cimento* 1: 252–276.

Schwarzschild, Karl. 1916. "Über das Gravitationsfeld eines Massenpunktes nach der Einsteinschen Theorie." *Sitzungsberichte der Preussischen Akademie der Wissenschaften zu Berlin* 1916: 189–196.

Tamburini, Fabrizio, Bo Thidé, and Massimo Della Valle. 2020. "Measurement of the Spin of the M87 Black Hole from Its Observed Twisted Light." *Monthly Notices of the Royal Astronomical Society Letters* 492 (1): L22–L27.

Thorne, Kip S. 1974. "Disk-Accretion onto a Black Hole. II. Evolution of the Hole." *The Astrophysical Journal* 191: 507–519.

Wald, Robert M. 1984. *General Relativity*. Chicago: University of Chicago Press.
