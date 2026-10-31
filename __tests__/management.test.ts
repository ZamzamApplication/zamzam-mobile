import {
  invitationToken,
  initialSetup,
  validateSetup,
} from '../src/registration';
import {
  parseFilterGroups,
  matchesFilterGroups,
} from '../src/attendance-filters';
import { demoManagement } from '../src/demo-management';
import type { DemoManagementData } from '../src/demo-management';
import type { FilterGroup, StudentInfo } from '../src/domain-types';
import type { Roster, Session, Settings } from '../src/types';
const sessions = [
  { id: 1, date: '2026-10-04' },
  { id: 2, date: '2026-10-11' },
];
const group = (operator: 'is' | 'is_not' = 'is'): FilterGroup[] => [
  {
    id: 'g',
    rules: [
      { target: 'weekday', weekday: 0, sessionId: 1, operator, status: 'حاضر' },
    ],
  },
];
test('invitation parsing accepts website links and app links without turning arbitrary paths into requests', () => {
  const token = 'abcdefghijklmnop_123';
  for (const value of [
    token,
    `https://zamzam-web.fly.dev/invite/${token}`,
    `zamzam://invite/${token}`,
    `/invite/${token}`,
  ])
    expect(invitationToken(value)).toBe(token);
  for (const value of [
    'http://bad/invite/abc',
    'javascript:alert(1)',
    'https://site/invite/a/b',
    'a?role=admin',
    '',
  ])
    expect(() => invitationToken(value)).toThrow();
});
test('initial setup validates semantic attendance choices and month boundaries', () => {
  expect(() => validateSetup(initialSetup)).not.toThrow();
  expect(() =>
    validateSetup({ ...initialSetup, absent_status: 'حاضر' }),
  ).toThrow();
  expect(() =>
    validateSetup({ ...initialSetup, month_start_day: 29 }),
  ).toThrow();
  expect(() =>
    validateSetup({ ...initialSetup, subscription_default_fee_minor: -1 }),
  ).toThrow();
});
test('malformed saved filters cannot crash or introduce unsupported operators', () => {
  for (const raw of [
    'null',
    '{}',
    'invalid',
    '[{"rules":[{"operator":"execute","status":"x"}]}]',
    '[{"rules":[{"target":"weekday","weekday":9,"operator":"is","status":"x"}]}]',
  ])
    expect(() => parseFilterGroups(raw)).toThrow();
  expect(parseFilterGroups(JSON.stringify(group()))).toEqual([
    { ...group()[0], connector: 'and' },
  ]);
});
test('weekday is-not means none of the available records matches and missing days do not match', () => {
  const mixed = { records: { '1': 'حاضر', '2': 'غياب' } };
  expect(matchesFilterGroups(mixed, group('is'), sessions)).toBe(true);
  expect(matchesFilterGroups(mixed, group('is_not'), sessions)).toBe(false);
  expect(
    matchesFilterGroups(
      { records: { '1': 'غياب', '2': 'غياب' } },
      group('is_not'),
      sessions,
    ),
  ).toBe(true);
  expect(matchesFilterGroups({ records: {} }, group('is_not'), sessions)).toBe(
    false,
  );
  expect(matchesFilterGroups(mixed, group('is_not'), [])).toBe(false);
});
test('group connectors combine session rules without changing stored data', () => {
  const groups: FilterGroup[] = [
    { id: 'a', rules: [{ sessionId: 1, operator: 'is', status: 'حاضر' }] },
    {
      id: 'b',
      connector: 'or',
      rules: [{ sessionId: 2, operator: 'is', status: 'حاضر' }],
    },
  ];
  expect(
    matchesFilterGroups({ records: { '2': 'حاضر' } }, groups, sessions),
  ).toBe(true);
  groups[1].connector = 'and';
  expect(
    matchesFilterGroups({ records: { '2': 'حاضر' } }, groups, sessions),
  ).toBe(false);
});
function fixture(): DemoManagementData & {
  settings: Settings;
  sessions: Session[];
  rosters: Record<number, Roster>;
  people: StudentInfo[];
  sheikhs: any[];
} {
  return {
    settings: { id: 1, name: 'Demo' },
    sessions: [
      {
        id: 10,
        date: '2026-10-01',
        circle_id: 1,
        is_confirmed: false,
        quran_progress_enabled: false,
        version: 1,
      },
    ],
    rosters: {
      10: {
        session_id: 10,
        date: '2026-10-01',
        circle_id: 1,
        is_confirmed: false,
        quran_progress_enabled: false,
        version: 1,
        sheikh_groups: [],
        circle_sheikhs: [],
      },
    },
    people: [
      { id: 1, name: 'Student', sheikh: { id: 5, name: 'Old' } } as StudentInfo,
    ],
    sheikhs: [
      { id: 5, name: 'Old' },
      { id: 6, name: 'New' },
    ],
  };
}
test('demo account CRUD never stores passwords and revocation removes access', () => {
  const w = fixture();
  const request = (
    route: string,
    method: string,
    body: Record<string, unknown>,
  ) =>
    demoManagement(w, route, method, body, new URLSearchParams()).value as any;
  const user = request('/users', 'POST', {
    username: 'New user',
    password: 'secret-ignored',
    role: 'sheikh',
    sheikh_id: 5,
  });
  expect(user.password).toBeUndefined();
  request(`/users/${user.id}`, 'PUT', {
    role: 'auditor',
    sheikh_id: null,
    password: 'other-secret',
  });
  expect(w.users?.find(u => u.id === user.id)?.role).toBe('auditor');
  expect(JSON.stringify(w)).not.toContain('other-secret');
  request(`/users/${user.id}`, 'DELETE', {});
  expect(w.users?.some(u => u.id === user.id)).toBe(false);
});
test('demo archive preserves records, rejects stale recovery, and restores the session', () => {
  const w = fixture(),
    request = (action: string, version: number) =>
      demoManagement(
        w,
        `/sessions/10/${action}`,
        'POST',
        { expected_version: version },
        new URLSearchParams(),
      );
  request('archive', 1);
  expect(w.sessions[0].archived_at).toBeTruthy();
  expect(w.rosters[10]).toBeDefined();
  expect(() => request('recover', 1)).toThrow();
  request('recover', 2);
  expect(w.sessions[0].archived_at).toBeNull();
});
test('demo sheikh deletion requires every student resolution and reassigns before removal', () => {
  const w = fixture();
  expect(() =>
    demoManagement(
      w,
      '/sheikhs/5/delete',
      'POST',
      { student_resolutions: [] },
      new URLSearchParams(),
    ),
  ).toThrow();
  demoManagement(
    w,
    '/sheikhs/5/delete',
    'POST',
    {
      student_resolutions: [
        { student_id: 1, action: 'reassign', sheikh_id: 6 },
      ],
    },
    new URLSearchParams(),
  );
  expect(w.people[0].sheikh?.id).toBe(6);
  expect(w.sheikhs.some(sh => sh.id === 5)).toBe(false);
});
