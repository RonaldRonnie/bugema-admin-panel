/**
 * Sign-in, including the two-step MFA login and the one-time admin bootstrap.
 *
 * An MFA login returns no tokens and opens no session on the password step —
 * only a short-lived challenge token — so the second step is a separate call
 * and a failure there leaves nothing behind.
 */
import { api, request, tokens, API_BASE } from '../api.js';
import { el, button, notify } from '../ui.js';
import { buildForm } from '../fields.js';

const CFG = window.BU_ADMIN_CONFIG || {};

export function renderLogin(root, onSignedIn) {
  root.className = '';
  root.replaceChildren();

  const card = el('div', { class: 'auth-card' });
  root.append(el('div', { class: 'auth-wrap' }, card));

  showPassword();

  function header(subtitle) {
    return el('div', {}, [
      el('div', { class: 'brand' }, [
        el('div', { class: 'brand-mark', text: 'BU' }),
        el('div', { class: 'brand-text' }, [
          el('div', { class: 'brand-title', text: CFG.institution || 'Digital Campus' }),
          el('div', { class: 'brand-sub', text: 'Admin console' }),
        ]),
      ]),
      el('h1', { text: 'Sign in' }),
      el('p', { class: 'lead', text: subtitle }),
    ]);
  }

  function footer() {
    return el('div', { class: 'auth-foot' }, [
      el('div', { class: 'mono', style: { fontSize: '11px' }, text: API_BASE }),
      CFG.showBootstrap
        ? el('div', { class: 'mt-8' }, el('a', { href: '#', text: 'First-run setup', onClick: (e) => { e.preventDefault(); showBootstrap(); } }))
        : null,
      el('div', { class: 'mt-8' }, el('a', { href: '#', text: 'Forgot password', onClick: (e) => { e.preventDefault(); showForgot(); } })),
    ]);
  }

  function showPassword() {
    const email = el('input', { type: 'email', placeholder: 'you@bugemauniv.ac.ug', autocomplete: 'username' });
    const password = el('input', { type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
    const submit = button('Sign in', { variant: 'primary', block: true, onClick: () => go() });

    const hint = el('div', { class: 'auth-foot hidden', style: { color: 'var(--warn)' } });

    const go = async () => {
      if (!email.value.trim() || !password.value) { notify.error(new Error('Email and password are both required.'), 'Sign in'); return; }
      submit.disabled = true;
      submit.textContent = 'Signing in…';

      /*
       * A free-tier host idles its instance out and takes the better part of a
       * minute to wake. Without this the first sign-in of the day looks like a
       * hang, and the natural reaction is to reload — which starts the wait
       * over. Say what is happening instead.
       */
      const slowTimer = setTimeout(() => {
        hint.textContent = 'Still waiting on the API. If it is on a free hosting tier it may be waking from idle, which can take up to a minute on the first request.';
        hint.classList.remove('hidden');
      }, 6000);

      try {
        const result = await request('/auth/login', {
          method: 'POST', auth: false,
          body: { email: email.value.trim(), password: password.value },
        });
        if (result?.mfaRequired) { showMfa(result.challengeToken); return; }
        tokens.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        onSignedIn();
      } catch (err) {
        notify.error(err, 'Could not sign in');
      } finally {
        clearTimeout(slowTimer);
        hint.classList.add('hidden');
        submit.disabled = false;
        submit.textContent = 'Sign in';
      }
    };

    for (const input of [email, password]) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }

    card.replaceChildren(
      header('Use the account an administrator provisioned for you.'),
      el('div', { class: 'field' }, [el('label', { text: 'Email' }), email]),
      el('div', { class: 'field' }, [el('label', { text: 'Password' }), password]),
      submit,
      hint,
      footer(),
    );
    email.focus();
  }

  function showMfa(challengeToken) {
    const code = el('input', { type: 'text', placeholder: '123456', maxlength: '6', class: 'mono', autocomplete: 'one-time-code' });
    const submit = button('Verify', { variant: 'primary', block: true, onClick: () => go() });

    const go = async () => {
      submit.disabled = true;
      submit.textContent = 'Verifying…';
      try {
        const result = await request('/auth/mfa/challenge', {
          method: 'POST', auth: false,
          body: { challengeToken, code: code.value.trim() },
        });
        tokens.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        onSignedIn();
      } catch (err) {
        notify.error(err, 'Verification failed');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Verify';
      }
    };
    code.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

    card.replaceChildren(
      header('Enter the six-digit code from your authenticator app.'),
      el('div', { class: 'field' }, [el('label', { text: 'Authenticator code' }), code]),
      submit,
      el('div', { class: 'auth-foot' }, el('a', { href: '#', text: '← Back', onClick: (e) => { e.preventDefault(); showPassword(); } })),
    );
    code.focus();
  }

  function showForgot() {
    const email = el('input', { type: 'email', placeholder: 'you@bugemauniv.ac.ug' });
    card.replaceChildren(
      header('We will send a reset link if the address belongs to an account.'),
      el('div', { class: 'field' }, [el('label', { text: 'Email' }), email]),
      button('Send reset link', {
        variant: 'primary', block: true,
        onClick: async () => {
          try {
            await request('/auth/forgot-password', { method: 'POST', auth: false, body: { email: email.value.trim() } });
            notify.ok('If that address has an account, a reset link is on its way.');
          } catch (err) { notify.error(err); }
        },
      }),
      el('div', { class: 'mt-16' }, button('I have a reset token', { block: true, onClick: showReset })),
      el('div', { class: 'auth-foot' }, el('a', { href: '#', text: '← Back to sign in', onClick: (e) => { e.preventDefault(); showPassword(); } })),
    );
    email.focus();
  }

  function showReset() {
    const form = buildForm([
      { name: 'token', label: 'Reset token', type: 'text', required: true },
      { name: 'newPassword', label: 'New password', type: 'password', required: true, help: '8+ characters, mixed case, a digit and a symbol.' },
    ], {}, { columns: 1 });

    card.replaceChildren(
      header('Paste the token from the email and choose a new password.'),
      form.node,
      button('Reset password', {
        variant: 'primary', block: true,
        onClick: async () => {
          let payload;
          try { payload = form.read(); } catch (err) { notify.error(err); return; }
          try {
            await request('/auth/reset-password', { method: 'POST', auth: false, body: payload });
            notify.ok('Password reset. Sign in with the new one.');
            showPassword();
          } catch (err) { notify.error(err); }
        },
      }),
      el('div', { class: 'auth-foot' }, el('a', { href: '#', text: '← Back to sign in', onClick: (e) => { e.preventDefault(); showPassword(); } })),
    );
  }

  function showBootstrap() {
    const secret = el('input', { type: 'password', placeholder: 'BOOTSTRAP_ADMIN_SECRET' });
    const form = buildForm([
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, help: 'At least 12 characters for this account.' },
      { name: 'firstName', label: 'First name', type: 'text', required: true, maxLength: 100 },
      { name: 'lastName', label: 'Last name', type: 'text', required: true, maxLength: 100 },
      { name: 'staffNumber', label: 'Staff number', type: 'text', maxLength: 50 },
    ], {}, { columns: 1 });

    card.replaceChildren(
      header('Create the first SUPER_ADMIN on a database that has none.'),
      el('p', { class: 'card-sub', style: { marginTop: '-12px', marginBottom: '16px' },
        text: 'Authenticated by the BOOTSTRAP_ADMIN_SECRET shared secret, not a token. It succeeds at most once per database, and you should unset the secret afterwards.' }),
      el('div', { class: 'field' }, [el('label', { text: 'Bootstrap secret' }), secret]),
      form.node,
      button('Create the first administrator', {
        variant: 'primary', block: true,
        onClick: async () => {
          let payload;
          try { payload = form.read(); } catch (err) { notify.error(err); return; }
          try {
            const result = await request('/auth/bootstrap-admin', {
              method: 'POST', auth: false, body: payload,
              headers: { 'x-bootstrap-secret': secret.value },
            });
            if (result?.accessToken) {
              tokens.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
              notify.ok('Administrator created — you are signed in.');
              onSignedIn();
              return;
            }
            notify.ok('Administrator created. Sign in with those details.');
            showPassword();
          } catch (err) { notify.error(err, 'Bootstrap failed'); }
        },
      }),
      el('div', { class: 'auth-foot' }, el('a', { href: '#', text: '← Back to sign in', onClick: (e) => { e.preventDefault(); showPassword(); } })),
    );
  }
}
