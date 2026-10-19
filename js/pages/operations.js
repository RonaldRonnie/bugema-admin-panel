/**
 * Operational consoles that are a single action rather than a collection:
 * emergency broadcast, global search, file assets, the digital-ID desk and a
 * raw API console for anything this UI does not model.
 */
import { api, request, API_BASE } from '../api.js';
import { el, button, badge, skeleton, emptyState, errorState, notify, confirmDialog, openModal } from '../ui.js';
import { buildForm, openFormModal } from '../fields.js';
import { fmtDateTime, personName, shortId, renderValue } from '../format.js';
import { E, humanize } from '../enums.js';
import { definitelyCannot } from '../store.js';
import { href } from '../router.js';

/* ------------------------------------------------------ Emergency broadcast */

export function renderBroadcast(container) {
  container.replaceChildren();

  const form = buildForm([
    { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
    { name: 'body', label: 'Message', type: 'textarea', required: true, maxLength: 2000, rows: 6 },
    {
      name: 'audienceUserIds', label: 'Limit to specific people', type: 'refs', lookup: 'users',
      help: 'Leave empty to reach every ACTIVE user on the platform.',
    },
  ], {}, { columns: 1 });

  const sendBtn = button('Send emergency broadcast', {
    variant: 'danger', glyph: '🚨',
    ...(definitelyCannot('notifications:broadcast_emergency')
      ? { disabled: true, title: 'Requires notifications:broadcast_emergency' } : {}),
    onClick: () => {
      let payload;
      try { payload = form.read(); } catch (err) { notify.error(err, 'Check the form'); return; }
      const scope = payload.audienceUserIds?.length
        ? `${payload.audienceUserIds.length} selected ${payload.audienceUserIds.length === 1 ? 'person' : 'people'}`
        : 'EVERY active user on the platform';
      confirmDialog({
        title: 'Send emergency broadcast',
        message: `This goes to ${scope}, immediately, as a critical notification nobody can mute. Send it?`,
        confirmLabel: 'Send now',
        onConfirm: async () => {
          await api.post('/notifications/emergency-broadcast', payload);
          notify.ok('Broadcast sent.');
          container.querySelectorAll('input, textarea').forEach((i) => { i.value = ''; });
        },
      });
    },
  });

  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'Emergency broadcast' }),
        el('div', { class: 'card-sub', text: 'Always sent as critical. Recipients cannot have muted the emergency_alert category — the API refuses to let anyone disable it.' }),
      ]),
    ]),
    el('div', { class: 'card-body' }, [form.node, el('div', { class: 'mt-16' }, sendBtn)]),
  ]));
}

/* ------------------------------------------------------------ Global search */

export function renderSearch(container, route) {
  container.replaceChildren();
  const term = route.query?.q || '';

  const input = el('input', { type: 'text', value: term, placeholder: 'Search the platform (min 2 characters)…' });
  const typeBoxes = E.SearchableType.map((t) => {
    const box = el('input', { type: 'checkbox' });
    box.dataset.value = t;
    box.checked = true;
    return el('label', { class: 'chip', style: { cursor: 'pointer' } }, [box, humanize(t)]);
  });
  const results = el('div', {});

  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { results.replaceChildren(emptyState('Type at least two characters')); return; }
    const types = typeBoxes.map((l) => l.querySelector('input')).filter((b) => b.checked).map((b) => b.dataset.value);
    results.replaceChildren(skeleton(5));
    try {
      const data = await api.get('/search', { q, types: types.length === E.SearchableType.length ? undefined : types });
      const groups = Object.entries(data || {}).filter(([, rows]) => Array.isArray(rows) && rows.length);
      if (!groups.length) { results.replaceChildren(emptyState(`Nothing matched “${q}”`)); return; }
      results.replaceChildren(...groups.map(([type, rows]) => el('div', { class: 'card mb-16' }, [
        el('div', { class: 'card-head' }, [
          el('h2', { text: humanize(type) }),
          el('div', { class: 'spacer' }),
          badge(String(rows.length)),
        ]),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, el('tbody', {}, rows.map((row) =>
          el('tr', {}, [
            el('td', { text: row.name || row.title || personName(row) || row.code || row.id }),
            el('td', { class: 'muted clip', text: row.description || row.email || row.code || '' }),
            el('td', { class: 'mono muted', text: shortId(row.id) }),
          ]))))),
      ])));
    } catch (err) {
      results.replaceChildren(errorState(err, run));
    }
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

  container.append(el('div', { class: 'card mb-16' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'Search' }),
        el('div', { class: 'card-sub', text: 'Health records, counselling records and message content are deliberately not searchable — there is no code path for it. User results never include contact details.' }),
      ]),
    ]),
    el('div', { class: 'card-body' }, [
      el('div', { class: 'row' }, [el('div', { style: { flex: '1' } }, input), button('Search', { variant: 'primary', onClick: run })]),
      el('div', { class: 'chips mt-16' }, typeBoxes),
    ]),
  ]), results);

  if (term) run();
}

/* ----------------------------------------------------------------- Files */

export function renderFiles(container) {
  container.replaceChildren();
  const recent = JSON.parse(sessionStorage.getItem('bu-admin-files') || '[]');
  const listSlot = el('div', {});

  const fileInput = el('input', { type: 'file' });
  const uploadBtn = button('Upload', {
    variant: 'primary', glyph: '⭱',
    onClick: async () => {
      const file = fileInput.files?.[0];
      if (!file) { notify.info('Choose a file first.'); return; }
      if (file.size > 20 * 1024 * 1024) { notify.error(new Error('The API caps uploads at 20 MB.'), 'Too large'); return; }
      try {
        const asset = await api.upload('/files/upload', file);
        recent.unshift({ ...asset, uploadedLocallyAt: new Date().toISOString() });
        sessionStorage.setItem('bu-admin-files', JSON.stringify(recent.slice(0, 40)));
        notify.ok(`Uploaded. Asset ID ${asset.id}`);
        fileInput.value = '';
        paint();
      } catch (err) { notify.error(err); }
    },
  });

  const lookupInput = el('input', { type: 'text', placeholder: 'Paste a file asset ID…' });

  function paint() {
    if (!recent.length) { listSlot.replaceChildren(emptyState('Nothing uploaded in this browser session', 'Upload a file above, or look one up by ID.')); return; }
    listSlot.replaceChildren(el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [
      el('thead', {}, el('tr', {}, ['File', 'Type', 'Size', 'Asset ID', ''].map((h) => el('th', { text: h })))),
      el('tbody', {}, recent.map((asset) => el('tr', {}, [
        el('td', { text: asset.originalName || asset.filename || '—' }),
        el('td', { class: 'muted', text: asset.mimeType || '—' }),
        el('td', { class: 'tabular', text: asset.sizeBytes ? `${Math.round(asset.sizeBytes / 1024)} KB` : '—' }),
        el('td', { class: 'mono', text: asset.id }),
        el('td', { class: 'actions' }, el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [
          button('Copy ID', { small: true, onClick: () => { navigator.clipboard?.writeText(asset.id); notify.ok('Asset ID copied.'); } }),
          button('Download link', { small: true, onClick: () => downloadLink(asset.id) }),
          button('Delete', {
            small: true, variant: 'danger',
            onClick: () => confirmDialog({
              title: 'Delete file',
              message: 'Delete this asset? Rejected with 409 if a message, announcement or maintenance request still references it.',
              onConfirm: async () => {
                await api.del(`/files/${asset.id}`);
                const i = recent.findIndex((a) => a.id === asset.id);
                if (i >= 0) recent.splice(i, 1);
                sessionStorage.setItem('bu-admin-files', JSON.stringify(recent));
                notify.ok('Deleted.');
                paint();
              },
            }),
          }),
        ])),
      ]))),
    ])));
  }

  async function downloadLink(id) {
    try {
      const result = await api.get(`/files/${encodeURIComponent(id)}/download-url`);
      const url = result?.url || result?.downloadUrl || result;
      openModal({
        title: 'Pre-signed download link',
        render: () => el('div', {}, [
          el('p', { class: 'card-sub', text: 'Short-lived. Anyone holding this URL can fetch the file until it expires.' }),
          el('input', { type: 'text', value: String(url), readonly: true, onFocus: (e) => e.target.select() }),
          el('div', { class: 'mt-16' }, el('a', { class: 'btn btn-primary', href: String(url), target: '_blank', rel: 'noopener noreferrer', text: 'Open' })),
        ]),
      });
    } catch (err) { notify.error(err); }
  }

  container.append(
    el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, [
        el('div', {}, [
          el('h2', { text: 'Files' }),
          el('div', { class: 'card-sub', text: 'Upload once, reference the returned asset ID anywhere that takes fileAssetId(s) — announcements, maintenance requests, document requests. 20 MB cap, images and common documents only.' }),
        ]),
      ]),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'row' }, [el('div', { style: { flex: '1' } }, fileInput), uploadBtn]),
        el('div', { class: 'row mt-16' }, [
          el('div', { style: { flex: '1' } }, lookupInput),
          button('Get download link', { onClick: () => lookupInput.value.trim() && downloadLink(lookupInput.value.trim()) }),
        ]),
      ]),
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, el('h2', { text: 'Uploaded in this session' })),
      listSlot,
    ]),
  );

  paint();
}

/* -------------------------------------------------------- Digital ID desk */

export function renderDigitalId(container) {
  container.replaceChildren();
  const result = el('div', {});

  const verifyForm = buildForm([
    { name: 'userId', label: 'User ID', type: 'text', required: true },
    { name: 'expiresAt', label: 'Expires at (ISO)', type: 'text', required: true, placeholder: '2026-01-01T12:00:00.000Z' },
    { name: 'token', label: 'Token', type: 'text', required: true },
  ], {}, { columns: 1 });

  const manageForm = buildForm([
    { name: 'userId', label: 'User', type: 'ref', lookup: 'users', required: true },
  ], {}, { columns: 1 });

  const act = (suffix, label, variant) => button(label, {
    variant, small: true,
    ...(definitelyCannot('digital_id:manage') ? { disabled: true, title: 'Requires digital_id:manage' } : {}),
    onClick: async () => {
      let values;
      try { values = manageForm.read(); } catch (err) { notify.error(err); return; }
      try {
        const res = await api.patch(`/digital-id/${encodeURIComponent(values.userId)}/${suffix}`, {});
        notify.ok(`${label} — done.`);
        result.replaceChildren(el('pre', { class: 'json', text: JSON.stringify(res, null, 2) }));
      } catch (err) { notify.error(err); }
    },
  });

  container.append(
    el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, [
        el('div', {}, [
          el('h2', { text: 'Verify a digital ID' }),
          el('div', { class: 'card-sub', text: 'Verification is HMAC-based, not JWT. The holder’s app calls GET /digital-id/me/token for a payload valid for two minutes; paste its three fields here and the API recomputes the HMAC and checks expiry and the card’s active status.' }),
        ]),
      ]),
      el('div', { class: 'card-body' }, [
        verifyForm.node,
        button('Verify', {
          variant: 'primary',
          onClick: async () => {
            let payload;
            try { payload = verifyForm.read(); } catch (err) { notify.error(err); return; }
            try {
              const res = await api.post('/digital-id/verify', payload);
              result.replaceChildren(el('div', { class: 'card' }, [
                el('div', { class: 'card-head' }, [el('h2', { text: 'Verification result' }), el('div', { class: 'spacer' }), badge('VALID', 'ok')]),
                el('div', { class: 'card-body' }, el('pre', { class: 'json', text: JSON.stringify(res, null, 2) })),
              ]));
            } catch (err) {
              result.replaceChildren(el('div', { class: 'card' }, [
                el('div', { class: 'card-head' }, [el('h2', { text: 'Verification result' }), el('div', { class: 'spacer' }), badge('REJECTED', 'danger')]),
                el('div', { class: 'card-body card-sub', text: err.message }),
              ]));
            }
          },
        }),
      ]),
    ]),
    el('div', { class: 'card mb-16' }, [
      el('div', { class: 'card-head' }, [
        el('div', {}, [
          el('h2', { text: 'Manage a card' }),
          el('div', { class: 'card-sub', text: 'Deactivate a lost card immediately, reactivate a recovered one, or reissue after a name change.' }),
        ]),
      ]),
      el('div', { class: 'card-body' }, [
        manageForm.node,
        el('div', { class: 'row' }, [
          act('deactivate', 'Deactivate', 'danger'),
          act('reactivate', 'Reactivate'),
          act('reissue', 'Reissue'),
        ]),
      ]),
    ]),
    result,
  );
}

/* ------------------------------------------------------------ API console */

const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

export function renderApiConsole(container) {
  container.replaceChildren();

  const method = el('select', {}, METHODS.map((m) => el('option', { value: m, text: m })));
  const path = el('input', { type: 'text', value: '/admin/stats', placeholder: '/users?limit=5', class: 'mono' });
  const body = el('textarea', { class: 'mono', rows: 8, placeholder: '{\n  "key": "value"\n}' });
  const out = el('pre', { class: 'json', text: 'No request sent yet.' });
  const statusSlot = el('div', {});

  const send = async () => {
    const m = method.value;
    let parsed;
    if (body.value.trim() && m !== 'GET' && m !== 'DELETE') {
      try { parsed = JSON.parse(body.value); }
      catch (err) { notify.error(new Error(`Body is not valid JSON — ${err.message}`)); return; }
    }
    const started = performance.now();
    out.textContent = 'Sending…';
    try {
      const envelope = await request(path.value.trim(), { method: m, body: parsed, raw: true });
      const ms = Math.round(performance.now() - started);
      statusSlot.replaceChildren(el('div', { class: 'row' }, [badge('OK', 'ok'), el('span', { class: 'card-sub', text: `${ms} ms · requestId ${envelope?.requestId ?? '—'}` })]));
      out.textContent = JSON.stringify(envelope, null, 2);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      statusSlot.replaceChildren(el('div', { class: 'row' }, [
        badge(`${err.status || 'ERR'} ${err.code || ''}`.trim(), 'danger'),
        el('span', { class: 'card-sub', text: `${ms} ms` }),
      ]));
      out.textContent = JSON.stringify({ status: err.status, code: err.code, message: err.message, details: err.details }, null, 2);
    }
  };

  path.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'API console' }),
        el('div', { class: 'card-sub', text: `Send any request to ${API_BASE} with your current token. Everything this console does elsewhere goes through the same client — this is the escape hatch for endpoints the UI does not model.` }),
      ]),
      el('div', { class: 'spacer' }),
      el('a', { class: 'btn btn-sm', href: `${API_BASE.replace(/\/api\/v\d+$/, '')}/api/docs`, target: '_blank', rel: 'noopener noreferrer', text: 'Swagger docs ↗' }),
    ]),
    el('div', { class: 'card-body' }, [
      el('div', { class: 'row' }, [
        el('div', { style: { width: '110px' } }, method),
        el('div', { style: { flex: '1' } }, path),
        button('Send', { variant: 'primary', onClick: send }),
      ]),
      el('div', { class: 'field mt-16' }, [el('label', { text: 'JSON body (POST / PATCH / PUT)' }), body]),
      statusSlot,
      el('div', { class: 'mt-8' }, out),
    ]),
  ]));
}
