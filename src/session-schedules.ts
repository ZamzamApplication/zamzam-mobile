export const WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
export type ScheduleInput = {
  name: string | null;
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  timezone: string;
  membership_mode: 'all' | 'categories' | 'students';
  member_ids: number[];
  is_active: boolean;
};
export type SessionSchedule = ScheduleInput & {
  id: number;
  version: number;
  upcoming: { date: string; session_id: number | null; status: string }[];
};
export function schedulePayload(schedule: SessionSchedule) {
  const { id, version, upcoming, ...input } = schedule;
  return { ...input, expected_version: version };
}
