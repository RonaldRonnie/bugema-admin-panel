/**
 * Thin client for the Digital Campus API.
 *
 * Owns three things the rest of the console should never have to think about:
 * unwrapping the `{ success, data, pagination }` envelope, attaching the access
 * token, and transparently rotating an expired one through /auth/refresh —
 * including the case where several requests expire at the same moment, which
 * must produce exactly one refresh call (a second one would present an
 * already-rotated token and the API would revoke the whole session family).
 */

const CFG = window.BU_ADMIN_CONFIG || {};
export const API_BASE = (CFG.apiBaseUrl || '/api/v1').replace(/\/+$/, '');

const STORE_KEY = 'bu-admin-session';

/** An API error carrying the server's own code so callers can branch on it. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || null;
  }
  get isForbidden() { return this.status === 403; }
  get isUnauthorized() { return this.status === 401; }
  get isNotFound() { return this.status === 404; }
}

export const tokens = {
  get() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  },
  set(value) {
    if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORE_KEY);
  },
  clear() { localStorage.removeItem(STORE_KEY); },
};

let refreshInFlight = null;
let onSessionLost = () => {};
let onMutation = () => {};

/** Registered by the app so a dead session can bounce the user to the login screen. */
export function setSessionLostHandler(fn) { onSessionLost = fn; }

/**
 * Registered by the store so a successful write drops cached reference data.
 * Without it a faculty created on one screen stays missing from every picker
 * that was populated earlier in the session, and the operator has to reload
 * the browser to see their own change.
 */
export function setMutationHandler(fn) { onMutation = fn; }

function qs(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (v.length) sp.set(k, v.join(',')); }
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function parseBody(res) {
  if (res.status === 204) return { success: true, data: null };
  const text = await res.text();
  if (!text) return { success: res.ok, data: null };
  try { return JSON.parse(text); }
  catch { return { success: false, error: { code: 'NON_JSON_RESPONSE', message: text.slice(0, 400) } }; }
}

async function refreshTokens() {
  const current = tokens.get();
  if (!current?.refreshToken) throw new ApiError(401, 'NO_SESSION', 'Not signed in.');

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const body = await parseBody(res);
      if (!res.ok || !body.success) {
        tokens.clear();
        throw new ApiError(401, body?.error?.code || 'SESSION_EXPIRED',
          body?.error?.message || 'Your session has expired. Please sign in again.');
      }
      const next = { ...current, ...body.data };
      tokens.set(next);
      return next;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/**
 * @param {string} path      Path below the version prefix, e.g. '/users/123'.
 * @param {object} [opt]
 * @param {string} [opt.method='GET']
 * @param {object} [opt.query]   Serialised to a query string; blanks are dropped.
 * @param {object} [opt.body]    JSON body. Use opt.form for multipart.
 * @param {FormData} [opt.form]
 * @param {object} [opt.headers]
 * @param {boolean} [opt.auth=true]
 * @param {boolean} [opt.raw=false]  Resolve with the whole envelope, not just `data`.
 */
export async function request(path, opt = {}) {
  const { method = 'GET', query, body, form, headers = {}, auth = true, raw = false } = opt;
  const url = `${API_BASE}${path}${qs(query)}`;

  const send = async (bearer) => {
    const h = { Accept: 'application/json', ...headers };
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    let payload;
    if (form) payload = form;                       // let the browser set the boundary
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    return fetch(url, { method, headers: h, body: payload });
  };

  let session = auth ? tokens.get() : null;
  let res;
  try {
    res = await send(session?.accessToken);
  } catch (networkError) {
    throw new ApiError(0, 'NETWORK_ERROR',
      `Could not reach the API at ${API_BASE}. Check that it is running and that this origin is allowed by CORS_ORIGIN. (${networkError.message})`);
  }

  if (res.status === 401 && auth && session?.refreshToken) {
    try {
      session = await refreshTokens();
      res = await send(session.accessToken);
    } catch (err) {
      onSessionLost();
      throw err;
    }
  }

  const envelope = await parseBody(res);

  if (!res.ok || envelope.success === false) {
    const err = envelope.error || {};
    if (res.status === 401 && auth) { tokens.clear(); onSessionLost(); }
    throw new ApiError(res.status, err.code || `HTTP_${res.status}`,
      err.message || res.statusText || 'Request failed.', err.details);
  }

  if (method !== 'GET') onMutation(path, method);

  return raw ? envelope : envelope.data;
}

export const api = {
  get: (path, query, opt) => request(path, { ...opt, method: 'GET', query }),
  /** Paginated GET: resolves `{ items, pagination }` whether or not the route paginates. */
  async list(path, query, opt) {
    const env = await request(path, { ...opt, method: 'GET', query, raw: true });
    const data = env.data;
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    return { items, pagination: env.pagination || null, rawData: data };
  },
  post: (path, body, opt) => request(path, { ...opt, method: 'POST', body }),
  patch: (path, body, opt) => request(path, { ...opt, method: 'PATCH', body }),
  put: (path, body, opt) => request(path, { ...opt, method: 'PUT', body }),
  del: (path, opt) => request(path, { ...opt, method: 'DELETE' }),
  upload: (path, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(path, { method: 'POST', form });
  },
};
