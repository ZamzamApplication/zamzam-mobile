import React, { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import type {
  SheikhInfo,
  StudentCategory,
  StudentCustomField,
  StudentInfo,
  StudentProfile,
} from '../domain-types';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { canManage, localDate } from '../types';
import {
  Avatar,
  Button,
  Card,
  Field,
  Notice,
  Select,
  Toggle,
  Txt,
  s,
} from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';

export function PeopleScreen({
  engine,
  onBack,
  onProfile,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  onProfile: (id: number) => void;
}) {
  const { data, online } = useEngine(engine);
  const admin = canManage(data.user);
  const students = useResource<StudentInfo[]>(
    engine,
    admin ? '/students' : null,
  );
  const sheikhs = useResource<SheikhInfo[]>(engine, '/sheikhs');
  const categories = useResource<StudentCategory[]>(
    engine,
    admin ? '/student-categories' : null,
  );
  const fields = useResource<{ fields: StudentCustomField[] }>(
    engine,
    admin ? '/student-custom-fields' : null,
  );
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('students');
  const [filter, setFilter] = useState('');
  const [editStudent, setEditStudent] = useState<StudentInfo | 'new' | null>(
    null,
  );
  const [editSheikh, setEditSheikh] = useState<SheikhInfo | 'new' | null>(null);
  const fromRosters = [
    ...new Map(
      Object.values(data.rosters).flatMap(r =>
        r.sheikh_groups.flatMap(g =>
          g.students.map(
            st =>
              [
                st.id,
                {
                  ...st,
                  status: '',
                  warnings: [],
                  sheikh: g.sheikh,
                } as StudentInfo,
              ] as const,
          ),
        ),
      ),
    ).values(),
  ];
  const rows = admin ? students.value || [] : fromRosters;
  const reload = () => {
    students.reload();
    sheikhs.reload();
    categories.reload();
    fields.reload();
  };
  if (editStudent)
    return (
      <StudentEditor
        key={editStudent === 'new' ? 'new' : editStudent.id}
        engine={engine}
        student={editStudent === 'new' ? undefined : editStudent}
        sheikhs={sheikhs.value || []}
        categories={categories.value || []}
        fields={fields.value?.fields || []}
        onBack={() => setEditStudent(null)}
        onSaved={() => {
          setEditStudent(null);
          reload();
        }}
      />
    );
  if (editSheikh)
    return (
      <SheikhEditor
        key={editSheikh === 'new' ? 'new' : editSheikh.id}
        engine={engine}
        sheikh={editSheikh === 'new' ? undefined : editSheikh}
        onBack={() => setEditSheikh(null)}
        onSaved={() => {
          setEditSheikh(null);
          reload();
        }}
      />
    );
  return (
    <FeaturePage
      engine={engine}
      title="الشيوخ والطلاب"
      onBack={onBack}
      reload={reload}
      loading={students.loading || sheikhs.loading}
      error={students.error || sheikhs.error}
      fetchedAt={students.fetchedAt}
    >
      <Field
        label="بحث بالاسم أو الرقم أو الهاتف"
        value={query}
        onChangeText={setQuery}
        testID="people-search"
      />
      {admin && (
        <View style={s.row}>
          <Button
            small
            secondary={tab !== 'students'}
            title="الطلاب"
            onPress={() => setTab('students')}
          />
          <Button
            small
            secondary={tab !== 'sheikhs'}
            title="الشيوخ"
            onPress={() => setTab('sheikhs')}
          />
        </View>
      )}
      {tab === 'students' ? (
        <>
          <Select
            label="الشيخ"
            value={filter}
            onChange={setFilter}
            options={[
              { value: '', label: 'كل الشيوخ' },
              ...(sheikhs.value || []).map(v => ({
                value: String(v.id),
                label: v.name,
              })),
            ]}
          />
          <Txt muted>
            {
              rows.filter(v => !filter || v.sheikh?.id === Number(filter))
                .length
            }{' '}
            طالب في القائمة
          </Txt>
          {admin && (
            <Button
              title="إضافة طالب"
              icon="plus"
              testID="add-student"
              onPress={() => setEditStudent('new')}
            />
          )}
          {rows
            .filter(
              v =>
                (!filter || v.sheikh?.id === Number(filter)) &&
                `${v.name} ${v.student_id || ''} ${v.phone || ''} ${
                  v.sheikh?.name || ''
                }`.includes(query.trim()),
            )
            .map(student => (
              <Card key={student.id}>
                <Pressable
                  accessibilityRole="button"
                  testID={`student-profile-${student.id}`}
                  onPress={() => onProfile(student.id)}
                  style={s.row}
                >
                  <Avatar
                    name={student.name}
                    uri={
                      student.profile_pic
                        ? engine.client.resolveMedia?.(student.profile_pic)
                        : null
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Txt bold>{student.name}</Txt>
                    <Txt muted style={{ fontSize: 11 }}>
                      {student.sheikh?.name || 'بلا شيخ'} · {student.status}
                    </Txt>
                  </View>
                </Pressable>
                {admin && (
                  <Button
                    small
                    secondary
                    title={`تعديل ${student.name}`}
                    onPress={() => setEditStudent(student)}
                  />
                )}
              </Card>
            ))}
          {!rows.length && !students.loading && (
            <Txt muted>لا يوجد طلاب في البيانات المتاحة لهذا الحساب.</Txt>
          )}
        </>
      ) : (
        <>
          <Button
            title="إضافة شيخ"
            icon="plus"
            testID="add-sheikh"
            onPress={() => setEditSheikh('new')}
          />
          {(sheikhs.value || [])
            .filter(v => `${v.name} ${v.phone || ''}`.includes(query.trim()))
            .map(sheikh => (
              <Card key={sheikh.id}>
                <Txt bold>{sheikh.name}</Txt>
                <Txt muted>{sheikh.phone || 'لا يوجد رقم هاتف'}</Txt>
                <Txt muted>
                  {rows.filter(v => v.sheikh?.id === sheikh.id).length} طالب
                </Txt>
                <Button
                  small
                  secondary
                  title="تعديل الشيخ"
                  onPress={() => setEditSheikh(sheikh)}
                />
              </Card>
            ))}
        </>
      )}
      {!online && (
        <Txt muted>
          إضافة البيانات وتعديلها متاحان كمسودات؛ النشر يتطلب اتصالاً.
        </Txt>
      )}
    </FeaturePage>
  );
}

function StudentEditor({
  engine,
  student,
  sheikhs,
  categories,
  fields,
  onBack,
  onSaved,
}: {
  engine: OfflineEngine;
  student?: StudentInfo;
  sheikhs: SheikhInfo[];
  categories: StudentCategory[];
  fields: StudentCustomField[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const { online, data } = useEngine(engine);
  const action = useAction();
  const draft = useDraft(engine, `student:${student?.id || 'new'}`, {
    name: student?.name || '',
    phone: student?.phone || '',
    student_id: student?.student_id || '',
    birthday: student?.birthday || '',
    registration_date: student?.registration_date || localDate(),
    status: student?.status || 'مقيد',
    sheikh_id: (student?.sheikh?.id ?? sheikhs[0]?.id ?? null) as number | null,
    parent_phones: (student?.parent_phones || []).map(v => ({
      phone_number: v.phone_number,
      parent_type: v.parent_type,
      name: v.name || '',
    })),
    category_ids: student?.category_ids || [],
    custom_field_values: (student?.custom_field_values || {}) as Record<
      string,
      string | boolean
    >,
    quran_progress_enabled: student?.quran_progress_enabled || false,
  });
  const v = draft.value;
  const publish = async () => {
    const ok = await action.run(async () => {
      if (!v.name.trim()) throw new Error('اسم الطالب مطلوب.');
      for (const date of [v.birthday, v.registration_date])
        if (
          date &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            localDate(new Date(`${date}T12:00:00`)) !== date)
        )
          throw new Error('أدخل تاريخاً صالحاً بصيغة YYYY-MM-DD.');
      await engine.publish(
        student ? `/students/${student.id}` : '/students',
        {
          ...v,
          name: v.name.trim(),
          birthday: v.birthday || null,
          registration_date: v.registration_date || null,
        },
        student ? 'PUT' : 'POST',
      );
      await draft.clear();
    });
    if (ok) onSaved();
  };
  return (
    <FeaturePage
      engine={engine}
      title={student ? 'تعديل الطالب' : 'إضافة طالب'}
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Field
        label="اسم الطالب"
        value={v.name}
        onChangeText={name => draft.change({ name })}
        testID="student-name"
      />
      <Field
        label="رقم الطالب"
        value={v.student_id}
        onChangeText={student_id => draft.change({ student_id })}
      />
      <Field
        label="الهاتف"
        value={v.phone}
        keyboardType="phone-pad"
        onChangeText={phone => draft.change({ phone })}
      />
      {!student && (
        <Select
          label="الشيخ"
          value={String(v.sheikh_id || '')}
          onChange={id => draft.change({ sheikh_id: id ? Number(id) : null })}
          options={[
            { value: '', label: 'بلا شيخ' },
            ...sheikhs.map(sheikh => ({
              value: String(sheikh.id),
              label: sheikh.name,
            })),
          ]}
        />
      )}
      <Select
        label="حالة الطالب"
        value={v.status}
        onChange={status => draft.change({ status })}
        options={['مقيد', 'مستبعد', 'منقطع', 'ضيف', 'غير مقيد'].map(value => ({
          value,
          label: value,
        }))}
      />
      <Field
        label="تاريخ الميلاد YYYY-MM-DD"
        value={v.birthday}
        onChangeText={birthday => draft.change({ birthday })}
      />
      <Field
        label="تاريخ التسجيل YYYY-MM-DD"
        value={v.registration_date}
        onChangeText={registration_date => draft.change({ registration_date })}
      />
      {categories.map(category => (
        <Toggle
          key={category.id}
          title={category.name}
          value={v.category_ids.includes(category.id)}
          onChange={checked =>
            draft.change({
              category_ids: checked
                ? [...v.category_ids, category.id]
                : v.category_ids.filter(id => id !== category.id),
            })
          }
        />
      ))}
      {fields
        .filter(f => f.is_active)
        .map(field => (
          <View key={field.id}>
            {field.field_type === 'checkbox' ? (
              <Toggle
                title={field.name}
                value={
                  v.custom_field_values[field.id] === true ||
                  v.custom_field_values[field.id] === 'true'
                }
                onChange={value =>
                  draft.change({
                    custom_field_values: {
                      ...v.custom_field_values,
                      [field.id]: value,
                    },
                  })
                }
              />
            ) : field.field_type === 'select' ? (
              <Select
                label={field.name}
                value={String(v.custom_field_values[field.id] || '')}
                onChange={value =>
                  draft.change({
                    custom_field_values: {
                      ...v.custom_field_values,
                      [field.id]: value,
                    },
                  })
                }
                options={[
                  { value: '', label: 'اختر' },
                  ...field.options.map(value => ({ value, label: value })),
                ]}
              />
            ) : (
              <Field
                label={`${field.name}${field.is_required ? ' *' : ''}`}
                value={String(v.custom_field_values[field.id] || '')}
                onChangeText={value =>
                  draft.change({
                    custom_field_values: {
                      ...v.custom_field_values,
                      [field.id]: value,
                    },
                  })
                }
                keyboardType={
                  field.field_type === 'number' ? 'numeric' : 'default'
                }
              />
            )}
          </View>
        ))}
      <Txt bold>أرقام أولياء الأمور</Txt>
      {v.parent_phones.map((parent, index) => (
        <Card key={index}>
          <Field
            label={`رقم ولي الأمر ${index + 1}`}
            value={parent.phone_number}
            keyboardType="phone-pad"
            onChangeText={phone_number =>
              draft.change({
                parent_phones: v.parent_phones.map((p, i) =>
                  i === index ? { ...p, phone_number } : p,
                ),
              })
            }
          />
          <Select
            label="صلة القرابة"
            value={parent.parent_type}
            onChange={parent_type =>
              draft.change({
                parent_phones: v.parent_phones.map((p, i) =>
                  i === index ? { ...p, parent_type } : p,
                ),
              })
            }
            options={['أب', 'أم', 'أخ', 'أخت', 'جد', 'جدة', 'أرضي'].map(
              value => ({ value, label: value }),
            )}
          />
          <Button
            small
            secondary
            title="إزالة الرقم"
            onPress={() =>
              draft.change({
                parent_phones: v.parent_phones.filter((_, i) => i !== index),
              })
            }
          />
        </Card>
      ))}
      <Button
        small
        secondary
        title="إضافة رقم ولي أمر"
        onPress={() =>
          draft.change({
            parent_phones: [
              ...v.parent_phones,
              { phone_number: '', parent_type: 'أب', name: '' },
            ],
          })
        }
      />
      {data.settings.progress_tracking_enabled && (
        <Toggle
          title="تفعيل متابعة القرآن للطالب"
          value={v.quran_progress_enabled}
          onChange={quran_progress_enabled =>
            draft.change({ quran_progress_enabled })
          }
        />
      )}
      <Notice message="تُحفظ التعديلات كمسودة على الجهاز. اضغط نشر لحفظها في التحفيظ." />
      <Button
        title="نشر بيانات الطالب"
        disabled={!online || !v.name.trim()}
        busy={action.busy}
        onPress={() => {
          void publish();
        }}
        testID="student-save"
      />
    </FeaturePage>
  );
}

function SheikhEditor({
  engine,
  sheikh,
  onBack,
  onSaved,
}: {
  engine: OfflineEngine;
  sheikh?: SheikhInfo;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { online } = useEngine(engine);
  const action = useAction();
  const draft = useDraft(engine, `sheikh:${sheikh?.id || 'new'}`, {
    name: sheikh?.name || '',
    phone: sheikh?.phone || '',
    whatsapp_group_id: sheikh?.whatsapp_group_id || '',
    attendance_all_students_access:
      sheikh?.attendance_all_students_access || false,
  });
  return (
    <FeaturePage
      engine={engine}
      title={sheikh ? 'تعديل الشيخ' : 'إضافة شيخ'}
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Field
        label="اسم الشيخ"
        value={draft.value.name}
        onChangeText={name => draft.change({ name })}
        testID="sheikh-name"
      />
      <Field
        label="الهاتف"
        value={draft.value.phone}
        keyboardType="phone-pad"
        onChangeText={phone => draft.change({ phone })}
      />
      <Field
        label="معرف مجموعة واتساب"
        value={draft.value.whatsapp_group_id}
        onChangeText={whatsapp_group_id => draft.change({ whatsapp_group_id })}
      />
      {sheikh && (
        <Toggle
          title="عرض جميع الطلاب في تسجيل الحضور"
          value={draft.value.attendance_all_students_access}
          onChange={attendance_all_students_access =>
            draft.change({ attendance_all_students_access })
          }
        />
      )}
      <Notice message="تُحفظ التعديلات على الجهاز حتى تنشرها عند الاتصال." />
      <Button
        title="نشر بيانات الشيخ"
        disabled={!online || !draft.value.name.trim()}
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            await engine.publish(
              sheikh ? `/sheikhs/${sheikh.id}` : '/sheikhs',
              { ...draft.value, circle_id: engine.tenant },
              sheikh ? 'PUT' : 'POST',
            );
            await draft.clear();
            onSaved();
          });
        }}
        testID="sheikh-save"
      />
    </FeaturePage>
  );
}

export function ProfileScreen({
  engine,
  id,
  onBack,
  onProgress,
  onPlans,
}: {
  engine: OfflineEngine;
  id: number;
  onBack: () => void;
  onProgress: () => void;
  onPlans: () => void;
}) {
  const { data, online } = useEngine(engine);
  const admin = canManage(data.user);
  const resource = useResource<StudentProfile>(
    engine,
    `/students/${id}/profile`,
  );
  const sheikhs = useResource<SheikhInfo[]>(engine, admin ? '/sheikhs' : null);
  const [warning, setWarning] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [start, setStart] = useState(localDate());
  const [end, setEnd] = useState(localDate());
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const action = useAction();
  const profile = resource.value;
  const mutate = async (path: string, body?: unknown, method = 'POST') => {
    await engine.publish(path, body, method);
    await engine.resource(`/students/${id}/profile`);
  };
  const writable =
    !!profile?.can_manage &&
    online &&
    !action.busy &&
    data.user.role !== 'auditor';
  return (
    <FeaturePage
      engine={engine}
      title={profile?.name || 'ملف الطالب'}
      onBack={onBack}
      loading={resource.loading}
      reload={resource.reload}
      error={action.error || resource.error}
      fetchedAt={resource.fetchedAt}
    >
      {profile && (
        <>
          <Card>
            <View style={s.row}>
              <Avatar
                name={profile.name}
                uri={
                  profile.profile_pic
                    ? engine.client.resolveMedia?.(profile.profile_pic)
                    : null
                }
              />
              <View style={{ flex: 1 }}>
                <Txt bold>{profile.name}</Txt>
                <Txt muted>
                  {profile.sheikh?.name} · {profile.status}
                </Txt>
              </View>
            </View>
            <Txt>رقم الطالب: {profile.student_id || '—'}</Txt>
            <Txt>الميلاد: {profile.birthday || '—'}</Txt>
            <Txt>تاريخ التسجيل: {profile.registration_date || '—'}</Txt>
            {profile.phone && (
              <Button
                small
                secondary
                title={`اتصال: ${profile.phone}`}
                onPress={() => {
                  void Linking.openURL(`tel:${profile.phone}`);
                }}
              />
            )}
            {profile.parent_phones.map(parent => (
              <Txt key={parent.id}>
                {parent.parent_type}: {parent.phone_number}
              </Txt>
            ))}
          </Card>
          <Card>
            <Txt bold>ملخص الحضور</Txt>
            <Txt>
              الحضور: {profile.attendance.present} · الغياب:{' '}
              {profile.attendance.absent} · بعذر: {profile.attendance.excused}
            </Txt>
            <Txt>
              الإجمالي: {profile.attendance.total} · التتابع:{' '}
              {profile.attendance.streak}
            </Txt>
          </Card>
          {profile.progress.enabled && (
            <Card>
              <Txt bold>متابعة القرآن</Txt>
              <Txt>
                {profile.progress.entries} سجل · متوسط التقييم{' '}
                {profile.progress.average_quality}
              </Txt>
              <Button
                secondary
                title="سجل الحفظ والمراجعة والأهداف"
                onPress={onProgress}
              />
              <Button secondary title="خطة الطالب اليومية" onPress={onPlans} />
            </Card>
          )}
          <Card>
            <Txt bold>الإنذارات</Txt>
            {profile.warnings.map(w => (
              <View key={w.id}>
                <Txt>
                  {w.warning_number}. {w.reason} ·{' '}
                  {w.sent ? 'أُرسل' : 'لم يُرسل'}
                </Txt>
                <Txt muted style={{ fontSize: 10 }}>
                  {w.created_at}
                </Txt>
              </View>
            ))}
            {!profile.warnings.length && <Txt muted>لا توجد إنذارات</Txt>}
            {profile.can_manage && (
              <>
                <Field
                  label="سبب الإنذار"
                  value={warning}
                  onChangeText={setWarning}
                />
                <Button
                  title="إضافة إنذار"
                  disabled={!writable || !warning.trim()}
                  onPress={() => {
                    void action.run(async () => {
                      await mutate(`/students/${id}/warnings`, {
                        reason: warning.trim(),
                      });
                      setWarning('');
                    });
                  }}
                />
              </>
            )}
          </Card>
          <Card>
            <Txt bold>الأعذار الدورية</Txt>
            {[
              'الأحد',
              'الإثنين',
              'الثلاثاء',
              'الأربعاء',
              'الخميس',
              'الجمعة',
              'السبت',
            ].map((title, weekday) => (
              <Toggle
                key={weekday}
                title={title}
                value={(
                  weekdays || profile.excused_weekdays.map(w => w.weekday)
                ).includes(weekday)}
                onChange={checked => {
                  const old =
                    weekdays || profile.excused_weekdays.map(w => w.weekday);
                  setWeekdays(
                    checked
                      ? [...old, weekday]
                      : old.filter(v => v !== weekday),
                  );
                }}
                disabled={!profile.can_manage}
              />
            ))}
            {profile.can_manage && (
              <Button
                title="حفظ الأعذار الدورية"
                disabled={!writable || weekdays === null}
                onPress={() => {
                  void action.run(async () => {
                    await mutate(
                      `/students/${id}/excused-weekdays`,
                      {
                        weekdays: weekdays!.map(weekday => ({
                          weekday,
                          note:
                            profile.excused_weekdays.find(
                              v => v.weekday === weekday,
                            )?.note || null,
                        })),
                      },
                      'PUT',
                    );
                    setWeekdays(null);
                  });
                }}
              />
            )}
          </Card>
          <Card>
            <Txt bold>فترات الإجازة</Txt>
            {profile.excused_periods.map(period => (
              <View key={period.id}>
                <Txt>
                  {period.start_date} — {period.end_date}
                </Txt>
                <Txt muted>
                  {period.reason} · {period.status}
                </Txt>
                {writable &&
                  !['cancelled', 'completed'].includes(period.status) && (
                    <Button
                      small
                      secondary
                      title="إلغاء الفترة"
                      onPress={() =>
                        Alert.alert(
                          'إلغاء الإجازة',
                          'هل تريد إلغاء هذه الفترة؟',
                          [
                            { text: 'رجوع' },
                            {
                              text: 'إلغاء الفترة',
                              onPress: () => {
                                void action.run(() =>
                                  mutate(
                                    `/students/${id}/excused-periods/${period.id}/cancel`,
                                  ),
                                );
                              },
                            },
                          ],
                        )
                      }
                    />
                  )}
              </View>
            ))}
            {profile.can_manage && (
              <>
                <Field
                  label="بداية الإجازة YYYY-MM-DD"
                  value={start}
                  onChangeText={setStart}
                />
                <Field
                  label="نهاية الإجازة YYYY-MM-DD"
                  value={end}
                  onChangeText={setEnd}
                />
                <Field
                  label="سبب الإجازة"
                  value={reason}
                  onChangeText={setReason}
                />
                <Button
                  title="إضافة فترة إجازة"
                  disabled={!writable || !reason.trim() || start > end}
                  onPress={() => {
                    void action.run(async () => {
                      await mutate(`/students/${id}/excused-periods`, {
                        start_date: start,
                        end_date: end,
                        reason,
                      });
                      setReason('');
                    });
                  }}
                />
              </>
            )}
          </Card>
          {admin && (
            <Card>
              <Txt bold>نقل الطالب إلى شيخ آخر</Txt>
              <Select
                label="الشيخ الجديد"
                value={destination}
                onChange={setDestination}
                options={[
                  { value: '', label: 'اختر الشيخ' },
                  ...(sheikhs.value || [])
                    .filter(v => v.id !== profile.sheikh?.id)
                    .map(v => ({ value: String(v.id), label: v.name })),
                ]}
              />
              <Button
                title="نقل الطالب"
                disabled={!writable || !destination || !profile.sheikh}
                onPress={() =>
                  Alert.alert(
                    'نقل الطالب',
                    'سيُنقل الطالب إلى الشيخ المحدد. هل تريد المتابعة؟',
                    [
                      { text: 'إلغاء' },
                      {
                        text: 'نقل',
                        onPress: () => {
                          void action.run(async () => {
                            await mutate(`/students/${id}/move-sheikh`, {
                              sheikh_id: Number(destination),
                              expected_current_sheikh_id: profile.sheikh!.id,
                            });
                            setDestination('');
                          });
                        },
                      },
                    ],
                  )
                }
              />
            </Card>
          )}
        </>
      )}
    </FeaturePage>
  );
}
