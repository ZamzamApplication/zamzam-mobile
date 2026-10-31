import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ApiClient, API_URL } from '../api';
import type { Gateway, User } from '../types';
import type { OfflineEngine } from '../offline/engine';
import { invitationToken, initialSetup, validateSetup } from '../registration';
import type { InitialSetup } from '../registration';
import { majorToMinor, minorToInput } from '../finance';
import {
  Button,
  Card,
  Field,
  Heading,
  Notice,
  Select,
  Toggle,
  Txt,
  s,
} from '../ui';
import { useAction } from './feature-ui';
export function SetupFields({
  value,
  change,
}: {
  value: InitialSetup;
  change: (v: InitialSetup) => void;
}) {
  const [statusText, setStatusText] = useState(
    value.attendance_statuses.join('\n'),
  );
  const [sessionText, setSessionText] = useState(
    value.session_name_options.join('\n'),
  );
  const [fee, setFee] = useState(
    minorToInput(value.subscription_default_fee_minor),
  );
  const options = (values: string[]) =>
    values.map(v => ({ value: v, label: v }));
  const lines = (v: string) => [
    ...new Set(
      v
        .split('\n')
        .map(w => w.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <>
      <Heading title="إعدادات التحفيظ الأولية" />
      <Field
        label="حالات الحضور (حالة في كل سطر)"
        value={statusText}
        onChangeText={v => {
          setStatusText(v);
          change({ ...value, attendance_statuses: lines(v) });
        }}
        multiline
      />
      <Select
        label="حالة الحضور"
        value={value.present_status}
        onChange={present_status => change({ ...value, present_status })}
        options={options(value.attendance_statuses)}
      />
      <Select
        label="حالة الغياب"
        value={value.absent_status}
        onChange={absent_status => change({ ...value, absent_status })}
        options={options(value.attendance_statuses)}
      />
      <Field
        label="أسماء الحلقات (اسم في كل سطر)"
        value={sessionText}
        onChangeText={v => {
          setSessionText(v);
          change({ ...value, session_name_options: lines(v) });
        }}
        multiline
      />
      <Field
        label="بداية الشهر (1–28)"
        value={String(value.month_start_day)}
        keyboardType="numeric"
        onChangeText={v => change({ ...value, month_start_day: Number(v) })}
      />
      <Toggle
        title="تفعيل الاشتراكات"
        value={value.subscriptions_enabled}
        onChange={subscriptions_enabled =>
          change({ ...value, subscriptions_enabled })
        }
      />
      {value.subscriptions_enabled && (
        <>
          <Field
            label="الرسم الشهري الافتراضي"
            value={fee}
            keyboardType="decimal-pad"
            onChangeText={v => {
              setFee(v);
              change({
                ...value,
                subscription_default_fee_minor: majorToMinor(v) ?? -1,
              });
            }}
          />
          <Select
            label="العملة"
            value={value.subscription_currency}
            onChange={subscription_currency =>
              change({ ...value, subscription_currency })
            }
            options={['EGP', 'SAR', 'USD'].map(v => ({ value: v, label: v }))}
          />
        </>
      )}
      <Toggle
        title="تفعيل متابعة القرآن"
        value={value.progress_tracking_enabled}
        onChange={progress_tracking_enabled =>
          change({ ...value, progress_tracking_enabled })
        }
      />
    </>
  );
}
export function SignupFlow({
  endpoint = API_URL,
  onBack,
}: {
  endpoint?: string;
  onBack: () => void;
}) {
  const action = useAction(),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [setup, setSetup] = useState(initialSetup),
    [step, setStep] = useState(1),
    [done, setDone] = useState(false);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
    >
      <Heading title="إنشاء حساب وتحفيظ جديد" />
      <Button secondary small title="تسجيل الدخول" onPress={onBack} />
      {done ? (
        <Card>
          <Txt bold>تم إرسال طلب إنشاء التحفيظ</Txt>
          <Notice message="طلبك بانتظار مراجعة إدارة المنصة. سجّل الدخول بعد الموافقة لمتابعة العمل." />
        </Card>
      ) : (
        <Card>
          {step === 1 ? (
            <>
              <Field
                label="اسم التحفيظ"
                value={name}
                onChangeText={setName}
                testID="signup-tahfiz"
              />
              <Field
                label="رقم التواصل"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Field
                label="اسم المستخدم"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                testID="signup-username"
              />
              <Field
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="signup-password"
              />
              <Button
                title="التالي — إعدادات التحفيظ"
                onPress={() => {
                  void action.run(async () => {
                    if (
                      name.trim().length < 2 ||
                      username.trim().length < 3 ||
                      password.length < 8
                    )
                      throw new Error(
                        'اسم التحفيظ حرفان على الأقل، واسم المستخدم 3 أحرف، وكلمة المرور 8 أحرف.',
                      );
                    setStep(2);
                  });
                }}
                testID="signup-next"
              />
            </>
          ) : (
            <>
              <SetupFields value={setup} change={setSetup} />
              <Notice message="سيُنشأ التحفيظ بحالة بانتظار المراجعة، كما في الموقع." />
              <Button
                title="إرسال طلب التسجيل"
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    validateSetup(setup);
                    await ApiClient.publicRequest(
                      '/auth/signup',
                      {
                        ...setup,
                        tahfiz_name: name.trim(),
                        contact_phone: phone.trim() || null,
                        username: username.trim(),
                        password,
                      },
                      endpoint,
                    );
                    setPassword('');
                    setDone(true);
                  });
                }}
                testID="signup-submit"
              />
              <Button secondary title="السابق" onPress={() => setStep(1)} />
            </>
          )}
          {action.error && <Notice error message={action.error} />}
        </Card>
      )}
    </ScrollView>
  );
}
interface InvitePreview {
  tahfiz_id: number;
  tahfiz_name: string;
  role: string;
  sheikh_name?: string;
  status: string;
  available?: boolean;
}
export function InvitationFlow({
  client,
  initialLink = '',
  endpoint = API_URL,
  onBack,
  onReady,
  onJoined,
  onExisting,
}: {
  client?: Gateway;
  initialLink?: string;
  endpoint?: string;
  onBack: () => void;
  onReady?: (s: { client: Gateway; user: User }) => Promise<void>;
  onJoined?: (user: User) => void;
  onExisting?: () => void;
}) {
  const [link, setLink] = useState(initialLink),
    [token, setToken] = useState(''),
    [preview, setPreview] = useState<InvitePreview | null>(null),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [created, setCreated] = useState(false),
    [joined, setJoined] = useState(false),
    action = useAction();
  return (
    <View style={{ gap: 12 }}>
      <Heading title="الانضمام بدعوة" />
      <Field
        label="رابط الدعوة أو الرمز"
        value={link}
        onChangeText={v => {
          setLink(v);
          setPreview(null);
          setToken('');
        }}
        autoCapitalize="none"
        testID="invite-link"
      />
      <Button
        secondary
        title="عرض الدعوة"
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            const t = invitationToken(link);
            setPreview(null);
            setToken('');
            const p = client?.demo
              ? await client.request<InvitePreview>(`/invitations/preview/${t}`)
              : await ApiClient.publicRequest<InvitePreview>(
                  `/invitations/preview/${t}`,
                  undefined,
                  endpoint,
                );
            setToken(t);
            setPreview(p);
            setCreated(false);
            setJoined(false);
          });
        }}
        testID="invite-preview"
      />
      {preview && (
        <Card>
          <Txt bold>{preview.tahfiz_name}</Txt>
          <Txt>
            {preview.role === 'admin' ? 'مدير' : 'شيخ'}
            {preview.sheikh_name ? ` · ${preview.sheikh_name}` : ''}
          </Txt>
          <Txt muted>حالة الدعوة: {preview.status}</Txt>
          {preview.status !== 'active' || preview.available === false ? (
            <Notice
              error
              message="هذه الدعوة منتهية أو مستخدمة أو غير متاحة."
            />
          ) : joined ? (
            <Notice message="تم الانضمام بنجاح." />
          ) : client ? (
            <Button
              title="قبول الدعوة والانضمام"
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  const result = await client.request<{ tahfiz_id: number }>(
                    `/invitations/accept/${token}`,
                    { method: 'POST' },
                  );
                  setJoined(true);
                  const user = await client.switchTenant(result.tahfiz_id);
                  onJoined?.(user);
                });
              }}
              testID="invite-accept"
            />
          ) : (
            <>
              <Field
                label="اسم المستخدم"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                testID="invite-username"
              />
              <Field
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                testID="invite-password"
              />
              {created && (
                <Notice message="تم إنشاء الحساب. يمكنك تسجيل الدخول دون إعادة استهلاك الدعوة." />
              )}
              <Button
                title={created ? 'تسجيل الدخول' : 'إنشاء حساب جديد والانضمام'}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    if (username.trim().length < 3 || password.length < 8)
                      throw new Error(
                        'اسم المستخدم 3 أحرف وكلمة المرور 8 أحرف على الأقل.',
                      );
                    if (!created) {
                      await ApiClient.publicRequest(
                        `/invitations/register/${token}`,
                        { username: username.trim(), password },
                        endpoint,
                      );
                      setCreated(true);
                    }
                    const next = await ApiClient.login(
                      username,
                      password,
                      endpoint,
                    );
                    const user = await next.loadUser();
                    setPassword('');
                    await onReady?.({ client: next, user });
                  });
                }}
                testID="invite-register"
              />
              <Button
                secondary
                title="لدي حساب — تسجيل الدخول"
                onPress={onExisting || onBack}
              />
            </>
          )}
        </Card>
      )}
      {action.error && <Notice error message={action.error} />}
      <Button secondary title="رجوع" onPress={onBack} />
    </View>
  );
}
export function CreateTahfizFlow({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const action = useAction(),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [setup, setSetup] = useState(initialSetup),
    [done, setDone] = useState(false);
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
    >
      <Heading title="إنشاء تحفيظ جديد" />
      <Button secondary small title="رجوع" onPress={onBack} />
      {done ? (
        <Notice message="تم إرسال الطلب. تحفيظك الجديد بانتظار الموافقة، ويمكنك متابعة العمل في التحفيظ الحالي." />
      ) : (
        <Card>
          <Field
            label="اسم التحفيظ"
            value={name}
            onChangeText={setName}
            testID="new-tahfiz-name"
          />
          <Field label="رقم التواصل" value={phone} onChangeText={setPhone} />
          <SetupFields value={setup} change={setSetup} />
          <Button
            title="إرسال طلب إنشاء التحفيظ"
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (name.trim().length < 2)
                  throw new Error('اسم التحفيظ حرفان على الأقل.');
                validateSetup(setup);
                await engine.publish('/auth/tahfiz', {
                  ...setup,
                  name: name.trim(),
                  contact_phone: phone.trim() || null,
                });
                setDone(true);
              });
            }}
            testID="new-tahfiz-submit"
          />
          {action.error && <Notice error message={action.error} />}
        </Card>
      )}
    </ScrollView>
  );
}
