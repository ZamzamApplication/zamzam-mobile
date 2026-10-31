import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL, ApiClient, errorMessage } from './src/api';
import { DemoClient } from './src/demo';
import type { Gateway, User } from './src/types';
import { useEngine } from './src/hooks';
import { OfflineEngine } from './src/offline/engine';
import { readWorkspace } from './src/offline/database';
import {
  AttendanceScreen,
  RecordsScreen,
  SessionsScreen,
} from './src/screens/Attendance';
import { SettingsScreen } from './src/screens/Settings';
import { HomeScreen } from './src/screens/Home';
import { formatQuranRange } from './src/quran';
import {
  SignupFlow,
  InvitationFlow,
  PendingApproval,
} from './src/screens/Registration';
import { FinanceScreen } from './src/screens/Finance';
import { MoreScreen } from './src/screens/More';
import { RegistrationNotification } from './src/screens/StudentRegistration';
import type { MoreRoute } from './src/screens/More';
import {
  Button,
  Card,
  dark,
  Field,
  Icon,
  IconButton,
  light,
  Notice,
  s,
  Sheet,
  Theme,
  Toggle,
  Txt,
  useTheme,
} from './src/ui';
import type { IconName } from './src/ui';

type Session = { client: Gateway; user: User };
function Login({
  onReady,
  initialInvite,
  onInviteClose,
}: {
  onReady: (session: Session) => Promise<void>;
  initialInvite?: string;
  onInviteClose: () => void;
}) {
  const t = useTheme();
  const [mode, setMode] = useState(initialInvite ? 'invite' : 'login');
  useEffect(() => {
    if (initialInvite) setMode('invite');
  }, [initialInvite]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [endpoint, setEndpoint] = useState(API_URL);
  const [serverStatus, setServerStatus] = useState('');
  const [checkingServer, setCheckingServer] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const login = async () => {
    setBusy(true);
    setError('');
    try {
      const client = await ApiClient.login(username, password, endpoint);
      const user = await client.loadUser();
      setPassword('');
      await onReady({ client, user });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      const client = await DemoClient.create();
      await onReady({ client, user: client.user });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (mode === 'signup')
    return <SignupFlow endpoint={endpoint} onBack={() => setMode('login')} />;
  if (mode === 'invite')
    return (
      <ScrollView contentContainerStyle={s.page}>
        <InvitationFlow
          initialLink={initialInvite}
          endpoint={endpoint}
          onBack={() => {
            setMode('login');
            onInviteClose();
          }}
          onExisting={() => setMode('login')}
          onReady={async next => {
            onInviteClose();
            await onReady(next);
          }}
        />
      </ScrollView>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Card
          style={{
            padding: 24,
            gap: 18,
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            borderRadius: 28,
          }}
        >
          <View style={[s.row, { marginBottom: 10 }]}>
            <View
              style={{
                height: 40,
                width: 40,
                backgroundColor: '#06b6d4',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: 22, lineHeight: 34 }}>💧</Txt>
            </View>
            <Txt bold style={{ fontSize: 20 }}>
              زمزم
            </Txt>
          </View>
          <View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: t.pale,
                alignSelf: 'flex-end',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Txt style={{ fontSize: 24, lineHeight: 36 }}>🔐</Txt>
            </View>
            <Txt bold style={{ fontSize: 25, lineHeight: 38 }}>
              مرحباً بعودتك
            </Txt>
            <Txt muted style={{ marginTop: 8 }}>
              سجّل دخولك للمتابعة من حيث توقفت وإدارة حلقاتك بسهولة.
            </Txt>
          </View>
          <Field
            label="اسم المستخدم"
            placeholder="username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            testID="login-username"
            editable={!busy}
            style={{ textAlign: 'left', writingDirection: 'ltr' }}
          />
          <Field
            label="كلمة المرور"
            placeholder="أدخل كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => {
              if (username && password && !busy) void login();
            }}
            testID="login-password"
            editable={!busy}
            style={{ textAlign: 'left', writingDirection: 'ltr' }}
          />
          {error ? <Notice error message={error} /> : null}
          <Button
            title="تسجيل الدخول"
            busy={busy}
            disabled={!username.trim() || !password}
            onPress={() => {
              void login();
            }}
            testID="login-submit"
          />
          <Txt
            muted
            style={{
              fontSize: 10,
              textAlign: 'center',
              writingDirection: 'ltr',
            }}
          >
            {endpoint}
          </Txt>
          <Button
            small
            secondary
            title="فحص الاتصال بالخادم"
            testID="check-server"
            busy={checkingServer}
            onPress={() => {
              setCheckingServer(true);
              setServerStatus('');
              void ApiClient.checkServer(endpoint)
                .then(() =>
                  setServerStatus('الاتصال بخادم زمزم وقاعدة البيانات يعمل'),
                )
                .catch(() =>
                  setServerStatus(
                    'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.',
                  ),
                )
                .finally(() => setCheckingServer(false));
            }}
          />
          {serverStatus ? (
            <Txt
              testID="server-status"
              muted
              style={{ fontSize: 11, textAlign: 'center' }}
            >
              {serverStatus}
            </Txt>
          ) : null}
          <View style={[s.row, { gap: 10 }]}>
            <View style={{ height: 1, backgroundColor: t.border, flex: 1 }} />
            <Txt muted style={{ fontSize: 11 }}>
              أو
            </Txt>
            <View style={{ height: 1, backgroundColor: t.border, flex: 1 }} />
          </View>
          <Button
            secondary
            title="تجربة التطبيق"
            disabled={busy}
            onPress={() => {
              void demo();
            }}
            testID="demo-start"
          />
          <Button
            secondary
            title="إنشاء حساب وتحفيظ جديد"
            onPress={() => setMode('signup')}
            testID="signup-open"
          />
          <Button
            secondary
            title="الانضمام بدعوة"
            onPress={() => setMode('invite')}
            testID="invite-open"
          />
          <Txt muted style={{ fontSize: 11, textAlign: 'center' }}>
            التجربة تستخدم بيانات محلية مستقلة عن حسابك الحقيقي.
          </Txt>
          {__DEV__ && (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdvanced(v => !v)}
              >
                <Txt muted style={{ fontSize: 11, textAlign: 'center' }}>
                  إعداد خادم التطوير
                </Txt>
              </Pressable>
              {advanced && (
                <Field
                  label="عنوان خادم API"
                  value={endpoint}
                  onChangeText={setEndpoint}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              )}
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SyncPanel({
  engine,
  visible,
  onClose,
  paused,
  onPause,
}: {
  engine: OfflineEngine;
  visible: boolean;
  onClose: () => void;
  paused: boolean;
  onPause: (value: boolean) => void;
}) {
  const { data, syncing, online, error } = useEngine(engine);
  const [localError, setLocalError] = useState('');
  const issues = data.queue.filter(p => p.issue);
  const pending = data.queue.filter(p => !p.issue);
  const quranIssues = (data.quranQueue || []).filter(p => p.issue);
  const quranPending = (data.quranQueue || []).filter(p => !p.issue);
  const reasons: Record<string, string> = {
    revision_conflict: 'عُدّل السجل على جهاز آخر.',
    session_locked: 'أُكّدت الحلقة على جهاز آخر وأصبح الحضور مقفلاً.',
    entity_not_found: 'الطالب أو الحلقة لم يعودا متاحين لهذا الحساب.',
    invalid_attendance_status: 'تغيرت حالات الحضور في إعدادات التحفيظ.',
    invalid_sheikh: 'الشيخ المختار غير متاح.',
    session_progress_disabled:
      'رُفض هذا التعديل قبل تحديث الخادم. يمكنك الآن إعادة إرساله بعد مراجعة بياناته.',
    session_archived:
      'الحلقة مؤرشفة. استعدها من إدارة الحلقات قبل إعادة إرسال التعديل.',
    scope_changed: 'تغيرت صلاحيات الحساب. راجع البيانات مع المدير.',
  };
  return (
    <Sheet
      visible={visible}
      title="المزامنة والعمل دون إنترنت"
      onClose={onClose}
    >
      <Notice
        message={
          online ? 'متصل بالإنترنت' : 'غير متصل · التغييرات محفوظة على الجهاز'
        }
      />
      <Txt>
        {pending.length + quranPending.length} تغيير بانتظار المزامنة ·{' '}
        {issues.length + quranIssues.length} يحتاج مراجعة
      </Txt>
      {issues.length > 0 && (
        <Notice message="المزامنة العادية لا تستبدل التعديلات المتعارضة. راجع كل طالب أدناه، ثم اختر إعادة إرسال أحدث تعديلاتك أو استخدام بيانات الخادم. بعد حلها ستتاح إمكانية تأكيد الحلقة." />
      )}
      <Txt muted style={{ fontSize: 12 }}>
        آخر مزامنة:{' '}
        {data.lastSync
          ? new Date(data.lastSync).toLocaleString('ar-EG')
          : 'لم تتم بعد'}
      </Txt>
      <Button
        title="المزامنة الآن"
        icon="sync"
        disabled={!online}
        busy={syncing}
        onPress={() => {
          void engine.sync();
        }}
        testID="sync-now"
      />
      {engine.client.demo && (
        <Toggle
          title="تجربة العمل دون إنترنت"
          detail="يوقف المزامنة في التجربة فقط. تبقى التغييرات محفوظة بعد إغلاق التطبيق."
          value={paused}
          onChange={onPause}
        />
      )}
      {(localError || error) && <Notice error message={localError || error!} />}
      {issues.map(issue => {
        const student = data.rosters[issue.values.session_id]?.sheikh_groups
          .flatMap(g => g.students)
          .find(st => st.id === issue.values.student_id);
        const latest = data.queue
          .filter(p => p.entity_key === issue.entity_key)
          .at(-1)!;
        const resolve = (keep: boolean) => {
          void engine
            .resolve(issue.entity_key, keep)
            .catch(e => setLocalError(errorMessage(e)));
        };
        return (
          <Card key={issue.mutation_id}>
            <Txt bold>{student?.name || `طالب ${issue.values.student_id}`}</Txt>
            <Txt muted>
              {reasons[issue.issue!] ||
                'تعذر قبول التعديل. راجع البيانات قبل إعادة المحاولة.'}
            </Txt>
            <Txt>
              تعديلك: {latest.values.status}
              {latest.values.notes ? ` · ${latest.values.notes}` : ''}
            </Txt>
            <Txt>
              الخادم:{' '}
              {(issue.server === undefined
                ? data.attendance[issue.entity_key]
                : issue.server
              )?.status || 'لا يوجد سجل'}
              {(issue.server === undefined
                ? data.attendance[issue.entity_key]
                : issue.server
              )?.notes
                ? ` · ${
                    (issue.server === undefined
                      ? data.attendance[issue.entity_key]
                      : issue.server
                    )?.notes
                  }`
                : ''}
            </Txt>
            {issue.issue !== 'scope_changed' && (
              <Button
                secondary
                title="إعادة إرسال أحدث تعديلاتي"
                disabled={!online || syncing}
                testID={`retry-mutation-${issue.values.student_id}`}
                onPress={() => resolve(true)}
              />
            )}
            <Button
              secondary
              title="استخدام بيانات الخادم"
              onPress={() =>
                Alert.alert(
                  'استخدام بيانات الخادم',
                  'سيتم استبدال تعديلاتك المحلية لهذا الطالب ببيانات الخادم.',
                  [
                    { text: 'رجوع', style: 'cancel' },
                    {
                      text: 'استخدام بيانات الخادم',
                      onPress: () => resolve(false),
                    },
                  ],
                )
              }
            />
          </Card>
        );
      })}
      {quranIssues.map(q => (
        <Card key={q.mutation_id}>
          <Txt bold>تعارض في متابعة القرآن</Txt>
          <Txt>تعديلك: {formatQuranRange(q.values)}</Txt>
          <Txt>
            الخادم: {q.server ? formatQuranRange(q.server) : 'لا يوجد سجل'}
          </Txt>
          <Txt muted>{reasons[q.issue!] || q.issue}</Txt>
          <Button
            secondary
            title="استخدام نسخة الخادم"
            onPress={() => {
              void engine
                .resolveQuran(q.entity_key, false)
                .catch(e => setLocalError(errorMessage(e)));
            }}
          />
          <Button
            secondary
            title="إعادة إرسال تعديلي"
            disabled={!online}
            onPress={() => {
              void engine
                .resolveQuran(q.entity_key, true)
                .catch(e => setLocalError(errorMessage(e)));
            }}
          />
        </Card>
      ))}
      {quranPending.slice(0, 12).map(q => (
        <Txt key={q.mutation_id}>قرآن: {formatQuranRange(q.values)}</Txt>
      ))}
      {pending.slice(0, 12).map(p => (
        <Txt key={p.mutation_id} muted style={{ fontSize: 12 }}>
          {data.rosters[p.values.session_id]?.sheikh_groups
            .flatMap(g => g.students)
            .find(st => st.id === p.values.student_id)?.name || 'طالب'}{' '}
          · {p.values.status}
        </Txt>
      ))}
    </Sheet>
  );
}

function Workspace({
  engine,
  onTenant,
  onLogout,
  isDark,
  toggleTheme,
}: {
  engine: OfflineEngine;
  onTenant: (user: User) => void;
  onLogout: () => Promise<void>;
  isDark: boolean;
  toggleTheme: () => void;
}) {
  const { data, online, syncing, error } = useEngine(engine);
  const t = useTheme();
  const [page, setPage] = useState<
    'home' | 'sessions' | 'attendance' | 'finance' | 'settings' | 'more'
  >(data.user.role === 'auditor' ? 'finance' : 'home');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [moreRoute, setMoreRoute] = useState<MoreRoute>(null);
  const [picker, setPicker] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState('');
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let connected = false;
    const unsubscribe = NetInfo.addEventListener(state => {
      connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      engine.setOnline(connected && !paused);
    });
    const app = AppState.addEventListener('change', state => {
      if (state === 'active' && connected && !paused) void engine.autoSync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && connected && !paused)
        void engine.autoSync();
    }, 60000);
    return () => {
      unsubscribe();
      app.remove();
      clearInterval(timer);
    };
  }, [engine, paused]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sessionId !== null) {
        setSessionId(null);
        return true;
      }
      if (moreRoute) {
        setMoreRoute(null);
        return true;
      }
      if (page !== 'home') {
        setPage('home');
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [sessionId, page, moreRoute]);
  const chooseTenant = async (id: number) => {
    if (id === engine.tenant || switching) {
      setPicker(false);
      return;
    }
    setSwitching(true);
    setMessage('');
    try {
      const membership = data.user.memberships?.find(
        m =>
          m.tahfiz_id === id &&
          m.tahfiz_status === 'active' &&
          m.is_active !== false,
      );
      if (!membership) throw new Error('لا يوجد اشتراك نشط في هذا التحفيظ.');
      let user: User;
      if (online) user = await engine.client.switchTenant(id);
      else {
        const cached = await readWorkspace(`${engine.client.accountKey}:${id}`);
        if (!cached?.bootstrapped)
          throw new Error(
            'هذا التحفيظ لم يُحمّل على الجهاز بعد. اتصل بالإنترنت لفتحه للمرة الأولى.',
          );
        user = {
          ...cached.user,
          memberships: data.user.memberships,
          role: membership.role,
          sheikh_id: membership.sheikh_id,
        };
        await engine.client.selectCachedTenant(user);
      }
      setPicker(false);
      onTenant(user);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSwitching(false);
    }
  };
  const logout = () =>
    Alert.alert(
      'تسجيل الخروج',
      data.queue.length || data.quranQueue?.length
        ? 'توجد تغييرات غير متزامنة. ستبقى محفوظة بأمان لهذا الحساب حتى تسجل دخوله مرة أخرى.'
        : 'هل تريد تسجيل الخروج من هذا الجهاز؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: () => {
            void onLogout().catch(e => setMessage(errorMessage(e)));
          },
        },
      ],
    );
  const allPending = [...data.queue, ...(data.quranQueue || [])];
  const issues = allPending.filter(p => p.issue).length;
  const open = (id: number) => setSessionId(id);
  const nav: { key: typeof page; label: string; icon: IconName }[] = [
    { key: 'home', label: 'الرئيسية', icon: 'home' },
    { key: 'sessions', label: 'الحلقات', icon: 'sessions' },
    { key: 'attendance', label: 'سجل الحضور', icon: 'attendance' },
    ...(['admin', 'super_admin', 'auditor'].includes(data.user.role)
      ? [
          {
            key: 'finance' as const,
            label: 'القسم المالي',
            icon: 'finance' as const,
          },
        ]
      : []),
    { key: 'settings', label: 'الإعدادات', icon: 'settings' },
    { key: 'more', label: 'المزيد', icon: 'more' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, direction: 'ltr' }}>
      <View
        style={[
          s.row,
          {
            paddingHorizontal: 10,
            minHeight: 60,
            borderBottomWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
            gap: 3,
          },
        ]}
      >
        <Txt bold style={{ fontSize: 18, color: t.cyan, marginLeft: 'auto' }}>
          💧 زمزم
        </Txt>
        <Pressable
          testID="workspace-switcher"
          accessibilityRole="button"
          accessibilityLabel={`التبديل بين التحفيظات: ${data.settings.name}`}
          onPress={() => {
            setMessage('');
            setPicker(true);
          }}
          style={[
            s.row,
            {
              gap: 5,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 12,
              padding: 6,
              maxWidth: 180,
              flexShrink: 1,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: '#0891b2',
              width: 30,
              height: 30,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt bold style={{ color: '#fff' }}>
              {data.settings.name[0]}
            </Txt>
          </View>
          <Txt bold numberOfLines={1} style={{ fontSize: 11, flexShrink: 1 }}>
            {data.settings.name}
          </Txt>
          <Icon name="down" size={13} />
        </Pressable>
        <IconButton
          name={isDark ? 'sun' : 'moon'}
          label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
          onPress={toggleTheme}
          testID="theme-toggle"
        />
        <IconButton name="logout" label="تسجيل الخروج" onPress={logout} />
      </View>
      <View
        style={{
          backgroundColor: t.pale,
          borderBottomWidth: 1,
          borderColor: t.border,
          padding: 5,
        }}
      >
        <Txt style={{ textAlign: 'center', fontSize: 11, color: t.cyan }}>
          تعمل الآن داخل:{' '}
          <Txt bold style={{ fontSize: 11, color: t.cyan }}>
            {data.settings.name}
          </Txt>
        </Txt>
      </View>
      {engine.client.demo && (
        <View style={{ backgroundColor: '#fffbeb', padding: 4 }}>
          <Txt style={{ fontSize: 10, color: '#a16207', textAlign: 'center' }}>
            وضع تجريبي · بيانات محلية مستقلة
          </Txt>
        </View>
      )}
      <Pressable
        testID="sync-status"
        accessibilityRole="button"
        onPress={() => setSyncOpen(true)}
        style={[
          s.row,
          {
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderBottomWidth: 1,
            borderColor: t.border,
            backgroundColor: t.card,
          },
        ]}
      >
        {syncing ? (
          <ActivityIndicator size="small" color={t.cyan} />
        ) : (
          <Icon
            name={online ? 'check' : 'wifi'}
            color={issues ? '#be123c' : online ? '#059669' : '#b45309'}
            size={15}
          />
        )}
        <Txt
          style={{ fontSize: 11, flex: 1, color: issues ? '#be123c' : t.muted }}
        >
          {syncing
            ? 'جاري المزامنة...'
            : !online
            ? 'دون اتصال · محفوظ على الجهاز'
            : issues
            ? `${issues} تعديل يحتاج مراجعة`
            : allPending.length
            ? `${allPending.length} تغيير بانتظار المزامنة`
            : 'البيانات محفوظة على الجهاز'}
        </Txt>
        <Txt style={{ fontSize: 11, color: t.cyan }}>المزامنة</Txt>
      </Pressable>
      {((error && !syncing) || message) && !picker ? (
        <View style={{ padding: 8 }}>
          <Notice
            error
            message={message || error!}
            onRetry={() => {
              setMessage('');
              void engine.sync();
            }}
          />
        </View>
      ) : null}
      <RegistrationNotification
        engine={engine}
        onOpen={() => {
          setSessionId(null);
          setPage('more');
          setMoreRoute({ page: 'registration' });
        }}
      />
      <View style={{ flex: 1 }}>
        {sessionId !== null ? (
          <AttendanceScreen
            key={sessionId}
            engine={engine}
            id={sessionId}
            onBack={() => setSessionId(null)}
            onProfile={id => {
              setSessionId(null);
              setMoreRoute({ page: 'profile', id });
              setPage('more');
            }}
            onQuran={() => {
              setMoreRoute({ page: 'quran', id: sessionId });
              setSessionId(null);
              setPage('more');
            }}
            onReview={() => setSyncOpen(true)}
          />
        ) : page === 'finance' ||
          (page === 'home' && data.user.role === 'auditor') ? (
          <FinanceScreen
            engine={engine}
            onBack={() =>
              setPage(data.user.role === 'auditor' ? 'finance' : 'more')
            }
          />
        ) : page === 'home' ? (
          <HomeScreen
            engine={engine}
            onOpen={open}
            onSessions={() => setPage('sessions')}
            onRecords={() => setPage('attendance')}
            onSettings={() => setPage('settings')}
            onSync={() => setSyncOpen(true)}
            onMore={() => {
              setPage('more');
              setMoreRoute(null);
            }}
          />
        ) : page === 'sessions' ? (
          <SessionsScreen
            engine={engine}
            onOpen={open}
            onManage={() => {
              setMoreRoute({ page: 'session-management' });
              setPage('more');
            }}
          />
        ) : page === 'more' ? (
          <MoreScreen
            engine={engine}
            route={moreRoute}
            navigate={route => {
              if (route?.page === 'finance') {
                setPage('finance');
                setMoreRoute(null);
              } else setMoreRoute(route);
            }}
            onHome={() => setPage('home')}
            onSettings={() => setPage('settings')}
            onJoined={onTenant}
            onSession={id => {
              setSessionId(id);
              setPage('sessions');
            }}
          />
        ) : page === 'attendance' ? (
          <RecordsScreen engine={engine} onOpen={open} />
        ) : (
          <SettingsScreen engine={engine} />
        )}
      </View>
      <View
        style={[
          s.row,
          {
            padding: 6,
            gap: 3,
            backgroundColor: t.card,
            borderTopWidth: 1,
            borderColor: t.border,
          },
        ]}
      >
        {nav
          .filter(
            item => data.user.role !== 'auditor' || item.key === 'finance',
          )
          .map(item => (
            <Pressable
              key={item.key}
              testID={`tab-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: item.key === page }}
              onPress={() => {
                setSessionId(null);
                setMoreRoute(null);
                setPage(item.key);
              }}
              style={{
                flex: 1,
                minHeight: 55,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: 12,
                backgroundColor: page === item.key ? t.active : t.card,
              }}
            >
              <Icon
                name={item.icon}
                color={item.key === page ? t.cyan : t.muted}
                size={22}
              />
              <Txt
                bold
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  color: item.key === page ? t.cyan : t.muted,
                }}
              >
                {item.label}
              </Txt>
            </Pressable>
          ))}
      </View>
      <Sheet
        visible={picker}
        title="التبديل بين التحفيظات"
        onClose={() => {
          if (!switching) setPicker(false);
        }}
      >
        <Txt muted style={{ fontSize: 12 }}>
          ستتغير البيانات والحلقات حسب التحفيظ المختار. تبقى التغييرات المعلقة
          مرتبطة بتحفيظها.
        </Txt>
        {message ? <Notice error message={message} /> : null}
        {(data.user.memberships || []).map(m => (
          <Pressable
            key={m.id}
            testID={`workspace-${m.tahfiz_id}`}
            disabled={
              switching || m.tahfiz_status !== 'active' || m.is_active === false
            }
            onPress={() => {
              void chooseTenant(m.tahfiz_id);
            }}
            style={[
              s.option,
              {
                backgroundColor:
                  m.tahfiz_id === engine.tenant ? t.active : t.field,
                opacity: m.tahfiz_status === 'active' ? 1 : 0.4,
              },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                backgroundColor:
                  m.tahfiz_id === engine.tenant ? '#0891b2' : t.active,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt
                bold
                style={{
                  color: m.tahfiz_id === engine.tenant ? '#fff' : t.cyan,
                }}
              >
                {m.tahfiz_name[0]}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt bold>
                {m.tahfiz_id === engine.tenant
                  ? data.settings.name
                  : m.tahfiz_name}
              </Txt>
              <Txt muted style={{ fontSize: 11 }}>
                {m.role === 'admin'
                  ? 'مدير'
                  : m.role === 'auditor'
                  ? 'مراجع'
                  : 'شيخ'}
                {m.tahfiz_status !== 'active' ? ' · غير نشط' : ''}
              </Txt>
            </View>
            {m.tahfiz_id === engine.tenant && (
              <Icon name="check" color={t.cyan} />
            )}
            {switching && <ActivityIndicator size="small" color={t.cyan} />}
          </Pressable>
        ))}
      </Sheet>
      <SyncPanel
        engine={engine}
        visible={syncOpen}
        onClose={() => setSyncOpen(false)}
        paused={paused}
        onPause={setPaused}
      />
    </View>
  );
}

function OfflineWorkspace({
  session,
  onUser,
  onLogout,
  isDark,
  toggleTheme,
}: {
  session: Session;
  onUser: (u: User) => void;
  onLogout: () => Promise<void>;
  isDark: boolean;
  toggleTheme: () => void;
}) {
  const [engine, setEngine] = useState<OfflineEngine | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let instance: OfflineEngine | undefined;
    setEngine(null);
    setError('');
    void OfflineEngine.open(session.client, session.user)
      .then(result => {
        instance = result;
        result.setOnline(false);
        if (active) setEngine(result);
        else result.dispose();
      })
      .catch(e => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
      instance?.dispose();
    };
  }, [session.client, session.user, retry]);
  if (!engine)
    return (
      <View style={[s.page, { flex: 1, justifyContent: 'center' }]}>
        {error ? (
          <Notice error message={error} onRetry={() => setRetry(v => v + 1)} />
        ) : (
          <ActivityIndicator size="large" color="#0891b2" />
        )}
      </View>
    );
  return (
    <Workspace
      engine={engine}
      onTenant={onUser}
      onLogout={onLogout}
      isDark={isDark}
      toggleTheme={toggleTheme}
    />
  );
}

export default function App() {
  const [inviteLink, setInviteLink] = useState('');
  useEffect(() => {
    const accept = (url: string | null | undefined) => {
      if (url && /^(https:\/\/[^/]+\/invite\/|zamzam:\/\/invite\/)/.test(url))
        setInviteLink(url);
    };
    void Linking.getInitialURL().then(accept);
    const listener = Linking.addEventListener('url', e => accept(e.url));
    return () => listener.remove();
  }, []);

  const system = useColorScheme();
  const [isDark, setDark] = useState(system === 'dark');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const [mode, theme] = await Promise.all([
        AsyncStorage.getItem('zamzam.mode'),
        AsyncStorage.getItem('zamzam.theme'),
      ]);
      if (theme && active) setDark(theme === 'dark');
      if (mode === 'demo') {
        const client = await DemoClient.create();
        if (active) setSession({ client, user: client.user });
      } else {
        const client = await ApiClient.restore();
        if (client) {
          const user = client.cachedUser || (await client.loadUser());
          if (active) setSession({ client, user });
        }
      }
    })()
      .catch(e => {
        if (active) setStartupError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (session?.client instanceof ApiClient)
      session.client.onExpired = () => {
        setSession(null);
        setStartupError(
          'انتهت صلاحية الجلسة. سجّل الدخول لمتابعة المزامنة. بياناتك المحلية محفوظة.',
        );
      };
  }, [session]);
  const ready = async (next: Session) => {
    await AsyncStorage.setItem(
      'zamzam.mode',
      next.client.demo ? 'demo' : 'account',
    );
    setStartupError('');
    setSession(next);
  };
  const logout = async () => {
    if (!session) return;
    try {
      await session.client.logout();
    } catch {
      /* Local sign-out still completes when the server cannot be reached. */
    }
    await AsyncStorage.removeItem('zamzam.mode');
    setSession(null);
  };
  const toggleTheme = () => {
    const next = !isDark;
    setDark(next);
    void AsyncStorage.setItem('zamzam.theme', next ? 'dark' : 'light');
  };
  const theme = isDark ? dark : light;
  return (
    <SafeAreaProvider>
      <Theme.Provider value={theme}>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.card, direction: 'ltr' }}
        >
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ActivityIndicator color={theme.cyan} size="large" />
            </View>
          ) : session?.user.tahfiz?.status === 'pending' ? (
            <PendingApproval
              client={session.client}
              user={session.user}
              onUser={user => setSession({ ...session, user })}
              onLogout={logout}
            />
          ) : session ? (
            <OfflineWorkspace
              key={`${session.client.accountKey}:${session.user.tahfiz_id}`}
              session={session}
              onUser={user => setSession({ ...session, user })}
              onLogout={logout}
              isDark={isDark}
              toggleTheme={toggleTheme}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.bg }}>
              {startupError ? (
                <View style={{ padding: 12 }}>
                  <Notice message={startupError} error />
                </View>
              ) : null}
              <Login
                onReady={ready}
                initialInvite={inviteLink}
                onInviteClose={() => setInviteLink('')}
              />
            </View>
          )}
          <Sheet
            visible={!!inviteLink && !!session}
            title="دعوة تحفيظ"
            onClose={() => setInviteLink('')}
          >
            {session && (
              <InvitationFlow
                client={session.client}
                initialLink={inviteLink}
                onBack={() => setInviteLink('')}
                onJoined={user => {
                  setSession({ ...session, user });
                  setInviteLink('');
                }}
              />
            )}
          </Sheet>
        </SafeAreaView>
      </Theme.Provider>
    </SafeAreaProvider>
  );
}
