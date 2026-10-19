/** The organisation hierarchy: faculties → departments → programmes. */
import { E } from '../enums.js';

export const faculties = {
  key: 'faculties',
  label: 'Faculties',
  singular: 'Faculty',
  group: 'Organisation',
  icon: '🏛',
  description: 'Top of the academic hierarchy. A faculty with live departments cannot be deleted.',
  list: {
    path: '/faculties',
    paginated: false,
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description', clip: true },
      { key: 'deanUserId', label: 'Dean', type: 'id' },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/faculties/:id',
  create: {
    path: '/faculties', permission: 'faculties:create',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', required: true, maxLength: 20 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'deanUserId', label: 'Dean', type: 'ref', lookup: 'staff' },
    ],
  },
  update: {
    path: '/faculties/:id', permission: 'faculties:update',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', maxLength: 20 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'deanUserId', label: 'Dean', type: 'ref', lookup: 'staff' },
    ],
  },
  remove: { path: '/faculties/:id', permission: 'faculties:delete', confirm: 'Delete this faculty? Rejected if it still has departments.' },
  related: [
    {
      key: 'departments', label: 'Departments', path: '/departments', query: { },
      mapRows: (rows, faculty) => rows.filter((d) => d.facultyId === faculty.id),
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'headOfDepartmentUserId', label: 'Head', type: 'id' },
      ],
      emptyMessage: 'No departments in this faculty',
    },
  ],
};

export const departments = {
  key: 'departments',
  label: 'Departments',
  singular: 'Department',
  group: 'Organisation',
  icon: '🏢',
  description: 'A department owns programmes and backs the department-restricted chat channel.',
  list: {
    path: '/departments',
    paginated: false,
    filters: [{ name: 'facultyId', label: 'Faculty', type: 'select', lookup: 'faculties' }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'facultyId', label: 'Faculty', type: 'id' },
      { key: 'headOfDepartmentUserId', label: 'Head of dept.', type: 'id' },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/departments/:id',
  create: {
    path: '/departments', permission: 'departments:create',
    fields: [
      { name: 'facultyId', label: 'Faculty', type: 'select', lookup: 'faculties', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', required: true, maxLength: 20 },
      { name: 'headOfDepartmentUserId', label: 'Head of department', type: 'ref', lookup: 'staff' },
    ],
  },
  update: {
    path: '/departments/:id', permission: 'departments:update',
    fields: [
      { name: 'facultyId', label: 'Faculty', type: 'select', lookup: 'faculties' },
      { name: 'name', label: 'Name', type: 'text', maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', maxLength: 20 },
      { name: 'headOfDepartmentUserId', label: 'Head of department', type: 'ref', lookup: 'staff' },
    ],
  },
  remove: { path: '/departments/:id', permission: 'departments:delete', confirm: 'Delete this department? Rejected if it still has programmes.' },
  related: [
    {
      key: 'programs', label: 'Programmes', path: '/programs',
      mapRows: (rows, dept) => rows.filter((p) => p.departmentId === dept.id),
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
        { key: 'level', label: 'Level' },
        { key: 'durationYears', label: 'Years' },
      ],
      emptyMessage: 'No programmes in this department',
    },
    {
      key: 'channel-members', label: 'Channel members', path: '/department-channels/:id/members',
      columns: [
        { key: 'userId', label: 'User', type: 'id' },
        { key: 'role', label: 'Role' },
        { key: 'joinedAt', label: 'Joined', type: 'datetime' },
      ],
      remove: {
        path: '/department-channels/:id/members/:childId', childIdKey: 'userId',
        permission: 'department_channels:manage',
        confirm: 'Revoke this person’s access to the department channel now?',
      },
      emptyMessage: 'The channel has no members yet (it is provisioned on first visit)',
    },
  ],
};

export const programs = {
  key: 'programs',
  label: 'Programmes',
  singular: 'Programme',
  group: 'Organisation',
  icon: '🎓',
  description: 'Degree programmes students enrol into. Courses hang off a programme.',
  list: {
    path: '/programs',
    paginated: false,
    filters: [{ name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'level', label: 'Level' },
      { key: 'durationYears', label: 'Years' },
      { key: 'departmentId', label: 'Department', type: 'id' },
    ],
  },
  detailPath: '/programs/:id',
  create: {
    path: '/programs', permission: 'programs:create',
    fields: [
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', required: true, maxLength: 20 },
      { name: 'level', label: 'Level', type: 'enum', options: E.ProgramLevel, required: true },
      { name: 'durationYears', label: 'Duration (years)', type: 'integer', required: true, min: 1, max: 8 },
    ],
  },
  update: {
    path: '/programs/:id', permission: 'programs:update',
    fields: [
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'name', label: 'Name', type: 'text', maxLength: 150 },
      { name: 'code', label: 'Code', type: 'text', maxLength: 20 },
      { name: 'level', label: 'Level', type: 'enum', options: E.ProgramLevel },
      { name: 'durationYears', label: 'Duration (years)', type: 'integer', min: 1, max: 8 },
    ],
  },
  remove: { path: '/programs/:id', permission: 'programs:delete', confirm: 'Delete this programme?' },
  related: [
    {
      key: 'courses', label: 'Courses', path: '/courses', query: { limit: 100 },
      mapRows: (rows, program) => rows.filter((c) => c.programId === program.id),
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'title', label: 'Title' },
        { key: 'creditUnits', label: 'CU' },
      ],
      emptyMessage: 'No courses in this programme',
    },
  ],
};
