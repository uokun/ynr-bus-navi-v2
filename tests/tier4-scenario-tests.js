/**
 * tier4-scenario-tests.js
 * Tier 4: Real-World Application Scenarios (>= 8 test cases)
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import {
  assert,
  createBrowserEnv,
  REFERENCE_CONFIG,
  getMockTimetables,
  calculateTransferOracle,
  isJapaneseHolidayOracle,
  getCalendarTypeOracle
} from './test-harness.js';

export const tier4Tests = [];

function registerTest(id, name, scenarioDesc, fn) {
  tier4Tests.push({ id, name, scenarioDesc, fn });
}

// =========================================================================
// Scenario Tests (9 real-world end-to-end user workflows)
// =========================================================================

registerTest('T4.1', 'Morning Commute: Yokodai -> Kamiooka (Line 111) -> Koizumi (Line 133) on Weekday 07:30',
  'Morning Commute Yokodai to Koizumi', () => {
  const timetables = getMockTimetables();
  const morningCommuteTime = new Date(2026, 7, 24, 7, 30, 0); // Monday 07:30 AM (Weekday)

  // 1. Verify calendar type is Weekday
  assert.equal(getCalendarTypeOracle(morningCommuteTime), 'Weekday');

  // 2. Calculate transfer with standard 5-minute buffer
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: morningCommuteTime
  });

  // 3. Assert recommended option
  assert.equal(result.status, 'ok');
  assert.ok(result.recommended);
  assert.equal(result.recommended.leg1.line, '111系統');
  assert.equal(result.recommended.leg1.destination, '上大岡駅前');
  assert.equal(result.recommended.leg1.departureTime, '07:30'); // Departs 07:30 -> Arr 07:45
  assert.equal(result.recommended.leg2.line, '133系統');
  assert.equal(result.recommended.leg2.destination, '根岸駅前');
  assert.equal(result.recommended.leg2.departureTime, '07:50'); // Departs 07:50 (5m buffer after 07:45)

  // 4. Assert alternatives for backup
  assert.greaterOrEqual(result.alternatives.length, 2);
  assert.equal(result.alternatives[0].leg1.departureTime, '07:42');
});

registerTest('T4.2', 'Evening Return Commute: Koizumi -> Kamiooka (Line 133) -> Yokodai (Line 111) on Weekday 18:45',
  'Evening Return Commute Koizumi to Yokodai', () => {
  const timetables = getMockTimetables();
  const eveningCommuteTime = new Date(2026, 7, 24, 18, 45, 0); // Monday 18:45 PM

  // User sets 7-minute custom transfer buffer
  // At 18:45, next departure on Line 133 Inbound is 19:00 (Arr Kamiooka 19:12)
  // With 7 min buffer, min connecting time is 19:19 -> next Line 111 is 19:30
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line133Inbound,
    leg2Timetable: timetables.line111Inbound,
    direction: 'inbound',
    bufferMinutes: 7,
    currentTime: eveningCommuteTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.line, '133系統');
  assert.equal(result.recommended.leg1.departureTime, '19:00'); // Next departure at/after 18:45
  assert.equal(result.recommended.leg2.line, '111系統');
  assert.equal(result.recommended.leg2.departureTime, '19:30'); // Departs 19:30 (>= 19:12 + 7m = 19:19)

  // Total duration check
  assert.ok(result.recommended.totalDurationMinutes > 0);
});

registerTest('T4.3', 'Holiday Family Excursion: Yokodai -> Kamiooka -> Koizumi on Sunday 11:00 AM with Line 64/111',
  'Sunday Holiday Family Excursion', () => {
  const sundayTime = new Date(2026, 7, 23, 11, 0, 0); // Sunday 11:00 AM
  assert.equal(getCalendarTypeOracle(sundayTime), 'Holiday');

  const timetables = getMockTimetables();
  // Line 111 Outbound: 11:00 -> Arr Kamiooka 11:15
  // Buffer 5m -> Min connecting 11:20 -> Line 64 Outbound next is 12:15
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line64Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: sundayTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.departureTime, '11:00');
  assert.equal(result.recommended.leg2.line, '64系統');
  assert.equal(result.recommended.leg2.departureTime, '12:15');
});

registerTest('T4.4', 'Emergency Delay & Missed Connection Recovery Workflow',
  'Live Delay Recalculation and Route Healing', () => {
  const timetables = getMockTimetables();
  const morningTime = new Date(2026, 7, 24, 8, 0, 0);

  // Baseline on-time connection
  const normalResult = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: morningTime
  });
  assert.equal(normalResult.recommended.leg1.departureTime, '08:10');
  assert.equal(normalResult.recommended.leg2.departureTime, '08:40');

  // Sudden 18-minute delay on Leg 1 bus (08:10 bus leaves at 08:28, arrives 08:43 -> min connecting 08:48)
  const delayedResult = calculateTransferOracle({
    leg1Timetable: [{ line: '111系統', departureTime: '08:10', busId: 'bus-111-delayed' }],
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { 'bus-111-delayed': 18 },
    currentTime: morningTime
  });

  // Misses 08:40 bus, automatically selects 09:05 bus!
  assert.equal(delayedResult.status, 'ok');
  assert.equal(delayedResult.recommended.leg2.departureTime, '09:05');
});

registerTest('T4.5', 'First-Time User Setup & Configuration Workflow',
  'PWA Launch, Settings Configuration, and Theme Switching', () => {
  const env = createBrowserEnv();

  // 1. Initial state
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY), null);
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER), null);

  // 2. User sets API key and 3-minute buffer in settings modal
  const customKey = 'sp6f7n9vz8rl444kyzez0hrmw9j9j5owtyiw8tksze5mamr8wd7nrcc6xeybydat';
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY, customKey);
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER, '3');
  env.document.querySelector('html').setAttribute('data-theme', 'dark');

  // 3. Verify persistence
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY), customKey);
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER), '3');
  assert.equal(env.document.querySelector('html').getAttribute('data-theme'), 'dark');
});

registerTest('T4.6', 'Subway Tunnel Complete Offline Commute Check Workflow',
  'Offline App Shell & Cached Timetable Query', () => {
  const env = createBrowserEnv();
  env.window.navigator.onLine = false;

  // Verify app shell and mock data provide departures without network
  const mockTimetables = getMockTimetables();
  assert.ok(mockTimetables.line111Outbound.length > 0);
  assert.ok(mockTimetables.line133Outbound.length > 0);

  const transfer = calculateTransferOracle({
    leg1Timetable: mockTimetables.line111Outbound,
    leg2Timetable: mockTimetables.line133Outbound,
    direction: 'outbound',
    currentTime: new Date(2026, 7, 24, 12, 0, 0)
  });

  assert.equal(transfer.status, 'ok');
  assert.ok(transfer.recommended);
});

registerTest('T4.7', 'Year-End / New Year Holiday Schedule Transfer on Jan 2nd',
  'Special Schedule Period 12/29 to 01/03 Recognition', () => {
  const jan2nd = new Date(2026, 0, 2, 9, 30, 0); // Jan 2 (Friday)
  assert.true(isJapaneseHolidayOracle(jan2nd));
  assert.equal(getCalendarTypeOracle(jan2nd), 'Holiday');

  const timetables = getMockTimetables();
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    currentTime: jan2nd
  });

  assert.equal(result.status, 'ok');
});

registerTest('T4.8', 'Bus Line Filtering & Stop-by-Stop Inspection Workflow',
  'Line 64 Filter and Stop Tab Exploration', () => {
  const timetables = getMockTimetables();
  const line64Buses = timetables.line64Outbound.filter(b => b.line === '64系統');

  assert.equal(line64Buses.length, 16);
  assert.equal(line64Buses[0].destination, '磯子駅前');
});

registerTest('T4.9', 'Live Commute Desk Monitoring & Polling Lifecycle',
  'Auto-Polling, Delay Tracking, and Page Visibility Lifecycle', () => {
  const env = createBrowserEnv();
  let pollCount = 0;
  let simulatedDelay = 0;

  const onPollTick = () => {
    if (env.document.visibilityState === 'visible') {
      pollCount++;
      simulatedDelay += 1;
    }
  };

  // 1. Tab active on desk: 3 polling cycles (90s)
  onPollTick();
  onPollTick();
  onPollTick();
  assert.equal(pollCount, 3);
  assert.equal(simulatedDelay, 3);

  // 2. User minimizes browser: backgrounding
  env.document.visibilityState = 'hidden';
  onPollTick(); // Should be ignored
  assert.equal(pollCount, 3);

  // 3. User restores window
  env.document.visibilityState = 'visible';
  onPollTick();
  assert.equal(pollCount, 4);
});
