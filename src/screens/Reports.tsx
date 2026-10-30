import React, { useState } from 'react';
import { Share, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { canManage, financialMonth, monthRange } from '../types';
import type {
  AuditLogPage,
  CircleAttendanceRate,
  CircleStudentStatsResponse,
  QuranProgressEntry,
  SheikhInfo,
} from '../domain-types';
import { auditPath, rangeError, reportPaths, reportStudents } from '../reports';
import type { AuditFilters, ReportFilters } from '../reports';
import { categoryName } from '../progress';
import { auditActionLabel, formatAuditDetails } from '../audit-log';
import { Button, Card, Field, Notice, Select, Txt, useTheme } from '../ui';
import { FeaturePage, useAction } from './feature-ui';

interface QuranReport {
  enabled: boolean;
  students: {
    student_id: number;
    student_name: string;
    entries: number;
    average_quality: number;
    mistakes: number;
    latest_entry: QuranProgressEntry | null;
  }[];
  category_totals: Record<string, number>;
}
function Dates({
  from,
  to,
  change,
}: {
  from: string;
  to: string;
  change: (v: { from?: string; to?: string }) => void;
}) {
  return (
    <>
      <Field
        label="من تاريخ YYYY-MM-DD"
        value={from}
        onChangeText={v => change({ from: v })}
        testID="report-from"
      />
      <Field
        label="إلى تاريخ YYYY-MM-DD"
        value={to}
        onChangeText={v => change({ to: v })}
        testID="report-to"
      />
    </>
  );
}
function Counts({ values }: { values: Record<string, number> }) {
  return (
    <>
      {Object.entries(values).map(([label, count]) => (
        <Txt key={label}>
          {label}: {count}
        </Txt>
      ))}
    </>
  );
}
export function ReportsScreen({
  engine,
  onBack,
  onProfile,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  onProfile: (id: number) => void;
}) {
  const { data } = useEngine(engine);
  const initial = monthRange(
    financialMonth(data.settings.month_start_day),
    data.settings.month_start_day,
  );
  const [filters, setFilters] = useState<ReportFilters>({
    from: initial.start,
    to: initial.end,
    sheikh: '',
  });
  const [applied, setApplied] = useState(filters);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('low');
  const [page, setPage] = useState(1);
  const [quranPage, setQuranPage] = useState(1);
  const paths = reportPaths(engine.tenant, applied);
  const rate = useResource<CircleAttendanceRate>(engine, paths.rate);
  const students = useResource<CircleStudentStatsResponse>(
    engine,
    paths.students,
  );
  const quran = useResource<QuranReport>(
    engine,
    data.settings.progress_tracking_enabled ? paths.quran : null,
  );
  const sheikhs = useResource<SheikhInfo[]>(
    engine,
    canManage(data.user) ? '/sheikhs' : null,
  );
  const options = canManage(data.user)
    ? sheikhs.value || []
    : [
        ...new Map(
          Object.values(data.rosters).flatMap(r =>
            r.circle_sheikhs.map(s => [s.id, s] as const),
          ),
        ).values(),
      ];
  const error = rangeError(filters.from, filters.to, true);
  const rows = reportStudents(students.value?.students || [], query, sort);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const currentPage = Math.min(page, pages);
  const reload = () => {
    rate.reload();
    students.reload();
    quran.reload();
    sheikhs.reload();
  };
  const action = useAction();
  const theme = useTheme();
  return (
    <FeaturePage
      engine={engine}
      title="التقارير"
      onBack={onBack}
      loading={rate.loading || students.loading || quran.loading}
      error={
        rate.error ||
        students.error ||
        quran.error ||
        sheikhs.error ||
        action.error
      }
      reload={reload}
      fetchedAt={rate.fetchedAt}
    >
      <Card>
        <Dates {...filters} change={v => setFilters({ ...filters, ...v })} />
        <Select
          label="الشيخ"
          value={filters.sheikh}
          onChange={sheikh => setFilters({ ...filters, sheikh })}
          options={[
            { value: '', label: 'كل الشيوخ المتاحين' },
            ...options.map(s => ({ value: String(s.id), label: s.name })),
          ]}
        />
        {error ? <Notice error message={error} /> : null}
        <Button
          title="عرض التقرير"
          disabled={!!error}
          onPress={() => {
            setApplied({ ...filters });
            setPage(1);
            reload();
          }}
          testID="report-apply"
        />
      </Card>
      <Txt bold>
        الفترة المعروضة: {applied.from} — {applied.to}
      </Txt>
      <Txt muted>
        الحضور من الحلقات المؤكدة فقط. يعرض تقرير القرآن التسميع المسجل، بما فيه
        الحلقات غير المؤكدة.
      </Txt>
      {(rate.value?.scope === 'assigned_students' ||
        students.value?.scope === 'assigned_students') && (
        <Notice message="هذه النتائج تخص الطلاب المسموح لك بالاطلاع عليهم." />
      )}
      {rate.value && (
        <Card>
          <Txt bold>ملخص الحضور</Txt>
          <Txt bold testID="report-rate">
            نسبة الحضور: {rate.value.attendance_rate.toFixed(1)}%
          </Txt>
          <View
            accessibilityLabel={`نسبة الحضور ${rate.value.attendance_rate}%`}
            style={{
              height: 8,
              backgroundColor: theme.border,
              borderRadius: 4,
            }}
          >
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.cyan,
                width: `${Math.max(
                  0,
                  Math.min(100, rate.value.attendance_rate),
                )}%`,
              }}
            />
          </View>
          <Txt>
            السجلات: {rate.value.total_attendance_records} · المحتسبة:{' '}
            {rate.value.total_applicable_records ??
              rate.value.total_attendance_records}
          </Txt>
          <Counts values={rate.value.status_counts} />
        </Card>
      )}
      {students.value && (
        <>
          <Field
            label="بحث الطلاب أو الشيوخ"
            value={query}
            onChangeText={v => {
              setQuery(v);
              setPage(1);
            }}
            testID="report-search"
          />
          <Select
            label="ترتيب النتائج"
            value={sort}
            onChange={v => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: 'low', label: 'الأقل حضوراً أولاً' },
              { value: 'high', label: 'الأكثر حضوراً أولاً' },
              { value: 'name', label: 'الاسم' },
            ]}
          />
          <Txt bold>
            {rows.length} طالب · صفحة {currentPage} من {pages}
          </Txt>
          <Button
            secondary
            title="مشاركة نتائج الحضور المعروضة"
            disabled={!rows.length}
            onPress={() => {
              void action.run(async () => {
                await Share.share({
                  message: [
                    `تقرير الحضور · ${data.settings.name}`,
                    `${applied.from} — ${applied.to}`,
                    ...rows.map(
                      s =>
                        `${s.student_name} · ${
                          s.sheikh_name
                        } · ${s.attendance_rate.toFixed(1)}% · ${Object.entries(
                          s.status_counts,
                        )
                          .map(([k, v]) => `${k}: ${v}`)
                          .join('، ')}`,
                    ),
                  ].join('\n'),
                });
              });
            }}
          />
          {rows.slice((currentPage - 1) * 25, currentPage * 25).map(s => (
            <Card key={s.student_id}>
              <Txt bold>{s.student_name}</Txt>
              <Txt muted>{s.sheikh_name}</Txt>
              <Txt>
                الحضور: {s.attendance_rate.toFixed(1)}% · {s.total_sessions}{' '}
                حلقة
              </Txt>
              <Counts values={s.status_counts} />
              <Button
                secondary
                small
                title="فتح ملف الطالب"
                onPress={() => onProfile(s.student_id)}
                testID={`report-student-${s.student_id}`}
              />
            </Card>
          ))}
          {!rows.length && <Txt muted>لا يوجد طلاب مطابقون في هذه الفترة.</Txt>}
          <Button
            secondary
            small
            title="الصفحة السابقة"
            disabled={currentPage <= 1}
            onPress={() => setPage(currentPage - 1)}
          />
          <Button
            secondary
            small
            title="الصفحة التالية"
            disabled={currentPage >= pages}
            onPress={() => setPage(currentPage + 1)}
          />
        </>
      )}
      {quran.value && (
        <Card>
          <Txt bold>تقرير القرآن</Txt>
          {!quran.value.enabled ? (
            <Txt muted>متابعة القرآن غير مفعلة.</Txt>
          ) : (
            <>
              <Counts
                values={Object.fromEntries(
                  Object.entries(quran.value.category_totals).map(([k, v]) => [
                    categoryName(k),
                    v,
                  ]),
                )}
              />
              {quran.value.students.slice(0, quranPage * 25).map(s => (
                <View key={s.student_id}>
                  <Txt bold>{s.student_name}</Txt>
                  <Txt>
                    {s.entries} تسميع · متوسط {s.average_quality.toFixed(1)}/5 ·{' '}
                    {s.mistakes} أخطاء
                  </Txt>
                </View>
              ))}
              {quran.value.students.length > quranPage * 25 && (
                <Button
                  secondary
                  title="عرض مزيد من نتائج القرآن"
                  onPress={() => setQuranPage(v => v + 1)}
                />
              )}
              {!quran.value.students.length && (
                <Txt muted>لا يوجد تسميع في الفترة المعروضة.</Txt>
              )}
            </>
          )}
        </Card>
      )}
    </FeaturePage>
  );
}

const EMPTY_AUDIT: AuditFilters = {
  from: '',
  to: '',
  query: '',
  action: '',
  actor: '',
};
export function AuditScreen({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const { data } = useEngine(engine);
  const allowed = canManage(data.user);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT);
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const result = useResource<AuditLogPage>(
    engine,
    allowed ? auditPath(applied, page) : null,
  );
  const error = rangeError(filters.from, filters.to);
  return (
    <FeaturePage
      engine={engine}
      title="سجل العمليات"
      onBack={onBack}
      loading={result.loading}
      error={result.error}
      reload={result.reload}
      fetchedAt={result.fetchedAt}
    >
      {!allowed ? (
        <Notice message="سجل العمليات متاح لمسؤولي التحفيظ فقط." />
      ) : (
        <>
          <Card>
            <Field
              label="بحث في التفاصيل أو اسم المنفذ"
              value={filters.query}
              onChangeText={query => setFilters({ ...filters, query })}
              testID="audit-query"
            />
            <Select
              label="نوع العملية"
              value={filters.action}
              onChange={action => setFilters({ ...filters, action })}
              options={[
                { value: '', label: 'كل العمليات' },
                ...(result.value?.actions || []).map(v => ({
                  value: v,
                  label: auditActionLabel(v),
                })),
              ]}
            />
            <Select
              label="المنفذ"
              value={filters.actor}
              onChange={actor => setFilters({ ...filters, actor })}
              options={[
                { value: '', label: 'كل المستخدمين' },
                ...(result.value?.actors || []).map(v => ({
                  value: String(v.id),
                  label: v.username,
                })),
              ]}
            />
            <Dates
              {...filters}
              change={v => setFilters({ ...filters, ...v })}
            />
            {error ? <Notice error message={error} /> : null}
            <Button
              title="تطبيق الفلاتر"
              disabled={!!error || filters.query.length > 100}
              onPress={() => {
                setApplied({ ...filters });
                setPage(1);
                result.reload();
              }}
              testID="audit-apply"
            />
            <Button
              secondary
              small
              title="مسح الفلاتر"
              onPress={() => {
                setFilters(EMPTY_AUDIT);
                setApplied(EMPTY_AUDIT);
                setPage(1);
                result.reload();
              }}
            />
          </Card>
          <Txt muted>
            الفلاتر المعروضة: {applied.from || 'البداية'} —{' '}
            {applied.to || 'اليوم'}
            {applied.query ? ` · ${applied.query}` : ''}
            {applied.action ? ` · ${auditActionLabel(applied.action)}` : ''}
          </Txt>
          {result.value && (
            <>
              <Txt bold>
                {result.value.total} عملية · صفحة {result.value.page} من{' '}
                {Math.max(1, result.value.pages)}
              </Txt>
              {result.value.items.map(item => (
                <Card key={item.id}>
                  <Txt bold>{auditActionLabel(item.action)}</Txt>
                  <Txt>نفذها {item.actor_username}</Txt>
                  <Txt muted>
                    {new Date(item.created_at).toLocaleString('ar-EG')}
                  </Txt>
                  <Txt>{formatAuditDetails(item.details)}</Txt>
                </Card>
              ))}
              {!result.value.items.length && (
                <Txt muted>لا توجد عمليات مطابقة لهذه الفلاتر.</Txt>
              )}
              <Button
                secondary
                title="الصفحة السابقة"
                disabled={page <= 1 || result.loading}
                onPress={() => setPage(page - 1)}
                testID="audit-previous"
              />
              <Button
                secondary
                title="الصفحة التالية"
                disabled={page >= result.value.pages || result.loading}
                onPress={() => setPage(page + 1)}
                testID="audit-next"
              />
            </>
          )}
        </>
      )}
    </FeaturePage>
  );
}
