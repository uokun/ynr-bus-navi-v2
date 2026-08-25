/**
 * m2-m3-unit-tests.js
 * Verification of Milestone 2 and Milestone 3 modules:
 * config.js, storage-service.js, mock-data.js, odpt-client.js, calendar-service.js, timetable-service.js, transfer-service.js
 */

import { CONFIG, STOPS, ROUTES, STORAGE_KEYS, DEFAULT_CONSUMER_KEY } from '../js/config.js';
import { StorageService } from '../js/services/storage-service.js';
import { MockData, MOCK_BUSSTOP_POLES, MOCK_ROUTES, MOCK_BUSES, MOCK_BUS_INFO, getMockTimetables, getMockTimetable } from '../js/api/mock-data.js';
import { OdptClient } from '../js/api/odpt-client.js';
import { CalendarService, calendarService } from '../js/services/calendar-service.js';
import { TimetableService, timetableService } from '../js/services/timetable-service.js';
import { TransferService, transferService } from '../js/services/transfer-service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    passed++;
    console.log(`✔ PASS: ${message}`);
  }
}

console.log('=== Starting M2 & M3 Modules Verification ===\n');

// 1. Config tests
assert(CONFIG.API_BASE === 'https://api.odpt.org/api/v4/', 'CONFIG.API_BASE is correct');
assert(CONFIG.DEFAULT_CONSUMER_KEY === DEFAULT_CONSUMER_KEY, 'DEFAULT_CONSUMER_KEY is set');
assert(STOPS.YOKODAI.name === '洋光台北口', 'STOPS.YOKODAI has correct name');
assert(STOPS.KAMIOOKA.name === '上大岡駅前', 'STOPS.KAMIOOKA has correct name');
assert(STOPS.KOIZUMI.name === '古泉', 'STOPS.KOIZUMI has correct name');
assert(ROUTES.ROUTE_111.name === '111系統', 'ROUTES.ROUTE_111 exists');
assert(ROUTES.ROUTE_133.name === '133系統', 'ROUTES.ROUTE_133 exists');
assert(ROUTES.ROUTE_64.name === '64系統', 'ROUTES.ROUTE_64 exists');

// 2. StorageService tests
const mockStorageMap = new Map();
const customStorage = {
  getItem: (k) => (mockStorageMap.has(k) ? mockStorageMap.get(k) : null),
  setItem: (k, v) => mockStorageMap.set(k, String(v)),
  removeItem: (k) => mockStorageMap.delete(k),
  clear: () => mockStorageMap.clear(),
  get length() { return mockStorageMap.size; },
  key: (i) => Array.from(mockStorageMap.keys())[i]
};
const storage = new StorageService(customStorage);

assert(storage.getApiKey() === DEFAULT_CONSUMER_KEY, 'Default API key when empty');
storage.setApiKey('test_key_abc');
assert(storage.getApiKey() === 'test_key_abc', 'Saved API key retrieved');
storage.resetApiKey();
assert(storage.getApiKey() === DEFAULT_CONSUMER_KEY, 'Reset API key restores default');

assert(storage.getTransferBuffer() === 5, 'Default buffer is 5');
storage.setTransferBuffer(10);
assert(storage.getTransferBuffer() === 10, 'Set buffer is saved');
storage.setTransferBuffer(-5);
assert(storage.getTransferBuffer() === 1, 'Negative buffer clamped to 1');
storage.setTransferBuffer(100);
assert(storage.getTransferBuffer() === 30, 'Buffer > 30 clamped to 30');

assert(storage.getTheme() === 'system', 'Default theme is system');
storage.setTheme('dark');
assert(storage.getTheme() === 'dark', 'Dark theme saved');

storage.setCached('my_test_cache', { foo: 'bar' }, 60);
const cachedVal = storage.getCached('my_test_cache');
assert(cachedVal && cachedVal.foo === 'bar', 'Cached data retrieved within TTL');

storage.clearCache();
assert(storage.getCached('my_test_cache') === null, 'Cache cleared successfully');

// 3. CalendarService tests
assert(calendarService.isJapaneseHoliday(new Date(2026, 0, 1)) === true, '2026-01-01 is New Year holiday');
assert(calendarService.isJapaneseHoliday(new Date(2026, 0, 2)) === true, '2026-01-02 is Year-End/New Year period');
assert(calendarService.isJapaneseHoliday(new Date(2026, 4, 3)) === true, '2026-05-03 is Constitution Memorial Day');
assert(calendarService.isJapaneseHoliday(new Date(2026, 4, 6)) === true, '2026-05-06 is Substitute holiday');
assert(calendarService.getCalendarType(new Date(2026, 0, 1)) === 'Holiday', 'Jan 1 schedule is Holiday');
assert(calendarService.getCalendarType(new Date(2026, 7, 22)) === 'Saturday', '2026-08-22 is Saturday');
assert(calendarService.getCalendarType(new Date(2026, 7, 24)) === 'Weekday', '2026-08-24 is Weekday');

// 4. MockData tests
assert(MOCK_BUSSTOP_POLES.length >= 3, 'Mock bus stop poles provided');
assert(MOCK_ROUTES.length >= 3, 'Mock routes provided');
const mockSchedules = getMockTimetables('Weekday');
assert(mockSchedules.line111Outbound.length > 20, 'Line 111 outbound schedule complete');
assert(mockSchedules.line133Outbound.length > 20, 'Line 133 outbound schedule complete');
assert(mockSchedules.line64Outbound.length > 10, 'Line 64 outbound schedule complete');
assert(mockSchedules.line133Inbound.length > 20, 'Line 133 inbound schedule complete');
assert(mockSchedules.line111Inbound.length > 20, 'Line 111 inbound schedule complete');

// 5. TimetableService tests
assert(timetableService.timeStringToMinutes('07:35') === 455, '07:35 is 455 minutes');
assert(timetableService.minutesToTimeString(455) === '07:35', '455 minutes is 07:35');
const cd1 = timetableService.formatCountdown(5);
assert(cd1.text === 'あと 5分' && cd1.status === 'soon', 'Countdown 5m is soon');
const cd2 = timetableService.formatCountdown(0.5);
assert(cd2.text === 'まもなく発車' && cd2.status === 'urgent', 'Countdown <1m is urgent');

const filtered = timetableService.filterTimetable(mockSchedules.line111Outbound, { timeFrom: '07:00' });
assert(filtered.length > 0 && filtered[0].departureTime >= '07:00', 'Filtered from 07:00');

const nextDeps = timetableService.getNextDepartures(mockSchedules.line111Outbound, new Date(2026, 7, 22, 7, 0, 0), 3);
assert(nextDeps.length === 3, 'Next 3 departures retrieved');
assert(nextDeps[0].departureTime === '07:05', 'Earliest departure after 07:00 is 07:05');

const delayedMerged = timetableService.mergeRealtimeDelays(
  [{ line: '111系統', departureTime: '07:05', busId: '111-4412' }],
  [{ 'owl:sameAs': 'odpt.Bus:YokohamaMunicipal.111.Vehicle4412', 'odpt:delay': 120 }]
);
assert(delayedMerged[0].delayMinutes === 2, 'Delay 120s merged as 2 min');
assert(delayedMerged[0].actualDepartureTime === '07:07', 'Actual departure shifted to 07:07');

// 6. TransferService tests
const routes = transferService.getBidirectionalRoutes();
assert(routes.outbound.leg1.line === '111系統', 'Outbound leg1 is 111系統');
assert(routes.outbound.leg2.line === '133系統', 'Outbound leg2 is 133系統');
assert(routes.inbound.leg1.line === '133系統', 'Inbound leg1 is 133系統');
assert(routes.inbound.leg2.line === '111系統', 'Inbound leg2 is 111系統');

const transferRes = transferService.calculateTransferRoute({
  leg1Timetable: mockSchedules.line111Outbound,
  leg2Timetable: mockSchedules.line133Outbound,
  direction: 'outbound',
  bufferMinutes: 5,
  currentTime: new Date(2026, 7, 22, 7, 0, 0)
});
assert(transferRes.status === 'ok', 'Transfer calculation status is ok');
assert(transferRes.recommended.leg1.departureTime === '07:05', 'Recommended Leg 1 is 07:05');
assert(transferRes.recommended.leg2.departureTime === '07:35', 'Recommended Leg 2 is 07:35');
assert(transferRes.recommended.transferWaitMinutes === 15, 'Wait minutes is 15');
assert(transferRes.alternatives.length >= 2, 'At least 2 alternative options returned');

// 7. OdptClient tests
const client = new OdptClient({ storage });
const poles = await client.fetchBusstopPoles();
assert(poles.length >= 3, 'OdptClient fetchBusstopPoles returns poles');
const patterns = await client.fetchBusRoutePatterns();
assert(patterns.length >= 3, 'OdptClient fetchBusRoutePatterns returns patterns');
const timetable = await client.fetchTimetable(STOPS.YOKODAI.id, 'Weekday');
assert(timetable.length > 0, 'OdptClient fetchTimetable returns timetable');
const liveBuses = await client.fetchRealtimeBuses();
assert(liveBuses.length >= 1, 'OdptClient fetchRealtimeBuses returns buses');
const busInfo = await client.fetchBusInformation();
assert(busInfo.length >= 1, 'OdptClient fetchBusInformation returns bus info');

console.log(`\n========================================`);
console.log(`Total Passed: ${passed}, Failed: ${failed}`);
console.log(`========================================`);
if (failed > 0) {
  process.exit(1);
}
