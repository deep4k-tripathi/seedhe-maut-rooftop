# SM Nation — Design

**Date:** 2026-08-10
**Status:** Approved

## Concept

A single page. A Delhi rooftop at night, hand-drawn in SVG, that reacts to the music.
Tap anywhere and a curated Seedhe Maut set plays. The scene pulses with the bassline.
A live count of everyone else on the page sits in the corner. Links hand off to the
full tracks on Spotify, YouTube Music, and Apple Music.

Inspired by saloon.wtf, which achieves the same effect with 30-second Apple Music
preview clips rather than hosted audio.

## Key technical finding

saloon.wtf hosts no music. Every track streams from
`audio-ssl.itunes.apple.com/.../mzaf_*.m4a` — the free, public, unauthenticated
preview endpoints exposed by the iTunes Search API. No login, no SDK, no licensing
exposure, no bandwidth cost.

Two facts verified against the live API before committing to this design:

1. Seedhe Maut's catalog is fully present — 166 unique tracks, every one with a
   working `previewUrl`.
2. The preview CDN returns `access-control-allow-origin: *`. Audio can therefore be
   routed through the Web Audio API with `crossOrigin="anonymous"`, which makes a
   genuine audio-reactive visualizer possible rather than a faked one.

Constraint accepted: previews are 30 seconds. This is a vibe jukebox that hands off
to streaming services for full listening, not a replacement for them.

## Stack

Vite + TypeScript, no framework. The page is one screen; a framework would cost more
bytes than the entire site. Static build, deployed to Vercel's free tier.

Budget: under 50 KB of JavaScript, gzipped.

## Structure

```
src/scene/      SVG Delhi night scene, exposes pulse(levels) — knows nothing about audio
src/player/     engine.ts (audio + analyser), ui.ts (transport) — knows nothing about the scene
src/presence/   WebSocket client for the live counter — fails invisibly
data/curation.txt    the curated list, one song per line   <- the only file edited by hand
data/tracks.json     generated, committed
scripts/resolve-tracks.mjs   curation.txt -> tracks.json via the iTunes API
worker/         Cloudflare Worker + Durable Object, the live counter
```

Data flows one direction:

```
curation.txt --build--> tracks.json --import--> engine --rAF--> levels --> scene.pulse()
                                                presence WS --> counter badge
```

Each module is independently testable. The scene never imports the player; the player
never imports the scene. `main.ts` wires them together.

## Module contracts

| Module | Purpose | Public surface | Depends on |
|---|---|---|---|
| `player/engine.ts` | Own one `<audio>` element and an `AnalyserNode`; manage playlist state | `play() pause() next() prev() toggle() levels() on(event, cb)` | `tracks.json` |
| `player/ui.ts` | Render transport, now-playing, progress | `mount(root, engine)` | engine events |
| `scene/index.ts` | Draw the scene, animate it | `mount(root)`, `pulse(levels)` | nothing |
| `presence/client.ts` | Maintain WS, expose live count | `connect(url), onCount(cb)` | nothing |
| `scripts/resolve-tracks.mjs` | Build-time resolution of names to track records | CLI | iTunes API |

`resolve-tracks.mjs` is build-time only and never ships to the browser.

## Curation loop

`data/curation.txt` holds one song name per line. The resolver searches the iTunes API,
prefers results where "Seedhe Maut" appears in the artist credit, and writes
`data/tracks.json` with `previewUrl`, artwork, album, artist, duration, and a stable
`trackId`.

Storing `trackId` makes re-resolution deterministic if Apple ever rotates an asset URL.

Two tracks in the curated set — Pankh and Chalo Chalein — are credited to
"Seedhe Maut & Sez on the Beat" and "Ritviz" respectively, so they live under different
artist IDs. The resolver matches on artist-credit substring rather than exact artist ID
to catch these.

## The scene

Rooftop foreground: water tanks, tangled wires, drying clothes. Mid-ground of low Delhi
blocks with lit windows. A haze-orange night sky behind. A festoon of jhalar lights
strung overhead.

Palette: black, bone white, one bruised red.

Audio reactive:
- Bass drives window glow
- Mids drive the tube-light flicker
- Transients snap the wires

Hand-made rather than photoreal, deliberately.

## Live counter

A Cloudflare Worker with a single Durable Object, over WebSocket. An open connection
means one person present; on connect and disconnect the object broadcasts the new count.
No heartbeat bookkeeping and no TTL guessing.

Free-tier viability was verified: Durable Objects are available on the Workers Free plan
(SQLite-backed only), with 100,000 requests/day, and WebSocket Hibernation avoids
duration billing. One connection is one request, so this supports 100k page loads a day
at zero cost.

The site stays on Vercel. This is a separate, self-contained service.

## Failure modes

| Failure | Behaviour |
|---|---|
| Preview URL 404s (Apple rotated the asset) | Skip to next track, log the dead `trackId`. Never a silent stall. |
| Autoplay blocked (all mobile browsers) | Page opens on a "tap to begin" curtain. Required anyway, and a better first impression. |
| Counter offline or not yet deployed | Badge does not render. Site fully functional. No fabricated numbers. |
| Artwork fails to load | Gradient fallback keyed to the track. |
| `tracks.json` empty or malformed | Build fails loudly rather than shipping a dead player. |

## Testing

Vitest covers the two components with real logic:

- **Resolver** — name resolves to the correct track; handles no-match; prefers
  Seedhe Maut credits over unrelated artists with similar titles.
- **Engine playlist state machine** — next/prev/wrap/shuffle, and skip-on-error.

Scene and UI are verified manually in a browser with screenshots.

## Deployment

- Site: Vercel free tier, static output from `vite build`
- Counter: `wrangler deploy` to a Cloudflare free account
- Domain: `deepaktrip.wtf`, registered 2026-08-09 at GoDaddy, on GoDaddy nameservers
  (`ns07/ns08.domaincontrol.com`). DNS records added at GoDaddy point it at Vercel.

## Out of scope

Accounts, likes, chat, request queue, analytics, PWA/offline, lyrics, admin UI.

## Curated set

Twelve tracks confirmed present in the catalog with working previews:

Maina, Baat Aisi Ghar Jaisi, Teen Dost, Kohra, Nadaan, Kavi, Hoshiyaar, Tofa,
Na Jaaye, I Don't Miss That Life, Pankh, Chalo Chalein.

A thirteenth entry from the original list, "Edhni", returns zero results across the
entire iTunes store and does not exist. Replacement pending: either "Uss Din" or
"Chalta Reh", both real Bayaan tracks in the same mellow register.
