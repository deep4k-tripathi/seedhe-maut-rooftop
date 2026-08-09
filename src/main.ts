/**
 * Wiring. Everything interesting lives in the modules; this file only connects them.
 */
import './styles/main.css';
import rawTracks from '../data/tracks.json';
import { LINKS, PRESENCE_URL } from './config';
import { createEngine, type Track } from './player/engine';
import { bindKeys, mount as mountDock } from './player/ui';
import { createPresence } from './presence/client';
import { mount as mountScene, pulse } from './scene';

const tracks = rawTracks as Track[];

const root = document.documentElement;
const sceneRoot = document.querySelector<HTMLElement>('#scene')!;
const dock = document.querySelector<HTMLElement>('#dock')!;
const curtain = document.querySelector<HTMLElement>('#curtain')!;
const enter = document.querySelector<HTMLButtonElement>('#enter')!;
const live = document.querySelector<HTMLElement>('#live')!;
const liveCount = document.querySelector<HTMLElement>('#live-count')!;
const linkBar = document.querySelector<HTMLElement>('#links')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
const setlist = document.querySelector<HTMLElement>('#setlist')!;

mountScene(sceneRoot);

linkBar.innerHTML = LINKS.map(
  (link) =>
    `<a href="${link.href}" target="_blank" rel="noopener noreferrer" title="${link.name}"` +
    ` aria-label="${link.name}"><svg viewBox="0 0 24 24"><path d="${link.icon}"/></svg></a>`,
).join('');

setlist.textContent = `${tracks.length} tracks · 30s previews`;

if (!tracks.length) {
  // The build guards against this, but never leave a dead play button on screen.
  notice.textContent = 'No tracks configured.';
  notice.hidden = false;
  enter.disabled = true;
} else {
  const engine = createEngine(tracks);

  mountDock(dock, engine);
  bindKeys(engine);

  engine.on('exhausted', () => {
    notice.textContent = 'Every preview is unreachable right now. Try a reload.';
    notice.hidden = false;
  });
  engine.on('play', () => {
    notice.hidden = true;
  });

  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    curtain.dataset.open = 'false';
    dock.hidden = false;
    engine.begin();
  };

  enter.addEventListener('click', begin);
  curtain.addEventListener('click', begin);

  // Drive the scene from the live spectrum.
  const frame = () => {
    pulse(root, engine.readLevels());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// The counter is decoration: if it never connects, nothing here runs and the badge
// stays hidden. No placeholder number is ever shown.
const presence = createPresence(PRESENCE_URL);
presence.onCount((count) => {
  liveCount.textContent = String(count);
  live.dataset.ready = 'true';
});
presence.start();
