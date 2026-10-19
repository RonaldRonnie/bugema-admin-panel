/** Value formatting shared by tables, detail panels and CSV export. */
import { el, badge } from './ui.js';
import { humanize, toneFor } from './enums.js';

const DT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
const D = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : DT.format(d);
}

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : D.format(d);
}

export function fmtRelative(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return String(value);
  const secs = Math.round((then - Date.now()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return rtf.format(secs, 'second');
}

export function fmtMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString();
}

/** A person's display name from any of the shapes the API returns them in. */
export function personName(person) {
  if (!person) return '—';
  if (typeof person === 'string') return person;
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || person.name || person.id || '—';
}

export function shortId(id) {
  return typeof id === 'string' && id.length > 12 ? `${id.slice(0, 8)}…` : (id ?? '—');
}

/** Renders any value as a DOM node suitable for a table cell or detail row. */
export function renderValue(value, hint) {
  if (value === null || value === undefined || value === '') return el('span', { class: 'muted', text: '—' });
  if (typeof value === 'boolean') return badge(value ? 'Yes' : 'No', value ? 'ok' : '');
  // 'text' opts out of the status heuristic below — role and permission names
  // are identifiers an operator types verbatim, not statuses to prettify.
  if (hint === 'text') return el('span', { text: String(value) });
  if (hint === 'status' || (typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,}$/.test(value))) {
    return badge(humanize(value), toneFor(value));
  }
  if (hint === 'datetime') return el('span', { class: 'nowrap', text: fmtDateTime(value) });
  if (hint === 'date') return el('span', { class: 'nowrap', text: fmtDate(value) });
  if (hint === 'money') return el('span', { class: 'tabular', text: fmtMoney(value) });
  if (hint === 'id') return el('span', { class: 'mono muted', title: String(value), text: shortId(value) });
  if (Array.isArray(value)) {
    if (!value.length) return el('span', { class: 'muted', text: '—' });
    if (value.every((v) => typeof v !== 'object')) {
      return el('span', { class: 'row', style: { gap: '4px' } }, value.map((v) => badge(String(v))));
    }
    return el('span', { class: 'muted', text: `${value.length} item${value.length === 1 ? '' : 's'}` });
  }
  if (typeof value === 'object') {
    if (value.firstName || value.lastName || value.email) return el('span', { text: personName(value) });
    if (value.name) return el('span', { text: value.name });
    if (value.title) return el('span', { text: value.title });
    return el('span', { class: 'muted', text: '{…}' });
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return el('span', { class: 'nowrap', text: fmtDateTime(value) });
  }
  return el('span', { text: String(value) });
}

/** Read `a.b.c` out of an object without throwing on a missing link. */
export function pick(obj, path) {
  return String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** Turn rows into a CSV download — the usual "give me this list in a spreadsheet". */
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => esc(pick(row, c.key))).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** `/users/:id/roles/:roleId` + params → a concrete path. */
export function buildPath(template, params = {}) {
  return template.replace(/:([A-Za-z0-9_]+)/g, (match, key) => {
    const value = params[key];
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${key}" for ${template}`);
    return encodeURIComponent(value);
  });
}
