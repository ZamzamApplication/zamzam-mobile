import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { errorMessage } from '../api';
import { Button, Heading, Notice, s, Txt, useTheme } from '../ui';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
export function useDraft<T>(engine: OfflineEngine, key: string, initial: T) {
  const [value, setValue] = useState<T>(
    () => (engine.view.data.formDrafts?.[key] as T) ?? initial,
  );
  const [error, setError] = useState('');
  const change = (patch: Partial<T>) => {
    const next = { ...value, ...patch };
    setValue(next);
    void engine.formDraft(key, next).catch(e => setError(errorMessage(e)));
  };
  return {
    value,
    change,
    error,
    clear: () => engine.formDraft(key, undefined, value),
  };
}
export function FeaturePage({
  engine,
  title,
  onBack,
  children,
  loading,
  error,
  reload,
  fetchedAt,
}: {
  engine: OfflineEngine;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  reload?: () => void;
  fetchedAt?: string;
}) {
  const { online } = useEngine(engine);
  const t = useTheme();
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        reload ? (
          <RefreshControl
            refreshing={!!loading}
            onRefresh={reload}
            tintColor={t.cyan}
          />
        ) : undefined
      }
    >
      <Button small secondary icon="back" title="رجوع" onPress={onBack} />
      <Heading title={title} />
      {!online && (
        <Notice message="دون اتصال · تعرض البيانات المحفوظة، وتبقى مسوداتك على الجهاز حتى تنشرها عند الاتصال." />
      )}
      {fetchedAt && (
        <Txt muted style={{ fontSize: 10 }}>
          آخر تحديث: {new Date(fetchedAt).toLocaleString('ar-EG')}
        </Txt>
      )}
      {error ? <Notice error message={error} onRetry={reload} /> : null}
      {loading && <ActivityIndicator color={t.cyan} />}
      {children}
    </ScrollView>
  );
}
