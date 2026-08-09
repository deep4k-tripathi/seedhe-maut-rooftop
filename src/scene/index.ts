/**
 * The scene.
 *
 * A thin adapter over the ported "Dilli, 11:40 pm" composition. It owns the clock and
 * nothing else: the composition is a pure function of authored time T, and this decides
 * what T is right now.
 *
 * Still knows nothing about audio sources — it receives levels and passes them through.
 */
import type { Levels } from '../player/engine';
import { mount as mountComposition, render, TOTAL } from './composition';

/** A calm wide frame, used when the viewer has asked for reduced motion. */
const STILL_FRAME = 3.2;

let started = 0;
let reduced = false;

export function mount(root: HTMLElement): void {
  mountComposition(root);
  started = performance.now();

  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = query.matches;
  query.addEventListener('change', (event) => {
    reduced = event.matches;
  });

  // Paint one frame immediately so the curtain never sits over an empty stage.
  render(reduced ? STILL_FRAME : 0, { bass: 0, mid: 0, treble: 0 });
}

/**
 * Advance and draw. Called once per animation frame.
 *
 * The composition's own choreography is authored, not generated — the audio only lifts
 * the city's light sources, so the piece reads exactly as made even in silence.
 */
export function pulse(_root: HTMLElement, levels: Levels): void {
  const T = reduced ? STILL_FRAME : ((performance.now() - started) / 1000) % TOTAL;
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  render(T, {
    bass: clamp01(levels.bass),
    mid: clamp01(levels.mid),
    treble: clamp01(levels.treble),
  });
}
