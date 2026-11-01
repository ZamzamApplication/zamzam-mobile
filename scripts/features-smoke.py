#!/usr/bin/env python3
"""Exercise people, profiles, Quran and plans in isolated demo data only."""
from pathlib import Path
import runpy
import time

helpers = runpy.run_path(str(Path(__file__).with_name('emulator-smoke.py')), run_name='device_helpers')
device, nodes, tap, find, text_contains, screenshot = [helpers[key] for key in ['device', 'nodes', 'tap', 'find', 'text_contains', 'screenshot']]
adb = helpers['adb']
def fill(key, value):
    node, _ = find(key, scroll=True, editable=True)
    device('fill', '@' + node['ref'], value, '--settle')
    device('keyboard', 'dismiss')
def open_feature(item):
    if item == 'people':
        tap('tab-administration');tap('admin-people',scroll=True)
    elif item == 'quran':
        tap('tab-sessions');tap('session-101',scroll=True);tap('session-quran',scroll=True)
    elif item == 'plans':
        tap('tab-home');tap('home-plans',scroll=True)
def restart():
    device('open', 'com.zamzammobile', '--relaunch')
    find('tab-home', timeout=35)
def step(value):
    print(value, flush=True)

device('open', 'com.zamzammobile')
current = nodes()
if any(helpers['match'](n, 'login-submit') for n in current):
    raise AssertionError('This smoke flow requires an existing isolated demo session; the public demo login entry was removed.')
text_contains('وضع تجريبي', timeout=30)
wifi = adb('shell','settings','get','global','wifi_on').strip()
mobile = adb('shell','settings','get','global','mobile_data').strip()
marker = str(int(time.time()))
try:
    open_feature('people')
    tap('student-profile-1000', scroll=True)
    find('ملخص الحضور', scroll=True)
    screenshot('student-profile')
    step('PASS: student directory opens a cached profile and attendance summary')
    open_feature('people')
    tap('add-student', scroll=True)
    fill('student-name', 'QA student ' + marker)
    tap('student-save', scroll=True)
    fill('people-search', 'QA student ' + marker)
    find('student-profile-*', scroll=True)
    step('PASS: student creation publishes only to the demo directory')
    open_feature('people')
    tap('الشيوخ')
    tap('add-sheikh', scroll=True)
    fill('sheikh-name', 'QA teacher ' + marker)
    tap('sheikh-save', scroll=True)
    fill('people-search', 'QA teacher ' + marker)
    find('تعديل الشيخ', scroll=True)
    step('PASS: sheikh creation and search')
    open_feature('quran')
    find('quran-edit-1000-new_memorization', timeout=35, scroll=True)
    device('settings','wifi','off')
    device('settings','mobile-data','off')
    tap('quran-edit-1000-new_memorization')
    fill('quran-notes', 'Quran offline ' + marker)
    tap('quran-save', scroll=True)
    find('1 تعديل قرآن محفوظ على الجهاز', scroll=True)
    restart()
    open_feature('quran')
    tap('quran-edit-1000-new_memorization', scroll=True)
    field, _ = find('quran-notes', scroll=True, editable=True)
    assert marker in field.get('text',''), 'Offline Quran record did not survive restart'
    screenshot('quran-offline-restart')
    step('PASS: Quran editing works offline and survives a cold restart')
    device('settings','wifi','on')
    device('settings','mobile-data','on')
    tap('sync-status')
    text_contains('متصل بالإنترنت', timeout=35)
    tap('sync-now')
    text_contains('0 تغيير بانتظار المزامنة', timeout=35)
    tap('إغلاق')
    step('PASS: reconnect synchronizes the Quran outbox')
    open_feature('plans')
    tap('plan-create', scroll=True)
    fill('plan-name', 'QA plan ' + marker)
    tap('plan-save', scroll=True)
    find('مشاركة جدول الخطة', timeout=35, scroll=True)
    screenshot('personal-plan')
    restart()
    open_feature('plans')
    find('QA plan ' + marker, scroll=True)
    step('PASS: Quran plan generation, publication, and cached library persistence')
    step('ALL FEATURE SMOKE CHECKS PASSED')
finally:
    device('settings','wifi','on' if wifi == '1' else 'off')
    device('settings','mobile-data','on' if mobile == '1' else 'off')
