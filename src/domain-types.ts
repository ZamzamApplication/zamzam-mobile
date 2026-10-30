export interface User {
  id: number;
  username: string;
  role: 'super_admin' | 'admin' | 'sheikh' | 'auditor';
  global_role?: 'super_admin' | 'admin' | 'sheikh' | 'auditor';
  sheikh_id: number | null;
  attendance_all_students_access?: boolean;
  tahfiz_id: number | null;
  default_tahfiz_id?: number | null;
  capabilities?: string[];
  memberships?: TahfizMembership[];
  tahfiz?: {
    id: number;
    name: string;
    status: 'pending' | 'active' | 'rejected' | 'suspended';
    status_reason?: string | null;
    week_start_day?: number;
    month_start_day?: number;
    attendance_statuses?: string[];
    attendance_status_colors?: Record<string, string>;
    excel_export_templates?: import('./excel-templates').ExcelExportTemplates;
    excused_absence_streak_limit?: number;
    excused_absence_reset_statuses?: string[];
    attendance_streak_alert_enabled?: boolean;
    attendance_sheikh_selection_enabled?: boolean;
    restrict_sheikh_student_access?: boolean;
    attendance_streak_status?: string;
    attendance_streak_limit?: number;
    attendance_streak_reset_statuses?: string[];
    present_status?: string;
    absent_status?: string;
    multiple_sessions_per_day_enabled?: boolean;
    session_name_options?: string[];
    sheikh_custom_fields_enabled?: boolean;
    whatsend_enabled?: boolean;
    progress_tracking_enabled?: boolean;
    progress_categories?: WardCategory[];
    progress_quality_options?: import('./quran').QualityOption[];
  } | null;
}

export interface TahfizMembership {
  id: number;
  tahfiz_id: number;
  tahfiz_name: string;
  tahfiz_status: 'pending' | 'active' | 'rejected' | 'suspended';
  role: 'admin' | 'sheikh' | 'auditor';
  sheikh_id: number | null;
  is_active?: boolean;
}

export interface TahfizInvitation {
  id: number;
  tahfiz_id: number;
  tahfiz_name?: string;
  role: 'admin' | 'sheikh';
  sheikh_id: number | null;
  sheikh_name?: string | null;
  status: 'active' | 'used' | 'revoked' | 'expired';
  created_at: string;
  expires_at: string;
  used_at?: string | null;
  used_by_id?: number | null;
  creator_username?: string | null;
  available?: boolean;
  already_member?: boolean;
  token?: string;
  path?: string;
}

export type FeedbackCategory = 'bug' | 'suggestion' | 'other';
export type FeedbackStatus = 'open' | 'in_review' | 'resolved' | 'not_an_issue';

export interface FeedbackReport {
  id: number;
  reporter_user_id: number | null;
  reporter_username: string;
  tahfiz_id: number | null;
  tahfiz_name: string | null;
  category: FeedbackCategory;
  title: string;
  description: string;
  page_url: string | null;
  status: FeedbackStatus;
  resolution_note: string | null;
  reviewed_by_id: number | null;
  reviewer_username: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogActor {
  id: number;
  username: string;
}

export interface AuditLogItem {
  id: number;
  actor_user_id: number;
  actor_username: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  actions: string[];
  actors: AuditLogActor[];
}

export interface Circle {
  id: number;
  name: string;
  description?: string;
  max_warnings?: number;
  week_start_day?: number;
  month_start_day?: number;
  attendance_statuses?: string[];
  attendance_status_colors?: Record<string, string>;
  excel_export_templates?: import('./excel-templates').ExcelExportTemplates;
  excused_absence_streak_limit?: number;
  excused_absence_reset_statuses?: string[];
  attendance_streak_alert_enabled?: boolean;
  attendance_sheikh_selection_enabled?: boolean;
  restrict_sheikh_student_access?: boolean;
  attendance_streak_status?: string;
  attendance_streak_limit?: number;
  attendance_streak_reset_statuses?: string[];
  present_status?: string;
  absent_status?: string;
  multiple_sessions_per_day_enabled?: boolean;
  session_name_options?: string[];
  sheikh_custom_fields_enabled?: boolean;
  contact_phone?: string;
  whatsend_api_url?: string;
  whatsend_groups_url?: string;
  whatsend_api_key_configured?: boolean;
  whatsend_enabled?: boolean;
  progress_tracking_enabled?: boolean;
  progress_categories?: WardCategory[];
  progress_quality_options?: import('./quran').QualityOption[];
  subscriptions_enabled?: boolean;
  subscription_default_fee_minor?: number;
  subscription_currency?: string;
  expense_categories?: ExpenseCategory[];
}

export interface Session {
  id: number;
  date: string;
  name?: string | null;
  daily_sequence?: number;
  explicit_membership?: boolean;
  student_count?: number;
  is_confirmed: boolean;
  quran_progress_enabled: boolean;
  status?: 'draft' | 'confirmed' | 'reopened';
  version?: number;
  circle_id: number;
  circle_name?: string;
}

export interface StudentAttendance {
  id: number;
  name: string;
  phone?: string;
  profile_pic?: string | null;
  attendance_id: number | null;
  status: string;
  notes?: string;
  sheikh_id: number | null;
  quran_progress_enabled?: boolean;
}

export interface SheikhGroup {
  sheikh: { id: number; name: string };
  students: StudentAttendance[];
}

export interface SessionAttendance {
  session_id: number;
  date: string;
  name?: string | null;
  daily_sequence?: number;
  explicit_membership?: boolean;
  student_count?: number;
  is_confirmed: boolean;
  quran_progress_enabled: boolean;
  status?: 'draft' | 'confirmed' | 'reopened';
  version: number;
  circle_id: number;
  circle_name?: string;
  sheikh_groups: SheikhGroup[];
  circle_sheikhs: { id: number; name: string }[];
}

export interface SheikhInfo {
  id: number;
  name: string;
  phone?: string;
  whatsapp_group_id?: string;
  attendance_all_students_access?: boolean;
  circle_id: number;
  circle_name: string;
  week_start_day?: number;
  month_start_day?: number;
}

export interface SheikhDeletionStudent {
  id: number;
  name: string;
  student_id?: string | null;
  phone?: string | null;
  status: string;
}

export interface SheikhDeletionPreview {
  sheikh: { id: number; name: string };
  students: SheikhDeletionStudent[];
  destination_sheikhs: Array<{ id: number; name: string }>;
  linked_usernames: string[];
}

export interface SheikhStudentDeletionResolution {
  student_id: number;
  action: 'reassign' | 'delete';
  sheikh_id?: number | null;
}

export interface MoveStudentResult {
  message: string;
  student_id: number;
  from_sheikh_id: number | null;
  destination_sheikh: { id: number; name: string };
}

export type SubscriptionPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'mobile_wallet'
  | 'other';

export interface SubscriptionSettings {
  enabled: boolean;
  default_monthly_fee_minor: number;
  currency: string;
  month_start_day?: number;
  current_period_start?: string;
  current_period_end?: string;
}

export interface SubscriptionMonthRecord {
  id: number;
  student_id: number | null;
  student_name: string;
  student_code: string | null;
  student_phone?: string | null;
  sheikh_id: number | null;
  sheikh_name: string | null;
  period_start: string;
  period_end: string;
  fee_minor: number;
  student_fee_override_minor?: number | null;
  is_paid: boolean;
  payment_date: string | null;
  payment_method: SubscriptionPaymentMethod | null;
  payment_note: string | null;
  receipt_number: string | null;
}

export interface ExpenseCategory {
  id: string;
  label: string;
  enabled: boolean;
}

export interface ExpenseRecord {
  id: number;
  name: string;
  category_id: string;
  category_label: string;
  amount_minor: number;
  currency: string;
  expense_date: string;
  payment_method: SubscriptionPaymentMethod;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpensePage {
  items: ExpenseRecord[];
  total: number;
  total_minor: number;
  page: number;
  page_size: number;
}

export interface FinanceOverview {
  period_start: string;
  period_end: string;
  currency: string;
  cash_collected_minor: number;
  expenses_minor: number;
  net_cash_minor: number;
  expected_subscriptions_minor: number;
  collected_subscriptions_minor: number;
  outstanding_subscriptions_minor: number;
  payment_methods: Array<{
    method: SubscriptionPaymentMethod;
    income_minor: number;
    expenses_minor: number;
    net_minor: number;
  }>;
}

export interface SubscriptionMonthSummary {
  expected_minor: number;
  collected_minor: number;
  unpaid_minor: number;
  paid_count: number;
  unpaid_count: number;
}

export interface SubscriptionMonthsResponse {
  items: SubscriptionMonthRecord[];
  total: number;
  page: number;
  page_size: number;
  summary: SubscriptionMonthSummary;
}

export interface SubscriptionReceipt extends SubscriptionMonthRecord {
  tahfiz_name: string;
  currency?: string;
  recorded_by_username?: string | null;
}

export interface StudentCurrentSubscription {
  enabled: boolean;
  effective_fee_minor: number;
  currency?: string;
  record: SubscriptionMonthRecord | null;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

export interface ParentPhone {
  id: number;
  phone_number: string;
  parent_type: string;
  name?: string;
}

export interface WarningInfo {
  id: number;
  reason: string;
  warning_number: number;
  sent: boolean;
  sent_at?: string;
  created_at: string;
}

export interface WarningRow {
  id: number;
  student_id: number;
  student_name: string;
  sheikh_id: number | null;
  sheikh_name: string | null;
  reason: string;
  warning_number: number;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface ExcusedWeekdayInfo {
  id?: number;
  weekday: number;
  note?: string | null;
}

export interface ExcusedPeriodInfo {
  id: number;
  student_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentInfo {
  id: number;
  name: string;
  phone?: string;
  student_id?: string;
  birthday?: string;
  profile_pic?: string | null;
  status: string;
  registration_date?: string;
  sort_order?: number;
  warnings: WarningInfo[];
  sheikh?: { id: number; name: string };
  parent_phones?: ParentPhone[];
  excused_weekdays?: ExcusedWeekdayInfo[];
  excused_periods?: ExcusedPeriodInfo[];
  categories?: StudentCategory[];
  category_ids?: number[];
  custom_field_values?: Record<string, string>;
  quran_progress_enabled?: boolean;
}

export type StudentCustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select';

export interface StudentCustomField {
  id: number;
  name: string;
  field_type: StudentCustomFieldType;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_by_user_id?: number | null;
  can_edit: boolean;
}

export interface StudentCategory {
  id: number;
  name: string;
  student_count?: number;
}

export interface AttendanceThresholdAlert {
  student_id: number;
  student_name: string;
  streak: number;
  limit: number;
  status: string;
}

export interface StudentProfile extends StudentInfo {
  parent_phones: ParentPhone[];
  excused_weekdays: ExcusedWeekdayInfo[];
  excused_periods: ExcusedPeriodInfo[];
  attendance: {
    total: number;
    present: number;
    present_status?: string;
    absent: number;
    excused: number;
    not_applicable: number;
    streak: number;
    streak_limit: number;
    streak_status: string;
    streak_alert_enabled: boolean;
  };
  progress: {
    enabled: boolean;
    student_enabled: boolean;
    categories: WardCategory[];
    entries: number;
    average_quality: number;
    active_goals: number;
  };
  can_manage: boolean;
}

export interface UserInfo {
  id: number;
  username: string;
  role: 'admin' | 'sheikh' | 'auditor';
  sheikh_id: number | null;
}

export interface CircleAttendanceRate {
  circle_id: number;
  scope?: 'tenant' | 'assigned_students';
  total_attendance_records: number;
  total_applicable_records?: number;
  status_counts: Record<string, number>;
  present: number;
  absent: number;
  excused: number;
  not_applicable?: number;
  attendance_rate: number;
}

export interface StudentStreak {
  student_id: number;
  total_attended: number;
  total_excused: number;
  total_absent: number;
  total_sessions: number;
  attendance_rate: number;
}

export interface AttendanceGridSession {
  id: number;
  date: string;
  name?: string | null;
  daily_sequence?: number;
  circle_id: number;
}

export interface FilterRule {
  target?: 'session' | 'weekday';
  sessionId: number;
  weekday?: number;
  operator: 'is' | 'is_not';
  status: string;
  connector?: 'and' | 'or';
}

export interface FilterGroup {
  id: string;
  connector?: 'and' | 'or';
  rules: FilterRule[];
}

export interface AttendanceGridStudent {
  id: number;
  name: string;
  profile_pic?: string | null;
  sheikh_id: number | null;
  sheikh_name?: string | null;
  next_warning_number: number;
  remaining_warnings: number;
  subscription_amount_minor?: number | null;
  quran_progress_ranges?: Partial<
    Record<
      WardCategory,
      {
        first: QuranRangeSnapshot;
        last: QuranRangeSnapshot;
      }
    >
  >;
  custom_field_values?: Record<string, string>;
  records: Record<string, string | null>;
}

export interface AttendanceGrid {
  scope?: 'tenant' | 'assigned_students';
  sessions: AttendanceGridSession[];
  students: AttendanceGridStudent[];
}

export interface StudentStatsItem {
  student_id: number;
  student_name: string;
  profile_pic?: string | null;
  sheikh_name: string;
  total_sessions: number;
  total_applicable_sessions?: number;
  status_counts: Record<string, number>;
  present: number;
  excused: number;
  absent: number;
  not_applicable: number;
  attendance_rate: number;
}

export interface CircleStudentStatsResponse {
  circle_id: number;
  scope?: 'tenant' | 'assigned_students';
  students: StudentStatsItem[];
}

export type ProgressCategory = string;
export type QuranRangeType = 'surah_ayah' | 'page';
export type QuranDirection = 'forward' | 'backward';
export type WardCategory = string;
export type WardIncrementUnit =
  | 'ayahs'
  | 'lines'
  | 'pages'
  | 'juz'
  | 'hizb'
  | 'quarter'
  | 'half_page';

export interface QuranRangeSnapshot {
  direction?: QuranDirection;
  range_type: QuranRangeType;
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
  from_page: number | null;
  to_page: number | null;
}

export interface StudentQuranPlan {
  direction?: QuranDirection;
  id?: number;
  student_id: number;
  category: WardCategory;
  increment_unit: WardIncrementUnit;
  increment_amount: number;
  next_surah: number | null;
  next_ayah: number | null;
  next_page: number | null;
  updated_at?: string;
  completed_at?: string | null;
}

export interface QuranProgressEntry {
  direction?: QuranDirection;
  id: number;
  session_id: number;
  student_id: number;
  sheikh_id: number | null;
  recorded_by_id: number;
  category: ProgressCategory;
  range_type: QuranRangeType;
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
  from_page: number | null;
  to_page: number | null;
  quality_score: number;
  mistakes: number;
  notes: string | null;
  next_assignment: string | null;
  created_at: string;
  updated_at: string;
  session_date?: string | null;
}

export interface QuranProgressTrendPoint {
  entry_id: number;
  session_date: string;
  category: ProgressCategory;
  quality_score: number;
  mistakes: number;
}

export interface QuranProgressRevision {
  id: number;
  progress_entry_id: number;
  session_id: number;
  category: ProgressCategory;
  editor_user_id: number;
  editor_username: string;
  before: Partial<QuranProgressInput>;
  after: Partial<QuranProgressInput>;
  created_at: string;
}

export interface QuranProgressInput {
  direction?: QuranDirection;
  student_id: number;
  sheikh_id?: number | null;
  category: ProgressCategory;
  range_type: QuranRangeType;
  from_surah?: number | null;
  from_ayah?: number | null;
  to_surah?: number | null;
  to_ayah?: number | null;
  from_page?: number | null;
  to_page?: number | null;
  quality_score: number;
  mistakes?: number;
  notes?: string | null;
  next_assignment?: string | null;
}

export interface StudentGoal {
  id: number;
  student_id: number;
  range_type: QuranRangeType;
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
  from_page: number | null;
  to_page: number | null;
  target_date: string | null;
  notes: string | null;
  status: 'active' | 'completed' | 'cancelled';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
