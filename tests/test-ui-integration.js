/**
 * test-ui-integration.js
 * 
 * Milestone 2 & Milestone 3 UI統合・JR風ステップタイムライン検証テストスイート
 * - StepTimelineComponent の render (フルタイムライン) および renderMini (ミニバッジ)
 * - セマンティックARIA属性、アクセシビリティ、XSSエスケープ検証
 * - TimetableService.mergeRealtimeDelays との locationStatus 連携
 * - 個別停留所カード・乗り継ぎ案内カードのHTML構造整合性検証
 */

import { stepTimelineComponent, escapeHtml, StepTimelineComponent } from '../js/ui/step-timeline.js';
import { busLocationService } from '../js/services/bus-location-service.js';
import { timetableService } from '../js/services/timetable-service.js';
import { STOPS, ROUTES } from '../js/config.js';
import { MOCK_BUSES } from '../js/api/mock-data.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, details = '') {
  if (!condition) {
    const fullMsg = details ? `${message} (Details: ${details})` : message;
    console.error(`❌ FAIL: ${fullMsg}`);
    failures.push(fullMsg);
    failed++;
  } else {
    passed++;
    console.log(`✔ PASS: ${message}`);
  }
}

console.log('================================================================');
console.log('🚀 RUNNING UI INTEGRATION & STEP TIMELINE TEST SUITE (M2 & M3)');
console.log('================================================================\n');

// =============================================================================
// 1. escapeHtml & Security Validation
// =============================================================================
console.log('--- 1. HTML Escaping & Security ---');

assert(escapeHtml('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;', 'Escapes HTML tags');
assert(escapeHtml('Tom & Jerry "Special"') === 'Tom &amp; Jerry &quot;Special&quot;', 'Escapes ampersands and quotes');
assert(escapeHtml("Bus '111'") === "Bus &#039;111&#039;", 'Escapes single quotes');
assert(escapeHtml(null) === '', 'Handles null safely');
assert(escapeHtml(undefined) === '', 'Handles undefined safely');

// =============================================================================
// 2. stepTimelineComponent.render() - Full JR-Style Step Timeline Tests
// =============================================================================
console.log('\n--- 2. Full JR-Style Step Timeline Rendering (render) ---');

// 2.1 En Route (走行中: 2個前)
{
  const liveBus = {
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4418',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonankuSogoChoshamae.1827.1',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    'odpt:delay': 180
  };
  const status = busLocationService.getBusLocationStatus(liveBus, 'KamiookaStation', '111系統');
  const html = stepTimelineComponent.render(status);

  assert(html.includes('jr-step-timeline-container'), 'Contains root container class');
  assert(html.includes('role="region"'), 'Contains semantic role="region"');
  assert(html.includes('aria-label="在線位置案内:'), 'Contains ARIA label with status text');
  assert(html.includes('step-timeline-track'), 'Contains track container');
  assert(html.includes('bus-marker-wrap'), 'Contains pulsating bus marker');
  assert(html.includes('🚍'), 'Contains bus emoji icon');
  assert(html.includes('走行中 (+3分)'), 'Contains marker label with delay text');
  assert(html.includes('delay-some'), 'Applies delay-some class for 3 min delay');
  assert(html.includes('吉原'), 'Contains fromStop node name');
  assert(html.includes('上大岡駅前'), 'Contains target stop node name');
  assert(html.includes('当バス停'), 'Contains target relText');
  assert(html.includes('target-dot'), 'Target node has target-dot');
}

// 2.2 Approaching (まもなく到着: 1個前)
{
  const approachingBus = {
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4412',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    'odpt:delay': 0
  };
  const status = busLocationService.getBusLocationStatus(approachingBus, 'KamiookaStation', '111系統');
  const html = stepTimelineComponent.render(status);

  assert(html.includes('status-approaching'), 'Container has status-approaching modifier');
  assert(html.includes('まもなく (定刻)'), 'Marker label indicates approaching on time');
  assert(html.includes('delay-none'), 'Applies delay-none class for on-time bus');
  assert(html.includes('関の下'), 'Timeline contains preceding stop 関の下');
}

// 2.3 At Stop (当バス停に到着/停車中)
{
  const atStopBus = {
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4405',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:toBusstopPole': '',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    'odpt:delay': 60
  };
  const status = busLocationService.getBusLocationStatus(atStopBus, 'KamiookaStation', '111系統');
  const html = stepTimelineComponent.render(status);

  assert(html.includes('status-at_stop'), 'Container has status-at_stop modifier');
  assert(html.includes('停車中 (+1分)'), 'Marker label indicates stopped at station with delay');
  assert(html.includes('当バス停に到着/停車中'), 'Header status pill contains at_stop text');
}

// 2.4 Scheduled / Non-active Bus
{
  const scheduledStatus = busLocationService.getBusLocationStatus(null, 'KamiookaStation', '111系統');
  const html = stepTimelineComponent.render(scheduledStatus, { showScheduled: true });

  assert(html.includes('is-scheduled'), 'Container has is-scheduled class');
  assert(html.includes('運行前/予定'), 'Header displays scheduled text');
  assert(!html.includes('bus-marker-wrap'), 'No live bus marker rendered for scheduled bus');
  assert(html.includes('上大岡駅前'), 'Contains target stop node in preview');

  const emptyHtml = stepTimelineComponent.render(scheduledStatus, { showScheduled: false });
  assert(emptyHtml === '', 'Returns empty string when showScheduled is false');
}

// 2.5 Null / Corrupted / Edge Cases
{
  assert(stepTimelineComponent.render(null) === '', 'render(null) returns empty string');
  assert(stepTimelineComponent.render({}) === '', 'render({}) returns empty string without timeline nodes');
  assert(stepTimelineComponent.render({ timelineNodes: [] }) === '', 'render({ timelineNodes: [] }) returns empty string');
}

// =============================================================================
// 3. stepTimelineComponent.renderMini() - Mini Location Badge Tests
// =============================================================================
console.log('\n--- 3. Mini Location Badge Rendering (renderMini) ---');

// 3.1 Live Bus Mini Badge
{
  const liveBus = {
    'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.133.Vehicle2890',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Tenjinmae.3609.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Okamuracho.827.1',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.13303.10_1',
    'odpt:delay': 120
  };
  const status = busLocationService.getBusLocationStatus(liveBus, 'Koizumi', '133系統');
  const miniHtml = stepTimelineComponent.renderMini(status);

  assert(miniHtml.includes('mini-bus-location live'), 'Mini badge has mini-bus-location live classes');
  assert(miniHtml.includes('role="status"'), 'Mini badge has role="status"');
  assert(miniHtml.includes('pulsing'), 'Bus icon has pulsing animation class');
  assert(miniHtml.includes('2個前'), 'Mini badge text displays 2個前');
  assert(miniHtml.includes('+2分遅れ'), 'Mini badge displays delay badge text');
  assert(miniHtml.includes('delay-some'), 'Mini badge has delay-some class');
}

// 3.2 Scheduled Bus Mini Badge
{
  const scheduledStatus = busLocationService.getBusLocationStatus(null, 'Koizumi', '133系統');
  const miniHtml = stepTimelineComponent.renderMini(scheduledStatus);

  assert(miniHtml.includes('mini-bus-location scheduled'), 'Mini badge has scheduled class');
  assert(miniHtml.includes('運行予定（定刻見込み）'), 'Mini badge displays scheduled status text');
  assert(miniHtml.includes('delay-none'), 'Mini badge has delay-none class');
  assert(miniHtml.includes('🕒'), 'Mini badge uses clock icon for scheduled');
}

// 3.3 Null / Undefined Mini Badge
{
  assert(stepTimelineComponent.renderMini(null) === '', 'renderMini(null) returns empty string');
  assert(stepTimelineComponent.renderMini(undefined) === '', 'renderMini(undefined) returns empty string');
}

// =============================================================================
// 4. TimetableService.mergeRealtimeDelays with LocationStatus Integration
// =============================================================================
console.log('\n--- 4. TimetableService mergeRealtimeDelays with LocationStatus ---');

{
  const mockEntries = [
    { line: '111系統', departureTime: '07:05', busId: '111-4412', destination: '上大岡駅前' },
    { line: '111系統', departureTime: '07:20', busId: '111-4418', destination: '上大岡駅前' },
    { line: '111系統', departureTime: '07:35', busId: '111-9999', destination: '上大岡駅前' } // No realtime bus
  ];

  const realtimeBuses = [
    {
      '@id': '111-4412',
      'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4412',
      'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1',
      'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
      'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
      'odpt:delay': 0
    },
    {
      '@id': '111-4418',
      'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4418',
      'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1',
      'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonankuSogoChoshamae.1827.1',
      'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
      'odpt:delay': 180
    }
  ];

  const merged = timetableService.mergeRealtimeDelays(mockEntries, realtimeBuses, 'KamiookaStation', '111系統');

  assert(merged.length === 3, 'Merged returns 3 entries');
  assert(merged[0].locationStatus !== undefined, 'Entry 0 has locationStatus attached');
  assert(merged[0].locationStatus.status === 'approaching', 'Entry 0 locationStatus status is approaching');
  assert(merged[0].locationStatus.stopsAway === 1, 'Entry 0 stopsAway is 1');

  assert(merged[1].locationStatus !== undefined, 'Entry 1 has locationStatus attached');
  assert(merged[1].locationStatus.status === 'en_route', 'Entry 1 locationStatus status is en_route');
  assert(merged[1].locationStatus.delayMinutes === 3, 'Entry 1 delayMinutes is 3');

  assert(merged[2].locationStatus !== undefined, 'Entry 2 (scheduled) has locationStatus attached');
  assert(merged[2].locationStatus.status === 'scheduled', 'Entry 2 status is scheduled');
}

// =============================================================================
// 5. Card Component HTML Integrity
// =============================================================================
console.log('\n--- 5. Departure & Transfer Card HTML Structure Verification ---');

// 5.1 Departure Item Card Structure
{
  const testDep = {
    departureTime: '14:20',
    delayMinutes: 3,
    line: '111系統',
    destination: '上大岡駅前',
    countdownText: 'あと 5分',
    locationStatus: busLocationService.getBusLocationStatus(
      {
        'odpt:fromBusstopPole': '7816.1',
        'odpt:toBusstopPole': '1827.1',
        'odpt:busroutePattern': '11100',
        'odpt:delay': 180
      },
      '1046.6',
      '111系統'
    )
  };

  const delayClass = testDep.delayMinutes > 0 ? 'delay-some' : 'delay-none';
  const delayText = testDep.delayMinutes > 0 ? `+${testDep.delayMinutes}分` : '定刻';
  const loc = testDep.locationStatus;
  const isLive = loc && (loc.status === 'at_stop' || loc.status === 'approaching' || loc.status === 'en_route');
  const liveBadgeText = isLive ? `🚍 ${loc.stopsAway}個前` : '予定';
  const timelineHtml = stepTimelineComponent.render(loc, { showScheduled: true });

  const cardHtml = `
    <div class="departure-item">
      <div class="dep-header">
        <div class="dep-left">
          <span class="dep-time">${testDep.departureTime} <span class="delay-badge ${delayClass}">${delayText}</span></span>
          <span class="dep-dest">${testDep.line} ${testDep.destination}</span>
        </div>
        <div class="dep-right">
          <div class="dep-countdown">${testDep.countdownText}</div>
          <div class="dep-live">${liveBadgeText}</div>
        </div>
      </div>
      ${timelineHtml}
    </div>
  `;

  assert(cardHtml.includes('departure-item'), 'Card has departure-item');
  assert(cardHtml.includes('dep-header'), 'Card has dep-header');
  assert(cardHtml.includes('dep-left') && cardHtml.includes('dep-right'), 'Card has dep-left and dep-right');
  assert(cardHtml.includes('jr-step-timeline-container'), 'Card embeds step-timeline');
  assert(cardHtml.includes('bus-marker-wrap'), 'Card contains bus marker');
}

// 5.2 Transfer Route Node Structure
{
  const legStatus = busLocationService.getBusLocationStatus(
    {
      'odpt:fromBusstopPole': '3609.1',
      'odpt:toBusstopPole': '827.1',
      'odpt:busroutePattern': '13303',
      'odpt:delay': 60
    },
    '1810.1',
    '133系統'
  );

  const miniHtml = stepTimelineComponent.renderMini(legStatus);
  const routeNodeHtml = `
    <div class="route-node">
      <div class="route-header">
        <span class="route-time">14:35 <span class="delay-badge delay-some">+1分</span></span>
        <span class="route-name">上大岡駅前 発</span>
      </div>
      <div class="route-detail">133系統 古泉 行</div>
      ${miniHtml}
    </div>
  `;

  assert(routeNodeHtml.includes('route-node'), 'Transfer node has route-node');
  assert(routeNodeHtml.includes('mini-bus-location live'), 'Transfer node embeds mini-bus-location');
  assert(routeNodeHtml.includes('2個前'), 'Mini badge shows 2個前');
}

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n================================================================');
console.log(`🏁 UI INTEGRATION TEST SUMMARY`);
console.log(`✔ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  console.error('\nFailures:');
  failures.forEach((f, idx) => console.error(`${idx + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('\n🎉 ALL UI INTEGRATION & STEP TIMELINE TESTS PASSED!');
}
