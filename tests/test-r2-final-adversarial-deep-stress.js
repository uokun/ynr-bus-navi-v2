/**
 * tests/test-r2-final-adversarial-deep-stress.js
 * 
 * Deep Adversarial Stress & Boundary Exploration Suite for R2 Final Gate.
 * Author: challenger_r2_final (Empirical Challenger)
 * 
 * Objectives:
 * 1. Transfer Service:
 *    - Boundary cutoff times (20:59 vs 21:00, 03:59 vs 04:00)
 *    - Negative delay (early departure) handling
 *    - Delay pushing Leg 1 arrival across midnight and past earlier Leg 2 departures
 *    - Inbound direction midnight rollover & 6番のりば platform verification
 *    - Empty, single, cancelled, and all-missed connection scenarios
 * 2. normalizeDestination:
 *    - ReDoS safety with 100,000-character adversarial string
 *    - Whitespace and line-break variants
 *    - XSS strings preservation
 * 3. StorageService & Cache Integrity:
 *    - Malformed JSON cache recovery
 *    - Expiration TTL strictness
 *    - API key preservation across cache purges
 * 4. BusLocationService:
 *    - Extreme delay values (3600s, -600s, NaN)
 *    - Malformed bus entries resilience
 * 5. Full DOM Concurrency:
 *    - Rapid API key flip-flop stress (20 cycles)
 *    - State integrity validation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowserEnv, assert } from './test-harness.js';
import { transferService } from '../js/services/transfer-service.js';
import { normalizeDestination } from '../js/api/odpt-client.js';
import { storageService } from '../js/services/storage-service.js';
import { odptClient } from '../js/api/odpt-client.js';
import { busLocationService, formatDelayText } from '../js/services/bus-location-service.js';
import { App } from '../js/app.js';
import { AppState } from '../js/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✖ FAIL: ${name} (${e.message})`);
    failures.push({ name, err: e.message });
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✖ FAIL: ${name} (${e.message})`);
    failures.push({ name, err: e.message });
  }
}

function setupDOM() {
  const env = createBrowserEnv();
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    env.document.body.innerHTML = bodyMatch[1];
  }

  globalThis.window = env.window;
  globalThis.document = env.document;
  globalThis.localStorage = env.localStorage;
  globalThis.sessionStorage = env.sessionStorage;
  return env;
}

console.log('========================================================================');
console.log('   CHALLENGER R2 FINAL DEEP ADVERSARIAL STRESS HARNESS                  ');
console.log('========================================================================\n');

// ------------------------------------------------------------------------
// DOMAIN 1: Transfer Service Boundary & Delay Stress
// ------------------------------------------------------------------------
console.log('▶ DOMAIN 1: Transfer Service Extreme Boundary & Delay Stress');

test('1.1 Boundary cutoff at 20:59 vs 21:00 referenceMin', () => {
  // At 20:59 (1259 min), a departure at 00:10 (10 min) should NOT yet be treated as next day
  const norm2059 = transferService.normalizeMinutesForComparison(10, 1259);
  assert.equal(norm2059, 10, 'At 20:59, 00:10 is not shifted by +1440');

  // At 21:00 (1260 min), a departure at 00:10 (10 min) SHOULD be treated as next day (+1440 = 1450)
  const norm2100 = transferService.normalizeMinutesForComparison(10, 1260);
  assert.equal(norm2100, 1450, 'At 21:00, 00:10 is shifted by +1440');
});

test('1.2 Boundary cutoff at 03:59 vs 04:00 referenceMin', () => {
  // At 03:59 (239 min), a departure from previous night 23:55 (1435 min) is treated as -5 min
  const norm0359 = transferService.normalizeMinutesForComparison(1435, 239);
  assert.equal(norm0359, -5, 'At 03:59, 23:55 is shifted to -5');

  // At 04:00 (240 min), a departure at 23:55 is treated as tonight (1435 min)
  const norm0400 = transferService.normalizeMinutesForComparison(1435, 240);
  assert.equal(norm0400, 1435, 'At 04:00, 23:55 is unshifted 1435');
});

test('1.3 Delay pushing Leg 1 arrival past earlier Leg 2 departure (dynamic connection healing)', () => {
  // Leg 1 departs 23:40, standard arrival 23:55. BUT delayed 15 minutes!
  // Actual arrival at Kamiooka = 23:55 + 15 = 00:10 (1450 min).
  // Leg 2 has:
  // - Bus A: 00:05 (leaves before delayed Leg 1 arrives!)
  // - Bus B: 00:20 (connects with 10 min wait)
  const res = transferService.calculateTransferRoute({
    leg1Timetable: [
      { departureTime: '23:40', busId: 'b1', line: '111系統' }
    ],
    leg2Timetable: [
      { departureTime: '00:05', busId: 'b2_early', line: '133系統' },
      { departureTime: '00:20', busId: 'b2_connects', line: '133系統' }
    ],
    realtimeDelays: {
      'b1': 15 // 15 min delay
    },
    currentTime: new Date('2026-09-17T23:30:00'),
    bufferMinutes: 0
  });

  assert.ok(res.recommended, 'Recommended route exists');
  assert.equal(res.recommended.leg1.actualDepartureTime, '23:55', 'Delayed Leg 1 departure is 23:55');
  assert.equal(res.recommended.leg1.estimatedArrivalTime, '00:10', 'Delayed Leg 1 arrival is 00:10');
  assert.equal(res.recommended.leg2.actualDepartureTime, '00:20', 'Selects Bus B (00:20) that departs after delayed arrival');
  assert.equal(res.recommended.transferWaitMinutes, 10, 'Wait minutes is exactly 10 min');
});

test('1.4 Negative delay (early bus arrival) does not cause negative wait time or invalid selection', () => {
  // Leg 1 departs 10:00, arrival 10:15.
  // Leg 2 departs 10:20, arrives 10:32.
  // Delay is -2 min on Leg 2 (leaves 10:18). Leg 1 still arrives 10:15. Wait = 10:18 - 10:15 = 3 min.
  const res = transferService.calculateTransferRoute({
    leg1Timetable: [{ departureTime: '10:00', busId: 'b1', line: '111系統' }],
    leg2Timetable: [{ departureTime: '10:20', busId: 'b2', line: '133系統' }],
    realtimeDelays: { 'b2': -2 },
    currentTime: new Date('2026-09-17T09:50:00'),
    bufferMinutes: 0
  });

  assert.ok(res.recommended);
  assert.equal(res.recommended.leg2.actualDepartureTime, '10:18');
  assert.equal(res.recommended.transferWaitMinutes, 3);
});

test('1.5 Inbound direction midnight rollover & platform 6番のりば verification', () => {
  const routes = transferService.getBidirectionalRoutes();
  assert.equal(routes.inbound.leg2.platform, '6番のりば', 'Inbound Leg 2 platform must be 6番のりば');

  // Inbound: Leg 1 Koizumi (12m travel) -> Kamiooka -> Leg 2 Yokodai (15m travel)
  const res = transferService.calculateTransferRoute({
    leg1Timetable: [{ departureTime: '23:50', busId: 'b1', line: '133系統' }],
    leg2Timetable: [{ departureTime: '00:10', busId: 'b2', line: '111系統' }],
    direction: 'inbound',
    currentTime: new Date('2026-09-17T23:45:00'),
    bufferMinutes: 0
  });

  assert.ok(res.recommended);
  assert.equal(res.recommended.leg1.actualDepartureTime, '23:50');
  // Leg 1 arrives at Kamiooka at 23:50 + 12 = 00:02
  assert.equal(res.recommended.leg1.estimatedArrivalTime, '00:02');
  // Leg 2 departs at 00:10. Wait = 8 min.
  assert.equal(res.recommended.leg2.actualDepartureTime, '00:10');
  assert.equal(res.recommended.transferWaitMinutes, 8);
  assert.equal(res.recommended.totalDurationMinutes, 35); // 00:10 + 15 = 00:25 arrival. Total = 00:25 - 23:50 = 35 min.
});

test('1.6 All buses cancelled returns status: no_buses_available', () => {
  const res = transferService.calculateTransferRoute({
    leg1Timetable: [{ departureTime: '10:00', busId: 'b1', line: '111系統', isCancelled: true }],
    leg2Timetable: [{ departureTime: '10:20', busId: 'b2', line: '133系統' }],
    currentTime: new Date('2026-09-17T09:50:00')
  });

  assert.equal(res.status, 'no_buses_available');
  assert.equal(res.recommended, null);
  assert.equal(res.alternatives.length, 0);
});

test('1.7 Leg 1 has buses, but Leg 2 has no connecting bus (all depart prior to Leg 1 arrival)', () => {
  const res = transferService.calculateTransferRoute({
    leg1Timetable: [{ departureTime: '22:00', busId: 'b1', line: '111系統' }], // arrives 22:15
    leg2Timetable: [{ departureTime: '21:30', busId: 'b2', line: '133系統' }], // departs before arrival
    currentTime: new Date('2026-09-17T21:50:00')
  });

  assert.equal(res.status, 'no_buses_available');
  assert.equal(res.recommended, null);
});


// ------------------------------------------------------------------------
// DOMAIN 2: normalizeDestination Adversarial Edge Cases
// ------------------------------------------------------------------------
console.log('\n▶ DOMAIN 2: normalizeDestination Adversarial Edge Cases');

test('2.1 ReDoS resistance with 100,000-character payload', () => {
  const giantString = '洋光台 '.repeat(20000);
  const start = performance.now();
  const res = normalizeDestination(giantString, '111系統', '7800.1');
  const duration = performance.now() - start;
  assert.equal(res, '洋光台駅前 行');
  assert.ok(duration < 500, `Execution took ${duration.toFixed(2)}ms (< 500ms limit)`);
});

test('2.2 Whitespace-only string falls back safely to pole route', () => {
  assert.equal(normalizeDestination('   \n\t  \uFFFD  ', '111系統', '7800.1'), '上大岡駅前 行');
  assert.equal(normalizeDestination('   \n\t  \uFFFD  ', '111系統', '7800.2'), '港南台駅前 行');
  assert.equal(normalizeDestination('   \n\t  \uFFFD  ', '133系統', '1810.1'), '上大岡駅前 行');
  assert.equal(normalizeDestination('   \n\t  \uFFFD  ', '133系統', '1810.2'), '根岸駅前 行');
});

test('2.3 Non-standard / XSS destination preserved without crashing or mutation', () => {
  const xss = '<script>alert("hack")</script>';
  const res = normalizeDestination(xss, '111系統', '7800.1');
  assert.equal(res, '<script>alert("hack")</script> 行');
});


// ------------------------------------------------------------------------
// DOMAIN 3: StorageService & Cache Hardening
// ------------------------------------------------------------------------
console.log('\n▶ DOMAIN 3: StorageService & Cache Hardening');

test('3.1 setApiKey sanitization with whitespace, null, and empty string', () => {
  setupDOM();
  // Whitespace only
  assert.equal(storageService.setApiKey('   '), '');
  assert.equal(storageService.hasApiKey(), false);

  // Null / undefined
  assert.equal(storageService.setApiKey(null), '');
  assert.equal(storageService.hasApiKey(), false);

  // Valid with trimming
  assert.equal(storageService.setApiKey('  token-abc  '), 'token-abc');
  assert.equal(storageService.hasApiKey(), true);
  assert.equal(storageService.getApiKey(), 'token-abc');
});

test('3.2 Cache TTL expiration & corrupted envelope recovery', () => {
  setupDOM();
  // 1. Valid cached item
  storageService.setCachedData('test-valid', { answer: 42 }, 3600);
  assert.equal(storageService.getCachedData('test-valid')?.answer, 42);

  // 2. Expired cached item
  const expiredKey = 'odpt:test-expired';
  const envelopeExpired = {
    key: expiredKey,
    cachedAt: Date.now() - 10000,
    expiresAt: Date.now() - 5000, // expired 5s ago
    data: { stale: true }
  };
  storageService._setItem(expiredKey, JSON.stringify(envelopeExpired));
  assert.equal(storageService.getCachedData('test-expired'), null, 'Expired cache must return null');

  // 3. Corrupted non-JSON cache item
  const corruptKey = 'odpt:test-corrupt';
  storageService._setItem(corruptKey, '<<<not valid json>>>');
  assert.equal(storageService.getCachedData('test-corrupt'), null, 'Corrupted cache must return null without throwing');

  // 4. clearCache preserves API key
  storageService.setApiKey('keep-my-api-key');
  storageService.clearCache();
  assert.equal(storageService.getApiKey(), 'keep-my-api-key', 'clearCache must NEVER wipe transporter_api_key');
});


// ------------------------------------------------------------------------
// DOMAIN 4: BusLocationService Extreme Values
// ------------------------------------------------------------------------
console.log('\n▶ DOMAIN 4: BusLocationService Extreme Values');

test('4.1 Extreme delay seconds (3600s, -300s, NaN) formatting', () => {
  assert.equal(formatDelayText(3600).delayText, '+60分遅れ');
  assert.equal(formatDelayText(0).delayText, '定刻');
  assert.equal(formatDelayText(20).delayText, '定刻'); // < 30s rounds to 0
  assert.equal(formatDelayText(65).delayText, '+1分遅れ');
  assert.equal(formatDelayText(NaN).delayText, '定刻');
  assert.equal(formatDelayText(undefined).delayText, '定刻');
  assert.equal(formatDelayText(-120).delayText, '-2分早着');
});

test('4.2 Malformed bus entries in 5-stop approaching calculation', () => {
  const malformedBuses = [
    null,
    undefined,
    {},
    { 'odpt:busroute': null },
    { 'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.133', 'odpt:delay': 'not-a-number' }
  ];

  let threw = false;
  let res;
  try {
    res = busLocationService.get5StopApproachingStatus(malformedBuses, 'koizumi', '1');
  } catch (e) {
    threw = true;
  }

  assert.equal(threw, false, 'Must handle malformed bus objects without throwing');
  assert.equal(res.status, 'scheduled', 'Defaults safely to scheduled status');
});


// ------------------------------------------------------------------------
// DOMAIN 5: Full DOM Concurrency & Lifecycle
// ------------------------------------------------------------------------
console.log('\n▶ DOMAIN 5: Full DOM Concurrency & Lifecycle');

await testAsync('5.1 20-cycle rapid API key save/reset flip-flop with DOM verification', async () => {
  setupDOM();
  const appState = new AppState();
  const app = new App(appState);
  globalThis.app = app;
  await app.init();

  for (let i = 1; i <= 20; i++) {
    // 1. Set key
    storageService.setApiKey(`stress-token-${i}`);
    await app.renderAll();
    const tBox = document.getElementById('transfer-result-container');
    assert.ok(tBox);
    assert.equal(tBox.innerHTML.includes('APIキーを設定してください'), false, `Cycle ${i} save check failed`);

    // 2. Reset key
    storageService.resetApiKey();
    await app.renderAll();
    assert.equal(tBox.innerHTML.includes('APIキーを設定してください'), true, `Cycle ${i} reset check failed`);
  }

  if (app.polling) app.polling.stop();
  if (app.clockTimerId) clearInterval(app.clockTimerId);
});

// ------------------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TOTAL DEEP STRESS TESTS : ${total}`);
console.log(`PASSED                 : ${passed}`);
console.log(`FAILED                 : ${failed}`);
console.log('========================================================================\n');

if (failed > 0) {
  console.error('CHALLENGER STRESS FAILURES:');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f.name} -> ${f.err}`));
  process.exit(1);
} else {
  console.log('VERDICT: 100% PASS - ALL DEEP ADVERSARIAL STRESS TESTS APPROVED');
  process.exit(0);
}
