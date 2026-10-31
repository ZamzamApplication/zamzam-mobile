import type {
  UserInfo,
  StudentCategory,
  StudentCustomField,
  StudentInfo,
  SheikhInfo,
} from './domain-types';
import type { Roster, Session, Settings } from './types';
import { ApiError } from './api';
export interface DemoManagementData {
  users?: UserInfo[];
  categories?: StudentCategory[];
  customFields?: StudentCustomField[];
  savedFilters?: {
    id: number;
    name: string;
    data: string;
    can_edit: boolean;
    can_delete: boolean;
  }[];
}
type Workspace = DemoManagementData & {
  settings: Settings;
  rosters: Record<number, Roster>;
  sessions: Session[];
  people?: StudentInfo[];
  sheikhs?: SheikhInfo[];
};
export function demoManagement(
  w: Workspace,
  route: string,
  method: string,
  body: Record<string, any>,
  params: URLSearchParams,
) {
  const result = (value: unknown) => ({ handled: true, value });
  w.users ||= [
    { id: 999, username: 'demo-admin', role: 'admin', sheikh_id: null },
  ];
  w.categories ||= [];
  w.customFields ||= [];
  w.savedFilters ||= [];
  if (route === '/users') {
    if (method === 'GET') return result(w.users);
    if (w.users.some(u => u.username === body.username))
      throw new ApiError('اسم المستخدم موجود.', 409);
    const user = { id: Date.now(), ...body } as UserInfo;
    delete (user as unknown as Record<string, unknown>).password;
    w.users.push(user);
    return result(user);
  }
  if (/^\/users\/\d+$/.test(route)) {
    const user = w.users.find(u => u.id === Number(route.split('/')[2]));
    if (!user) throw new ApiError('المستخدم غير موجود.', 404);
    if (method === 'DELETE') {
      w.users = w.users.filter(u => u.id !== user.id);
      return result({ message: 'تم إلغاء الوصول' });
    }
    const values = { ...body };
    delete values.password;
    Object.assign(user, values);
    return result(user);
  }
  if (route === '/student-categories') {
    if (method === 'GET') return result(w.categories);
    const category = { id: Date.now(), name: body.name };
    w.categories.push(category);
    return result(category);
  }
  if (/^\/student-categories\/\d+$/.test(route)) {
    const id = Number(route.split('/')[2]),
      category = w.categories.find(c => c.id === id);
    if (!category) throw new ApiError('التصنيف غير موجود.', 404);
    if (method === 'DELETE') {
      w.categories = w.categories.filter(c => c.id !== id);
      w.people?.forEach(st => {
        st.category_ids = st.category_ids?.filter(cid => cid !== id);
      });
      return result(undefined);
    }
    category.name = body.name;
    return result(category);
  }
  if (route === '/student-custom-fields') {
    if (method === 'GET')
      return result({
        fields: w.customFields.filter(
          f => params.get('include_inactive') === 'true' || f.is_active,
        ),
        can_create: true,
      });
    const field = {
      id: Date.now(),
      ...body,
      is_active: true,
      sort_order: w.customFields.length,
      can_edit: true,
    } as StudentCustomField;
    w.customFields.push(field);
    return result(field);
  }
  if (/^\/student-custom-fields\/\d+$/.test(route)) {
    const field = w.customFields.find(
      f => f.id === Number(route.split('/')[2]),
    );
    if (!field) throw new ApiError('الحقل غير موجود.', 404);
    Object.assign(field, body);
    return result(field);
  }
  if (route === '/saved-filters/') {
    if (method === 'GET') return result(w.savedFilters);
    const f = {
      id: Date.now(),
      name: body.name,
      data: body.data,
      can_edit: true,
      can_delete: true,
    };
    w.savedFilters.push(f);
    return result(f);
  }
  if (/^\/saved-filters\/\d+$/.test(route)) {
    const id = Number(route.split('/')[2]),
      f = w.savedFilters.find(item => item.id === id);
    if (!f) throw new ApiError('التصفية غير موجودة.', 404);
    if (method === 'DELETE') {
      w.savedFilters = w.savedFilters.filter(item => item.id !== id);
      return result(undefined);
    }
    Object.assign(f, body);
    return result(f);
  }
  if (/^\/students\/\d+\/upload-pic$/.test(route)) {
    const student = w.people?.find(st => st.id === Number(route.split('/')[2]));
    if (!student) throw new ApiError('الطالب غير موجود.', 404);
    student.profile_pic = body.uri;
    return result({ profile_pic: body.uri });
  }
  if (/^\/students\/\d+$/.test(route) && method === 'DELETE') {
    const id = Number(route.split('/')[2]);
    w.people = w.people?.filter(st => st.id !== id);
    Object.values(w.rosters).forEach(r =>
      r.sheikh_groups.forEach(g => {
        g.students = g.students.filter(st => st.id !== id);
      }),
    );
    return result(undefined);
  }
  if (/^\/sheikhs\/\d+\/deletion-preview$/.test(route)) {
    const id = Number(route.split('/')[2]),
      sheikh = w.sheikhs?.find(sh => sh.id === id);
    if (!sheikh) throw new ApiError('الشيخ غير موجود.', 404);
    return result({
      sheikh: { id, name: sheikh.name },
      students: (w.people || []).filter(st => st.sheikh?.id === id),
      destination_sheikhs: (w.sheikhs || []).filter(sh => sh.id !== id),
      linked_usernames: w.users
        .filter(u => u.sheikh_id === id)
        .map(u => u.username),
    });
  }
  if (/^\/sheikhs\/\d+\/delete$/.test(route)) {
    const id = Number(route.split('/')[2]),
      students = w.people?.filter(st => st.sheikh?.id === id) || [];
    if (
      students.some(
        st =>
          !body.student_resolutions.some((r: any) => r.student_id === st.id),
      )
    )
      throw new ApiError('حدد مصير جميع الطلاب.', 409);
    for (const choice of body.student_resolutions) {
      const st = w.people!.find(item => item.id === choice.student_id);
      if (!st) throw new ApiError('طالب غير موجود.', 409);
      if (choice.action === 'delete') {
        w.people = w.people!.filter(item => item.id !== st.id);
      } else st.sheikh = w.sheikhs!.find(sh => sh.id === choice.sheikh_id);
    }
    w.sheikhs = w.sheikhs?.filter(sh => sh.id !== id);
    w.users
      .filter(u => u.sheikh_id === id)
      .forEach(u => {
        u.sheikh_id = null;
      });
    return result({ message: 'تم حذف الشيخ' });
  }
  if (route === '/auth/tahfiz')
    return result({
      message: 'بانتظار الموافقة',
      status: 'pending',
      tahfiz_id: 100,
    });
  if (/^\/invitations\/preview\//.test(route))
    return result({
      tahfiz_id: w.settings.id,
      tahfiz_name: w.settings.name,
      role: 'sheikh',
      status: 'active',
      available: true,
    });
  if (/^\/invitations\/accept\//.test(route))
    return result({ tahfiz_id: w.settings.id, role: 'sheikh' });
  if (route === '/warnings')
    return result(
      (w.people || []).flatMap(st =>
        (st.warnings || []).map(warning => ({
          ...warning,
          student_name: st.name,
          sheikh_id: st.sheikh?.id,
          sheikh_name: st.sheikh?.name,
        })),
      ),
    );
  if (route === '/warnings/send') {
    const results = body.warning_ids.map((id: number) => {
      const warning = w.people
        ?.flatMap(st => st.warnings || [])
        .find(item => item.id === id);
      if (!warning)
        return { warning_id: id, success: false, error: 'الإنذار غير موجود' };
      warning.sent = true;
      return { warning_id: id, success: true };
    });
    return result({ results });
  }
  if (route === '/sessions/all')
    return result(
      params.get('include_archived') === 'true'
        ? w.sessions
        : w.sessions.filter(s => !s.archived_at),
    );
  const match = route.match(
    /^\/sessions\/(\d+)(?:\/(archive|recover|membership))?$/,
  );
  if (match && method !== 'GET') {
    const id = Number(match[1]),
      session = w.sessions.find(s => s.id === id),
      roster = w.rosters[id];
    if (!session || !roster) throw new ApiError('الحلقة غير موجودة.', 404);
    if (
      body.expected_version !== undefined &&
      body.expected_version !== roster.version
    )
      throw new ApiError('تغيرت الحلقة. أعد تحميلها.', 409);
    if (match[2] === 'archive' || match[2] === 'recover') {
      session.archived_at =
        match[2] === 'archive' ? new Date().toISOString() : null;
      roster.archived_at = session.archived_at;
    } else {
      if (roster.is_confirmed || roster.archived_at)
        throw new ApiError('الحلقة مقفلة.', 409);
      if (match[2] === 'membership') {
        roster.explicit_membership = true;
        roster.sheikh_groups = (w.sheikhs || []).map(sh => ({
          sheikh: sh,
          students: (w.people || [])
            .filter(
              st => st.sheikh?.id === sh.id && body.student_ids.includes(st.id),
            )
            .map(st => ({
              ...st,
              status: 'غياب',
              sheikh_id: sh.id,
              attendance_id: st.id,
              revision: 1,
            })),
        }));
      } else {
        session.date = body.session_date;
        roster.date = body.session_date;
        session.name = body.name;
        roster.name = body.name;
      }
    }
    roster.version++;
    session.version = roster.version;
    return result({ ...session });
  }
  return { handled: false, value: undefined };
}
