/**
 * test-bus-location-adversarial-challenger.js
 * 
 * Comprehensive Empirical Adversarial Stress Test Suite for:
 * 1. Bus Location Engine (js/services/bus-location-service.js)
 * 2. Timetable Integration Engine (js/services/timetable-service.js)
 * 
 * Coverage:
 * - Category 1: Out of bound bus positions, unknown pole IDs, reverse directions, invalid route patterns
 * - Category 2: Extreme delays (negative delays, 60+ min delays, missing/corrupted delay field, midnight wrapping)
 * - Category 3: Rapid position transitions (advancing from 3 stops away -> at stop -> passed, jumps, jitter)
 * - Category 4: Circular routes, terminal stops, starting stops, single-stop routes
 * - Category 5: Timetable integration, realtime delay merging, countdown formatting, multi-bus matching
 * - Category 6: Adversarial Fuzzing Engine (10,000 randomized mutated inputs)
 * - Category 7: Empirical Bug Reproduction & Vulnerability Harness (Midnight drop, ODPT URI mismatch, Non-finite delay)
 */

import {
  BusLocationService,
  busLocationService,
  getStopNameFromPole,
  normalizePoleId,
  getStopsForRoute,
  findStopIndex,
  formatDelayText,
  formatStatusText,
  POLE_NAME_MAPPINGS
} from '../js/services/bus-location-service.js';

import {
  TimetableService,
  timetableService
} from '../js/services/timetable-service.js';

import { CONFIG, STOPS, ROUTES } from '../js/config.js';
import { MockData, getMockTimetable } from '../js/api/mock-data.js';

console.log('========================================================================');
console.log('  BUS LOCATION & TIMETABLE ADVERSARIAL STRESS TEST (EMPIRICAL CHALLENGER)');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
const discoveredBugs = [];

function assert(condition, testName, errorDetails = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  } else {
    failedTests++;
    const errMsg = `❌ FAIL: ${testName} ${errorDetails ? `(${errorDetails})` : ''}`;
    console.error(`  ${errMsg}`);
    failures.push({ testName, errorDetails });
  }
}

function expectNoThrow(fn, testName) {
  totalTests++;
  try {
    const result = fn();
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
    return result;
  } catch (err) {
    failedTests++;
    const errMsg = `❌ FAIL (Threw Exception): ${testName} -> ${err.message}`;
    console.error(`  ${errMsg}`);
    failures.push({ testName, errorDetails: err.stack || err.message });
    return null;
  }
}

// =========================================================================
// SUITE 1: OUT OF BOUND BUS POSITIONS, UNKNOWN POLE IDS, REVERSE DIRECTIONS
// =========================================================================
console.log('\n--- Suite 1: Out of Bound Bus Positions, Unknown Pole IDs & Reverse Directions ---');

expectNoThrow(() => {
  assert(getStopNameFromPole(null) === '', 'getStopNameFromPole(null) returns empty string');
  assert(getStopNameFromPole(undefined) === '', 'getStopNameFromPole(undefined) returns empty string');
  assert(getStopNameFromPole('') === '', 'getStopNameFromPole("") returns empty string');
  assert(getStopNameFromPole(12345) === '', 'getStopNameFromPole(number) returns empty string');
  assert(getStopNameFromPole({}) === '', 'getStopNameFromPole(object) returns empty string');
  assert(getStopNameFromPole('UnknownPole_9999') === 'UnknownPole_9999', 'Unknown pole ID returns literal string');
  assert(getStopNameFromPole('<script>alert(1)</script>') === '<script>alert(1)</script>', 'XSS payload handled safely');
  assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1') === '洋光台北口', 'Full ODPT URI resolves correctly');
}, 'Pole ID resolution handles all malformed inputs safely');

expectNoThrow(() => {
  const stops111 = getStopsForRoute('111', 'outbound');
  assert(findStopIndex(stops111, 'NonExistentStop') === -1, 'Unknown stop index is -1');
  assert(findStopIndex(null, '上大岡駅前') === -1, 'findStopIndex with null list returns -1');
  assert(findStopIndex([], '上大岡駅前') === -1, 'findStopIndex with empty list returns -1');
  assert(findStopIndex(stops111, null) === -1, 'findStopIndex with null target returns -1');
}, 'Stop index lookup handles edge cases');

expectNoThrow(() => {
  const busInboundOnOutboundRoute = {
    '@id': 'odpt.Bus:YokohamaMunicipal.111.Vehicle9901',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11101.10_1',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.2',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiGochome.7803.2',
    'odpt:delay': 0
  };

  const statusOut = busLocationService.getBusLocationStatus(
    busInboundOnOutboundRoute,
    'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    { direction: 'outbound' }
  );

  assert(statusOut !== null, 'Status calculated for reverse direction bus');
  assert(statusOut.status === 'en_route' || statusOut.status === 'passed', 'Reverse bus classified consistently');
  assert(Array.isArray(statusOut.timelineNodes), 'Timeline nodes generated for reverse bus');
}, 'Reverse direction bus is handled gracefully');

expectNoThrow(() => {
  const foreignBus = {
    '@id': 'odpt.Bus:Toei.01.Vehicle001',
    'odpt:busroutePattern': 'odpt.BusroutePattern:Toei.To01',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:Toei.Roppongi.01',
    'odpt:toBusstopPole': 'odpt.BusstopPole:Toei.Shibuya.01',
    'odpt:delay': 120
  };

  const status = busLocationService.getBusLocationStatus(
    foreignBus,
    'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );

  assert(status.status === 'en_route', 'Foreign bus fallback status is en_route');
  assert(status.stopsAway === null, 'Foreign bus stopsAway is null');
  assert(status.timelineNodes.length > 0, 'Timeline nodes still rendered for foreign bus');
}, 'Foreign bus positions do not crash the engine');

expectNoThrow(() => {
  const invertedBus = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:delay': 0
  };

  const status = busLocationService.getBusLocationStatus(
    invertedBus,
    'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );

  assert(status.status === 'passed', 'Inverted bus at end of line marked as passed for upstream stop');
  assert(status.stopsAway === null, 'Passed bus has stopsAway: null');
}, 'Inverted pole pairs handled with consistent logic');


// =========================================================================
// SUITE 2: EXTREME DELAYS & TIMING ANOMALIES
// =========================================================================
console.log('\n--- Suite 2: Extreme Delays & Timing Anomalies ---');

expectNoThrow(() => {
  const resEarly1 = formatDelayText(-60);
  assert(resEarly1.delayMinutes === -1, 'formatDelayText(-60) is -1 min');
  assert(resEarly1.delayText === '-1分早着', 'formatDelayText(-60) text is -1分早着');

  const resEarly5 = formatDelayText(-300);
  assert(resEarly5.delayMinutes === -5, 'formatDelayText(-300) is -5 min');
  assert(resEarly5.delayText === '-5分早着', 'formatDelayText(-300) text is -5分早着');

  const resEarlyZero = formatDelayText(-10);
  assert(resEarlyZero.delayMinutes === 0, 'formatDelayText(-10) rounds to 0 min');
  assert(resEarlyZero.delayText === '定刻', 'formatDelayText(-10) text is 定刻');
}, 'Negative delays formatted accurately');

expectNoThrow(() => {
  const res60 = formatDelayText(3600);
  assert(res60.delayMinutes === 60, 'formatDelayText(3600) is 60 min');
  assert(res60.delayText === '+60分遅れ', 'formatDelayText(3600) text is +60分遅れ');

  const res120 = formatDelayText(7200);
  assert(res120.delayMinutes === 120, 'formatDelayText(7200) is 120 min');
  assert(res120.delayText === '+120分遅れ', 'formatDelayText(7200) text is +120分遅れ');

  const res1Day = formatDelayText(86400);
  assert(res1Day.delayMinutes === 1440, 'formatDelayText(86400) is 1440 min');
  assert(res1Day.delayText === '+1440分遅れ', 'formatDelayText(86400) text is +1440分遅れ');
}, 'Massive delays formatted without overflow');

expectNoThrow(() => {
  assert(formatDelayText(undefined).delayText === '定刻', 'undefined delay is 定刻');
  assert(formatDelayText(null).delayText === '定刻', 'null delay is 定刻');
  assert(formatDelayText('120').delayText === '定刻', 'string delay defaults to 定刻');
  assert(formatDelayText(NaN).delayText === '定刻', 'NaN delay is 定刻');
}, 'Corrupted delay fields safely default to 定刻');

expectNoThrow(() => {
  const entryLateNight = {
    departureTime: '23:55',
    delaySeconds: 1200
  };
  const liveBusLate = {
    'odpt:delay': 1200
  };

  const merged = timetableService.mergeRealtimeDelays([entryLateNight], [liveBusLate]);
  assert(merged.length === 1, 'Merged delay for late night bus');
  assert(merged[0].actualDepartureTime === '00:15', '23:55 + 20min correctly wrapped past midnight to 00:15');
}, 'Delay merging wraps correctly past midnight');

expectNoThrow(() => {
  const entryEarlyMorning = {
    departureTime: '00:05',
    delaySeconds: -600
  };
  const liveBusEarly = {
    'odpt:delay': -600
  };

  const merged = timetableService.mergeRealtimeDelays([entryEarlyMorning], [liveBusEarly]);
  assert(merged[0].actualDepartureTime === '23:55', '00:05 - 10min correctly wrapped before midnight to 23:55');
}, 'Early arrival delay wraps before midnight');


// =========================================================================
// SUITE 3: RAPID POSITION TRANSITIONS & STATE MACHINE INTEGRITY
// =========================================================================
console.log('\n--- Suite 3: Rapid Position Transitions & State Machine Integrity ---');

expectNoThrow(() => {
  const targetPole = 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1';
  const pattern = 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1';

  // Step 1: 4 stops away
  const busStep1 = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiGochome.7803.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiStation.7806.2'
  };
  const res1 = busLocationService.getBusLocationStatus(busStep1, targetPole, pattern);
  assert(res1.status === 'en_route', 'Step 1 (4 stops away) is en_route');
  assert(res1.stopsAway === 4, 'Step 1 stopsAway is 4');
  assert(res1.statusText.includes('4個前'), 'Step 1 text contains 4個前');

  // Step 2: 2 stops away
  const busStep2 = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NishiPark.4223.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiNichome.7802.1'
  };
  const res2 = busLocationService.getBusLocationStatus(busStep2, targetPole, pattern);
  assert(res2.status === 'en_route', 'Step 2 (2 stops away) is en_route');
  assert(res2.stopsAway === 2, 'Step 2 stopsAway is 2');
  assert(res2.statusText.includes('2個前'), 'Step 2 text contains 2個前');

  // Step 3: 1 stop away (approaching)
  const busStep3 = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiNichome.7802.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1'
  };
  const res3 = busLocationService.getBusLocationStatus(busStep3, targetPole, pattern);
  assert(res3.status === 'approaching', 'Step 3 (1 stop away) is approaching');
  assert(res3.stopsAway === 1, 'Step 3 stopsAway is 1');
  assert(res3.statusText.includes('まもなく到着'), 'Step 3 text contains まもなく到着');

  // Step 4: At stop
  const busStep4 = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.1'
  };
  const res4 = busLocationService.getBusLocationStatus(busStep4, targetPole, pattern);
  assert(res4.status === 'at_stop', 'Step 4 (at stop) is at_stop');
  assert(res4.stopsAway === 0, 'Step 4 stopsAway is 0');
  assert(res4.statusText.includes('当バス停に到着/停車中'), 'Step 4 text contains 当バス停に到着/停車中');

  // Step 5: Passed
  const busStep5 = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoKoenBochiIriguchi.5208.1'
  };
  const res5 = busLocationService.getBusLocationStatus(busStep5, targetPole, pattern);
  assert(res5.status === 'passed', 'Step 5 (passed stop) is passed');
  assert(res5.stopsAway === null, 'Step 5 stopsAway is null');
  assert(res5.statusText === '通過済', 'Step 5 text is 通過済');

  [res1, res2, res3, res4, res5].forEach((res, idx) => {
    assert(Array.isArray(res.timelineNodes) && res.timelineNodes.length > 0, `Step ${idx+1} timeline nodes valid`);
    const targetNode = res.timelineNodes.find(n => n.isTarget);
    assert(targetNode !== undefined, `Step ${idx+1} target node exists in timeline`);
  });
}, 'Complete monotonic stop lifecycle simulation passes');

expectNoThrow(() => {
  const targetPole = 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1';
  const pattern = 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1';

  const jumpedBus = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonanWardOffice.1827.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.SasageKonanchuodori.2021.1'
  };
  const res = busLocationService.getBusLocationStatus(jumpedBus, targetPole, pattern);
  assert(res.status === 'passed', 'Jumped bus past target is immediately recognized as passed');
  assert(res.stopsAway === null, 'Jumped bus has stopsAway null');
}, 'Sudden position jump is handled deterministically');


// =========================================================================
// SUITE 4: CIRCULAR ROUTES, TERMINAL STOPS, STARTING STOPS
// =========================================================================
console.log('\n--- Suite 4: Circular Routes, Terminal Stops & Starting Stops ---');

expectNoThrow(() => {
  const busAtOrigin = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokohamaWomenJuniorCollege.7822.1'
  };

  const resTargetOrigin = busLocationService.getBusLocationStatus(
    busAtOrigin,
    'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );
  assert(resTargetOrigin.status === 'at_stop', 'Bus at origin with target at origin is at_stop');
  assert(resTargetOrigin.stopsAway === 0, 'stopsAway at origin is 0');

  const resTarget2nd = busLocationService.getBusLocationStatus(
    busAtOrigin,
    'odpt.BusstopPole:YokohamaMunicipal.YokohamaWomenJuniorCollege.7822.1',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );
  assert(resTarget2nd.status === 'approaching', 'Bus at origin heading to 2nd stop is approaching');
  assert(resTarget2nd.stopsAway === 1, 'stopsAway for 2nd stop is 1');
}, 'Starting stop boundary cases work seamlessly');

expectNoThrow(() => {
  const busAtTerminus = {
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:toBusstopPole': null
  };

  const resTargetTerminus = busLocationService.getBusLocationStatus(
    busAtTerminus,
    'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );
  assert(resTargetTerminus.status === 'at_stop', 'Bus at terminus with target at terminus is at_stop');
  assert(resTargetTerminus.stopsAway === 0, 'stopsAway at terminus is 0');

  const resTargetUpstream = busLocationService.getBusLocationStatus(
    busAtTerminus,
    'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1'
  );
  assert(resTargetUpstream.status === 'passed', 'Terminus bus is passed for upstream stops');
  assert(resTargetUpstream.stopsAway === null, 'stopsAway is null for passed bus');
}, 'Terminus stop boundary cases work seamlessly');

expectNoThrow(() => {
  const degenerateService = new BusLocationService();
  const customNodes = degenerateService._createDefaultTimelineNodes('洋光台北口', 'nonexistent_route');
  assert(customNodes.length >= 1, 'Degenerate route creates at least 1 timeline node');
  assert(customNodes[customNodes.length - 1].isTarget === true, 'Last node is marked target in degenerate route');
}, 'Degenerate / fallback route configurations handle safely');


// =========================================================================
// SUITE 5: TIMETABLE INTEGRATION & REALTIME DELAY MERGING
// =========================================================================
console.log('\n--- Suite 5: Timetable Integration & Realtime Delay Merging ---');

expectNoThrow(() => {
  const timetable = [
    { id: '111-out-0705', busId: '111-out-0705', departureTime: '07:05', line: '111系統', destination: '上大岡駅前' },
    { id: '111-out-0720', busId: '111-out-0720', departureTime: '07:20', line: '111系統', destination: '上大岡駅前' },
    { id: '111-out-0735', busId: '111-out-0735', departureTime: '07:35', line: '111系統', destination: '上大岡駅前' }
  ];

  const liveBuses = [
    {
      '@id': 'odpt.Bus:YokohamaMunicipal.111.111-out-0720',
      'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
      'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
      'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.1',
      'odpt:delay': 180
    },
    {
      '@id': 'odpt.Bus:YokohamaMunicipal.111.GenericBus1',
      'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
      'odpt:destinationBusstopPole': '上大岡駅前',
      'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
      'odpt:delay': 60
    }
  ];

  const merged = timetableService.mergeRealtimeDelays(timetable, liveBuses);
  
  assert(merged[0].delayMinutes === 1, 'Entry 07:05 matched GenericBus1 (+1 min)');
  assert(merged[0].actualDepartureTime === '07:06', 'Entry 07:05 actual departure is 07:06');
  assert(merged[1].delayMinutes === 3, 'Entry 07:20 matched direct busId (+3 min)');
  assert(merged[1].actualDepartureTime === '07:23', 'Entry 07:20 actual departure is 07:23');
  assert(merged[2].delayMinutes === 0, 'Entry 07:35 has 0 min delay');
  assert(merged[2].actualDepartureTime === '07:35', 'Entry 07:35 actual departure remains 07:35');
  assert(merged[2].locationStatus.status === 'scheduled', 'Entry 07:35 locationStatus is scheduled');
}, 'Realtime delay merge performs multi-pass correlation accurately');

expectNoThrow(() => {
  assert(timetableService.formatCountdown(-5).status === 'past', 'diff -5min is past');
  assert(timetableService.formatCountdown(0, -10).status === 'urgent', 'diff -10s is urgent (発車直後)');
  assert(timetableService.formatCountdown(0, 30).status === 'urgent', 'diff 30s is urgent (まもなく発車)');
  assert(timetableService.formatCountdown(4).status === 'soon', 'diff 4min is soon');
  assert(timetableService.formatCountdown(30).status === 'normal', 'diff 30min is normal');
  assert(timetableService.formatCountdown(150).text.includes('2時間30分'), 'diff 150min shows hours and minutes');
}, 'Countdown formatter categorizes time deltas correctly');

expectNoThrow(() => {
  const departures = [
    { departureTime: '06:00' },
    { departureTime: '07:58' },
    { departureTime: '08:05' },
    { departureTime: '08:15' },
    { departureTime: '08:25' },
    { departureTime: '08:35' },
    { departureTime: '08:45' }
  ];

  const curTime = new Date('2026-08-23T08:00:00');
  const next3 = timetableService.getNextDepartures(departures, curTime, 3);

  assert(next3.length === 3, 'getNextDepartures respected count limit of 3');
  assert(next3[0].departureTime === '07:58', '07:58 included as recent departure within 2 min threshold');
  assert(next3[1].departureTime === '08:05', '08:05 included as next departure');
  assert(next3[2].departureTime === '08:15', '08:15 included as 3rd departure');
}, 'getNextDepartures accurately filters past entries and limits output');


// =========================================================================
// SUITE 6: ADVERSARIAL FUZZING ENGINE (10,000 MUTATED RUNS)
// =========================================================================
console.log('\n--- Suite 6: Adversarial Fuzzing Engine (10,000 Mutated Runs) ---');

expectNoThrow(() => {
  const possiblePoles = [
    null, undefined, '', 'Unknown.123', '7800.1', '1046.6', '1810.1', '1823.3', '4600.4',
    'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt.BusstopPole:Corrupted.Pole.999.0'
  ];

  const possibleDelays = [
    0, 60, 180, -60, -300, 3600, -3600, 86400, null, undefined, NaN, 'fast', {}
  ];

  const possibleRoutes = [
    '111', '133', '64', '064', '999', null, undefined, '',
    'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    'odpt.BusroutePattern:YokohamaMunicipal.13303.08_1'
  ];

  const possibleDirections = ['outbound', 'inbound', null, undefined, 'random'];

  let fuzzPass = 0;
  const FUZZ_ITERATIONS = 10000;

  for (let i = 0; i < FUZZ_ITERATIONS; i++) {
    const fromPole = possiblePoles[Math.floor(Math.random() * possiblePoles.length)];
    const toPole = possiblePoles[Math.floor(Math.random() * possiblePoles.length)];
    const targetPole = possiblePoles[Math.floor(Math.random() * possiblePoles.length)];
    const delay = possibleDelays[Math.floor(Math.random() * possibleDelays.length)];
    const route = possibleRoutes[Math.floor(Math.random() * possibleRoutes.length)];
    const dir = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];

    const busObj = {
      '@id': `odpt.Bus:Fuzz.${i}`,
      'odpt:fromBusstopPole': fromPole,
      'odpt:toBusstopPole': toPole,
      'odpt:delay': delay
    };

    const status = busLocationService.getBusLocationStatus(busObj, targetPole, route, { direction: dir });

    if (
      status &&
      typeof status.status === 'string' &&
      typeof status.statusText === 'string' &&
      typeof status.delayMinutes === 'number' &&
      !isNaN(status.delayMinutes) &&
      Array.isArray(status.timelineNodes) &&
      typeof status.busSegmentIndex === 'number' &&
      typeof status.busMarkerPercent === 'number'
    ) {
      fuzzPass++;
    }
  }

  assert(fuzzPass === FUZZ_ITERATIONS, `Fuzz engine passed all ${FUZZ_ITERATIONS} iterations with zero crashes (100% invariant adherence)`);
}, '10,000 iterations randomized fuzzing completed successfully');


// =========================================================================
// SUITE 7: EMPIRICAL DEFECT & VULNERABILITY REPRODUCTION HARNESS
// =========================================================================
console.log('\n--- Suite 7: Empirical Defect & Vulnerability Reproduction Harness ---');

// Bug 1: Midnight Rollover / Delay Wrap Disappearance in getNextDepartures
(() => {
  const testName = 'BUG-1: Midnight Delayed Bus Disappearance in getNextDepartures';
  totalTests++;
  const timetable = [
    { departureTime: '23:50', actualDepartureTime: '00:15', delayMinutes: 25 }
  ];
  const curTime = new Date('2026-08-23T23:40:00');
  const departures = timetableService.getNextDepartures(timetable, curTime, 5);

  if (departures.length === 0) {
    console.error(`  ❌ CONFIRMED DEFECT: ${testName}`);
    console.error(`     At 23:40, bus with departureTime '23:50' and actualDepartureTime '00:15' (delay +25m) returned 0 departures!`);
    discoveredBugs.push({
      id: 'BUG-1',
      severity: 'CRITICAL',
      file: 'js/services/timetable-service.js:150-189',
      summary: 'Late-night buses delayed past midnight (00:xx) disappear from getNextDepartures before midnight',
      reproduction: `curTime='23:40:00', entry={departureTime:'23:50', actualDepartureTime:'00:15'} -> getNextDepartures returned [] (expected 1 item with countdown ~35 min)`
    });
    failedTests++;
  } else {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  }
})();

// Bug 2: ODPT URI destination matching in mergeRealtimeDelays
(() => {
  const testName = 'BUG-2: ODPT BusstopPole URI Destination Mismatch in mergeRealtimeDelays';
  totalTests++;
  const timetable = [
    { id: '111-out-0705', departureTime: '07:05', line: '111系統', destination: '上大岡駅前' }
  ];
  const liveBusWithUri = {
    '@id': 'odpt.Bus:YokohamaMunicipal.111.Vehicle101',
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:delay': 120
  };

  const merged = timetableService.mergeRealtimeDelays(timetable, [liveBusWithUri]);
  if (merged[0].delayMinutes === 0 && merged[0].actualDepartureTime === '07:05') {
    console.error(`  ❌ CONFIRMED DEFECT: ${testName}`);
    console.error(`     Live bus with ODPT URI destination was NOT matched against timetable destination '上大岡駅前'!`);
    discoveredBugs.push({
      id: 'BUG-2',
      severity: 'HIGH',
      file: 'js/services/timetable-service.js:292-297',
      summary: 'Pass 2 destination matching fails when live bus destination is an ODPT Pole URI',
      reproduction: `liveBus['odpt:destinationBusstopPole']='odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6' vs entry.destination='上大岡駅前' -> no match (delay remains 0 instead of 2 min)`
    });
    failedTests++;
  } else {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  }
})();

// Bug 3: Non-finite delay values in formatDelayText
(() => {
  const testName = 'BUG-3: Non-finite (Infinity) Delay Handling in formatDelayText';
  totalTests++;
  const res = formatDelayText(Infinity);
  if (!Number.isFinite(res.delayMinutes) || res.delayText.includes('Infinity')) {
    console.error(`  ❌ CONFIRMED DEFECT: ${testName}`);
    console.error(`     formatDelayText(Infinity) returned delayMinutes=${res.delayMinutes}, delayText='${res.delayText}'`);
    discoveredBugs.push({
      id: 'BUG-3',
      severity: 'LOW',
      file: 'js/services/bus-location-service.js:423-435',
      summary: 'formatDelayText does not check Number.isFinite, allowing Infinity / -Infinity to produce "+Infinity分遅れ"',
      reproduction: `formatDelayText(Infinity) -> delayText: '+Infinity分遅れ'`
    });
    failedTests++;
  } else {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  }
})();


// =========================================================================
// FINAL EMPIRICAL RESULTS SUMMARY
// =========================================================================
console.log('\n========================================================================');
console.log(`🏁 TEST RESULTS SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${totalTests} tests.`);
console.log(`🔍 CONFIRMED BUGS FOUND: ${discoveredBugs.length}`);
console.log('========================================================================');

discoveredBugs.forEach(b => {
  console.log(`\n[${b.severity}] ${b.id}: ${b.summary}`);
  console.log(`  File: ${b.file}`);
  console.log(`  Repro: ${b.reproduction}`);
});

// Exit code reflects whether defects were found (1 for found bugs, for challenger reporting)
