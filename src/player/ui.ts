/**
 * Transport controls and the now-playing card.
 *
 * Reads the engine through its public surface and subscribes to its events.
 * Holds no playback state of its own.
 */
import type { Engine } from './engine';

const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2.5v12H6zm3.5 6L19 6v12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M15.5 6H18v12h-2.5zM5 6l9.5 6L5 18z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zm6.4 0H17v14h-3.6z"/></svg>',
};

/** A 1x1 transparent gif, used when a cover fails so the layout never jumps. */
const BLANK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function seconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const total = Math.floor(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function mount(dock: HTMLElement, engine: Engine): void {
  dock.innerHTML = `
    <img class="art" alt="" src="${BLANK}">
    <div class="meta">
      <div class="title"></div>
      <div class="sub"></div>
      <div class="bar"><i></i></div>
    </div>
    <div class="transport">
      <button class="prev" type="button" aria-label="Previous track">${ICON.prev}</button>
      <button class="play" type="button" aria-label="Play or pause">${ICON.pause}</button>
      <button class="next" type="button" aria-label="Next track">${ICON.next}</button>
    </div>`;

  const art = dock.querySelector<HTMLImageElement>('.art')!;
  const title = dock.querySelector<HTMLElement>('.title')!;
  const sub = dock.querySelector<HTMLElement>('.sub')!;
  const fill = dock.querySelector<HTMLElement>('.bar i')!;
  const playButton = dock.querySelector<HTMLButtonElement>('.play')!;

  art.addEventListener('error', () => {
    art.src = BLANK; // gradient background shows through
  });

  dock.querySelector('.prev')!.addEventListener('click', () => engine.previous());
  dock.querySelector('.next')!.addEventListener('click', () => engine.next());
  playButton.addEventListener('click', () => engine.toggle());

  function renderTrack(): void {
    const track = engine.current;
    art.src = track.artwork || BLANK;
    title.textContent = track.title;
    const year = track.year ? ` · ${track.year}` : '';
    sub.textContent = `${track.artist}${track.album ? ` — ${track.album}` : ''}${year}`;
    document.title = `${track.title} · SM Nation`;
  }

  function renderPlayState(): void {
    playButton.innerHTML = engine.playing ? ICON.pause : ICON.play;
  }

  function renderProgress(): void {
    fill.style.width = `${(engine.progress * 100).toFixed(2)}%`;
    sub.title = `${seconds(engine.elapsed)} / ${seconds(engine.duration)}`;
  }

  engine.on('track', renderTrack);
  engine.on('play', renderPlayState);
  engine.on('pause', renderPlayState);
  engine.on('time', renderProgress);

  renderTrack();
  renderPlayState();
}

/** Keyboard shortcuts, bound at the document level. */
export function bindKeys(engine: Engine): void {
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.isContentEditable) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        engine.toggle();
        break;
      case 'ArrowRight':
        engine.next();
        break;
      case 'ArrowLeft':
        engine.previous();
        break;
    }
  });
}
