/**
 * "Dilli, 11:40 pm" — a south Delhi rooftop, ported from the Claude Design
 * composition `Delhi Rooftop.dc.html` (project "Rooftop Scene Delhi Night").
 *
 * The original is a React component driven by a composition runtime that supplies an
 * authored time axis T. This is a faithful vanilla port: React and the runtime would
 * have cost ~45 KB gzipped for what is, here, a background.
 *
 * The model is unchanged — the whole scene is a pure function of T over a 20 second
 * loop. Static scenery is built once as markup; each frame only writes the attributes
 * that actually move.
 *
 * Faithfulness note: the scenery is generated from ONE shared PRNG consumed in a
 * specific order (FAR, MID, far windows, mid windows, stars, mid antennae, near band).
 * That order is load-bearing — changing it produces a different skyline — so it is
 * preserved exactly.
 */

const W = 1920;
const H = 1080;
const FX = 470;
const FY = 500;
export const TOTAL = 20;

/** Tweak defaults baked in from the design's TWEAK_DEFAULTS block. */
const SMOG = 0.75;
const GRAIN = true;
const FLIGHT = true;
const ROOF_FOLKS = true;

/* ─────────────────────────── motion ─────────────────────────── */

const Easing = {
  easeOutCubic: (t: number) => --t * t * t + 1,
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
  glide: (a: number, b: number, s: number, e: number) =>
    animate(a, b, s, e, Easing.easeInOutCubic),
  drift: (a: number, b: number, s: number, e: number) =>
    animate(a, b, s, e, Easing.easeInOutSine),
};

type Keys = readonly (readonly [number, number])[];

/** Piecewise keyframe lookup — the only thing that eases in the whole piece. */
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

/**
 * Every cyclic value completes a whole number of cycles per TOTAL, so the loop seam
 * is exact and nothing jumps at the wrap.
 */
const cyc = (T: number, cycles: number, phase = 0) =>
  Math.sin(Math.PI * 2 * ((T * cycles) / TOTAL + phase));

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

/* ─────────────────────────── camera ─────────────────────────── */

function camera(T: number) {
  const s = seq(T, [
    [0, 1.1], [4.4, 1.148], [9.3, 2.3], [10.7, 2.29],
    [13.6, 2.0], [16.2, 1.97], [19.2, 1.096], [20, 1.1],
  ]);
  const cx = seq(T, [
    [0, 960], [4.4, 992], [9.3, 648], [10.7, 660],
    [13.6, 1000], [16.2, 1026], [19.2, 950], [20, 960],
  ]);
  const cy = seq(T, [
    [0, 495], [4.4, 482], [9.3, 598], [10.7, 600],
    [13.6, 506], [16.2, 502], [19.2, 498], [20, 495],
  ]);
  return { s, cx: cx + cyc(T, 2, 0.12) * 3.5, cy: cy + cyc(T, 3, 0.4) * 2.4 };
}

/* ─────────────────────── the figure's pose ─────────────────────── */

const L_REST_E = [108, 196], L_REST_H = [96, 214];
const L_UP_E = [164, 188], L_UP_H = [206, 118];
const R_REST_E = [250, 200], R_REST_H = [258, 246];
const R_GRAB_E = [258, 204], R_GRAB_H = [268, 244];
const R_RAIS_E = [252, 176], R_RAIS_H = [242, 122];
const GLASS_REST = [272, 258];

export interface Pose {
  lE: [number, number]; lH: [number, number]; cig: [number, number];
  rE: [number, number]; rH: [number, number];
  glass: [number, number]; glassRot: number;
  ember: number; exhale: number; breath: number;
  cigW: [number, number]; mouthW: [number, number];
}

function pose(T: number): Pose {
  const drag = seq(T, [[6.9, 0], [7.65, 1], [8.5, 1], [9.25, 0]]);
  const lE = lp(L_REST_E, L_UP_E, drag);
  const lH = lp(L_REST_H, L_UP_H, drag);
  const dir = [lerp(-0.5, 0.72, drag), lerp(-0.86, -0.69, drag)];
  const cig: [number, number] = [lH[0] + dir[0]! * 21, lH[1] + dir[1]! * 21];

  const sip = seq(T, [
    [12.7, 0], [13.5, 0.35], [14.1, 1], [14.85, 1], [15.5, 0.35], [16.05, 0],
  ]);
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
  const exhale = seq(T, [[8.55, 0], [9.05, 1], [10.6, 0.7], [12.5, 0]]);
  // Shoulders lift on the drag, drop on the exhale.
  const breath =
    seq(T, [[6.9, 0], [7.9, -3.2], [8.5, -3.6], [9.4, 2.4], [11.0, 0]]) + cyc(T, 4, 0.1) * 0.9;

  return {
    lE, lH, cig, rE, rH, glass, glassRot, ember, exhale, breath,
    cigW: [FX + cig[0], FY + cig[1]],
    mouthW: [FX + 226, FY + 112],
  };
}

/* ────────────────────── static scenery (one PRNG, order matters) ────────────────────── */

const RN = rng(20240811);

interface Block { x: number; y: number; w: number; h: number }

const FAR: Block[] = (() => {
  const out: Block[] = [];
  for (let x = -60; x < 1990; ) {
    const w = 34 + RN() * 76;
    let h = 22 + RN() * 74;
    if (x > 1180 && x < 1400) h = Math.min(h, 26);
    out.push({ x, y: 648 - h, w, h });
    x += w + RN() * 10 - 3;
  }
  return out;
})();

const MID: Block[] = (() => {
  const out: Block[] = [];
  for (let x = -70; x < 2000; ) {
    const w = 62 + RN() * 128;
    let h = 52 + RN() * 122;
    if (x > 1200 && x < 1400) h = Math.min(h, 48);
    out.push({ x, y: 708 - h, w, h });
    x += w + RN() * 12 - 4;
  }
  return out;
})();

interface Win { x: number; y: number; w: number; h: number; c: string; o: number }

function windowsFor(blocks: Block[], cell: number, gap: number, lit: number): Win[] {
  const out: Win[] = [];
  for (const b of blocks) {
    for (let wy = b.y + 8; wy < b.y + b.h - 6; wy += cell + gap) {
      for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += cell + gap) {
        if (RN() > lit) continue;
        const cold = RN() > 0.82;
        out.push({
          x: wx, y: wy, w: cell, h: cell * 1.35,
          c: cold ? '#a8d4ff' : RN() > 0.5 ? '#ffc881' : '#ffab55',
          o: 0.3 + RN() * 0.55,
        });
      }
    }
  }
  return out;
}

const FAR_WINS = windowsFor(FAR, 1.6, 3.4, 0.3);
const MID_WINS = windowsFor(MID, 3.0, 6.0, 0.34);

interface Star { x: number; y: number; r: number; o: number; c: number; p: number }
const STARS: Star[] = (() => {
  const out: Star[] = [];
  for (let i = 0; i < 46; i++) {
    out.push({
      x: 40 + RN() * 1840, y: -290 + RN() * 660,
      r: 0.7 + RN() * 1.2, o: 0.22 + RN() * 0.5,
      c: 1 + Math.floor(RN() * 4), p: RN(),
    });
  }
  return out;
})();

/** Consumed here to keep the shared PRNG in step with the original's draw order. */
const MID_ANTENNA: boolean[] = MID.map((b) => (b.w > 90 ? RN() > 0.5 : false));

const NEAR_BAND_BUMPS = (() => {
  const out: string[] = [];
  for (let x = -40; x < 1990; x += 46 + RN() * 70) {
    const h = 6 + RN() * 26;
    const w = 22 + RN() * 60;
    out.push(`<rect x="${x.toFixed(1)}" y="${(730 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${(h + 20).toFixed(1)}" rx="2" fill="#05070f"/>`);
    if (RN() > 0.7) {
      out.push(`<line x1="${(x + 8).toFixed(1)}" y1="${(730 - h).toFixed(1)}" x2="${(x + 5).toFixed(1)}" y2="${(730 - h - 30).toFixed(1)}" stroke="#05070f" stroke-width="1.8"/>`);
    }
  }
  return out.join('');
})();

/* ─────────────────────────── markup builders ─────────────────────────── */

const svgFar = () =>
  `<g>${FAR.map((b) => `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="#0e1428"/>`).join('')}` +
  `${FAR_WINS.map((w) => `<rect x="${w.x.toFixed(1)}" y="${w.y.toFixed(1)}" width="${w.w}" height="${w.h.toFixed(2)}" fill="${w.c}" opacity="${(w.o * 0.55).toFixed(3)}"/>`).join('')}</g>`;

const svgMid = () =>
  `<g>${MID.map((b, i) =>
    `<g><rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="#080b18"/>` +
    `<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="2" fill="#1b2136" opacity="0.7"/>` +
    (b.w > 110 ? `<rect x="${(b.x + b.w * 0.62).toFixed(1)}" y="${(b.y - 13).toFixed(1)}" width="20" height="13" rx="4" fill="#080b18"/>` : '') +
    (MID_ANTENNA[i] ? `<line x1="${(b.x + 14).toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${(b.x + 10).toFixed(1)}" y2="${(b.y - 26).toFixed(1)}" stroke="#0d1122" stroke-width="1.6"/>` : '') +
    `</g>`).join('')}` +
  `${MID_WINS.map((w) => `<rect x="${w.x.toFixed(1)}" y="${w.y.toFixed(1)}" width="${w.w}" height="${w.h.toFixed(2)}" fill="${w.c}" opacity="${(w.o * 0.8).toFixed(3)}"/>`).join('')}</g>`;

/** Qutub Minar: five tapering fluted storeys, floodlit from below. */
const QX = 1302, QBASE = 622, QTOP = 303;
const Q_STOREY = [100, 63, 46, 36, 29];

const svgQutub = () => {
  const parts: string[] = [];
  let y = QBASE;
  const totalH = Q_STOREY.reduce((a, b) => a + b, 0);
  Q_STOREY.forEach((sh) => {
    const t = (QBASE - y) / totalH;
    const t2 = (QBASE - (y - sh)) / totalH;
    const w0 = lerp(82, 34, t), w1 = lerp(82, 34, t2);
    parts.push(`<path d="M ${QX - w0 / 2} ${y} L ${QX - w1 / 2} ${y - sh} L ${QX + w1 / 2} ${y - sh} L ${QX + w0 / 2} ${y} Z" fill="url(#qgrad)"/>`);
    for (let f = 1; f < 7; f++) {
      const fx0 = QX - w0 / 2 + (w0 * f) / 7;
      const fx1 = QX - w1 / 2 + (w1 * f) / 7;
      parts.push(`<line x1="${fx0.toFixed(1)}" y1="${y}" x2="${fx1.toFixed(1)}" y2="${y - sh}" stroke="#3a1f10" stroke-width="0.9" opacity="0.55"/>`);
    }
    y -= sh;
    parts.push(`<rect x="${QX - w1 / 2 - 7}" y="${y - 8}" width="${w1 + 14}" height="9" rx="1.5" fill="#8d5327"/>`);
    parts.push(`<rect x="${QX - w1 / 2 - 7}" y="${y - 9}" width="${w1 + 14}" height="2" fill="#e0a266" opacity="0.75"/>`);
    parts.push(`<rect x="${QX - w1 / 2 - 7}" y="${y + 1}" width="${w1 + 14}" height="4" fill="#2a1508" opacity="0.6"/>`);
    y -= 9;
  });
  parts.push(`<rect x="${QX - 15}" y="${y - 12}" width="30" height="13" fill="#7d4a24"/>`);
  parts.push(`<rect x="${QX - 9}" y="${y - 20}" width="18" height="9" rx="2" fill="#6b3f1e"/>`);
  return `<g><ellipse cx="${QX}" cy="${QBASE - 60}" rx="130" ry="210" fill="url(#qhaze)"/>${parts.join('')}` +
    `<path d="M ${QX - 41} ${QBASE} L ${QX - 17} ${QTOP + 4} L ${QX - 11} ${QTOP + 4} L ${QX - 33} ${QBASE} Z" fill="#ffd7a8" opacity="0.10"/></g>`;
};

/** A lit hoarding on a mid-city roof — the one bright thing at his eye level. */
const svgHoarding = () =>
  `<g><ellipse id="sc-hoard-glow" cx="956" cy="606" rx="130" ry="78" fill="#ffb066" opacity="0.05"/>` +
  `<rect x="922" y="640" width="5" height="70" fill="#070a14"/><rect x="986" y="640" width="5" height="70" fill="#070a14"/>` +
  `<rect x="908" y="586" width="98" height="54" rx="2" fill="#0d1526"/>` +
  `<rect x="912" y="590" width="90" height="46" fill="#8a5a24" opacity="0.7"/>` +
  `<rect x="912" y="590" width="90" height="17" fill="#b8813a" opacity="0.55"/>` +
  `<rect x="920" y="614" width="48" height="5" rx="1" fill="#ffe0b0" opacity="0.42"/>` +
  `<rect x="920" y="624" width="28" height="4" rx="1" fill="#ffe0b0" opacity="0.26"/>` +
  `<rect x="908" y="583" width="98" height="3" fill="#d59a4c" opacity="0.45"/></g>`;

const svgNearBand = () =>
  `<g><rect x="-40" y="728" width="2000" height="70" fill="#05070f"/>${NEAR_BAND_BUMPS}</g>`;

/** One of the other lives on other roofs. */
function roofFigure(id: string, x: number, y: number, h: number): string {
  const hw = h * 0.3;
  return (
    `<g id="${id}" transform="translate(${x},${y})">` +
    `<path d="M ${-hw} 0 C ${-hw * 0.9} ${-h * 0.5} ${-hw * 0.8} ${-h * 0.62} ${-hw * 0.5} ${-h * 0.68} L ${hw * 0.5} ${-h * 0.68} C ${hw * 0.8} ${-h * 0.62} ${hw * 0.9} ${-h * 0.5} ${hw} 0 Z" fill="#05070e"/>` +
    `<circle cx="0" cy="${-h * 0.8}" r="${h * 0.15}" fill="#05070e"/>` +
    `<line id="${id}-arm" x1="${hw * 0.55}" y1="${-h * 0.6}" x2="${hw * 0.55}" y2="${-h * 0.6}" stroke="#05070e" stroke-width="${h * 0.11}" stroke-linecap="round"/>` +
    `</g>`
  );
}

const svgNeighbours = () => {
  const bulbs: string[] = [];
  for (let i = 0; i < 13; i++) {
    const u = i / 12;
    const x = lerp(1478, 1900, u);
    const y = 664 + Math.sin(u * Math.PI) * 26;
    bulbs.push(`<circle class="sc-bulb" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#ffca7d" opacity="0.6"/>` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#ffca7d" opacity="0.10"/>`);
  }
  return (
    `<g>` +
    `<rect x="-30" y="716" width="450" height="90" fill="#060810"/>` +
    `<rect x="-30" y="714" width="450" height="3" fill="#171d30" opacity="0.8"/>` +
    `<rect x="86" y="668" width="52" height="48" rx="6" fill="#05070e"/>` +
    `<rect x="80" y="662" width="64" height="9" rx="3" fill="#05070e"/>` +
    `<path d="M 236 716 L 236 690 M 224 686 A 16 16 0 0 1 250 686" stroke="#05070e" stroke-width="3" fill="none"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-l', 330, 716, 48) : '') +
    `<rect x="1452" y="706" width="510" height="100" fill="#060810"/>` +
    `<rect x="1452" y="704" width="510" height="3" fill="#171d30" opacity="0.8"/>` +
    bulbs.join('') +
    `<path d="M 1478 664 Q 1689 704 1900 690" stroke="#0b0f1c" stroke-width="1.4" fill="none" opacity="0.9"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-r1', 1566, 706, 52) + roofFigure('sc-nb-r2', 1614, 706, 49) : '') +
    `<rect x="1108" y="692" width="196" height="60" fill="#070a14"/>` +
    (ROOF_FOLKS ? roofFigure('sc-nb-walk', 1130, 692, 30) : '') +
    `</g>`
  );
};

const svgRooftop = () =>
  `<g>` +
  `<path d="M 168 618 L 168 762 M 552 636 L 552 764" stroke="#080b15" stroke-width="6"/>` +
  `<path d="M 168 620 Q 360 686 552 638" stroke="#0c1120" stroke-width="2" fill="none"/>` +
  `<g id="sc-cloth-a"><path d="M 240 652 L 288 660 L 292 728 L 236 720 Z" fill="#0a0e1a"/>` +
  `<path d="M 288 660 L 292 728" stroke="#232b42" stroke-width="1.4" opacity="0.7"/></g>` +
  `<g id="sc-cloth-b"><path d="M 398 664 L 448 662 L 452 722 L 396 724 Z" fill="#090d18"/>` +
  `<path d="M 448 662 L 452 722" stroke="#232b42" stroke-width="1.4" opacity="0.7"/></g>` +
  `<rect x="-40" y="758" width="2000" height="88" fill="#0a0d18"/>` +
  `<rect x="-40" y="756" width="2000" height="4" fill="url(#edge)"/>` +
  `<rect x="-40" y="844" width="2000" height="260" fill="url(#floor)"/>` +
  [886, 928, 976, 1032].map((y, i) => `<line x1="-40" y1="${y}" x2="1960" y2="${y}" stroke="#10162a" stroke-width="1.4" opacity="${(0.5 - i * 0.09).toFixed(2)}"/>`).join('') +
  `<ellipse id="sc-pool" cx="318" cy="960" rx="430" ry="155" fill="url(#pool)"/>` +
  // stairwell mumty, the near anchor at the left
  `<g><rect x="-60" y="636" width="270" height="400" fill="#04060c"/>` +
  `<rect x="-70" y="628" width="290" height="14" fill="#060911"/>` +
  `<path d="M 92 1000 L 92 862 Q 92 838 126 838 Q 160 838 160 862 L 160 1000 Z" fill="#1d1207"/>` +
  `<path d="M 98 1000 L 98 864 Q 98 844 126 844 Q 154 844 154 864 L 154 1000 Z" fill="url(#door)"/>` +
  `<rect x="210" y="636" width="5" height="400" fill="#0b1120" opacity="0.7"/></g>` +
  // water tank
  `<g><rect x="1626" y="828" width="204" height="176" rx="16" fill="#05070d"/>` +
  `<rect x="1616" y="818" width="224" height="18" rx="8" fill="#070a12"/>` +
  `<rect x="1700" y="1004" width="18" height="52" fill="#05070d"/>` +
  `<rect x="1752" y="1004" width="18" height="52" fill="#05070d"/>` +
  `<path d="M 1846 836 L 1846 1002" stroke="#05070d" stroke-width="7"/>` +
  [0, 1, 2, 3, 4].map((i) => `<line x1="1836" y1="${860 + i * 34}" x2="1858" y2="${860 + i * 34}" stroke="#05070d" stroke-width="5"/>`).join('') +
  `<rect x="1626" y="828" width="7" height="176" rx="3" fill="#1d2436" opacity="0.55"/></g>` +
  // potted plant
  `<g><path d="M 214 1002 L 292 1002 L 282 1074 L 224 1074 Z" fill="#05070d"/>` +
  `<path d="M 253 1000 C 250 950 224 928 206 918 M 253 1000 C 258 946 288 926 306 920 M 253 1000 C 252 962 246 940 240 924" stroke="#070a12" stroke-width="4" fill="none"/>` +
  `<ellipse cx="204" cy="916" rx="16" ry="7" fill="#070a12" transform="rotate(-24 204 916)"/>` +
  `<ellipse cx="308" cy="918" rx="16" ry="7" fill="#070a12" transform="rotate(22 308 918)"/>` +
  `<ellipse cx="238" cy="920" rx="13" ry="6" fill="#070a12" transform="rotate(-8 238 920)"/></g>` +
  // bottle + phone face down on the parapet
  `<g><path d="M 812 758 L 812 706 Q 812 698 818 694 L 818 676 L 830 676 L 830 694 Q 836 698 836 706 L 836 758 Z" fill="#080b14"/>` +
  `<path d="M 814 748 L 814 712 Q 814 706 818 703 L 818 690" stroke="#3c4a3a" stroke-width="2" fill="none" opacity="0.65"/>` +
  `<rect x="814" y="724" width="20" height="32" fill="#2e3a26" opacity="0.5"/>` +
  `<rect x="500" y="748" width="52" height="11" rx="3" fill="#070a12"/>` +
  `<rect x="500" y="747" width="52" height="2" rx="1" fill="#2a3145" opacity="0.7"/></g>` +
  `</g>`;

const svgFigure = () =>
  `<g id="sc-figure" transform="translate(${FX},${FY})">` +
  `<path id="sc-knee" d="" fill="#090c15"/>` +
  `<ellipse cx="86" cy="255" rx="24" ry="8" fill="#080b13"/>` +
  `<path id="sc-body" d="" fill="#0a0c16"/>` +
  `<path id="sc-rim-warm" d="" stroke="#c8834a" stroke-width="3.2" fill="none" opacity="0.5" stroke-linecap="round"/>` +
  `<path id="sc-rim-cool" d="" stroke="#7fa0d6" stroke-width="2.4" fill="none" opacity="0.30" stroke-linecap="round"/>` +
  `<path id="sc-hood" d="" stroke="#04060d" stroke-width="6" fill="none" opacity="0.9"/>` +
  `<path id="sc-hood2" d="" stroke="#b8783f" stroke-width="1.4" fill="none" opacity="0.35"/>` +
  `<path id="sc-yoke" d="" stroke="#171d2e" stroke-width="2" fill="none" opacity="0.7"/>` +
  `<path d="M 114 222 C 152 232 196 231 234 222" stroke="#141a29" stroke-width="2" fill="none" opacity="0.55"/>` +
  // right arm, then left
  armMarkup('r') + armMarkup('l') +
  `<line id="sc-cig-stick" stroke="#b8b2a2" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>` +
  `<circle id="sc-cig-1" r="3.1" fill="#ff7a2e"/>` +
  `<circle id="sc-cig-2" r="7" fill="#ff8b3c"/>` +
  `<circle id="sc-cig-3" r="21" fill="#ff9a4a"/>` +
  `<g id="sc-glass">` +
  `<path d="M -12 0 L -10 -30 L 10 -30 L 12 0 Z" fill="#b9d6ee" opacity="0.10"/>` +
  `<path d="M -12 0 L -10 -30 L 10 -30 L 12 0 Z" stroke="#cfe4f6" stroke-width="1.2" fill="none" opacity="0.26"/>` +
  `<path d="M -10.5 -8 L -11.6 0 L 11.6 0 L 10.5 -8 Z" fill="#c8783a" opacity="0.42"/>` +
  `<line x1="-8" y1="-27" x2="-9.4" y2="-4" stroke="#ffe6c2" stroke-width="1.3" opacity="0.26"/>` +
  `<circle cx="7" cy="-6" r="1.7" fill="#ffcf94" opacity="0.4"/></g>` +
  `</g>`;

function armMarkup(side: 'l' | 'r'): string {
  return (
    `<g><path id="sc-${side}-up" stroke="#0a0c16" stroke-width="29" stroke-linecap="round"/>` +
    `<path id="sc-${side}-lo" stroke="#0a0c16" stroke-width="24" stroke-linecap="round"/>` +
    `<circle id="sc-${side}-hand" r="11" fill="#0a0c16"/>` +
    `<path id="sc-${side}-rim" stroke="#c07c42" stroke-width="2" stroke-linecap="round" opacity="0.28"/></g>`
  );
}

const svgPlane = () =>
  `<g id="sc-plane" opacity="0">` +
  `<ellipse cx="0" cy="0" rx="13" ry="2.2" fill="#0d1220"/>` +
  `<path d="M 2 0 L -7 7 L -2 7.6 L 6 0.8 Z" fill="#0d1220"/>` +
  `<path d="M 2 0 L -7 -6 L -2 -6.6 L 6 -0.8 Z" fill="#0d1220"/>` +
  `<path d="M -12 0 L -16 -4 L -13 -0.4 Z" fill="#0d1220"/>` +
  `<circle id="sc-plane-r" cx="-7" cy="7" r="1.9" fill="#ff3b3b"/>` +
  `<circle id="sc-plane-g" cx="-7" cy="-6" r="1.9" fill="#43ff96"/>` +
  `<circle id="sc-plane-s" cx="0" cy="0" r="3" fill="#ffffff"/>` +
  `<circle cx="12" cy="1" r="2" fill="#fff3d6" opacity="0.45"/></g>`;

/* ─────────────────────────── mount ─────────────────────────── */

const GRAIN_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>',
)}")`;

const SKY = `linear-gradient(180deg,
  #03040a 0%, #04060e 28%, #080e22 44%, #131c3c 58%,
  #262146 69%, #42284a 77%, #7c4632 85%, #ae6a2e 91%,
  #c17c2e 94.5%, #58321b 100%)`;

/** Haze scales with SMOG, so the one knob still drives the look rather than magic alphas. */
const SMOG_BAND = `linear-gradient(180deg,
  rgba(196,112,52,0) 0%,
  rgba(196,112,52,${(0.1 * SMOG).toFixed(4)}) 46%,
  rgba(214,128,58,${(0.26 * SMOG).toFixed(4)}) 78%,
  rgba(150,84,40,${(0.16 * SMOG).toFixed(4)}) 100%)`;

const SMOG_QGLOW = `radial-gradient(ellipse at 50% 80%,
  rgba(255,166,88,${(0.16 * SMOG).toFixed(4)}) 0%, rgba(255,166,88,0) 66%)`;

interface Refs {
  world: HTMLElement;
  stage: HTMLElement;
  stars: SVGCircleElement[];
  liveWins: SVGRectElement[];
  cars: SVGGElement[];
  bulbs: SVGCircleElement[];
  smoke: HTMLElement;
  endcard: HTMLElement;
  endTitle: HTMLElement;
  endLine: HTMLElement;
  hoardGlow: SVGElement;
  pool: SVGElement;
  smogBand: HTMLElement;
  q: (id: string) => SVGElement;
}

let refs: Refs | null = null;

/** Live windows and traffic use their own generators, so order here is independent. */
const LIVE_WINS = (() => {
  const r = rng(991);
  const out: { x: number; y: number; c: string; k: number; p: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const b = MID[Math.floor(r() * MID.length)]!;
    out.push({
      x: b.x + 8 + r() * (b.w - 18), y: b.y + 8 + r() * (b.h - 20),
      c: r() > 0.75 ? '#a8d4ff' : '#ffbe74',
      k: 1 + Math.floor(r() * 5), p: r(),
    });
  }
  return out;
})();

const CARS = (() => {
  const r = rng(404);
  const out: { k: number; p: number; lane: number; s: number }[] = [];
  for (let i = 0; i < 9; i++) {
    out.push({ k: 1 + Math.floor(r() * 2), p: r(), lane: r() > 0.5 ? 0 : 1, s: 0.6 + r() * 0.7 });
  }
  return out;
})();

export function mount(root: HTMLElement): void {
  root.innerHTML = `
<div class="sc-stage" id="sc-stage">
 <div class="sc-world" id="sc-world">
  <div class="sc-sky" style="background:${SKY}"></div>
  <div class="sc-moonglow"></div>

  <svg class="sc-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="qgrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#d98d4c"/><stop offset="34%" stop-color="#b06f37"/>
        <stop offset="72%" stop-color="#7c4c26"/><stop offset="100%" stop-color="#5a361b"/>
      </linearGradient>
      <radialGradient id="qhaze">
        <stop offset="0%" stop-color="#ffb26a" stop-opacity="0.16"/>
        <stop offset="60%" stop-color="#ff9a4d" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#ff9a4d" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g id="sc-stars">${STARS.map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" fill="#dfe8ff"/>`).join('')}</g>
    <path d="M 300 241 A 27 27 0 1 0 300 295 A 34 34 0 0 1 300 241 Z" fill="#f0e7d2" opacity="0.78"/>
    ${FLIGHT ? svgPlane() : ''}
    ${svgFar()}
    ${svgQutub()}
    ${svgMid()}
    ${svgHoarding()}
    <g id="sc-livewins">${LIVE_WINS.map((w) => `<rect x="${w.x.toFixed(1)}" y="${w.y.toFixed(1)}" width="3" height="4" fill="${w.c}"/>`).join('')}</g>
    <g>
      <path d="M 380 730 L 1470 706 L 1470 716 L 380 742 Z" fill="#0a0e1c" opacity="0.85"/>
      <g id="sc-cars">${CARS.map((c) => {
        const col = c.lane ? '#ff5a48' : '#ffe4b0';
        return `<g><ellipse rx="${(5 * c.s).toFixed(2)}" ry="1.5" fill="${col}" opacity="0.85"/>` +
          `<ellipse rx="${(13 * c.s).toFixed(2)}" ry="3.4" fill="${col}" opacity="0.10"/></g>`;
      }).join('')}</g>
    </g>
  </svg>

  <div class="sc-smog" id="sc-smog" style="background:${SMOG_BAND}"></div>
  <div class="sc-qglow" style="background:${SMOG_QGLOW}"></div>

  <svg class="sc-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6d4f34" stop-opacity="0"/>
        <stop offset="26%" stop-color="#7f5c3a" stop-opacity="0.55"/>
        <stop offset="62%" stop-color="#9a6c40" stop-opacity="0.7"/>
        <stop offset="100%" stop-color="#6d4f34" stop-opacity="0.15"/>
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0d18"/><stop offset="38%" stop-color="#06080f"/>
        <stop offset="100%" stop-color="#020308"/>
      </linearGradient>
      <radialGradient id="pool">
        <stop offset="0%" stop-color="#e08a3a" stop-opacity="0.15"/>
        <stop offset="45%" stop-color="#c9762f" stop-opacity="0.055"/>
        <stop offset="100%" stop-color="#c9762f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="door" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#c98436" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="#84501f" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#3a2210" stop-opacity="0.12"/>
      </linearGradient>
    </defs>
    ${svgNearBand()}
    ${svgNeighbours()}
    ${svgRooftop()}
    ${svgFigure()}
  </svg>

  <div class="sc-smoke" id="sc-smoke"></div>
 </div>

 <div class="sc-endcard" id="sc-endcard">
   <div class="sc-end-title" id="sc-end-title">दिल्ली</div>
   <div class="sc-end-line" id="sc-end-line">
     <i></i><span>every week ends here</span><i></i>
   </div>
 </div>

 <div class="sc-vignette"></div>
 <div class="sc-warmlift"></div>
 ${GRAIN ? `<div class="sc-grain" style="background-image:${GRAIN_URL}"></div>` : ''}
</div>`;

  const q = (id: string) => root.querySelector(`#${id}`) as SVGElement;
  refs = {
    stage: root.querySelector('#sc-stage') as HTMLElement,
    world: root.querySelector('#sc-world') as HTMLElement,
    stars: [...root.querySelectorAll('#sc-stars circle')] as SVGCircleElement[],
    liveWins: [...root.querySelectorAll('#sc-livewins rect')] as SVGRectElement[],
    cars: [...root.querySelectorAll('#sc-cars > g')] as SVGGElement[],
    bulbs: [...root.querySelectorAll('.sc-bulb')] as SVGCircleElement[],
    smoke: root.querySelector('#sc-smoke') as HTMLElement,
    endcard: root.querySelector('#sc-endcard') as HTMLElement,
    endTitle: root.querySelector('#sc-end-title') as HTMLElement,
    endLine: root.querySelector('#sc-end-line') as HTMLElement,
    hoardGlow: q('sc-hoard-glow'),
    pool: q('sc-pool'),
    smogBand: root.querySelector('#sc-smog') as HTMLElement,
    q,
  };

  // Pre-create the smoke puffs; each frame only moves and fades them.
  const puffs: string[] = [];
  for (let i = 0; i < SMOKE_N + EXHALE_N; i++) puffs.push('<div class="sc-puff"></div>');
  refs.smoke.innerHTML = puffs.join('');
  smokeEls = [...refs.smoke.children] as HTMLElement[];

}

let smokeEls: HTMLElement[] = [];
const SMOKE_N = 16;
const EXHALE_N = 22;

/** The figure, in world space — what the crop must not lose. */
const SUBJECT = { x: 590, y: 660 };

/** How hard the crop tracks the subject versus the stage centre. */
const FOLLOW = 0.75;

/**
 * Scale the 1920×1080 stage to cover the viewport.
 *
 * Plain `cover` centres the stage, which is wrong here: the camera deliberately frames
 * the figure left of centre, so a narrow portrait crop sliced him out of frame entirely
 * and left a phone showing empty sky. The crop window therefore tracks the subject's
 * current stage position, clamped so it never runs past the edges of the composition.
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
    if (vis >= total) return (viewport - total * k) / 2; // no crop on this axis
    const anchor = clamp(lerp(total / 2, subj, FOLLOW), vis / 2, total - vis / 2);
    return -(anchor - vis / 2) * k;
  };

  refs.stage.style.transform =
    `translate(${offset(visW, W, subjX, vw).toFixed(2)}px, ${offset(visH, H, subjY, vh).toFixed(2)}px) scale(${k.toFixed(5)})`;
}

/* ─────────────────────────── per-frame ─────────────────────────── */

const set = (el: Element | null, name: string, value: string | number) => {
  if (el) el.setAttribute(name, String(value));
};

/**
 * Render one frame.
 *
 * `energy` is the audio level from the player, 0..1. The composition's own
 * choreography is never overridden by it — the audio only lifts the city's light
 * sources, so the piece still reads exactly as authored in silence.
 */
export function render(T: number, energy: { bass: number; mid: number; treble: number }): void {
  if (!refs) return;
  const r = refs;
  const p = pose(T);
  const cam = camera(T);

  place(cam);
  r.world.style.transform =
    `translate(${(W / 2 - cam.cx * cam.s).toFixed(2)}px, ${(H / 2 - cam.cy * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(4)})`;

  // stars
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i]!;
    set(r.stars[i]!, 'opacity', (s.o * (0.62 + 0.38 * cyc(T, s.c, s.p)) * 0.8 * (1 + energy.treble * 0.5)).toFixed(3));
  }

  // plane
  if (FLIGHT) {
    const o = seq(T, [[10.4, 0], [11.3, 1], [17.6, 1], [18.6, 0]]);
    const plane = r.q('sc-plane');
    set(plane, 'opacity', o.toFixed(3));
    if (o > 0.001) {
      const x = seq(T, [[10.6, 400], [18.6, 1930]], MOTION.drift);
      const y = seq(T, [[10.6, 344], [18.6, 412]], MOTION.drift);
      set(plane, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(2.4) scale(0.72)`);
      const beacon = T % 1 < 0.13 ? 1 : 0;
      const strobe = (T * 1.25) % 1 < 0.055 ? 1 : 0;
      set(r.q('sc-plane-r'), 'opacity', 0.2 + beacon * 0.8);
      set(r.q('sc-plane-g'), 'opacity', 0.2 + beacon * 0.8);
      set(r.q('sc-plane-s'), 'opacity', strobe * 0.85);
    }
  }

  // live windows — the audio lifts these
  for (let i = 0; i < LIVE_WINS.length; i++) {
    const w = LIVE_WINS[i]!;
    const v = 0.5 + 0.5 * cyc(T, w.k, w.p);
    set(r.liveWins[i]!, 'opacity', Math.min(1, (0.15 + v * 0.75) * (1 + energy.mid * 0.6)).toFixed(3));
  }

  // traffic
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i]!;
    let u = ((T * c.k) / TOTAL + c.p) % 1;
    if (c.lane) u = 1 - u;
    const x = lerp(380, 1470, u);
    const y = lerp(736, 710, u) + (c.lane ? 4 : -1);
    set(r.cars[i]!, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
  }

  // neighbours
  if (ROOF_FOLKS) {
    const sway = cyc(T, 2, 0.15) * 1.6;
    const raise = -1.15 + 0.85 * Math.max(0, cyc(T, 2, 0.62));
    const walk = ((T * 1) / TOTAL + 0.1) % 1;
    set(r.q('sc-nb-l'), 'transform', `translate(330,716) rotate(${(sway * 0.6).toFixed(2)})`);
    set(r.q('sc-nb-r1'), 'transform', `translate(1566,706) rotate(${sway.toFixed(2)})`);
    set(r.q('sc-nb-r2'), 'transform', `translate(1614,706) rotate(${(-sway * 0.8).toFixed(2)})`);
    set(r.q('sc-nb-walk'), 'transform', `translate(${lerp(1130, 1280, walk).toFixed(1)},692) rotate(${(sway * 0.5).toFixed(2)})`);
    const arm = r.q('sc-nb-r1-arm');
    if (arm) {
      const hw = 52 * 0.3;
      set(arm, 'x2', (hw * 0.55 + Math.cos(raise) * 52 * 0.42).toFixed(2));
      set(arm, 'y2', (-52 * 0.6 + Math.sin(raise) * 52 * 0.42).toFixed(2));
    }
  }
  for (let i = 0; i < r.bulbs.length; i++) {
    set(r.bulbs[i]!, 'opacity', (0.55 + 0.45 * Math.abs(cyc(T, 2, i * 0.11))).toFixed(3));
  }

  // laundry
  set(r.q('sc-cloth-a'), 'transform', `rotate(${(cyc(T, 2, 0) * 2.2).toFixed(2)} 262 654)`);
  set(r.q('sc-cloth-b'), 'transform', `rotate(${(cyc(T, 2, 0.33) * 2.6).toFixed(2)} 420 668)`);

  figure(r, p);
  smoke(T);
  endCard(r, T);

  // audio lift on the city's light sources
  set(r.hoardGlow, 'opacity', (0.05 + energy.bass * 0.09).toFixed(3));
  set(r.pool, 'opacity', (1 + energy.bass * 0.5).toFixed(3));
  r.smogBand.style.opacity = (0.85 + energy.bass * 0.15).toFixed(3);
}

function figure(r: Refs, p: Pose): void {
  const b = p.breath;

  set(r.q('sc-knee'), 'd',
    `M 112 ${(254 + b * 0.2).toFixed(2)} C 92 246 74 222 72 198 C 70 182 84 174 96 184 C 110 196 118 224 120 250 Z`);

  set(r.q('sc-body'), 'd',
    `M 106 258 C 102 216 106 172 114 ${152 + b}
     C 120 ${140 + b} 126 ${136 + b} 132 ${132 + b}
     C 120 ${110 + b} 122 ${74 + b} 142 ${54 + b}
     C 160 ${34 + b} 198 ${32 + b} 214 ${52 + b}
     C 230 ${72 + b} 228 ${110 + b} 218 ${132 + b}
     C 226 ${136 + b} 232 ${142 + b} 236 ${154 + b}
     C 242 190 240 226 238 258 Z`);

  set(r.q('sc-rim-warm'), 'd',
    `M 214 ${52 + b} C 230 ${72 + b} 228 ${110 + b} 218 ${132 + b} C 226 ${136 + b} 232 ${142 + b} 236 ${154 + b} C 242 190 240 226 238 258`);
  set(r.q('sc-rim-cool'), 'd',
    `M 114 ${152 + b} C 120 ${140 + b} 126 ${136 + b} 132 ${132 + b} C 120 ${110 + b} 122 ${74 + b} 142 ${54 + b} C 152 ${44 + b} 166 ${37 + b} 182 ${35 + b}`);
  const hood = `M 205 ${48 + b} C 218 ${66 + b} 219 ${106 + b} 210 ${131 + b}`;
  set(r.q('sc-hood'), 'd', hood);
  set(r.q('sc-hood2'), 'd', hood);
  set(r.q('sc-yoke'), 'd', `M 124 ${164 + b} C 158 ${178 + b} 198 ${176 + b} 230 ${164 + b}`);

  arm(r, 'r', 220, 154 + b, p.rE, p.rH);
  arm(r, 'l', 136, 152 + b, p.lE, p.lH);

  const stick = r.q('sc-cig-stick');
  set(stick, 'x1', p.lH[0].toFixed(2)); set(stick, 'y1', p.lH[1].toFixed(2));
  set(stick, 'x2', p.cig[0].toFixed(2)); set(stick, 'y2', p.cig[1].toFixed(2));

  for (const [id, mul] of [['sc-cig-1', 0.5], ['sc-cig-2', 0.3], ['sc-cig-3', 0.12]] as const) {
    const el = r.q(id);
    set(el, 'cx', p.cig[0].toFixed(2));
    set(el, 'cy', p.cig[1].toFixed(2));
    set(el, 'opacity', (id === 'sc-cig-1' ? 0.5 + p.ember * mul : p.ember * mul).toFixed(3));
  }

  set(r.q('sc-glass'), 'transform',
    `translate(${p.glass[0].toFixed(2)},${p.glass[1].toFixed(2)}) rotate(${p.glassRot.toFixed(2)})`);
}

function arm(r: Refs, side: 'l' | 'r', ox: number, oy: number, e: number[], h: number[]): void {
  set(r.q(`sc-${side}-up`), 'd', `M ${ox} ${oy.toFixed(2)} L ${e[0]!.toFixed(2)} ${e[1]!.toFixed(2)}`);
  set(r.q(`sc-${side}-lo`), 'd', `M ${e[0]!.toFixed(2)} ${e[1]!.toFixed(2)} L ${h[0]!.toFixed(2)} ${h[1]!.toFixed(2)}`);
  const hand = r.q(`sc-${side}-hand`);
  set(hand, 'cx', h[0]!.toFixed(2)); set(hand, 'cy', h[1]!.toFixed(2));
  set(r.q(`sc-${side}-rim`), 'd',
    `M ${(e[0]! + 3).toFixed(2)} ${(e[1]! - 3).toFixed(2)} L ${(h[0]! + 3).toFixed(2)} ${(h[1]! - 3).toFixed(2)}`);
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

  // the long exhale after the drag
  for (let i = 0; i < EXHALE_N; i++) {
    const birth = 8.66 + i * 0.075;
    const age = T - birth;
    if (age < 0 || age > 4.4) { hide(n++); continue; }
    const k = age / 4.4;
    const w = ((i * 29) % 13) / 13;
    const src = pose(birth).mouthW;
    const size = lerp(18, 196, Math.pow(k, 0.55));
    const o = Math.min(1, k / 0.22) * Math.pow(1 - k, 1.8) * 0.52 * (0.6 + 0.4 * w);
    puff(n++, src[0] + Math.pow(age, 0.9) * 66 + Math.sin(age * 1.2 + i) * 18 + i * 2.4,
      src[1] - Math.pow(age, 1.15) * 44 - i, size, 0.92 - k * 0.45 + w * 0.14, o, (i * 41) % 180);
  }
}

function puff(i: number, x: number, y: number, size: number, ar: number, o: number, rot: number): void {
  const el = smokeEls[i];
  if (!el) return;
  const h = size * ar;
  el.style.cssText =
    `position:absolute;left:0;top:0;width:${size.toFixed(1)}px;height:${h.toFixed(1)}px;` +
    `border-radius:50%;opacity:${Math.max(0, o).toFixed(3)};` +
    `transform:translate(${(x - size / 2).toFixed(1)}px,${(y - h / 2).toFixed(1)}px) rotate(${rot}deg);` +
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
  const y2 = seq(T, [[17.35, 14], [18.4, 0]]);
  r.endTitle.style.opacity = o1.toFixed(3);
  r.endTitle.style.transform = `translateY(${y1.toFixed(2)}px)`;
  r.endTitle.style.filter = `blur(${b1.toFixed(2)}px)`;
  r.endLine.style.opacity = o2.toFixed(3);
  r.endLine.style.transform = `translateY(${y2.toFixed(2)}px)`;
}
