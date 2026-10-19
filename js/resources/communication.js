/** Announcements, worship services and the digital ID desk. */
import { E } from '../enums.js';
import { el, openModal, notify } from '../ui.js';
import { showJoinLink } from './academics.js';

export const announcements = {
  key: 'announcements',
  label: 'Announcements',
  singular: 'Announcement',
  group: 'Communication',
  icon: '📢',
  description: 'Audience-aware notices. A reader only ever sees announcements whose audience matches them, within the publish/expiry window.',
  list: {
    path: '/announcements',
    searchable: true,
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'audienceType', label: 'Audience' },
      { key: 'priority', label: 'Priority' },
      { key: 'publishAt', label: 'Publish', type: 'datetime' },
      { key: 'expiresAt', label: 'Expires', type: 'datetime' },
      { key: 'authorUserId', label: 'Author', type: 'id' },
    ],
  },
  detailPath: '/announcements/:id',
  create: {
    path: '/announcements', permission: 'announcements:create',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { name: 'content', label: 'Content', type: 'textarea', required: true, maxLength: 10000, rows: 8 },
      { name: 'audienceType', label: 'Audience', type: 'enum', options: E.AnnouncementAudienceType, default: 'ALL' },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.AnnouncementPriority, default: 'NORMAL' },
      { name: 'facultyId', label: 'Faculty', type: 'select', lookup: 'faculties', help: 'Only used when the audience is FACULTY.' },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments', help: 'Only used when the audience is DEPARTMENT.' },
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs', help: 'Only used when the audience is PROGRAM.' },
      { name: 'publishAt', label: 'Publish at', type: 'datetime', help: 'Leave blank to publish immediately.' },
      { name: 'expiresAt', label: 'Expires at', type: 'datetime' },
      { name: 'fileAssetIds', label: 'Attachment IDs', type: 'tags', help: 'Upload under Files first, then paste the IDs here.' },
    ],
  },
  update: {
    path: '/announcements/:id', permission: 'announcements:update',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 200 },
      { name: 'content', label: 'Content', type: 'textarea', maxLength: 10000, rows: 8 },
      { name: 'audienceType', label: 'Audience', type: 'enum', options: E.AnnouncementAudienceType },
      { name: 'priority', label: 'Priority', type: 'enum', options: E.AnnouncementPriority },
      { name: 'facultyId', label: 'Faculty', type: 'select', lookup: 'faculties' },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'publishAt', label: 'Publish at', type: 'datetime' },
      { name: 'expiresAt', label: 'Expires at', type: 'datetime' },
    ],
  },
  remove: { path: '/announcements/:id', permission: 'announcements:delete', confirm: 'Delete this announcement?' },
};

export const worshipSessions = {
  key: 'worship-sessions',
  label: 'Worship services',
  singular: 'Service',
  group: 'Communication',
  icon: '⛪',
  description: 'Campus-wide streamed services, open to any signed-in person — no enrolment check. Weekly recurrence is optional.',
  list: {
    path: '/worship-sessions',
    permission: 'worship_sessions:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.LiveSessionStatus },
      { name: 'upcoming', label: 'Upcoming only', type: 'enum', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'scheduledStartAt', label: 'Starts', type: 'datetime' },
      { key: 'scheduledEndAt', label: 'Ends', type: 'datetime' },
      { key: 'status', label: 'Status' },
      { key: 'isRecurring', label: 'Recurring' },
      { key: 'recurrenceDayOfWeek', label: 'Weekly on' },
    ],
  },
  detailPath: '/worship-sessions/:id',
  create: {
    path: '/worship-sessions', permission: 'worship_sessions:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'scheduledStartAt', label: 'Starts', type: 'datetime', required: true },
      { name: 'scheduledEndAt', label: 'Ends', type: 'datetime', required: true },
      { name: 'isRecurring', label: 'Repeats weekly', type: 'checkbox' },
      { name: 'recurrenceDayOfWeek', label: 'Day of week', type: 'enum', options: E.DayOfWeek },
    ],
  },
  update: {
    path: '/worship-sessions/:id', permission: 'worship_sessions:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 200 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'scheduledStartAt', label: 'Starts', type: 'datetime' },
      { name: 'scheduledEndAt', label: 'Ends', type: 'datetime' },
      { name: 'isRecurring', label: 'Repeats weekly', type: 'checkbox' },
      { name: 'recurrenceDayOfWeek', label: 'Day of week', type: 'enum', options: E.DayOfWeek },
      { name: 'status', label: 'Status', type: 'enum', options: E.LiveSessionStatus },
    ],
  },
  actions: [
    { key: 'start', label: 'Start', glyph: '▶', method: 'PATCH', path: '/worship-sessions/:id/start', permission: 'worship_sessions:manage', when: (s) => s.status === 'SCHEDULED' },
    { key: 'end', label: 'End', glyph: '■', variant: 'danger', method: 'PATCH', path: '/worship-sessions/:id/end', permission: 'worship_sessions:manage', when: (s) => s.status === 'LIVE' },
    { key: 'join', label: 'Get join link', glyph: '🔗', method: 'POST', path: '/worship-sessions/:id/join', onResult: (r) => showJoinLink(r) },
  ],
  related: [
    {
      key: 'attendance', label: 'Attendance', path: '/worship-sessions/:id/attendance',
      columns: [
        { key: 'userId', label: 'User', type: 'id' },
        { key: 'joinedAt', label: 'Joined', type: 'datetime' },
        { key: 'leftAt', label: 'Left', type: 'datetime' },
      ],
      emptyMessage: 'Nobody has joined',
    },
  ],
};
