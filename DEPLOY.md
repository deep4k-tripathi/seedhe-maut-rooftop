# Deploying

Two independent pieces: the static site on Vercel, and the live-counter Worker on
Cloudflare. The site works without the Worker — the counter badge just never appears —
so ship the site first and add the counter whenever.

Both steps need a browser login, so they cannot be automated from here.

---

## 1. The site → Vercel

Import the repo rather than using the CLI: Vercel then rebuilds on every push to `main`,
which is what you want anyway.

1. Go to <https://vercel.com/new>
2. Sign in **with GitHub** (as `deep4k-tripathi`)
3. Import `deep4k-tripathi/seedhe-maut-rooftop`
4. Take every default — `vercel.json` already sets the framework, build command and
   output directory
5. Deploy

You get a `*.vercel.app` URL in about a minute. Every later `git push` redeploys.

---

## 2. The domain → `deepaktrip.wtf`

The domain is registered and sitting on GoDaddy nameservers
(`ns07/ns08.domaincontrol.com`), so add the records at GoDaddy — do **not** change
nameservers.

In Vercel: **Project → Settings → Domains → Add** `deepaktrip.wtf`. Vercel will show the
records it wants. They will be:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Then in GoDaddy: **My Products → DNS → Manage Zones → deepaktrip.wtf → Add Record**.

Delete GoDaddy's default parked `A @` record first, or the new one will conflict.

Use whatever values Vercel shows you rather than the table above if they differ — Vercel
changes these occasionally, and its dashboard is authoritative.

DNS usually propagates in minutes. Check with:

```bash
dig +short A deepaktrip.wtf
```

### If the domain still is not visible in GoDaddy

RDAP confirms it is registered to a GoDaddy account, created 2026-08-09 18:39 UTC and
expiring 2027-08-09. If your dashboard does not list it, you are almost certainly signed
into a different GoDaddy account than the one that checked out. Find the purchase receipt
from 9 August and look at which address it was sent to.

---

## 3. The live counter → Cloudflare

**Already deployed.** Live at:

```
https://sm-nation-presence.deepak-tripathi.workers.dev
```

`ALLOWED_ORIGINS` is set in `worker/wrangler.toml` and applies on deploy. To ship a
change:

```bash
cd worker && npx wrangler deploy
```

If you ever deploy from a fresh Cloudflare account, note that Workers has to be opened
in the dashboard once before the first deploy will succeed — it fails with
`You need a workers.dev subdomain` until you load **Compute** in the dashboard sidebar.
(Workers is under "Compute" now, not the old "Workers & Pages" entry.)

### The site points at it via

Vercel → **Settings → Environment Variables**:

```
VITE_PRESENCE_URL = wss://sm-nation-presence.deepak-tripathi.workers.dev
```

`wss://`, not `https://`. **Changing this requires a Vercel redeploy** — Vite inlines env
vars at build time, so an existing build keeps the old value.

---

## Checking it worked

- Site loads and the curtain says "Chadh ja chhat pe"
- Tapping in starts a track and the city reacts to the bass
- Counter appears top-right — open a second tab and it should read 2

If the counter never appears, the WebSocket is not connecting. That is deliberate: the
badge hides rather than showing a made-up number. Check the browser console and confirm
`VITE_PRESENCE_URL` was set **before** the build that is currently live.

Quick health check without a browser:

```bash
curl -s https://sm-nation-presence.deepak-tripathi.workers.dev
```

Returns `{"count":N}`. To confirm the origin lock still works, an upgrade request from an
unlisted origin should come back `403 Forbidden origin`.
