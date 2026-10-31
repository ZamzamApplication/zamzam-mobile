import type {
  FilterGroup,
  FilterRule,
  AttendanceGridStudent,
  AttendanceGridSession,
} from './domain-types';
export function parseFilterGroups(raw: string): FilterGroup[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('بيانات التصفية المحفوظة غير صالحة.');
  }
  if (!Array.isArray(value) || value.length > 20)
    throw new Error('بيانات التصفية المحفوظة غير صالحة.');
  return value.map((g, i) => {
    if (
      !g ||
      typeof g !== 'object' ||
      !Array.isArray(g.rules) ||
      g.rules.length > 50 ||
      (g.connector !== undefined && !['and', 'or'].includes(g.connector))
    )
      throw new Error('مجموعة تصفية غير صالحة.');
    return {
      id: typeof g.id === 'string' ? g.id : `group-${i}`,
      connector: g.connector || 'and',
      rules: g.rules.map((r: Record<string, unknown>) => {
        if (
          !r ||
          !['is', 'is_not'].includes(String(r.operator)) ||
          typeof r.status !== 'string' ||
          r.status.length > 100 ||
          (r.connector !== undefined &&
            !['and', 'or'].includes(String(r.connector))) ||
          (r.target !== undefined &&
            !['session', 'weekday'].includes(String(r.target)))
        )
          throw new Error('شرط تصفية غير صالح.');
        if (
          r.target === 'weekday'
            ? !Number.isInteger(r.weekday) ||
              Number(r.weekday) < 0 ||
              Number(r.weekday) > 6
            : !Number.isInteger(r.sessionId) || Number(r.sessionId) < 1
        )
          throw new Error('مرجع الحلقة أو اليوم غير صالح.');
        return r as unknown as FilterRule;
      }),
    };
  });
}
export function matchesFilterGroups(
  student: Pick<AttendanceGridStudent, 'records'>,
  groups: FilterGroup[],
  sessions: Pick<AttendanceGridSession, 'id' | 'date'>[],
) {
  const match = (r: FilterRule) => {
    const ids =
      r.target === 'weekday'
        ? sessions
            .filter(s => new Date(s.date + 'T12:00:00').getDay() === r.weekday)
            .map(s => s.id)
        : [r.sessionId];
    const statuses = ids
      .map(id => student.records[String(id)])
      .filter(
        (status): status is string => status !== null && status !== undefined,
      );
    if (!statuses.length) return false;
    return r.operator === 'is'
      ? statuses.some(status => status === r.status)
      : statuses.every(status => status !== r.status);
  };
  const combine = (
    values: boolean[],
    connectors: ('and' | 'or' | undefined)[],
  ) =>
    values
      .slice(1)
      .reduce(
        (result, value, i) =>
          connectors[i + 1] === 'or' ? result || value : result && value,
        values[0] ?? true,
      );
  return combine(
    groups.map(g =>
      combine(
        g.rules.map(match),
        g.rules.map(r => r.connector),
      ),
    ),
    groups.map(g => g.connector),
  );
}
