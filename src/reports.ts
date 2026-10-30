import type { StudentStatsItem } from './domain-types';

export interface ReportFilters {
  from: string;
  to: string;
  sheikh: string;
}
export interface AuditFilters {
  from: string;
  to: string;
  query: string;
  action: string;
  actor: string;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
    return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function rangeError(from: string, to: string, required = false) {
  if (
    (required && (!from || !to)) ||
    (from && !validDate(from)) ||
    (to && !validDate(to))
  )
    return 'أدخل تاريخاً صحيحاً بصيغة YYYY-MM-DD.';
  return from && to && from > to
    ? 'تاريخ البداية يجب أن يسبق النهاية أو يساويها.'
    : '';
}
export function queryString(values: Record<string, string | number>) {
  return Object.entries(values)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
export function reportPaths(tenant: number, filters: ReportFilters) {
  const query = queryString({
    date_from: filters.from,
    date_to: filters.to,
    sheikh_id: filters.sheikh,
  });
  return {
    rate: `/reports/circle/${tenant}/rate?${query}`,
    students: `/reports/circle/${tenant}/student-stats?${query}`,
    quran: `/reports/quran-progress?${query}`,
  };
}
export function auditPath(filters: AuditFilters, page: number) {
  return (
    '/audit-logs?' +
    queryString({
      page,
      page_size: 25,
      date_from: filters.from,
      date_to: filters.to,
      query: filters.query.trim(),
      action: filters.action,
      actor_user_id: filters.actor,
    })
  );
}
export function reportStudents(
  rows: StudentStatsItem[],
  query: string,
  sort: string,
) {
  return rows
    .filter(row =>
      `${row.student_name} ${row.sheikh_name}`.includes(query.trim()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.student_name.localeCompare(b.student_name, 'ar')
        : sort === 'high'
        ? b.attendance_rate - a.attendance_rate
        : a.attendance_rate - b.attendance_rate,
    );
}
