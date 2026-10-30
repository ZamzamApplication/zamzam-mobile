import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import type {
  QuranProgressEntry,
  QuranProgressInput,
  StudentGoal,
  StudentQuranPlan,
} from '../domain-types';
import { canManage, dateLabel, localDate } from '../types';
import { quranKey } from '../offline/quran';
import { categoryName, validateProgress } from '../progress';
import { formatQuranRange, QUALITY_OPTIONS, SURAHS } from '../quran';
import { Button, Card, Field, Notice, Select, Txt } from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';

interface SessionProgress {
  enabled: boolean;
  entries: QuranProgressEntry[];
  previous_entries: QuranProgressEntry[];
  suggested_entries: QuranProgressInput[];
  categories: string[];
}
export function QuranScreen({
  engine,
  onBack,
  initialSession,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  initialSession?: number;
}) {
  const { data, online, syncing } = useEngine(engine);
  const [sessionId, setSession] = useState(
    initialSession ||
      data.sessions.find(v => !v.is_confirmed)?.id ||
      data.sessions[0]?.id ||
      0,
  );
  const resource = useResource<SessionProgress>(
    engine,
    sessionId ? `/sessions/${sessionId}/progress` : null,
  );
  const [editor, setEditor] = useState<{
    student: number;
    name: string;
    category: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const action = useAction();
  const session = data.sessions.find(v => v.id === sessionId);
  const roster = data.rosters[sessionId];
  const categories = resource.value?.categories ||
    data.settings.progress_categories || [
      'new_memorization',
      'recent_revision',
    ];
  const queue = data.quranQueue || [];
  if (editor) {
    const key = quranKey(sessionId, editor.student, editor.category);
    const value =
      queue.filter(q => q.entity_key === key).at(-1)?.values ||
      data.quranEntries?.[key] ||
      resource.value?.entries.find(
        v => v.student_id === editor.student && v.category === editor.category,
      ) ||
      resource.value?.suggested_entries.find(
        v => v.student_id === editor.student && v.category === editor.category,
      );
    return (
      <ProgressEditor
        key={key}
        engine={engine}
        sessionId={sessionId}
        student={editor.student}
        name={editor.name}
        category={editor.category}
        initial={value}
        onBack={() => setEditor(null)}
      />
    );
  }
  return (
    <FeaturePage
      engine={engine}
      title="الحفظ والمراجعة"
      onBack={onBack}
      loading={resource.loading || syncing}
      reload={() => {
        resource.reload();
        void engine.sync();
      }}
      error={resource.error || action.error}
      fetchedAt={resource.fetchedAt}
    >
      {!data.settings.progress_tracking_enabled && (
        <Notice message="متابعة القرآن غير مفعلة في إعدادات التحفيظ. يمكن للمدير تفعيلها من الإعدادات." />
      )}
      <Select
        label="الحلقة"
        value={String(sessionId)}
        onChange={v => {
          setSession(Number(v));
        }}
        options={data.sessions.map(v => ({
          value: String(v.id),
          label: `${dateLabel(v.date)}${v.name ? ` · ${v.name}` : ''}${
            v.is_confirmed ? ' · مؤكدة' : ''
          }`,
        }))}
      />
      {session &&
        !session.quran_progress_enabled &&
        data.settings.progress_tracking_enabled &&
        canManage(data.user) &&
        !session.is_confirmed && (
          <Button
            title="تفعيل متابعة القرآن لهذه الحلقة"
            disabled={!online}
            onPress={() => {
              void action.run(async () => {
                await engine.publish(
                  `/sessions/${sessionId}/progress-tracking`,
                  {
                    enabled: true,
                    expected_version: roster?.version || session.version,
                  },
                  'PUT',
                );
                await engine.loadRoster(sessionId);
                resource.reload();
              });
            }}
          />
        )}
      <Field label="بحث الطلاب" value={query} onChangeText={setQuery} />
      {queue.length > 0 && (
        <Card>
          <Txt bold>{queue.length} تعديل قرآن محفوظ على الجهاز</Txt>
          <Button
            title="مزامنة الآن"
            disabled={!online}
            busy={syncing}
            onPress={() => {
              void engine.sync();
            }}
          />
        </Card>
      )}
      {queue
        .filter(q => q.issue)
        .map(q => (
          <Card key={q.mutation_id}>
            <Txt bold>
              تعديل يحتاج مراجعة · {categoryName(q.values.category)}
            </Txt>
            <Txt>
              نسختك: {formatQuranRange(q.values)} · {q.values.quality_score}/5
            </Txt>
            <Txt>
              الخادم: {q.server ? formatQuranRange(q.server) : 'لا يوجد سجل'}
            </Txt>
            <Txt muted>{q.issue}</Txt>
            <Button
              secondary
              title="استخدام نسخة الخادم"
              onPress={() => {
                void action.run(() => engine.resolveQuran(q.entity_key, false));
              }}
            />
            <Button
              title="إعادة إرسال نسختي"
              disabled={!online}
              onPress={() => {
                void action.run(() => engine.resolveQuran(q.entity_key, true));
              }}
            />
          </Card>
        ))}
      {roster?.sheikh_groups.map(group => (
        <View key={group.sheikh.id} style={{ gap: 10 }}>
          <Txt bold>{group.sheikh.name}</Txt>
          {group.students
            .filter(student => student.name.includes(query.trim()))
            .map(student => (
              <Card key={student.id}>
                <Txt bold>{student.name}</Txt>
                {categories.map(category => {
                  const key = quranKey(sessionId, student.id, category);
                  const pending = queue
                    .filter(q => q.entity_key === key)
                    .at(-1);
                  const entry =
                    pending?.values ||
                    data.quranEntries?.[key] ||
                    resource.value?.entries.find(
                      e =>
                        e.student_id === student.id && e.category === category,
                    );
                  const previous = resource.value?.previous_entries.find(
                    e => e.student_id === student.id && e.category === category,
                  );
                  return (
                    <View key={category} style={{ gap: 5 }}>
                      <Txt>{categoryName(category)}</Txt>
                      <Txt muted>
                        {entry
                          ? `${formatQuranRange(entry)} · التقييم ${
                              entry.quality_score
                            }/5${pending ? ' · محفوظ على الجهاز' : ''}`
                          : 'لم يسجل بعد'}
                      </Txt>
                      {previous && (
                        <Txt muted style={{ fontSize: 11 }}>
                          السابق: {formatQuranRange(previous)}
                        </Txt>
                      )}
                      <Button
                        small
                        secondary
                        title={`تسجيل ${categoryName(category)} — ${
                          student.name
                        }`}
                        disabled={
                          !data.settings.progress_tracking_enabled ||
                          !session?.quran_progress_enabled ||
                          session.is_confirmed ||
                          data.user.role === 'auditor' ||
                          !data.quranEntries ||
                          student.quran_progress_enabled !== true
                        }
                        onPress={() =>
                          setEditor({
                            student: student.id,
                            name: student.name,
                            category,
                          })
                        }
                        testID={`quran-edit-${student.id}-${category}`}
                      />
                    </View>
                  );
                })}
              </Card>
            ))}
        </View>
      ))}
      {!roster && sessionId > 0 && (
        <Button
          secondary
          title="تحميل قائمة الطلاب"
          disabled={!online}
          onPress={() => {
            void action.run(() => engine.loadRoster(sessionId));
          }}
        />
      )}
      <Notice message="تُحفظ سجلات القرآن على الجهاز ثم تزامن تلقائياً. لا تُؤكّد الحلقة حتى تُزامن تغييراتها وتراجع التعارضات." />
    </FeaturePage>
  );
}

export function RangeFields({
  value,
  change,
  allowDirection = true,
}: {
  value: QuranProgressInput;
  change: (v: Partial<QuranProgressInput>) => void;
  allowDirection?: boolean;
}) {
  return (
    <>
      <Select
        label="نوع النطاق"
        value={value.range_type}
        onChange={range_type =>
          change({ range_type: range_type as QuranProgressInput['range_type'] })
        }
        options={[
          { value: 'surah_ayah', label: 'سورة وآية' },
          { value: 'page', label: 'صفحات' },
        ]}
      />
      {allowDirection && (
        <Select
          label="الاتجاه"
          value={value.direction || 'forward'}
          onChange={direction =>
            change({ direction: direction as 'forward' | 'backward' })
          }
          options={[
            { value: 'forward', label: 'من الفاتحة إلى الناس' },
            { value: 'backward', label: 'من الناس إلى الفاتحة' },
          ]}
        />
      )}
      {value.range_type === 'page' ? (
        <>
          <Field
            label="من صفحة"
            value={String(value.from_page || '')}
            keyboardType="numeric"
            onChangeText={v => change({ from_page: Number(v) })}
          />
          <Field
            label="إلى صفحة"
            value={String(value.to_page || '')}
            keyboardType="numeric"
            onChangeText={v => change({ to_page: Number(v) })}
          />
        </>
      ) : (
        <>
          <Select
            label="من سورة"
            value={String(value.from_surah || 1)}
            onChange={v => change({ from_surah: Number(v) })}
            options={SURAHS.map(surah => ({
              value: String(surah.number),
              label: surah.name,
            }))}
          />
          <Field
            label="من آية"
            value={String(value.from_ayah || '')}
            keyboardType="numeric"
            onChangeText={v => change({ from_ayah: Number(v) })}
          />
          <Select
            label="إلى سورة"
            value={String(value.to_surah || 1)}
            onChange={v => change({ to_surah: Number(v) })}
            options={SURAHS.map(surah => ({
              value: String(surah.number),
              label: surah.name,
            }))}
          />
          <Field
            label="إلى آية"
            value={String(value.to_ayah || '')}
            keyboardType="numeric"
            onChangeText={v => change({ to_ayah: Number(v) })}
          />
        </>
      )}
    </>
  );
}
function ProgressEditor({
  engine,
  sessionId,
  student,
  name,
  category,
  initial,
  onBack,
}: {
  engine: OfflineEngine;
  sessionId: number;
  student: number;
  name: string;
  category: string;
  initial?: QuranProgressInput;
  onBack: () => void;
}) {
  const action = useAction();
  const draft = useDraft<QuranProgressInput>(
    engine,
    `progress:${quranKey(sessionId, student, category)}`,
    initial || {
      student_id: student,
      category,
      range_type: 'surah_ayah',
      from_surah: 1,
      from_ayah: 1,
      to_surah: 1,
      to_ayah: 7,
      from_page: 1,
      to_page: 1,
      quality_score: 5,
      mistakes: 0,
      notes: '',
      next_assignment: '',
    },
  );
  return (
    <FeaturePage
      engine={engine}
      title={`${name} · ${categoryName(category)}`}
      onBack={onBack}
      error={action.error || draft.error}
    >
      <RangeFields value={draft.value} change={draft.change} />
      <Select
        label="التقييم"
        value={String(draft.value.quality_score)}
        onChange={v => draft.change({ quality_score: Number(v) })}
        options={QUALITY_OPTIONS.map(v => ({
          value: String(v.value),
          label: v.label,
        }))}
      />
      <Field
        label="عدد الأخطاء"
        value={String(draft.value.mistakes ?? 0)}
        keyboardType="numeric"
        onChangeText={v => draft.change({ mistakes: Number(v) })}
      />
      <Field
        label="ملاحظات التسميع"
        value={draft.value.notes || ''}
        onChangeText={notes => draft.change({ notes })}
        multiline
        testID="quran-notes"
      />
      <Field
        label="التكليف القادم"
        value={draft.value.next_assignment || ''}
        onChangeText={next_assignment => draft.change({ next_assignment })}
        multiline
      />
      <Button
        title="حفظ على الجهاز"
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            validateProgress(draft.value);
            const values = { ...draft.value, student_id: student, category };
            if (values.range_type === 'page')
              Object.assign(values, {
                from_surah: null,
                from_ayah: null,
                to_surah: null,
                to_ayah: null,
              });
            else Object.assign(values, { from_page: null, to_page: null });
            await engine.editQuran(sessionId, values);
            await draft.clear();
            onBack();
          });
        }}
        testID="quran-save"
      />
    </FeaturePage>
  );
}

interface StudentProgress {
  enabled: boolean;
  entries: QuranProgressEntry[];
  goals: StudentGoal[];
  average_quality: number;
  revisions: {
    id: number;
    category: string;
    editor_username: string;
    created_at: string;
  }[];
}
export function StudentProgressScreen({
  engine,
  studentId,
  onBack,
}: {
  engine: OfflineEngine;
  studentId: number;
  onBack: () => void;
}) {
  const resource = useResource<StudentProgress>(
    engine,
    `/students/${studentId}/progress`,
  );
  const { data, online } = useEngine(engine);
  const action = useAction();
  const [goal, setGoal] = useState(false);
  const draft = useDraft<QuranProgressInput & { target_date?: string }>(
    engine,
    `goal:${studentId}`,
    {
      student_id: studentId,
      category: 'new_memorization',
      range_type: 'page',
      from_page: 1,
      to_page: 20,
      quality_score: 5,
      notes: '',
      target_date: localDate(),
    },
  );
  const writable = data.user.role !== 'auditor';
  return (
    <FeaturePage
      engine={engine}
      title="سجل القرآن والأهداف"
      onBack={onBack}
      loading={resource.loading}
      error={resource.error || action.error}
      reload={resource.reload}
      fetchedAt={resource.fetchedAt}
    >
      <Card>
        <Txt bold>
          متوسط التقييم: {resource.value?.average_quality ?? '—'}/5
        </Txt>
        <Txt muted>{resource.value?.entries.length || 0} سجل تسميع</Txt>
      </Card>
      {writable && (
        <Button
          secondary
          title={goal ? 'إغلاق الهدف' : 'إضافة هدف حفظ'}
          onPress={() => setGoal(!goal)}
        />
      )}
      {goal && (
        <Card>
          <RangeFields
            value={draft.value}
            change={draft.change}
            allowDirection={false}
          />
          <Field
            label="تاريخ الهدف YYYY-MM-DD"
            value={draft.value.target_date || ''}
            onChangeText={target_date => draft.change({ target_date })}
          />
          <Field
            label="ملاحظات الهدف"
            value={draft.value.notes || ''}
            onChangeText={notes => draft.change({ notes })}
          />
          <Button
            title="نشر الهدف"
            disabled={!online}
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                validateProgress({ ...draft.value, direction: 'forward' });
                const v = draft.value;
                await engine.publish(`/students/${studentId}/goals`, {
                  range_type: v.range_type,
                  from_page: v.range_type === 'page' ? v.from_page : null,
                  to_page: v.range_type === 'page' ? v.to_page : null,
                  from_surah:
                    v.range_type === 'surah_ayah' ? v.from_surah : null,
                  from_ayah: v.range_type === 'surah_ayah' ? v.from_ayah : null,
                  to_surah: v.range_type === 'surah_ayah' ? v.to_surah : null,
                  to_ayah: v.range_type === 'surah_ayah' ? v.to_ayah : null,
                  target_date: v.target_date || null,
                  notes: v.notes,
                });
                await draft.clear();
                setGoal(false);
                resource.reload();
              });
            }}
          />
        </Card>
      )}
      {resource.value?.goals.map(v => (
        <Card key={v.id}>
          <Txt bold>{formatQuranRange(v)}</Txt>
          <Txt>
            {v.target_date || 'دون موعد'} · {v.status}
          </Txt>
          <Txt muted>{v.notes}</Txt>
          {v.status === 'active' && writable && (
            <Button
              small
              title="تم إكمال الهدف"
              disabled={!online}
              onPress={() =>
                Alert.alert('إكمال الهدف', 'هل أكمل الطالب هذا الهدف؟', [
                  { text: 'إلغاء' },
                  {
                    text: 'إكمال',
                    onPress: () => {
                      void action.run(async () => {
                        await engine.publish(
                          `/students/${studentId}/goals/${v.id}`,
                          { status: 'completed' },
                          'PUT',
                        );
                        resource.reload();
                      });
                    },
                  },
                ])
              }
            />
          )}
        </Card>
      ))}
      {resource.value?.entries.map(entry => (
        <Card key={entry.id}>
          <Txt bold>
            {categoryName(entry.category)} · {entry.session_date || ''}
          </Txt>
          <Txt>{formatQuranRange(entry)}</Txt>
          <Txt>
            التقييم {entry.quality_score}/5 · الأخطاء {entry.mistakes}
          </Txt>
          <Txt muted>{entry.notes}</Txt>
          {entry.next_assignment && <Txt>التالي: {entry.next_assignment}</Txt>}
        </Card>
      ))}
      {resource.value?.revisions.length ? (
        <Card>
          <Txt bold>سجل تعديلات التسميع</Txt>
          {resource.value.revisions.map(r => (
            <Txt key={r.id}>
              {categoryName(r.category)} · {r.editor_username} · {r.created_at}
            </Txt>
          ))}
        </Card>
      ) : null}
    </FeaturePage>
  );
}

export function StudentPlansScreen({
  engine,
  studentId,
  onBack,
}: {
  engine: OfflineEngine;
  studentId: number;
  onBack: () => void;
}) {
  const resource = useResource<{
    plans: StudentQuranPlan[];
    student_enabled: boolean;
    categories: string[];
  }>(engine, `/students/${studentId}/quran-plans`);
  if (!resource.value)
    return (
      <FeaturePage
        engine={engine}
        title="خطة الطالب اليومية"
        onBack={onBack}
        loading={resource.loading}
        error={resource.error}
        reload={resource.reload}
      >
        <Txt muted>حمّل خطة الطالب أولاً.</Txt>
      </FeaturePage>
    );
  return (
    <StudentPlanEditor
      key={studentId}
      engine={engine}
      studentId={studentId}
      initial={resource.value}
      onBack={onBack}
    />
  );
}
function StudentPlanEditor({
  engine,
  studentId,
  initial,
  onBack,
}: {
  engine: OfflineEngine;
  studentId: number;
  initial: {
    plans: StudentQuranPlan[];
    student_enabled: boolean;
    categories: string[];
  };
  onBack: () => void;
}) {
  const { data, online } = useEngine(engine);
  const admin = canManage(data.user);
  const action = useAction();
  const draft = useDraft(engine, `student-plan:${studentId}`, {
    plans: initial.plans,
  });
  const patch = (index: number, value: Partial<StudentQuranPlan>) =>
    draft.change({
      plans: draft.value.plans.map((p, i) =>
        i === index ? { ...p, ...value } : p,
      ),
    });
  return (
    <FeaturePage
      engine={engine}
      title="خطة الطالب اليومية"
      onBack={onBack}
      error={action.error || draft.error}
    >
      {!initial.student_enabled && (
        <Notice message="متابعة القرآن غير مفعلة لهذا الطالب. يمكن للمدير تفعيلها من بيانات الطالب." />
      )}
      {draft.value.plans.map((plan, index) => (
        <Card key={plan.category}>
          <Txt bold>{categoryName(plan.category)}</Txt>
          <Select
            label="مقدار الورد"
            value={plan.increment_unit}
            disabled={!admin}
            onChange={v =>
              patch(index, {
                increment_unit: v as StudentQuranPlan['increment_unit'],
              })
            }
            options={[
              ['ayahs', 'آيات'],
              ['lines', 'أسطر'],
              ['pages', 'صفحات'],
              ['juz', 'جزء'],
              ['hizb', 'حزب'],
              ['quarter', 'ربع'],
              ['half_page', 'نصف صفحة'],
            ].map(([value, label]) => ({ value, label }))}
          />
          <Field
            label="الكمية اليومية"
            value={String(plan.increment_amount)}
            editable={admin}
            keyboardType="numeric"
            onChangeText={v => patch(index, { increment_amount: Number(v) })}
          />
          <Select
            label="الاتجاه"
            value={plan.direction || 'forward'}
            disabled={!admin}
            onChange={v =>
              patch(index, { direction: v as 'forward' | 'backward' })
            }
            options={[
              { value: 'forward', label: 'الفاتحة إلى الناس' },
              { value: 'backward', label: 'الناس إلى الفاتحة' },
            ]}
          />
          {plan.increment_unit === 'pages' ? (
            <Field
              label="الصفحة القادمة"
              value={String(plan.next_page || 1)}
              editable={admin}
              keyboardType="numeric"
              onChangeText={v => patch(index, { next_page: Number(v) })}
            />
          ) : (
            <>
              <Select
                label="السورة القادمة"
                value={String(plan.next_surah || 1)}
                disabled={!admin}
                onChange={v => patch(index, { next_surah: Number(v) })}
                options={SURAHS.map(v => ({
                  value: String(v.number),
                  label: v.name,
                }))}
              />
              <Field
                label="الآية القادمة"
                value={String(plan.next_ayah || 1)}
                editable={admin}
                keyboardType="numeric"
                onChangeText={v => patch(index, { next_ayah: Number(v) })}
              />
            </>
          )}
          {admin && (
            <Button
              small
              secondary
              title="إزالة الورد"
              onPress={() =>
                draft.change({
                  plans: draft.value.plans.filter((_, i) => i !== index),
                })
              }
            />
          )}
        </Card>
      ))}
      {admin &&
        initial.categories
          .filter(
            category => !draft.value.plans.some(p => p.category === category),
          )
          .map(category => (
            <Button
              key={category}
              secondary
              title={`إضافة ورد ${categoryName(category)}`}
              onPress={() =>
                draft.change({
                  plans: [
                    ...draft.value.plans,
                    {
                      student_id: studentId,
                      category,
                      increment_unit: 'ayahs',
                      increment_amount: 5,
                      next_surah: 1,
                      next_ayah: 1,
                      next_page: 1,
                    },
                  ],
                })
              }
            />
          ))}
      {admin && (
        <Button
          title="نشر خطة الطالب"
          disabled={!online || !initial.student_enabled}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              await engine.publish(
                `/students/${studentId}/quran-plans`,
                {
                  plans: draft.value.plans.map(
                    ({
                      category,
                      direction,
                      increment_unit,
                      increment_amount,
                      next_surah,
                      next_ayah,
                      next_page,
                    }) => ({
                      category,
                      direction,
                      increment_unit,
                      increment_amount,
                      next_surah:
                        increment_unit === 'pages' ? null : next_surah || 1,
                      next_ayah:
                        increment_unit === 'pages' ? null : next_ayah || 1,
                      next_page:
                        increment_unit === 'pages' ? next_page || 1 : null,
                    }),
                  ),
                },
                'PUT',
              );
              await draft.clear();
              onBack();
            });
          }}
        />
      )}
    </FeaturePage>
  );
}
