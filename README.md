# زمزم — Zamzam Mobile

Arabic-first React Native app matching the portrait web client: Cairo fonts,
cyan surfaces, RTL controls, the Tahfiz picker, and bottom navigation.

## Initial features

- Home: the website's dashboard summary, next/pending sessions, student and
  sheikh counts, completion rate, and quick actions. Attention items highlight
  overdue sessions, today's sessions, sync issues, and unpublished settings drafts.
  Summary responses are encrypted and cached separately for each account/tahfiz.
- Sessions: cached open sessions and 90 days of history; online session creation.
- Attendance: teacher groups, search, configurable status cycling/picker, notes,
  teacher reassignment, bulk marking, confirmation, and reasoned reopening.
- Attendance record: monthly periods respecting the configured month start,
  teacher/name filters, and a horizontal attendance table.
- Tahfiz switching: active memberships online; previously downloaded workspaces
  offline. Each workspace keeps its own data, settings drafts, cursor, and outbox.
- Settings: general data, attendance rules/colors/status renames, Qur'an tracking,
  Excel templates, invitations, and WhatSend configuration. Server authorization
  remains authoritative; administrative controls are hidden for non-admins.
- Light/dark appearance, secure native login, refresh rotation, device logout,
  and an explicitly labelled demo isolated from production.

## People and Quran features

The More tab opens student and sheikh directories, student profiles with attendance
summaries, warnings, excuses, leave, and transfers. Administrative forms keep
encrypted drafts; publishing needs a connection and server permission.

Quran tracking supports session entries, forward/reverse ranges, quality,
mistakes, notes, next assignments, history, goals, and student plans. Session Quran
entries use a durable offline outbox with explicit conflict review. Confirmation
waits until attendance and Quran changes have synchronized.

Personal Quran plans include schedule generation, a cached library, progress
drafts, sharing, archiving, and deletion. Publishing a plan or completion uses the
server version to detect concurrent changes. Download the relevant screens before
going offline; creating shared records and publishing drafts require a connection.

## Finance, reports, and audit history

The bottom navigation opens the financial workspace for administrators and auditors;
reports and audit history are available from More.
It follows the website's portrait layout: two-column summary tiles, subscription
and expense tabs, monthly filters, and Cairo typography. Auditors can view data;
administrators can record individual or selected bulk payments, review/share
receipts, cancel payments, correct fees, publish subscription settings, and
create, edit, or delete expenses. Financial forms retain encrypted drafts offline;
payments and publishing require an online confirmation. Failed responses are not
automatically retried; review server records before retrying an uncertain write.

Attendance and Quran reports support date/teacher filters, student search and
sorting, profile links, and cached offline results. Attendance reports count
confirmed sessions; the existing Quran report also includes unconfirmed sessions.
The admin audit log supports server-side search, action/actor/date filters, and
pagination. Every applied filter/page has its own encrypted cache key, so a failed
request cannot label an older result with a new period.

Remaining website parity work includes Excel file export, financial category
administration and historical period generation, trips, user/access management,
public signup/invite flows, feedback/platform administration, and additional
student/session management actions. Receipt sharing currently uses native text
sharing. Existing server permissions remain authoritative.

## Offline behavior

Attendance writes commit locally **before** the app reports them saved. SQLCipher
stores datasets, drafts, sync cursors, and mutations in one encrypted database;
the encryption key and auth tokens are in Keychain / Android Keystore-backed
storage. AsyncStorage holds only appearance and selected demo/account mode.

The first connection downloads `/sync/v1/bootstrap` and complete session rosters
(the latter preserve explicit session membership). A durable outbox pushes to
`/sync/v1/mutations`, then consumes `/sync/v1/changes`. Data and cursors commit in
the same local transaction. Once attempted, a mutation's id and payload never
change. An interrupted request is retried with that id, including after an app
restart. Later edits to the same attendance row wait behind its receipt and are
rebased only after that preceding edit is acknowledged.

Connection restoration, app foregrounding, a short edit debounce, manual retry,
and a foreground timer trigger synchronization. Automatic failures back off.
Pending changes and rejected/conflicting changes are visible in the sync panel.
Conflicts show local and server values; the user chooses the server version or
explicitly resubmits against the current revision. Rejected edits do not loop.

For an existing blocked edit, open مراجعة التعديلات and choose إعادة إرسال أحدث
تعديلاتي or استخدام بيانات الخادم after reviewing the values. If the server
changes again, review the refreshed version before retrying. Confirmation becomes
available after the session's pending and blocked changes are resolved. Install
updates over the existing app to preserve unsynchronized local changes.

Previously downloaded data remains available without a network, including after
a cold start. A workspace's first download, session creation, confirmation,
reopening, and publishing shared settings need a connection. Settings edits are
saved as encrypted local drafts while offline. API keys are never saved in drafts.
Signing out removes auth credentials; encrypted pending data remains scoped to the
same account and is available after that account signs in again.

## Development

Use Node 22.11+, Java 21 (Gradle also provisions its Java 17 toolchain), Android SDK
37.0, build tools 37.0.0, NDK 27.1.12297006, and CMake 3.22.1. SQLCipher is enabled
through the `op-sqlite` entry in `package.json`.

```sh
npm ci
npm start
```

In another terminal, with the emulator running:

```sh
npm run android -- --active-arch-only --no-packager
```

For a self-contained emulator APK that starts without Metro:

```sh
npm run android:standalone
```

This repository's existing release configuration signs that internal test build
with its debug key. Configure private release signing before distributing a
production build. The command builds only the emulator's x86_64 ABI; omit
`-PreactNativeArchitectures=x86_64` to build all configured device ABIs.

The normal API is `https://zamzam-api.fly.dev`. Debug builds expose an optional
server field on login; local HTTP is limited to localhost and Android's host alias
`10.0.2.2`. Production builds use HTTPS. See [the API guide](docs/API.md) and
[OpenAPI](docs/openapi.json).

The login screen includes a server connection check against `/health`. Signing
in uses the Fly backend's authentication, attendance sync, settings, and dashboard
endpoints; demo mode continues to use separate local fixtures. The home page uses
the same `/reports/dashboard-summary` and `/sessions/upcoming` APIs as the website.

On iOS, run `bundle install` and `bundle exec pod install` under `ios/` as appropriate.
Fonts and their OFL license are included; the asset configuration links both
platforms. iOS native compilation requires macOS and is not covered by Android
emulator verification.

## Validation

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
python scripts/emulator-smoke.py --serial emulator-5554 --agent-device /path/from/device_open/agent-device
python scripts/features-smoke.py --serial emulator-5554 --agent-device /path/from/device_open/agent-device
python scripts/finance-smoke.py --serial emulator-5554 --agent-device /path/from/device_open/agent-device
```

Open the emulator through T3 Code's `device_open` tool and pass its device-bound
`agent-device` command to the script. UI actions, network settings, screenshots,
and restarts then appear in the Device panel.

The emulator script requires the labelled demo mode, changes only demo data,
exercises network loss and cold restarts, and restores the original Wi-Fi/mobile
settings in `finally`. It captures local evidence under ignored `artifacts/`.
It checks attendance/notes persistence, cached tenant isolation, settings drafts,
reconnection, attendance history, and theme switching. It also verifies that the
database does not have a plaintext SQLite header, using `run-as` for debug builds
or root file access on the Android userdebug emulator for standalone builds.

The backend change alongside this client removes an incorrect dependency between
attendance sync and Qur'an-progress tracking. Its tests cover receipt replay,
revision conflicts, tenant isolation, and confirmed-session locking. It must be
included when deploying the API. The API also supplies attendance row revisions
in rosters and advances student Quran plans after accepted mobile Quran entries.
