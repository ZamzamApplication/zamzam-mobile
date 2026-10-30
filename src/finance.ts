import type {
  SubscriptionMonthRecord,
  SubscriptionPaymentMethod,
} from './domain-types';

export const SUBSCRIPTION_PAYMENT_METHODS: Array<{
  value: SubscriptionPaymentMethod;
  label: string;
}> = [
  { value: 'cash', label: 'نقدي' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'mobile_wallet', label: 'محفظة إلكترونية' },
  { value: 'other', label: 'أخرى' },
];

export function majorToMinor(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function minorToInput(value: number): string {
  return (value / 100).toFixed(2);
}

export function formatSubscriptionMoney(
  value: number,
  currency = 'EGP',
): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function selectedOutstandingTotal(
  records: SubscriptionMonthRecord[],
  selectedIds: Set<number>,
): number {
  return records.reduce(
    (total, record) =>
      selectedIds.has(record.id) && !record.is_paid
        ? total + record.fee_minor
        : total,
    0,
  );
}

export function paymentMethodLabel(
  method: SubscriptionPaymentMethod | null,
): string {
  return (
    SUBSCRIPTION_PAYMENT_METHODS.find(item => item.value === method)?.label ||
    '—'
  );
}
