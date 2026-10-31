import React, { useState } from 'react';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import {
  canManage,
  dateLabel,
  financialMonth,
  monthRange,
  statusesFor,
  uid,
} from '../types';
import type {
  AttendanceGrid,
  FilterGroup,
  FilterRule,
  SheikhInfo,
} from '../domain-types';
import { matchesFilterGroups, parseFilterGroups } from '../attendance-filters';
import { rangeError, queryString } from '../reports';
import { Button, Card, Field, Notice, Select, Sheet, Toggle, Txt } from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';
import { confirmAction } from './Administration';
interface SavedFilter {
  id: number;
  name: string;
  data: string;
  can_edit?: boolean;
  can_delete?: boolean;
}
const weekdays = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
export function AdvancedAttendanceScreen({
  engine,
  onBack,
  onProfile,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  onProfile: (id: number) => void;
}) {
  const { data, online } = useEngine(engine),
    initial = monthRange(
      financialMonth(data.settings.month_start_day),
      data.settings.month_start_day,
    ),
    [from, setFrom] = useState(initial.start),
    [to, setTo] = useState(initial.end),
    [applied, setApplied] = useState(initial),
    [query, setQuery] = useState(''),
    [teacher, setTeacher] = useState(''),
    [name, setName] = useState(''),
    [savedId, setSavedId] = useState<number | null>(null),
    [edit, setEdit] = useState(false),
    [limit, setLimit] = useState(25);
  const draft = useDraft(engine, 'attendance-filter', {
      groups: [] as FilterGroup[],
    }),
    groups = draft.value.groups,
    action = useAction();
  const grid = useResource<AttendanceGrid>(
      engine,
      '/reports/attendance-grid?' +
        queryString({ date_from: applied.start, date_to: applied.end }),
    ),
    saved = useResource<SavedFilter[]>(engine, '/saved-filters/');
  const rows = (grid.value?.students || []).filter(
    st =>
      (!teacher || st.sheikh_id === Number(teacher)) &&
      `${st.name} ${st.sheikh_name || ''}`.includes(query) &&
      matchesFilterGroups(st, groups, grid.value!.sessions),
  );
  const change = (gi: number, ri: number, patch: Partial<FilterRule>) =>
    draft.change({
      groups: groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              rules: g.rules.map((r, j) => (j === ri ? { ...r, ...patch } : r)),
            }
          : g,
      ),
    });
  const addRule = (gi: number) =>
    draft.change({
      groups: groups.map((g, i) =>
        i === gi
          ? {
              ...g,
              rules: [
                ...g.rules,
                {
                  target: 'session',
                  sessionId: grid.value?.sessions[0]?.id || 0,
                  operator: 'is',
                  status: statusesFor(data.settings)[0],
                  connector: 'and',
                },
              ],
            }
          : g,
      ),
    });
  return (
    <FeaturePage
      engine={engine}
      title="تصفية سجل الحضور"
      onBack={onBack}
      loading={grid.loading || saved.loading}
      error={grid.error || saved.error || action.error || draft.error}
      reload={() => {
        grid.reload();
        saved.reload();
      }}
      fetchedAt={grid.fetchedAt}
    >
      <Card>
        <Field
          label="من تاريخ YYYY-MM-DD"
          value={from}
          onChangeText={setFrom}
        />
        <Field label="إلى تاريخ YYYY-MM-DD" value={to} onChangeText={setTo} />
        <Button
          title="عرض الفترة"
          disabled={!!rangeError(from, to, true)}
          onPress={() => {
            setApplied({ start: from, end: to });
            setLimit(25);
            grid.reload();
          }}
        />
      </Card>
      <Txt muted>
        الفترة المعروضة: {applied.start} — {applied.end}
      </Txt>
      <Button
        secondary
        title={`شروط التصفية · ${groups.reduce(
          (n, g) => n + g.rules.length,
          0,
        )}`}
        onPress={() => setEdit(true)}
        testID="filter-edit"
      />
      <Field
        label="بحث الطلاب أو الشيوخ"
        value={query}
        onChangeText={setQuery}
      />
      <Select
        label="الشيخ"
        value={teacher}
        onChange={setTeacher}
        options={[
          { value: '', label: 'كل الشيوخ' },
          ...[
            ...new Map(
              (grid.value?.students || [])
                .filter(st => st.sheikh_id)
                .map(st => [
                  st.sheikh_id,
                  {
                    value: String(st.sheikh_id),
                    label: st.sheikh_name || 'شيخ',
                  },
                ]),
            ).values(),
          ],
        ]}
      />
      <Card>
        <Txt bold>التصفيات المحفوظة</Txt>
        {saved.value?.map(f => (
          <Card key={f.id}>
            <Txt bold>{f.name}</Txt>
            <Button
              small
              secondary
              title="تطبيق"
              onPress={() => {
                void action.run(async () => {
                  const parsed = parseFilterGroups(f.data);
                  draft.change({ groups: parsed });
                  setName(f.name);
                  setSavedId(f.id);
                });
              }}
              testID={`filter-load-${f.id}`}
            />
            {f.can_delete && (
              <Button
                small
                secondary
                title="حذف التصفية"
                disabled={!online || action.busy}
                onPress={() =>
                  confirmAction(
                    'حذف التصفية',
                    f.name,
                    () => {
                      void action.run(async () => {
                        await engine.publish(
                          `/saved-filters/${f.id}`,
                          undefined,
                          'DELETE',
                        );
                        if (savedId === f.id) setSavedId(null);
                        saved.reload();
                      });
                    },
                    true,
                  )
                }
              />
            )}
          </Card>
        ))}
        <Field
          label="اسم التصفية"
          value={name}
          onChangeText={setName}
          testID="filter-name"
        />
        <Button
          title="حفظ كتصفية جديدة"
          disabled={!online || !name.trim() || !groups.length}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              parseFilterGroups(JSON.stringify(groups));
              await engine.publish('/saved-filters/', {
                name: name.trim(),
                data: JSON.stringify(groups),
              });
              saved.reload();
            });
          }}
          testID="filter-save"
        />
        {savedId && saved.value?.find(f => f.id === savedId)?.can_edit && (
          <Button
            secondary
            title="تحديث التصفية المحفوظة"
            disabled={!online || !name.trim()}
            onPress={() =>
              confirmAction('تحديث التصفية', name, () => {
                void action.run(async () => {
                  parseFilterGroups(JSON.stringify(groups));
                  await engine.publish(
                    `/saved-filters/${savedId}`,
                    { name: name.trim(), data: JSON.stringify(groups) },
                    'PUT',
                  );
                  saved.reload();
                });
              })
            }
          />
        )}
        <Button
          secondary
          title="مسح الشروط"
          onPress={() => {
            draft.change({ groups: [] });
            setSavedId(null);
          }}
        />
      </Card>
      <Txt bold>{rows.length} طالب مطابق</Txt>
      {rows.slice(0, limit).map(st => (
        <Card key={st.id}>
          <Txt bold>{st.name}</Txt>
          <Txt muted>{st.sheikh_name}</Txt>
          {grid.value?.sessions.map(session => (
            <Txt key={session.id}>
              {dateLabel(session.date)}: {st.records[String(session.id)] || '—'}
            </Txt>
          ))}
          <Button
            secondary
            small
            title="فتح ملف الطالب"
            onPress={() => onProfile(st.id)}
          />
        </Card>
      ))}
      {rows.length > limit && (
        <Button title="عرض المزيد" onPress={() => setLimit(limit + 25)} />
      )}
      <Sheet visible={edit} title="تصفية متقدمة" onClose={() => setEdit(false)}>
        <Notice message="شروط «ليس» لأيام الأسبوع تتطلب اختلاف الحالة في جميع الحلقات المتاحة لذلك اليوم. عدم وجود سجلات لا يُحسب تطابقاً." />
        {groups.map((g, gi) => (
          <Card key={g.id}>
            {gi > 0 && (
              <Select
                label="ربط المجموعة"
                value={g.connector || 'and'}
                onChange={v =>
                  draft.change({
                    groups: groups.map((item, i) =>
                      i === gi
                        ? { ...item, connector: v as 'and' | 'or' }
                        : item,
                    ),
                  })
                }
                options={[
                  { value: 'and', label: 'و' },
                  { value: 'or', label: 'أو' },
                ]}
              />
            )}
            <Txt bold>مجموعة {gi + 1}</Txt>
            {g.rules.map((r, ri) => (
              <Card key={ri}>
                {ri > 0 && (
                  <Select
                    label="ربط الشرط"
                    value={r.connector || 'and'}
                    onChange={v =>
                      change(gi, ri, { connector: v as 'and' | 'or' })
                    }
                    options={[
                      { value: 'and', label: 'و' },
                      { value: 'or', label: 'أو' },
                    ]}
                  />
                )}
                <Select
                  label="نوع الشرط"
                  value={r.target || 'session'}
                  onChange={v =>
                    change(gi, ri, {
                      target: v as 'session' | 'weekday',
                      weekday: r.weekday ?? 0,
                      sessionId:
                        r.sessionId || grid.value?.sessions[0]?.id || 0,
                    })
                  }
                  options={[
                    { value: 'session', label: 'حلقة معينة' },
                    { value: 'weekday', label: 'يوم من الأسبوع' },
                  ]}
                />
                {r.target === 'weekday' ? (
                  <Select
                    label="اليوم"
                    value={String(r.weekday ?? 0)}
                    onChange={v => change(gi, ri, { weekday: Number(v) })}
                    options={weekdays.map((label, i) => ({
                      value: String(i),
                      label,
                    }))}
                  />
                ) : (
                  <Select
                    label="الحلقة"
                    value={String(r.sessionId)}
                    onChange={v => change(gi, ri, { sessionId: Number(v) })}
                    options={(grid.value?.sessions || []).map(session => ({
                      value: String(session.id),
                      label:
                        dateLabel(session.date) +
                        (session.name ? ` · ${session.name}` : ''),
                    }))}
                  />
                )}
                <Select
                  label="المقارنة"
                  value={r.operator}
                  onChange={v =>
                    change(gi, ri, { operator: v as 'is' | 'is_not' })
                  }
                  options={[
                    { value: 'is', label: 'هو' },
                    { value: 'is_not', label: 'ليس' },
                  ]}
                />
                <Select
                  label="الحالة"
                  value={r.status}
                  onChange={status => change(gi, ri, { status })}
                  options={statusesFor(data.settings).map(status => ({
                    value: status,
                    label: status,
                  }))}
                />
                <Button
                  small
                  secondary
                  title="حذف الشرط"
                  onPress={() =>
                    draft.change({
                      groups: groups.map((item, i) =>
                        i === gi
                          ? {
                              ...item,
                              rules: item.rules.filter((_, j) => j !== ri),
                            }
                          : item,
                      ),
                    })
                  }
                />
              </Card>
            ))}
            <Button secondary title="إضافة شرط" onPress={() => addRule(gi)} />
            <Button
              small
              secondary
              title="حذف المجموعة"
              onPress={() =>
                draft.change({ groups: groups.filter((_, i) => i !== gi) })
              }
            />
          </Card>
        ))}
        <Button
          title="إضافة مجموعة شروط"
          onPress={() =>
            draft.change({
              groups: [
                ...groups,
                {
                  id: uid(),
                  connector: 'and',
                  rules: [
                    {
                      sessionId: grid.value?.sessions[0]?.id || 0,
                      target: 'session',
                      operator: 'is',
                      status: statusesFor(data.settings)[0],
                    },
                  ],
                },
              ],
            })
          }
          testID="filter-add-group"
        />
        <Button secondary title="تطبيق وإغلاق" onPress={() => setEdit(false)} />
      </Sheet>
    </FeaturePage>
  );
}
interface WarningRow {
  id: number;
  student_name: string;
  reason: string;
  warning_number: number;
  sent: boolean;
  sheikh_id: number | null;
  sheikh_name: string | null;
}
export function WarningDeliveryScreen({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const { data, online } = useEngine(engine),
    allowed = canManage(data.user),
    [teacher, setTeacher] = useState(''),
    [selected, setSelected] = useState<number[]>([]),
    [errors, setErrors] = useState<Record<number, string>>({}),
    [query, setQuery] = useState(''),
    [limit, setLimit] = useState(25),
    action = useAction();
  const warnings = useResource<WarningRow[]>(
      engine,
      allowed ? '/warnings' + (teacher ? `?sheikh_id=${teacher}` : '') : null,
    ),
    sheikhs = useResource<SheikhInfo[]>(engine, allowed ? '/sheikhs' : null);
  const rows = (warnings.value || []).filter(w =>
    `${w.student_name} ${w.reason}`.includes(query),
  );
  const enabled = online && !!data.settings.whatsend_enabled;
  const sendIds = selected.filter(id =>
    warnings.value?.some(w => w.id === id && !w.sent),
  );
  return (
    <FeaturePage
      engine={engine}
      title="الإنذارات"
      onBack={onBack}
      loading={warnings.loading}
      error={warnings.error || sheikhs.error || action.error}
      reload={warnings.reload}
      fetchedAt={warnings.fetchedAt}
    >
      {!allowed ? (
        <Notice message="الإنذارات متاحة للمسؤولين فقط." />
      ) : (
        <>
          <Select
            label="الشيخ"
            value={teacher}
            onChange={v => {
              setTeacher(v);
              setSelected([]);
              setLimit(25);
            }}
            options={[
              { value: '', label: 'كل الشيوخ' },
              ...(sheikhs.value || []).map(sh => ({
                value: String(sh.id),
                label: sh.name,
              })),
            ]}
          />
          <Field
            label="بحث الطلاب أو أسباب الإنذارات"
            value={query}
            onChangeText={setQuery}
          />
          {!data.settings.whatsend_enabled && (
            <Notice message="إرسال واتساب غير متاح حتى تفعيل WhatSend في الإعدادات." />
          )}
          <Button
            secondary
            title="اختيار الإنذارات غير المرسلة المعروضة"
            onPress={() =>
              setSelected(
                rows
                  .slice(0, limit)
                  .filter(w => !w.sent)
                  .map(w => w.id),
              )
            }
          />
          <Button
            title={`إرسال الإنذارات المحددة (${sendIds.length})`}
            disabled={!enabled || !sendIds.length}
            busy={action.busy}
            onPress={() =>
              confirmAction(
                'إرسال إنذارات واتساب',
                `سيتم إرسال ${sendIds.length} إنذار إلى مجموعات الشيوخ.`,
                () => {
                  void action.run(async () => {
                    const response = await engine.publish<{
                      results: {
                        warning_id: number;
                        success: boolean;
                        error?: string;
                      }[];
                    }>('/warnings/send', { warning_ids: sendIds });
                    const failed = response.results.filter(r => !r.success);
                    setSelected(failed.map(r => r.warning_id));
                    setErrors(
                      Object.fromEntries(
                        failed.map(r => [
                          r.warning_id,
                          r.error || 'تعذر الإرسال',
                        ]),
                      ),
                    );
                    warnings.reload();
                  });
                },
              )
            }
            testID="warnings-send"
          />
          {rows.slice(0, limit).map(w => (
            <Card key={w.id}>
              <Txt bold>
                {w.student_name} · إنذار {w.warning_number}
              </Txt>
              <Txt muted>{w.sheikh_name}</Txt>
              <Txt>{w.reason}</Txt>
              <Txt>{w.sent ? 'تم الإرسال' : 'لم يُرسل'}</Txt>
              <Toggle
                title="اختيار للإرسال"
                value={selected.includes(w.id) && !w.sent}
                disabled={w.sent || action.busy}
                onChange={v =>
                  setSelected(
                    v
                      ? [...selected, w.id]
                      : selected.filter(id => id !== w.id),
                  )
                }
              />
              {errors[w.id] && <Notice error message={errors[w.id]} />}
            </Card>
          ))}
          {rows.length > limit && (
            <Button
              secondary
              title="عرض المزيد"
              onPress={() => setLimit(limit + 25)}
            />
          )}
        </>
      )}
    </FeaturePage>
  );
}
