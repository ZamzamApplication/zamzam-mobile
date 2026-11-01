import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { ApiClient, errorMessage } from '../api';
import type { PublicRegistration } from '../student-registration';
import { REGISTRATION_API } from '../student-registration';
import {
  Button,
  Card,
  Field,
  Heading,
  Notice,
  Select,
  Txt,
  s,
  useTheme,
} from '../ui';
import { useAction } from './feature-ui';

export function PublicStudentRegistration({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const t = useTheme();
  const [form, setForm] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const action = useAction();
  const path = `${REGISTRATION_API}/public/${encodeURIComponent(token)}`;
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    ApiClient.publicRequest<PublicRegistration>(path)
      .then(value => {
        if (current) setForm(value);
      })
      .catch(e => {
        if (current) setError(errorMessage(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, reload]);
  const submit = () => {
    void action.run(async () => {
      if (!form || done) return;
      if (!name.trim()) throw new Error('أدخل اسم الطالب.');
      for (const field of form.fields) {
        if (field.is_required && !answers[field.id]?.trim())
          throw new Error(`أكمل حقل ${field.name}.`);
      }
      await ApiClient.publicRequest(path, {
        name: name.trim(),
        phone: phone.trim() || null,
        birthday: birthday.trim() || null,
        website: '',
        answers,
      });
      setDone(true);
      setName('');
      setPhone('');
      setBirthday('');
      setAnswers({});
    });
  };
  return (
    <ScrollView
      contentContainerStyle={s.page}
      keyboardShouldPersistTaps="handled"
      testID="public-registration"
    >
      <Heading
        title={form?.title || 'تسجيل طالب جديد'}
        action={<Button small secondary title="رجوع" onPress={onBack} />}
      />
      {loading && <ActivityIndicator color={t.cyan} />}
      {error ? (
        <Notice error message={error} onRetry={() => setReload(v => v + 1)} />
      ) : null}
      {done ? (
        <Card>
          <Heading title="تم إرسال الطلب بنجاح" />
          <Txt>
            وصل طلب التسجيل إلى إدارة التحفيظ. تسجيل الطالب النهائي يتم بعد
            موافقة الإدارة.
          </Txt>
          <Button secondary title="إغلاق" onPress={onBack} />
        </Card>
      ) : (
        form && (
          <Card>
            <Txt bold>{form.tahfiz_name}</Txt>
            {form.description ? <Txt muted>{form.description}</Txt> : null}
            <Field
              label="اسم الطالب *"
              value={name}
              onChangeText={setName}
              maxLength={100}
              editable={!action.busy}
              testID="public-registration-name"
            />
            <Field
              label="رقم التواصل"
              value={phone}
              onChangeText={setPhone}
              maxLength={20}
              keyboardType="phone-pad"
              editable={!action.busy}
            />
            <Field
              label="تاريخ الميلاد (YYYY-MM-DD)"
              value={birthday}
              onChangeText={setBirthday}
              maxLength={10}
              editable={!action.busy}
            />
            {form.fields.map(field => {
              const value = answers[field.id] || '';
              const change = (v: string) =>
                setAnswers(previous => ({ ...previous, [field.id]: v }));
              const label = `${field.name}${field.is_required ? ' *' : ''}`;
              return field.field_type === 'select' ||
                field.field_type === 'checkbox' ? (
                <Select
                  key={field.id}
                  label={label}
                  value={value}
                  onChange={change}
                  disabled={action.busy}
                  options={[
                    { value: '', label: 'اختر' },
                    ...(field.field_type === 'checkbox'
                      ? [
                          { value: 'true', label: 'نعم' },
                          { value: 'false', label: 'لا' },
                        ]
                      : field.options.map(option => ({
                          value: option,
                          label: option,
                        }))),
                  ]}
                />
              ) : (
                <Field
                  key={field.id}
                  label={
                    field.field_type === 'date'
                      ? `${label} (YYYY-MM-DD)`
                      : label
                  }
                  value={value}
                  onChangeText={change}
                  keyboardType={
                    field.field_type === 'number' ? 'decimal-pad' : 'default'
                  }
                  maxLength={field.field_type === 'text' ? 2000 : undefined}
                  editable={!action.busy}
                />
              );
            })}
            <Txt muted>
              بإرسال الطلب، توافق على مشاركة هذه البيانات مع إدارة التحفيظ لغرض
              التسجيل.
            </Txt>
            {action.error ? <Notice error message={action.error} /> : null}
            <Button
              title="إرسال طلب التسجيل"
              busy={action.busy}
              disabled={!name.trim()}
              onPress={submit}
              testID="public-registration-submit"
            />
            {action.error ? (
              <Txt muted>
                إذا انقطع الاتصال بعد الإرسال، تحقق من وصول الطلب قبل إرساله مرة
                أخرى.
              </Txt>
            ) : null}
          </Card>
        )
      )}
    </ScrollView>
  );
}
