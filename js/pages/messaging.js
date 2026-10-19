/** Conversations and the department channel, both backed by the Messaging tables. */
import { api } from '../api.js';
import { el, button, badge, skeleton, emptyState, errorState, notify, confirmDialog } from '../ui.js';
import { openFormModal } from '../fields.js';
import { fmtDateTime, personName, shortId } from '../format.js';
import { state } from '../store.js';
import { E } from '../enums.js';

export function renderMessaging(container) {
  container.replaceChildren();

  const listSlot = el('div', { class: 'chat-list' });
  const mainSlot = el('div', { class: 'chat-main' });
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'Conversations' }),
        el('div', { class: 'card-sub', text: 'Your own direct and group threads. You can only read a conversation you are a participant in — moderation of others’ messages is a separate permission.' }),
      ]),
      el('div', { class: 'spacer' }),
      button('New conversation', { small: true, variant: 'primary', glyph: '＋', onClick: newConversation }),
      button('Refresh', { small: true, glyph: '↻', onClick: () => loadConversations() }),
    ]),
    el('div', { class: 'chat' }, [listSlot, mainSlot]),
  ]);
  container.append(card);

  let active = null;

  async function loadConversations() {
    listSlot.replaceChildren(skeleton(5));
    try {
      const { items } = await api.list('/conversations', { limit: 50 });
      if (!items.length) { listSlot.replaceChildren(emptyState('No conversations')); return; }
      listSlot.replaceChildren(...items.map((c) => el('div', {
        class: `chat-item ${active?.id === c.id ? 'active' : ''}`.trim(),
        onClick: () => openConversation(c),
      }, [
        el('div', { class: 't' }, [
          c.name || (c.type === 'DIRECT' ? 'Direct message' : 'Group'),
          c.unreadCount ? badge(String(c.unreadCount), 'accent') : null,
        ]),
        el('div', { class: 'p', text: c.lastMessage?.content || c.type }),
      ])));
    } catch (err) {
      listSlot.replaceChildren(errorState(err, loadConversations));
    }
  }

  async function openConversation(conversation) {
    active = conversation;
    loadConversations();
    mainSlot.replaceChildren(skeleton(6));

    let messages = [];
    try {
      const res = await api.list(`/conversations/${conversation.id}/messages`, { limit: 50, order: 'asc' });
      messages = res.items;
    } catch (err) {
      mainSlot.replaceChildren(errorState(err, () => openConversation(conversation)));
      return;
    }

    const feed = el('div', { class: 'chat-msgs' }, messages.length
      ? messages.map((m) => messageNode(m, () => openConversation(conversation)))
      : [emptyState('No messages yet')]);

    const input = el('input', { type: 'text', placeholder: 'Write a message…', maxlength: 5000 });
    const send = async () => {
      const content = input.value.trim();
      if (!content) return;
      input.disabled = true;
      try {
        await api.post(`/conversations/${conversation.id}/messages`, { content });
        input.value = '';
        await openConversation(conversation);
      } catch (err) { notify.error(err); }
      finally { input.disabled = false; input.focus(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    mainSlot.replaceChildren(
      el('div', { class: 'panel-head' }, [
        el('div', {}, [
          el('h2', { text: conversation.name || (conversation.type === 'DIRECT' ? 'Direct message' : 'Group') }),
          el('div', { class: 'sub', text: `${conversation.type} · ${conversation.id}` }),
        ]),
        el('div', { class: 'spacer' }),
        button('Mark read', {
          small: true,
          onClick: async () => {
            const last = messages[messages.length - 1];
            if (!last) return;
            try { await api.post(`/conversations/${conversation.id}/read`, { messageId: last.id }); notify.ok('Marked read.'); loadConversations(); }
            catch (err) { notify.error(err); }
          },
        }),
        button('Add participant', {
          small: true,
          onClick: async () => {
            const done = await openFormModal({
              title: 'Add participant',
              fields: [{ name: 'userId', label: 'User', type: 'ref', lookup: 'users', required: true }],
              onSubmit: (body) => api.post(`/conversations/${conversation.id}/participants`, body),
            });
            if (done) notify.ok('Participant added.');
          },
        }),
      ]),
      feed,
      el('div', { class: 'chat-compose' }, [input, button('Send', { variant: 'primary', onClick: send })]),
    );
    feed.scrollTop = feed.scrollHeight;
  }

  function messageNode(message, reload) {
    const mine = message.senderUserId === state.user?.id;
    const deleted = message.content === null;
    return el('div', { class: `msg ${mine ? 'mine' : ''} ${deleted ? 'deleted' : ''}`.trim() }, [
      el('div', { class: 'who', text: message.sender ? personName(message.sender) : shortId(message.senderUserId) }),
      el('div', { text: deleted ? 'Message deleted' : message.content }),
      el('div', { class: 'when' }, [
        fmtDateTime(message.createdAt),
        message.editedAt ? ' · edited' : '',
        !deleted ? el('button', {
          class: 'icon-btn', text: '🗑', title: 'Delete (sender, or messaging:moderate)',
          onClick: () => confirmDialog({
            title: 'Delete message',
            message: 'Soft-delete this message? The row stays, its content is cleared.',
            onConfirm: async () => { await api.del(`/messages/${message.id}`); reload(); },
          }),
        }) : null,
      ]),
    ]);
  }

  async function newConversation() {
    const done = await openFormModal({
      title: 'New conversation',
      subtitle: 'Re-creating an existing DIRECT pair returns the existing thread rather than a duplicate.',
      fields: [
        { name: 'type', label: 'Type', type: 'enum', options: E.ConversationType, required: true, default: 'DIRECT' },
        { name: 'name', label: 'Group name', type: 'text', maxLength: 150, help: 'Groups only.' },
        { name: 'participantUserIds', label: 'Participants', type: 'refs', lookup: 'users', required: true },
      ],
      onSubmit: (body) => api.post('/conversations', body),
    });
    if (done) { notify.ok('Conversation ready.'); loadConversations(); if (done.id) openConversation(done); }
  }

  loadConversations();
  mainSlot.replaceChildren(emptyState('Pick a conversation', 'Or start a new one.'));
}

/* ------------------------------------------------------ department channel */

export function renderDepartmentChannel(container) {
  container.replaceChildren();
  const slot = el('div', {});
  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'card-head' }, [
      el('div', {}, [
        el('h2', { text: 'My department channel' }),
        el('div', { class: 'card-sub', text: 'The one official group for your department. Access follows your current User.departmentId on every read and write — a membership row left over from before a transfer grants nothing.' }),
      ]),
      el('div', { class: 'spacer' }),
      button('Refresh', { small: true, glyph: '↻', onClick: () => load() }),
    ]),
    slot,
  ]));

  async function load() {
    slot.replaceChildren(skeleton(5));

    // The channel follows the caller's own department. An administrator with
    // no departmentId has no channel to read — and cannot borrow one, because
    // the API re-checks the caller's current department on every read.
    if (!state.user?.departmentId) {
      slot.replaceChildren(emptyState(
        'Your account is not assigned to a department',
        'This channel always follows your own department. To administer someone else’s channel, open Departments and use the Channel members tab there.'));
      return;
    }

    let channel;
    try {
      channel = await api.get('/department-channels/mine');
    } catch (err) {
      slot.replaceChildren(errorState(err, load));
      return;
    }

    const departmentId = channel.departmentId || state.user?.departmentId;
    let messages = [];
    try {
      const res = await api.list(`/department-channels/${departmentId}/messages`, { limit: 50, order: 'asc' });
      messages = res.items;
    } catch (err) {
      slot.replaceChildren(errorState(err, load));
      return;
    }

    const feed = el('div', { class: 'chat-msgs', style: { maxHeight: '460px' } },
      messages.length
        ? messages.map((m) => el('div', { class: `msg ${m.senderUserId === state.user?.id ? 'mine' : ''}`.trim() }, [
            el('div', { class: 'who', text: m.sender ? personName(m.sender) : shortId(m.senderUserId) }),
            el('div', { text: m.content ?? 'Message deleted' }),
            el('div', { class: 'when', text: fmtDateTime(m.createdAt) }),
          ]))
        : [emptyState('No messages in the channel yet')]);

    const input = el('input', { type: 'text', placeholder: 'Message the department…', maxlength: 5000 });
    const send = async () => {
      const content = input.value.trim();
      if (!content) return;
      input.disabled = true;
      try { await api.post(`/department-channels/${departmentId}/messages`, { content }); input.value = ''; await load(); }
      catch (err) { notify.error(err); }
      finally { input.disabled = false; }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    slot.replaceChildren(
      el('div', { class: 'card-body card-sub', text: `Department ${departmentId} · conversation ${channel.conversationId ?? channel.id ?? '—'}` }),
      feed,
      el('div', { class: 'chat-compose' }, [input, button('Send', { variant: 'primary', onClick: send })]),
    );
    feed.scrollTop = feed.scrollHeight;
  }

  load();
}
