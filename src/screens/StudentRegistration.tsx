import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Share, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { Button, Card, Field, Notice, Select, Sheet, Toggle, Txt } from '../ui';
import { FeaturePage, useAction } from './feature-ui';
import { CustomFieldEditor } from './Administration';
import type {
  RegistrationField,
  RegistrationForm,
  RegistrationRequest,
} from '../student-registration';
import { REGISTRATION_API as base } from '../student-registration';

function Qr({ url }: { url: string }) {
  const code = qrcode(0, 'M');
  code.addData(url);
  code.make();
  const size = code.getModuleCount(),
    paths: string[] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (code.isDark(r, c)) paths.push(`M${c + 4},${r + 4}h1v1h-1z`);
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg
        accessibilityLabel="رمز التسجيل QR"
        width={240}
        height={240}
        viewBox={`0 0 ${size + 8} ${size + 8}`}
      >
        <Rect width={size + 8} height={size + 8} fill="white" />
        <Path d={paths.join('')} fill="#102b36" />
      </Svg>
    </View>
  );
}
export function RegistrationNotification({
  engine,
  onOpen,
}: {
  engine: OfflineEngine;
  onOpen: () => void;
}) {
  const { online, data } = useEngine(engine);
  const [count, setCount] = useState(0);
  const allowed = ['admin', 'super_admin'].includes(data.user.role);
  useEffect(() => {
    let live = true;
    setCount(0);
    if (!allowed || !online || engine.client.demo) return;
    const load = () =>
      engine
        .request<{ pending_count: number }>(`${base}/notifications`)
        .then(result => {
          if (live) setCount(result.pending_count);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [engine, online, allowed]);
  return count ? (
    <View style={{ paddingHorizontal: 12 }}>
      <Button
        secondary
        title={`طلبات تسجيل جديدة (${count}) · مراجعة`}
        onPress={onOpen}
      />
    </View>
  ) : null;
}

export function RegistrationScreen({
  engine,
  onBack,
}: {
  engine: OfflineEngine;
  onBack: () => void;
}) {
  const { online, data } = useEngine(engine),
    action = useAction();
  const [forms, setForms] = useState<RegistrationForm[]>([]),
    [rows, setRows] = useState<RegistrationRequest[]>([]),
    [fields, setFields] = useState<RegistrationField[]>([]),
    [sheikhs, setSheikhs] = useState<{ id: number; name: string }[]>([]);
  const [status, setStatus] = useState('pending'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [form, setForm] = useState<RegistrationForm | 'new' | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [publicIds, setPublicIds] = useState<number[]>([]),
    [active, setActive] = useState(true),
    [newField, setNewField] = useState(false);
  const [qrForm, setQrForm] = useState<RegistrationForm | null>(null),
    [selected, setSelected] = useState<RegistrationRequest | null>(null);
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [birthday, setBirthday] = useState(''),
    [studentId, setStudentId] = useState(''),
    [sheikh, setSheikh] = useState(''),
    [values, setValues] = useState<Record<string, string>>({});
  const allowed = ['admin', 'super_admin'].includes(data.user.role);
  const load = useCallback(async () => {
    if (!allowed || !online || engine.client.demo) return;
    try {
      const [f, r, custom, teachers] = await Promise.all([
        engine.request<RegistrationForm[]>(`${base}/forms`),
        engine.request<RegistrationRequest[]>(
          `${base}/requests?status=${status}`,
        ),
        engine.request<{ fields: RegistrationField[] }>(
          '/student-custom-fields',
        ),
        engine.request<{ id: number; name: string }[]>('/sheikhs'),
      ]);
      setForms(f);
      setRows(r);
      setFields(custom.fields);
      setSheikhs(teachers);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل التسجيل');
    }
  }, [engine, online, allowed, status]);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const openForm = (v: RegistrationForm | 'new') => {
    setForm(v);
    setTitle(v === 'new' ? 'طلب الالتحاق بالتحفيظ' : v.title);
    setDescription(v === 'new' ? '' : v.description);
    setPublicIds(v === 'new' ? [] : v.public_field_ids);
    setActive(v === 'new' || v.is_active);
  };
  const openApproval = (r: RegistrationRequest) => {
    setSelected(r);
    setName(r.name);
    setPhone(r.phone || '');
    setBirthday(r.birthday || '');
    setStudentId('');
    setSheikh('');
    setValues(
      Object.fromEntries(
        Object.entries(r.answers)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)]),
      ),
    );
  };
  const writable = online && !engine.client.demo && allowed;
  return (
    <FeaturePage
      engine={engine}
      title="التسجيل العام للطلاب"
      onBack={onBack}
      reload={() => void load()}
      error={error || action.error}
    >
      {!allowed ? (
        <Notice error message="هذه الصفحة متاحة لإدارة التحفيظ فقط." />
      ) : (
        <>
          {engine.client.demo && (
            <Notice message="التسجيل العام متاح عند الاتصال بحساب تحفيظ حقيقي." />
          )}
          {notice && <Notice message={notice} />}
          <Card>
            <Txt bold>رابط واحد لاستقبال الطلاب</Txt>
            <Txt muted>
              أنشئ نموذجاً، واختر ما يملؤه الطالب وما تستكمله الإدارة. نموذج
              الطالب يعمل على أي هاتف دون حساب.
            </Txt>
            <Button
              title="إنشاء نموذج تسجيل"
              disabled={!writable || action.busy}
              onPress={() => openForm('new')}
            />
            <Button
              secondary
              title="إضافة حقل مخصص"
              disabled={!writable || action.busy}
              onPress={() => setNewField(true)}
            />
          </Card>
          {forms.map(f => (
            <Card key={f.id}>
              <Txt bold>{f.title}</Txt>
              <Txt muted>
                {f.is_active ? 'استقبال الطلبات مفتوح' : 'التسجيل مغلق'}
              </Txt>
              <Button
                secondary
                title="QR ومشاركة وطباعة"
                onPress={() => setQrForm(f)}
              />
              <Button
                secondary
                title="تعديل النموذج والحقول"
                disabled={!writable || action.busy}
                onPress={() => openForm(f)}
              />
              <Button
                secondary
                title={f.is_active ? 'إغلاق التسجيل' : 'فتح التسجيل'}
                disabled={!writable}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await engine.request(`${base}/forms/${f.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ ...f, is_active: !f.is_active }),
                    });
                    await load();
                  });
                }}
              />
            </Card>
          ))}
          <Select
            label={`طلبات التسجيل (${rows.length})`}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pending', label: 'بانتظار المراجعة' },
              { value: 'approved', label: 'مقبولة' },
              { value: 'rejected', label: 'مرفوضة' },
            ]}
          />
          {!rows.length && <Txt muted>لا توجد طلبات بهذه الحالة.</Txt>}
          {rows.map(r => (
            <Card key={r.id}>
              <Txt bold>{r.name}</Txt>
              <Txt muted>
                {r.phone || 'بدون رقم تواصل'} ·{' '}
                {new Date(r.created_at).toLocaleDateString('ar-EG')}
              </Txt>
              {r.fields.map(f => (
                <Txt key={f.id}>
                  {f.name}:{' '}
                  {r.answers[f.id] === 'true'
                    ? 'نعم'
                    : r.answers[f.id] === 'false'
                    ? 'لا'
                    : r.answers[f.id] || '—'}
                </Txt>
              ))}
              {r.status === 'pending' && (
                <>
                  <Button
                    title="قبول واستكمال البيانات"
                    disabled={!writable || action.busy}
                    onPress={() => openApproval(r)}
                  />
                  <Button
                    secondary
                    title="رفض الطلب"
                    disabled={!writable || action.busy}
                    onPress={() =>
                      Alert.alert('رفض الطلب', `رفض طلب ${r.name}؟`, [
                        { text: 'إلغاء', style: 'cancel' },
                        {
                          text: 'رفض',
                          style: 'destructive',
                          onPress: () => {
                            void action.run(async () => {
                              await engine.request(
                                `${base}/requests/${r.id}/reject`,
                                { method: 'POST' },
                              );
                              await load();
                            });
                          },
                        },
                      ])
                    }
                  />
                </>
              )}
            </Card>
          ))}
          <Sheet
            visible={!!form}
            title="نموذج التسجيل"
            onClose={() => {
              if (!action.busy) setForm(null);
            }}
          >
            <Field
              label="عنوان النموذج"
              maxLength={120}
              value={title}
              onChangeText={setTitle}
            />
            <Field
              label="نص الترحيب والملصق"
              multiline
              maxLength={2000}
              value={description}
              onChangeText={setDescription}
            />
            <Txt muted>
              الاسم ورقم التواصل وتاريخ الميلاد تظهر تلقائياً. فعّل الحقول التي
              يملؤها الطالب؛ البقية تستكملها الإدارة عند القبول.
            </Txt>
            {fields.map(f => (
              <Toggle
                key={f.id}
                title={f.name}
                value={publicIds.includes(f.id)}
                onChange={v =>
                  setPublicIds(ids =>
                    v ? [...ids, f.id] : ids.filter(id => id !== f.id),
                  )
                }
              />
            ))}
            <Toggle
              title="استقبال الطلبات"
              value={active}
              onChange={setActive}
            />
            <Button
              title="حفظ النموذج"
              busy={action.busy}
              disabled={!writable || !title.trim()}
              onPress={() => {
                void action.run(async () => {
                  await engine.request(
                    `${base}/forms${
                      form && form !== 'new' ? `/${form.id}` : ''
                    }`,
                    {
                      method: form === 'new' ? 'POST' : 'PUT',
                      body: JSON.stringify({
                        title,
                        description,
                        public_field_ids: publicIds,
                        is_active: active,
                      }),
                    },
                  );
                  setForm(null);
                  await load();
                });
              }}
            />
            {action.error && <Notice error message={action.error} />}
          </Sheet>
          <Sheet
            visible={newField}
            title="حقل مخصص جديد"
            onClose={() => setNewField(false)}
          >
            {newField && (
              <CustomFieldEditor
                engine={engine}
                onSaved={() => {
                  setNewField(false);
                  void load();
                }}
              />
            )}
          </Sheet>
          <Sheet
            visible={!!qrForm}
            title="رمز التسجيل وملصق الطباعة"
            onClose={() => setQrForm(null)}
          >
            {qrForm && (
              <>
                <Txt bold>{qrForm.title}</Txt>
                <Qr url={qrForm.url} />
                <Txt selectable>{qrForm.url}</Txt>
                <Button
                  title="مشاركة رابط التسجيل"
                  onPress={() => {
                    void action.run(async () => {
                      await Share.share({
                        message: `${qrForm.title}\n${qrForm.url}`,
                      });
                    });
                  }}
                />
                <Button
                  secondary
                  title="فتح الملصق للطباعة / حفظ PDF"
                  onPress={() => {
                    void action.run(async () => {
                      await Linking.openURL(qrForm.print_url);
                    });
                  }}
                />
                <Button
                  secondary
                  title="معاينة نموذج الطالب"
                  onPress={() => {
                    void action.run(async () => {
                      await Linking.openURL(qrForm.url);
                    });
                  }}
                />
                {action.error && <Notice error message={action.error} />}
              </>
            )}
          </Sheet>
          <Sheet
            visible={!!selected}
            title="قبول الطالب واستكمال بياناته"
            onClose={() => {
              if (!action.busy) setSelected(null);
            }}
          >
            <Txt muted>
              يُضاف الطالب عند تأكيد القبول بعد حفظ الشيخ والبيانات التالية.
            </Txt>
            <Field
              label="اسم الطالب *"
              maxLength={100}
              value={name}
              onChangeText={setName}
            />
            <Field
              label="رقم التواصل"
              maxLength={20}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Field
              label="تاريخ الميلاد (YYYY-MM-DD)"
              value={birthday}
              onChangeText={setBirthday}
            />
            <Field
              label="الرقم التعريفي"
              maxLength={50}
              value={studentId}
              onChangeText={setStudentId}
            />
            <Select
              label="الشيخ"
              value={sheikh}
              onChange={setSheikh}
              options={[
                { value: '', label: 'بدون شيخ حالياً' },
                ...sheikhs.map(s => ({ value: String(s.id), label: s.name })),
              ]}
            />
            {fields.map(f =>
              f.field_type === 'select' || f.field_type === 'checkbox' ? (
                <Select
                  key={f.id}
                  label={`${f.name}${f.is_required ? ' *' : ''}`}
                  value={values[f.id] || ''}
                  onChange={v => setValues(old => ({ ...old, [f.id]: v }))}
                  options={[
                    { value: '', label: 'اختر' },
                    ...(f.field_type === 'checkbox'
                      ? [
                          { value: 'true', label: 'نعم' },
                          { value: 'false', label: 'لا' },
                        ]
                      : f.options.map(v => ({ value: v, label: v }))),
                  ]}
                />
              ) : (
                <Field
                  key={f.id}
                  label={`${f.name}${f.is_required ? ' *' : ''}${
                    f.field_type === 'date' ? ' (YYYY-MM-DD)' : ''
                  }`}
                  value={values[f.id] || ''}
                  onChangeText={v => setValues(old => ({ ...old, [f.id]: v }))}
                  keyboardType={
                    f.field_type === 'number' ? 'numeric' : 'default'
                  }
                />
              ),
            )}
            <Button
              title="تأكيد القبول وإضافة الطالب"
              disabled={!writable || !name.trim()}
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  if (!selected) return;
                  await engine.request(
                    `${base}/requests/${selected.id}/approve`,
                    {
                      method: 'POST',
                      body: JSON.stringify({
                        student: {
                          name,
                          phone: phone || null,
                          birthday: birthday || null,
                          student_id: studentId || null,
                          sheikh_id: sheikh ? Number(sheikh) : null,
                          custom_field_values: Object.fromEntries(
                            Object.entries(values).filter(([key]) =>
                              fields.some(f => f.id === Number(key)),
                            ),
                          ),
                        },
                      }),
                    },
                  );
                  setSelected(null);
                  setNotice('تم قبول الطلب وإضافة الطالب');
                  await load();
                  await engine.sync();
                });
              }}
            />
            {action.error && <Notice error message={action.error} />}
          </Sheet>
        </>
      )}
    </FeaturePage>
  );
}
