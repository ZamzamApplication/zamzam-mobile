import type { StudentInfo, SheikhInfo, StudentQuranPlan } from './domain-types';
import type { SavedPlan } from './plan-model';
import type { QuranRecord } from './offline/quran';
import type { Roster, Session, Settings } from './types';
import { localDate, uid } from './types';
import { ApiError } from './api';
export interface DemoFeatureData {
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
