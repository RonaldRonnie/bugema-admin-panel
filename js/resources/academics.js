/** Academics: courses, offerings, enrolment, timetable, exams, attendance, live lessons. */
import { E } from '../enums.js';
import { el, badge, notify, openModal } from '../ui.js';
import { api } from '../api.js';

export const courses = {
  key: 'courses',
  label: 'Courses',
  singular: 'Course',
  group: 'Academics',
  icon: '📘',
  description: 'The course catalogue and its prerequisite graph. Prerequisites are checked when a student enrols.',
  list: {
    path: '/courses',
    searchable: true,
    filters: [{ name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' }],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'title', label: 'Title' },
      { key: 'creditUnits', label: 'Credit units' },
      { key: 'programId', label: 'Programme', type: 'id' },
      { key: 'createdAt', label: 'Created', type: 'datetime' },
    ],
  },
  detailPath: '/courses/:id',
  create: {
    path: '/courses', permission: 'courses:create',
    fields: [
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs', required: true },
      { name: 'code', label: 'Code', type: 'text', required: true, maxLength: 20 },
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { name: 'creditUnits', label: 'Credit units', type: 'integer', min: 0 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
    ],
  },
  update: {
    path: '/courses/:id', permission: 'courses:update',
    fields: [
      { name: 'programId', label: 'Programme', type: 'select', lookup: 'programs' },
      { name: 'code', label: 'Code', type: 'text', maxLength: 20 },
      { name: 'title', label: 'Title', type: 'text', maxLength: 200 },
      { name: 'creditUnits', label: 'Credit units', type: 'integer', min: 0 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
    ],
  },
  remove: { path: '/courses/:id', permission: 'courses:delete', confirm: 'Delete this course?' },
  toolbar: [
    {
      label: 'Sync from LMS', glyph: '⇄', permission: 'courses:create',
      run: async ({ reload }) => {
        try {
          const result = await api.post('/courses/lms-sync', {});
          notify.ok(`LMS sync finished: ${JSON.stringify(result)}`, 'Sync complete');
          reload();
        } catch (err) { notify.error(err); }
      },
    },
  ],
  related: [
    {
      key: 'prerequisites', label: 'Prerequisites', path: '/courses/:id/prerequisites',
      columns: [
        { key: 'code', label: 'Code' },
        { key: 'title', label: 'Title' },
      ],
      create: {
        label: 'Add prerequisite', permission: 'courses:update', path: '/courses/:id/prerequisites',
        fields: [{ name: 'prerequisiteCourseId', label: 'Prerequisite course', type: 'ref', lookup: 'courses', required: true }],
      },
      remove: { path: '/courses/:id/prerequisites/:childId', permission: 'courses:update', confirm: 'Remove this prerequisite?' },
      emptyMessage: 'No prerequisites',
    },
  ],
};

export const courseOfferings = {
  key: 'course-offerings',
  label: 'Course offerings',
  singular: 'Offering',
  group: 'Academics',
  icon: '🗓',
  description: 'A course taught by a named lecturer in one academic year and semester. Enrolment, timetable, exams and live lessons all hang off an offering.',
  list: {
    path: '/academics/course-offerings',
    filters: [
      { name: 'courseId', label: 'Course', type: 'ref', lookup: 'courses' },
      { name: 'lecturerUserId', label: 'Lecturer', type: 'ref', lookup: 'staff' },
      { name: 'academicYear', label: 'Academic year', type: 'text', placeholder: '2025/2026' },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester },
    ],
    columns: [
      { key: 'course.code', label: 'Course', render: (o) => o.course?.code ?? o.courseId },
      { key: 'course.title', label: 'Title', clip: true, render: (o) => o.course?.title ?? '—' },
      { key: 'academicYear', label: 'Year' },
      { key: 'semester', label: 'Semester' },
      { key: 'lecturerUserId', label: 'Lecturer', type: 'id' },
    ],
  },
  detailPath: '/academics/course-offerings/:id',
  create: {
    path: '/academics/course-offerings', permission: 'course_offerings:manage',
    fields: [
      { name: 'courseId', label: 'Course', type: 'ref', lookup: 'courses', required: true },
      { name: 'lecturerUserId', label: 'Lecturer', type: 'ref', lookup: 'staff', required: true },
      { name: 'academicYear', label: 'Academic year', type: 'text', required: true, maxLength: 50, placeholder: '2025/2026' },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester, required: true },
    ],
  },
  update: {
    path: '/academics/course-offerings/:id', permission: 'course_offerings:manage',
    fields: [
      { name: 'courseId', label: 'Course', type: 'ref', lookup: 'courses' },
      { name: 'lecturerUserId', label: 'Lecturer', type: 'ref', lookup: 'staff' },
      { name: 'academicYear', label: 'Academic year', type: 'text', maxLength: 50 },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester },
    ],
  },
  remove: { path: '/academics/course-offerings/:id', permission: 'course_offerings:manage', confirm: 'Delete this offering?' },
  actions: [
    {
      key: 'enroll', label: 'Enrol a student', glyph: '＋', permission: 'course_offerings:manage',
      method: 'POST', path: '/academics/course-offerings/:id/enroll',
      subtitle: 'Prerequisite completion is validated by the API.',
      fields: [{ name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students', required: true }],
      transform: (body) => body,
    },
  ],
  related: [
    {
      key: 'enrollments', label: 'Enrolments', path: '/academics/course-offerings/:id/enrollments',
      columns: [
        { key: 'studentUserId', label: 'Student', type: 'id' },
        { key: 'status', label: 'Status' },
        { key: 'grade', label: 'Grade' },
        { key: 'enrolledAt', label: 'Enrolled', type: 'datetime' },
      ],
      actions: [
        {
          label: 'Grade', method: 'PATCH', path: '/academics/enrollments/:childId/grade',
          permission: 'enrollment:manage',
          body: () => ({}),
          when: () => false,  // graded through the Enrolments screen, which has the form
        },
        {
          label: 'Drop', variant: 'danger', method: 'PATCH', path: '/academics/enrollments/:childId/drop',
          permission: 'enrollment:manage', when: (e) => e.status === 'ENROLLED',
        },
      ],
      emptyMessage: 'Nobody enrolled yet',
    },
    {
      key: 'schedule', label: 'Timetable', path: '/schedules', query: { limit: 100 },
      mapRows: (rows, offering) => rows.filter((s) => s.courseOfferingId === offering.id),
      columns: [
        { key: 'dayOfWeek', label: 'Day' },
        { key: 'startTime', label: 'From' },
        { key: 'endTime', label: 'To' },
        { key: 'roomLabel', label: 'Room' },
      ],
      emptyMessage: 'No timetable entries',
    },
    {
      key: 'exams', label: 'Exams', path: '/examinations', query: { limit: 100 },
      mapRows: (rows, offering) => rows.filter((x) => x.courseOfferingId === offering.id),
      columns: [
        { key: 'examDate', label: 'Date', type: 'datetime' },
        { key: 'durationMinutes', label: 'Minutes' },
        { key: 'venueLabel', label: 'Venue' },
        { key: 'status', label: 'Status' },
      ],
      emptyMessage: 'No exams scheduled',
    },
    {
      key: 'live', label: 'Live lessons', path: '/live-sessions',
      query: {}, columns: [
        { key: 'title', label: 'Title' },
        { key: 'scheduledStartAt', label: 'Starts', type: 'datetime' },
        { key: 'status', label: 'Status' },
      ],
      emptyMessage: 'No live lessons',
    },
  ],
};

export const enrollments = {
  key: 'enrollments',
  label: 'Enrolments',
  singular: 'Enrolment',
  group: 'Academics',
  icon: '📝',
  description: 'Create, grade and drop enrolments. Grading an enrolment moves it to COMPLETED.',
  list: {
    path: '/academics/course-offerings/:offeringId/enrollments',
    permission: 'enrollment:manage',
    needs: { offeringId: { label: 'Course offering', lookup: 'courseOfferings' } },
    columns: [
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'grade', label: 'Grade' },
      { key: 'gradePoint', label: 'Points' },
      { key: 'enrolledAt', label: 'Enrolled', type: 'datetime' },
    ],
  },
  detail: false,
  create: {
    path: '/academics/enrollments', permission: 'enrollment:manage',
    fields: [
      { name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings', required: true },
      { name: 'studentUserId', label: 'Student', type: 'ref', lookup: 'students', required: true },
    ],
  },
  actions: [
    {
      key: 'grade', label: 'Grade', inline: true, glyph: '✓', permission: 'enrollment:manage',
      method: 'PATCH', path: '/academics/enrollments/:id/grade',
      fields: [{ name: 'grade', label: 'Grade', type: 'enum', options: E.Grade, required: true }],
      when: (e) => e.status !== 'DROPPED',
    },
    {
      key: 'drop', label: 'Drop', inline: true, variant: 'danger', permission: 'enrollment:manage',
      method: 'PATCH', path: '/academics/enrollments/:id/drop',
      confirm: 'Drop this enrolment?',
      when: (e) => e.status === 'ENROLLED',
    },
  ],
};

export const schedules = {
  key: 'schedules',
  label: 'Timetable',
  singular: 'Timetable entry',
  group: 'Academics',
  icon: '⏰',
  description: 'Weekly class slots. Any change here notifies every enrolled student.',
  list: {
    path: '/schedules',
    filters: [{ name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings' }],
    columns: [
      { key: 'courseOfferingId', label: 'Offering', type: 'id' },
      { key: 'dayOfWeek', label: 'Day' },
      { key: 'startTime', label: 'From' },
      { key: 'endTime', label: 'To' },
      { key: 'roomLabel', label: 'Room' },
      { key: 'campusLocationId', label: 'Location', type: 'id' },
    ],
  },
  detail: false,
  create: {
    path: '/schedules', permission: 'schedules:manage',
    fields: [
      { name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings', required: true },
      { name: 'dayOfWeek', label: 'Day', type: 'enum', options: E.DayOfWeek, required: true },
      { name: 'startTime', label: 'Start time', type: 'time', required: true, help: '24-hour HH:MM' },
      { name: 'endTime', label: 'End time', type: 'time', required: true },
      { name: 'campusLocationId', label: 'Campus location', type: 'select', lookup: 'campusLocations' },
      { name: 'roomLabel', label: 'Room label', type: 'text', maxLength: 50 },
    ],
  },
  update: {
    path: '/schedules/:id', permission: 'schedules:manage',
    fields: [
      { name: 'dayOfWeek', label: 'Day', type: 'enum', options: E.DayOfWeek },
      { name: 'startTime', label: 'Start time', type: 'time' },
      { name: 'endTime', label: 'End time', type: 'time' },
      { name: 'campusLocationId', label: 'Campus location', type: 'select', lookup: 'campusLocations' },
      { name: 'roomLabel', label: 'Room label', type: 'text', maxLength: 50 },
    ],
  },
  remove: { path: '/schedules/:id', permission: 'schedules:manage', confirm: 'Delete this timetable entry? Enrolled students are notified.' },
};

export const examinations = {
  key: 'examinations',
  label: 'Examinations',
  singular: 'Exam',
  group: 'Academics',
  icon: '🧪',
  description: 'Exam sittings and their seat allocation. Generating seats assigns every enrolled student a seat number.',
  list: {
    path: '/examinations',
    filters: [{ name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings' }],
    columns: [
      { key: 'courseOfferingId', label: 'Offering', type: 'id' },
      { key: 'examDate', label: 'Date', type: 'datetime' },
      { key: 'durationMinutes', label: 'Minutes' },
      { key: 'venueLabel', label: 'Venue' },
      { key: 'status', label: 'Status' },
    ],
  },
  create: {
    path: '/examinations', permission: 'exams:manage',
    fields: [
      { name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings', required: true },
      { name: 'examDate', label: 'Date and time', type: 'datetime', required: true },
      { name: 'durationMinutes', label: 'Duration (minutes)', type: 'integer', required: true, min: 1 },
      { name: 'campusLocationId', label: 'Campus location', type: 'select', lookup: 'campusLocations' },
      { name: 'venueLabel', label: 'Venue label', type: 'text', maxLength: 100 },
    ],
  },
  update: {
    path: '/examinations/:id', permission: 'exams:manage',
    fields: [
      { name: 'examDate', label: 'Date and time', type: 'datetime' },
      { name: 'durationMinutes', label: 'Duration (minutes)', type: 'integer', min: 1 },
      { name: 'campusLocationId', label: 'Campus location', type: 'select', lookup: 'campusLocations' },
      { name: 'venueLabel', label: 'Venue label', type: 'text', maxLength: 100 },
    ],
  },
  remove: { path: '/examinations/:id', permission: 'exams:manage', confirm: 'Delete this exam?' },
  actions: [
    {
      key: 'seats', label: 'Generate seat allocation', glyph: '🪑', permission: 'exams:manage',
      method: 'POST', path: '/examinations/:id/seat-allocations/generate',
      confirm: 'Generate seat numbers for every student enrolled in this offering?',
      successMessage: 'Seats allocated.',
    },
  ],
  related: [
    {
      key: 'seats', label: 'Seat allocation', path: '/examinations/:id/seat-allocations',
      columns: [
        { key: 'seatNumber', label: 'Seat' },
        { key: 'studentUserId', label: 'Student', type: 'id' },
      ],
      emptyMessage: 'No seats allocated — use the Generate action',
    },
  ],
};

export const attendance = {
  key: 'attendance',
  label: 'Attendance',
  singular: 'Attendance session',
  group: 'Academics',
  icon: '📍',
  description: 'Open a QR check-in window for a class. Out-of-geofence check-ins are recorded as SUSPICIOUS rather than rejected, and only the derived distance is stored — never raw coordinates.',
  list: {
    path: '/attendance/sessions/:sessionId/records',
    needs: { sessionId: { label: 'Attendance session ID', free: true } },
    paginated: false,
    columns: [
      { key: 'studentUserId', label: 'Student', type: 'id' },
      { key: 'status', label: 'Status' },
      { key: 'distanceMeters', label: 'Distance (m)' },
      { key: 'checkedInAt', label: 'Checked in', type: 'datetime' },
      { key: 'deviceInfo', label: 'Device', clip: true },
    ],
  },
  detail: false,
  create: {
    path: '/attendance/sessions', permission: 'attendance:manage',
    title: 'Open an attendance session',
    label: 'Open session',
    fields: [
      { name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings', required: true },
      { name: 'durationMinutes', label: 'Open for (minutes)', type: 'integer', min: 1, default: 15 },
      { name: 'latitude', label: 'Latitude', type: 'number', help: 'Optional geofence centre.' },
      { name: 'longitude', label: 'Longitude', type: 'number' },
      { name: 'geofenceRadiusMeters', label: 'Geofence radius (m)', type: 'integer', min: 1 },
    ],
    successMessage: 'Session opened — share the QR token with the class.',
  },
};

export const liveSessions = {
  key: 'live-sessions',
  label: 'Live lessons',
  singular: 'Live lesson',
  group: 'Academics',
  icon: '🎥',
  description: 'Streamed lessons for a course offering. The list view never carries the join link — open a session to get it.',
  list: {
    path: '/live-sessions',
    needs: { courseOfferingId: { label: 'Course offering', lookup: 'courseOfferings' } },
    paginated: false,
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'scheduledStartAt', label: 'Starts', type: 'datetime' },
      { key: 'scheduledEndAt', label: 'Ends', type: 'datetime' },
      { key: 'status', label: 'Status' },
    ],
  },
  detailPath: '/live-sessions/:id',
  create: {
    path: '/live-sessions', permission: 'live_sessions:manage',
    fields: [
      { name: 'courseOfferingId', label: 'Course offering', type: 'select', lookup: 'courseOfferings', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 200 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'scheduledStartAt', label: 'Scheduled start', type: 'datetime', required: true },
      { name: 'scheduledEndAt', label: 'Scheduled end', type: 'datetime', required: true },
    ],
  },
  update: {
    path: '/live-sessions/:id', permission: 'live_sessions:manage',
    fields: [
      { name: 'title', label: 'Title', type: 'text', maxLength: 200 },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
      { name: 'scheduledStartAt', label: 'Scheduled start', type: 'datetime' },
      { name: 'scheduledEndAt', label: 'Scheduled end', type: 'datetime' },
      { name: 'status', label: 'Status', type: 'enum', options: E.LiveSessionStatus },
    ],
  },
  actions: [
    { key: 'start', label: 'Start', glyph: '▶', method: 'PATCH', path: '/live-sessions/:id/start', permission: 'live_sessions:manage', when: (s) => s.status === 'SCHEDULED' },
    { key: 'end', label: 'End', glyph: '■', variant: 'danger', method: 'PATCH', path: '/live-sessions/:id/end', permission: 'live_sessions:manage', when: (s) => s.status === 'LIVE' },
    {
      key: 'join', label: 'Get join link', glyph: '🔗', method: 'POST', path: '/live-sessions/:id/join',
      onResult: (result) => showJoinLink(result),
      successMessage: 'Join link issued.',
    },
  ],
  related: [
    {
      key: 'attendance', label: 'Attendance', path: '/live-sessions/:id/attendance',
      columns: [
        { key: 'userId', label: 'User', type: 'id' },
        { key: 'joinedAt', label: 'Joined', type: 'datetime' },
        { key: 'leftAt', label: 'Left', type: 'datetime' },
      ],
      emptyMessage: 'Nobody has joined',
    },
  ],
};

/** Shared by live lessons and worship services — both return `{ joinUrl }`. */
export function showJoinLink(result) {
  const url = result?.joinUrl || result?.url;
  if (!url) { notify.info('The API returned no join URL.'); return; }
  openModal({
    title: 'Join link',
    render: () => el('div', {}, [
      el('p', { class: 'card-sub', text: 'Issued by the streaming provider. Anyone with this link can join the session.' }),
      el('input', { type: 'text', value: url, readonly: true, onFocus: (e) => e.target.select() }),
      el('div', { class: 'mt-16' }, el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-primary', text: 'Open in a new tab' })),
    ]),
  });
}

/**
 * The academic calendar. Until this existed a semester was only an enum value,
 * so nothing in the system could tell when it ran — registration windows and
 * invoice due dates had no date to key off.
 */
export const academicTerms = {
  key: 'academic-terms',
  label: 'Academic calendar',
  singular: 'Academic term',
  group: 'Academics',
  icon: '🗓',
  description: 'Each (year, semester) with real boundaries, plus the registration and examination windows. Exactly one term is current at a time; marking a new one stands the previous down.',
  list: {
    path: '/academic-terms',
    filters: [
      { name: 'academicYear', label: 'Academic year', type: 'text', placeholder: '2026/2027' },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester },
    ],
    columns: [
      { key: 'academicYear', label: 'Year' },
      { key: 'semester', label: 'Semester' },
      { key: 'name', label: 'Name', clip: true },
      { key: 'startDate', label: 'Starts', type: 'date' },
      { key: 'endDate', label: 'Ends', type: 'date' },
      { key: 'registrationEndDate', label: 'Registration closes', type: 'date' },
      { key: 'isCurrent', label: 'Current' },
    ],
  },
  detailPath: '/academic-terms/:id',
  create: {
    path: '/academic-terms', permission: 'academic_terms:manage',
    subtitle: 'The academic year must be written as "2026/2027" — it is the string that joins this term to the course offerings and invoices already carrying one.',
    fields: [
      { name: 'academicYear', label: 'Academic year', type: 'text', required: true, placeholder: '2026/2027' },
      { name: 'semester', label: 'Semester', type: 'enum', options: E.Semester, required: true },
      { name: 'name', label: 'Display name', type: 'text', maxLength: 150, placeholder: 'Semester One 2026/2027' },
      { name: 'startDate', label: 'Term starts', type: 'datetime', required: true },
      { name: 'endDate', label: 'Term ends', type: 'datetime', required: true },
      { name: 'registrationStartDate', label: 'Registration opens', type: 'datetime' },
      { name: 'registrationEndDate', label: 'Registration closes', type: 'datetime' },
      { name: 'examStartDate', label: 'Examinations start', type: 'datetime' },
      { name: 'examEndDate', label: 'Examinations end', type: 'datetime' },
      { name: 'isCurrent', label: 'Make this the current term', type: 'checkbox' },
    ],
  },
  update: {
    path: '/academic-terms/:id', permission: 'academic_terms:manage',
    fields: [
      { name: 'name', label: 'Display name', type: 'text', maxLength: 150 },
      { name: 'startDate', label: 'Term starts', type: 'datetime' },
      { name: 'endDate', label: 'Term ends', type: 'datetime' },
      { name: 'registrationStartDate', label: 'Registration opens', type: 'datetime' },
      { name: 'registrationEndDate', label: 'Registration closes', type: 'datetime' },
      { name: 'examStartDate', label: 'Examinations start', type: 'datetime' },
      { name: 'examEndDate', label: 'Examinations end', type: 'datetime' },
      { name: 'isCurrent', label: 'Make this the current term', type: 'checkbox' },
    ],
  },
  actions: [
    {
      key: 'set-current', label: 'Make current', glyph: '★',
      permission: 'academic_terms:manage', method: 'PATCH', path: '/academic-terms/:id',
      confirm: 'Make this the current term? Whichever term holds it now stands down.',
      body: () => ({ isCurrent: true }),
      when: (t) => !t.isCurrent,
      successMessage: 'Current term updated.',
    },
  ],
  remove: {
    path: '/academic-terms/:id', permission: 'academic_terms:manage',
    confirm: 'Delete this term? Rejected if it still carries fee structures.',
  },
};
