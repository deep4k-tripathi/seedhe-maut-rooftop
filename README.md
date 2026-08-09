# SM Nation

A Delhi rooftop at night that plays Seedhe Maut.

One page. Hand-drawn SVG scene that reacts to the music, a curated set of tracks, a live
headcount of everyone else on the page, and links out to the full songs.

Inspired by [saloon.wtf](https://saloon.wtf).

## How the music works

No audio is hosted here. Every track streams from Apple's public 30-second preview
endpoints (`audio-ssl.itunes.apple.com`), the same free, unauthenticated URLs the iTunes
Search API hands out. No login, no SDK, no licensing exposure, no bandwidth bill.

Those endpoints serve `access-control-allow-origin: *`, so the audio can be routed
through the Web Audio API. The scene reacts to the real spectrum — bass drives the
window glow, mids drive the tube-light flicker, transients move the wires.

Thirty seconds a track is the trade. The site is a jukebox that hands off to Spotify,
Apple Music and YouTube Music for real listening.

## Curating the set

Edit `data/curation.txt` — one song per line, `#` for comments. Append `| Artist` to
disambiguate a collab released under someone else's name.

```bash
npm run tracks
```

That resolves each name against the iTunes catalogue and rewrites `data/tracks.json`
with preview URLs, artwork and stable track IDs. Commit both files.

The resolver reads whole artist discographies rather than using keyword search, because
search is keyword-ranked and routinely fails to surface tracks that plainly exist. It
also hard-gates on the artist credit: a candidate is only accepted if Seedhe Maut are
actually on it, or if you named a different artist explicitly. Without that gate the API
happily returns an unrelated artist's song with the same title.

If a name cannot be resolved the script says so and skips it rather than guessing.

## Development

```bash
npm install
npm run tracks    # refresh data/tracks.json
npm run dev       # http://localhost:5173
npm test          # matcher + playlist state machine
npm run typecheck
npm run build
```

## Layout

```
src/scene/      the rooftop; exposes pulse(levels), knows nothing about audio
src/player/     engine.ts (audio + analyser), ui.ts (transport)
src/presence/   WebSocket client for the headcount; fails invisibly
src/config.ts   presence endpoint and outbound links
data/           curation.txt (edit this) -> tracks.json (generated)
scripts/        resolve-tracks.mjs, match.mjs
worker/         Cloudflare Worker + Durable Object for the live counter
```

Data flows one way:

```
curation.txt --build--> tracks.json --import--> engine --rAF--> levels --> scene.pulse()
```

The scene never imports the player and the player never imports the scene.

## The live counter

A Cloudflare Worker with one Durable Object over WebSocket. An open connection is one
person; connect and disconnect rebroadcast the count. No heartbeats, no TTL guessing.

Durable Objects run on the Workers **free** plan (SQLite-backed), 100k requests/day, and
WebSocket Hibernation avoids duration billing. One connection is one request.

Point the site at it with `VITE_PRESENCE_URL`. Leave it unset and the badge never
renders — the site works fine without it and never shows a fabricated number.

## Deploying

Site is a static build (`npm run build` → `dist/`), hosted on Vercel's free tier.
Counter deploys separately with `wrangler deploy`.

## Licence

Code is MIT. The music is not mine and is not redistributed — only Apple's public
preview streams are linked, and all artwork and metadata belong to their owners.
