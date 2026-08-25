/**
 * tests/empirical-challenger-edge-cases.js
 * Dedicated Empirical Challenger Stress Test for Milestone Verification & Edge Cases
 */

import { assert, createBrowserEnv } from './test-harness.js';
import { timetableService, TimetableService } from '../js/services/timetable-service.js';
import { busLocationService, formatDelayText, getStopNameFromPole } from '../js/services/bus-location-service.js';
import { StepTimelineComponent, escapeHtml } from '../js/ui/step-timeline.js';
import { PollingService } from '../js/services/polling-service.js';
import { transferService } from '../js/services/transfer-service.js';

console.log('========================================================================');
console.log('  EMPIRICAL CHALLENGER DEEP EDGE-CASE & STRESS VERIFICATION SUITE       ');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// 1. Midnight Rollover Delays (23:50 + 25m = 00:15)
// -----------------------------------------------------------------------------
console.log('▶ [Edge Case 1] Midnight Rollover & Late Night Delays');

test('23:50 scheduled bus delayed by 25 minutes calculates actual departure 00:15', () => {
  const ts = new TimetableService();
  const depMin = ts.timeStringToMinutes('23:50');
  const actualDepMin = depMin + 25; // 1455 min
  const actualDepStr = ts.minutesToTimeString(actualDepMin);
  assert.equal(actualDepStr, '00:15', '1455 minutes should wrap to 00:15');
});

test('getNextDepartures preserves 23:50 bus delayed to 00:15 when current time is 23:40', () => {
  const ts = new TimetableService();
  const timetable = [
    { departureTime: '23:50', actualDepartureTime: '00:15', line: '111系統', destination: '上大岡駅前', delayMinutes: 25 },
    { departureTime: '23:55', actualDepartureTime: '23:55', line: '111系統', destination: '上大岡駅前', delayMinutes: 0 }
  ];

  // Current time: 23:40:00 (Aug 23, 2026)
  const now = new Date(2026, 7, 23, 23, 40, 0);
  const nextDeps = ts.getNextDepartures(timetable, now, 5);

  assert.equal(nextDeps.length, 2, 'Both departures should be retained');
  // First should be 23:55 (15 min away), second should be 00:15 (35 min away)
  assert.equal(nextDeps[0].actualDepartureTime, '23:55');
  assert.equal(nextDeps[0].diffMinutes, 15);
  assert.equal(nextDeps[0].countdownText, 'あと 15分');

  assert.equal(nextDeps[1].actualDepartureTime, '00:15');
  assert.equal(nextDeps[1].diffMinutes, 35);
  assert.equal(nextDeps[1].countdownText, 'あと 35分');
});

test('getNextDepartures preserves 23:50 bus delayed to 00:15 when current time is 23:50', () => {
  const ts = new TimetableService();
  const timetable = [
    { departureTime: '23:50', actualDepartureTime: '00:15', line: '111系統', destination: '上大岡駅前', delayMinutes: 25 }
  ];

  const now = new Date(2026, 7, 23, 23, 50, 0);
  const nextDeps = ts.getNextDepartures(timetable, now, 5);

  assert.equal(nextDeps.length, 1);
  assert.equal(nextDeps[0].diffMinutes, 25);
  assert.equal(nextDeps[0].countdownText, 'あと 25分');
});

test('getNextDepartures handles current time past midnight (00:05) with 00:15 bus', () => {
  const ts = new TimetableService();
  const timetable = [
    { departureTime: '23:50', actualDepartureTime: '00:15', line: '111系統', destination: '上大岡駅前', delayMinutes: 25 },
    { departureTime: '00:10', actualDepartureTime: '00:10', line: '133系統', destination: '根岸駅前', delayMinutes: 0 }
  ];

  // Current time: 00:05:00
  const now = new Date(2026, 7, 24, 0, 5, 0);
  const nextDeps = ts.getNextDepartures(timetable, now, 5);

  assert.equal(nextDeps.length, 2);
  assert.equal(nextDeps[0].actualDepartureTime, '00:10');
  assert.equal(nextDeps[0].diffMinutes, 5);
  assert.equal(nextDeps[1].actualDepartureTime, '00:15');
  assert.equal(nextDeps[1].diffMinutes, 10);
});

// -----------------------------------------------------------------------------
// 2. Sparse Arrays in timelineNodes
// -----------------------------------------------------------------------------
console.log('\n▶ [Edge Case 2] Sparse & Corrupted Arrays in timelineNodes');

test('StepTimelineComponent safely handles sparse arrays with null and undefined elements', () => {
  const timeline = new StepTimelineComponent();

  const sparseStatus = {
    status: 'en_route',
    statusText: '2個前を走行中',
    delayMinutes: 3,
    delayText: '+3分遅れ',
    busSegmentIndex: 1,
    busMarkerPercent: 50,
    timelineNodes: [
      null,
      undefined,
      { name: '吉原', relText: '2個前', state: 'passed' },
      null,
      { name: '港南区総合庁舎前', relText: '1個前', state: 'upcoming' },
      undefined,
      { name: '上大岡駅前', relText: '当バス停', isTarget: true, state: 'target' },
      null
    ]
  };

  const html = timeline.render(sparseStatus);
  assert.ok(html.length > 0, 'HTML should render without throwing TypeError');
  assert.includes(html, '吉原');
  assert.includes(html, '上大岡駅前');
  assert.includes(html, 'target-dot');
  assert.includes(html, 'jr-step-timeline-container');
});

test('StepTimelineComponent handles completely empty, non-array, or corrupted timelineNodes', () => {
  const timeline = new StepTimelineComponent();

  assert.equal(timeline.render({ timelineNodes: [] }), '');
  assert.equal(timeline.render({ timelineNodes: null }), '');
  assert.equal(timeline.render({ timelineNodes: 'corrupted' }), '');
  assert.equal(timeline.render({ timelineNodes: 12345 }), '');
  assert.equal(timeline.render({ timelineNodes: {} }), '');
});

// -----------------------------------------------------------------------------
// 3. XSS Payloads & HTML Sanitization
// -----------------------------------------------------------------------------
console.log('\n▶ [Edge Case 3] Adversarial XSS Payloads in All Dynamic Fields');

test('escapeHtml handles comprehensive XSS test vector set', () => {
  const attackVectors = [
    '<script>alert("XSS")</script>',
    '"><img src=x onerror=alert(1)>',
    '"><svg/onload=alert(1)>',
    'javascript:alert(1)',
    '\' onclick=\'alert(1)',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<b onmouseover=alert(1)>hover</b>',
    '"><script src="//evil.com/xss.js"></script>'
  ];

  for (const vector of attackVectors) {
    const escaped = escapeHtml(vector);
    assert.false(escaped.includes('<script'), `Escaped string should not contain unescaped <script: ${vector}`);
    assert.false(escaped.includes('<img'), `Escaped string should not contain unescaped <img: ${vector}`);
    assert.false(escaped.includes('<svg'), `Escaped string should not contain unescaped <svg: ${vector}`);
    assert.false(escaped.includes('<iframe'), `Escaped string should not contain unescaped <iframe: ${vector}`);
    assert.false(escaped.includes('<b'), `Escaped string should not contain unescaped <b: ${vector}`);
  }
});

test('StepTimelineComponent eliminates status modifier attribute injection', () => {
  const timeline = new StepTimelineComponent();

  const maliciousStatus = {
    status: '"><script>alert("XSS")</script><div class="',
    statusText: '<script>alert(1)</script>',
    delayMinutes: 0,
    delayText: '"><img src=x onerror=alert(1)>',
    timelineNodes: [
      { name: '<script>alert(2)</script>', relText: '<svg onload=alert(3)>', isTarget: false },
      { name: '"><img src=1 onerror=alert(4)>', isTarget: true }
    ]
  };

  const html = timeline.render(maliciousStatus);
  assert.false(html.includes('<script>'), 'Rendered HTML should have zero unescaped <script> tags');
  assert.false(html.includes('<img src='), 'Rendered HTML should have zero unescaped <img tags');
  assert.false(html.includes('<svg onload='), 'Rendered HTML should have zero unescaped <svg tags');
  assert.includes(html, 'status-scheduled', 'Should safely fallback to status-scheduled');
});

// -----------------------------------------------------------------------------
// 4. Non-Finite Delays (Infinity, -Infinity, NaN, null, undefined)
// -----------------------------------------------------------------------------
console.log('\n▶ [Edge Case 4] Non-Finite Delays & Malformed Numbers');

test('formatDelayText safely normalizes all non-finite and malformed delay inputs', () => {
  assert.deepEqual(formatDelayText(Infinity), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText(-Infinity), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText(NaN), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText(null), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText(undefined), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText('9999'), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText({}), { delayMinutes: 0, delayText: '定刻' });
  assert.deepEqual(formatDelayText([]), { delayMinutes: 0, delayText: '定刻' });
});

test('busLocationService handles live bus with non-finite and extreme delay fields', () => {
  const busWithInfinityDelay = {
    '@id': 'odpt.Bus:YokohamaMunicipal.111.Vehicle9999',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.1',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiNichome.7802.1',
    'odpt:delay': Infinity
  };

  const status = busLocationService.getBusLocationStatus(
    busWithInfinityDelay,
    'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    '111'
  );

  assert.equal(status.delayMinutes, 0);
  assert.equal(status.delayText, '定刻');
});

// -----------------------------------------------------------------------------
// 5. Rapid Polling Transitions & UI Lifecycle
// -----------------------------------------------------------------------------
console.log('\n▶ [Edge Case 5] Rapid Polling Transitions & Lifecycle Stress');

test('PollingService constructor accepts object, numbers, or callbacks seamlessly', () => {
  const p1 = new PollingService({ intervalSec: 45 });
  assert.equal(p1.intervalSec, 45);

  const p2 = new PollingService(30000, () => {});
  assert.equal(p2.intervalSec, 30);

  const p3 = new PollingService(15, () => {});
  assert.equal(p3.intervalSec, 15);
});

test('PollingService supports rapid consecutive start, pause, resume, and stop calls', () => {
  let refreshCount = 0;
  const polling = new PollingService({
    intervalSec: 30,
    onRefresh: () => { refreshCount++; }
  });

  for (let i = 0; i < 50; i++) {
    polling.start();
    polling.pause();
    polling.resume();
    polling.resetCountdown();
    polling.stop();
  }

  assert.equal(polling.isRunning, false);
  assert.equal(refreshCount, 0);
});

test('PollingService debounces rapid consecutive manual refreshes', () => {
  let refreshCount = 0;
  const polling = new PollingService({
    intervalSec: 30,
    onRefresh: () => { refreshCount++; }
  });

  const res1 = polling.manualRefresh();
  const res2 = polling.manualRefresh();
  const res3 = polling.manualRefresh();
  const res4 = polling.manualRefresh();

  assert.equal(res1, true, 'First manual refresh should be permitted');
  assert.equal(res2, false, 'Second immediate manual refresh should be debounced');
  assert.equal(res3, false, 'Third immediate manual refresh should be debounced');
  assert.equal(res4, false, 'Fourth immediate manual refresh should be debounced');
  assert.equal(refreshCount, 1, 'Callback should be called exactly once');
});

test('In-place countdown update algorithm preserves DOM element references and keyframe animation continuity', () => {
  const env = createBrowserEnv();
  const container = env.document.createElement('div');
  container.innerHTML = `
    <div class="departure-item" data-dep-time="23:55">
      <div class="dep-header">
        <span class="dep-countdown">あと 10分</span>
      </div>
      <div class="jr-step-timeline-container is-live">
        <div class="bus-marker-wrap"><div class="bus-marker-icon">🚍</div></div>
      </div>
    </div>
  `;

  const markerBefore = container.querySelector('.bus-marker-icon');
  const countdownEl = container.querySelector('.dep-countdown');
  assert.ok(markerBefore, 'Bus marker must exist before update');

  // Perform in-place update logic identical to app.js
  const now = new Date(2026, 7, 23, 23, 48, 0); // 7 minutes before 23:55
  const curMin = now.getHours() * 60 + now.getMinutes();
  const curSec = now.getSeconds();
  const curTotalSec = curMin * 60 + curSec;

  const items = container.querySelectorAll('.departure-item');
  items.forEach(item => {
    const depTimeStr = item.dataset.depTime;
    let depMin = timetableService.timeStringToMinutes(depTimeStr);
    let depSec = depMin * 60;
    let diffSec = depSec - curTotalSec;
    const diffMin = Math.floor(diffSec / 60);
    const countdown = timetableService.formatCountdown(diffMin, diffSec);
    const cEl = item.querySelector('.dep-countdown');
    if (cEl && cEl.textContent !== countdown.text) {
      cEl.textContent = countdown.text;
    }
  });

  const markerAfter = container.querySelector('.bus-marker-icon');
  assert.equal(countdownEl.textContent, 'あと 7分');
  assert.ok(markerBefore === markerAfter, 'DOM node identity must be preserved across countdown updates!');
});

console.log('\n========================================================================');
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
