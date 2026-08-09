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
  const cols = Math.max(2, Math.floor(w / 26));
  const rows = Math.max(2, Math.floor(h / 30));
  const padX = (w - cols * 14) / (cols + 1);
  const padY = (h - rows * 16) / (rows + 1);

  let windows = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (random() > 0.42) continue; // most flats are dark at this hour
      const wx = x + padX + c * (14 + padX);
      const wy = y + padY + r * (16 + padY);
      // Staggered phases stop the whole skyline blinking in lockstep.
      const phase = (random() * 6).toFixed(2);
      const warm = random() > 0.25;
      windows +=
        `<rect class="win ${warm ? 'warm' : 'cool'}" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}"` +
        ` width="12" height="14" style="--phase:${phase}s"/>`;
    }
  }

  return (
    `<g class="block" style="--depth:${depth}">` +
    `<rect class="mass" x="${x}" y="${y}" width="${w}" height="${h}"/>${windows}</g>`
  );
}

function skyline(random: () => number): string {
  let out = '';

  // Far ridge: hazy, barely there.
  let x = -40;
  while (x < W + 40) {
    const w = 70 + random() * 90;
    const h = 90 + random() * 130;
    out += building(x, 470 - h, w, h, random, 0.35);
    x += w + 6 + random() * 18;
  }

  // Near ridge: taller, more contrast, more lit windows.
  x = -60;
  while (x < W + 60) {
    const w = 110 + random() * 140;
    const h = 150 + random() * 210;
    out += building(x, 610 - h, w, h, random, 1);
    x += w + 10 + random() * 26;
  }

  return out;
}

/** The black plastic water tanks on every roof in the city. */
function tank(x: number, y: number, scale: number): string {
  const w = 110 * scale;
  const h = 78 * scale;
  return (
    `<g class="tank" transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect class="tank-stand" x="6" y="${h / scale - 4}" width="${w / scale - 12}" height="26"/>` +
    `<path class="tank-body" d="M0 18 Q0 0 24 0 L86 0 Q110 0 110 18 L110 62 Q110 78 86 78 L24 78 Q0 78 0 62 Z"/>` +
    `<rect class="tank-rib" x="0" y="30" width="110" height="5"/>` +
    `<rect class="tank-rib" x="0" y="46" width="110" height="5"/>` +
    `<ellipse class="tank-lid" cx="55" cy="2" rx="20" ry="6"/>` +
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
    // Point on the quadratic bezier at t.
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 + sag;
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    bulbs +=
      `<circle class="bulb b${i % 4}" cx="${bx.toFixed(1)}" cy="${(by + 7).toFixed(1)}" r="4.5"` +
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
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#07070a"/>
      <stop offset="42%"  stop-color="#14101a"/>
      <stop offset="72%"  stop-color="#3a1f22"/>
      <stop offset="90%"  stop-color="#7a3a24"/>
      <stop offset="100%" stop-color="#94502c"/>
    </linearGradient>

    <radialGradient id="haze" cx="0.68" cy="0.78" r="0.55">
      <stop offset="0%"   stop-color="#c9642f" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#c9642f" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="tubeglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%"   stop-color="#dfefff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#dfefff" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000" stop-opacity="0.72"/>
      <stop offset="38%"  stop-color="#000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.80"/>
    </linearGradient>

    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect class="haze" width="${W}" height="${H}" fill="url(#haze)"/>

  <g class="stars">${Array.from({ length: 46 }, () => {
    const sx = (random() * W).toFixed(0);
    const sy = (random() * 380).toFixed(0);
    const r = (0.6 + random() * 1.1).toFixed(2);
    return `<circle cx="${sx}" cy="${sy}" r="${r}" style="--phase:${(random() * 4).toFixed(2)}s"/>`;
  }).join('')}</g>

  <g class="skyline">${skyline(random)}</g>

  <!-- rooftop slab -->
  <g class="roof">
    <rect class="roof-deck" x="0" y="612" width="${W}" height="${H - 612}"/>
    <rect class="parapet" x="0" y="596" width="${W}" height="26"/>
    <rect class="parapet-cap" x="0" y="592" width="${W}" height="7"/>
  </g>

  <!-- wires strung across the whole frame -->
  <g class="wires">
    ${wire(-40, 232, W + 40, 196, 74)}
    ${wire(-40, 300, W + 40, 268, 96)}
    ${wire(-40, 268, W + 40, 330, 58)}
  </g>

  <!-- the pole everything hangs off -->
  <g class="pole">
    <rect x="1236" y="150" width="13" height="470"/>
    <rect x="1196" y="196" width="94" height="8"/>
    <rect x="1204" y="240" width="78" height="7"/>
  </g>

  <g class="dish" transform="translate(268 508)">
    <rect x="26" y="18" width="7" height="96"/>
    <ellipse class="dish-face" cx="30" cy="16" rx="42" ry="26"/>
    <rect class="dish-arm" x="27" y="-6" width="5" height="26"/>
  </g>

  ${tank(1012, 470, 1.16)}
  ${tank(1198, 506, 0.86)}
  ${tank(94, 500, 0.98)}

  <!-- clothesline -->
  <g class="laundry">
    ${wire(392, 556, 902, 556, 34, 'line')}
    ${[
      { x: 452, w: 54, h: 92, c: 'c0' },
      { x: 534, w: 46, h: 74, c: 'c1' },
      { x: 604, w: 62, h: 98, c: 'c2' },
      { x: 700, w: 44, h: 70, c: 'c1' },
      { x: 776, w: 56, h: 86, c: 'c0' },
    ]
      .map(
        (item, i) =>
          `<rect class="cloth ${item.c}" x="${item.x}" y="${568 + i * 2}"` +
          ` width="${item.w}" height="${item.h}" style="--phase:${(i * 0.45).toFixed(2)}s"/>`,
      )
      .join('')}
  </g>

  <!-- the tube light on the stairwell wall -->
  <g class="stairhead">
    <rect class="hut" x="1372" y="418" width="212" height="200"/>
    <rect class="hut-door" x="1436" y="500" width="66" height="118"/>
    <ellipse class="tube-glow" cx="1478" cy="470" rx="190" ry="120" fill="url(#tubeglow)"/>
    <rect class="tube" x="1400" y="466" width="156" height="9" rx="4"/>
  </g>

  <g class="festoon">${jhalar(-30, 138, W + 30, 176, 96, 34)}</g>

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
