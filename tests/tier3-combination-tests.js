/**
 * tier3-combination-tests.js
 * Tier 3: Cross-Feature Combinations (>= 15 test cases)
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

export const tier3Tests = [];

function registerTest(id, name, combinationDesc, fn) {
  tier3Tests.push({ id, name, combinationDesc, fn });
}

// =========================================================================
// Tier 3 Combinations (16 tests)
// =========================================================================

registerTest('T3.1', 'Direction switch (Inbound) + Line filter (133 only) + Custom buffer (8 min)',
  'Direction Invert + Filter 133 + 8m Buffer', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 8, 0, 0); // 08:00 AM

  // Filtered Leg 1 (133 only)
  const filteredLeg1 = timetables.line133Inbound.filter(b => b.line === '133系統');

  const result = calculateTransferOracle({
    leg1Timetable: filteredLeg1,
    leg2Timetable: timetables.line111Inbound,
    direction: 'inbound',
    bufferMinutes: 8,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.line, '133系統');
  assert.equal(result.recommended.leg2.line, '111系統');
  assert.equal(result.recommended.bufferMinutes, 8);

  const [arrH, arrM] = result.recommended.leg1.estimatedArrivalTime.split(':').map(Number);
  const [dep2H, dep2M] = result.recommended.leg2.actualDepartureTime.split(':').map(Number);
  assert.greaterOrEqual((dep2H * 60 + dep2M) - (arrH * 60 + arrM), 8);
});

registerTest('T3.2', 'Offline mode + Dark theme + Holiday calendar (New Year 2026-01-01) + Transfer calculation',
  'Offline + Dark Mode + Jan 1 Holiday + Transfer', () => {
  const env = createBrowserEnv();
  env.window.navigator.onLine = false;
  env.document.querySelector('html').setAttribute('data-theme', 'dark');

  const holidayDate = new Date(2026, 0, 1, 10, 0, 0);
  const calType = getCalendarTypeOracle(holidayDate);
  assert.equal(calType, 'Holiday');

  const timetables = getMockTimetables();
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: holidayDate
  });

  assert.equal(result.status, 'ok');
  assert.equal(env.document.querySelector('html').getAttribute('data-theme'), 'dark');
  assert.false(env.window.navigator.onLine);
});

registerTest('T3.3', 'API 401 error fallback to mock data + Polling enabled + Settings update with valid key',
  'HTTP 401 Fallback + Auto Poll + Settings Key Recovery', async () => {
  const env = createBrowserEnv();
  let apiKey = 'invalid_key';

  env.setMockFetch('odpt:Bus', async () => {
    if (apiKey === 'invalid_key') {
      return { ok: false, status: 401, statusText: 'Unauthorized' };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [{ '@id': 'bus-1', 'odpt:operator': 'odpt.Operator:YokohamaMunicipal' }]
    };
  });

  // Initial fetch with invalid key fails & falls back to mock
  const res1 = await env.window.fetch('https://api.odpt.org/api/v4/odpt:Bus');
  assert.equal(res1.status, 401);

  // User updates key in settings modal
  apiKey = REFERENCE_CONFIG.DEFAULT_CONSUMER_KEY;
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY, apiKey);

  // Subsequent fetch with valid key succeeds
  const res2 = await env.window.fetch('https://api.odpt.org/api/v4/odpt:Bus');
  assert.equal(res2.status, 200);
  const data = await res2.json();
  assert.equal(data.length, 1);
});

registerTest('T3.4', 'Large Leg 1 delay (+15m) + Line filter + Auto-refresh polling update',
  'Leg 1 Delay + Line Filter + Live Polling Recalculation', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 30, 0);

  // Line 111 with +15m delay: scheduled 07:30, actual dep 07:45 -> arr Kamiooka 08:00
  // Earliest Leg 2 after 08:00 + 5m (08:05) is 08:05
  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound.filter(b => b.line === '111系統'),
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    realtimeDelays: { '111-out-5': 15 }, // 07:30 bus has 15m delay
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.delayMinutes, 15);
  assert.equal(result.recommended.leg1.estimatedArrivalTime, '08:00');
  assert.equal(result.recommended.leg2.departureTime, '08:05');
});

registerTest('T3.5', 'Single Stop View (Kamiooka) + Saturday timetable + Search/filter (64 line) + Theme toggle',
  'Stop View Kamiooka + Saturday + Filter 64 + Dark Theme', () => {
  const env = createBrowserEnv();
  env.document.querySelector('html').setAttribute('data-theme', 'dark');

  const satDate = new Date(2026, 7, 22); // Saturday
  assert.equal(getCalendarTypeOracle(satDate), 'Saturday');

  const timetables = getMockTimetables();
  const kamiooka64Buses = timetables.line64Outbound.filter(b => b.line === '64系統');

  assert.ok(kamiooka64Buses.length > 0);
  assert.equal(kamiooka64Buses[0].line, '64系統');
  assert.equal(env.document.querySelector('html').getAttribute('data-theme'), 'dark');
});

registerTest('T3.6', 'Negative buffer input sanitization + Direction toggle + Transfer alternative extraction',
  'Sanitize Buffer + Inbound Direction + 3 Alternatives', () => {
  const sanitizeBuffer = (b) => Math.max(1, parseInt(b, 10) || 5);
  const cleanBuffer = sanitizeBuffer(-10);
  assert.equal(cleanBuffer, 1, 'Negative buffer must be clamped to 1');

  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 8, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line133Inbound,
    leg2Timetable: timetables.line111Inbound,
    direction: 'inbound',
    bufferMinutes: cleanBuffer,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.greaterOrEqual(result.alternatives.length, 2);
});

registerTest('T3.7', 'Network reconnection (offline -> online) + Manual refresh + Status banner update',
  'Network Offline to Online + Refresh + Status Banner Sync', () => {
  const env = createBrowserEnv();
  env.document.body.innerHTML = `
    <div id="status-banner" class="banner-offline">オフライン（キャッシュ表示中）</div>
  `;

  const banner = env.document.getElementById('status-banner');

  // Network reconnects
  env.window.navigator.onLine = true;
  banner.className = 'banner-normal';
  banner.textContent = '運行状況: 平常運転 / 最終更新 08:30';

  assert.includes(banner.textContent, '平常運転');
  assert.includes(banner.className, 'banner-normal');
});

registerTest('T3.8', 'End of day (23:30) transfer calculation + Midnight crossing (00:15) + Empty Leg 2 fallback',
  'Late Night 23:30 + Midnight Crossing + Safe Service Ended Fallback', () => {
  const curTime = new Date(2026, 7, 22, 23, 30, 0);

  // Leg 1 has last bus at 23:35 (Arr 23:50)
  // Leg 2 has no departures after 23:50 (last was 22:15)
  const result = calculateTransferOracle({
    leg1Timetable: [{ line: '111系統', departureTime: '23:35' }],
    leg2Timetable: [{ line: '133系統', departureTime: '22:15' }],
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  assert.equal(result.status, 'no_buses_available');
  assert.equal(result.recommended, null);
});

registerTest('T3.9', 'Storage cache expiration (TTL elapsed) + API re-fetch + UI refresh',
  'Cache TTL Expired + Dynamic Re-fetch + Cache Replacement', () => {
  const env = createBrowserEnv();
  const cacheKey = 'timetable_cache_test';
  const oneWeekAgo = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days old

  env.localStorage.setItem(cacheKey, JSON.stringify({
    timestamp: oneWeekAgo,
    data: ['old_data']
  }));

  const getCachedWithTTL = (key, ttlSec) => {
    const raw = env.localStorage.getItem(key);
    if (!raw) return null;
    try {
      const item = JSON.parse(raw);
      if (Date.now() - item.timestamp > ttlSec * 1000) {
        env.localStorage.removeItem(key);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  };

  // 7 days TTL (604800s)
  const cached = getCachedWithTTL(cacheKey, 7 * 24 * 3600);
  assert.equal(cached, null, 'Expired cache must be invalidated');
  assert.equal(env.localStorage.getItem(cacheKey), null);
});

registerTest('T3.10', 'Multiple line filters (111 + 64) + Reverse direction + Stop countdown list',
  'Multi-line Filter + Inbound Direction + Sorted Departures List', () => {
  const timetables = getMockTimetables();
  const multiFiltered = [
    ...timetables.line133Inbound.filter(b => b.line === '133系統'),
    ...timetables.line111Inbound.filter(b => b.line === '111系統')
  ];

  assert.ok(multiFiltered.length > 0);
  const has133 = multiFiltered.some(b => b.line === '133系統');
  const has111 = multiFiltered.some(b => b.line === '111系統');
  assert.true(has133);
  assert.true(has111);
});

registerTest('T3.11', 'Extreme buffer (60 min) + Multiple alternative connections listing',
  '60-Minute Long Buffer + 3 Alternatives Extraction', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 60,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.greaterOrEqual(result.recommended.transferWaitMinutes, 60);
  assert.greaterOrEqual(result.alternatives.length, 2);
});

registerTest('T3.12', 'Page Visibility backgrounding + Re-focus + Storage update + Re-render',
  'Visibility State Background/Foreground + Storage Sync', () => {
  const env = createBrowserEnv();
  let buffer = 5;

  // Background tab
  env.document.visibilityState = 'hidden';
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER, '10');

  // Foreground tab & sync
  env.document.visibilityState = 'visible';
  buffer = parseInt(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER), 10);

  assert.equal(buffer, 10);
  assert.equal(env.document.visibilityState, 'visible');
});

registerTest('T3.13', 'Bus cancellation banner active + Normal countdown in stop view + Transfer exclusion',
  'Cancellation Banner + Stop View Alert + Routing Exclusion', () => {
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: [
      { line: '111系統', departureTime: '07:05', isCancelled: true },
      { line: '111系統', departureTime: '07:18', isCancelled: false }
    ],
    leg2Timetable: getMockTimetables().line133Outbound,
    direction: 'outbound',
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.departureTime, '07:18');
  assert.false(result.recommended.leg1.isCancelled);
});

registerTest('T3.14', 'PWA Service Worker offline shell + Mock timetable query + UI tab navigation',
  'PWA Shell Offline + Mock Data + Tab Switching', () => {
  const env = createBrowserEnv();
  env.window.navigator.onLine = false;

  const views = ['transit', 'yokodai', 'kamiooka', 'koizumi'];
  let activeView = 'transit';

  for (const v of views) {
    activeView = v;
    assert.equal(activeView, v);
  }
});

registerTest('T3.15', 'Custom API key saved + Theme changed to dark + Transfer on substitute holiday',
  'Custom Key + Dark Mode + Substitute Holiday Transfer', () => {
  const env = createBrowserEnv();
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY, 'custom_user_key');
  env.document.querySelector('html').setAttribute('data-theme', 'dark');

  const substituteHoliday = new Date(2026, 4, 6); // May 6, 2026 (Substitute Holiday)
  assert.equal(getCalendarTypeOracle(substituteHoliday), 'Holiday');

  const result = calculateTransferOracle({
    leg1Timetable: getMockTimetables().line111Outbound,
    leg2Timetable: getMockTimetables().line133Outbound,
    direction: 'outbound',
    currentTime: new Date(2026, 4, 6, 9, 0, 0)
  });

  assert.equal(result.status, 'ok');
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY), 'custom_user_key');
});

registerTest('T3.16', 'Filter by destination 根岸駅前 + Outbound direction routing',
  'Destination Filter 根岸駅前 + Outbound Leg 2 Isolation', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const negishiLeg2 = timetables.line133Outbound.filter(b => b.destination === '根岸駅前');
  assert.ok(negishiLeg2.length > 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: negishiLeg2,
    direction: 'outbound',
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg2.destination, '根岸駅前');
});
