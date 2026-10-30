import { homeAttention } from '../src/home';
import { emptyWorkspace } from '../src/offline/state';
import type { Session } from '../src/types';

const session = (id: number, date: string, confirmed = false): Session => ({
  id,
  date,
  circle_id: 1,
  is_confirmed: confirmed,
  quran_progress_enabled: false,
});
function fixture() {
  return emptyWorkspace({
    id: 1,
    username: 'admin',
    role: 'admin',
    tahfiz_id: 1,
    sheikh_id: null,
  });
}
test('attention prioritizes overdue sessions, excludes confirmed sessions, and applies newer cached changes', () => {
  const data = fixture();
  data.dashboard = {
    updatedAt: '2026-10-30T10:00:00Z',
    summary: {
      tahfiz_name: 'Zamzam',
      students: 8,
      sheikhs: 2,
      sessions: 5,
      confirmed_sessions: 1,
      pending_sessions: 4,
    },
    sessions: [
      session(1, '2026-10-29'),
      session(2, '2026-10-28'),
      session(3, '2026-10-30'),
      session(4, '2026-10-31'),
    ],
  };
  data.sessions = [session(2, '2026-10-28', true)];
  const view = homeAttention(data, '2026-10-30');
  expect(view.pending.map(s => s.id)).toEqual([1, 3, 4]);
  expect(view.overdue.map(s => s.id)).toEqual([1]);
  expect(view.today.map(s => s.id)).toEqual([3]);
});
test('settings attention respects membership permissions and remains isolated by workspace', () => {
  const data = fixture();
  data.settingsDrafts.general = { name: 'Draft' };
  expect(homeAttention(data).drafts).toBe(1);
  data.user.role = 'sheikh';
  expect(homeAttention(data).drafts).toBe(0);
  expect(homeAttention(fixture()).pending).toEqual([]);
  expect(homeAttention(fixture()).drafts).toBe(0);
});
