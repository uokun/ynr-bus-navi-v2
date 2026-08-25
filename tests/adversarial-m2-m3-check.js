/**
 * tests/adversarial-m2-m3-check.js
 * Comprehensive Adversarial & Boundary Verification for Milestones 2 & 3
 */

import { CONFIG, STOPS, ROUTES, STORAGE_KEYS, CACHE_TTL } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { CalendarService } from '../js/services/calendar-service.js';
import { TimetableService } from '../js/services/timetable-service.js';
import { TransferService } from '../js/services/transfer-service.js';
import { OdptClient } from '../js/api/odpt-client.js';
import { MockData, getMockTimetable } from '../js/api/mock-data.js';

console.log('========================================================================');
console.log('🔥 STARTING ADVERSARIAL & BOUNDARY VERIFICATION FOR M2 & M3');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message} - ${detail}`);
    failCount++;
    failures.push({ message, detail });
  }
}

// =========================================================================
// 1. StorageService Adversarial Stress Testing
// =========================================================================
console.log('--- 1. StorageService: Memory Fallback, Quota & Corrupted JSON ---');

// 1.1 In-memory fallback (null storage)
const memStorage = new StorageService(null);
memStorage.setApiKey('test-key-12345');
assert(memStorage.getApiKey() === 'test-key-12345', 'In-memory storage saves and retrieves API key');
memStorage.resetApiKey();
assert(memStorage.getApiKey() === CONFIG.DEFAULT_CONSUMER_KEY, 'In-memory resetApiKey restores default');

// 1.2 Buffer clamping on extreme inputs
assert(memStorage.setTransferBuffer(-999) === 1, 'Negative buffer clamped to 1');
assert(memStorage.setTransferBuffer(0) === 1, 'Zero buffer clamped to 1');
assert(memStorage.setTransferBuffer(1) === 1, 'Buffer 1 accepted');
assert(memStorage.setTransferBuffer(30) === 30, 'Buffer 30 accepted');
assert(memStorage.setTransferBuffer(999) === 30, 'Buffer > 30 clamped to 30');
assert(memStorage.setTransferBuffer('invalid') === 5, 'Non-numeric buffer defaults to 5');
assert(memStorage.setTransferBuffer(null) === 5, 'Null buffer defaults to 5');

// 1.3 Corrupted JSON handling
const mockLocalStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
    _store: store
  };
})();

const jsonCorruptedStorage = new StorageService(mockLocalStorage);
// Inject totally corrupted JSON into cache key
mockLocalStorage.setItem('transporter_cache_corrupted_key', '{ bad json :::: ');
const corruptedResult = jsonCorruptedStorage.getCachedData('corrupted_key');
assert(corruptedResult === null, 'Corrupted JSON returns null without throwing');
assert(mockLocalStorage.getItem('transporter_cache_corrupted_key') === null, 'Corrupted JSON entry is purged from storage');

// Inject non-object JSON into cache key
mockLocalStorage.setItem('transporter_cache_number_key', '12345');
assert(jsonCorruptedStorage.getCachedData('number_key') === null, 'Non-envelope JSON returns null and purges');

// 1.4 TTL Expiration test
const ttlStorage = new StorageService(mockLocalStorage);
ttlStorage.setCachedData('quick_expire', { test: 'value' }, 1); // 1 sec TTL
assert(ttlStorage.getCachedData('quick_expire').test === 'value', 'Cached data valid immediately');

// Manipulate cachedAt to expired time
const rawEnvelope = JSON.parse(mockLocalStorage.getItem('transporter_cache_quick_expire'));
rawEnvelope.expiresAt = Date.now() - 5000; // Expired 5 seconds ago
mockLocalStorage.setItem('transporter_cache_quick_expire', JSON.stringify(rawEnvelope));

assert(ttlStorage.getCachedData('quick_expire') === null, 'Expired cache returns null');
assert(mockLocalStorage.getItem('transporter_cache_quick_expire') === null, 'Expired cache entry is cleaned up');

// 1.5 Zero-TTL should not cache
ttlStorage.setCachedData('zero_ttl', { test: 'no-cache' }, 0);
assert(mockLocalStorage.getItem('transporter_cache_zero_ttl') === null, 'Zero TTL items are not written to storage');

// 1.6 QuotaExceededError Simulation & Auto-Purge
const quotaStorageMock = (() => {
  const store = new Map();
  let failQuota = false;
  return {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => {
      if (failQuota) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
    setFailQuota: (f) => { failQuota = f; },
    _store: store
  };
})();

const quotaService = new StorageService(quotaStorageMock);
quotaService.setCachedData('cache1', 'data1', 3600);
quotaService.setCachedData('cache2', 'data2', 3600);
assert(quotaStorageMock._store.size === 2, 'Initial cache written');

// Trigger quota error on setItem
quotaStorageMock.setFailQuota(true);
// When setItem fails with QuotaExceededError, it calls clearCache() and falls back to memory if still fails
quotaService.setApiKey('saved_in_mem_due_to_quota');
assert(quotaService.getApiKey() === 'saved_in_mem_due_to_quota', 'Memory fallback preserved key during quota error');

console.log('');

// =========================================================================
// 2. CalendarService Edge Cases & Holiday Rules
// =========================================================================
console.log('--- 2. CalendarService: Astronomical Equinox, GW May 6, & Year-End ---');

const cal = new CalendarService();

// 2.1 Fixed Holidays
assert(cal.isJapaneseHoliday(new Date(2026, 0, 1)) === true, '2026-01-01 (元日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 1, 11)) === true, '2026-02-11 (建国記念の日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 1, 23)) === true, '2026-02-23 (天皇誕生日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 3, 29)) === true, '2026-04-29 (昭和の日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 4, 3)) === true, '2026-05-03 (憲法記念日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 4, 4)) === true, '2026-05-04 (みどりの日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 4, 5)) === true, '2026-05-05 (こどもの日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 7, 11)) === true, '2026-08-11 (山の日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 10, 3)) === true, '2026-11-03 (文化の日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 10, 23)) === true, '2026-11-23 (勤労感謝の日) is Holiday');

// 2.2 Golden Week 2026 (May 3 is Sunday -> May 6 is Substitute Holiday)
assert(cal.isJapaneseHoliday(new Date(2026, 4, 6)) === true, '2026-05-06 is Substitute Holiday (May 3 Sunday rule)');
assert(cal.getCalendarType(new Date(2026, 4, 6)) === 'Holiday', '2026-05-06 calendar type is Holiday');

// 2.3 Happy Monday Holidays 2026
assert(cal.isJapaneseHoliday(new Date(2026, 0, 12)) === true, '2026-01-12 (成人の日: 2nd Mon) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 6, 20)) === true, '2026-07-20 (海の日: 3rd Mon) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 8, 21)) === true, '2026-09-21 (敬老の日: 3rd Mon) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 9, 12)) === true, '2026-10-12 (スポーツの日: 2nd Mon) is Holiday');

// 2.4 Astronomical Equinox 2026
assert(cal.isJapaneseHoliday(new Date(2026, 2, 20)) === true, '2026-03-20 (春分の日) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 8, 23)) === true, '2026-09-23 (秋分の日) is Holiday');

// 2.5 Year-End / New Year Special (Dec 29 - Jan 3)
assert(cal.isJapaneseHoliday(new Date(2026, 11, 28)) === false, '2026-12-28 is not holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 11, 29)) === true, '2026-12-29 (Year-End period) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 11, 30)) === true, '2026-12-30 (Year-End period) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 11, 31)) === true, '2026-12-31 (Year-End period) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 0, 2)) === true, '2026-01-02 (New Year period) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 0, 3)) === true, '2026-01-03 (New Year period) is Holiday');
assert(cal.isJapaneseHoliday(new Date(2026, 0, 4)) === false, '2026-01-04 is not holiday');

// 2.6 Day of week categorization
assert(cal.getCalendarType(new Date(2026, 7, 21)) === 'Weekday', '2026-08-21 (Friday) is Weekday');
assert(cal.getCalendarType(new Date(2026, 7, 22)) === 'Saturday', '2026-08-22 (Saturday) is Saturday');
assert(cal.getCalendarType(new Date(2026, 7, 23)) === 'Holiday', '2026-08-23 (Sunday) is Holiday');

// 2.7 Invalid Date input handling
assert(cal.getCalendarType(new Date('invalid')) !== null, 'Invalid Date handles safely without throwing');

console.log('');

// =========================================================================
// 3. TimetableService Boundary, Parsing & Delay Calculations
// =========================================================================
console.log('--- 3. TimetableService: Boundary Cases, Countdown & Delays ---');

const tt = new TimetableService();

// 3.1 Time string conversions
assert(tt.timeStringToMinutes('00:00') === 0, '00:00 is 0 min');
assert(tt.timeStringToMinutes('23:59') === 1439, '23:59 is 1439 min');
assert(tt.timeStringToMinutes('24:15') === 1455, '24:15 is 1455 min');
assert(tt.timeStringToMinutes('') === 0, 'Empty string is 0 min');
assert(tt.timeStringToMinutes(null) === 0, 'Null is 0 min');
assert(tt.timeStringToMinutes('abc:def') === 0, 'Non-numeric time is 0 min');

assert(tt.minutesToTimeString(0) === '00:00', '0 min is 00:00');
assert(tt.minutesToTimeString(1439) === '23:59', '1439 min is 23:59');
assert(tt.minutesToTimeString(1455, true) === '00:15', '1455 min wrapped is 00:15');
assert(tt.minutesToTimeString(1455, false) === '24:15', '1455 min unwrapped is 24:15');
assert(tt.minutesToTimeString(NaN) === '00:00', 'NaN min defaults to 00:00');

// 3.2 Countdown states
assert(tt.formatCountdown(-3, -150).status === 'past', '-150s is past');
assert(tt.formatCountdown(-0.5, -30).status === 'urgent', '-30s is urgent (発車直後)');
assert(tt.formatCountdown(0.5, 30).status === 'urgent', '30s is urgent (まもなく発車)');
assert(tt.formatCountdown(4, 240).status === 'soon', '4m is soon');
assert(tt.formatCountdown(25, 1500).status === 'normal', '25m is normal');
assert(tt.formatCountdown(90, 5400).text === 'あと 1時間30分', '90m formats with hours');

// 3.3 Realtime Delay Merging
const baseTimetable = [
  { busId: '111-out-0', line: '111系統', departureTime: '07:05', destination: '上大岡駅前' },
  { busId: '111-out-1', line: '111系統', departureTime: '07:18', destination: '上大岡駅前' }
];

const liveBuses = [
  {
    '@id': 'live-111-out-0',
    'odpt:busroute': ROUTES.ROUTE_111.id,
    'odpt:delay': 180, // 3 minutes
    'geo:lat': 35.385,
    'geo:long': 139.598,
    'odpt:toBusstopPole': STOPS.YOKODAI.id
  }
];

const merged = tt.mergeRealtimeDelays(baseTimetable, liveBuses);
assert(merged[0].delayMinutes === 3, 'Delay merged as 3 minutes');
assert(merged[0].actualDepartureTime === '07:08', 'Actual departure shifted to 07:08');
assert(merged[0].liveLocation !== null, 'Live GPS location attached');
assert(merged[1].delayMinutes === 0, 'Unmatched bus remains 0 delay');
assert(merged[1].actualDepartureTime === '07:18', 'Unmatched bus departure unchanged');

console.log('');

// =========================================================================
// 4. TransferService: Bidirectional, Buffer Clamping, Delay Shifts & Late-Night
// =========================================================================
console.log('--- 4. TransferService: Bidirectional Routing & Adversarial Edge Cases ---');

const tf = new TransferService();
const bidi = tf.getBidirectionalRoutes();

// 4.1 Route metadata verification
assert(bidi.outbound.origin.name === '洋光台北口', 'Outbound origin is 洋光台北口');
assert(bidi.outbound.destination.name === '古泉', 'Outbound destination is 古泉');
assert(bidi.outbound.leg1.line === '111系統', 'Outbound Leg 1 is 111系統');
assert(bidi.outbound.leg1.durationMinutes === 15, 'Outbound Leg 1 duration is 15 min');
assert(bidi.outbound.leg2.line === '133系統', 'Outbound Leg 2 is 133系統');
assert(bidi.outbound.leg2.durationMinutes === 12, 'Outbound Leg 2 duration is 12 min');

assert(bidi.inbound.origin.name === '古泉', 'Inbound origin is 古泉');
assert(bidi.inbound.destination.name === '洋光台北口', 'Inbound destination is 洋光台北口');
assert(bidi.inbound.leg1.line === '133系統', 'Inbound Leg 1 is 133系統');
assert(bidi.inbound.leg1.durationMinutes === 12, 'Inbound Leg 1 duration is 12 min');
assert(bidi.inbound.leg2.line === '111系統', 'Inbound Leg 2 is 111系統');
assert(bidi.inbound.leg2.durationMinutes === 15, 'Inbound Leg 2 duration is 15 min');

// 4.2 Outbound Transfer Calculation (Weekday Morning Commute 07:00)
const outTimetables = MockData.getMockTimetables('Weekday');
const outboundResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line111Outbound,
  leg2Timetable: outTimetables.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 24, 7, 0, 0)
});

assert(outboundResult.status === 'ok', 'Outbound 07:00 calculation succeeds');
assert(outboundResult.recommended.leg1.departureTime === '07:05', 'Outbound recommended Leg 1 dep is 07:05');
assert(outboundResult.recommended.leg1.estimatedArrivalTime === '07:20', 'Outbound Leg 1 arr at Kamiooka is 07:20');
assert(outboundResult.recommended.leg2.departureTime === '07:35', 'Outbound recommended Leg 2 dep is 07:35 (>= 07:20 + 5m buffer)');
assert(outboundResult.recommended.transferWaitMinutes === 15, 'Transfer wait is 15 min');
assert(outboundResult.recommended.leg2.estimatedArrivalTime === '07:47', 'Outbound arrival at Koizumi is 07:47');
assert(outboundResult.alternatives.length >= 2, 'At least 2 alternative outbound connections returned');

// 4.3 Inbound Transfer Calculation (Weekday Morning Commute 07:00: Koizumi -> Yokodai)
const inboundResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line133Inbound,
  leg2Timetable: outTimetables.line111Inbound,
  direction: 'inbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 24, 7, 0, 0)
});

assert(inboundResult.status === 'ok', 'Inbound 07:00 calculation succeeds');
assert(inboundResult.recommended.leg1.departureTime === '07:05', 'Inbound recommended Leg 1 (133系統) dep is 07:05');
assert(inboundResult.recommended.leg1.estimatedArrivalTime === '07:17', 'Inbound Leg 1 (133系統: 12m) arr at Kamiooka is 07:17');
assert(inboundResult.recommended.leg2.departureTime === '07:30', 'Inbound recommended Leg 2 (111系統) dep is 07:30 (>= 07:17 + 5m buffer = 07:22)');
assert(inboundResult.recommended.transferWaitMinutes === 13, 'Inbound transfer wait is 13 min');
assert(inboundResult.recommended.leg2.estimatedArrivalTime === '07:45', 'Inbound arrival at Yokodai is 07:45');

// 4.4 Custom Transfer Buffer: 1 min vs 20 min
const tightBufferResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line111Outbound,
  leg2Timetable: outTimetables.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 1, // Minimum buffer
  currentTime: new Date(2026, 7, 24, 7, 0, 0)
});
// 07:05 dep + 15m = 07:20 arr. With 1m buffer, min connecting time = 07:21. Next 133 bus is 07:35 (or 07:15 is too early).
assert(tightBufferResult.recommended.leg2.departureTime === '07:35', 'Tight buffer 1m gives 07:35 Leg 2');

const wideBufferResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line111Outbound,
  leg2Timetable: outTimetables.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 20, // 20 min buffer
  currentTime: new Date(2026, 7, 24, 7, 0, 0)
});
// 07:05 dep + 15m = 07:20 arr. With 20m buffer, min connecting time = 07:40. Next 133 bus is 07:50.
assert(wideBufferResult.recommended.leg2.departureTime === '07:50', 'Wide buffer 20m shifts Leg 2 to 07:50');
assert(wideBufferResult.recommended.transferWaitMinutes === 30, 'Transfer wait with 20m buffer is 30 min (07:50 - 07:20)');

// 4.5 Delay Shift Propagation
// 07:05 bus in line111Outbound is index 3 ('111-out-3')
const bus0705 = outTimetables.line111Outbound.find(b => b.departureTime === '07:05');
const delayedResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line111Outbound,
  leg2Timetable: outTimetables.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 5,
  realtimeDelays: { [bus0705.busId]: 12 }, // +12 min delay on 07:05 bus
  currentTime: new Date(2026, 7, 24, 7, 0, 0)
});
assert(delayedResult.recommended.leg1.delayMinutes === 12, 'Leg 1 has 12 min delay');
assert(delayedResult.recommended.leg1.actualDepartureTime === '07:17', 'Leg 1 actual dep is 07:17');
assert(delayedResult.recommended.leg1.estimatedArrivalTime === '07:32', 'Leg 1 actual arr is 07:32');
assert(delayedResult.recommended.leg2.departureTime === '07:50', 'Delayed connection automatically shifts to 07:50 Leg 2 bus');
assert(delayedResult.recommended.transferWaitMinutes === 18, 'Wait time recalculated to 18 min (07:50 - 07:32)');

// 4.6 Late-Night & End-of-Service Boundary (23:45)
const lateNightResult = tf.calculateTransferRoute({
  leg1Timetable: outTimetables.line111Outbound,
  leg2Timetable: outTimetables.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 24, 23, 45, 0)
});
assert(lateNightResult.status === 'no_buses_available', 'After last bus returns status no_buses_available');
assert(lateNightResult.recommended === null, 'After last bus recommended is null');
assert(Array.isArray(lateNightResult.alternatives) && lateNightResult.alternatives.length === 0, 'After last bus alternatives is empty array');

console.log('');

// =========================================================================
// 5. OdptClient Offline & Mock Fallback Resilience
// =========================================================================
console.log('--- 5. OdptClient: HTTP Error Fallback & Notification ---');

const offlineStorage = new StorageService();
offlineStorage.clearCache();
offlineStorage.setApiKey('invalid_test_key_xyz');
const offlineClient = new OdptClient({
  storage: offlineStorage,
  apiBase: 'https://invalid-non-existent-odpt-domain-12345.org/api/v4/'
});
let receivedStatus = null;
offlineClient.onStatusChange(st => {
  receivedStatus = st;
});

// fetchBusstopPoles under simulated offline/403
const poles = await offlineClient.fetchBusstopPoles();
assert(Array.isArray(poles) && poles.length >= 3, 'fetchBusstopPoles returns mock poles on network failure');
assert(offlineClient.isUsingMockData === true, 'isUsingMockData is true');
assert(receivedStatus !== null && receivedStatus.isMock === true, 'Status notification triggered with isMock: true');

const ttData = await offlineClient.fetchTimetable(STOPS.YOKODAI.id, 'Weekday');
assert(Array.isArray(ttData) && ttData.length > 0, 'fetchTimetable returns mock timetable on network failure');

const buses = await offlineClient.fetchRealtimeBuses();
assert(Array.isArray(buses) && buses.length > 0, 'fetchRealtimeBuses returns mock buses on network failure');

const busInfo = await offlineClient.fetchBusInformation();
assert(Array.isArray(busInfo) && busInfo.length > 0, 'fetchBusInformation returns mock bus info on network failure');

console.log('\n========================================================================');
console.log(`VERIFICATION SUMMARY: ${passCount} passed, ${failCount} failed.`);
console.log('========================================================================');

if (failCount > 0) {
  console.error('\nFailures encountered:');
  for (const f of failures) {
    console.error(`- ${f.message}: ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log('🎉 ALL ADVERSARIAL STRESS TESTS PASSED WITH ZERO FAILURES!');
  process.exit(0);
}
