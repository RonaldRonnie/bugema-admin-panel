/**
 * The form engine: a field descriptor in, a labelled control out, plus a
 * `read()` that returns an API-shaped value (and `undefined` for "leave this
 * out of the body" — which matters for PATCH, where sending `null` would be a
 * deliberate clear rather than "unchanged").
 *
 * Field types: text · textarea · email · password · number · integer · money ·
 * enum · select · multienum · checkbox · date · datetime · time · ref · refs ·
 * tags · json · static
 */
import { el, button, notify, openModal } from './ui.js';
import { humanize } from './enums.js';
import { lookupOptions, lookupSearch, lookupLabel } from './lookups.js';

let seq = 0;
const uid = () => `f${++seq}`;

/** Trim an ISO timestamp down to what <input type="datetime-local"> accepts. */
function toLocalInput(value, withTime = true) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

function wrap(field, control, { extra } = {}) {
  const errSlot = el('div', { class: 'err hidden' });
  const node = el('div', { class: 'field' }, [
    field.type === 'checkbox' ? null : el('label', { for: control.id || undefined }, [
      field.label || humanize(field.name),
      field.required ? el('span', { class: 'req', text: '*' }) : null,
    ]),
    control,
    extra || null,
    field.help ? el('div', { class: 'help', text: field.help }) : null,
    errSlot,
  ]);
  node._showError = (msg) => {
    errSlot.textContent = msg || '';
    errSlot.classList.toggle('hidden', !msg);
  };
  return node;
}

/* ------------------------------------------------------------ ref picker */

function refControl(field, initialValue, onChange) {
  const input = el('input', {
    type: 'text', id: uid(), placeholder: field.placeholder || 'Type to search…',
    autocomplete: 'off',
  });
  const menu = el('div', { class: 'combo-menu hidden' });
  const chosen = el('div', { class: 'hidden' });
  const combo = el('div', { class: 'combo' }, [input, menu]);
  let value = initialValue ?? null;

  const setValue = (v, label) => {
    value = v || null;
    onChange?.(value);
    if (value) {
      input.value = '';
      input.classList.add('hidden');
      chosen.classList.remove('hidden');
      chosen.className = 'combo-sel';
      chosen.replaceChildren(
        el('span', { text: label || v }),
        el('div', { class: 'spacer' }),
        el('button', { class: 'icon-btn', text: '×', title: 'Clear', onClick: () => setValue(null) }),
      );
    } else {
      chosen.classList.add('hidden');
      input.classList.remove('hidden');
      input.value = '';
    }
    menu.classList.add('hidden');
  };

  if (value) {
    chosen.classList.remove('hidden');
    input.classList.add('hidden');
    chosen.className = 'combo-sel';
    chosen.replaceChildren(el('span', { text: value }), el('div', { class: 'spacer' }),
      el('button', { class: 'icon-btn', text: '×', title: 'Clear', onClick: () => setValue(null) }));
    lookupLabel(field.lookup, value).then((label) => {
      if (value) chosen.firstChild.textContent = label;
    });
  }

  let timer;
  const run = async () => {
    const term = input.value.trim();
    try {
      const options = await lookupSearch(field.lookup, term);
      menu.replaceChildren();
      if (!options.length) {
        menu.append(el('div', { class: 'combo-opt muted', text: term ? 'No match' : 'Start typing to search' }));
      }
      for (const opt of options.slice(0, 25)) {
        menu.append(el('div', {
          class: 'combo-opt',
          onMousedown: (e) => { e.preventDefault(); setValue(opt.value, opt.label); },
        }, [opt.label, opt.meta ? el('span', { class: 'meta', text: opt.meta }) : null]));
      }
      menu.classList.remove('hidden');
    } catch (err) { notify.error(err, 'Lookup failed'); }
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
  input.addEventListener('focus', run);
  input.addEventListener('blur', () => setTimeout(() => menu.classList.add('hidden'), 140));

  return {
    node: el('div', {}, [combo, chosen]),
    control: input,
    read: () => value || undefined,
    set: (v) => setValue(v),
  };
}

function refsControl(field, initialValue) {
  const values = new Map();          // id -> label
  const chips = el('div', { class: 'chips' });
  const render = () => {
    chips.replaceChildren(...[...values].map(([id, label]) =>
      el('span', { class: 'chip' }, [
        el('span', { text: label }),
        el('button', { type: 'button', text: '\u00d7', title: 'Remove', onClick: () => { values.delete(id); render(); } }),
      ])));
    if (!values.size) chips.append(el('span', { class: 'muted', style: { fontSize: '12px' }, text: 'None selected' }));
  };

  // One picker, re-armed after each pick so several can be added in a row.
  const picker = refControl({ ...field, type: 'ref' }, null, (id) => {
    if (!id || values.has(id)) return;
    values.set(id, id);
    render();
    lookupLabel(field.lookup, id).then((label) => {
      if (values.has(id)) { values.set(id, label || id); render(); }
    });
    setTimeout(() => picker.set(null), 0);
  });

  for (const id of initialValue || []) {
    values.set(id, id);
    lookupLabel(field.lookup, id).then((label) => { if (values.has(id)) { values.set(id, label || id); render(); } });
  }
  render();

  return {
    node: el('div', {}, [picker.node, chips]),
    control: picker.control,
    read: () => (values.size ? [...values.keys()] : undefined),
  };
}

/* ------------------------------------------------------------- build one */

/**
 * @param {object} field   descriptor
 * @param {*} initial      current value (edit forms)
 * @returns {{node: HTMLElement, read: Function, name: string, field: object}}
 */
export function buildField(field, initial) {
  const name = field.name;
  const value = initial !== undefined && initial !== null ? initial : field.default;
  let control;
  let read;
  let extra = null;

  switch (field.type) {
    case 'static':
      control = el('div', { class: 'mono muted', style: { padding: '7px 0' }, text: String(value ?? '—') });
      read = () => undefined;
      break;

    case 'checkbox': {
      const box = el('input', { type: 'checkbox', id: uid() });
      box.checked = Boolean(value);
      control = el('div', { class: 'field-row' }, [
        box,
        el('label', { for: box.id }, [field.label || humanize(name), field.required ? el('span', { class: 'req', text: '*' }) : null]),
      ]);
      read = () => box.checked;
      break;
    }

    case 'textarea': {
      const ta = el('textarea', { id: uid(), placeholder: field.placeholder || '', maxlength: field.maxLength, rows: field.rows || 4 });
      ta.value = value ?? '';
      control = ta;
      read = () => (ta.value.trim() === '' ? undefined : ta.value);
      break;
    }

    case 'json': {
      const ta = el('textarea', { id: uid(), class: 'mono', rows: field.rows || 6, placeholder: '{ }' });
      ta.value = value ? JSON.stringify(value, null, 2) : '';
      control = ta;
      read = () => {
        if (!ta.value.trim()) return undefined;
        try { return JSON.parse(ta.value); }
        catch (e) { throw new Error(`${field.label || name}: not valid JSON — ${e.message}`); }
      };
      break;
    }

    case 'enum':
    case 'select': {
      const sel = el('select', { id: uid() });
      sel.append(el('option', { value: '', text: field.required ? 'Select…' : '— none —' }));
      const options = (field.options || []).map((o) => (typeof o === 'string' ? { value: o, label: humanize(o) } : o));
      for (const o of options) sel.append(el('option', { value: o.value, text: o.label }));
      sel.value = value ?? '';
      control = sel;
      read = () => (sel.value === '' ? undefined : sel.value);
      if (field.lookup) {
        lookupOptions(field.lookup).then((opts) => {
          const keep = sel.value;
          sel.replaceChildren(el('option', { value: '', text: field.required ? 'Select…' : '— none —' }));
          for (const o of opts) sel.append(el('option', { value: o.value, text: o.label }));
          sel.value = keep || value || '';
        }).catch(() => {});
      }
      break;
    }

    case 'multienum': {
      const checked = new Set(value || []);
      const boxes = (field.options || []).map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? humanize(o) : o.label;
        const box = el('input', { type: 'checkbox', id: uid() });
        box.checked = checked.has(v);
        box.dataset.value = v;
        return el('label', { class: 'chip', style: { cursor: 'pointer' } }, [box, label]);
      });
      control = el('div', { class: 'chips' }, boxes);
      read = () => {
        const picked = [...control.querySelectorAll('input:checked')].map((b) => b.dataset.value);
        return picked.length ? picked : undefined;
      };
      break;
    }

    case 'tags': {
      const input = el('input', { type: 'text', id: uid(), placeholder: field.placeholder || 'Comma-separated' });
      input.value = Array.isArray(value) ? value.join(', ') : (value ?? '');
      control = input;
      read = () => {
        const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
        return parts.length ? parts : undefined;
      };
      break;
    }

    case 'ref': {
      const picker = refControl(field, value ?? null);
      control = picker.node;
      read = picker.read;
      break;
    }

    case 'refs': {
      const picker = refsControl(field, value ?? []);
      control = picker.node;
      read = picker.read;
      break;
    }

    case 'date':
    case 'datetime': {
      const withTime = field.type === 'datetime';
      const input = el('input', { type: withTime ? 'datetime-local' : 'date', id: uid() });
      input.value = toLocalInput(value, withTime);
      control = input;
      read = () => {
        if (!input.value) return undefined;
        const d = new Date(input.value);
        if (Number.isNaN(d.getTime())) throw new Error(`${field.label || name}: invalid date`);
        // The API validates with @IsISO8601 / @IsDateString — send UTC ISO.
        return field.dateOnly ? input.value : d.toISOString();
      };
      break;
    }

    case 'time': {
      const input = el('input', { type: 'time', id: uid(), placeholder: 'HH:MM' });
      input.value = value ?? '';
      control = input;
      read = () => (input.value || undefined);
      break;
    }

    case 'number':
    case 'integer':
    case 'money': {
      const input = el('input', {
        type: 'number', id: uid(),
        step: field.type === 'integer' ? '1' : (field.step || 'any'),
        min: field.min, max: field.max, placeholder: field.placeholder || '',
      });
      input.value = value ?? '';
      control = input;
      read = () => {
        if (input.value === '') return undefined;
        const n = Number(input.value);
        if (Number.isNaN(n)) throw new Error(`${field.label || name}: not a number`);
        return n;
      };
      break;
    }

    default: {
      const input = el('input', {
        type: field.type === 'password' ? 'password' : (field.type === 'email' ? 'email' : 'text'),
        id: uid(), placeholder: field.placeholder || '', maxlength: field.maxLength,
        autocomplete: field.autocomplete || 'off',
      });
      input.value = value ?? '';
      control = input;
      read = () => (input.value.trim() === '' ? undefined : input.value.trim());
    }
  }

  const node = wrap(field, control, { extra });
  return {
    name,
    field,
    node,
    read: () => {
      const v = read();
      if (field.required && (v === undefined || v === '' || (Array.isArray(v) && !v.length))) {
        throw new Error(`${field.label || humanize(name)} is required`);
      }
      return v;
    },
    showError: node._showError,
  };
}

/**
 * Build a whole form.
 * @returns {{node, read, fields}} — `read()` throws on the first invalid field
 * and returns a body object with undefined values stripped.
 */
export function buildForm(fields, values = {}, { columns = 1 } = {}) {
  const built = fields.map((f) => buildField(f, values[f.name]));
  const body = columns > 1
    ? el('div', { class: columns === 3 ? 'grid-3' : 'grid-2' }, built.map((b) => b.node))
    : el('div', {}, built.map((b) => b.node));

  return {
    node: body,
    fields: built,
    read() {
      const out = {};
      for (const b of built) {
        b.showError(null);
        let v;
        try { v = b.read(); }
        catch (err) { b.showError(err.message); throw err; }
        if (v !== undefined) out[b.name] = v;
      }
      return out;
    },
  };
}

/**
 * A modal wrapping a form. Resolves with whatever `onSubmit` returned, or
 * `null` when the operator dismissed it without saving.
 */
export function openFormModal({ title, subtitle, fields, values, submitLabel = 'Save', columns = 2, onSubmit, wide }) {
  return new Promise((resolve) => {
    let settled = false;
    let form;
    openModal({
      title,
      subtitle,
      wide: wide ?? fields.length > 6,
      render: () => {
        form = buildForm(fields, values || {}, { columns });
        return form.node;
      },
      footer: (close) => [
        button('Cancel', { onClick: close }),
        button(submitLabel, {
          variant: 'primary',
          onClick: async (event) => {
            const btn = event.currentTarget;
            let payload;
            try { payload = form.read(); }
            catch (err) { notify.error(err, 'Check the form'); return; }
            const label = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Saving\u2026';
            try {
              const result = await onSubmit(payload);
              settled = true;
              close();
              resolve(result ?? true);
            } catch (err) {
              notify.error(err);
              btn.disabled = false;
              btn.textContent = label;
            }
          },
        }),
      ],
      onClose: () => { if (!settled) resolve(null); },
    });
  });
}
