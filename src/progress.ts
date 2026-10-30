import type { QuranProgressInput } from './domain-types';
import { surahInfo } from './quran';
export const categoryName = (value: string) =>
  ({
    new_memorization: 'الحفظ الجديد',
    recent_revision: 'المراجعة القريبة',
    old_revision: 'المراجعة البعيدة',
    test: 'اختبار',
  }[value] || value);
export function validateProgress(input: QuranProgressInput) {
  if (
    !Number.isInteger(input.quality_score) ||
    input.quality_score < 1 ||
    input.quality_score > 5
  )
    throw new Error('اختر تقييماً من 1 إلى 5.');
  if (
    !Number.isInteger(input.mistakes ?? 0) ||
    (input.mistakes ?? 0) < 0 ||
    (input.mistakes ?? 0) > 1000
  )
    throw new Error('عدد الأخطاء يجب أن يكون بين 0 و1000.');
  if (input.range_type === 'page') {
    const from = input.from_page || 0,
      to = input.to_page || 0;
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1 ||
      to < 1 ||
      from > 604 ||
      to > 604 ||
      (input.direction === 'backward' ? to > from : to < from)
    )
      throw new Error('أدخل نطاق صفحات صالحاً بين 1 و604 وفق اتجاه القراءة.');
  } else {
    const a = input.from_surah || 0,
      b = input.to_surah || 0,
      x = input.from_ayah || 0,
      y = input.to_ayah || 0;
    if (
      ![a, b, x, y].every(Number.isInteger) ||
      a < 1 ||
      a > 114 ||
      b < 1 ||
      b > 114 ||
      x < 1 ||
      y < 1 ||
      x > surahInfo(a).ayahs ||
      y > surahInfo(b).ayahs ||
      (a === b ? y < x : input.direction === 'backward' ? b > a : b < a)
    )
      throw new Error('أدخل نطاق سور وآيات صالحاً وفق اتجاه القراءة.');
  }
}
