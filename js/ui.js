/** DOM helpers, toasts, modals and drawers. No framework, no build step. */

/** Create an element. `attrs` supports class/text/html/dataset/on* handlers. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function icon(glyph) { return el('span', { class: 'ico', text: glyph, 'aria-hidden': 'true' }); }

export function button(label, opts = {}) {
  const { variant = '', small = false, glyph, onClick, disabled, title, block } = opts;
  const classes = ['btn', variant && `btn-${variant}`, small && 'btn-sm', block && 'btn-block']
    .filter(Boolean).join(' ');
  return el('button', { class: classes, type: 'button', onClick, disabled, title },
    [glyph ? icon(glyph) : null, label]);
}

export function badge(text, tone = '') {
  return el('span', { class: `badge ${tone}`.trim(), text: String(text) });
}

export function skeleton(rows = 5) {
  return el('div', { class: 'skeleton' },
    Array.from({ length: rows }, (_, i) =>
      el('div', { class: 'bar', style: { width: `${95 - i * 11}%` } })));
}

export function emptyState(message, hint) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'big', text: '—' }),
    el('div', { text: message }),
    hint ? el('div', { class: 'card-sub mt-8', text: hint }) : null,
  ]);
}

export function errorState(err, onRetry) {
  const forbidden = err?.status === 403;
  return el('div', { class: 'empty' }, [
    el('div', { class: 'big', text: forbidden ? '🔒' : '⚠' }),
    el('div', { style: { fontWeight: '600', color: 'var(--text)' },
      text: forbidden ? 'You do not have permission for this' : 'Could not load this' }),
    el('div', { class: 'card-sub mt-8', style: { maxWidth: '58ch', margin: '8px auto 0' },
      text: err?.message || String(err) }),
    err?.code ? el('div', { class: 'card-sub mt-8 mono', text: err.code }) : null,
    onRetry ? el('div', { class: 'mt-16' }, button('Try again', { onClick: onRetry, small: true })) : null,
  ]);
}

/* ---------------------------------------------------------------- Toasts */

export function toast(message, { title, tone = 'ok', timeout = 4200 } = {}) {
  const root = document.getElementById('toasts');
  const node = el('div', { class: `toast ${tone}` }, [
    el('div', { class: 't-body' }, [
      title ? el('div', { class: 't-title', text: title }) : null,
      el('div', { class: 't-msg', text: message }),
    ]),
    el('button', { class: 'icon-btn', text: '×', title: 'Dismiss', onClick: () => node.remove() }),
  ]);
  root.append(node);
  if (timeout) setTimeout(() => node.remove(), timeout);
  return node;
}

export const notify = {
  ok: (msg, title = 'Done') => toast(msg, { title, tone: 'ok' }),
  info: (msg, title) => toast(msg, { title, tone: 'info' }),
  /** Renders validation `details` from the API underneath the message. */
  error: (err, title = 'Request failed') => {
    const parts = [err?.message || String(err)];
    if (Array.isArray(err?.details) && err.details.length) {
      parts.push(err.details.map((d) => `${d.field}: ${d.message}`).join(' · '));
    }
    return toast(parts.join('\n'), { title, tone: 'err', timeout: 8000 });
  },
};

/* ------------------------------------------------------- Modals & drawers */

const modalRoot = () => document.getElementById('modal-root');

function mountOverlay(panel, { center = true, onClose } = {}) {
  const overlay = el('div', { class: `overlay ${center ? 'center' : ''}`.trim() }, [panel]);
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  modalRoot().append(overlay);
  return close;
}

/**
 * Open a modal. `render(close)` returns the body; `footer(close)` the buttons.
 * Returns the close function so callers can dismiss it programmatically.
 */
export function openModal({ title, subtitle, render, footer, wide = false, onClose }) {
  const body = el('div', { class: 'panel-body' });
  const foot = el('div', { class: 'panel-foot' });
  const panel = el('div', { class: `modal ${wide ? 'wide' : ''}`.trim() }, [
    el('div', { class: 'panel-head' }, [
      el('div', {}, [
        el('h2', { text: title }),
        subtitle ? el('div', { class: 'sub', text: subtitle }) : null,
      ]),
      el('div', { class: 'spacer' }),
      el('button', { class: 'icon-btn', text: '×', title: 'Close (Esc)', onClick: () => close() }),
    ]),
    body, foot,
  ]);
  const close = mountOverlay(panel, { center: true, onClose });
  body.append(render(close));
  const buttons = footer?.(close);
  if (buttons) foot.append(...[].concat(buttons));
  else foot.append(button('Close', { onClick: () => close() }));
  return close;
}

/** Right-hand slide-over, used for record detail. */
export function openDrawer({ title, subtitle, render, actions, onClose }) {
  const body = el('div', { class: 'panel-body' });
  const head = el('div', { class: 'panel-head' }, [
    el('div', { style: { minWidth: '0' } }, [
      el('h2', { text: title }),
      subtitle ? el('div', { class: 'sub', text: subtitle }) : null,
    ]),
    el('div', { class: 'spacer' }),
  ]);
  const panel = el('div', { class: 'drawer' }, [head, body]);
  const close = mountOverlay(panel, { center: false, onClose });
  head.append(el('button', { class: 'icon-btn', text: '×', title: 'Close (Esc)', onClick: () => close() }));
  if (actions) head.insertBefore(el('div', { class: 'row' }, [].concat(actions(close))), head.lastChild);
  body.append(render(close, body));
  return { close, body };
}

export function confirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
  return openModal({
    title,
    render: () => el('div', { text: message, style: { color: 'var(--text-dim)' } }),
    footer: (close) => [
      button('Cancel', { onClick: close }),
      button(confirmLabel, {
        variant: danger ? 'danger' : 'primary',
        onClick: async () => {
          try { await onConfirm(); close(); }
          catch (err) { notify.error(err); }
        },
      }),
    ],
  });
}

/** Attach a loading state to a button for the duration of an async action. */
export async function withBusy(btn, fn, busyLabel = 'Working…') {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try { return await fn(); }
  finally { btn.disabled = false; btn.textContent = original; }
}
