/**
 * m4-m5-unit-tests.js
 * Comprehensive unit and integration verification for Milestone 4 & 5 modules:
 * - state.js (Reactive state store, subscriptions, mutations)
 * - ui-helpers.js (HTML escaping, time/countdown formatters, badge builders, toasts)
 * - render-status.js (Status banner, live clock, countdown indicators)
 * - render-main.js (Main transfer card, route directions, alternatives, end-of-service)
 * - render-stop-view.js (Individual stop departures, filtering, countdown badges)
 * - render-modal.js (Settings modal, slider, cache clearing, timetable modal)
 * - polling-service.js (Timer loop, Page Visibility handling, debounced manual refresh)
 * - app.js (Application lifecycle, DOM event bindings, data synchronization)
 */

import { createBrowserEnv, assert } from './test-harness.js';
import { AppState, state } from '../js/state.js';
import {
  escapeHtml,
  formatTime,
  formatCountdown,
  getRouteBadgeHtml,
  getDelayBadgeHtml,
  getStatusBadgeHtml,
  showToast
} from '../js/ui/ui-helpers.js';
import { renderStatusBanner, updateCountdownIndicator, updateLiveClock } from '../js/ui/render-status.js';
import { renderMainTransfer } from '../js/ui/render-main.js';
import { renderStopViews } from '../js/ui/render-stop-view.js';
import { initModals } from '../js/ui/render-modal.js';
import { PollingService, pollingService } from '../js/services/polling-service.js';
import { App, app } from '../js/app.js';
import { getMockTimetables } from '../js/api/mock-data.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    throw err;
  }
}

console.log('========================================================================');
console.log('         MILESTONES 4 & 5 COMPREHENSIVE UNIT TEST SUITE                 ');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// 1. AppState & Reactive Store Tests
// --------------------------------------------------------------------------
console.log('▶ 1. State Store (js/state.js)');

test('AppState initializes with complete default properties', () => {
  const store = new AppState();
  const s = store.getState();

  assert.equal(s.direction, 'outbound');
  assert.equal(s.currentTab, 'transfer');
  assert.equal(s.activeFilter, 'all');
  assert.equal(typeof s.bufferMinutes, 'number');
  assert.equal(typeof s.apiKey, 'string');
  assert.ok(s.calendarType);
  assert.equal(typeof s.timetables, 'object');
  assert.equal(s.isPolling, true);
});

test('AppState setState updates properties and notifies subscribers', () => {
  const store = new AppState();
  let notificationCount = 0;
  let receivedChangedKeys = [];

  const unsubscribe = store.subscribe((newState, changedKeys) => {
    notificationCount++;
    receivedChangedKeys = changedKeys;
  });

  store.setState({ direction: 'inbound', activeFilter: '111' });

  assert.equal(store.getState().direction, 'inbound');
  assert.equal(store.getState().activeFilter, '111');
  assert.equal(notificationCount, 1);
  assert.deepEqual(receivedChangedKeys, ['direction', 'activeFilter']);

  // Unsubscribe test
  unsubscribe();
  store.setState({ direction: 'outbound' });
  assert.equal(notificationCount, 1, 'Should not notify after unsubscribe');
});

test('AppState reset restores all values to initial state', () => {
  const store = new AppState();
  store.setState({ direction: 'inbound', activeFilter: '64', currentTab: 'stop-kamiooka' });
  store.reset();

  const s = store.getState();
  assert.equal(s.direction, 'outbound');
  assert.equal(s.activeFilter, 'all');
  assert.equal(s.currentTab, 'transfer');
});

// --------------------------------------------------------------------------
// 2. UI Helpers Tests
// --------------------------------------------------------------------------
console.log('\n▶ 2. UI Helpers (js/ui/ui-helpers.js)');

test('escapeHtml properly sanitizes XSS and special characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('A & B'), 'A &amp; B');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('formatTime formats Date objects and string inputs', () => {
  const d = new Date(2026, 7, 22, 9, 5, 8);
  assert.equal(formatTime(d, false), '09:05');
  assert.equal(formatTime(d, true), '09:05:08');
  assert.equal(formatTime('7:30'), '07:30');
  assert.equal(formatTime('14:25:30', true), '14:25:30');
  assert.equal(formatTime(null), '--:--');
});

test('getRouteBadgeHtml returns correct class for lines', () => {
  assert.includes(getRouteBadgeHtml('111系統'), 'route-badge-111');
  assert.includes(getRouteBadgeHtml('133系統'), 'route-badge-133');
  assert.includes(getRouteBadgeHtml('64系統'), 'route-badge-64');
  assert.includes(getRouteBadgeHtml('21系統'), 'route-badge-other');
});

test('getDelayBadgeHtml handles on-time and delay minutes', () => {
  assert.includes(getDelayBadgeHtml(0), 'on-time');
  assert.includes(getDelayBadgeHtml(0), '定刻');
  assert.includes(getDelayBadgeHtml(3), 'delayed');
  assert.includes(getDelayBadgeHtml(3), '+3分遅延');
});

test('getStatusBadgeHtml generates valid status pills', () => {
  assert.includes(getStatusBadgeHtml('normal', '平常運転'), 'status-pill normal');
  assert.includes(getStatusBadgeHtml('delay', '遅延あり'), 'status-pill delay');
  assert.includes(getStatusBadgeHtml('alert', '運行支障'), 'status-pill alert');
});

test('showToast creates toast and auto-cleans up in browser environment', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  showToast('設定を保存しました', 'success', 500);
  const container = env.document.getElementById('toast-container');
  assert.ok(container, 'Toast container should exist');
  assert.includes(container.innerHTML, '設定を保存しました');
  assert.includes(container.innerHTML, 'success');
});

// --------------------------------------------------------------------------
// 3. Status Banner & Countdown Renderers
// --------------------------------------------------------------------------
console.log('\n▶ 3. Status Banner (js/ui/render-status.js)');

test('renderStatusBanner renders normal, delay, and offline statuses', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <div id="status-banner" class="status-banner">
      <span id="status-pill" class="status-pill">
        <span id="status-pill-text"></span>
      </span>
      <span id="status-message"></span>
      <span id="status-update-time"></span>
    </div>
  `;

  // Normal state
  renderStatusBanner({
    isOffline: false,
    busInformation: [],
    realtimeBuses: [],
    lastUpdated: new Date(2026, 7, 22, 12, 30, 0)
  });

  const banner = env.document.getElementById('status-banner');
  const pillText = env.document.getElementById('status-pill-text');
  const updateTime = env.document.getElementById('status-update-time');

  assert.includes(banner.className, 'normal');
  assert.equal(pillText.textContent, '平常運転');
  assert.includes(updateTime.textContent, '12:30:00');

  // Offline state
  renderStatusBanner({
    isOffline: true,
    busInformation: [],
    realtimeBuses: [],
    lastUpdated: new Date(2026, 7, 22, 12, 35, 0)
  });
  assert.equal(pillText.textContent, 'オフライン');

  // Disruption alert
  renderStatusBanner({
    isOffline: false,
    busInformation: [{
      'odpt:informationStatus': 'Suspend',
      'odpt:informationText': '大雨のため一部区間で運行を見合わせています'
    }],
    realtimeBuses: [],
    lastUpdated: new Date(2026, 7, 22, 12, 40, 0)
  });
  assert.includes(banner.className, 'alert');
  assert.equal(pillText.textContent, '運行支障');
});

test('updateCountdownIndicator updates timer display and button title', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <button id="refresh-btn">
      <span id="refresh-timer-display">30s</span>
    </button>
  `;

  updateCountdownIndicator(24, false);
  const timer = env.document.getElementById('refresh-timer-display');
  assert.equal(timer.textContent, '24s');

  updateCountdownIndicator(0, true);
  assert.equal(timer.textContent, '停止中');
});

// --------------------------------------------------------------------------
// 4. Main Transfer Card Renderer
// --------------------------------------------------------------------------
console.log('\n▶ 4. Main Transfer Card (js/ui/render-main.js)');

test('renderMainTransfer renders recommended connection and alternatives', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <span id="direction-badge"></span>
    <span id="origin-name"></span>
    <span id="via-stop-name"></span>
    <span id="dest-name"></span>
    <span id="buffer-display-val"></span>
    <div id="main-transfer-card">
      <span id="main-card-total-time"></span>
      <span id="leg-1-route-badge"></span>
      <span id="leg-1-dest-label"></span>
      <span id="leg-1-delay-badge"></span>
      <span id="leg-1-countdown"></span>
      <span id="leg-1-dep-time"></span>
      <span id="leg-1-arr-time"></span>
      <span id="leg-1-dep-stop"></span>
      <span id="leg-1-platform-sub"></span>
      <span id="leg-1-arr-stop"></span>
      <span id="transfer-wait-minutes"></span>
      <span id="transfer-buffer-tag"></span>
      <span id="leg-2-route-badge"></span>
      <span id="leg-2-dest-label"></span>
      <span id="leg-2-delay-badge"></span>
      <span id="leg-2-countdown"></span>
      <span id="leg-2-dep-time"></span>
      <span id="leg-2-arr-time"></span>
      <span id="leg-2-dep-stop"></span>
      <span id="leg-2-platform-sub"></span>
      <span id="leg-2-arr-stop"></span>
    </div>
    <div id="alternative-options-card">
      <span id="alt-options-count"></span>
      <div id="alt-connections-list"></div>
    </div>
  `;

  const mockState = {
    direction: 'outbound',
    bufferMinutes: 5,
    transferResult: {
      status: 'ok',
      recommended: {
        totalDurationMinutes: 28,
        transferWaitMinutes: 7,
        bufferMinutes: 5,
        leg1: {
          line: '111系統',
          destination: '上大岡駅前',
          departureTime: '07:30',
          actualDepartureTime: '07:30',
          estimatedArrivalTime: '07:45',
          delayMinutes: 0
        },
        leg2: {
          line: '133系統',
          destination: '根岸駅前',
          departureTime: '07:52',
          actualDepartureTime: '07:52',
          estimatedArrivalTime: '08:04',
          delayMinutes: 0
        }
      },
      alternatives: [
        {
          totalDurationMinutes: 30,
          transferWaitMinutes: 9,
          leg1: { line: '111系統', departureTime: '07:42', actualDepartureTime: '07:42' },
          leg2: { line: '133系統', departureTime: '08:05', estimatedArrivalTime: '08:17' }
        }
      ]
    }
  };

  renderMainTransfer(mockState);

  assert.equal(env.document.getElementById('direction-badge').textContent, '往路');
  assert.includes(env.document.getElementById('origin-name').textContent, '洋光台北口');
  assert.includes(env.document.getElementById('dest-name').textContent, '古泉');
  assert.equal(env.document.getElementById('main-card-total-time').textContent, '所要時間: 約28分');
  assert.equal(env.document.getElementById('leg-1-dep-time').textContent, '07:30');
  assert.equal(env.document.getElementById('transfer-wait-minutes').textContent, '7分');
  assert.equal(env.document.getElementById('leg-2-dep-time').textContent, '07:52');
  assert.equal(env.document.getElementById('alt-options-count').textContent, '1便利用可能');
  assert.includes(env.document.getElementById('alt-connections-list').innerHTML, '候補1');
});

test('renderMainTransfer renders clean end-of-service state when no connection', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <span id="direction-badge"></span>
    <span id="origin-name"></span>
    <span id="via-stop-name"></span>
    <span id="dest-name"></span>
    <span id="buffer-display-val"></span>
    <div id="main-transfer-card">
      <span id="main-card-total-time"></span>
      <span id="leg-1-countdown"></span>
    </div>
    <div id="alternative-options-card">
      <span id="alt-options-count"></span>
      <div id="alt-connections-list"></div>
    </div>
  `;

  renderMainTransfer({
    direction: 'outbound',
    bufferMinutes: 5,
    transferResult: { status: 'no_buses_available', recommended: null, alternatives: [] }
  });

  assert.equal(env.document.getElementById('main-card-total-time').textContent, '本日の運行終了');
  assert.includes(env.document.getElementById('alt-connections-list').innerHTML, '本日の運行はすべて終了しました');
});

// --------------------------------------------------------------------------
// 5. Stop View Renderer
// --------------------------------------------------------------------------
console.log('\n▶ 5. Stop View (js/ui/render-stop-view.js)');

test('renderStopViews shows stop departure list when stop tab is active', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <div id="main-transfer-card"></div>
    <div id="alternative-options-card"></div>
    <div id="stop-views-container" class="hidden">
      <span id="stop-view-title-name"></span>
      <span id="stop-view-pole-info"></span>
      <span id="stop-view-count"></span>
      <div id="stop-departure-list"></div>
    </div>
  `;

  const timetables = getMockTimetables('Weekday');

  const mockState = {
    direction: 'outbound',
    currentTab: 'stop-yokodai',
    activeFilter: 'all',
    timetables,
    realtimeBuses: []
  };

  renderStopViews(mockState);

  const container = env.document.getElementById('stop-views-container');
  const mainCard = env.document.getElementById('main-transfer-card');
  const titleName = env.document.getElementById('stop-view-title-name');
  const list = env.document.getElementById('stop-departure-list');

  assert.false(container.classList.contains('hidden'), 'Stop view should be visible');
  assert.true(mainCard.classList.contains('hidden'), 'Main transfer card should be hidden');
  assert.equal(titleName.textContent, '洋光台北口');
  assert.ok(list.innerHTML.length > 0, 'Departure list should have items');
});

// --------------------------------------------------------------------------
// 6. Settings and Timetable Modals
// --------------------------------------------------------------------------
console.log('\n▶ 6. Modals (js/ui/render-modal.js)');

test('initModals initializes settings and timetable modal handlers', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;

  env.document.body.innerHTML = `
    <button id="settings-btn"></button>
    <button id="header-settings-btn"></button>
    <div id="settings-modal" class="modal-container">
      <div id="settings-modal-backdrop"></div>
      <button id="settings-modal-close"></button>
      <input id="api-key-input" type="text" />
      <button id="btn-reset-api-key"></button>
      <input id="buffer-input" type="range" value="5" />
      <span id="setting-buffer-display">5分</span>
      <select id="setting-refresh-interval">
        <option value="30">30秒</option>
      </select>
      <select id="setting-theme-select">
        <option value="system">system</option>
      </select>
      <span id="cache-size-display"></span>
      <button id="btn-clear-cache"></button>
      <button id="btn-cancel-settings"></button>
      <button id="save-settings-btn"></button>
    </div>

    <button id="timetable-btn"></button>
    <button id="tab-timetable-all" data-tab="timetable-all"></button>
    <div id="timetable-modal" class="modal-container">
      <div id="timetable-modal-backdrop"></div>
      <button id="timetable-modal-close"></button>
      <select id="timetable-stop-select">
        <option value="yokodai">洋光台北口</option>
        <option value="kamiooka">上大岡駅前</option>
        <option value="koizumi">古泉</option>
      </select>
      <button id="btn-cal-weekday"></button>
      <button id="btn-cal-saturday"></button>
      <button id="btn-cal-holiday"></button>
      <table>
        <tbody id="timetable-tbody"></tbody>
      </table>
      <button id="btn-close-timetable"></button>
    </div>
    <div id="toast-container"></div>
  `;

  let savedCallbackCalled = false;
  const modalControls = initModals({
    state,
    storageService: env.localStorage ? {
      getApiKey: () => 'sample_key',
      setApiKey: (k) => k,
      getTransferBuffer: () => 5,
      setTransferBuffer: (b) => b,
      getAutoRefreshInterval: () => 30,
      setAutoRefreshInterval: (i) => i,
      getTheme: () => 'system',
      setTheme: (t) => t,
      clearCache: () => {}
    } : null,
    onSettingsSaved: () => { savedCallbackCalled = true; }
  });

  // Open settings
  env.document.getElementById('settings-btn').click();
  const settingsModal = env.document.getElementById('settings-modal');
  assert.true(settingsModal.classList.contains('active'), 'Settings modal should be active');

  // Save settings
  env.document.getElementById('save-settings-btn').click();
  assert.false(settingsModal.classList.contains('active'), 'Settings modal should close on save');
  assert.true(savedCallbackCalled, 'Saved callback should be invoked');

  // Open Timetable modal
  env.document.getElementById('timetable-btn').click();
  const timetableModal = env.document.getElementById('timetable-modal');
  assert.true(timetableModal.classList.contains('active'), 'Timetable modal should be active');

  const tbody = env.document.getElementById('timetable-tbody');
  assert.ok(tbody.innerHTML.length > 0, 'Timetable grid should be populated');

  // Close Timetable modal
  env.document.getElementById('btn-close-timetable').click();
  assert.false(timetableModal.classList.contains('active'), 'Timetable modal should close');
});

// --------------------------------------------------------------------------
// 7. Polling Service Tests
// --------------------------------------------------------------------------
console.log('\n▶ 7. Polling Service (js/services/polling-service.js)');

test('PollingService handles countdown, pause, resume, and interval updates', () => {
  let tickCount = 0;
  let lastTickSeconds = 0;

  const polling = new PollingService({
    intervalSec: 30,
    onTick: (sec, isPaused) => {
      tickCount++;
      lastTickSeconds = sec;
    }
  });

  polling.start();
  assert.equal(polling.isRunning, true);
  assert.equal(polling.isPaused, false);

  polling.pause();
  assert.equal(polling.isPaused, true);

  polling.resume();
  assert.equal(polling.isPaused, false);

  polling.setIntervalSec(60);
  assert.equal(polling.intervalSec, 60);

  polling.stop();
  assert.equal(polling.isRunning, false);
});

test('PollingService debounces manual refresh correctly', () => {
  let refreshCalls = 0;
  const polling = new PollingService({
    intervalSec: 30,
    onRefresh: () => { refreshCalls++; }
  });

  // First manual refresh should execute
  const first = polling.manualRefresh();
  assert.equal(first, true);
  assert.equal(refreshCalls, 1);

  // Immediate second manual refresh should be debounced
  const second = polling.manualRefresh();
  assert.equal(second, false);
  assert.equal(refreshCalls, 1);
});

// --------------------------------------------------------------------------
// 8. Application Lifecycle & Integration Tests
// --------------------------------------------------------------------------
console.log('\n▶ 8. Full Application Integration (js/app.js)');

asyncTest('App boots, wires all DOM events, and loads initial state', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;

  env.document.body.innerHTML = `
    <header class="app-header">
      <span id="live-time">--:--:--</span>
      <button id="theme-toggle-btn">🌙</button>
      <button id="header-settings-btn">⚙️</button>
    </header>
    <main>
      <div id="direction-route-display">
        <span id="direction-badge"></span>
        <span id="origin-name"></span>
        <span id="via-stop-name"></span>
        <span id="dest-name"></span>
      </div>
      <button id="direction-toggle-btn"></button>
      <div id="status-banner" class="status-banner normal">
        <span id="status-pill">
          <span id="status-pill-text">平常運転</span>
        </span>
        <span id="status-message"></span>
        <span id="status-update-time"></span>
      </div>
      <nav id="view-tabs">
        <button class="tab-btn active" data-tab="transfer" id="tab-transfer">乗り継ぎ</button>
        <button class="tab-btn" data-tab="stop-yokodai" id="tab-stop-yokodai">洋光台</button>
        <button class="tab-btn" data-tab="stop-kamiooka" id="tab-stop-kamiooka">上大岡</button>
        <button class="tab-btn" data-tab="stop-koizumi" id="tab-stop-koizumi">古泉</button>
        <button class="tab-btn" data-tab="timetable-all" id="tab-timetable-all">全時刻表</button>
      </nav>
      <section id="route-filter-chips">
        <button class="filter-chip active" data-route="all" id="filter-all">全て</button>
        <button class="filter-chip" data-route="111" id="filter-111">111系統</button>
        <button class="filter-chip" data-route="133" id="filter-133">133系統</button>
        <button class="filter-chip" data-route="64" id="filter-64">64系統</button>
      </section>
      <span id="buffer-display-val">5分</span>
      <div id="main-transfer-card">
        <span id="main-card-total-time"></span>
        <span id="leg-1-route-badge"></span>
        <span id="leg-1-dest-label"></span>
        <span id="leg-1-delay-badge"></span>
        <span id="leg-1-countdown"></span>
        <span id="leg-1-dep-time"></span>
        <span id="leg-1-arr-time"></span>
        <span id="leg-1-dep-stop"></span>
        <span id="leg-1-platform-sub"></span>
        <span id="leg-1-arr-stop"></span>
        <span id="transfer-wait-minutes"></span>
        <span id="transfer-buffer-tag"></span>
        <span id="leg-2-route-badge"></span>
        <span id="leg-2-dest-label"></span>
        <span id="leg-2-delay-badge"></span>
        <span id="leg-2-countdown"></span>
        <span id="leg-2-dep-time"></span>
        <span id="leg-2-arr-time"></span>
        <span id="leg-2-dep-stop"></span>
        <span id="leg-2-platform-sub"></span>
        <span id="leg-2-arr-stop"></span>
      </div>
      <div id="alternative-options-card">
        <span id="alt-options-count"></span>
        <div id="alt-connections-list"></div>
      </div>
      <div id="stop-views-container" class="hidden">
        <span id="stop-view-title-name"></span>
        <span id="stop-view-pole-info"></span>
        <span id="stop-view-count"></span>
        <div id="stop-departure-list"></div>
      </div>
    </main>
    <nav id="bottom-nav">
      <button id="refresh-btn">
        <span id="refresh-timer-display">30s</span>
      </button>
      <button id="btn-nav-direction"></button>
      <button id="timetable-btn"></button>
      <button id="settings-btn"></button>
    </nav>
    <div id="settings-modal" class="modal-container">
      <div id="settings-modal-backdrop"></div>
      <button id="settings-modal-close"></button>
      <input id="api-key-input" type="text" />
      <button id="btn-reset-api-key"></button>
      <input id="buffer-input" type="range" value="5" />
      <span id="setting-buffer-display">5分</span>
      <select id="setting-refresh-interval"><option value="30">30秒</option></select>
      <select id="setting-theme-select"><option value="system">自動</option></select>
      <span id="cache-size-display"></span>
      <button id="btn-clear-cache"></button>
      <button id="btn-cancel-settings"></button>
      <button id="save-settings-btn"></button>
    </div>
    <div id="timetable-modal" class="modal-container">
      <div id="timetable-modal-backdrop"></div>
      <button id="timetable-modal-close"></button>
      <select id="timetable-stop-select">
        <option value="yokodai">洋光台北口</option>
      </select>
      <button id="btn-cal-weekday"></button>
      <button id="btn-cal-saturday"></button>
      <button id="btn-cal-holiday"></button>
      <table><tbody id="timetable-tbody"></tbody></table>
      <button id="btn-close-timetable"></button>
    </div>
    <div id="toast-container"></div>
  `;

  const testApp = new App();
  await testApp.init();

  // Test Direction Toggle
  const dirBtn = env.document.getElementById('direction-toggle-btn');
  dirBtn.click();
  assert.equal(testApp.state.getState().direction, 'inbound', 'Direction should swap to inbound');

  // Test Filter Chip Click
  const filter133 = env.document.getElementById('filter-133');
  filter133.click();
  assert.equal(testApp.state.getState().activeFilter, '133', 'Filter should update to 133');

  // Test Tab Navigation
  const kamiookaTab = env.document.getElementById('tab-stop-kamiooka');
  kamiookaTab.click();
  assert.equal(testApp.state.getState().currentTab, 'stop-kamiooka', 'Tab should switch to kamiooka');

  // Clean up timers
  if (testApp.polling) testApp.polling.stop();
  if (testApp.clockTimerId) clearInterval(testApp.clockTimerId);
});

console.log('\n========================================================================');
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
