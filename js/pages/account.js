/** Your own account: profile, sessions/devices, password and MFA. */
import { api } from '../api.js';
import { el, button, badge, skeleton, emptyState, errorState, notify, confirmDialog, openModal } from '../ui.js';
import { buildForm, openFormModal } from '../fields.js';
import { fmtDateTime, personName } from '../format.js';
import { state, loadSession, clearSession } from '../store.js';

export function renderAccount(container) {
  container.replaceChildren();
  const profileSlot = el('div', {});
  const sessionSlot = el('div', {});
  const mfaSlot = el('div', {});

  container.append(
    el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, [el('h2', { text: 'My profile' }), el('div', { class: 'spacer' }),
        button('Refresh', { small: true, glyph: '↻', onClick: () => loadProfile() })]),
      profileSlot,
    ]),
    el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, [
        el('div', {}, [
          el('h2', { text: 'Security' }),
          el('div', { class: 'card-sub', text: 'Changing your password revokes every session you hold, including this one.' }),
        ]),
      ]),
      mfaSlot,
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('div', {}, [
          el('h2', { text: 'Active sessions' }),
          el('div', { class: 'card-sub', text: 'Each row is one device holding a refresh-token family. Revoking one takes effect immediately.' }),
        ]),
        el('div', { class: 'spacer' }),
        button('Sign out everywhere', {
          small: true, variant: 'danger',
          onClick: () => confirmDialog({
            title: 'Sign out everywhere',
            message: 'Revoke every session for your account, including this browser?',
            confirmLabel: 'Sign out everywhere',
            onConfirm: async () => { await api.post('/auth/logout-all', {}); clearSession(); window.location.hash = '#/'; window.location.reload(); },
          }),
        }),
        button('Refresh', { small: true, glyph: '↻', onClick: () => loadSessions() }),
      ]),
      sessionSlot,
    ]),
  );

  async function loadProfile() {
    profileSlot.replaceChildren(skeleton(4));
    try {
      const me = await api.get('/auth/me');
      profileSlot.replaceChildren(el('div', { class: 'card-body' }, [
        el('dl', { class: 'kv' }, [
          el('dt', { text: 'Name' }), el('dd', { text: personName(me) }),
          el('dt', { text: 'Email' }), el('dd', { text: me.email }),
          el('dt', { text: 'Phone' }), el('dd', { text: me.phone || '—' }),
          el('dt', { text: 'User ID' }), el('dd', { class: 'mono', text: me.id }),
          el('dt', { text: 'Type' }), el('dd', {}, badge(me.type)),
          el('dt', { text: 'Status' }), el('dd', {}, badge(me.status, me.status === 'ACTIVE' ? 'ok' : 'warn')),
          el('dt', { text: 'Roles' }), el('dd', { class: 'row' }, (me.roles || []).map((r) => badge(r, r === 'SUPER_ADMIN' ? 'accent' : ''))),
          el('dt', { text: 'Permissions in effect' }), el('dd', {
            text: state.permissionsKnown ? String(state.permissions?.size ?? 0) : 'unknown — your account cannot read /roles',
          }),
          el('dt', { text: 'Email verified' }), el('dd', { text: fmtDateTime(me.emailVerifiedAt) }),
          el('dt', { text: 'Last sign-in' }), el('dd', { text: fmtDateTime(me.lastLoginAt) }),
        ]),
        el('div', { class: 'row mt-16' }, [
          button('Edit my details', {
            onClick: async () => {
              const done = await openFormModal({
                title: 'Edit my details',
                fields: [
                  { name: 'firstName', label: 'First name', type: 'text', maxLength: 100 },
                  { name: 'lastName', label: 'Last name', type: 'text', maxLength: 100 },
                  { name: 'middleName', label: 'Middle name', type: 'text', maxLength: 100 },
                  { name: 'phone', label: 'Phone', type: 'text', maxLength: 30 },
                  { name: 'avatarUrl', label: 'Avatar URL', type: 'text' },
                ],
                values: me,
                onSubmit: (bodyValues) => api.patch(`/users/${me.id}`, bodyValues),
              });
              if (done) { notify.ok('Profile updated.'); await loadSession(); loadProfile(); }
            },
          }),
        ]),
      ]));
    } catch (err) {
      profileSlot.replaceChildren(errorState(err, loadProfile));
    }
  }

  async function loadSessions() {
    sessionSlot.replaceChildren(skeleton(3));
    try {
      const { items } = await api.list('/auth/sessions');
      if (!items.length) { sessionSlot.replaceChildren(emptyState('No active sessions')); return; }
      sessionSlot.replaceChildren(el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [
        el('thead', {}, el('tr', {}, ['Device', 'IP address', 'Created', 'Expires', ''].map((h) => el('th', { text: h })))),
        el('tbody', {}, items.map((s) => el('tr', {}, [
          el('td', { class: 'clip', text: s.userAgent || 'Unknown device' }),
          el('td', { class: 'mono', text: s.ipAddress || '—' }),
          el('td', { class: 'nowrap', text: fmtDateTime(s.createdAt) }),
          el('td', { class: 'nowrap', text: fmtDateTime(s.expiresAt) }),
          el('td', { class: 'actions' }, button('Revoke', {
            small: true, variant: 'danger',
            onClick: () => confirmDialog({
              title: 'Revoke session',
              message: 'Sign this device out now?',
              onConfirm: async () => { await api.del(`/auth/sessions/${s.id}`); notify.ok('Session revoked.'); loadSessions(); },
            }),
          })),
        ]))),
      ])));
    } catch (err) {
      sessionSlot.replaceChildren(errorState(err, loadSessions));
    }
  }

  function paintSecurity() {
    mfaSlot.replaceChildren(el('div', { class: 'card-body row' }, [
      button('Change password', {
        onClick: async () => {
          const done = await openFormModal({
            title: 'Change password',
            subtitle: 'At least 8 characters, with upper and lower case, a digit and a symbol. All your sessions are revoked on success.',
            columns: 1,
            fields: [
              { name: 'currentPassword', label: 'Current password', type: 'password', required: true },
              { name: 'newPassword', label: 'New password', type: 'password', required: true },
            ],
            onSubmit: (b) => api.patch('/auth/change-password', b),
          });
          if (done) {
            notify.ok('Password changed. Signing you out…');
            setTimeout(() => { clearSession(); window.location.reload(); }, 1400);
          }
        },
      }),
      button('Enrol in MFA', { glyph: '🔐', onClick: enrollMfa }),
      button('Disable MFA', {
        variant: 'danger',
        onClick: async () => {
          const done = await openFormModal({
            title: 'Disable MFA',
            subtitle: 'Both your password and a current code are required.',
            columns: 1,
            fields: [
              { name: 'password', label: 'Password', type: 'password', required: true },
              { name: 'code', label: 'Authenticator code', type: 'text', required: true, placeholder: '123456' },
            ],
            onSubmit: (b) => api.post('/auth/mfa/disable', b),
          });
          if (done) notify.ok('MFA disabled.');
        },
      }),
    ]));
  }

  async function enrollMfa() {
    let enrolment;
    try { enrolment = await api.post('/auth/mfa/enroll', {}); }
    catch (err) { notify.error(err); return; }

    const qr = enrolment.qrCodeDataUrl || enrolment.qrCode || enrolment.qrcode;
    const secret = enrolment.secret || enrolment.base32 || '';

    openModal({
      title: 'Enrol in multi-factor authentication',
      subtitle: 'Scan the code, then confirm with the first real code your app shows. MFA is not on until you confirm.',
      render: (close) => {
        const codeInput = el('input', { type: 'text', placeholder: '123456', maxlength: '6', class: 'mono' });
        return el('div', {}, [
          qr ? el('div', { style: { textAlign: 'center', marginBottom: '14px' } },
            el('img', { src: qr, alt: 'MFA QR code', style: { width: '190px', background: '#fff', padding: '8px', borderRadius: '8px' } })) : null,
          secret ? el('div', { class: 'field' }, [
            el('label', { text: 'Or enter this secret manually' }),
            el('input', { type: 'text', value: secret, readonly: true, class: 'mono', onFocus: (e) => e.target.select() }),
          ]) : null,
          el('div', { class: 'field' }, [el('label', { text: 'Code from your authenticator' }), codeInput]),
          button('Confirm and turn MFA on', {
            variant: 'primary', block: true,
            onClick: async () => {
              try {
                await api.post('/auth/mfa/verify-enrollment', { code: codeInput.value.trim() });
                notify.ok('MFA is now on for your account.');
                close();
              } catch (err) { notify.error(err); }
            },
          }),
        ]);
      },
      footer: () => [],
    });
  }

  loadProfile();
  loadSessions();
  paintSecurity();
}
