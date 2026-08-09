/**
 * Pure matching logic for the track resolver.
 *
 * Kept free of I/O so it can be tested against fixed candidate lists.
 */

/** The artist credit we consider canonical. Collabs bill differently, so we substring-match. */
export const CANONICAL_ARTIST = 'seedhe maut';

/** Below this title similarity we refuse to guess. */
export const TITLE_THRESHOLD = 0.72;

/** Versions we never want when a plain studio cut exists. */
const PENALISED = /\b(live|remix|instrumental|karaoke|sped up|slowed|reverb|cover|edit)\b/i;

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalise(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop a trailing "(feat. …)" / "(with …)" so titles compare on their core. */
export function stripFeature(title) {
  return String(title ?? '').replace(/\s*[([]\s*(feat|ft|with)[.\s][^)\]]*[)\]]/gi, '');
}

/** Levenshtein distance, iterative with a single rolling row. */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/** Similarity in [0,1]. 1 means identical after normalisation. */
export function similarity(a, b) {
  const x = normalise(stripFeature(a));
  const y = normalise(stripFeature(b));
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  const longest = Math.max(x.length, y.length);
  return 1 - editDistance(x, y) / longest;
}

/**
 * A candidate is only usable if Seedhe Maut are actually on it, or if the curation
 * entry named a different artist explicitly (collabs bill under the other name).
 *
 * Without this gate the API happily returns an unrelated artist's song with the same
 * title — "Maina" by Jasraj Joshi outscoring the track we actually want.
 */
export function isEligible(entry, candidate) {
  const artist = normalise(candidate?.artistName);
  const title = normalise(candidate?.trackName);
  if (artist.includes(CANONICAL_ARTIST) || title.includes(CANONICAL_ARTIST)) return true;
  if (entry.artistHint && artist.includes(normalise(entry.artistHint))) return true;
  return false;
}

/**
 * Score one iTunes result against a curation entry.
 * Title similarity dominates; artist credit breaks ties.
 */
export function scoreCandidate(entry, candidate) {
  if (!isEligible(entry, candidate)) return null;

  const title = similarity(entry.title, candidate.trackName);
  if (title < TITLE_THRESHOLD) return null;

  const artist = normalise(candidate.artistName);
  let score = title * 1000;

  if (artist.includes(CANONICAL_ARTIST)) score += 300;
  if (entry.artistHint && artist.includes(normalise(entry.artistHint))) score += 200;
  if (PENALISED.test(candidate.trackName ?? '')) score -= 400;
  // An exact title match beats a merely close one, independent of length effects.
  if (normalise(stripFeature(entry.title)) === normalise(stripFeature(candidate.trackName))) {
    score += 100;
  }

  return { score, title, candidate };
}

/**
 * Pick the best candidate, or null when nothing clears the threshold.
 * Candidates without a previewUrl are unusable and are discarded first.
 */
export function pickBest(entry, candidates) {
  const scored = (candidates ?? [])
    .filter((c) => c && c.previewUrl)
    .map((c) => scoreCandidate(entry, c))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].candidate : null;
}

/**
 * Parse curation.txt into entries.
 * Blank lines and `#` comments are skipped; `Title | Artist hint` splits on the pipe.
 */
export function parseCuration(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [title, artistHint] = line.split('|').map((part) => part.trim());
      return artistHint ? { title, artistHint } : { title };
    })
    .filter((entry) => entry.title);
}
