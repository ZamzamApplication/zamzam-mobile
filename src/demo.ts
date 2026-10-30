import { readDocument, writeDocument } from './offline/database';
import { ApiError } from './api';
import { absentFor, localDate } from './types';
import { demoFeature } from './demo-features';
import type { DemoFeatureData } from './demo-features';
import { DEFAULT_EXCEL_EXPORT_TEMPLATES } from './excel-templates';
import type {
  AttendanceUpdate,
  Gateway,
  Grid,
  Invitation,
  Roster,
  Session,
  Settings,
  User,
} from './types';

interface Workspace extends DemoFeatureData {
  settings: Settings;
  sessions: Session[];
  rosters: Record<number, Roster>;
  cursor?: number;
  receipts?: Record<string, { body: string; result: unknown }>;
  invitations?: Invitation[];
}
const STORAGE = 'zamzam.demo.v1';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function fixtures(id: number): Workspace {
  const settings: Settings = {
    id,
    name: id === 1 ? 'تحفيظ زمزم' : 'تحفيظ النور',
    description: 'حفظ القرآن الكريم ومراجعته',
    contact_phone: '',
    status: 'active',
    week_start_day: 6,
    month_start_day: 1,
    max_warnings: 3,
    attendance_statuses: ['حاضر', 'غياب', 'غياب بعذر', 'لا ينطبق'],
    attendance_status_colors: {
      حاضر: 'green',
      غياب: 'slate',
      'غياب بعذر': 'amber',
      'لا ينطبق': 'sky',
    },
    present_status: 'حاضر',
    absent_status: 'غياب',
    attendance_sheikh_selection_enabled: true,
    restrict_sheikh_student_access: true,
    multiple_sessions_per_day_enabled: false,
    session_name_options: ['الصباحية', 'المسائية'],
    progress_tracking_enabled: true,
    progress_categories: ['new_memorization', 'recent_revision'],
    attendance_streak_limit: 3,
    attendance_streak_status: 'غياب بعذر',
    attendance_streak_alert_enabled: true,
    attendance_streak_reset_statuses: ['حاضر'],
    whatsend_enabled: false,
    excel_export_templates: clone(DEFAULT_EXCEL_EXPORT_TEMPLATES),
  };
  const sessions: Session[] = [0, -1, -3].map((offset, index) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      id: id * 100 + index,
      date: localDate(d),
      name: index === 0 ? 'الصباحية' : null,
      daily_sequence: 1,
      circle_id: id,
      circle_name: settings.name,
      version: 1,
      is_confirmed: index === 2,
      status: index === 2 ? 'confirmed' : 'draft',
      quran_progress_enabled: true,
      student_count: 6,
    };
  });
  const names =
    id === 1
      ? [
          'أحمد محمد علي',
          'عمر عبد الرحمن',
          'يوسف إبراهيم',
          'عبد الله محمود',
          'محمد خالد',
          'إبراهيم حسن',
        ]
      : [
          'أنس مصطفى',
          'معاذ أحمد',
          'يحيى عبد الله',
          'سيف الدين علي',
          'آدم محمود',
          'حمزة سعيد',
        ];
  const sheikhs = [
    { id: id * 10 + 1, name: 'الشيخ محمد أحمد' },
    { id: id * 10 + 2, name: 'الشيخ عبد الرحمن' },
  ];
  const rosters: Record<number, Roster> = {};
  sessions.forEach(session => {
    rosters[session.id] = {
      ...session,
      session_id: session.id,
      version: 1,
      circle_sheikhs: sheikhs,
      sheikh_groups: sheikhs.map((sheikh, group) => ({
        sheikh,
        students: names.slice(group * 3, group * 3 + 3).map((name, index) => ({
          id: id * 1000 + group * 3 + index,
          name,
          attendance_id: session.is_confirmed ? index + 1 : null,
          status: session.is_confirmed
            ? index === 2
              ? 'غياب بعذر'
              : 'حاضر'
            : 'غياب',
          notes: '',
          quran_progress_enabled: true,
          sheikh_id: sheikh.id,
        })),
      })),
    };
  });
  return { settings, sessions, rosters };
}
export class DemoClient implements Gateway {
  readonly demo = true;
  readonly deviceId = 'zamzam-demo-device';
  readonly accountKey = 'demo:1';
  private constructor(
    private tenant = 1,
    private workspaces: Record<number, Workspace> = {
      1: fixtures(1),
      2: fixtures(2),
    },
  ) {}
  private receipts = new Map<string, { body: string; result: unknown }>();
  static async create() {
    const saved = await readDocument<{
      tenant: number;
      workspaces: Record<number, Workspace>;
    }>(STORAGE);
    if (saved) {
      try {
        const d = saved;
        if (d.workspaces?.[1] && d.workspaces?.[2]) {
          for (const w of Object.values(d.workspaces))
            if (!w.featureVersion) {
              w.featureVersion = 1;
              w.cursor = (w.cursor || 0) + 1;
              w.settings.progress_tracking_enabled = true;
              w.sessions.forEach(session => {
                session.quran_progress_enabled = true;
              });
              Object.values(w.rosters).forEach(roster => {
                roster.quran_progress_enabled = true;
                roster.sheikh_groups.forEach(g =>
                  g.students.forEach(student => {
                    student.quran_progress_enabled = true;
                  }),
                );
              });
            }
          const client = new DemoClient(d.tenant, d.workspaces);
          await client.persist();
          return client;
        }
      } catch {}
    }
    return new DemoClient();
  }
  get user(): User {
    return this.userFor(this.tenant);
  }
  private userFor(tenant: number): User {
    return {
      id: 1,
      username: 'حساب تجريبي',
      role: 'admin',
      tahfiz_id: tenant,
      sheikh_id: null,
      tahfiz: clone(this.workspaces[tenant].settings),
      memberships: Object.values(this.workspaces).map(w => ({
        id: w.settings.id,
        tahfiz_id: w.settings.id,
        tahfiz_name: w.settings.name,
        tahfiz_status: 'active',
        role: 'admin',
        sheikh_id: null,
        is_active: true,
      })),
    };
  }
  private async persist() {
    await writeDocument(STORAGE, {
      tenant: this.tenant,
      workspaces: this.workspaces,
    });
  }
  async logout() {}
  async selectCachedTenant(user: User) {
    await this.switchTenant(user.tahfiz_id!);
  }
  async switchTenant(id: number) {
    if (!this.workspaces[id])
      throw new ApiError('لا يوجد اشتراك نشط في هذا التحفيظ.', 403);
    this.tenant = id;
    await this.persist();
    return this.user;
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const tenant =
      Number((options.headers as Record<string, string>)?.['X-Tahfiz-ID']) ||
      this.tenant;
    const w = this.workspaces[tenant];
    const [route, query = ''] = path.split('?');
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(String(options.body)) : {};
    let result: unknown;
    const attendance = () =>
      Object.values(w.rosters).flatMap(r =>
        r.sheikh_groups.flatMap(g =>
          g.students
            .filter(s => s.attendance_id !== null)
            .map(s => ({
              id: r.session_id * 100000 + s.id,
              session_id: r.session_id,
              student_id: s.id,
              status: s.status,
              notes: s.notes || null,
              sheikh_id: s.sheikh_id,
              revision: s.revision || 1,
            })),
        ),
      );
    const feature = demoFeature(w, route, method, body);
    if (feature.handled) {
      await this.persist();
      return (
        feature.value === undefined ? undefined : clone(feature.value)
      ) as T;
    }
    if (route === '/auth/me') return this.userFor(tenant) as T;
    if (route === '/reports/dashboard-summary') {
      const roster = Object.values(w.rosters)[0];
      const confirmed = w.sessions.filter(s => s.is_confirmed).length;
      return {
        tahfiz_name: w.settings.name,
        students:
          roster?.sheikh_groups.reduce((n, g) => n + g.students.length, 0) || 0,
        sheikhs: roster?.circle_sheikhs.length || 0,
        sessions: w.sessions.length,
        confirmed_sessions: confirmed,
        pending_sessions: w.sessions.length - confirmed,
      } as T;
    }
    if (route === '/sessions/upcoming')
      return clone(
        w.sessions
          .filter(s => !s.is_confirmed)
          .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
      ) as T;
    if (route === '/sync/v1/bootstrap')
      return clone({
        schema_version: 2,
        cursor: w.cursor || 0,
        tahfiz: w.settings,
        sessions: w.sessions,
        attendance: attendance(),
        quran_progress: w.progress || [],
      }) as T;
    if (route === '/sync/v1/changes') {
      const cursor = Number(new URLSearchParams(query).get('cursor')) || 0;
      return clone({
        changes:
          cursor < (w.cursor || 0)
            ? [
                ...w.sessions.map(s => ({
                  entity_type: 'session',
                  entity_key: String(s.id),
                  operation: 'upsert',
                  payload: s,
                })),
                ...(w.progress || []).map(p => ({
                  entity_type: 'quran_progress',
                  entity_key: String(p.id),
                  operation: 'upsert',
                  payload: p,
                })),
                ...attendance().map(a => ({
                  entity_type: 'attendance',
                  entity_key: String(a.id),
                  operation: 'upsert',
                  payload: a,
                })),
              ]
            : [],
        next_cursor: w.cursor || 0,
        has_more: false,
      }) as T;
    }
    if (route === '/sync/v1/mutations') {
      const results: unknown[] = [];
      w.receipts ||= {};
      for (const m of body.mutations) {
        const receipt = w.receipts[m.mutation_id];
        if (receipt) {
          results.push({ ...(receipt.result as object), replayed: true });
          continue;
        }
        if (m.entity_type === 'quran_progress') {
          const server = (w.progress || []).find(
            p =>
              p.session_id === m.values.session_id &&
              p.student_id === m.values.student_id &&
              p.category === m.values.category,
          );
          const roster = w.rosters[m.values.session_id];
          let response;
          if (roster?.is_confirmed)
            response = { status: 'rejected', code: 'session_locked' };
          else if ((server?.revision || 0) !== m.base_revision)
            response = {
              status: 'conflict',
              code: 'revision_conflict',
              server: server || null,
            };
          else {
            const entry = {
              ...m.values,
              id: server?.id || Date.now(),
              revision: (server?.revision || 0) + 1,
            };
            w.progress = [
              ...(w.progress || []).filter(p => p !== server),
              entry,
            ];
            w.cursor = (w.cursor || 0) + 1;
            response = { status: 'applied', entity: entry };
          }
          const receipt = { ...response, mutation_id: m.mutation_id };
          w.receipts[m.mutation_id] = {
            body: JSON.stringify(m),
            result: receipt,
          };
          results.push(receipt);
          continue;
        }
        const roster = w.rosters[m.values.session_id];
        const student = roster?.sheikh_groups
          .flatMap(g => g.students)
          .find(s => s.id === m.values.student_id);
        let response: Record<string, unknown>;
        const server = attendance().find(
          a =>
            a.session_id === m.values.session_id &&
            a.student_id === m.values.student_id,
        );
        if (!student || !roster)
          response = { status: 'rejected', code: 'entity_not_found' };
        else if (roster.is_confirmed)
          response = { status: 'rejected', code: 'session_locked' };
        else if (!w.settings.attendance_statuses?.includes(m.values.status))
          response = { status: 'rejected', code: 'invalid_attendance_status' };
        else if ((server?.revision || 0) !== m.base_revision)
          response = {
            status: 'conflict',
            code: 'revision_conflict',
            server: server || null,
            local: m.values,
          };
        else {
          Object.assign(student, m.values, {
            revision: (server?.revision || 0) + 1,
            attendance_id: student.id,
          });
          roster.version++;
          w.sessions.find(s => s.id === roster.session_id)!.version =
            roster.version;
          w.cursor = (w.cursor || 0) + 1;
          response = {
            status: 'applied',
            entity: attendance().find(
              a =>
                a.session_id === m.values.session_id &&
                a.student_id === m.values.student_id,
            ),
          };
        }
        response = { ...response, mutation_id: m.mutation_id, replayed: false };
        w.receipts[m.mutation_id] = {
          body: JSON.stringify(m),
          result: response,
        };
        results.push(response);
      }
      await this.persist();
      return clone({ results, cursor: w.cursor || 0 }) as T;
    }
    if (route === '/sessions/all') return clone(w.sessions) as T;
    if (route.startsWith('/invitations/')) {
      w.invitations ||= [];
      if (method === 'GET') result = w.invitations;
      else if (method === 'DELETE') {
        w.invitations.find(i => i.id === Number(route.split('/')[2]))!.status =
          'revoked';
      } else {
        const id = route.endsWith('/resend')
          ? Number(route.split('/')[2])
          : Date.now();
        const entry: Invitation = {
          id,
          role: body.role || 'sheikh',
          status: 'active',
          expires_at: new Date(
            Date.now() + Number(body.expires_hours || 48) * 3600000,
          ).toISOString(),
          path: `/invite/demo-${id}`,
        };
        w.invitations = w.invitations.filter(i => i.id !== id);
        w.invitations.push(entry);
        result = entry;
      }
      await this.persist();
      return (result === undefined ? undefined : clone(result)) as T;
    }
    if (route === '/tahfiz/settings') {
      if (method === 'PUT') {
        const { whatsend_api_key: serviceKey, ...settingsBody } = body;
        w.settings = {
          ...w.settings,
          ...settingsBody,
          ...(serviceKey ? { whatsend_api_key_configured: true } : {}),
        };
        w.sessions.forEach(s => {
          s.circle_name = w.settings.name;
        });
        Object.values(w.rosters).forEach(r => {
          r.circle_name = w.settings.name;
        });
      }
      result = w.settings;
    } else if (route === '/sheikhs') {
      result = Object.values(w.rosters)[0]?.circle_sheikhs || [];
    } else if (route === '/reports/attendance-grid') {
      const params = new URLSearchParams(query);
      const sessions = w.sessions.filter(
        s =>
          (!params.get('date_from') || s.date >= params.get('date_from')!) &&
          (!params.get('date_to') || s.date <= params.get('date_to')!),
      );
      const roster = Object.values(w.rosters)[0];
      const grid: Grid = {
        sessions,
        students: (roster?.sheikh_groups.flatMap(g => g.students) || []).map(
          st => ({
            id: st.id,
            name: st.name,
            sheikh_id: st.sheikh_id,
            sheikh_name: roster.circle_sheikhs.find(s => s.id === st.sheikh_id)
              ?.name,
            records: Object.fromEntries(
              sessions.map(s => [
                s.id,
                w.rosters[s.id].sheikh_groups
                  .flatMap(g => g.students)
                  .find(x => x.id === st.id)?.status ?? null,
              ]),
            ),
          }),
        ),
      };
      result = grid;
    } else if (route === '/sessions/' && method === 'POST') {
      if (
        !w.settings.multiple_sessions_per_day_enabled &&
        w.sessions.some(s => s.date === body.session_date)
      )
        throw new ApiError('توجد حلقة بهذا التاريخ بالفعل.', 409);
      const sample = clone(Object.values(w.rosters)[0]);
      const id = Math.max(...w.sessions.map(s => s.id)) + 1;
      const session: Session = {
        id,
        date: body.session_date,
        name: body.name,
        circle_id: tenant,
        circle_name: w.settings.name,
        is_confirmed: false,
        status: 'draft',
        quran_progress_enabled: true,
        version: 1,
        student_count: 6,
      };
      const roster: Roster = {
        ...sample,
        ...session,
        session_id: id,
        version: 1,
      };
      roster.sheikh_groups.forEach(g =>
        g.students.forEach(s => {
          s.status = absentFor(w.settings);
          s.notes = '';
          s.attendance_id = null;
        }),
      );
      w.rosters[id] = roster;
      w.sessions.unshift(session);
      result = session;
    } else if (route === '/attendance/batch') {
      const key = (options.headers as Record<string, string>)?.[
        'Idempotency-Key'
      ];
      const receipt = this.receipts.get(`${tenant}:${key}`);
      if (receipt) {
        if (receipt.body !== String(options.body))
          throw new ApiError('مفتاح الطلب مستخدم لبيانات مختلفة.', 409);
        return { ...clone(receipt.result as object), replayed: true } as T;
      }
      const roster = w.rosters[body.session_id];
      if (!roster) throw new ApiError('الحلقة غير موجودة.', 404);
      if (roster.is_confirmed || roster.version !== body.expected_version)
        throw new ApiError('تغيرت الحلقة. أعد تحميل البيانات.', 409);
      (body.updates as AttendanceUpdate[]).forEach(update => {
        if (!w.settings.attendance_statuses?.includes(update.status))
          throw new ApiError('حالة الحضور غير صالحة.', 422);
        const student = roster.sheikh_groups
          .flatMap(g => g.students)
          .find(s => s.id === update.student_id);
        if (!student) throw new ApiError('الطالب غير موجود في الحلقة.', 404);
        Object.assign(student, update, { attendance_id: student.id });
      });
      roster.version++;
      w.sessions.find(s => s.id === body.session_id)!.version = roster.version;
      result = {
        session_id: body.session_id,
        version: roster.version,
        saved: body.updates.length,
        replayed: false,
        threshold_alerts: [],
      };
      this.receipts.set(`${tenant}:${key}`, {
        body: String(options.body),
        result: clone(result),
      });
    } else {
      const match = route.match(
        /^\/sessions\/(\d+)\/(attendance|confirm|reopen)$/,
      );
      if (!match) throw new ApiError('هذه العملية غير متاحة في التجربة.', 404);
      const roster = w.rosters[Number(match[1])];
      if (!roster) throw new ApiError('الحلقة غير موجودة.', 404);
      if (match[2] !== 'attendance') {
        if (body.expected_version !== roster.version)
          throw new ApiError('تغيرت الحلقة. أعد تحميلها.', 409);
        if (match[2] === 'reopen' && !body.reason?.trim())
          throw new ApiError('اكتب سبب إعادة فتح الحلقة.', 422);
        roster.is_confirmed = match[2] === 'confirm';
        roster.status = roster.is_confirmed ? 'confirmed' : 'reopened';
        roster.version++;
        Object.assign(w.sessions.find(s => s.id === roster.session_id)!, {
          is_confirmed: roster.is_confirmed,
          status: roster.status,
          version: roster.version,
        });
      }
      result = roster;
    }
    if (method !== 'GET') await this.persist();
    return clone(result) as T;
  }
}
