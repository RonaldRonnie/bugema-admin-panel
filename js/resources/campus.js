/** Campus services: map, library, accommodation, visitor logs, digital ID. */
import { E } from '../enums.js';
import { el, badge, openModal, notify } from '../ui.js';
import { api } from '../api.js';

export const campusLocations = {
  key: 'campus-locations',
  label: 'Campus map',
  singular: 'Location',
  group: 'Campus services',
  icon: '🗺',
  description: 'Points on the campus map. Lecture rooms and venues here are what timetable entries and exams point at.',
  list: {
    path: '/campus-locations',
    searchable: true,
    filters: [{ name: 'category', label: 'Category', type: 'enum', options: E.CampusLocationCategory }],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'openingHours', label: 'Opening hours' },
      { key: 'contactInfo', label: 'Contact' },
    ],
  },
  detailPath: '/campus-locations/:id',
  create: {
    path: '/campus-locations', permission: 'campus_locations:create',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 200 },
      { name: 'category', label: 'Category', type: 'enum', options: E.CampusLocationCategory, required: true },
      { name: 'latitude', label: 'Latitude', type: 'number', required: true },
      { name: 'longitude', label: 'Longitude', type: 'number', required: true },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'openingHours', label: 'Opening hours', type: 'text', maxLength: 100 },
      { name: 'contactInfo', label: 'Contact', type: 'text', maxLength: 100 },
    ],
  },
  update: {
    path: '/campus-locations/:id', permission: 'campus_locations:update',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 200 },
      { name: 'category', label: 'Category', type: 'enum', options: E.CampusLocationCategory },
      { name: 'latitude', label: 'Latitude', type: 'number' },
      { name: 'longitude', label: 'Longitude', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'openingHours', label: 'Opening hours', type: 'text', maxLength: 100 },
      { name: 'contactInfo', label: 'Contact', type: 'text', maxLength: 100 },
    ],
  },
  remove: { path: '/campus-locations/:id', permission: 'campus_locations:delete', confirm: 'Delete this location?' },
};

/* ------------------------------------------------------------- Library */

export const libraryBooks = {
  key: 'library-books',
  label: 'Books',
  singular: 'Book',
  group: 'Library',
  icon: '📚',
  description: 'The catalogue. A book is a title; each physical item is a copy with its own barcode and status.',
  list: {
    path: '/library/books',
    permission: 'library:manage_catalog',
    searchable: true,
    filters: [
      { name: 'authorId', label: 'Author', type: 'select', lookup: 'authors' },
      { name: 'categoryId', label: 'Category', type: 'select', lookup: 'categories' },
    ],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'isbn', label: 'ISBN' },
      { key: 'authorId', label: 'Author', type: 'id' },
      { key: 'categoryId', label: 'Category', type: 'id' },
      { key: 'copies', label: 'Copies', render: (b) => String((b.copies || []).length || b._count?.copies || 0) },
    ],
  },
  detailPath: '/library/books/:id',
  create: {
    path: '/library/books', permission: 'library:manage_catalog',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 300 },
      { name: 'isbn', label: 'ISBN', type: 'text', maxLength: 20 },
      { name: 'authorId', label: 'Author', type: 'select', lookup: 'authors' },
      { name: 'categoryId', label: 'Category', type: 'select', lookup: 'categories' },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },
  update: {
    path: '/library/books/:id', permission: 'library:manage_catalog',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 300 },
      { name: 'isbn', label: 'ISBN', type: 'text', maxLength: 20 },
      { name: 'authorId', label: 'Author', type: 'select', lookup: 'authors' },
      { name: 'categoryId', label: 'Category', type: 'select', lookup: 'categories' },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },
  remove: { path: '/library/books/:id', permission: 'library:manage_catalog', confirm: 'Delete this book?' },
  actions: [
    {
      key: 'reserve', label: 'Place a reservation', glyph: '🔖', permission: 'library:manage_loans',
      method: 'POST', path: '/library/books/:id/reservations', fields: [],
      successMessage: 'Reservation placed.',
    },
  ],
  related: [
    {
      key: 'copies', label: 'Copies',
      from: (book) => book.copies || [],
      columns: [
        { key: 'barcode', label: 'Barcode' },
        { key: 'status', label: 'Status' },
      ],
      create: {
        label: 'Add copy', permission: 'library:manage_catalog', path: '/library/books/:id/copies',
        fields: [{ name: 'barcode', label: 'Barcode', type: 'text', required: true, maxLength: 50 }],
      },
      actions: [
        {
          label: 'Mark lost', variant: 'danger', method: 'PATCH', path: '/library/copies/:childId',
          permission: 'library:manage_catalog', body: () => ({ status: 'LOST' }),
          when: (copy) => copy.status !== 'LOST',
        },
        {
          label: 'Mark available', method: 'PATCH', path: '/library/copies/:childId',
          permission: 'library:manage_catalog', body: () => ({ status: 'AVAILABLE' }),
          when: (copy) => copy.status !== 'AVAILABLE',
        },
      ],
      emptyMessage: 'No physical copies registered',
    },
  ],
};

export const libraryAuthors = {
  key: 'library-authors',
  label: 'Authors',
  singular: 'Author',
  group: 'Library',
  icon: '✍',
  list: {
    path: '/library/authors', searchable: true,
    columns: [{ key: 'name', label: 'Name' }, { key: 'createdAt', label: 'Added', type: 'datetime' }],
  },
  detailPath: '/library/authors/:id',
  create: { path: '/library/authors', permission: 'library:manage_catalog', fields: [{ name: 'name', label: 'Name', type: 'text', required: true, maxLength: 200 }] },
  update: { path: '/library/authors/:id', permission: 'library:manage_catalog', fields: [{ name: 'name', label: 'Name', type: 'text', maxLength: 200 }] },
  remove: { path: '/library/authors/:id', permission: 'library:manage_catalog', confirm: 'Delete this author?' },
};

export const libraryCategories = {
  key: 'library-categories',
  label: 'Categories',
  singular: 'Category',
  group: 'Library',
  icon: '🏷',
  list: {
    path: '/library/categories', permission: 'library:manage_catalog',
    columns: [{ key: 'name', label: 'Name' }, { key: 'createdAt', label: 'Added', type: 'datetime' }],
  },
  detailPath: '/library/categories/:id',
  create: { path: '/library/categories', permission: 'library:manage_catalog', fields: [{ name: 'name', label: 'Name', type: 'text', required: true, maxLength: 100 }] },
  update: { path: '/library/categories/:id', permission: 'library:manage_catalog', fields: [{ name: 'name', label: 'Name', type: 'text', maxLength: 100 }] },
  remove: { path: '/library/categories/:id', permission: 'library:manage_catalog', confirm: 'Delete this category?' },
};

export const libraryLoans = {
  key: 'library-loans',
  label: 'Loans',
  singular: 'Loan',
  group: 'Library',
  icon: '📕',
  description: 'Issue and return copies, and bill an overdue fine straight onto the borrower’s invoice ledger.',
  list: {
    path: '/library/loans',
    permission: 'library:manage_loans',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.LoanStatus },
      { name: 'overdue', label: 'Overdue only', type: 'enum', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ],
    columns: [
      { key: 'userId', label: 'Borrower', type: 'id' },
      { key: 'bookCopyId', label: 'Copy', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'borrowedAt', label: 'Borrowed', type: 'datetime' },
      { key: 'dueAt', label: 'Due', type: 'datetime' },
      { key: 'returnedAt', label: 'Returned', type: 'datetime' },
      { key: 'fineAmount', label: 'Fine', type: 'money' },
    ],
  },
  detail: false,
  create: {
    path: '/library/loans', permission: 'library:manage_loans', label: 'Issue a loan',
    fields: [
      { name: 'bookCopyId', label: 'Book copy ID', type: 'text', required: true, help: 'The copy’s UUID — find it under the book’s Copies tab.' },
      { name: 'userId', label: 'Borrower', type: 'ref', lookup: 'users', required: true },
      { name: 'dueAt', label: 'Due', type: 'datetime', required: true },
    ],
  },
  actions: [
    {
      key: 'return', label: 'Return', inline: true, glyph: '↩', permission: 'library:manage_loans',
      method: 'POST', path: '/library/loans/:id/return',
      confirm: 'Mark this copy returned?',
      when: (l) => l.status !== 'RETURNED',
    },
    {
      key: 'extend', label: 'Extend due date', glyph: '⏱', permission: 'library:manage_loans',
      method: 'PATCH', path: '/library/loans/:id',
      fields: [{ name: 'dueAt', label: 'New due date', type: 'datetime', required: true }],
      when: (l) => l.status !== 'RETURNED',
    },
    {
      key: 'fine', label: 'Charge a fine', glyph: '💰', variant: 'danger', permission: 'library:manage_loans',
      method: 'PATCH', path: '/library/loans/:id/charge-fine',
      subtitle: 'Raises an invoice against the borrower for the overdue amount.',
      fields: [
        { name: 'academicYear', label: 'Academic year', type: 'text', required: true, maxLength: 20 },
        { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester, required: true },
        { name: 'dueDate', label: 'Invoice due date', type: 'datetime' },
      ],
    },
  ],
};

/* ------------------------------------------------------- Accommodation */

export const hostels = {
  key: 'hostels',
  label: 'Hostels',
  singular: 'Hostel',
  group: 'Accommodation',
  icon: '🏨',
  description: 'Hostels contain rooms, rooms contain beds, and a bed is what a student is actually allocated.',
  list: {
    path: '/accommodation/hostels',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'description', label: 'Description', clip: true },
    ],
  },
  detailPath: '/accommodation/hostels/:id',
  create: {
    path: '/accommodation/hostels', permission: 'accommodation:manage',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150 },
      { name: 'type', label: 'Type', type: 'enum', options: E.HostelType, required: true },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    ],
  },
  update: {
    path: '/accommodation/hostels/:id', permission: 'accommodation:manage',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 150 },
      { name: 'type', label: 'Type', type: 'enum', options: E.HostelType },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    ],
  },
  remove: { path: '/accommodation/hostels/:id', permission: 'accommodation:manage', confirm: 'Delete this hostel?' },
  related: [
    {
      key: 'rooms', label: 'Rooms', path: '/accommodation/hostels/:id/rooms',
      columns: [
        { key: 'roomNumber', label: 'Room' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'id', label: 'Room ID', type: 'id' },
      ],
      create: {
        label: 'Add room', permission: 'accommodation:manage', path: '/accommodation/hostels/:id/rooms',
        fields: [
          { name: 'roomNumber', label: 'Room number', type: 'text', required: true, maxLength: 50 },
          { name: 'capacity', label: 'Capacity', type: 'integer', required: true, min: 1 },
        ],
      },
      remove: { path: '/accommodation/rooms/:childId', permission: 'accommodation:manage', confirm: 'Delete this room?' },
      emptyMessage: 'No rooms in this hostel',
    },
  ],
};

export const rooms = {
  key: 'rooms',
  label: 'Rooms & beds',
  singular: 'Room',
  group: 'Accommodation',
  icon: '🛏',
  description: 'Pick a hostel to list its rooms; open a room to manage the beds inside it.',
  list: {
    path: '/accommodation/hostels/:hostelId/rooms',
    permission: 'accommodation:manage',
    needs: { hostelId: { label: 'Hostel', lookup: 'hostels' } },
    paginated: false,
    columns: [
      { key: 'roomNumber', label: 'Room' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'id', label: 'Room ID', type: 'id' },
    ],
  },
  detailPath: '/accommodation/rooms/:id',
  update: {
    path: '/accommodation/rooms/:id', permission: 'accommodation:manage',
    fields: [
      { name: 'roomNumber', label: 'Room number', type: 'text', maxLength: 50 },
      { name: 'capacity', label: 'Capacity', type: 'integer', min: 1 },
    ],
  },
  remove: { path: '/accommodation/rooms/:id', permission: 'accommodation:manage', confirm: 'Delete this room?' },
  related: [
    {
      key: 'beds', label: 'Beds', path: '/accommodation/rooms/:id/beds',
      columns: [
        { key: 'bedNumber', label: 'Bed' },
        { key: 'status', label: 'Status' },
        { key: 'id', label: 'Bed ID', type: 'id' },
      ],
      create: {
        label: 'Add bed', permission: 'accommodation:manage', path: '/accommodation/rooms/:id/beds',
        fields: [{ name: 'bedNumber', label: 'Bed number', type: 'text', required: true, maxLength: 50 }],
      },
      actions: [
        { label: 'Available', method: 'PATCH', path: '/accommodation/beds/:childId', permission: 'accommodation:manage', body: () => ({ status: 'AVAILABLE' }), when: (b) => b.status !== 'AVAILABLE' },
        { label: 'Maintenance', method: 'PATCH', path: '/accommodation/beds/:childId', permission: 'accommodation:manage', body: () => ({ status: 'MAINTENANCE' }), when: (b) => b.status !== 'MAINTENANCE' },
      ],
      remove: { path: '/accommodation/beds/:childId', permission: 'accommodation:manage', confirm: 'Delete this bed?' },
      emptyMessage: 'No beds in this room',
    },
  ],
};

export const allocations = {
  key: 'allocations',
  label: 'Bed allocations',
  singular: 'Allocation',
  group: 'Accommodation',
  icon: '🔑',
  list: {
    path: '/accommodation/allocations',
    permission: 'accommodation:manage',
    filters: [
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students' },
      { name: 'bedId', label: 'Bed ID', type: 'text' },
    ],
    columns: [
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'bedId', label: 'Bed', type: 'id' },
      { key: 'academicYear', label: 'Year' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
    ],
  },
  detail: false,
  create: {
    path: '/accommodation/allocations', permission: 'accommodation:manage',
    fields: [
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students', required: true },
      { name: 'bedId', label: 'Bed ID', type: 'text', required: true, help: 'Copy the bed’s UUID from Rooms & beds.' },
      { name: 'academicYear', label: 'Academic year', type: 'text', required: true, maxLength: 50 },
      { name: 'startDate', label: 'Start date', type: 'datetime', required: true },
    ],
  },
  actions: [
    {
      key: 'end', label: 'End allocation', inline: true, variant: 'danger', permission: 'accommodation:manage',
      method: 'PATCH', path: '/accommodation/allocations/:id/end',
      confirm: 'End this allocation and free the bed?',
      when: (a) => a.status === 'ACTIVE',
    },
  ],
};

export const swapRequests = {
  key: 'swap-requests',
  label: 'Room swaps',
  singular: 'Swap request',
  group: 'Accommodation',
  icon: '🔄',
  list: {
    path: '/accommodation/swap-requests',
    permission: 'accommodation:manage',
    filters: [{ name: 'status', label: 'Status', type: 'enum', options: E.RoomSwapRequestStatus }],
    columns: [
      { key: 'requesterUserId', label: 'Requester', type: 'id' },
      { key: 'requestedBedId', label: 'Wants bed', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Reason', clip: true },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
    ],
  },
  detail: false,
  actions: [
    {
      key: 'approve', label: 'Approve', inline: true, permission: 'accommodation:manage',
      method: 'PATCH', path: '/accommodation/swap-requests/:id/approve',
      confirm: 'Approve this swap and move the student?',
      when: (s) => s.status === 'PENDING',
    },
    {
      key: 'reject', label: 'Reject', inline: true, variant: 'danger', permission: 'accommodation:manage',
      method: 'PATCH', path: '/accommodation/swap-requests/:id/reject',
      fields: [{ name: 'reviewNotes', label: 'Review notes', type: 'textarea', maxLength: 500 }],
      when: (s) => s.status === 'PENDING',
    },
  ],
};

export const maintenanceRequests = {
  key: 'maintenance-requests',
  label: 'Maintenance',
  singular: 'Maintenance request',
  group: 'Accommodation',
  icon: '🔧',
  description: 'Repair requests raised by residents, with assignment and a status trail.',
  list: {
    path: '/accommodation/maintenance-requests',
    permission: 'maintenance:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.MaintenanceStatus },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.MaintenancePriority },
    ],
    columns: [
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description', clip: true },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'requesterUserId', label: 'Raised by', type: 'id' },
      { key: 'assignedToUserId', label: 'Assigned to', type: 'id' },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
    ],
  },
  detailPath: '/accommodation/maintenance-requests/:id',
  create: {
    path: '/accommodation/maintenance-requests', permission: 'accommodation:manage',
    fields: [
      { name: 'category', label: 'Category', type: 'text', required: true, maxLength: 100 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 1000 },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.MaintenancePriority },
      { name: 'fileAssetIds', label: 'Attached file asset IDs', type: 'tags', help: 'Upload under Files first, then paste the IDs.' },
    ],
  },
  actions: [
    {
      key: 'assign', label: 'Assign', glyph: '👤', permission: 'maintenance:manage',
      method: 'PATCH', path: '/accommodation/maintenance-requests/:id/assign',
      fields: [{ name: 'staffUserId', label: 'Staff member', type: 'ref', lookup: 'staff', required: true }],
    },
    {
      key: 'status', label: 'Update status', glyph: '→', permission: 'maintenance:manage',
      method: 'PATCH', path: '/accommodation/maintenance-requests/:id/status',
      fields: [
        { name: 'status', label: 'Status', type: 'enum', options: E.MaintenanceStatus, required: true },
        { name: 'resolutionNotes', label: 'Resolution notes', type: 'textarea', maxLength: 500 },
      ],
    },
  ],
};

export const visitorLogs = {
  key: 'visitor-logs',
  label: 'Visitor logs',
  singular: 'Visitor',
  group: 'Accommodation',
  icon: '🚪',
  list: {
    path: '/accommodation/visitor-logs',
    permission: 'visitor_logs:manage',
    filters: [{ name: 'hostUserId', label: 'Host', type: 'ref', lookup: 'users' }],
    columns: [
      { key: 'visitorName', label: 'Visitor' },
      { key: 'hostUserId', label: 'Host', type: 'id' },
      { key: 'visitorContact', label: 'Contact' },
      { key: 'purpose', label: 'Purpose', clip: true },
      { key: 'checkInAt', label: 'In', type: 'datetime' },
      { key: 'checkOutAt', label: 'Out', type: 'datetime' },
    ],
  },
  detail: false,
  create: {
    path: '/accommodation/visitor-logs', permission: 'visitor_logs:manage', label: 'Check a visitor in',
    fields: [
      { name: 'hostUserId', label: 'Host', type: 'ref', lookup: 'users', required: true },
      { name: 'visitorName', label: 'Visitor name', type: 'text', required: true, maxLength: 200 },
      { name: 'visitorContact', label: 'Contact', type: 'text', maxLength: 20 },
      { name: 'purpose', label: 'Purpose', type: 'textarea', maxLength: 500 },
    ],
  },
  actions: [
    {
      key: 'checkout', label: 'Check out', inline: true, permission: 'visitor_logs:manage',
      method: 'PATCH', path: '/accommodation/visitor-logs/:id/checkout',
      confirm: 'Record this visitor as checked out now?',
      when: (v) => !v.checkOutAt,
    },
  ],
};

/**
 * Links into the university's primary student information system.
 *
 * That system stays the system of record for admissions, registration and the
 * official fee ledger. Rather than pretend those live here, the app carries a
 * curated set of links into it, which every client renders as cards. This
 * needs nothing from that system's vendor — it is the step that works today,
 * while a real data feed is still being negotiated.
 */
export const campusLinks = {
  key: 'campus-links',
  label: 'Primary system links',
  singular: 'Link',
  group: 'Campus services',
  icon: '🔗',
  description: 'Destinations in the university’s own systems — the portal, results, fee statements, e-learning. Reading them is public, so the mobile app can show the cards before anyone signs in.',
  list: {
    path: '/campus-links',
    query: { includeInactive: true },
    filters: [
      { name: 'category', label: 'Category', type: 'enum', options: E.CampusLinkCategory },
      { name: 'audience', label: 'Audience', type: 'enum', options: E.AnnouncementAudienceType },
    ],
    columns: [
      { key: 'icon', label: '' },
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'audience', label: 'Audience' },
      { key: 'url', label: 'Destination', clip: true },
      { key: 'requiresLogin', label: 'Signs in again' },
      { key: 'sortOrder', label: 'Position' },
      { key: 'isActive', label: 'Live' },
    ],
  },
  detailPath: '/campus-links/:id',
  create: {
    path: '/campus-links', permission: 'campus_links:manage',
    subtitle: 'Only http(s) addresses are accepted — the clients open these in a browser view on the student’s own device.',
    defaults: { requiresLogin: true, isActive: true, sortOrder: 0 },
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 150 },
      { name: 'url', label: 'Destination URL', type: 'text', required: true, placeholder: 'https://portal.bugemauniv.ac.ug' },
      { name: 'category', label: 'Category', type: 'enum', options: E.CampusLinkCategory, required: true },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
      { name: 'icon', label: 'Icon', type: 'text', maxLength: 50, placeholder: '🎓' },
      { name: 'audience', label: 'Audience', type: 'enum', options: E.AnnouncementAudienceType },
      {
        name: 'requiresLogin', label: 'Destination asks for its own sign-in', type: 'checkbox',
        help: 'Clients warn the user before handing them off — the campus session does not carry across.',
      },
      { name: 'sortOrder', label: 'Position', type: 'integer', min: 0 },
      { name: 'isActive', label: 'Show this link', type: 'checkbox' },
    ],
  },
  update: {
    path: '/campus-links/:id', permission: 'campus_links:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 150 },
      { name: 'url', label: 'Destination URL', type: 'text' },
      { name: 'category', label: 'Category', type: 'enum', options: E.CampusLinkCategory },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
      { name: 'icon', label: 'Icon', type: 'text', maxLength: 50 },
      { name: 'audience', label: 'Audience', type: 'enum', options: E.AnnouncementAudienceType },
      { name: 'requiresLogin', label: 'Destination asks for its own sign-in', type: 'checkbox' },
      { name: 'sortOrder', label: 'Position', type: 'integer', min: 0 },
      { name: 'isActive', label: 'Show this link', type: 'checkbox' },
    ],
  },
  remove: { path: '/campus-links/:id', permission: 'campus_links:manage', confirm: 'Delete this link?' },
};
