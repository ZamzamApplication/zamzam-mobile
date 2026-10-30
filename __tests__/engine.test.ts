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
