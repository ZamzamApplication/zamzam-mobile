export type Role = 'admin' | 'super_admin' | 'sheikh' | 'auditor';
export interface Membership {
  id: number;
  tahfiz_id: number;
  tahfiz_name: string;
  tahfiz_status: string;
  role: Role;
  sheikh_id: number | null;
  is_active?: boolean;
}
export interface Settings {
  id: number;
  name: string;
  description?: string;
  contact_phone?: string;
  status?: string;
  max_warnings?: number;
  week_start_day?: number;
  month_start_day?: number;
  attendance_statuses?: string[];
  attendance_status_colors?: Record<string, string>;
  present_status?: string;
  absent_status?: string;
  attendance_sheikh_selection_enabled?: boolean;
  restrict_sheikh_student_access?: boolean;
  multiple_sessions_per_day_enabled?: boolean;
  session_name_options?: string[];
  sheikh_custom_fields_enabled?: boolean;
  attendance_streak_alert_enabled?: boolean;
  attendance_streak_status?: string;
  attendance_streak_limit?: number;
  attendance_streak_reset_statuses?: string[];
  progress_tracking_enabled?: boolean;
  progress_categories?: string[];
  progress_quality_options?: { value: number; label: string }[];
  attendance_status_renames?: Record<string, string>;
  excel_export_templates?: import('./excel-templates').ExcelExportTemplates;
  whatsend_enabled?: boolean;
  whatsend_api_url?: string;
  whatsend_groups_url?: string;
  whatsend_api_key_configured?: boolean;
}
export interface Invitation {
  id: number;
  role: 'admin' | 'sheikh';
  status: string;
  sheikh_name?: string;
  expires_at: string;
  path?: string;
  available?: boolean;
}
export interface User {
  id: number;
  username: string;
  role: Role;
  tahfiz_id: number | null;
  sheikh_id: number | null;
  attendance_all_students_access?: boolean;
  capabilities?: string[];
  memberships?: Membership[];
  tahfiz?: Settings | null;
}
export interface Session {
  id: number;
  date: string;
  name?: string | null;
  daily_sequence?: number;
  circle_id: number;
  circle_name?: string;
  is_confirmed: boolean;
  quran_progress_enabled: boolean;
  version?: number;
  status?: string;
  student_count?: number;
}
export interface DashboardSummary {
  tahfiz_name: string;
  sheikhs: number;
  students: number;
  sessions: number;
  confirmed_sessions: number;
  pending_sessions: number;
}
export interface Student {
  id: number;
  name: string;
  profile_pic?: string | null;
  attendance_id: number | null;
  status: string;
  notes?: string | null;
  sheikh_id: number | null;
  revision?: number;
}
export interface Roster extends Omit<Session, 'id'> {
  session_id: number;
  version: number;
  sheikh_groups: {
    sheikh: { id: number; name: string };
    students: Student[];
  }[];
  circle_sheikhs: { id: number; name: string }[];
}
export interface AttendanceUpdate {
  student_id: number;
  status: string;
  notes: string | null;
  sheikh_id: number | null;
}
export interface Grid {
  scope?: string;
  sessions: Session[];
  students: {
    id: number;
    name: string;
    sheikh_id: number | null;
    sheikh_name?: string;
    records: Record<string, string | null>;
  }[];
}
export interface Gateway {
  demo: boolean;
  deviceId: string;
  accountKey: string;
  request<T>(path: string, options?: RequestInit): Promise<T>;
  switchTenant(id: number): Promise<User>;
  selectCachedTenant(user: User): Promise<void>;
  cacheUser?(user: User): Promise<void>;
  resolveMedia?(path: string): string;
  logout(): Promise<void>;
}
export const canManage = (user: User) =>
  user.role === 'admin' || user.role === 'super_admin';
export const statusesFor = (settings?: Settings | null) => {
  const values = [
    ...new Set(
      settings?.attendance_statuses?.map(s => s.trim()).filter(Boolean),
    ),
  ];
  return values.length ? values : ['حاضر', 'غياب', 'غياب بعذر', 'لا ينطبق'];
};
export const presentFor = (s?: Settings | null) =>
  statusesFor(s).includes(s?.present_status || '')
    ? s!.present_status!
    : statusesFor(s)[0];
export const absentFor = (s?: Settings | null) =>
  statusesFor(s).includes(s?.absent_status || '')
    ? s!.absent_status!
    : statusesFor(s).find(v => v !== presentFor(s)) || statusesFor(s)[0];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
export function uid() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function monthRange(value: string, startDay = 1) {
  const [year, month] = value.split('-').map(Number);
  return {
    start: localDate(new Date(year, month - 1, startDay)),
    end: localDate(new Date(year, month, startDay - 1)),
  };
}
export function financialMonth(startDay = 1, date = new Date()) {
  const d = new Date(
    date.getFullYear(),
    date.getMonth() - (date.getDate() < startDay ? 1 : 0),
    1,
  );
  return localDate(d).slice(0, 7);
}
