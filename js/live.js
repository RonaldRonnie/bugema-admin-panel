/**
 * Live reference-data updates.
 *
 * The console caches the collections that populate its pickers, so until now a
 * faculty added by one administrator stayed missing from another's dropdowns
 * until that person reloaded the browser. The API pushes a content-free signal
 * when one of those collections changes (see src/realtime in the API); this
 * drops the cache and, when it is safe to, refreshes the list on screen.
 *
 * The signal names an entity type and nothing else — no record id, no field
 * values — so nothing here is a second way to read data. Everything shown
 * still comes back over REST, where the permission checks live.
 *
 * Why a hand-written client rather than socket.io's own: this console ships as
 * static files with no build step and no CDN, which is what lets it be dropped
 * behind nginx or served from the API host unchanged. The slice of the
 * protocol it needs is four frame types, written out below, and both ends of
 * this connection are ours. If the console ever gains a bundler, replacing
 * this file with the real client is the right move.
 *
 *   Engine.IO / Socket.IO v4 frames used here:
 *     "0{...}"            server open, carries pingInterval/pingTimeout
 *     "40<ns>,<json>"     connect to a namespace, json is the auth payload
 *     "40<ns>,{sid}"      server's acknowledgement of that connect
 *     "44<ns>,<json>"     server refused the connect
 *     "42<ns>,[ev,data]"  an event
 *     "2" / "3"           ping from server / pong from us
 */
import { tokens, API_BASE } from './api.js';
import { invalidateLookups } from './store.js';
import { refresh as refreshRoute, parseHash } from './router.js';

const NAMESPACE = '/reference-data';
const EVENT = 'reference-data:changed';

/** Which console screen each broadcast entity type belongs to. */
const ENTITY_ROUTES = {
  Faculty: 'faculties',
  Department: 'departments',
  Program: 'programs',
  Course: 'courses',
  AcademicTerm: 'academic-terms',
  FeeStructure: 'fee-structures',
  CampusLink: 'campus-links',
  CampusLocation: 'campus-locations',
};

/** ws:// or wss:// origin of the API, whatever form apiBaseUrl took. */
function socketOrigin() {
  const url = new URL(API_BASE, window.location.href);
  return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
}

let socket = null;
let stopped = false;
let attempt = 0;
let pingTimer = null;

function clearPingTimer() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

/**
 * A change landed. The cache always goes, because a stale picker is the whole
 * problem this solves. The list on screen is only refreshed when the operator
 * is not in the middle of something: a modal open means a half-filled form,
 * and redrawing the page under it would throw their work away.
 */
function onChange(change) {
  invalidateLookups();

  const modalOpen = Boolean(document.getElementById('modal-root')?.childElementCount);
  if (modalOpen) return;

  const route = ENTITY_ROUTES[change.entityType];
  if (!route) return;

  const current = parseHash().path.replace(/^\//, '').split('/')[0];
  if (current === route) refreshRoute();
}

function scheduleReconnect() {
  if (stopped) return;
  // Backs off to half a minute. A console left open overnight against a
  // stopped API should not spend the night reconnecting every second.
  const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
  attempt += 1;
  setTimeout(connect, delay);
}

function connect() {
  if (stopped) return;
  const token = tokens.get()?.accessToken;
  // No session yet. Try again shortly rather than give up for good — the
  // operator may be part-way through signing in.
  if (!token) { scheduleReconnect(); return; }

  let ws;
  try {
    ws = new WebSocket(`${socketOrigin()}/socket.io/?EIO=4&transport=websocket`);
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.addEventListener('message', (frame) => {
    const data = String(frame.data);

    if (data.startsWith('0{')) {
      ws.send(`40${NAMESPACE},${JSON.stringify({ token })}`);
      try {
        const { pingInterval } = JSON.parse(data.slice(1));
        clearPingTimer();
        // The server pings us; this is only a floor under the connection so a
        // silently dead socket is noticed rather than assumed healthy.
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('3');
        }, Math.max(5000, pingInterval || 25000));
      } catch { /* keep the connection; the server still drives the ping */ }
      return;
    }

    if (data.startsWith(`40${NAMESPACE},`)) { attempt = 0; return; }

    if (data.startsWith(`44${NAMESPACE}`) || data.startsWith('44')) {
      // Refused — an expired token is the usual reason. The REST client
      // rotates it on the next request, so a later attempt picks up a fresh
      // one rather than this file duplicating the refresh logic.
      ws.close();
      return;
    }

    if (data.startsWith(`42${NAMESPACE},`)) {
      try {
        const [event, payload] = JSON.parse(data.slice(`42${NAMESPACE},`.length));
        if (event === EVENT && payload) onChange(payload);
      } catch { /* a frame we cannot read is not worth breaking the page over */ }
      return;
    }

    if (data === '2') ws.send('3');
  });

  ws.addEventListener('close', () => { clearPingTimer(); scheduleReconnect(); });
  ws.addEventListener('error', () => { try { ws.close(); } catch { /* already closing */ } });
}

/** Called once the operator has a session. Safe to call again. */
export function startLiveUpdates() {
  stopped = false;
  attempt = 0;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  connect();
}

/** Called on sign-out, so a closed session does not keep a socket open. */
export function stopLiveUpdates() {
  stopped = true;
  clearPingTimer();
  if (socket) { try { socket.close(); } catch { /* already closed */ } }
  socket = null;
}
