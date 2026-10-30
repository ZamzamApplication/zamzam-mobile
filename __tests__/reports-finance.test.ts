import {
  auditPath,
  rangeError,
  reportPaths,
  reportStudents,
} from '../src/reports';
import { majorToMinor, selectedOutstandingTotal } from '../src/finance';
import { demoFinance } from '../src/demo-finance';
import { demoFeature } from '../src/demo-features';
import type { DemoFinanceData } from '../src/demo-finance';
import type { DemoFeatureData } from '../src/demo-features';
import type { Roster, Settings } from '../src/types';
import type {
  StudentStatsItem,
  SubscriptionMonthRecord,
  FinanceOverview,
} from '../src/domain-types';
import { financialMonth, monthRange, localDate } from '../src/types';

test('date ranges reject impossible dates and reversed periods before requesting reports', () => {
  expect(rangeError('2026-02-30', '2026-03-01')).toBeTruthy();
  expect(rangeError('2026-10-31', '2026-10-01')).toBeTruthy();
  expect(rangeError('', '', true)).toBeTruthy();
  expect(rangeError('2028-02-29', '2028-02-29')).toBe('');
  expect(rangeError('', '')).toBe('');
});
test('report cache keys isolate applied dates, teachers, tenants and audit pages', () => {
  const filters = { from: '2026-10-01', to: '2026-10-31', sheikh: '7' };
  expect(reportPaths(2, filters).rate).toBe(
    '/reports/circle/2/rate?date_from=2026-10-01&date_to=2026-10-31&sheikh_id=7',
  );
  expect(reportPaths(3, filters).rate).not.toBe(reportPaths(2, filters).rate);
  expect(reportPaths(2, { ...filters, sheikh: '' }).students).not.toContain(
    'sheikh_id',
  );
  const audit = auditPath(
    { from: '', to: '', action: '', actor: '', query: 'a&actor_user_id=9' },
    2,
  );
  expect(audit).toContain('page=2');
  expect(new URLSearchParams(audit.split('?')[1]).get('query')).toBe(
    'a&actor_user_id=9',
  );
  expect(
    new URLSearchParams(audit.split('?')[1]).get('actor_user_id'),
  ).toBeNull();
});
test('attention sorting filters without mutating the cached student report', () => {
  const rows = [
    { student_name: 'طالب ب', sheikh_name: 'أحمد', attendance_rate: 90 },
    { student_name: 'طالب أ', sheikh_name: 'عمر', attendance_rate: 20 },
  ] as StudentStatsItem[];
  expect(reportStudents(rows, 'طالب', 'low')[0].attendance_rate).toBe(20);
  expect(reportStudents(rows, 'أحمد', 'high')).toHaveLength(1);
  expect(rows[0].attendance_rate).toBe(90);
});
test('money input converts exactly and excludes already-paid records from bulk totals', () => {
  expect(majorToMinor('125,05')).toBe(12505);
  expect(majorToMinor('0.01')).toBe(1);
  for (const invalid of ['-1', '1.001', 'NaN', '9007199254740993'])
    expect(majorToMinor(invalid)).toBeNull();
  const rows = [
    { id: 1, fee_minor: 10000, is_paid: false },
    { id: 2, fee_minor: 5000, is_paid: true },
    { id: 3, fee_minor: 2500, is_paid: false },
  ] as SubscriptionMonthRecord[];
  expect(selectedOutstandingTotal(rows, new Set([1, 2]))).toBe(10000);
});
function workspace(): DemoFinanceData &
  DemoFeatureData & { settings: Settings; rosters: Record<number, Roster>; sessions: [] } {
  return {
    sessions: [],
    settings: {
      id: 1,
      name: 'Demo',
      present_status: 'حاضر',
      month_start_day: 1,
      progress_tracking_enabled: true,
    },
    rosters: {
      10: {
        session_id: 10,
        date: localDate(),
        circle_id: 1,
        version: 1,
        is_confirmed: true,
        circle_sheikhs: [{ id: 5, name: 'Sheikh' }],
        sheikh_groups: [
          {
            sheikh: { id: 5, name: 'Sheikh' },
            students: [
              {
                id: 1,
                name: 'Student',
                attendance_id: 1,
                status: 'حاضر',
                sheikh_id: 5,
              },
            ],
          },
        ],
        quran_progress_enabled: true,
      },
    },
  };
}
test('demo finance records payments once, issues receipts, and reconciles expenses with cash', () => {
  const w = workspace();
  const request = (
    path: string,
    method = 'GET',
    body: Record<string, unknown> = {},
  ) => {
    const [route, query = ''] = path.split('?');
    return demoFinance(w, route, method, body, new URLSearchParams(query))
      .value as any;
  };
  const period = monthRange(financialMonth()).start;
  const path = `/finance/overview?period=${period}`;
  expect((request(path) as FinanceOverview).cash_collected_minor).toBe(0);
  request('/subscriptions/months/1/mark-paid', 'POST', {
    payment_date: localDate(),
    payment_method: 'cash',
  });
  expect(request('/subscriptions/months/1/receipt').receipt_number).toBe(
    'DEMO-1',
  );
  expect(() =>
    request('/subscriptions/months/1/mark-paid', 'POST', {}),
  ).toThrow();
  const expense = request('/finance/expenses', 'POST', {
    name: 'Supplies',
    category_id: 'general',
    amount_minor: 2500,
    expense_date: localDate(),
    payment_method: 'cash',
  });
  expect(request(path).net_cash_minor).toBe(7500);
  request(`/finance/expenses/${expense.id}`, 'DELETE');
  expect(request(path).net_cash_minor).toBe(10000);
  request('/subscriptions/months/1/mark-unpaid', 'POST');
  expect(() => request('/subscriptions/months/1/receipt')).toThrow();
  expect(request(path).net_cash_minor).toBe(0);
});
test('demo attendance reports exclude unconfirmed sessions, honor dates and teacher scope', () => {
  const w = workspace();
  w.rosters[11] = { ...w.rosters[10], session_id: 11, is_confirmed: false };
  const report = (query: string) =>
    demoFeature(
      w,
      '/reports/circle/1/rate',
      'GET',
      {},
      new URLSearchParams(query),
    ).value as any;
  expect(report('').total_attendance_records).toBe(1);
  expect(report('sheikh_id=99').total_attendance_records).toBe(0);
  expect(report('date_to=2000-01-01').total_attendance_records).toBe(0);
});
test('audit demo pagination and search retain server response semantics', () => {
  const w = workspace();
  const result = demoFeature(
    w,
    '/audit-logs',
    'GET',
    {},
    new URLSearchParams('page=2&page_size=25'),
  ).value as any;
  expect(result.items).toHaveLength(5);
  expect(result.total).toBe(30);
  expect(result.pages).toBe(2);
  const empty = demoFeature(
    w,
    '/audit-logs',
    'GET',
    {},
    new URLSearchParams('query=not-found'),
  ).value as any;
  expect(empty.items).toHaveLength(0);
});
