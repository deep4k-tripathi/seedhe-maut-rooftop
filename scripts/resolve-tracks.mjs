#!/usr/bin/env node
/**
 * data/curation.txt -> data/tracks.json
 *
 * Resolves each curated song name against the iTunes Search API and records the
 * preview stream, artwork and a stable trackId. Build-time only; never shipped
 * to the browser.
 *
 * Usage: npm run tracks
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseCuration, pickBest, similarity, TITLE_THRESHOLD } from './match.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CURATION = resolve(ROOT, 'data/curation.txt');
const OUTPUT = resolve(ROOT, 'data/tracks.json');
const STORE = 'IN';

/**
 * Artist catalogues are the trustworthy source. The Search API is keyword-ranked and
 * routinely fails to surface a track that plainly exists, so we pull whole
 * discographies first and only fall back to search for outside collabs.
 */
const CATALOGUE_ARTIST_IDS = [
  1233336608, // Seedhe Maut
  1287062189, // Sez on the Beat — carries the Bayaan-era joint billing
];

/** Apple serves 100x100 by default; ask for something that survives a retina display. */
function upscaleArtwork(url, size = 600) {
  return String(url ?? '').replace(/\/\d+x\d+bb\.jpg$/, `/${size}x${size}bb.jpg`);
}

async function search(term) {
  const url =
    'https://itunes.apple.com/search?' +
    new URLSearchParams({ term, entity: 'song', limit: '40', country: STORE });

  const res = await fetch(url, { headers: { 'User-Agent': 'sm-nation/1.0' } });
  if (!res.ok) throw new Error(`iTunes search failed (${res.status}) for "${term}"`);
  // The API occasionally replies with text/javascript; parse defensively.
  return JSON.parse(await res.text()).results ?? [];
}

/** Every song credited to an artist, straight from the lookup endpoint. */
async function catalogueFor(artistId) {
  const url =
    'https://itunes.apple.com/lookup?' +
    new URLSearchParams({
      id: String(artistId),
      entity: 'song',
      limit: '200',
      country: STORE,
    });

  const res = await fetch(url, { headers: { 'User-Agent': 'sm-nation/1.0' } });
  if (!res.ok) throw new Error(`iTunes lookup failed (${res.status}) for artist ${artistId}`);
  const rows = JSON.parse(await res.text()).results ?? [];
  return rows.filter((row) => row?.wrapperType === 'track');
}

/** Load and merge every catalogue once, so per-track resolution is a local operation. */
async function loadCatalogue() {
  const lists = await Promise.all(CATALOGUE_ARTIST_IDS.map(catalogueFor));
  const byId = new Map();
  for (const row of lists.flat()) if (row?.trackId) byId.set(row.trackId, row);
  return [...byId.values()];
}

/**
 * Catalogue first. Search is only consulted when the catalogue has no match, which
 * is the case for collabs released under a third artist (Ritviz, Badshah, and so on).
 */
async function candidatesFor(entry, catalogue) {
  const local = catalogue.filter((row) => scoreable(entry, row));
  if (local.length) return local;

  const biased = `${entry.artistHint ?? 'Seedhe Maut'} ${entry.title}`;
  const [a, b] = await Promise.all([search(biased), search(entry.title)]);
  const byId = new Map();
  for (const row of [...a, ...b]) if (row?.trackId) byId.set(row.trackId, row);
  return [...byId.values()];
}

/** Cheap pre-filter so we do not run the search fallback when the catalogue already has it. */
function scoreable(entry, row) {
  return similarity(entry.title, row.trackName) >= TITLE_THRESHOLD;
}

/** Confirm the preview stream is actually reachable before we bake it in. */
async function previewIsLive(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Compare the resolved set against what is committed, by trackId only.
 *
 * Preview URLs are deliberately excluded: Apple rotates those asset paths, so diffing
 * them would fail on runs where nothing about the curation actually changed.
 */
async function check(tracks) {
  const committed = JSON.parse(await readFile(OUTPUT, 'utf8'));
  const before = committed.map((t) => t.id).sort((a, b) => a - b);
  const after = tracks.map((t) => t.id).sort((a, b) => a - b);

  if (JSON.stringify(before) === JSON.stringify(after)) {
    console.log(`\ntracks.json is in sync with curation.txt (${after.length} tracks)`);
    return;
  }

  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  console.error('\ntracks.json is out of sync with curation.txt.');
  if (added.length) console.error(`  missing from tracks.json: ${added.join(', ')}`);
  if (removed.length) console.error(`  no longer resolved: ${removed.join(', ')}`);
  console.error("Run 'npm run tracks' and commit the result.");
  process.exit(1);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const entries = parseCuration(await readFile(CURATION, 'utf8'));
  if (!entries.length) throw new Error('curation.txt has no entries');

  const catalogue = await loadCatalogue();
  console.log(
    `Loaded ${catalogue.length} catalogue tracks. Resolving ${entries.length} curated entries…\n`,
  );

  const tracks = [];
  const missing = [];
  const dead = [];

  for (const entry of entries) {
    const match = pickBest(entry, await candidatesFor(entry, catalogue));

    if (!match) {
      missing.push(entry.title);
      console.log(`  MISS  ${entry.title}`);
      continue;
    }

    if (!(await previewIsLive(match.previewUrl))) {
      dead.push(`${entry.title} (id=${match.trackId})`);
      console.log(`  DEAD  ${entry.title} — preview URL unreachable`);
      continue;
    }

    tracks.push({
      id: match.trackId,
      title: match.trackName,
      artist: match.artistName,
      album: match.collectionName ?? '',
      year: Number(String(match.releaseDate ?? '').slice(0, 4)) || null,
      preview: match.previewUrl,
      artwork: upscaleArtwork(match.artworkUrl100),
      durationMs: match.trackTimeMillis ?? null,
      appleUrl: match.trackViewUrl ?? null,
    });

    console.log(`  OK    ${entry.title} → ${match.trackName} · ${match.artistName}`);
  }

  if (!tracks.length) {
    throw new Error('Resolved zero tracks — refusing to write an empty playlist.');
  }

  if (checkOnly) return check(tracks);

  await writeFile(OUTPUT, JSON.stringify(tracks, null, 2) + '\n');

  console.log(`\nWrote ${tracks.length} tracks to data/tracks.json`);
  if (missing.length) console.log(`Unresolved (not in the store): ${missing.join(', ')}`);
  if (dead.length) console.log(`Dead previews (re-run to refresh): ${dead.join(', ')}`);
}

main().catch((error) => {
  console.error(`\nresolve-tracks failed: ${error.message}`);
  process.exit(1);
});
