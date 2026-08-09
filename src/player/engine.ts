/**
 * The audio engine.
 *
 * Owns exactly one <audio> element and one AnalyserNode. Knows about tracks and
 * playback state; knows nothing about the DOM, the scene, or how anything looks.
 */

export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  preview: string;
  artwork: string;
  durationMs: number | null;
  appleUrl: string | null;
}

/** Normalised 0..1 energy bands, smoothed for animation. */
export interface Levels {
  bass: number;
  mid: number;
  treble: number;
  level: number;
}

export type EngineEvent = 'track' | 'play' | 'pause' | 'time' | 'exhausted';
type Listener = () => void;

const SILENT: Levels = { bass: 0, mid: 0, treble: 0, level: 0 };

/** How quickly the visualiser catches up. Higher is snappier, lower is smoother. */
const ATTACK = 0.45;
const DECAY = 0.12;

/** Fisher-Yates. Returns a fresh array; the caller's order is left alone. */
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Playlist position tracking, extracted so it can be tested without an AudioContext.
 * Holds an order of indices into the track array and a cursor over that order.
 */
export function createPlaylist(size: number, order?: number[]) {
  if (size <= 0) throw new Error('createPlaylist needs at least one track');
  let sequence = order ?? shuffled([...Array(size).keys()]);
  let cursor = 0;
  /** Tracks that failed to load. Once every track is dead we stop rather than spin. */
  const dead = new Set<number>();

  const api = {
    get current(): number {
      return sequence[cursor]!;
    },
    get exhausted(): boolean {
      return dead.size >= size;
    },
    markDead(): void {
      dead.add(api.current);
    },
    markAlive(): void {
      dead.delete(api.current);
    },
    /** Advance by `step`, wrapping, skipping anything already known to be dead. */
    step(step: number): number {
      for (let attempts = 0; attempts < size; attempts++) {
        cursor = (cursor + step + sequence.length) % sequence.length;
        if (!dead.has(api.current)) return api.current;
      }
      return api.current;
    },
    jumpTo(trackIndex: number): number {
      const at = sequence.indexOf(trackIndex);
      if (at >= 0) cursor = at;
      return api.current;
    },
    reshuffle(random?: () => number): void {
      const currentTrack = api.current;
      sequence = shuffled([...Array(size).keys()], random);
      cursor = Math.max(0, sequence.indexOf(currentTrack));
    },
  };

  return api;
}

export function createEngine(tracks: readonly Track[]) {
  if (!tracks.length) throw new Error('createEngine needs at least one track');

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';

  const playlist = createPlaylist(tracks.length);
  const listeners = new Map<EngineEvent, Set<Listener>>();

  let context: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let spectrum: Uint8Array | undefined;
  let levels: Levels = { ...SILENT };

  const emit = (event: EngineEvent) => listeners.get(event)?.forEach((fn) => fn());

  /**
   * The graph can only be built inside a user gesture, so it is created on first play
   * rather than at construction.
   */
  function ensureGraph(): void {
    if (context) return;
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return; // No Web Audio: playback still works, the scene just stays calm.

    context = new Ctor();
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    spectrum = new Uint8Array(analyser.frequencyBinCount);
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
  }

  function load(trackIndex: number, autoplay: boolean): void {
    const track = tracks[trackIndex]!;
    audio.src = track.preview;
    emit('track');
    if (autoplay) void start();
  }

  async function start(): Promise<void> {
    ensureGraph();
    if (context?.state === 'suspended') await context.resume();
    try {
      await audio.play();
    } catch {
      // Autoplay policy or a dead source. The 'error' handler deals with the latter.
    }
  }

  audio.addEventListener('playing', () => {
    playlist.markAlive();
    emit('play');
  });
  audio.addEventListener('pause', () => emit('pause'));
  audio.addEventListener('timeupdate', () => emit('time'));
  audio.addEventListener('ended', () => next());

  // A 404 on a rotated Apple asset must not stall the room.
  audio.addEventListener('error', () => {
    const track = tracks[playlist.current]!;
    console.warn(`[sm-nation] preview unreachable, skipping: ${track.title} (id=${track.id})`);
    playlist.markDead();
    if (playlist.exhausted) {
      emit('exhausted');
      return;
    }
    load(playlist.step(1), true);
  });

  function next(): void {
    load(playlist.step(1), true);
  }

  function previous(): void {
    // Match the convention every player uses: restart the track before stepping back.
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    load(playlist.step(-1), true);
  }

  return {
    get current(): Track {
      return tracks[playlist.current]!;
    },
    get playing(): boolean {
      return !audio.paused && !audio.ended;
    },
    get exhausted(): boolean {
      return playlist.exhausted;
    },
    /** 0..1 through the current preview. */
    get progress(): number {
      return audio.duration > 0 ? audio.currentTime / audio.duration : 0;
    },
    get elapsed(): number {
      return audio.currentTime || 0;
    },
    get duration(): number {
      return Number.isFinite(audio.duration) ? audio.duration : 0;
    },

    play: start,
    pause: () => audio.pause(),
    toggle: () => (audio.paused ? void start() : audio.pause()),
    next,
    previous,
    playTrack(trackIndex: number): void {
      load(playlist.jumpTo(trackIndex), true);
    },
    /** Begin the session on the first shuffled track. */
    begin(): void {
      load(playlist.current, true);
    },

    /** Current smoothed energy bands, sampled fresh on each call. */
    readLevels(): Levels {
      if (!analyser || !spectrum || audio.paused) {
        levels = ease(levels, SILENT);
        return levels;
      }
      analyser.getByteFrequencyData(spectrum as Uint8Array<ArrayBuffer>);
      levels = ease(levels, bands(spectrum));
      return levels;
    },

    on(event: EngineEvent, listener: Listener): () => void {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;

/** Average a slice of the spectrum into 0..1. */
function average(spectrum: Uint8Array, from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += spectrum[i] ?? 0;
  return total / Math.max(1, to - from) / 255;
}

/** Split the spectrum into the three bands the scene reacts to. */
export function bands(spectrum: Uint8Array): Levels {
  const n = spectrum.length;
  const bass = average(spectrum, 0, Math.floor(n * 0.08));
  const mid = average(spectrum, Math.floor(n * 0.08), Math.floor(n * 0.35));
  const treble = average(spectrum, Math.floor(n * 0.35), n);
  return { bass, mid, treble, level: (bass + mid + treble) / 3 };
}

/** Rise fast, fall slow — reads as punchy rather than twitchy. */
function ease(from: Levels, to: Levels): Levels {
  const blend = (a: number, b: number) => a + (b - a) * (b > a ? ATTACK : DECAY);
  return {
    bass: blend(from.bass, to.bass),
    mid: blend(from.mid, to.mid),
    treble: blend(from.treble, to.treble),
    level: blend(from.level, to.level),
  };
}
