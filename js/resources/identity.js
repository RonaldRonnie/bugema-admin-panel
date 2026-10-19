/** Identity & access: users, roles, permissions. */
import { E } from '../enums.js';
import { el, badge } from '../ui.js';
import { personName, fmtDateTime, renderValue } from '../format.js';

const nameCol = {
  key: 'firstName', label: 'Name',
  render: (u) => el('div', {}, [
    el('div', { style: { fontWeight: '550' }, text: personName(u) }),
    el('div', { class: 'card-sub', text: u.email || '' }),
  ]),
};

const rolesCol = {
  key: 'roles', label: 'Roles',
  render: (u) => el('div', { class: 'row', style: { gap: '4px' } },
    (u.roles || []).length ? u.roles.map((r) => badge(r, r === 'SUPER_ADMIN' ? 'accent' : '')) : [el('span', { class: 'muted', text: '—' })]),
};

export const users = {
  key: 'users',
  label: 'Users',
  singular: 'User',
  group: 'Identity & access',
  icon: '👤',
  description: 'Every student and staff account, their status, and the roles that grant them access.',
  list: {
    path: '/users',
    permission: 'users:read',
    searchable: true,
    filters: [
      { name: 'type', label: 'Type', type: 'enum', options: E.UserType },
      { name: 'status', label: 'Status', type: 'enum', options: E.AccountStatus },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'roleName', label: 'Role', type: 'text', placeholder: 'e.g. LECTURER' },
    ],
    columns: [
      nameCol,
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      rolesCol,
      { key: 'lastLoginAt', label: 'Last login', type: 'datetime' },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/users/:id',
  rowTitle: (u) => personName(u),
  detailFields: [
    { key: 'id', label: 'User ID', type: 'id' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'firstName', label: 'First name' },
    { key: 'middleName', label: 'Middle name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'roles', label: 'Roles' },
    { key: 'departmentId', label: 'Department', type: 'id' },
    { key: 'programId', label: 'Programme', type: 'id' },
    { key: 'emailVerifiedAt', label: 'Email verified', type: 'datetime' },
    { key: 'lastLoginAt', label: 'Last login', type: 'datetime' },
    { key: 'createdAt', label: 'Created', type: 'datetime' },
    {
      key: 'studentProfile', label: 'Student profile',
      render: (u) => (u.studentProfile
        ? el('div', {}, [
            el('div', { text: `Reg. ${u.studentProfile.registrationNumber ?? '—'}` }),
            el('div', { class: 'card-sub', text: `Year ${u.studentProfile.yearOfStudy ?? '—'} · ${u.studentProfile.verificationStatus ?? ''}` }),
          ])
        : el('span', { class: 'muted', text: '—' })),
    },
    {
      key: 'staffProfile', label: 'Staff profile',
      render: (u) => (u.staffProfile
        ? el('div', {}, [
            el('div', { text: `Staff no. ${u.staffProfile.staffNumber ?? '—'}` }),
            el('div', { class: 'card-sub', text: [u.staffProfile.jobTitle, u.staffProfile.employmentType].filter(Boolean).join(' · ') }),
          ])
        : el('span', { class: 'muted', text: '—' })),
    },
  ],
  create: {
    path: '/users',
    permission: 'users:create',
    title: 'Provision an account',
    subtitle: 'The API generates a temporary password and emails it to the new account.',
    fields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'type', label: 'Account type', type: 'enum', options: E.UserType, required: true, default: 'STUDENT' },
      { name: 'firstName', label: 'First name', type: 'text', required: true, maxLength: 100 },
      { name: 'lastName', label: 'Last name', type: 'text', required: true, maxLength: 100 },
      { name: 'middleName', label: 'Middle name', type: 'text', maxLength: 100 },
      { name: 'registrationNumber', label: 'Registration number', type: 'text', maxLength: 50, help: 'Required for STUDENT accounts.' },
      { name: 'staffNumber', label: 'Staff number', type: 'text', maxLength: 50, help: 'Required for STAFF accounts.' },
      { name: 'employmentType', label: 'Employment type', type: 'enum', options: E.EmploymentType },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'roleIds', label: 'Roles', type: 'refs', lookup: 'roles', help: 'Assigning a role here takes effect immediately.' },
    ],
    successMessage: 'Account created. A temporary password has been emailed.',
  },
  update: {
    path: '/users/:id',
    permission: 'users:update',
    fields: [
      { name: 'firstName', label: 'First name', type: 'text', maxLength: 100 },
      { name: 'lastName', label: 'Last name', type: 'text', maxLength: 100 },
      { name: 'middleName', label: 'Middle name', type: 'text', maxLength: 100 },
      { name: 'phone', label: 'Phone', type: 'text', maxLength: 30 },
      { name: 'avatarUrl', label: 'Avatar URL', type: 'text' },
      { name: 'departmentId', label: 'Department', type: 'select', lookup: 'departments' },
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
    ],
  },
  remove: {
    path: '/users/:id',
    permission: 'users:delete',
    confirm: 'Soft-delete this account? The row is retained for audit but the person can no longer sign in.',
  },
  actions: [
    {
      key: 'status', label: 'Change status', glyph: '◉', permission: 'users:manage_status',
      method: 'PATCH', path: '/users/:id/status',
      title: 'Change account status',
      subtitle: 'Leaving ACTIVE revokes every session this person holds.',
      fields: [
        { name: 'status', label: 'New status', type: 'enum', options: E.AccountStatus, required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', required: true, maxLength: 500, help: 'Recorded in the audit log. 3 characters minimum.' },
      ],
      initial: (u) => ({ status: u.status }),
    },
    {
      key: 'assign-role', label: 'Assign role', glyph: '🔑', permission: 'users:manage_roles',
      method: 'POST', path: '/users/:id/roles',
      fields: [{ name: 'roleId', label: 'Role', type: 'select', lookup: 'roles', required: true }],
      successMessage: 'Role assigned. The user’s sessions were revoked so the change applies at once.',
    },
  ],
  related: [
    {
      key: 'roles', label: 'Roles', path: '/roles',
      mapRows: (roles, user) => roles.filter((r) => (user.roles || []).includes(r.name)),
      columns: [
        { key: 'name', label: 'Role', type: 'text' },
        { key: 'description', label: 'Description', clip: true },
        { key: 'isSystemRole', label: 'System' },
      ],
      create: {
        label: 'Assign role', permission: 'users:manage_roles', path: '/users/:id/roles',
        fields: [{ name: 'roleId', label: 'Role', type: 'select', lookup: 'roles', required: true }],
      },
      remove: { path: '/users/:id/roles/:childId', permission: 'users:manage_roles', confirm: 'Remove this role? The user’s sessions are revoked.' },
      emptyMessage: 'No roles assigned',
    },
  ],
};

export const roles = {
  key: 'roles',
  label: 'Roles',
  singular: 'Role',
  group: 'Identity & access',
  icon: '🔑',
  description: 'Roles bundle permissions. Permission checks hit the database on every request, so a change here applies on the caller’s next request.',
  list: {
    path: '/roles',
    permission: 'roles:read',
    paginated: false,
    columns: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', clip: true },
      { key: 'isSystemRole', label: 'System role' },
      { key: 'permissions', label: 'Permissions', render: (r) => String((r.permissions || []).length) },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/roles/:id',
  detailFields: [
    { key: 'id', label: 'ID', type: 'id' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'description', label: 'Description' },
    { key: 'isSystemRole', label: 'System role' },
    { key: 'createdAt', label: 'Created', type: 'datetime' },
  ],
  create: {
    path: '/roles', permission: 'roles:create',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 50, placeholder: 'e.g. REGISTRAR' },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
      { name: 'permissionIds', label: 'Permissions', type: 'refs', lookup: 'permissions' },
    ],
  },
  update: {
    path: '/roles/:id', permission: 'roles:update',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 50 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    ],
  },
  remove: {
    path: '/roles/:id', permission: 'roles:delete',
    when: (r) => !r.isSystemRole,
    confirm: 'Delete this role? Users holding it lose the permissions it granted.',
  },
  related: [
    {
      key: 'permissions', label: 'Permissions',
      from: (role) => (role.permissions || []).map((rp) => rp.permission ?? rp),
      columns: [
        { key: 'name', label: 'Permission', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'description', label: 'Description', clip: true },
      ],
      create: {
        label: 'Grant permission', permission: 'roles:manage_permissions', path: '/roles/:id/permissions',
        fields: [{ name: 'permissionId', label: 'Permission', type: 'select', lookup: 'permissions', required: true }],
      },
      remove: { path: '/roles/:id/permissions/:childId', permission: 'roles:manage_permissions', confirm: 'Revoke this permission from the role?' },
      emptyMessage: 'This role grants nothing yet',
    },
  ],
};

export const permissions = {
  key: 'permissions',
  label: 'Permissions',
  singular: 'Permission',
  group: 'Identity & access',
  icon: '🧩',
  description: 'The full permission catalogue. Creating one requires the SUPER_ADMIN role; a new permission grants nothing until a role includes it.',
  list: {
    path: '/permissions',
    paginated: false,
    columns: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'description', label: 'Description', clip: true },
    ],
  },
  detailPath: '/permissions/:id',
  create: {
    path: '/permissions',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 100, placeholder: 'resource:action' },
      { name: 'category', label: 'Category', type: 'text', required: true, maxLength: 50 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    ],
    subtitle: 'Format is "<resource>:<action>", matching the API’s own constants.',
  },
};
