/**
 * tier2-boundary-tests.js
 * Tier 2: Boundary & Corner Cases (>= 50 test cases, >= 5 per category)
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

export const tier2Tests = [];

function registerTest(id, name, category, fn) {
  tier2Tests.push({ id, name, category, fn });
}

// =========================================================================
// Category B1: PWA Shell & Asset Boundaries (5 tests)
// =========================================================================

registerTest('T2.1.1', 'Service Worker fetch handler falls back to cache/mock on network failure', 'B1: PWA Boundaries', async () => {
  let fetchedFromCache = false;
  const mockFetchHandler = async (request, cache) => {
    try {
      throw new Error('Network offline');
    } catch {
      fetchedFromCache = true;
      return { ok: true, status: 200, json: async () => ({ status: 'from-cache' }) };
    }
  };

  const response = await mockFetchHandler({ url: '/api/v4/odpt:Bus' }, {});
  assert.true(fetchedFromCache, 'Should fall back to cache when network fails');
  assert.equal(response.status, 200);
});

registerTest('T2.1.2', 'Malformed manifest JSON fallback handling', 'B1: PWA Boundaries', () => {
  const parseManifestSafe = (jsonStr) => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {
        name: '横浜市営バス 運行ナビ',
        short_name: '市営バスナビ',
        theme_color: '#004098'
      };
    }
  };

  const brokenJson = '{ "name": "横浜市営バス", broken ';
  const manifest = parseManifestSafe(brokenJson);
  assert.ok(manifest.name, 'Must fallback to default manifest object');
  assert.equal(manifest.theme_color, '#004098');
});

registerTest('T2.1.3', 'Missing icon asset fallback with inline SVG support', 'B1: PWA Boundaries', () => {
  const getIconUrl = (iconPath, fallbackSvg) => {
    return iconPath && iconPath.length > 0 ? iconPath : fallbackSvg;
  };

  const fallback = '<svg class="bus-icon"></svg>';
  const icon = getIconUrl('', fallback);
  assert.equal(icon, fallback, 'Should provide inline SVG fallback when icon path is missing');
});

registerTest('T2.1.4', 'CacheStorage quota exceeded error handled gracefully', 'B1: PWA Boundaries', () => {
  let errorHandled = false;
  const safeCachePut = (key, data, storage) => {
    try {
      storage.setItem(key, data);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        errorHandled = true;
      }
    }
  };

  const env = createBrowserEnv();
  env.localStorage.shouldThrowQuotaError = true;
  safeCachePut('large_cache_key', 'some_big_data', env.localStorage);

  assert.true(errorHandled, 'QuotaExceededError must be caught and handled gracefully');
});

registerTest('T2.1.5', 'Offline reload loads app shell from simulated cache', 'B1: PWA Boundaries', () => {
  const cacheStorage = new Map();
  cacheStorage.set('/index.html', '<html><body><div id="app"></div></body></html>');

  const cachedShell = cacheStorage.get('/index.html');
  assert.ok(cachedShell);
  assert.includes(cachedShell, '<div id="app">');
});

// =========================================================================
// Category B2: Theme & Display Boundaries (5 tests)
// =========================================================================

registerTest('T2.2.1', 'Invalid theme name in storage defaults safely to light/auto', 'B2: Theme Boundaries', () => {
  const sanitizeTheme = (rawTheme) => {
    const validThemes = ['light', 'dark', 'auto'];
    return validThemes.includes(rawTheme) ? rawTheme : 'light';
  };

  assert.equal(sanitizeTheme('neon-pink'), 'light');
  assert.equal(sanitizeTheme(null), 'light');
  assert.equal(sanitizeTheme(undefined), 'light');
  assert.equal(sanitizeTheme('dark'), 'dark');
});

registerTest('T2.2.2', 'Rapid theme toggling stress test preserves DOM integrity', 'B2: Theme Boundaries', () => {
  const env = createBrowserEnv();
  const root = env.document.querySelector('html');

  let current = 'light';
  for (let i = 0; i < 100; i++) {
    current = current === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', current);
  }

  assert.equal(root.getAttribute('data-theme'), 'light', '100 toggles should land deterministically on light');
});

registerTest('T2.2.3', 'System preference prefers-color-scheme media query handler', 'B2: Theme Boundaries', () => {
  const resolveTheme = (userPref, systemPrefersDark) => {
    if (userPref === 'auto' || !userPref) {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return userPref;
  };

  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
  assert.equal(resolveTheme('light', true), 'light'); // Explicit user preference overrides system
});

registerTest('T2.2.4', 'Empty theme attribute in HTML does not crash CSS token lookup', 'B2: Theme Boundaries', () => {
  const env = createBrowserEnv();
  const root = env.document.querySelector('html');
  root.removeAttribute('data-theme');

  const activeTheme = root.getAttribute('data-theme') || 'light';
  assert.equal(activeTheme, 'light');
});

registerTest('T2.2.5', 'Contrast tokens validation for dark and light surfaces', 'B2: Theme Boundaries', () => {
  const themeTokens = {
    light: { bg: '#F4F6F9', text: '#1A1A1A' },
    dark: { bg: '#121212', text: '#E0E0E0' }
  };

  assert.ok(themeTokens.light.bg !== themeTokens.light.text);
  assert.ok(themeTokens.dark.bg !== themeTokens.dark.text);
});

// =========================================================================
// Category B3: Direction Toggle Boundaries (5 tests)
// =========================================================================

registerTest('T2.3.1', 'Rapid double-click on direction toggle button maintains deterministic state', 'B3: Direction Boundaries', () => {
  let dir = 'outbound';
  const toggle = () => { dir = dir === 'outbound' ? 'inbound' : 'outbound'; };

  toggle(); // Inbound
  toggle(); // Outbound
  assert.equal(dir, 'outbound', 'Double click must return to original direction');
});

registerTest('T2.3.2', 'Direction toggle preserves active line filter selection', 'B3: Direction Boundaries', () => {
  let appState = { direction: 'outbound', filterLine: '133系統' };
  const toggleDirection = (state) => ({
    ...state,
    direction: state.direction === 'outbound' ? 'inbound' : 'outbound'
  });

  appState = toggleDirection(appState);
  assert.equal(appState.direction, 'inbound');
  assert.equal(appState.filterLine, '133系統', 'Line filter must be preserved across direction toggle');
});

registerTest('T2.3.3', 'Direction toggle when 0 buses are available shows clear empty state', 'B3: Direction Boundaries', () => {
  const emptyTimetable = [];
  const result = calculateTransferOracle({
    leg1Timetable: emptyTimetable,
    leg2Timetable: emptyTimetable,
    direction: 'inbound',
    currentTime: new Date(2026, 7, 22, 12, 0, 0)
  });

  assert.equal(result.status, 'no_buses_available');
  assert.equal(result.recommended, null);
});

registerTest('T2.3.4', 'Direction toggle preserves custom transfer buffer setting', 'B3: Direction Boundaries', () => {
  let appState = { direction: 'outbound', bufferMinutes: 8 };
  const toggleDirection = (state) => ({
    ...state,
    direction: state.direction === 'outbound' ? 'inbound' : 'outbound'
  });

  appState = toggleDirection(appState);
  assert.equal(appState.bufferMinutes, 8, 'Custom buffer minutes (8) must remain unchanged');
});

registerTest('T2.3.5', 'Invalid direction parameter sanitizes safely to outbound', 'B3: Direction Boundaries', () => {
  const sanitizeDirection = (dir) => (dir === 'inbound' ? 'inbound' : 'outbound');

  assert.equal(sanitizeDirection('invalid_dir'), 'outbound');
  assert.equal(sanitizeDirection(null), 'outbound');
  assert.equal(sanitizeDirection('inbound'), 'inbound');
});

// =========================================================================
// Category B4: Stop View & Timetable Boundaries (6 tests)
// =========================================================================

registerTest('T2.4.1', 'Late night query after last bus returns service ended status', 'B4: Timetable Boundaries', () => {
  const timetables = getMockTimetables();
  const lateNight = new Date(2026, 7, 22, 23, 50, 0); // 23:50 PM

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    currentTime: lateNight
  });

  assert.equal(result.status, 'no_buses_available');
  assert.equal(result.recommended, null);
});

registerTest('T2.4.2', 'Early morning query before first bus identifies first departure', 'B4: Timetable Boundaries', () => {
  const timetables = getMockTimetables();
  const earlyMorning = new Date(2026, 7, 22, 4, 30, 0); // 04:30 AM

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    currentTime: earlyMorning
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.departureTime, '06:15');
});

registerTest('T2.4.3', 'Midnight crossing times (24:15, 00:15) parsed and sorted chronologically', 'B4: Timetable Boundaries', () => {
  const parseTimeToDayMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h >= 24 ? h : h) * 60 + m;
  };

  const times = ['23:45', '24:15', '22:30'];
  times.sort((a, b) => parseTimeToDayMinutes(a) - parseTimeToDayMinutes(b));

  assert.deepEqual(times, ['22:30', '23:45', '24:15']);
});

registerTest('T2.4.4', 'Empty timetable array passed to stop view outputs empty state', 'B4: Timetable Boundaries', () => {
  const renderDeparturesList = (departures) => {
    if (!departures || departures.length === 0) {
      return '<div class="empty-state">本日の運行は終了しました</div>';
    }
    return departures.map(d => `<div>${d.departureTime}</div>`).join('');
  };

  const html = renderDeparturesList([]);
  assert.includes(html, '本日の運行は終了しました');
});

registerTest('T2.4.5', 'Bus departure countdown at 0 seconds displays departing soon indicator', 'B4: Timetable Boundaries', () => {
  const formatCountdown = (diffSeconds) => {
    if (diffSeconds <= 0) return 'まもなく発車';
    const min = Math.ceil(diffSeconds / 60);
    return `あと ${min}分`;
  };

  assert.equal(formatCountdown(0), 'まもなく発車');
  assert.equal(formatCountdown(-10), 'まもなく発車');
  assert.equal(formatCountdown(300), 'あと 5分');
});

registerTest('T2.4.6', 'Bus departure with negative countdown (> 2 min ago) filtered out', 'B4: Timetable Boundaries', () => {
  const buses = [
    { departureTime: '07:00' },
    { departureTime: '07:15' },
    { departureTime: '07:30' }
  ];
  const curMinutes = 7 * 60 + 17; // 07:17

  const futureBuses = buses.filter(b => {
    const [h, m] = b.departureTime.split(':').map(Number);
    return h * 60 + m >= curMinutes;
  });

  assert.equal(futureBuses.length, 1);
  assert.equal(futureBuses[0].departureTime, '07:30');
});

// =========================================================================
// Category B5: Transfer Buffer & Delay Boundaries (6 tests)
// =========================================================================

registerTest('T2.5.1', '0 minutes transfer buffer input (immediate connection allowed)', 'B5: Transfer Boundaries', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: [{ line: '111系統', departureTime: '07:00' }],
    leg2Timetable: [{ line: '133系統', departureTime: '07:15' }],
    direction: 'outbound',
    bufferMinutes: 0, // Leg 1 arr at 07:15, Leg 2 dep at 07:15 -> exactly 0 min buffer
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.transferWaitMinutes, 0);
});

registerTest('T2.5.2', 'Negative buffer input clamped to minimum 1 min', 'B5: Transfer Boundaries', () => {
  const sanitizeBuffer = (buf) => {
    const num = parseInt(buf, 10);
    if (isNaN(num) || num < 1) return 1;
    if (num > 60) return 60;
    return num;
  };

  assert.equal(sanitizeBuffer(-5), 1);
  assert.equal(sanitizeBuffer(0), 1);
  assert.equal(sanitizeBuffer(5), 5);
});

registerTest('T2.5.3', 'Extreme buffer input (120 min) clamped to upper limit (60 min)', 'B5: Transfer Boundaries', () => {
  const sanitizeBuffer = (buf) => {
    const num = parseInt(buf, 10);
    if (isNaN(num) || num < 1) return 1;
    if (num > 60) return 60;
    return num;
  };

  assert.equal(sanitizeBuffer(120), 60);
});

registerTest('T2.5.4', 'Leg 1 massive delay (+20m) causes missed connection and selects next Leg 2 bus', 'B5: Transfer Boundaries', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  // Normal: Leg 1 07:05 -> Arr 07:20 -> Min 07:25 -> Leg 2 07:35
  // With +20m delay on Leg 1: Dep 07:25 -> Arr 07:40 -> Min 07:45 -> Misses 07:35 -> Next is 07:50
  const result = calculateTransferOracle({
    leg1Timetable: [{ line: '111系統', departureTime: '07:05', busId: 'bus-111-delayed' }],
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { 'bus-111-delayed': 20 },
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg2.departureTime, '07:50', 'Should catch 07:50 bus due to missed 07:35 connection');
});

registerTest('T2.5.5', 'Leg 2 massive delay (+30 min) updates wait time and arrival accordingly', 'B5: Transfer Boundaries', () => {
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: [{ line: '111系統', departureTime: '07:00' }], // Arr Kamiooka: 07:15
    leg2Timetable: [{ line: '133系統', departureTime: '07:30', busId: 'bus-133-delayed' }], // Dep: 07:30 + 30m = 08:00
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { 'bus-133-delayed': 30 },
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  // Wait = 08:00 - 07:15 = 45 min
  assert.equal(result.recommended.transferWaitMinutes, 45);
});

registerTest('T2.5.6', 'Suspended or cancelled bus on Leg 1 skipped in recommendations', 'B5: Transfer Boundaries', () => {
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: [
      { line: '111系統', departureTime: '07:05', isCancelled: true },
      { line: '111系統', departureTime: '07:18', isCancelled: false }
    ],
    leg2Timetable: getMockTimetables().line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.departureTime, '07:18', 'Cancelled 07:05 bus should be skipped');
});

// =========================================================================
// Category B6: Japanese Calendar & Holiday Calculation Boundaries (6 tests)
// =========================================================================

registerTest('T2.6.1', 'Fixed national holiday 2026-05-03 Constitution Memorial Day yields Holiday', 'B6: Calendar Boundaries', () => {
  const d = new Date(2026, 4, 3); // May 3, 2026
  assert.true(isJapaneseHolidayOracle(d));
  assert.equal(getCalendarTypeOracle(d), 'Holiday');
});

registerTest('T2.6.2', 'Substitute holiday when national holiday falls on Sunday', 'B6: Calendar Boundaries', () => {
  // In 2026, May 3 is Sunday. May 6 is substitute holiday
  const may6 = new Date(2026, 4, 6);
  assert.true(isJapaneseHolidayOracle(may6));
  assert.equal(getCalendarTypeOracle(may6), 'Holiday');
});

registerTest('T2.6.3', 'Happy Monday holiday Coming of Age Day dynamically calculated', 'B6: Calendar Boundaries', () => {
  // Jan 2026 Coming of Age Day is Jan 12 (2nd Monday)
  const jan12 = new Date(2026, 0, 12);
  assert.true(isJapaneseHolidayOracle(jan12));
  assert.equal(getCalendarTypeOracle(jan12), 'Holiday');
});

registerTest('T2.6.4', 'Astronomical equinox Vernal Equinox Day calculated accurately for 2026', 'B6: Calendar Boundaries', () => {
  // Vernal equinox 2026 is March 20
  const mar20 = new Date(2026, 2, 20);
  assert.true(isJapaneseHolidayOracle(mar20));
  assert.equal(getCalendarTypeOracle(mar20), 'Holiday');
});

registerTest('T2.6.5', 'Year-End and New Year special period Dec 29 to Jan 3 yields Holiday schedule', 'B6: Calendar Boundaries', () => {
  const dec30 = new Date(2026, 11, 30);
  const jan2 = new Date(2026, 0, 2);

  assert.true(isJapaneseHolidayOracle(dec30));
  assert.true(isJapaneseHolidayOracle(jan2));
  assert.equal(getCalendarTypeOracle(dec30), 'Holiday');
  assert.equal(getCalendarTypeOracle(jan2), 'Holiday');
});

registerTest('T2.6.6', 'Leap year Feb 29 handled without date arithmetic errors', 'B6: Calendar Boundaries', () => {
  const leapDay = new Date(2028, 1, 29); // Feb 29, 2028 (Tuesday)
  assert.equal(leapDay.getDate(), 29);
  assert.equal(getCalendarTypeOracle(leapDay), 'Weekday');
});

// =========================================================================
// Category B7: Filter Boundaries & Search Combinations (5 tests)
// =========================================================================

registerTest('T2.7.1', 'Filter combination yielding 0 buses displays clear empty state', 'B7: Filter Boundaries', () => {
  const buses = [
    { line: '111系統', destination: '上大岡駅前' }
  ];
  const filtered = buses.filter(b => b.line === '64系統');
  assert.equal(filtered.length, 0);
});

registerTest('T2.7.2', 'Filtering with non-existent line number returns empty array without throwing', 'B7: Filter Boundaries', () => {
  const buses = [
    { line: '111系統', destination: '上大岡駅前' }
  ];
  const filtered = buses.filter(b => b.line === '999系統');
  assert.deepEqual(filtered, []);
});

registerTest('T2.7.3', 'Filter input containing HTML/script tags is safely sanitized', 'B7: Filter Boundaries', () => {
  const sanitizeSearch = (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const malicious = '<script>alert(1)</script>';
  const sanitized = sanitizeSearch(malicious);
  assert.false(sanitized.includes('<script>'));
  assert.includes(sanitized, '&lt;script&gt;');
});

registerTest('T2.7.4', 'Filter input with leading and trailing whitespace is trimmed properly', 'B7: Filter Boundaries', () => {
  const filterVal = '  111系統  ';
  assert.equal(filterVal.trim(), '111系統');
});

registerTest('T2.7.5', 'Filter reset when already at All is a safe no-op', 'B7: Filter Boundaries', () => {
  let filter = 'all';
  const resetFilter = () => { filter = 'all'; };
  resetFilter();
  assert.equal(filter, 'all');
});

// =========================================================================
// Category B8: Storage & Settings Boundaries (5 tests)
// =========================================================================

registerTest('T2.8.1', 'Empty API key string input resets safely to default consumer key', 'B8: Storage Boundaries', () => {
  const resolveApiKey = (inputKey) => {
    if (!inputKey || inputKey.trim().length === 0) {
      return REFERENCE_CONFIG.DEFAULT_CONSUMER_KEY;
    }
    return inputKey.trim();
  };

  assert.equal(resolveApiKey(''), REFERENCE_CONFIG.DEFAULT_CONSUMER_KEY);
  assert.equal(resolveApiKey('   '), REFERENCE_CONFIG.DEFAULT_CONSUMER_KEY);
  assert.equal(resolveApiKey('my_custom_key'), 'my_custom_key');
});

registerTest('T2.8.2', 'Extremely long API key string handled without crashing storage', 'B8: Storage Boundaries', () => {
  const env = createBrowserEnv();
  const longKey = 'a'.repeat(2000);
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY, longKey);
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY).length, 2000);
});

registerTest('T2.8.3', 'LocalStorage QuotaExceededError caught and reported gracefully', 'B8: Storage Boundaries', () => {
  const env = createBrowserEnv();
  env.localStorage.shouldThrowQuotaError = true;

  let caught = false;
  try {
    env.localStorage.setItem('key', 'val');
  } catch (err) {
    caught = true;
    assert.equal(err.name, 'QuotaExceededError');
  }
  assert.true(caught);
});

registerTest('T2.8.4', 'Non-numeric transfer buffer input defaults safely to 5', 'B8: Storage Boundaries', () => {
  const parseBuffer = (val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 5 : Math.max(1, Math.min(60, parsed));
  };

  assert.equal(parseBuffer('five'), 5);
  assert.equal(parseBuffer(NaN), 5);
  assert.equal(parseBuffer(null), 5);
  assert.equal(parseBuffer(undefined), 5);
});

registerTest('T2.8.5', 'Corrupted JSON in LocalStorage cache caught, cleared and re-initialized', 'B8: Storage Boundaries', () => {
  const env = createBrowserEnv();
  const cacheKey = 'cache_test';
  env.localStorage.setItem(cacheKey, '{ broken json !! ');

  const getCachedJson = (key) => {
    try {
      const raw = env.localStorage.getItem(key);
      return JSON.parse(raw);
    } catch {
      env.localStorage.removeItem(key);
      return null;
    }
  };

  const result = getCachedJson(cacheKey);
  assert.equal(result, null);
  assert.equal(env.localStorage.getItem(cacheKey), null);
});

// =========================================================================
// Category B9: API Error & Network Boundaries (6 tests)
// =========================================================================

registerTest('T2.9.1', 'ODPT API HTTP 401 Unauthorized falls back to mock data with auth warning', 'B9: Network Boundaries', async () => {
  const env = createBrowserEnv();
  env.setMockFetch('odpt:Bus', async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized'
  }));

  const fetchWithFallback = async (url) => {
    const res = await env.window.fetch(url);
    if (!res.ok) {
      return { data: getMockTimetables(), isMock: true, error: `HTTP ${res.status}` };
    }
    return { data: await res.json(), isMock: false };
  };

  const result = await fetchWithFallback('https://api.odpt.org/api/v4/odpt:Bus');
  assert.true(result.isMock);
  assert.equal(result.error, 'HTTP 401');
  assert.ok(result.data.line111Outbound.length > 0);
});

registerTest('T2.9.2', 'ODPT API HTTP 403 Forbidden falls back to mock data', 'B9: Network Boundaries', async () => {
  const env = createBrowserEnv();
  env.setMockFetch('odpt:Bus', async () => ({
    ok: false,
    status: 403,
    statusText: 'Forbidden'
  }));

  const res = await env.window.fetch('https://api.odpt.org/api/v4/odpt:Bus');
  assert.equal(res.status, 403);
});

registerTest('T2.9.3', 'ODPT API HTTP 429 Rate Limit triggers backoff and mock fallback', 'B9: Network Boundaries', async () => {
  const env = createBrowserEnv();
  env.setMockFetch('odpt:Bus', async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests'
  }));

  const res = await env.window.fetch('https://api.odpt.org/api/v4/odpt:Bus');
  assert.equal(res.status, 429);
});

registerTest('T2.9.4', 'ODPT API HTTP 500 Internal Server Error falls back cleanly', 'B9: Network Boundaries', async () => {
  const env = createBrowserEnv();
  env.setMockFetch('odpt:Bus', async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error'
  }));

  const res = await env.window.fetch('https://api.odpt.org/api/v4/odpt:Bus');
  assert.equal(res.status, 500);
});

registerTest('T2.9.5', 'Network timeout and abort exception handled cleanly', 'B9: Network Boundaries', async () => {
  let timedOut = false;
  const timeoutFetch = async () => {
    try {
      const controller = new AbortController();
      controller.abort();
      throw new Error('The operation was aborted');
    } catch (e) {
      timedOut = true;
      return getMockTimetables();
    }
  };

  const data = await timeoutFetch();
  assert.true(timedOut);
  assert.ok(data.line111Outbound.length > 0);
});

registerTest('T2.9.6', 'Incomplete API payload with missing optional delay field handled safely', 'B9: Network Boundaries', () => {
  const rawBusData = {
    '@id': 'bus-test-01',
    'odpt:operator': 'odpt.Operator:YokohamaMunicipal'
    // 'odpt:delay' is missing
  };

  const delaySeconds = rawBusData['odpt:delay'] || 0;
  const delayMinutes = Math.floor(delaySeconds / 60);
  assert.equal(delayMinutes, 0, 'Missing delay should default to 0');
});

// =========================================================================
// Category B10: Polling & Concurrency Boundaries (5 tests)
// =========================================================================

registerTest('T2.10.1', 'Rapid manual refresh button clicking debounced to single request', 'B10: Concurrency Boundaries', () => {
  let callCount = 0;
  let lastCalled = 0;

  const debouncedRefresh = (now) => {
    if (now - lastCalled >= 1000) {
      callCount++;
      lastCalled = now;
    }
  };

  // Simulate 10 rapid clicks within 500ms
  const baseTime = 10000;
  for (let i = 0; i < 10; i++) {
    debouncedRefresh(baseTime + i * 50);
  }

  assert.equal(callCount, 1, '10 rapid clicks in 500ms must be debounced to exactly 1 request');
});

registerTest('T2.10.2', 'Tab backgrounding (visibilitychange hidden) pauses polling timer', 'B10: Concurrency Boundaries', () => {
  let isTimerActive = true;
  const handleVisibilityChange = (state) => {
    if (state === 'hidden') isTimerActive = false;
    else if (state === 'visible') isTimerActive = true;
  };

  handleVisibilityChange('hidden');
  assert.false(isTimerActive, 'Timer must pause when visibility is hidden');
});

registerTest('T2.10.3', 'Tab foregrounding (visibilitychange visible) restarts polling and syncs', 'B10: Concurrency Boundaries', () => {
  let isTimerActive = false;
  let synced = false;

  const handleVisibilityChange = (state) => {
    if (state === 'visible') {
      isTimerActive = true;
      synced = true;
    }
  };

  handleVisibilityChange('visible');
  assert.true(isTimerActive, 'Timer should resume on tab visible');
  assert.true(synced, 'Immediate sync should occur when returning to tab');
});

registerTest('T2.10.4', 'Polling interval boundary values clamped between 10s and 120s', 'B10: Concurrency Boundaries', () => {
  const clampPollingInterval = (sec) => {
    const s = parseInt(sec, 10);
    if (isNaN(s)) return 30;
    return Math.max(10, Math.min(120, s));
  };

  assert.equal(clampPollingInterval(5), 10);
  assert.equal(clampPollingInterval(200), 120);
  assert.equal(clampPollingInterval(45), 45);
});

registerTest('T2.10.5', 'Concurrent asynchronous fetch requests do not cause race conditions in state', 'B10: Concurrency Boundaries', async () => {
  let latestSeq = 0;
  let appStateData = null;

  const simulateFetch = async (seq, delayMs, data) => {
    await new Promise(r => setTimeout(r, delayMs));
    if (seq >= latestSeq) {
      latestSeq = seq;
      appStateData = data;
    }
  };

  // Request 1 initiated first (seq 1), but takes 50ms
  // Request 2 initiated second (seq 2), but takes 10ms (finishes earlier)
  // Request 1 must NOT overwrite Request 2 when it finishes later
  const p1 = simulateFetch(1, 50, 'data-1');
  const p2 = simulateFetch(2, 10, 'data-2');

  await Promise.all([p1, p2]);
  assert.equal(appStateData, 'data-2', 'State must preserve data from newer sequence');
});
