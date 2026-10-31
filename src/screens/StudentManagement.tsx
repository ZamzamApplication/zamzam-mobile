import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { Asset } from 'react-native-image-picker';
import type { OfflineEngine } from '../offline/engine';
import { useEngine } from '../hooks';
import { useResource } from '../resources';
import type {
  SheikhDeletionPreview,
  SheikhStudentDeletionResolution,
} from '../domain-types';
import { Button, Card, Notice, Select, Sheet, Toggle, Txt } from '../ui';
import { useAction } from './feature-ui';
import { confirmAction } from './Administration';
export function StudentPhoto({
  engine,
  id,
  reload,
}: {
  engine: OfflineEngine;
  id: number;
  reload: () => void;
}) {
  const { online } = useEngine(engine),
    action = useAction(),
    [asset, setAsset] = useState<Asset | null>(null);
  return (
    <Card>
      <Txt bold>صورة الطالب</Txt>
      {asset?.uri && (
        <Image
          source={{ uri: asset.uri }}
          style={{ height: 180, width: '100%' }}
          resizeMode="contain"
        />
      )}
      <Button
        secondary
        title="اختيار صورة"
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            const response = await launchImageLibrary({
              mediaType: 'photo',
              selectionLimit: 1,
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 0.8,
              assetRepresentationMode: 'compatible',
            });
            if (response.didCancel) return;
            if (response.errorCode)
              throw new Error(response.errorMessage || 'تعذر اختيار الصورة.');
            const selected = response.assets?.[0];
            if (!selected?.uri) throw new Error('لم تُحدد صورة.');
            if ((selected.fileSize || 0) > 10 * 1024 * 1024)
              throw new Error('اختر صورة لا تتجاوز 10 ميجابايت.');
            setAsset(selected);
          });
        }}
        testID="student-photo-select"
      />
      {asset && (
        <Button
          title="رفع الصورة"
          disabled={!online}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              await engine.uploadStudentPhoto(id, {
                uri: asset.uri!,
                name: asset.fileName || 'student.jpg',
                type: asset.type || 'image/jpeg',
              });
              setAsset(null);
              reload();
            });
          }}
          testID="student-photo-upload"
        />
      )}
      {action.error && <Notice error message={action.error} />}
    </Card>
  );
}
export function DeleteStudent({
  engine,
  id,
  name,
  onDeleted,
}: {
  engine: OfflineEngine;
  id: number;
  name: string;
  onDeleted: () => void;
}) {
  const { online, data } = useEngine(engine),
    [open, setOpen] = useState(false),
    [removeHistory, setRemoveHistory] = useState(false),
    action = useAction();
  const pending = [...data.queue, ...(data.quranQueue || [])].some(
    p => p.values.student_id === id,
  );
  return (
    <>
      <Button
        secondary
        title="حذف الطالب"
        disabled={!online || pending}
        onPress={() => setOpen(true)}
        testID="student-delete"
      />
      {pending && <Txt muted>زامن تعديلات الطالب قبل الحذف.</Txt>}
      <Sheet visible={open} title="حذف الطالب" onClose={() => setOpen(false)}>
        <Notice
          error
          message={`سيُحذف ${name}. راجع مصير سجلات الحضور قبل التأكيد.`}
        />
        <Toggle
          title="حذف سجلات حضور الطالب أيضاً"
          detail="اتركه مغلقاً للاحتفاظ بسجلات الحضور التاريخية."
          value={removeHistory}
          onChange={setRemoveHistory}
        />
        <Button
          title="تأكيد حذف الطالب"
          disabled={!online}
          busy={action.busy}
          onPress={() =>
            confirmAction(
              'حذف الطالب',
              `${name} · ${
                removeHistory ? 'حذف سجلات الحضور' : 'الاحتفاظ بسجلات الحضور'
              }`,
              () => {
                void action.run(async () => {
                  await engine.publish(
                    `/students/${id}?delete_sessions=${removeHistory}`,
                    undefined,
                    'DELETE',
                  );
                  await engine.sync();
                  setOpen(false);
                  onDeleted();
                });
              },
              true,
            )
          }
          testID="student-delete-confirm"
        />
        {action.error && <Notice error message={action.error} />}
      </Sheet>
    </>
  );
}
export function DeleteSheikh({
  engine,
  id,
  onDeleted,
}: {
  engine: OfflineEngine;
  id: number;
  onDeleted: () => void;
}) {
  const { online, data } = useEngine(engine),
    [open, setOpen] = useState(false),
    [choices, setChoices] = useState<Record<number, string>>({}),
    [all, setAll] = useState('');
  const preview = useResource<SheikhDeletionPreview>(
      engine,
      open ? `/sheikhs/${id}/deletion-preview` : null,
    ),
    action = useAction();
  const pending = [...data.queue, ...(data.quranQueue || [])].some(p =>
    preview.value?.students.some(st => st.id === p.values.student_id),
  );
  const complete =
    preview.value && preview.value.students.every(st => !!choices[st.id]);
  return (
    <>
      <Button
        secondary
        small
        title="حذف الشيخ وتوزيع طلابه"
        onPress={() => {
          setChoices({});
          setOpen(true);
        }}
        testID={`sheikh-delete-${id}`}
      />
      <Sheet visible={open} title="حذف الشيخ" onClose={() => setOpen(false)}>
        {preview.error && (
          <Notice error message={preview.error} onRetry={preview.reload} />
        )}
        <Notice message="حدد لكل طالب شيخاً بديلاً، أو اختر حذفه صراحةً. لن يُحذف الشيخ حتى تحدد مصير جميع طلابه." />
        {preview.value && (
          <>
            <Txt bold>
              {preview.value.sheikh.name} · {preview.value.students.length} طالب
            </Txt>
            <Select
              label="نقل الجميع إلى"
              value={all}
              onChange={setAll}
              options={[
                { value: '', label: 'اختر الشيخ' },
                ...preview.value.destination_sheikhs.map(sh => ({
                  value: String(sh.id),
                  label: sh.name,
                })),
              ]}
            />
            <Button
              secondary
              title="تطبيق النقل على الجميع"
              disabled={!all}
              onPress={() =>
                setChoices(
                  Object.fromEntries(
                    preview.value!.students.map(st => [st.id, all]),
                  ),
                )
              }
            />
            {preview.value.students.map(st => (
              <View key={st.id}>
                <Txt bold>{st.name}</Txt>
                <Select
                  label={`مصير ${st.name}`}
                  value={choices[st.id] || ''}
                  onChange={value => setChoices({ ...choices, [st.id]: value })}
                  options={[
                    { value: '', label: 'اختر الإجراء' },
                    ...preview.value!.destination_sheikhs.map(sh => ({
                      value: String(sh.id),
                      label: `نقل إلى ${sh.name}`,
                    })),
                    { value: 'delete', label: 'حذف الطالب' },
                  ]}
                />
              </View>
            ))}
            {preview.value.linked_usernames.length > 0 && (
              <Notice
                message={`ستبقى هذه الحسابات دون ارتباط بشيخ: ${preview.value.linked_usernames.join(
                  '، ',
                )}`}
              />
            )}
            {pending && (
              <Notice error message="زامن تعديلات هؤلاء الطلاب قبل الحذف." />
            )}
            <Button
              title="تأكيد حذف الشيخ"
              disabled={!online || !complete || pending}
              busy={action.busy}
              onPress={() =>
                confirmAction(
                  'حذف الشيخ',
                  `${preview.value!.sheikh.name} · نقل ${
                    Object.values(choices).filter(v => v !== 'delete').length
                  } طالب وحذف ${
                    Object.values(choices).filter(v => v === 'delete').length
                  } طالب.`,
                  () => {
                    void action.run(async () => {
                      const resolutions: SheikhStudentDeletionResolution[] =
                        preview.value!.students.map(st =>
                          choices[st.id] === 'delete'
                            ? { student_id: st.id, action: 'delete' }
                            : {
                                student_id: st.id,
                                action: 'reassign',
                                sheikh_id: Number(choices[st.id]),
                              },
                        );
                      await engine.publish(`/sheikhs/${id}/delete`, {
                        student_resolutions: resolutions,
                      });
                      setOpen(false);
                      await engine.sync();
                      onDeleted();
                    });
                  },
                  true,
                )
              }
            />
          </>
        )}
        {action.error && <Notice error message={action.error} />}
      </Sheet>
    </>
  );
}
