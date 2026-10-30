import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useEngine } from '../hooks';
import type { OfflineEngine } from '../offline/engine';
import { homeAttention } from '../home';
import { canManage, dateLabel, localDate } from '../types';
import { Button, Card, Heading, Icon, Notice, s, Txt, useTheme } from '../ui';

export function HomeScreen({
  engine,
  onOpen,
  onSessions,
  onRecords,
  onSettings,
  onSync,
}: {
  engine: OfflineEngine;
  onOpen: (id: number) => void;
  onSessions: () => void;
  onRecords: () => void;
  onSettings: () => void;
  onSync: () => void;
}) {
  const { data, online, syncing, dashboardError } = useEngine(engine);
  const t = useTheme();
  const attention = homeAttention(data);
  const summary = data.dashboard?.summary;
  const completion = summary?.sessions
    ? Math.round((summary.confirmed_sessions / summary.sessions) * 100)
    : 0;
  const next = attention.pending[0];
  const hasAttention =
    attention.issues ||
    attention.waiting ||
    attention.drafts ||
    attention.overdue.length ||
    attention.today.length;
  const metrics = [
    {
      title: 'الطلاب',
      value: summary?.students,
      detail: 'طالب نشط في التحفيظ',
      color: '#06b6d4',
    },
    {
      title: 'الشيوخ',
      value: summary?.sheikhs,
      detail: 'شيخ مسؤول عن المتابعة',
      color: '#10b981',
    },
    {
      title: 'الحلقات',
      value: summary?.sessions,
      detail: `${summary?.pending_sessions ?? '—'} حلقة قيد الانتظار`,
      color: '#f59e0b',
      action: onSessions,
    },
    {
      title: 'الحضور المؤكد',
      value: summary?.confirmed_sessions,
      detail: 'حلقة مكتملة في سجل الحضور',
      color: '#6366f1',
      action: onRecords,
    },
  ];
  return (
    <ScrollView
      testID="home-screen"
      contentContainerStyle={s.page}
      refreshControl={
        <RefreshControl
          refreshing={syncing}
          onRefresh={() => {
            void engine.sync();
          }}
          tintColor={t.cyan}
        />
      }
    >
      <Card style={{ gap: 12, backgroundColor: t.pale }}>
        <Txt bold style={{ fontSize: 12, color: t.cyan }}>
          لوحة المتابعة
        </Txt>
        <Heading
          title={data.settings.name}
          detail="نظرة سريعة على التحفيظ والحلقات غير المؤكدة، مع وصول مباشر لأهم مهام اليوم."
        />
        <View style={[s.row, { alignItems: 'stretch', gap: 6 }]}>
          {[
            ['الحلقات المؤكدة', summary?.confirmed_sessions ?? '—'],
            ['قيد الانتظار', summary?.pending_sessions ?? '—'],
            ['نسبة الإغلاق', summary ? `${completion}%` : '—'],
          ].map(([label, value]) => (
            <View
              key={label}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: 8,
                backgroundColor: t.card,
              }}
            >
              <Txt muted style={{ fontSize: 10 }}>
                {label}
              </Txt>
              <Txt bold style={{ fontSize: 22, color: t.cyan }}>
                {value}
              </Txt>
            </View>
          ))}
        </View>
        <Txt muted style={{ fontSize: 10 }}>
          {data.dashboard
            ? `آخر تحديث للملخص: ${new Date(
                data.dashboard.updatedAt,
              ).toLocaleString('ar-EG')}`
            : 'اتصل بالإنترنت لتحميل ملخص التحفيظ للمرة الأولى.'}
          {!online ? ' · نسخة محفوظة دون اتصال' : ''}
        </Txt>
      </Card>
      {dashboardError && online ? (
        <Notice message="تعذر تحديث الملخص. اسحب لأسفل للمحاولة مجدداً؛ تظل البيانات المحفوظة متاحة." />
      ) : null}
      <Card style={{ gap: 10 }}>
        <Txt bold style={{ fontSize: 18 }}>
          يحتاج انتباهك
        </Txt>
        {attention.issues > 0 && (
          <Button
            secondary
            title={`${attention.issues} تعديل يحتاج مراجعة`}
            onPress={onSync}
            testID="home-review-sync"
          />
        )}
        {attention.waiting > 0 && (
          <Button
            secondary
            title={`${attention.waiting} تغيير بانتظار المزامنة`}
            onPress={onSync}
            testID="home-pending-sync"
          />
        )}
        {attention.overdue.length > 0 && (
          <Button
            secondary
            title={`${attention.overdue.length} حلقة سابقة تحتاج متابعة أو تأكيد`}
            onPress={() => onOpen(attention.overdue[0].id)}
            testID="home-overdue"
          />
        )}
        {attention.today.length > 0 && (
          <Button
            secondary
            title={`${attention.today.length} حلقة اليوم بانتظار الحضور أو التأكيد`}
            onPress={() => onOpen(attention.today[0].id)}
            testID="home-today"
          />
        )}
        {attention.drafts > 0 && (
          <Button
            secondary
            title={`${attention.drafts} مسودة إعدادات غير منشورة`}
            onPress={onSettings}
            testID="home-settings-drafts"
          />
        )}
        {!hasAttention && (
          <Txt muted>
            {data.bootstrapped
              ? 'لا توجد مهام عاجلة في البيانات المحملة.'
              : 'جاري تحميل البيانات لتحديد ما يحتاج متابعتك...'}
          </Txt>
        )}
      </Card>
      <Card style={{ gap: 10 }}>
        <Txt bold style={{ fontSize: 18 }}>
          أقرب حلقة
        </Txt>
        {next ? (
          <Pressable
            accessibilityRole="button"
            testID="home-next-session"
            onPress={() => onOpen(next.id)}
            style={{ gap: 5 }}
          >
            <Txt bold style={{ color: t.cyan }}>
              {next.date === localDate()
                ? 'اليوم'
                : next.date < localDate()
                ? 'حلقة سابقة بانتظار التأكيد'
                : 'حلقة قادمة'}
            </Txt>
            <Txt bold>{dateLabel(next.date)}</Txt>
            <Txt muted>
              {next.name || next.circle_name || data.settings.name}
            </Txt>
            <Txt style={{ color: t.cyan }}>فتح تسجيل الحضور ←</Txt>
          </Pressable>
        ) : (
          <Txt muted>
            {data.dashboard
              ? 'لا توجد حلقات قيد الانتظار'
              : 'لا توجد حلقات محملة بعد'}
          </Txt>
        )}
      </Card>
      <View
        style={[s.row, { flexWrap: 'wrap', alignItems: 'stretch', gap: 10 }]}
      >
        {metrics.map(item => (
          <View key={item.title} style={{ width: '48%', flexGrow: 1 }}>
            <Pressable
              accessibilityRole={item.action ? 'button' : undefined}
              disabled={!item.action}
              onPress={item.action}
              style={{ flex: 1 }}
            >
              <Card style={{ flex: 1, gap: 6 }}>
                <View style={s.row}>
                  <View
                    style={{
                      width: 4,
                      height: 36,
                      borderRadius: 4,
                      backgroundColor: item.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt muted style={{ fontSize: 12 }}>
                      {item.title}
                    </Txt>
                    <Txt bold style={{ fontSize: 26 }}>
                      {item.value ?? '—'}
                    </Txt>
                  </View>
                </View>
                <Txt muted style={{ fontSize: 10 }}>
                  {item.detail}
                </Txt>
              </Card>
            </Pressable>
          </View>
        ))}
      </View>
      <Card style={{ gap: 10 }}>
        <Heading title="المهام السريعة" />
        <Button
          secondary
          icon="sessions"
          title={
            canManage(data.user) ? 'إدارة الحلقات وإضافة حلقة' : 'عرض الحلقات'
          }
          onPress={onSessions}
          testID="home-sessions"
        />
        <Button
          secondary
          icon="attendance"
          title="سجل الحضور"
          onPress={onRecords}
        />
        <Button
          secondary
          icon="settings"
          title="الإعدادات"
          onPress={onSettings}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <Heading
          title="الحلقات قيد الانتظار"
          detail="الحلقات التي تحتاج متابعة أو تأكيد"
        />
        {attention.pending.slice(0, 5).map(session => (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            onPress={() => onOpen(session.id)}
            style={[s.row, { paddingVertical: 8 }]}
          >
            <Icon name="sessions" color={t.cyan} />
            <View style={{ flex: 1 }}>
              <Txt bold>{dateLabel(session.date)}</Txt>
              <Txt muted style={{ fontSize: 11 }}>
                {session.name || data.settings.name}
              </Txt>
            </View>
            <Icon name="back" size={16} />
          </Pressable>
        ))}
        {!attention.pending.length && (
          <Txt muted>لا توجد حلقات قيد الانتظار في البيانات المحملة.</Txt>
        )}
        <Button small secondary title="عرض كل الحلقات" onPress={onSessions} />
      </Card>
    </ScrollView>
  );
}
