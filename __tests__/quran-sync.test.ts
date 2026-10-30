import {
  applyQuranReceipt,
  quranBatch,
  quranKey,
  queueQuran,
} from '../src/offline/quran';
import type { QuranRecord } from '../src/offline/quran';
import { validateProgress } from '../src/progress';
const input = {
  student_id: 1,
  session_id: 10,
  category: 'new_memorization',
  range_type: 'page' as const,
  from_page: 1,
  to_page: 2,
  quality_score: 5,
  mistakes: 0,
};
test('Quran mutations freeze after sending and rebase later edits only after the receipt', () => {
  const records: Record<string, QuranRecord> = {};
  let queue = queueQuran([], records, input, 'device-1');
  queue[0].attempted = true;
  const original = JSON.stringify(queue[0]);
  queue = queueQuran(queue, records, { ...input, to_page: 3 }, 'device-1');
  expect(JSON.stringify(queue[0])).toBe(original);
  expect(quranBatch(queue).map(q => q.mutation_id)).toEqual([
    queue[0].mutation_id,
  ]);
  queue = applyQuranReceipt(queue, records, {
    mutation_id: queue[0].mutation_id,
    status: 'applied',
    entity: { ...input, id: 20, revision: 1 },
  });
  expect(queue).toHaveLength(1);
  expect(queue[0].values.to_page).toBe(3);
  expect(queue[0].base_revision).toBe(1);
});
test('conflicts keep local values, block successors, and expose the server revision', () => {
  const records: Record<string, QuranRecord> = {};
  let queue = queueQuran([], records, input, 'device-1');
  queue[0].attempted = true;
  queue = queueQuran(queue, records, { ...input, to_page: 4 }, 'device-1');
  queue = applyQuranReceipt(queue, records, {
    mutation_id: queue[0].mutation_id,
    status: 'conflict',
    code: 'revision_conflict',
    server: { ...input, to_page: 5, id: 20, revision: 2 },
  });
  expect(quranBatch(queue)).toHaveLength(0);
  expect(queue.at(-1)?.values.to_page).toBe(4);
  expect(records[quranKey(10, 1, input.category)].revision).toBe(2);
});
test('range validation handles reverse pages, verse bounds, and invalid evaluations', () => {
  expect(() =>
    validateProgress({
      ...input,
      direction: 'backward',
      from_page: 5,
      to_page: 3,
    }),
  ).not.toThrow();
  expect(() =>
    validateProgress({ ...input, from_page: 5, to_page: 3 }),
  ).toThrow();
  expect(() => validateProgress({ ...input, quality_score: 0 })).toThrow();
  expect(() =>
    validateProgress({
      ...input,
      range_type: 'surah_ayah',
      from_surah: 1,
      from_ayah: 1,
      to_surah: 1,
      to_ayah: 8,
    }),
  ).toThrow();
});
