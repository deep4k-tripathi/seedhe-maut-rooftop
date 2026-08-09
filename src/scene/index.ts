/**
 * The Delhi rooftop at night.
 *
 * Pure drawing. It receives energy levels and reacts; it has no idea where they come
 * from and never touches the audio engine.
 *
 * Reactivity goes through CSS custom properties rather than SVG attribute writes, so
 * a frame costs four property sets instead of a few hundred DOM mutations.
 */
import type { Levels } from '../player/engine';

const W = 1600;
const H = 900;

/**
 * Where the roof surface begins. Everything below is deck, so any sky colour placed
 * below this line is simply covered up — the warm horizon has to sit above it.
 */
const ROOFLINE = 566;

/**
 * Objects on the roof are placed by where their base sits on the deck, not by depth
 * order alone: lower on the plane reads as nearer. These are the three bands used.
 */
const STANDING = { far: 610, mid: 680, near: 772 };

/**
 * The SVG is drawn with `slice`, so a narrow viewport crops the sides. On a 4:3 screen
 * only the middle ~58% of the width survives. Anything that must be seen belongs
 * inside this band; the rest is a bonus on wide displays.
 */
const SAFE = { from: 380, to: 1220 };

/** Deterministic PRNG so the skyline is identical on every load. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A block of flats: silhouette plus a scatter of lit windows. */
function building(
  x: number,
  y: number,
  w: number,
  h: number,
  random: () => number,
  depth: number,
): string {
  const cols = Math.max(2, Math.floor(w / 30));
  const rows = Math.max(2, Math.floor(h / 34));
  const padX = (w - cols * 14) / (cols + 1);
  const padY = (h - rows * 16) / (rows + 1);

  let windows = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (random() > 0.38) continue; // most flats are dark at this hour
      const wx = x + padX + c * (14 + padX);
      const wy = y + padY + r * (16 + padY);
      // Staggered phases stop the whole skyline blinking in lockstep.
      const phase = (random() * 6).toFixed(2);
      const warm = random() > 0.22;
      windows +=
        `<rect class="win ${warm ? 'warm' : 'cool'}" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}"` +
        ` width="12" height="14" style="--phase:${phase}s"/>`;
    }
  }

  return (
    `<g class="block d${depth}">` +
    `<rect class="mass" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
    `<rect class="ledge" x="${x}" y="${y}" width="${w}" height="3"/>` +
    windows +
    `</g>`
  );
}

/**
 * Two ridges of buildings. Gaps matter more than the blocks: the warm horizon only
 * shows through the spaces between them, and that is what makes the skyline read.
 */
function skyline(random: () => number): string {
  let out = '';

  let x = -40;
  while (x < W + 40) {
    const w = 84 + random() * 96;
    const h = 100 + random() * 120;
    out += building(x, 452 - h, w, h, random, 2);
    x += w + 22 + random() * 34; // generous gaps so the glow comes through
  }

  x = -70;
  while (x < W + 70) {
    const w = 118 + random() * 150;
    const h = 130 + random() * 190;
    out += building(x, ROOFLINE - h, w, h, random, 1);
    x += w + 26 + random() * 40;
  }

  return out;
}

/** The black plastic water tanks on every roof in the city. */
function tank(x: number, baseY: number, scale: number): string {
  const bodyH = 78;
  const standH = 24;
  const y = baseY - (bodyH + standH) * scale;

  return (
    `<g class="tank" transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect class="tank-stand" x="8" y="${bodyH - 2}" width="94" height="${standH + 4}"/>` +
    `<path class="tank-body" d="M0 18 Q0 0 24 0 L86 0 Q110 0 110 18 L110 62 Q110 78 86 78 L24 78 Q0 78 0 62 Z"/>` +
    `<rect class="tank-rib" x="0" y="28" width="110" height="6"/>` +
    `<rect class="tank-rib" x="0" y="46" width="110" height="6"/>` +
    `<ellipse class="tank-lid" cx="55" cy="1" rx="21" ry="7"/>` +
    // Rim light along the top edge. Without this the tank is black on black.
    `<path class="rim" d="M1 17 Q1 1 24 1 L86 1 Q109 1 109 17"/>` +
    `</g>`
  );
}

/** A sagging catenary between two points. */
function wire(x1: number, y1: number, x2: number, y2: number, sag: number, cls = ''): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return `<path class="wire ${cls}" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}"/>`;
}

/** The string of festival bulbs nobody ever takes down. */
function jhalar(x1: number, y1: number, x2: number, y2: number, sag: number, count: number): string {
  let bulbs = '';
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 + sag;
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    bulbs +=
      `<circle class="bulb b${i % 4}" cx="${bx.toFixed(1)}" cy="${(by + 8).toFixed(1)}" r="5"` +
      ` style="--phase:${((i % 7) * 0.32).toFixed(2)}s"/>`;
  }
  return wire(x1, y1, x2, y2, sag, 'jhalar-wire') + bulbs;
}

export function mount(root: HTMLElement): void {
  const random = seeded(20260810);

  root.innerHTML = `
<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <!-- Warm band sits just above the roofline so the skyline silhouettes against it. -->
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#04040a"/>
      <stop offset="26%" stop-color="#0a0912"/>
      <stop offset="44%" stop-color="#150f1c"/>
      <stop offset="56%" stop-color="#2b1620"/>
      <stop offset="64%" stop-color="#5c2c1f"/>
      <stop offset="${((ROOFLINE / H) * 100).toFixed(0)}%" stop-color="#a3542a"/>
    </linearGradient>

    <radialGradient id="haze" cx="0.62" cy="0.665" r="0.46">
      <stop offset="0%"   stop-color="#e08135" stop-opacity="0.75"/>
      <stop offset="55%"  stop-color="#c9642f" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#c9642f" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="tubeglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%"   stop-color="#d8ecff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#d8ecff" stop-opacity="0"/>
    </radialGradient>

    <!-- Light pooling on the deck under the tube. -->
    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%"   stop-color="#cfe6ff" stop-opacity="0.17"/>
      <stop offset="100%" stop-color="#cfe6ff" stop-opacity="0"/>
    </radialGradient>

    <!-- Horizon bounce on the deck surface, so the roof is lit rather than void. -->
    <linearGradient id="bounce" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#c96a2f" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#c96a2f" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.62"/>
      <stop offset="34%"  stop-color="#000" stop-opacity="0.06"/>
      <stop offset="78%"  stop-color="#000" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
    </linearGradient>

    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect class="haze" width="${W}" height="${H}" fill="url(#haze)"/>

  <g class="stars">${Array.from({ length: 52 }, () => {
    const sx = (random() * W).toFixed(0);
    const sy = (random() * 340).toFixed(0);
    const r = (0.6 + random() * 1.2).toFixed(2);
    return `<circle cx="${sx}" cy="${sy}" r="${r}" style="--phase:${(random() * 4).toFixed(2)}s"/>`;
  }).join('')}</g>

  <g class="skyline">${skyline(random)}</g>

  <!-- wires strung high across the frame -->
  <g class="wires">
    ${wire(-40, 236, W + 40, 198, 78)}
    ${wire(-40, 306, W + 40, 272, 100)}
    ${wire(-40, 272, W + 40, 336, 60)}
  </g>

  <!-- the roof we are standing on: one plane running from the far edge to the frame -->
  <g class="roof">
    <rect class="roof-deck" x="0" y="${ROOFLINE}" width="${W}" height="${H - ROOFLINE}"/>
    <!-- bounce light on the surface, strongest at the far edge -->
    <rect class="deck-bounce" x="0" y="${ROOFLINE}" width="${W}" height="200" fill="url(#bounce)"/>
    <rect class="parapet-cap" x="0" y="${ROOFLINE - 5}" width="${W}" height="6"/>
    <!-- tar patches, so the deck is a surface rather than a void -->
    <path class="patch" d="M120 700 L520 672 L660 742 L210 786 Z"/>
    <path class="patch" d="M980 660 L1310 690 L1240 748 L940 712 Z"/>
    <ellipse class="pool" cx="${SAFE.to + 60}" cy="${STANDING.near}" rx="330" ry="130"
             fill="url(#pool)"/>
  </g>

  <!-- the pole everything hangs off, kept inside the safe band -->
  <g class="pole">
    <rect x="852" y="120" width="14" height="${STANDING.far - 120}"/>
    <rect x="810" y="170" width="98" height="9"/>
    <rect x="820" y="216" width="78" height="7"/>
  </g>

  <!-- dish, off to the left where it fills dead space on wide screens -->
  <g class="dish" transform="translate(150 ${STANDING.mid - 132})">
    <rect class="dish-mast" x="30" y="26" width="9" height="112"/>
    <path class="dish-face" d="M0 34 A44 34 0 0 1 88 34 Z"/>
    <rect class="dish-arm" x="41" y="4" width="5" height="30"/>
    <circle class="dish-lnb" cx="43" cy="4" r="6"/>
  </g>

  <!--
    Clothesline hung right at the roofline, where the sky is brightest. Anywhere lower
    and the cloths are black-on-black; anywhere higher and the skyline swallows them.
  -->
  <g class="laundry">
    ${wire(596, 548, 862, 536, 26, 'line')}
    ${[
      { x: 618, w: 50, h: 88, c: 'c0' },
      { x: 690, w: 42, h: 70, c: 'c1' },
      { x: 754, w: 56, h: 96, c: 'c2' },
    ]
      .map(
        (item, i) =>
          `<g class="cloth-wrap" style="--phase:${(i * 0.45).toFixed(2)}s">` +
          `<rect class="cloth ${item.c}" x="${item.x}" y="${556 + i * 3}"` +
          ` width="${item.w}" height="${item.h}"/>` +
          `<rect class="cloth-rim" x="${item.x}" y="${556 + i * 3}" width="${item.w}" height="3"/>` +
          `</g>`,
      )
      .join('')}
  </g>

  <!-- pigeons, because there are always pigeons -->
  <g class="birds">
    ${[
      { x: 700, y: 296 },
      { x: 742, y: 302 },
      { x: 792, y: 309 },
      { x: 1046, y: 268 },
      { x: 1082, y: 274 },
    ]
      .map(
        (b) =>
          `<path class="bird" d="M${b.x} ${b.y} q5 -8 10 0 q5 -8 10 0 l0 9 q-10 4 -20 0 Z"/>`,
      )
      .join('')}
  </g>

  <!-- foreground tanks: large, low on the plane, clearly in front of the city -->
  ${tank(SAFE.from - 10, STANDING.near, 1.85)}
  ${tank(SAFE.to - 300, STANDING.mid, 1.15)}

  <!-- stairwell hut, its tube light the only cool source in the frame -->
  <g class="stairhead">
    <rect class="hut" x="${SAFE.to - 100}" y="${STANDING.near - 268}" width="330" height="268"/>
    <rect class="hut-edge" x="${SAFE.to - 100}" y="${STANDING.near - 268}" width="6" height="268"/>
    <rect class="hut-door" x="${SAFE.to - 14}" y="${STANDING.near - 158}" width="78" height="158"/>
    <ellipse class="tube-glow" cx="${SAFE.to + 40}" cy="${STANDING.near - 206}" rx="250" ry="164"
             fill="url(#tubeglow)"/>
    <rect class="tube" x="${SAFE.to - 44}" y="${STANDING.near - 210}" width="170" height="10" rx="5"/>
  </g>

  <g class="festoon">${jhalar(-30, 132, W + 30, 172, 100, 34)}</g>

  <rect class="vignette" width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect class="grain" width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

/**
 * Feed the scene. Called once per animation frame.
 * Values are clamped because a hot mix can push a band past 1.
 */
export function pulse(root: HTMLElement, levels: Levels): void {
  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v).toFixed(3);
  const style = root.style;
  style.setProperty('--bass', clamp(levels.bass));
  style.setProperty('--mid', clamp(levels.mid));
  style.setProperty('--treble', clamp(levels.treble));
  style.setProperty('--level', clamp(levels.level));
}
