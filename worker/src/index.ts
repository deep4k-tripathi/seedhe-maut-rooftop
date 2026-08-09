/**
 * Live headcount.
 *
 * One Durable Object holds every open WebSocket. A connection is a person; connects and
 * disconnects rebroadcast the total. No heartbeats and no TTL bookkeeping, because the
 * socket lifecycle already answers the question exactly.
 *
 * Uses the Hibernation API (`acceptWebSocket` rather than `ws.accept()`), which lets the
 * object evict itself from memory between messages while keeping connections alive. That
 * is what keeps this inside the free plan: calling `accept()` would bill duration for the
 * entire time every socket stays open.
 */

export interface Env {
  ROOF: DurableObjectNamespace;
  /** Comma-separated list of origins allowed to connect. */
  ALLOWED_ORIGINS?: string;
}

/** Everyone shares one room, so the object name is fixed. */
const ROOM = 'the-roof';

/** WebSocket.OPEN. Spelled out because the numeric readyState is easy to misread. */
const WS_OPEN = 1;

function isAllowed(origin: string | null, env: Env): boolean {
  // Unset means "any origin" — convenient locally, worth setting in production.
  if (!env.ALLOWED_ORIGINS) return true;
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(origin);
}

export class Roof {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      // Plain GET returns the current count, handy for health checks.
      return Response.json(
        { count: this.live().length },
        { headers: { 'access-control-allow-origin': '*' } },
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Hibernation-aware accept. The object may be evicted between events.
    this.state.acceptWebSocket(server);
    this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Clients send nothing meaningful; a ping just refreshes their own view. */
  webSocketMessage(ws: WebSocket): void {
    ws.send(JSON.stringify({ count: this.live().length }));
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // 1006 cannot be sent back; use a normal closure.
    try {
      ws.close(code === 1006 ? 1000 : code, reason);
    } catch {
      // Already gone.
    }
    this.broadcast(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.broadcast(ws);
  }

  /**
   * Tell everyone the new total.
   *
   * `getWebSockets()` still returns the socket that triggered webSocketClose, so
   * counting its raw length reports one person too many for the moment after someone
   * leaves. Filter on readyState and drop the departing socket explicitly.
   */
  private live(departing?: WebSocket): WebSocket[] {
    return this.state
      .getWebSockets()
      .filter((socket) => socket !== departing && socket.readyState === WS_OPEN);
  }

  private broadcast(departing?: WebSocket): void {
    const live = this.live(departing);

    const payload = JSON.stringify({ count: live.length });
    for (const socket of live) {
      try {
        socket.send(payload);
      } catch {
        // A socket that died mid-broadcast will surface via webSocketClose.
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/' && url.pathname !== '/ws') {
      return new Response('Not found', { status: 404 });
    }

    const origin = request.headers.get('Origin');
    if (request.headers.get('Upgrade') === 'websocket' && !isAllowed(origin, env)) {
      return new Response('Forbidden origin', { status: 403 });
    }

    // A single named object means every visitor lands in the same room.
    const id = env.ROOF.idFromName(ROOM);
    return env.ROOF.get(id).fetch(request);
  },
};
