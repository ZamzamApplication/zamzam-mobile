import {
  SURAHS,
  surahInfo,
  nextQuranPoint,
  nextReverseQuranPoint,
} from './quran';
import { QURAN_LINE_END_OFFSETS_BASE64 } from './quran-line-data';
import { QURAN_PAGE_START_OFFSETS_BASE64 } from './quran-page-data';
import { QURAN_QUARTER_STARTS } from './quran-quarter-data';

export type QuranPoint = { surah: number; ayah: number };
export type QuranPlanUnit =
  | 'ayahs'
  | 'lines'
  | 'surah'
  | 'juz'
  | 'hizb'
  | 'quarter'
  | 'page'
  | 'half_page';
export type QuranPlanSequenceItem = {
  id: string;
  name: string;
  totalUnits: number;
  startUnit?: number;
  url?: string;
  episodes?: { title: string; url: string }[];
};
export type QuranPlanTrack = {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'quran' | 'quantity' | 'playlist';
  start: QuranPoint;
  unit: QuranPlanUnit;
  subject: string;
  quantityUnit: string;
  startNumber: number;
  dailyAmount: number;
  cyclic?: boolean;
  hifzStart?: QuranPoint;
  hifzEnd?: QuranPoint;
  quranSequenceId?: string;
  quranSequenceCyclic?: boolean;
  items?: QuranPlanSequenceItem[];
  /** Active weekdays (0=Sunday..6=Saturday) for this content. Undefined = follow the plan's global days. */
  weekdays?: number[];
};
export type QuranPlanInput = {
  startDate: string;
  endDate: string;
  weekdays: number[];
  tracks: QuranPlanTrack[];
};
export type QuranAssignment = {
  from: QuranPoint | null;
  to: QuranPoint | null;
  fromNumber: number | null;
  toNumber: number | null;
  ayahCount: number;
  unit: QuranPlanUnit | 'quantity';
  unitAmount: number;
  text: string;
  completedMushaf: boolean;
  completedRange?: boolean;
  segments?: { from: QuranPoint; to: QuranPoint }[];
  links?: { label: string; url: string }[];
};
export type QuranPlanDay = {
  date: string;
  weekday: number;
  isStudyDay: boolean;
  assignments: Record<string, QuranAssignment | null>;
  /** Per-content pause flags: true means this content rests on this day (shows راحة). */
  paused?: Record<string, boolean>;
};
export type QuranPlanTrackTotal = {
  ayahs: number;
  amount: number;
  end: QuranPoint | null;
  endNumber: number | null;
};
export type GeneratedQuranPlan = {
  tracks: QuranPlanTrack[];
  days: QuranPlanDay[];
  studyDays: number;
  totals: Record<string, QuranPlanTrackTotal>;
};

const LAST_POINT: QuranPoint = { surah: 114, ayah: surahInfo(114).ayahs };
let lineEndOffsets: number[] | null = null;
let pageStartOffsets: number[] | null = null;

export const QURAN_PAGE_COUNT = 604;
export const QURAN_JUZ_COUNT = 30;
export const QURAN_QUARTERS_PER_JUZ = 8;
export const QURAN_HIZBS_PER_JUZ = 2;

function decodeOffsets(encoded: string): number[] {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let bits = 0,
    buffer = 0;
  for (const char of encoded) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
    }
  }
  return Array.from(
    { length: bytes.length / 2 },
    (_, index) => bytes[index * 2] | (bytes[index * 2 + 1] << 8),
  );
}

function quranLineEndOffsets(): number[] {
  if (lineEndOffsets) return lineEndOffsets;
  lineEndOffsets = decodeOffsets(QURAN_LINE_END_OFFSETS_BASE64);
  return lineEndOffsets;
}

function quranPageStartOffsets(): number[] {
  if (pageStartOffsets) return pageStartOffsets;
  pageStartOffsets = decodeOffsets(QURAN_PAGE_START_OFFSETS_BASE64);
  return pageStartOffsets;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function isoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidQuranPoint(point: QuranPoint): boolean {
  return (
    point.surah >= 1 &&
    point.surah <= SURAHS.length &&
    point.ayah >= 1 &&
    point.ayah <= surahInfo(point.surah).ayahs
  );
}

function nextPoint(point: QuranPoint): QuranPoint | null {
  return nextQuranPoint(point);
}

export function quranNextPoint(point: QuranPoint): QuranPoint | null {
  return nextPoint(point);
}

export function quranNextReversePoint(point: QuranPoint): QuranPoint | null {
  return nextReverseQuranPoint(point);
}

function reverseOrder(point: QuranPoint): number {
  // Surahs descend, while verses within each surah ascend.
  return (SURAHS.length - point.surah) * 1000 + point.ayah;
}

export function isReverseQuranTrack(track: QuranPlanTrack): boolean {
  return (
    track.kind === 'quran' &&
    track.hifzEnd !== undefined &&
    track.start.surah > track.hifzEnd.surah
  );
}

export function quranPlanStopPoint(track: QuranPlanTrack): QuranPoint {
  const stop = track.hifzEnd ?? LAST_POINT;
  if (!isReverseQuranTrack(track)) return stop;
  const firstQuarter = quranQuarterForPoint(stop);
  if (
    track.unit === 'quarter' &&
    firstQuarter.juz === 1 &&
    firstQuarter.quarter === 1
  )
    return quranSurahEndPoint(1);
  if (
    track.unit === 'hizb' &&
    firstQuarter.juz === 1 &&
    firstQuarter.quarter <= 4
  )
    return quranSurahEndPoint(1);
  if (track.unit === 'juz' && firstQuarter.juz === 1)
    return quranSurahEndPoint(1);
  return stop;
}

function globalOffset(point: QuranPoint): number {
  let offset = point.ayah;
  for (let surah = 1; surah < point.surah; surah += 1)
    offset += surahInfo(surah).ayahs;
  return offset;
}

export function pointAtOffset(offset: number): QuranPoint {
  let remaining = offset;
  for (const surah of SURAHS) {
    if (remaining <= surah.ayahs)
      return { surah: surah.number, ayah: remaining };
    remaining -= surah.ayahs;
  }
  return LAST_POINT;
}

const quranQuarterStartOffsets = QURAN_QUARTER_STARTS.map(([surah, ayah]) =>
  globalOffset({ surah, ayah }),
);

function lastBoundaryAtOrBefore(offsets: number[], offset: number): number {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= offset) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

export function quranPageStartPoint(page: number): QuranPoint {
  const safePage = Math.min(QURAN_PAGE_COUNT, Math.max(1, Math.trunc(page)));
  return pointAtOffset(quranPageStartOffsets()[safePage - 1]);
}

export function quranPageForPoint(point: QuranPoint): number {
  return (
    lastBoundaryAtOrBefore(quranPageStartOffsets(), globalOffset(point)) + 1
  );
}

export function quranQuarterStartPoint(
  juz: number,
  quarter: number,
): QuranPoint {
  const safeJuz = Math.min(QURAN_JUZ_COUNT, Math.max(1, Math.trunc(juz)));
  const safeQuarter = Math.min(
    QURAN_QUARTERS_PER_JUZ,
    Math.max(1, Math.trunc(quarter)),
  );
  return pointAtOffset(
    quranQuarterStartOffsets[
      (safeJuz - 1) * QURAN_QUARTERS_PER_JUZ + safeQuarter - 1
    ],
  );
}

export function quranQuarterEndPoint(juz: number, quarter: number): QuranPoint {
  const safeJuz = Math.min(QURAN_JUZ_COUNT, Math.max(1, Math.trunc(juz)));
  const safeQuarter = Math.min(
    QURAN_QUARTERS_PER_JUZ,
    Math.max(1, Math.trunc(quarter)),
  );
  const index = (safeJuz - 1) * QURAN_QUARTERS_PER_JUZ + safeQuarter - 1;
  const nextStart =
    index + 1 < quranQuarterStartOffsets.length
      ? quranQuarterStartOffsets[index + 1]
      : globalOffset(LAST_POINT) + 1;
  return pointAtOffset(nextStart - 1);
}

export function quranQuarterForPoint(point: QuranPoint): {
  juz: number;
  quarter: number;
} {
  const index = lastBoundaryAtOrBefore(
    quranQuarterStartOffsets,
    globalOffset(point),
  );
  return {
    juz: Math.floor(index / QURAN_QUARTERS_PER_JUZ) + 1,
    quarter: (index % QURAN_QUARTERS_PER_JUZ) + 1,
  };
}

export function quranHizbStartPoint(juz: number, hizb: number): QuranPoint {
  const safeHizb = Math.min(QURAN_HIZBS_PER_JUZ, Math.max(1, Math.trunc(hizb)));
  return quranQuarterStartPoint(juz, (safeHizb - 1) * 4 + 1);
}

export function quranHizbEndPoint(juz: number, hizb: number): QuranPoint {
  const safeHizb = Math.min(QURAN_HIZBS_PER_JUZ, Math.max(1, Math.trunc(hizb)));
  return quranQuarterEndPoint(juz, safeHizb * 4);
}

export function quranHizbForPoint(point: QuranPoint): {
  juz: number;
  hizb: number;
} {
  const { juz, quarter } = quranQuarterForPoint(point);
  return { juz, hizb: Math.floor((quarter - 1) / 4) + 1 };
}

export function quranJuzStartPoint(juz: number): QuranPoint {
  return quranQuarterStartPoint(juz, 1);
}

export function quranJuzEndPoint(juz: number): QuranPoint {
  return quranQuarterEndPoint(juz, QURAN_QUARTERS_PER_JUZ);
}

export function quranSurahStartPoint(surah: number): QuranPoint {
  const safeSurah = Math.min(SURAHS.length, Math.max(1, Math.trunc(surah)));
  return { surah: safeSurah, ayah: 1 };
}

export function quranSurahEndPoint(surah: number): QuranPoint {
  const safeSurah = Math.min(SURAHS.length, Math.max(1, Math.trunc(surah)));
  return { surah: safeSurah, ayah: surahInfo(safeSurah).ayahs };
}

function quranPageEndOffset(pageIndex: number): number {
  const starts = quranPageStartOffsets();
  return pageIndex + 1 < starts.length
    ? starts[pageIndex + 1] - 1
    : globalOffset(LAST_POINT);
}

export function quranPageEndPoint(page: number): QuranPoint {
  const safePage = Math.min(QURAN_PAGE_COUNT, Math.max(1, Math.trunc(page)));
  return pointAtOffset(quranPageEndOffset(safePage - 1));
}

const arabicAyahNumber = new Intl.NumberFormat('ar-EG', { useGrouping: false });

function mushafAyahMarker(ayah: number): string {
  return arabicAyahNumber.format(ayah);
}

export function formatPlanRange(from: QuranPoint, to: QuranPoint): string {
  const fromAyah = mushafAyahMarker(from.ayah);
  const toAyah = mushafAyahMarker(to.ayah);
  if (from.surah === to.surah) {
    if (from.ayah === 1 && to.ayah === surahInfo(to.surah).ayahs)
      return `سورة ${surahInfo(from.surah).name}`;
    return from.ayah === to.ayah
      ? `سورة ${surahInfo(from.surah).name} — ${fromAyah}`
      : `سورة ${surahInfo(from.surah).name} — ${fromAyah} : ${toAyah}`;
  }
  const first = `سورة ${surahInfo(from.surah).name}${
    from.ayah === 1 ? '' : ` ${fromAyah}`
  }`;
  const last = `سورة ${surahInfo(to.surah).name}${
    to.ayah === surahInfo(to.surah).ayahs ? '' : ` ${toAyah}`
  }`;
  return `${first} ← ${last}`;
}

export function formatCompactPlanRange(
  from: QuranPoint,
  to: QuranPoint,
): string {
  const fromAyah = mushafAyahMarker(from.ayah);
  const toAyah = mushafAyahMarker(to.ayah);
  if (from.surah === to.surah) {
    if (from.ayah === 1 && to.ayah === surahInfo(to.surah).ayahs)
      return `سورة ${surahInfo(from.surah).name}`;
    return from.ayah === to.ayah
      ? `سورة ${surahInfo(from.surah).name}: ${fromAyah}`
      : `سورة ${surahInfo(from.surah).name}: ${fromAyah} : ${toAyah}`;
  }
  const first = `سورة ${surahInfo(from.surah).name}${
    from.ayah === 1 ? '' : `: ${fromAyah}`
  }`;
  const last = `سورة ${surahInfo(to.surah).name}${
    to.ayah === surahInfo(to.surah).ayahs ? '' : `: ${toAyah}`
  }`;
  return `${first} ← ${last}`;
}

function formatSurahRange(from: QuranPoint, to: QuranPoint): string {
  const first = surahInfo(from.surah).name;
  const last = surahInfo(to.surah).name;
  return from.surah === to.surah
    ? `سورة ${first}`
    : `من سورة ${first} إلى سورة ${last}`;
}

function formatJuzRange(from: QuranPoint, to: QuranPoint): string {
  const first = quranQuarterForPoint(from).juz;
  const last = quranQuarterForPoint(to).juz;
  return first === last
    ? `الجزء ${first}`
    : `من الجزء ${first} إلى الجزء ${last}`;
}

function allocateAyahs(
  start: QuranPoint,
  requestedAyahs: number,
  maximumEnd: QuranPoint = LAST_POINT,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  let end = start;
  let count = 1;
  while (count < requestedAyahs) {
    const following = nextPoint(end);
    if (!following || globalOffset(following) > globalOffset(maximumEnd)) break;
    end = following;
    count += 1;
  }
  const next =
    globalOffset(end) >= globalOffset(maximumEnd) ? null : nextPoint(end);
  return {
    assignment: {
      from: start,
      to: end,
      fromNumber: null,
      toNumber: null,
      ayahCount: count,
      unit: 'ayahs',
      unitAmount: count,
      text: formatPlanRange(start, end),
      completedMushaf:
        next === null && globalOffset(end) === globalOffset(LAST_POINT),
    },
    next,
  };
}

function allocateLines(
  start: QuranPoint,
  requestedLines: number,
  maximumEnd: QuranPoint = LAST_POINT,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  const offsets = quranLineEndOffsets();
  const startOffset = globalOffset(start);
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] < startOffset) low = middle + 1;
    else high = middle;
  }
  const firstLine = Math.min(low, offsets.length - 1);
  const lastLine = Math.min(firstLine + requestedLines - 1, offsets.length - 1);
  const endOffset = Math.min(offsets[lastLine], globalOffset(maximumEnd));
  const end = pointAtOffset(endOffset);
  const next = endOffset >= globalOffset(maximumEnd) ? null : nextPoint(end);
  return {
    assignment: {
      from: start,
      to: end,
      fromNumber: null,
      toNumber: null,
      ayahCount: globalOffset(end) - startOffset + 1,
      unit: 'lines',
      unitAmount: lastLine - firstLine + 1,
      text: formatPlanRange(start, end),
      completedMushaf: next === null && endOffset === globalOffset(LAST_POINT),
    },
    next,
  };
}

function allocateQuarters(
  start: QuranPoint,
  requestedQuarters: number,
  maximumEnd: QuranPoint = LAST_POINT,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  const startOffset = globalOffset(start);
  let low = 0;
  let high = quranQuarterStartOffsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (quranQuarterStartOffsets[middle] <= startOffset) low = middle + 1;
    else high = middle;
  }

  const followingBoundaryIndex = low + requestedQuarters - 1;
  const requestedEndOffset =
    followingBoundaryIndex < quranQuarterStartOffsets.length
      ? quranQuarterStartOffsets[followingBoundaryIndex] - 1
      : globalOffset(LAST_POINT);
  const endOffset = Math.min(requestedEndOffset, globalOffset(maximumEnd));
  const end = pointAtOffset(endOffset);
  const next = endOffset >= globalOffset(maximumEnd) ? null : nextPoint(end);
  const firstQuarterIndex = Math.max(0, low - 1);
  const lastQuarterIndex = lastBoundaryAtOrBefore(
    quranQuarterStartOffsets,
    endOffset,
  );
  const quarterAmount = Math.max(1, lastQuarterIndex - firstQuarterIndex + 1);
  return {
    assignment: {
      from: start,
      to: end,
      fromNumber: null,
      toNumber: null,
      ayahCount: endOffset - startOffset + 1,
      unit: 'quarter',
      unitAmount: quarterAmount,
      text: formatPlanRange(start, end),
      completedMushaf: next === null && endOffset === globalOffset(LAST_POINT),
    },
    next,
  };
}

function allocatePages(
  start: QuranPoint,
  requestedPages: number,
  maximumEnd: QuranPoint = LAST_POINT,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  const startOffset = globalOffset(start);
  const starts = quranPageStartOffsets();
  const firstPage = lastBoundaryAtOrBefore(starts, startOffset);
  const lastPage = Math.min(firstPage + requestedPages - 1, starts.length - 1);
  const endOffset = Math.min(
    quranPageEndOffset(lastPage),
    globalOffset(maximumEnd),
  );
  const end = pointAtOffset(endOffset);
  const next = endOffset >= globalOffset(maximumEnd) ? null : nextPoint(end);
  return {
    assignment: {
      from: start,
      to: end,
      fromNumber: null,
      toNumber: null,
      ayahCount: endOffset - startOffset + 1,
      unit: 'page',
      unitAmount: lastPage - firstPage + 1,
      text: formatPlanRange(start, end),
      completedMushaf: next === null && endOffset === globalOffset(LAST_POINT),
    },
    next,
  };
}

function allocateSurahs(
  start: QuranPoint,
  requestedSurahs: number,
  maximumEnd: QuranPoint = LAST_POINT,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  const lastSurah = Math.min(
    start.surah + requestedSurahs - 1,
    maximumEnd.surah,
  );
  const end =
    lastSurah === maximumEnd.surah ? maximumEnd : quranSurahEndPoint(lastSurah);
  const next =
    globalOffset(end) >= globalOffset(maximumEnd) ? null : nextPoint(end);
  return {
    assignment: {
      from: start,
      to: end,
      fromNumber: null,
      toNumber: null,
      ayahCount: globalOffset(end) - globalOffset(start) + 1,
      unit: 'surah',
      unitAmount: lastSurah - start.surah + 1,
      text: formatSurahRange(start, end),
      completedMushaf:
        next === null && globalOffset(end) === globalOffset(LAST_POINT),
    },
    next,
  };
}

function allocate(
  start: QuranPoint,
  track: QuranPlanTrack,
  maximumEnd: QuranPoint = LAST_POINT,
) {
  if (track.unit === 'ayahs')
    return allocateAyahs(start, track.dailyAmount, maximumEnd);
  if (track.unit === 'surah')
    return allocateSurahs(start, track.dailyAmount, maximumEnd);
  if (track.unit === 'page')
    return allocatePages(start, track.dailyAmount, maximumEnd);
  if (
    track.unit === 'quarter' ||
    track.unit === 'hizb' ||
    track.unit === 'juz'
  ) {
    const quartersPerUnit =
      track.unit === 'quarter' ? 1 : track.unit === 'hizb' ? 4 : 8;
    const result = allocateQuarters(
      start,
      track.dailyAmount * quartersPerUnit,
      maximumEnd,
    );
    return {
      ...result,
      assignment: {
        ...result.assignment,
        unit: track.unit,
        unitAmount: Math.ceil(result.assignment.unitAmount / quartersPerUnit),
        text:
          track.unit === 'juz'
            ? formatJuzRange(
                result.assignment.from as QuranPoint,
                result.assignment.to as QuranPoint,
              )
            : result.assignment.text,
      },
    };
  }
  const lineAmount =
    track.unit === 'lines' ? track.dailyAmount : track.dailyAmount * 8;
  const result = allocateLines(start, lineAmount, maximumEnd);
  return {
    ...result,
    assignment: {
      ...result.assignment,
      unit: track.unit,
      unitAmount:
        track.unit === 'lines'
          ? result.assignment.unitAmount
          : Math.ceil(result.assignment.unitAmount / 8),
    },
  };
}

function firstLineAtOrAfter(offset: number): number {
  const lines = quranLineEndOffsets();
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle] < offset) low = middle + 1;
    else high = middle;
  }
  return Math.min(low, lines.length - 1);
}

function reverseSegmentAmount(
  from: QuranPoint,
  to: QuranPoint,
  unit: QuranPlanUnit,
): number {
  if (unit === 'ayahs') return to.ayah - from.ayah + 1;
  if (unit === 'surah') return 1;
  if (unit === 'page')
    return quranPageForPoint(to) - quranPageForPoint(from) + 1;
  const lineCount =
    firstLineAtOrAfter(globalOffset(to)) -
    firstLineAtOrAfter(globalOffset(from)) +
    1;
  if (unit === 'lines') return lineCount;
  if (unit === 'half_page') return Math.ceil(lineCount / 8);
  const firstQuarter = lastBoundaryAtOrBefore(
    quranQuarterStartOffsets,
    globalOffset(from),
  );
  const lastQuarter = lastBoundaryAtOrBefore(
    quranQuarterStartOffsets,
    globalOffset(to),
  );
  const quarters = lastQuarter - firstQuarter + 1;
  if (unit === 'quarter') return quarters;
  return Math.ceil(quarters / (unit === 'hizb' ? 4 : 8));
}

function allocateReverse(
  start: QuranPoint,
  track: QuranPlanTrack,
  stop: QuranPoint,
): { assignment: QuranAssignment; next: QuranPoint | null } {
  const segments: { from: QuranPoint; to: QuranPoint }[] = [];
  let cursor: QuranPoint | null = start;
  let remaining = track.dailyAmount;
  let amount = 0;
  let ayahs = 0;
  let completedRange = false;

  while (cursor && remaining > 0) {
    const segmentEnd =
      cursor.surah === stop.surah ? stop : quranSurahEndPoint(cursor.surah);
    const result = allocate(
      cursor,
      { ...track, dailyAmount: remaining },
      segmentEnd,
    );
    const to = result.assignment.to as QuranPoint;
    const used = reverseSegmentAmount(cursor, to, track.unit);
    segments.push({ from: cursor, to });
    amount += used;
    ayahs += result.assignment.ayahCount;
    remaining -= used;
    completedRange = reverseOrder(to) >= reverseOrder(stop);
    cursor = completedRange ? null : result.next ?? quranNextReversePoint(to);
  }

  const first = segments[0];
  const last = segments[segments.length - 1];
  const text =
    track.unit === 'surah' &&
    first.from.ayah === 1 &&
    last.to.ayah === surahInfo(last.to.surah).ayahs
      ? formatSurahRange(first.from, last.to)
      : track.unit === 'juz'
      ? formatJuzRange(first.from, last.to)
      : formatPlanRange(first.from, last.to);

  return {
    assignment: {
      from: first.from,
      to: last.to,
      fromNumber: null,
      toNumber: null,
      ayahCount: ayahs,
      unit: track.unit,
      unitAmount: amount,
      text,
      completedMushaf:
        completedRange &&
        track.start.surah === SURAHS.length &&
        track.start.ayah === 1 &&
        stop.surah === 1 &&
        stop.ayah === surahInfo(1).ayahs,
      completedRange,
      segments,
    },
    next: cursor,
  };
}

function allocateQuantity(
  start: number,
  track: QuranPlanTrack,
): { assignment: QuranAssignment; next: number } {
  const end = start + track.dailyAmount - 1;
  const subject = track.subject.trim();
  const unit = track.quantityUnit.trim();
  return {
    assignment: {
      from: null,
      to: null,
      fromNumber: start,
      toNumber: end,
      ayahCount: 0,
      unit: 'quantity',
      unitAmount: track.dailyAmount,
      text:
        track.dailyAmount === 1
          ? `${subject} — ${unit} ${start}`
          : `${subject} — من ${unit} ${start} إلى ${end}`,
      completedMushaf: false,
    },
    next: end + 1,
  };
}

type SequenceCursor = { itemIndex: number; unitNumber: number } | null;

function sequenceItemStart(track: QuranPlanTrack, itemIndex: number): number {
  if (track.kind === 'playlist')
    return track.items?.[itemIndex]?.startUnit ?? 1;
  if (track.kind !== 'quantity') return 1;
  return (
    track.items?.[itemIndex]?.startUnit ??
    (itemIndex === 0 ? track.startNumber : 1)
  );
}

function youtubeEpisodeUrl(value: string, episode: number): string {
  try {
    let url = new URL(value.trim());
    const playlistId = url.searchParams.get('list');
    if (playlistId) {
      const episodeUrl = new URL('https://www.youtube.com/watch');
      episodeUrl.searchParams.set('list', playlistId);
      episodeUrl.searchParams.set('index', String(episode));
      return episodeUrl.toString();
    }
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      if (videoId) {
        url = new URL(
          `https://www.youtube.com/watch?${url.searchParams.toString()}`,
        );
        url.searchParams.set('v', videoId);
      }
    }
    url.searchParams.set('index', String(episode));
    return url.toString();
  } catch {
    return value.trim();
  }
}

function allocateSequence(
  cursor: SequenceCursor,
  track: QuranPlanTrack,
): { assignment: QuranAssignment | null; next: SequenceCursor } {
  if (!cursor || !track.items?.length) return { assignment: null, next: null };
  let itemIndex = cursor.itemIndex;
  let unitNumber = cursor.unitNumber;
  let remaining = track.dailyAmount;
  let allocated = 0;
  const parts: string[] = [];
  const links: { label: string; url: string }[] = [];
  let firstNumber: number | null = null;
  let lastNumber: number | null = null;

  while (remaining > 0 && itemIndex < track.items.length) {
    const item = track.items[itemIndex];
    const available = item.totalUnits - unitNumber + 1;
    if (available <= 0) {
      itemIndex += 1;
      unitNumber = sequenceItemStart(track, itemIndex);
      continue;
    }
    const count = Math.min(remaining, available);
    const endNumber = unitNumber + count - 1;
    if (firstNumber === null) firstNumber = unitNumber;
    lastNumber = endNumber;
    if (track.kind === 'playlist') {
      parts.push(
        count === 1
          ? item.episodes?.[unitNumber - 1]?.title
            ? `${item.name} — ${item.episodes[unitNumber - 1].title}`
            : `${item.name} — حلقة ${unitNumber}`
          : `${item.name} — حلقات ${unitNumber}–${endNumber}`,
      );
      for (let episode = unitNumber; episode <= endNumber; episode += 1) {
        const importedEpisode = item.episodes?.[episode - 1];
        links.push({
          label: `مقطع ${episode}`,
          url:
            importedEpisode?.url || youtubeEpisodeUrl(item.url || '', episode),
        });
      }
    } else {
      const unit = track.quantityUnit.trim();
      parts.push(
        count === 1
          ? `${item.name} — ${unit} ${unitNumber}`
          : `${item.name} — من ${unit} ${unitNumber} إلى ${endNumber}`,
      );
    }
    allocated += count;
    remaining -= count;
    unitNumber = endNumber + 1;
    if (unitNumber > item.totalUnits) {
      itemIndex += 1;
      unitNumber = sequenceItemStart(track, itemIndex);
    }
  }

  if (allocated === 0) return { assignment: null, next: null };
  return {
    assignment: {
      from: null,
      to: null,
      fromNumber: firstNumber,
      toNumber: lastNumber,
      ayahCount: 0,
      unit: 'quantity',
      unitAmount: allocated,
      text: parts.join(' · '),
      completedMushaf: false,
      links: links.length ? links : undefined,
    },
    next: itemIndex < track.items.length ? { itemIndex, unitNumber } : null,
  };
}

export function generateQuranPlan(input: QuranPlanInput): GeneratedQuranPlan {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  )
    throw new Error('invalid_date_range');
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const calendarDays = Math.floor((endUtc - startUtc) / 86_400_000) + 1;
  if (calendarDays > 730) throw new Error('plan_period_too_long');
  if (input.weekdays.length === 0) throw new Error('study_days_required');

  const enabledTracks = input.tracks.filter(track => track.enabled);
  const ids = new Set<string>();
  for (const track of enabledTracks) {
    const reverse = isReverseQuranTrack(track);
    const hifzStart =
      track.hifzStart ??
      (reverse ? { surah: 114, ayah: 1 } : { surah: 1, ayah: 1 });
    const hifzEnd = quranPlanStopPoint(track);
    const usesHifzRange =
      track.kind === 'quran' &&
      (track.cyclic ||
        track.hifzStart !== undefined ||
        track.hifzEnd !== undefined);
    const invalidHifzRange =
      usesHifzRange &&
      (!isValidQuranPoint(hifzStart) ||
        !isValidQuranPoint(hifzEnd) ||
        (reverse
          ? reverseOrder(hifzStart) > reverseOrder(hifzEnd) ||
            reverseOrder(track.start) > reverseOrder(hifzEnd) ||
            (track.cyclic &&
              reverseOrder(track.start) < reverseOrder(hifzStart))
          : globalOffset(hifzStart) > globalOffset(hifzEnd) ||
            globalOffset(track.start) > globalOffset(hifzEnd) ||
            (track.cyclic &&
              globalOffset(track.start) < globalOffset(hifzStart))));
    const invalidQuran =
      track.kind === 'quran' &&
      (!isValidQuranPoint(track.start) ||
        ![
          'ayahs',
          'lines',
          'surah',
          'juz',
          'hizb',
          'quarter',
          'page',
          'half_page',
        ].includes(track.unit));
    const hasSequence =
      (track.kind === 'quantity' || track.kind === 'playlist') &&
      track.items !== undefined;
    const invalidSequence =
      hasSequence &&
      (!track.items?.length ||
        track.items.some(
          (item, itemIndex) =>
            !item.id.trim() ||
            !item.name.trim() ||
            !Number.isInteger(item.totalUnits) ||
            item.totalUnits < 1 ||
            (track.kind === 'quantity' &&
              (!Number.isInteger(sequenceItemStart(track, itemIndex)) ||
                sequenceItemStart(track, itemIndex) < 1 ||
                sequenceItemStart(track, itemIndex) > item.totalUnits)) ||
            (track.kind === 'playlist' &&
              (!item.url?.trim() ||
                !item.episodes?.length ||
                item.episodes.length !== item.totalUnits ||
                !Number.isInteger(sequenceItemStart(track, itemIndex)) ||
                sequenceItemStart(track, itemIndex) < 1 ||
                sequenceItemStart(track, itemIndex) > item.totalUnits)),
        ));
    const invalidLegacyQuantity =
      track.kind === 'quantity' &&
      !hasSequence &&
      (!track.subject.trim() ||
        !track.quantityUnit.trim() ||
        !Number.isInteger(track.startNumber) ||
        track.startNumber < 1);
    const invalidPlaylist = track.kind === 'playlist' && !hasSequence;
    const invalidWeekdays =
      track.weekdays !== undefined &&
      (!Array.isArray(track.weekdays) ||
        track.weekdays.some(
          day => !Number.isInteger(day) || day < 0 || day > 6,
        ));
    if (invalidHifzRange) throw new Error('invalid_hifz_range');
    if (
      !track.id.trim() ||
      ids.has(track.id) ||
      !track.name.trim() ||
      invalidQuran ||
      invalidSequence ||
      invalidLegacyQuantity ||
      invalidPlaylist ||
      invalidWeekdays ||
      !Number.isInteger(track.dailyAmount) ||
      track.dailyAmount < 1
    ) {
      throw new Error('invalid_track');
    }
    ids.add(track.id);
  }
  if (enabledTracks.length === 0) throw new Error('track_required');

  const nextPoints = new Map(
    enabledTracks
      .filter(track => track.kind === 'quran')
      .map(track => [track.id, track.start as QuranPoint | null]),
  );
  const quranSequenceGroups = new Map<string, QuranPlanTrack[]>();
  enabledTracks
    .filter(track => track.kind === 'quran' && track.quranSequenceId)
    .forEach(track => {
      const group =
        quranSequenceGroups.get(track.quranSequenceId as string) ?? [];
      group.push(track);
      quranSequenceGroups.set(track.quranSequenceId as string, group);
    });
  const quranSequenceCursors = new Map<
    string,
    { trackIndex: number; point: QuranPoint }
  >(
    Array.from(quranSequenceGroups.entries()).map(([id, group]) => [
      id,
      { trackIndex: 0, point: group[0].start },
    ]),
  );
  const outputTracks = enabledTracks.filter(
    track =>
      !track.quranSequenceId ||
      quranSequenceGroups.get(track.quranSequenceId)?.[0]?.id === track.id,
  );
  const nextNumbers = new Map(
    enabledTracks
      .filter(track => track.kind === 'quantity' && track.items === undefined)
      .map(track => [track.id, track.startNumber]),
  );
  const sequenceCursors = new Map(
    enabledTracks
      .filter(track => track.kind !== 'quran' && track.items !== undefined)
      .map(track => [
        track.id,
        {
          itemIndex: 0,
          unitNumber: sequenceItemStart(track, 0),
        } as SequenceCursor,
      ]),
  );
  const totals: Record<string, QuranPlanTrackTotal> = Object.fromEntries(
    outputTracks.map(track => [
      track.id,
      { ayahs: 0, amount: 0, end: null, endNumber: null },
    ]),
  );
  let studyDays = 0;
  const selectedDays = new Set(input.weekdays);
  const trackDays = new Map<string, Set<number>>(
    enabledTracks.map(track => [
      track.id,
      track.weekdays === undefined
        ? selectedDays
        : new Set(
            track.weekdays.filter(
              day => Number.isInteger(day) && day >= 0 && day <= 6,
            ),
          ),
    ]),
  );
  const days: QuranPlanDay[] = [];

  for (let index = 0; index < calendarDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const weekday = date.getDay();
    const isStudyDay = selectedDays.has(weekday);
    const assignments: Record<string, QuranAssignment | null> =
      Object.fromEntries(outputTracks.map(track => [track.id, null]));
    const paused: Record<string, boolean> = {};
    if (isStudyDay) {
      studyDays += 1;
      const handledQuranSequences = new Set<string>();
      for (const track of enabledTracks) {
        if (track.kind === 'quran' && track.quranSequenceId) {
          if (handledQuranSequences.has(track.quranSequenceId)) continue;
          handledQuranSequences.add(track.quranSequenceId);
          const group = quranSequenceGroups.get(track.quranSequenceId);
          const cursor = quranSequenceCursors.get(track.quranSequenceId);
          if (!group || !cursor) continue;
          const outputTrack = group[0];
          const currentTrack = group[cursor.trackIndex];
          if (!trackDays.get(currentTrack.id)?.has(weekday)) {
            paused[outputTrack.id] = true;
            continue;
          }
          const result = isReverseQuranTrack(currentTrack)
            ? allocateReverse(
                cursor.point,
                currentTrack,
                quranPlanStopPoint(currentTrack),
              )
            : allocate(
                cursor.point,
                currentTrack,
                currentTrack.hifzEnd ?? LAST_POINT,
              );
          assignments[outputTrack.id] = result.assignment;
          totals[outputTrack.id].end = result.assignment.to;
          totals[outputTrack.id].ayahs += result.assignment.ayahCount;
          totals[outputTrack.id].amount += result.assignment.unitAmount;
          if (result.next) {
            quranSequenceCursors.set(track.quranSequenceId, {
              ...cursor,
              point: result.next,
            });
          } else if (cursor.trackIndex + 1 < group.length) {
            const nextTrack = group[cursor.trackIndex + 1];
            quranSequenceCursors.set(track.quranSequenceId, {
              trackIndex: cursor.trackIndex + 1,
              point: nextTrack.start,
            });
          } else if (group.some(item => item.quranSequenceCyclic)) {
            quranSequenceCursors.set(track.quranSequenceId, {
              trackIndex: 0,
              point: group[0].start,
            });
          } else {
            quranSequenceCursors.delete(track.quranSequenceId);
          }
          continue;
        }
        if (track.kind !== 'quran' && track.items !== undefined) {
          if (!trackDays.get(track.id)?.has(weekday)) {
            paused[track.id] = true;
            continue;
          }
          const result = allocateSequence(
            sequenceCursors.get(track.id) ?? null,
            track,
          );
          assignments[track.id] = result.assignment;
          sequenceCursors.set(track.id, result.next);
          if (result.assignment) {
            totals[track.id].endNumber = result.assignment.toNumber;
            totals[track.id].amount += result.assignment.unitAmount;
          }
        } else if (track.kind === 'quantity') {
          if (!trackDays.get(track.id)?.has(weekday)) {
            paused[track.id] = true;
            continue;
          }
          const next = nextNumbers.get(track.id);
          if (next == null) continue;
          const result = allocateQuantity(next, track);
          assignments[track.id] = result.assignment;
          nextNumbers.set(track.id, result.next);
          totals[track.id].endNumber = result.assignment.toNumber;
          totals[track.id].amount += result.assignment.unitAmount;
        } else {
          if (!trackDays.get(track.id)?.has(weekday)) {
            paused[track.id] = true;
            continue;
          }
          const next = nextPoints.get(track.id);
          if (!next) continue;
          const reverse = isReverseQuranTrack(track);
          const hifzEnd = quranPlanStopPoint(track);
          const hasHifzEnd =
            track.cyclic ||
            track.hifzStart !== undefined ||
            track.hifzEnd !== undefined;
          const result = reverse
            ? allocateReverse(next, track, hifzEnd)
            : allocate(next, track, hasHifzEnd ? hifzEnd : LAST_POINT);
          assignments[track.id] = result.assignment;
          nextPoints.set(
            track.id,
            result.next ??
              (track.cyclic
                ? track.hifzStart ??
                  (reverse ? { surah: 114, ayah: 1 } : { surah: 1, ayah: 1 })
                : null),
          );
          totals[track.id].end = result.assignment.to;
          totals[track.id].ayahs += result.assignment.ayahCount;
          totals[track.id].amount += result.assignment.unitAmount;
        }
      }
    }
    days.push({
      date: isoDate(date),
      weekday,
      isStudyDay,
      assignments,
      paused: Object.keys(paused).length ? paused : undefined,
    });
  }

  return {
    tracks: outputTracks.map(track => ({
      ...track,
      start: { ...track.start },
    })),
    days,
    studyDays,
    totals,
  };
}

export function completedMushafText(point: QuranPoint | null): string {
  return point &&
    point.surah === LAST_POINT.surah &&
    point.ayah === LAST_POINT.ayah
    ? ' · اكتمل المصحف'
    : '';
}
