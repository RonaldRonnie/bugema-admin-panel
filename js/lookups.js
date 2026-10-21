/**
 * Reference collections used to populate pickers. `search: true` means the
 * collection is too large to list, so the picker queries the API as you type
 * (the API's own `?search=` / `?q=` parameter); everything else is fetched once
 * and cached by store.lookup().
 */
import { api, ApiError } from './api.js';
import { lookup } from './store.js';

export const LOOKUPS = {
  users: {
    path: '/users', search: true,
    label: (u) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id,
    meta: (u) => [u.email, u.type, u.status].filter(Boolean).join(' · '),
  },
  students: {
    path: '/users', search: true, query: { type: 'STUDENT' },
    label: (u) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id,
    meta: (u) => [u.email, u.studentProfile?.registrationNumber].filter(Boolean).join(' · '),
  },
  staff: {
    path: '/users', search: true, query: { type: 'STAFF' },
    label: (u) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id,
    meta: (u) => [u.email, u.staffProfile?.staffNumber].filter(Boolean).join(' · '),
  },
  roles: { path: '/roles', label: (r) => r.name, meta: (r) => r.description },
  permissions: { path: '/permissions', label: (p) => p.name, meta: (p) => p.category },
  faculties: { path: '/faculties', label: (f) => `${f.code} — ${f.name}` },
  // /departments and /programs take no pagination parameters at all — their
  // query DTOs do not extend PaginationQueryDto, and the API rejects unknown
  // query keys outright, so these two must be fetched bare.
  departments: { path: '/departments', noPagination: true, label: (d) => `${d.code} — ${d.name}` },
  programs: { path: '/programs', noPagination: true, label: (p) => `${p.code} — ${p.name}`, meta: (p) => p.level },
  courses: { path: '/courses', search: true, label: (c) => `${c.code} — ${c.title}` },
  academicTerms: {
    path: '/academic-terms',
    label: (t) => t.name || `${t.academicYear} ${String(t.semester || '').replace('SEMESTER_', 'Semester ')}`,
    meta: (t) => (t.isCurrent ? 'current term' : undefined),
  },
  courseOfferings: {
    path: '/academics/course-offerings',
    label: (o) => `${o.course?.code ?? o.courseId?.slice(0, 8)} · ${o.academicYear} ${String(o.semester || '').replace('SEMESTER_', 'S')}`,
    meta: (o) => o.course?.title,
  },
  campusLocations: { path: '/campus-locations', label: (l) => l.name, meta: (l) => l.category },
  hostels: { path: '/accommodation/hostels', label: (h) => h.name, meta: (h) => h.type },
  clubs: { path: '/clubs', label: (c) => c.name },
  events: { path: '/events', label: (e) => e.title },
  books: { path: '/library/books', search: true, label: (b) => b.title, meta: (b) => b.isbn },
  authors: { path: '/library/authors', search: true, label: (a) => a.name },
  categories: { path: '/library/categories', label: (c) => c.name },
  invoices: {
    path: '/invoices', label: (i) => `${i.description} · ${i.academicYear}`,
    meta: (i) => `${i.amount} · ${i.status}`,
  },
};

/** Options for a non-searchable lookup, cached across the session. */
export async function lookupOptions(name) {
  const def = LOOKUPS[name];
  if (!def) throw new Error(`Unknown lookup "${name}"`);
  const items = await lookup(def.path, def.noPagination ? def.query : { limit: 100, ...def.query });
  return items.map((item) => ({ value: item.id ?? item.userId, label: def.label(item), meta: def.meta?.(item), item }));
}

/** Live search for a large collection. Falls back to an empty list on 403. */
export async function lookupSearch(name, term) {
  const def = LOOKUPS[name];
  if (!def) throw new Error(`Unknown lookup "${name}"`);
  if (!def.search) {
    const all = await lookupOptions(name);
    const t = term.toLowerCase();
    return all.filter((o) => o.label.toLowerCase().includes(t) || (o.meta || '').toLowerCase().includes(t)).slice(0, 25);
  }
  try {
    const { items } = await api.list(def.path, { ...def.query, search: term || undefined, limit: 20 });
    return items.map((item) => ({ value: item.id ?? item.userId, label: def.label(item), meta: def.meta?.(item), item }));
  } catch (err) {
    if (err instanceof ApiError && (err.isForbidden || err.isNotFound)) return [];
    throw err;
  }
}

/** Resolve one id to a label, for showing an existing value in an edit form. */
export async function lookupLabel(name, id) {
  if (!id) return '';
  const def = LOOKUPS[name];
  if (!def) return id;
  try {
    const item = await api.get(`${def.path}/${encodeURIComponent(id)}`);
    return def.label(item);
  } catch {
    return id;
  }
}
