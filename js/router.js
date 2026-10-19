/**
 * Hash router. Routes look like `#/users?status=ACTIVE&page=2` — keeping list
 * state in the URL means a filtered view can be bookmarked, reloaded and
 * shared, and the browser's back button does what the operator expects.
 */

const routes = new Map();
let notFound = null;
let current = null;
let onNavigate = () => {};

export function defineRoute(path, handler) { routes.set(path, handler); }
export function setNotFound(handler) { notFound = handler; }
export function setNavigateHook(fn) { onNavigate = fn; }

export function parseHash(hash = window.location.hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryString));
  return { path: path || '/', query };
}

export function currentRoute() { return current; }

export function href(path, query) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const q = sp.toString();
  return `#${path}${q ? `?${q}` : ''}`;
}

export function navigate(path, query, { replace = false } = {}) {
  const target = href(path, query);
  if (replace) window.history.replaceState(null, '', target);
  else window.location.hash = target;
  if (replace) handle();
}

/** Merge into the current query string without leaving the page. */
export function setQuery(patch, { replace = true } = {}) {
  const { path, query } = parseHash();
  const next = { ...query };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') delete next[k];
    else next[k] = String(v);
  }
  navigate(path, next, { replace });
}

function handle() {
  const route = parseHash();
  current = route;
  const handler = routes.get(route.path);
  onNavigate(route);
  if (handler) handler(route);
  else if (notFound) notFound(route);
}

export function startRouter() {
  window.addEventListener('hashchange', handle);
  handle();
}

export function refresh() { handle(); }
