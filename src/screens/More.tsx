import React from 'react';
import { RegistrationScreen } from './StudentRegistration';
import type { OfflineEngine } from '../offline/engine';
import { Button, Card, Txt } from '../ui';
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
  onJoined,
  onSession,
}: {
  engine: OfflineEngine;
  route: MoreRoute;
  navigate: (v: MoreRoute) => void;
  onHome: () => void;
  onSettings: () => void;
  onJoined: (user: User) => void;
  onSession: (id: number) => void;
}) {
  const { data } = useEngine(engine);
  const back = () => navigate(null);
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
      />
    );
  if (route?.page === 'invitations')
    return <SettingsScreen engine={engine} initialSection="invitations" />;
  if (route?.page === 'registration')
    return <RegistrationScreen engine={engine} onBack={back} />;
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
      <Card>
        <Txt bold>الطلاب والمتابعة</Txt>
        <Button
          secondary
          title="تصفية سجل الحضور المتقدمة"
          onPress={() => navigate({ page: 'attendance-filters' })}
          testID="more-attendance-filters"
        />
        {canManage(data.user) && (
          <Button
            secondary
            title="الإنذارات والإرسال الجماعي"
            onPress={() => navigate({ page: 'warnings' })}
            testID="more-warnings"
          />
        )}
        {canManage(data.user) && (
          <Button
            secondary
            title="إدارة الحلقات والأعضاء والأرشيف"
            onPress={() => navigate({ page: 'session-management' })}
            testID="more-session-management"
          />
        )}
        {['admin', 'super_admin'].includes(data.user.role) && (
          <Button
            secondary
            title="التسجيل العام وطلبات الطلاب"
            onPress={() => navigate({ page: 'registration' })}
          />
        )}
        {canManage(data.user) && (
          <Button
            secondary
            title="الإدارة — المستخدمين والتصنيفات والحقول"
            onPress={() => navigate({ page: 'administration' })}
            testID="more-administration"
          />
        )}
        {['admin', 'super_admin', 'auditor'].includes(data.user.role) && (
          <Button
            secondary
            title="القسم المالي"
            onPress={() => navigate({ page: 'finance' })}
            testID="more-finance"
          />
        )}
        <Button
          secondary
          title="التقارير والإحصاءات"
          onPress={() => navigate({ page: 'reports' })}
          testID="more-reports"
        />
        {canManage(data.user) && (
          <Button
            secondary
            title="سجل العمليات"
            onPress={() => navigate({ page: 'audit' })}
            testID="more-audit"
          />
        )}
        <Button
          secondary
          title="الشيوخ والطلاب وملفاتهم"
          onPress={() => navigate({ page: 'people' })}
          testID="more-people"
        />
        <Button
          secondary
          title="تسجيل الحفظ والمراجعة"
          onPress={() => navigate({ page: 'quran' })}
          testID="more-quran"
        />
      </Card>
      {(Object.keys(data.formDrafts || {}).length > 0 ||
        Object.keys(data.settingsDrafts).length > 0) && (
        <Card>
          <Txt bold>المسودات المحفوظة على الجهاز</Txt>
          {Object.keys(data.settingsDrafts).length > 0 && (
            <Button secondary title="مسودات الإعدادات" onPress={onSettings} />
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
                if (key.startsWith('finance')) navigate({ page: 'finance' });
                else if (key.startsWith('student-plan:'))
                  navigate({
                    page: 'student-plans',
                    id: Number(key.split(':')[1]),
                  });
                else if (key.startsWith('progress:'))
                  navigate({ page: 'quran', id: Number(key.split(':')[2]) });
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
        </Card>
      )}
      <Card>
        <Txt bold>خططي</Txt>
        <Button
          secondary
          title="الانضمام إلى تحفيظ بدعوة"
          onPress={() => navigate({ page: 'join' })}
          testID="more-join"
        />
        <Button
          secondary
          title="إنشاء تحفيظ جديد"
          onPress={() => navigate({ page: 'create-tahfiz' })}
          testID="more-create-tahfiz"
        />
        <Button
          secondary
          title="خطط الحفظ والمراجعة"
          onPress={() => navigate({ page: 'plans' })}
          testID="more-plans"
        />
        <Txt muted>
          أعدّ خطتك، وراجع الجدول دون اتصال، ثم انشر الإنجاز عند عودة الاتصال.
        </Txt>
      </Card>
    </FeaturePage>
  );
}
