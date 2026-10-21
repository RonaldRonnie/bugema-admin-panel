/**
 * The nav registry. Order here is the order in the sidebar; `group` collects
 * entries under a heading. A `page` entry renders a bespoke module, a
 * `resource` entry goes through the generic engine in pages/resource.js.
 */
import * as identity from './identity.js';
import * as organization from './organization.js';
import * as academics from './academics.js';
import * as finance from './finance.js';
import * as campus from './campus.js';
import * as studentlife from './studentlife.js';
import * as wellbeing from './wellbeing.js';
import * as communication from './communication.js';

export const RESOURCES = [
  identity.users, identity.roles, identity.permissions,
  organization.faculties, organization.departments, organization.programs,
  academics.academicTerms,
  academics.courses, academics.courseOfferings, academics.enrollments, academics.schedules,
  academics.examinations, academics.attendance, academics.liveSessions,
  finance.feeStructures, finance.invoices, finance.payments, finance.stuckPayments,
  finance.scholarships, finance.documentRequests,
  campus.campusLinks, campus.campusLocations,
  campus.libraryBooks, campus.libraryAuthors, campus.libraryCategories, campus.libraryLoans,
  campus.hostels, campus.rooms, campus.allocations, campus.swapRequests,
  campus.maintenanceRequests, campus.visitorLogs,
  studentlife.clubs, studentlife.events, studentlife.alumni, studentlife.jobs,
  wellbeing.clinicAppointments, wellbeing.counselingAppointments, wellbeing.safetyAlerts, wellbeing.tickets,
  communication.announcements, communication.worshipSessions,
];

/** Bespoke screens, interleaved into the nav by group. */
export const PAGES = [
  { key: 'dashboard', path: '/', label: 'Dashboard', group: 'Overview', icon: '📊', page: 'dashboard' },
  { key: 'search', path: '/search', label: 'Search', group: 'Overview', icon: '🔍', page: 'search' },
  { key: 'access-matrix', path: '/access-matrix', label: 'Access matrix', group: 'Identity & access', icon: '🧮', page: 'access-matrix', permission: 'roles:read' },
  { key: 'messaging', path: '/messaging', label: 'Conversations', group: 'Communication', icon: '💬', page: 'messaging' },
  { key: 'department-channel', path: '/department-channel', label: 'Department channel', group: 'Communication', icon: '🏫', page: 'department-channel' },
  { key: 'broadcast', path: '/broadcast', label: 'Emergency broadcast', group: 'Communication', icon: '🚨', page: 'broadcast', permission: 'notifications:broadcast_emergency' },
  { key: 'digital-id', path: '/digital-id', label: 'Digital ID desk', group: 'Campus services', icon: '🪪', page: 'digital-id' },
  { key: 'files', path: '/files', label: 'Files', group: 'Platform', icon: '📎', page: 'files' },
  { key: 'audit', path: '/audit', label: 'Audit trail', group: 'Platform', icon: '📜', page: 'audit', permission: 'audit:read' },
  { key: 'health', path: '/health', label: 'API health', group: 'Platform', icon: '🩺', page: 'health' },
  { key: 'api-console', path: '/api-console', label: 'API console', group: 'Platform', icon: '⌨', page: 'api-console' },
  { key: 'account', path: '/account', label: 'My account', group: 'Platform', icon: '⚙', page: 'account' },
];

/** Sidebar order. Any group a resource declares that is missing here is appended. */
export const GROUP_ORDER = [
  'Overview',
  'Identity & access',
  'Organisation',
  'Academics',
  'Finance',
  'Campus services',
  'Library',
  'Accommodation',
  'Student life',
  'Health & wellbeing',
  'Communication',
  'Platform',
];

/** Everything the sidebar renders, grouped and ordered. */
export function navEntries() {
  const entries = [
    ...PAGES.map((p) => ({ ...p, kind: 'page' })),
    ...RESOURCES.map((r) => ({
      kind: 'resource',
      key: r.key,
      path: `/${r.key}`,
      label: r.label,
      group: r.group,
      icon: r.icon,
      permission: r.list?.permission,
      resource: r,
    })),
  ];

  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  }

  const ordered = [];
  for (const name of GROUP_ORDER) if (groups.has(name)) ordered.push([name, groups.get(name)]);
  for (const [name, items] of groups) if (!GROUP_ORDER.includes(name)) ordered.push([name, items]);
  return ordered;
}

export function resourceByKey(key) {
  return RESOURCES.find((r) => r.key === key) || null;
}
