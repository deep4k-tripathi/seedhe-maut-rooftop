/**
 * Everything you might want to change without reading any other file.
 */

/**
 * WebSocket endpoint for the live headcount.
 * Set VITE_PRESENCE_URL at build time. Left unset, the badge simply never appears —
 * the site works fine without it.
 */
export const PRESENCE_URL: string | undefined =
  import.meta.env.VITE_PRESENCE_URL || undefined;

/**
 * Where to send people for the full tracks. Every URL here was checked live;
 * replace them with your own playlists whenever you like.
 */
export const LINKS = [
  {
    name: 'Spotify',
    href: 'https://open.spotify.com/playlist/04PQUyjYmUPQNgSW0z2b3m',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.8.8 0 0 1-1.1.3c-3-1.8-6.7-2.2-11.1-1.2a.8.8 0 1 1-.3-1.5c4.8-1.1 8.9-.6 12.2 1.4a.8.8 0 0 1 .3 1zm1.2-2.8a1 1 0 0 1-1.3.3c-3.4-2.1-8.6-2.7-12.6-1.5A1 1 0 1 1 3.3 10c4.6-1.4 10.3-.7 14.2 1.7a1 1 0 0 1 .3 1.4zm.1-2.9C14.8 8.3 8.5 8.1 5 9.2a1.2 1.2 0 0 1-.7-2.3c4-1.2 11-1 15.1 1.5a1.2 1.2 0 0 1-1.2 2z',
  },
  {
    name: 'Apple Music',
    href: 'https://music.apple.com/in/artist/seedhe-maut/1233336608',
    icon: 'M16.4 3c.1 1-.3 2-1 2.8-.6.8-1.7 1.4-2.7 1.3-.1-1 .4-2 1-2.7.7-.8 1.8-1.4 2.7-1.4zm3.3 15c-.5 1.1-.7 1.6-1.3 2.6-.9 1.4-2.1 3.1-3.6 3.1-1.3 0-1.7-.9-3.5-.9s-2.2.9-3.5.9c-1.5 0-2.7-1.6-3.6-3C1.8 17.3 1.6 13 3.2 10.7c1.1-1.6 2.8-2.6 4.4-2.6 1.6 0 2.7 1 4 1 1.3 0 2-1 3.9-1 1.4 0 2.9.8 4 2.1-3.5 1.9-3 6.9.2 8.1z',
  },
  {
    name: 'YouTube Music',
    href: 'https://music.youtube.com/search?q=Seedhe+Maut',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18.2a8.2 8.2 0 1 1 0-16.4 8.2 8.2 0 0 1 0 16.4zM9.8 8.3v7.4L16 12z',
  },
] as const;
