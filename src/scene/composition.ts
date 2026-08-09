/**
 * "Dilli, 11:40 pm" v2 — south Delhi rooftop, comic-print treatment.
 *
 * Ported from the Claude Design composition `Delhi Rooftop v2.dc.html` (project
 * "Rooftop Scene Delhi Night"): cel-shaded volumes, ink outlines, halftone screens and
 * chromatic misregistration.
 *
 * The original is React driven by a composition runtime that supplies an authored time
 * axis T. This is a faithful vanilla port — React plus the runtime would have cost
 * ~45 KB gzipped for what is, here, a background.
 *
 * The model is unchanged: the whole scene is a pure function of T over a 20 second loop.
 * Static scenery is built once as markup; each frame writes only what moves.
 *
 * FRAGILE: the city is generated from ONE shared PRNG consumed in a fixed order —
 * far blocks, mid blocks, far buildings, mid buildings, stars, near band. v2 interleaves
 * window and detail generation *inside* `building()`, so the draw order is part of the
 * generator. Reordering or adding a call regenerates a different city.
 */

const W = 1920;
const H = 1080;
const FX = 470;
const FY = 500;
export const TOTAL = 20;

/** Baked from the design's TWEAK_DEFAULTS. */
const SMOG = 0.75;
const GRAIN = true;
const FLIGHT = true;
const ROOF_FOLKS = true;
const HALFTONE = true;
const MISREGISTER = true;

/* ── ink palette ── */
const INK = '#080a1e';
const SKIN_RIM = '#ffb072';
const HOT = '#ff9a44';
const COOL = '#3fd8ea';
const MAG = '#ff2e88';

/* ─────────────────────────── motion ─────────────────────────── */

const Easing = {
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

type Ease = (t: number) => number;

function animate(from: number, to: number, start: number, end: number, ease: Ease) {
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

const MOTION = {
  glide: (a: number, b: number, s: number, e: number) => animate(a, b, s, e, Easing.easeInOutCubic),
  drift: (a: number, b: number, s: number, e: number) => animate(a, b, s, e, Easing.easeInOutSine),
};

type Keys = readonly (readonly [number, number])[];

function seq(T: number, keys: Keys, mo = MOTION.glide): number {
  if (T <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    if (T <= keys[i]![0]) return mo(keys[i - 1]![1], keys[i]![1], keys[i - 1]![0], keys[i]![0])(T);
  }
  return keys[keys.length - 1]![1];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lp = (a: number[], b: number[], k: number): [number, number] => [
  lerp(a[0]!, b[0]!, k),
  lerp(a[1]!, b[1]!, k),
];
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const cyc = (T: number, cycles: number, phase = 0) =>
  Math.sin(Math.PI * 2 * ((T * cycles) / TOTAL + phase));

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);

/* ─────────────────────────── camera ─────────────────────────── */

function camera(T: number) {
  const s = seq(T, [
    [0, 1.1], [4.4, 1.148], [9.3, 2.34], [10.7, 2.33],
    [13.6, 2.0], [16.2, 1.97], [19.2, 1.096], [20, 1.1],
  ]);
  const cx = seq(T, [
    [0, 960], [4.4, 992], [9.3, 652], [10.7, 664],
    [13.6, 1000], [16.2, 1026], [19.2, 950], [20, 960],
  ]);
  const cy = seq(T, [
    [0, 495], [4.4, 482], [9.3, 596], [10.7, 598],
    [13.6, 506], [16.2, 502], [19.2, 498], [20, 495],
  ]);
  return { s, cx: cx + cyc(T, 2, 0.12) * 3.5, cy: cy + cyc(T, 3, 0.4) * 2.4 };
}

/* ─────────────────────────── pose ─────────────────────────── */

const L_REST_E = [108, 196], L_REST_H = [96, 214];
const L_UP_E = [158, 190], L_UP_H = [198, 118];
const R_REST_E = [250, 200], R_REST_H = [258, 246];
const R_GRAB_E = [258, 204], R_GRAB_H = [268, 244];
const R_RAIS_E = [250, 178], R_RAIS_H = [238, 124];
const GLASS_REST = [272, 258];

export interface Pose {
  lE: [number, number]; lH: [number, number]; cig: [number, number];
  rE: [number, number]; rH: [number, number];
  glass: [number, number]; glassRot: number;
  ember: number; breath: number; faceLit: number;
  cigW: [number, number]; mouthW: [number, number];
}

function pose(T: number): Pose {
  const drag = seq(T, [[6.9, 0], [7.65, 1], [8.5, 1], [9.25, 0]]);
  const lE = lp(L_REST_E, L_UP_E, drag);
  const lH = lp(L_REST_H, L_UP_H, drag);
  const dir = [lerp(-0.5, 0.72, drag), lerp(-0.86, -0.69, drag)];
  const cig: [number, number] = [lH[0] + dir[0]! * 21, lH[1] + dir[1]! * 21];

  const sip = seq(T, [[12.7, 0], [13.5, 0.35], [14.1, 1], [14.85, 1], [15.5, 0.35], [16.05, 0]]);
  let rE: [number, number], rH: [number, number];
  if (sip <= 0.35) {
    const u = sip / 0.35;
    rE = lp(R_REST_E, R_GRAB_E, u);
    rH = lp(R_REST_H, R_GRAB_H, u);
  } else {
    const u = (sip - 0.35) / 0.65;
    rE = lp(R_GRAB_E, R_RAIS_E, u);
    rH = lp(R_GRAB_H, R_RAIS_H, u);
  }
  const hold = clamp((sip - 0.35) / 0.65, 0, 1);
  const glass = lp(GLASS_REST, [rH[0] + 2, rH[1] + 15], hold);
  const glassRot = seq(T, [[14.15, 0], [14.45, -34], [14.78, -34], [15.08, 0]]);

  const ember =
    seq(T, [[0, 0.3], [7.55, 0.32], [7.9, 1], [8.4, 1], [8.8, 0.32], [20, 0.3]]) *
    (0.88 + 0.12 * cyc(T, 30, 0.2));
  const breath =
    seq(T, [[6.9, 0], [7.9, -3.2], [8.5, -3.6], [9.4, 2.4], [11.0, 0]]) + cyc(T, 4, 0.1) * 0.9;

  // The ember washes his profile only while it is close to his face.
  const faceLit =
    clamp(drag * 1.15 - 0.15, 0, 1) * (0.35 + 0.65 * clamp((ember - 0.3) / 0.7, 0, 1));

  return {
    lE, lH, cig, rE, rH, glass, glassRot, ember, breath, faceLit,
    cigW: [FX + cig[0], FY + cig[1]],
    mouthW: [FX + 218, FY + 112],
  };
}

/* ─────────────────── city geometry (shared PRNG, order matters) ─────────────────── */

const RN = rng(20240811);

interface Block { x: number; y: number; w: number; h: number; kind: number }

function makeBlocks(
  baseY: number, minW: number, maxW: number, minH: number, maxH: number,
  clearFrom: number, clearTo: number, clearH: number,
): Block[] {
  const out: Block[] = [];
  for (let x = -80; x < 2010; ) {
    const w = minW + RN() * (maxW - minW);
    let h = minH + RN() * (maxH - minH);
    if (x > clearFrom && x < clearTo) h = Math.min(h, clearH);
    out.push({ x, y: baseY - h, w, h, kind: RN() });
    x += w + RN() * 14 - 5;
  }
  return out;
}

const FAR = makeBlocks(648, 34, 110, 22, 96, 1180, 1400, 26);
const MID = makeBlocks(708, 62, 190, 52, 174, 1190, 1410, 46);

/**
 * One building: a lit face, a shaded return, a ledge and real windows.
 * Consumes the shared PRNG inline — this is what makes the draw order load-bearing.
 */
function building(
  b: Block, tone: string[], winTone: string[],
  cell: number, gap: number, lit: number, detail: boolean,
): string {
  const side = Math.min(16, b.w * 0.13);
  const els: string[] = [];
  els.push(`<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="${tone[0]}"/>`);
  els.push(`<rect x="${n1(b.x + b.w - side)}" y="${n1(b.y)}" width="${n1(side)}" height="${n1(b.h)}" fill="${tone[1]}"/>`);
  els.push(`<rect x="${n1(b.x - 2)}" y="${n1(b.y - 4)}" width="${n1(b.w + 4)}" height="5" fill="${tone[2]}"/>`);
  els.push(`<rect x="${n1(b.x - 2)}" y="${n1(b.y - 5)}" width="${n1(b.w + 4)}" height="1.6" fill="${tone[3]}" opacity="0.8"/>`);

  for (let wy = b.y + 10; wy < b.y + b.h - 8; wy += cell * 1.5 + gap) {
    for (let wx = b.x + 7; wx < b.x + b.w - side - 5; wx += cell + gap) {
      const on = RN() < lit;
      const c = on ? (RN() > 0.83 ? winTone[1] : winTone[0]) : tone[1];
      const o = on ? 0.45 + RN() * 0.5 : 0.85;
      els.push(`<rect x="${n1(wx)}" y="${n1(wy)}" width="${cell}" height="${n2(cell * 1.45)}" fill="${c}" opacity="${n2(o)}"/>`);
      if (on && cell > 2.4) {
        els.push(`<rect x="${n1(wx)}" y="${n1(wy)}" width="${cell}" height="0.8" fill="${INK}" opacity="0.5"/>`);
      }
    }
  }

  if (detail) {
    if (b.w > 120) {
      els.push(`<rect x="${n1(b.x + b.w * 0.55)}" y="${n1(b.y - 22)}" width="26" height="18" rx="5" fill="${tone[1]}"/>`);
      els.push(`<rect x="${n1(b.x + b.w * 0.55 - 3)}" y="${n1(b.y - 25)}" width="32" height="4" rx="2" fill="${tone[1]}"/>`);
      els.push(`<rect x="${n1(b.x + b.w * 0.56)}" y="${n1(b.y - 4)}" width="4" height="4" fill="${tone[1]}"/>`);
    }
    if (RN() > 0.45) {
      const ax = b.x + 12 + RN() * (b.w - 30);
      els.push(`<path d="M ${n1(ax)} ${n1(b.y)} L ${n1(ax - 3)} ${n1(b.y - 34)}" stroke="${tone[1]}" stroke-width="1.8"/>`);
      els.push(`<path d="M ${n1(ax - 8)} ${n1(b.y - 26)} L ${n1(ax + 4)} ${n1(b.y - 30)}" stroke="${tone[1]}" stroke-width="1.4"/>`);
    }
    if (RN() > 0.62 && b.w > 90) {
      const dy = b.y - 12;
      els.push(`<path d="M ${n1(b.x + 16)} ${n1(b.y)} L ${n1(b.x + 16)} ${n1(dy)} M ${n1(b.x + 6)} ${n1(dy - 3)} A 12 12 0 0 1 ${n1(b.x + 28)} ${n1(dy - 6)}" stroke="${tone[1]}" stroke-width="2.4" fill="none"/>`);
    }
  }
  return `<g>${els.join('')}</g>`;
}

const G_FAR = `<g>${FAR.map((b) =>
  building(b, ['#131a3e', '#0d1230', '#1a2450', '#2c3a72'], ['#ffc98a', '#a8d8ff'], 1.7, 3.2, 0.32, false),
).join('')}</g>`;

const G_MID = `<g>${MID.map((b) =>
  building(b, ['#0e1330', '#080c22', '#141a40', '#26306a'], ['#ffbd6e', '#9ed4ff'], 3.1, 5.6, 0.36, true),
).join('')}</g>`;

/** The far layer re-inked twice off-register — the printing-press miss that reads as depth. */
const G_FAR_CMY =
  `<g transform="translate(-3,0)" opacity="0.13" style="mix-blend-mode:screen">` +
  FAR.map((b) => `<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="${MAG}"/>`).join('') +
  `</g><g transform="translate(3,0)" opacity="0.10" style="mix-blend-mode:screen">` +
  FAR.map((b) => `<rect x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}" fill="#1ec8de"/>`).join('') +
  `</g>`;

interface Star { x: number; y: number; r: number; o: number; c: number; p: number }
const STARS: Star[] = (() => {
  const out: Star[] = [];
  for (let i = 0; i < 54; i++) {
    out.push({
      x: 30 + RN() * 1860, y: -300 + RN() * 680,
      r: 0.7 + RN() * 1.3, o: 0.24 + RN() * 0.5,
      c: 1 + Math.floor(RN() * 4), p: RN(),
    });
  }
  return out;
})();

const G_NEAR_BAND = (() => {
  const bumps: string[] = [];
  for (let x = -60; x < 2000; x += 42 + RN() * 66) {
    const h = 6 + RN() * 28;
    const w = 20 + RN() * 62;
    bumps.push(`<rect x="${n1(x)}" y="${n1(730 - h)}" width="${n1(w)}" height="${n1(h + 22)}" rx="2" fill="#080c22"/>`);
    bumps.push(`<rect x="${n1(x)}" y="${n1(730 - h)}" width="${n1(w)}" height="1.4" fill="#1b2450" opacity="0.7"/>`);
    if (RN() > 0.68) {
      bumps.push(`<line x1="${n1(x + 8)}" y1="${n1(730 - h)}" x2="${n1(x + 5)}" y2="${n1(730 - h - 32)}" stroke="#080c22" stroke-width="1.8"/>`);
    }
  }
  return `<g><rect x="-60" y="728" width="2060" height="72" fill="#080c22"/>${bumps.join('')}</g>`;
})();

/* ── Qutub Minar: fluted sandstone drums, corbelled balconies, marble upper storeys ── */

const QX = 1302, QBASE = 622;
const Q_STOREY = [
  { h: 100, flutes: 12, style: 'mix', band: true, marble: false },
  { h: 63, flutes: 11, style: 'round', band: true, marble: false },
  { h: 46, flutes: 10, style: 'angle', band: true, marble: false },
  { h: 36, flutes: 8, style: 'plain', band: false, marble: true },
  { h: 29, flutes: 8, style: 'plain', band: false, marble: true },
];

const G_QUTUB = (() => {
  const parts: string[] = [];
  const totalH = Q_STOREY.reduce((a, s) => a + s.h, 0) + Q_STOREY.length * 9;
  let y = QBASE;
  const widthAt = (yy: number) => lerp(84, 30, (QBASE - yy) / totalH);

  for (const st of Q_STOREY) {
    const yTop = y - st.h;
    const w0 = widthAt(y), w1 = widthAt(yTop);
    const sand = st.marble ? ['#c9b89c', '#9d8a6e', '#e0d3bd'] : ['#c2762f', '#8c4d1e', '#e8a35c'];
    parts.push(`<path d="M ${n1(QX - w0 / 2)} ${n1(y)} L ${n1(QX - w1 / 2)} ${n1(yTop)} L ${n1(QX + w1 / 2)} ${n1(yTop)} L ${n1(QX + w0 / 2)} ${n1(y)} Z" fill="${sand[0]}"/>`);

    for (let f = 0; f < st.flutes; f++) {
      const u0 = f / st.flutes, u1 = (f + 0.5) / st.flutes;
      const x0a = QX - w0 / 2 + w0 * u0, x0b = QX - w0 / 2 + w0 * u1;
      const x1a = QX - w1 / 2 + w1 * u0, x1b = QX - w1 / 2 + w1 * u1;
      const angular = st.style === 'angle' || (st.style === 'mix' && f % 2 === 0);
      if (st.style === 'plain') {
        parts.push(`<path d="M ${n1(x0a)} ${n1(y)} L ${n1(x1a)} ${n1(yTop)}" stroke="${sand[1]}" stroke-width="0.8" opacity="0.5"/>`);
      } else if (angular) {
        parts.push(`<path d="M ${n1(x0a)} ${n1(y)} L ${n1(x1a)} ${n1(yTop)} L ${n1(x1b)} ${n1(yTop)} L ${n1(x0b)} ${n1(y)} Z" fill="${sand[1]}" opacity="0.55"/>`);
      } else {
        parts.push(`<path d="M ${n1(x0a)} ${n1(y)} L ${n1(x1a)} ${n1(yTop)} L ${n1(x1b)} ${n1(yTop)} L ${n1(x0b)} ${n1(y)} Z" fill="${sand[2]}" opacity="0.32"/>`);
        parts.push(`<path d="M ${n1(x0b)} ${n1(y)} L ${n1(x1b)} ${n1(yTop)}" stroke="${sand[1]}" stroke-width="0.7" opacity="0.6"/>`);
      }
    }

    // The lit face falls off toward the right shoulder of the drum.
    parts.push(`<path d="M ${n1(QX + w0 / 2 - w0 * 0.3)} ${n1(y)} L ${n1(QX + w1 / 2 - w1 * 0.3)} ${n1(yTop)} L ${n1(QX + w1 / 2)} ${n1(yTop)} L ${n1(QX + w0 / 2)} ${n1(y)} Z" fill="#3d1d0a" opacity="0.42"/>`);
    parts.push(`<path d="M ${n1(QX - w0 * 0.16)} ${n1(y)} L ${n1(QX - w1 * 0.16)} ${n1(yTop)} L ${n1(QX - w1 * 0.02)} ${n1(yTop)} L ${n1(QX - w0 * 0.02)} ${n1(y)} Z" fill="#ffcf94" opacity="0.16"/>`);

    if (st.band) {
      parts.push(`<rect x="${n1(QX - w1 / 2 - 1)}" y="${n1(yTop + 5)}" width="${n1(w1 + 2)}" height="7" fill="#7d4218" opacity="0.85"/>`);
      for (let d = 0; d < 9; d++) {
        parts.push(`<rect x="${n1(QX - w1 / 2 + 2 + (d * (w1 - 4)) / 9)}" y="${n1(yTop + 7)}" width="1.6" height="3" fill="#ffd7a0" opacity="0.4"/>`);
      }
    }

    y = yTop;

    // Corbelled balcony: a row of stalactite brackets, then the ring and its rail.
    const bw = w1 + 17;
    for (let c = 0; c < 11; c++) {
      const bx = QX - bw / 2 + 2 + (c * (bw - 4)) / 10;
      parts.push(`<path d="M ${n1(bx - 2.6)} ${n1(y)} L ${n1(bx + 2.6)} ${n1(y)} L ${n1(bx)} ${n1(y + 8)} Z" fill="#a05c22"/>`);
    }
    parts.push(`<rect x="${n1(QX - bw / 2)}" y="${n1(y - 8)}" width="${n1(bw)}" height="9" rx="1.5" fill="#b06a2c"/>`);
    parts.push(`<rect x="${n1(QX - bw / 2)}" y="${n1(y - 9)}" width="${n1(bw)}" height="2.2" fill="#ffd3a0" opacity="0.75"/>`);
    parts.push(`<rect x="${n1(QX - bw / 2 + bw * 0.68)}" y="${n1(y - 8)}" width="${n1(bw * 0.32)}" height="9" fill="#4a2409" opacity="0.4"/>`);
    for (let c = 0; c < 14; c++) {
      parts.push(`<rect x="${n1(QX - bw / 2 + 2 + (c * (bw - 4)) / 14)}" y="${n1(y - 15)}" width="1.5" height="6" fill="#96591f"/>`);
    }
    parts.push(`<rect x="${n1(QX - bw / 2 - 1)}" y="${n1(y - 16)}" width="${n1(bw + 2)}" height="1.8" fill="#c07a34"/>`);
    y -= 9;
  }

  const capW = widthAt(y);
  parts.push(`<rect x="${n1(QX - capW / 2 - 3)}" y="${n1(y - 11)}" width="${n1(capW + 6)}" height="12" fill="#bfae93"/>`);
  parts.push(`<rect x="${n1(QX - capW / 2 + 3)}" y="${n1(y - 19)}" width="${n1(capW - 6)}" height="9" rx="2" fill="#a89477"/>`);
  parts.push(`<circle cx="${QX}" cy="${n1(y - 22)}" r="3" fill="#efe4cf"/>`);
  return `<g>${parts.join('')}</g>`;
})();

const G_QUTUB_LIGHT =
  `<g><ellipse cx="${QX}" cy="${QBASE - 130}" rx="150" ry="250" fill="url(#qhaze)"/>` +
  `<path d="M ${QX - 96} ${QBASE + 30} L ${QX - 22} 300 L ${QX - 8} 300 L ${QX - 54} ${QBASE + 30} Z" fill="#ffd7a8" opacity="0.05"/>` +
  `<path d="M ${QX + 96} ${QBASE + 30} L ${QX + 22} 300 L ${QX + 8} 300 L ${QX + 54} ${QBASE + 30} Z" fill="#ffd7a8" opacity="0.04"/>` +
  (MISREGISTER
    ? `<g transform="translate(-3,0)" opacity="0.22" style="mix-blend-mode:screen">` +
      `<path d="M ${QX - 42} ${QBASE} L ${QX - 15} 300 L ${QX + 15} 300 L ${QX + 42} ${QBASE} Z" fill="${MAG}"/></g>`
    : '') +
  `</g>`;

const G_HOARDING =
  `<g><ellipse cx="956" cy="606" rx="150" ry="94" fill="url(#qhaze)" opacity="0.5" id="sc-hoard-glow"/>` +
  `<rect x="922" y="640" width="5" height="70" fill="#0a0f28"/><rect x="986" y="640" width="5" height="70" fill="#0a0f28"/>` +
  `<rect x="906" y="584" width="102" height="58" rx="2" fill="#0a0f28"/>` +
  `<rect x="911" y="589" width="92" height="48" fill="#b0762c"/>` +
  `<rect x="911" y="589" width="92" height="20" fill="#e0a04c" opacity="0.8"/>` +
  `<rect x="911" y="624" width="92" height="13" fill="#5e3a10" opacity="0.75"/>` +
  `<path d="M 928 632 L 928 601 L 962 601 L 962 609 L 938 609 L 938 613 L 956 613 L 956 621 L 938 621 L 938 632 Z" fill="#2a1705" opacity="0.9"/>` +
  `<circle cx="976" cy="606" r="7" fill="#2a1705" opacity="0.75"/>` +
  `<rect x="906" y="581" width="102" height="3" fill="#f0b464" opacity="0.5"/>` +
  `<path d="M 924 642 L 936 710 M 990 642 L 978 710 M 930 676 L 984 676" stroke="#0a0f28" stroke-width="3" fill="none"/></g>`;

function roofFigure(id: string, x: number, y: number, h: number): string {
  const hw = h * 0.3;
  return (
    `<g id="${id}" transform="translate(${x},${y})">` +
    `<path d="M ${-hw} 0 C ${n2(-hw * 0.9)} ${n2(-h * 0.5)} ${n2(-hw * 0.8)} ${n2(-h * 0.62)} ${n2(-hw * 0.5)} ${n2(-h * 0.68)} L ${n2(hw * 0.5)} ${n2(-h * 0.68)} C ${n2(hw * 0.8)} ${n2(-h * 0.62)} ${n2(hw * 0.9)} ${n2(-h * 0.5)} ${n2(hw)} 0 Z" fill="#06081a"/>` +
    `<circle cx="0" cy="${n2(-h * 0.8)}" r="${n2(h * 0.15)}" fill="#06081a"/>` +
    `<path d="M ${n2(hw * 0.55)} ${n2(-h * 0.66)} C ${n2(hw * 0.8)} ${n2(-h * 0.5)} ${n2(hw * 0.82)} ${n2(-h * 0.3)} ${n2(hw * 0.9)} 0" stroke="${HOT}" stroke-width="${n2(h * 0.045)}" fill="none" opacity="0.4"/>` +
    `<line id="${id}-arm" x1="${n2(hw * 0.55)}" y1="${n2(-h * 0.6)}" x2="${n2(hw * 0.55)}" y2="${n2(-h * 0.6)}" stroke="#06081a" stroke-width="${n2(h * 0.11)}" stroke-linecap="round"/>` +
    `</g>`
  );
}

const G_NEIGHBOURS = (() => {
  const bulbs: string[] = [];
  for (let i = 0; i < 13; i++) {
    const u = i / 12;
    const x = lerp(1478, 1900, u);
    const y = 664 + Math.sin(u * Math.PI) * 26;
    bulbs.push(`<circle class="sc-bulb" cx="${n1(x)}" cy="${n1(y)}" r="2.8" fill="#ffca7d" opacity="0.6"/>` +
      `<circle cx="${n1(x)}" cy="${n1(y)}" r="10" fill="#ffca7d" opacity="0.12"/>`);
  }
  return (
    `<g>` +
    `<rect x="-40" y="716" width="460" height="94" fill="#080c22"/>` +
    `<rect x="-40" y="713" width="460" height="3.4" fill="#232e63"/>` +
    `<rect x="-40" y="712" width="460" height="1.4" fill="#8a5f38" opacity="0.5"/>` +
    `<rect x="86" y="668" width="52" height="48" rx="6" fill="#06091c"/>` +
    `<rect x="80" y="662" width="64" height="9" rx="3" fill="#06091c"/>` +
    `<rect x="86" y="668" width="4" height="48" fill="#2b3670" opacity="0.7"/>` +
    `<path d="M 236 716 L 236 690 M 224 686 A 16 16 0 0 1 250 686" stroke="#06091c" stroke-width="3" fill="none"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-l', 330, 716, 48) : '') +
    `<rect x="1452" y="706" width="520" height="104" fill="#080c22"/>` +
    `<rect x="1452" y="703" width="520" height="3.4" fill="#232e63"/>` +
    `<rect x="1452" y="702" width="520" height="1.4" fill="#8a5f38" opacity="0.5"/>` +
    bulbs.join('') +
    `<path d="M 1478 664 Q 1689 704 1900 690" stroke="#0c1130" stroke-width="1.4" fill="none" opacity="0.9"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-r1', 1566, 706, 52) + roofFigure('sc-nb-r2', 1614, 706, 49) : '') +
    `<rect x="1108" y="692" width="196" height="62" fill="#070a1e"/>` +
    `<rect x="1108" y="690" width="196" height="2.4" fill="#212b5c"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-walk', 1130, 692, 30) : '') +
    `</g>`
  );
})();

const G_ROOFTOP =
  `<g>` +
  `<path d="M 168 618 L 168 762 M 552 636 L 552 764" stroke="#090d24" stroke-width="6"/>` +
  `<path d="M 170 618 L 170 762" stroke="#2c3770" stroke-width="1.6" opacity="0.6"/>` +
  `<path d="M 168 620 Q 360 686 552 638" stroke="#111838" stroke-width="2" fill="none"/>` +
  `<g id="sc-cloth-a">` +
  `<path d="M 240 652 L 288 660 L 292 728 L 236 720 Z" fill="#101636"/>` +
  `<path d="M 240 652 L 288 660 L 290 690 L 238 683 Z" fill="#1a2350" opacity="0.7"/>` +
  `<path d="M 288 660 L 292 728" stroke="#3a4788" stroke-width="1.5" opacity="0.8"/></g>` +
  `<g id="sc-cloth-b">` +
  `<path d="M 398 664 L 448 662 L 452 722 L 396 724 Z" fill="#0e1430"/>` +
  `<path d="M 398 664 L 448 662 L 449 692 L 397 694 Z" fill="#182047" opacity="0.7"/>` +
  `<path d="M 448 662 L 452 722" stroke="#3a4788" stroke-width="1.5" opacity="0.8"/></g>` +
  // parapet: top slab, lit lip, face, base shadow
  `<rect x="-60" y="758" width="2060" height="92" fill="#0c1128"/>` +
  `<rect x="-60" y="758" width="2060" height="12" fill="#161d44"/>` +
  `<rect x="-60" y="755" width="2060" height="4" fill="url(#edge)"/>` +
  `<rect x="-60" y="770" width="2060" height="7" fill="#070a1c" opacity="0.7"/>` +
  `<rect x="-60" y="844" width="2060" height="264" fill="url(#floor)"/>` +
  `<rect x="-60" y="842" width="2060" height="4" fill="#1a2249" opacity="0.85"/>` +
  [888, 930, 978, 1034].map((y, i) => `<line x1="-60" y1="${y}" x2="1980" y2="${y}" stroke="#151c40" stroke-width="1.5" opacity="${n2(0.55 - i * 0.1)}"/>`).join('') +
  [210, 520, 830, 1140, 1450, 1760].map((x) => `<line x1="${x}" y1="846" x2="${n1(x + (x - 960) * 0.22)}" y2="1080" stroke="#151c40" stroke-width="1.3" opacity="0.3"/>`).join('') +
  `<ellipse id="sc-pool" cx="318" cy="960" rx="440" ry="160" fill="url(#pool)"/>` +
  // stairwell mumty
  `<g><rect x="-60" y="636" width="270" height="400" fill="#05081a"/>` +
  `<rect x="-70" y="628" width="290" height="14" fill="#0a0f28"/>` +
  `<rect x="-70" y="626" width="290" height="2" fill="#2b3670" opacity="0.7"/>` +
  `<path d="M 92 1000 L 92 862 Q 92 838 126 838 Q 160 838 160 862 L 160 1000 Z" fill="#241608"/>` +
  `<path d="M 98 1000 L 98 864 Q 98 844 126 844 Q 154 844 154 864 L 154 1000 Z" fill="url(#door)"/>` +
  `<rect x="206" y="636" width="6" height="400" fill="#141c44" opacity="0.8"/></g>` +
  // water tank
  `<g><rect x="1626" y="828" width="204" height="176" rx="16" fill="#06091c"/>` +
  `<rect x="1616" y="818" width="224" height="18" rx="8" fill="#0a0e26"/>` +
  `<rect x="1626" y="828" width="9" height="176" rx="4" fill="#28336c" opacity="0.6"/>` +
  `<rect x="1616" y="818" width="224" height="3" rx="2" fill="#3d4a90" opacity="0.5"/>` +
  [0, 1, 2, 3].map((i) => `<rect x="1650" y="${856 + i * 38}" width="156" height="2" fill="#141c44" opacity="0.6"/>`).join('') +
  `<rect x="1700" y="1004" width="18" height="52" fill="#06091c"/>` +
  `<rect x="1752" y="1004" width="18" height="52" fill="#06091c"/>` +
  `<path d="M 1846 836 L 1846 1002" stroke="#06091c" stroke-width="7"/>` +
  [0, 1, 2, 3, 4].map((i) => `<line x1="1836" y1="${860 + i * 34}" x2="1858" y2="${860 + i * 34}" stroke="#06091c" stroke-width="5"/>`).join('') +
  `</g>` +
  // potted plant
  `<g><path d="M 214 1002 L 292 1002 L 282 1074 L 224 1074 Z" fill="#06091c"/>` +
  `<path d="M 214 1002 L 240 1002 L 234 1074 L 224 1074 Z" fill="#141c44" opacity="0.6"/>` +
  `<path d="M 253 1000 C 250 950 224 928 206 918 M 253 1000 C 258 946 288 926 306 920 M 253 1000 C 252 962 246 940 240 924" stroke="#080c20" stroke-width="4" fill="none"/>` +
  `<ellipse cx="204" cy="916" rx="16" ry="7" fill="#080c20" transform="rotate(-24 204 916)"/>` +
  `<ellipse cx="308" cy="918" rx="16" ry="7" fill="#080c20" transform="rotate(22 308 918)"/>` +
  `<ellipse cx="238" cy="920" rx="13" ry="6" fill="#080c20" transform="rotate(-8 238 920)"/></g>` +
  // bottle + phone
  `<g><path d="M 812 758 L 812 706 Q 812 698 818 694 L 818 676 L 830 676 L 830 694 Q 836 698 836 706 L 836 758 Z" fill="#0a1024"/>` +
  `<path d="M 830 758 L 830 706 Q 830 699 834 695 L 834 677 L 830 677 L 830 694 Q 836 698 836 706 L 836 758 Z" fill="#5d8a4e" opacity="0.35"/>` +
  `<rect x="814" y="724" width="20" height="32" fill="#3c5c2e" opacity="0.55"/>` +
  `<path d="M 833 700 L 833 752" stroke="#a8d08a" stroke-width="1.6" opacity="0.4"/>` +
  `<rect x="500" y="748" width="52" height="11" rx="3" fill="#080c20"/>` +
  `<rect x="500" y="747" width="52" height="2" rx="1" fill="#39457f" opacity="0.8"/></g>` +
  `</g>`;

/* ─────────────────────────── the character ─────────────────────────── */

const G_FIGURE =
  `<g id="sc-figure" transform="translate(${FX},${FY})">` +
  (MISREGISTER
    ? `<g transform="translate(-3.5,1.5)" opacity="0.24" style="mix-blend-mode:screen"><path id="sc-ghost-m" fill="#2a0f3a"/></g>` +
      `<g transform="translate(3.5,-1.5)" opacity="0.20" style="mix-blend-mode:screen"><path id="sc-ghost-c" fill="#06303c"/></g>`
    : '') +
  `<path id="sc-knee" fill="${INK}"/>` +
  `<path id="sc-knee2" fill="#101433"/>` +
  `<path d="M 96 188 C 106 198 113 216 116 234" stroke="#1e2450" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round"/>` +
  `<ellipse cx="86" cy="255" rx="25" ry="8.5" fill="${INK}"/>` +
  `<path id="sc-sil-ink" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>` +
  `<path id="sc-sil-fill" fill="#0f1230"/>` +
  `<path id="sc-back" fill="#08091f"/>` +
  `<path id="sc-lit" fill="#1a1f47" opacity="0.9"/>` +
  `<path d="M 201 256 C 205 210 205 162 201 126" stroke="#242b5c" stroke-width="7" opacity="0.28" stroke-linecap="round" fill="none"/>` +
  (HALFTONE ? `<path id="sc-ht" fill="url(#ht)" opacity="0.16"/>` : '') +
  // hood: back peak, gather at the shoulders, fold lines
  `<path id="sc-hood1" stroke="#242b5c" stroke-width="2.6" fill="none" opacity="0.34" stroke-linecap="round"/>` +
  `<path id="sc-hood2" stroke="#07081c" stroke-width="4" fill="none" opacity="0.92"/>` +
  `<path id="sc-hood3" stroke="#07081c" stroke-width="2.2" fill="none" opacity="0.5"/>` +
  `<path id="sc-hood4" stroke="#07081c" stroke-width="3" fill="none" opacity="0.7"/>` +
  `<path id="sc-hood5" stroke="#20264f" stroke-width="1.5" fill="none" opacity="0.45"/>` +
  // the hood opening, and his profile inside it
  `<path id="sc-open-fill" fill="#05061a"/>` +
  `<path id="sc-open-a" stroke="#05061a" stroke-width="5" fill="none"/>` +
  `<path id="sc-open-b" stroke="#b87e46" stroke-width="1.3" fill="none"/>` +
  `<g id="sc-face"><path id="sc-profile" stroke="${SKIN_RIM}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<circle id="sc-facelight" cx="208" r="13" fill="${HOT}"/></g>` +
  // rim lights
  `<path id="sc-rim-hot" stroke="${HOT}" stroke-width="3.4" fill="none" opacity="0.58" stroke-linecap="round"/>` +
  `<path id="sc-rim-pale" stroke="#ffd39a" stroke-width="1.6" fill="none" opacity="0.45" stroke-linecap="round"/>` +
  `<path id="sc-rim-cool" stroke="${COOL}" stroke-width="2.2" fill="none" opacity="0.2" stroke-linecap="round"/>` +
  // hem + pocket
  `<path d="M 112 232 C 152 244 199 243 237 232" stroke="#07081c" stroke-width="4" fill="none" opacity="0.75"/>` +
  `<path d="M 112 236 C 152 248 199 247 237 236" stroke="#252c5e" stroke-width="1.5" fill="none" opacity="0.42"/>` +
  `<path d="M 150 190 C 172 200 196 200 214 192" stroke="#07081c" stroke-width="2.6" fill="none" opacity="0.45"/>` +
  armMarkup('r') + armMarkup('l') +
  // cigarette
  `<line id="sc-cig-ink" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/>` +
  `<line id="sc-cig-body" stroke="#cfc7b2" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>` +
  `<circle id="sc-cig-1" r="3.2" fill="#ff8a34"/>` +
  `<circle id="sc-cig-2" r="1.5" fill="#fff0c8"/>` +
  `<circle id="sc-cig-3" r="8" fill="#ff8b3c"/>` +
  `<circle id="sc-cig-4" r="24" fill="#ff9a4a"/>` +
  // glass
  `<g id="sc-glass">` +
  `<path d="M -13 0 L -11 -31 L 11 -31 L 13 0 Z" fill="${INK}" opacity="0.55"/>` +
  `<path d="M -12 0 L -10 -30 L 10 -30 L 12 0 Z" fill="#9fc6e4" opacity="0.10"/>` +
  `<path d="M -10.5 -9 L -11.6 0 L 11.6 0 L 10.5 -9 Z" fill="#d0782f" opacity="0.5"/>` +
  `<path d="M -10.5 -9 L 10.5 -9 L 10.7 -7 L -10.7 -7 Z" fill="#ffb066" opacity="0.45"/>` +
  `<path d="M -12 0 L -10 -30 L 10 -30 L 12 0 Z" stroke="#cfe4f6" stroke-width="1.2" fill="none" opacity="0.3"/>` +
  `<line x1="-8" y1="-27" x2="-9.4" y2="-4" stroke="#ffe6c2" stroke-width="1.4" opacity="0.3"/>` +
  `<circle cx="7" cy="-6" r="1.8" fill="#ffcf94" opacity="0.45"/></g>` +
  `</g>`;

function armMarkup(side: 'l' | 'r'): string {
  return (
    `<g>` +
    `<path id="sc-${side}-up-ink" stroke="${INK}" stroke-linecap="round" fill="none"/>` +
    `<path id="sc-${side}-lo-ink" stroke="${INK}" stroke-linecap="round" fill="none"/>` +
    `<path id="sc-${side}-up" stroke="#12162f" stroke-linecap="round" fill="none"/>` +
    `<path id="sc-${side}-lo" stroke="#12162f" stroke-linecap="round" fill="none"/>` +
    `<path id="sc-${side}-rim" stroke="${HOT}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.3" transform="translate(4,-4)"/>` +
    `<circle id="sc-${side}-h1" r="10.5" fill="${INK}"/>` +
    `<circle id="sc-${side}-h2" r="8.2" fill="#14183a"/>` +
    `<circle id="sc-${side}-h3" r="3.2" fill="#232a57" opacity="0.8"/>` +
    `</g>`
  );
}

/* ─────────────────────────── mount ─────────────────────────── */

const GRAIN_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>',
)}")`;

const SKY = `linear-gradient(180deg,
  #03051a 0%, #050a28 26%, #0a1440 44%, #131b52 57%,
  #241e5c 67%, #43215a 76%, #7d2b4f 84%, #b8452f 90%,
  #dd6d28 95%, #5c2c14 100%)`;

const SMOG_BAND = `linear-gradient(180deg,
  rgba(212,96,64,0) 0%,
  rgba(212,96,64,${(0.1 * SMOG).toFixed(4)}) 44%,
  rgba(232,124,58,${(0.27 * SMOG).toFixed(4)}) 78%,
  rgba(160,74,40,${(0.17 * SMOG).toFixed(4)}) 100%)`;

const SMOG_QGLOW = `radial-gradient(ellipse at 50% 82%,
  rgba(255,166,88,${(0.17 * SMOG).toFixed(4)}) 0%, rgba(255,166,88,0) 66%)`;

interface Refs {
  stage: HTMLElement;
  world: HTMLElement;
  stars: SVGCircleElement[];
  liveWinRects: SVGRectElement[];
  liveWinGlows: SVGCircleElement[];
  cars: SVGGElement[];
  bulbs: SVGCircleElement[];
  smoke: HTMLElement;
  endcard: HTMLElement;
  endLayers: HTMLElement[];
  endWrap: HTMLElement;
  endLine: HTMLElement;
  hoardGlow: SVGElement;
  pool: SVGElement;
  smogBand: HTMLElement;
  q: (id: string) => SVGElement;
}

let refs: Refs | null = null;
let smokeEls: HTMLElement[] = [];
const SMOKE_N = 16;
const EXHALE_N = 22;

const LIVE_WINS = (() => {
  const r = rng(991);
  const out: { x: number; y: number; c: string; k: number; p: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const b = MID[Math.floor(r() * MID.length)]!;
    out.push({
      x: b.x + 8 + r() * (b.w - 22), y: b.y + 10 + r() * (b.h - 24),
      c: r() > 0.75 ? '#a8d8ff' : '#ffc074',
      k: 1 + Math.floor(r() * 5), p: r(),
    });
  }
  return out;
})();

const CARS = (() => {
  const r = rng(404);
  const out: { k: number; p: number; lane: number; s: number }[] = [];
  for (let i = 0; i < 11; i++) {
    out.push({ k: 1 + Math.floor(r() * 2), p: r(), lane: r() > 0.5 ? 0 : 1, s: 0.6 + r() * 0.7 });
  }
  return out;
})();

export function mount(root: HTMLElement): void {
  root.innerHTML = `
<div class="sc-stage" id="sc-stage">
 <div class="sc-world" id="sc-world">
  <div class="sc-sky" style="background:${SKY}"></div>
  ${HALFTONE ? `<div class="sc-ht sc-ht-a"></div><div class="sc-ht sc-ht-b"></div>` : ''}
  <div class="sc-moonglow"></div>

  <svg class="sc-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="qhaze">
        <stop offset="0%" stop-color="#ffb26a" stop-opacity="0.17"/>
        <stop offset="58%" stop-color="#ff8a4d" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#ff8a4d" stop-opacity="0"/>
      </radialGradient>
      <pattern id="ht" width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="3.5" cy="3.5" r="1.5" fill="#39407e" opacity="0.7"/>
      </pattern>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#8a5f38" stop-opacity="0"/>
        <stop offset="26%" stop-color="#9c6c3e" stop-opacity="0.6"/>
        <stop offset="62%" stop-color="#c08347" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="#8a5f38" stop-opacity="0.16"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0d1230"/><stop offset="38%" stop-color="#080b20"/>
        <stop offset="100%" stop-color="#030411"/>
      </linearGradient>
      <radialGradient id="pool">
        <stop offset="0%" stop-color="#e08a3a" stop-opacity="0.16"/>
        <stop offset="45%" stop-color="#c9762f" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="#c9762f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="door" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#d98f3a" stop-opacity="0.6"/>
        <stop offset="55%" stop-color="#8c5522" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#3a2210" stop-opacity="0.12"/>
      </linearGradient>
    </defs>

    <g id="sc-stars">${STARS.map((s, i) => `<circle cx="${n1(s.x)}" cy="${n1(s.y)}" r="${n2(s.r)}" fill="${i % 7 === 0 ? '#9fe8ff' : '#e6ecff'}"/>`).join('')}</g>
    <path d="M 300 241 A 27 27 0 1 0 300 295 A 34 34 0 0 1 300 241 Z" fill="#f4f0e2" opacity="0.85"/>
    ${FLIGHT ? svgPlane() : ''}
    ${G_FAR}
    ${MISREGISTER ? G_FAR_CMY : ''}
    ${G_QUTUB_LIGHT}
    ${G_QUTUB}
    ${G_MID}
    ${G_HOARDING}
    <g id="sc-livewins">${LIVE_WINS.map((w) =>
      `<g><rect x="${n1(w.x)}" y="${n1(w.y)}" width="3.1" height="4.5" fill="${w.c}"/>` +
      `<circle cx="${n1(w.x + 1.5)}" cy="${n1(w.y + 2)}" r="7" fill="${w.c}"/></g>`).join('')}</g>
    <g>
      <path d="M 380 730 L 1470 706 L 1470 718 L 380 744 Z" fill="#0b1130" opacity="0.9"/>
      <path d="M 380 730 L 1470 706" stroke="#2a3568" stroke-width="1.2" opacity="0.6"/>
      <g id="sc-cars">${CARS.map((c) => {
        const col = c.lane ? '#ff4a6a' : '#ffe4b0';
        return `<g><ellipse rx="${n2(5 * c.s)}" ry="1.5" fill="${col}" opacity="0.9"/>` +
          `<ellipse rx="${n2(14 * c.s)}" ry="3.6" fill="${col}" opacity="0.11"/></g>`;
      }).join('')}</g>
    </g>
  </svg>

  <div class="sc-smog" id="sc-smog" style="background:${SMOG_BAND}"></div>
  <div class="sc-qglow" style="background:${SMOG_QGLOW}"></div>

  <svg class="sc-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${G_NEAR_BAND}
    ${G_NEIGHBOURS}
    ${G_ROOFTOP}
    ${G_FIGURE}
  </svg>

  <div class="sc-smoke" id="sc-smoke"></div>
 </div>
</div>

<!--
  The title card and the grade sit OUTSIDE the stage, in viewport space. In the
  original the stage was the screen, so these could live inside it; here the stage is
  scaled and subject-anchored, which pushed the card off-frame on portrait and left
  the vignette framing nothing.
-->
<div class="sc-endcard" id="sc-endcard">
  <div class="sc-end-wrap" id="sc-end-wrap">
    <div class="sc-end-ghost sc-end-mag" id="sc-end-mag">दिल्ली</div>
    <div class="sc-end-ghost sc-end-cool" id="sc-end-cool">दिल्ली</div>
    <div class="sc-end-main">दिल्ली</div>
  </div>
  <div class="sc-end-line" id="sc-end-line"><i></i><span>every week ends here</span><i></i></div>
</div>

<div class="sc-vignette"></div>
<div class="sc-warmlift"></div>
${GRAIN ? `<div class="sc-grain" style="background-image:${GRAIN_URL}"></div>` : ''}`;

  const q = (id: string) => root.querySelector(`#${id}`) as SVGElement;
  refs = {
    stage: root.querySelector('#sc-stage') as HTMLElement,
    world: root.querySelector('#sc-world') as HTMLElement,
    stars: [...root.querySelectorAll('#sc-stars circle')] as SVGCircleElement[],
    liveWinRects: [...root.querySelectorAll('#sc-livewins rect')] as SVGRectElement[],
    liveWinGlows: [...root.querySelectorAll('#sc-livewins circle')] as SVGCircleElement[],
    cars: [...root.querySelectorAll('#sc-cars > g')] as SVGGElement[],
    bulbs: [...root.querySelectorAll('.sc-bulb')] as SVGCircleElement[],
    smoke: root.querySelector('#sc-smoke') as HTMLElement,
    endcard: root.querySelector('#sc-endcard') as HTMLElement,
    endWrap: root.querySelector('#sc-end-wrap') as HTMLElement,
    endLayers: [root.querySelector('#sc-end-mag'), root.querySelector('#sc-end-cool')] as HTMLElement[],
    endLine: root.querySelector('#sc-end-line') as HTMLElement,
    hoardGlow: q('sc-hoard-glow'),
    pool: q('sc-pool'),
    smogBand: root.querySelector('#sc-smog') as HTMLElement,
    q,
  };

  const puffs: string[] = [];
  for (let i = 0; i < SMOKE_N + EXHALE_N; i++) puffs.push('<div class="sc-puff"></div>');
  refs.smoke.innerHTML = puffs.join('');
  smokeEls = [...refs.smoke.children] as HTMLElement[];
}

function svgPlane(): string {
  return (
    `<g id="sc-plane" opacity="0">` +
    `<ellipse cx="0" cy="0" rx="13" ry="2.3" fill="#0c1130"/>` +
    `<path d="M 2 0 L -7 7 L -2 7.6 L 6 0.8 Z" fill="#0c1130"/>` +
    `<path d="M 2 0 L -7 -6 L -2 -6.6 L 6 -0.8 Z" fill="#0c1130"/>` +
    `<path d="M -12 0 L -16 -4 L -13 -0.4 Z" fill="#0c1130"/>` +
    `<path d="M -11 -1 L 8 -1.4" stroke="#5b6bb8" stroke-width="0.8" opacity="0.7"/>` +
    `<circle id="sc-plane-r" cx="-7" cy="7" r="1.9" fill="#ff3b6b"/>` +
    `<circle id="sc-plane-g" cx="-7" cy="-6" r="1.9" fill="#43ff96"/>` +
    `<circle id="sc-plane-s" cx="0" cy="0" r="3" fill="#ffffff"/>` +
    `<circle cx="12" cy="1" r="2" fill="#fff3d6" opacity="0.45"/></g>`
  );
}

/* ─────────────────────────── per-frame ─────────────────────────── */

const CALM_CAM = camera(0);
const set = (el: Element | null, name: string, value: string | number) => {
  if (el) el.setAttribute(name, String(value));
};

/** The figure, in world space — what the crop must not lose. */
const SUBJECT = { x: 590, y: 660 };
const FOLLOW = 0.75;

/**
 * Scale the stage to cover the viewport.
 *
 * Plain `cover` centres the stage, which is wrong here: the camera frames the figure
 * left of centre, so a narrow portrait crop sliced him out of frame entirely. The crop
 * window tracks the subject, clamped so it never runs past the composition's edges.
 */
function place(cam: { s: number; cx: number; cy: number }): void {
  if (!refs) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const k = Math.max(vw / W, vh / H);
  const visW = vw / k;
  const visH = vh / k;
  const subjX = W / 2 + (SUBJECT.x - cam.cx) * cam.s;
  const subjY = H / 2 + (SUBJECT.y - cam.cy) * cam.s;

  const offset = (vis: number, total: number, subj: number, viewport: number) => {
    if (vis >= total) return (viewport - total * k) / 2;
    return -(clamp(lerp(total / 2, subj, FOLLOW), vis / 2, total - vis / 2) - vis / 2) * k;
  };

  refs.stage.style.transform =
    `translate(${offset(visW, W, subjX, vw).toFixed(2)}px, ${offset(visH, H, subjY, vh).toFixed(2)}px) scale(${k.toFixed(5)})`;
}

export function render(
  T: number,
  energy: { bass: number; mid: number; treble: number },
  calmCamera = false,
): void {
  if (!refs) return;
  const r = refs;
  const p = pose(T);
  // Reduced motion pins the camera to the establishing wide. The push-in is what
  // provokes motion sensitivity; the ambient life of the city does not, and freezing
  // the whole piece just leaves a still image.
  const cam = calmCamera ? CALM_CAM : camera(T);

  place(cam);
  r.world.style.transform =
    `translate(${(W / 2 - cam.cx * cam.s).toFixed(2)}px, ${(H / 2 - cam.cy * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(4)})`;

  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i]!;
    set(r.stars[i]!, 'opacity',
      (s.o * (0.6 + 0.4 * cyc(T, s.c, s.p)) * 0.85 * (1 + energy.treble * 0.5)).toFixed(3));
  }

  if (FLIGHT) {
    const o = seq(T, [[10.4, 0], [11.3, 1], [17.6, 1], [18.6, 0]]);
    const plane = r.q('sc-plane');
    set(plane, 'opacity', o.toFixed(3));
    if (o > 0.001) {
      const x = seq(T, [[10.6, 400], [18.6, 1930]], MOTION.drift);
      const y = seq(T, [[10.6, 344], [18.6, 412]], MOTION.drift);
      set(plane, 'transform', `translate(${n1(x)},${n1(y)}) rotate(2.4) scale(0.78)`);
      const beacon = T % 1 < 0.13 ? 1 : 0;
      const strobe = (T * 1.25) % 1 < 0.055 ? 1 : 0;
      set(r.q('sc-plane-r'), 'opacity', 0.2 + beacon * 0.8);
      set(r.q('sc-plane-g'), 'opacity', 0.2 + beacon * 0.8);
      set(r.q('sc-plane-s'), 'opacity', strobe * 0.85);
    }
  }

  for (let i = 0; i < LIVE_WINS.length; i++) {
    const w = LIVE_WINS[i]!;
    const v = 0.5 + 0.5 * cyc(T, w.k, w.p);
    const lift = 1 + energy.mid * 0.6;
    set(r.liveWinRects[i]!, 'opacity', Math.min(1, (0.15 + v * 0.8) * lift).toFixed(3));
    set(r.liveWinGlows[i]!, 'opacity', Math.min(1, v * 0.07 * lift).toFixed(3));
  }

  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i]!;
    let u = ((T * c.k) / TOTAL + c.p) % 1;
    if (c.lane) u = 1 - u;
    const x = lerp(380, 1470, u);
    const y = lerp(737, 711, u) + (c.lane ? 4 : -1);
    set(r.cars[i]!, 'transform', `translate(${n1(x)},${n1(y)})`);
  }

  if (ROOF_FOLKS) {
    const sway = cyc(T, 2, 0.15) * 1.6;
    const raise = -1.15 + 0.85 * Math.max(0, cyc(T, 2, 0.62));
    const walk = ((T * 1) / TOTAL + 0.1) % 1;
    set(r.q('sc-nb-l'), 'transform', `translate(330,716) rotate(${n2(sway * 0.6)})`);
    set(r.q('sc-nb-r1'), 'transform', `translate(1566,706) rotate(${n2(sway)})`);
    set(r.q('sc-nb-r2'), 'transform', `translate(1614,706) rotate(${n2(-sway * 0.8)})`);
    set(r.q('sc-nb-walk'), 'transform', `translate(${n1(lerp(1130, 1280, walk))},692) rotate(${n2(sway * 0.5)})`);
    const arm = r.q('sc-nb-r1-arm');
    if (arm) {
      const hw = 52 * 0.3;
      set(arm, 'x2', n2(hw * 0.55 + Math.cos(raise) * 52 * 0.42));
      set(arm, 'y2', n2(-52 * 0.6 + Math.sin(raise) * 52 * 0.42));
    }
  }
  for (let i = 0; i < r.bulbs.length; i++) {
    set(r.bulbs[i]!, 'opacity', (0.55 + 0.45 * Math.abs(cyc(T, 2, i * 0.11))).toFixed(3));
  }

  set(r.q('sc-cloth-a'), 'transform', `rotate(${n2(cyc(T, 2, 0) * 2.2)} 262 654)`);
  set(r.q('sc-cloth-b'), 'transform', `rotate(${n2(cyc(T, 2, 0.33) * 2.6)} 420 668)`);

  figure(r, p);
  smoke(T);
  endCard(r, T);

  set(r.hoardGlow, 'opacity', (0.5 + energy.bass * 0.35).toFixed(3));
  set(r.pool, 'opacity', (1 + energy.bass * 0.5).toFixed(3));
  r.smogBand.style.opacity = (0.85 + energy.bass * 0.15).toFixed(3);
}

function figure(r: Refs, p: Pose): void {
  const b = p.breath;

  const SIL =
    `M 106 258 C 100 214 104 170 116 ${n2(152 + b)}
     C 124 ${n2(142 + b)} 132 ${n2(138 + b)} 138 ${n2(134 + b)}
     C 128 ${n2(116 + b)} 130 ${n2(82 + b)} 148 ${n2(62 + b)}
     C 156 ${n2(52 + b)} 168 ${n2(46 + b)} 182 ${n2(45 + b)}
     C 200 ${n2(44 + b)} 214 ${n2(56 + b)} 219 ${n2(76 + b)}
     C 224 ${n2(96 + b)} 222 ${n2(118 + b)} 216 ${n2(132 + b)}
     C 226 ${n2(137 + b)} 233 ${n2(143 + b)} 237 ${n2(155 + b)}
     C 243 191 241 227 239 258 Z`;

  if (MISREGISTER) {
    set(r.q('sc-ghost-m'), 'd', SIL);
    set(r.q('sc-ghost-c'), 'd', SIL);
  }
  set(r.q('sc-sil-ink'), 'd', SIL);
  set(r.q('sc-sil-fill'), 'd', SIL);

  set(r.q('sc-knee'), 'd',
    `M 112 ${n2(254 + b * 0.2)} C 92 246 74 222 72 198 C 70 182 84 174 96 184 C 110 196 118 224 120 250 Z`);
  set(r.q('sc-knee2'), 'd',
    `M 114 250 C 96 242 79 220 77 199 C 76 187 86 181 95 188 C 108 199 116 224 118 248 Z`);

  set(r.q('sc-back'), 'd',
    `M 106 258 C 100 214 104 170 116 ${n2(152 + b)} C 124 ${n2(142 + b)} 132 ${n2(138 + b)} 138 ${n2(134 + b)}
     C 128 ${n2(116 + b)} 130 ${n2(82 + b)} 148 ${n2(62 + b)} C 156 ${n2(52 + b)} 166 ${n2(47 + b)} 176 ${n2(45 + b)}
     L 172 258 Z`);

  set(r.q('sc-lit'), 'd',
    `M 192 ${n2(46 + b)} C 206 ${n2(50 + b)} 216 ${n2(60 + b)} 219 ${n2(78 + b)}
     C 223 ${n2(98 + b)} 222 ${n2(118 + b)} 216 ${n2(132 + b)}
     C 226 ${n2(137 + b)} 233 ${n2(143 + b)} 237 ${n2(155 + b)} C 243 191 241 227 239 258
     L 217 258 C 219 200 216 130 206 ${n2(58 + b)} Z`);

  if (HALFTONE) {
    set(r.q('sc-ht'), 'd',
      `M 120 254 C 114 214 118 178 124 ${n2(152 + b)} C 130 ${n2(138 + b)} 134 ${n2(124 + b)} 136 ${n2(104 + b)} L 158 ${n2(106 + b)} L 156 254 Z`);
  }

  set(r.q('sc-hood1'), 'd', `M 142 ${n2(72 + b)} C 148 ${n2(58 + b)} 158 ${n2(50 + b)} 172 ${n2(47 + b)}`);
  set(r.q('sc-hood2'), 'd', `M 138 ${n2(112 + b)} C 150 ${n2(126 + b)} 172 ${n2(132 + b)} 198 ${n2(128 + b)}`);
  set(r.q('sc-hood3'), 'd', `M 141 ${n2(92 + b)} C 152 ${n2(104 + b)} 176 ${n2(110 + b)} 202 ${n2(105 + b)}`);
  set(r.q('sc-hood4'), 'd', `M 152 ${n2(134 + b)} C 172 ${n2(145 + b)} 198 ${n2(145 + b)} 214 ${n2(136 + b)}`);
  set(r.q('sc-hood5'), 'd', `M 146 ${n2(130 + b)} C 168 ${n2(141 + b)} 196 ${n2(141 + b)} 211 ${n2(132 + b)}`);

  const openCurve = `M 200 ${n2(52 + b)} C 212 ${n2(68 + b)} 214 ${n2(106 + b)} 206 ${n2(130 + b)}`;
  set(r.q('sc-open-fill'), 'd',
    `${openCurve} C 212 ${n2(126 + b)} 218 ${n2(112 + b)} 219 ${n2(88 + b)} C 220 ${n2(68 + b)} 211 ${n2(55 + b)} 200 ${n2(52 + b)} Z`);
  set(r.q('sc-open-a'), 'd', openCurve);
  set(r.q('sc-open-b'), 'd', openCurve);
  set(r.q('sc-open-b'), 'opacity', (0.24 + p.faceLit * 0.46).toFixed(3));

  set(r.q('sc-face'), 'opacity', (0.35 + p.faceLit * 0.6).toFixed(3));
  set(r.q('sc-profile'), 'd',
    `M 203 ${n2(68 + b)} C 209 ${n2(74 + b)} 211 ${n2(80 + b)} 209 ${n2(86 + b)} L 215 ${n2(94 + b)} L 208 ${n2(98 + b)}
     C 210 ${n2(102 + b)} 210 ${n2(105 + b)} 207 ${n2(107 + b)} C 210 ${n2(113 + b)} 208 ${n2(119 + b)} 203 ${n2(123 + b)}`);
  set(r.q('sc-facelight'), 'cy', n2(92 + b));
  set(r.q('sc-facelight'), 'opacity', (p.faceLit * 0.16).toFixed(3));

  set(r.q('sc-rim-hot'), 'd',
    `M 210 ${n2(50 + b)} C 220 ${n2(60 + b)} 224 ${n2(96 + b)} 216 ${n2(132 + b)} C 226 ${n2(137 + b)} 233 ${n2(143 + b)} 237 ${n2(155 + b)} C 243 191 241 227 239 258`);
  set(r.q('sc-rim-pale'), 'd',
    `M 216 ${n2(132 + b)} C 226 ${n2(137 + b)} 233 ${n2(143 + b)} 237 ${n2(155 + b)} C 241 173 241 197 240 215`);
  set(r.q('sc-rim-cool'), 'd',
    `M 116 ${n2(152 + b)} C 124 ${n2(142 + b)} 132 ${n2(138 + b)} 138 ${n2(134 + b)} C 128 ${n2(116 + b)} 130 ${n2(82 + b)} 148 ${n2(62 + b)} C 154 ${n2(54 + b)} 162 ${n2(49 + b)} 170 ${n2(46 + b)}`);

  arm(r, 'r', 218, 156, p.rE, p.rH, 26, 21, -7, b);
  arm(r, 'l', 140, 154, p.lE, p.lH, 26, 21, 9, b);

  const ink = r.q('sc-cig-ink');
  const body = r.q('sc-cig-body');
  for (const el of [ink, body]) {
    set(el, 'x1', n2(p.lH[0])); set(el, 'y1', n2(p.lH[1]));
    set(el, 'x2', n2(p.cig[0])); set(el, 'y2', n2(p.cig[1]));
  }
  const embers: [string, number][] = [
    ['sc-cig-1', 0.55 + p.ember * 0.45],
    ['sc-cig-2', 0.4 + p.ember * 0.6],
    ['sc-cig-3', p.ember * 0.3],
    ['sc-cig-4', p.ember * 0.12],
  ];
  for (const [id, o] of embers) {
    const el = r.q(id);
    set(el, 'cx', n2(p.cig[0]));
    set(el, 'cy', n2(p.cig[1]));
    set(el, 'opacity', o.toFixed(3));
  }

  set(r.q('sc-glass'), 'transform',
    `translate(${n2(p.glass[0])},${n2(p.glass[1])}) rotate(${n2(p.glassRot)})`);
}

/** Arms are drawn as bent quadratics with an ink outline under a lighter core. */
function arm(
  r: Refs, side: 'l' | 'r', ox: number, oy: number,
  e: number[], h: number[], wUp: number, wLo: number, bend: number, b: number,
): void {
  const mx = (e[0]! + h[0]!) / 2;
  const my = (e[1]! + h[1]!) / 2;
  const dx = h[0]! - e[0]!;
  const dy = h[1]! - e[1]!;
  const len = Math.hypot(dx, dy) || 1;
  const fore = `M ${n2(e[0]!)} ${n2(e[1]!)} Q ${n2(mx - (dy / len) * bend)} ${n2(my + (dx / len) * bend)} ${n2(h[0]!)} ${n2(h[1]!)}`;
  const upper = `M ${ox} ${n2(oy + b)} Q ${n2((ox + e[0]!) / 2 + 4)} ${n2((oy + b + e[1]!) / 2)} ${n2(e[0]!)} ${n2(e[1]!)}`;

  set(r.q(`sc-${side}-up-ink`), 'd', upper);
  set(r.q(`sc-${side}-up-ink`), 'stroke-width', wUp + 5);
  set(r.q(`sc-${side}-lo-ink`), 'd', fore);
  set(r.q(`sc-${side}-lo-ink`), 'stroke-width', wLo + 5);
  set(r.q(`sc-${side}-up`), 'd', upper);
  set(r.q(`sc-${side}-up`), 'stroke-width', wUp);
  set(r.q(`sc-${side}-lo`), 'd', fore);
  set(r.q(`sc-${side}-lo`), 'stroke-width', wLo);
  set(r.q(`sc-${side}-rim`), 'd', fore);

  set(r.q(`sc-${side}-h1`), 'cx', n2(h[0]!)); set(r.q(`sc-${side}-h1`), 'cy', n2(h[1]!));
  set(r.q(`sc-${side}-h2`), 'cx', n2(h[0]!)); set(r.q(`sc-${side}-h2`), 'cy', n2(h[1]!));
  set(r.q(`sc-${side}-h3`), 'cx', n2(h[0]! + 2.4)); set(r.q(`sc-${side}-h3`), 'cy', n2(h[1]! - 2.4));
}

function smoke(T: number): void {
  const LIFE = 3.9;
  let n = 0;

  for (let i = 0; i < SMOKE_N; i++) {
    const u = (T / LIFE + i / SMOKE_N) % 1;
    const age = u * LIFE;
    const src = pose(T - age).cigW;
    const k = age / LIFE;
    const w = ((i * 37) % 11) / 11;
    const size = lerp(11, 128, Math.pow(k, 0.6));
    const o = Math.min(1, k / 0.3) * Math.pow(1 - k, 1.9) * 0.62 * (0.6 + 0.4 * w);
    puff(n++, src[0] + age * 25 + Math.sin(age * 1.6 + i * 2.1) * 14,
      src[1] - Math.pow(age, 1.2) * 48, size, 0.95 - k * 0.45 + w * 0.15, o, (i * 53) % 180);
  }

  // The long exhale after the drag — v2 dissipates faster and harder.
  for (let i = 0; i < EXHALE_N; i++) {
    const birth = 8.66 + i * 0.075;
    const age = T - birth;
    if (age < 0 || age > 3.2) { hide(n++); continue; }
    const k = age / 3.2;
    const w = ((i * 29) % 13) / 13;
    const src = pose(birth).mouthW;
    const size = lerp(18, 176, Math.pow(k, 0.55));
    const o = Math.min(1, k / 0.22) * Math.pow(1 - k, 2.6) * 0.62 * (0.6 + 0.4 * w);
    puff(n++, src[0] + Math.pow(age, 0.9) * 66 + Math.sin(age * 1.2 + i) * 18 + i * 2.4,
      src[1] - Math.pow(age, 1.15) * 44 - i, size, 0.92 - k * 0.45 + w * 0.14, o, (i * 41) % 180);
  }
}

function puff(i: number, x: number, y: number, size: number, ar: number, o: number, rot: number): void {
  const el = smokeEls[i];
  if (!el) return;
  const h = size * ar;
  el.style.cssText =
    `position:absolute;left:0;top:0;width:${n1(size)}px;height:${n1(h)}px;` +
    `border-radius:50%;opacity:${Math.max(0, o).toFixed(3)};` +
    `transform:translate(${n1(x - size / 2)}px,${n1(y - h / 2)}px) rotate(${rot}deg);` +
    `background:radial-gradient(closest-side, rgba(226,232,246,0.32) 0%, rgba(214,222,242,0.21) 28%, rgba(202,212,236,0.10) 50%, rgba(192,204,230,0.035) 72%, rgba(190,202,226,0) 92%)`;
}

function hide(i: number): void {
  const el = smokeEls[i];
  if (el) el.style.opacity = '0';
}

function endCard(r: Refs, T: number): void {
  const o1 = seq(T, [[16.3, 0], [17.35, 1], [18.9, 1], [19.75, 0]]);
  const o2 = seq(T, [[17.35, 0], [18.15, 1], [18.9, 1], [19.5, 0]]);
  if (o1 <= 0.002 && o2 <= 0.002) {
    r.endcard.style.opacity = '0';
    return;
  }
  r.endcard.style.opacity = '1';

  const y1 = seq(T, [[16.3, 26], [17.6, 0]]);
  const b1 = seq(T, [[16.3, 10], [17.5, 0]]);
  // The plates converge as the card settles — the press coming into register.
  const sp = seq(T, [[16.3, 7], [18.2, 0]]);
  const y2 = seq(T, [[17.35, 14], [18.4, 0]]);

  r.endWrap.style.opacity = o1.toFixed(3);
  r.endWrap.style.transform = `translateY(${n2(y1)}px)`;
  r.endWrap.style.filter = `blur(${n2(b1)}px)`;
  r.endLayers[0]!.style.transform = `translate(${n2(-sp)}px, ${n2(sp * 0.4)}px)`;
  r.endLayers[1]!.style.transform = `translate(${n2(sp)}px, ${n2(-sp * 0.4)}px)`;
  r.endLine.style.opacity = o2.toFixed(3);
  r.endLine.style.transform = `translateY(${n2(y2)}px)`;
}
