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
import { applyQuranReceipt, quranBatch, quranKey, queueQuran } from './quran';
import type { QuranRecord } from './quran';
import type { QuranProgressInput } from '../domain-types';
import { validateProgress } from '../progress';

interface Bootstrap {
  quran_progress?: QuranRecord[];
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
        quranQueue: cached.quranQueue?.map(p => ({
          ...p,
          issue: 'scope_changed',
        })),
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
  async editQuran(sessionId: number, values: QuranProgressInput) {
    validateProgress(values);
    await this.mutate(data => {
      const roster = data.rosters[sessionId];
      if (
        !data.settings.progress_tracking_enabled ||
        !roster?.quran_progress_enabled ||
        roster.is_confirmed ||
        data.user.role === 'auditor'
      )
        throw new Error('متابعة القرآن غير متاحة أو الحلقة مؤكدة.');
      if (
        !roster.sheikh_groups.some(g =>
          g.students.some(
            s =>
              s.id === values.student_id && s.quran_progress_enabled === true,
          ),
        )
      )
        throw new Error('الطالب ليس ضمن طلاب الحلقة.');
      if (!data.quranEntries)
        throw new Error(
          'حمّل بيانات متابعة القرآن أولاً قبل التسجيل دون اتصال.',
        );
      data.quranQueue = queueQuran(
        data.quranQueue || [],
        data.quranEntries,
        { ...values, session_id: sessionId },
        this.client.deviceId,
      );
    });
    clearTimeout(this.scheduled);
    this.scheduled = setTimeout(() => {
      void this.autoSync();
    }, 800);
  }
  async resolveQuran(key: string, keepLocal: boolean) {
    await this.mutate(data => {
      const related = (data.quranQueue || []).filter(q => q.entity_key === key);
      const issue = related.find(q => q.issue);
      const latest = related.at(-1);
      if (!issue || !latest) return;
      data.quranEntries ||= {};
      if (issue.server) data.quranEntries[key] = issue.server;
      else delete data.quranEntries[key];
      data.quranQueue = data.quranQueue!.filter(q => q.entity_key !== key);
      if (keepLocal)
        data.quranQueue = queueQuran(
          data.quranQueue,
          data.quranEntries,
          latest.values,
          this.client.deviceId,
        );
    });
    void this.sync();
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
  async resource<T>(path: string): Promise<T> {
    if (!this.view.online) {
      const cached = this.view.data.resources?.[path];
      if (!cached)
        throw new Error(
          'هذه البيانات لم تُحمّل على الجهاز بعد. اتصل بالإنترنت لتحميلها.',
        );
      return cached.value as T;
    }
    let value: T;
    try {
      value = await this.request<T>(path);
    } catch (error) {
      if (error instanceof ApiError && [403, 404].includes(error.status))
        await this.mutate(data => {
          if (data.resources) delete data.resources[path];
        });
      throw error;
    }
    await this.mutate(data => {
      data.resources ||= {};
      data.resources[path] = { value, fetchedAt: new Date().toISOString() };
    });
    return value;
  }
  async formDraft(key: string, value: unknown) {
    await this.mutate(data => {
      data.formDrafts ||= {};
      if (value === undefined) delete data.formDrafts[key];
      else data.formDrafts[key] = value;
    });
  }
  async publish<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    if (!this.view.online)
      throw new Error(
        'المسودة محفوظة على الجهاز. نشر هذا التغيير يحتاج إلى اتصال بالإنترنت.',
      );
    return this.request<T>(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
    await this.mutate(data => {
      data.rosters[id] = roster;
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
    if (
      this.view.data.queue.some(p => p.values.session_id === sessionId) ||
      this.view.data.quranQueue?.some(p => p.values.session_id === sessionId)
    )
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
          quranQueue: data.quranQueue?.map(p => ({
            ...p,
            issue: 'scope_changed',
          })),
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
        data.quranEntries = Object.fromEntries(
          (bootstrap.quran_progress || []).map(e => [
            quranKey(e.session_id, e.student_id, e.category),
            e,
          ]),
        );
        data.bootstrapped = true;
      });
    }
    if (!this.view.data.quranEntries) {
      const bootstrap = await this.request<Bootstrap>(
        '/sync/v1/bootstrap?history_days=90',
      );
      await this.mutate(data => {
        data.quranEntries = Object.fromEntries(
          (bootstrap.quran_progress || []).map(e => [
            quranKey(e.session_id, e.student_id, e.category),
            e,
          ]),
        );
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
    for (
      let round = 0;
      round < 20 && !this.closed && this.view.online;
      round++
    ) {
      const batch = quranBatch(this.view.data.quranQueue || []);
      if (!batch.length) break;
      await this.mutate(data => {
        batch.forEach(q => {
          const pending = data.quranQueue?.find(
            p => p.mutation_id === q.mutation_id,
          );
          if (pending) pending.attempted = true;
        });
      });
      const response = await this.request<{
        results: Parameters<typeof applyQuranReceipt>[2][];
      }>('/sync/v1/mutations', {
        method: 'POST',
        body: JSON.stringify({
          mutations: batch.map(
            ({
              attempted: _attempted,
              issue: _issue,
              server: _server,
              ...mutation
            }) => mutation,
          ),
        }),
      });
      if (!response.results.length)
        throw new Error('استجابة المزامنة غير مكتملة. تغييرات القرآن محفوظة.');
      await this.mutate(data => {
        for (const receipt of response.results)
          data.quranQueue = applyQuranReceipt(
            data.quranQueue || [],
            data.quranEntries!,
            receipt,
          );
      });
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
