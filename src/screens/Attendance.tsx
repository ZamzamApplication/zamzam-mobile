import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { attendanceKey, visibleRoster } from '../offline/state';
import { useEngine } from '../hooks';
import { errorMessage } from '../api';
import {
  canManage,
  dateLabel,
  financialMonth,
  localDate,
  monthRange,
  presentFor,
  statusesFor,
} from '../types';
import type { Roster, Student } from '../types';
import {
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Icon,
  Notice,
  statusColors,
  Avatar,
  s,
  Select,
  Sheet,
  Txt,
  useTheme,
} from '../ui';

export function SessionsScreen({
  engine,
  onOpen,
}: {
  engine: OfflineEngine;
  onOpen: (id: number) => void;
}) {
  const { data, online, syncing } = useEngine(engine);
  const t = useTheme();
  const [filter, setFilter] = useState('upcoming');
  const [month, setMonth] = useState('');
  const [create, setCreate] = useState(false);
  const [date, setDate] = useState(localDate());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const monthly = data.sessions.filter(
    session =>
      !month ||
      (session.date >= monthRange(month, data.settings.month_start_day).start &&
        session.date <= monthRange(month, data.settings.month_start_day).end),
  );
  const rows = monthly
    .filter(
      session =>
        filter === 'all' ||
        (filter === 'past' ? session.is_confirmed : !session.is_confirmed),
    )
    .sort((a, b) =>
      filter === 'upcoming'
        ? a.date.localeCompare(b.date) || a.id - b.id
        : b.date.localeCompare(a.date) || b.id - a.id,
    );
  const months = [
    ...new Set([
      financialMonth(data.settings.month_start_day),
      ...data.sessions.map(session =>
        financialMonth(
          data.settings.month_start_day,
          new Date(`${session.date}T12:00:00`),
        ),
      ),
    ]),
  ]
    .sort()
    .reverse();
  const add = async () => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      localDate(new Date(`${date}T12:00:00`)) !== date
    ) {
      setError('أدخل تاريخاً صالحاً بصيغة YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await engine.createSession(date, name);
      setCreate(false);
      onOpen(id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FlatList
      data={rows}
      keyExtractor={session => String(session.id)}
      contentContainerStyle={s.page}
      refreshControl={
        <RefreshControl
          refreshing={syncing}
          onRefresh={() => {
            void engine.sync();
          }}
          tintColor={t.cyan}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Heading
            title="الحلقات"
            action={
              canManage(data.user) ? (
                <Button
                  small
                  title="إضافة حلقة"
                  icon="plus"
                  disabled={!online}
                  onPress={() => setCreate(true)}
                  testID="create-session"
                />
              ) : undefined
            }
          />
          <Select
            label="تصفية حسب الشهر"
            value={month}
            options={[
              { value: '', label: 'كل الأشهر' },
              ...months.map(m => ({
                value: m,
                label: new Date(`${m}-15T12:00:00`).toLocaleDateString(
                  'ar-EG',
                  { month: 'long', year: 'numeric' },
                ),
              })),
            ]}
            onChange={setMonth}
          />
          <View
            style={[
              s.row,
              {
                gap: 6,
                padding: 4,
                backgroundColor: t.active,
                borderRadius: 12,
              },
            ]}
          >
            {[
              ['upcoming', 'غير مؤكدة'],
              ['past', 'مؤكدة'],
              ['all', 'الكل'],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === key }}
                testID={`sessions-${key}`}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 9,
                  backgroundColor: key === filter ? '#0891b2' : t.card,
                }}
              >
                <Txt
                  bold
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: key === filter ? '#fff' : t.muted,
                  }}
                >
                  {label} ·{' '}
                  {
                    monthly.filter(
                      v =>
                        key === 'all' ||
                        (key === 'past' ? v.is_confirmed : !v.is_confirmed),
                    ).length
                  }
                </Txt>
              </Pressable>
            ))}
          </View>
          {!online && (
            <Notice message="يمكنك تسجيل الحضور في الحلقات المحملة دون إنترنت. إنشاء حلقات جديدة يحتاج إلى اتصال." />
          )}
          <Sheet
            visible={create}
            title="إضافة حلقة جديدة"
            onClose={() => {
              if (!busy) setCreate(false);
            }}
          >
            <Field
              label="تاريخ الحلقة"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              testID="session-date"
            />
            {data.settings.multiple_sessions_per_day_enabled && (
              <Select
                label="اسم الحلقة"
                value={name}
                options={[
                  { value: '', label: 'بدون اسم' },
                  ...(data.settings.session_name_options || []).map(n => ({
                    value: n,
                    label: n,
                  })),
                ]}
                onChange={setName}
              />
            )}
            {error ? <Notice message={error} error /> : null}
            <Button
              title="إنشاء الحلقة"
              onPress={() => {
                void add();
              }}
              busy={busy}
            />
          </Sheet>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          testID={`session-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`حلقة ${dateLabel(item.date)} ${item.name || ''}`}
          onPress={() => onOpen(item.id)}
        >
          <Card>
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Txt bold style={{ fontSize: 16 }}>
                  {item.name ? `${item.name} · ` : ''}
                  {dateLabel(item.date)}
                </Txt>
                <Txt muted style={{ fontSize: 12, marginTop: 6 }}>
                  {item.circle_name || data.settings.name}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {item.student_count ??
                    data.rosters[item.id]?.sheikh_groups.flatMap(
                      g => g.students,
                    ).length ??
                    '—'}{' '}
                  طالب
                </Txt>
              </View>
              <Txt
                style={[
                  s.pill,
                  { minWidth: 82, textAlign: 'center', flexShrink: 0 },
                  {
                    backgroundColor: item.is_confirmed ? '#dcfce7' : '#fef3c7',
                    color: item.is_confirmed ? '#15803d' : '#a16207',
                  },
                ]}
              >
                {item.is_confirmed ? 'مؤكدة' : 'قيد الانتظار'}
              </Txt>
            </View>
            <View style={s.row}>
              <Txt style={{ fontSize: 11, color: t.cyan, flex: 1 }}>
                {data.rosters[item.id] ? 'متاحة دون إنترنت' : 'بانتظار التحميل'}
              </Txt>
              <Icon name="back" size={16} />
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Empty
          title={
            data.bootstrapped
              ? 'لا توجد حلقات'
              : syncing
              ? 'جاري تحميل الحلقات'
              : 'لم تُحمّل بيانات هذا التحفيظ بعد'
          }
          detail={
            !data.bootstrapped
              ? 'اتصل بالإنترنت مرة واحدة لتحميل الحلقات والطلاب على جهازك.'
              : 'اختر تصفية أخرى أو أضف حلقة جديدة.'
          }
          retry={() => {
            void engine.sync();
          }}
        />
      }
      ListFooterComponent={
        data.bootstrapped ? (
          <Txt muted style={{ fontSize: 11, textAlign: 'center' }}>
            الحلقات المفتوحة وسجل آخر ٩٠ يوماً محفوظة على الجهاز.
          </Txt>
        ) : undefined
      }
    />
  );
}

function StudentCard({
  student,
  roster,
  engine,
  disabled,
  onError,
}: {
  student: Student;
  roster: Roster;
  engine: OfflineEngine;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const { data } = useEngine(engine);
  const t = useTheme();
  const [notes, setNotes] = useState(student.notes || '');
  const [focused, setFocused] = useState(false);
  const [options, setOptions] = useState(false);
  useEffect(() => {
    if (!focused) setNotes(student.notes || '');
  }, [student.notes, focused]);
  const states = statusesFor(data.settings);
  const color = statusColors(
    data.settings.attendance_status_colors?.[student.status],
    t,
  );
  const pending = data.queue.filter(
    q => q.entity_key === attendanceKey(roster.session_id, student.id),
  );
  const issue = pending.some(p => p.issue);
  const update = (patch: Partial<Student>) => {
    void engine
      .editStudent(roster.session_id, student.id, patch)
      .catch(e => onError(errorMessage(e)));
  };
  return (
    <View
      style={{
        padding: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <View style={s.row}>
        <Avatar
          name={student.name}
          uri={
            student.profile_pic
              ? engine.client.resolveMedia?.(student.profile_pic) ||
                student.profile_pic
              : null
          }
        />
        <Txt bold style={{ flex: 1 }}>
          {student.name}
        </Txt>
        {pending.length > 0 && (
          <Txt style={{ fontSize: 10, color: issue ? '#be123c' : '#b45309' }}>
            {issue ? 'يحتاج مراجعة' : 'بانتظار المزامنة'}
          </Txt>
        )}
      </View>
      <View>
        <Txt style={s.label}>الحالة</Txt>
        <View
          style={[
            s.row,
            {
              gap: 0,
              minHeight: 46,
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: color.border,
              backgroundColor: color.bg,
              opacity: disabled ? 0.65 : 1,
            },
          ]}
        >
          <Pressable
            testID={`status-${student.id}`}
            accessibilityLabel={`تغيير حضور ${student.name}: ${student.status}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() =>
              update({
                status:
                  states[(states.indexOf(student.status) + 1) % states.length],
              })
            }
            style={{ flex: 1, padding: 9 }}
          >
            <Txt bold style={{ textAlign: 'center', color: color.text }}>
              {student.status}
            </Txt>
          </Pressable>
          <Pressable
            testID={`status-menu-${student.id}`}
            accessibilityLabel={`اختيار حالة ${student.name}`}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => setOptions(true)}
            style={{
              width: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: 1,
              borderRightColor: color.border,
              minHeight: 44,
            }}
          >
            <Icon name="down" color={color.text} size={16} />
          </Pressable>
        </View>
      </View>
      <Sheet
        visible={options}
        title={`حالة حضور ${student.name}`}
        onClose={() => setOptions(false)}
      >
        {states.map(status => (
          <Button
            key={status}
            title={`${status === student.status ? '✓ ' : ''}${status}`}
            secondary
            onPress={() => {
              setOptions(false);
              update({ status });
            }}
          />
        ))}
      </Sheet>
      {data.settings.attendance_sheikh_selection_enabled !== false && (
        <Select
          label="الشيخ"
          value={String(student.sheikh_id ?? '')}
          disabled={disabled}
          options={[
            { value: '', label: 'بدون شيخ' },
            ...roster.circle_sheikhs.map(v => ({
              value: String(v.id),
              label: v.name,
            })),
          ]}
          onChange={v => update({ sheikh_id: v ? Number(v) : null })}
        />
      )}
      <Field
        label="ملاحظات"
        testID={`notes-${student.id}`}
        value={notes}
        editable={!disabled}
        placeholder="ملاحظات..."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={value => {
          setNotes(value);
          update({ notes: value });
        }}
      />
    </View>
  );
}

export function AttendanceScreen({
  engine,
  id,
  onBack,
  onReview,
}: {
  engine: OfflineEngine;
  id: number;
  onBack: () => void;
  onReview?: () => void;
}) {
  const { data, online, syncing } = useEngine(engine);
  const t = useTheme();
  const roster = useMemo(() => visibleRoster(data, id), [data, id]);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState('');
  const perform = async (action: 'confirm' | 'reopen') => {
    setBusy(true);
    setError('');
    try {
      await engine.transition(id, action, reason);
      setReopen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!roster)
    return (
      <ScrollView contentContainerStyle={s.page}>
        <Button secondary title="الحلقات" icon="back" onPress={onBack} />
        <Empty
          title="الحلقة غير محملة على الجهاز"
          detail="اتصل بالإنترنت وحمّل الحلقة لتسجيل الحضور دون اتصال."
          retry={() => {
            void engine.loadRoster(id).catch(e => setError(errorMessage(e)));
          }}
        />
        {error && <Notice message={error} error />}
      </ScrollView>
    );
  const students = roster.sheikh_groups.flatMap(g => g.students);
  const pending = data.queue.filter(q => q.values.session_id === id);
  const blocked = pending.filter(q => q.issue).length;
  const disabled = roster.is_confirmed || data.user.role === 'auditor' || busy;
  const visibleGroups = roster.sheikh_groups
    .map(g => ({
      ...g,
      students: g.students.filter(v => v.name.includes(query.trim())),
    }))
    .filter(g => g.students.length);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
      refreshControl={
        <RefreshControl
          refreshing={syncing}
          onRefresh={() => {
            void engine.sync();
          }}
          tintColor={t.cyan}
        />
      }
    >
      <Pressable accessibilityRole="button" onPress={onBack} style={s.row}>
        <Icon name="back" size={17} />
        <Txt style={{ color: t.cyan }}>الحلقات</Txt>
      </Pressable>
      <Heading
        title="تسجيل الحضور"
        detail={`${roster.name ? `${roster.name} · ` : ''}${dateLabel(
          roster.date,
        )}`}
      />
      {blocked > 0 && (
        <Card>
          <Txt bold style={{ color: '#be123c' }}>
            توقفت المزامنة لأن {blocked} تعديل يحتاج مراجعة.
          </Txt>
          <Txt muted>
            لن تُرسل التعديلات التالية لهذا الطالب ولن يمكن تأكيد الحلقة حتى
            تختار النسخة التي تريد حفظها.
          </Txt>
          <Button
            secondary
            title="مراجعة سبب إيقاف المزامنة"
            onPress={() => onReview?.()}
            testID="review-blocked-attendance"
          />
        </Card>
      )}
      {pending.length > 0 && !blocked && (
        <Txt muted style={{ fontSize: 12 }}>
          يمكن تأكيد الحلقة بعد اكتمال مزامنة تغييرات الحضور.
        </Txt>
      )}
      <View style={s.row}>
        <Button
          title={
            blocked
              ? `مراجعة التعديلات (${blocked})`
              : pending.length
              ? `مزامنة التغييرات (${pending.length})`
              : 'مزامنة'
          }
          icon="sync"
          onPress={() => {
            if (blocked && onReview) onReview();
            else
              void engine.sync().then(() => {
                if (
                  engine.view.data.queue.some(
                    q => q.values.session_id === id && q.issue,
                  )
                )
                  onReview?.();
              });
          }}
          busy={syncing}
          disabled={(!online && !blocked) || busy}
          style={{ flex: 1 }}
        />
        {canManage(data.user) && (
          <Button
            secondary
            title={roster.is_confirmed ? 'إعادة فتح الحلقة' : 'تأكيد الحلقة'}
            disabled={!online || busy || pending.length > 0}
            busy={busy}
            style={{ flex: 1 }}
            onPress={() =>
              roster.is_confirmed
                ? setReopen(true)
                : Alert.alert(
                    'تأكيد الحلقة',
                    'سيُقفل الحضور بعد التأكيد. هل تريد المتابعة؟',
                    [
                      { text: 'إلغاء', style: 'cancel' },
                      {
                        text: 'تأكيد',
                        onPress: () => {
                          void perform('confirm');
                        },
                      },
                    ],
                  )
            }
          />
        )}
      </View>
      <Txt
        accessibilityLiveRegion="polite"
        style={{
          fontSize: 12,
          textAlign: 'center',
          color: pending.length ? '#b45309' : '#059669',
        }}
      >
        {pending.length
          ? 'محفوظة على الجهاز · بانتظار المزامنة'
          : 'تم حفظ جميع التغييرات'}
      </Txt>
      {roster.is_confirmed && (
        <Notice message="تم تأكيد هذه الحلقة. الحضور مقفل حتى يعيد المدير فتحها." />
      )}
      {error ? <Notice message={error} error /> : null}
      <View style={[s.row, { flexWrap: 'wrap', gap: 10 }]}>
        {statusesFor(data.settings).map(status => {
          const color = statusColors(
            data.settings.attendance_status_colors?.[status],
            t,
          );
          return (
            <View
              key={status}
              style={{
                width: '48%',
                borderWidth: 1,
                borderRadius: 9,
                borderColor: color.border,
                backgroundColor: color.bg,
                padding: 10,
              }}
            >
              <Txt
                bold
                style={{ fontSize: 22, textAlign: 'center', color: color.text }}
              >
                {students.filter(st => st.status === status).length}
              </Txt>
              <Txt
                style={{ fontSize: 12, color: color.text, textAlign: 'center' }}
              >
                {status}
              </Txt>
            </View>
          );
        })}
      </View>
      <Field
        placeholder="بحث عن طالب..."
        accessibilityLabel="بحث عن طالب"
        testID="student-search"
        value={query}
        onChangeText={setQuery}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          setCollapsed(
            collapsed.length ? [] : roster.sheikh_groups.map(g => g.sheikh.id),
          )
        }
      >
        <Txt style={{ color: t.cyan, fontSize: 12 }}>
          {collapsed.length ? 'فتح الكل' : 'طي الكل'}
        </Txt>
      </Pressable>
      {visibleGroups.map(group => (
        <Card key={group.sheikh.id} style={{ padding: 0, overflow: 'hidden' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              expanded: !collapsed.includes(group.sheikh.id),
            }}
            onPress={() =>
              setCollapsed(current =>
                current.includes(group.sheikh.id)
                  ? current.filter(v => v !== group.sheikh.id)
                  : [...current, group.sheikh.id],
              )
            }
            style={[s.row, { backgroundColor: t.pale, padding: 14 }]}
          >
            <View style={{ flex: 1 }}>
              <Txt bold>{group.sheikh.name}</Txt>
              <Txt muted style={{ fontSize: 11 }}>
                {group.students.length} طالب ·{' '}
                {
                  group.students.filter(
                    v => v.status === presentFor(data.settings),
                  ).length
                }{' '}
                حاضر
              </Txt>
            </View>
            <Icon name="down" size={18} />
          </Pressable>
          {!collapsed.includes(group.sheikh.id) && (
            <View>
              {!disabled && (
                <View style={{ paddingHorizontal: 12 }}>
                  <Button
                    small
                    secondary
                    title="تحديد الجميع حاضر"
                    onPress={() =>
                      Alert.alert(
                        'تحديد الجميع حاضر',
                        `سيتم تحديث ${group.students.length} طالب في القائمة المعروضة.`,
                        [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'تحديث',
                            onPress: () => {
                              void engine
                                .edit(
                                  id,
                                  group.students.map(st => ({
                                    student_id: st.id,
                                    status: presentFor(data.settings),
                                    notes: st.notes || null,
                                    sheikh_id: st.sheikh_id,
                                  })),
                                )
                                .catch(e => setError(errorMessage(e)));
                            },
                          },
                        ],
                      )
                    }
                  />
                </View>
              )}
              {group.students.map(student => (
                <StudentCard
                  key={student.id}
                  student={student}
                  roster={roster}
                  engine={engine}
                  disabled={disabled}
                  onError={setError}
                />
              ))}
            </View>
          )}
        </Card>
      ))}
      {!visibleGroups.length && (
        <Empty
          title="لا يوجد طلاب مطابقون"
          detail={
            students.length
              ? 'جرّب البحث باسم آخر.'
              : 'لا يوجد طلاب مسندون لهذه الحلقة.'
          }
        />
      )}
      <Sheet
        visible={reopen}
        title="إعادة فتح الحلقة"
        onClose={() => {
          if (!busy) setReopen(false);
        }}
      >
        <Txt muted>
          سيتم السماح بتعديل الحضور، وسيُحفظ السبب في سجل التدقيق.
        </Txt>
        <Field
          label="سبب إعادة الفتح"
          value={reason}
          onChangeText={setReason}
          multiline
        />
        {error && <Notice message={error} error />}
        <Button
          title="إعادة فتح الحلقة"
          disabled={!reason.trim()}
          busy={busy}
          onPress={() => {
            void perform('reopen');
          }}
        />
      </Sheet>
    </ScrollView>
  );
}

export function RecordsScreen({
  engine,
  onOpen,
}: {
  engine: OfflineEngine;
  onOpen: (id: number) => void;
}) {
  const { data } = useEngine(engine);
  const t = useTheme();
  const [month, setMonth] = useState(
    financialMonth(data.settings.month_start_day),
  );
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [weekPage, setWeekPage] = useState(0);
  const [query, setQuery] = useState('');
  const [sheikh, setSheikh] = useState('');
  const start = new Date();
  start.setDate(
    start.getDate() -
      ((start.getDay() - (data.settings.week_start_day ?? 6) + 7) % 7) -
      weekPage * 7,
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const range =
    mode === 'month'
      ? monthRange(month, data.settings.month_start_day)
      : { start: localDate(start), end: localDate(end) };
  const sessions = data.sessions
    .filter(
      v =>
        v.date >= range.start &&
        ((mode === 'week' && weekPage === 0) || v.date <= range.end),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const people = new Map<number, Student>();
  const teachers = new Map<number, string>();
  Object.values(data.rosters).forEach(r =>
    r.circle_sheikhs.forEach(sh => teachers.set(sh.id, sh.name)),
  );
  sessions.forEach(session =>
    visibleRoster(data, session.id)?.sheikh_groups.forEach(group =>
      group.students.forEach(student => people.set(student.id, student)),
    ),
  );
  const students = [...people.values()].filter(
    st =>
      st.name.includes(query.trim()) &&
      (!sheikh || String(st.sheikh_id) === sheikh),
  );
  const changeMonth = (delta: number) => {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(localDate(d).slice(0, 7));
  };
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <Heading
        title="سجل الحضور"
        detail="متابعة حضور الطلاب حسب الشهر والشيخ"
      />
      <Card>
        <Field
          placeholder="بحث عن طالب..."
          accessibilityLabel="البحث في سجل الحضور"
          value={query}
          onChangeText={setQuery}
        />
        <Select
          label="الشيخ"
          value={sheikh}
          onChange={setSheikh}
          options={[
            { value: '', label: 'جميع الشيوخ' },
            ...[...teachers].map(([id, name]) => ({
              value: String(id),
              label: name,
            })),
          ]}
        />
      </Card>
      <Card>
        <View style={s.row}>
          <Button
            title="عرض أسبوعي"
            secondary={mode !== 'week'}
            style={{ flex: 1 }}
            onPress={() => setMode('week')}
          />
          <Button
            title="عرض شهري"
            secondary={mode !== 'month'}
            style={{ flex: 1 }}
            onPress={() => setMode('month')}
          />
        </View>
        <View style={s.row}>
          <Button
            secondary
            small
            title={mode === 'week' ? 'أسبوع أقدم' : 'السابق'}
            onPress={() =>
              mode === 'week' ? setWeekPage(p => p + 1) : changeMonth(-1)
            }
          />
          <Txt bold style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
            {mode === 'week'
              ? weekPage === 0
                ? 'الأسبوع الحالي'
                : `قبل ${weekPage} أسبوع`
              : new Date(`${month}-15T12:00:00`).toLocaleDateString('ar-EG', {
                  month: 'long',
                  year: 'numeric',
                })}
          </Txt>
          <Button
            secondary
            small
            title={mode === 'week' ? 'أسبوع أحدث' : 'التالي'}
            disabled={mode === 'week' && weekPage === 0}
            onPress={() =>
              mode === 'week'
                ? setWeekPage(p => Math.max(0, p - 1))
                : changeMonth(1)
            }
          />
        </View>
        <Txt muted style={{ fontSize: 11, textAlign: 'center' }}>
          {dateLabel(range.start)} — {dateLabel(range.end)}
        </Txt>
      </Card>
      <View style={s.row}>
        <Txt bold style={{ flex: 1 }}>
          الحضور · {students.length} طالب
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          {sessions.length} حلقة
        </Txt>
      </View>
      {!sessions.length ? (
        <Empty title="لا توجد حلقات في هذه الفترة" />
      ) : !students.length ? (
        <Empty title="لا يوجد طلاب مطابقون" />
      ) : (
        students.map(student => {
          const records = sessions
            .map(session => ({
              session,
              student: visibleRoster(data, session.id)
                ?.sheikh_groups.flatMap(g => g.students)
                .find(st => st.id === student.id),
            }))
            .filter(
              row =>
                row.student &&
                (row.student.attendance_id !== null ||
                  data.queue.some(
                    q =>
                      q.entity_key ===
                      attendanceKey(row.session.id, student.id),
                  )),
            );
          return (
            <Card
              key={student.id}
              style={{ padding: 0, gap: 0, overflow: 'hidden' }}
            >
              <View
                style={[
                  s.row,
                  { padding: 14, borderBottomWidth: 1, borderColor: t.border },
                ]}
              >
                <Avatar
                  name={student.name}
                  uri={
                    student.profile_pic
                      ? engine.client.resolveMedia?.(student.profile_pic) ||
                        student.profile_pic
                      : null
                  }
                />
                <View style={{ flex: 1 }}>
                  <Txt bold>{student.name}</Txt>
                  <Txt muted style={{ fontSize: 11 }}>
                    {teachers.get(student.sheikh_id || 0) || 'بدون شيخ'}
                  </Txt>
                </View>
              </View>
              {records.length ? (
                records.map(({ session, student: st }) => {
                  const color = statusColors(
                    data.settings.attendance_status_colors?.[st!.status],
                    t,
                  );
                  return (
                    <Pressable
                      key={session.id}
                      accessibilityRole="button"
                      accessibilityLabel={`فتح حلقة ${dateLabel(session.date)}`}
                      onPress={() => onOpen(session.id)}
                      style={[
                        s.row,
                        {
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderColor: t.border,
                        },
                      ]}
                    >
                      <Txt muted style={{ fontSize: 11, flex: 1 }}>
                        {session.name ? `${session.name} · ` : ''}
                        {dateLabel(session.date)}
                      </Txt>
                      <Txt
                        numberOfLines={1}
                        style={[
                          s.pill,
                          {
                            color: color.text,
                            backgroundColor: color.bg,
                            borderColor: color.border,
                            borderWidth: 1,
                            minWidth: 76,
                            textAlign: 'center',
                          },
                        ]}
                      >
                        {st!.status}
                      </Txt>
                    </Pressable>
                  );
                })
              ) : (
                <Txt muted style={{ fontSize: 12, padding: 14 }}>
                  لم يُسجّل حضور في هذه الفترة بعد.
                </Txt>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
