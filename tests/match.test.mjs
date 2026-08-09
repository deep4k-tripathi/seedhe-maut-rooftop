import { describe, expect, it } from 'vitest';
import {
  isEligible,
  normalise,
  parseCuration,
  pickBest,
  similarity,
  stripFeature,
} from '../scripts/match.mjs';

/** Shorthand for building an iTunes-shaped candidate. */
const track = (trackName, artistName, extra = {}) => ({
  trackId: Math.abs(hash(trackName + artistName)),
  trackName,
  artistName,
  previewUrl: 'https://audio-ssl.itunes.apple.com/x.m4a',
  ...extra,
});

function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

describe('normalise', () => {
  it('strips diacritics, punctuation and case', () => {
    expect(normalise('Náyaab!')).toBe('nayaab');
    expect(normalise("I Don't Miss That Life")).toBe('i don t miss that life');
  });

  it('survives null and undefined', () => {
    expect(normalise(null)).toBe('');
    expect(normalise(undefined)).toBe('');
  });
});

describe('stripFeature', () => {
  it('removes a trailing feature credit', () => {
    expect(stripFeature('Pankh (feat. Bawari Basanti)').trim()).toBe('Pankh');
    expect(stripFeature('Chalo Chalein (feat. Seedhe Maut)').trim()).toBe('Chalo Chalein');
  });

  it('leaves plain titles untouched', () => {
    expect(stripFeature('Teen Dost')).toBe('Teen Dost');
  });
});

describe('similarity', () => {
  it('scores identical titles as 1', () => {
    expect(similarity('Teen Dost', 'Teen Dost')).toBe(1);
  });

  it('ignores a feature suffix', () => {
    expect(similarity('Pankh', 'Pankh (feat. Bawari Basanti)')).toBe(1);
  });

  it('scores unrelated titles far below the threshold', () => {
    expect(similarity('Edhni', 'Bajenge')).toBeLessThan(0.3);
  });
});

describe('isEligible', () => {
  it('accepts a Seedhe Maut credit', () => {
    expect(isEligible({ title: 'Maina' }, track('Maina', 'Seedhe Maut'))).toBe(true);
  });

  it('accepts the joint Sez billing', () => {
    expect(
      isEligible({ title: 'Kohra' }, track('Kohra', 'Seedhe Maut & Sez on the Beat')),
    ).toBe(true);
  });

  it('accepts a third-party collab when the entry names that artist', () => {
    const entry = { title: 'Chalo Chalein', artistHint: 'Ritviz' };
    expect(isEligible(entry, track('Chalo Chalein (feat. Seedhe Maut)', 'Ritviz'))).toBe(true);
  });

  it('rejects an unrelated artist with the same title', () => {
    expect(isEligible({ title: 'Maina' }, track('Maina', 'Jasraj Joshi'))).toBe(false);
  });
});

describe('pickBest', () => {
  // The regression that shipped a wrong artist: the API returns an identically
  // titled song by someone else, and it must never win.
  it('prefers Seedhe Maut over an unrelated artist with an identical title', () => {
    const candidates = [
      track('Maina', 'Jasraj Joshi'),
      track('Maina', 'Seedhe Maut & Sez on the Beat'),
    ];
    expect(pickBest({ title: 'Maina' }, candidates).artistName).toBe(
      'Seedhe Maut & Sez on the Beat',
    );
  });

  it('returns null rather than guessing when nothing is eligible', () => {
    const candidates = [track('Maina', 'Jasraj Joshi'), track('Kohra', 'Sarab')];
    expect(pickBest({ title: 'Maina' }, candidates)).toBeNull();
  });

  it('returns null for a title that does not exist', () => {
    const candidates = [track('Bajenge', 'Seedhe Maut'), track('Nadaan', 'Seedhe Maut')];
    expect(pickBest({ title: 'Edhni' }, candidates)).toBeNull();
  });

  it('discards candidates with no preview stream', () => {
    const candidates = [track('Tofa', 'Seedhe Maut', { previewUrl: undefined })];
    expect(pickBest({ title: 'Tofa' }, candidates)).toBeNull();
  });

  it('penalises live and remix versions when a studio cut exists', () => {
    const candidates = [
      track('Nadaan (Live)', 'Seedhe Maut'),
      track('Nadaan', 'Seedhe Maut'),
    ];
    expect(pickBest({ title: 'Nadaan' }, candidates).trackName).toBe('Nadaan');
  });

  it('copes with an empty candidate list', () => {
    expect(pickBest({ title: 'Nadaan' }, [])).toBeNull();
    expect(pickBest({ title: 'Nadaan' }, undefined)).toBeNull();
  });
});

describe('parseCuration', () => {
  it('skips comments and blank lines', () => {
    const parsed = parseCuration('# header\n\nMaina\n\n# another\nTofa\n');
    expect(parsed).toEqual([{ title: 'Maina' }, { title: 'Tofa' }]);
  });

  it('reads an artist hint after the pipe', () => {
    expect(parseCuration('Chalo Chalein | Ritviz')).toEqual([
      { title: 'Chalo Chalein', artistHint: 'Ritviz' },
    ]);
  });

  it('returns nothing for an all-comment file', () => {
    expect(parseCuration('# only comments\n# here\n')).toEqual([]);
  });
});
