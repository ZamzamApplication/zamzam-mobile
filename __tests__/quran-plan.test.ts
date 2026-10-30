import {
  formatCompactPlanRange,
  formatPlanRange,
  generateQuranPlan,
  quranHizbForPoint,
  quranHizbStartPoint,
  quranJuzStartPoint,
  quranPageEndPoint,
  quranPageForPoint,
  quranPageStartPoint,
  quranQuarterEndPoint,
  quranQuarterForPoint,
  quranQuarterStartPoint,
  quranSurahEndPoint,
  type QuranPlanTrack,
} from '../src/quran-plan';
import { QURAN_QUARTER_STARTS } from '../src/quran-quarter-data';

function quranTrack(
  id: string,
  start: { surah: number; ayah: number },
  dailyAmount: number,
  unit: QuranPlanTrack['unit'] = 'ayahs',
): QuranPlanTrack {
  return {
    id,
    name: id,
    enabled: true,
    kind: 'quran',
    start,
    unit,
    dailyAmount,
    subject: '',
    quantityUnit: 'صفحة',
    startNumber: 1,
  };
}

describe('Quran plan generation', () => {
  it('supports the named Hifz units', () => {
    const plan = generateQuranPlan({
      startDate: '2026-01-04',
      endDate: '2026-01-04',
      weekdays: [0],
      tracks: [
        quranTrack('memorization', { surah: 1, ayah: 1 }, 1, 'half_page'),
      ],
    });
    expect(plan.days[0].assignments.memorization?.unit).toBe('half_page');
    expect(plan.days[0].assignments.memorization?.unitAmount).toBe(1);
    expect(plan.days[0].assignments.memorization?.ayahCount).toBeGreaterThan(0);
  });
  it('maps page, juz, quarter, and hizb starts to Quran points', () => {
    expect(quranPageStartPoint(2)).toEqual({ surah: 2, ayah: 1 });
    expect(quranPageForPoint({ surah: 2, ayah: 5 })).toBe(2);
    expect(quranJuzStartPoint(2)).toEqual({ surah: 2, ayah: 142 });
    expect(quranQuarterStartPoint(2, 3)).toEqual({ surah: 2, ayah: 177 });
    expect(quranQuarterForPoint({ surah: 2, ayah: 177 })).toEqual({
      juz: 2,
      quarter: 3,
    });
    expect(quranHizbStartPoint(2, 2)).toEqual({ surah: 2, ayah: 203 });
    expect(quranHizbForPoint({ surah: 2, ayah: 203 })).toEqual({
      juz: 2,
      hizb: 2,
    });
  });
  it('allocates complete mushaf pages when page is the selected unit', () => {
    const plan = generateQuranPlan({
      startDate: '2026-01-04',
      endDate: '2026-01-04',
      weekdays: [0],
      tracks: [quranTrack('memorization', quranPageStartPoint(2), 1, 'page')],
    });
    expect(plan.days[0].assignments.memorization?.from).toEqual({
      surah: 2,
      ayah: 1,
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 2,
      ayah: 5,
    });
    expect(plan.days[0].assignments.memorization?.unit).toBe('page');
  });
  it('allocates complete surahs when surah is the selected unit', () => {
    const plan = generateQuranPlan({
      startDate: '2026-01-04',
      endDate: '2026-01-05',
      weekdays: [0, 1],
      tracks: [quranTrack('memorization', { surah: 2, ayah: 1 }, 2, 'surah')],
    });
    expect(plan.days[0].assignments.memorization?.from).toEqual({
      surah: 2,
      ayah: 1,
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 3,
      ayah: 200,
    });
    expect(plan.days[0].assignments.memorization?.unit).toBe('surah');
    expect(plan.days[0].assignments.memorization?.unitAmount).toBe(2);
    expect(plan.days[0].assignments.memorization?.text).toBe(
      'من سورة البقرة إلى سورة آل عمران',
    );
    expect(plan.days[1].assignments.memorization?.from).toEqual({
      surah: 4,
      ayah: 1,
    });
  });
  it('labels juz assignments without ayah numbers', () => {
    const plan = generateQuranPlan({
      startDate: '2026-01-04',
      endDate: '2026-01-04',
      weekdays: [0],
      tracks: [quranTrack('memorization', quranJuzStartPoint(2), 1, 'juz')],
    });
    expect(plan.days[0].assignments.memorization?.text).toBe('الجزء 2');
  });
  it('allocates inclusive daily ayah ranges across surahs', () => {
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 2],
      tracks: [quranTrack('memorization', { surah: 1, ayah: 6 }, 3)],
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 2,
      ayah: 1,
    });
    expect(plan.days[1].isStudyDay).toBe(false);
    expect(plan.days[2].assignments.memorization?.from).toEqual({
      surah: 2,
      ayah: 2,
    });
    expect(plan.totals.memorization.ayahs).toBe(6);
  });

  it('generates any number of independent tracks', () => {
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-16',
      weekdays: [0],
      tracks: [
        quranTrack('memorization', { surah: 2, ayah: 1 }, 5),
        quranTrack('revision', { surah: 3, ayah: 10 }, 20),
        quranTrack('listening', { surah: 4, ayah: 1 }, 3),
      ],
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 2,
      ayah: 5,
    });
    expect(plan.days[0].assignments.revision?.to).toEqual({
      surah: 3,
      ayah: 29,
    });
    expect(plan.days[0].assignments.listening?.to).toEqual({
      surah: 4,
      ayah: 3,
    });
  });

  it('generates sequential non-Quran assignments such as book pages', () => {
    const book: QuranPlanTrack = {
      ...quranTrack('reading', { surah: 1, ayah: 1 }, 10),
      name: 'قراءة',
      kind: 'quantity',
      subject: 'كتاب الرحيق المختوم',
      quantityUnit: 'صفحة',
      startNumber: 21,
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-17',
      weekdays: [0, 1],
      tracks: [book],
    });
    expect(plan.days[0].assignments.reading?.text).toContain(
      'من صفحة 21 إلى 30',
    );
    expect(plan.days[1].assignments.reading?.text).toContain(
      'من صفحة 31 إلى 40',
    );
    expect(plan.totals.reading.amount).toBe(20);
    expect(plan.totals.reading.endNumber).toBe(40);
  });

  it('finishes bounded books and continues with the next book', () => {
    const books: QuranPlanTrack = {
      ...quranTrack('books', { surah: 1, ayah: 1 }, 4),
      name: 'قراءة',
      kind: 'quantity',
      quantityUnit: 'صفحة',
      startNumber: 1,
      items: [
        { id: 'book-1', name: 'الكتاب الأول', totalUnits: 5 },
        { id: 'book-2', name: 'الكتاب الثاني', totalUnits: 4 },
      ],
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-19',
      weekdays: [0, 1, 2, 3],
      tracks: [books],
    });
    expect(plan.days[1].assignments.books?.text).toContain(
      'الكتاب الأول — صفحة 5',
    );
    expect(plan.days[1].assignments.books?.text).toContain(
      'الكتاب الثاني — من صفحة 1 إلى 3',
    );
    expect(plan.days[2].assignments.books?.text).toContain(
      'الكتاب الثاني — صفحة 4',
    );
    expect(plan.days[3].assignments.books).toBeNull();
    expect(plan.totals.books.amount).toBe(9);
  });

  it('uses the configured start page for each book', () => {
    const books: QuranPlanTrack = {
      ...quranTrack('books', { surah: 1, ayah: 1 }, 3),
      name: 'قراءة',
      kind: 'quantity',
      quantityUnit: 'صفحة',
      startNumber: 1,
      items: [
        { id: 'book-1', name: 'الكتاب الأول', startUnit: 4, totalUnits: 5 },
        { id: 'book-2', name: 'الكتاب الثاني', startUnit: 10, totalUnits: 14 },
      ],
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 1, 2],
      tracks: [books],
    });
    expect(plan.days[0].assignments.books?.text).toContain(
      'الكتاب الأول — من صفحة 4 إلى 5',
    );
    expect(plan.days[0].assignments.books?.text).toContain(
      'الكتاب الثاني — صفحة 10',
    );
    expect(plan.days[1].assignments.books?.text).toContain(
      'الكتاب الثاني — من صفحة 11 إلى 13',
    );
  });

  it('sequences YouTube playlists and includes an episode link for every assignment', () => {
    const playlists: QuranPlanTrack = {
      ...quranTrack('lessons', { surah: 1, ayah: 1 }, 2),
      name: 'مشاهدة',
      kind: 'playlist',
      items: [
        {
          id: 'series-1',
          name: 'السلسلة الأولى',
          totalUnits: 2,
          url: 'https://www.youtube.com/playlist?list=PL123',
          episodes: [
            { title: 'الأولى', url: 'https://youtube.com/watch?v=one' },
            { title: 'الثانية', url: 'https://youtube.com/watch?v=two' },
          ],
        },
        {
          id: 'series-2',
          name: 'السلسلة الثانية',
          totalUnits: 2,
          url: 'https://www.youtube.com/playlist?list=PL456',
          episodes: [
            { title: 'الثالثة', url: 'https://youtube.com/watch?v=three' },
            { title: 'الرابعة', url: 'https://youtube.com/watch?v=four' },
          ],
        },
      ],
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 1, 2],
      tracks: [playlists],
    });
    expect(plan.days[0].assignments.lessons?.links).toHaveLength(2);
    expect(plan.days[0].assignments.lessons?.links?.[0].label).toBe('مقطع 1');
    expect(plan.days[0].assignments.lessons?.links?.[1].label).toBe('مقطع 2');
    expect(plan.days[0].assignments.lessons?.links?.[1].url).toBe(
      'https://youtube.com/watch?v=two',
    );
    expect(plan.days[1].assignments.lessons?.text).toContain('السلسلة الثانية');
    expect(plan.days[2].assignments.lessons).toBeNull();
  });

  it('stops safely at the end of the Mushaf', () => {
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 1, 2],
      tracks: [quranTrack('memorization', { surah: 114, ayah: 5 }, 5)],
    });
    expect(plan.days[0].assignments.memorization?.ayahCount).toBe(2);
    expect(plan.days[0].assignments.memorization?.completedMushaf).toBe(true);
    expect(plan.days[1].assignments.memorization).toBeNull();
  });

  it('can restart a cyclic Quran entry after finishing the Mushaf', () => {
    const track = {
      ...quranTrack('revision', { surah: 114, ayah: 5 }, 5),
      cyclic: true,
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-17',
      weekdays: [0, 1],
      tracks: [track],
    });
    expect(plan.days[0].assignments.revision?.completedMushaf).toBe(true);
    expect(plan.days[1].assignments.revision?.from).toEqual({
      surah: 1,
      ayah: 1,
    });
  });

  it('restarts a cyclic Quran entry within the student Hifz range', () => {
    const track = {
      ...quranTrack('revision', { surah: 2, ayah: 1 }, 2),
      cyclic: true,
      hifzStart: { surah: 2, ayah: 1 },
      hifzEnd: { surah: 2, ayah: 3 },
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 1, 2],
      tracks: [track],
    });
    expect(plan.days[0].assignments.revision?.from).toEqual({
      surah: 2,
      ayah: 1,
    });
    expect(plan.days[0].assignments.revision?.to).toEqual({
      surah: 2,
      ayah: 2,
    });
    expect(plan.days[1].assignments.revision?.from).toEqual({
      surah: 2,
      ayah: 3,
    });
    expect(plan.days[1].assignments.revision?.to).toEqual({
      surah: 2,
      ayah: 3,
    });
    expect(plan.days[2].assignments.revision?.from).toEqual({
      surah: 2,
      ayah: 1,
    });
  });

  it('stops a Quran entry at the configured Hifz end when repetition is disabled', () => {
    const hifzStart = quranQuarterStartPoint(1, 1);
    const hifzEnd = quranQuarterEndPoint(1, 1);
    const track = {
      ...quranTrack('memorization', hifzStart, 2, 'quarter'),
      hifzStart,
      hifzEnd,
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-17',
      weekdays: [0, 1],
      tracks: [track],
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual(hifzEnd);
    expect(plan.days[1].assignments.memorization).toBeNull();
  });

  it('sequences Quran Werds and allows each Werd to use its own unit', () => {
    const sequenceId = 'hifz-sequence';
    const first = {
      ...quranTrack('first', { surah: 2, ayah: 1 }, 1),
      hifzEnd: { surah: 2, ayah: 1 },
      quranSequenceId: sequenceId,
    };
    const secondStart = quranQuarterStartPoint(1, 1);
    const second = {
      ...quranTrack('second', secondStart, 1, 'quarter'),
      hifzEnd: quranQuarterEndPoint(1, 1),
      quranSequenceId: sequenceId,
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-18',
      weekdays: [0, 1, 2],
      tracks: [first, second],
    });
    expect(plan.tracks.map(track => track.id)).toEqual(['first']);
    expect(plan.days[0].assignments.first?.to).toEqual({ surah: 2, ayah: 1 });
    expect(plan.days[1].assignments.first?.unit).toBe('quarter');
    expect(plan.days[1].assignments.second).toBeUndefined();
    expect(plan.days[2].assignments.first).toBeNull();
  });

  it('loops an entire Quran Werd sequence while preserving each Werd unit', () => {
    const sequenceId = 'looping-hifz-sequence';
    const pages = {
      ...quranTrack('pages', quranPageStartPoint(2), 1, 'page'),
      hifzEnd: quranPageEndPoint(2),
      quranSequenceId: sequenceId,
      quranSequenceCyclic: true,
    };
    const surahs = {
      ...quranTrack('surahs', { surah: 3, ayah: 1 }, 1, 'surah'),
      hifzEnd: quranSurahEndPoint(3),
      quranSequenceId: sequenceId,
      quranSequenceCyclic: true,
    };
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-19',
      weekdays: [0, 1, 2, 3],
      tracks: [pages, surahs],
    });
    expect(plan.days.map(day => day.assignments.pages?.unit)).toEqual([
      'page',
      'surah',
      'page',
      'surah',
    ]);
    expect(plan.days[0].assignments.pages?.from).toEqual(
      quranPageStartPoint(2),
    );
    expect(plan.days[2].assignments.pages?.from).toEqual(
      quranPageStartPoint(2),
    );
    expect(plan.days[1].assignments.pages?.from).toEqual({ surah: 3, ayah: 1 });
    expect(plan.days[3].assignments.pages?.from).toEqual({ surah: 3, ayah: 1 });
  });

  it('uses the offline Madani Mushaf mapping for line-based plans', () => {
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-16',
      weekdays: [0],
      tracks: [quranTrack('memorization', { surah: 1, ayah: 3 }, 2, 'lines')],
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 1,
      ayah: 6,
    });
    expect(plan.days[0].assignments.memorization?.unitAmount).toBe(2);
  });

  it('uses all 240 canonical starts for quarter-based plans', () => {
    expect(QURAN_QUARTER_STARTS).toHaveLength(240);
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-17',
      weekdays: [0, 1],
      tracks: [quranTrack('memorization', { surah: 1, ayah: 1 }, 1, 'quarter')],
    });
    expect(plan.days[0].assignments.memorization?.to).toEqual({
      surah: 2,
      ayah: 25,
    });
    expect(plan.days[1].assignments.memorization?.from).toEqual({
      surah: 2,
      ayah: 26,
    });
    expect(plan.days[1].assignments.memorization?.to).toEqual({
      surah: 2,
      ayah: 43,
    });
  });

  it('defines a hizb as 4 quarters and a juz as 8 quarters', () => {
    const plan = generateQuranPlan({
      startDate: '2026-08-16',
      endDate: '2026-08-16',
      weekdays: [0],
      tracks: [
        quranTrack('hizb', { surah: 1, ayah: 1 }, 1, 'hizb'),
        quranTrack('juz', { surah: 1, ayah: 1 }, 1, 'juz'),
      ],
    });
    expect(plan.days[0].assignments.hizb?.to).toEqual({ surah: 2, ayah: 74 });
    expect(plan.days[0].assignments.juz?.to).toEqual({ surah: 2, ayah: 141 });
  });

  it('formats single and cross-surah ranges clearly', () => {
    expect(formatPlanRange({ surah: 1, ayah: 1 }, { surah: 1, ayah: 3 })).toBe(
      'سورة الفاتحة — ١ : ٣',
    );
    expect(formatPlanRange({ surah: 1, ayah: 7 }, { surah: 2, ayah: 2 })).toBe(
      'سورة الفاتحة ٧ ← سورة البقرة ٢',
    );
  });

  it('formats copied ranges compactly with Arabic ayah numbers', () => {
    expect(
      formatCompactPlanRange({ surah: 28, ayah: 25 }, { surah: 28, ayah: 26 }),
    ).toBe('سورة القصص: ٢٥ : ٢٦');
    expect(
      formatCompactPlanRange({ surah: 1, ayah: 7 }, { surah: 2, ayah: 2 }),
    ).toBe('سورة الفاتحة: ٧ ← سورة البقرة: ٢');
  });
});
