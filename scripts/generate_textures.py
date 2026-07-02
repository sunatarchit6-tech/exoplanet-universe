#!/usr/bin/env python3
"""
Generate 166 visually distinct planet textures from 49 base images.

Uses 7 manipulation axes:
  1. Hue rotation (high impact on saturated textures)
  2. Brightness/exposure (high impact on all)
  3. Color tint (RGB channel multipliers, works on grays)
  4. Contrast (medium impact)
  5. Saturation (medium on colorful)
  6. Horizontal wrap (longitude rotation — different planetary "face")
  7. Vertical flip (hemisphere swap)

Each planet gets a base matched by class (rocky/super/neptune/gas) and temperature,
then a unique combination of transforms maximizing visual distance from siblings.
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

# ── Project paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent
OUT_DIR = ROOT / "textures" / "planets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Target output resolution (matches existing textures)
TARGET_W, TARGET_H = 2048, 1024


# ── Base texture catalog ──────────────────────────────────────────────────────
# Categorized by planet class and temperature band (cool/warm/hot)

BASE_CATALOG = {
    "rocky": {
        "cool": [   # < 400K — icy, barren
            "textures/nasa/eris.jpg",
            "textures/nasa/haumea.jpg",
            "textures/nasa/makemake.jpg",
            "textures/nasa/ceres.jpg",
            "textures/Rocky 1.jpg",
            "textures/nasa/OGLE-2005-BLG-390L_b.jpg",
            "textures/nasa/TRAPPIST-1_e.jpg",
            "textures/nasa/TRAPPIST-1_f.jpg",
            "textures/nasa/TRAPPIST-1_g.jpg",
        ],
        "warm": [   # 400–1000K — rocky, Mars/Mercury-like
            "textures/nasa/mercury.jpg",
            "textures/nasa/mars.jpg",
            "textures/Rocky 3.jpg",
            "textures/Rocky 4.jpg",
            "textures/Rocky 5.jpg",
            "textures/nasa/TRAPPIST-1_b.jpg",
            "textures/nasa/TRAPPIST-1_c.jpg",
            "textures/nasa/TRAPPIST-1_d.jpg",
            "textures/nasa/YZ_Cet_d.jpg",
            "textures/generated/CoRoT-7_b.jpg",
            "textures/generated/GJ_12_b.jpg",
        ],
        "hot": [    # > 1000K — lava worlds
            "textures/Rocky 2.jpg",
            "textures/nasa/55_Cnc_e.jpg",
            "textures/generated/Kepler-1649_c.jpg",
        ],
    },
    "super": {
        "cool": [   # < 400K — ocean worlds, thick atmospheres
            "textures/Super earth cool : water .jpg",
            "textures/super earth cool 2.jpg",
            "textures/nasa/Kepler-22_b.jpg",
            "textures/nasa/Kepler-452_b.jpg",
            "textures/nasa/Proxima_Cen_b.jpg",
            "textures/generated/TOI-715_b.jpg",
        ],
        "warm": [   # 400–1000K
            "textures/Super earth 1.jpg",
            "textures/Super earth 4.jpg",
            "textures/generated/TOI-1452_b.jpg",
            "textures/generated/Pi_Men_c.jpg",
            "textures/nasa/venus.jpg",
        ],
        "hot": [    # > 1000K
            "textures/Super earth 3.jpg",
            "textures/nasa/55_Cnc_e.jpg",
            "textures/generated/CoRoT-7_b.jpg",
        ],
    },
    "neptune": {
        "cool": [   # < 500K
            "textures/nasa/neptune.jpg",
            "textures/nasa/uranus.jpg",
            "textures/nasa/GJ_504_b.jpg",
            "textures/nasa/Kepler-7_b.jpg",
        ],
        "warm": [   # 500–1000K
            "textures/nasa/neptune.jpg",
            "textures/nasa/HAT-P-11_b.jpg",
            "textures/nasa/GJ_504_b.jpg",
            "textures/nasa/uranus.jpg",
        ],
        "hot": [    # > 1000K
            "textures/nasa/HAT-P-11_b.jpg",
            "textures/nasa/HD_189733_b.jpg",
            "textures/generated/HD_209458_b.jpg",
        ],
    },
    "gas": {
        "cool": [   # < 500K — cold gas giants
            "textures/nasa/jupiter.jpg",
            "textures/nasa/saturn.jpg",
            "textures/Gas giants 1.webp",
            "textures/Gas giants 4.jpg",
        ],
        "warm": [   # 500–1200K
            "textures/nasa/jupiter.jpg",
            "textures/Gas giant 2.jpg",
            "textures/generated/55_Cnc_b.jpg",
            "textures/generated/WASP-12_b.jpg",
        ],
        "hot": [    # > 1200K — hot Jupiters
            "textures/Gas giant hot 3.jpg",
            "textures/generated/HD_209458_b.jpg",
            "textures/generated/WASP-12_b.jpg",
            "textures/nasa/HD_189733_b.jpg",
        ],
    },
}

# ── Temperature band classification ───────────────────────────────────────────
TEMP_BANDS = {
    "rocky":   {"cool": (0, 400), "warm": (400, 1000), "hot": (1000, 9999)},
    "super":   {"cool": (0, 400), "warm": (400, 1000), "hot": (1000, 9999)},
    "neptune": {"cool": (0, 500), "warm": (500, 1000), "hot": (1000, 9999)},
    "gas":     {"cool": (0, 500), "warm": (500, 1200), "hot": (1200, 9999)},
}


def get_temp_band(cls, temp):
    bands = TEMP_BANDS[cls]
    for band, (lo, hi) in bands.items():
        if lo <= temp < hi:
            return band
    return "warm"  # fallback


# ── Transform functions (all preserve resolution) ─────────────────────────────

def hue_shift(img, degrees):
    """Rotate hue by `degrees` (0-360). Preserves luminance structure."""
    if degrees == 0:
        return img
    hsv = img.convert("HSV")
    h, s, v = hsv.split()
    h_arr = np.array(h, dtype=np.int16)
    h_arr = ((h_arr + int(degrees * 256 / 360)) % 256).astype(np.uint8)
    return Image.merge("HSV", (Image.fromarray(h_arr), s, v)).convert("RGB")


def horizontal_wrap(img, fraction):
    """Shift texture horizontally by `fraction` of width (0.0 to 1.0)."""
    if fraction == 0:
        return img
    arr = np.array(img)
    shift = int(arr.shape[1] * fraction)
    return Image.fromarray(np.roll(arr, shift, axis=1))


def vertical_flip(img):
    """Flip top/bottom — shows opposite hemisphere."""
    return img.transpose(Image.FLIP_TOP_BOTTOM)


def apply_tint(img, r_mult, g_mult, b_mult):
    """Per-channel color multiplication. Works on gray textures."""
    arr = np.array(img, dtype=np.float32)
    arr[:, :, 0] *= r_mult
    arr[:, :, 1] *= g_mult
    arr[:, :, 2] *= b_mult
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def apply_brightness(img, factor):
    """Adjust brightness. 1.0 = unchanged."""
    return ImageEnhance.Brightness(img).enhance(factor)


def apply_contrast(img, factor):
    """Adjust contrast. 1.0 = unchanged."""
    return ImageEnhance.Contrast(img).enhance(factor)


def apply_saturation(img, factor):
    """Adjust color saturation. 1.0 = unchanged, 0.0 = grayscale."""
    return ImageEnhance.Color(img).enhance(factor)


# ── Scientifically plausible transformation presets ───────────────────────────
# Real exoplanet colors are constrained by physics/chemistry:
#   Rocky: grays, browns, reds, oranges, tans (regolith, iron oxide, silicates)
#   Super-Earth: blues (ocean), white (ice/clouds), tan, brown, orange-red
#   Neptune-like: blues, teals, cyan, blue-gray, pale green-blue (methane/H2)
#   Gas giant: oranges, browns, tans, whites, reds, deep blues (ammonia, methane)

# Per-class hue ranges (degrees) — only physically plausible colors
# Each list contains hue offsets that produce realistic planet colors
# Hue steps MUST account for the base texture's existing color.
# Blue bases (neptune, uranus) + hue 120-180 → green (BAD).
# Warm bases (jupiter, saturn) + hue 180-240 → green (BAD).
# Safe approach: only small rotations (±30°) to stay in the same color family,
# plus large jumps that land in known-good territory.
CLASS_HUE_STEPS = {
    "rocky": [0, 5, 10, 350, 345, 340, 15, 335, 20, 330, 25, 320],  # reds, oranges, warm grays
    "super": [0, 5, 350, 10, 340, 15, 345, 20, 335, 25, 330, 355],  # keep base color family
    "neptune": [0, 5, 355, 10, 350, 15, 345, 20, 340, 25, 335, 30],  # stay blue — no green
    "gas": [0, 5, 355, 10, 350, 15, 345, 20, 340, 25, 335, 30],  # stay in warm family
}

# Per-class tint palettes — only colors that real planets exhibit
CLASS_TINTS = {
    "rocky": [
        ("regolith",  1.15, 1.00, 0.85),   # gray-brown
        ("iron",      1.35, 0.85, 0.65),   # rusty red
        ("basalt",    0.85, 0.85, 0.90),   # dark gray-blue
        ("sandstone", 1.30, 1.10, 0.75),   # tan
        ("granite",   1.05, 0.95, 0.90),   # warm gray
        ("obsidian",  0.80, 0.78, 0.82),   # dark cool gray
        ("ochre",     1.40, 1.00, 0.55),   # deep orange
        ("ash",       0.90, 0.88, 0.85),   # pale gray
        ("terracotta",1.35, 0.80, 0.55),   # red-brown
        ("slate",     0.82, 0.84, 0.92),   # blue-gray
        ("dust",      1.20, 1.05, 0.80),   # dusty tan
        ("pumice",    1.10, 1.08, 1.00),   # light warm
    ],
    "super": [
        ("ocean",     0.60, 0.85, 1.40),   # deep ocean blue
        ("ice",       0.85, 0.95, 1.15),   # icy pale blue
        ("cloud",     1.10, 1.08, 1.05),   # white-warm clouds
        ("terran",    0.75, 0.90, 1.20),   # Earth-like blue
        ("steam",     1.05, 1.00, 0.90),   # warm haze
        ("tundra",    0.80, 0.92, 1.05),   # cold blue-gray
        ("magma",     1.40, 0.75, 0.50),   # volcanic red
        ("copper",    1.25, 0.90, 0.70),   # warm copper
        ("arctic",    0.90, 1.00, 1.15),   # cold blue-white
        ("sulfur",    1.20, 1.15, 0.65),   # yellow-tan
        ("limestone", 1.15, 1.10, 0.95),   # pale warm
        ("coral",     1.30, 0.85, 0.75),   # orange-pink
    ],
    "neptune": [
        ("methane",   0.55, 0.80, 1.40),   # deep methane blue
        ("teal",      0.60, 1.10, 1.15),   # teal
        ("ice_giant", 0.70, 0.90, 1.30),   # Uranus-like pale blue
        ("azure",     0.50, 0.75, 1.45),   # vivid blue
        ("cyan",      0.55, 1.05, 1.25),   # cyan
        ("storm",     0.75, 0.82, 1.10),   # stormy gray-blue
        ("haze",      0.80, 0.88, 1.05),   # hazy blue-gray
        ("deep_blue", 0.45, 0.65, 1.35),   # very deep blue
        ("neptune",   0.50, 0.70, 1.40),   # Neptune-like
        ("aqua",      0.60, 1.00, 1.20),   # aquamarine
        ("cobalt",    0.55, 0.70, 1.30),   # cobalt blue
        ("frost",     0.75, 0.92, 1.15),   # frosty blue
    ],
    "gas": [
        ("jupiter",   1.25, 1.05, 0.70),   # Jupiter tan-orange
        ("saturn",    1.30, 1.15, 0.75),   # Saturn gold
        ("banded",    1.15, 0.95, 0.75),   # warm banded
        ("storm",     1.10, 0.85, 0.65),   # red storm
        ("cream",     1.15, 1.10, 0.95),   # cream white
        ("rust",      1.35, 0.80, 0.55),   # deep rust
        ("hot_blue",  0.60, 0.75, 1.35),   # hot Jupiter blue
        ("smog",      0.90, 0.85, 0.78),   # brown smog
        ("amber",     1.35, 1.00, 0.55),   # deep amber
        ("charcoal",  0.80, 0.78, 0.75),   # dark gray
        ("bronze",    1.25, 0.95, 0.65),   # bronze
        ("ash",       0.88, 0.86, 0.85),   # pale gray
    ],
}

# Shared across all classes
BRIGHTNESS_LEVELS = [0.62, 0.74, 0.86, 0.98, 1.10, 1.25, 1.42, 1.60]
CONTRAST_LEVELS = [0.65, 0.80, 1.0, 1.22, 1.48]
SATURATION_LEVELS = [0.25, 0.55, 0.85, 1.15, 1.50, 1.85]

# ── Curated overrides for well-known planets with documented colors ──────────
# These planets have observed/modelled colors from published research.
# Format: planet_name -> (base_path, fixed_recipe)
# The recipe skips random generation entirely.
PLANET_OVERRIDES = {
    # HD 189733 b: first exoplanet with measured color — deep cobalt blue
    # (Albedo measurements by Hubble, Evans et al. 2013)
    "HD 189733 b": {
        "base": "textures/nasa/HD_189733_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.95, "tint": (0.50, 0.65, 1.40),
                   "tint_name": "cobalt", "contrast": 1.15, "saturation": 1.60,
                   "wrap": 0.0, "flip": False},
    },
    # GJ 504 b: "pink Jupiter" — directly imaged, magenta/pink
    # (Kuzuhara et al. 2013)
    "GJ 504 b": {
        "base": "textures/nasa/GJ_504_b.jpg",
        "recipe": {"hue": 0, "brightness": 1.0, "tint": (1.20, 0.75, 0.95),
                   "tint_name": "pink", "contrast": 1.10, "saturation": 1.30,
                   "wrap": 0.0, "flip": False},
    },
    # TRAPPIST-1 e: best HZ candidate, likely temperate — gray-blue rocky
    "TRAPPIST-1 e": {
        "base": "textures/nasa/TRAPPIST-1_e.jpg",
        "recipe": {"hue": 0, "brightness": 0.90, "tint": (0.85, 0.90, 1.10),
                   "tint_name": "temperate", "contrast": 1.10, "saturation": 0.80,
                   "wrap": 0.0, "flip": False},
    },
    # TRAPPIST-1 b: hot inner planet — dark reddish rocky
    "TRAPPIST-1 b": {
        "base": "textures/nasa/TRAPPIST-1_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.85, "tint": (1.15, 0.90, 0.80),
                   "tint_name": "warm_rock", "contrast": 1.15, "saturation": 0.90,
                   "wrap": 0.0, "flip": False},
    },
    # 55 Cnc e: lava world — dark with glowing orange/red
    "55 Cnc e": {
        "base": "textures/nasa/55_Cnc_e.jpg",
        "recipe": {"hue": 0, "brightness": 0.88, "tint": (1.25, 0.85, 0.65),
                   "tint_name": "lava", "contrast": 1.25, "saturation": 1.40,
                   "wrap": 0.0, "flip": False},
    },
    # Kepler-452 b: "Earth's cousin" — should look Earth-like (blue-green-tan)
    "Kepler-452 b": {
        "base": "textures/nasa/Kepler-452_b.jpg",
        "recipe": {"hue": 0, "brightness": 1.05, "tint": (0.80, 0.95, 1.15),
                   "tint_name": "earthlike", "contrast": 1.20, "saturation": 1.30,
                   "wrap": 0.0, "flip": False},
    },
    # Proxima Cen b: nearest exoplanet — temperate rocky
    "Proxima Cen b": {
        "base": "textures/nasa/Proxima_Cen_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.92, "tint": (1.05, 0.95, 0.88),
                   "tint_name": "warm_rock", "contrast": 1.10, "saturation": 0.85,
                   "wrap": 0.0, "flip": False},
    },
    # HAT-P-7 b: ultra-hot Jupiter — should look like a gas giant, not rocky
    "HAT-P-7 b": {
        "base": "textures/Gas giant hot 3.jpg",
        "recipe": {"hue": 5, "brightness": 0.85, "tint": (1.20, 0.90, 0.65),
                   "tint_name": "hot_giant", "contrast": 1.20, "saturation": 1.20,
                   "wrap": 0.3, "flip": False},
    },
    # Beta Pic b: young directly-imaged gas giant — warm reddish
    "Beta Pic b": {
        "base": "textures/nasa/jupiter.jpg",
        "recipe": {"hue": 350, "brightness": 0.90, "tint": (1.30, 0.90, 0.65),
                   "tint_name": "young_giant", "contrast": 1.15, "saturation": 1.20,
                   "wrap": 0.2, "flip": False},
    },
    # HR 8799 b/c/d/e: directly imaged system — warm red-brown gas giants
    # Each uses a DIFFERENT base to ensure visual distinction in the same system
    "HR 8799 b": {
        "base": "textures/nasa/jupiter.jpg",
        "recipe": {"hue": 355, "brightness": 0.78, "tint": (1.20, 0.82, 0.55),
                   "tint_name": "warm_giant", "contrast": 1.18, "saturation": 1.05,
                   "wrap": 0.0, "flip": False},
    },
    "HR 8799 c": {
        "base": "textures/nasa/saturn.jpg",
        "recipe": {"hue": 350, "brightness": 0.82, "tint": (1.30, 0.95, 0.62),
                   "tint_name": "golden_giant", "contrast": 1.15, "saturation": 1.20,
                   "wrap": 0.3, "flip": True},
    },
    "HR 8799 d": {
        "base": "textures/Gas giant 2.jpg",
        "recipe": {"hue": 5, "brightness": 0.75, "tint": (1.15, 0.85, 0.68),
                   "tint_name": "dusty_giant", "contrast": 1.22, "saturation": 1.00,
                   "wrap": 0.5, "flip": False},
    },
    "HR 8799 e": {
        "base": "textures/Gas giants 4.jpg",
        "recipe": {"hue": 350, "brightness": 0.85, "tint": (1.25, 0.90, 0.58),
                   "tint_name": "deep_giant", "contrast": 1.15, "saturation": 1.15,
                   "wrap": 0.65, "flip": True},
    },
    # WASP-12 b: ultra-hot Jupiter — actually very dark (absorbs 94% of light)
    "WASP-12 b": {
        "base": "textures/generated/WASP-12_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.68, "tint": (1.10, 0.85, 0.70),
                   "tint_name": "dark_hot", "contrast": 1.30, "saturation": 0.80,
                   "wrap": 0.0, "flip": False},
    },
    # GJ 436 b: warm Neptune — should be blue/teal (base is already blue, no hue shift)
    "GJ 436 b": {
        "base": "textures/nasa/neptune.jpg",
        "recipe": {"hue": 0, "brightness": 0.92, "tint": (0.70, 0.85, 1.25),
                   "tint_name": "warm_neptune", "contrast": 1.15, "saturation": 1.30,
                   "wrap": 0.15, "flip": False},
    },
    # Kepler-16 b: circumbinary gas giant — Saturn-like
    "Kepler-16 b": {
        "base": "textures/nasa/saturn.jpg",
        "recipe": {"hue": 0, "brightness": 0.95, "tint": (1.20, 1.10, 0.80),
                   "tint_name": "saturn_like", "contrast": 1.10, "saturation": 1.10,
                   "wrap": 0.35, "flip": False},
    },
    # K2-182 b: super-Earth — guard-persistent green, force to ocean world
    "K2-182 b": {
        "base": "textures/nasa/Kepler-22_b.jpg",
        "recipe": {"hue": 0, "brightness": 1.05, "tint": (0.75, 0.88, 1.20),
                   "tint_name": "ocean", "contrast": 1.15, "saturation": 1.10,
                   "wrap": 0.4, "flip": True},
    },
    # Kepler-62 e: super-Earth in HZ — Earth-like blue-brown
    "Kepler-62 e": {
        "base": "textures/nasa/Proxima_Cen_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.95, "tint": (0.80, 0.90, 1.15),
                   "tint_name": "terran", "contrast": 1.20, "saturation": 1.10,
                   "wrap": 0.6, "flip": False},
    },
    # Kepler-38 b: circumbinary Neptune — too dark, force blue
    "Kepler-38 b": {
        "base": "textures/nasa/neptune.jpg",
        "recipe": {"hue": 5, "brightness": 0.88, "tint": (0.65, 0.82, 1.25),
                   "tint_name": "neptune", "contrast": 1.15, "saturation": 1.20,
                   "wrap": 0.55, "flip": True},
    },
    # CoRoT-5 b: hot Jupiter — warm banded, not green
    "CoRoT-5 b": {
        "base": "textures/nasa/jupiter.jpg",
        "recipe": {"hue": 350, "brightness": 0.85, "tint": (1.20, 0.95, 0.70),
                   "tint_name": "banded", "contrast": 1.20, "saturation": 1.15,
                   "wrap": 0.4, "flip": True},
    },
    # TOI-1266 c: super-Earth — blue-gray, not green
    "TOI-1266 c": {
        "base": "textures/Super earth 1.jpg",
        "recipe": {"hue": 0, "brightness": 0.90, "tint": (0.85, 0.90, 1.10),
                   "tint_name": "cool_super", "contrast": 1.15, "saturation": 0.90,
                   "wrap": 0.3, "flip": False},
    },
    # TRAPPIST-1 c: inner rocky — warm gray-tan
    "TRAPPIST-1 c": {
        "base": "textures/nasa/TRAPPIST-1_c.jpg",
        "recipe": {"hue": 0, "brightness": 0.90, "tint": (1.10, 0.95, 0.85),
                   "tint_name": "warm_rock", "contrast": 1.15, "saturation": 0.85,
                   "wrap": 0.0, "flip": False},
    },
    # HAT-P-20 b: massive hot Jupiter — use dark gas giant base
    "HAT-P-20 b": {
        "base": "textures/Gas giants 4.jpg",
        "recipe": {"hue": 5, "brightness": 0.75, "tint": (1.20, 0.90, 0.65),
                   "tint_name": "warm_giant", "contrast": 1.25, "saturation": 1.15,
                   "wrap": 0.35, "flip": False},
    },
    # HD 23472 b: super-Earth — too bright, darken
    "HD 23472 b": {
        "base": "textures/Super earth 4.jpg",
        "recipe": {"hue": 355, "brightness": 0.82, "tint": (1.05, 0.95, 0.88),
                   "tint_name": "warm_rock", "contrast": 1.20, "saturation": 1.00,
                   "wrap": 0.5, "flip": True},
    },
    # TOI-1266 b: sub-Neptune — blue-gray, not blown out
    "TOI-1266 b": {
        "base": "textures/nasa/uranus.jpg",
        "recipe": {"hue": 0, "brightness": 0.85, "tint": (0.75, 0.88, 1.15),
                   "tint_name": "ice_giant", "contrast": 1.20, "saturation": 1.10,
                   "wrap": 0.45, "flip": True},
    },
    # TOI-2095 c: small rocky — dusty warm, not blown-out white
    "TOI-2095 c": {
        "base": "textures/nasa/mars.jpg",
        "recipe": {"hue": 5, "brightness": 0.88, "tint": (1.15, 1.00, 0.80),
                   "tint_name": "dusty", "contrast": 1.20, "saturation": 1.10,
                   "wrap": 0.6, "flip": True},
    },
    # WISEP J121756.91+162640.2 A b: free-floating gas giant — dark, cool
    "WISEP J121756.91+162640.2 A b": {
        "base": "textures/Gas giants 4.jpg",
        "recipe": {"hue": 350, "brightness": 0.70, "tint": (0.90, 0.85, 0.95),
                   "tint_name": "dark_giant", "contrast": 1.25, "saturation": 0.80,
                   "wrap": 0.7, "flip": False},
    },
    # GJ 1132 b: rocky — warm, Mars-like
    "GJ 1132 b": {
        "base": "textures/nasa/mars.jpg",
        "recipe": {"hue": 355, "brightness": 0.85, "tint": (1.20, 0.92, 0.75),
                   "tint_name": "regolith", "contrast": 1.18, "saturation": 1.05,
                   "wrap": 0.25, "flip": False},
    },
    # HD 219134 d: rocky — basalt gray
    "HD 219134 d": {
        "base": "textures/nasa/mercury.jpg",
        "recipe": {"hue": 0, "brightness": 0.82, "tint": (0.95, 0.92, 0.90),
                   "tint_name": "basalt", "contrast": 1.15, "saturation": 0.85,
                   "wrap": 0.55, "flip": True},
    },
    # ── Fixes from texture-classification audit (2026-03-22) ──────────────────
    # 55 Cnc b: gas giant (13 Re, 0.87 Mj) — was getting rocky texture
    "55 Cnc b": {
        "base": "textures/nasa/saturn.jpg",
        "recipe": {"hue": 5, "brightness": 0.88, "tint": (1.25, 1.05, 0.72),
                   "tint_name": "saturn_warm", "contrast": 1.15, "saturation": 1.15,
                   "wrap": 0.45, "flip": False},
    },
    # GJ 357 d: super-Earth in HZ (2.34 Re, 219K) — ocean/HZ world, not frozen rocky
    "GJ 357 d": {
        "base": "textures/Super earth cool : water .jpg",
        "recipe": {"hue": 0, "brightness": 0.92, "tint": (0.70, 0.88, 1.25),
                   "tint_name": "ocean", "contrast": 1.15, "saturation": 1.20,
                   "wrap": 0.3, "flip": False},
    },
    # GJ 667C c: super-Earth in HZ (1.8 Re, 277K) — ocean world
    "GJ 667C c": {
        "base": "textures/super earth cool 2.jpg",
        "recipe": {"hue": 0, "brightness": 0.95, "tint": (0.72, 0.90, 1.20),
                   "tint_name": "ocean", "contrast": 1.12, "saturation": 1.15,
                   "wrap": 0.5, "flip": True},
    },
    # GJ 832 c: super-Earth in HZ (1.72 Re, 253K) — ocean world
    "GJ 832 c": {
        "base": "textures/nasa/Kepler-22_b.jpg",
        "recipe": {"hue": 5, "brightness": 0.90, "tint": (0.75, 0.92, 1.18),
                   "tint_name": "ocean", "contrast": 1.15, "saturation": 1.10,
                   "wrap": 0.65, "flip": False},
    },
    # HD 40307 g: super-Earth in HZ (2.5 Re, 226K) — ocean world
    "HD 40307 g": {
        "base": "textures/Super earth cool : water .jpg",
        "recipe": {"hue": 355, "brightness": 0.88, "tint": (0.68, 0.85, 1.22),
                   "tint_name": "deep_ocean", "contrast": 1.18, "saturation": 1.25,
                   "wrap": 0.7, "flip": True},
    },
    # Tau Cet e: super-Earth in HZ (2.0 Re, 286K) — ocean world
    "Tau Cet e": {
        "base": "textures/super earth cool 2.jpg",
        "recipe": {"hue": 0, "brightness": 0.92, "tint": (0.75, 0.90, 1.15),
                   "tint_name": "terran", "contrast": 1.15, "saturation": 1.10,
                   "wrap": 0.35, "flip": False},
    },
    # Wolf 1061 c: super-Earth in HZ (1.61 Re, 270K) — ocean world
    "Wolf 1061 c": {
        "base": "textures/nasa/Kepler-452_b.jpg",
        "recipe": {"hue": 355, "brightness": 0.90, "tint": (0.78, 0.92, 1.15),
                   "tint_name": "terran", "contrast": 1.18, "saturation": 1.15,
                   "wrap": 0.55, "flip": True},
    },
    # Pi Men c: super-Earth hot (2.06 Re, 1154K) — hot super-Earth, not rocky
    "Pi Men c": {
        "base": "textures/Super earth 3.jpg",
        "recipe": {"hue": 5, "brightness": 0.85, "tint": (1.20, 0.88, 0.65),
                   "tint_name": "hot_super", "contrast": 1.20, "saturation": 1.10,
                   "wrap": 0.4, "flip": False},
    },
    # GJ 12 b: rocky HZ world (1.02 Re, 270K) — cool temperate, not hot
    "GJ 12 b": {
        "base": "textures/nasa/TRAPPIST-1_e.jpg",
        "recipe": {"hue": 0, "brightness": 0.88, "tint": (0.90, 0.92, 1.05),
                   "tint_name": "temperate", "contrast": 1.12, "saturation": 0.85,
                   "wrap": 0.3, "flip": False},
    },
    # TRAPPIST-1 g: rocky HZ world (1.13 Re, 200K) — outermost, coldest, icy
    "TRAPPIST-1 g": {
        "base": "textures/nasa/TRAPPIST-1_g.jpg",
        "recipe": {"hue": 0, "brightness": 0.72, "tint": (0.78, 0.82, 1.15),
                   "tint_name": "icy_rock", "contrast": 1.18, "saturation": 0.65,
                   "wrap": 0.0, "flip": False},
    },
    # TRAPPIST-1 f: rocky HZ world (1.04 Re, 219K) — cool temperate
    "TRAPPIST-1 f": {
        "base": "textures/nasa/TRAPPIST-1_f.jpg",
        "recipe": {"hue": 0, "brightness": 0.88, "tint": (0.85, 0.90, 1.10),
                   "tint_name": "cool_rock", "contrast": 1.12, "saturation": 0.82,
                   "wrap": 0.0, "flip": False},
    },
    # Teegarden b: rocky HZ world (1.05 Re, 257K) — temperate
    "Teegarden b": {
        "base": "textures/nasa/TRAPPIST-1_e.jpg",
        "recipe": {"hue": 5, "brightness": 0.90, "tint": (0.92, 0.95, 1.05),
                   "tint_name": "temperate", "contrast": 1.10, "saturation": 0.88,
                   "wrap": 0.5, "flip": True},
    },
    # Teegarden c: rocky frozen (1.11 Re, 181K) — cold icy
    "Teegarden c": {
        "base": "textures/nasa/eris.jpg",
        "recipe": {"hue": 0, "brightness": 0.85, "tint": (0.85, 0.92, 1.12),
                   "tint_name": "icy", "contrast": 1.15, "saturation": 0.75,
                   "wrap": 0.4, "flip": False},
    },
    # Kepler-442 b: rocky HZ world (1.34 Re, 233K) — temperate rocky
    "Kepler-442 b": {
        "base": "textures/nasa/TRAPPIST-1_e.jpg",
        "recipe": {"hue": 350, "brightness": 0.92, "tint": (0.88, 0.92, 1.08),
                   "tint_name": "temperate", "contrast": 1.15, "saturation": 0.90,
                   "wrap": 0.65, "flip": False},
    },
    # Kepler-62 f: rocky HZ world (1.41 Re, 208K) — cold temperate
    "Kepler-62 f": {
        "base": "textures/nasa/TRAPPIST-1_f.jpg",
        "recipe": {"hue": 5, "brightness": 0.88, "tint": (0.85, 0.90, 1.10),
                   "tint_name": "cool_rock", "contrast": 1.12, "saturation": 0.85,
                   "wrap": 0.7, "flip": True},
    },
    # TOI-715 b: rocky HZ world (1.55 Re, 234K) — temperate rocky
    "TOI-715 b": {
        "base": "textures/nasa/Proxima_Cen_b.jpg",
        "recipe": {"hue": 0, "brightness": 0.90, "tint": (0.82, 0.90, 1.12),
                   "tint_name": "temperate", "contrast": 1.15, "saturation": 1.00,
                   "wrap": 0.45, "flip": False},
    },
    # HD 209458 b: iconic hot Jupiter (15.58 Re, 1130K) — hot gas giant
    "HD 209458 b": {
        "base": "textures/Gas giant hot 3.jpg",
        "recipe": {"hue": 5, "brightness": 0.82, "tint": (1.25, 0.92, 0.65),
                   "tint_name": "hot_giant", "contrast": 1.20, "saturation": 1.15,
                   "wrap": 0.3, "flip": False},
    },
    # HD 189733 b already has an override (cobalt blue — correct)
    # ── Same-system differentiation overrides (2026-03-22) ────────────────────
    # Kepler-278 system: two warm neptunes — use different ice giant bases
    "Kepler-278 b": {
        "base": "textures/nasa/neptune.jpg",
        "recipe": {"hue": 5, "brightness": 0.85, "tint": (0.60, 0.80, 1.30),
                   "tint_name": "deep_blue", "contrast": 1.18, "saturation": 1.25,
                   "wrap": 0.2, "flip": False},
    },
    "Kepler-278 c": {
        "base": "textures/nasa/uranus.jpg",
        "recipe": {"hue": 350, "brightness": 0.90, "tint": (0.65, 1.05, 1.15),
                   "tint_name": "teal", "contrast": 1.12, "saturation": 1.10,
                   "wrap": 0.6, "flip": True},
    },
    # TOI-421 system: hot super-Earth + warm neptune — different class textures
    "TOI-421 b": {
        "base": "textures/Super earth 3.jpg",
        "recipe": {"hue": 5, "brightness": 0.82, "tint": (1.25, 0.90, 0.65),
                   "tint_name": "hot_super", "contrast": 1.22, "saturation": 1.15,
                   "wrap": 0.35, "flip": False},
    },
    "TOI-421 c": {
        "base": "textures/nasa/neptune.jpg",
        "recipe": {"hue": 0, "brightness": 0.88, "tint": (0.55, 0.78, 1.35),
                   "tint_name": "methane", "contrast": 1.15, "saturation": 1.30,
                   "wrap": 0.5, "flip": True},
    },
    # HD 23472 system: two warm super-Earths — different surface types
    "HD 23472 b": {
        "base": "textures/Super earth 4.jpg",
        "recipe": {"hue": 355, "brightness": 0.80, "tint": (1.15, 0.92, 0.78),
                   "tint_name": "warm_rock", "contrast": 1.20, "saturation": 1.05,
                   "wrap": 0.4, "flip": True},
    },
    "HD 23472 c": {
        "base": "textures/nasa/venus.jpg",
        "recipe": {"hue": 5, "brightness": 0.88, "tint": (1.10, 1.00, 0.85),
                   "tint_name": "venus_like", "contrast": 1.15, "saturation": 0.95,
                   "wrap": 0.7, "flip": False},
    },
    # K2-3 system: two cool rocky worlds — icy vs temperate
    "K2-3 c": {
        "base": "textures/nasa/mars.jpg",
        "recipe": {"hue": 350, "brightness": 0.88, "tint": (1.20, 0.95, 0.75),
                   "tint_name": "dusty", "contrast": 1.18, "saturation": 1.10,
                   "wrap": 0.3, "flip": False},
    },
    "K2-3 d": {
        "base": "textures/nasa/TRAPPIST-1_e.jpg",
        "recipe": {"hue": 0, "brightness": 0.90, "tint": (0.88, 0.92, 1.08),
                   "tint_name": "temperate", "contrast": 1.12, "saturation": 0.85,
                   "wrap": 0.55, "flip": True},
    },
    # HD 136352 system: hot super-Earth vs warm super-Earth
    "HD 136352 b": {
        "base": "textures/nasa/55_Cnc_e.jpg",
        "recipe": {"hue": 5, "brightness": 0.85, "tint": (1.30, 0.85, 0.60),
                   "tint_name": "lava", "contrast": 1.25, "saturation": 1.20,
                   "wrap": 0.25, "flip": False},
    },
    "HD 136352 d": {
        "base": "textures/Super earth 1.jpg",
        "recipe": {"hue": 350, "brightness": 0.92, "tint": (0.90, 0.95, 1.08),
                   "tint_name": "cool_super", "contrast": 1.12, "saturation": 0.90,
                   "wrap": 0.6, "flip": True},
    },
    # TOI-125 system: two hot super-Earths — different surfaces
    "TOI-125 c": {
        "base": "textures/Super earth 3.jpg",
        "recipe": {"hue": 350, "brightness": 0.85, "tint": (1.20, 0.88, 0.68),
                   "tint_name": "hot_rock", "contrast": 1.20, "saturation": 1.10,
                   "wrap": 0.3, "flip": True},
    },
    "TOI-125 d": {
        "base": "textures/nasa/venus.jpg",
        "recipe": {"hue": 5, "brightness": 0.82, "tint": (1.10, 1.05, 0.82),
                   "tint_name": "venus_warm", "contrast": 1.18, "saturation": 1.00,
                   "wrap": 0.65, "flip": False},
    },
    # L 98-59 system: two hot rocky worlds — lava vs scorched
    "L 98-59 b": {
        "base": "textures/nasa/55_Cnc_e.jpg",
        "recipe": {"hue": 0, "brightness": 0.80, "tint": (1.35, 0.82, 0.55),
                   "tint_name": "lava", "contrast": 1.28, "saturation": 1.30,
                   "wrap": 0.15, "flip": False},
    },
    "L 98-59 c": {
        "base": "textures/nasa/mercury.jpg",
        "recipe": {"hue": 5, "brightness": 0.85, "tint": (1.10, 0.95, 0.85),
                   "tint_name": "scorched", "contrast": 1.20, "saturation": 0.90,
                   "wrap": 0.5, "flip": True},
    },
}


def _halton(index, base):
    """Halton quasi-random sequence value in [0, 1) for better space-filling."""
    result = 0.0
    f = 1.0 / base
    i = index + 1  # 1-based to avoid 0
    while i > 0:
        result += f * (i % base)
        i //= base
        f /= base
    return result


def generate_transform_recipe(index, total_siblings, planet_class="rocky"):
    """
    Generate a unique transformation recipe using class-specific palettes.
    Only produces scientifically plausible colors for each planet type.
    """
    # Halton sequences with different prime bases → uncorrelated axes
    h_hue  = _halton(index, 2)
    h_brt  = _halton(index, 3)
    h_tint = _halton(index, 5)
    h_con  = _halton(index, 7)
    h_sat  = _halton(index, 11)
    h_wrap = _halton(index, 13)
    h_flip = _halton(index, 17)

    hue_steps = CLASS_HUE_STEPS[planet_class]
    tint_list = CLASS_TINTS[planet_class]

    hue = hue_steps[int(h_hue * len(hue_steps)) % len(hue_steps)]
    bright = BRIGHTNESS_LEVELS[int(h_brt * len(BRIGHTNESS_LEVELS)) % len(BRIGHTNESS_LEVELS)]
    tint_entry = tint_list[int(h_tint * len(tint_list)) % len(tint_list)]
    tint_name = tint_entry[0]
    tint = (tint_entry[1], tint_entry[2], tint_entry[3])
    contrast = CONTRAST_LEVELS[int(h_con * len(CONTRAST_LEVELS)) % len(CONTRAST_LEVELS)]
    saturation = SATURATION_LEVELS[int(h_sat * len(SATURATION_LEVELS)) % len(SATURATION_LEVELS)]
    wrap = h_wrap   # continuous [0, 1)
    flip = h_flip > 0.5

    return {
        "hue": hue,
        "brightness": bright,
        "tint": tint,
        "tint_name": tint_name,
        "contrast": contrast,
        "saturation": saturation,
        "wrap": wrap,
        "flip": flip,
    }


def apply_recipe(img, recipe):
    """Apply a full transformation recipe to an image."""
    result = img.copy()

    # 1. Horizontal wrap (structural change — do first)
    result = horizontal_wrap(result, recipe["wrap"])

    # 2. Vertical flip
    if recipe["flip"]:
        result = vertical_flip(result)

    # 3. Hue rotation (constrained to plausible range per class)
    result = hue_shift(result, recipe["hue"])

    # 4. Color tint (class-specific palette)
    r, g, b = recipe["tint"]
    result = apply_tint(result, r, g, b)

    # 5. Saturation
    result = apply_saturation(result, recipe["saturation"])

    # 6. Contrast
    result = apply_contrast(result, recipe["contrast"])

    # 7. Brightness (do last — final exposure)
    result = apply_brightness(result, recipe["brightness"])

    return result


# ── Load base images with caching ─────────────────────────────────────────────
_base_cache = {}

def load_base(path):
    """Load and resize base texture to target resolution. Cached."""
    path_str = str(path)
    if path_str not in _base_cache:
        img = Image.open(ROOT / path_str).convert("RGB")
        if img.size != (TARGET_W, TARGET_H):
            img = img.resize((TARGET_W, TARGET_H), Image.LANCZOS)
        _base_cache[path_str] = img
    return _base_cache[path_str]


# ── Parse planet data ─────────────────────────────────────────────────────────

def parse_planets():
    """Extract planet list, classes, and temperatures from project files."""

    # Load NASA data for radius/temp lookup
    with open(ROOT / "nasa_data.json") as f:
        nasa = json.load(f)
    nasa_lookup = {p["n"]: p for p in nasa}

    # Parse HTML for PLANET_TEX and NAMED
    with open(ROOT / "exoplanet_3d.html") as f:
        html = f.read()

    # Extract PLANET_TEX entries
    match = re.search(r"const PLANET_TEX=\{(.*?)\};", html, re.DOTALL)
    tex_block = match.group(1)
    planets = {}
    for m in re.finditer(r"'([^']+)'\s*:\s*'([^']+)'", tex_block):
        planets[m.group(1)] = m.group(2)

    # Extract NAMED data for original 46 (supports both single and double quotes)
    named_data = {}
    for m in re.finditer(
        r"""\["([^"]+)",([0-9.]+),(-?[0-9.]+),([0-9.]+),(\d+),"([^"]+)",([0-9.]+),([0-9.]+),([01])\]""",
        html,
    ):
        name = m.group(1)
        radius = float(m.group(7))
        temp = float(m.group(8))
        named_data[name] = {"radius": radius, "temp": temp}

    def planet_class(r):
        if r < 1.6:
            return "rocky"
        if r < 3.0:
            return "super"
        if r < 8.0:
            return "neptune"
        return "gas"

    # Build info for all 166
    result = {}
    for name, texfile in planets.items():
        if name in named_data:
            r = named_data[name]["radius"]
            t = named_data[name]["temp"]
        elif name in nasa_lookup:
            r = nasa_lookup[name].get("R", 1.5)
            t = nasa_lookup[name].get("T", 500)
        else:
            r, t = 1.5, 500

        cls = planet_class(r)
        band = get_temp_band(cls, t)
        result[name] = {
            "texfile": texfile,
            "radius": r,
            "temp": t,
            "class": cls,
            "band": band,
        }

    return result


# ── Main generation logic ─────────────────────────────────────────────────────

def main():
    planets = parse_planets()
    print(f"Parsed {len(planets)} planets")

    # Group planets by (class, temp_band) for base assignment
    groups = defaultdict(list)
    for name, info in planets.items():
        key = (info["class"], info["band"])
        groups[key].append(name)

    print("\nPlanet distribution:")
    for (cls, band), names in sorted(groups.items()):
        bases = BASE_CATALOG.get(cls, {}).get(band, [])
        print(f"  {cls:8s} {band:5s}: {len(names):3d} planets, {len(bases)} bases")

    # Assign bases to planets using round-robin within each group
    assignments = {}  # planet_name -> (base_path, sibling_index)
    base_usage = defaultdict(int)  # base_path -> count

    for (cls, band), names in sorted(groups.items()):
        bases = BASE_CATALOG.get(cls, {}).get(band, [])
        if not bases:
            # Fallback: use warm band
            bases = BASE_CATALOG.get(cls, {}).get("warm", [])
        if not bases:
            # Ultimate fallback
            bases = ["textures/nasa/mercury.jpg"]

        # Sort planets by temperature for smoother base assignment
        names_sorted = sorted(names, key=lambda n: planets[n]["temp"])

        for i, name in enumerate(names_sorted):
            base_idx = i % len(bases)
            base_path = bases[base_idx]
            assignments[name] = (base_path, base_usage[base_path])
            base_usage[base_path] += 1

    # Report base usage
    print(f"\nBase usage (top 10):")
    for base, count in sorted(base_usage.items(), key=lambda x: -x[1])[:10]:
        print(f"  {count:3d}x {base}")

    # Generate textures
    print(f"\nGenerating {len(planets)} textures...")
    generated = 0
    errors = 0
    overridden = 0

    # Luminance bounds: reject textures that are too dark or too washed out
    MIN_LUMINANCE = 35    # mean pixel value — nothing nearly black
    MAX_LUMINANCE = 220   # nothing blown out white
    MIN_CONTRAST = 14     # std dev — must have visible surface detail
    MAX_GREEN_DOMINANCE = 20  # max amount G can exceed both R and B

    for name, info in sorted(planets.items()):
        texfile = info["texfile"]
        out_path = OUT_DIR / texfile

        try:
            # Check for curated override first
            if name in PLANET_OVERRIDES:
                override = PLANET_OVERRIDES[name]
                base_img = load_base(override["base"])
                recipe = override["recipe"]
                result = apply_recipe(base_img, recipe)
                result.save(str(out_path), "JPEG", quality=92)
                generated += 1
                overridden += 1
                continue

            base_path, sibling_idx = assignments[name]
            base_img = load_base(base_path)
            recipe = generate_transform_recipe(sibling_idx, base_usage[base_path], info["class"])
            result = apply_recipe(base_img, recipe)

            # Luminance guard: check if result is too dark, too bright, too flat, or green
            def passes_guard(img_to_check):
                ch = np.array(img_to_check.resize((128, 64)), dtype=np.float32)
                lum = ch.mean()
                std = ch.std()
                r_m, g_m, b_m = ch[:,:,0].mean(), ch[:,:,1].mean(), ch[:,:,2].mean()
                green_dom = g_m - min(r_m, b_m)
                return (MIN_LUMINANCE <= lum <= MAX_LUMINANCE
                        and std >= MIN_CONTRAST
                        and green_dom <= MAX_GREEN_DOMINANCE)

            if not passes_guard(result):
                # Try alternative recipes until we find one in bounds
                for offset in range(5, 200, 2):
                    alt_recipe = generate_transform_recipe(
                        sibling_idx + offset, base_usage[base_path], info["class"]
                    )
                    alt_result = apply_recipe(base_img, alt_recipe)
                    if passes_guard(alt_result):
                        result = alt_result
                        break

            # Save at full quality
            result.save(str(out_path), "JPEG", quality=92)
            generated += 1

            if generated % 20 == 0:
                print(f"  [{generated}/{len(planets)}] Generated {texfile}")

        except Exception as e:
            print(f"  ERROR: {name} ({base_path}): {e}", file=sys.stderr)
            errors += 1

    print(f"\nDone! Generated {generated} textures ({overridden} curated overrides), {errors} errors.")
    print(f"Output: {OUT_DIR}")

    # Verify visual diversity: compute mean colors and check min distance
    print("\nVerifying visual diversity...")
    means = {}
    for name, info in planets.items():
        path = OUT_DIR / info["texfile"]
        if path.exists():
            img = np.array(Image.open(str(path)).resize((64, 32)), dtype=np.float32)
            means[name] = img.mean(axis=(0, 1))

    # Check pairwise distances for planets sharing a base
    base_groups = defaultdict(list)
    for name, (base_path, _) in assignments.items():
        base_groups[base_path].append(name)

    min_dists = []
    for base_path, names in base_groups.items():
        if len(names) < 2:
            continue
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if names[i] in means and names[j] in means:
                    dist = np.abs(means[names[i]] - means[names[j]]).mean()
                    min_dists.append((dist, names[i], names[j], base_path))

    if min_dists:
        min_dists.sort()
        print(f"  Min pairwise distance (same base): {min_dists[0][0]:.1f}")
        print(f"  Median pairwise distance: {sorted([d for d, *_ in min_dists])[len(min_dists)//2]:.1f}")
        print(f"  5 closest pairs (same base):")
        for dist, n1, n2, base in min_dists[:5]:
            print(f"    {dist:5.1f}  {n1[:25]:25s} vs {n2[:25]:25s} ({os.path.basename(base)})")

    # ── Post-fix: iteratively fix close same-base pairs ─────────────────────
    MIN_DIST_THRESHOLD = 20.0
    GLOBAL_MIN_THRESHOLD = 5.0

    def compute_min_sibling_dist(name, base_path):
        """Compute minimum distance from `name` to all its siblings."""
        siblings = [n for n in base_groups[base_path] if n != name and n in means]
        if not siblings:
            return float("inf")
        return min(np.abs(means[name] - means[s]).mean() for s in siblings)

    for fix_round in range(3):  # up to 3 rounds
        # Find all same-base pairs below threshold
        close_names = set()
        for base_path, names in base_groups.items():
            if len(names) < 2:
                continue
            for i in range(len(names)):
                for j in range(i + 1, len(names)):
                    if names[i] in means and names[j] in means:
                        d = np.abs(means[names[i]] - means[names[j]]).mean()
                        if d < MIN_DIST_THRESHOLD:
                            close_names.add((names[j], base_path, d))

        if not close_names:
            break

        print(f"\n  Fix round {fix_round + 1}: {len(close_names)} planets to fix...")
        for name, base_path, orig_dist in close_names:
            # Never overwrite curated overrides
            if name in PLANET_OVERRIDES:
                continue
            _, sibling_idx = assignments[name]
            texfile = planets[name]["texfile"]
            out_path = OUT_DIR / texfile
            base_img = load_base(base_path)

            best_min_dist = compute_min_sibling_dist(name, base_path)
            best_img = None
            best_mean = None

            # Try many alternative recipes, pick the one maximizing MIN distance to ALL siblings
            for offset in range(10, 120, 3):
                alt_recipe = generate_transform_recipe(sibling_idx + offset, base_usage[base_path], planets[name]["class"])
                alt_img = apply_recipe(base_img, alt_recipe)

                # Enforce quality guard on alternatives
                alt_check = np.array(alt_img.resize((128, 64)), dtype=np.float32)
                alt_lum = alt_check.mean()
                alt_std = alt_check.std()
                alt_r, alt_g, alt_b = alt_check[:,:,0].mean(), alt_check[:,:,1].mean(), alt_check[:,:,2].mean()
                if not (MIN_LUMINANCE <= alt_lum <= MAX_LUMINANCE
                        and alt_std >= MIN_CONTRAST
                        and (alt_g - min(alt_r, alt_b)) <= MAX_GREEN_DOMINANCE):
                    continue

                alt_mean = np.array(alt_img.resize((64, 32)), dtype=np.float32).mean(axis=(0, 1))

                # Check min distance to all siblings
                siblings = [n for n in base_groups[base_path] if n != name and n in means]
                min_d = min(np.abs(alt_mean - means[s]).mean() for s in siblings)
                if min_d > best_min_dist:
                    best_min_dist = min_d
                    best_img = alt_img
                    best_mean = alt_mean

            if best_img is not None and best_min_dist > orig_dist:
                best_img.save(str(out_path), "JPEG", quality=92)
                means[name] = best_mean
                print(f"    {name}: {orig_dist:.1f} → {best_min_dist:.1f}")

    # Re-verify same-base
    min_dists_final = []
    for base_path, names in base_groups.items():
        if len(names) < 2:
            continue
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                if names[i] in means and names[j] in means:
                    d = np.abs(means[names[i]] - means[names[j]]).mean()
                    min_dists_final.append((d, names[i], names[j]))
    min_dists_final.sort()
    print(f"\n  Final same-base: min={min_dists_final[0][0]:.1f}, "
          f"median={min_dists_final[len(min_dists_final)//2][0]:.1f}")
    print(f"  5 closest same-base pairs:")
    for d, n1, n2 in min_dists_final[:5]:
        print(f"    {d:5.1f}  {n1[:25]:25s} vs {n2[:25]:25s}")

    # ── Global diversity fix ──────────────────────────────────────────────────
    print("\nGlobal diversity check (all 166 textures):")
    all_names = list(means.keys())
    global_close = []
    for i in range(len(all_names)):
        for j in range(i + 1, len(all_names)):
            d = np.abs(means[all_names[i]] - means[all_names[j]]).mean()
            if d < GLOBAL_MIN_THRESHOLD:
                global_close.append((d, all_names[i], all_names[j]))
    global_close.sort()

    if global_close:
        print(f"  {len(global_close)} global pairs below {GLOBAL_MIN_THRESHOLD}:")
        for d, n1, n2 in global_close:
            print(f"    {d:5.1f}  {n1} vs {n2}")
        # Fix: add extra brightness bump to second planet in each collision
        for d, n1, n2 in global_close:
            # Never overwrite curated overrides
            if n2 in PLANET_OVERRIDES:
                continue
            base_path, sibling_idx = assignments[n2]
            texfile = planets[n2]["texfile"]
            out_path = OUT_DIR / texfile
            base_img = load_base(base_path)

            best_global_min = d
            best_img = None
            best_mean = None
            for offset in range(20, 150, 5):
                alt_recipe = generate_transform_recipe(sibling_idx + offset, base_usage[base_path], planets[n2]["class"])
                alt_img = apply_recipe(base_img, alt_recipe)
                alt_mean = np.array(alt_img.resize((64, 32)), dtype=np.float32).mean(axis=(0, 1))
                # Check distance to ALL other planets
                min_global = min(
                    np.abs(alt_mean - means[n]).mean()
                    for n in all_names if n != n2
                )
                # Also enforce quality guard on alternative
                alt_check = np.array(alt_img.resize((128, 64)), dtype=np.float32)
                alt_lum = alt_check.mean()
                alt_std = alt_check.std()
                alt_r, alt_g, alt_b = alt_check[:,:,0].mean(), alt_check[:,:,1].mean(), alt_check[:,:,2].mean()
                alt_green = alt_g - min(alt_r, alt_b)
                if not (MIN_LUMINANCE <= alt_lum <= MAX_LUMINANCE
                        and alt_std >= MIN_CONTRAST
                        and alt_green <= MAX_GREEN_DOMINANCE):
                    continue
                if min_global > best_global_min:
                    best_global_min = min_global
                    best_img = alt_img
                    best_mean = alt_mean

            if best_img is not None:
                best_img.save(str(out_path), "JPEG", quality=92)
                means[n2] = best_mean
                print(f"    Fixed {n2}: {d:.1f} → {best_global_min:.1f}")
    else:
        # Find actual global min for reporting
        global_min = float("inf")
        global_min_pair = ("", "")
        for i in range(len(all_names)):
            for j in range(i + 1, len(all_names)):
                d = np.abs(means[all_names[i]] - means[all_names[j]]).mean()
                if d < global_min:
                    global_min = d
                    global_min_pair = (all_names[i], all_names[j])
        print(f"  All clear! Global min: {global_min:.1f} ({global_min_pair[0]} vs {global_min_pair[1]})")

    print(f"\n  5 most different pairs (same base):")
    min_dists.sort()
    for dist, n1, n2, base in min_dists[-5:]:
        print(f"    {dist:5.1f}  {n1[:25]:25s} vs {n2[:25]:25s} ({os.path.basename(base)})")


if __name__ == "__main__":
    main()
