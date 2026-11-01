import React from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import type { OfflineEngine } from '../src/offline/engine';
jest.mock('react-native-keychain', () => ({}));
let mockOnline = true;
jest.mock('../src/hooks', () => ({
  useEngine: () => ({
    online: mockOnline,
    data: { settings: { multiple_sessions_per_day_enabled: true } },
  }),
}));
jest.mock('../src/ui', () => {
  const React = require('react');
  const component = (type: string) => (props: object) =>
    React.createElement(type, props);
  return {
    Button: component('button'),
    Field: component('field'),
    Select: component('select'),
    Notice: component('notice'),
    Txt: component('text'),
    s: { row: {} },
  };
});
import { WeeklyScheduleForm } from '../src/screens/SessionSchedules';
let screen: ReactTestRenderer;
let request: jest.Mock;
let sync: jest.Mock;
let saved: jest.Mock;
const element = (type: string, label: string) =>
  screen.root
    .findAllByType(type as never)
    .find(v => (v.props.title || v.props.label) === label)!;
beforeEach(() => {
  mockOnline = true;
  request = jest.fn().mockResolvedValue([]);
  sync = jest.fn().mockResolvedValue(undefined);
  saved = jest.fn();
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
});
async function open() {
  await act(async () => {
    screen = create(
      <WeeklyScheduleForm
        engine={{ request, sync } as unknown as OfflineEngine}
        onSaved={saved}
      />,
    );
  });
}
test('saves selected weekdays and dates, then refreshes the workspace', async () => {
  await open();
  expect(element('button', 'حفظ الجدول الأسبوعي').props.disabled).toBe(true);
  await act(async () => {
    element('button', 'الأحد').props.onPress();
    element('button', 'الثلاثاء').props.onPress();
    element('field', 'بدءاً من').props.onChangeText('2026-11-01');
  });
  await act(async () => {
    await element('button', 'حفظ الجدول الأسبوعي').props.onPress();
  });
  expect(request).toHaveBeenCalledWith(
    '/session-schedules',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
    weekdays: [0, 2],
    start_date: '2026-11-01',
    timezone: 'Africa/Cairo',
    membership_mode: 'all',
    member_ids: [],
  });
  expect(sync).toHaveBeenCalled();
  expect(saved).toHaveBeenCalled();
});
test('loads categories and sends category IDs rather than a frozen student list', async () => {
  request.mockResolvedValue([{ id: 7, name: 'Group' }]);
  await open();
  await act(async () => {
    element('select', 'طلاب الحلقة').props.onChange('categories');
  });
  expect(request).toHaveBeenCalledWith('/student-categories');
  await act(async () => {
    element('button', 'Group').props.onPress();
    element('button', 'الأحد').props.onPress();
  });
  await act(async () => {
    await element('button', 'حفظ الجدول الأسبوعي').props.onPress();
  });
  expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
    membership_mode: 'categories',
    member_ids: [7],
  });
});
test('keeps the form open on a failed save and disables saving offline', async () => {
  await open();
  await act(async () => {
    element('button', 'الأحد').props.onPress();
  });
  request.mockRejectedValueOnce(new Error('Unable to save'));
  await act(async () => {
    await element('button', 'حفظ الجدول الأسبوعي').props.onPress();
  });
  expect(saved).not.toHaveBeenCalled();
  expect(sync).not.toHaveBeenCalled();
  expect(
    screen.root
      .findAllByType('notice' as never)
      .some(v => v.props.message === 'Unable to save'),
  ).toBe(true);
  mockOnline = false;
  await act(async () => {
    screen.update(
      <WeeklyScheduleForm
        engine={{ request, sync } as unknown as OfflineEngine}
        onSaved={saved}
      />,
    );
  });
  expect(element('button', 'حفظ الجدول الأسبوعي').props.disabled).toBe(true);
});
