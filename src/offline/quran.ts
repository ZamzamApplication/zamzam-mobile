import type { QuranProgressInput } from '../domain-types';
import { uid } from '../types';
export type QuranRecord = QuranProgressInput & {
  id: number;
  session_id: number;
  revision: number;
};
export interface QuranPending {
  mutation_id: string;
  device_id: string;
  entity_type: 'quran_progress';
  entity_key: string;
  base_revision: number;
  values: QuranProgressInput & { session_id: number };
  client_changed_at: string;
  attempted: boolean;
  issue?: string;
  server?: QuranRecord | null;
}
export const quranKey = (session: number, student: number, category: string) =>
  `session:${session}:student:${student}:category:${category}`;
export function queueQuran(
  queue: QuranPending[],
  records: Record<string, QuranRecord>,
  values: QuranPending['values'],
  device: string,
): QuranPending[] {
  const key = quranKey(values.session_id, values.student_id, values.category);
  const previous = queue.filter(q => q.entity_key === key).at(-1);
  return [
    ...queue.filter(q => q !== previous || q.attempted || q.issue),
    {
      mutation_id: uid(),
      device_id: device,
      entity_type: 'quran_progress',
      entity_key: key,
      base_revision: records[key]?.revision || 0,
      values: { ...values },
      client_changed_at: new Date().toISOString(),
      attempted: false,
    },
  ];
}
export function quranBatch(queue: QuranPending[]) {
  const seen = new Set<string>();
  return queue
    .filter(q => {
      if (seen.has(q.entity_key)) return false;
      seen.add(q.entity_key);
      return !q.issue;
    })
    .slice(0, 50);
}
export function applyQuranReceipt(
  queue: QuranPending[],
  records: Record<string, QuranRecord>,
  result: {
    mutation_id: string;
    status: string;
    entity?: QuranRecord;
    code?: string;
    server?: QuranRecord | null;
  },
) {
  const pending = queue.find(q => q.mutation_id === result.mutation_id);
  if (!pending) return queue;
  if (result.status === 'applied' && result.entity) {
    records[pending.entity_key] = result.entity;
    queue = queue.filter(q => q !== pending);
    queue
      .filter(q => q.entity_key === pending.entity_key && !q.attempted)
      .forEach(q => {
        q.base_revision = result.entity!.revision;
      });
  } else {
    pending.issue = result.code || result.status;
    pending.server = result.server;
    if (result.server) records[pending.entity_key] = result.server;
  }
  return queue;
}
