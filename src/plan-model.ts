import {
  generateQuranPlan,
  type GeneratedQuranPlan,
  type QuranPlanTrack,
} from './quran-plan';

export type ShareMode = 'private' | 'readonly' | 'read_mark';
export type PlanConfiguration = {
  planOwnerType: 'student' | 'female-student' | 'teacher' | 'female-teacher';
  studentName: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  includeCompletionCheckboxes: boolean;
  completionMode?: 'day' | 'item';
  tracks: QuranPlanTrack[];
};
export type SavedPlanSummary = {
  id: string;
  name: string;
  completed: boolean;
  archived: boolean;
  share_mode: ShareMode;
  share_token?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  can_mark: boolean;
  completed_dates: string[];
  completed_items?: Record<string, string[]>;
  study_dates: string[];
};
export type SavedPlan = SavedPlanSummary & { configuration: PlanConfiguration };

export function retainedCompletionDates(
  previous: PlanConfiguration | undefined,
  next: PlanConfiguration,
  completed: string[],
): string[] {
  const after = generateQuranPlan(next);
  if (!previous)
    return completed.filter(date =>
      after.days.some(day => day.date === date && day.isStudyDay),
    );
  const before = generateQuranPlan(previous);
  const dates = new Map(before.days.map(day => [day.date, day]));
  return completed.filter(date => {
    const oldDay = dates.get(date);
    const newDay = after.days.find(day => day.date === date);
    return (
      oldDay?.isStudyDay &&
      newDay?.isStudyDay &&
      JSON.stringify(oldDay.assignments) ===
        JSON.stringify(newDay.assignments) &&
      JSON.stringify(oldDay.paused) === JSON.stringify(newDay.paused)
    );
  });
}

export function assignmentIds(
  plan: GeneratedQuranPlan,
): Record<string, string[]> {
  return Object.fromEntries(
    plan.days
      .filter(day => day.isStudyDay)
      .map(day => [
        day.date,
        plan.tracks
          .filter(track => day.assignments[track.id] && !day.paused?.[track.id])
          .map(track => track.id),
      ]),
  );
}

export function completionState(
  plan: GeneratedQuranPlan,
  dates: string[],
  items: Record<string, string[]>,
  mode: 'day' | 'item' = 'day',
) {
  const assignments = assignmentIds(plan);
  const completedItems: Record<string, string[]> = {};
  const completedDates: string[] = [];
  for (const [date, ids] of Object.entries(assignments)) {
    const checked = dates.includes(date)
      ? ids
      : ids.filter(id => items[date]?.includes(id));
    if (checked.length) completedItems[date] = checked;
    if (
      ids.length
        ? checked.length === ids.length
        : dates.includes(date) || mode === 'item'
    )
      completedDates.push(date);
  }
  return { completedItems, completedDates, assignments };
}

export function retainedCompletionItems(
  previous: PlanConfiguration | undefined,
  next: PlanConfiguration,
  items: Record<string, string[]>,
): Record<string, string[]> {
  const after = generateQuranPlan(next);
  const before = previous
    ? new Map(generateQuranPlan(previous).days.map(day => [day.date, day]))
    : null;
  const result: Record<string, string[]> = {};
  for (const day of after.days) {
    const retained = (items[day.date] || []).filter(
      id =>
        day.isStudyDay &&
        day.assignments[id] &&
        !day.paused?.[id] &&
        (!before ||
          (before.get(day.date)?.isStudyDay &&
            !before.get(day.date)?.paused?.[id] &&
            JSON.stringify(before.get(day.date)?.assignments[id]) ===
              JSON.stringify(day.assignments[id]))),
    );
    if (retained.length) result[day.date] = retained;
  }
  return result;
}
