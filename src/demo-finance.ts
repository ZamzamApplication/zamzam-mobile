import type {
  ExpenseRecord,
  SubscriptionMonthRecord,
  SubscriptionSettings,
} from './domain-types';
import type { Settings, Roster } from './types';
import { financialMonth, monthRange } from './types';
import { ApiError } from './api';
export interface DemoFinanceData {
  finance?: {
    settings: SubscriptionSettings;
    subscriptions: SubscriptionMonthRecord[];
    expenses: ExpenseRecord[];
  };
}
export function demoFinance(
  w: DemoFinanceData & { settings: Settings; rosters: Record<number, Roster> },
  route: string,
  method: string,
  body: Record<string, any>,
  params: URLSearchParams,
) {
  if (!route.startsWith('/finance') && !route.startsWith('/subscriptions'))
    return { handled: false, value: undefined };
  const current = monthRange(
    financialMonth(w.settings.month_start_day),
    w.settings.month_start_day,
  );
  w.finance ||= {
    settings: {
      enabled: true,
      default_monthly_fee_minor: 10000,
      currency: 'EGP',
      month_start_day: w.settings.month_start_day || 1,
    },
    subscriptions: [
      ...new Map(
        Object.values(w.rosters).flatMap(r =>
          r.sheikh_groups.flatMap(g =>
            g.students.map(
              s =>
                [
                  s.id,
                  {
                    id: s.id,
                    student_id: s.id,
                    student_name: s.name,
                    student_code: null,
                    sheikh_id: g.sheikh.id,
                    sheikh_name: g.sheikh.name,
                    period_start: current.start,
                    period_end: current.end,
                    fee_minor: 10000,
                    is_paid: false,
                    payment_date: null,
                    payment_method: null,
                    payment_note: null,
                    receipt_number: null,
                  },
                ] as const,
            ),
          ),
        ),
      ).values(),
    ],
    expenses: [],
  };
  const f = w.finance,
    categories = [
      { id: 'general', label: 'مصروفات عامة', enabled: true },
      { id: 'transport', label: 'انتقالات', enabled: true },
    ],
    result = (value: unknown) => ({ handled: true, value });
  const period = params.get('period') || current.start;
  const end = monthRange(
    financialMonth(w.settings.month_start_day, new Date(period + 'T12:00:00')),
    w.settings.month_start_day,
  ).end;
  const records = f.subscriptions.filter(s => s.period_start === period);
  if (route === '/subscriptions/settings') {
    if (method === 'PUT') Object.assign(f.settings, body);
    return result(f.settings);
  }
  if (route === '/finance/settings')
    return result({
      month_start_day: w.settings.month_start_day || 1,
      expense_categories: categories,
      sheikhs: [
        ...new Map(
          Object.values(w.rosters).flatMap(r =>
            r.circle_sheikhs.map(s => [s.id, s] as const),
          ),
        ).values(),
      ],
    });
  if (route === '/finance/overview') {
    const paid = f.subscriptions.filter(
        s => s.is_paid && s.payment_date! >= period && s.payment_date! <= end,
      ),
      expenses = f.expenses.filter(
        e => e.expense_date >= period && e.expense_date <= end,
      );
    const cash = paid.reduce((n, s) => n + s.fee_minor, 0),
      cost = expenses.reduce((n, e) => n + e.amount_minor, 0),
      expected = records.reduce((n, s) => n + s.fee_minor, 0),
      collected = records
        .filter(s => s.is_paid)
        .reduce((n, s) => n + s.fee_minor, 0);
    return result({
      period_start: period,
      period_end: end,
      currency: f.settings.currency,
      cash_collected_minor: cash,
      expenses_minor: cost,
      net_cash_minor: cash - cost,
      expected_subscriptions_minor: expected,
      collected_subscriptions_minor: collected,
      outstanding_subscriptions_minor: expected - collected,
      payment_methods: ['cash', 'bank_transfer', 'mobile_wallet', 'other'].map(
        method => ({
          method,
          income_minor: paid
            .filter(s => s.payment_method === method)
            .reduce((n, s) => n + s.fee_minor, 0),
          expenses_minor: expenses
            .filter(e => e.payment_method === method)
            .reduce((n, e) => n + e.amount_minor, 0),
          net_minor:
            paid
              .filter(s => s.payment_method === method)
              .reduce((n, s) => n + s.fee_minor, 0) -
            expenses
              .filter(e => e.payment_method === method)
              .reduce((n, e) => n + e.amount_minor, 0),
        }),
      ),
    });
  }
  const pay = (r: SubscriptionMonthRecord) => {
    if (r.is_paid) throw new ApiError('الاشتراك مسدد بالفعل.', 409);
    r.is_paid = true;
    r.payment_date = body.payment_date;
    r.payment_method = body.payment_method;
    r.payment_note = body.payment_note;
    r.receipt_number = `DEMO-${r.id}`;
  };
  if (route === '/subscriptions/months/bulk-mark-paid') {
    const selected = f.subscriptions.filter(s =>
      body.record_ids.includes(s.id),
    );
    if (selected.some(s => s.is_paid))
      throw new ApiError('يوجد اشتراك مسدد.', 409);
    selected.forEach(pay);
    return result({ updated: selected.length });
  }
  if (/^\/subscriptions\/months\/\d+/.test(route)) {
    const r = f.subscriptions.find(s => s.id === Number(route.split('/')[3]));
    if (!r) throw new ApiError('الاشتراك غير موجود.', 404);
    if (route.endsWith('/receipt')) {
      if (!r.is_paid) throw new ApiError('لم يتم السداد.', 409);
      return result({
        ...r,
        tahfiz_name: w.settings.name,
        currency: f.settings.currency,
        recorded_by_username: 'demo-admin',
      });
    }
    if (route.endsWith('/mark-paid')) pay(r);
    else if (route.endsWith('/mark-unpaid')) {
      r.is_paid = false;
      r.payment_date = null;
      r.payment_method = null;
      r.payment_note = null;
      r.receipt_number = null;
    } else if (method === 'PATCH') r.fee_minor = body.fee_minor;
    return result(r);
  }
  if (route === '/subscriptions/months') {
    const filtered = records.filter(
        s =>
          (!params.get('paid') || String(s.is_paid) === params.get('paid')) &&
          (!params.get('sheikh_id') ||
            s.sheikh_id === Number(params.get('sheikh_id'))) &&
          (!params.get('search') ||
            (s.student_name + ' ' + s.sheikh_name).includes(
              params.get('search')!,
            )),
      ),
      page = Number(params.get('page') || 1),
      size = Number(params.get('page_size') || 25);
    return result({
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      page,
      page_size: size,
      summary: {
        expected_minor: filtered.reduce((n, s) => n + s.fee_minor, 0),
        collected_minor: filtered
          .filter(s => s.is_paid)
          .reduce((n, s) => n + s.fee_minor, 0),
        unpaid_minor: filtered
          .filter(s => !s.is_paid)
          .reduce((n, s) => n + s.fee_minor, 0),
        paid_count: filtered.filter(s => s.is_paid).length,
        unpaid_count: filtered.filter(s => !s.is_paid).length,
      },
    });
  }
  if (/^\/finance\/expenses\/\d+$/.test(route)) {
    const record = f.expenses.find(e => e.id === Number(route.split('/')[3]));
    if (!record) throw new ApiError('المصروف غير موجود.', 404);
    if (method === 'DELETE') {
      f.expenses = f.expenses.filter(e => e.id !== record.id);
      return result(undefined);
    }
    Object.assign(record, body, {
      category_label: categories.find(c => c.id === body.category_id)?.label,
      updated_at: new Date().toISOString(),
    });
    return result(record);
  }
  if (route === '/finance/expenses') {
    if (method === 'POST') {
      const record = {
        ...body,
        id: Date.now(),
        currency: f.settings.currency,
        category_label: categories.find(c => c.id === body.category_id)?.label,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ExpenseRecord;
      f.expenses.unshift(record);
      return result(record);
    }
    const rows = f.expenses.filter(
        e =>
          e.expense_date >= period &&
          e.expense_date <= end &&
          (!params.get('category_id') ||
            e.category_id === params.get('category_id')) &&
          (!params.get('search') ||
            (e.name + ' ' + e.note).includes(params.get('search')!)),
      ),
      page = Number(params.get('page') || 1),
      size = Number(params.get('page_size') || 25);
    return result({
      items: rows.slice((page - 1) * size, page * size),
      total: rows.length,
      total_minor: rows.reduce((n, e) => n + e.amount_minor, 0),
      page,
      page_size: size,
    });
  }
  throw new ApiError('مسار تجريبي غير متاح.', 404);
}
