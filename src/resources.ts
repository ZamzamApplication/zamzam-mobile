import { useCallback, useEffect, useState } from 'react';
import { useEngine } from './hooks';
import type { OfflineEngine } from './offline/engine';
import { errorMessage } from './api';

export function useResource<T>(engine: OfflineEngine, path: string | null) {
  const { data, online } = useEngine(engine);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setError('');
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void engine
      .resource<T>(path)
      .catch(e => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [engine, path, online, refresh]);
  const cached = path ? data.resources?.[path] : undefined;
  return {
    value: cached?.value as T | undefined,
    fetchedAt: cached?.fetchedAt,
    online,
    loading,
    error,
    reload,
  };
}
