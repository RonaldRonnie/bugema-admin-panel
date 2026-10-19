/**
 * Role × permission grid.
 *
 * Granting or revoking takes effect on the holder's very next request — the
 * API checks permissions against the database per request rather than trusting
 * the JWT — so this screen is the fastest way to fix an access problem.
 */
import { api } from '../api.js';
import { el, button, badge, skeleton, errorState, notify, confirmDialog } from '../ui.js';
import { definitelyCannot } from '../store.js';
import { invalidateLookups } from '../store.js';

export function renderAccessMatrix(container) {
  container.replaceChildren();
  const slot = el('div', {});
  const filterInput = el('input', { type: 'text', placeholder: 'Filter permissions…', style: { maxWidth: '260px' } });

  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'Access matrix' }),
        el('div', { class: 'card-sub', text: 'Tick a cell to grant, untick to revoke. Changes apply on the holder’s next request — no sign-out needed.' }),
      ]),
      el('div', { class: 'spacer' }),
      filterInput,
      button('Refresh', { small: true, glyph: '↻', onClick: () => load() }),
    ]),
    slot,
  ]));

  let roles = [];
  let permissions = [];
  const readOnly = definitelyCannot('roles:manage_permissions');

  filterInput.addEventListener('input', () => paint());

  async function load() {
    slot.replaceChildren(skeleton(8));
    try {
      const [roleRes, permRes] = await Promise.all([api.list('/roles'), api.list('/permissions')]);
      roles = roleRes.items;
      permissions = permRes.items.slice().sort((a, b) =>
        (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
      paint();
    } catch (err) {
      slot.replaceChildren(errorState(err, load));
    }
  }

  function grantedSet(role) {
    return new Set((role.permissions || []).map((rp) => rp.permission?.id ?? rp.id));
  }

  function paint() {
    const term = filterInput.value.trim().toLowerCase();
    const shown = term
      ? permissions.filter((p) => p.name.toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term))
      : permissions;

    if (!shown.length) { slot.replaceChildren(el('div', { class: 'empty', text: 'No permission matches that filter.' })); return; }

    const granted = new Map(roles.map((r) => [r.id, grantedSet(r)]));

    const head = el('tr', {}, [
      el('th', { class: 'sticky-l', text: 'Permission' }),
      ...roles.map((r) => el('th', { class: 'rot' }, el('div', { text: r.name }))),
    ]);

    let lastCategory = null;
    const body = el('tbody', {});
    for (const perm of shown) {
      if (perm.category !== lastCategory) {
        lastCategory = perm.category;
        body.append(el('tr', {}, el('th', {
          class: 'sticky-l', colspan: String(roles.length + 1),
          style: { textTransform: 'none', letterSpacing: '0', color: 'var(--text-dim)' },
          text: perm.category || 'Uncategorised',
        })));
      }
      body.append(el('tr', {}, [
        el('td', { class: 'sticky-l mono', title: perm.description || '', text: perm.name }),
        ...roles.map((role) => {
          const box = el('input', { type: 'checkbox' });
          box.checked = granted.get(role.id).has(perm.id);
          box.disabled = readOnly;
          box.title = `${role.name} → ${perm.name}`;
          box.addEventListener('change', async () => {
            const wasChecked = box.checked;
            box.disabled = true;
            try {
              if (wasChecked) await api.post(`/roles/${role.id}/permissions`, { permissionId: perm.id });
              else await api.del(`/roles/${role.id}/permissions/${perm.id}`);
              granted.get(role.id)[wasChecked ? 'add' : 'delete'](perm.id);
              invalidateLookups();
              notify.ok(`${wasChecked ? 'Granted' : 'Revoked'} ${perm.name} ${wasChecked ? 'to' : 'from'} ${role.name}.`);
            } catch (err) {
              box.checked = !wasChecked;
              notify.error(err);
            } finally {
              box.disabled = readOnly;
            }
          });
          return el('td', { class: 'cell' }, box);
        }),
      ]));
    }

    // replaceChildren() stringifies a null argument, so build the list first.
    const parts = [];
    if (readOnly) {
      parts.push(el('div', { class: 'card-body card-sub', text: 'Read-only: your account does not hold roles:manage_permissions.' }));
    }
    parts.push(el('div', { class: 'table-wrap', style: { maxHeight: '70vh', overflowY: 'auto' } },
      el('table', { class: 'data matrix' }, [el('thead', {}, head), body])));
    slot.replaceChildren(...parts);
  }

  load();
}
