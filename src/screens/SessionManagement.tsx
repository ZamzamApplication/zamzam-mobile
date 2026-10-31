import React, { useState } from 'react';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { canManage, dateLabel, localDate } from '../types';
import type { Session, Roster } from '../types';
import type { StudentInfo } from '../domain-types';
import { rangeError } from '../reports';
import { Button, Card, Field, Notice, Sheet, Toggle, Txt } from '../ui';
import { FeaturePage, useAction } from './feature-ui';
import { confirmAction } from './Administration';
export function SessionManagementScreen({
  engine,
  onBack,
  onOpen,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  onOpen: (id: number) => void;
}) {
  const { data, online } = useEngine(engine),
    allowed = canManage(data.user),
    action = useAction();
  const sessions = useResource<Session[]>(
      engine,
      allowed ? '/sessions/all?include_archived=true' : null,
    ),
    students = useResource<StudentInfo[]>(engine, allowed ? '/students' : null);
  const [archived, setArchived] = useState(false),
    [selected, setSelected] = useState<Session | 'new' | null>(null),
    [date, setDate] = useState(localDate()),
    [name, setName] = useState(''),
    [members, setMembers] = useState<number[] | null>(null),
    [query, setQuery] = useState(''),
    [reason, setReason] = useState(''),
    [archive, setArchive] = useState<Session | null>(null),
    [limit, setLimit] = useState(25);
  const roster = useResource<Roster>(
    engine,
    selected && selected !== 'new'
      ? `/sessions/${selected.id}/attendance`
      : null,
  );
  const allRows = students.value || [];
  const currentIds =
    members ??
    roster.value?.sheikh_groups.flatMap(g => g.students.map(st => st.id)) ??
    [];
  const pending = (id: number) =>
    [...data.queue, ...(data.quranQueue || [])].some(
      p => p.values.session_id === id,
    );
  const reload = () => {
    sessions.reload();
    students.reload();
  };
  const openEditor = (session: Session | 'new') => {
    setSelected(session);
    setDate(session === 'new' ? localDate() : session.date);
    setName(session === 'new' ? '' : session.name || '');
    setMembers(session === 'new' ? allRows.map(st => st.id) : null);
    setQuery('');
  };
  const activeRows = (sessions.value || []).filter(
    row => !!row.archived_at === archived,
  );
  return (
    <FeaturePage
      engine={engine}
      title="إدارة الحلقات"
      onBack={onBack}
      loading={sessions.loading || students.loading}
      error={sessions.error || students.error || action.error}
      reload={reload}
      fetchedAt={sessions.fetchedAt}
    >
      {!allowed ? (
        <Notice message="إدارة الحلقات متاحة للمسؤولين فقط." />
      ) : (
        <>
          <Button
            title="إنشاء حلقة"
            onPress={() => openEditor('new')}
            testID="manage-session-create"
          />
          <Toggle
            title="عرض الحلقات المؤرشفة"
            value={archived}
            onChange={v => {
              setArchived(v);
              setLimit(25);
            }}
          />
          {activeRows.slice(0, limit).map(row => (
            <Card key={row.id}>
              <Txt bold>
                {dateLabel(row.date)}
                {row.name ? ` · ${row.name}` : ''}
              </Txt>
              <Txt muted>
                {row.is_confirmed ? 'مؤكدة' : 'غير مؤكدة'} ·{' '}
                {row.student_count ?? '—'} طالب
                {row.archived_at ? ' · مؤرشفة' : ''}
              </Txt>
              {!row.archived_at && (
                <Button
                  secondary
                  small
                  title="فتح الحضور"
                  onPress={() => onOpen(row.id)}
                />
              )}
              <Button
                secondary
                title="تعديل التاريخ والاسم والأعضاء"
                disabled={
                  !online ||
                  row.is_confirmed ||
                  !!row.archived_at ||
                  pending(row.id)
                }
                onPress={() => openEditor(row)}
                testID={`manage-session-edit-${row.id}`}
              />
              <Button
                secondary
                title={row.archived_at ? 'استعادة الحلقة' : 'أرشفة الحلقة'}
                disabled={!online || pending(row.id)}
                onPress={() => {
                  setReason('');
                  setArchive(row);
                }}
                testID={`manage-session-archive-${row.id}`}
              />
              {pending(row.id) && (
                <Notice message="زامن التعديلات المحلية لهذه الحلقة أولاً." />
              )}
            </Card>
          ))}
          {!activeRows.length && <Txt muted>لا توجد حلقات في هذه القائمة.</Txt>}
          {activeRows.length > limit && (
            <Button
              secondary
              title="عرض المزيد"
              onPress={() => setLimit(limit + 25)}
            />
          )}
          <Sheet
            visible={!!selected}
            title={selected === 'new' ? 'إنشاء حلقة جديدة' : 'تعديل الحلقة'}
            onClose={() => setSelected(null)}
          >
            <Field
              label="تاريخ الحلقة YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              testID="manage-session-date"
            />
            <Field
              label="اسم الحلقة"
              value={name}
              onChangeText={setName}
              testID="manage-session-name"
            />
            {roster.error && (
              <Notice error message={roster.error} onRetry={roster.reload} />
            )}
            {(data.settings.multiple_sessions_per_day_enabled ||
              (selected &&
                selected !== 'new' &&
                roster.value?.explicit_membership)) && (
              <>
                <Txt bold>طلاب الحلقة · {currentIds.length} طالب</Txt>
                <Field
                  label="بحث الطلاب"
                  value={query}
                  onChangeText={setQuery}
                />
                <Button
                  secondary
                  small
                  title="اختيار جميع الطلاب المتاحين"
                  onPress={() => setMembers(allRows.map(st => st.id))}
                />
                {allRows
                  .filter(st => st.name.includes(query))
                  .map(st => (
                    <Toggle
                      key={st.id}
                      title={st.name}
                      value={currentIds.includes(st.id)}
                      onChange={v =>
                        setMembers(
                          v
                            ? [...currentIds, st.id]
                            : currentIds.filter(id => id !== st.id),
                        )
                      }
                    />
                  ))}
              </>
            )}
            <Button
              title={selected === 'new' ? 'إنشاء' : 'حفظ التغييرات'}
              disabled={
                !online ||
                (selected !== 'new' && (roster.loading || !roster.value))
              }
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  const error = rangeError(date, date, true);
                  if (error) throw new Error(error);
                  if (selected === 'new') {
                    if (
                      data.settings.multiple_sessions_per_day_enabled &&
                      !currentIds.length
                    )
                      throw new Error('اختر طالباً واحداً على الأقل.');
                    await engine.publish('/sessions/', {
                      session_date: date,
                      name: name.trim() || null,
                      ...(data.settings.multiple_sessions_per_day_enabled
                        ? { student_ids: currentIds }
                        : {}),
                    });
                  } else if (selected) {
                    if (pending(selected.id))
                      throw new Error('زامن التعديلات المحلية أولاً.');
                    const latest = roster.value!;
                    await engine.publish(
                      `/sessions/${selected.id}`,
                      {
                        session_date: date,
                        name: name.trim() || null,
                        expected_version: latest.version,
                      },
                      'PUT',
                    );
                    await engine.loadRoster(selected.id);
                  }
                  await engine.sync();
                  setSelected(null);
                  reload();
                });
              }}
              testID="manage-session-save"
            />
            {action.error && <Notice error message={action.error} />}
          </Sheet>
          <Sheet
            visible={!!archive}
            title={archive?.archived_at ? 'استعادة الحلقة' : 'أرشفة الحلقة'}
            onClose={() => setArchive(null)}
          >
            <Notice message="تحافظ الأرشفة على سجلات الحضور والتسميع، وتمنع تعديل الحلقة حتى استعادتها." />
            <Field
              label="السبب"
              value={reason}
              onChangeText={setReason}
              testID="session-archive-reason"
            />
            <Button
              title="تأكيد"
              disabled={!online || reason.trim().length < 3 || action.busy}
              onPress={() =>
                confirmAction(
                  archive?.archived_at ? 'استعادة الحلقة' : 'أرشفة الحلقة',
                  `${archive?.date} · ${reason}`,
                  () => {
                    void action.run(async () => {
                      if (!archive) return;
                      await engine.publish(
                        `/sessions/${archive.id}/${
                          archive.archived_at ? 'recover' : 'archive'
                        }`,
                        {
                          expected_version: archive.version ?? 0,
                          reason: reason.trim(),
                        },
                      );
                      await engine.sync();
                      setArchive(null);
                      reload();
                    });
                  },
                )
              }
              testID="session-archive-confirm"
            />
            {action.error && <Notice error message={action.error} />}
          </Sheet>
        </>
      )}
    </FeaturePage>
  );
}
