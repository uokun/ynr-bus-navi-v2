/**
 * tests/adversarial-m2-m3-tests.js
 * Comprehensive Adversarial Test Suite for Milestones 2 & 3
 * 
 * Tests:
 * 1. ODPT API Client Network & Error Simulation (401, 403, 404, 500, 502, 503, 504, timeout, network dropout, corrupted JSON)
 * 2. Storage Service Cache Expiration, Invalidation, Quota Exceeded, In-memory fallback, and Key Clamping
 * 3. 120+ Japanese Calendar Dates (Fixed, Happy Monday, Equinox 2020-2035, Leap years, GW May 6 substitute rules, New Year period, regular days)
 * 4. Timetable & Transfer Calculation Edge Cases (midnight wraparound, extreme delays, missing/cancelled buses, buffer limits)
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
console.log('🚀 RUNNING ADVERSARIAL TEST SUITE: MILESTONES 2 & 3');
console.log('================================================================\n');

// =============================================================================
// SECTION 1: ODPT API Client - Network Dropouts & HTTP Errors & Corrupted Data
// =============================================================================
console.log('--- SECTION 1: ODPT Client Adversarial Error & Fallback Tests ---');

async function testOdptClientAdversarial() {
  // Helper to create client with custom storage and mock fetch
  function createMockFetchClient(fetchImpl) {
    const memoryStore = new Map();
    const mockStorage = new StorageService({
      getItem: (k) => memoryStore.get(k) || null,
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k),
      clear: () => memoryStore.clear(),
      get length() { return memoryStore.size; },
      key: (i) => Array.from(memoryStore.keys())[i]
    });

    const client = new OdptClient({
      storage: mockStorage,
      mockData: MockData
    });

    return { client, mockStorage };
  }

  // 1.1 HTTP Errors: 401, 403, 404, 500, 502, 503, 504
  const httpErrorCodes = [401, 403, 404, 500, 502, 503, 504];
  for (const status of httpErrorCodes) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status,
      statusText: `Simulated HTTP ${status}`
    });

    const { client } = createMockFetchClient();
    let notifiedStatus = null;
    client.onStatusChange(s => { notifiedStatus = s; });

    // Test fetchBusstopPoles
    const poles = await client.fetchBusstopPoles();
    assert(Array.isArray(poles) && poles.length > 0, `HTTP ${status}: fetchBusstopPoles gracefully falls back to mock poles`);
    assert(client.isUsingMockData === true, `HTTP ${status}: client.isUsingMockData flag set to true`);
    assert(client.lastError !== null, `HTTP ${status}: client.lastError captures HTTP error`);
    assert(notifiedStatus && notifiedStatus.isMock === true && notifiedStatus.status === 'fallback', `HTTP ${status}: onStatusChange notified`);

    // Test fetchBusRoutePatterns
    const routes = await client.fetchBusRoutePatterns();
    assert(Array.isArray(routes) && routes.length > 0, `HTTP ${status}: fetchBusRoutePatterns gracefully falls back to mock routes`);

    // Test fetchBusstopPoleTimetables
    const tt = await client.fetchBusstopPoleTimetables(STOPS.YOKODAI.id, 'Weekday');
    assert(Array.isArray(tt) && tt.length > 0, `HTTP ${status}: fetchBusstopPoleTimetables gracefully falls back to mock timetable`);

    // Test fetchRealtimeBuses
    const liveBuses = await client.fetchRealtimeBuses();
    assert(Array.isArray(liveBuses) && liveBuses.length > 0, `HTTP ${status}: fetchRealtimeBuses gracefully falls back to mock live buses`);

    // Test fetchBusInformation
    const busInfo = await client.fetchBusInformation();
    assert(Array.isArray(busInfo) && busInfo.length > 0, `HTTP ${status}: fetchBusInformation gracefully falls back to mock info`);

    globalThis.fetch = originalFetch;
  }

  // 1.2 Network Timeout / Abort / Connection Refused
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch (Network connection refused / timeout)');
    };

    const { client } = createMockFetchClient();
    const poles = await client.fetchBusstopPoles();
    assert(Array.isArray(poles) && poles.length > 0, 'Network Drop / Timeout: fetchBusstopPoles falls back to mock');
    assert(client.isUsingMockData === true, 'Network Drop: isUsingMockData is true');
    assert(client.lastError.message.includes('Network connection refused'), 'Network Drop: error message recorded');

    globalThis.fetch = originalFetch;
  }

  // 1.3 Navigator Offline State
  {
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
        writable: true
      });

      const { client } = createMockFetchClient();
      const tt = await client.fetchBusstopPoleTimetables('kamiooka', 'Holiday');
      assert(Array.isArray(tt) && tt.length > 0, 'navigator.onLine = false: falls back to mock timetable');
      assert(client.lastError.message.includes('Offline: navigator.onLine is false'), 'Offline detected before fetch call');
    } finally {
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    }
  }

  // 1.4 Malformed / Corrupted JSON payload from API
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0 (HTML error page returned)'); }
    });

    const { client } = createMockFetchClient();
    const routes = await client.fetchBusRoutePatterns();
    assert(Array.isArray(routes) && routes.length > 0, 'Corrupted JSON (HTML returned with 200 OK): falls back to mock routes');
    assert(client.isUsingMockData === true, 'Corrupted JSON: isUsingMockData is true');

    globalThis.fetch = originalFetch;
  }

  // 1.5 Successful Live API response caching & retrieval
  {
    const sampleApiData = [{ '@type': 'odpt:BusstopPole', 'dc:title': 'Real API Pole' }];
    let fetchCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => sampleApiData
      };
    };

    const { client } = createMockFetchClient();
    const res1 = await client.fetchBusstopPoles();
    assert(res1[0]['dc:title'] === 'Real API Pole', 'Live API call returned valid data');
    assert(client.isUsingMockData === false, 'Live API: isUsingMockData is false');

    // 2nd call should hit cache (TTL > 0 for BusstopPole)
    const res2 = await client.fetchBusstopPoles();
    assert(fetchCount === 1, 'Live API response cached: 2nd call did not trigger network fetch');
    assert(res2[0]['dc:title'] === 'Real API Pole', 'Cached data returned successfully');

    globalThis.fetch = originalFetch;
  }
}

// =============================================================================
// SECTION 2: Storage Service - Cache Expiration, Corrupted Data & Edge Cases
// =============================================================================
console.log('\n--- SECTION 2: Storage Service Stress & Adversarial Tests ---');

function testStorageServiceAdversarial() {
  const memoryStore = new Map();
  let simulateQuotaError = false;

  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => {
      if (simulateQuotaError) {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      }
      memoryStore.set(k, String(v));
    },
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
    get length() { return memoryStore.size; },
    key: (i) => Array.from(memoryStore.keys())[i]
  };

  const storage = new StorageService(mockStorage);

  // 2.1 Cache TTL Expiration Test
  storage.setCachedData('expire_test', { value: 123 }, 1); // 1 sec TTL
  assert(storage.getCachedData('expire_test') !== null, 'Data present immediately after setting cache');

  // Advance time by mocking Date.now
  const originalDateNow = Date.now;
  try {
    Date.now = () => originalDateNow() + 2000; // 2 seconds later
    const expiredResult = storage.getCachedData('expire_test');
    assert(expiredResult === null, 'Cache expired after TTL elapsed and returns null');
  } finally {
    Date.now = originalDateNow;
  }

  // 2.2 Corrupted Cache Data in Storage
  const corruptKeys = [
    { key: 'corrupt_invalid_json', val: '{ invalid json here...' },
    { key: 'corrupt_null_raw', val: 'null' },
    { key: 'corrupt_number_raw', val: '12345' },
    { key: 'corrupt_empty_obj', val: '{}' },
    { key: 'corrupt_no_data_field', val: JSON.stringify({ cachedAt: Date.now(), expiresAt: Date.now() + 100000 }) }
  ];

  for (const item of corruptKeys) {
    memoryStore.set(`${STORAGE_KEYS.CACHE_PREFIX}${item.key}`, item.val);
    const res = storage.getCachedData(item.key);
    assert(res === null, `Corrupted cache [${item.key}] returns null safely without throwing`);
  }

  // 2.3 Storage setCachedData with TTL <= 0 does not store
  storage.setCachedData('zero_ttl_key', { test: true }, 0);
  assert(storage.getCachedData('zero_ttl_key') === null, 'TTL <= 0 is not cached in storage');

  // 2.4 QuotaExceededError Recovery
  storage.setCachedData('old_cache_1', { data: 'old1' }, 3600);
  storage.setCachedData('old_cache_2', { data: 'old2' }, 3600);
  assert(memoryStore.size >= 2, 'Caches populated before quota error test');

  // Trigger quota error on next setItem
  simulateQuotaError = true;
  const setRes = storage._setItem('new_key_under_quota', 'new_val');
  assert(storage._getItem('new_key_under_quota') === 'new_val', 'QuotaExceededError handled: falls back to in-memory store');
  simulateQuotaError = false;

  // 2.5 API Key Edge Cases
  storage.setApiKey('');
  assert(storage.getApiKey() === DEFAULT_CONSUMER_KEY, 'Empty string API key resets to DEFAULT_CONSUMER_KEY');

  storage.setApiKey('   ');
  assert(storage.getApiKey() === DEFAULT_CONSUMER_KEY, 'Whitespace-only API key resets to DEFAULT_CONSUMER_KEY');

  storage.setApiKey('  custom_token_12345  ');
  assert(storage.getApiKey() === 'custom_token_12345', 'API key trimmed when saved');

  storage.resetApiKey();
  assert(storage.getApiKey() === DEFAULT_CONSUMER_KEY, 'resetApiKey() restores DEFAULT_CONSUMER_KEY');

  // 2.6 Transfer Buffer Clamping
  const bufferTestCases = [
    { in: -10, expected: 1 },
    { in: 0, expected: 1 },
    { in: 1, expected: 1 },
    { in: 5, expected: 5 },
    { in: 30, expected: 30 },
    { in: 31, expected: 30 },
    { in: 100, expected: 30 },
    { in: '15', expected: 15 },
    { in: 'invalid', expected: 5 },
    { in: null, expected: 5 },
    { in: NaN, expected: 5 }
  ];

  for (const tc of bufferTestCases) {
    storage.setTransferBuffer(tc.in);
    assert(storage.getTransferBuffer() === tc.expected, `setTransferBuffer(${tc.in}) -> clamped to ${tc.expected}`);
  }

  // 2.7 Theme Validation
  const themeTestCases = [
    { in: 'dark', expected: 'dark' },
    { in: 'light', expected: 'light' },
    { in: 'system', expected: 'system' },
    { in: 'blue', expected: 'system' },
    { in: '', expected: 'system' },
    { in: null, expected: 'system' }
  ];

  for (const tc of themeTestCases) {
    storage.setTheme(tc.in);
    assert(storage.getTheme() === tc.expected, `setTheme('${tc.in}') -> ${tc.expected}`);
  }

  // 2.8 Auto-Refresh Interval Clamping
  const refreshCases = [
    { in: -5, expected: 0 },
    { in: 0, expected: 0 },
    { in: 30, expected: 30 },
    { in: 60, expected: 60 },
    { in: 120, expected: 120 },
    { in: 200, expected: 120 },
    { in: 'invalid', expected: 30 }
  ];

  for (const tc of refreshCases) {
    storage.setAutoRefreshInterval(tc.in);
    assert(storage.getAutoRefreshInterval() === tc.expected, `setAutoRefreshInterval(${tc.in}) -> ${tc.expected}`);
  }
}

// =============================================================================
// SECTION 3: Calendar Service - 120+ Holiday & Schedule Tests
// =============================================================================
console.log('\n--- SECTION 3: Calendar Service 120+ Holiday & Schedule Tests ---');

function testCalendarService120Dates() {
  const calendar = new CalendarService();

  // Test across years 2024 to 2031 (8 years * ~17 holidays/year = 136 test dates)
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];

  let holidayCount = 0;
  for (const y of years) {
    // 1. Fixed holidays
    const fixedHolidays = [
      { m: 1, d: 1, name: '元日' },
      { m: 2, d: 11, name: '建国記念の日' },
      { m: 2, d: 23, name: '天皇誕生日' },
      { m: 4, d: 29, name: '昭和の日' },
      { m: 5, d: 3, name: '憲法記念日' },
      { m: 5, d: 4, name: 'みどりの日' },
      { m: 5, d: 5, name: 'こどもの日' },
      { m: 8, d: 11, name: '山の日' },
      { m: 11, d: 3, name: '文化の日' },
      { m: 11, d: 23, name: '勤労感謝の日' }
    ];

    for (const h of fixedHolidays) {
      const dt = new Date(y, h.m - 1, h.d);
      const isHol = calendar.isJapaneseHoliday(dt);
      const calType = calendar.getCalendarType(dt);
      assert(isHol === true, `${y}-${String(h.m).padStart(2, '0')}-${String(h.d).padStart(2, '0')} (${h.name}) is holiday`);
      assert(calType === 'Holiday', `${y}-${String(h.m).padStart(2, '0')}-${String(h.d).padStart(2, '0')} uses Holiday timetable`);
      holidayCount++;
    }

    // 2. Year-End / New Year Special Days
    const newYearDates = [
      { m: 12, d: 29 }, { m: 12, d: 30 }, { m: 12, d: 31 },
      { m: 1, d: 2 }, { m: 1, d: 3 }
    ];
    for (const ny of newYearDates) {
      const dt = new Date(y, ny.m - 1, ny.d);
      assert(calendar.isJapaneseHoliday(dt) === true, `${y}-${String(ny.m).padStart(2, '0')}-${String(ny.d).padStart(2, '0')} Year-End/New Year is holiday`);
      assert(calendar.getCalendarType(dt) === 'Holiday', `${y}-${String(ny.m).padStart(2, '0')}-${String(ny.d).padStart(2, '0')} Year-End/New Year uses Holiday schedule`);
      holidayCount++;
    }
  }

  // 3. Happy Monday Holidays Specific Checks
  const happyMondayTests = [
    // 2024
    { y: 2024, m: 1, d: 8, name: '2024 成人の日 (第2月曜)' },
    { y: 2024, m: 7, d: 15, name: '2024 海の日 (第3月曜)' },
    { y: 2024, m: 9, d: 16, name: '2024 敬老の日 (第3月曜)' },
    { y: 2024, m: 10, d: 14, name: '2024 スポーツの日 (第2月曜)' },
    // 2025
    { y: 2025, m: 1, d: 13, name: '2025 成人の日' },
    { y: 2025, m: 7, d: 21, name: '2025 海の日' },
    { y: 2025, m: 9, d: 15, name: '2025 敬老の日' },
    { y: 2025, m: 10, d: 13, name: '2025 スポーツの日' },
    // 2026
    { y: 2026, m: 1, d: 12, name: '2026 成人の日' },
    { y: 2026, m: 7, d: 20, name: '2026 海の日' },
    { y: 2026, m: 9, d: 21, name: '2026 敬老の日' },
    { y: 2026, m: 10, d: 12, name: '2026 スポーツの日' },
    // 2027
    { y: 2027, m: 1, d: 11, name: '2027 成人の日' },
    { y: 2027, m: 7, d: 19, name: '2027 海の日' },
    { y: 2027, m: 9, d: 20, name: '2027 敬老の日' },
    { y: 2027, m: 10, d: 11, name: '2027 スポーツの日' }
  ];

  for (const hm of happyMondayTests) {
    const dt = new Date(hm.y, hm.m - 1, hm.d);
    assert(calendar.isJapaneseHoliday(dt) === true, `${hm.name} (${hm.y}-${hm.m}-${hm.d}) is Holiday`);
    assert(calendar.getCalendarType(dt) === 'Holiday', `${hm.name} schedule is Holiday`);
    holidayCount++;
  }

  // 4. Spring / Autumn Equinox Astronomical Calculations
  const equinoxTests = [
    { y: 2024, spring: 20, autumn: 22 },
    { y: 2025, spring: 20, autumn: 23 },
    { y: 2026, spring: 20, autumn: 23 },
    { y: 2027, spring: 21, autumn: 23 },
    { y: 2028, spring: 20, autumn: 22 }, // Leap year
    { y: 2029, spring: 20, autumn: 23 },
    { y: 2030, spring: 20, autumn: 23 }
  ];

  for (const eq of equinoxTests) {
    const spDt = new Date(eq.y, 2, eq.spring); // March
    const auDt = new Date(eq.y, 8, eq.autumn); // September
    assert(calendar.isJapaneseHoliday(spDt) === true, `${eq.y} 春分の日 (${eq.y}-03-${eq.spring}) is Holiday`);
    assert(calendar.isJapaneseHoliday(auDt) === true, `${eq.y} 秋分の日 (${eq.y}-09-${eq.autumn}) is Holiday`);
    holidayCount += 2;
  }

  // 5. Golden Week May 6 Substitute Holiday Rule Test
  // In 2024: May 3 (Fri), May 4 (Sat), May 5 (Sun) -> May 6 (Mon) is substitute for Children's Day
  assert(calendar.isJapaneseHoliday(new Date(2024, 4, 6)) === true, '2024-05-06 is Substitute Holiday (May 5 was Sun)');
  // In 2026: May 3 (Sun) -> May 6 (Wed) is substitute for Constitution Day
  assert(calendar.isJapaneseHoliday(new Date(2026, 4, 6)) === true, '2026-05-06 is Substitute Holiday (May 3 was Sun)');
  // In 2025: May 3 (Sat), May 4 (Sun) -> May 6 (Tue) is substitute
  assert(calendar.isJapaneseHoliday(new Date(2025, 4, 6)) === true, '2025-05-06 is Substitute Holiday (May 4 was Sun)');

  // 5.1 Sunday Substitute Holidays across years
  const sundaySubstituteTests = [
    { date: new Date(2024, 1, 12), name: '2024-02-12 (建国記念の日 振替休日)' },
    { date: new Date(2024, 7, 12), name: '2024-08-12 (山の日 振替休日)' },
    { date: new Date(2024, 8, 23), name: '2024-09-23 (秋分の日 振替休日)' },
    { date: new Date(2024, 10, 4), name: '2024-11-04 (文化の日 振替休日)' },
    { date: new Date(2025, 1, 24), name: '2025-02-24 (天皇誕生日 振替休日)' }
  ];

  for (const sst of sundaySubstituteTests) {
    assert(calendar.isJapaneseHoliday(sst.date) === true, `${sst.name} is Holiday`);
    assert(calendar.getCalendarType(sst.date) === 'Holiday', `${sst.name} uses Holiday timetable`);
    holidayCount++;
  }

  // 5.2 Citizen's Holiday (国民の休日: Silver Week 2026-09-22)
  const silverWeek2026 = new Date(2026, 8, 22); // Sep 22, 2026 (between 敬老の日 9/21 and 秋分の日 9/23)
  assert(calendar.isJapaneseHoliday(silverWeek2026) === true, '2026-09-22 is Silver Week Citizen Holiday (国民の休日)');
  assert(calendar.getCalendarType(silverWeek2026) === 'Holiday', '2026-09-22 uses Holiday timetable');
  holidayCount++;

  // 6. Regular Weekdays & Saturdays (Non-Holidays)
  const regularDays = [
    { date: new Date(2026, 7, 19), expected: 'Weekday' }, // 2026-08-19 (Wed)
    { date: new Date(2026, 7, 20), expected: 'Weekday' }, // 2026-08-20 (Thu)
    { date: new Date(2026, 7, 21), expected: 'Weekday' }, // 2026-08-21 (Fri)
    { date: new Date(2026, 7, 22), expected: 'Saturday' }, // 2026-08-22 (Sat)
    { date: new Date(2026, 7, 23), expected: 'Holiday' },  // 2026-08-23 (Sun)
    { date: new Date(2026, 7, 24), expected: 'Weekday' }, // 2026-08-24 (Mon)
    { date: new Date(2024, 1, 29), expected: 'Weekday' }, // 2024-02-29 (Leap day Thu)
    { date: new Date(2028, 1, 29), expected: 'Weekday' }  // 2028-02-29 (Leap day Tue)
  ];

  for (const rd of regularDays) {
    const calType = calendar.getCalendarType(rd.date);
    assert(calType === rd.expected, `${rd.date.toISOString().slice(0, 10)} classified as ${rd.expected}`);
  }

  // 7. Invalid Date Handlers
  assert(calendar.isJapaneseHoliday(null) !== undefined, 'isJapaneseHoliday(null) safely handles invalid input');
  assert(calendar.isJapaneseHoliday(new Date('invalid')) !== undefined, 'isJapaneseHoliday(invalid Date) safely handles invalid input');
  assert(calendar.getCalendarType('string') !== undefined, 'getCalendarType(string) safely handles invalid input');

  console.log(`\n✔ Tested total ${holidayCount + regularDays.length + 3} holiday/calendar date conditions.`);
}

// =============================================================================
// SECTION 4: Timetable & Transfer Service - Boundary & Stress Scenarios
// =============================================================================
console.log('\n--- SECTION 4: Timetable & Transfer Boundary & Stress Tests ---');

function testTimetableAndTransferBoundary() {
  const timetable = new TimetableService();
  const transfer = new TransferService(timetable);

  // 4.1 Timetable conversion edge cases
  assert(timetable.timeStringToMinutes('00:00') === 0, '00:00 is 0 min');
  assert(timetable.timeStringToMinutes('23:59') === 1439, '23:59 is 1439 min');
  assert(timetable.timeStringToMinutes('24:15') === 1455, '24:15 is 1455 min (past midnight)');
  assert(timetable.timeStringToMinutes('') === 0, 'Empty string is 0 min');
  assert(timetable.timeStringToMinutes(null) === 0, 'Null time string is 0 min');
  assert(timetable.timeStringToMinutes('abc') === 0, 'Malformed string is 0 min');

  assert(timetable.minutesToTimeString(0) === '00:00', '0 min is 00:00');
  assert(timetable.minutesToTimeString(1439) === '23:59', '1439 min is 23:59');
  assert(timetable.minutesToTimeString(1455, true) === '00:15', '1455 min wrapped is 00:15');
  assert(timetable.minutesToTimeString(-15, true) === '23:45', 'Negative minutes wrapped properly');
  assert(timetable.minutesToTimeString(NaN) === '00:00', 'NaN minutes returns 00:00');

  // 4.2 Countdown Formatting boundaries
  assert(timetable.formatCountdown(-3).text === '発車済み', 'Diff < -2min is 発車済み');
  assert(timetable.formatCountdown(-0.5).text === '発車直後', 'Diff -30s is 発車直後');
  assert(timetable.formatCountdown(0.3).text === 'まもなく発車', 'Diff 20s is まもなく発車');
  assert(timetable.formatCountdown(1).text === 'あと 1分', 'Diff 1 min is あと 1分');
  assert(timetable.formatCountdown(5).text === 'あと 5分', 'Diff 5 min is あと 5分');
  assert(timetable.formatCountdown(45).text === 'あと 45分', 'Diff 45 min is あと 45分');
  assert(timetable.formatCountdown(125).text === 'あと 2時間5分', 'Diff 125 min is あと 2時間5分');
  assert(timetable.formatCountdown(120).text === 'あと 2時間', 'Diff 120 min is あと 2時間');

  // 4.3 Realtime Delay merging with negative and extreme delays
  const testEntries = [
    { line: '111系統', departureTime: '08:00', busId: '111-1' },
    { line: '111系統', departureTime: '08:15', busId: '111-2' },
    { line: '111系統', departureTime: '08:30', busId: '111-3' }
  ];

  const realtimeBuses = [
    { '@id': '111-1', 'odpt:delay': 300 }, // +5 min delay
    { '@id': '111-2', 'odpt:delay': 0 },   // on time
    { '@id': '111-3', 'odpt:delay': 3600 } // +60 min extreme delay
  ];

  const merged = timetable.mergeRealtimeDelays(testEntries, realtimeBuses);
  assert(merged[0].actualDepartureTime === '08:05', 'Bus 1 actual departure delayed to 08:05');
  assert(merged[1].actualDepartureTime === '08:15', 'Bus 2 actual departure remains 08:15');
  assert(merged[2].actualDepartureTime === '09:30', 'Bus 3 actual departure delayed to 09:30');

  // 4.4 Transfer calculation - Standard case
  const mockSchedules = getMockTimetables('Weekday');
  const transferRes = transfer.calculateTransferRoute({
    leg1Timetable: mockSchedules.line111Outbound,
    leg2Timetable: mockSchedules.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 22, 7, 0, 0)
  });

  assert(transferRes.status === 'ok', 'Transfer calculation returns status ok');
  assert(transferRes.recommended !== null, 'Recommended transfer option found');
  assert(transferRes.recommended.leg1.departureTime === '07:05', 'Leg 1 recommended departure is 07:05');
  assert(transferRes.recommended.leg1.estimatedArrivalTime === '07:20', 'Leg 1 arrival at Kamiooka is 07:20 (15 min)');
  assert(transferRes.recommended.leg2.departureTime === '07:35', 'Leg 2 recommended departure is 07:35 (>= 07:20 + 5m buffer)');
  assert(transferRes.recommended.transferWaitMinutes === 15, 'Transfer wait time is 15 minutes');
  assert(transferRes.alternatives.length > 0, 'Alternative options provided');

  // 4.5 Transfer calculation - Inbound case (Koizumi -> Kamiooka -> Yokodai)
  const transferInbound = transfer.calculateTransferRoute({
    leg1Timetable: mockSchedules.line133Inbound,
    leg2Timetable: mockSchedules.line111Inbound,
    direction: 'inbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 22, 7, 0, 0)
  });

  assert(transferInbound.status === 'ok', 'Inbound transfer calculation returns status ok');
  assert(transferInbound.recommended.leg1.departureTime === '07:05', 'Inbound Leg 1 departure is 07:05');
  assert(transferInbound.recommended.leg1.estimatedArrivalTime === '07:17', 'Inbound Leg 1 arrival at Kamiooka is 07:17 (12 min)');
  assert(transferInbound.recommended.leg2.departureTime === '07:30', 'Inbound Leg 2 departure is 07:30 (>= 07:17 + 5m buffer)');

  // 4.6 Transfer calculation - Massive delay on Leg 1 causes connection switch to later Leg 2 bus
  const delayedTransfer = transfer.calculateTransferRoute({
    leg1Timetable: mockSchedules.line111Outbound,
    leg2Timetable: mockSchedules.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { '111-out-3': 20 }, // 07:05 departure delayed by 20 min -> departs 07:25, arrives Kamiooka 07:40
    currentTime: new Date(2026, 7, 22, 7, 0, 0)
  });

  assert(delayedTransfer.recommended.leg1.actualDepartureTime === '07:25', 'Delayed Leg 1 departs at 07:25');
  assert(delayedTransfer.recommended.leg1.estimatedArrivalTime === '07:40', 'Delayed Leg 1 arrives Kamiooka at 07:40');
  assert(delayedTransfer.recommended.leg2.actualDepartureTime >= '07:45', 'Leg 2 dynamically adjusted to depart >= 07:45 (after buffer)');

  // 4.7 Transfer calculation - End of Day / Midnight Boundary (No buses available)
  const endOfDayTransfer = transfer.calculateTransferRoute({
    leg1Timetable: mockSchedules.line111Outbound,
    leg2Timetable: mockSchedules.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: new Date(2026, 7, 22, 23, 50, 0)
  });

  assert(endOfDayTransfer.status === 'no_buses_available', 'End of day past last bus returns status no_buses_available');
  assert(endOfDayTransfer.recommended === null, 'No recommended bus at end of day');
  assert(endOfDayTransfer.alternatives.length === 0, 'No alternatives at end of day');

  // 4.8 Empty / Null Timetable handling
  const emptyTransfer = transfer.calculateTransferRoute({
    leg1Timetable: [],
    leg2Timetable: [],
    currentTime: new Date()
  });
  assert(emptyTransfer.status === 'no_buses_available', 'Empty timetable gracefully returns no_buses_available');

  try {
    const nullTransfer = transfer.calculateTransferRoute({
      leg1Timetable: null,
      leg2Timetable: null,
      currentTime: new Date()
    });
    assert(nullTransfer.status === 'no_buses_available', 'Null timetable gracefully returns no_buses_available without throwing');
  } catch (err) {
    assert(false, 'Null timetable gracefully returns no_buses_available without throwing', err.message);
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================
async function runAll() {
  await testOdptClientAdversarial();
  testStorageServiceAdversarial();
  testCalendarService120Dates();
  testTimetableAndTransferBoundary();

  console.log('\n================================================================');
  console.log(`🏁 ADVERSARIAL TEST SUMMARY`);
  console.log(`✔ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nFailure Details:');
    failures.forEach((f, idx) => console.error(`${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY!');
  }
}

runAll().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
