import {
  applyChanges,
  applyResults,
  attendanceKey,
  emptyWorkspace,
  nextBatch,
  queueAttendance,
  resolveMutation,
  visibleRoster,
} from '../src/offline/state';
import type { WorkspaceData } from '../src/offline/state';
import type { User } from '../src/types';

function fixture(tenant = 1): WorkspaceData {
  const user: User = {
    id: 9,
    username: 'test',
    role: 'admin',
    sheikh_id: null,
    tahfiz_id: tenant,
    tahfiz: {
      id: tenant,
      name: `Tahfiz ${tenant}`,
      attendance_statuses: ['حاضر', 'غياب', 'بعذر'],
    },
  };
  const data = emptyWorkspace(user);
  data.rosters[10] = {
    session_id: 10,
    date: '2026-10-29',
    version: 1,
    circle_id: tenant,
    is_confirmed: false,
    quran_progress_enabled: false,
    circle_sheikhs: [{ id: 5, name: 'Sheikh' }],
    sheikh_groups: [
      {
        sheikh: { id: 5, name: 'Sheikh' },
        students: [1, 2].map(id => ({
          id,
          name: `Student ${id}`,
          attendance_id: null,
          status: 'غياب',
          sheikh_id: 5,
          notes: '',
        })),
      },
    ],
  };
  return data;
}
const edit = (student_id: number, status = 'حاضر') => ({
  student_id,
  status,
  notes: 'offline note',
  sheikh_id: 5,
});

test('coalesces edits that have never been sent and keeps one complete local attendance value', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  queueAttendance(
    data,
    10,
    [{ ...edit(1, 'بعذر'), notes: 'latest' }],
    'device-id-1',
  );
  expect(data.queue).toHaveLength(1);
  expect(visibleRoster(data, 10)?.sheikh_groups[0].students[0]).toMatchObject({
    status: 'بعذر',
    notes: 'latest',
  });
});
test('never changes a possibly submitted mutation; replays its id and body before a later edit', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  data.queue[0].attempted = true;
  const frozen = JSON.stringify(data.queue[0]);
  queueAttendance(data, 10, [edit(1, 'بعذر')], 'device-id-1');
  expect(JSON.stringify(data.queue[0])).toBe(frozen);
  expect(nextBatch(data)).toHaveLength(1);
  expect(nextBatch(data)[0].mutation_id).toBe(data.queue[0].mutation_id);
});
test('an acknowledgement rebases the next unsent edit without losing its newer local value', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  data.queue[0].attempted = true;
  const sentId = data.queue[0].mutation_id;
  queueAttendance(data, 10, [edit(1, 'بعذر')], 'device-id-1');
  applyResults(data, [
    {
      mutation_id: sentId,
      status: 'applied',
      entity: { ...edit(1), id: 100, session_id: 10, revision: 1 },
    },
  ]);
  expect(data.queue).toHaveLength(1);
  expect(data.queue[0].base_revision).toBe(1);
  expect(visibleRoster(data, 10)?.sheikh_groups[0].students[0].status).toBe(
    'بعذر',
  );
});
test('retains conflicts and later edits until an explicit resolution, using a fresh mutation id', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  data.queue[0].attempted = true;
  const id = data.queue[0].mutation_id;
  applyResults(data, [
    {
      mutation_id: id,
      status: 'conflict',
      code: 'revision_conflict',
      server: { ...edit(1, 'غياب'), session_id: 10, revision: 7, id: 100 },
    },
  ]);
  queueAttendance(data, 10, [edit(1, 'بعذر')], 'device-id-1');
  expect(nextBatch(data)).toHaveLength(0);
  resolveMutation(data, attendanceKey(10, 1), true, 'device-id-1');
  expect(data.queue).toHaveLength(1);
  expect(data.queue[0].mutation_id).not.toBe(id);
  expect(data.queue[0].base_revision).toBe(7);
  expect(data.queue[0].values.status).toBe('بعذر');
});
test('taking the server version explicitly discards local changes for only that record', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1), edit(2)], 'device-id-1');
  applyResults(data, [
    {
      mutation_id: data.queue[0].mutation_id,
      status: 'conflict',
      code: 'revision_conflict',
      server: { ...edit(1, 'بعذر'), session_id: 10, revision: 4, id: 100 },
    },
  ]);
  resolveMutation(data, attendanceKey(10, 1), false, 'device-id-1');
  expect(data.queue).toHaveLength(1);
  expect(data.queue[0].values.student_id).toBe(2);
  expect(visibleRoster(data, 10)?.sheikh_groups[0].students[0].status).toBe(
    'بعذر',
  );
});
test('feed updates do not overwrite local pending edits and tombstones remove inaccessible students', () => {
  const data = fixture();
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  applyChanges(data, [
    {
      entity_type: 'attendance',
      entity_key: '100',
      operation: 'upsert',
      payload: { ...edit(1, 'بعذر'), id: 100, session_id: 10, revision: 2 },
    },
  ]);
  expect(visibleRoster(data, 10)?.sheikh_groups[0].students[0].status).toBe(
    'حاضر',
  );
  applyChanges(data, [
    {
      entity_type: 'student',
      entity_key: '1',
      operation: 'delete',
      payload: null,
    },
  ]);
  expect(
    visibleRoster(data, 10)?.sheikh_groups[0].students.map(st => st.id),
  ).toEqual([2]);
  expect(data.queue[0].issue).toBe('entity_not_found');
});
test('locked sessions reject local edits and rejected mutations never silently retry', () => {
  const data = fixture();
  data.rosters[10].is_confirmed = true;
  expect(() => queueAttendance(data, 10, [edit(1)], 'device-id-1')).toThrow();
  data.rosters[10].is_confirmed = false;
  queueAttendance(data, 10, [edit(1)], 'device-id-1');
  applyResults(data, [
    {
      mutation_id: data.queue[0].mutation_id,
      status: 'rejected',
      code: 'session_locked',
    },
  ]);
  expect(nextBatch(data)).toEqual([]);
  expect(() =>
    resolveMutation(data, attendanceKey(10, 1), true, 'device-id-1'),
  ).toThrow();
});
test('workspaces and serialized local restarts preserve independent attendance queues', () => {
  const first = fixture(1);
  const second = fixture(2);
  queueAttendance(first, 10, [edit(1)], 'device-id-1');
  const restarted: WorkspaceData = JSON.parse(JSON.stringify(first));
  expect(restarted.queue).toEqual(first.queue);
  expect(second.queue).toEqual([]);
  expect(visibleRoster(second, 10)?.sheikh_groups[0].students[0].status).toBe(
    'غياب',
  );
});
