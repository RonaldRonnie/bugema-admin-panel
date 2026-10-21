/**
 * Enum values mirrored from prisma/schema.prisma and the API's constant files.
 * Kept here, in one place, so a schema change is a one-file edit in the console.
 */

export const E = {
  UserType: ['STUDENT', 'STAFF'],
  AccountStatus: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'LOCKED'],
  VerificationStatus: ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'],
  ProgramLevel: ['CERTIFICATE', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'PHD'],
  EmploymentType: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'VISITING'],
  ConversationType: ['DIRECT', 'GROUP'],
  ConversationParticipantRole: ['MEMBER', 'ADMIN'],
  NotificationChannel: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'],
  AnnouncementAudienceType: ['ALL', 'FACULTY', 'DEPARTMENT', 'PROGRAM', 'STAFF', 'LECTURERS', 'STUDENTS'],
  AnnouncementPriority: ['NORMAL', 'URGENT'],
  CampusLinkCategory: ['ACADEMIC_PORTAL', 'RESULTS', 'FINANCE', 'E_LEARNING', 'LIBRARY', 'ADMISSIONS', 'SUPPORT', 'OTHER'],
  CampusLocationCategory: ['BUILDING', 'LECTURE_ROOM', 'OFFICE', 'HOSTEL', 'LIBRARY', 'CLINIC', 'CAFETERIA', 'ADMIN_OFFICE', 'LANDMARK'],
  BookCopyStatus: ['AVAILABLE', 'BORROWED', 'RESERVED', 'LOST', 'DAMAGED'],
  LoanStatus: ['ACTIVE', 'RETURNED', 'OVERDUE'],
  ReservationStatus: ['PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
  HostelType: ['MALE', 'FEMALE', 'MIXED'],
  BedStatus: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'],
  AllocationStatus: ['ACTIVE', 'ENDED'],
  MaintenancePriority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  MaintenanceStatus: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RoomSwapRequestStatus: ['PENDING', 'APPROVED', 'REJECTED'],
  ClubMembershipRole: ['MEMBER', 'OFFICER', 'PRESIDENT'],
  EventRegistrationStatus: ['REGISTERED', 'CANCELLED', 'ATTENDED'],
  EventInteractionMode: ['NONE', 'HOTSEAT'],
  AppointmentStatus: ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  /** Only these three can be set through PATCH …/status — see update-appointment-status.dto.ts */
  SettableAppointmentStatus: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  Semester: ['SEMESTER_1', 'SEMESTER_2', 'SUMMER'],
  EnrollmentStatus: ['ENROLLED', 'DROPPED', 'COMPLETED'],
  DayOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
  ExamStatus: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
  AttendanceRecordStatus: ['PRESENT', 'SUSPICIOUS'],
  InvoiceStatus: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PaymentStatus: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'],
  DocumentRequestType: ['TRANSCRIPT', 'CLEARANCE_CERTIFICATE', 'RECOMMENDATION_LETTER', 'OTHER'],
  DocumentRequestStatus: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'READY'],
  LiveSessionType: ['COURSE_LESSON', 'WORSHIP_SERVICE'],
  LiveSessionStatus: ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
  DevicePlatform: ['IOS', 'ANDROID', 'WEB'],
  TicketCategory: ['WIFI', 'FACILITIES', 'ACADEMIC', 'IT_SUPPORT', 'OTHER'],
  TicketPriority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  TicketStatus: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  SafetyAlertStatus: ['ACTIVE', 'RESOLVED'],
  ScholarshipDiscountType: ['PERCENTAGE', 'FIXED_AMOUNT'],
  ScholarshipStatus: ['ACTIVE', 'REVOKED'],
  JobType: ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'],
  JobPostingStatus: ['OPEN', 'CLOSED'],
  JobApplicationStatus: ['SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'],
  /** 5.0 scale, from src/academics/constants/grade-points.constant.ts */
  Grade: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E', 'F'],
  SearchableType: ['users', 'faculties', 'departments', 'programs', 'announcements', 'events', 'clubs', 'courses', 'books', 'campus_locations'],
};

/** System role names seeded by the API (src/common/constants/system-roles.constants.ts). */
export const SYSTEM_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_ADMIN', 'LECTURER', 'STUDENT', 'LIBRARIAN',
  'ACCOMMODATION_OFFICER', 'HEALTH_STAFF', 'COUNSELOR', 'SECURITY_OFFICER', 'FINANCE_OFFICER',
];

/** Colour for a status-like value, so every table reads the same way. */
const TONES = {
  ok: ['ACTIVE', 'PAID', 'SUCCEEDED', 'COMPLETED', 'APPROVED', 'RESOLVED', 'AVAILABLE', 'PRESENT',
       'READY', 'VERIFIED', 'ACCEPTED', 'RETURNED', 'CONFIRMED', 'OPEN', 'LIVE', 'FULFILLED', 'ATTENDED'],
  warn: ['PENDING', 'PENDING_VERIFICATION', 'PARTIALLY_PAID', 'UNDER_REVIEW', 'PROCESSING', 'ASSIGNED',
         'IN_PROGRESS', 'REQUESTED', 'SUSPICIOUS', 'RESERVED', 'MAINTENANCE', 'PENDING_REVIEW',
         'SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'OVERDUE', 'HIGH', 'MEDIUM'],
  danger: ['SUSPENDED', 'DEACTIVATED', 'LOCKED', 'FAILED', 'REJECTED', 'CANCELLED', 'LOST', 'DAMAGED',
           'NO_SHOW', 'DROPPED', 'REVOKED', 'URGENT', 'EXPIRED'],
  info: ['SCHEDULED', 'ENROLLED', 'BORROWED', 'OCCUPIED', 'ENDED', 'CLOSED', 'REFUNDED', 'REGISTERED',
         'NORMAL', 'LOW', 'UNVERIFIED', 'STUDENT', 'STAFF'],
};

export function toneFor(value) {
  const v = String(value || '').toUpperCase();
  for (const [tone, values] of Object.entries(TONES)) if (values.includes(v)) return tone;
  return '';
}

/** SCREAMING_SNAKE → "Screaming snake", for labels and option text. */
export function humanize(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
