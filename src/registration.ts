export function invitationToken(value: string) {
  const cleaned = value.trim();
  const match = cleaned.match(
    /^(?:https:\/\/[^/?#]+\/invite\/|zamzam:\/\/invite\/|\/invite\/)?([A-Za-z0-9_-]{16,500})\/?$/,
  );
  if (!match) throw new Error('أدخل رابط دعوة صحيحاً أو رمز الدعوة.');
  return match[1];
}
export const initialSetup = {
  attendance_statuses: ['حاضر', 'غياب', 'غياب بعذر', 'لا ينطبق'],
  present_status: 'حاضر',
  absent_status: 'غياب',
  session_name_options: ['الصباحية', 'المسائية'],
  subscriptions_enabled: false,
  subscription_default_fee_minor: 0,
  subscription_currency: 'EGP',
  month_start_day: 1,
  progress_tracking_enabled: false,
  progress_categories: ['new_memorization', 'recent_revision'],
};
export type InitialSetup = typeof initialSetup;
export function validateSetup(setup: InitialSetup) {
  if (
    setup.attendance_statuses.length < 2 ||
    !setup.attendance_statuses.includes(setup.present_status) ||
    !setup.attendance_statuses.includes(setup.absent_status) ||
    setup.present_status === setup.absent_status
  )
    throw new Error('حدد حالات الحضور، وحالتي حاضر وغياب مختلفتين.');
  if (
    !setup.session_name_options.length ||
    !Number.isInteger(setup.month_start_day) ||
    setup.month_start_day < 1 ||
    setup.month_start_day > 28
  )
    throw new Error('أضف اسم حلقة وحدد بداية الشهر من 1 إلى 28.');
  if (
    !/^[A-Z]{3}$/.test(setup.subscription_currency) ||
    !Number.isSafeInteger(setup.subscription_default_fee_minor) ||
    setup.subscription_default_fee_minor < 0
  )
    throw new Error('راجع العملة وقيمة الاشتراك.');
}
