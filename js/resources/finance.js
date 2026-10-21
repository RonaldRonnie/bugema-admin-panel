/** Finance & documents: invoices, payments, scholarships, document requests. */
import { E } from '../enums.js';
import { el, badge, openModal, notify } from '../ui.js';
import { fmtMoney } from '../format.js';

export const invoices = {
  key: 'invoices',
  label: 'Invoices',
  singular: 'Invoice',
  group: 'Finance',
  icon: '🧾',
  description: 'Student billing. Amounts paid and outstanding are derived from the payment ledger, never stored on the invoice; scholarships apply as waivers on top.',
  list: {
    path: '/invoices',
    permission: 'invoices:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.InvoiceStatus },
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students' },
      { name: 'academicYear', label: 'Academic year', type: 'text', placeholder: '2025/2026' },
    ],
    columns: [
      { key: 'description', label: 'Description', clip: true },
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'academicYear', label: 'Year' },
      { key: 'semester', label: 'Semester' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'amountPaid', label: 'Paid', type: 'money' },
      { key: 'amountOutstanding', label: 'Outstanding', type: 'money' },
      { key: 'status', label: 'Status' },
      { key: 'dueDate', label: 'Due', type: 'date' },
    ],
  },
  detailPath: '/invoices/:id',
  create: {
    path: '/invoices', permission: 'invoices:manage',
    fields: [
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students', required: true },
      { name: 'academicYear', label: 'Academic year', type: 'text', required: true, maxLength: 20, placeholder: '2025/2026' },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester, required: true },
      { name: 'description', label: 'Description', type: 'text', required: true, maxLength: 500 },
      { name: 'amount', label: 'Amount', type: 'money', required: true, min: 0.01 },
      { name: 'dueDate', label: 'Due date', type: 'datetime', required: true },
    ],
  },
  update: {
    path: '/invoices/:id', permission: 'invoices:manage',
    fields: [
      { name: 'academicYear', label: 'Academic year', type: 'text', maxLength: 20 },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester },
      { name: 'description', label: 'Description', type: 'text', maxLength: 500 },
      { name: 'amount', label: 'Amount', type: 'money', min: 0.01 },
      { name: 'dueDate', label: 'Due date', type: 'datetime' },
    ],
  },
  actions: [
    {
      key: 'cancel', label: 'Cancel invoice', variant: 'danger', glyph: '⊘',
      permission: 'invoices:manage', method: 'PATCH', path: '/invoices/:id/cancel',
      confirm: 'Cancel this invoice?',
      when: (i) => i.status !== 'CANCELLED' && i.status !== 'PAID',
    },
    {
      key: 'pay', label: 'Initiate a payment', glyph: '💳',
      method: 'POST', path: '/invoices/:id/payments/initiate',
      subtitle: 'Repeating this while a payment is still PENDING returns the existing one rather than creating a second.',
      fields: [],
      successMessage: 'Payment initiated.',
    },
  ],
  related: [
    {
      key: 'payments', label: 'Payments', path: '/payments', query: { limit: 100 },
      mapRows: (rows, invoice) => rows.filter((p) => p.invoiceId === invoice.id),
      columns: [
        { key: 'amount', label: 'Amount', type: 'money' },
        { key: 'status', label: 'Status' },
        { key: 'providerName', label: 'Provider' },
        { key: 'providerReference', label: 'Reference', clip: true },
        { key: 'createdAt', label: 'Created', type: 'datetime' },
      ],
      emptyMessage: 'No payments against this invoice',
    },
  ],
};

export const payments = {
  key: 'payments',
  label: 'Payments',
  singular: 'Payment',
  group: 'Finance',
  icon: '💳',
  description: 'The payment ledger. Settlement only ever happens through the provider’s verify() — a webhook’s claimed status is never trusted.',
  list: {
    path: '/payments',
    permission: 'payments:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.PaymentStatus },
      { name: 'invoiceId', label: 'Invoice', type: 'select', lookup: 'invoices' },
    ],
    columns: [
      { key: 'id', label: 'Payment', type: 'id' },
      { key: 'invoiceId', label: 'Invoice', type: 'id' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'status', label: 'Status' },
      { key: 'providerName', label: 'Provider' },
      { key: 'providerReference', label: 'Reference', clip: true },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
      { key: 'completedAt', label: 'Completed', type: 'datetime' },
    ],
  },
  detailPath: '/payments/:id',
  actions: [
    {
      key: 'reconcile', label: 'Reconcile with provider', glyph: '⇄', permission: 'payments:manage',
      method: 'PATCH', path: '/payments/:id/reconcile',
      confirm: 'Re-verify this payment with the provider and apply whatever it reports? Only valid while the payment is PENDING.',
      when: (p) => p.status === 'PENDING',
      successMessage: 'Reconciliation run — check the resulting status.',
    },
  ],
};

export const stuckPayments = {
  key: 'stuck-payments',
  label: 'Stuck payments',
  singular: 'Stuck payment',
  group: 'Finance',
  icon: '⏳',
  description: 'PENDING payments past the staleness threshold — the same queue the 15-minute cron sweep works through. Each row says how long it has been stuck and whether the provider can still be asked.',
  list: {
    path: '/payments/stuck',
    permission: 'payments:manage',
    columns: [
      { key: 'id', label: 'Payment', type: 'id' },
      { key: 'invoiceId', label: 'Invoice', type: 'id' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'providerName', label: 'Provider' },
      {
        key: 'stuckForMinutes', label: 'Stuck for',
        render: (p) => {
          const mins = Number(p.stuckForMinutes ?? 0);
          const tone = mins > 180 ? 'danger' : mins > 60 ? 'warn' : '';
          return badge(mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`, tone);
        },
      },
      { key: 'canReconcile', label: 'Can reconcile' },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detail: false,
  actions: [
    {
      key: 'reconcile', label: 'Reconcile', inline: true, glyph: '⇄', permission: 'payments:manage',
      method: 'PATCH', path: '/payments/:id/reconcile',
      confirm: 'Ask the provider about this payment now and settle it with whatever comes back?',
      when: (p) => p.canReconcile !== false,
    },
  ],
};

export const scholarships = {
  key: 'scholarships',
  label: 'Scholarships',
  singular: 'Scholarship',
  group: 'Finance',
  icon: '🏅',
  description: 'Financial aid awards. A scholarship is applied as a waiver against matching invoices — the invoice amount itself is never rewritten.',
  list: {
    path: '/scholarships',
    permission: 'scholarships:manage',
    filters: [
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students' },
      { name: 'status', label: 'Status', type: 'enum', options: E.ScholarshipStatus },
    ],
    columns: [
      { key: 'name', label: 'Award' },
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'sponsor', label: 'Sponsor' },
      { key: 'academicYear', label: 'Year' },
      { key: 'semester', label: 'Semester' },
      { key: 'discountType', label: 'Type' },
      { key: 'discountValue', label: 'Value', type: 'money' },
      { key: 'status', label: 'Status' },
    ],
  },
  detail: false,
  create: {
    path: '/scholarships', permission: 'scholarships:manage',
    fields: [
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students', required: true },
      { name: 'name', label: 'Award name', type: 'text', required: true, maxLength: 200 },
      { name: 'sponsor', label: 'Sponsor', type: 'text', maxLength: 200 },
      { name: 'academicYear', label: 'Academic year', type: 'text', required: true, maxLength: 20 },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester, required: true },
      { name: 'discountType', label: 'Discount type', type: 'enum', options: E.ScholarshipDiscountType, required: true },
      { name: 'discountValue', label: 'Discount value', type: 'money', required: true, min: 0.01, help: 'A percentage (0–100) or a fixed amount, depending on the type above.' },
      { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 500 },
    ],
  },
  actions: [
    {
      key: 'revoke', label: 'Revoke', inline: true, variant: 'danger', permission: 'scholarships:manage',
      method: 'PATCH', path: '/scholarships/:id/revoke',
      confirm: 'Revoke this award? Invoices stop receiving the waiver.',
      when: (s) => s.status === 'ACTIVE',
    },
  ],
};

export const documentRequests = {
  key: 'document-requests',
  label: 'Document requests',
  singular: 'Request',
  group: 'Finance',
  icon: '📄',
  description: 'Transcript and clearance requests. Status only moves forward: REQUESTED → UNDER_REVIEW → APPROVED/REJECTED → PROCESSING → READY. Every transition notifies the student.',
  list: {
    path: '/documents/requests',
    permission: 'document_requests:manage',
    filters: [
      { name: 'status', label: 'Status', type: 'enum', options: E.DocumentRequestStatus },
      { name: 'type', label: 'Type', type: 'enum', options: E.DocumentRequestType },
    ],
    columns: [
      { key: 'type', label: 'Type' },
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'assignedToUserId', label: 'Assigned to', type: 'id' },
      { key: 'details', label: 'Details', clip: true },
      { key: 'createdAt', label: 'Requested', type: 'datetime' },
    ],
  },
  detailPath: '/documents/requests/:id',
  actions: [
    {
      key: 'assign', label: 'Assign', glyph: '👤', permission: 'document_requests:manage',
      method: 'PATCH', path: '/documents/requests/:id/assign',
      fields: [{ name: 'staffUserId', label: 'Staff member', type: 'ref', lookup: 'staff', required: true }],
    },
    {
      key: 'status', label: 'Move status', glyph: '→', permission: 'document_requests:manage',
      method: 'PATCH', path: '/documents/requests/:id/status',
      subtitle: 'REJECTED needs a reason; READY needs a generated file asset.',
      fields: [
        { name: 'status', label: 'New status', type: 'enum', options: E.DocumentRequestStatus, required: true },
        { name: 'rejectionReason', label: 'Rejection reason', type: 'textarea', maxLength: 2000 },
        { name: 'generatedFileAssetId', label: 'Generated file asset ID', type: 'text', help: 'Upload the document under Files first, then paste its ID here.' },
      ],
    },
  ],
  related: [
    {
      key: 'comments', label: 'Comments', path: '/documents/requests/:id/comments',
      columns: [
        { key: 'content', label: 'Comment', clip: true },
        { key: 'authorUserId', label: 'Author', type: 'id' },
        { key: 'createdAt', label: 'When', type: 'datetime' },
      ],
      create: {
        label: 'Add comment', permission: 'document_requests:manage', path: '/documents/requests/:id/comments',
        fields: [{ name: 'content', label: 'Comment', type: 'textarea', required: true, maxLength: 2000 }],
      },
      emptyMessage: 'No comments yet',
    },
  ],
};

/**
 * The published tariff for one programme in one term. Before this, every
 * invoice was typed by hand with a free-text description and an amount, which
 * cannot bill a cohort and cannot be checked against anything.
 *
 * Publishing is the point of no return: a published structure is what students
 * were billed against, so the API refuses to edit or delete one. Withdraw it
 * first, or supersede it.
 */
export const feeStructures = {
  key: 'fee-structures',
  label: 'Fee structures',
  singular: 'Fee structure',
  group: 'Finance',
  icon: '📐',
  description: 'The tariff a cohort is billed from. Mandatory items total into one invoice per student; optional items are offered but never billed automatically.',
  list: {
    path: '/fee-structures',
    filters: [
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'academicTermId', label: 'Term', type: 'select', lookup: 'academicTerms' },
    ],
    columns: [
      { key: 'program.code', label: 'Programme' },
      { key: 'term.academicYear', label: 'Year' },
      { key: 'term.semester', label: 'Semester' },
      {
        key: 'yearOfStudy', label: 'Year of study',
        render: (r) => el('span', { text: r.yearOfStudy === 0 ? 'All years' : `Year ${r.yearOfStudy}` }),
      },
      { key: 'mandatoryTotal', label: 'Billed each', type: 'money' },
      { key: 'isPublished', label: 'Published' },
    ],
  },
  detailPath: '/fee-structures/:id',
  detailFields: [
    { key: 'program.name', label: 'Programme' },
    { key: 'term.academicYear', label: 'Academic year' },
    { key: 'term.semester', label: 'Semester' },
    {
      key: 'yearOfStudy', label: 'Year of study',
      render: (r) => el('span', { text: r.yearOfStudy === 0 ? 'Every year of the programme' : `Year ${r.yearOfStudy}` }),
    },
    { key: 'isPublished', label: 'Published' },
    { key: 'publishedAt', label: 'Published at', type: 'datetime' },
    { key: 'mandatoryTotal', label: 'Billed each student', type: 'money' },
    { key: 'optionalTotal', label: 'Optional items total', type: 'money' },
    {
      key: 'items', label: 'Items',
      render: (r) => el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { text: 'Item' }),
          el('th', { text: 'Amount' }),
          el('th', { text: 'Billed' }),
        ])),
        el('tbody', {}, (r.items || []).map((item) => el('tr', {}, [
          el('td', {}, [
            el('div', { text: item.name }),
            item.description ? el('div', { class: 'card-sub', text: item.description }) : null,
          ]),
          el('td', { class: 'tabular', text: fmtMoney(item.amount) }),
          el('td', {}, badge(item.isMandatory ? 'Mandatory' : 'Optional', item.isMandatory ? 'ok' : '')),
        ]))),
      ]),
    },
  ],
  create: {
    path: '/fee-structures', permission: 'fee_structures:manage',
    subtitle: 'Created as a draft. Nothing is billed until it is published.',
    defaults: {
      items: [
        { name: 'Tuition', amount: 0, isMandatory: true },
        { name: 'Functional fees', amount: 0, isMandatory: true },
      ],
    },
    fields: [
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs', required: true },
      { name: 'academicTermId', label: 'Academic term', type: 'select', lookup: 'academicTerms', required: true },
      {
        name: 'yearOfStudy', label: 'Year of study', type: 'integer', min: 0, max: 10,
        help: '0 applies the tariff to every year of the programme.',
      },
      {
        name: 'items', label: 'Fee items', type: 'json', rows: 10, required: true,
        help: 'A list of { name, amount, isMandatory }. Only mandatory items are billed.',
      },
    ],
  },
  update: {
    path: '/fee-structures/:id', permission: 'fee_structures:manage',
    subtitle: 'Only a draft can be edited. Sending items replaces every line.',
    fields: [
      { name: 'yearOfStudy', label: 'Year of study', type: 'integer', min: 0, max: 10 },
      { name: 'items', label: 'Fee items', type: 'json', rows: 10 },
    ],
  },
  actions: [
    {
      key: 'publish', label: 'Publish', glyph: '✓', permission: 'fee_structures:manage',
      method: 'POST', path: '/fee-structures/:id/publish',
      confirm: 'Publish this tariff? Once published it cannot be edited — only withdrawn.',
      when: (f) => !f.isPublished,
      successMessage: 'Fee structure published.',
    },
    {
      key: 'withdraw', label: 'Withdraw', glyph: '↩', variant: 'danger',
      permission: 'fee_structures:manage', method: 'POST', path: '/fee-structures/:id/withdraw',
      confirm: 'Withdraw this tariff so it can be edited again? Invoices already raised against it are not touched.',
      when: (f) => f.isPublished,
      successMessage: 'Fee structure withdrawn.',
    },
    {
      key: 'generate', label: 'Bill the cohort', glyph: '🧾',
      permission: 'invoices:manage', method: 'POST', path: '/fee-structures/:id/generate-invoices',
      title: 'Raise invoices from this tariff',
      subtitle: 'Leave the dry run ticked first: it reports exactly what a real run would bill and writes nothing. Re-running never bills a student twice.',
      when: (f) => f.isPublished,
      initial: () => ({ dryRun: true }),
      fields: [
        { name: 'dueDate', label: 'Due date', type: 'datetime', required: true },
        { name: 'dryRun', label: 'Dry run — report only, write nothing', type: 'checkbox' },
      ],
      onResult: (result) => {
        notify.ok(result.dryRun
          ? `Dry run: ${result.wouldCreate} invoice(s) of ${fmtMoney(result.amountEach)} would be raised; ${result.skippedAlreadyBilled} already billed.`
          : `${result.created} invoice(s) of ${fmtMoney(result.amountEach)} raised; ${result.skippedAlreadyBilled} already billed.`);
      },
      successMessage: 'Done.',
    },
  ],
  remove: {
    path: '/fee-structures/:id', permission: 'fee_structures:manage',
    confirm: 'Delete this draft tariff?',
    when: (f) => !f.isPublished,
  },
};
