/**
 * Role dashboards.
 *
 * Every office signs in through the same screen and holds the same kind of
 * token; what differs is where they land and what the landing shows. That
 * difference is declared here rather than coded into the dashboard page, so
 * adding an office is a row in this file.
 *
 * None of it is a security boundary. The API checks permissions against the
 * database on every request, so a dashboard that offers a tile its holder
 * cannot in fact read gets a 403 and the tile is dropped — see the counter
 * loader in pages/dashboard.js. This decides what is worth putting in front of
 * someone, not what they are allowed to do.
 *
 * Order is precedence: a user holding several roles gets the first that
 * matches, which is why the broadest offices come first.
 */

export const DASHBOARDS = [
  {
    role: 'SUPER_ADMIN',
    label: 'Platform administration',
    headline: 'Everything, across every office. Use the access matrix to see who can reach what.',
    links: [
      { label: 'Provision a user', to: '/users', glyph: '👤' },
      { label: 'Access matrix', to: '/access-matrix', glyph: '🧮', permission: 'roles:read' },
      { label: 'Audit trail', to: '/audit', glyph: '📜', permission: 'audit:read' },
      { label: 'API health', to: '/health', glyph: '🩺' },
    ],
    showPlatformStats: true,
  },
  {
    role: 'ADMIN',
    label: 'University administration',
    headline: 'Users, the organisation chart, communication and campus services.',
    links: [
      { label: 'Provision a user', to: '/users', glyph: '👤' },
      { label: 'Post an announcement', to: '/announcements', glyph: '📢' },
      { label: 'Emergency broadcast', to: '/broadcast', glyph: '🚨', permission: 'notifications:broadcast_emergency' },
      { label: 'Primary system links', to: '/campus-links', glyph: '🔗', permission: 'campus_links:manage' },
      { label: 'Audit trail', to: '/audit', glyph: '📜', permission: 'audit:read' },
    ],
    showPlatformStats: true,
  },
  {
    role: 'REGISTRAR',
    label: 'Academic registry',
    headline: 'The calendar, course offerings, enrolment, examinations and transcripts.',
    links: [
      { label: 'Academic calendar', to: '/academic-terms', glyph: '🗓' },
      { label: 'Course offerings', to: '/course-offerings', glyph: '📘' },
      { label: 'Enrolments', to: '/enrollments', glyph: '📝' },
      { label: 'Examinations', to: '/examinations', glyph: '🧑‍🏫' },
      { label: 'Document requests', to: '/document-requests', glyph: '📄' },
    ],
    showCurrentTerm: true,
    counters: [
      { label: 'Course offerings', path: '/academics/course-offerings', to: '/course-offerings' },
      { label: 'Programmes', path: '/programs', noPagination: true, to: '/programs' },
      { label: 'Requests awaiting review', path: '/documents/requests', query: { status: 'REQUESTED' }, to: '/document-requests' },
      { label: 'Examinations', path: '/examinations', to: '/examinations' },
    ],
  },
  {
    role: 'FINANCE_OFFICER',
    label: 'Business office',
    headline: 'The published tariff, student billing, and the payment ledger.',
    links: [
      { label: 'Fee structures', to: '/fee-structures', glyph: '📐', permission: 'fee_structures:manage' },
      { label: 'Invoices', to: '/invoices', glyph: '🧾', permission: 'invoices:manage' },
      { label: 'Stuck payments', to: '/stuck-payments', glyph: '⏳', permission: 'payments:manage' },
      { label: 'Scholarships', to: '/scholarships', glyph: '🎓', permission: 'scholarships:manage' },
    ],
    showCurrentTerm: true,
    counters: [
      { label: 'Unpaid invoices', path: '/invoices', query: { status: 'PENDING' }, to: '/invoices' },
      { label: 'Overdue invoices', path: '/invoices', query: { status: 'OVERDUE' }, to: '/invoices', tone: 'danger' },
      { label: 'Stuck payments', path: '/payments/stuck', to: '/stuck-payments', tone: 'danger' },
      { label: 'Published tariffs', path: '/fee-structures', query: { isPublished: true }, to: '/fee-structures' },
    ],
  },
  {
    role: 'DEAN_OF_STUDENTS',
    label: 'Dean of Students',
    headline: 'Student welfare — accommodation, clubs and events, safety and support.',
    links: [
      { label: 'Safety alerts', to: '/safety-alerts', glyph: '🚨', permission: 'safety_alerts:manage' },
      { label: 'Support tickets', to: '/tickets', glyph: '🎫', permission: 'tickets:manage' },
      { label: 'Accommodation', to: '/allocations', glyph: '🛏', permission: 'accommodation:manage' },
      { label: 'Post an announcement', to: '/announcements', glyph: '📢' },
      { label: 'Emergency broadcast', to: '/broadcast', glyph: '🚨', permission: 'notifications:broadcast_emergency' },
    ],
    counters: [
      { label: 'Active safety alerts', path: '/safety-alerts', query: { status: 'ACTIVE' }, to: '/safety-alerts', tone: 'danger' },
      { label: 'Open tickets', path: '/tickets', query: { status: 'OPEN' }, to: '/tickets' },
      { label: 'Maintenance open', path: '/accommodation/maintenance-requests', query: { status: 'OPEN' }, to: '/maintenance-requests' },
      { label: 'Bed allocations', path: '/accommodation/allocations', to: '/allocations' },
    ],
  },
  {
    role: 'DEAN',
    label: 'Faculty office',
    headline: 'Oversight of the faculty — its departments, programmes and teaching.',
    links: [
      { label: 'Departments', to: '/departments', glyph: '🏫' },
      { label: 'Programmes', to: '/programs', glyph: '🎓' },
      { label: 'Department channel', to: '/department-channel', glyph: '💬' },
      { label: 'Post an announcement', to: '/announcements', glyph: '📢' },
    ],
    showCurrentTerm: true,
    showPlatformStats: true,
  },
  {
    // DEPARTMENT_ADMIN is the Head of Department — there is deliberately no
    // separate HOD role, which would be a second name for the same authority.
    role: 'DEPARTMENT_ADMIN',
    label: 'Head of Department',
    headline: 'Your department — its programmes, staff and students.',
    links: [
      { label: 'Programmes', to: '/programs', glyph: '🎓' },
      { label: 'Courses', to: '/courses', glyph: '📗' },
      { label: 'Department channel', to: '/department-channel', glyph: '💬' },
      { label: 'Staff and students', to: '/users', glyph: '👥', permission: 'users:read' },
    ],
    showCurrentTerm: true,
  },
  {
    role: 'LIBRARIAN',
    label: 'Library',
    headline: 'The catalogue and the loan desk.',
    links: [
      { label: 'Books', to: '/library-books', glyph: '📚' },
      { label: 'Loans', to: '/library-loans', glyph: '🔄' },
      { label: 'Authors', to: '/library-authors', glyph: '✍' },
    ],
    counters: [
      { label: 'Books', path: '/library/books', to: '/library-books' },
      { label: 'Active loans', path: '/library/loans', query: { status: 'ACTIVE' }, to: '/library-loans' },
      { label: 'Overdue loans', path: '/library/loans', query: { status: 'OVERDUE' }, to: '/library-loans', tone: 'danger' },
    ],
  },
  {
    role: 'ACCOMMODATION_OFFICER',
    label: 'Accommodation office',
    headline: 'Hostels, allocations, maintenance and visitors.',
    links: [
      { label: 'Allocations', to: '/allocations', glyph: '🛏' },
      { label: 'Maintenance', to: '/maintenance-requests', glyph: '🔧' },
      { label: 'Swap requests', to: '/swap-requests', glyph: '🔁' },
      { label: 'Visitor logs', to: '/visitor-logs', glyph: '🚶' },
    ],
    counters: [
      { label: 'Bed allocations', path: '/accommodation/allocations', to: '/allocations' },
      { label: 'Maintenance open', path: '/accommodation/maintenance-requests', query: { status: 'OPEN' }, to: '/maintenance-requests' },
      { label: 'Swaps pending', path: '/accommodation/swap-requests', query: { status: 'PENDING' }, to: '/swap-requests' },
    ],
  },
  {
    role: 'SECURITY_OFFICER',
    label: 'Campus security',
    headline: 'Identity checks, visitor logs and safety alerts.',
    links: [
      { label: 'Digital ID desk', to: '/digital-id', glyph: '🪪' },
      { label: 'Safety alerts', to: '/safety-alerts', glyph: '🚨' },
      { label: 'Visitor logs', to: '/visitor-logs', glyph: '🚶' },
    ],
    counters: [
      { label: 'Active safety alerts', path: '/safety-alerts', query: { status: 'ACTIVE' }, to: '/safety-alerts', tone: 'danger' },
      { label: 'Visitors on campus', path: '/accommodation/visitor-logs', to: '/visitor-logs' },
    ],
  },
  {
    role: 'HEALTH_STAFF',
    label: 'Campus clinic',
    headline: 'Clinic appointments. Nothing else reaches these records.',
    links: [{ label: 'Clinic appointments', to: '/clinic-appointments', glyph: '🩺' }],
    counters: [
      { label: 'Confirmed appointments', path: '/health/appointments', query: { status: 'CONFIRMED' }, to: '/clinic-appointments' },
    ],
  },
  {
    role: 'COUNSELOR',
    label: 'Counselling',
    headline: 'Counselling appointments. Nothing else reaches these records.',
    links: [{ label: 'Counselling appointments', to: '/counseling-appointments', glyph: '💛' }],
    counters: [
      { label: 'Confirmed appointments', path: '/counseling/appointments', query: { status: 'CONFIRMED' }, to: '/counseling-appointments' },
    ],
  },
];

/** Shown to an account whose roles match no dashboard, and to one with none. */
export const FALLBACK_DASHBOARD = {
  role: null,
  label: 'Console',
  headline: 'Your account holds no role with a dashboard of its own. The menu shows what the API will let you reach.',
  links: [{ label: 'My account', to: '/account', glyph: '⚙' }],
};

/** The dashboard for a set of role names, by the precedence above. */
export function dashboardFor(roles = []) {
  const held = new Set(roles);
  return DASHBOARDS.find((d) => held.has(d.role)) || FALLBACK_DASHBOARD;
}
