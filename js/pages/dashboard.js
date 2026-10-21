/**
 * The landing screen, which differs by office.
 *
 * Every role signs in through the same form and the dashboard is the same
 * route; what it shows comes from the matching entry in dashboards.js. The
 * platform-wide statistics are only part of it, and only for the offices that
 * can read GET /admin/stats — that route is aggregate-only by design, exposing
 * counts and never an individual's record.
 */
import { api } from '../api.js';
import { el, button, badge, skeleton, errorState, notify } from '../ui.js';
import { fmtDateTime, fmtNumber } from '../format.js';
import { humanize, toneFor } from '../enums.js';
import { state, definitelyCannot } from '../store.js';
import { href } from '../router.js';
import { dashboardFor } from '../dashboards.js';

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

/**
 * One tile reading a collection's total out of its pagination envelope, which
 * costs a single row rather than the page the list screen would fetch.
 *
 * A 403 means this office cannot read that collection — which is a legitimate
 * answer, not a failure — so the tile is dropped rather than shown broken. A
 * 404 is treated the same way: a route the deployed API does not carry is not
 * something to put an error in front of an operator about.
 */
async function counterTile(counter) {
  try {
    // A few collections take no pagination parameters at all and reject any
    // unknown query key outright (/programs is one), so those are fetched bare
    // and counted from the rows themselves.
    const query = counter.noPagination ? counter.query : { ...counter.query, limit: 1 };
    const { items, pagination } = await api.list(counter.path, query);
    const total = counter.noPagination ? items.length : (pagination?.total ?? 0);
    const card = statCard(counter.label, total, counter.foot);
    if (counter.tone && total > 0) card.classList.add(counter.tone);
    if (counter.to) {
      return el('a', { class: 'stat-link', href: href(counter.to) }, card);
    }
    return card;
  } catch {
    // Forbidden, missing, or a query this route will not accept — all of them
    // mean "no count to show here", which is a legitimate answer rather than
    // something to put an error in front of an operator about. The tile is
    // dropped and the rest of the dashboard still renders.
    return null;
  }
}

/** The current academic term, for the offices whose work is keyed to it. */
async function currentTermCard() {
  let term;
  try {
    term = await api.get('/academic-terms/current');
  } catch {
    return null;
  }
  if (!term) {
    return el('div', { class: 'card mb-16' }, el('div', { class: 'card-body' }, [
      el('div', { style: { fontWeight: '600' }, text: 'No current academic term' }),
      el('div', { class: 'card-sub mt-8' }, [
        el('span', { text: 'Registration windows and billing have no dates to work from until one is set. ' }),
        el('a', { href: href('/academic-terms'), text: 'Open the calendar' }),
      ]),
    ]));
  }
  const label = term.name || `${term.academicYear} ${humanize(term.semester)}`;
  return el('div', { class: 'card mb-16' }, el('div', { class: 'card-body' }, [
    el('div', { class: 'row' }, [
      el('div', { style: { fontWeight: '600' }, text: label }),
      badge('current term', 'accent'),
    ]),
    el('div', { class: 'card-sub mt-8', text: [
      `Runs ${fmtDateTime(term.startDate)} to ${fmtDateTime(term.endDate)}`,
      term.registrationEndDate ? `registration closes ${fmtDateTime(term.registrationEndDate)}` : null,
      term.examStartDate ? `examinations from ${fmtDateTime(term.examStartDate)}` : null,
    ].filter(Boolean).join('  ·  ') }),
  ]));
}

export function renderDashboard(container) {
  container.replaceChildren();

  const profile = dashboardFor(state.roles);

  const hello = el('div', { class: 'card mb-16' }, [
    el('div', { class: 'card-body' }, [
      el('div', { style: { fontSize: '16px', fontWeight: '600' },
        text: `Welcome back, ${state.user?.firstName || 'administrator'}.` }),
      el('div', { class: 'card-sub mt-8' }, [
        el('strong', { text: profile.label }),
        el('span', { text: `  —  ${profile.headline}` }),
      ]),
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

  // A link whose permission we positively know is missing is dropped; one we
  // are unsure about is kept, and the API answers for itself.
  const links = (profile.links || []).filter((q) => !definitelyCannot(q.permission));
  const quick = links.length
    ? el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, el('h2', { text: 'Jump to' })),
      el('div', { class: 'card-body row' }, links.map((q) =>
        el('a', { class: 'btn btn-sm', href: href(q.to), text: `${q.glyph}  ${q.label}` }))),
    ])
    : null;

  const termSlot = el('div', {});
  const countersSlot = el('div', {});
  const statsSlot = el('div', {});
  container.append(hello, ...(quick ? [quick] : []), termSlot, countersSlot, statsSlot);

  const loadTerm = async () => {
    if (!profile.showCurrentTerm) return;
    const card = await currentTermCard();
    if (card) termSlot.replaceChildren(card);
  };

  const loadCounters = async () => {
    if (!profile.counters?.length) return;
    countersSlot.replaceChildren(skeleton(2));
    const tiles = (await Promise.all(profile.counters.map(counterTile))).filter(Boolean);
    countersSlot.replaceChildren(
      tiles.length ? el('div', { class: 'stat-grid mb-16' }, tiles) : el('div', {}),
    );
  };

  const load = async () => {
    await Promise.all([loadTerm(), loadCounters()]);

    // Offices without admin:read_stats get their own counters and nothing
    // else — asking for the platform figures would only show them a 403.
    if (!profile.showPlatformStats || definitelyCannot('admin:read_stats')) {
      statsSlot.replaceChildren();
      return;
    }

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
