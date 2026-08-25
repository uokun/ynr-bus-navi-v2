/**
 * tier5-adversarial-stress-tests.js
 * Tier 5: Adversarial Stress, Fuzzing & Fault Injection Test Suite
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App (transporter)
 *
 * Covers 5 Core Adversarial Dimensions:
 * 1. Rapid UI actions: fast sequential direction flipping, spamming tab switching, continuous manual refresh clicks.
 * 2. Dynamic buffer changes from 1 to 30 min while countdown timers are actively ticking.
 * 3. Mid-flight API key change and corrupted storage simulation.
 * 4. Extreme time warp simulations (23:59:59 -> 00:00:01 rollover, daylight savings, leap years).
 * 5. Filter combinations resulting in empty list followed by filter reset.
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

import { AppState, state as globalState } from '../js/state.js';
import { StorageService } from '../js/services/storage-service.js';
import { PollingService } from '../js/services/polling-service.js';
import { timetableService, TimetableService } from '../js/services/timetable-service.js';
import { transferService, TransferService } from '../js/services/transfer-service.js';
import { calendarService, CalendarService } from '../js/services/calendar-service.js';
import { renderStatusBanner, updateCountdownIndicator, updateLiveClock } from '../js/ui/render-status.js';
import { renderMainTransfer } from '../js/ui/render-main.js';
import { renderStopViews } from '../js/ui/render-stop-view.js';
import { initModals } from '../js/ui/render-modal.js';
import { App } from '../js/app.js';
import { getMockTimetable } from '../js/api/mock-data.js';

export const tier5Tests = [];

function registerTest(id, name, stressArea, fn) {
  tier5Tests.push({ id, name, stressArea, fn });
}

/**
 * Helper to build a complete, realistic DOM tree for full App mounting
 */
export function createFullAppDOM(env) {
  env.document.body.innerHTML = `
    <header class="app-header">
      <div class="header-content">
        <div class="header-title-wrap">
          <span class="header-icon">🚌</span>
          <h1 class="header-title">横浜市営バス 運行ナビ</h1>
        </div>
        <div class="header-controls">
          <span id="live-time" class="live-time-display">--:--:--</span>
          <button id="theme-toggle-btn" class="icon-btn" aria-label="テーマ切替">🌙</button>
          <button id="header-settings-btn" class="icon-btn" aria-label="設定">⚙️</button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <!-- Route Direction & Flip Header -->
      <section class="direction-banner-card">
        <div class="direction-info-wrap">
          <span id="direction-badge" class="direction-pill">往路</span>
          <div class="route-stops-display">
            <span id="origin-name" class="stop-name origin">🚏 洋光台北口</span>
            <span class="route-arrow">➔</span>
            <span id="via-stop-name" class="stop-name via">上大岡駅前 経由</span>
            <span class="route-arrow">➔</span>
            <span id="dest-name" class="stop-name dest">🚏 古泉</span>
          </div>
        </div>
        <button id="direction-toggle-btn" class="direction-flip-btn" aria-label="往復方向を反転">
          <span class="flip-icon">⇄</span>
          <span class="flip-text">反転</span>
        </button>
      </section>

      <!-- Status & Operation Alert Banner -->
      <section id="status-banner" class="status-banner normal" role="status">
        <div class="status-left">
          <span id="status-pill" class="status-pill normal">
            <span class="status-indicator-dot"></span>
            <span id="status-pill-text">平常運転</span>
          </span>
          <span id="status-message" class="status-message-text">全線平常通り運行しています</span>
        </div>
        <div class="status-right">
          <span id="status-update-time" class="status-update-time">更新 --:--:--</span>
        </div>
      </section>

      <!-- View Navigation Tabs -->
      <nav id="view-tabs" class="view-tabs-nav" role="tablist">
        <button class="tab-btn active" data-tab="transfer" id="tab-transfer" role="tab" aria-selected="true">乗り継ぎ案内</button>
        <button class="tab-btn" data-tab="stop-yokodai" id="tab-stop-yokodai" role="tab" aria-selected="false">洋光台北口</button>
        <button class="tab-btn" data-tab="stop-kamiooka" id="tab-stop-kamiooka" role="tab" aria-selected="false">上大岡駅前</button>
        <button class="tab-btn" data-tab="stop-koizumi" id="tab-stop-koizumi" role="tab" aria-selected="false">古泉</button>
        <button class="tab-btn" data-tab="timetable-all" id="tab-timetable-all" role="tab" aria-selected="false">全時刻表</button>
      </nav>

      <!-- Route Filter Chips & Buffer Info -->
      <section class="controls-toolbar">
        <div id="route-filter-chips" class="filter-chips-group" role="group" aria-label="系統絞り込み">
          <button class="filter-chip active" data-route="all" id="filter-all" aria-checked="true">全て</button>
          <button class="filter-chip" data-route="111" id="filter-111" aria-checked="false">111系統</button>
          <button class="filter-chip" data-route="133" id="filter-133" aria-checked="false">133系統</button>
          <button class="filter-chip" data-route="64" id="filter-64" aria-checked="false">64系統</button>
        </div>
        <div class="buffer-indicator-wrap">
          <span class="buffer-label">乗換バッファ:</span>
          <span id="buffer-display-val" class="buffer-val-badge">5分</span>
        </div>
      </section>

      <!-- Main Transfer Recommendation Card -->
      <div id="main-transfer-card" class="transfer-main-card">
        <div class="card-header-bar">
          <span class="card-title-tag">★ 直近おすすめ乗り継ぎ</span>
          <span id="main-card-total-time" class="total-duration-badge">所要時間: 約34分</span>
        </div>

        <!-- Leg 1 -->
        <div class="transfer-leg leg-1">
          <div class="leg-header">
            <span class="leg-step-num">第1区間</span>
            <span id="leg-1-route-badge" class="route-badge route-badge-111">111系統</span>
            <span id="leg-1-dest-label" class="leg-dest-label">上大岡駅前 行</span>
            <span id="leg-1-delay-badge" class="delay-tag on-time">定刻</span>
            <span id="leg-1-countdown" class="countdown-badge">あと 5分</span>
          </div>
          <div class="leg-timing-row">
            <div class="timing-point dep">
              <span id="leg-1-dep-time" class="time-main">07:30</span>
              <span id="leg-1-dep-stop" class="stop-title">洋光台北口</span>
              <span id="leg-1-platform-sub" class="platform-text">のりば 1番</span>
            </div>
            <div class="timing-arrow-wrap">➔</div>
            <div class="timing-point arr">
              <span id="leg-1-arr-time" class="time-main">07:45 着</span>
              <span id="leg-1-arr-stop" class="stop-title">上大岡駅前</span>
            </div>
          </div>
        </div>

        <!-- Transfer Buffer Step -->
        <div class="transfer-connection-step">
          <span class="walk-icon">🚶‍♂️</span>
          <span class="transfer-text">上大岡駅 乗り換え待ち</span>
          <span id="transfer-wait-minutes" class="wait-minutes-badge">5分</span>
          <span id="transfer-buffer-tag" class="buffer-secured-tag">バッファ 5分 確保</span>
        </div>

        <!-- Leg 2 -->
        <div class="transfer-leg leg-2">
          <div class="leg-header">
            <span class="leg-step-num">第2区間</span>
            <span id="leg-2-route-badge" class="route-badge route-badge-133">133系統</span>
            <span id="leg-2-dest-label" class="leg-dest-label">根岸駅前 行 (古泉経由)</span>
            <span id="leg-2-delay-badge" class="delay-tag on-time">定刻</span>
            <span id="leg-2-countdown" class="countdown-badge">上大岡発 07:50</span>
          </div>
          <div class="leg-timing-row">
            <div class="timing-point dep">
              <span id="leg-2-dep-time" class="time-main">07:50</span>
              <span id="leg-2-dep-stop" class="stop-title">上大岡駅前</span>
              <span id="leg-2-platform-sub" class="platform-text">のりば 12番</span>
            </div>
            <div class="timing-arrow-wrap">➔</div>
            <div class="timing-point arr">
              <span id="leg-2-arr-time" class="time-main">08:02 着</span>
              <span id="leg-2-arr-stop" class="stop-title">古泉</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Alternative Connections List -->
      <div id="alternative-options-card" class="alternative-card">
        <div class="alt-header-bar">
          <span class="alt-title">以降の乗り継ぎ候補便</span>
          <span id="alt-options-count" class="alt-count-badge">3便利用可能</span>
        </div>
        <div id="alt-connections-list" class="alt-list"></div>
      </div>

      <!-- Individual Stop Views Container -->
      <div id="stop-views-container" class="stop-views-section hidden">
        <div class="stop-view-header-bar">
          <div class="stop-title-group">
            <h2 id="stop-view-title-name" class="stop-view-title">洋光台北口</h2>
            <span id="stop-view-pole-info" class="pole-info-text">1番のりば (上大岡駅前方面)</span>
          </div>
          <span id="stop-view-count" class="departure-count-badge">直近5便</span>
        </div>
        <div id="stop-departure-list" class="stop-departure-list"></div>
      </div>
    </main>

    <!-- Bottom Navigation Bar -->
    <nav id="bottom-nav" class="bottom-action-bar">
      <button id="refresh-btn" class="nav-action-btn" aria-label="手動更新">
        <span class="nav-icon">🔄</span>
        <span class="nav-label">更新</span>
        <span id="refresh-timer-display" class="timer-bubble">30s</span>
      </button>
      <button id="btn-nav-direction" class="nav-action-btn" aria-label="方向反転">
        <span class="nav-icon">⇄</span>
        <span class="nav-label">反転</span>
      </button>
      <button id="timetable-btn" class="nav-action-btn" aria-label="時刻表">
        <span class="nav-icon">📖</span>
        <span class="nav-label">全時刻表</span>
      </button>
      <button id="settings-btn" class="nav-action-btn" aria-label="設定">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">設定</span>
      </button>
    </nav>

    <!-- Settings Modal -->
    <div id="settings-modal" class="modal-container" role="dialog" aria-modal="true">
      <div id="settings-modal-backdrop" class="modal-backdrop"></div>
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">⚙️ アプリケーション設定</h3>
          <button id="settings-modal-close" class="close-btn" aria-label="閉じる">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="api-key-input">ODPT API Consumer Key</label>
            <div class="input-with-action">
              <input id="api-key-input" type="text" class="text-input" />
              <button id="btn-reset-api-key" class="btn-sm">初期化</button>
            </div>
          </div>
          <div class="form-group">
            <label for="buffer-input">上大岡駅 乗り換えバッファ時間: <span id="setting-buffer-display">5分</span></label>
            <input id="buffer-input" type="range" min="1" max="30" value="5" class="range-slider" />
          </div>
          <div class="form-group">
            <label for="setting-refresh-interval">自動更新（ポーリング）間隔</label>
            <select id="setting-refresh-interval" class="select-input">
              <option value="30">30秒（標準）</option>
              <option value="60">60秒（省電力）</option>
              <option value="0">停止（手動のみ）</option>
            </select>
          </div>
          <div class="form-group">
            <label for="setting-theme-select">テーマ表示設定</label>
            <select id="setting-theme-select" class="select-input">
              <option value="system">システム準拠</option>
              <option value="light">ライトモード</option>
              <option value="dark">ダークモード</option>
            </select>
          </div>
          <div class="form-group">
            <span id="cache-size-display" class="cache-status-text">キャッシュ状態: 正常</span>
            <button id="btn-clear-cache" class="btn-warning">キャッシュ消去</button>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancel-settings" class="btn-secondary">キャンセル</button>
          <button id="save-settings-btn" class="btn-primary">保存して適用</button>
        </div>
      </div>
    </div>

    <!-- Timetable Modal -->
    <div id="timetable-modal" class="modal-container" role="dialog" aria-modal="true">
      <div id="timetable-modal-backdrop" class="modal-backdrop"></div>
      <div class="modal-card modal-large">
        <div class="modal-header">
          <h3 class="modal-title">📖 全系統時刻表</h3>
          <button id="timetable-modal-close" class="close-btn" aria-label="閉じる">✕</button>
        </div>
        <div class="modal-body">
          <div class="timetable-toolbar">
            <select id="timetable-stop-select" class="select-input">
              <option value="yokodai">洋光台北口</option>
              <option value="kamiooka">上大岡駅前</option>
              <option value="koizumi">古泉</option>
            </select>
            <div class="cal-tabs">
              <button id="btn-cal-weekday" class="cal-tab-btn active">平日</button>
              <button id="btn-cal-saturday" class="cal-tab-btn">土曜</button>
              <button id="btn-cal-holiday" class="cal-tab-btn">休日</button>
            </div>
          </div>
          <div class="timetable-table-container">
            <table class="timetable-grid">
              <thead><tr><th>時</th><th>行先・系統・分</th></tr></thead>
              <tbody id="timetable-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-close-timetable" class="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>

    <!-- Toast Notification Mount -->
    <div id="toast-container" class="toast-container"></div>
  `;
}

// =========================================================================
// Suite 5.1: Rapid UI Actions & Event Flooding (S5.1)
// =========================================================================

registerTest('T5.1.1', '100x rapid consecutive direction flipping without race conditions',
  'S5.1: Rapid UI Actions', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  const toggleBtn = env.document.getElementById('direction-toggle-btn');
  const dirBadge = env.document.getElementById('direction-badge');
  const originName = env.document.getElementById('origin-name');
  const destName = env.document.getElementById('dest-name');

  assert.ok(toggleBtn, 'Direction toggle button must exist');

  // Perform 100 rapid sequential flips
  for (let i = 1; i <= 100; i++) {
    toggleBtn.click();
    const expectedDir = (i % 2 === 1) ? 'inbound' : 'outbound';
    const s = appInstance.state.getState();

    assert.equal(s.direction, expectedDir, `Step ${i}: State direction must be ${expectedDir}`);
    assert.equal(dirBadge.textContent, expectedDir === 'outbound' ? '往路' : '復路', `Step ${i}: Badge must match`);
    assert.includes(originName.textContent, expectedDir === 'outbound' ? '洋光台北口' : '古泉', `Step ${i}: Origin must match`);
    assert.includes(destName.textContent, expectedDir === 'outbound' ? '古泉' : '洋光台北口', `Step ${i}: Destination must match`);
    assert.ok(s.transferResult, 'Transfer result must exist after flip');
  }

  // Final check: 100 flips -> even parity -> outbound
  assert.equal(appInstance.state.getState().direction, 'outbound');
  appInstance.polling?.stop();
});

registerTest('T5.1.2', '200x high-frequency tab switching storm across all tabs',
  'S5.1: Rapid UI Actions', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  const mainCard = env.document.getElementById('main-transfer-card');
  const stopViewsContainer = env.document.getElementById('stop-views-container');

  const tabList = ['tab-transfer', 'tab-stop-yokodai', 'tab-stop-kamiooka', 'tab-stop-koizumi'];

  // Perform 200 random tab clicks
  for (let i = 0; i < 200; i++) {
    const targetId = tabList[i % tabList.length];
    const btn = env.document.getElementById(targetId);
    assert.ok(btn, `Tab button ${targetId} must exist`);

    btn.click();

    const currentTab = appInstance.state.getState().currentTab;
    const tabDataAttr = btn.getAttribute('data-tab');
    assert.equal(currentTab, tabDataAttr, `Iteration ${i}: Tab state must match ${tabDataAttr}`);

    // Verify UI visibility toggling
    if (tabDataAttr === 'transfer') {
      assert.false(mainCard.classList.contains('hidden'), 'Main card should be visible in transfer tab');
      assert.true(stopViewsContainer.classList.contains('hidden'), 'Stop views should be hidden in transfer tab');
    } else {
      assert.true(mainCard.classList.contains('hidden'), `Main card should be hidden in ${tabDataAttr}`);
      assert.false(stopViewsContainer.classList.contains('hidden'), `Stop views should be visible in ${tabDataAttr}`);
      const stopTitle = env.document.getElementById('stop-view-title-name');
      assert.ok(stopTitle.textContent.length > 0, 'Stop title must be rendered');
    }
  }

  appInstance.polling?.stop();
});

registerTest('T5.1.3', '100x continuous manual refresh spamming with debounce protection',
  'S5.1: Rapid UI Actions', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  const refreshBtn = env.document.getElementById('refresh-btn');

  // Track onRefresh executions
  const origLoadData = appInstance.loadData.bind(appInstance);
  let loadDataCalls = 0;
  appInstance.loadData = async (opts) => {
    loadDataCalls++;
    return origLoadData(opts);
  };

  // Click refresh button 100 times in tight loop
  for (let i = 0; i < 100; i++) {
    refreshBtn.click();
  }

  // Due to debounce (2000ms), only 1 manual refresh should proceed immediately
  assert.equal(loadDataCalls, 1, 'Manual refresh must debounce 100 rapid clicks down to 1 call');

  // Verify status banner remains intact
  const banner = env.document.getElementById('status-banner');
  assert.ok(banner, 'Status banner must remain intact');
  assert.ok(banner.className.includes('status-normal') || banner.className.includes('status-warning'), 'Banner must have valid status class');

  appInstance.polling?.stop();
});

registerTest('T5.1.4', '300x chaotic multi-actor UI storm (fuzzing interleaving all actions)',
  'S5.1: Rapid UI Actions', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  const dirBtn = env.document.getElementById('direction-toggle-btn');
  const tabs = ['tab-transfer', 'tab-stop-yokodai', 'tab-stop-kamiooka', 'tab-stop-koizumi'];
  const filters = ['filter-all', 'filter-111', 'filter-133', 'filter-64'];
  const themeBtn = env.document.getElementById('theme-toggle-btn');
  const refreshBtn = env.document.getElementById('refresh-btn');

  // Execute 300 randomized actions in rapid sequence
  for (let i = 0; i < 300; i++) {
    const actionType = i % 5;
    if (actionType === 0) {
      dirBtn.click();
    } else if (actionType === 1) {
      const tabId = tabs[(i * 7) % tabs.length];
      env.document.getElementById(tabId)?.click();
    } else if (actionType === 2) {
      const filterId = filters[(i * 11) % filters.length];
      env.document.getElementById(filterId)?.click();
    } else if (actionType === 3) {
      themeBtn.click();
    } else if (actionType === 4) {
      refreshBtn.click();
    }
  }

  // Assert complete structural and state integrity after the storm
  const finalState = appInstance.state.getState();
  assert.ok(['outbound', 'inbound'].includes(finalState.direction), 'Valid direction');
  assert.ok(['all', '111', '133', '64'].includes(finalState.activeFilter), 'Valid filter');
  assert.ok(['light', 'dark', 'system'].includes(finalState.theme), 'Valid theme');
  assert.ok(finalState.transferResult, 'Transfer result is valid');
  assert.ok(env.document.getElementById('main-transfer-card'), 'Main card exists');

  appInstance.polling?.stop();
});

// =========================================================================
// Suite 5.2: Dynamic Buffer Modulation Under Active Countdown (S5.2)
// =========================================================================

registerTest('T5.2.1', 'Dynamic buffer sweep (1..30 min) while countdown timer ticks continuously',
  'S5.2: Dynamic Buffer & Live Timers', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const storage = new StorageService(env.localStorage);
  const appState = new AppState();
  const timetables = getMockTimetables('Weekday');
  appState.setState({ timetables });

  let tickCount = 0;
  const polling = new PollingService({
    intervalSec: 30,
    state: appState,
    onTick: (sec) => {
      tickCount++;
      updateCountdownIndicator(sec, false);
    }
  });
  polling.start();

  // Sweep buffer forward 1 -> 30, then backward 30 -> 1 while ticking
  for (let buf = 1; buf <= 30; buf++) {
    storage.setTransferBuffer(buf);
    appState.setState({ bufferMinutes: buf });

    // Simulate timer tick
    polling._onTimerTick();

    const transferRes = transferService.calculateTransferRoute({
      leg1Timetable: timetables.line111Outbound,
      leg2Timetable: timetables.line133Outbound,
      direction: 'outbound',
      bufferMinutes: buf,
      currentTime: new Date(2026, 7, 24, 8, 0, 0)
    });

    assert.equal(transferRes.status, 'ok');
    assert.equal(transferRes.recommended.bufferMinutes, buf);
    assert.equal(appState.getState().bufferMinutes, buf);
  }

  for (let buf = 30; buf >= 1; buf--) {
    storage.setTransferBuffer(buf);
    appState.setState({ bufferMinutes: buf });
    polling._onTimerTick();

    const transferRes = transferService.calculateTransferRoute({
      leg1Timetable: timetables.line111Outbound,
      leg2Timetable: timetables.line133Outbound,
      direction: 'outbound',
      bufferMinutes: buf,
      currentTime: new Date(2026, 7, 24, 8, 0, 0)
    });

    assert.equal(transferRes.status, 'ok');
    assert.equal(transferRes.recommended.bufferMinutes, buf);
  }

  assert.greaterOrEqual(tickCount, 60, 'Should have completed at least 60 ticks during sweep');
  polling.stop();
});

registerTest('T5.2.2', 'Live transfer connection shifts dynamically when buffer expands from 1m to 20m',
  'S5.2: Dynamic Buffer & Live Timers', () => {
  const timetables = getMockTimetables('Weekday');
  const morningTime = new Date(2026, 7, 24, 7, 30, 0); // 07:30

  // 1. With 1-min buffer: Line 111 departs 07:30 -> Arr 07:45 -> Leg 2 needs >= 07:46
  // Line 133 has departure at 07:50
  const tightRes = transferService.calculateTransferRoute({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 1,
    currentTime: morningTime
  });
  assert.equal(tightRes.recommended.leg2.departureTime, '07:50');
  assert.equal(tightRes.recommended.transferWaitMinutes, 5); // 07:50 - 07:45 = 5m

  // 2. With 25-min buffer: Arr 07:45 -> Leg 2 needs >= 08:10
  // Next Line 133 at or after 08:10 is 08:20
  const looseRes = transferService.calculateTransferRoute({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 25,
    currentTime: morningTime
  });
  assert.equal(looseRes.recommended.leg2.departureTime, '08:20');
  assert.equal(looseRes.recommended.transferWaitMinutes, 35); // 08:20 - 07:45 = 35m
  assert.ok(looseRes.recommended.totalDurationMinutes > tightRes.recommended.totalDurationMinutes);
});

registerTest('T5.2.3', 'Boundary and adversarial buffer inputs clamped cleanly without NaN or exceptions',
  'S5.2: Dynamic Buffer & Live Timers', () => {
  const storage = new StorageService();

  const testInputs = [
    { input: 0, expected: 0 },
    { input: -10, expected: 0 },
    { input: 31, expected: 30 },
    { input: 1000, expected: 30 },
    { input: 'invalid', expected: 0 },
    { input: null, expected: 0 },
    { input: undefined, expected: 0 },
    { input: NaN, expected: 0 },
    { input: '12', expected: 12 },
    { input: '25', expected: 25 }
  ];

  for (const t of testInputs) {
    const clamped = storage.setTransferBuffer(t.input);
    assert.equal(clamped, t.expected, `Buffer input ${t.input} must clamp to ${t.expected}`);
    const retrieved = storage.getTransferBuffer();
    assert.equal(retrieved, t.expected, `Retrieved buffer for ${t.input} must be ${t.expected}`);
  }
});

registerTest('T5.2.4', '500x high-frequency slider dragging simulation with live state sync',
  'S5.2: Dynamic Buffer & Live Timers', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const storage = new StorageService(env.localStorage);
  const appState = new AppState();

  initModals({
    state: appState,
    storageService: storage
  });

  const bufferSlider = env.document.getElementById('buffer-input');
  const bufferDisplay = env.document.getElementById('setting-buffer-display');

  // Simulate 500 rapid slider movements
  for (let i = 0; i < 500; i++) {
    const val = (i % 30) + 1;
    bufferSlider.value = String(val);
    bufferSlider.dispatchEvent(new env.window.Event('input'));

    assert.equal(bufferDisplay.textContent, `${val}分`, `Slider event ${i}: Display must match ${val}分`);
  }
});

// =========================================================================
// Suite 5.3: Mid-Flight API Key Mutation & Storage Fault Injection (S5.3)
// =========================================================================

registerTest('T5.3.1', 'Mid-flight API key change during active async fetch operation',
  'S5.3: Fault Injection & Storage', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const storage = new StorageService(env.localStorage);
  const appInstance = new App();
  appInstance.storage = storage;

  // Custom fetch handler that delays 20ms to allow in-flight mutation
  env.setMockFetch('odpt:Bus', async () => {
    await new Promise(r => setTimeout(r, 20));
    return {
      ok: true,
      status: 200,
      json: async () => [{ '@id': 'bus-1', 'odpt:busroute': '111系統', 'odpt:delay': 60 }]
    };
  });

  const initialLoadPromise = appInstance.loadData({ isManual: false });

  // Mutate API key mid-flight
  const newKey = 'custom_key_9999_hardened_token';
  storage.setApiKey(newKey);
  appInstance.state.setState({ apiKey: newKey });

  // Await the in-flight load
  await initialLoadPromise;

  // Verify key is retained and not reverted by previous fetch completion
  assert.equal(storage.getApiKey(), newKey, 'Storage must retain mutated key');
  assert.equal(appInstance.state.getState().apiKey, newKey, 'State must retain mutated key');
});

registerTest('T5.3.2', 'Corrupted LocalStorage cache injection (malformed JSON, garbage envelopes)',
  'S5.3: Fault Injection & Storage', () => {
  const env = createBrowserEnv();
  const storage = new StorageService(env.localStorage);

  const corruptedPayloads = [
    '{ broken json [',
    '<script>evil()</script>',
    'null',
    'undefined',
    '{"cachedAt": 123, "expiresAt": 1000, "data": null}',
    '1234567890',
    'x'.repeat(10000)
  ];

  corruptedPayloads.forEach((payload, idx) => {
    const key = `corrupted_key_${idx}`;
    env.localStorage.setItem(`transporter_cache_${key}`, payload);

    // getCachedData must not throw and must return null while purging
    const result = storage.getCachedData(key);
    assert.equal(result, null, `Corrupted cache payload #${idx} must safely yield null`);
    assert.equal(env.localStorage.getItem(`transporter_cache_${key}`), null, `Corrupted item #${idx} must be purged`);
  });
});

registerTest('T5.3.3', 'LocalStorage QuotaExceededError fault injection during high-volume caching',
  'S5.3: Fault Injection & Storage', () => {
  const env = createBrowserEnv();
  const storage = new StorageService(env.localStorage);

  // Set existing cache items
  storage.setCachedData('item1', { foo: 'bar' }, 3600);
  storage.setCachedData('item2', { baz: 'qux' }, 3600);

  // Arm quota error simulation
  env.localStorage.shouldThrowQuotaError = true;

  // Setting new cache data should trigger quota handling and memory fallback without throwing
  let threw = false;
  try {
    storage.setCachedData('large_item', { text: 'heavy data'.repeat(100) }, 3600);
    storage.setApiKey('emergency_key_after_quota');
    storage.setTheme('dark');
  } catch (err) {
    threw = true;
  }

  assert.false(threw, 'StorageService must never throw on QuotaExceededError');
  assert.equal(storage.getApiKey(), 'emergency_key_after_quota', 'Memory fallback should store API key');
  assert.equal(storage.getTheme(), 'dark', 'Memory fallback should store Theme');
});

registerTest('T5.3.4', 'Complete storage wipe and reset while app is actively running',
  'S5.3: Fault Injection & Storage', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  // Wipe storage entirely
  env.localStorage.clear();
  appInstance.storage.clearCache();
  appInstance.storage.resetApiKey();

  // Re-render and recalculate
  appInstance.recomputeAndRender();

  const s = appInstance.state.getState();
  assert.equal(appInstance.storage.getApiKey(), REFERENCE_CONFIG.DEFAULT_CONSUMER_KEY, 'Reverts to default consumer key');
  assert.equal(appInstance.storage.getTransferBuffer(), 0, 'Reverts to default buffer');
  assert.ok(s.transferResult, 'Transfer result is still computed cleanly');

  appInstance.polling?.stop();
});

// =========================================================================
// Suite 5.4: Extreme Time Warp & Calendar Edge Simulations (S5.4)
// =========================================================================

registerTest('T5.4.1', 'Midnight rollover sequence: 23:59:58 -> 23:59:59 -> 00:00:00 -> 00:00:01 -> 00:00:02',
  'S5.4: Extreme Time Warp', () => {
  const timetables = getMockTimetables('Weekday');
  const timetableSvc = new TimetableService();

  const rolloverSteps = [
    { time: new Date(2026, 7, 24, 23, 59, 58), desc: 'Late night 23:59:58' },
    { time: new Date(2026, 7, 24, 23, 59, 59), desc: 'Late night 23:59:59' },
    { time: new Date(2026, 7, 25, 0, 0, 0), desc: 'Midnight rollover 00:00:00' },
    { time: new Date(2026, 7, 25, 0, 0, 1), desc: 'Midnight 00:00:01' },
    { time: new Date(2026, 7, 25, 0, 0, 2), desc: 'Midnight 00:00:02' },
  ];

  for (const step of rolloverSteps) {
    const departures = timetableSvc.getNextDepartures(timetables.line111Outbound, step.time, 5);
    const transferRes = transferService.calculateTransferRoute({
      leg1Timetable: timetables.line111Outbound,
      leg2Timetable: timetables.line133Outbound,
      direction: 'outbound',
      bufferMinutes: 5,
      currentTime: step.time
    });

    // Check countdown formatting does not produce NaN or empty text
    for (const d of departures) {
      assert.ok(typeof d.countdownText === 'string', `Valid countdown string on ${step.desc}`);
      assert.false(d.countdownText.includes('NaN'), `No NaN in countdown on ${step.desc}`);
    }

    assert.ok(transferRes, `Transfer result returned on ${step.desc}`);
  }
});

registerTest('T5.4.2', 'Leap year boundary transitions (2024-02-28 -> 2024-02-29 -> 2024-03-01)',
  'S5.4: Extreme Time Warp', () => {
  const calSvc = new CalendarService();

  // 2024 is a Leap Year: Feb 29 exists
  const feb28 = new Date(2024, 1, 28); // Wednesday -> Weekday
  const feb29 = new Date(2024, 1, 29); // Thursday -> Weekday
  const mar01 = new Date(2024, 2, 1);  // Friday -> Weekday

  assert.equal(calSvc.getCalendarType(feb28), 'Weekday');
  assert.equal(calSvc.getCalendarType(feb29), 'Weekday');
  assert.equal(calSvc.getCalendarType(mar01), 'Weekday');
  assert.false(calSvc.isJapaneseHoliday(feb29), 'Feb 29 is not a national holiday in 2024');

  // Verify non-leap year (2026) Date behavior
  const nonLeap2026Feb28 = new Date(2026, 1, 28); // Saturday -> Saturday
  assert.equal(calSvc.getCalendarType(nonLeap2026Feb28), 'Saturday');
});

registerTest('T5.4.3', 'Golden Week multi-day consecutive & substitute holiday cascade (May 3 to May 6)',
  'S5.4: Extreme Time Warp', () => {
  const calSvc = new CalendarService();

  // In 2026:
  // May 3 (Sun): 憲法記念日
  // May 4 (Mon): みどりの日
  // May 5 (Tue): こどもの日
  // May 6 (Wed): 振替休日 (Since May 3 was Sunday)
  const may3 = new Date(2026, 4, 3);
  const may4 = new Date(2026, 4, 4);
  const may5 = new Date(2026, 4, 5);
  const may6 = new Date(2026, 4, 6);

  assert.equal(calSvc.getCalendarType(may3), 'Holiday', 'May 3 is Constitution Day (Holiday)');
  assert.equal(calSvc.getCalendarType(may4), 'Holiday', 'May 4 is Greenery Day (Holiday)');
  assert.equal(calSvc.getCalendarType(may5), 'Holiday', 'May 5 is Children Day (Holiday)');
  assert.equal(calSvc.getCalendarType(may6), 'Holiday', 'May 6 is Substitute Holiday for May 3');
});

registerTest('T5.4.4', '100x chaotic time warp fuzzing across arbitrary dates and times of day',
  'S5.4: Extreme Time Warp', () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  createFullAppDOM(env);

  const timetables = getMockTimetables('Weekday');
  const timetableSvc = new TimetableService();

  for (let i = 0; i < 100; i++) {
    // Generate random month (0..11), day (1..28), hour (0..23), minute (0..59), second (0..59)
    const m = i % 12;
    const d = (i % 28) + 1;
    const h = (i * 7) % 24;
    const min = (i * 13) % 60;
    const sec = (i * 17) % 60;

    const testDate = new Date(2026, m, d, h, min, sec);

    const deps = timetableSvc.getNextDepartures(timetables.line111Outbound, testDate, 5);
    const transferRes = transferService.calculateTransferRoute({
      leg1Timetable: timetables.line111Outbound,
      leg2Timetable: timetables.line133Outbound,
      direction: 'outbound',
      bufferMinutes: 5,
      currentTime: testDate
    });

    assert.ok(Array.isArray(deps), `Step ${i}: Departures array returned`);
    assert.ok(transferRes, `Step ${i}: Transfer result returned`);
    assert.ok(['ok', 'no_buses_available'].includes(transferRes.status), `Step ${i}: Valid status`);

    // Render UI to guarantee zero exceptions
    renderMainTransfer({
      direction: 'outbound',
      bufferMinutes: 5,
      transferResult: transferRes
    });
  }
});

// =========================================================================
// Suite 5.5: Filter Permutations, Empty States & Recovery Hardening (S5.5)
// =========================================================================

registerTest('T5.5.1', 'Filter resulting in 0 matching buses followed by clean filter reset to All',
  'S5.5: Filter Permutations', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  appInstance.storage.setApiKey('test_valid_key');
  const mockTables = getMockTimetables('Weekday');
  appInstance.timetables = mockTables;
  await appInstance.init();

  // 1. Switch to Stop View (Yokodai)
  env.document.getElementById('tab-stop-yokodai').click();
  const countBadge = env.document.getElementById('stop-view-count');
  const departureList = env.document.getElementById('stop-departure-list');

  assert.includes(countBadge.textContent, '直近');

  // 2. Set filter to 133 (Line 133 does NOT stop at YokodaiKitaguchi)
  env.document.getElementById('filter-133').click();

  // Assert empty state rendered
  assert.includes(countBadge.textContent, '直近0便');
  assert.includes(departureList.innerHTML, '該当する出発予定便はありません');

  // 3. Reset filter to All
  env.document.getElementById('filter-all').click();

  // Assert departures restored
  assert.false(countBadge.textContent.includes('直近0便'));
  assert.includes(departureList.innerHTML, '111系統');

  appInstance.polling?.stop();
});

registerTest('T5.5.2', '50x rapid filter oscillation between empty results and valid routes',
  'S5.5: Filter Permutations', async () => {
  const env = createBrowserEnv();
  globalThis.document = env.document;
  globalThis.window = env.window;
  createFullAppDOM(env);

  const appInstance = new App();
  await appInstance.init();

  env.document.getElementById('tab-stop-kamiooka').click();

  const filterSequence = ['filter-111', 'filter-133', 'filter-64', 'filter-all'];

  for (let i = 0; i < 50; i++) {
    const targetFilter = filterSequence[i % filterSequence.length];
    env.document.getElementById(targetFilter).click();

    const currentFilter = appInstance.state.getState().activeFilter;
    const chipBtn = env.document.getElementById(targetFilter);

    assert.true(chipBtn.classList.contains('active'), `Filter ${targetFilter} must have active class`);
    assert.equal(currentFilter, chipBtn.getAttribute('data-route'));

    const listEl = env.document.getElementById('stop-departure-list');
    assert.ok(listEl.children.length >= 1 || listEl.innerHTML.includes('該当する出発予定便はありません'));
  }

  appInstance.polling?.stop();
});

registerTest('T5.5.3', 'Multi-criteria filter isolation (route + destination + time cutoff)',
  'S5.5: Filter Permutations', () => {
  const timetables = getMockTimetables('Weekday');
  const timetableSvc = new TimetableService();

  const entries = timetables.line133Outbound; // Starts at Kamiooka, goes to Negishi via Koizumi

  // Filter with exact route '133' and destination '根岸駅前' and from 12:00
  const filtered = timetableSvc.filterTimetable(entries, {
    route: '133',
    destination: '根岸駅前',
    timeFrom: '12:00'
  });

  assert.ok(filtered.length > 0, 'Should find matching buses after 12:00');
  for (const item of filtered) {
    assert.includes(item.line, '133');
    assert.includes(item.destination, '根岸駅前');
    const min = timetableSvc.timeStringToMinutes(item.departureTime);
    assert.greaterOrEqual(min, 720, 'Departure time must be >= 12:00 (720 min)');
  }
});

registerTest('T5.5.4', 'XSS and special character injection into filter queries handled safely',
  'S5.5: Filter Permutations', () => {
  const timetables = getMockTimetables('Weekday');
  const timetableSvc = new TimetableService();

  const maliciousQueries = [
    '<script>alert("xss")</script>',
    '"><img src=x onerror=alert(1)>',
    '\' OR 1=1 --',
    '\\x00\\r\\n',
    '${7*7}',
    '{{constructor.constructor("alert(1)")()}}'
  ];

  for (const q of maliciousQueries) {
    let threw = false;
    let result = [];
    try {
      result = timetableSvc.filterTimetable(timetables.line111Outbound, {
        route: q,
        destination: q
      });
    } catch (err) {
      threw = true;
    }

    assert.false(threw, `Malicious query "${q}" must not throw exception`);
    assert.equal(result.length, 0, `Malicious query "${q}" should safely return empty array`);
  }
});

// Self-runner if executed directly
if (process.argv[1]?.endsWith('tier5-adversarial-stress-tests.js')) {
  console.log('\n========================================================================');
  console.log('       TIER 5: ADVERSARIAL STRESS & FAULT INJECTION SUITE              ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const t of tier5Tests) {
    const start = performance.now();
    try {
      await t.fn();
      const elapsed = (performance.now() - start).toFixed(1);
      passed++;
      console.log(`  ✔ PASS [${t.id}] ${t.name} (${elapsed}ms) [${t.stressArea}]`);
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(1);
      failed++;
      console.error(`  ✖ FAIL [${t.id}] ${t.name} (${elapsed}ms)`);
      console.error(`    ${err.message || err}`);
      if (err.stack) console.error(`    ${err.stack}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`  Tier 5 Results: ${passed}/${tier5Tests.length} Passed (${failed} Failed)`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}
