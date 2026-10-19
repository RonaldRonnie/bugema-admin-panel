/**
 * Health, counselling, safety and the help desk.
 *
 * Clinic and counselling records are the most sensitive data in the system:
 * reading someone else's record as permitted staff is audited as
 * health.record_accessed / counseling.record_accessed *before* the response is
 * returned. The console surfaces that plainly rather than hiding it.
 */
import { E } from '../enums.js';
import { el } from '../ui.js';

const SENSITIVE = 'Opening a record here is recorded in the audit log against your account.';

export const clinicAppointments = {
  key: 'clinic-appointments',
  label: 'Clinic appointments',
  singular: 'Appointment',
  group: 'Health & wellbeing',
  icon: '🏥',
  description: `Campus clinic bookings. ${SENSITIVE}`,
  list: {
    path: '/health/appointments',
    permission: 'health:manage',
    filters: [{ name: 'status', label: 'Status', type: 'enum', options: E.AppointmentStatus }],
    columns: [
      { key: 'studentUserId', label: 'Patient', type: 'id' },
      { key: 'reasonCategory', label: 'Reason' },
      { key: 'status', label: 'Status' },
      { key: 'requestedAt', label: 'Requested for', type: 'datetime' },
      { key: 'scheduledAt', label: 'Scheduled', type: 'datetime' },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
    ],
  },
  detailPath: '/health/appointments/:id',
  create: {
    path: '/health/appointments', label: 'Book for myself',
    subtitle: 'Creates an appointment for your own account — staff book on behalf of a student through the clinic system, not here.',
    fields: [
      { name: 'reasonCategory', label: 'Reason category', type: 'text', maxLength: 100 },
      { name: 'requestedAt', label: 'Preferred time', type: 'datetime' },
    ],
  },
  remove: { path: '/health/appointments/:id', permission: 'health:manage', confirm: 'Delete this appointment record?' },
  actions: [
    {
      key: 'schedule', label: 'Schedule', glyph: '📅', permission: 'health:manage',
      method: 'PATCH', path: '/health/appointments/:id/schedule',
      fields: [{ name: 'scheduledAt', label: 'Scheduled for', type: 'datetime', required: true }],
    },
    {
      key: 'status', label: 'Set outcome', glyph: '→', permission: 'health:manage',
      method: 'PATCH', path: '/health/appointments/:id/status',
      subtitle: 'Only COMPLETED, CANCELLED and NO_SHOW can be set here.',
      fields: [
        { name: 'status', label: 'Outcome', type: 'enum', options: E.SettableAppointmentStatus, required: true },
        { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 500 },
      ],
    },
  ],
};

export const counselingAppointments = {
  key: 'counseling-appointments',
  label: 'Counselling',
  singular: 'Session',
  group: 'Health & wellbeing',
  icon: '💬',
  description: `Counselling bookings and counsellor assignment. ${SENSITIVE}`,
  list: {
    path: '/counseling/appointments',
    permission: 'counseling:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.AppointmentStatus },
      { name: 'unassigned', label: 'Unassigned only', type: 'enum', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ],
    columns: [
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'counselorUserId', label: 'Counsellor', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'requestedAt', label: 'Requested for', type: 'datetime' },
      { key: 'scheduledAt', label: 'Scheduled', type: 'datetime' },
    ],
  },
  detailPath: '/counseling/appointments/:id',
  create: {
    path: '/counseling/appointments', label: 'Book for myself',
    fields: [{ name: 'requestedAt', label: 'Preferred time', type: 'datetime' }],
  },
  remove: { path: '/counseling/appointments/:id', permission: 'counseling:manage', confirm: 'Delete this counselling record?' },
  actions: [
    {
      key: 'assign', label: 'Assign counsellor', glyph: '👤', permission: 'counseling:manage',
      method: 'PATCH', path: '/counseling/appointments/:id/assign',
      fields: [{ name: 'counselorUserId', label: 'Counsellor', type: 'ref', lookup: 'staff', required: true }],
    },
    {
      key: 'schedule', label: 'Schedule', glyph: '📅', permission: 'counseling:manage',
      method: 'PATCH', path: '/counseling/appointments/:id/schedule',
      fields: [{ name: 'scheduledAt', label: 'Scheduled for', type: 'datetime', required: true }],
    },
    {
      key: 'status', label: 'Set outcome', glyph: '→', permission: 'counseling:manage',
      method: 'PATCH', path: '/counseling/appointments/:id/status',
      fields: [
        { name: 'status', label: 'Outcome', type: 'enum', options: E.SettableAppointmentStatus, required: true },
        { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 500 },
      ],
    },
  ],
};

export const safetyAlerts = {
  key: 'safety-alerts',
  label: 'Safety alerts',
  singular: 'Alert',
  group: 'Health & wellbeing',
  icon: '🚨',
  description: 'Panic-button alerts raised from the mobile app. Everyone holding safety_alerts:manage is notified when one comes in.',
  list: {
    path: '/safety-alerts',
    permission: 'safety_alerts:manage',
    filters: [{ name: 'status', label: 'Status', type: 'enum', options: E.SafetyAlertStatus }],
    columns: [
      { key: 'userId', label: 'Raised by', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'message', label: 'Message', clip: true },
      { key: 'latitude', label: 'Lat' },
      { key: 'longitude', label: 'Lng' },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
      { key: 'resolvedAt', label: 'Resolved', type: 'datetime' },
    ],
  },
  detailPath: '/safety-alerts/:id',
  detailFields: [
    { key: 'id', label: 'Alert ID', type: 'id' },
    { key: 'userId', label: 'Raised by', type: 'id' },
    { key: 'status', label: 'Status' },
    { key: 'message', label: 'Message' },
    {
      key: 'latitude', label: 'Location',
      render: (a) => (a.latitude && a.longitude
        ? el('a', {
            href: `https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=18/${a.latitude}/${a.longitude}`,
            target: '_blank', rel: 'noopener noreferrer',
            text: `${a.latitude}, ${a.longitude} — open map`,
          })
        : el('span', { class: 'muted', text: 'No coordinates' })),
    },
    { key: 'createdAt', label: 'Raised', type: 'datetime' },
    { key: 'resolvedAt', label: 'Resolved', type: 'datetime' },
    { key: 'resolutionNotes', label: 'Resolution notes' },
  ],
  actions: [
    {
      key: 'resolve', label: 'Resolve', inline: true, glyph: '✓', permission: 'safety_alerts:manage',
      method: 'PATCH', path: '/safety-alerts/:id/resolve',
      fields: [{ name: 'resolutionNotes', label: 'Resolution notes', type: 'textarea', maxLength: 1000 }],
      when: (a) => a.status === 'ACTIVE',
    },
  ],
};

export const tickets = {
  key: 'tickets',
  label: 'Help desk',
  singular: 'Ticket',
  group: 'Health & wellbeing',
  icon: '🎫',
  description: 'Campus support tickets — Wi-Fi, facilities, IT and academic queries.',
  list: {
    path: '/tickets',
    permission: 'tickets:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.TicketStatus },
      { name: 'category', label: 'Category', type: 'enum', options: E.TicketCategory },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.TicketPriority },
    ],
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'category', label: 'Category' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'requesterUserId', label: 'Raised by', type: 'id' },
      { key: 'assignedToUserId', label: 'Assigned to', type: 'id' },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
    ],
  },
  detailPath: '/tickets/:id',
  create: {
    path: '/tickets',
    fields: [
      { name: 'category', label: 'Category', type: 'enum', options: E.TicketCategory, required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true, maxLength: 200 },
      { name: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 2000 },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.TicketPriority },
    ],
  },
  actions: [
    {
      key: 'assign', label: 'Assign', glyph: '👤', permission: 'tickets:manage',
      method: 'PATCH', path: '/tickets/:id/assign',
      fields: [{ name: 'staffUserId', label: 'Staff member', type: 'ref', lookup: 'staff', required: true }],
    },
    {
      key: 'status', label: 'Update status', glyph: '→', permission: 'tickets:manage',
      method: 'PATCH', path: '/tickets/:id/status',
      fields: [
        { name: 'status', label: 'Status', type: 'enum', options: E.TicketStatus, required: true },
        { name: 'resolutionNotes', label: 'Resolution notes', type: 'textarea', maxLength: 2000 },
      ],
    },
  ],
};
