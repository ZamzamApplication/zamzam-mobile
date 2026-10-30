import React from 'react';
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
import { useEngine } from '../hooks';
export type MoreRoute = {
  page:
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
}: {
  engine: OfflineEngine;
  route: MoreRoute;
  navigate: (v: MoreRoute) => void;
  onHome: () => void;
  onSettings: () => void;
}) {
  const { data } = useEngine(engine);
  const back = () => navigate(null);
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
                key.startsWith('student-plan:')
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
                if (key.startsWith('student-plan:'))
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
