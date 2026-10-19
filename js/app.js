/**
 * Application shell: boots the session, builds the sidebar, and dispatches
 * each route to either a bespoke page or the generic resource engine.
 */
import { setSessionLostHandler, tokens, API_BASE } from './api.js';
import { state, loadSession, clearSession, setTheme, isAuthenticated, definitelyCannot, invalidateLookups } from './store.js';
import { el, button, badge, notify, skeleton, errorState } from './ui.js';
import { defineRoute, setNotFound, startRouter, navigate, href, parseHash, setNavigateHook } from './router.js';
import { navEntries, resourceByKey, PAGES } from './resources/index.js';
import { renderResource } from './pages/resource.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard, renderHealth } from './pages/dashboard.js';
import { renderAudit } from './pages/audit.js';
import { renderAccessMatrix } from './pages/access-matrix.js';
import { renderMessaging, renderDepartmentChannel } from './pages/messaging.js';
import { renderBroadcast, renderSearch, renderFiles, renderDigitalId, renderApiConsole } from './pages/operations.js';
import { renderAccount } from './pages/account.js';
import { personName } from './format.js';

const CFG = window.BU_ADMIN_CONFIG || {};
const root = document.getElementById('app');

const PAGE_RENDERERS = {
  dashboard: renderDashboard,
  search: renderSearch,
  'access-matrix': renderAccessMatrix,
  messaging: renderMessaging,
  'department-channel': renderDepartmentChannel,
  broadcast: renderBroadcast,
  'digital-id': renderDigitalId,
  files: renderFiles,
  audit: renderAudit,
  health: renderHealth,
  'api-console': renderApiConsole,
  account: renderAccount,
};

document.documentElement.dataset.theme = state.theme;

/* ----------------------------------------------------------------- boot */

setSessionLostHandler(() => {
  clearSession();
  notify.info('Your session ended. Please sign in again.', 'Signed out');
  showLogin();
});

function showLogin() {
  renderLogin(root, async () => {
    try {
      await loadSession();
      invalidateLookups();
      buildShell();
      startOrRefreshRouter();
    } catch (err) {
      notify.error(err, 'Signed in, but could not load your profile');
    }
  });
}

let routerStarted = false;
function startOrRefreshRouter() {
  if (routerStarted) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
  startRouter();
  routerStarted = true;
}

async function boot() {
  if (!isAuthenticated()) { showLogin(); return; }
  root.textContent = 'Loading your profile…';
  try {
    await loadSession();
  } catch (err) {
    if (err?.status === 401 || err?.status === 0) {
      if (err?.status === 0) notify.error(err, 'Cannot reach the API');
      clearSession();
      showLogin();
      return;
    }
    notify.error(err, 'Could not load your profile');
    clearSession();
    showLogin();
    return;
  }
  buildShell();
  startOrRefreshRouter();
}

/* ---------------------------------------------------------------- shell */

let contentSlot;
let sidebarNav;
let topTitle;

function buildShell() {
  root.className = '';
  root.replaceChildren();

  sidebarNav = el('nav', { class: 'sidebar-nav' });
  contentSlot = el('div', { class: 'content' });
  topTitle = el('h1', { text: 'Dashboard' });

  const navFilter = el('input', { type: 'text', placeholder: 'Filter menu…' });
  navFilter.addEventListener('input', () => paintNav(navFilter.value.trim().toLowerCase()));

  const sidebar = el('aside', { class: 'sidebar' }, [
    el('div', { class: 'sidebar-head' }, [
      el('div', { class: 'brand' }, [
        el('div', { class: 'brand-mark', text: 'BU' }),
        el('div', { class: 'brand-text' }, [
          el('div', { class: 'brand-title', text: CFG.institution || 'Digital Campus' }),
          el('div', { class: 'brand-sub', text: 'Admin console' }),
        ]),
      ]),
    ]),
    el('div', { class: 'nav-filter' }, navFilter),
    sidebarNav,
    el('div', { class: 'sidebar-foot' }, [
      el('div', { class: 'who' }, [
        el('div', { class: 'avatar', text: initials(state.user) }),
        el('div', { class: 'who-text' }, [
          el('div', { class: 'who-name', text: personName(state.user) }),
          el('div', { class: 'who-role', text: (state.roles[0] || 'no role') + (state.roles.length > 1 ? ` +${state.roles.length - 1}` : '') }),
        ]),
        el('button', {
          class: 'icon-btn', text: '⎋', title: 'Sign out',
          onClick: async () => {
            try { await import('./api.js').then(({ api }) => api.post('/auth/logout', {})); } catch { /* already gone */ }
            clearSession();
            window.location.hash = '#/';
            window.location.reload();
          },
        }),
      ]),
    ]),
  ]);

  const menuToggle = el('button', {
    class: 'icon-btn menu-toggle', text: '☰', title: 'Menu',
    onClick: () => sidebar.classList.toggle('open'),
  });

  const main = el('div', { class: 'main' }, [
    el('header', { class: 'topbar' }, [
      menuToggle,
      topTitle,
      el('div', { class: 'spacer' }),
      el('span', { class: 'crumb mono', text: API_BASE }),
      el('button', {
        class: 'icon-btn', text: state.theme === 'dark' ? '☀' : '☾',
        title: 'Toggle light / dark',
        onClick: (e) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          e.currentTarget.textContent = next === 'dark' ? '☀' : '☾';
        },
      }),
    ]),
    contentSlot,
  ]);

  root.append(el('div', { class: 'shell' }, [sidebar, main]));
  paintNav('');

  setNavigateHook((route) => {
    sidebar.classList.remove('open');
    paintNav(navFilter.value.trim().toLowerCase(), route.path);
  });
}

function initials(user) {
  if (!user) return '?';
  return `${(user.firstName || '?')[0]}${(user.lastName || '')[0] || ''}`.toUpperCase();
}

function paintNav(filter = '', activePath = parseHash().path) {
  if (!sidebarNav) return;
  sidebarNav.replaceChildren();

  for (const [group, entries] of navEntries()) {
    const visible = filter
      ? entries.filter((e) => e.label.toLowerCase().includes(filter) || group.toLowerCase().includes(filter))
      : entries;
    if (!visible.length) continue;

    sidebarNav.append(el('div', { class: 'nav-group-label', text: group }));
    for (const entry of visible) {
      const denied = definitelyCannot(entry.permission);
      sidebarNav.append(el('a', {
        class: `nav-item ${activePath === entry.path ? 'active' : ''} ${denied ? 'denied' : ''}`.trim(),
        href: href(entry.path),
        title: denied ? `Your roles do not include "${entry.permission}" — the API will refuse` : entry.label,
      }, [el('span', { class: 'ico', text: entry.icon || '•' }), entry.label]));
    }
  }
}

/* --------------------------------------------------------------- routing */

function mountPage(title, renderer, route) {
  topTitle.textContent = title;
  document.title = `${title} · ${CFG.institution || 'Digital Campus'} Admin`;
  contentSlot.replaceChildren();
  try {
    renderer(contentSlot, route);
  } catch (err) {
    contentSlot.replaceChildren(errorState(err));
    // Surfacing it beats a blank screen when a resource descriptor is wrong.
    console.error('[admin] page render failed', err);
  }
  contentSlot.scrollTop = 0;
}

for (const page of PAGES) {
  const renderer = PAGE_RENDERERS[page.page];
  if (!renderer) continue;
  defineRoute(page.path, (route) => mountPage(page.label, renderer, route));
}

for (const [, entries] of navEntries()) {
  for (const entry of entries) {
    if (entry.kind !== 'resource') continue;
    defineRoute(entry.path, (route) => mountPage(entry.label, (slot, r) => renderResource(slot, entry.resource, r), route));
  }
}

setNotFound((route) => {
  const key = route.path.replace(/^\//, '');
  const resource = resourceByKey(key);
  if (resource) { mountPage(resource.label, (slot, r) => renderResource(slot, resource, r), route); return; }
  mountPage('Not found', (slot) => {
    slot.replaceChildren(el('div', { class: 'card' }, el('div', { class: 'empty' }, [
      el('div', { class: 'big', text: '🧭' }),
      el('div', { text: `No screen at ${route.path}` }),
      el('div', { class: 'mt-16' }, el('a', { class: 'btn', href: href('/'), text: 'Back to the dashboard' })),
    ])));
  }, route);
});

boot();
