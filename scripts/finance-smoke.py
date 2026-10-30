#!/usr/bin/env python3
"""Verify reports and financial flows using isolated demo records only."""
from pathlib import Path
import runpy
import time
h=runpy.run_path(str(Path(__file__).with_name('emulator-smoke.py')),run_name='device_helpers')
device,nodes,tap,find,text_contains,screenshot=[h[k] for k in ['device','nodes','tap','find','text_contains','screenshot']]
def fill(key,value):
    node,_=find(key,scroll=True,editable=True)
    device('fill','@'+node['ref'],value,'--settle')
    device('keyboard','dismiss')
def more(key):
    tap('tab-more');tap(key,scroll=True)
def restart():
    device('open','com.zamzammobile','--relaunch');find('tab-more',timeout=35)
def step(value):print(value,flush=True)
device('open','com.zamzammobile')
text_contains('وضع تجريبي')
wifi=h['adb']('shell','settings','get','global','wifi_on').strip()
mobile=h['adb']('shell','settings','get','global','mobile_data').strip()
marker=str(int(time.time()))
try:
    more('more-reports')
    fill('report-from','2026-02-30')
    node,_=find('report-apply',scroll=True)
    assert not node['enabled'],'Impossible report date was accepted'
    fill('report-from','2026-10-01')
    tap('report-apply',scroll=True)
    find('report-rate',scroll=True)
    screenshot('reports-portrait')
    step('PASS: attendance report loads and rejects invalid date filters')
    device('settings','wifi','off');device('settings','mobile-data','off')
    restart();more('more-reports');find('report-rate',scroll=True)
    step('PASS: report cache survives an offline cold restart')
    device('settings','wifi','on');device('settings','mobile-data','on')
    time.sleep(1)
    more('more-audit')
    fill('audit-query','no-match-'+marker)
    tap('audit-apply',scroll=True)
    find('لا توجد عمليات مطابقة لهذه الفلاتر.',scroll=True)
    step('PASS: audit log applies server-side search and empty results')
    more('more-finance')
    find('finance-net',scroll=True)
    screenshot('finance-portrait')
    tap('finance-expenses',scroll=True)
    tap('finance-add-expense',scroll=True)
    fill('expense-name','QA expense '+marker)
    fill('expense-amount','25.50')
    tap('expense-save',scroll=True)
    # Return to the top to reach the active list filters after publication.
    more('more-finance');tap('finance-expenses',scroll=True)
    fill('finance-search','QA expense '+marker)
    tap('finance-apply',scroll=True)
    find('QA expense '+marker,scroll=True)
    find('تعديل المصروف',scroll=True)
    step('PASS: demo expense publication and filtered retrieval')
    more('more-finance')
    tap('finance-pay-1000',scroll=True)
    tap('finance-confirm-payment',scroll=True)
    tap('تأكيد')
    more('more-finance')
    tap('finance-receipt-1000',scroll=True)
    find('finance-share-receipt',scroll=True)
    screenshot('finance-receipt')
    step('PASS: demo payment confirmation produces a receipt')
    step('ALL REPORT AND FINANCE SMOKE CHECKS PASSED')
finally:
    device('settings','wifi','on' if wifi=='1' else 'off')
    device('settings','mobile-data','on' if mobile=='1' else 'off')
