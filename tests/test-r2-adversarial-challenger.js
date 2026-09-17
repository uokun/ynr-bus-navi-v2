/**
 * test-r2-adversarial-challenger.js
 * 
 * Challenger R2 Adversarial Stress & Fuzzing Harness
 * Comprehensive empirical validation covering:
 * 1. normalizeDestination: 10,000 fuzzing iterations, edge cases, variants, unknown destinations
 * 2. transferService: Midnight rollover (23:50, 23:59, 00:00, 00:05, 04:00, 12:00), end-of-service status, connection validity
 * 3. busLocationService.get5StopApproachingStatus: Koizumi bidirectional (Pole 1 & Pole 2) full-sequence tracking & isolation
 */

import { normalizeDestination } from '../js/api/odpt-client.js';
import { transferService } from '../js/services/transfer-service.js';
import { busLocationService } from '../js/services/bus-location-service.js';
import { REAL_TIMETABLES } from '../js/api/real-timetable-data.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  } else {
    failedTests++;
    const msg = `  ✖ FAIL: ${testName} ${details ? `(${details})` : ''}`;
    console.error(msg);
    failures.push({ testName, details });
  }
}

console.log('========================================================================');
console.log('   CHALLENGER R2 ADVERSARIAL STRESS & FUZZING TEST SUITE');
console.log('========================================================================\n');

// ========================================================================
// 1. normalizeDestination: 10,000 Fuzzing Iterations & Boundary Tests
// ========================================================================
console.log('▶ TEST SUITE 1: normalizeDestination Fuzzing & Boundary Tests');
console.log('------------------------------------------------------------------------');

// 1.1 Standard & Edge Cases
assert(
  normalizeDestination('洋光台駅前 行', '111系統', '7800.1') === '洋光台駅前 行',
  '[1.1.1] Standard explicit: 洋光台駅前 行 on 111'
);

assert(
  normalizeDestination('港南台駅前 行', '111系統', '7800.1') === '港南台駅前 行',
  '[1.1.2] Standard explicit: 港南台駅前 行 on 111 (not overwritten by stopId)'
);

assert(
  normalizeDestination('根岸駅前 行', '133系統', '1810.1') === '根岸駅前 行',
  '[1.1.3] Standard explicit: 根岸駅前 行 on 133 (not overwritten by stopId)'
);

assert(
  normalizeDestination('上大岡駅前 行', '133系統', '1810.2') === '上大岡駅前 行',
  '[1.1.4] Standard explicit: 上大岡駅前 行 on 133 (not overwritten by stopId)'
);

// 1.2 Partial Keyword Matches
assert(
  normalizeDestination('上大岡', '111系統', '7800.2') === '上大岡駅前 行',
  '[1.2.1] Partial keyword: 上大岡 -> 上大岡駅前 行'
);

assert(
  normalizeDestination('大岡駅前', '111系統', '7800.2') === '上大岡駅前 行',
  '[1.2.2] Partial keyword: 大岡駅前 -> 上大岡駅前 行'
);

assert(
  normalizeDestination('港南台', '111系統', '7800.1') === '港南台駅前 行',
  '[1.2.3] Partial keyword: 港南台 -> 港南台駅前 行'
);

assert(
  normalizeDestination('滝頭', '133系統', '1810.1') === '滝頭 行',
  '[1.2.4] Partial keyword: 滝頭 -> 滝頭 行'
);

assert(
  normalizeDestination('磯子駅前', '64系統', '1046.1') === '磯子駅前 行',
  '[1.2.5] Partial keyword: 磯子 -> 磯子駅前 行'
);

// 1.3 Corrupted & Special Characters
assert(
  normalizeDestination('\uFFFD\uFFFD\uFFFD', '111系統', '7800.1') === '上大岡駅前 行',
  '[1.3.1] Corrupted unicode \\uFFFD fallback to Pole 1 on 111'
);

assert(
  normalizeDestination('\uFFFD\uFFFD\uFFFD', '111系統', '7800.2') === '港南台駅前 行',
  '[1.3.2] Corrupted unicode \\uFFFD fallback to Pole 2 on 111'
);

assert(
  normalizeDestination('\uFFFD 上大岡 \uFFFD', '111系統', '7800.2') === '上大岡駅前 行',
  '[1.3.3] Mixed \\uFFFD with keyword: \\uFFFD 上大岡 \\uFFFD -> 上大岡駅前 行'
);

// 1.4 Empty, Null, Undefined Fallbacks
assert(
  normalizeDestination('', '111系統', '7800.1') === '上大岡駅前 行',
  '[1.4.1] Empty string fallback: 111 Pole 1 -> 上大岡駅前 行'
);

assert(
  normalizeDestination(null, '111系統', '7800.2') === '港南台駅前 行',
  '[1.4.2] Null destination fallback: 111 Pole 2 -> 港南台駅前 行'
);

assert(
  normalizeDestination(undefined, '133系統', '1810.1') === '上大岡駅前 行',
  '[1.4.3] Undefined destination fallback: 133 Pole 1 -> 上大岡駅前 行'
);

assert(
  normalizeDestination('', '133系統', '1810.2') === '根岸駅前 行',
  '[1.4.4] Empty destination fallback: 133 Pole 2 -> 根岸駅前 行'
);

assert(
  normalizeDestination('', '111系統', '1046.6') === '港南台駅前 行',
  '[1.4.5] Kamiooka Pole 6 fallback on 111 -> 港南台駅前 行'
);

assert(
  normalizeDestination('', '111系統', '1046.13') === '上大岡駅前 行',
  '[1.4.6] Kamiooka Pole 13 fallback on 111 -> 上大岡駅前 行'
);

assert(
  normalizeDestination('', '133系統', '1046.12') === '根岸駅前 行',
  '[1.4.7] Kamiooka Pole 12 fallback on 133 -> 根岸駅前 行'
);

assert(
  normalizeDestination('', 'UNKNOWN系統', '9999.1') === '運行予定',
  '[1.4.8] Unknown line empty destination -> 運行予定'
);

// 1.5 10,000-Iteration Fuzzing
console.log('\n  ... Running 10,000 randomized fuzzing iterations on normalizeDestination ...');
let fuzzExceptions = 0;
const fuzzLines = ['111系統', '133系統', '64系統', '', null, undefined, 'TEST系統', '999系統'];
const fuzzStops = [
  '7800.1', '7800.2', '1046.1', '1046.6', '1046.12', '1046.13', '1810.1', '1810.2',
  'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
  'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2',
  '', null, undefined, 'unknown.pole.99'
];

const seedChars = [
  '上', '大', '岡', '駅', '前', '港', '南', '台', '洋', '光', '根', '岸', '滝', '頭', '磯', '子',
  '臺', '驛', '崗', ' ', '\t', '\n', '\uFFFD', '\u0000', 'a', 'Z', '0', '9',
  '🚀', '🚍', '<', '>', '"', "'", '&', ';', '%', '\\', '/', '.', '?'
];

for (let i = 0; i < 10000; i++) {
  // Generate random input
  let destInput;
  const randType = i % 10;
  if (randType === 0) destInput = null;
  else if (randType === 1) destInput = undefined;
  else if (randType === 2) destInput = '';
  else if (randType === 3) destInput = '   \uFFFD   ';
  else if (randType === 4) destInput = i; // number
  else if (randType === 5) destInput = (i % 2 === 0); // boolean
  else {
    const len = Math.floor(Math.random() * 20);
    let s = '';
    for (let c = 0; c < len; c++) {
      s += seedChars[Math.floor(Math.random() * seedChars.length)];
    }
    destInput = s;
  }

  const line = fuzzLines[Math.floor(Math.random() * fuzzLines.length)];
  const stop = fuzzStops[Math.floor(Math.random() * fuzzStops.length)];

  try {
    const res = normalizeDestination(destInput, line, stop);
    if (typeof res !== 'string' || res.length === 0) {
      fuzzExceptions++;
    }
  } catch (e) {
    fuzzExceptions++;
    if (fuzzExceptions <= 5) {
      console.error(`  Fuzz exception at iteration ${i}:`, e.message, { destInput, line, stop });
    }
  }
}

assert(
  fuzzExceptions === 0,
  '[1.5.1] 10,000 Fuzzing iterations completed with 0 unhandled exceptions',
  `Exceptions: ${fuzzExceptions}`
);

// 1.6 Adversarial: Unknown destination & Variant character classification check
// BUG DISCOVERY: When lineName is '111系統' or '133系統', Step 2 unconditionally overwrites
// ANY destination not in the 6 keywords (including '回送', '臨時', '横浜駅西口', '洋光臺駅前')!
const testUnknownDest = normalizeDestination('横浜駅西口', '111系統', '7800.1');
const testOutOfService = normalizeDestination('回送', '111系統', '7800.1');
const testTraditionalKanji = normalizeDestination('洋光臺駅前', '111系統', '7800.1');

console.log('\n  Adversarial Destination Classification Results:');
console.log(`    - Unknown '横浜駅西口' on 111: '${testUnknownDest}'`);
console.log(`    - Out-of-service '回送' on 111: '${testOutOfService}'`);
console.log(`    - Variant '洋光臺駅前' on 111: '${testTraditionalKanji}'`);

assert(
  testUnknownDest === '横浜駅西口 行',
  '[1.6.1] Unknown destination preserved on 111系統 (Expected: 横浜駅西口 行)',
  `Actual: ${testUnknownDest} (Step 2 unconditionally overwrites Step 3)`
);

assert(
  testOutOfService === '回送 行' || testOutOfService === '回送',
  '[1.6.2] Out-of-service 回送 not misclassified as 上大岡駅前 行',
  `Actual: ${testOutOfService}`
);

assert(
  testTraditionalKanji === '洋光台駅前 行' || testTraditionalKanji === '洋光臺駅前 行',
  '[1.6.3] Traditional character 洋光臺駅前 not inverted to 上大岡駅前 行',
  `Actual: ${testTraditionalKanji}`
);


// ========================================================================
// 2. transferService: Midnight Rollover & Boundary Stress Tests
// ========================================================================
console.log('\n▶ TEST SUITE 2: transferService Midnight Rollover & Boundary Tests');
console.log('------------------------------------------------------------------------');

// 2.1 End-of-service status check with Real Timetables
const l1RealWeekday = REAL_TIMETABLES['odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1'].Weekday;
const l2RealWeekday = REAL_TIMETABLES['odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12'].Weekday;

const lateTimes = ['22:50', '23:15', '23:45', '23:50', '23:59'];
for (const t of lateTimes) {
  const res = transferService.calculateTransferRoute({
    leg1Timetable: l1RealWeekday,
    leg2Timetable: l2RealWeekday,
    currentTime: new Date(`2026-09-17T${t}:00`),
    bufferMinutes: 0
  });
  assert(
    res.status === 'no_buses_available' && res.recommended === null,
    `[2.1.${lateTimes.indexOf(t) + 1}] Real timetable end-of-service at ${t}: status === 'no_buses_available'`,
    `status: ${res.status}, recommended: ${res.recommended !== null}`
  );
}

// 2.2 Next morning first bus connection at 00:00, 00:05, 04:00, 12:00 with Real Timetables
const res0000 = transferService.calculateTransferRoute({
  leg1Timetable: l1RealWeekday,
  leg2Timetable: l2RealWeekday,
  currentTime: new Date('2026-09-17T00:00:00'),
  bufferMinutes: 0
});
assert(
  res0000.status === 'ok' && res0000.recommended !== null && res0000.recommended.leg1.departureTime === '06:22',
  '[2.2.1] Real timetable at 00:00 connects to first morning bus (06:22)',
  `res0000: ${res0000.recommended?.leg1?.departureTime}`
);

const res0005 = transferService.calculateTransferRoute({
  leg1Timetable: l1RealWeekday,
  leg2Timetable: l2RealWeekday,
  currentTime: new Date('2026-09-17T00:05:00'),
  bufferMinutes: 0
});
assert(
  res0005.status === 'ok' && res0005.recommended !== null && res0005.recommended.leg1.departureTime === '06:22',
  '[2.2.2] Real timetable at 00:05 connects to first morning bus (06:22)',
  `res0005: ${res0005.recommended?.leg1?.departureTime}`
);

const res0400 = transferService.calculateTransferRoute({
  leg1Timetable: l1RealWeekday,
  leg2Timetable: l2RealWeekday,
  currentTime: new Date('2026-09-17T04:00:00'),
  bufferMinutes: 0
});
assert(
  res0400.status === 'ok' && res0400.recommended !== null && res0400.recommended.leg1.departureTime === '06:22',
  '[2.2.3] Real timetable at 04:00 connects to first morning bus (06:22)',
  `res0400: ${res0400.recommended?.leg1?.departureTime}`
);

const res1200 = transferService.calculateTransferRoute({
  leg1Timetable: l1RealWeekday,
  leg2Timetable: l2RealWeekday,
  currentTime: new Date('2026-09-17T12:00:00'),
  bufferMinutes: 0
});
assert(
  res1200.status === 'ok' && res1200.recommended !== null && res1200.recommended.leg1.departureTime === '12:07',
  '[2.2.4] Real timetable at 12:00 connects to midday bus (12:07)',
  `res1200: ${res1200.recommended?.leg1?.departureTime}`
);

// 2.3 Synthetic Midnight Rollover Connections: 23:50 -> 00:15
const syntheticL1Midnight = [
  { departureTime: '23:45', busId: 'b1', line: '111系統' },
  { departureTime: '23:55', busId: 'b2', line: '111系統' },
  { departureTime: '00:10', busId: 'b3', line: '111系統' }
];
const syntheticL2Midnight = [
  { departureTime: '00:15', busId: 'b4', line: '133系統' },
  { departureTime: '00:30', busId: 'b5', line: '133系統' }
];

const res2350 = transferService.calculateTransferRoute({
  leg1Timetable: syntheticL1Midnight,
  leg2Timetable: syntheticL2Midnight,
  currentTime: new Date('2026-09-17T23:50:00'),
  bufferMinutes: 0
});

assert(
  res2350.status === 'ok' &&
  res2350.recommended?.leg1?.departureTime === '23:55' &&
  res2350.recommended?.leg2?.departureTime === '00:15',
  '[2.3.1] Day rollover at 23:50: Leg 1 (23:55) -> Leg 2 (00:15)',
  `Leg1: ${res2350.recommended?.leg1?.departureTime}, Leg2: ${res2350.recommended?.leg2?.departureTime}`
);

assert(
  res2350.recommended?.transferWaitMinutes === 5,
  '[2.3.2] Day rollover at 23:50 wait time is 5 minutes',
  `Actual wait: ${res2350.recommended?.transferWaitMinutes}`
);

// 2.4 Adversarial Bug Stress: Early Morning Midnight Connection Inversion Bug (00:00 - 04:00)
// When currentTime is 00:05, Leg 1 arrives at 00:25 (15 min travel from 00:10).
// Leg 2 has buses at 00:20 (leaves before Leg 1 arrives) and 00:35 (leaves 10 min after arrival).
// BUG: transfer-service.js line 166-168 adds +1440 to 00:20 because normDep2 < minConnectingTime && normDep2 < 240,
// causing it to pick 00:20 with a 1435-minute wait instead of 00:35 with a 10-minute wait!
const resEarlyMorningInversion = transferService.calculateTransferRoute({
  leg1Timetable: [
    { departureTime: '00:10', busId: 'b1', line: '111系統' } // arrives Kamiooka at 00:25
  ],
  leg2Timetable: [
    { departureTime: '00:20', busId: 'b2_early', line: '133系統' }, // departed before arrival!
    { departureTime: '00:35', busId: 'b2_valid', line: '133系統' }  // valid connection (wait 10 min)
  ],
  currentTime: new Date('2026-09-17T00:05:00'),
  bufferMinutes: 0
});

console.log('\n  Adversarial Early Morning Rollover Connection Result:');
console.log(`    - Leg 1 departure: ${resEarlyMorningInversion.recommended?.leg1?.actualDepartureTime}`);
console.log(`    - Leg 1 arrival:   ${resEarlyMorningInversion.recommended?.leg1?.estimatedArrivalTime}`);
console.log(`    - Selected Leg 2:  ${resEarlyMorningInversion.recommended?.leg2?.actualDepartureTime}`);
console.log(`    - Wait minutes:    ${resEarlyMorningInversion.recommended?.transferWaitMinutes}`);

assert(
  resEarlyMorningInversion.recommended?.leg2?.departureTime === '00:35',
  '[2.4.1] Transfer engine selects valid connecting bus (00:35) not already-departed bus (00:20)',
  `Actual selected: ${resEarlyMorningInversion.recommended?.leg2?.departureTime} (Inverted connection bug!)`
);

assert(
  resEarlyMorningInversion.recommended?.transferWaitMinutes < 60,
  '[2.4.2] Transfer wait time is realistic (< 60m), not 24 hours later (1435m)',
  `Actual wait: ${resEarlyMorningInversion.recommended?.transferWaitMinutes}m`
);


// ========================================================================
// 3. busLocationService.get5StopApproachingStatus: Koizumi Bidirectional
// ========================================================================
console.log('\n▶ TEST SUITE 3: Koizumi Bidirectional 5-Stop Approaching Tests');
console.log('------------------------------------------------------------------------');

// 3.1 Pole 1 (上大岡方面) Default & Sequence Check
const p1Default = busLocationService.get5StopApproachingStatus([], 'koizumi', '1');
assert(
  p1Default.targetStopName === '古泉' && p1Default.targetStopKey === 'koizumi',
  '[3.1.1] Pole 1 default stop name is 古泉'
);
assert(
  p1Default.stops.length === 6,
  '[3.1.2] Pole 1 has exactly 6 stop nodes'
);
const p1ExpectedStops = ['坂下公園前', '滝頭', '市電保存館前', '滝頭地域ケアプラザ前', '仲之町', '古泉'];
const p1ActualStops = p1Default.stops.map(s => s.name);
assert(
  JSON.stringify(p1ActualStops) === JSON.stringify(p1ExpectedStops),
  '[3.1.3] Pole 1 stop sequence: 坂下公園前 ➔ 滝頭 ➔ 市電保存館前 ➔ 滝頭地域ケアプラザ前 ➔ 仲之町 ➔ 古泉',
  `Actual: ${p1ActualStops.join(' ➔ ')}`
);

// 3.2 Pole 2 (根岸方面) Default & Sequence Check
const p2Default = busLocationService.get5StopApproachingStatus([], 'koizumi', '2');
assert(
  p2Default.targetStopName === '古泉' && p2Default.targetStopKey === 'koizumi',
  '[3.2.1] Pole 2 default stop name is 古泉'
);
assert(
  p2Default.stops.length === 6,
  '[3.2.2] Pole 2 has exactly 6 stop nodes'
);
const p2ExpectedStops = ['万福寺前', '上笹堀', '横浜岡村郵便局前', '天神前', '岡村町', '古泉'];
const p2ActualStops = p2Default.stops.map(s => s.name);
assert(
  JSON.stringify(p2ActualStops) === JSON.stringify(p2ExpectedStops),
  '[3.2.3] Pole 2 stop sequence: 万福寺前 ➔ 上笹堀 ➔ 横浜岡村郵便局前 ➔ 天神前 ➔ 岡村町 ➔ 古泉',
  `Actual: ${p2ActualStops.join(' ➔ ')}`
);

// 3.3 Live Bus at each of the 6 stops on Pole 1
for (let i = 0; i < p1ExpectedStops.length; i++) {
  const stopName = p1ExpectedStops[i];
  const expectedAway = 5 - i;
  const mockBus = [{
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:fromBusstopPole': stopName,
    'odpt:toBusstopPole': stopName,
    'odpt:delay': 30
  }];
  const res = busLocationService.get5StopApproachingStatus(mockBus, 'koizumi', '1');
  assert(
    res.stopsAway === expectedAway,
    `[3.3.${i + 1}] Pole 1 live bus at ${stopName} is ${expectedAway} stops away`,
    `stopsAway: ${res.stopsAway}`
  );
}

// 3.4 Live Bus at each of the 6 stops on Pole 2
for (let i = 0; i < p2ExpectedStops.length; i++) {
  const stopName = p2ExpectedStops[i];
  const expectedAway = 5 - i;
  const mockBus = [{
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.1823.1',
    'odpt:fromBusstopPole': stopName,
    'odpt:toBusstopPole': stopName,
    'odpt:delay': 60
  }];
  const res = busLocationService.get5StopApproachingStatus(mockBus, 'koizumi', '2');
  assert(
    res.stopsAway === expectedAway,
    `[3.4.${i + 1}] Pole 2 live bus at ${stopName} is ${expectedAway} stops away`,
    `stopsAway: ${res.stopsAway}`
  );
}

// 3.5 Cross-direction isolation
const outboundNegishiBus = [{
  'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
  'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.1823.1',
  'odpt:fromBusstopPole': '岡村町',
  'odpt:toBusstopPole': '岡村町',
  'odpt:delay': 0
}];
const p1WithReverseBus = busLocationService.get5StopApproachingStatus(outboundNegishiBus, 'koizumi', '1');
assert(
  p1WithReverseBus.status === 'scheduled' && p1WithReverseBus.activeBus === null,
  '[3.5.1] Pole 1 (to Kamiooka) isolates and ignores Outbound (to Negishi) bus'
);

const inboundKamiookaBus = [{
  'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
  'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
  'odpt:fromBusstopPole': '仲之町',
  'odpt:toBusstopPole': '仲之町',
  'odpt:delay': 0
}];
const p2WithReverseBus = busLocationService.get5StopApproachingStatus(inboundKamiookaBus, 'koizumi', '2');
assert(
  p2WithReverseBus.status === 'scheduled' && p2WithReverseBus.activeBus === null,
  '[3.5.2] Pole 2 (to Negishi) isolates and ignores Inbound (to Kamiooka) bus'
);

// 3.6 Route line isolation (111 bus passed to 133 stop)
const line111Bus = [{
  'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
  'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
  'odpt:fromBusstopPole': '洋光台駅前',
  'odpt:toBusstopPole': '洋光台駅前',
  'odpt:delay': 0
}];
const p2WithLine111Bus = busLocationService.get5StopApproachingStatus(line111Bus, 'koizumi', '2');
assert(
  p2WithLine111Bus.status === 'scheduled' && p2WithLine111Bus.activeBus === null,
  '[3.6.1] Pole 2 (Line 133) isolates and ignores Line 111 bus'
);

// 3.7 Multiple buses: Closest bus is prioritized
const multiBusesP2 = [
  {
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.1823.1',
    'odpt:fromBusstopPole': '万福寺前', // 5 stops away
    'odpt:toBusstopPole': '万福寺前',
    'odpt:delay': 0
  },
  {
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.1823.1',
    'odpt:fromBusstopPole': '天神前', // 2 stops away
    'odpt:toBusstopPole': '天神前',
    'odpt:delay': 45
  }
];
const p2MultiRes = busLocationService.get5StopApproachingStatus(multiBusesP2, 'koizumi', '2');
assert(
  p2MultiRes.stopsAway === 2 && p2MultiRes.delayMinutes === 1,
  '[3.7.1] Pole 2 picks closest bus (天神前, 2 stops away) over distant bus (万福寺前, 5 stops away)',
  `stopsAway: ${p2MultiRes.stopsAway}`
);

// 3.8 Full ODPT URI compatibility
const uriBusP2 = [{
  'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133',
  'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NegishiStation.1823.1',
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Okamuracho.1812.2',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2',
  'odpt:delay': 120
}];
const p2UriRes = busLocationService.get5StopApproachingStatus(uriBusP2, 'koizumi', '2');
assert(
  p2UriRes.status === 'approaching' && p2UriRes.stopsAway === 1 && p2UriRes.busPosition.segmentIndex === 4,
  '[3.8.1] Pole 2 resolves full ODPT URIs and correctly calculates approaching segment',
  `status: ${p2UriRes.status}, segmentIndex: ${p2UriRes.busPosition.segmentIndex}`
);


// ========================================================================
// Summary
// ========================================================================
console.log('\n========================================================================');
console.log(`TOTAL TESTS : ${totalTests}`);
console.log(`PASSED      : ${passedTests}`);
console.log(`FAILED      : ${failedTests}`);
console.log('========================================================================\n');

if (failures.length > 0) {
  console.error('CRITICAL CHALLENGER FINDINGS (FAILURES):');
  failures.forEach((f, idx) => {
    console.error(`  ${idx + 1}. ${f.testName}`);
    if (f.details) console.error(`     Reason: ${f.details}`);
  });
  console.log('\nVERDICT: REQUEST_CHANGES');
  process.exit(1);
} else {
  console.log('VERDICT: APPROVE');
  process.exit(0);
}
