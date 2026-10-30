import type {
  AttendanceUpdate,
  DashboardSummary,
  Invitation,
  Roster,
  Session,
  Settings,
  User,
} from '../types';
import { uid } from '../types';

export interface ServerAttendance extends AttendanceUpdate {
  id: number;
  session_id: number;
  revision: number;
}
export interface Mutation {
  mutation_id: string;
  device_id: string;
  entity_type: 'attendance';
  entity_key: string;
  base_revision: number;
  values: AttendanceUpdate & { session_id: number };
  client_changed_at: string;
}
export interface Pending extends Mutation {
  attempted: boolean;
  issue?: string;
  server?: ServerAttendance | null;
}
export interface WorkspaceData {
  dashboard?: {
    summary: DashboardSummary;
    sessions: Session[];
    updatedAt: string;
  };
  user: User;
  settings: Settings;
  sessions: Session[];
  rosters: Record<string, Roster>;
  attendance: Record<string, ServerAttendance>;
  queue: Pending[];
  cursor: number;
  bootstrapped: boolean;
  lastSync: string | null;
  settingsDrafts: Record<string, Partial<Settings>>;
  invitations?: Invitation[];
}
export interface MutationResult {
  mutation_id: string;
  status: 'applied' | 'conflict' | 'rejected';
  code?: string;
  entity?: ServerAttendance;
  server?: ServerAttendance | null;
  replayed?: boolean;
}
export const attendanceKey = (session: number, student: number) =>
  `session:${session}:student:${student}`;
export function emptyWorkspace(user: User): WorkspaceData {
  return {
    user,
    settings: user.tahfiz || { id: user.tahfiz_id!, name: 'التحفيظ' },
    sessions: [],
    rosters: {},
    attendance: {},
    queue: [],
    cursor: 0,
    bootstrapped: false,
    lastSync: null,
    settingsDrafts: {},
  };
}
export function queueAttendance(
  data: WorkspaceData,
  sessionId: number,
  updates: AttendanceUpdate[],
  deviceId: string,
) {
  const roster = data.rosters[sessionId];
  if (!roster || roster.is_confirmed)
    throw new Error('الحلقة مؤكدة أو غير متاحة على الجهاز.');
  for (const update of updates) {
    if (
      !roster.sheikh_groups.some(g =>
        g.students.some(s => s.id === update.student_id),
      )
    )
      throw new Error('الطالب ليس ضمن طلاب الحلقة.');
    if (!data.settings.attendance_statuses?.includes(update.status))
      throw new Error('حالة الحضور غير صالحة.');
    const key = attendanceKey(sessionId, update.student_id);
    const previous = data.queue.filter(p => p.entity_key === key).at(-1);
    // Once a request might have reached the server, its id and payload are immutable.
    if (previous && !previous.attempted && !previous.issue)
      data.queue = data.queue.filter(p => p !== previous);
    data.queue.push({
      mutation_id: uid(),
      device_id: deviceId,
      entity_type: 'attendance',
      entity_key: key,
      base_revision: data.attendance[key]?.revision || 0,
      values: { ...update, session_id: sessionId },
      client_changed_at: new Date().toISOString(),
      attempted: false,
    });
  }
}
export function nextBatch(data: WorkspaceData): Pending[] {
  const seen = new Set<string>();
  return data.queue
    .filter(p => {
      if (seen.has(p.entity_key)) return false;
      seen.add(p.entity_key);
      return !p.issue;
    })
    .slice(0, 50);
}
export function applyResults(data: WorkspaceData, results: MutationResult[]) {
  for (const result of results) {
    const pending = data.queue.find(p => p.mutation_id === result.mutation_id);
    if (!pending) continue;
    if (result.status === 'applied' && result.entity) {
      data.attendance[pending.entity_key] = result.entity;
      data.queue = data.queue.filter(p => p !== pending);
      for (const later of data.queue) {
        if (later.entity_key === pending.entity_key && !later.attempted)
          later.base_revision = result.entity.revision;
      }
    } else {
      pending.issue = result.code || result.status;
      pending.server = result.server;
      if (result.server) data.attendance[pending.entity_key] = result.server;
    }
  }
}
export function resolveMutation(
  data: WorkspaceData,
  key: string,
  keepLocal: boolean,
  deviceId: string,
) {
  const related = data.queue.filter(p => p.entity_key === key);
  const failed = related.find(p => p.issue);
  if (!failed) return;
  const latest = related[related.length - 1];
  if (keepLocal && failed.issue !== 'revision_conflict')
    throw new Error('عالج سبب رفض التعديل قبل إعادة إرساله.');
  data.queue = data.queue.filter(p => p.entity_key !== key);
  if (failed.server === null) delete data.attendance[key];
  if (keepLocal)
    queueAttendance(data, latest.values.session_id, [latest.values], deviceId);
}
export function visibleRoster(
  data: WorkspaceData,
  sessionId: number,
): Roster | undefined {
  const roster = data.rosters[sessionId];
  if (!roster) return undefined;
  return {
    ...roster,
    sheikh_groups: roster.sheikh_groups.map(g => ({
      ...g,
      students: g.students.map(student => {
        const key = attendanceKey(sessionId, student.id);
        const server = data.attendance[key];
        const pending = data.queue.filter(p => p.entity_key === key).at(-1);
        return {
          ...student,
          ...(server
            ? {
                status: server.status,
                notes: server.notes,
                sheikh_id: server.sheikh_id,
                attendance_id: server.id,
              }
            : {}),
          ...(pending ? pending.values : {}),
        };
      }),
    })),
  };
}
export interface Change {
  entity_type: string;
  entity_key: string;
  operation: string;
  payload: Record<string, unknown> | null;
}
export function applyChanges(data: WorkspaceData, changes: Change[]) {
  const refresh = new Set<number>();
  for (const change of changes) {
    const p = change.payload;
    if (change.entity_type === 'attendance') {
      if (p) {
        const a = p as unknown as ServerAttendance;
        data.attendance[attendanceKey(a.session_id, a.student_id)] = a;
        refresh.add(a.session_id);
      } else {
        for (const [key, row] of Object.entries(data.attendance))
          if (String(row.id) === change.entity_key) {
            delete data.attendance[key];
            refresh.add(row.session_id);
          }
      }
    } else if (change.entity_type === 'session') {
      const id = Number(change.entity_key);
      if (!p) {
        data.sessions = data.sessions.filter(s => s.id !== id);
        delete data.rosters[id];
        data.queue
          .filter(q => q.values.session_id === id)
          .forEach(q => {
            q.issue = 'entity_not_found';
          });
      } else {
        const index = data.sessions.findIndex(s => s.id === id);
        if (index >= 0)
          data.sessions[index] = { ...data.sessions[index], ...p };
        else data.sessions.unshift(p as unknown as Session);
        refresh.add(id);
      }
    } else if (
      change.entity_type === 'student' ||
      change.entity_type === 'sheikh'
    ) {
      // Full rosters carry explicit session membership and server-side role filtering.
      for (const session of data.sessions) refresh.add(session.id);
      if (!p && change.entity_type === 'student') {
        for (const roster of Object.values(data.rosters))
          for (const group of roster.sheikh_groups) {
            group.students = group.students.filter(
              s => String(s.id) !== change.entity_key,
            );
          }
        data.queue
          .filter(q => String(q.values.student_id) === change.entity_key)
          .forEach(q => {
            q.issue = 'entity_not_found';
          });
      }
    }
  }
  return [...refresh];
}
