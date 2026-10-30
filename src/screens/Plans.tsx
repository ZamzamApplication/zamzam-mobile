import React, { useMemo, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { localDate, uid } from '../types';
import {
  assignmentIds,
  completionState,
  retainedCompletionDates,
  retainedCompletionItems,
} from '../plan-model';
import type {
  PlanConfiguration,
  SavedPlan,
  SavedPlanSummary,
} from '../plan-model';
import { generateQuranPlan } from '../quran-plan';
import type { QuranPlanTrack } from '../quran-plan';
import { SURAHS } from '../quran';
import { Button, Card, Field, Notice, Select, Toggle, Txt } from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';

const weekdays = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
function newTrack(): QuranPlanTrack {
  return {
    id: uid(),
    name: 'الحفظ',
    enabled: true,
    kind: 'quran',
    start: { surah: 1, ayah: 1 },
    unit: 'ayahs',
    subject: '',
    quantityUnit: '',
    startNumber: 1,
    dailyAmount: 5,
  };
}
export function PlansScreen({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const list = useResource<SavedPlanSummary[]>(engine, '/personal-plans');
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [archived, setArchived] = useState(false);
  if (creating)
    return (
      <PlanEditor
        engine={engine}
        onBack={() => setCreating(false)}
        onSaved={record => {
          setCreating(false);
          setId(record.id);
          list.reload();
        }}
      />
    );
  if (id)
    return (
      <SavedPlanScreen
        key={id}
        engine={engine}
        id={id}
        onBack={() => {
          setId(null);
          list.reload();
        }}
      />
    );
  return (
    <FeaturePage
      engine={engine}
      title="خطط الحفظ والمراجعة"
      onBack={onBack}
      loading={list.loading}
      error={list.error}
      reload={list.reload}
      fetchedAt={list.fetchedAt}
    >
      <Button
        title="إنشاء خطة"
        icon="plus"
        onPress={() => setCreating(true)}
        testID="plan-create"
      />
      <Toggle
        title="عرض الخطط المؤرشفة"
        value={archived}
        onChange={setArchived}
      />
      {(list.value || [])
        .filter(plan => plan.archived === archived)
        .map(plan => (
          <Card key={plan.id}>
            <Txt bold>{plan.name}</Txt>
            <Txt muted>
              {plan.completed_dates.length} / {plan.study_dates.length} يوم
              مكتمل · {plan.completed ? 'مكتملة' : 'قيد التنفيذ'}
            </Txt>
            <Button
              secondary
              title="فتح الخطة"
              onPress={() => setId(plan.id)}
              testID={`plan-open-${plan.id}`}
            />
          </Card>
        ))}
      {!list.value?.length && !list.loading && (
        <Txt muted>لم تحفظ أي خطة بعد. يمكنك إعداد مسودة جديدة دون اتصال.</Txt>
      )}
    </FeaturePage>
  );
}
function SavedPlanScreen({
  engine,
  id,
  onBack,
}: {
  engine: OfflineEngine;
  id: string;
  onBack: () => void;
}) {
  const resource = useResource<SavedPlan>(
    engine,
    `/personal-plans/${encodeURIComponent(id)}`,
  );
  const [editing, setEditing] = useState(false);
  if (!resource.value)
    return (
      <FeaturePage
        engine={engine}
        title="الخطة"
        onBack={onBack}
        loading={resource.loading}
        error={resource.error}
        reload={resource.reload}
      >
        <Txt muted>حمّل الخطة أولاً لعرضها دون اتصال.</Txt>
      </FeaturePage>
    );
  if (editing)
    return (
      <PlanEditor
        engine={engine}
        previous={resource.value}
        onBack={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          resource.reload();
        }}
      />
    );
  return (
    <PlanSchedule
      key={`${id}:${resource.value.version}`}
      engine={engine}
      plan={resource.value}
      onBack={onBack}
      onEdit={() => setEditing(true)}
      reload={resource.reload}
    />
  );
}
function PlanEditor({
  engine,
  previous,
  onBack,
  onSaved,
}: {
  engine: OfflineEngine;
  previous?: SavedPlan;
  onBack: () => void;
  onSaved: (v: SavedPlan) => void;
}) {
  const { online } = useEngine(engine);
  const action = useAction();
  const end = new Date();
  end.setDate(end.getDate() + 29);
  const draft = useDraft(engine, `personal-plan:${previous?.id || 'new'}`, {
    name: previous?.name || 'خطة الحفظ والمراجعة',
    baseVersion: previous?.version,
    configuration:
      previous?.configuration ||
      ({
        planOwnerType: 'student',
        studentName: '',
        startDate: localDate(),
        endDate: localDate(end),
        weekdays: [0, 1, 2, 3, 4, 6],
        includeCompletionCheckboxes: true,
        completionMode: 'day',
        tracks: [newTrack()],
      } as PlanConfiguration),
  });
  const config = draft.value.configuration;
  const change = (patch: Partial<PlanConfiguration>) =>
    draft.change({ configuration: { ...config, ...patch } });
  const patchTrack = (index: number, patch: Partial<QuranPlanTrack>) =>
    change({
      tracks: config.tracks.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      ),
    });
  const generated = useMemo(() => {
    try {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(config.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(config.endDate) ||
        config.startDate > config.endDate ||
        (new Date(config.endDate).getTime() -
          new Date(config.startDate).getTime()) /
          86400000 >=
          730
      )
        return null;
      return generateQuranPlan(config);
    } catch {
      return null;
    }
  }, [config]);
  return (
    <FeaturePage
      engine={engine}
      title={previous ? 'تعديل الخطة' : 'إنشاء خطة'}
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Field
        label="اسم الخطة"
        value={draft.value.name}
        onChangeText={name => draft.change({ name })}
        testID="plan-name"
      />
      <Field
        label="اسم صاحب الخطة"
        value={config.studentName}
        onChangeText={studentName => change({ studentName })}
      />
      <Field
        label="تاريخ البداية YYYY-MM-DD"
        value={config.startDate}
        onChangeText={startDate => change({ startDate })}
      />
      <Field
        label="تاريخ النهاية YYYY-MM-DD"
        value={config.endDate}
        onChangeText={endDate => change({ endDate })}
      />
      <Select
        label="تسجيل الإنجاز"
        value={config.completionMode || 'day'}
        onChange={completionMode =>
          change({ completionMode: completionMode as 'day' | 'item' })
        }
        options={[
          { value: 'day', label: 'باليوم' },
          { value: 'item', label: 'لكل ورد' },
        ]}
      />
      <Card>
        <Txt bold>أيام الدراسة</Txt>
        {weekdays.map((title, day) => (
          <Toggle
            key={day}
            title={title}
            value={config.weekdays.includes(day)}
            onChange={checked =>
              change({
                weekdays: checked
                  ? [...config.weekdays, day]
                  : config.weekdays.filter(v => v !== day),
              })
            }
          />
        ))}
      </Card>
      {config.tracks.map((track, index) => (
        <Card key={track.id}>
          <Field
            label="اسم الورد"
            value={track.name}
            onChangeText={name => patchTrack(index, { name })}
          />
          <Toggle
            title="تفعيل الورد"
            value={track.enabled}
            onChange={enabled => patchTrack(index, { enabled })}
          />
          {track.kind === 'quran' ? (
            <>
              <Select
                label="سورة البداية"
                value={String(track.start.surah)}
                onChange={v =>
                  patchTrack(index, { start: { surah: Number(v), ayah: 1 } })
                }
                options={SURAHS.map(v => ({
                  value: String(v.number),
                  label: v.name,
                }))}
              />
              <Field
                label="آية البداية"
                value={String(track.start.ayah)}
                keyboardType="numeric"
                onChangeText={v =>
                  patchTrack(index, {
                    start: { ...track.start, ayah: Number(v) },
                  })
                }
              />
              <Select
                label="وحدة المقدار"
                value={track.unit}
                onChange={v =>
                  patchTrack(index, { unit: v as QuranPlanTrack['unit'] })
                }
                options={[
                  ['ayahs', 'آيات'],
                  ['lines', 'أسطر'],
                  ['page', 'صفحات'],
                  ['half_page', 'نصف صفحة'],
                  ['surah', 'سور'],
                  ['juz', 'جزء'],
                  ['hizb', 'حزب'],
                  ['quarter', 'ربع'],
                ].map(([value, label]) => ({ value, label }))}
              />
            </>
          ) : (
            <Txt muted>
              هذا الورد من نوع{' '}
              {track.kind === 'playlist' ? 'قائمة دروس' : 'محتوى بالكمية'}؛
              تُحفظ تفاصيله كما أُعدّت في الموقع.
            </Txt>
          )}
          <Field
            label="المقدار اليومي"
            value={String(track.dailyAmount)}
            keyboardType="numeric"
            onChangeText={v => patchTrack(index, { dailyAmount: Number(v) })}
          />
          <Button
            small
            secondary
            title="إزالة الورد"
            onPress={() =>
              change({ tracks: config.tracks.filter((_, i) => i !== index) })
            }
          />
        </Card>
      ))}
      <Button
        secondary
        title="إضافة ورد قرآن"
        onPress={() => change({ tracks: [...config.tracks, newTrack()] })}
      />
      <Notice
        message={
          generated
            ? `${generated.studyDays} يوم دراسة · المسودة محفوظة على الجهاز`
            : 'راجع التواريخ والأوراد؛ يجب ألا تتجاوز الخطة سنتين.'
        }
      />
      {generated?.days
        .filter(v => v.isStudyDay)
        .slice(0, 7)
        .map(day => (
          <Card key={day.date}>
            <Txt bold>
              {day.date} · {weekdays[day.weekday]}
            </Txt>
            {generated.tracks.map(track => (
              <Txt key={track.id}>
                {track.name}: {day.assignments[track.id]?.text || 'راحة'}
              </Txt>
            ))}
          </Card>
        ))}
      <Button
        title="حفظ الخطة في حسابي"
        disabled={
          !online ||
          !generated ||
          !config.weekdays.length ||
          !config.tracks.some(v => v.enabled) ||
          !draft.value.name.trim()
        }
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (!generated) throw new Error('الخطة غير صالحة.');
            const dates = retainedCompletionDates(
              previous?.configuration,
              config,
              previous?.completed_dates || [],
            );
            const items = retainedCompletionItems(
              previous?.configuration,
              config,
              previous?.completed_items || {},
            );
            const state = completionState(
              generated,
              dates,
              items,
              config.completionMode,
            );
            const record = await engine.publish<SavedPlan>(
              previous ? `/personal-plans/${previous.id}` : '/personal-plans',
              {
                name: draft.value.name.trim(),
                configuration: config,
                study_dates: generated.days
                  .filter(v => v.isStudyDay)
                  .map(v => v.date),
                completed_dates: state.completedDates,
                completed_items: state.completedItems,
                assignment_ids: state.assignments,
                ...(previous
                  ? { expected_version: draft.value.baseVersion }
                  : {}),
              },
              previous ? 'PUT' : 'POST',
            );
            await draft.clear();
            await engine.resource('/personal-plans');
            await engine.resource(`/personal-plans/${record.id}`);
            onSaved(record);
          });
        }}
        testID="plan-save"
      />
    </FeaturePage>
  );
}
function PlanSchedule({
  engine,
  plan,
  onBack,
  onEdit,
  reload,
}: {
  engine: OfflineEngine;
  plan: SavedPlan;
  onBack: () => void;
  onEdit: () => void;
  reload: () => void;
}) {
  const { online } = useEngine(engine);
  const action = useAction();
  const [limit, setLimit] = useState(14);
  const generated = useMemo(
    () => generateQuranPlan(plan.configuration),
    [plan.configuration],
  );
  const draft = useDraft(engine, `plan-completion:${plan.id}`, {
    baseVersion: plan.version,
    dates: plan.completed_dates,
    items: plan.completed_items || {},
  });
  const state = completionState(
    generated,
    draft.value.dates,
    draft.value.items,
    plan.configuration.completionMode,
  );
  const changed =
    JSON.stringify(state.completedDates) !==
      JSON.stringify(plan.completed_dates) ||
    JSON.stringify(state.completedItems) !==
      JSON.stringify(plan.completed_items || {});
  const status = async (changes: object) => {
    await engine.publish(
      `/personal-plans/${plan.id}`,
      { expected_version: plan.version, ...changes },
      'PATCH',
    );
    await engine.resource(`/personal-plans/${plan.id}`);
    reload();
  };
  return (
    <FeaturePage
      engine={engine}
      title={plan.name}
      onBack={onBack}
      error={action.error || draft.error}
      reload={reload}
    >
      <Txt>
        {state.completedDates.length} / {plan.study_dates.length} يوم مكتمل{' '}
        {changed ? '· إنجاز محلي غير منشور' : ''}
      </Txt>
      {plan.can_edit && (
        <Button secondary title="تعديل الخطة" onPress={onEdit} />
      )}
      <Button
        secondary
        title="مشاركة جدول الخطة"
        onPress={() => {
          void Share.share({
            message: `${plan.name}\n${generated.days
              .filter(v => v.isStudyDay)
              .map(
                day =>
                  `${day.date}\n${generated.tracks
                    .map(
                      track =>
                        `${track.name}: ${
                          day.assignments[track.id]?.text || 'راحة'
                        }`,
                    )
                    .join('\n')}`,
              )
              .join('\n\n')}`,
          });
        }}
      />
      {generated.days
        .filter(day => day.isStudyDay)
        .slice(0, limit)
        .map(day => (
          <Card key={day.date}>
            <Txt bold>
              {day.date} · {weekdays[day.weekday]}
            </Txt>
            {generated.tracks.map(track => (
              <View key={track.id}>
                <Txt>
                  {track.name}: {day.assignments[track.id]?.text || 'راحة'}
                </Txt>
                {plan.configuration.completionMode === 'item' &&
                  day.assignments[track.id] &&
                  !day.paused?.[track.id] && (
                    <Toggle
                      title={`إنجاز ${track.name} ${day.date}`}
                      disabled={!plan.can_mark || plan.archived}
                      value={
                        state.completedItems[day.date]?.includes(track.id) ||
                        false
                      }
                      onChange={checked => {
                        const items = {
                          ...state.completedItems,
                          [day.date]: checked
                            ? [
                                ...(state.completedItems[day.date] || []),
                                track.id,
                              ]
                            : (state.completedItems[day.date] || []).filter(
                                id => id !== track.id,
                              ),
                        };
                        draft.change({ dates: [], items });
                      }}
                    />
                  )}
              </View>
            ))}
            {plan.configuration.completionMode !== 'item' && (
              <Toggle
                title={`إنجاز ${day.date}`}
                disabled={!plan.can_mark || plan.archived}
                value={state.completedDates.includes(day.date)}
                onChange={checked =>
                  draft.change({
                    dates: checked
                      ? [...state.completedDates, day.date]
                      : state.completedDates.filter(d => d !== day.date),
                    items: {
                      ...state.completedItems,
                      [day.date]: checked
                        ? assignmentIds(generated)[day.date]
                        : [],
                    },
                  })
                }
              />
            )}
          </Card>
        ))}
      {generated.studyDays > limit && (
        <Button
          secondary
          title="عرض أيام أكثر"
          onPress={() => setLimit(v => v + 14)}
        />
      )}
      {plan.can_mark && (
        <Button
          title="نشر الإنجاز المحفوظ"
          disabled={!online || !changed || plan.archived}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              await engine.publish(
                `/personal-plans/${plan.id}`,
                {
                  name: plan.name,
                  configuration: plan.configuration,
                  study_dates: plan.study_dates,
                  completed_dates: state.completedDates,
                  completed_items: state.completedItems,
                  assignment_ids: state.assignments,
                  expected_version: draft.value.baseVersion,
                },
                'PUT',
              );
              await draft.clear();
              await engine.resource(`/personal-plans/${plan.id}`);
              reload();
            });
          }}
        />
      )}
      {plan.can_edit && (
        <Card>
          <Select
            label="مشاركة الخطة"
            value={plan.share_mode}
            disabled={!online || changed}
            onChange={share_mode => {
              void action.run(() => status({ share_mode }));
            }}
            options={[
              { value: 'private', label: 'خاصة' },
              { value: 'readonly', label: 'رابط للقراءة فقط' },
              { value: 'read_mark', label: 'رابط للقراءة وتسجيل الإنجاز' },
            ]}
          />
          {plan.share_token && plan.share_mode !== 'private' && (
            <Button
              secondary
              title="مشاركة رابط الخطة"
              onPress={() => {
                void Share.share({
                  message: `https://zamzam-web.fly.dev/plan?share=${plan.share_token}`,
                });
              }}
            />
          )}
          <Button
            secondary
            title={plan.archived ? 'استعادة من الأرشيف' : 'أرشفة الخطة'}
            disabled={!online || changed}
            onPress={() => {
              void action.run(() => status({ archived: !plan.archived }));
            }}
          />
          <Button
            danger
            title="حذف الخطة"
            disabled={!online}
            onPress={() =>
              Alert.alert(
                'حذف الخطة',
                'سيتم حذف الخطة نهائياً من حسابك. هل تريد المتابعة؟',
                [
                  { text: 'إلغاء' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: () => {
                      void action.run(async () => {
                        await engine.publish(
                          `/personal-plans/${plan.id}?expected_version=${plan.version}`,
                          undefined,
                          'DELETE',
                        );
                        onBack();
                      });
                    },
                  },
                ],
              )
            }
          />
        </Card>
      )}
    </FeaturePage>
  );
}
