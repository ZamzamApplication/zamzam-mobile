import React, { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { canManage, financialMonth, monthRange, localDate } from '../types';
import type {
  ExpenseCategory,
  ExpensePage,
  ExpenseRecord,
  FinanceOverview,
  SubscriptionMonthRecord,
  SubscriptionMonthsResponse,
  SubscriptionPaymentMethod,
  SubscriptionReceipt,
  SubscriptionSettings,
} from '../domain-types';
import {
  formatSubscriptionMoney as money,
  majorToMinor,
  minorToInput,
  paymentMethodLabel,
  selectedOutstandingTotal,
  SUBSCRIPTION_PAYMENT_METHODS,
} from '../finance';
import { queryString, rangeError } from '../reports';
import {
  Button,
  Card,
  Field,
  Notice,
  Select,
  Toggle,
  Txt,
  StatGrid,
} from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';
interface FinanceSettings {
  month_start_day: number;
  expense_categories: ExpenseCategory[];
  sheikhs: { id: number; name: string }[];
}
const financeAccess = (role: string) =>
  ['admin', 'super_admin', 'auditor'].includes(role);
const confirm = (
  title: string,
  message: string,
  run: () => void,
  destructive = false,
) =>
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'تأكيد',
      style: destructive ? 'destructive' : 'default',
      onPress: run,
    },
  ]);
function amount(value: string, positive = false) {
  const n = majorToMinor(value);
  if (n === null || n > 1_000_000_000 || (positive && n === 0))
    throw new Error('أدخل مبلغاً صحيحاً، بمنزلتين عشريتين بحد أقصى.');
  return n;
}
export function FinanceScreen({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const { data, online } = useEngine(engine),
    allowed = financeAccess(data.user.role),
    admin = canManage(data.user);
  const settings = useResource<FinanceSettings>(
    engine,
    allowed ? '/finance/settings' : null,
  );
  const subscriptionSettings = useResource<SubscriptionSettings>(
    engine,
    allowed ? '/subscriptions/settings' : null,
  );
  const [month, setMonth] = useState(
    financialMonth(data.settings.month_start_day),
  );
  const [filters, setFilters] = useState({
    month,
    search: '',
    paid: '',
    sheikh: '',
    category: '',
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1),
    [section, setSection] = useState('subscriptions');
  const [selected, setSelected] = useState<number[]>([]);
  const [payment, setPayment] = useState<SubscriptionMonthRecord[] | null>(
    null,
  );
  const [expense, setExpense] = useState<ExpenseRecord | 'new' | null>(null);
  const [receipt, setReceipt] = useState<number | null>(null);
  const [correct, setCorrect] = useState<SubscriptionMonthRecord | null>(null);
  const [editSettings, setEditSettings] = useState(false);
  const startDay =
    settings.value?.month_start_day ?? data.settings.month_start_day ?? 1;
  const period = monthRange(applied.month, startDay).start;
  const periodEnd = monthRange(applied.month, startDay).end;
  const overview = useResource<FinanceOverview>(
    engine,
    allowed ? `/finance/overview?period=${period}` : null,
  );
  const subscriptionPath =
    '/subscriptions/months?' +
    queryString({
      period,
      search: applied.search,
      paid: applied.paid,
      sheikh_id: applied.sheikh,
      page,
      page_size: 25,
    });
  const expensePath =
    '/finance/expenses?' +
    queryString({
      period,
      search: applied.search,
      category_id: applied.category,
      page,
      page_size: 25,
    });
  const subs = useResource<SubscriptionMonthsResponse>(
    engine,
    allowed && section === 'subscriptions' ? subscriptionPath : null,
  );
  const expenses = useResource<ExpensePage>(
    engine,
    allowed && section === 'expenses' ? expensePath : null,
  );
  const action = useAction();
  const currency =
    overview.value?.currency || subscriptionSettings.value?.currency || 'EGP';
  const reload = () => {
    overview.reload();
    subs.reload();
    expenses.reload();
    settings.reload();
    subscriptionSettings.reload();
  };
  const back = () => {
    setPayment(null);
    setExpense(null);
    setReceipt(null);
    setCorrect(null);
    setEditSettings(false);
    reload();
  };
  if (!allowed)
    return (
      <FeaturePage engine={engine} title="القسم المالي" onBack={onBack}>
        <Notice message="القسم المالي متاح للإدارة والمراجعين فقط." />
      </FeaturePage>
    );
  if (payment && admin)
    return (
      <PaymentEditor
        engine={engine}
        records={payment}
        currency={currency}
        onBack={back}
        onSaved={back}
      />
    );
  if (expense && admin && settings.value)
    return (
      <ExpenseEditor
        engine={engine}
        expense={expense === 'new' ? undefined : expense}
        categories={settings.value.expense_categories}
        currency={currency}
        onBack={back}
        onSaved={back}
      />
    );
  if (receipt)
    return (
      <ReceiptScreen
        engine={engine}
        id={receipt}
        currency={currency}
        onBack={back}
      />
    );
  if (correct && admin)
    return (
      <FeeEditor
        engine={engine}
        record={correct}
        currency={currency}
        onBack={back}
      />
    );
  if (editSettings && admin && subscriptionSettings.value)
    return (
      <FinanceSettingsEditor
        engine={engine}
        settings={subscriptionSettings.value}
        onBack={back}
      />
    );
  const currentRows = subs.value?.items || [];
  const selectedRows = currentRows.filter(
    s => selected.includes(s.id) && !s.is_paid && s.fee_minor > 0,
  );
  const total =
    section === 'subscriptions'
      ? subs.value?.total || 0
      : expenses.value?.total || 0;
  const filterError = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? ''
    : 'أدخل الشهر بصيغة YYYY-MM.';
  return (
    <FeaturePage
      engine={engine}
      title="القسم المالي"
      onBack={onBack}
      loading={
        overview.loading || subs.loading || expenses.loading || settings.loading
      }
      error={
        overview.error ||
        subs.error ||
        expenses.error ||
        settings.error ||
        subscriptionSettings.error ||
        action.error
      }
      reload={reload}
      fetchedAt={overview.fetchedAt}
    >
      {!admin && <Notice message="وصول المراجع للعرض فقط." />}
      <Txt bold>
        الفترة المعروضة: {period} — {periodEnd}
      </Txt>
      {overview.value && (
        <Card>
          <Txt bold>الملخص المالي</Txt>
          <StatGrid
            items={[
              {
                label: 'المتوقع للاشتراكات',
                value: money(
                  overview.value.expected_subscriptions_minor,
                  currency,
                ),
              },
              {
                label: 'المحصل في الفترة',
                value: money(overview.value.cash_collected_minor, currency),
                tone: 'good',
              },
              {
                label: 'المصروفات',
                value: money(overview.value.expenses_minor, currency),
                tone: 'bad',
              },
              {
                label: 'صافي النقدية',
                value: money(overview.value.net_cash_minor, currency),
                testID: 'finance-net',
              },
            ]}
          />
          <Txt>
            المتبقي للاشتراكات:{' '}
            {money(overview.value.outstanding_subscriptions_minor, currency)}
          </Txt>
          <Txt muted>
            النقدية حسب تاريخ السداد، والاشتراكات حسب فترة الاستحقاق.
          </Txt>
          {overview.value.payment_methods.map(m => (
            <Txt key={m.method}>
              {paymentMethodLabel(m.method)} · محصل{' '}
              {money(m.income_minor, currency)} · مصروف{' '}
              {money(m.expenses_minor, currency)}
            </Txt>
          ))}
        </Card>
      )}
      {admin && (
        <Button
          secondary
          title="إعدادات الاشتراكات"
          disabled={!subscriptionSettings.value}
          onPress={() => setEditSettings(true)}
        />
      )}
      <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          secondary={section !== 'subscriptions'}
          title="الاشتراكات"
          onPress={() => {
            setSection('subscriptions');
            setPage(1);
            setSelected([]);
          }}
          testID="finance-subscriptions"
        />
        <Button
          style={{ flex: 1 }}
          secondary={section !== 'expenses'}
          title="المصروفات"
          onPress={() => {
            setSection('expenses');
            setPage(1);
            setSelected([]);
          }}
          testID="finance-expenses"
        />
      </View>
      <Card>
        <Field
          label="الشهر YYYY-MM"
          value={month}
          onChangeText={v => {
            setMonth(v);
            setFilters({ ...filters, month: v });
          }}
          testID="finance-month"
        />
        <Field
          label="بحث بالاسم أو الملاحظات"
          value={filters.search}
          onChangeText={search => setFilters({ ...filters, search })}
          testID="finance-search"
        />
        {section === 'subscriptions' ? (
          <>
            <Select
              label="السداد"
              value={filters.paid}
              onChange={paid => setFilters({ ...filters, paid })}
              options={[
                { value: '', label: 'الكل' },
                { value: 'true', label: 'مسدد' },
                { value: 'false', label: 'غير مسدد' },
              ]}
            />
            <Select
              label="الشيخ"
              value={filters.sheikh}
              onChange={sheikh => setFilters({ ...filters, sheikh })}
              options={[
                { value: '', label: 'كل الشيوخ' },
                ...(settings.value?.sheikhs || []).map(s => ({
                  value: String(s.id),
                  label: s.name,
                })),
              ]}
            />
          </>
        ) : (
          <Select
            label="تصنيف المصروف"
            value={filters.category}
            onChange={category => setFilters({ ...filters, category })}
            options={[
              { value: '', label: 'كل التصنيفات' },
              ...(settings.value?.expense_categories || []).map(c => ({
                value: c.id,
                label: c.label,
              })),
            ]}
          />
        )}
        {filterError ? <Notice error message={filterError} /> : null}
        <Button
          title="عرض البيانات المالية"
          disabled={!!filterError}
          onPress={() => {
            setApplied({ ...filters });
            setPage(1);
            setSelected([]);
            reload();
          }}
          testID="finance-apply"
        />
      </Card>
      {section === 'subscriptions' ? (
        <>
          {subscriptionSettings.value &&
            !subscriptionSettings.value.enabled && (
              <Notice message="الاشتراكات غير مفعلة. يمكن عرض السجلات السابقة." />
            )}
          {subs.value && (
            <Card>
              <Txt bold>اشتراكات النتائج المطابقة</Txt>
              <Txt>
                مسدد {subs.value.summary.paid_count} · غير مسدد{' '}
                {subs.value.summary.unpaid_count}
              </Txt>
              <Txt>
                المحصل {money(subs.value.summary.collected_minor, currency)} ·
                المتبقي {money(subs.value.summary.unpaid_minor, currency)}
              </Txt>
            </Card>
          )}
          {admin && selectedRows.length > 0 && (
            <Button
              title={`تسجيل سداد ${selectedRows.length} · ${money(
                selectedOutstandingTotal(currentRows, new Set(selected)),
                currency,
              )}`}
              onPress={() => setPayment(selectedRows)}
              testID="finance-bulk-pay"
            />
          )}
          {currentRows.map(s => (
            <Card key={s.id}>
              <Txt bold>{s.student_name}</Txt>
              <Txt muted>
                {s.sheikh_name || 'دون شيخ'} · {s.period_start} — {s.period_end}
              </Txt>
              <Txt>
                {money(s.fee_minor, currency)} ·{' '}
                {s.fee_minor === 0 ? 'معفى' : s.is_paid ? 'مسدد' : 'غير مسدد'}
              </Txt>
              {s.is_paid && (
                <>
                  <Txt>
                    {s.payment_date} · {paymentMethodLabel(s.payment_method)}
                  </Txt>
                  <Button
                    secondary
                    small
                    title="عرض الإيصال"
                    onPress={() => setReceipt(s.id)}
                    testID={`finance-receipt-${s.id}`}
                  />
                </>
              )}
              {admin && !s.is_paid && s.fee_minor > 0 && (
                <>
                  <Toggle
                    title="اختيار للسداد الجماعي"
                    value={selected.includes(s.id)}
                    onChange={v =>
                      setSelected(
                        v
                          ? [...selected, s.id]
                          : selected.filter(id => id !== s.id),
                      )
                    }
                  />
                  <Button
                    title="تسجيل السداد"
                    onPress={() => setPayment([s])}
                    testID={`finance-pay-${s.id}`}
                  />
                </>
              )}
              {admin && (
                <Button
                  secondary
                  small
                  title="تعديل المبلغ"
                  onPress={() => setCorrect(s)}
                />
              )}
              {admin && s.is_paid && (
                <Button
                  secondary
                  small
                  title="إلغاء السداد"
                  disabled={!online || action.busy}
                  onPress={() =>
                    confirm(
                      'إلغاء السداد',
                      `${s.student_name} · ${money(
                        s.fee_minor,
                        currency,
                      )} · سيُلغى الإيصال المسجل.`,
                      () => {
                        void action.run(async () => {
                          await engine.publish(
                            `/subscriptions/months/${s.id}/mark-unpaid`,
                          );
                          reload();
                        });
                      },
                      true,
                    )
                  }
                />
              )}
            </Card>
          ))}
          {subs.value && !currentRows.length && (
            <Txt muted>لا توجد اشتراكات مطابقة.</Txt>
          )}
        </>
      ) : (
        <>
          {admin && (
            <Button
              title="إضافة مصروف"
              disabled={
                !settings.value?.expense_categories.some(c => c.enabled)
              }
              onPress={() => setExpense('new')}
              testID="finance-add-expense"
            />
          )}
          {expenses.value && (
            <Txt bold>
              مجموع نتائج المصروفات:{' '}
              {money(expenses.value.total_minor, currency)}
            </Txt>
          )}
          {expenses.value?.items.map(e => (
            <Card key={e.id}>
              <Txt bold>{e.name}</Txt>
              <Txt>
                {money(e.amount_minor, e.currency)} · {e.category_label}
              </Txt>
              <Txt muted>
                {e.expense_date} · {paymentMethodLabel(e.payment_method)}
              </Txt>
              <Txt>{e.note}</Txt>
              {admin && (
                <>
                  <Button
                    secondary
                    small
                    title="تعديل المصروف"
                    onPress={() => setExpense(e)}
                  />
                  <Button
                    secondary
                    small
                    title="حذف المصروف"
                    disabled={!online || action.busy}
                    onPress={() =>
                      confirm(
                        'حذف المصروف',
                        `${e.name} · ${money(e.amount_minor, e.currency)}`,
                        () => {
                          void action.run(async () => {
                            await engine.publish(
                              `/finance/expenses/${e.id}`,
                              undefined,
                              'DELETE',
                            );
                            reload();
                          });
                        },
                        true,
                      )
                    }
                  />
                </>
              )}
            </Card>
          ))}
          {expenses.value && !expenses.value.items.length && (
            <Txt muted>لا توجد مصروفات مطابقة.</Txt>
          )}
        </>
      )}
      <Txt>
        صفحة {page} من {Math.max(1, Math.ceil(total / 25))} · {total} نتيجة
      </Txt>
      <Button
        secondary
        title="الصفحة السابقة"
        disabled={page <= 1}
        onPress={() => {
          setPage(page - 1);
          setSelected([]);
        }}
      />
      <Button
        secondary
        title="الصفحة التالية"
        disabled={page * 25 >= total}
        onPress={() => {
          setPage(page + 1);
          setSelected([]);
        }}
      />
    </FeaturePage>
  );
}

function PaymentEditor({
  engine,
  records,
  currency,
  onBack,
  onSaved,
}: {
  engine: OfflineEngine;
  records: SubscriptionMonthRecord[];
  currency: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction();
  const draft = useDraft(
    engine,
    `finance-payment:${records
      .map(r => r.id)
      .sort((a, b) => a - b)
      .join(',')}`,
    {
      payment_date: localDate(),
      payment_method: 'cash' as SubscriptionPaymentMethod,
      payment_note: '',
    },
  );
  const v = draft.value,
    total = records.reduce((n, r) => n + r.fee_minor, 0),
    error =
      rangeError(v.payment_date, v.payment_date, true) ||
      (v.payment_date > localDate()
        ? 'لا يمكن تسجيل سداد بتاريخ مستقبلي.'
        : '');
  return (
    <FeaturePage
      engine={engine}
      title="تسجيل سداد اشتراك"
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Card>
        {records.map(r => (
          <Txt key={r.id}>
            {r.student_name} · {money(r.fee_minor, currency)}
          </Txt>
        ))}
        <Txt bold>الإجمالي: {money(total, currency)}</Txt>
      </Card>
      <Field
        label="تاريخ السداد YYYY-MM-DD"
        value={v.payment_date}
        onChangeText={payment_date => draft.change({ payment_date })}
      />
      <Select
        label="طريقة السداد"
        value={v.payment_method}
        onChange={payment_method =>
          draft.change({
            payment_method: payment_method as SubscriptionPaymentMethod,
          })
        }
        options={SUBSCRIPTION_PAYMENT_METHODS}
      />
      <Field
        label="ملاحظة السداد"
        value={v.payment_note}
        onChangeText={payment_note => draft.change({ payment_note })}
        multiline
      />
      {error ? <Notice error message={error} /> : null}
      <Notice message="تُحفظ مسودة السداد على الجهاز، ويُسجل السداد عند التأكيد والاتصال فقط." />
      <Button
        title="تأكيد السداد"
        disabled={!online || !!error}
        busy={action.busy}
        onPress={() =>
          confirm(
            'تسجيل السداد',
            `${records.length} اشتراك · ${money(total, currency)} · ${
              v.payment_date
            } · ${paymentMethodLabel(v.payment_method)}`,
            () => {
              void action.run(async () => {
                await engine.publish(
                  records.length === 1
                    ? `/subscriptions/months/${records[0].id}/mark-paid`
                    : '/subscriptions/months/bulk-mark-paid',
                  {
                    ...v,
                    ...(records.length > 1
                      ? { record_ids: records.map(r => r.id) }
                      : {}),
                  },
                );
                await draft.clear();
                onSaved();
              });
            },
          )
        }
        testID="finance-confirm-payment"
      />
      {action.error && (
        <Notice message="راجع حالة الاشتراكات قبل إعادة المحاولة؛ قد يكون الخادم قد سجل السداد." />
      )}
    </FeaturePage>
  );
}
function ExpenseEditor({
  engine,
  expense,
  categories,
  currency,
  onBack,
  onSaved,
}: {
  engine: OfflineEngine;
  expense?: ExpenseRecord;
  categories: ExpenseCategory[];
  currency: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction();
  const draft = useDraft(engine, `finance-expense:${expense?.id || 'new'}`, {
    name: expense?.name || '',
    category_id:
      expense?.category_id || categories.find(c => c.enabled)?.id || '',
    amount: expense ? minorToInput(expense.amount_minor) : '',
    expense_date: expense?.expense_date || localDate(),
    payment_method:
      expense?.payment_method || ('cash' as SubscriptionPaymentMethod),
    note: expense?.note || '',
  });
  const v = draft.value;
  return (
    <FeaturePage
      engine={engine}
      title={expense ? 'تعديل مصروف' : 'إضافة مصروف'}
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Field
        label="اسم المصروف"
        value={v.name}
        onChangeText={name => draft.change({ name })}
        testID="expense-name"
      />
      <Field
        label={`المبلغ (${currency})`}
        keyboardType="decimal-pad"
        value={v.amount}
        onChangeText={n => draft.change({ amount: n })}
        testID="expense-amount"
      />
      <Select
        label="التصنيف"
        value={v.category_id}
        onChange={category_id => draft.change({ category_id })}
        options={categories
          .filter(c => c.enabled || c.id === expense?.category_id)
          .map(c => ({ value: c.id, label: c.label }))}
      />
      <Field
        label="التاريخ YYYY-MM-DD"
        value={v.expense_date}
        onChangeText={expense_date => draft.change({ expense_date })}
      />
      <Select
        label="طريقة الدفع"
        value={v.payment_method}
        onChange={payment_method =>
          draft.change({
            payment_method: payment_method as SubscriptionPaymentMethod,
          })
        }
        options={SUBSCRIPTION_PAYMENT_METHODS}
      />
      <Field
        label="ملاحظات"
        value={v.note}
        onChangeText={note => draft.change({ note })}
        multiline
      />
      <Notice message="المصروف مسودة محلية حتى تضغط نشر عند الاتصال." />
      <Button
        title="نشر المصروف"
        disabled={!online || !v.name.trim() || !v.category_id}
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            const error = rangeError(v.expense_date, v.expense_date, true);
            if (error) throw new Error(error);
            const amount_minor = amount(v.amount, true);
            await engine.publish(
              expense ? `/finance/expenses/${expense.id}` : '/finance/expenses',
              {
                name: v.name.trim(),
                category_id: v.category_id,
                amount_minor,
                expense_date: v.expense_date,
                payment_method: v.payment_method,
                note: v.note || null,
              },
              expense ? 'PATCH' : 'POST',
            );
            await draft.clear();
            onSaved();
          });
        }}
        testID="expense-save"
      />
      {action.error && (
        <Notice message="راجع سجل المصروفات قبل إعادة النشر لتجنب إنشاء مصروف مكرر إذا انقطع الرد." />
      )}
    </FeaturePage>
  );
}
function ReceiptScreen({
  engine,
  id,
  currency,
  onBack,
}: {
  engine: OfflineEngine;
  id: number;
  currency: string;
  onBack: () => void;
}) {
  const record = useResource<SubscriptionReceipt>(
      engine,
      `/subscriptions/months/${id}/receipt`,
    ),
    action = useAction(),
    r = record.value;
  const text = r
    ? [
        r.tahfiz_name,
        `إيصال ${r.receipt_number}`,
        r.student_name,
        `${r.period_start} — ${r.period_end}`,
        money(r.fee_minor, r.currency || currency),
        `${r.payment_date} · ${paymentMethodLabel(r.payment_method)}`,
        r.payment_note || '',
        r.recorded_by_username ? `سجله ${r.recorded_by_username}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  return (
    <FeaturePage
      engine={engine}
      title="إيصال السداد"
      onBack={onBack}
      loading={record.loading}
      error={record.error || action.error}
      reload={record.reload}
      fetchedAt={record.fetchedAt}
    >
      {r && (
        <>
          <Card>
            <Txt>{text}</Txt>
          </Card>
          <Button
            title="مشاركة الإيصال"
            onPress={() => {
              void action.run(async () => {
                await Share.share({ message: text });
              });
            }}
            testID="finance-share-receipt"
          />
        </>
      )}
    </FeaturePage>
  );
}
function FeeEditor({
  engine,
  record,
  currency,
  onBack,
}: {
  engine: OfflineEngine;
  record: SubscriptionMonthRecord;
  currency: string;
  onBack: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction(),
    draft = useDraft(engine, `finance-fee:${record.id}`, {
      value: minorToInput(record.fee_minor),
      future: false,
    });
  return (
    <FeaturePage
      engine={engine}
      title="تعديل مبلغ الاشتراك"
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Txt>
        {record.student_name} · {record.period_start}
      </Txt>
      <Txt>المبلغ الحالي: {money(record.fee_minor, currency)}</Txt>
      <Field
        label="المبلغ الجديد"
        value={draft.value.value}
        onChangeText={value => draft.change({ value })}
        keyboardType="decimal-pad"
      />
      <Toggle
        title="تطبيق المبلغ أيضاً على الأشهر القادمة"
        value={draft.value.future}
        onChange={future => draft.change({ future })}
      />
      <Button
        title="حفظ المبلغ"
        disabled={!online}
        busy={action.busy}
        onPress={() => {
          let fee: number;
          try {
            fee = amount(draft.value.value);
          } catch {
            void action.run(async () => {
              amount(draft.value.value);
            });
            return;
          }
          confirm(
            'تعديل المبلغ',
            `${record.student_name} · ${money(
              record.fee_minor,
              currency,
            )} ← ${money(fee, currency)}${
              draft.value.future ? ' · يشمل الأشهر القادمة' : ''
            }`,
            () => {
              void action.run(async () => {
                await engine.publish(
                  `/subscriptions/months/${record.id}`,
                  {
                    fee_minor: fee,
                    update_future: draft.value.future,
                    ...(draft.value.future
                      ? { future_monthly_fee_minor: fee }
                      : {}),
                  },
                  'PATCH',
                );
                await draft.clear();
                onBack();
              });
            },
          );
        }}
      />
    </FeaturePage>
  );
}
function FinanceSettingsEditor({
  engine,
  settings,
  onBack,
}: {
  engine: OfflineEngine;
  settings: SubscriptionSettings;
  onBack: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction(),
    draft = useDraft(engine, 'finance-settings', {
      enabled: settings.enabled,
      fee: minorToInput(settings.default_monthly_fee_minor),
      currency: settings.currency,
    });
  return (
    <FeaturePage
      engine={engine}
      title="إعدادات الاشتراكات"
      onBack={onBack}
      error={action.error || draft.error}
    >
      <Toggle
        title="تفعيل الاشتراكات"
        value={draft.value.enabled}
        onChange={enabled => draft.change({ enabled })}
      />
      <Field
        label="الرسم الشهري الافتراضي"
        value={draft.value.fee}
        onChangeText={fee => draft.change({ fee })}
        keyboardType="decimal-pad"
      />
      <Field
        label="رمز العملة (مثل EGP)"
        value={draft.value.currency}
        onChangeText={currency =>
          draft.change({ currency: currency.toUpperCase() })
        }
      />
      <Button
        title="نشر إعدادات الاشتراكات"
        disabled={!online}
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (!/^[A-Z]{3}$/.test(draft.value.currency))
              throw new Error('رمز العملة ثلاثة أحرف.');
            const default_monthly_fee_minor = amount(draft.value.fee);
            await engine.publish(
              '/subscriptions/settings',
              {
                enabled: draft.value.enabled,
                default_monthly_fee_minor,
                currency: draft.value.currency,
              },
              'PUT',
            );
            await draft.clear();
            onBack();
          });
        }}
      />
    </FeaturePage>
  );
}
