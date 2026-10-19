/**
 * The audit trail.
 *
 * `action` is a case-insensitive prefix match on the API side, so `auth.login`
 * brings back both `auth.login.success` and `auth.login.failed` — the quick
 * filters below lean on that. Reading the audit log is deliberately not itself
 * audited (see SECURITY.md), so paging through here leaves no trace.
 */
import { api } from '../api.js';
import { el, button, badge, skeleton, emptyState, errorState, openDrawer } from '../ui.js';
import { fmtDateTime, personName, downloadCsv, shortId } from '../format.js';
import { buildForm } from '../fields.js';
import { setQuery } from '../router.js';

const QUICK = [
  { label: 'All', action: '' },
  { label: 'Sign-ins', action: 'auth.login' },
  { label: 'Failed sign-ins', action: 'auth.login.failed' },
  { label: 'Account changes', action: 'user' },
  { label: 'Role changes', action: 'role' },
  { label: 'Payments', action: 'payment' },
  { label: 'Health records', action: 'health.record_accessed' },
  { label: 'Counselling records', action: 'counseling.record_accessed' },
];

const FILTERS = [
  { name: 'action', label: 'Action prefix', type: 'text', placeholder: 'e.g. auth.login', grow: true },
  { name: 'actorUserId', label: 'Actor', type: 'ref', lookup: 'users' },
  { name: 'entityType', label: 'Entity type', type: 'text', placeholder: 'e.g. User' },
  { name: 'entityId', label: 'Entity ID', type: 'text' },
  { name: 'from', label: 'From', type: 'datetime' },
  { name: 'to', label: 'To', type: 'datetime' },
];

function toneForAction(action) {
  const a = String(action || '');
  if (a.includes('fail') || a.includes('denied') || a.includes('revoke') || a.includes('delete')) return 'danger';
  if (a.includes('record_accessed') || a.includes('status') || a.includes('update')) return 'warn';
  if (a.includes('success') || a.includes('create')) return 'ok';
  return '';
}

export function renderAudit(container, route) {
  const query = route.query || {};
  container.replaceChildren();

  const quickBar = el('div', { class: 'row', style: { padding: '12px 16px', borderBottom: '1px solid var(--border)' } },
    QUICK.map((q) => button(q.label, {
      small: true,
      variant: (query.action || '') === q.action ? 'primary' : undefined,
      onClick: () => setQuery({ action: q.action, page: 1 }, { replace: false }),
    })));

  const filterBar = el('div', { class: 'filters' });
  const slot = el('div', {});
  const pagerSlot = el('div', {});
  let rows = [];

  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'Audit trail' }),
        el('div', { class: 'card-sub', text: 'Who did what, to which record, and when. Action is matched as a case-insensitive prefix.' }),
      ]),
      el('div', { class: 'spacer' }),
      button('Refresh', { small: true, glyph: '↻', onClick: () => load() }),
      button('CSV', {
        small: true, glyph: '⭳',
        onClick: () => downloadCsv('audit-log.csv', [
          { key: 'createdAt', label: 'When' }, { key: 'action', label: 'Action' },
          { key: 'actorUserId', label: 'Actor ID' }, { key: 'entityType', label: 'Entity type' },
          { key: 'entityId', label: 'Entity ID' }, { key: 'ipAddress', label: 'IP' },
        ], rows),
      }),
    ]),
    quickBar, filterBar, slot, pagerSlot,
  ]);
  container.append(card);

  const form = buildForm(FILTERS, query, { columns: 1 });
  for (const f of form.fields) {
    if (f.field.grow) f.node.classList.add('grow');
    filterBar.append(f.node);
    const input = f.node.querySelector('input, select');
    if (input) {
      const handler = () => { let v; try { v = form.read(); } catch { return; }
        setQuery({ ...Object.fromEntries(FILTERS.map((d) => [d.name, v[d.name] ?? ''])), page: 1 }, { replace: false }); };
      if (input.type === 'datetime-local') input.addEventListener('change', handler);
      else { let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(handler, 400); }); }
    }
  }

  async function load() {
    slot.replaceChildren(skeleton(8));
    const params = { page: Number(query.page) || 1, limit: Number(query.limit) || 25 };
    for (const f of FILTERS) if (query[f.name]) params[f.name] = query[f.name];

    try {
      const { items, pagination } = await api.list('/audit-logs', params);
      rows = items;
      if (!items.length) { slot.replaceChildren(emptyState('No audit entries match these filters')); pagerSlot.replaceChildren(); return; }

      slot.replaceChildren(el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [
        el('thead', {}, el('tr', {}, ['When', 'Action', 'Actor', 'Entity', 'IP address'].map((h) => el('th', { text: h })))),
        el('tbody', {}, items.map((row) => el('tr', {
          class: 'row-link',
          onClick: () => openEntry(row),
        }, [
          el('td', { class: 'nowrap', text: fmtDateTime(row.createdAt) }),
          el('td', {}, badge(row.action, toneForAction(row.action))),
          el('td', { text: row.actor ? personName(row.actor) : (row.actorUserId ? shortId(row.actorUserId) : 'system') }),
          el('td', { class: 'mono', text: row.entityType ? `${row.entityType} ${shortId(row.entityId)}` : '—' }),
          el('td', { class: 'mono muted', text: row.ipAddress || '—' }),
        ]))),
      ])));

      if (pagination) {
        const { page, limit, total, totalPages } = pagination;
        pagerSlot.replaceChildren(el('div', { class: 'pager' }, [
          el('span', { text: `${total === 0 ? 0 : (page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` }),
          el('div', { class: 'spacer' }),
          button('‹ Prev', { small: true, disabled: page <= 1, onClick: () => setQuery({ page: page - 1 }, { replace: false }) }),
          el('span', { text: `Page ${page} / ${Math.max(totalPages, 1)}` }),
          button('Next ›', { small: true, disabled: page >= totalPages, onClick: () => setQuery({ page: page + 1 }, { replace: false }) }),
        ]));
      }
    } catch (err) {
      slot.replaceChildren(errorState(err, load));
    }
  }

  function openEntry(row) {
    openDrawer({
      title: row.action,
      subtitle: fmtDateTime(row.createdAt),
      render: () => el('div', {}, [
        el('dl', { class: 'kv' }, [
          el('dt', { text: 'Entry ID' }), el('dd', { class: 'mono', text: row.id }),
          el('dt', { text: 'Action' }), el('dd', {}, badge(row.action, toneForAction(row.action))),
          el('dt', { text: 'Actor' }), el('dd', { text: row.actor ? `${personName(row.actor)} (${row.actorUserId})` : (row.actorUserId || 'system') }),
          el('dt', { text: 'Entity' }), el('dd', { class: 'mono', text: `${row.entityType ?? '—'} ${row.entityId ?? ''}` }),
          el('dt', { text: 'IP address' }), el('dd', { class: 'mono', text: row.ipAddress || '—' }),
          el('dt', { text: 'User agent' }), el('dd', { text: row.userAgent || '—' }),
          el('dt', { text: 'When' }), el('dd', { text: fmtDateTime(row.createdAt) }),
        ]),
        el('h3', { style: { fontSize: '13px', margin: '18px 0 8px' }, text: 'Metadata' }),
        el('pre', { class: 'json', text: JSON.stringify(row.metadata ?? row.changes ?? {}, null, 2) }),
        el('h3', { style: { fontSize: '13px', margin: '18px 0 8px' }, text: 'Raw entry' }),
        el('pre', { class: 'json', text: JSON.stringify(row, null, 2) }),
      ]),
    });
  }

  load();
}
