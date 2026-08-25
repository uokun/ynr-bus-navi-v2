/**
 * adversarial-stress-m2-m3.js
 * Adversarial Stress-Testing & Mathematical Precision Suite for Milestone 2 & Milestone 3.
 * 
 * Testing Focus:
 * 1. Extreme Delays on Leg 1 (+15m, +30m, +45m, +120m) causing missed connections.
 * 2. Transfer buffer variations: 0, 1, 5, 30, 99 minutes, plus invalid/negative/extreme inputs.
 * 3. Edge times: early morning (05:30), late night (23:45), midnight (24:15, 00:15).
 * 4. Empty timetables, all cancelled, end-of-day, and corrupted data scenarios.
 * 5. Strict mathematical precision of T_arr1, T_min2, Wait Duration, Total Duration across all branches.
 * 6. High-load stress generator (1,000+ randomized combinations of delays, buffers, and times).
 */

import { CONFIG, STOPS, ROUTES, DEFAULT_TRANSFER_BUFFER_MINUTES } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { TimetableService, timetableService } from '../js/services/timetable-service.js';
import { TransferService, transferService } from '../js/services/transfer-service.js';
import { CalendarService, calendarService } from '../js/services/calendar-service.js';
import { getMockTimetables, getMockTimetable, buildTimetableEntries } from '../js/api/mock-data.js';
import { OdptClient } from '../js/api/odpt-client.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedTests++;
    const errMsg = `❌ [FAIL] ${message}${details ? ' -> ' + details : ''}`;
    console.error(`  ${errMsg}`);
    failureDetails.push(errMsg);
  }
}

function assertEqual(actual, expected, message) {
  const cond = actual === expected;
  assert(cond, message, `Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
}

console.log('========================================================================');
console.log('       ADVERSARIAL STRESS & MATHEMATICAL VERIFICATION (M2 & M3)         ');
console.log('========================================================================\n');

const weekdayTables = getMockTimetables('Weekday');
const satTables = getMockTimetables('Saturday');
const holTables = getMockTimetables('Holiday');

// ========================================================================
// SECTION 1: Mathematical Precision of T_arr1, T_min2, Wait, Total Duration
// ========================================================================
console.log('▶ SECTION 1: Exact Mathematical Precision Verification');

{
  // Test Outbound Route: Leg 1 (15m travel), Leg 2 (12m travel)
  const leg1Times = ['08:00', '08:30', '09:00'];
  const leg2Times = ['08:15', '08:20', '08:45', '09:10'];
  const leg1 = buildTimetableEntries(leg1Times, '111系統', '上大岡駅前', 'out');
  const leg2 = buildTimetableEntries(leg2Times, '133系統', '根岸駅前', 'out');

  // Case 1.1: Standard buffer = 5, no delay, currentTime = 07:50
  // Dep1 = 08:00 (480m) -> Arr1 = 480 + 15 = 495m (08:15)
  // T_min2 = 495 + 5 = 500m (08:20)
  // Leg 2 candidates: 08:15 (495 < 500: skip), 08:20 (500 >= 500: match!)
  // Wait = 500 - 495 = 5m
  // Arr2 = 500 + 12 = 512m (08:32)
  // Total = 512 - 480 = 32m
  const res1 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 24, 7, 50, 0)
  });

  assert(res1.status === 'ok', 'Status is ok for standard transfer');
  assertEqual(res1.recommended.leg1.actualDepartureTime, '08:00', 'Leg 1 actual dep is 08:00');
  assertEqual(res1.recommended.leg1.estimatedArrivalTime, '08:15', 'Leg 1 estimated arr is 08:15');
  assertEqual(res1.recommended.leg2.actualDepartureTime, '08:20', 'Leg 2 selected is 08:20 (satisfies minConnectingTime 08:20)');
  assertEqual(res1.recommended.leg2.estimatedArrivalTime, '08:32', 'Leg 2 estimated arr is 08:32');
  assertEqual(res1.recommended.transferWaitMinutes, 5, 'Wait duration is exactly 5 minutes');
  assertEqual(res1.recommended.totalDurationMinutes, 32, 'Total duration is exactly 32 minutes (15 + 5 + 12)');

  // Case 1.2: Inbound Route: Leg 1 (12m travel), Leg 2 (15m travel)
  // Dep1 = 08:00 (480m) -> Arr1 = 480 + 12 = 492m (08:12)
  // Buffer = 7 -> T_min2 = 492 + 7 = 499m (08:19)
  // Leg 2 departures: ['08:15' (495m < 499m), '08:25' (505m >= 499m)]
  const inLeg1 = buildTimetableEntries(['08:00'], '133系統', '上大岡駅前', 'in');
  const inLeg2 = buildTimetableEntries(['08:15', '08:25'], '111系統', '港南台駅前', 'in');

  const resIn = transferService.calculateTransferRoute({
    leg1Timetable: inLeg1,
    leg2Timetable: inLeg2,
    direction: 'inbound',
    bufferMinutes: 7,
    currentTime: new Date(2026, 7, 24, 7, 55, 0)
  });

  assert(resIn.status === 'ok', 'Inbound transfer status ok');
  assertEqual(resIn.recommended.leg1.estimatedArrivalTime, '08:12', 'Inbound Leg 1 estimated arr is 08:12 (12m travel)');
  assertEqual(resIn.recommended.leg2.actualDepartureTime, '08:25', 'Inbound Leg 2 selected is 08:25');
  assertEqual(resIn.recommended.transferWaitMinutes, 13, 'Inbound wait duration is 13m (08:25 - 08:12)');
  assertEqual(resIn.recommended.leg2.estimatedArrivalTime, '08:40', 'Inbound Leg 2 estimated arr is 08:40 (15m travel)');
  assertEqual(resIn.recommended.totalDurationMinutes, 40, 'Inbound total duration is 40m (12 + 13 + 15)');
}

// ========================================================================
// SECTION 2: High Delay on Leg 1 (+15m, +30m, +45m, +120m) & Missed Connections
// ========================================================================
console.log('\n▶ SECTION 2: High Delay Stress on Leg 1 & Connection Miss Recovery');

{
  const leg1 = buildTimetableEntries(['09:00', '09:30'], '111系統', '上大岡駅前', 'out');
  const leg2 = buildTimetableEntries(['09:18', '09:25', '09:40', '10:00', '10:30'], '133系統', '根岸駅前', 'out');

  // Case 2.1: +15m delay on 09:00 Leg 1
  // Sched Dep1 = 09:00 (540m), Delay = 15m -> Actual Dep1 = 09:15 (555m)
  // Arr1 = 555 + 15 = 570m (09:30)
  // Buffer = 5 -> T_min2 = 570 + 5 = 575m (09:35)
  // Missed Leg 2 buses: 09:18 (558 < 575), 09:25 (565 < 575)
  // Caught Leg 2: 09:40 (580 >= 575)
  // Wait = 580 - 570 = 10m
  const resDelay15 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { [leg1[0].busId]: 15 },
    currentTime: new Date(2026, 7, 24, 8, 50, 0)
  });

  assertEqual(resDelay15.recommended.leg1.actualDepartureTime, '09:15', '+15m delay updates Leg 1 actual departure to 09:15');
  assertEqual(resDelay15.recommended.leg1.estimatedArrivalTime, '09:30', '+15m delay updates Leg 1 estimated arrival to 09:30');
  assertEqual(resDelay15.recommended.leg2.actualDepartureTime, '09:40', 'Correctly catches 09:40 after missing 09:18 and 09:25');
  assertEqual(resDelay15.recommended.transferWaitMinutes, 10, 'Wait duration is exactly 10 minutes');

  // Case 2.2: +30m delay on 09:00 Leg 1
  // Sched Dep1 = 09:00 (540m), Delay = 30m -> Actual Dep1 = 09:30 (570m)
  // Arr1 = 570 + 15 = 585m (09:45)
  // Buffer = 5 -> T_min2 = 585 + 5 = 590m (09:50)
  // Missed: 09:18, 09:25, 09:40 (580 < 590)
  // Caught: 10:00 (600 >= 590)
  // Wait = 600 - 585 = 15m
  const resDelay30 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { [leg1[0].busId]: 30 },
    currentTime: new Date(2026, 7, 24, 8, 50, 0)
  });

  assertEqual(resDelay30.recommended.leg1.actualDepartureTime, '09:30', '+30m delay updates Leg 1 actual departure to 09:30');
  assertEqual(resDelay30.recommended.leg1.estimatedArrivalTime, '09:45', '+30m delay updates Leg 1 estimated arrival to 09:45');
  assertEqual(resDelay30.recommended.leg2.actualDepartureTime, '10:00', 'Correctly skips 09:40 and catches 10:00');
  assertEqual(resDelay30.recommended.transferWaitMinutes, 15, 'Wait duration is 15 minutes (10:00 - 09:45)');

  // Case 2.3: +120m massive delay on Leg 1
  // Sched Dep1 = 09:00 -> Actual Dep1 = 11:00 (660m)
  // Arr1 = 660 + 15 = 675m (11:15)
  // T_min2 = 675 + 5 = 680m (11:20)
  // In leg2, latest bus is 10:30 (630m < 680m). For this b1, no b2 connects.
  // Next Leg 1 is 09:30 (no delay, but if currentTime is 09:35, 09:30 already departed).
  const resDelay120 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { [leg1[0].busId]: 120 },
    currentTime: new Date(2026, 7, 24, 9, 35, 0) // 09:30 bus departed
  });
  assertEqual(resDelay120.status, 'no_buses_available', 'Massive delay causing all Leg 2 departures to be missed yields no_buses_available');
  assertEqual(resDelay120.recommended, null, 'Recommended is null when no connection exists');

  // Case 2.4: Leg 2 also delayed: Leg 1 on-time (Arr1 09:15, T_min2 09:20), Leg 2 scheduled 09:18 has +5m delay (Actual Dep2 09:23)
  // Actual Dep2 09:23 >= 09:20 -> Can be caught!
  const resLeg2Delay = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { [leg2[0].busId]: 5 }, // 09:18 + 5m = 09:23
    currentTime: new Date(2026, 7, 24, 8, 50, 0)
  });
  assertEqual(resLeg2Delay.recommended.leg2.actualDepartureTime, '09:23', 'Leg 2 +5m delay allows catching scheduled 09:18 at 09:23');
  assertEqual(resLeg2Delay.recommended.transferWaitMinutes, 8, 'Wait is 8m (09:23 - 09:15)');
}

// ========================================================================
// SECTION 3: Transfer Buffer Boundary Values (0, 1, 5, 30, 99 min & Edge Types)
// ========================================================================
console.log('\n▶ SECTION 3: Transfer Buffer Boundary Values & Edge Types');

{
  const leg1 = buildTimetableEntries(['10:00'], '111系統', '上大岡駅前', 'out');
  // Arr1 = 10:15 (615m)
  const leg2 = buildTimetableEntries(['10:15', '10:16', '10:20', '10:45', '11:54', '12:00'], '133系統', '根岸駅前', 'out');

  // Case 3.1: Buffer = 0 (Instant transfer allowed at 10:15)
  const resBuf0 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: 0,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBuf0.recommended.leg2.actualDepartureTime, '10:15', 'Buffer 0 connects immediately at 10:15');
  assertEqual(resBuf0.recommended.transferWaitMinutes, 0, 'Buffer 0 wait minutes is 0');

  // Case 3.2: Buffer = 1 (T_min2 = 10:16)
  const resBuf1 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: 1,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBuf1.recommended.leg2.actualDepartureTime, '10:16', 'Buffer 1 catches 10:16');
  assertEqual(resBuf1.recommended.transferWaitMinutes, 1, 'Buffer 1 wait minutes is 1');

  // Case 3.3: Buffer = 5 (T_min2 = 10:20)
  const resBuf5 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBuf5.recommended.leg2.actualDepartureTime, '10:20', 'Buffer 5 catches 10:20');
  assertEqual(resBuf5.recommended.transferWaitMinutes, 5, 'Buffer 5 wait minutes is 5');

  // Case 3.4: Buffer = 30 (T_min2 = 10:45)
  const resBuf30 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: 30,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBuf30.recommended.leg2.actualDepartureTime, '10:45', 'Buffer 30 catches 10:45');
  assertEqual(resBuf30.recommended.transferWaitMinutes, 30, 'Buffer 30 wait minutes is 30');

  // Case 3.5: Buffer = 99 (T_min2 = 615 + 99 = 714m = 11:54)
  const resBuf99 = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: 99,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBuf99.recommended.leg2.actualDepartureTime, '11:54', 'Buffer 99 catches 11:54');
  assertEqual(resBuf99.recommended.transferWaitMinutes, 99, 'Buffer 99 wait minutes is 99');

  // Case 3.6: Buffer negative (-10) -> sanitized to Math.max(0, -10) = 0
  const resBufNeg = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: -10,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBufNeg.recommended.bufferMinutes, 0, 'Negative buffer is sanitized to 0');
  assertEqual(resBufNeg.recommended.leg2.actualDepartureTime, '10:15', 'Negative buffer behaves safely like buffer 0');

  // Case 3.7: Buffer non-numeric (null, undefined, NaN) -> defaults to 5
  const resBufNull = transferService.calculateTransferRoute({
    leg1Timetable: leg1,
    leg2Timetable: leg2,
    bufferMinutes: null,
    currentTime: new Date(2026, 7, 24, 9, 50, 0)
  });
  assertEqual(resBufNull.recommended.bufferMinutes, 5, 'Null buffer defaults to 5');
  assertEqual(resBufNull.recommended.leg2.actualDepartureTime, '10:20', 'Null buffer connects at 10:20');

  // Case 3.8: StorageService buffer clamp tests
  const storage = new StorageService();
  assertEqual(storage.setTransferBuffer(0), 1, 'StorageService setTransferBuffer(0) clamps to 1');
  assertEqual(storage.setTransferBuffer(31), 30, 'StorageService setTransferBuffer(31) clamps to 30');
  assertEqual(storage.setTransferBuffer('invalid'), 5, 'StorageService setTransferBuffer("invalid") defaults to 5');
}

// ========================================================================
// SECTION 4: Edge Times: Early Morning (05:30), Late Night (23:45), Midnight (24:15)
// ========================================================================
console.log('\n▶ SECTION 4: Edge Times & Chronological Boundaries');

{
  // Case 4.1: Early morning 05:30 (First Weekday bus is 06:15)
  const earlyRes = transferService.calculateTransferRoute({
    leg1Timetable: weekdayTables.line111Outbound,
    leg2Timetable: weekdayTables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 24, 5, 30, 0)
  });
  assert(earlyRes.status === 'ok', 'Early morning 05:30 status is ok');
  assertEqual(earlyRes.recommended.leg1.departureTime, '06:15', 'First bus of the day 06:15 selected');
  assertEqual(earlyRes.recommended.leg1.estimatedArrivalTime, '06:30', 'First bus arrives at Kamiooka 06:30');
  // First Line 133 is 06:30, with buffer 5 T_min2 = 06:35 -> Next Line 133 is 06:55
  assertEqual(earlyRes.recommended.leg2.departureTime, '06:55', 'Leg 2 selected is 06:55 (06:30 is before minConnectingTime 06:35)');

  // Case 4.2: Late night 22:45 (Last Weekday Line 111 is 22:30)
  const lateRes = transferService.calculateTransferRoute({
    leg1Timetable: weekdayTables.line111Outbound,
    leg2Timetable: weekdayTables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 24, 22, 45, 0)
  });
  assertEqual(lateRes.status, 'no_buses_available', 'Past last bus 22:45 returns no_buses_available');
  assertEqual(lateRes.recommended, null, 'Recommended is null past last bus');

  // Case 4.3: Late night connection where Leg 1 exists but Leg 2 has ended
  // Leg 1: 22:30 (Arr 22:45, T_min2 22:50). Last Leg 2 is 22:15.
  const endOfDayRes = transferService.calculateTransferRoute({
    leg1Timetable: weekdayTables.line111Outbound,
    leg2Timetable: weekdayTables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 24, 22, 20, 0)
  });
  assertEqual(endOfDayRes.status, 'no_buses_available', 'End of day when Leg 2 is already finished returns no_buses_available cleanly');

  // Case 4.4: 24:15 timeStringToMinutes and minutesToTimeString
  assertEqual(timetableService.timeStringToMinutes('24:15'), 1455, '24:15 converts to 1455 minutes');
  assertEqual(timetableService.minutesToTimeString(1455, true), '00:15', '1455 minutes wraps to 00:15 when wrap24=true');
  assertEqual(timetableService.minutesToTimeString(1455, false), '24:15', '1455 minutes formats to 24:15 when wrap24=false');
  assertEqual(timetableService.minutesToTimeString(-15, true), '23:45', '-15 minutes wraps to 23:45');
}

// ========================================================================
// SECTION 5: Empty, Cancelled & Corrupted Timetable Inputs
// ========================================================================
console.log('\n▶ SECTION 5: Empty, Cancelled & Corrupted Timetables');

{
  // Case 5.1: Empty Leg 1
  const resEmpty1 = transferService.calculateTransferRoute({
    leg1Timetable: [],
    leg2Timetable: weekdayTables.line133Outbound,
    currentTime: new Date(2026, 7, 24, 8, 0, 0)
  });
  assertEqual(resEmpty1.status, 'no_buses_available', 'Empty Leg 1 returns no_buses_available');
  assertEqual(resEmpty1.recommended, null, 'Recommended is null for empty Leg 1');

  // Case 5.2: Empty Leg 2
  const resEmpty2 = transferService.calculateTransferRoute({
    leg1Timetable: weekdayTables.line111Outbound,
    leg2Timetable: [],
    currentTime: new Date(2026, 7, 24, 8, 0, 0)
  });
  assertEqual(resEmpty2.status, 'no_buses_available', 'Empty Leg 2 returns no_buses_available');

  // Case 5.3: All Leg 1 cancelled
  const cancelledLeg1 = weekdayTables.line111Outbound.map(b => ({ ...b, isCancelled: true }));
  const resCancel1 = transferService.calculateTransferRoute({
    leg1Timetable: cancelledLeg1,
    leg2Timetable: weekdayTables.line133Outbound,
    currentTime: new Date(2026, 7, 24, 8, 0, 0)
  });
  assertEqual(resCancel1.status, 'no_buses_available', 'All cancelled Leg 1 returns no_buses_available');

  // Case 5.4: All Leg 2 cancelled
  const cancelledLeg2 = weekdayTables.line133Outbound.map(b => ({ ...b, isCancelled: true }));
  const resCancel2 = transferService.calculateTransferRoute({
    leg1Timetable: weekdayTables.line111Outbound,
    leg2Timetable: cancelledLeg2,
    currentTime: new Date(2026, 7, 24, 8, 0, 0)
  });
  assertEqual(resCancel2.status, 'no_buses_available', 'All cancelled Leg 2 returns no_buses_available');

  // Case 5.5: Corrupted / Defensive inputs validation
  const resNullTimetable = transferService.calculateTransferRoute({
    leg1Timetable: null,
    leg2Timetable: undefined,
    currentTime: 'invalid date'
  });
  assertEqual(resNullTimetable.status, 'no_buses_available', 'Null timetable returns no_buses_available gracefully without throwing');

  const resUndefined = transferService.calculateTransferRoute({
    leg1Timetable: undefined,
    leg2Timetable: undefined,
    currentTime: 'invalid date'
  });
  assertEqual(resUndefined.status, 'no_buses_available', 'Undefined timetables return no_buses_available safely');
}

// ========================================================================
// SECTION 6: TimetableService Edge Functions & Countdown Formatting
// ========================================================================
console.log('\n▶ SECTION 6: TimetableService Edge Cases & Formatters');

{
  // Countdown boundaries
  assertEqual(timetableService.formatCountdown(0, -121).text, '発車済み', '-121s is 発車済み');
  assertEqual(timetableService.formatCountdown(0, -121).status, 'past', '-121s status is past');
  assertEqual(timetableService.formatCountdown(0, -60).text, '発車直後', '-60s is 発車直後');
  assertEqual(timetableService.formatCountdown(0, -60).status, 'urgent', '-60s status is urgent');
  assertEqual(timetableService.formatCountdown(0, 0).text, 'まもなく発車', '0s is まもなく発車');
  assertEqual(timetableService.formatCountdown(0, 59).text, 'まもなく発車', '59s is まもなく発車');
  assertEqual(timetableService.formatCountdown(1, 60).text, 'あと 1分', '60s is あと 1分');
  assertEqual(timetableService.formatCountdown(5, 300).text, 'あと 5分', '300s is あと 5分');
  assertEqual(timetableService.formatCountdown(5, 300).status, 'soon', '5 min is status soon');
  assertEqual(timetableService.formatCountdown(6, 360).text, 'あと 6分', '360s is あと 6分');
  assertEqual(timetableService.formatCountdown(6, 360).status, 'normal', '6 min is status normal');
  assertEqual(timetableService.formatCountdown(60, 3600).text, 'あと 1時間', '3600s is あと 1時間');
  assertEqual(timetableService.formatCountdown(75, 4500).text, 'あと 1時間15分', '4500s is あと 1時間15分');

  // getNextDepartures edge cases
  const emptyDeps = timetableService.getNextDepartures([], new Date(), 5);
  assertEqual(emptyDeps.length, 0, 'Empty timetable yields empty departures array');

  const invalidDateDeps = timetableService.getNextDepartures(weekdayTables.line111Outbound, new Date('invalid'), 3);
  assert(invalidDateDeps.length <= 3, 'Invalid date defaults to new Date() and returns departures safely');

  // Realtime delay merging
  const entries = [
    { line: '111系統', departureTime: '08:00', busId: '111-4412' },
    { line: '133系統', departureTime: '08:15', busId: '133-9999' }
  ];
  const liveBuses = [
    { '@id': 'urn:uuid:bus-111-4412', 'odpt:delay': 180 }, // 3 min delay
    { '@id': 'urn:uuid:bus-other', 'odpt:delay': 60 }
  ];
  const merged = timetableService.mergeRealtimeDelays(entries, liveBuses);
  assertEqual(merged[0].delayMinutes, 3, 'Merged busId 111-4412 delay is 3 minutes');
  assertEqual(merged[0].actualDepartureTime, '08:03', 'Merged actualDepartureTime is 08:03');
  assertEqual(merged[1].delayMinutes, 0, 'Unmatched bus has 0 delay');
  assertEqual(merged[1].actualDepartureTime, '08:15', 'Unmatched bus actualDepartureTime is 08:15');
}

// ========================================================================
// SECTION 7: High-Load Stress Generator (1,000 Randomized Scenarios)
// ========================================================================
console.log('\n▶ SECTION 7: High-Load Randomized Stress Generator (1,000 Iterations)');

{
  let stressPassed = 0;
  let stressFailed = 0;
  const stressErrors = [];

  for (let i = 0; i < 1000; i++) {
    // Random hour (5 to 23), minute (0 to 59)
    const hour = Math.floor(Math.random() * 19) + 5;
    const min = Math.floor(Math.random() * 60);
    const date = new Date(2026, 7, 24, hour, min, 0);

    // Random buffer (0 to 30)
    const buffer = Math.floor(Math.random() * 31);

    // Random direction
    const direction = Math.random() > 0.5 ? 'outbound' : 'inbound';

    // Random delays on random buses
    const delays = {};
    if (Math.random() > 0.3) {
      const randomDelay = Math.floor(Math.random() * 40); // 0 to 39 min delay
      delays['111-out-0'] = randomDelay;
      delays['111-out-5'] = randomDelay;
      delays['133-out-2'] = randomDelay;
    }

    try {
      const leg1 = direction === 'outbound' ? weekdayTables.line111Outbound : weekdayTables.line133Inbound;
      const leg2 = direction === 'outbound' ? weekdayTables.line133Outbound : weekdayTables.line111Inbound;

      const res = transferService.calculateTransferRoute({
        leg1Timetable: leg1,
        leg2Timetable: leg2,
        direction,
        bufferMinutes: buffer,
        realtimeDelays: delays,
        currentTime: date
      });

      // INVARIANT 1: Must return status 'ok' or 'no_buses_available'
      if (res.status !== 'ok' && res.status !== 'no_buses_available') {
        throw new Error(`Invalid status: ${res.status}`);
      }

      // INVARIANT 2: If status === 'ok', recommended must be valid object
      if (res.status === 'ok') {
        if (!res.recommended || !res.recommended.leg1 || !res.recommended.leg2) {
          throw new Error('Recommended route missing or incomplete');
        }

        const leg1DepMin = timetableService.timeStringToMinutes(res.recommended.leg1.actualDepartureTime);
        const leg1ArrMin = timetableService.timeStringToMinutes(res.recommended.leg1.estimatedArrivalTime);
        const leg2DepMin = timetableService.timeStringToMinutes(res.recommended.leg2.actualDepartureTime);
        const leg2ArrMin = timetableService.timeStringToMinutes(res.recommended.leg2.estimatedArrivalTime);

        const expLeg1Duration = direction === 'outbound' ? 15 : 12;
        const expLeg2Duration = direction === 'outbound' ? 12 : 15;

        // INVARIANT 3: Leg 1 arrival = actual departure + leg1 duration
        if (leg1ArrMin !== leg1DepMin + expLeg1Duration) {
          throw new Error(`Leg 1 duration invariant failed: arr ${leg1ArrMin} !== dep ${leg1DepMin} + ${expLeg1Duration}`);
        }

        // INVARIANT 4: Leg 2 arrival = actual departure + leg2 duration
        if (leg2ArrMin !== leg2DepMin + expLeg2Duration) {
          throw new Error(`Leg 2 duration invariant failed: arr ${leg2ArrMin} !== dep ${leg2DepMin} + ${expLeg2Duration}`);
        }

        // INVARIANT 5: Leg 2 actual departure >= Leg 1 estimated arrival + buffer
        if (leg2DepMin < leg1ArrMin + buffer) {
          throw new Error(`Transfer buffer invariant failed: Leg2 dep ${leg2DepMin} < Arr1 ${leg1ArrMin} + buffer ${buffer}`);
        }

        // INVARIANT 6: Wait duration = Leg 2 actual departure - Leg 1 estimated arrival
        if (res.recommended.transferWaitMinutes !== leg2DepMin - leg1ArrMin) {
          throw new Error(`Wait duration invariant failed: ${res.recommended.transferWaitMinutes} !== ${leg2DepMin - leg1ArrMin}`);
        }

        // INVARIANT 7: Total duration = Leg 2 arrival - Leg 1 departure
        if (res.recommended.totalDurationMinutes !== leg2ArrMin - leg1DepMin) {
          throw new Error(`Total duration invariant failed: ${res.recommended.totalDurationMinutes} !== ${leg2ArrMin - leg1DepMin}`);
        }
      }

      stressPassed++;
    } catch (err) {
      stressFailed++;
      stressErrors.push(err.message);
    }
  }

  assert(stressFailed === 0, `All 1,000 randomized stress tests passed (Passed: ${stressPassed}, Failed: ${stressFailed})`);
}

// ========================================================================
// SUMMARY & VERDICT
// ========================================================================
console.log('\n========================================================================');
console.log(`STRESS TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('========================================================================');

if (failedTests > 0) {
  console.error('FAILURES:');
  for (const f of failureDetails) {
    console.error(`- ${f}`);
  }
  process.exit(1);
} else {
  console.log('✨ ALL ADVERSARIAL STRESS TESTS AND INVARIANTS PASSED PERFECTLY!');
  process.exit(0);
}
