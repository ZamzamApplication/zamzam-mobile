import { useSyncExternalStore } from 'react';
import type { OfflineEngine } from './offline/engine';
export function useEngine(engine: OfflineEngine) {
  return useSyncExternalStore(engine.subscribe, () => engine.view);
}
