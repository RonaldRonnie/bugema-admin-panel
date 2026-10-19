/**
 * Platform overview. GET /admin/stats is aggregate-only by design — it exposes
 * counts and never an individual's record — which also makes it the quickest
 * confirmation that an admin token really does reach across the system.
 */
import { api } from '../api.js';
import { el, button, badge, skeleton, errorState, notify } from '../ui.js';
import { fmtDateTime, fmtNumber } from '../format.js';
import { humanize, toneFor } from '../enums.js';
import { state } from '../store.js';
import { href } from '../router.js';

function statCard(label, value, foot) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'label', text: label }),
    el('div', { class: 'value tabular', text: fmtNumber(value) }),
    foot ? el('div', { class: 'foot', text: foot }) : null,
  ]);
}

function barChart(title, record, total) {
  const max = Math.max(1, ...Object.values(record || {}));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, el('h2', { text: title })),
    el('div', { class: 'card-body bars' }, Object.entries(record || {}).map(([key, count]) =>
      el('div', { class: 'bar-row' }, [
        el('div', {}, badge(humanize(key), toneFor(key))),
        el('div', { class: 'bar-track' }, el('div', {
          class: 'bar-fill',
          style: { width: `${(count / max) * 100}%`, background: 'var(--accent)' },
        })),
        el('div', { class: 'n', text: fmtNumber(count) }),
      ]))),
  ]);
}

const QUICK_LINKS = [
  { label: 'Provision a user', to: '/users', glyph: '👤' },
  { label: 'Post an announcement', to: '/announcements', glyph: '📢' },
  { label: 'Emergency broadcast', to: '/broadcast', glyph: '🚨' },
  { label: 'Stuck payments', to: '/stuck-payments', glyph: '⏳' },
  { label: 'Safety alerts', to: '/safety-alerts', glyph: '🚨' },
  { label: 'Audit trail', to: '/audit', glyph: '📜' },
];

export function renderDashboard(container) {
  container.replaceChildren();

  const hello = el('div', { class: 'card mb-16' }, [
    el('div', { class: 'card-body' }, [
      el('div', { style: { fontSize: '16px', fontWeight: '600' },
        text: `Welcome back, ${state.user?.firstName || 'administrator'}.` }),
      el('div', { class: 'card-sub mt-8' }, [
        el('span', { text: 'Signed in as ' }),
        ...(state.roles.length
          ? state.roles.map((r) => badge(r, r === 'SUPER_ADMIN' ? 'accent' : ''))
          : [badge('no roles', 'danger')]),
        el('span', { text: state.permissionsKnown
          ? `  ·  ${state.permissions?.size ?? 0} permissions in effect`
          : '  ·  permission set unknown (no roles:read) — every screen is shown and the API decides' }),
      ]),
    ]),
  ]);

  const quick = el('div', { class: 'card mb-16' }, [
    el('div', { class: 'card-head' }, el('h2', { text: 'Jump to' })),
    el('div', { class: 'card-body row' }, QUICK_LINKS.map((q) =>
      el('a', { class: 'btn btn-sm', href: href(q.to), text: `${q.glyph}  ${q.label}` }))),
  ]);

  const statsSlot = el('div', {}, skeleton(4));
  container.append(hello, quick, statsSlot);

  const load = async () => {
    statsSlot.replaceChildren(skeleton(4));
    let stats;
    try {
      stats = await api.get('/admin/stats');
    } catch (err) {
      statsSlot.replaceChildren(errorState(err, load));
      return;
    }

    const { users, access, organization, activity, generatedAt } = stats;

    statsSlot.replaceChildren(
      el('div', { class: 'stat-grid mb-16' }, [
        statCard('Users', users.total, `${fmtNumber(users.deleted)} soft-deleted`),
        statCard('Active sessions', activity.activeSessions, 'Unrevoked and unexpired'),
        statCard('Audit events (24h)', activity.auditLogsLast24h),
        statCard('Roles', access.roles, `${fmtNumber(access.permissions)} permissions · ${fmtNumber(access.superAdmins)} super admins`),
        statCard('Faculties', organization.faculties),
        statCard('Departments', organization.departments),
        statCard('Programmes', organization.programs),
        statCard('Courses', organization.courses),
      ]),
      el('div', { class: 'grid-2' }, [
        barChart('Users by type', users.byType),
        barChart('Users by status', users.byStatus),
      ]),
      el('div', { class: 'card-sub mt-16', text: `Snapshot taken ${fmtDateTime(generatedAt)} — every count comes from one transaction, so the numbers agree with each other.` }),
    );
  };

  load();
}

/** Public health probes — handy when the console cannot reach the API. */
export function renderHealth(container) {
  container.replaceChildren();
  const slot = el('div', {});
  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'API health' }),
        el('div', { class: 'card-sub', text: 'The three Terminus probes. /health/ready fails when PostgreSQL is unreachable.' }),
      ]),
      el('div', { class: 'spacer' }),
      button('Re-check', { small: true, glyph: '↻', onClick: () => load() }),
    ]),
    el('div', { class: 'card-body' }, slot),
  ]));

  async function probe(path) {
    const started = performance.now();
    try {
      const data = await api.get(path, undefined, { auth: false, raw: false });
      return { ok: true, ms: Math.round(performance.now() - started), data };
    } catch (err) {
      return { ok: false, ms: Math.round(performance.now() - started), error: err };
    }
  }

  async function load() {
    slot.replaceChildren(skeleton(3));
    const paths = ['/health', '/health/live', '/health/ready'];
    const results = await Promise.all(paths.map(probe));
    slot.replaceChildren(el('table', { class: 'data' }, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Probe' }), el('th', { text: 'Result' }), el('th', { text: 'Latency' }), el('th', { text: 'Detail' })])),
      el('tbody', {}, results.map((r, i) => el('tr', {}, [
        el('td', { class: 'mono', text: paths[i] }),
        el('td', {}, badge(r.ok ? 'UP' : 'DOWN', r.ok ? 'ok' : 'danger')),
        el('td', { class: 'tabular', text: `${r.ms} ms` }),
        el('td', { class: 'clip mono', text: r.ok ? JSON.stringify(r.data) : (r.error?.message || '') }),
      ]))),
    ]));
  }

  load();
}
