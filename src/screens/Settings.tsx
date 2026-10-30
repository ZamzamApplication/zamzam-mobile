import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Share,
  View,
} from 'react-native';
import { useEngine } from '../hooks';
import { errorMessage } from '../api';
import type { OfflineEngine } from '../offline/engine';
import type { Invitation, Settings } from '../types';
import { canManage, statusesFor, uid } from '../types';
import { configuredExcelExportTemplates } from '../excel-templates';
import type { ExcelTemplateKey } from '../excel-templates';
import {
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Icon,
  Notice,
  palette,
  s,
  Select,
  Toggle,
  Txt,
  useTheme,
} from '../ui';

const categories = [
  {
    key: 'general',
    icon: '🏠',
    title: 'بيانات التحفيظ',
    description: 'الاسم، التواصل، الفترات والإنذارات',
  },
  {
    key: 'attendance',
    icon: '✓',
    title: 'الحضور والحلقات',
    description: 'الصلاحيات، الحلقات وحالات الحضور',
  },
  {
    key: 'progress',
    icon: '📖',
    title: 'متابعة القرآن',
    description: 'تفعيل متابعة الحفظ والمراجعة',
  },
  {
    key: 'excel',
    icon: '📊',
    title: 'قوالب Excel',
    description: 'الأعمدة والعناوين وتنسيق ملفات التصدير',
  },
  {
    key: 'invitations',
    icon: '👥',
    title: 'دعوات الانضمام',
    description: 'إضافة المديرين والشيوخ ومتابعة الدعوات',
  },
  {
    key: 'integrations',
    icon: '🔗',
    title: 'التكاملات',
    description: 'إعداد خدمات WhatSend وواتساب',
  },
] as const;
type Section = (typeof categories)[number]['key'];
const weekdays = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
const colorNames = ['أخضر', 'رمادي', 'ذهبي', 'أزرق', 'بنفسجي', 'وردي'];
const keys: Record<Exclude<Section, 'invitations'>, (keyof Settings)[]> = {
  general: [
    'name',
    'description',
    'contact_phone',
    'max_warnings',
    'week_start_day',
    'month_start_day',
  ],
  attendance: [
    'attendance_statuses',
    'attendance_status_colors',
    'attendance_status_renames',
    'present_status',
    'absent_status',
    'attendance_sheikh_selection_enabled',
    'restrict_sheikh_student_access',
    'multiple_sessions_per_day_enabled',
    'session_name_options',
    'sheikh_custom_fields_enabled',
    'attendance_streak_alert_enabled',
    'attendance_streak_status',
    'attendance_streak_limit',
    'attendance_streak_reset_statuses',
  ],
  progress: [
    'progress_tracking_enabled',
    'progress_categories',
    'progress_quality_options',
  ],
  excel: ['excel_export_templates'],
  integrations: ['whatsend_enabled', 'whatsend_api_url', 'whatsend_groups_url'],
};
function valuesFor(
  section: Exclude<Section, 'invitations'>,
  value: Settings,
): Partial<Settings> {
  return Object.fromEntries(
    keys[section]
      .filter(key => value[key] !== undefined)
      .map(key => [key, value[key]]),
  );
}
function SectionCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Txt bold style={{ fontSize: 17 }}>
        {title}
      </Txt>
      {detail && (
        <Txt muted style={{ fontSize: 12 }}>
          {detail}
        </Txt>
      )}
      {children}
    </Card>
  );
}

export function SettingsScreen({ engine }: { engine: OfflineEngine }) {
  const { data } = useEngine(engine);
  const t = useTheme();
  const [section, setSection] = useState<Section | null>(null);
  useEffect(() => {
    if (!section) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setSection(null);
      return true;
    });
    return () => listener.remove();
  }, [section]);
  if (!canManage(data.user))
    return (
      <ScrollView contentContainerStyle={s.page}>
        <Heading title="الإعدادات" />
        <Card>
          <Txt bold>{data.user.username}</Txt>
          <Txt muted>{data.settings.name}</Txt>
          <Txt muted>إعدادات التحفيظ المشتركة متاحة للمدير فقط.</Txt>
        </Card>
      </ScrollView>
    );
  if (section)
    return (
      <SettingsForm
        key={section}
        section={section}
        engine={engine}
        onBack={() => setSection(null)}
        onSection={setSection}
      />
    );
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Heading title="إعدادات التحفيظ" detail="اختر القسم الذي تريد تعديله." />
      {categories.map(category => (
        <Pressable
          key={category.key}
          testID={`settings-${category.key}`}
          accessibilityRole="button"
          accessibilityLabel={category.title}
          onPress={() => setSection(category.key)}
        >
          <Card style={{ padding: 20, gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: t.active,
                alignSelf: 'flex-end',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt style={{ fontSize: 22, lineHeight: 34 }}>
                {category.icon}
              </Txt>
            </View>
            <Txt bold style={{ fontSize: 17, marginTop: 6 }}>
              {category.title}
            </Txt>
            <Txt muted>{category.description}</Txt>
            <Txt bold style={{ color: t.cyan, marginTop: 8 }}>
              فتح الإعدادات ‹
            </Txt>
            {data.settingsDrafts[category.key] && (
              <Txt style={{ fontSize: 11, color: '#b45309' }}>
                مسودة محفوظة على الجهاز
              </Txt>
            )}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SettingsForm({
  engine,
  section,
  onBack,
  onSection,
}: {
  engine: OfflineEngine;
  section: Section;
  onBack: () => void;
  onSection: (s: Section) => void;
}) {
  const { data, online } = useEngine(engine);
  const navRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const t = useTheme();
  const [form, setForm] = useState<Settings>(() => ({
    max_warnings: 3,
    week_start_day: 6,
    month_start_day: 1,
    ...data.settings,
    ...data.settingsDrafts[section],
  }));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [rename, setRename] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newName, setNewName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [templateKey, setTemplateKey] =
    useState<ExcelTemplateKey>('attendance');
  const [customColumn, setCustomColumn] = useState('');
  const current = categories.find(v => v.key === section)!;
  const change = (patch: Partial<Settings>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setNotice('');
    if (section !== 'invitations')
      void engine
        .draft(section, valuesFor(section, next))
        .catch(e => setError(errorMessage(e)));
  };
  const save = async () => {
    if (section === 'invitations') return;
    if (!form.name.trim()) {
      setError('اسم التحفيظ مطلوب.');
      return;
    }
    if (
      section === 'general' &&
      (!Number.isInteger(form.max_warnings) ||
        (form.max_warnings || 0) < 1 ||
        (form.max_warnings || 0) > 100 ||
        !Number.isInteger(form.month_start_day) ||
        (form.month_start_day || 0) < 1 ||
        (form.month_start_day || 0) > 28)
    ) {
      setError('تحقق من بداية الشهر (١–٢٨) والحد الأقصى للإنذارات (١–١٠٠).');
      return;
    }
    if (section === 'attendance' && data.queue.length) {
      setError('زامن تغييرات الحضور وعالج التعارضات قبل تعديل إعدادات الحضور.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...valuesFor(section, form),
        ...(section === 'integrations' && apiKey
          ? { whatsend_api_key: apiKey }
          : {}),
      };
      await engine.saveSettings(section, payload);
      setApiKey('');
      setForm(engine.view.data.settings);
      setNotice('تم حفظ الإعدادات');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const statuses = statusesFor(form);
  const statusOptions = statuses.map(value => ({ value, label: value }));
  const renameStatus = () => {
    const value = renameValue.trim();
    if (!rename || !value || (value !== rename && statuses.includes(value))) {
      setError('اختر اسماً مختلفاً وغير مكرر للحالة.');
      return;
    }
    const renames = { ...form.attendance_status_renames };
    const original =
      Object.keys(renames).find(key => renames[key] === rename) ||
      (statusesFor(data.settings).includes(rename) ? rename : null);
    if (original) {
      if (original === value) delete renames[original];
      else renames[original] = value;
    }
    const colors = {
      ...form.attendance_status_colors,
      [value]: form.attendance_status_colors?.[rename] || 'violet',
    };
    delete colors[rename];
    change({
      attendance_statuses: statuses.map(v => (v === rename ? value : v)),
      attendance_status_colors: colors,
      attendance_status_renames: renames,
      present_status:
        form.present_status === rename ? value : form.present_status,
      absent_status: form.absent_status === rename ? value : form.absent_status,
      attendance_streak_status:
        form.attendance_streak_status === rename
          ? value
          : form.attendance_streak_status,
      attendance_streak_reset_statuses:
        form.attendance_streak_reset_statuses?.map(v =>
          v === rename ? value : v,
        ),
    });
    setRename(null);
    setError('');
  };
  const templates = configuredExcelExportTemplates(form.excel_export_templates);
  const template = templates[templateKey];
  const updateTemplate = (patch: Partial<typeof template>) =>
    change({
      excel_export_templates: {
        ...templates,
        [templateKey]: { ...template, ...patch },
      },
    });
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
      >
        <Pressable accessibilityRole="button" onPress={onBack} style={s.row}>
          <Icon name="back" size={18} />
          <Txt style={{ color: t.cyan }}>كل الإعدادات</Txt>
        </Pressable>
        <Heading title={current.title} detail={current.description} />
        <ScrollView
          horizontal
          ref={navRef}
          onContentSizeChange={() => {
            if (categories.findIndex(c => c.key === section) < 3)
              navRef.current?.scrollToEnd({ animated: false });
            else navRef.current?.scrollTo({ x: 0, animated: false });
          }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.row, { gap: 7 }]}
        >
          {categories.map(item => (
            <Button
              small
              secondary={section !== item.key}
              key={item.key}
              title={item.title}
              onPress={() => onSection(item.key)}
            />
          ))}
        </ScrollView>
        {!online && (
          <Notice message="أنت غير متصل. الإعدادات المحملة متاحة، وتُحفظ تعديلاتك كمسودة على الجهاز حتى تعود للاتصال." />
        )}
        {error ? <Notice error message={error} /> : null}
        {notice ? <Notice message={notice} /> : null}
        {section === 'general' && (
          <>
            <SectionCard title="بيانات التحفيظ">
              <Field
                label="اسم التحفيظ"
                value={form.name}
                onChangeText={name => change({ name })}
                testID="settings-name"
              />
              <Field
                label="وصف التحفيظ"
                value={form.description || ''}
                onChangeText={description => change({ description })}
                multiline
              />
              <Field
                label="رقم التواصل"
                keyboardType="phone-pad"
                value={form.contact_phone || ''}
                onChangeText={contact_phone => change({ contact_phone })}
              />
            </SectionCard>
            <SectionCard title="الفترات والإنذارات">
              <Select
                label="بداية الأسبوع"
                value={String(form.week_start_day ?? 6)}
                options={weekdays.map((v, i) => ({
                  value: String(i),
                  label: v,
                }))}
                onChange={v => change({ week_start_day: Number(v) })}
              />
              <Select
                label="بداية الشهر"
                value={String(form.month_start_day ?? 1)}
                options={Array.from({ length: 28 }, (_, i) => ({
                  value: String(i + 1),
                  label: `اليوم ${i + 1}`,
                }))}
                onChange={v => change({ month_start_day: Number(v) })}
              />
              <Field
                label="الحد الأقصى للإنذارات"
                value={String(form.max_warnings ?? 3)}
                keyboardType="number-pad"
                onChangeText={v => change({ max_warnings: Number(v) })}
              />
              <Txt muted style={{ fontSize: 12 }}>
                بداية الشهر تتحكم في نطاقات سجل الحضور والتقارير الشهرية.
              </Txt>
            </SectionCard>
          </>
        )}
        {section === 'attendance' && (
          <>
            <SectionCard
              title="الصلاحيات وطريقة التسجيل"
              detail="وصول الشيوخ والخيارات التي تظهر أثناء أخذ الحضور."
            >
              <Toggle
                title="تقييد الشيوخ بطلابهم"
                detail="عند التفعيل لا يستطيع الشيخ عرض أو تعديل إلا الطلاب المسندين إليه."
                value={form.restrict_sheikh_student_access !== false}
                onChange={v =>
                  v
                    ? change({ restrict_sheikh_student_access: true })
                    : Alert.alert(
                        'إيقاف تقييد الشيوخ',
                        'سيتمكن جميع الشيوخ من الوصول إلى جميع طلاب التحفيظ. هل تريد المتابعة؟',
                        [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'إيقاف التقييد',
                            onPress: () =>
                              change({ restrict_sheikh_student_access: false }),
                          },
                        ],
                      )
                }
              />
              <Toggle
                title="اختيار الشيخ أثناء تسجيل الحضور"
                detail="عند إيقافه يُستخدم الشيخ المرتبط بالطالب تلقائياً."
                value={form.attendance_sheikh_selection_enabled !== false}
                onChange={v =>
                  change({ attendance_sheikh_selection_enabled: v })
                }
              />
              <Toggle
                title="السماح بأكثر من حلقة في اليوم"
                value={!!form.multiple_sessions_per_day_enabled}
                onChange={v => change({ multiple_sessions_per_day_enabled: v })}
              />
              <Toggle
                title="السماح للشيوخ بإنشاء حقول طلاب مخصصة"
                value={form.sheikh_custom_fields_enabled !== false}
                onChange={v => change({ sheikh_custom_fields_enabled: v })}
              />
            </SectionCard>
            <SectionCard
              title="حالات الحضور"
              detail="تُستخدم الحالات والألوان نفسها في تسجيل الحضور والسجل."
            >
              {statuses.map((status, index) => (
                <View
                  key={status}
                  style={{
                    gap: 8,
                    borderBottomWidth: 1,
                    borderColor: t.border,
                    paddingBottom: 12,
                  }}
                >
                  <View style={s.row}>
                    <Txt bold style={{ flex: 1 }}>
                      {status}
                    </Txt>
                    <Button
                      small
                      secondary
                      title="تعديل"
                      onPress={() => {
                        setRename(status);
                        setRenameValue(status);
                      }}
                    />
                    <Button
                      small
                      secondary
                      title="↑"
                      disabled={index === 0}
                      onPress={() => {
                        const next = [...statuses];
                        [next[index - 1], next[index]] = [
                          next[index],
                          next[index - 1],
                        ];
                        change({ attendance_statuses: next });
                      }}
                    />
                    <Button
                      small
                      danger
                      title="حذف"
                      disabled={
                        statuses.length < 2 ||
                        status === form.present_status ||
                        status === form.absent_status
                      }
                      onPress={() =>
                        Alert.alert(
                          'حذف الحالة',
                          `حذف «${status}» من الحالات المتاحة؟`,
                          [
                            { text: 'إلغاء' },
                            {
                              text: 'حذف',
                              style: 'destructive',
                              onPress: () =>
                                change({
                                  attendance_statuses: statuses.filter(
                                    v => v !== status,
                                  ),
                                  attendance_streak_reset_statuses:
                                    form.attendance_streak_reset_statuses?.filter(
                                      v => v !== status,
                                    ),
                                }),
                            },
                          ],
                        )
                      }
                    />
                  </View>
                  <View style={s.row}>
                    {Object.entries(palette).map(([key, color], i) => (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityLabel={`لون ${status}: ${colorNames[i]}`}
                        accessibilityState={{
                          checked:
                            form.attendance_status_colors?.[status] === key,
                        }}
                        onPress={() =>
                          change({
                            attendance_status_colors: {
                              ...form.attendance_status_colors,
                              [status]: key,
                            },
                          })
                        }
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          borderWidth:
                            form.attendance_status_colors?.[status] === key
                              ? 3
                              : 1,
                          borderColor:
                            form.attendance_status_colors?.[status] === key
                              ? t.cyan
                              : color.border,
                          backgroundColor: color.text,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
              {rename && (
                <Card>
                  <Field
                    label={`الاسم الجديد لحالة ${rename}`}
                    value={renameValue}
                    onChangeText={setRenameValue}
                  />
                  <View style={s.row}>
                    <Button small title="تطبيق الاسم" onPress={renameStatus} />
                    <Button
                      secondary
                      small
                      title="إلغاء"
                      onPress={() => setRename(null)}
                    />
                  </View>
                </Card>
              )}
              <Field
                label="حالة جديدة"
                value={newStatus}
                onChangeText={setNewStatus}
              />
              <Button
                secondary
                title="إضافة حالة"
                disabled={
                  !newStatus.trim() || statuses.includes(newStatus.trim())
                }
                onPress={() => {
                  change({
                    attendance_statuses: [...statuses, newStatus.trim()],
                  });
                  setNewStatus('');
                }}
              />
              <Select
                label="الحالة التي تُحسب حضوراً"
                value={form.present_status || statuses[0]}
                options={statusOptions}
                onChange={v => change({ present_status: v })}
              />
              <Select
                label="الحالة الافتراضية للغياب"
                value={form.absent_status || statuses[1]}
                options={statusOptions}
                onChange={v => change({ absent_status: v })}
              />
            </SectionCard>
            <SectionCard title="أسماء الحلقات">
              {(form.session_name_options || []).map(v => (
                <View key={v} style={s.row}>
                  <Txt style={{ flex: 1 }}>{v}</Txt>
                  <Button
                    small
                    danger
                    title="حذف"
                    onPress={() =>
                      change({
                        session_name_options: form.session_name_options?.filter(
                          x => x !== v,
                        ),
                      })
                    }
                  />
                </View>
              ))}
              <Field
                label="اسم حلقة جديد"
                placeholder="مثال: الصباحية"
                value={newName}
                onChangeText={setNewName}
              />
              <Button
                secondary
                title="إضافة الاسم"
                disabled={!newName.trim()}
                onPress={() => {
                  change({
                    session_name_options: [
                      ...new Set([
                        ...(form.session_name_options || []),
                        newName.trim(),
                      ]),
                    ],
                  });
                  setNewName('');
                }}
              />
            </SectionCard>
            <SectionCard title="تنبيهات تكرار الغياب">
              <Toggle
                title="تفعيل تنبيهات التكرار"
                value={form.attendance_streak_alert_enabled !== false}
                onChange={v => change({ attendance_streak_alert_enabled: v })}
              />
              <Select
                label="الحالة التي تتم متابعتها"
                value={form.attendance_streak_status || statuses[0]}
                options={statusOptions}
                onChange={v => change({ attendance_streak_status: v })}
              />
              <Field
                label="عدد المرات قبل التنبيه"
                keyboardType="number-pad"
                value={String(form.attendance_streak_limit ?? 3)}
                onChangeText={v =>
                  change({ attendance_streak_limit: Number(v) })
                }
              />
              <Txt bold>حالات تصفير التكرار</Txt>
              {statuses.map(v => (
                <Toggle
                  key={v}
                  title={v}
                  value={!!form.attendance_streak_reset_statuses?.includes(v)}
                  onChange={enabled =>
                    change({
                      attendance_streak_reset_statuses: enabled
                        ? [...(form.attendance_streak_reset_statuses || []), v]
                        : form.attendance_streak_reset_statuses?.filter(
                            x => x !== v,
                          ),
                    })
                  }
                />
              ))}
            </SectionCard>
          </>
        )}
        {section === 'progress' && (
          <SectionCard title="متابعة الحفظ والمراجعة">
            <Toggle
              title="تفعيل متابعة القرآن"
              detail="يظهر أثر هذا الإعداد في متابعة القرآن على جميع الأجهزة."
              value={!!form.progress_tracking_enabled}
              onChange={v => change({ progress_tracking_enabled: v })}
            />
            {Object.entries({
              new_memorization: 'حفظ جديد',
              recent_revision: 'مراجعة قريبة',
              old_revision: 'مراجعة بعيدة',
            }).map(([key, label]) => (
              <Toggle
                key={key}
                title={label}
                value={!!form.progress_categories?.includes(key)}
                onChange={v =>
                  change({
                    progress_categories: v
                      ? [...(form.progress_categories || []), key]
                      : form.progress_categories?.filter(c => c !== key),
                  })
                }
              />
            ))}
            {(form.progress_categories || [])
              .filter(
                v =>
                  ![
                    'new_memorization',
                    'recent_revision',
                    'old_revision',
                  ].includes(v),
              )
              .map(v => (
                <View key={v} style={s.row}>
                  <Txt style={{ flex: 1 }}>{v}</Txt>
                  <Button
                    small
                    danger
                    title="حذف"
                    onPress={() =>
                      change({
                        progress_categories: form.progress_categories?.filter(
                          x => x !== v,
                        ),
                      })
                    }
                  />
                </View>
              ))}
            <Field
              label="فئة متابعة مخصصة"
              value={customCategory}
              onChangeText={setCustomCategory}
            />
            <Button
              secondary
              title="إضافة فئة"
              disabled={
                !customCategory.trim() ||
                form.progress_categories?.includes(customCategory.trim())
              }
              onPress={() => {
                change({
                  progress_categories: [
                    ...(form.progress_categories || []),
                    customCategory.trim(),
                  ],
                });
                setCustomCategory('');
              }}
            />
            <Txt bold>خيارات التقييم</Txt>
            {(
              form.progress_quality_options || [
                { value: 5, label: 'ممتاز' },
                { value: 4, label: 'جيد جداً' },
                { value: 3, label: 'جيد' },
                { value: 2, label: 'مقبول' },
                { value: 1, label: 'يحتاج متابعة' },
              ]
            ).map((v, index, all) => (
              <Field
                key={v.value}
                label={`تقييم ${v.value}`}
                value={v.label}
                onChangeText={label =>
                  change({
                    progress_quality_options: all.map((option, i) =>
                      i === index ? { ...option, label } : option,
                    ),
                  })
                }
              />
            ))}
          </SectionCard>
        )}
        {section === 'integrations' && (
          <SectionCard title="خدمات WhatSend وواتساب">
            <Toggle
              title="تفعيل WhatSend"
              value={!!form.whatsend_enabled}
              onChange={v => change({ whatsend_enabled: v })}
            />
            <Field
              label="رابط إرسال الرسائل"
              value={form.whatsend_api_url || ''}
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={v => change({ whatsend_api_url: v })}
            />
            <Field
              label="رابط مجموعات واتساب"
              value={form.whatsend_groups_url || ''}
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={v => change({ whatsend_groups_url: v })}
            />
            <Field
              label="مفتاح API جديد"
              secureTextEntry
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              placeholder={
                form.whatsend_api_key_configured
                  ? 'مفتاح محفوظ · اتركه فارغاً للاحتفاظ به'
                  : 'مفتاح الخدمة'
              }
            />
            <Txt muted style={{ fontSize: 12 }}>
              مفتاح الخدمة لا يُحفظ في المسودة المحلية.
            </Txt>
          </SectionCard>
        )}
        {section === 'excel' && (
          <SectionCard title="تنسيق ملفات التصدير">
            <Select
              label="القالب"
              value={templateKey}
              options={[
                { value: 'attendance', label: 'سجل الحضور' },
                { value: 'statistics', label: 'الإحصائيات' },
                { value: 'progress', label: 'متابعة القرآن' },
              ]}
              onChange={v => setTemplateKey(v as ExcelTemplateKey)}
            />
            <Txt muted style={{ fontSize: 12 }}>
              تُحفظ القوالب نفسها التي تستخدمها نسخة الويب عند تصدير الملفات.
            </Txt>
            {template.columns.map((column, index) => (
              <View
                key={column.id}
                style={{
                  gap: 8,
                  paddingBottom: 14,
                  borderBottomWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Toggle
                  title={column.label}
                  value={column.enabled}
                  onChange={enabled =>
                    updateTemplate({
                      columns: template.columns.map((c, i) =>
                        i === index ? { ...c, enabled } : c,
                      ),
                    })
                  }
                />
                <Field
                  label="عنوان العمود"
                  value={column.label}
                  onChangeText={label =>
                    updateTemplate({
                      columns: template.columns.map((c, i) =>
                        i === index ? { ...c, label } : c,
                      ),
                    })
                  }
                />
                <Field
                  label="عرض العمود"
                  keyboardType="number-pad"
                  value={String(column.width)}
                  onChangeText={width =>
                    updateTemplate({
                      columns: template.columns.map((c, i) =>
                        i === index ? { ...c, width: Number(width) } : c,
                      ),
                    })
                  }
                />
                <View style={s.row}>
                  <Button
                    small
                    secondary
                    title="تحريك لأعلى"
                    disabled={index === 0}
                    onPress={() => {
                      const columns = [...template.columns];
                      [columns[index - 1], columns[index]] = [
                        columns[index],
                        columns[index - 1],
                      ];
                      updateTemplate({ columns });
                    }}
                  />
                  {column.custom && (
                    <Button
                      small
                      danger
                      title="حذف العمود"
                      onPress={() =>
                        updateTemplate({
                          columns: template.columns.filter(
                            c => c.id !== column.id,
                          ),
                        })
                      }
                    />
                  )}
                </View>
              </View>
            ))}
            <Field
              label="عمود مخصص"
              value={customColumn}
              onChangeText={setCustomColumn}
            />
            <Button
              secondary
              title="إضافة العمود"
              disabled={!customColumn.trim()}
              onPress={() => {
                updateTemplate({
                  columns: [
                    ...template.columns,
                    {
                      id: `custom_${uid()}`,
                      label: customColumn.trim(),
                      enabled: true,
                      custom: true,
                      width: 20,
                      header_font_size: 12,
                      show_header: true,
                      subcolumns: [],
                    },
                  ],
                });
                setCustomColumn('');
              }}
            />
            <Select
              label="خط العناوين"
              value={template.header_font_family}
              options={['Arial', 'Cairo', 'Tahoma', 'Calibri'].map(v => ({
                value: v,
                label: v,
              }))}
              onChange={v => updateTemplate({ header_font_family: v })}
            />
            <Field
              label="حجم خط العناوين"
              keyboardType="number-pad"
              value={String(template.header_font_size)}
              onChangeText={v =>
                updateTemplate({ header_font_size: Number(v) })
              }
            />
            <Toggle
              title="عناوين بخط عريض"
              value={template.header_bold}
              onChange={v => updateTemplate({ header_bold: v })}
            />
            <Select
              label="تنسيق تاريخ الحضور"
              value={template.attendance_date_format}
              options={[
                {
                  value: 'weekday_day_month_year',
                  label: 'اليوم والتاريخ كاملاً',
                },
                { value: 'day_month_year', label: 'اليوم والشهر والسنة' },
                { value: 'weekday_day', label: 'اسم اليوم ورقمه' },
                { value: 'day', label: 'رقم اليوم' },
              ]}
              onChange={v =>
                updateTemplate({
                  attendance_date_format:
                    v as typeof template.attendance_date_format,
                })
              }
            />
          </SectionCard>
        )}
        {section === 'invitations' && <Invitations engine={engine} />}
        {section !== 'invitations' && (
          <Txt muted style={{ fontSize: 11 }}>
            تُحفظ المسودة على جهازك أثناء الكتابة. استخدم حفظ الإعدادات لنشرها
            في التحفيظ.
          </Txt>
        )}
      </ScrollView>
      {section !== 'invitations' && (
        <View
          style={{
            backgroundColor: t.card,
            borderTopWidth: 1,
            borderColor: t.border,
            padding: 12,
            gap: 5,
          }}
        >
          <Txt
            style={{
              fontSize: 11,
              textAlign: 'center',
              color: data.settingsDrafts[section] ? '#b45309' : t.muted,
            }}
          >
            {data.settingsDrafts[section]
              ? 'مسودة محفوظة على الجهاز'
              : 'لا توجد تغييرات غير منشورة'}
          </Txt>
          <Button
            title="حفظ الإعدادات"
            onPress={() => {
              void save();
            }}
            busy={busy}
            disabled={!online || (!data.settingsDrafts[section] && !apiKey)}
            testID="save-settings"
          />
        </View>
      )}
    </View>
  );
}

function Invitations({ engine }: { engine: OfflineEngine }) {
  const { data, online } = useEngine(engine);
  const [role, setRole] = useState('sheikh');
  const [sheikh, setSheikh] = useState('');
  const [hours, setHours] = useState('48');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  useEffect(() => {
    if (online) void engine.invitations().catch(e => setError(errorMessage(e)));
  }, [engine, online]);
  const teachers = [
    ...new Map(
      Object.values(data.rosters)
        .flatMap(r => r.circle_sheikhs)
        .map(v => [v.id, v]),
    ).values(),
  ];
  const perform = async (path: string, method: string, body?: object) => {
    setBusy(true);
    setError('');
    try {
      const result = await engine.request<Invitation>(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (result?.path) setLink(`https://zamzam-web.fly.dev${result.path}`);
      await engine.invitations();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SectionCard title="إنشاء دعوة">
        <Select
          label="الدور"
          value={role}
          onChange={setRole}
          options={[
            { value: 'sheikh', label: 'شيخ' },
            { value: 'admin', label: 'مدير' },
          ]}
        />
        {role === 'sheikh' && (
          <Select
            label="الشيخ"
            value={sheikh}
            onChange={setSheikh}
            options={[
              { value: '', label: 'اختر الشيخ' },
              ...teachers.map(v => ({ value: String(v.id), label: v.name })),
            ]}
          />
        )}
        <Field
          label="صلاحية الدعوة بالساعات"
          keyboardType="number-pad"
          value={hours}
          onChangeText={setHours}
        />
        <Button
          title="إنشاء رابط الدعوة"
          busy={busy}
          disabled={!online || (role === 'sheikh' && !sheikh) || !Number(hours)}
          onPress={() => {
            void perform('/invitations/', 'POST', {
              role,
              sheikh_id: role === 'sheikh' ? Number(sheikh) : null,
              expires_hours: Number(hours),
            });
          }}
        />
        {error ? <Notice error message={error} /> : null}
        {link && (
          <>
            <Txt selectable style={{ fontSize: 12 }}>
              {link}
            </Txt>
            <Button
              secondary
              title="مشاركة الرابط"
              onPress={() => {
                void Share.share({ message: link });
              }}
            />
          </>
        )}
      </SectionCard>
      {(data.invitations || []).map(invitation => (
        <Card key={invitation.id}>
          <Txt bold>
            {invitation.role === 'admin'
              ? 'دعوة مدير'
              : `دعوة ${invitation.sheikh_name || 'شيخ'}`}
          </Txt>
          <Txt muted>
            {(
              {
                active: 'نشطة',
                used: 'مستخدمة',
                revoked: 'ملغاة',
                expired: 'منتهية',
              } as Record<string, string>
            )[invitation.status] || invitation.status}
          </Txt>
          <Txt muted style={{ fontSize: 12 }}>
            تنتهي: {new Date(invitation.expires_at).toLocaleString('ar-EG')}
          </Txt>
          {invitation.status === 'active' && (
            <View style={s.row}>
              <Button
                secondary
                small
                title="إعادة إرسال"
                disabled={!online || busy}
                onPress={() => {
                  void perform(`/invitations/${invitation.id}/resend`, 'POST');
                }}
              />
              <Button
                danger
                small
                title="إلغاء الدعوة"
                disabled={!online || busy}
                onPress={() =>
                  Alert.alert('إلغاء الدعوة', 'سيتوقف رابط الدعوة عن العمل.', [
                    { text: 'رجوع' },
                    {
                      text: 'إلغاء الدعوة',
                      style: 'destructive',
                      onPress: () => {
                        void perform(`/invitations/${invitation.id}`, 'DELETE');
                      },
                    },
                  ])
                }
              />
            </View>
          )}
        </Card>
      ))}
      {!data.invitations?.length && (
        <Empty
          title="لا توجد دعوات"
          detail="يمكنك إنشاء دعوة للانضمام إلى التحفيظ عند الاتصال بالإنترنت."
        />
      )}
    </>
  );
}
