import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { RegistrationScreen } from './StudentRegistration';
import type { OfflineEngine } from '../offline/engine';
import { Button, Card, Icon, s, Txt, useTheme } from '../ui';
import { FeaturePage } from './feature-ui';
import { PeopleScreen, ProfileScreen } from './People';
import {
  QuranScreen,
  StudentPlansScreen,
  StudentProgressScreen,
} from './Quran';
import { PlansScreen } from './Plans';
import { InvitationFlow, CreateTahfizFlow } from './Registration';
import type { User } from '../types';
import {
  AdvancedAttendanceScreen,
  WarningDeliveryScreen,
} from './AttendanceTools';
import { SessionManagementScreen } from './SessionManagement';
import { AdministrationScreen } from './Administration';
import { SettingsScreen } from './Settings';
import { FinanceScreen } from './Finance';
import { ReportsScreen, AuditScreen } from './Reports';
import { canManage } from '../types';
import { useEngine } from '../hooks';
export type MoreRoute = {
  page:
    | 'attendance-filters'
    | 'warnings'
    | 'session-management'
    | 'join'
    | 'create-tahfiz'
    | 'administration'
    | 'invitations'
    | 'registration'
    | 'finance'
    | 'reports'
    | 'audit'
    | 'people'
    | 'profile'
    | 'quran'
    | 'student-plans'
    | 'student-progress'
    | 'plans';
  id?: number;
} | null;
export function MoreScreen({
  engine,
  route,
  navigate,
  onHome,
  onSettings,
  onRecords,
  onSessions,
  onJoined,
  onSession,
}: {
  engine: OfflineEngine;
  route: MoreRoute;
  navigate: (v: MoreRoute) => void;
  onHome: () => void;
  onSettings: () => void;
  onRecords: () => void;
  onSessions: () => void;
  onJoined: (user: User) => void;
  onSession: (id: number) => void;
}) {
  const { data } = useEngine(engine);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const t = useTheme();
  const back = () => {
    if (route?.page === 'attendance-filters' || route?.page === 'warnings') {
      navigate(null);
      onRecords();
    } else if (
      route?.page === 'session-management' ||
      route?.page === 'reports'
    ) {
      navigate(null);
      onSessions();
    } else navigate(null);
  };
  const menuItem = (title: string, page: NonNullable<MoreRoute>['page']) => (
    <Pressable
      testID={`more-${page}`}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => navigate({ page })}
      style={({ pressed }) => [
        s.row,
        {
          minHeight: 52,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderColor: t.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Txt bold style={{ flex: 1 }}>
        {title}
      </Txt>
      <Icon name="back" size={18} color={t.muted} />
    </Pressable>
  );
  if (route?.page === 'attendance-filters')
    return (
      <AdvancedAttendanceScreen
        engine={engine}
        onBack={back}
        onProfile={id => navigate({ page: 'profile', id })}
      />
    );
  if (route?.page === 'warnings')
    return <WarningDeliveryScreen engine={engine} onBack={back} />;
  if (route?.page === 'session-management')
    return (
      <SessionManagementScreen
        engine={engine}
        onBack={back}
        onOpen={onSession}
      />
    );
  if (route?.page === 'join')
    return (
      <FeaturePage engine={engine} title="الانضمام إلى تحفيظ" onBack={back}>
        <InvitationFlow
          client={engine.client}
          onBack={back}
          onJoined={onJoined}
        />
      </FeaturePage>
    );
  if (route?.page === 'create-tahfiz')
    return <CreateTahfizFlow engine={engine} onBack={back} />;
  if (route?.page === 'administration')
    return (
      <AdministrationScreen
        engine={engine}
        onBack={back}
        onPeople={() => navigate({ page: 'people' })}
        onInvitations={() => navigate({ page: 'invitations' })}
        onRegistration={() => navigate({ page: 'registration' })}
      />
    );
  if (route?.page === 'invitations')
    return <SettingsScreen engine={engine} initialSection="invitations" />;
  if (route?.page === 'registration')
    return (
      <RegistrationScreen
        engine={engine}
        onBack={() => navigate({ page: 'administration' })}
      />
    );
  if (route?.page === 'finance')
    return <FinanceScreen engine={engine} onBack={back} />;
  if (route?.page === 'reports')
    return (
      <ReportsScreen
        engine={engine}
        onBack={back}
        onProfile={id => navigate({ page: 'profile', id })}
      />
    );
  if (route?.page === 'audit')
    return <AuditScreen engine={engine} onBack={back} />;
  if (route?.page === 'people')
    return (
      <PeopleScreen
        engine={engine}
        onBack={back}
        onProfile={id => navigate({ page: 'profile', id })}
      />
    );
  if (route?.page === 'profile' && route.id)
    return (
      <ProfileScreen
        engine={engine}
        id={route.id}
        onBack={() => navigate({ page: 'people' })}
        onProgress={() => navigate({ page: 'student-progress', id: route.id })}
        onPlans={() => navigate({ page: 'student-plans', id: route.id })}
      />
    );
  if (route?.page === 'quran')
    return (
      <QuranScreen engine={engine} onBack={back} initialSession={route.id} />
    );
  if (route?.page === 'student-progress' && route.id)
    return (
      <StudentProgressScreen
        engine={engine}
        studentId={route.id}
        onBack={() => navigate({ page: 'profile', id: route.id })}
      />
    );
  if (route?.page === 'student-plans' && route.id)
    return (
      <StudentPlansScreen
        engine={engine}
        studentId={route.id}
        onBack={() => navigate({ page: 'profile', id: route.id })}
      />
    );
  if (route?.page === 'plans')
    return <PlansScreen engine={engine} onBack={back} />;
  return (
    <FeaturePage engine={engine} title="المزيد" onBack={onHome}>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {menuItem('الشيوخ والطلاب', 'people')}
        {menuItem('الحفظ والمراجعة', 'quran')}
        {menuItem('خطط الحفظ والمراجعة', 'plans')}
        {canManage(data.user) && menuItem('الإدارة', 'administration')}
        {canManage(data.user) && menuItem('سجل العمليات', 'audit')}
      </Card>
      {(Object.keys(data.formDrafts || {}).length > 0 ||
        Object.keys(data.settingsDrafts).length > 0) && (
        <Card>
          <Button
            secondary
            title={`المسودات المحفوظة (${
              Object.keys(data.formDrafts || {}).length +
              Object.keys(data.settingsDrafts).length
            })`}
            onPress={() => setDraftsOpen(v => !v)}
          />
          {draftsOpen && (
            <>
              {Object.keys(data.settingsDrafts).length > 0 && (
                <Button
                  secondary
                  title="مسودات الإعدادات"
                  onPress={onSettings}
                />
              )}
              {Object.keys(data.formDrafts || {}).map(key => (
                <Button
                  key={key}
                  small
                  secondary
                  title={
                    key.startsWith('finance')
                      ? 'مسودة مالية'
                      : key.startsWith('student-plan:')
                      ? 'مسودة خطة طالب'
                      : key.startsWith('student:')
                      ? 'مسودة بيانات طالب'
                      : key.startsWith('sheikh:')
                      ? 'مسودة بيانات شيخ'
                      : key.startsWith('progress:')
                      ? 'مسودة تسميع'
                      : key.startsWith('goal:')
                      ? 'مسودة هدف حفظ'
                      : 'مسودة خطة أو إنجاز'
                  }
                  onPress={() => {
                    if (key.startsWith('finance'))
                      navigate({ page: 'finance' });
                    else if (key.startsWith('student-plan:'))
                      navigate({
                        page: 'student-plans',
                        id: Number(key.split(':')[1]),
                      });
                    else if (key.startsWith('progress:'))
                      navigate({
                        page: 'quran',
                        id: Number(key.split(':')[2]),
                      });
                    else if (key.startsWith('goal:'))
                      navigate({
                        page: 'student-progress',
                        id: Number(key.split(':')[1]),
                      });
                    else if (
                      key.startsWith('student:') ||
                      key.startsWith('sheikh:')
                    )
                      navigate({ page: 'people' });
                    else navigate({ page: 'plans' });
                  }}
                />
              ))}
              <Txt muted>
                افتح النموذج نفسه لاستكمال مسودته. لن تُنشر التعديلات تلقائياً.
              </Txt>
            </>
          )}
        </Card>
      )}
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="التحفيظات"
          accessibilityState={{ expanded: accountOpen }}
          onPress={() => setAccountOpen(v => !v)}
          style={[s.row, { minHeight: 52, paddingHorizontal: 4 }]}
        >
          <Txt bold style={{ flex: 1 }}>
            التحفيظات
          </Txt>
          <Icon name="down" size={18} color={t.muted} />
        </Pressable>
        {accountOpen && (
          <View>
            {menuItem('الانضمام بدعوة', 'join')}
            {menuItem('إنشاء تحفيظ جديد', 'create-tahfiz')}
          </View>
        )}
      </Card>
    </FeaturePage>
  );
}
