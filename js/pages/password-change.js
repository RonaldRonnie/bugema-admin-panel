/**
 * The screen an account lands on while it still has the password an
 * administrator gave it. The API refuses everything else with
 * 403 PASSWORD_CHANGE_REQUIRED until this succeeds, so there is nothing to
 * show behind it — only this, and a way to sign out.
 *
 * A successful change signs out every session, this one included (the API
 * does that on any password change), so the last step is the sign-in screen.
 */
import { api } from '../api.js';
import { el, button, notify } from '../ui.js';
import { personName } from '../format.js';

const CFG = window.BU_ADMIN_CONFIG || {};
const PASSWORD_RULE = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/**
 * @param {HTMLElement} root
 * @param {object} opt
 * @param {object} [opt.user]     the signed-in PublicUser, for the greeting
 * @param {() => void} opt.onChanged   password changed; the session is gone
 * @param {() => void} opt.onSignOut
 */
export function renderPasswordChange(root, { user, onChanged, onSignOut }) {
  root.className = '';
  root.replaceChildren();

  const current = el('input', { type: 'password', autocomplete: 'current-password' });
  const next = el('input', { type: 'password', autocomplete: 'new-password' });
  const confirm = el('input', { type: 'password', autocomplete: 'new-password' });
  const submit = button('Set my password', { variant: 'primary', block: true, onClick: () => go() });

  const go = async () => {
    const problem = !current.value || !next.value
      ? 'Fill in the password you were given and a new one.'
      : next.value !== confirm.value
        ? 'The new password and its confirmation do not match.'
        : next.value.length < 8 || !PASSWORD_RULE.test(next.value)
          ? 'Use at least 8 characters, with an upper-case letter, a lower-case letter and a number.'
          : next.value === current.value
            ? 'Choose a password that differs from the one you were given.'
            : null;
    if (problem) { notify.error(new Error(problem), 'Set your password'); return; }

    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      await api.patch('/auth/change-password', { currentPassword: current.value, newPassword: next.value });
      notify.ok('Password set. Sign in with your new password.', 'Done');
      onChanged();
    } catch (err) {
      notify.error(err, 'Could not set your password');
      submit.disabled = false;
      submit.textContent = 'Set my password';
    }
  };

  for (const input of [current, next, confirm]) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  const greeting = user?.firstName ? `Welcome, ${personName(user)}.` : 'Welcome.';
  root.append(el('div', { class: 'auth-wrap' }, el('div', { class: 'auth-card' }, [
    el('div', { class: 'brand' }, [
      el('div', { class: 'brand-mark', text: 'BU' }),
      el('div', { class: 'brand-text' }, [
        el('div', { class: 'brand-title', text: CFG.institution || 'Digital Campus' }),
        el('div', { class: 'brand-sub', text: 'Admin console' }),
      ]),
    ]),
    el('h1', { text: 'Choose your password' }),
    el('p', {
      class: 'lead',
      text: `${greeting} Your account was set up with a password someone else gave you. ` +
        'Replace it with one only you know before you continue.',
    }),
    el('div', { class: 'field' }, [el('label', { text: 'Password you were given' }), current]),
    el('div', { class: 'field' }, [
      el('label', { text: 'New password' }), next,
      el('div', { class: 'help', text: 'At least 8 characters, with an upper-case letter, a lower-case letter and a number.' }),
    ]),
    el('div', { class: 'field' }, [el('label', { text: 'New password again' }), confirm]),
    submit,
    el('div', { class: 'auth-foot' }, el('a', {
      href: '#', text: 'Sign out',
      onClick: (e) => { e.preventDefault(); onSignOut(); },
    })),
  ])));
  current.focus();
}
