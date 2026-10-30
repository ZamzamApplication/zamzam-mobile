const ACTION_LABELS: Record<string, string> = {
  'trip.created': 'إنشاء رحلة',
  'trip.participants_added': 'إضافة مشاركين لرحلة',
  'trip.participant_updated': 'تعديل مشاركة أو سداد رحلة',
  'trip.round_started': 'بدء جولة تحقق للرحلة',
  'trip.checked': 'تسجيل وجود مشارك في رحلة',
  'trip.headcount_removed': 'استبعاد مشاركة من التحقق الحالي',
  'trip.status_changed': 'تغيير حالة رحلة',
  'trip.group_added': 'إضافة مجموعة للرحلة',
  'trip.group_assigned': 'توزيع مشاركين على مجموعة',
  'attendance.batch_updated': 'تعديل سجل الحضور',
  'feedback.created': 'إرسال ملاحظة للمنصة',
  'feedback.status_changed': 'تغيير حالة ملاحظة',
  'invitation.accepted': 'قبول دعوة',
  'invitation.created': 'إنشاء دعوة',
  'invitation.registered': 'تسجيل مستخدم بدعوة',
  'invitation.resent': 'إعادة إرسال دعوة',
  'invitation.revoked': 'إلغاء دعوة',
  'membership.default_changed': 'تغيير التحفيظ الافتراضي',
  'membership.granted': 'منح عضوية',
  'membership.revoked': 'إلغاء عضوية',
  'membership.updated': 'تعديل عضوية',
  'quran_progress.batch_updated': 'تعديل متابعة القرآن',
  'saved_filter.deleted': 'حذف تصفية محفوظة',
  'session.confirmed': 'تأكيد حلقة',
  'session.date_updated': 'تغيير تاريخ حلقة',
  'session.deleted': 'حذف حلقة',
  'session.reopened': 'إعادة فتح حلقة',
  'sheikh.deleted': 'حذف شيخ',
  'student.deleted': 'حذف طالب',
  'student.deleted_before_sheikh_delete': 'حذف طالب أثناء حذف شيخ',
  'student.excused_period_cancelled': 'إلغاء فترة غياب بعذر',
  'student.excused_period_created': 'إضافة فترة غياب بعذر',
  'student.excused_period_ended_early': 'إنهاء فترة عذر مبكراً',
  'student.excused_period_updated': 'تعديل فترة غياب بعذر',
  'student.reassigned_before_sheikh_delete': 'إعادة إسناد طالب أثناء حذف شيخ',
  'student.sheikh_changed': 'نقل طالب إلى شيخ آخر',
  'subscriptions.amount_corrected': 'تصحيح قيمة اشتراك',
  'subscriptions.bulk_amount_corrected': 'تصحيح اشتراكات شهرية جماعي',
  'subscriptions.bulk_marked_paid': 'تسجيل سداد جماعي',
  'subscriptions.marked_paid': 'تسجيل سداد اشتراك',
  'subscriptions.marked_unpaid': 'إلغاء سداد اشتراك',
  'subscriptions.period_generated': 'إنشاء دورة اشتراكات',
  'subscriptions.settings_updated': 'تعديل إعدادات الاشتراكات',
  'subscriptions.student_fee_updated': 'تعديل رسم طالب',
  'finance.expense_created': 'إضافة مصروف',
  'finance.expense_updated': 'تعديل مصروف',
  'finance.expense_deleted': 'حذف مصروف',
  'finance.categories_updated': 'تعديل تصنيفات المصروفات',
  'sync.mutations_processed': 'مزامنة تغييرات الهاتف',
  'tahfiz.settings_updated': 'تعديل إعدادات التحفيظ',
  'tahfiz.support_access': 'دخول دعم المنصة',
  'tahfiz.support_context': 'استخدام سياق دعم المنصة',
  'user.access_revoked': 'إلغاء وصول مستخدم',
  'user.updated': 'تعديل مستخدم',
};

const DETAIL_LABELS: Record<string, string> = {
  trip_id: 'الرحلة',
  participant_id: 'المشارك',
  round_id: 'جولة التحقق',
  group_id: 'المجموعة',
  amount: 'المبلغ',
  changed: 'المعدّل',
  count: 'العدد',
  date: 'التاريخ',
  delete_attendance: 'حذف الحضور',
  deleted_students: 'طلاب محذوفون',
  end: 'النهاية',
  fields: 'الحقول',
  from: 'من',
  from_sheikh: 'الشيخ السابق',
  generated: 'تم الإنشاء',
  invitation: 'الدعوة',
  method: 'طريقة الدفع',
  period: 'الفترة',
  previous_status: 'الحالة السابقة',
  reason: 'السبب',
  reassigned_students: 'طلاب أعيد إسنادهم',
  receipt: 'الإيصال',
  record: 'السجل',
  records: 'السجلات',
  role: 'الدور',
  session: 'الحلقة',
  sheikh: 'الشيخ',
  start: 'البداية',
  student: 'الطالب',
  to: 'إلى',
  to_sheikh: 'الشيخ الجديد',
  update_future: 'تحديث الأشهر القادمة',
  user: 'المستخدم',
  version: 'الإصدار',
};

export function auditActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] || action.replaceAll('.', ' ← ').replaceAll('_', ' ')
  );
}

export function formatAuditDetails(details: string | null): string {
  if (!details) return 'لا توجد تفاصيل إضافية';
  let entries: [string, unknown][];
  try {
    const parsed = JSON.parse(details);
    entries =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.entries(parsed)
        : [];
  } catch {
    entries = details.split(';').map(part => {
      const separator = part.indexOf('=');
      return separator < 0
        ? ['', part.trim()]
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    });
  }
  if (entries.length === 0) return details;
  return entries
    .filter(([, value]) => String(value ?? '').trim())
    .map(([key, value]) =>
      key ? `${DETAIL_LABELS[key] || key}: ${String(value)}` : String(value),
    )
    .join(' · ');
}
