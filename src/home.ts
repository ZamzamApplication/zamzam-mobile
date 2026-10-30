import type { WorkspaceData } from './offline/state';
import { canManage, localDate } from './types';

export function homeAttention(data: WorkspaceData, today = localDate()) {
  const sessions = new Map(
    data.dashboard?.sessions.map(item => [item.id, item]),
  );
  data.sessions.forEach(item => sessions.set(item.id, item));
  const pending = [...sessions.values()]
    .filter(item => !item.is_confirmed)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return {
    pending,
    overdue: pending.filter(item => item.date < today),
    today: pending.filter(item => item.date === today),
    issues: [...data.queue, ...(data.quranQueue || [])].filter(
      item => item.issue,
    ).length,
    waiting: [...data.queue, ...(data.quranQueue || [])].filter(
      item => !item.issue,
    ).length,
    drafts:
      (canManage(data.user) ? Object.keys(data.settingsDrafts).length : 0) +
      Object.keys(data.formDrafts || {}).length,
  };
}
