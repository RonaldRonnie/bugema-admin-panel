/** Student life: clubs, events (and the hotseat), alumni, the jobs board. */
import { E } from '../enums.js';
import { el, badge } from '../ui.js';

export const clubs = {
  key: 'clubs',
  label: 'Clubs',
  singular: 'Club',
  group: 'Student life',
  icon: '🎭',
  description: 'Student societies. A club’s PRESIDENT or OFFICER can run its events without needing the events:manage permission.',
  list: {
    path: '/clubs',
    searchable: true,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description', clip: true },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/clubs/:id',
  create: {
    path: '/clubs', permission: 'clubs:manage',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150 },
      { name: 'category', label: 'Category', type: 'text', maxLength: 100 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },
  update: {
    path: '/clubs/:id', permission: 'clubs:manage',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 150 },
      { name: 'category', label: 'Category', type: 'text', maxLength: 100 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
    ],
  },
  remove: { path: '/clubs/:id', permission: 'clubs:manage', confirm: 'Delete this club?' },
  related: [
    {
      key: 'members', label: 'Members', path: '/clubs/:id/members',
      columns: [
        { key: 'userId', label: 'Member', type: 'id' },
        { key: 'role', label: 'Role' },
        { key: 'joinedAt', label: 'Joined', type: 'datetime' },
      ],
      childIdKey: 'userId',
      create: {
        label: 'Add member', permission: 'clubs:manage', path: '/clubs/:id/members',
        fields: [
          { name: 'userId', label: 'Member', type: 'ref', lookup: 'users', required: true },
          { name: 'role', label: 'Role', type: 'enum', options: E.ClubMembershipRole, default: 'MEMBER' },
        ],
      },
      actions: [
        { label: 'Make officer', method: 'PATCH', path: '/clubs/:id/members/:childId/role', permission: 'clubs:manage', body: () => ({ role: 'OFFICER' }), when: (m) => m.role !== 'OFFICER' },
        { label: 'Make president', method: 'PATCH', path: '/clubs/:id/members/:childId/role', permission: 'clubs:manage', body: () => ({ role: 'PRESIDENT' }), when: (m) => m.role !== 'PRESIDENT' },
      ],
      remove: { path: '/clubs/:id/members/:childId', confirm: 'Remove this member from the club?' },
      emptyMessage: 'No members yet',
    },
  ],
};

export const events = {
  key: 'events',
  label: 'Events',
  singular: 'Event',
  group: 'Student life',
  icon: '🎪',
  description: 'Campus events with optional capacity. Registration enforces capacity under Serializable isolation, so a full event returns 409 rather than silently overbooking.',
  list: {
    path: '/events',
    filters: [
      { name: 'clubId', label: 'Club', type: 'select', lookup: 'clubs' },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'upcoming', label: 'Upcoming only', type: 'enum', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    ],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'startAt', label: 'Starts', type: 'datetime' },
      { key: 'endAt', label: 'Ends', type: 'datetime' },
      { key: 'location', label: 'Location' },
      { key: 'capacity', label: 'Capacity' },
      {
        key: 'interactionMode', label: 'Mode',
        render: (e) => (e.interactionMode === 'HOTSEAT' ? badge('Hotseat', 'accent') : badge('None')),
      },
    ],
  },
  detailPath: '/events/:id',
  create: {
    path: '/events', permission: 'events:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'clubId', label: 'Hosting club', type: 'select', lookup: 'clubs' },
      { name: 'departmentId', label: 'Hosting department', type: 'select', lookup: 'departments' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'startAt', label: 'Starts', type: 'datetime', required: true },
      { name: 'endAt', label: 'Ends', type: 'datetime', required: true },
      { name: 'capacity', label: 'Capacity', type: 'integer', min: 1, help: 'Leave blank for unlimited.' },
      { name: 'interactionMode', label: 'Interaction mode', type: 'enum', options: E.EventInteractionMode, help: 'HOTSEAT enables the audience Q&A mixer.' },
    ],
  },
  update: {
    path: '/events/:id', permission: 'events:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'clubId', label: 'Hosting club', type: 'select', lookup: 'clubs' },
      { name: 'departmentId', label: 'Hosting department', type: 'select', lookup: 'departments' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'startAt', label: 'Starts', type: 'datetime' },
      { name: 'endAt', label: 'Ends', type: 'datetime' },
      { name: 'capacity', label: 'Capacity', type: 'integer', min: 1 },
      { name: 'interactionMode', label: 'Interaction mode', type: 'enum', options: E.EventInteractionMode },
    ],
  },
  remove: { path: '/events/:id', permission: 'events:manage', confirm: 'Delete this event? Registrations go with it.' },
  actions: [
    { key: 'register', label: 'Register me', glyph: '✋', method: 'POST', path: '/events/:id/register', fields: [] },
    { key: 'unregister', label: 'Cancel my registration', variant: 'danger', method: 'DELETE', path: '/events/:id/register', confirm: 'Cancel your own registration for this event?' },
  ],
  related: [
    {
      key: 'hotseat', label: 'Hotseat Q&A', path: '/events/:id/hotseat/questions',
      when: (e) => e.interactionMode === 'HOTSEAT',
      columns: [
        { key: 'content', label: 'Question', clip: true },
        { key: 'upvoteCount', label: 'Upvotes' },
        { key: 'isAnswered', label: 'Answered' },
        { key: 'createdAt', label: 'Asked', type: 'datetime' },
      ],
      create: {
        label: 'Ask', path: '/events/:id/hotseat/questions',
        fields: [{ name: 'content', label: 'Question', type: 'textarea', required: true }],
      },
      actions: [
        { label: 'Upvote', method: 'POST', path: '/events/:id/hotseat/questions/:childId/upvote' },
        { label: 'Mark answered', method: 'PATCH', path: '/events/:id/hotseat/questions/:childId/answered', permission: 'events:manage', body: () => ({ isAnswered: true }), when: (q) => !q.isAnswered },
      ],
      remove: { path: '/events/:id/hotseat/questions/:childId', permission: 'events:manage', confirm: 'Delete this question?' },
      emptyMessage: 'No questions yet',
    },
  ],
};

export const alumni = {
  key: 'alumni',
  label: 'Alumni',
  singular: 'Alumnus',
  group: 'Student life',
  icon: '🎓',
  description: 'Graduate profiles. Only profiles the alumnus marked public appear in the public directory.',
  list: {
    path: '/alumni',
    filters: [
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'graduationYear', label: 'Graduation year', type: 'integer', min: 1960 },
    ],
    columns: [
      { key: 'userId', label: 'User', type: 'id' },
      { key: 'graduationYear', label: 'Graduated' },
      { key: 'programId', label: 'Programme', type: 'id' },
      { key: 'currentEmployer', label: 'Employer' },
      { key: 'currentPosition', label: 'Position' },
      { key: 'isPublic', label: 'Public' },
    ],
  },
  idKey: 'userId',
  detail: false,
  remove: {
    path: '/alumni/:userId', permission: 'alumni:manage',
    confirm: 'Delete this alumni profile?',
  },
};

export const jobs = {
  key: 'jobs',
  label: 'Jobs board',
  singular: 'Job posting',
  group: 'Student life',
  icon: '💼',
  description: 'Vacancies posted to students and alumni, with the application pipeline behind each one.',
  list: {
    path: '/jobs',
    filters: [
      { name: 'type', label: 'Type', type: 'enum', options: E.JobType },
      { name: 'status', label: 'Status', type: 'enum', options: E.JobPostingStatus },
    ],
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'company', label: 'Company' },
      { key: 'location', label: 'Location' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'applicationDeadline', label: 'Deadline', type: 'date' },
    ],
  },
  detailPath: '/jobs/:id',
  create: {
    path: '/jobs', permission: 'jobs:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { name: 'company', label: 'Company', type: 'text', required: true, maxLength: 200 },
      { name: 'location', label: 'Location', type: 'text', maxLength: 200 },
      { name: 'type', label: 'Type', type: 'enum', options: E.JobType, required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 5000, rows: 7 },
      { name: 'applicationDeadline', label: 'Application deadline', type: 'datetime' },
    ],
  },
  update: {
    path: '/jobs/:id', permission: 'jobs:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 200 },
      { name: 'company', label: 'Company', type: 'text', maxLength: 200 },
      { name: 'location', label: 'Location', type: 'text', maxLength: 200 },
      { name: 'type', label: 'Type', type: 'enum', options: E.JobType },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 5000, rows: 7 },
      { name: 'applicationDeadline', label: 'Application deadline', type: 'datetime' },
      { name: 'status', label: 'Status', type: 'enum', options: E.JobPostingStatus },
    ],
  },
  remove: { path: '/jobs/:id', permission: 'jobs:manage', confirm: 'Delete this posting?' },
  related: [
    {
      key: 'applications', label: 'Applications', path: '/jobs/:id/applications',
      columns: [
        { key: 'applicantUserId', label: 'Applicant', type: 'id' },
        { key: 'status', label: 'Status' },
        { key: 'coverLetter', label: 'Cover letter', clip: true },
        { key: 'createdAt', label: 'Applied', type: 'datetime' },
      ],
      actions: [
        { label: 'Shortlist', method: 'PATCH', path: '/jobs/applications/:childId/status', permission: 'jobs:manage', body: () => ({ status: 'SHORTLISTED' }), when: (a) => a.status !== 'SHORTLISTED' },
        { label: 'Reject', variant: 'danger', method: 'PATCH', path: '/jobs/applications/:childId/status', permission: 'jobs:manage', body: () => ({ status: 'REJECTED' }), when: (a) => a.status !== 'REJECTED' },
        { label: 'Accept', method: 'PATCH', path: '/jobs/applications/:childId/status', permission: 'jobs:manage', body: () => ({ status: 'ACCEPTED' }), when: (a) => a.status !== 'ACCEPTED' },
      ],
      emptyMessage: 'No applications yet',
    },
  ],
};
