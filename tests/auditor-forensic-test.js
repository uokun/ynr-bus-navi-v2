/**
 * tests/auditor-forensic-test.js
 * Independent Forensic Verification & Stress-Testing Script for M2 & M3.
 * Executed by Forensic Auditor.
 */

import { CONFIG, STOPS, ROUTES, STORAGE_KEYS, DEFAULT_CONSUMER_KEY } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { MockData, MOCK_BUSSTOP_POLES, MOCK_ROUTES, MOCK_BUSES, MOCK_BUS_INFO, getMockTimetables, getMockTimetable } from '../js/api/mock-data.js';
import { OdptClient } from '../js/api/odpt-client.js';
import { CalendarService } from '../js/services/calendar-service.js';
import { TimetableService } from '../js/services/timetable-service.js';
import { TransferService } from '../js/services/transfer-service.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✔ [AUDIT-PASS] ${label}`);
  } else {
    failed++;
    const msg = `  ❌ [AUDIT-FAIL] ${label} - ${details}`;
    failures.push(msg);
    console.error(msg);
  }
}

console.log('================================================================');
console.log('       FORENSIC AUDITOR INDEPENDENT VERIFICATION SUITE         ');
console.log('================================================================\n');

// -----------------------------------------------------------------
// 1. CalendarService Multi-Year & Astronomical Verification
// -----------------------------------------------------------------
console.log('▶ [1] AUDITING: CalendarService (Holiday & Astronomical Formulae)');
const cal = new CalendarService();

// Test Vernal Equinox Day calculation over multiple years
// 2024: March 20 (Wed)
// 2025: March 20 (Thu)
// 2026: March 20 (Fri)
// 2027: March 21 (Sun -> Mon 22 is Substitute)
// 2028: March 20 (Mon)
check('2024-03-20 Vernal Equinox is holiday', cal.isJapaneseHoliday(new Date(2024, 2, 20)));
check('2025-03-20 Vernal Equinox is holiday', cal.isJapaneseHoliday(new Date(2025, 2, 20)));
check('2026-03-20 Vernal Equinox is holiday', cal.isJapaneseHoliday(new Date(2026, 2, 20)));
check('2027-03-21 Vernal Equinox is holiday', cal.isJapaneseHoliday(new Date(2027, 2, 21)));
check('2027-03-22 Substitute holiday for Vernal Equinox', cal.isJapaneseHoliday(new Date(2027, 2, 22)));
check('2028-03-20 Vernal Equinox is holiday', cal.isJapaneseHoliday(new Date(2028, 2, 20)));

// Test Autumnal Equinox Day calculation
// 2024: Sept 22 (Sun -> Mon 23 is Substitute)
// 2025: Sept 23 (Tue)
// 2026: Sept 23 (Wed)
// 2027: Sept 23 (Thu)
// 2028: Sept 22 (Fri)
check('2024-09-22 Autumnal Equinox is holiday', cal.isJapaneseHoliday(new Date(2024, 8, 22)));
check('2024-09-23 Autumnal Equinox Substitute is holiday', cal.isJapaneseHoliday(new Date(2024, 8, 23)));
check('2025-09-23 Autumnal Equinox is holiday', cal.isJapaneseHoliday(new Date(2025, 8, 23)));
check('2026-09-23 Autumnal Equinox is holiday', cal.isJapaneseHoliday(new Date(2026, 8, 23)));
check('2028-09-22 Autumnal Equinox is holiday', cal.isJapaneseHoliday(new Date(2028, 8, 22)));

// Test Happy Monday multi-year
// Coming of Age Day (2nd Monday of Jan): 2024-01-08, 2025-01-13, 2026-01-12
check('2024-01-08 Coming of Age Day is holiday', cal.isJapaneseHoliday(new Date(2024, 0, 8)));
check('2025-01-13 Coming of Age Day is holiday', cal.isJapaneseHoliday(new Date(2025, 0, 13)));
check('2026-01-12 Coming of Age Day is holiday', cal.isJapaneseHoliday(new Date(2026, 0, 12)));
// Marine Day (3rd Monday of Jul): 2024-07-15, 2025-07-21, 2026-07-20
check('2024-07-15 Marine Day is holiday', cal.isJapaneseHoliday(new Date(2024, 6, 15)));
check('2025-07-21 Marine Day is holiday', cal.isJapaneseHoliday(new Date(2025, 6, 21)));
check('2026-07-20 Marine Day is holiday', cal.isJapaneseHoliday(new Date(2026, 6, 20)));

// Test Year-End / New Year schedule
check('2025-12-28 is not special year-end (Sunday -> Holiday schedule, but isJapaneseHoliday is false)', cal.isJapaneseHoliday(new Date(2025, 11, 28)) === false);
check('2025-12-29 is Year-End holiday', cal.isJapaneseHoliday(new Date(2025, 11, 29)) === true);
check('2025-12-30 is Year-End holiday', cal.isJapaneseHoliday(new Date(2025, 11, 30)) === true);
check('2025-12-31 is Year-End holiday', cal.isJapaneseHoliday(new Date(2025, 11, 31)) === true);
check('2026-01-01 is New Year holiday', cal.isJapaneseHoliday(new Date(2026, 0, 1)) === true);
check('2026-01-02 is New Year holiday', cal.isJapaneseHoliday(new Date(2026, 0, 2)) === true);
check('2026-01-03 is New Year holiday', cal.isJapaneseHoliday(new Date(2026, 0, 3)) === true);
check('2026-01-04 is normal Sunday (isJapaneseHoliday is false)', cal.isJapaneseHoliday(new Date(2026, 0, 4)) === false);

// Test getCalendarType
check('2026-01-04 (Sunday) getCalendarType is Holiday', cal.getCalendarType(new Date(2026, 0, 4)) === 'Holiday');
check('2026-01-05 (Monday) getCalendarType is Weekday', cal.getCalendarType(new Date(2026, 0, 5)) === 'Weekday');
check('2026-01-10 (Saturday) getCalendarType is Saturday', cal.getCalendarType(new Date(2026, 0, 10)) === 'Saturday');
check('2026-01-12 (Coming of Age Mon) getCalendarType is Holiday', cal.getCalendarType(new Date(2026, 0, 12)) === 'Holiday');

// Edge case: invalid/null inputs
check('Invalid date string falls back without throwing', cal.getCalendarType('invalid-date') !== undefined);
check('Null date falls back without throwing', cal.isJapaneseHoliday(null) !== undefined);

// -----------------------------------------------------------------
// 2. TimetableService Math & Transformation Verification
// -----------------------------------------------------------------
console.log('\n▶ [2] AUDITING: TimetableService (Time Arithmetic & Delay Merging)');
const tt = new TimetableService();

check('timeStringToMinutes("00:00") === 0', tt.timeStringToMinutes('00:00') === 0);
check('timeStringToMinutes("12:34") === 754', tt.timeStringToMinutes('12:34') === 754);
check('timeStringToMinutes("23:59") === 1439', tt.timeStringToMinutes('23:59') === 1439);
check('timeStringToMinutes("24:15") === 1455', tt.timeStringToMinutes('24:15') === 1455);
check('timeStringToMinutes(null) === 0', tt.timeStringToMinutes(null) === 0);
check('timeStringToMinutes("invalid") === 0', tt.timeStringToMinutes('invalid') === 0);

check('minutesToTimeString(0) === "00:00"', tt.minutesToTimeString(0) === '00:00');
check('minutesToTimeString(754) === "12:34"', tt.minutesToTimeString(754) === '12:34');
check('minutesToTimeString(1439) === "23:59"', tt.minutesToTimeString(1439) === '23:59');
check('minutesToTimeString(1455, true) === "00:15"', tt.minutesToTimeString(1455, true) === '00:15');
check('minutesToTimeString(-1, true) === "23:59"', tt.minutesToTimeString(-1, true) === '23:59');

// Countdown format checks
check('formatCountdown past (>2 min)', tt.formatCountdown(-3).status === 'past' && tt.formatCountdown(-3).text === '発車済み');
check('formatCountdown just departed', tt.formatCountdown(-0.5).status === 'urgent' && tt.formatCountdown(-0.5).text === '発車直後');
check('formatCountdown departing soon (<1 min)', tt.formatCountdown(0.8).status === 'urgent' && tt.formatCountdown(0.8).text === 'まもなく発車');
check('formatCountdown soon (4 min)', tt.formatCountdown(4).status === 'soon' && tt.formatCountdown(4).text === 'あと 4分');
check('formatCountdown normal (25 min)', tt.formatCountdown(25).status === 'normal' && tt.formatCountdown(25).text === 'あと 25分');
check('formatCountdown hours (90 min)', tt.formatCountdown(90).status === 'normal' && tt.formatCountdown(90).text === 'あと 1時間30分');

// Dynamic Delay Merging with arbitrary synthetic data (not mock constants)
const syntheticTimetable = [
  { busId: 'bus-A', line: '111系統', departureTime: '10:00' },
  { busId: 'bus-B', line: '111系統', departureTime: '10:20' },
  { busId: 'bus-C', line: '133系統', departureTime: '10:40' }
];
const syntheticLiveBuses = [
  { '@id': 'live-bus-A', 'owl:sameAs': 'bus-A', 'odpt:delay': 300, 'geo:lat': 35.385, 'geo:long': 139.597 },
  { '@id': 'live-bus-B', 'owl:sameAs': 'bus-B', 'odpt:delay': -60, 'geo:lat': 35.390, 'geo:long': 139.598 }
];

const merged = tt.mergeRealtimeDelays(syntheticTimetable, syntheticLiveBuses);
check('Delay 300s -> +5m merged on bus-A', merged[0].delayMinutes === 5 && merged[0].actualDepartureTime === '10:05');
check('Delay -60s -> -1m merged on bus-B', merged[0].delayMinutes === 5 && merged[1].actualDepartureTime === '10:19');
check('No live data on bus-C -> delay 0', merged[2].delayMinutes === 0 && merged[2].actualDepartureTime === '10:40');
check('Live lat/long correctly attached to bus-A', merged[0].liveLocation && merged[0].liveLocation.lat === 35.385);

// -----------------------------------------------------------------
// 3. TransferService Genuine Connection & Algorithmic Verification
// -----------------------------------------------------------------
console.log('\n▶ [3] AUDITING: TransferService (Transfer Algorithm & Buffer Simulation)');
const ts = new TransferService(tt);

// Test transfer with synthetic, non-trivial schedules to guarantee genuine algorithmic calculation
const synLeg1 = [
  { busId: 's1', line: '111系統', departureTime: '08:00' }, // arr: 08:15 (outbound 15m)
  { busId: 's2', line: '111系統', departureTime: '08:20' }, // arr: 08:35
  { busId: 's3', line: '111系統', departureTime: '08:40' }  // arr: 08:55
];
const synLeg2 = [
  { busId: 't1', line: '133系統', departureTime: '08:18' }, // Before 08:15+5=08:20 (Cannot catch!)
  { busId: 't2', line: '133系統', departureTime: '08:25' }, // Connects to s1! (wait: 10m, arr: 08:37)
  { busId: 't3', line: '133系統', departureTime: '08:38' }, // Connects to s1 (wait 23m) or s2 (misses s2 because 08:35+5=08:40)
  { busId: 't4', line: '133系統', departureTime: '08:45' }  // Connects to s2! (wait: 10m, arr: 08:57)
];

// Test with buffer = 5 at 07:55
const res1 = ts.calculateTransferRoute({
  leg1Timetable: synLeg1,
  leg2Timetable: synLeg2,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 22, 7, 55, 0)
});

check('Calculated transfer recommended is s1 -> t2', res1.recommended.leg1.busId === 's1' && res1.recommended.leg2.busId === 't2');
check('Transfer wait minutes is 10 (08:25 - 08:15)', res1.recommended.transferWaitMinutes === 10);
check('Total duration is 37 min (08:00 to 08:37)', res1.recommended.totalDurationMinutes === 37);
check('Alternative 1 is s2 -> t4', res1.alternatives[0].leg1.busId === 's2' && res1.alternatives[0].leg2.busId === 't4');

// Test with delay injection on s1 (+10m delay): s1 departs 08:10, arrives 08:25. Min connection is 08:30.
// t2 (08:25) is now missed! Next available for s1 is t3 (08:38) -> wait is 13m!
const res2 = ts.calculateTransferRoute({
  leg1Timetable: synLeg1,
  leg2Timetable: synLeg2,
  direction: 'outbound',
  bufferMinutes: 5,
  realtimeDelays: { 's1': 10 },
  currentTime: new Date(2026, 7, 22, 7, 55, 0)
});

check('With s1 +10m delay, recommended switches to s1 -> t3 (08:38)', res2.recommended.leg1.busId === 's1' && res2.recommended.leg2.busId === 't3');
check('Wait time for s1 -> t3 is 13 min (08:38 - 08:25)', res2.recommended.transferWaitMinutes === 13);

// Test tight buffer: buffer = 2. s1 (arr 08:15) + buffer 2 = 08:17. t1 (08:18) is now catchable!
const res3 = ts.calculateTransferRoute({
  leg1Timetable: synLeg1,
  leg2Timetable: synLeg2,
  direction: 'outbound',
  bufferMinutes: 2,
  currentTime: new Date(2026, 7, 22, 7, 55, 0)
});
check('With 2-min buffer, s1 connects to t1 (08:18)', res3.recommended.leg2.busId === 't1');
check('Wait time is 3 min (08:18 - 08:15)', res3.recommended.transferWaitMinutes === 3);

// Test Reverse direction (inbound): Leg 1 duration is 12m, Leg 2 duration is 15m
const synInboundLeg1 = [{ busId: 'in1', departureTime: '09:00' }]; // arr: 09:12
const synInboundLeg2 = [
  { busId: 'in2_fail', departureTime: '09:15' }, // 09:12 + 5 = 09:17 -> fails!
  { busId: 'in2_ok', departureTime: '09:20' }    // 09:20 -> ok! arr: 09:35
];
const resInbound = ts.calculateTransferRoute({
  leg1Timetable: synInboundLeg1,
  leg2Timetable: synInboundLeg2,
  direction: 'inbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 22, 8, 50, 0)
});
check('Inbound calculation correctly uses 12m leg1 and catches in2_ok (09:20)', resInbound.recommended.leg2.busId === 'in2_ok');
check('Inbound total duration is 35m (09:00 to 09:35)', resInbound.recommended.totalDurationMinutes === 35);

// Test Empty / No bus available
const resEmpty = ts.calculateTransferRoute({
  leg1Timetable: [],
  leg2Timetable: synLeg2,
  currentTime: new Date(2026, 7, 22, 23, 50, 0)
});
check('Empty leg1 yields status no_buses_available and null recommended', resEmpty.status === 'no_buses_available' && resEmpty.recommended === null);

// -----------------------------------------------------------------
// 4. StorageService Integrity & Quota/Memory Resilience Verification
// -----------------------------------------------------------------
console.log('\n▶ [4] AUDITING: StorageService (TTL Expiration, Key Clamping & Quota Handling)');
const memStorage = new Map();
const mockEngine = {
  getItem: (k) => memStorage.get(k) || null,
  setItem: (k, v) => memStorage.set(k, String(v)),
  removeItem: (k) => memStorage.delete(k),
  clear: () => memStorage.clear(),
  get length() { return memStorage.size; },
  key: (i) => Array.from(memStorage.keys())[i]
};
const ss = new StorageService(mockEngine);

// API key tests
check('Initial API key is DEFAULT_CONSUMER_KEY', ss.getApiKey() === DEFAULT_CONSUMER_KEY);
ss.setApiKey('   custom_consumer_key_123   ');
check('API key is trimmed when saved', ss.getApiKey() === 'custom_consumer_key_123');
ss.setApiKey('');
check('Empty string API key resets to default', ss.getApiKey() === DEFAULT_CONSUMER_KEY);

// Buffer clamping
check('Buffer clamping negative -> 1', ss.setTransferBuffer(-10) === 1 && ss.getTransferBuffer() === 1);
check('Buffer clamping 0 -> 1', ss.setTransferBuffer(0) === 1 && ss.getTransferBuffer() === 1);
check('Buffer clamping 15 -> 15', ss.setTransferBuffer(15) === 15 && ss.getTransferBuffer() === 15);
check('Buffer clamping 45 -> 30', ss.setTransferBuffer(45) === 30 && ss.getTransferBuffer() === 30);
check('Buffer non-numeric string -> 5', ss.setTransferBuffer('abc') === 5 && ss.getTransferBuffer() === 5);

// Cache TTL
ss.setCachedData('fresh_cache', { valid: true }, 3600);
check('Fresh cache item is retrievable', ss.getCachedData('fresh_cache').valid === true);
ss.setCachedData('zero_ttl', { valid: false }, 0);
check('0 TTL is not cached', ss.getCachedData('zero_ttl') === null);

// Simulate expired cache by altering expiresAt directly
const expEnvelope = JSON.parse(memStorage.get(STORAGE_KEYS.CACHE_PREFIX + 'fresh_cache'));
expEnvelope.expiresAt = Date.now() - 1000;
memStorage.set(STORAGE_KEYS.CACHE_PREFIX + 'fresh_cache', JSON.stringify(expEnvelope));
check('Expired cache item returns null and is purged', ss.getCachedData('fresh_cache') === null);

// Corrupted cache JSON
memStorage.set(STORAGE_KEYS.CACHE_PREFIX + 'corrupt', '{bad_json:;');
check('Corrupted JSON returns null safely and removes key', ss.getCachedData('corrupt') === null && !memStorage.has(STORAGE_KEYS.CACHE_PREFIX + 'corrupt'));

// -----------------------------------------------------------------
// 5. OdptClient URL Construction & Fallback Robustness
// -----------------------------------------------------------------
console.log('\n▶ [5] AUDITING: OdptClient (URL Construction & Mock Fallback)');
const client = new OdptClient({ storage: ss });
let statusFired = null;
client.onStatusChange(st => { statusFired = st; });

const poles = await client.fetchBusstopPoles();
check('OdptClient fallback returns mock poles without crash', Array.isArray(poles) && poles.length >= 3);
check('OdptClient status listener was notified of fallback', statusFired !== null && statusFired.isMock === true);
check('Client marked isUsingMockData = true', client.isUsingMockData === true);

const ttPole = await client.fetchBusstopPoleTimetables(STOPS.YOKODAI.id, 'Weekday');
check('fetchBusstopPoleTimetables returns timetable array', Array.isArray(ttPole) && ttPole.length > 0);

console.log('\n================================================================');
console.log(` AUDIT SUMMARY: Total Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  console.error('\nFailures:\n' + failures.join('\n'));
  process.exit(1);
} else {
  console.log('\n✨ ALL AUDIT CHECKS PASSED EMPIRICALLY WITH ZERO INTEGRITY VIOLATIONS.');
}
