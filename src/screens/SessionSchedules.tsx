import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { errorMessage } from '../api';
import { localDate } from '../types';
import { Button, Card, Field, Notice, Select, Sheet, Txt, s } from '../ui';
import {
  WEEKDAYS,
  deviceTimezone,
  schedulePayload,
  weekdaysLabel,
} from '../session-schedules';
import type { ScheduleInput, SessionSchedule } from '../session-schedules';

type Choice = { id: number; name: string; status?: string };
export function WeeklyScheduleForm({
  engine,
  schedule,
  onSaved,
}: {
  engine: OfflineEngine;
  schedule?: SessionSchedule;
  onSaved: () => void;
}) {
  const { data, online } = useEngine(engine);
  const [days, setDays] = useState<number[]>(schedule?.weekdays || []);
  const [name, setName] = useState(schedule?.name || '');
  const [mode, setMode] = useState<ScheduleInput['membership_mode']>(
    schedule?.membership_mode || 'all',
  );
  const [ids, setIds] = useState<number[]>(schedule?.member_ids || []);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const multiple = Boolean(data.settings.multiple_sessions_per_day_enabled);
  useEffect(() => {
    let live = true;
    setReady(false);
    setChoices([]);
    if (mode === 'all') {
      setReady(true);
      return;
    }
    engine
      .request<Choice[]>(
        mode === 'categories' ? '/student-categories' : '/students',
      )
      .then(rows => {
        if (live) {
          setChoices(
            rows.filter(
              v =>
                mode === 'categories' ||
                ['مقيد', 'ضيف'].includes(v.status || ''),
            ),
          );
          setReady(true);
        }
      })
      .catch(e => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [engine, mode]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const input: ScheduleInput = {
        name: name.trim() || null,
        weekdays: days,
        // Not asked for: a schedule starts today and runs until deleted.
        start_date: schedule?.start_date || localDate(),
        end_date: schedule?.end_date || null,
        timezone: schedule?.timezone || deviceTimezone(),
        membership_mode: multiple ? mode : 'all',
        member_ids: multiple && mode !== 'all' ? ids : [],
        is_active: schedule?.is_active ?? true,
      };
      await engine.request(
        `/session-schedules${schedule ? `/${schedule.id}` : ''}`,
        {
          method: schedule ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...input,
            ...(schedule ? { expected_version: schedule.version } : {}),
          }),
        },
      );
      await engine.sync();
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <Txt bold>أيام الحلقة</Txt>
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {WEEKDAYS.map((day, i) => (
          <Button
            key={day}
            small
            secondary={!days.includes(i)}
            title={`${days.includes(i) ? '✓ ' : ''}${day}`}
            onPress={() =>
              setDays(v =>
                v.includes(i) ? v.filter(d => d !== i) : [...v, i].sort(),
              )
            }
          />
        ))}
      </View>
      <Field label="اسم الحلقة (اختياري)" value={name} onChangeText={setName} />
      {multiple && (
        <>
          <Select
            label="الطلاب"
            value={mode}
            onChange={v => {
              setMode(v as typeof mode);
              setIds([]);
            }}
            options={[
              { value: 'all', label: 'كل الطلاب' },
              { value: 'categories', label: 'حسب التصنيف' },
              { value: 'students', label: 'طلاب محددون' },
            ]}
          />
          {mode !== 'all' &&
            choices.map(v => (
              <Button
                key={v.id}
                small
                secondary={!ids.includes(v.id)}
                title={`${ids.includes(v.id) ? '✓ ' : ''}${v.name}`}
                onPress={() =>
                  setIds(current =>
                    current.includes(v.id)
                      ? current.filter(id => id !== v.id)
                      : [...current, v.id],
                  )
                }
              />
            ))}
        </>
      )}
      <Txt muted>تُنشأ الحلقة تلقائياً الساعة 12 منتصف الليل في كل يوم مختار.</Txt>
      {!online && <Notice message="إدارة الحلقات المتكررة تحتاج إلى اتصال." />}
      {error ? <Notice message={error} error /> : null}
      <Button
        title="حفظ"
        busy={busy}
        disabled={
          !online ||
          !ready ||
          !days.length ||
          (multiple && mode !== 'all' && !ids.length)
        }
        onPress={() => {
          void save();
        }}
      />
    </View>
  );
}

export function WeeklySchedules({ engine }: { engine: OfflineEngine }) {
  const { online, data } = useEngine(engine);
  const [rows, setRows] = useState<SessionSchedule[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<SessionSchedule | 'new' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setRows(await engine.request<SessionSchedule[]>('/session-schedules'));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    if (online && expanded) {
      void load();
    }
  }, [engine, online, expanded, data.lastSync]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await load();
      await engine.sync();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Button
        secondary
        title={`${expanded ? 'إخفاء' : 'عرض'} الحلقات المتكررة`}
        onPress={() => setExpanded(v => !v)}
      />
      {expanded && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Button
            title="+ حلقة متكررة"
            disabled={!online}
            onPress={() => setEditing('new')}
          />
          {!rows.length && (
            <Txt muted>
              اختر الأيام مرة واحدة، وتُنشأ الحلقة تلقائياً في كل يوم منها.
            </Txt>
          )}
          {rows.map(row => (
            <Card key={row.id}>
              <Txt bold>{row.name || 'حلقة متكررة'}</Txt>
              <Txt muted>
                {weekdaysLabel(row.weekdays)}
                {row.is_active ? '' : ' · متوقفة'}
              </Txt>
              <View style={[s.row, { marginTop: 8 }]}>
                <Button
                  small
                  secondary
                  title={row.is_active ? 'إيقاف' : 'تشغيل'}
                  disabled={!online || busy}
                  onPress={() => {
                    void change(() =>
                      engine.request(`/session-schedules/${row.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          ...schedulePayload(row),
                          is_active: !row.is_active,
                        }),
                      }),
                    );
                  }}
                />
                <Button
                  small
                  secondary
                  title="تعديل"
                  disabled={!online || busy}
                  onPress={() => setEditing(row)}
                />
                <Button
                  small
                  secondary
                  title="حذف"
                  disabled={!online || busy}
                  onPress={() =>
                    Alert.alert(
                      'حذف الحلقة المتكررة',
                      'الحلقات التي أُنشئت سابقاً ستبقى.',
                      [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'حذف',
                          style: 'destructive',
                          onPress: () => {
                            void change(() =>
                              engine.request(`/session-schedules/${row.id}`, {
                                method: 'DELETE',
                              }),
                            );
                          },
                        },
                      ],
                    )
                  }
                />
              </View>
            </Card>
          ))}
          {error ? <Notice message={error} error /> : null}
        </View>
      )}
      <Sheet
        visible={!!editing}
        title={editing === 'new' ? 'حلقة متكررة جديدة' : 'تعديل الحلقة المتكررة'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <WeeklyScheduleForm
            key={editing === 'new' ? 'new' : editing.id}
            engine={engine}
            schedule={editing === 'new' ? undefined : editing}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </Sheet>
    </Card>
  );
}
