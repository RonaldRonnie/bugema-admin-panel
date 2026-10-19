/**
 * Session and capability state.
 *
 * Permissions are checked server-side against the database on every request,
 * so nothing here is a security boundary — it only decides what the console
 * bothers to show. When the signed-in account can read /roles we compute the
 * exact effective permission set; when it cannot, we fall back to "show
 * everything and let the API answer", which is the honest behaviour for a
 * limited operator: they see a clear 403 rather than a mysteriously empty menu.
 */
import { api, tokens } from './api.js';

const listeners = new Set();

export const state = {
  user: null,            // PublicUser from /auth/me
  roles: [],             // role names held by the signed-in user
  permissions: null,     // Set<string>, or null when unknown
  permissionsKnown: false,
  theme: localStorage.getItem('bu-admin-theme') || 'dark',
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

export function isAuthenticated() { return Boolean(tokens.get()?.accessToken); }

/** True when the account holds the permission, or when we could not determine the set. */
export function can(permission) {
  if (!permission) return true;
  if (!state.permissionsKnown || !state.permissions) return true;
  return state.permissions.has(permission);
}

/** True only when we positively know the permission is missing. */
export function definitelyCannot(permission) {
  return Boolean(permission) && state.permissionsKnown && !!state.permissions && !state.permissions.has(permission);
}

export async function loadSession() {
  const me = await api.get('/auth/me');
  state.user = me;
  state.roles = me.roles || [];
  await loadPermissions();
  emit();
  return me;
}

async function loadPermissions() {
  state.permissions = null;
  state.permissionsKnown = false;
  if (!state.roles.length) { state.permissions = new Set(); state.permissionsKnown = true; emit(); return; }
  try {
    const { items } = await api.list('/roles');
    const mine = new Set(state.roles);
    const granted = new Set();
    for (const role of items) {
      if (!mine.has(role.name)) continue;
      for (const rp of role.permissions || []) {
        const name = rp?.permission?.name ?? rp?.name;
        if (name) granted.add(name);
      }
    }
    state.permissions = granted;
    state.permissionsKnown = true;
  } catch {
    // No roles:read. Leave the console fully navigable — the API is the gate.
    state.permissions = null;
    state.permissionsKnown = false;
  }
  emit();
}

export function clearSession() {
  state.user = null;
  state.roles = [];
  state.permissions = null;
  state.permissionsKnown = false;
  tokens.clear();
  emit();
}

export function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('bu-admin-theme', theme);
  document.documentElement.dataset.theme = theme;
  emit();
}

/* ------------------------------------------------------------------ *
 * Reference-data cache. Every form that needs a faculty/department/
 * course/… dropdown reads through here, so a page with six such fields
 * still makes one request per collection, not one per field.
 * ------------------------------------------------------------------ */

const lookupCache = new Map();

export async function lookup(path, query) {
  const key = path + JSON.stringify(query || {});
  if (!lookupCache.has(key)) {
    lookupCache.set(key, api.list(path, query)
      .then((r) => r.items)
      .catch(() => []));   // a lookup the operator cannot read must not break the form
  }
  return lookupCache.get(key);
}

export function invalidateLookups() { lookupCache.clear(); }
