#!/usr/bin/env python3
"""Exercise only the explicitly labelled demo, on an explicit emulator serial.

No production credentials, app-data reset, or production writes are performed.
Network settings are restored even if an assertion fails.
"""
import argparse
import os
from pathlib import Path
import json
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--serial', default='emulator-5554')
parser.add_argument('--agent-device', default=os.environ.get('AGENT_DEVICE'), required=not os.environ.get('AGENT_DEVICE'), help='Device-bound command returned by T3 device_open')
parser.add_argument('--artifacts', default='artifacts/emulator')
args = parser.parse_args()
adb_path = Path(os.environ.get('ANDROID_HOME', str(Path.home() / 'Android/Sdk'))) / 'platform-tools/adb'
base = [str(adb_path), '-s', args.serial]
artifacts = Path(args.artifacts)
artifacts.mkdir(parents=True, exist_ok=True)


def adb(*parts, binary=False):
    return subprocess.check_output(base + list(parts), timeout=35, text=not binary)


def device(*parts):
    return subprocess.check_output([args.agent_device, *parts], timeout=60, text=True)


def nodes():
    result = json.loads(device('snapshot', '--json'))
    if not result.get('success'):
        raise AssertionError(result)
    return [dict(n, **{
        'resource-id': n.get('identifier', ''),
        'content-desc': n.get('contentDescription', n.get('label', '')),
        'text': n.get('value', n.get('label', '')),
        'class': n.get('type', ''),
    }) for n in result['data']['nodes'] if n.get('visibleToUser', True)]


def match(node, needle):
    return node.get('resource-id') == needle or node.get('content-desc') == needle or node.get('text') == needle


def find(needle, timeout=40, scroll=False, editable=False):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        visible = nodes()
        for node in sorted(visible, key=lambda n: n.get('class') != 'android.widget.EditText'):
            if match(node, needle) and (not editable or node.get('editable')):
                rect = node.get('rect', {})
                if rect.get('height', 0) > 0 and rect.get('width', 0) > 0:
                    return node, rect
        if scroll:
            areas = [n for n in visible if n.get('kind') == 'scroll-area' and n.get('rect', {}).get('height', 0) > 150]
            if not areas: raise AssertionError('No visible scroll area')
            rect = max(areas, key=lambda n: n['rect']['height'])['rect']
            device('scroll', 'down', '--pixels', '200', '--duration-ms', '600', '--settle')
            time.sleep(.25)
        else:
            time.sleep(.3)
    (artifacts / 'failure-nodes.json').write_text(json.dumps(nodes(), ensure_ascii=False, indent=2))
    raise AssertionError(f'UI element not found: {needle}')


def tap(needle, scroll=False):
    node, _ = find(needle, scroll=scroll)
    selector = ('id=' + json.dumps(node['resource-id']) if node['resource-id'] else 'label=' + json.dumps(node['content-desc'], ensure_ascii=False))
    device('press', selector, '--settle')


def text_contains(value, timeout=20):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if any(value in (n.get('text', '') + n.get('content-desc', '')) for n in nodes()):
            return
        time.sleep(.3)
    raise AssertionError(f'Expected UI text: {value}')


def screenshot(name):
    device('screenshot', str((artifacts / f'{name}.png').resolve()))


def append(needle, value):
    node, _ = find(needle, scroll=True, editable=True)
    device('fill', '@' + node['ref'], node.get('text', '') + value, '--settle')
    device('keyboard', 'dismiss')


def workspace(number):
    tap('workspace-switcher')
    tap(f'workspace-{number}')
    text_contains('تحفيظ زمزم' if number == 1 else 'تحفيظ النور')


def restart():
    device('open', 'com.zamzammobile', '--relaunch')
    find('tab-sessions', timeout=35)


def open_attendance():
    tap('tab-sessions')
    tap('session-101', scroll=True)
    text_contains('تسجيل الحضور')


def step(value):
    print(value, flush=True)


def main():
    device('open', 'com.zamzammobile')
    wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on').strip()
    mobile = adb('shell', 'settings', 'get', 'global', 'mobile_data').strip()
    marker = 'offline-' + str(int(time.time()))
    try:
        current = nodes()
        if any(match(n, 'demo-start') for n in current):
            tap('demo-start', scroll=True)
        elif any(match(n, 'login-submit') for n in current):
            tap('demo-start', scroll=True)
        text_contains('وضع تجريبي', timeout=30)
        step('PASS: app is in explicitly isolated demo mode')
        tap('tab-home')
        text_contains('لوحة المتابعة')
        screenshot('home-top')
        find('home-next-session', scroll=True)
        screenshot('home-summary')
        tap('home-next-session')
        text_contains('تسجيل الحضور')
        step('PASS: home dashboard loads and opens the next pending session')
        workspace(2)
        tap('tab-sessions')
        find('session-201', scroll=True)
        workspace(1)
        tap('tab-sessions')
        find('session-101', scroll=True)
        step('PASS: both tahfiz workspaces downloaded and switched online')

        device('settings', 'wifi', 'off')
        device('settings', 'mobile-data', 'off')
        text_contains('دون اتصال')
        open_attendance()
        tap('status-menu-1000', scroll=True)
        options = nodes()
        target = next((n.get('content-desc') for n in options if n.get('content-desc') in ['حاضر', '✓ حاضر']), None)
        if target is None:
            raise AssertionError('Attendance present option missing')
        tap(target)
        append('notes-1000', marker)
        screenshot('attendance-offline')
        tap('sync-status')
        text_contains('بانتظار المزامنة')
        tap('إغلاق')
        step('PASS: attendance status and notes saved locally without a network')

        restart()
        text_contains('دون اتصال')
        tap('tab-home')
        find('home-pending-sync', scroll=True)
        screenshot('home-offline-attention')
        step('PASS: home shows cached summary and pending changes after offline restart')
        open_attendance()
        field, _ = find('notes-1000', scroll=True)
        if marker not in field.get('text', ''):
            raise AssertionError('Attendance note did not survive cold restart')
        step('PASS: offline attendance and pending outbox survive force-stop/restart')

        workspace(2)
        tap('tab-sessions')
        find('session-201', scroll=True)
        workspace(1)
        open_attendance()
        field, _ = find('notes-1000', scroll=True)
        assert marker in field.get('text', '')
        step('PASS: cached tahfiz switching offline keeps attendance isolated')

        tap('tab-attendance')
        text_contains('متابعة حضور الطلاب حسب الشهر والشيخ')
        screenshot('attendance-record')
        tap('tab-settings')
        tap('settings-general', scroll=True)
        append('وصف التحفيظ', marker)
        text_contains('مسودة محفوظة على الجهاز')
        restart()
        tap('tab-settings')
        tap('settings-general', scroll=True)
        field, _ = find('وصف التحفيظ', scroll=True, editable=True)
        assert marker in field.get('text', '')
        screenshot('settings-offline-draft')
        step('PASS: settings drafts survive an offline cold restart')

        device('settings', 'wifi', 'on')
        device('settings', 'mobile-data', 'on')
        tap('sync-status')
        text_contains('متصل بالإنترنت', timeout=35)
        tap('sync-now')
        text_contains('0 تغيير بانتظار المزامنة', timeout=35)
        step('PASS: reconnect drains the outbox and keeps the local record')
        tap('إغلاق')
        open_attendance()
        field, _ = find('notes-1000', scroll=True)
        assert marker in field.get('text', '')
        screenshot('attendance-synced')

        tap('tab-settings')
        find('settings-general', scroll=True)
        tap('theme-toggle')
        screenshot('settings-dark')
        tap('theme-toggle')
        step('PASS: attendance record, settings navigation, and theme toggle')

        # The Android userdebug emulator can inspect the file even for a release APK.
        try:
            reader = ['run-as', 'com.zamzammobile']
            files = adb('shell', *reader, 'find', '.', '-name', 'zamzam-offline-v1.sqlite').splitlines()
        except subprocess.CalledProcessError:
            reader = ['su', '0']
            files = adb('shell', *reader, 'find', '/data/user/0/com.zamzammobile', '-name', 'zamzam-offline-v1.sqlite').splitlines()
        assert files, 'Encrypted database file not found'
        if files:
            header = adb('exec-out', *reader, 'dd', f'if={files[0]}', 'bs=16', 'count=1', binary=True)
            assert header[:16] != b'SQLite format 3\x00' and len(header) >= 16
            step('PASS: database file header is encrypted (SQLCipher)')
        step('ALL EMULATOR SMOKE CHECKS PASSED')
    finally:
        device('settings', 'wifi', 'on' if wifi == '1' else 'off')
        device('settings', 'mobile-data', 'on' if mobile == '1' else 'off')


if __name__ == '__main__':
    main()
