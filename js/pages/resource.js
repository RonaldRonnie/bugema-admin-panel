/**
 * The generic resource screen: list → filters → pagination → detail drawer →
 * create/edit/delete/custom actions → nested child collections.
 *
 * Every module in the API is described declaratively in js/resources/*.js and
 * rendered by this one file, so a new endpoint is a config entry rather than a
 * new page. Anything genuinely bespoke (the dashboard, the audit trail, chat)
 * gets its own page module instead of being bent into this shape.
 */
import { api, ApiError } from '../api.js';
import { can, definitelyCannot } from '../store.js';
import { el, button, badge, skeleton, emptyState, errorState, notify, openDrawer, confirmDialog } from '../ui.js';
import { openFormModal, buildForm } from '../fields.js';
import { renderValue, pick, personName, downloadCsv, buildPath, fmtDateTime } from '../format.js';
import { humanize, toneFor } from '../enums.js';
import { setQuery, navigate, href } from '../router.js';

const PAGE_SIZE = window.BU_ADMIN_CONFIG?.defaultPageSize || 20;

/* ---------------------------------------------------------------- helpers */

function titleOf(resource, row) {
  if (resource.rowTitle) return resource.rowTitle(row);
  return row.title || row.name || row.subject
    || (row.firstName ? personName(row) : null)
    || row.code || row.id || 'Record';
}

function idOf(resource, row) {
  return pick(row, resource.idKey || 'id');
}

/** A permission the operator is known to lack disables the control and says why. */
function gate(permission) {
  return definitelyCannot(permission)
    ? { disabled: true, title: `Requires the "${permission}" permission` }
    : {};
}

function cellFor(column, row) {
  if (column.render) {
    const out = column.render(row);
    return out instanceof Node ? out : el('span', { text: out === null || out === undefined ? '—' : String(out) });
  }
  return renderValue(pick(row, column.key), column.type);
}

/* ------------------------------------------------------------- the engine */

export function renderResource(container, resource, route) {
  const query = route.query || {};
  container.replaceChildren();

  const head = el('div', { class: 'card-head' }, [
    el('div', {}, [
      el('h2', { text: resource.label }),
      resource.description ? el('div', { class: 'card-sub', text: resource.description }) : null,
    ]),
    el('div', { class: 'spacer' }),
  ]);

  const tools = el('div', { class: 'row' });
  head.append(tools);

  const filterBar = el('div', { class: 'filters' });
  const tableSlot = el('div', {});
  const pagerSlot = el('div', {});
  const card = el('div', { class: 'card' }, [head, filterBar, tableSlot, pagerSlot]);
  container.append(card);

  let lastRows = [];

  /* --- toolbar ---------------------------------------------------------- */

  const reload = () => load();

  tools.append(button('Refresh', { small: true, glyph: '↻', onClick: reload }));

  if (resource.exportable !== false) {
    tools.append(button('CSV', {
      small: true, glyph: '⭳', title: 'Download the rows currently shown',
      onClick: () => {
        if (!lastRows.length) return notify.info('Nothing to export on this page.');
        downloadCsv(`${resource.key}.csv`, resource.list.columns.filter((c) => c.key), lastRows);
      },
    }));
  }

  for (const tool of resource.toolbar || []) {
    if (tool.permission && definitelyCannot(tool.permission)) continue;
    tools.append(button(tool.label, {
      small: true, glyph: tool.glyph, variant: tool.variant,
      onClick: () => tool.run({ reload, resource }),
    }));
  }

  if (resource.create) {
    tools.append(button(resource.create.label || `New ${resource.singular || resource.label}`, {
      small: true, variant: 'primary', glyph: '＋', ...gate(resource.create.permission),
      onClick: () => openCreate(resource, reload),
    }));
  }

  /* --- filters ---------------------------------------------------------- */

  /*
   * `needs` declares a path parameter the list endpoint cannot do without
   * (e.g. /live-sessions requires ?courseOfferingId). It is rendered as a
   * filter so it can be changed in place, and the table waits until it is set
   * rather than firing a request the API would reject.
   */
  const needs = Object.entries(resource.list.needs || {});
  const filterDefs = [
    ...needs.map(([name, spec]) => ({
      name,
      label: spec.label,
      type: spec.lookup ? 'select' : 'text',
      lookup: spec.lookup,
      placeholder: spec.free ? 'Paste an ID…' : undefined,
      grow: !spec.lookup,
    })),
    ...(resource.list.filters || []),
  ];
  if (resource.list.searchable) {
    filterDefs.unshift({ name: 'search', label: 'Search', type: 'text', placeholder: 'Search…', grow: true });
  }

  if (filterDefs.length) {
    const form = buildForm(filterDefs, query, { columns: 1 });
    for (const f of form.fields) {
      if (f.field.grow) f.node.classList.add('grow');
      filterBar.append(f.node);
      const input = f.node.querySelector('input, select, textarea');
      if (input) {
        if (input.tagName === 'SELECT' || input.type === 'date' || input.type === 'datetime-local') {
          input.addEventListener('change', () => apply());
        } else {
          let t;
          input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 380); });
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(t); apply(); } });
        }
      }
    }
    const apply = () => {
      let values;
      try { values = form.read(); } catch { return; }
      const patch = { page: 1 };
      for (const f of filterDefs) patch[f.name] = values[f.name] ?? '';
      setQuery(patch, { replace: false });
    };
    filterBar.append(el('div', { class: 'field' }, [
      el('label', { html: '&nbsp;' }),
      button('Clear', {
        small: true,
        onClick: () => {
          const patch = { page: 1 };
          for (const f of filterDefs) patch[f.name] = '';
          setQuery(patch, { replace: false });
        },
      }),
    ]));
  } else {
    filterBar.classList.add('hidden');
  }

  /* --- data ------------------------------------------------------------- */

  async function load() {
    tableSlot.replaceChildren(skeleton(6));
    pagerSlot.replaceChildren();

    const missing = needs.filter(([name]) => !query[name]);
    if (missing.length) {
      tableSlot.replaceChildren(emptyState(
        `Choose ${missing.map(([, spec]) => spec.label.toLowerCase()).join(' and ')} to continue`,
        'This endpoint is scoped to one parent record, so it needs that selection first.'));
      return;
    }

    const params = { ...(resource.list.query || {}) };
    const pathParamNames = new Set((resource.list.path.match(/:([A-Za-z0-9_]+)/g) || []).map((m) => m.slice(1)));
    for (const f of filterDefs) {
      const raw = query[f.name];
      if (raw === undefined || raw === '') continue;
      if (pathParamNames.has(f.name)) continue;   // already in the URL path
      params[f.name] = f.type === 'checkbox' ? raw === 'true' : raw;
    }
    if (resource.list.paginated !== false) {
      params.page = Number(query.page) || 1;
      params.limit = Number(query.limit) || PAGE_SIZE;
    }

    let path;
    try {
      path = buildPath(resource.list.path, { ...route.query, ...(resource.list.pathParams || {}) });
    } catch (err) {
      tableSlot.replaceChildren(emptyState(err.message, 'Open this screen from the parent record.'));
      return;
    }

    try {
      const { items, pagination } = await api.list(path, params);
      lastRows = items;
      renderTable(items);
      renderPager(pagination, items.length);
    } catch (err) {
      lastRows = [];
      tableSlot.replaceChildren(errorState(err, reload));
    }
  }

  function renderTable(rows) {
    if (!rows.length) {
      tableSlot.replaceChildren(emptyState(
        resource.emptyMessage || `No ${resource.label.toLowerCase()} found`,
        Object.keys(query).some((k) => query[k] && k !== 'page') ? 'Try clearing the filters.' : undefined));
      return;
    }

    const columns = resource.list.columns;
    const hasRowActions = Boolean(resource.update || resource.remove || (resource.actions || []).length || resource.detail !== false);

    const thead = el('thead', {}, el('tr', {}, [
      ...columns.map((c) => el('th', { text: c.label })),
      hasRowActions ? el('th', { text: '' }) : null,
    ]));

    const tbody = el('tbody', {}, rows.map((row) => {
      const tr = el('tr', { class: resource.detail === false ? '' : 'row-link' },
        columns.map((c) => el('td', { class: c.clip ? 'clip' : '' }, cellFor(c, row))));

      if (resource.detail !== false) {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input')) return;
          openDetail(resource, row, reload);
        });
      }

      if (hasRowActions) {
        const actions = el('td', { class: 'actions' }, rowActions(resource, row, reload));
        tr.append(actions);
      }
      return tr;
    }));

    tableSlot.replaceChildren(el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [thead, tbody])));
  }

  function renderPager(pagination, count) {
    if (!pagination) {
      pagerSlot.replaceChildren(el('div', { class: 'pager' }, [
        el('span', { text: `${count} record${count === 1 ? '' : 's'}` }),
      ]));
      return;
    }
    const { page, limit, total, totalPages } = pagination;
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    pagerSlot.replaceChildren(el('div', { class: 'pager' }, [
      el('span', { text: `${from}–${to} of ${total}` }),
      el('div', { class: 'spacer' }),
      button('‹ Prev', { small: true, disabled: page <= 1, onClick: () => setQuery({ page: page - 1 }, { replace: false }) }),
      el('span', { class: 'tabular', text: `Page ${page} / ${Math.max(totalPages, 1)}` }),
      button('Next ›', { small: true, disabled: page >= totalPages, onClick: () => setQuery({ page: page + 1 }, { replace: false }) }),
    ]));
  }

  load();
}

/* ------------------------------------------------------------ row actions */

function rowActions(resource, row, reload) {
  const nodes = [];
  const id = idOf(resource, row);

  for (const action of resource.actions || []) {
    if (!action.inline) continue;
    if (action.when && !action.when(row)) continue;
    nodes.push(button(action.label, {
      small: true, variant: action.variant, glyph: action.glyph, ...gate(action.permission),
      onClick: () => runAction(resource, action, row, reload),
    }));
  }

  if (resource.update) {
    nodes.push(button('Edit', {
      small: true, ...gate(resource.update.permission),
      onClick: () => openEdit(resource, row, reload),
    }));
  }

  if (resource.remove && (!resource.remove.when || resource.remove.when(row))) {
    nodes.push(button(resource.remove.label || 'Delete', {
      small: true, variant: 'danger', ...gate(resource.remove.permission),
      onClick: () => confirmDialog({
        title: resource.remove.label || 'Delete record',
        message: resource.remove.confirm || `Delete “${titleOf(resource, row)}”? This cannot be undone from here.`,
        confirmLabel: resource.remove.label || 'Delete',
        onConfirm: async () => {
          await api.del(buildPath(resource.remove.path, { ...row, id }));
          notify.ok(`${resource.singular || 'Record'} deleted.`);
          reload();
        },
      }),
    }));
  }

  return el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, nodes);
}

/* ------------------------------------------------------- create / edit */

export async function openCreate(resource, reload, presets = {}) {
  const spec = resource.create;
  const result = await openFormModal({
    title: spec.title || `New ${resource.singular || resource.label}`,
    subtitle: spec.subtitle,
    fields: spec.fields,
    values: { ...(spec.defaults || {}), ...presets },
    submitLabel: spec.submitLabel || 'Create',
    onSubmit: async (body) => {
      const path = buildPath(spec.path, { ...presets, ...body });
      const payload = spec.transform ? spec.transform(body) : body;
      return api.post(path, payload);
    },
  });
  if (result) { notify.ok(spec.successMessage || `${resource.singular || 'Record'} created.`); reload?.(); }
  return result;
}

export async function openEdit(resource, row, reload) {
  const spec = resource.update;
  const id = idOf(resource, row);
  const values = spec.initial ? spec.initial(row) : row;
  const result = await openFormModal({
    title: spec.title || `Edit ${resource.singular || resource.label}`,
    subtitle: titleOf(resource, row),
    fields: spec.fields,
    values,
    submitLabel: 'Save changes',
    onSubmit: async (body) => {
      const path = buildPath(spec.path, { ...row, id });
      const payload = spec.transform ? spec.transform(body, row) : body;
      return (spec.method || 'PATCH') === 'PUT' ? api.put(path, payload) : api.patch(path, payload);
    },
  });
  if (result) { notify.ok('Saved.'); reload?.(); }
  return result;
}

/* ---------------------------------------------------------------- actions */

/**
 * Run a declared action. With `fields` it opens a form first; with `confirm`
 * it asks; otherwise it fires straight away.
 */
export async function runAction(resource, action, row, reload) {
  const id = row ? idOf(resource, row) : undefined;
  const path = () => buildPath(action.path, { ...(row || {}), id });

  const send = async (body) => {
    const method = (action.method || 'POST').toUpperCase();
    const payload = action.transform ? action.transform(body, row) : body;
    const target = path();
    if (method === 'GET') return api.get(target);
    if (method === 'DELETE') return api.del(target);
    if (method === 'PATCH') return api.patch(target, payload);
    if (method === 'PUT') return api.put(target, payload);
    return api.post(target, payload);
  };

  if (action.fields?.length) {
    const result = await openFormModal({
      title: action.title || action.label,
      subtitle: action.subtitle || (row ? titleOf(resource, row) : undefined),
      fields: action.fields,
      values: action.initial ? action.initial(row) : {},
      submitLabel: action.submitLabel || action.label,
      onSubmit: send,
    });
    if (result) {
      notify.ok(action.successMessage || `${action.label} — done.`);
      action.onResult?.(result, row);
      reload?.();
    }
    return result;
  }

  const fire = async () => {
    const result = await send(action.body ? action.body(row) : undefined);
    notify.ok(action.successMessage || `${action.label} — done.`);
    action.onResult?.(result, row);
    reload?.();
    return result;
  };

  if (action.confirm) {
    return confirmDialog({
      title: action.label,
      message: typeof action.confirm === 'function' ? action.confirm(row) : action.confirm,
      confirmLabel: action.label,
      danger: action.variant === 'danger',
      onConfirm: fire,
    });
  }

  try { return await fire(); }
  catch (err) { notify.error(err); }
}

/* ----------------------------------------------------------- detail panel */

export function openDetail(resource, rowOrId, reload) {
  const isRow = typeof rowOrId === 'object';
  let row = isRow ? rowOrId : null;
  const id = isRow ? idOf(resource, rowOrId) : rowOrId;

  const { body, close } = openDrawer({
    title: row ? titleOf(resource, row) : 'Loading…',
    subtitle: resource.label,
    actions: () => {
      const nodes = [];
      if (resource.update) {
        nodes.push(button('Edit', {
          small: true, ...gate(resource.update.permission),
          onClick: async () => { await openEdit(resource, row, reload); close(); },
        }));
      }
      return nodes;
    },
    render: () => el('div', {}, skeleton(5)),
  });

  // Kept across repaints: a child mutation re-fetches the parent and rebuilds
  // the panel, and the operator should land back on the tab they were using.
  let activeTab = 'overview';

  const paint = () => {
    body.replaceChildren();

    const tabsBar = el('div', { class: 'tabs', style: { padding: '0 0 0 0', marginBottom: '14px' } });
    const panel = el('div', {});
    body.append(tabsBar, panel);

    /*
     * A child collection can change the parent — revoking a role rewrites
     * User.roles — so a child mutation refreshes the parent record rather than
     * only its own list, which would otherwise redraw from a stale parent.
     */
    const onChildChange = async () => { await refetch(); reload?.(); };

    const tabs = [
      { key: 'overview', label: 'Overview', render: () => overviewTab(resource, row) },
      ...(resource.related || [])
        .filter((rel) => !rel.when || rel.when(row))
        .map((rel) => ({ key: rel.key, label: rel.label, render: () => relatedTab(resource, rel, row, onChildChange) })),
      { key: 'raw', label: 'Raw JSON', render: () => el('pre', { class: 'json', text: JSON.stringify(row, null, 2) }) },
    ];

    if (!tabs.some((t) => t.key === activeTab)) activeTab = tabs[0].key;
    const show = () => {
      [...tabsBar.children].forEach((t) => t.classList.toggle('active', t.dataset.key === activeTab));
      panel.replaceChildren(tabs.find((t) => t.key === activeTab).render());
    };
    for (const tab of tabs) {
      tabsBar.append(el('button', {
        class: 'tab', dataset: { key: tab.key }, text: tab.label,
        onClick: () => { activeTab = tab.key; show(); },
      }));
    }
    show();

    /* Actions that are not inline on the row live at the bottom of the panel. */
    const panelActions = (resource.actions || []).filter((a) => !a.hidden && (!a.when || a.when(row)));
    if (panelActions.length) {
      body.append(el('div', { class: 'card mt-16' }, [
        el('div', { class: 'card-head' }, el('h2', { text: 'Actions' })),
        el('div', { class: 'card-body row' }, panelActions.map((action) => button(action.label, {
          small: true, variant: action.variant, glyph: action.glyph, ...gate(action.permission),
          onClick: async () => {
            await runAction(resource, action, row, async () => { await refetch(); reload?.(); });
          },
        }))),
      ]));
    }
  };

  async function refetch() {
    if (resource.detailPath || !row) {
      try {
        row = await api.get(buildPath(resource.detailPath || `${resource.list.path}/:id`, { ...(row || {}), id }));
      } catch (err) {
        if (!row) { body.replaceChildren(errorState(err)); return; }
      }
    }
    paint();
  }

  refetch();
  return { close, refetch };
}

function overviewTab(resource, row) {
  const fields = resource.detailFields
    || Object.keys(row).filter((k) => typeof row[k] !== 'object' || row[k] === null).map((k) => ({ key: k, label: humanize(k) }));

  const dl = el('dl', { class: 'kv' });
  for (const f of fields) {
    const value = f.render ? f.render(row) : renderValue(pick(row, f.key), f.type);
    dl.append(el('dt', { text: f.label || humanize(f.key) }));
    dl.append(el('dd', {}, value instanceof Node ? value : el('span', { text: String(value ?? '—') })));
  }
  return dl;
}

/* -------------------------------------------------------- child collection */

function relatedTab(resource, rel, parentRow, onChildChange) {
  const wrap = el('div', {});
  const slot = el('div', {});
  const head = el('div', { class: 'row mb-8' });
  wrap.append(head, slot);

  const parentId = idOf(resource, parentRow);
  const paramBag = { ...parentRow, id: parentId, parentId };

  // A mutation refreshes the parent when the caller gave us a way to; failing
  // that, just the child list.
  const reload = () => (onChildChange ? onChildChange() : load());

  if (rel.create) {
    head.append(button(rel.create.label || 'Add', {
      small: true, variant: 'primary', glyph: '＋', ...gate(rel.create.permission),
      onClick: async () => {
        const result = await openFormModal({
          title: rel.create.title || rel.create.label || `Add to ${rel.label}`,
          fields: rel.create.fields,
          submitLabel: rel.create.submitLabel || 'Add',
          onSubmit: (bodyValues) => api.post(
            buildPath(rel.create.path, paramBag),
            rel.create.transform ? rel.create.transform(bodyValues, parentRow) : bodyValues),
        });
        if (result) { notify.ok('Added.'); reload(); }
      },
    }));
  }
  head.append(button('Refresh', { small: true, glyph: '↻', onClick: reload }));

  async function load() {
    slot.replaceChildren(skeleton(3));
    let rows;
    try {
      rows = rel.from ? (rel.from(parentRow) || []) : (await api.list(buildPath(rel.path, paramBag), rel.query)).items;
      if (rel.mapRows) rows = rel.mapRows(rows, parentRow);
    } catch (err) {
      slot.replaceChildren(errorState(err, reload));
      return;
    }
    if (!rows.length) { slot.replaceChildren(emptyState(rel.emptyMessage || `No ${rel.label.toLowerCase()} yet`)); return; }

    const hasActions = Boolean(rel.remove || (rel.actions || []).length);
    const table = el('table', { class: 'data' }, [
      el('thead', {}, el('tr', {}, [
        ...rel.columns.map((c) => el('th', { text: c.label })),
        hasActions ? el('th', {}) : null,
      ])),
      el('tbody', {}, rows.map((childRow) => {
        const cells = rel.columns.map((c) => el('td', { class: c.clip ? 'clip' : '' }, cellFor(c, childRow)));
        if (hasActions) {
          const nodes = [];
          for (const action of rel.actions || []) {
            if (action.when && !action.when(childRow, parentRow)) continue;
            nodes.push(button(action.label, {
              small: true, variant: action.variant, ...gate(action.permission),
              onClick: async () => {
                const bag = { ...paramBag, childId: pick(childRow, rel.childIdKey || 'id'), child: childRow };
                try {
                  const method = (action.method || 'POST').toUpperCase();
                  const target = buildPath(action.path, { ...childRow, ...bag });
                  if (method === 'DELETE') await api.del(target);
                  else if (method === 'PATCH') await api.patch(target, action.body?.(childRow, parentRow));
                  else await api.post(target, action.body?.(childRow, parentRow));
                  notify.ok(`${action.label} — done.`);
                  reload();
                } catch (err) { notify.error(err); }
              },
            }));
          }
          if (rel.remove) {
            nodes.push(button('Remove', {
              small: true, variant: 'danger', ...gate(rel.remove.permission),
              onClick: () => confirmDialog({
                title: 'Remove',
                message: rel.remove.confirm || 'Remove this entry?',
                onConfirm: async () => {
                  await api.del(buildPath(rel.remove.path, {
                    ...childRow, ...paramBag, childId: pick(childRow, rel.childIdKey || 'id'),
                  }));
                  notify.ok('Removed.');
                  reload();
                },
              }),
            }));
          }
          cells.push(el('td', { class: 'actions' }, el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, nodes)));
        }
        return el('tr', {}, cells);
      })),
    ]);
    slot.replaceChildren(el('div', { class: 'table-wrap' }, table));
  }

  load();
  return wrap;
}
