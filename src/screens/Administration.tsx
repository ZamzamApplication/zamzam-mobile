import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import { canManage } from '../types';
import type {
  UserInfo,
  SheikhInfo,
  StudentCategory,
  StudentCustomField,
  StudentCustomFieldType,
} from '../domain-types';
import {
  Button,
  Card,
  Field,
  Notice,
  Select,
  Sheet,
  Toggle,
  Txt,
  s,
} from '../ui';
import { FeaturePage, useAction, useDraft } from './feature-ui';
export const roleLabels = {
  admin: 'مدير',
  sheikh: 'شيخ',
  auditor: 'مراجع مالي — القسم المالي فقط',
};
export const confirmAction = (
  title: string,
  message: string,
  run: () => void,
  destructive = false,
) =>
  Alert.alert(title, message, [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'تأكيد',
      style: destructive ? 'destructive' : 'default',
      onPress: run,
    },
  ]);
export function AdministrationScreen({
  engine,
  onBack,
  onInvitations,
  onRegistration,
  onPeople,
}: {
  engine: OfflineEngine;
  onBack: () => void;
  onInvitations: () => void;
  onRegistration: () => void;
  onPeople: () => void;
}) {
  const { data, online } = useEngine(engine),
    allowed = canManage(data.user);
  const [tab, setTab] = useState('users'),
    [query, setQuery] = useState('');
  const users = useResource<UserInfo[]>(engine, allowed ? '/users' : null),
    sheikhs = useResource<SheikhInfo[]>(engine, allowed ? '/sheikhs' : null),
    categories = useResource<StudentCategory[]>(
      engine,
      allowed ? '/student-categories' : null,
    ),
    fields = useResource<{ fields: StudentCustomField[]; can_create: boolean }>(
      engine,
      allowed ? '/student-custom-fields?include_inactive=true' : null,
    );
  const [user, setUser] = useState<UserInfo | 'new' | null>(null),
    [field, setField] = useState<StudentCustomField | 'new' | null>(null),
    [category, setCategory] = useState<StudentCategory | 'new' | null>(null),
    [name, setName] = useState('');
  const action = useAction(),
    reload = () => {
      users.reload();
      sheikhs.reload();
      categories.reload();
      fields.reload();
    };
  return (
    <FeaturePage
      engine={engine}
      title="الإدارة"
      onBack={onBack}
      loading={users.loading || fields.loading}
      error={
        users.error ||
        sheikhs.error ||
        categories.error ||
        fields.error ||
        action.error
      }
      reload={reload}
    >
      {!allowed ? (
        <Notice message="هذه الصفحة متاحة لمسؤولي التحفيظ فقط." />
      ) : (
        <>
          <View style={s.row}>
            <Button
              style={{ flex: 1 }}
              secondary
              title="الشيوخ والطلاب"
              onPress={onPeople}
            />
            <Button
              style={{ flex: 1 }}
              secondary
              title="دعوة مستخدم"
              onPress={onInvitations}
            />
          </View>
          <Button
            secondary
            title="تسجيل الطلاب والطلبات العامة"
            onPress={onRegistration}
            testID="admin-student-registration"
          />
          <Select
            label="القسم"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'users', label: 'المستخدمين' },
              { value: 'categories', label: 'تصنيفات الطلاب' },
              { value: 'fields', label: 'الحقول المخصصة' },
            ]}
            testID="admin-section"
          />
          <Field label="بحث" value={query} onChangeText={setQuery} />
          {tab === 'users' && (
            <>
              <Button
                title="إضافة مستخدم"
                onPress={() => setUser('new')}
                testID="admin-add-user"
              />
              {users.value
                ?.filter(u => u.username.includes(query))
                .map(u => (
                  <Card key={u.id}>
                    <View style={s.row}>
                      <Txt bold style={{ flex: 1 }}>
                        {u.username}
                      </Txt>
                      <Txt muted>{roleLabels[u.role]}</Txt>
                    </View>
                    {u.sheikh_id && (
                      <Txt muted>
                        الشيخ:{' '}
                        {sheikhs.value?.find(sh => sh.id === u.sheikh_id)
                          ?.name || u.sheikh_id}
                      </Txt>
                    )}
                    <View style={s.row}>
                      <Button
                        small
                        secondary
                        title="تعديل"
                        onPress={() => setUser(u)}
                        testID={`admin-user-${u.id}`}
                      />
                      <Button
                        small
                        secondary
                        title="إلغاء الوصول"
                        disabled={
                          !online || u.id === data.user.id || action.busy
                        }
                        onPress={() =>
                          confirmAction(
                            'إلغاء وصول المستخدم',
                            `${u.username} · سيُلغى وصوله إلى هذا التحفيظ.`,
                            () => {
                              void action.run(async () => {
                                await engine.publish(
                                  `/users/${u.id}`,
                                  undefined,
                                  'DELETE',
                                );
                                reload();
                              });
                            },
                            true,
                          )
                        }
                      />
                    </View>
                  </Card>
                ))}
            </>
          )}
          {tab === 'categories' && (
            <>
              <Button
                title="إضافة تصنيف"
                onPress={() => {
                  setName('');
                  setCategory('new');
                }}
                testID="admin-add-category"
              />
              {categories.value
                ?.filter(c => c.name.includes(query))
                .map(c => (
                  <Card key={c.id}>
                    <Txt bold>{c.name}</Txt>
                    <View style={s.row}>
                      <Button
                        small
                        secondary
                        title="تعديل التصنيف"
                        onPress={() => {
                          setName(c.name);
                          setCategory(c);
                        }}
                      />
                      <Button
                        small
                        secondary
                        title="حذف التصنيف"
                        disabled={!online || action.busy}
                        onPress={() =>
                          confirmAction(
                            'حذف التصنيف',
                            `${c.name} · يُزال التصنيف من الطلاب دون حذفهم.`,
                            () => {
                              void action.run(async () => {
                                await engine.publish(
                                  `/student-categories/${c.id}`,
                                  undefined,
                                  'DELETE',
                                );
                                reload();
                              });
                            },
                            true,
                          )
                        }
                      />
                    </View>
                  </Card>
                ))}
            </>
          )}
          {tab === 'fields' && (
            <>
              <Button
                title="إضافة حقل مخصص"
                onPress={() => setField('new')}
                testID="admin-add-field"
              />
              {fields.value?.fields
                .filter(f => f.name.includes(query))
                .map(f => (
                  <Card key={f.id}>
                    <Txt bold>{f.name}</Txt>
                    <Txt muted>
                      {f.field_type} · {f.is_required ? 'إلزامي' : 'اختياري'} ·{' '}
                      {f.is_active ? 'مفعل' : 'معطل'}
                    </Txt>
                    <Button
                      secondary
                      small
                      title="تعديل الحقل"
                      onPress={() => setField(f)}
                    />
                  </Card>
                ))}
            </>
          )}
          <Sheet
            visible={!!user}
            title={user === 'new' ? 'إضافة مستخدم جديد' : 'تعديل المستخدم'}
            onClose={() => setUser(null)}
          >
            {user && (
              <UserEditor
                key={typeof user === 'string' ? 'new' : user.id}
                engine={engine}
                user={user === 'new' ? undefined : user}
                sheikhs={sheikhs.value || []}
                onSaved={() => {
                  setUser(null);
                  reload();
                }}
              />
            )}
          </Sheet>
          <Sheet
            visible={!!category}
            title={category === 'new' ? 'إضافة تصنيف' : 'تعديل التصنيف'}
            onClose={() => setCategory(null)}
          >
            <Field
              label="اسم التصنيف"
              value={name}
              onChangeText={setName}
              testID="category-name"
            />
            <Button
              title="حفظ"
              disabled={!online || !name.trim()}
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  await engine.publish(
                    category === 'new'
                      ? '/student-categories'
                      : `/student-categories/${
                          (category as StudentCategory).id
                        }`,
                    { name: name.trim() },
                    category === 'new' ? 'POST' : 'PUT',
                  );
                  setCategory(null);
                  reload();
                });
              }}
              testID="category-save"
            />
            {action.error && <Notice error message={action.error} />}
          </Sheet>
          <Sheet
            visible={!!field}
            title={field === 'new' ? 'إضافة حقل مخصص' : 'تعديل الحقل'}
            onClose={() => setField(null)}
          >
            {field && (
              <CustomFieldEditor
                key={typeof field === 'string' ? 'new' : field.id}
                engine={engine}
                field={field === 'new' ? undefined : field}
                onSaved={() => {
                  setField(null);
                  reload();
                }}
              />
            )}
          </Sheet>
        </>
      )}
    </FeaturePage>
  );
}
function UserEditor({
  engine,
  user,
  sheikhs,
  onSaved,
}: {
  engine: OfflineEngine;
  user?: UserInfo;
  sheikhs: SheikhInfo[];
  onSaved: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction(),
    [password, setPassword] = useState('');
  const draft = useDraft(engine, `admin-user:${user?.id || 'new'}`, {
    username: user?.username || '',
    role: user?.role || 'sheikh',
    sheikh_id: user?.sheikh_id ? String(user.sheikh_id) : '',
  });
  const v = draft.value;
  return (
    <>
      <Field
        label="اسم المستخدم"
        value={v.username}
        onChangeText={username => draft.change({ username })}
        autoCapitalize="none"
        testID="user-name"
      />
      <Field
        label={user ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور'}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        testID="user-password"
      />
      <Select
        label="الدور"
        value={v.role}
        onChange={role => draft.change({ role: role as UserInfo['role'] })}
        options={Object.entries(roleLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      {v.role === 'sheikh' && (
        <Select
          label="الشيخ المرتبط"
          value={v.sheikh_id}
          onChange={sheikh_id => draft.change({ sheikh_id })}
          options={[
            { value: '', label: 'دون ارتباط' },
            ...sheikhs.map(sh => ({ value: String(sh.id), label: sh.name })),
          ]}
        />
      )}
      <Notice message="الدور والشيخ المرتبط يحددان وصول المستخدم. كلمة المرور الجديدة تغيّر حسابه وتسجّل خروجه من أجهزته، ولا تُحفظ في المسودات." />
      <Button
        title={user ? 'حفظ' : 'إضافة'}
        disabled={!online}
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (v.username.trim().length < 3 || v.username.trim().length > 50)
              throw new Error('اسم المستخدم من 3 إلى 50 حرفاً.');
            if (
              (!user || password) &&
              (password.length < 8 || password.length > 200)
            )
              throw new Error('كلمة المرور من 8 إلى 200 حرف.');
            await engine.publish(
              user ? `/users/${user.id}` : '/users',
              {
                username: v.username.trim(),
                role: v.role,
                sheikh_id:
                  v.role === 'sheikh' && v.sheikh_id
                    ? Number(v.sheikh_id)
                    : null,
                ...(password ? { password } : {}),
              },
              user ? 'PUT' : 'POST',
            );
            setPassword('');
            await draft.clear();
            onSaved();
          });
        }}
        testID="user-save"
      />
      {(action.error || draft.error) && (
        <Notice error message={action.error || draft.error} />
      )}
    </>
  );
}
export function CustomFieldEditor({
  engine,
  field,
  onSaved,
}: {
  engine: OfflineEngine;
  field?: StudentCustomField;
  onSaved: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction(),
    draft = useDraft(engine, `admin-field:${field?.id || 'new'}`, {
      name: field?.name || '',
      field_type: field?.field_type || 'text',
      options: (field?.options || []).join('\n'),
      is_required: field?.is_required || false,
      is_active: field?.is_active ?? true,
    });
  const v = draft.value;
  return (
    <>
      <Field
        label="اسم الحقل"
        value={v.name}
        onChangeText={name => draft.change({ name })}
        testID="custom-field-name"
      />
      <Select
        label="نوع الحقل"
        value={v.field_type}
        onChange={field_type =>
          draft.change({ field_type: field_type as StudentCustomFieldType })
        }
        options={[
          { value: 'text', label: 'نص' },
          { value: 'number', label: 'رقم' },
          { value: 'date', label: 'تاريخ' },
          { value: 'checkbox', label: 'نعم / لا' },
          { value: 'select', label: 'قائمة اختيار' },
        ]}
      />
      {v.field_type === 'select' && (
        <Field
          label="الخيارات (خيار في كل سطر)"
          value={v.options}
          onChangeText={options => draft.change({ options })}
          multiline
        />
      )}
      <Toggle
        title="حقل إلزامي"
        value={v.is_required}
        onChange={is_required => draft.change({ is_required })}
      />
      {field && (
        <Toggle
          title="تفعيل الحقل"
          value={v.is_active}
          onChange={is_active => draft.change({ is_active })}
        />
      )}
      <Button
        title="حفظ الحقل"
        disabled={!online || !v.name.trim()}
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            const options =
              v.field_type === 'select'
                ? [
                    ...new Set(
                      v.options
                        .split('\n')
                        .map(o => o.trim())
                        .filter(Boolean),
                    ),
                  ]
                : [];
            if (v.field_type === 'select' && !options.length)
              throw new Error('أضف خياراً واحداً على الأقل.');
            await engine.publish(
              field
                ? `/student-custom-fields/${field.id}`
                : '/student-custom-fields',
              {
                name: v.name.trim(),
                field_type: v.field_type,
                options,
                is_required: v.is_required,
                ...(field ? { is_active: v.is_active } : {}),
              },
              field ? 'PUT' : 'POST',
            );
            await draft.clear();
            onSaved();
          });
        }}
        testID="custom-field-save"
      />
      {(action.error || draft.error) && (
        <Notice error message={action.error || draft.error} />
      )}
    </>
  );
}
