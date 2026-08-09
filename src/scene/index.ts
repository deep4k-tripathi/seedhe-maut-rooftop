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

let started = 0;

/**
 * Whether to hold the camera still.
 *
 * `prefers-reduced-motion` used to freeze the entire composition on one frame, which
 * is a misreading of the setting: what provokes motion sensitivity is the large camera
 * push-in and pan, not a window flickering or smoke drifting. Freezing everything just
 * served a still image to anyone with the OS setting on — which on macOS is a lot of
 * people. Now the camera holds on the establishing wide and the city stays alive.
 */
let calmCamera = false;

export function mount(root: HTMLElement): void {
  mountComposition(root);
  started = performance.now();

  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  calmCamera = query.matches;
  query.addEventListener('change', (event) => {
    calmCamera = event.matches;
  });

  // Paint one frame immediately so the curtain never sits over an empty stage.
  render(0, { bass: 0, mid: 0, treble: 0 }, calmCamera);
}

/**
 * Advance and draw. Called once per animation frame.
 *
 * The composition's own choreography is authored, not generated — the audio only lifts
 * the city's light sources, so the piece reads exactly as made even in silence.
 */
export function pulse(_root: HTMLElement, levels: Levels): void {
  const T = ((performance.now() - started) / 1000) % TOTAL;
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  render(
    T,
    {
      bass: clamp01(levels.bass),
      mid: clamp01(levels.mid),
      treble: clamp01(levels.treble),
    },
    calmCamera,
  );
}
