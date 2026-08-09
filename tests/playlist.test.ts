import { describe, expect, it } from 'vitest';
import { bands, createPlaylist, shuffled } from '../src/player/engine';

/** A deterministic stand-in for Math.random so shuffles are reproducible. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('shuffled', () => {
  it('keeps every element exactly once', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7];
    const out = shuffled(input, seededRandom(42));
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [0, 1, 2, 3];
    shuffled(input, seededRandom(7));
    expect(input).toEqual([0, 1, 2, 3]);
  });

  it('handles a single element', () => {
    expect(shuffled([9], seededRandom(1))).toEqual([9]);
  });
});

describe('createPlaylist', () => {
  it('refuses an empty track list', () => {
    expect(() => createPlaylist(0)).toThrow(/at least one track/);
  });

  it('walks forward in order', () => {
    const list = createPlaylist(3, [0, 1, 2]);
    expect(list.current).toBe(0);
    expect(list.step(1)).toBe(1);
    expect(list.step(1)).toBe(2);
  });

  it('wraps at the end', () => {
    const list = createPlaylist(3, [0, 1, 2]);
    list.step(1);
    list.step(1);
    expect(list.step(1)).toBe(0);
  });

  it('wraps backwards from the start', () => {
    const list = createPlaylist(3, [0, 1, 2]);
    expect(list.step(-1)).toBe(2);
  });

  it('skips a track marked dead', () => {
    const list = createPlaylist(4, [0, 1, 2, 3]);
    list.step(1); // now on 1
    list.markDead(); // 1 is dead
    list.step(-1); // back to 0
    expect(list.step(1)).toBe(2); // 1 is skipped
  });

  it('reports exhaustion once every track is dead', () => {
    const list = createPlaylist(2, [0, 1]);
    expect(list.exhausted).toBe(false);
    list.markDead();
    list.step(1);
    list.markDead();
    expect(list.exhausted).toBe(true);
  });

  it('terminates rather than looping forever when all tracks are dead', () => {
    const list = createPlaylist(3, [0, 1, 2]);
    list.markDead();
    list.step(1);
    list.markDead();
    list.step(1);
    list.markDead();
    expect(list.exhausted).toBe(true);
    expect(() => list.step(1)).not.toThrow();
  });

  it('revives a track that later loads successfully', () => {
    const list = createPlaylist(2, [0, 1]);
    list.markDead();
    expect(list.exhausted).toBe(false);
    list.markAlive();
    list.step(1);
    list.step(1);
    expect(list.current).toBe(0);
  });

  it('jumps directly to a chosen track', () => {
    const list = createPlaylist(4, [3, 1, 0, 2]);
    expect(list.jumpTo(0)).toBe(0);
    expect(list.step(1)).toBe(2);
  });

  it('ignores a jump to a track that is not in the sequence', () => {
    const list = createPlaylist(2, [0, 1]);
    expect(list.jumpTo(99)).toBe(0);
  });

  it('stays on the same track across a reshuffle', () => {
    const list = createPlaylist(6, [0, 1, 2, 3, 4, 5]);
    list.step(1);
    list.step(1);
    const before = list.current;
    list.reshuffle(seededRandom(3));
    expect(list.current).toBe(before);
  });
});

describe('bands', () => {
  it('reports silence for an empty spectrum', () => {
    const result = bands(new Uint8Array(64));
    expect(result).toEqual({ bass: 0, mid: 0, treble: 0, level: 0 });
  });

  it('reports full energy for a saturated spectrum', () => {
    const result = bands(new Uint8Array(64).fill(255));
    expect(result.bass).toBeCloseTo(1);
    expect(result.treble).toBeCloseTo(1);
    expect(result.level).toBeCloseTo(1);
  });

  it('isolates low-frequency energy to the bass band', () => {
    const spectrum = new Uint8Array(256);
    spectrum.fill(255, 0, 10); // only the lowest bins
    const result = bands(spectrum);
    expect(result.bass).toBeGreaterThan(0.4);
    expect(result.treble).toBe(0);
  });

  it('keeps every band within 0..1', () => {
    const spectrum = new Uint8Array(128).fill(255);
    const result = bands(spectrum);
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
