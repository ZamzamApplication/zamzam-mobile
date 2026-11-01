import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
jest.mock('react-native-keychain', () => ({}));
jest.mock('../src/ui', () => {
  const React = require('react');
  const component = (type: string) => (props: object) =>
    React.createElement(type, props);
  return {
    Card: component('card'),
    Txt: component('text'),
    Field: component('field'),
    Select: component('select'),
    Button: component('button'),
    Heading: component('heading'),
    Notice: component('notice'),
    s: { page: {} },
    useTheme: () => ({ cyan: '#0891b2' }),
  };
});
import { ApiClient } from '../src/api';
import { PublicStudentRegistration } from '../src/screens/PublicStudentRegistration';

const form = {
  title: 'تسجيل الطلاب',
  tahfiz_name: 'دار اختبار',
  description: '',
  fields: [
    {
      id: 7,
      name: 'المستوى',
      field_type: 'select',
      options: ['مبتدئ'],
      is_required: true,
    },
    {
      id: 8,
      name: 'الموافقة',
      field_type: 'checkbox',
      options: [],
      is_required: true,
    },
  ],
};
let screen: ReactTestRenderer;
let request: jest.SpyInstance;
beforeEach(() => {
  request = jest.spyOn(ApiClient, 'publicRequest').mockResolvedValue(form);
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
  request.mockRestore();
});
async function open() {
  await act(async () => {
    screen = create(
      <PublicStudentRegistration token={'a'.repeat(43)} onBack={() => {}} />,
    );
  });
}
const element = (type: string, props: Record<string, unknown>) =>
  screen.root
    .findAllByType(type as never)
    .find(node =>
      Object.entries(props).every(([key, value]) => node.props[key] === value),
    )!;

test('opens publicly and validates required answers before explicit submission', async () => {
  await open();
  expect(request).toHaveBeenCalledWith(
    `/student-registration/public/${'a'.repeat(43)}`,
  );
  await act(async () =>
    element('field', { testID: 'public-registration-name' }).props.onChangeText(
      'أحمد',
    ),
  );
  await act(async () =>
    element('button', { testID: 'public-registration-submit' }).props.onPress(),
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(element('notice', { error: true }).props.message).toContain('المستوى');
  await act(async () => {
    element('select', { label: 'المستوى *' }).props.onChange('مبتدئ');
    element('select', { label: 'الموافقة *' }).props.onChange('false');
  });
  await act(async () =>
    element('button', { testID: 'public-registration-submit' }).props.onPress(),
  );
  expect(request).toHaveBeenLastCalledWith(
    `/student-registration/public/${'a'.repeat(43)}`,
    {
      name: 'أحمد',
      phone: null,
      birthday: null,
      answers: { '7': 'مبتدئ', '8': 'false' },
      website: '',
    },
  );
  expect(element('heading', { title: 'تم إرسال الطلب بنجاح' })).toBeDefined();
});

test('keeps entered details after a failed submission and never retries it automatically', async () => {
  request
    .mockResolvedValueOnce({ ...form, fields: [] })
    .mockRejectedValueOnce(new Error('انقطع الاتصال'));
  await open();
  await act(async () =>
    element('field', { testID: 'public-registration-name' }).props.onChangeText(
      'أحمد',
    ),
  );
  await act(async () =>
    element('button', { testID: 'public-registration-submit' }).props.onPress(),
  );
  expect(
    element('field', { testID: 'public-registration-name' }).props.value,
  ).toBe('أحمد');
  expect(request).toHaveBeenCalledTimes(2);
  expect(element('notice', { error: true }).props.message).toBe(
    'انقطع الاتصال',
  );
});
