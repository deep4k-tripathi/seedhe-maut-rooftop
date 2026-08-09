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
through the Web Audio API and the scene can react to the real spectrum.

Thirty seconds a track is the trade. The site is a jukebox that hands off to Spotify,
Apple Music and YouTube Music for real listening.

## The scene

"Dilli, 11:40 pm" — a south Delhi rooftop, ported from the Claude Design composition
*Rooftop Scene Delhi Night*. A 20 second loop: the camera pushes in on a hooded figure
on the parapet, he takes a drag and exhales, a flight crosses behind the Qutub Minar, and
the frame pulls back as दिल्ली settles over the city.

It is a faithful port from React plus a composition runtime to vanilla TS — those would
have cost roughly 45 KB gzipped for what is, here, a background. The model is unchanged:
the whole scene is a pure function of authored time `T`. Static scenery is built once as
markup and each frame writes only the attributes that move.

Two things in `src/scene/composition.ts` are load-bearing and easy to break:

- The scenery comes from **one shared PRNG consumed in a fixed order** (far blocks, mid
  blocks, far windows, mid windows, stars, mid antennae, near band). Reordering those
  calls — or adding one — regenerates a different skyline.
- The crop **tracks the figure**, not the stage centre. The camera frames him left of
  centre, so a plain `object-fit: cover` sliced him off portrait viewports entirely.

Audio never overrides the authored choreography. It only lifts the city's light sources —
windows, the hoarding, the pool of light, the haze — so the piece reads exactly as made
even in silence.

The scene holds on a single still frame when the viewer has `prefers-reduced-motion`.

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
src/scene/      index.ts owns the clock; composition.ts is the ported piece
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
