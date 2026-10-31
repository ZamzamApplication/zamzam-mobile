import { demoManagement } from './demo-management';
import type { DemoManagementData } from './demo-management';
import type { StudentInfo, SheikhInfo, StudentQuranPlan } from './domain-types';
import type { SavedPlan } from './plan-model';
import type { QuranRecord } from './offline/quran';
import type { Roster, Session, Settings } from './types';
import { localDate, uid } from './types';
import { ApiError } from './api';
export interface DemoFeatureData extends DemoManagementData {
  people?: StudentInfo[];
  sheikhs?: SheikhInfo[];
  progress?: QuranRecord[];
  studentPlans?: Record<string, StudentQuranPlan[]>;
  personalPlans?: Record<string, SavedPlan>;
  featureVersion?: number;
}
type Workspace = DemoFeatureData & {
  settings: Settings;
  sessions: Session[];
  rosters: Record<number, Roster>;
};
export function demoFeature(
  w: Workspace,
  route: string,
  method: string,
  body: Record<string, any>,
  params = new URLSearchParams(),
) {
  const first = Object.values(w.rosters)[0];
  w.sheikhs ||=
    first?.circle_sheikhs.map(s => ({
      ...s,
      circle_id: w.settings.id,
      circle_name: w.settings.name,
      phone: '',
    })) || [];
  w.people ||=
    first?.sheikh_groups.flatMap(g =>
      g.students.map(s => ({
        id: s.id,
        name: s.name,
        phone: '',
        status: 'مقيد',
        sheikh: g.sheikh,
        warnings: [],
        parent_phones: [],
        excused_weekdays: [],
        excused_periods: [],
        category_ids: [],
        custom_field_values: {},
        registration_date: localDate(),
        quran_progress_enabled: true,
      })),
    ) || [];
  w.progress ||= [];
  w.studentPlans ||= {};
  w.personalPlans ||= {};
  const result = (value: unknown) => ({ handled: true, value });
  if (/^\/reports\/circle\/\d+\/(rate|student-stats)$/.test(route)) {
    const matches = (date: string) =>
      (!params.get('date_from') || date >= params.get('date_from')!) &&
      (!params.get('date_to') || date <= params.get('date_to')!);
    const students = w.people
      .filter(
        s =>
          !params.get('sheikh_id') ||
          s.sheikh?.id === Number(params.get('sheikh_id')),
      )
      .map(s => {
        const counts: Record<string, number> = {};
        Object.values(w.rosters)
          .filter(r => r.is_confirmed && matches(r.date))
          .forEach(r =>
            r.sheikh_groups.forEach(g =>
              g.students
                .filter(st => st.id === s.id && st.attendance_id !== null)
                .forEach(st => {
                  counts[st.status] = (counts[st.status] || 0) + 1;
                }),
            ),
          );
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const present = counts[w.settings.present_status || 'حاضر'] || 0;
        return {
          student_id: s.id,
          student_name: s.name,
          sheikh_name: s.sheikh?.name || '',
          total_sessions: total,
          total_applicable_sessions: total,
          status_counts: counts,
          present,
          absent: total - present,
          excused: 0,
          not_applicable: 0,
          attendance_rate: total ? (present / total) * 100 : 0,
        };
      });
    if (route.endsWith('/student-stats'))
      return result({ circle_id: w.settings.id, scope: 'tenant', students });
    const counts: Record<string, number> = {};
    students.forEach(s =>
      Object.entries(s.status_counts).forEach(([k, v]) => {
        counts[k] = (counts[k] || 0) + v;
      }),
    );
    const total = students.reduce((n, s) => n + s.total_sessions, 0),
      present = students.reduce((n, s) => n + s.present, 0);
    return result({
      circle_id: w.settings.id,
      scope: 'tenant',
      total_attendance_records: total,
      total_applicable_records: total,
      status_counts: counts,
      present,
      absent: total - present,
      excused: 0,
      not_applicable: 0,
      attendance_rate: total ? (present / total) * 100 : 0,
    });
  }
  if (route === '/reports/quran-progress') {
    const entries = w.progress.filter(e => {
      const r = w.rosters[e.session_id],
        student = w.people!.find(s => s.id === e.student_id);
      return (
        r &&
        (!params.get('date_from') || r.date >= params.get('date_from')!) &&
        (!params.get('date_to') || r.date <= params.get('date_to')!) &&
        (!params.get('sheikh_id') ||
          student?.sheikh?.id === Number(params.get('sheikh_id')))
      );
    });
    const totals: Record<string, number> = {};
    entries.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + 1;
    });
    return result({
      enabled: w.settings.progress_tracking_enabled,
      category_totals: totals,
      students: w.people.flatMap(s => {
        const records = entries.filter(e => e.student_id === s.id);
        return records.length
          ? [
              {
                student_id: s.id,
                student_name: s.name,
                entries: records.length,
                average_quality:
                  records.reduce((n, e) => n + e.quality_score, 0) /
                  records.length,
                mistakes: records.reduce((n, e) => n + (e.mistakes || 0), 0),
                latest_entry: records[records.length - 1],
              },
            ]
          : [];
      }),
    });
  }
  if (route === '/audit-logs') {
    const records = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      actor_user_id: 1,
      actor_username: 'demo-admin',
      action: i % 2 ? 'session.confirmed' : 'attendance.batch_updated',
      details: JSON.stringify({ session: i + 1, records: 12 }),
      created_at: new Date().toISOString(),
    }));
    const filtered = records.filter(
      e =>
        (!params.get('action') || e.action === params.get('action')) &&
        (!params.get('actor_user_id') ||
          e.actor_user_id === Number(params.get('actor_user_id'))) &&
        (!params.get('query') ||
          (e.details + e.actor_username).includes(params.get('query')!)) &&
        (!params.get('date_from') ||
          e.created_at.slice(0, 10) >= params.get('date_from')!) &&
        (!params.get('date_to') ||
          e.created_at.slice(0, 10) <= params.get('date_to')!),
    );
    const page = Number(params.get('page') || 1),
      size = Number(params.get('page_size') || 25);
    return result({
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      page,
      page_size: size,
      pages: Math.max(1, Math.ceil(filtered.length / size)),
      actions: ['session.confirmed', 'attendance.batch_updated'],
      actors: [{ id: 1, username: 'demo-admin' }],
    });
  }
  const management = demoManagement(w, route, method, body, params);
  if (management.handled) return management;
  if (route === '/student-categories') return result([]);
  if (route === '/student-custom-fields')
    return result({ fields: [], can_create: true });
  if (route === '/sheikhs') {
    if (method === 'GET') return result(w.sheikhs);
    const sheikh = {
      ...body,
      id: Date.now(),
      circle_id: w.settings.id,
      circle_name: w.settings.name,
    } as SheikhInfo;
    w.sheikhs.push(sheikh);
    return result(sheikh);
  }
  if (/^\/sheikhs\/\d+$/.test(route)) {
    const sheikh = w.sheikhs.find(s => s.id === Number(route.split('/')[2]));
    if (!sheikh) throw new ApiError('الشيخ غير موجود.', 404);
    Object.assign(sheikh, body);
    return result(sheikh);
  }
  if (route === '/students') {
    if (method === 'GET') return result(w.people);
    const sheikh = w.sheikhs.find(s => s.id === body.sheikh_id);
    const student = {
      ...body,
      name: String(body.name || ''),
      status: String(body.status || 'مقيد'),
      id: Date.now(),
      sheikh,
      warnings: [],
      excused_weekdays: [],
      excused_periods: [],
    } as StudentInfo;
    w.people.push(student);
    return result(student);
  }
  if (route.startsWith('/students/')) {
    const id = Number(route.split('/')[2]);
    const student = w.people.find(s => s.id === id);
    if (!student) throw new ApiError('الطالب غير موجود.', 404);
    if (route.endsWith('/profile')) {
      const rows = Object.values(w.rosters).flatMap(r =>
        r.sheikh_groups.flatMap(g =>
          g.students.filter(s => s.id === id && s.attendance_id !== null),
        ),
      );
      const entries = w.progress.filter(p => p.student_id === id);
      return result({
        ...student,
        parent_phones: student.parent_phones || [],
        excused_weekdays: student.excused_weekdays || [],
        excused_periods: student.excused_periods || [],
        can_manage: true,
        attendance: {
          total: rows.length,
          present: rows.filter(s => s.status === w.settings.present_status)
            .length,
          absent: rows.filter(s => s.status === w.settings.absent_status)
            .length,
          excused: rows.filter(s => s.status === 'غياب بعذر').length,
          not_applicable: 0,
          streak: 0,
          streak_limit: 3,
          streak_status: 'غياب بعذر',
          streak_alert_enabled: true,
        },
        progress: {
          enabled: w.settings.progress_tracking_enabled,
          student_enabled: student.quran_progress_enabled,
          entries: entries.length,
          average_quality: entries.length
            ? entries.reduce((n, p) => n + p.quality_score, 0) / entries.length
            : 0,
          active_goals: 0,
          categories: w.settings.progress_categories,
        },
      });
    }
    if (route.endsWith('/quran-plans')) {
      if (method === 'PUT') w.studentPlans[id] = body.plans;
      return result({
        plans: w.studentPlans[id] || [],
        student_enabled: student.quran_progress_enabled,
        categories: w.settings.progress_categories || [],
      });
    }
    if (route.endsWith('/progress'))
      return result({
        enabled: w.settings.progress_tracking_enabled,
        entries: w.progress
          .filter(p => p.student_id === id)
          .map(p => ({
            ...p,
            session_date: w.sessions.find(s => s.id === p.session_id)?.date,
          })),
        goals: [],
        average_quality: 0,
        trend: [],
        revisions: [],
      });
    if (route.endsWith('/move-sheikh')) {
      if (student.sheikh?.id !== body.expected_current_sheikh_id)
        throw new ApiError('تغير شيخ الطالب.', 409);
      student.sheikh = w.sheikhs.find(s => s.id === body.sheikh_id);
      return result({ message: 'تم النقل' });
    }
    if (route.endsWith('/warnings')) {
      student.warnings.push({
        id: Date.now(),
        reason: body.reason,
        warning_number: student.warnings.length + 1,
        sent: false,
        created_at: new Date().toISOString(),
      });
      return result({ message: 'تم' });
    }
    if (route.endsWith('/excused-weekdays')) {
      student.excused_weekdays = body.weekdays;
      return result(body.weekdays);
    }
    if (route.endsWith('/excused-periods')) {
      student.excused_periods ||= [];
      student.excused_periods.push({
        ...body,
        start_date: String(body.start_date),
        end_date: String(body.end_date),
        reason: String(body.reason),
        id: Date.now(),
        student_id: id,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result(student.excused_periods.at(-1));
    }
    if (route.endsWith('/cancel')) {
      const period = student.excused_periods?.find(
        p => p.id === Number(route.split('/')[4]),
      );
      if (period) period.status = 'cancelled';
      return result({});
    }
    if (/^\/students\/\d+$/.test(route) && method === 'PUT') {
      Object.assign(student, body);
      return result(student);
    }
  }
  if (/^\/sessions\/\d+\/progress-tracking$/.test(route)) {
    const id = Number(route.split('/')[2]);
    const roster = w.rosters[id];
    if (
      !roster ||
      roster.is_confirmed ||
      roster.version !== body.expected_version
    )
      throw new ApiError('تغيرت الحلقة.', 409);
    roster.quran_progress_enabled = body.enabled;
    roster.version++;
    Object.assign(w.sessions.find(s => s.id === id)!, {
      quran_progress_enabled: body.enabled,
      version: roster.version,
    });
    return result({
      session_id: id,
      version: roster.version,
      quran_progress_enabled: body.enabled,
    });
  }
  if (/^\/sessions\/\d+\/progress$/.test(route)) {
    const id = Number(route.split('/')[2]);
    const categories = w.settings.progress_categories || [];
    return result({
      enabled:
        !!w.settings.progress_tracking_enabled &&
        !!w.rosters[id]?.quran_progress_enabled,
      entries: w.progress.filter(p => p.session_id === id),
      previous_entries: [],
      suggested_entries: [],
      categories,
    });
  }
  if (route === '/personal-plans') {
    if (method === 'GET') return result(Object.values(w.personalPlans));
    const plan: SavedPlan = {
      ...body,
      id: uid(),
      completed: false,
      archived: false,
      share_mode: 'private',
      version: 1,
      can_edit: true,
      can_mark: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as SavedPlan;
    w.personalPlans[plan.id] = plan;
    return result(plan);
  }
  if (route.startsWith('/personal-plans/')) {
    const id = route.split('/')[2],
      plan = w.personalPlans[id];
    if (!plan) throw new ApiError('الخطة غير موجودة.', 404);
    if (method === 'GET') return result(plan);
    if (
      body.expected_version !== undefined &&
      plan.version !== body.expected_version
    )
      throw new ApiError('تغيرت الخطة. مسودتك محفوظة، راجع أحدث نسخة.', 409);
    if (method === 'DELETE') {
      delete w.personalPlans[id];
      return result(undefined);
    }
    Object.assign(plan, body, {
      version: plan.version + 1,
      updated_at: new Date().toISOString(),
    });
    if (body.share_mode && body.share_mode !== 'private')
      plan.share_token = `demo-${plan.id}`;
    return result(plan);
  }
  return { handled: false, value: undefined };
}
