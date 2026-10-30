import { ApiError, errorMessage } from '../api';
import type {
  AttendanceUpdate,
  DashboardSummary,
  Gateway,
  Invitation,
  Roster,
  Session,
  Settings,
  User,
} from '../types';
import { canManage } from '../types';
import {
  applyChanges,
  applyResults,
  attendanceKey,
  emptyWorkspace,
  nextBatch,
  queueAttendance,
  resolveMutation,
  visibleRoster,
} from './state';
import type {
  Change,
  Mutation,
  MutationResult,
  ServerAttendance,
  WorkspaceData,
} from './state';
import { readWorkspace, writeWorkspace } from './database';

interface Bootstrap {
  schema_version: number;
  cursor: number;
  tahfiz: Settings;
  sessions: Session[];
  attendance: ServerAttendance[];
}
function scopeSignature(user: User) {
  return [
    user.role,
    user.sheikh_id,
    user.tahfiz?.restrict_sheikh_student_access !== false,
    !!user.attendance_all_students_access,
  ].join(':');
}
export interface EngineView {
  dashboardError?: string;
  data: WorkspaceData;
  syncing: boolean;
  online: boolean;
  error: string | null;
  revision: number;
}
export class OfflineEngine {
  private scope: string;
  private closed = false;
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private flight: Promise<void> | null = null;
  private scheduled?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private retryAfter = 0;
  view: EngineView;
  private constructor(
    readonly client: Gateway,
    readonly tenant: number,
    data: WorkspaceData,
  ) {
    this.scope = `${client.accountKey}:${tenant}`;
    this.view = {
      data,
      syncing: false,
      online: true,
      error: null,
      revision: 0,
    };
  }
  static async open(client: Gateway, user: User) {
    const cached = await readWorkspace(
      `${client.accountKey}:${user.tahfiz_id}`,
    );
    const engine = new OfflineEngine(
      client,
      user.tahfiz_id!,
      cached || emptyWorkspace(user),
    );
    // A changed role/scope must not keep another membership's roster visible.
    if (cached && scopeSignature(cached.user) !== scopeSignature(user)) {
      engine.view.data = {
        ...emptyWorkspace(user),
        queue: cached.queue.map(p => ({ ...p, issue: 'scope_changed' })),
      };
    } else engine.view.data.user = user;
    return engine;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private notify() {
    if (this.closed) return;
    this.view = { ...this.view, revision: this.view.revision + 1 };
    this.listeners.forEach(fn => fn());
  }
  dispose() {
    this.closed = true;
    clearTimeout(this.scheduled);
    this.listeners.clear();
  }
  setOnline(online: boolean) {
    this.view.online = online;
    this.notify();
    if (online) void this.autoSync();
  }
  request<T>(path: string, options: RequestInit = {}) {
    return this.client.request<T>(path, {
      ...options,
      headers: { ...options.headers, 'X-Tahfiz-ID': String(this.tenant) },
    });
  }
  private mutate(fn: (data: WorkspaceData) => void): Promise<void> {
    const operation = this.writes
      .catch(() => {})
      .then(async () => {
        if (this.closed) return;
        const next: WorkspaceData = JSON.parse(JSON.stringify(this.view.data));
        fn(next);
        await writeWorkspace(this.scope, next);
        if (this.closed) return;
        this.view.data = next;
        this.notify();
      });
    this.writes = operation;
    return operation;
  }
  async edit(sessionId: number, updates: AttendanceUpdate[]) {
    await this.mutate(data =>
      queueAttendance(data, sessionId, updates, this.client.deviceId),
    );
    clearTimeout(this.scheduled);
    this.scheduled = setTimeout(() => {
      void this.autoSync();
    }, 800);
  }
  async editStudent(
    sessionId: number,
    studentId: number,
    patch: Partial<AttendanceUpdate>,
  ) {
    await this.mutate(data => {
      const student = visibleRoster(data, sessionId)
        ?.sheikh_groups.flatMap(g => g.students)
        .find(s => s.id === studentId);
      if (!student) throw new Error('تعذر العثور على الطالب.');
      queueAttendance(
        data,
        sessionId,
        [
          {
            student_id: studentId,
            status: student.status,
            notes: student.notes || null,
            sheikh_id: student.sheikh_id,
            ...patch,
          },
        ],
        this.client.deviceId,
      );
    });
    clearTimeout(this.scheduled);
    this.scheduled = setTimeout(() => {
      void this.autoSync();
    }, 800);
  }
  async resolve(key: string, keepLocal: boolean) {
    if (keepLocal) {
      if (!this.view.online)
        throw new Error(
          'اتصل بالإنترنت لتحميل أحدث نسخة قبل إعادة إرسال تعديلك.',
        );
      const failed = this.view.data.queue.find(
        p => p.entity_key === key && p.issue,
      );
      if (!failed) return;
      if (failed.issue === 'scope_changed')
        throw new Error(
          'تغيرت صلاحيات الحساب. راجع البيانات مع المدير قبل إعادة التسجيل.',
        );
      const id = failed.values.session_id;
      await this.loadRoster(id);
      const bootstrap = await this.request<Bootstrap>(
        '/sync/v1/bootstrap?history_days=90',
      );
      await this.mutate(data => {
        const latest = data.queue.filter(p => p.entity_key === key).at(-1);
        if (!latest) return;
        const roster = data.rosters[id];
        if (roster.is_confirmed)
          throw new Error(
            'الحلقة مؤكدة. أعد فتحها أولاً أو استخدم نسخة الخادم.',
          );
        if (
          !roster.sheikh_groups.some(g =>
            g.students.some(s => s.id === latest.values.student_id),
          )
        )
          throw new Error('الطالب لم يعد ضمن طلاب الحلقة.');
        const settings = { ...data.settings, ...bootstrap.tahfiz };
        if (!settings.attendance_statuses?.includes(latest.values.status))
          throw new Error(
            'تغيرت حالات الحضور. اختر حالة صالحة قبل إعادة الإرسال.',
          );
        const current = bootstrap.attendance.find(
          a => a.session_id === id && a.student_id === latest.values.student_id,
        );
        if (current) data.attendance[key] = current;
        else delete data.attendance[key];
        const issue = data.queue.find(p => p.entity_key === key && p.issue)!;
        issue.issue = 'revision_conflict';
        issue.server = current || null;
        resolveMutation(data, key, true, this.client.deviceId);
      });
      await this.sync();
      return;
    }
    await this.mutate(data =>
      resolveMutation(data, key, keepLocal, this.client.deviceId),
    );
    void this.sync();
  }
  async draft(section: string, values: Partial<Settings>) {
    await this.mutate(data => {
      data.settingsDrafts[section] = values;
    });
  }
  async invitations() {
    const invitations = await this.request<Invitation[]>('/invitations/');
    await this.mutate(data => {
      data.invitations = invitations;
    });
  }
  async saveSettings(section: string, values: Partial<Settings>) {
    if (!this.view.online)
      throw new Error(
        'المسودة محفوظة على الجهاز. اتصل بالإنترنت لحفظ إعدادات التحفيظ المشتركة.',
      );
    const settings = await this.request<Settings>('/tahfiz/settings', {
      method: 'PUT',
      body: JSON.stringify(values),
    });
    await this.mutate(data => {
      data.settings = settings;
      data.user.tahfiz = { ...data.user.tahfiz, ...settings };
      delete data.settingsDrafts[section];
    });
    if (!this.closed) await this.client.cacheUser?.(this.view.data.user);
  }
  async loadRoster(id: number) {
    const roster = await this.request<Roster>(`/sessions/${id}/attendance`);
    const students = roster.sheikh_groups.flatMap(g => g.students);
    const missingRevision = students.some(
      s =>
        s.attendance_id !== null &&
        s.revision === undefined &&
        !this.view.data.attendance[attendanceKey(id, s.id)],
    );
    // Older API versions omit revisions in rosters. Fetch their baseline once;
    // existing membership rows must never be submitted as new revision-zero rows.
    const fallback = missingRevision
      ? await this.request<Bootstrap>('/sync/v1/bootstrap?history_days=90')
      : undefined;
    await this.mutate(data => {
      data.rosters[id] = roster;
      for (const row of fallback?.attendance || [])
        if (row.session_id === id)
          data.attendance[attendanceKey(id, row.student_id)] = row;
      for (const student of students) {
        if (student.attendance_id !== null && student.revision !== undefined)
          data.attendance[attendanceKey(id, student.id)] = {
            id: student.attendance_id,
            session_id: id,
            student_id: student.id,
            revision: student.revision,
            status: student.status,
            notes: student.notes || null,
            sheikh_id: student.sheikh_id,
          };
      }
      const session = data.sessions.find(s => s.id === id);
      if (session) Object.assign(session, { ...roster, id });
    });
  }
  async createSession(date: string, name?: string) {
    if (!this.view.online)
      throw new Error(
        'إنشاء حلقة جديدة يحتاج إلى اتصال. الحلقات المحملة متاحة دون إنترنت.',
      );
    const result = await this.request<Session>('/sessions/', {
      method: 'POST',
      body: JSON.stringify({ session_date: date, name: name || null }),
    });
    await this.mutate(data => {
      data.sessions.unshift(result);
    });
    await this.loadRoster(result.id);
    return result.id;
  }
  async transition(
    sessionId: number,
    action: 'confirm' | 'reopen',
    reason?: string,
  ) {
    if (!this.view.online)
      throw new Error('تأكيد الحلقة وإعادة فتحها يحتاجان إلى اتصال.');
    await this.sync();
    if (this.view.data.queue.some(p => p.values.session_id === sessionId))
      throw new Error('زامن التغييرات وعالج التعارضات قبل تأكيد الحلقة.');
    const current = await this.request<Roster>(
      `/sessions/${sessionId}/attendance`,
    );
    await this.request(`/sessions/${sessionId}/${action}`, {
      method: 'POST',
      body: JSON.stringify({
        expected_version: current.version,
        ...(reason ? { reason } : {}),
      }),
    });
    await this.loadRoster(sessionId);
  }
  autoSync(): Promise<void> {
    if (Date.now() < this.retryAfter) return Promise.resolve();
    return this.sync();
  }
  sync(): Promise<void> {
    if (this.flight) return this.flight;
    if (!this.view.online || this.closed) return Promise.resolve();
    this.flight = this.run()
      .catch(error => {
        if (!this.closed) {
          this.failures++;
          this.retryAfter =
            Date.now() +
            Math.min(300000, 1000 * 2 ** Math.min(this.failures, 9));
          this.view.error = errorMessage(error);
          this.notify();
        }
      })
      .finally(() => {
        this.flight = null;
        this.view.syncing = false;
        this.notify();
      });
    return this.flight;
  }
  private async run() {
    this.view.syncing = true;
    this.view.error = null;
    this.notify();
    const me = await this.request<User>('/auth/me');
    if (scopeSignature(this.view.data.user) !== scopeSignature(me)) {
      await this.mutate(data => {
        Object.assign(data, {
          ...emptyWorkspace(me),
          queue: data.queue.map(p => ({ ...p, issue: 'scope_changed' })),
        });
      });
    }
    if (!this.view.data.bootstrapped) {
      const [bootstrap, sessions] = await Promise.all([
        this.request<Bootstrap>('/sync/v1/bootstrap?history_days=90'),
        this.request<Session[]>('/sessions/all'),
      ]);
      if (![1, 2].includes(bootstrap.schema_version))
        throw new Error('إصدار بيانات المزامنة غير مدعوم. حدّث التطبيق.');
      const ids = new Set(bootstrap.sessions.map(s => s.id));
      await this.mutate(data => {
        data.settings = { ...data.settings, ...bootstrap.tahfiz };
        data.sessions = sessions.filter(s => ids.has(s.id));
        data.attendance = Object.fromEntries(
          bootstrap.attendance.map(a => [
            attendanceKey(a.session_id, a.student_id),
            a,
          ]),
        );
        data.cursor = bootstrap.cursor;
        data.bootstrapped = true;
      });
    }
    for (const session of this.view.data.sessions) {
      if (this.closed || !this.view.online) return;
      if (!this.view.data.rosters[session.id])
        await this.loadRoster(session.id);
    }
    // Freeze the exact mutation before sending. A lost response is retried with the same id.
    for (
      let round = 0;
      round < 20 && !this.closed && this.view.online;
      round++
    ) {
      const batch = nextBatch(this.view.data);
      if (!batch.length) break;
      await this.mutate(data => {
        batch.forEach(p => {
          const q = data.queue.find(x => x.mutation_id === p.mutation_id);
          if (q) q.attempted = true;
        });
      });
      const mutations: Mutation[] = batch.map(p => ({
        mutation_id: p.mutation_id,
        device_id: p.device_id,
        entity_type: p.entity_type,
        entity_key: p.entity_key,
        base_revision: p.base_revision,
        values: p.values,
        client_changed_at: p.client_changed_at,
      }));
      const response = await this.request<{ results: MutationResult[] }>(
        '/sync/v1/mutations',
        { method: 'POST', body: JSON.stringify({ mutations }) },
      );
      if (!response.results.length)
        throw new Error(
          'استجابة المزامنة غير مكتملة. لم تُحذف التغييرات المحلية.',
        );
      await this.mutate(data => applyResults(data, response.results));
    }
    const reload = new Set<number>();
    for (let page = 0; page < 100 && !this.closed; page++) {
      const feed = await this.request<{
        changes: Change[];
        next_cursor: number;
        has_more: boolean;
      }>(`/sync/v1/changes?cursor=${this.view.data.cursor}&limit=200`);
      if (feed.has_more && feed.next_cursor <= this.view.data.cursor)
        throw new Error('تعذر متابعة المزامنة. حاول مرة أخرى.');
      await this.mutate(data => {
        applyChanges(data, feed.changes).forEach(id => reload.add(id));
        data.cursor = feed.next_cursor;
      });
      if (!feed.has_more) break;
    }
    for (const id of reload) {
      if (this.closed || !this.view.online) return;
      if (this.view.data.sessions.some(s => s.id === id)) {
        try {
          await this.loadRoster(id);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
      }
    }
    const settings = canManage(me)
      ? await this.request<Settings>('/tahfiz/settings')
      : me.tahfiz;
    await this.mutate(data => {
      data.user = me;
      data.settings = { ...data.settings, ...settings };
      data.lastSync = new Date().toISOString();
    });
    if (!this.closed)
      await this.client.cacheUser?.({ ...me, tahfiz: this.view.data.settings });
    this.failures = 0;
    this.retryAfter = 0;
    // Summary refresh failures must not prevent attendance synchronization.
    try {
      const [summary, sessions] = await Promise.all([
        this.request<DashboardSummary>('/reports/dashboard-summary'),
        this.request<Session[]>('/sessions/upcoming'),
      ]);
      await this.mutate(data => {
        data.dashboard = {
          summary,
          sessions,
          updatedAt: new Date().toISOString(),
        };
      });
      this.view.dashboardError = undefined;
    } catch (error) {
      this.view.dashboardError = errorMessage(error);
    }
  }
}
