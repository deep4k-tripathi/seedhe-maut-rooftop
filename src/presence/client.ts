/**
 * Live headcount over a WebSocket.
 *
 * Deliberately silent about its own failures: if the socket never connects, the
 * badge simply never appears. The site does not depend on it, and it never invents
 * a number.
 */

type CountListener = (count: number) => void;

/** Reconnect backoff, in milliseconds. Caps out rather than growing forever. */
const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;

export function createPresence(url: string | undefined) {
  const listeners = new Set<CountListener>();
  let socket: WebSocket | undefined;
  let attempt = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(): void {
    if (closed) return;
    // Jitter keeps a crowd from reconnecting in lockstep after a restart.
    const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
    const jitter = delay * (0.5 + Math.random() * 0.5);
    timer = setTimeout(connect, jitter);
    attempt++;
  }

  function connect(): void {
    if (closed || !url) return;

    try {
      socket = new WebSocket(url);
    } catch {
      schedule();
      return;
    }

    socket.addEventListener('open', () => {
      attempt = 0;
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (typeof payload?.count === 'number' && payload.count >= 0) {
          listeners.forEach((fn) => fn(payload.count));
        }
      } catch {
        // A malformed frame is not worth breaking the page over.
      }
    });

    socket.addEventListener('close', () => {
      socket = undefined;
      schedule();
    });

    // 'error' is always followed by 'close', so reconnection is handled there.
    socket.addEventListener('error', () => socket?.close());
  }

  return {
    start(): void {
      if (!url) return; // No endpoint configured — stay invisible.
      connect();
    },
    onCount(listener: CountListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop(): void {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    },
  };
}
