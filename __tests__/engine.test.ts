jest.mock('../src/offline/database', () => ({
  readWorkspace: jest.fn(),
  writeWorkspace: jest.fn(),
}));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {},
  getGenericPassword: jest.fn(),
}));
import { OfflineEngine } from '../src/offline/engine';
import { readWorkspace, writeWorkspace } from '../src/offline/database';
import type { Gateway, Roster, User } from '../src/types';
import { ApiError } from '../src/api';
import type {
  Mutation,
  ServerAttendance,
  WorkspaceData,
} from '../src/offline/state';

const user: User = {
  id: 1,
  username: 'admin',
  role: 'admin',
  tahfiz_id: 42,
  sheikh_id: null,
  tahfiz: { id: 42, name: 'Tahfiz', attendance_statuses: ['حاضر', 'غياب'] },
};
const roster: Roster = {
  session_id: 10,
  date: '2026-10-29',
  version: 1,
  circle_id: 42,
  is_confirmed: false,
  quran_progress_enabled: false,
  circle_sheikhs: [{ id: 5, name: 'Sheikh' }],
  sheikh_groups: [
    {
      sheikh: { id: 5, name: 'Sheikh' },
      students: [
        {
          id: 1,
          name: 'Student',
          status: 'غياب',
          attendance_id: null,
          notes: '',
          sheikh_id: 5,
        },
      ],
    },
  ],
};
const stored = new Map<string, WorkspaceData>();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  stored.clear();
  (readWorkspace as jest.Mock).mockImplementation(async scope =>
    stored.has(scope) ? clone(stored.get(scope)) : null,
  );
  (writeWorkspace as jest.Mock).mockImplementation(async (scope, data) => {
    stored.set(scope, clone(data));
  });
});
afterEach(() => jest.useRealTimers());

function server() {
  let lostResponse = false;
  let applications = 0;
  let record: ServerAttendance | null = null;
  const receipts = new Map<string, object>();
  const request = jest.fn(async (path: string, options?: RequestInit) => {
    if (path === '/auth/me') return user;
    if (path.startsWith('/sync/v1/bootstrap'))
      return {
        schema_version: 2,
        cursor: 0,
        tahfiz: user.tahfiz,
        sessions: [{ id: 10 }],
        attendance: [],
      };
    if (path === '/sessions/all') return [{ ...roster, id: 10 }];
    if (path === '/sessions/upcoming') return [{ ...roster, id: 10 }];
    if (path === '/reports/dashboard-summary')
      return {
        tahfiz_name: 'Tahfiz',
        students: 1,
        sheikhs: 1,
        sessions: 1,
        confirmed_sessions: 0,
        pending_sessions: 1,
      };
    if (path === '/sessions/10/attendance') return roster;
    if (path === '/tahfiz/settings') return user.tahfiz;
    if (path.startsWith('/sync/v1/changes'))
      return { changes: [], next_cursor: applications, has_more: false };
    if (path === '/sync/v1/mutations') {
      const body = JSON.parse(String(options?.body));
      const results = body.mutations.map((m: Mutation) => {
        if (receipts.has(m.mutation_id))
          return { ...receipts.get(m.mutation_id), replayed: true };
        applications++;
        record = { ...m.values, id: 100, revision: applications };
        const result = {
          mutation_id: m.mutation_id,
          status: 'applied',
          entity: record,
        };
        receipts.set(m.mutation_id, result);
        return result;
      });
      if (lostResponse) {
        lostResponse = false;
        throw new Error('response lost');
      }
      return { results };
    }
    throw new Error(path);
  });
  const client: Gateway = {
    demo: false,
    deviceId: 'test-device-id',
    accountKey: 'account:1',
    request: request as Gateway['request'],
    switchTenant: async () => user,
    selectCachedTenant: async () => {},
    logout: async () => {},
  };
  return {
    client,
    request,
    loseNextResponse: () => {
      lostResponse = true;
    },
    applications: () => applications,
  };
}

test('a dashboard outage preserves the cached summary and does not block attendance sync', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  await engine.sync();
  const cached = engine.view.data.dashboard;
  remote.client.request = async (path, options) => {
    if (path === '/reports/dashboard-summary')
      throw new Error('summary unavailable');
    return remote.request(path, options) as never;
  };
  await engine.editStudent(10, 1, { status: 'حاضر' });
  await engine.sync();
  expect(engine.view.data.queue).toHaveLength(0);
  expect(engine.view.error).toBeNull();
  expect(engine.view.dashboardError).toBe('summary unavailable');
  expect(engine.view.data.dashboard).toEqual(cached);
  engine.dispose();
});
test('a durable mutation survives a lost response and app restart, replaying the server receipt once', async () => {
  const remote = server();
  const first = await OfflineEngine.open(remote.client, user);
  await first.sync();
  expect(first.view.data.dashboard?.summary.students).toBe(1);
  expect(stored.get('account:1:42')?.dashboard?.sessions[0].id).toBe(10);
  await first.editStudent(10, 1, { status: 'حاضر', notes: 'saved offline' });
  remote.loseNextResponse();
  await first.sync();
  expect(first.view.data.queue).toHaveLength(1);
  expect(first.view.data.queue[0].attempted).toBe(true);
  const id = first.view.data.queue[0].mutation_id;
  first.dispose();
  const restarted = await OfflineEngine.open(remote.client, user);
  expect(restarted.view.data.dashboard?.summary.pending_sessions).toBe(1);
  expect(restarted.view.data.queue[0].mutation_id).toBe(id);
  await restarted.sync();
  expect(restarted.view.data.queue).toHaveLength(0);
  expect(remote.applications()).toBe(1);
  expect(restarted.view.data.attendance['session:10:student:1'].notes).toBe(
    'saved offline',
  );
  restarted.dispose();
});
test('offline edits never send requests, and every request remains scoped to the engine tahfiz', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  await engine.sync();
  engine.setOnline(false);
  remote.request.mockClear();
  await engine.editStudent(10, 1, { status: 'حاضر' });
  await engine.sync();
  expect(remote.request).not.toHaveBeenCalled();
  expect(engine.view.data.queue).toHaveLength(1);
  expect(stored.get('account:1:42')?.queue).toHaveLength(1);
  await engine.request('/auth/me');
  expect(remote.request.mock.calls[0][1]?.headers).toMatchObject({
    'X-Tahfiz-ID': '42',
  });
  engine.dispose();
});
test('a failed local commit does not claim a saved attendance edit', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  await engine.sync();
  engine.setOnline(false);
  (writeWorkspace as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await expect(engine.editStudent(10, 1, { status: 'حاضر' })).rejects.toThrow(
    'disk full',
  );
  expect(engine.view.data.queue).toHaveLength(0);
  expect(stored.get('account:1:42')?.queue).toHaveLength(0);
  engine.dispose();
});
test('publishing a draft preserves edits made while the request is in flight', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  const published = { name: 'Published' };
  const newer = { name: 'New edit' };
  await engine.formDraft('student:new', published);
  await engine.formDraft('student:new', newer);
  await engine.formDraft('student:new', undefined, published);
  expect(engine.view.data.formDrafts?.['student:new']).toEqual(newer);
  await engine.formDraft('student:new', undefined, newer);
  expect(engine.view.data.formDrafts?.['student:new']).toBeUndefined();
  engine.dispose();
});
test('cached feature resources survive offline restart and are purged after revoked access', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  const original = remote.client.request;
  remote.client.request = async (path, options) =>
    path === '/students'
      ? ([{ id: 1, name: 'Student' }] as never)
      : original(path, options);
  await engine.resource('/students');
  await engine.formDraft('student:new', { name: 'Local draft' });
  engine.dispose();
  const restarted = await OfflineEngine.open(remote.client, user);
  restarted.setOnline(false);
  expect(await restarted.resource('/students')).toEqual([
    { id: 1, name: 'Student' },
  ]);
  expect(restarted.view.data.formDrafts?.['student:new']).toEqual({
    name: 'Local draft',
  });
  await expect(
    restarted.publish('/students', { name: 'Never sent' }),
  ).rejects.toThrow();
  restarted.view.online = true;
  remote.client.request = async () => {
    throw new ApiError('Forbidden', 403);
  };
  await expect(restarted.resource('/students')).rejects.toThrow('Forbidden');
  expect(restarted.view.data.resources?.['/students']).toBeUndefined();
  restarted.dispose();
});
test('a membership scope change removes cached profiles, summaries, and drafts', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  await engine.sync();
  await engine.formDraft('student:new', { name: 'Admin draft' });
  engine.dispose();
  const restricted = await OfflineEngine.open(remote.client, {
    ...user,
    role: 'sheikh',
    sheikh_id: 5,
  });
  expect(restricted.view.data.formDrafts).toEqual({});
  expect(restricted.view.data.resources).toEqual({});
  expect(restricted.view.data.dashboard).toBeUndefined();
  restricted.dispose();
});
test('Quran edits survive a lost response and retry their immutable receipt after restart', async () => {
  const remote = server();
  const original = remote.client.request;
  remote.client.request = async (path, options) => {
    const response = await original<Record<string, unknown>>(path, options);
    if (path === '/auth/me')
      return {
        ...response,
        tahfiz: { ...user.tahfiz, progress_tracking_enabled: true },
      } as never;
    if (path === '/tahfiz/settings')
      return { ...response, progress_tracking_enabled: true } as never;
    if (path === '/sessions/10/attendance')
      return {
        ...roster,
        quran_progress_enabled: true,
        sheikh_groups: roster.sheikh_groups.map(g => ({
          ...g,
          students: g.students.map(s => ({
            ...s,
            quran_progress_enabled: true,
          })),
        })),
      } as never;
    return response as never;
  };
  const first = await OfflineEngine.open(remote.client, user);
  await first.sync();
  first.setOnline(false);
  await first.editQuran(10, {
    student_id: 1,
    category: 'new_memorization',
    range_type: 'page',
    from_page: 1,
    to_page: 2,
    quality_score: 5,
    notes: 'offline Quran',
  });
  remote.loseNextResponse();
  first.view.online = true;
  await first.sync();
  const id = first.view.data.quranQueue![0].mutation_id;
  first.dispose();
  const restarted = await OfflineEngine.open(remote.client, user);
  expect(restarted.view.data.quranQueue![0].mutation_id).toBe(id);
  await restarted.sync();
  expect(restarted.view.data.quranQueue).toEqual([]);
  expect(remote.applications()).toBe(1);
  expect(Object.values(restarted.view.data.quranEntries || {})[0].notes).toBe(
    'offline Quran',
  );
  restarted.dispose();
});

test('a newly loaded roster supplies the server revision for its existing membership rows', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  const original = remote.client.request;
  remote.client.request = async (path, options) => {
    if (path === '/sessions/10/attendance')
      return {
        ...roster,
        sheikh_groups: roster.sheikh_groups.map(g => ({
          ...g,
          students: g.students.map(s => ({
            ...s,
            attendance_id: 900,
            revision: 4,
          })),
        })),
      } as never;
    return original(path, options);
  };
  await engine.loadRoster(10);
  engine.setOnline(false);
  await engine.editStudent(10, 1, { status: 'حاضر' });
  expect(engine.view.data.queue[0].base_revision).toBe(4);
  engine.dispose();
});
test('older APIs without roster revisions are bootstrapped before editing a new membership row', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  const original = remote.client.request;
  remote.client.request = async (path, options) => {
    if (path === '/sessions/10/attendance')
      return {
        ...roster,
        sheikh_groups: roster.sheikh_groups.map(g => ({
          ...g,
          students: g.students.map(s => ({ ...s, attendance_id: 900 })),
        })),
      } as never;
    if (path.startsWith('/sync/v1/bootstrap'))
      return {
        schema_version: 2,
        cursor: 9,
        tahfiz: user.tahfiz,
        sessions: [],
        attendance: [
          {
            id: 900,
            session_id: 10,
            student_id: 1,
            status: 'غياب',
            notes: null,
            sheikh_id: 5,
            revision: 6,
          },
        ],
      } as never;
    return original(path, options);
  };
  await engine.loadRoster(10);
  engine.setOnline(false);
  await engine.editStudent(10, 1, { status: 'حاضر' });
  expect(engine.view.data.queue[0].base_revision).toBe(6);
  engine.dispose();
});
test('review retries the newest edit with a fresh id and current server revision, then confirmation succeeds', async () => {
  const remote = server();
  const engine = await OfflineEngine.open(remote.client, user);
  await engine.sync();
  engine.setOnline(false);
  await engine.editStudent(10, 1, { status: 'حاضر', notes: 'first edit' });
  engine.view.data.queue[0].attempted = true;
  engine.view.data.queue[0].issue = 'revision_conflict';
  engine.view.data.queue[0].server = {
    id: 900,
    session_id: 10,
    student_id: 1,
    status: 'غياب',
    notes: null,
    sheikh_id: 5,
    revision: 2,
  };
  const oldId = engine.view.data.queue[0].mutation_id;
  await engine.editStudent(10, 1, { notes: 'latest edit' });
  engine.view.online = true;
  await expect(engine.transition(10, 'confirm')).rejects.toThrow(
    'زامن التغييرات',
  );
  const original = remote.client.request;
  remote.client.request = async (path, options) => {
    if (path.startsWith('/sync/v1/bootstrap'))
      return {
        schema_version: 2,
        cursor: 0,
        tahfiz: user.tahfiz,
        sessions: [],
        attendance: [
          {
            id: 900,
            session_id: 10,
            student_id: 1,
            status: 'غياب',
            notes: null,
            sheikh_id: 5,
            revision: 3,
          },
        ],
      } as never;
    if (path === '/sessions/10/confirm') return {} as never;
    return original(path, options);
  };
  engine.view.online = true;
  await expect(
    engine.resolve(engine.view.data.queue[0].entity_key, true),
  ).rejects.toThrow('تغيرت نسخة الخادم');
  expect(engine.view.data.queue).toHaveLength(2);
  expect(
    remote.request.mock.calls.some(([path]) => path === '/sync/v1/mutations'),
  ).toBe(false);
  await engine.resolve(engine.view.data.queue[0].entity_key, true);
  const call = remote.request.mock.calls.find(
    ([path]) => path === '/sync/v1/mutations',
  );
  const sent = JSON.parse(String(call![1]?.body)).mutations[0];
  expect(sent.mutation_id).not.toBe(oldId);
  expect(sent.base_revision).toBe(3);
  expect(sent.values.notes).toBe('latest edit');
  expect(engine.view.data.queue).toEqual([]);
  await expect(engine.transition(10, 'confirm')).resolves.toBeUndefined();
  engine.dispose();
});
