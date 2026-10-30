export interface SurahInfo {
  number: number;
  name: string;
  ayahs: number;
}

const names = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'الأنفال',
  'التوبة',
  'يونس',
  'هود',
  'يوسف',
  'الرعد',
  'إبراهيم',
  'الحجر',
  'النحل',
  'الإسراء',
  'الكهف',
  'مريم',
  'طه',
  'الأنبياء',
  'الحج',
  'المؤمنون',
  'النور',
  'الفرقان',
  'الشعراء',
  'النمل',
  'القصص',
  'العنكبوت',
  'الروم',
  'لقمان',
  'السجدة',
  'الأحزاب',
  'سبأ',
  'فاطر',
  'يس',
  'الصافات',
  'ص',
  'الزمر',
  'غافر',
  'فصلت',
  'الشورى',
  'الزخرف',
  'الدخان',
  'الجاثية',
  'الأحقاف',
  'محمد',
  'الفتح',
  'الحجرات',
  'ق',
  'الذاريات',
  'الطور',
  'النجم',
  'القمر',
  'الرحمن',
  'الواقعة',
  'الحديد',
  'المجادلة',
  'الحشر',
  'الممتحنة',
  'الصف',
  'الجمعة',
  'المنافقون',
  'التغابن',
  'الطلاق',
  'التحريم',
  'الملك',
  'القلم',
  'الحاقة',
  'المعارج',
  'نوح',
  'الجن',
  'المزمل',
  'المدثر',
  'القيامة',
  'الإنسان',
  'المرسلات',
  'النبأ',
  'النازعات',
  'عبس',
  'التكوير',
  'الانفطار',
  'المطففين',
  'الانشقاق',
  'البروج',
  'الطارق',
  'الأعلى',
  'الغاشية',
  'الفجر',
  'البلد',
  'الشمس',
  'الليل',
  'الضحى',
  'الشرح',
  'التين',
  'العلق',
  'القدر',
  'البينة',
  'الزلزلة',
  'العاديات',
  'القارعة',
  'التكاثر',
  'العصر',
  'الهمزة',
  'الفيل',
  'قريش',
  'الماعون',
  'الكوثر',
  'الكافرون',
  'النصر',
  'المسد',
  'الإخلاص',
  'الفلق',
  'الناس',
];

const ayahCounts = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45,
  83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21,
  11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export const SURAHS: SurahInfo[] = names.map((name, index) => ({
  number: index + 1,
  name,
  ayahs: ayahCounts[index],
}));

export function surahInfo(number: number): SurahInfo {
  return SURAHS[number - 1] || SURAHS[0];
}

export function nextQuranPoint(point: {
  surah: number;
  ayah: number;
}): { surah: number; ayah: number } | null {
  if (point.ayah < surahInfo(point.surah).ayahs)
    return { surah: point.surah, ayah: point.ayah + 1 };
  return point.surah < SURAHS.length
    ? { surah: point.surah + 1, ayah: 1 }
    : null;
}

export function nextReverseQuranPoint(point: {
  surah: number;
  ayah: number;
}): { surah: number; ayah: number } | null {
  if (point.ayah < surahInfo(point.surah).ayahs)
    return { surah: point.surah, ayah: point.ayah + 1 };
  return point.surah > 1 ? { surah: point.surah - 1, ayah: 1 } : null;
}

export function formatQuranRange(range: {
  direction?: 'forward' | 'backward';
  range_type: 'surah_ayah' | 'page';
  from_surah?: number | null;
  from_ayah?: number | null;
  to_surah?: number | null;
  to_ayah?: number | null;
  from_page?: number | null;
  to_page?: number | null;
}) {
  const suffix = range.direction === 'backward' ? ' (عكسي)' : '';
  if (range.range_type === 'page') {
    return range.from_page === range.to_page
      ? `صفحة ${range.from_page}${suffix}`
      : `صفحات ${range.from_page}–${range.to_page}${suffix}`;
  }
  const fromName = surahInfo(range.from_surah || 1).name;
  const toName = surahInfo(range.to_surah || range.from_surah || 1).name;
  if (range.from_surah === range.to_surah) {
    return `${fromName} ${range.from_ayah}–${range.to_ayah}${suffix}`;
  }
  return `${fromName} ${range.from_ayah} ← ${toName} ${range.to_ayah}${suffix}`;
}

export const QUALITY_OPTIONS = [
  { value: 5, label: 'ممتاز' },
  { value: 4, label: 'جيد جداً' },
  { value: 3, label: 'جيد' },
  { value: 2, label: 'مقبول' },
  { value: 1, label: 'يحتاج متابعة' },
] as const;

export type QualityOption = { value: number; label: string };
