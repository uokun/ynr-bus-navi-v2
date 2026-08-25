/**
 * adversarial-m2-m3-challenger.js
 * Adversarial stress testing & deep integrity verification for Milestones 2 & 3.
 */

import { CONFIG, STOPS, ROUTES, CACHE_TTL } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { MockData, getMockTimetable, getMockTimetables } from '../js/api/mock-data.js';
import { OdptClient } from '../js/api/odpt-client.js';
import { CalendarService } from '../js/services/calendar-service.js';
import { TimetableService } from '../js/services/timetable-service.js';
import { TransferService } from '../js/services/transfer-service.js';

console.log('===============================================================');
console.log('🚀 RUNNING ADVERSARIAL CHALLENGER & INTEGRITY SUITE (M2 & M3)  ');
console.log('===============================================================\n');

let pass = 0;
let fail = 0;
const failures = [];

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${name}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
    fail++;
    failures.push({ name, details });
  }
}

// =========================================================================
// SECTION 1: CALENDAR & HOLIDAY ADVERSARIAL STRESS TEST
// =========================================================================
console.log('--- 1. CalendarService Adversarial & Equinox Tests ---');
const cal = new CalendarService();

// 1.1 Fixed Holidays in 2026
assert(cal.isJapaneseHoliday(new Date('2026-01-01T12:00:00')), '2026-01-01 元日');
assert(cal.isJapaneseHoliday(new Date('2026-02-11T12:00:00')), '2026-02-11 建国記念の日');
assert(cal.isJapaneseHoliday(new Date('2026-02-23T12:00:00')), '2026-02-23 天皇誕生日');
assert(cal.isJapaneseHoliday(new Date('2026-04-29T12:00:00')), '2026-04-29 昭和の日');
assert(cal.isJapaneseHoliday(new Date('2026-05-03T12:00:00')), '2026-05-03 憲法記念日');
assert(cal.isJapaneseHoliday(new Date('2026-05-04T12:00:00')), '2026-05-04 みどりの日');
assert(cal.isJapaneseHoliday(new Date('2026-05-05T12:00:00')), '2026-05-05 こどもの日');
assert(cal.isJapaneseHoliday(new Date('2026-08-11T12:00:00')), '2026-08-11 山の日');
assert(cal.isJapaneseHoliday(new Date('2026-11-03T12:00:00')), '2026-11-03 文化の日');
assert(cal.isJapaneseHoliday(new Date('2026-11-23T12:00:00')), '2026-11-23 勤労感謝の日');

// 1.2 Happy Monday in 2026
// 成人の日 (Jan 2nd Mon): 2026-01-12
assert(cal.isJapaneseHoliday(new Date('2026-01-12T12:00:00')), '2026-01-12 成人の日');
// 海の日 (Jul 3rd Mon): 2026-07-20
assert(cal.isJapaneseHoliday(new Date('2026-07-20T12:00:00')), '2026-07-20 海の日');
// 敬老の日 (Sep 3rd Mon): 2026-09-21
assert(cal.isJapaneseHoliday(new Date('2026-09-21T12:00:00')), '2026-09-21 敬老の日');
// スポーツの日 (Oct 2nd Mon): 2026-10-12
assert(cal.isJapaneseHoliday(new Date('2026-10-12T12:00:00')), '2026-10-12 スポーツの日');

// 1.3 Equinox calculation in 2026
// 春分の日 2026: 2026-03-20
assert(cal.isJapaneseHoliday(new Date('2026-03-20T12:00:00')), '2026-03-20 春分の日');
// 秋分の日 2026: 2026-09-23
assert(cal.isJapaneseHoliday(new Date('2026-09-23T12:00:00')), '2026-09-23 秋分の日');

// 1.4 Citizen's Holiday (国民の休日): 2026-09-22 (Tuesday between Sep 21 and Sep 23)
assert(cal.isJapaneseHoliday(new Date('2026-09-22T12:00:00')), '2026-09-22 国民の休日 (Silver Week)');

// 1.5 Golden Week Substitute Holiday: 2026-05-06 (May 3 is Sunday -> May 6 is holiday)
assert(cal.isJapaneseHoliday(new Date('2026-05-06T12:00:00')), '2026-05-06 振替休日 (GW May 6)');

// 1.6 Year-End / New Year Special Municipal Schedule
assert(cal.isJapaneseHoliday(new Date('2026-12-29T12:00:00')), '2026-12-29 年末年始ダイヤ');
assert(cal.isJapaneseHoliday(new Date('2026-12-30T12:00:00')), '2026-12-30 年末年始ダイヤ');
assert(cal.isJapaneseHoliday(new Date('2026-12-31T12:00:00')), '2026-12-31 年末年始ダイヤ');
assert(cal.isJapaneseHoliday(new Date('2026-01-02T12:00:00')), '2026-01-02 年末年始ダイヤ');
assert(cal.isJapaneseHoliday(new Date('2026-01-03T12:00:00')), '2026-01-03 年末年始ダイヤ');
assert(!cal.isJapaneseHoliday(new Date('2026-12-28T12:00:00')), '2026-12-28 is NOT Holiday (Monday)');

// 1.7 Timetable schedule type determination
assert(cal.getCalendarType(new Date('2026-08-22T12:00:00')) === 'Saturday', '2026-08-22 is Saturday schedule');
assert(cal.getCalendarType(new Date('2026-08-23T12:00:00')) === 'Holiday', '2026-08-23 is Sunday -> Holiday schedule');
assert(cal.getCalendarType(new Date('2026-08-24T12:00:00')) === 'Weekday', '2026-08-24 is Monday -> Weekday schedule');
assert(cal.getCalendarType(new Date('2026-09-22T12:00:00')) === 'Holiday', '2026-09-22 is Citizen Holiday -> Holiday schedule');
assert(cal.getCalendarType(null) !== undefined, 'getCalendarType handles null safely');
assert(cal.getCalendarType(new Date('invalid')) !== undefined, 'getCalendarType handles invalid Date safely');

// =========================================================================
// SECTION 2: STORAGE SERVICE & CACHE INTEGRITY TEST
// =========================================================================
console.log('\n--- 2. StorageService Multi-Tier Cache & Boundary Tests ---');
const storage = new StorageService();

// 2.1 Settings boundaries
assert(storage.setTransferBuffer(-5) === 1, 'Transfer buffer clamped to min 1 on negative input');
assert(storage.setTransferBuffer(50) === 30, 'Transfer buffer clamped to max 30 on >30 input');
assert(storage.setTransferBuffer('abc') === 5, 'Transfer buffer defaults to 5 on NaN input');
assert(storage.setTransferBuffer(7) === 7, 'Transfer buffer sets valid 7');
assert(storage.getTransferBuffer() === 7, 'Transfer buffer retrieved as 7');

assert(storage.setAutoRefreshInterval(-1) === 0, 'Auto refresh clamped to min 0');
assert(storage.setAutoRefreshInterval(300) === 120, 'Auto refresh clamped to max 120');
assert(storage.setAutoRefreshInterval(45) === 45, 'Auto refresh sets 45s');
assert(storage.getAutoRefreshInterval() === 45, 'Auto refresh retrieved as 45s');

assert(storage.setTheme('invalid') === 'system', 'Invalid theme falls back to system');
assert(storage.setTheme('dark') === 'dark', 'Dark theme saved');
assert(storage.getTheme() === 'dark', 'Dark theme retrieved');

// 2.2 Cache TTL & Expired Eviction
storage.setCachedData('test_valid', { message: 'hello' }, 3600);
assert(storage.getCachedData('test_valid')?.message === 'hello', 'Active cache entry retrieved');

// Expired test (negative TTL) - should not be saved or should be evicted immediately
storage.setCachedData('test_realtime', { live: 123 }, 0);
assert(storage.getCachedData('test_realtime') === null, '0 TTL (realtime) is not stored in cache');

// Test clearCache preserves settings
storage.setApiKey('test_user_key_123');
storage.clearCache();
assert(storage.getApiKey() === 'test_user_key_123', 'clearCache preserves user API key');
assert(storage.getTransferBuffer() === 7, 'clearCache preserves transfer buffer');
assert(storage.getCachedData('test_valid') === null, 'clearCache removed cache items');

// 2.3 Simulated QuotaExceededError in Mock Storage
let quotaExceededTriggered = false;
let purgedKeys = [];
const mockQuotaStorage = {
  _store: new Map(),
  get length() { return this._store.size; },
  key(i) { return Array.from(this._store.keys())[i]; },
  getItem(k) { return this._store.get(k) || null; },
  setItem(k, v) {
    if (k.includes('big_item') && !quotaExceededTriggered) {
      quotaExceededTriggered = true;
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this._store.set(k, v);
  },
  removeItem(k) {
    purgedKeys.push(k);
    this._store.delete(k);
  }
};
mockQuotaStorage.setItem('transporter_cache_old1', JSON.stringify({ cachedAt: 1, expiresAt: 2, data: 'old1' }));
mockQuotaStorage.setItem('transporter_api_key', 'my_saved_key');

const quotaStorageService = new StorageService(mockQuotaStorage);
quotaStorageService.setCachedData('big_item', { data: 'test' }, 3600);
assert(quotaExceededTriggered, 'QuotaExceededError caught and recovered automatically');
assert(purgedKeys.includes('transporter_cache_old1'), 'Old cache items purged on quota error');

// =========================================================================
// SECTION 3: MOCK DATA & ODPT CLIENT INTEGRITY TEST
// =========================================================================
console.log('\n--- 3. Mock Data & ODPT Client Fallback Tests ---');
const client = new OdptClient({ storage });

// 3.1 Verify Mock Data Schema
assert(Array.isArray(MockData.MOCK_BUSSTOP_POLES) && MockData.MOCK_BUSSTOP_POLES.length >= 3, 'Mock busstop poles exist');
assert(Array.isArray(MockData.MOCK_ROUTES) && MockData.MOCK_ROUTES.length >= 3, 'Mock routes exist');
assert(Array.isArray(MockData.MOCK_BUSES) && MockData.MOCK_BUSES.length >= 2, 'Mock realtime buses exist');
assert(Array.isArray(MockData.MOCK_BUS_INFO) && MockData.MOCK_BUS_INFO.length >= 1, 'Mock bus info exists');

// 3.2 Full Timetable Coverage for all schedules
for (const calType of ['Weekday', 'Saturday', 'Holiday']) {
  const tables = getMockTimetables(calType);
  assert(tables.line111Outbound.length >= 25, `Line 111 Outbound ${calType} has ${tables.line111Outbound.length} departures`);
  assert(tables.line133Outbound.length >= 20, `Line 133 Outbound ${calType} has ${tables.line133Outbound.length} departures`);
  assert(tables.line64Outbound.length >= 10, `Line 64 Outbound ${calType} has ${tables.line64Outbound.length} departures`);
  assert(tables.line133Inbound.length >= 20, `Line 133 Inbound ${calType} has ${tables.line133Inbound.length} departures`);
  assert(tables.line111Inbound.length >= 25, `Line 111 Inbound ${calType} has ${tables.line111Inbound.length} departures`);
}

// 3.3 OdptClient Fallback on Network / HTTP Error
let statusEvents = [];
client.onStatusChange(s => statusEvents.push(s));

// Test client fallback execution
const poles = await client.fetchBusstopPoles();
assert(Array.isArray(poles) && poles.length >= 3, 'fetchBusstopPoles succeeds via fallback');
assert(client.isUsingMockData === true, 'OdptClient marks isUsingMockData = true on 403 fallback');
assert(statusEvents.length > 0 && statusEvents[statusEvents.length - 1].isMock === true, 'Status listener notified of fallback');

const liveBuses = await client.fetchRealtimeBuses();
assert(Array.isArray(liveBuses) && liveBuses.length >= 2, 'fetchRealtimeBuses returns mock live buses on fallback');

const busInfo = await client.fetchBusInformation();
assert(Array.isArray(busInfo) && busInfo.length >= 1, 'fetchBusInformation returns bus status');

// =========================================================================
// SECTION 4: TIMETABLE SERVICE MATHEMATICS & PARSING TEST
// =========================================================================
console.log('\n--- 4. TimetableService Mathematics & Delay Merging Tests ---');
const ttService = new TimetableService();

// 4.1 Time conversion
assert(ttService.timeStringToMinutes('00:00') === 0, '00:00 is 0 min');
assert(ttService.timeStringToMinutes('06:15') === 375, '06:15 is 375 min');
assert(ttService.timeStringToMinutes('23:45') === 1425, '23:45 is 1425 min');
assert(ttService.timeStringToMinutes('invalid') === 0, 'invalid time string safely returns 0');

assert(ttService.minutesToTimeString(0) === '00:00', '0 min is 00:00');
assert(ttService.minutesToTimeString(375) === '06:15', '375 min is 06:15');
assert(ttService.minutesToTimeString(1425) === '23:45', '1425 min is 23:45');
assert(ttService.minutesToTimeString(1440) === '00:00', '1440 min wraps to 00:00');
assert(ttService.minutesToTimeString(-15) === '23:45', '-15 min wraps to 23:45');

// 4.2 Countdown Formatting
assert(ttService.formatCountdown(0, -150).text === '発車済み', '-150s is 発車済み');
assert(ttService.formatCountdown(0, -30).text === '発車直後', '-30s is 発車直後');
assert(ttService.formatCountdown(0, 30).text === 'まもなく発車', '30s is まもなく発車');
assert(ttService.formatCountdown(3, 180).text === 'あと 3分', '180s is あと 3分');
assert(ttService.formatCountdown(25, 1500).text === 'あと 25分', '1500s is あと 25分');
assert(ttService.formatCountdown(75, 4500).text === 'あと 1時間15分', '4500s is あと 1時間15分');

// 4.3 Filtering
const sampleTimetable = getMockTimetable(STOPS.KAMIOOKA.id, 'outbound', 'Weekday');
const filtered133 = ttService.filterTimetable(sampleTimetable, { route: '133' });
assert(filtered133.every(b => b.line.includes('133')), 'Filtered by route 133');

const filteredTime = ttService.filterTimetable(sampleTimetable, { timeFrom: '10:00' });
assert(filteredTime.every(b => ttService.timeStringToMinutes(b.departureTime) >= 600), 'Filtered from 10:00');

// 4.4 Realtime Delay Merge
const unmerged = [
  { busId: '111-out-0', line: '111系統', departureTime: '07:05', delayMinutes: 0 },
  { busId: '133-out-0', line: '133系統', departureTime: '07:15', delayMinutes: 0 }
];
const mockLive = [
  { 'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4412', 'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111', 'odpt:delay': 180 } // 3 min delay
];
const merged = ttService.mergeRealtimeDelays(unmerged, mockLive);
assert(merged[0].delayMinutes === 3, 'Delay merged correctly (180s -> 3 min)');
assert(merged[0].actualDepartureTime === '07:08', 'Actual departure shifted from 07:05 to 07:08');

// =========================================================================
// SECTION 5: TRANSFER CALCULATION ENGINE MATHEMATICAL MODEL TEST
// =========================================================================
console.log('\n--- 5. TransferService Mathematical Model & Adversarial Edge Cases ---');
const transfer = new TransferService(ttService);

// 5.1 Standard Outbound Transfer Test (Weekday 07:30)
const leg1Out = getMockTimetable(STOPS.YOKODAI.id, 'outbound', 'Weekday');
const leg2Out = getMockTimetable(STOPS.KAMIOOKA.id, 'outbound', 'Weekday');

const resOut = transfer.calculateTransferRoute({
  leg1Timetable: leg1Out,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date('2026-08-24T07:30:00') // Monday 07:30 (Weekday)
});

assert(resOut.status === 'ok', 'Transfer calculation status is ok');
assert(resOut.recommended !== null, 'Recommended transfer found');

// Mathematical verification of recommended connection:
// Leg 1: 07:42発 (dep1 = 462 min)
// Leg 1 travel time: 15 min -> Arr1 = 462 + 15 = 477 min (07:57)
// Min connecting time: Arr1 + 5 = 482 min (08:02)
// Leg 2: 08:05発 (dep2 = 485 min >= 482 min)
// Wait time: 485 - 477 = 8 min
const rec = resOut.recommended;
const dep1Min = ttService.timeStringToMinutes(rec.leg1.actualDepartureTime);
const arr1Min = ttService.timeStringToMinutes(rec.leg1.estimatedArrivalTime);
const dep2Min = ttService.timeStringToMinutes(rec.leg2.actualDepartureTime);
const arr2Min = ttService.timeStringToMinutes(rec.leg2.estimatedArrivalTime);

assert(arr1Min - dep1Min === 15, `Leg 1 travel time is 15 min (${dep1Min} -> ${arr1Min})`);
assert(dep2Min >= arr1Min + 5, `Transfer condition met: dep2 (${dep2Min}) >= arr1 (${arr1Min}) + buffer (5)`);
assert(rec.transferWaitMinutes === dep2Min - arr1Min, `Wait time matches formula (${rec.transferWaitMinutes} === ${dep2Min - arr1Min})`);
assert(arr2Min - dep2Min === 12, `Leg 2 travel time is 12 min (${dep2Min} -> ${arr2Min})`);
assert(rec.totalDurationMinutes === arr2Min - dep1Min, `Total duration matches (${rec.totalDurationMinutes} === ${arr2Min - dep1Min})`);

// 5.2 Verify all alternatives adhere to the mathematical rule
assert(resOut.alternatives.length >= 2, `At least 2 alternative options returned (got ${resOut.alternatives.length})`);
for (let i = 0; i < resOut.alternatives.length; i++) {
  const alt = resOut.alternatives[i];
  const aDep1 = ttService.timeStringToMinutes(alt.leg1.actualDepartureTime);
  const aArr1 = ttService.timeStringToMinutes(alt.leg1.estimatedArrivalTime);
  const aDep2 = ttService.timeStringToMinutes(alt.leg2.actualDepartureTime);
  assert(aDep2 >= aArr1 + 5, `Alternative #${i + 1} satisfies connection rule: aDep2(${aDep2}) >= aArr1(${aArr1}) + 5`);
}

// 5.3 Live Delay Missed-Connection Stress Test
// If Leg 1 (07:30 bus) has a +10 min delay, does it automatically jump to a later Leg 2 bus?
const resDelayed = transfer.calculateTransferRoute({
  leg1Timetable: leg1Out,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 5,
  realtimeDelays: {
    '111-out-5': 10 // 07:30 bus delayed by 10 min -> dep 07:40, arr 07:55. Min connecting time = 08:00.
  },
  currentTime: new Date('2026-08-24T07:30:00')
});

const recDelayed = resDelayed.recommended;
const dDep1 = ttService.timeStringToMinutes(recDelayed.leg1.actualDepartureTime);
const dArr1 = ttService.timeStringToMinutes(recDelayed.leg1.estimatedArrivalTime);
const dDep2 = ttService.timeStringToMinutes(recDelayed.leg2.actualDepartureTime);
assert(dArr1 === 450 + 10 + 15, `Delayed arrival is 07:55 (475 min)`);
assert(dDep2 >= dArr1 + 5, `Delayed connection jumped to suitable bus: dep2(${dDep2}) >= 480 (08:00)`);
assert(recDelayed.leg2.departureTime === '08:05', `Selected 08:05 bus instead of missed 07:50 bus`);

// 5.4 End of Service Boundary Test (Late night 23:45)
const resLateNight = transfer.calculateTransferRoute({
  leg1Timetable: leg1Out,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date('2026-08-24T23:45:00')
});

assert(resLateNight.status === 'no_buses_available', 'End of night returns status: no_buses_available');
assert(resLateNight.recommended === null, 'No recommended bus at midnight');
assert(resLateNight.alternatives.length === 0, 'No alternative buses at midnight');

// 5.5 Inbound Transfer Test (Koizumi -> Kamiooka -> Yokodai)
const leg1In = getMockTimetable(STOPS.KOIZUMI.id, 'inbound', 'Weekday');
const leg2In = getMockTimetable(STOPS.KAMIOOKA.id, 'inbound', 'Weekday');

const resIn = transfer.calculateTransferRoute({
  leg1Timetable: leg1In,
  leg2Timetable: leg2In,
  direction: 'inbound',
  bufferMinutes: 5,
  currentTime: new Date('2026-08-24T08:00:00')
});

assert(resIn.status === 'ok', 'Inbound transfer calculation status is ok');
assert(resIn.recommended !== null, 'Inbound recommended transfer found');
const recIn = resIn.recommended;
const inDep1 = ttService.timeStringToMinutes(recIn.leg1.actualDepartureTime);
const inArr1 = ttService.timeStringToMinutes(recIn.leg1.estimatedArrivalTime);
const inDep2 = ttService.timeStringToMinutes(recIn.leg2.actualDepartureTime);
assert(inArr1 - inDep1 === 12, `Inbound Leg 1 travel time is 12 min`);
assert(inDep2 >= inArr1 + 5, `Inbound transfer satisfies dep2 >= arr1 + 5`);

// 5.6 Edge Cases & Boundary Values in TransferService
// Empty timetables
assert(transfer.calculateTransferRoute({ leg1Timetable: [], leg2Timetable: [] }).status === 'no_buses_available', 'Empty timetables return no_buses_available');
assert(transfer.calculateTransferRoute().status === 'no_buses_available', 'No arguments call returns no_buses_available');

// Cancelled bus exclusion
const cancelledLeg1 = [
  { busId: '111-out-c1', line: '111系統', departureTime: '08:00', isCancelled: true },
  { busId: '111-out-ok', line: '111系統', departureTime: '08:15', isCancelled: false }
];
const resCancelled = transfer.calculateTransferRoute({
  leg1Timetable: cancelledLeg1,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date('2026-08-24T07:50:00')
});
assert(resCancelled.recommended.leg1.busId === '111-out-ok', 'Cancelled bus in Leg 1 was skipped');

// Buffer = 0 (Tight immediate transfer)
const resZeroBuffer = transfer.calculateTransferRoute({
  leg1Timetable: leg1Out,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 0,
  currentTime: new Date('2026-08-24T07:30:00')
});
assert(resZeroBuffer.status === 'ok' && resZeroBuffer.recommended.bufferMinutes === 0, 'Buffer=0 calculated successfully');

// Buffer = 30 (Long leisurely buffer)
const resLargeBuffer = transfer.calculateTransferRoute({
  leg1Timetable: leg1Out,
  leg2Timetable: leg2Out,
  direction: 'outbound',
  bufferMinutes: 30,
  currentTime: new Date('2026-08-24T07:30:00')
});
const b30Rec = resLargeBuffer.recommended;
const b30Arr1 = ttService.timeStringToMinutes(b30Rec.leg1.estimatedArrivalTime);
const b30Dep2 = ttService.timeStringToMinutes(b30Rec.leg2.actualDepartureTime);
assert(b30Dep2 >= b30Arr1 + 30, `Buffer=30 satisfies dep2(${b30Dep2}) >= arr1(${b30Arr1}) + 30`);

// Multi-year equinox astronomical check (2024 to 2030)
// 2024 Spring: Mar 20, 2025 Spring: Mar 20, 2026 Spring: Mar 20, 2027 Spring: Mar 21, 2028 Spring: Mar 20
assert(cal.isJapaneseHoliday(new Date('2024-03-20T12:00:00')), '2024-03-20 Vernal Equinox');
assert(cal.isJapaneseHoliday(new Date('2025-03-20T12:00:00')), '2025-03-20 Vernal Equinox');
assert(cal.isJapaneseHoliday(new Date('2027-03-21T12:00:00')), '2027-03-21 Vernal Equinox');
assert(cal.isJapaneseHoliday(new Date('2028-03-20T12:00:00')), '2028-03-20 Vernal Equinox (Leap Year)');

// Extreme time string conversions
assert(ttService.timeStringToMinutes('99:99') === 99 * 60 + 99, '99:99 parsed mathematically');
assert(ttService.minutesToTimeString(NaN) === '00:00', 'NaN minutesToTimeString yields 00:00');
assert(ttService.minutesToTimeString(-2880) === '00:00', '-2880 wraps to 00:00');
assert(ttService.minutesToTimeString(2895) === '00:15', '2895 wraps to 00:15');

// =========================================================================
// SUMMARY & EXIT CODE
// =========================================================================
console.log('\n===============================================================');
console.log(`Adversarial Suite Summary: ${pass} passed, ${fail} failed.`);
console.log('===============================================================');

if (fail > 0) {
  console.error('\nFailures details:');
  for (const f of failures) {
    console.error(`- ${f.name}: ${f.details}`);
  }
  process.exit(1);
} else {
  console.log('\n✨ All adversarial and integrity tests passed with 100% accuracy!');
  process.exit(0);
}
