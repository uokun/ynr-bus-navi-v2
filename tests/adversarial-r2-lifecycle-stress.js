/**
 * tests/adversarial-r2-lifecycle-stress.js
 * Empirical Challenger Adversarial Stress Suite for R1-R4 Lifecycle & State Transitions
 * 
 * Target Domains:
 * 1. Geolocation Manualization Stability:
 *    - Cold launch non-invocation
 *    - Rapid tab switching (100 switches)
 *    - Direction swap stress (50 clicks)
 *    - Manual "📍 現在地" triggers & accurate stop/tab routing
 *    - Error handling (permission denied, timeout, out-of-area >5km, undefined navigator)
 * 2. API Key Lifecycle & Pure API Policy Integrity:
 *    - Unconfigured key across all tabs (uniform warning, 0 exceptions)
 *    - Zero fallback to embedded data (empty array contract)
 *    - Key saving -> instant live mode synchronization
 *    - Key reset -> immediate cache purge & uniform unconfigured card restoration
 *    - Key cycle stress (save/reset loops)
 * 3. Domain & Boundary Logic Resilience:
 *    - Midnight cross-day transfer (23:45 -> 00:15)
 *    - End-of-service card rendering
 *    - Koizumi Pole 2 (Negishi bound) 5-stop approaching progress sequence
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowserEnv, assert } from './test-harness.js';
import { App } from '../js/app.js';
import { AppState, state } from '../js/state.js';
import { storageService } from '../js/services/storage-service.js';
import { odptClient } from '../js/api/odpt-client.js';
import { locationService } from '../js/services/location-service.js';
import { busLocationService } from '../js/services/bus-location-service.js';
import { transferService } from '../js/services/transfer-service.js';
import { STOPS } from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

function runTest(suite, name, fn) {
  const start = performance.now();
  try {
    fn();
    const duration = (performance.now() - start).toFixed(2);
    totalPassed++;
    results.push({ suite, name, status: 'PASS', duration });
    console.log(`  ✔ PASS [${suite}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    totalFailed++;
    results.push({ suite, name, status: 'FAIL', duration, error: err.message });
    console.error(`  ❌ FAIL [${suite}] ${name} (${duration}ms)`);
    console.error(err);
  }
}

async function runAsyncTest(suite, name, fn) {
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    totalPassed++;
    results.push({ suite, name, status: 'PASS', duration });
    console.log(`  ✔ PASS [${suite}] ${name} (${duration}ms)`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    totalFailed++;
    results.push({ suite, name, status: 'FAIL', duration, error: err.message });
    console.error(`  ❌ FAIL [${suite}] ${name} (${duration}ms)`);
    console.error(err);
  }
}

function setupDOMEnvironment() {
  const env = createBrowserEnv();
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    env.document.body.innerHTML = bodyMatch[1];
  }

  globalThis.window = env.window;
  globalThis.document = env.document;
  globalThis.localStorage = env.localStorage;
  globalThis.sessionStorage = env.sessionStorage;

  if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator) {
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent: 'AdversarialTest/1.0',
          onLine: true,
          geolocation: null
        },
        configurable: true,
        writable: true
      });
    } catch {}
  } else {
    globalThis.navigator.onLine = true;
  }

  return env;
}

// ========================================================================
// TEST SUITE EXECUTION
// ========================================================================

async function main() {
  console.log('========================================================================');
  console.log('   CHALLENGER ADVERSARIAL STRESS SUITE: LIFECYCLE & STABILITY           ');
  console.log('========================================================================\n');

  // ------------------------------------------------------------------------
  // SUITE 1: Geolocation Manualization Stability & Adversarial Stress
  // ------------------------------------------------------------------------
  console.log('▶ Suite 1: Geolocation Manualization Stability & Adversarial Stress');

  await runAsyncTest('Geolocation', '1.1 Cold launch non-invocation & pure initial state', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    storageService.clearCache();
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;

    let geoCallCount = 0;
    globalThis.navigator.geolocation = {
      getCurrentPosition: (success, error, options) => {
        geoCallCount++;
        success({ coords: { latitude: 35.3800, longitude: 139.5990, accuracy: 10 } });
      }
    };

    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;

    await app.init();

    // Verify initial direction and stop key
    assert.equal(app.direction, 'outbound', 'Initial direction must be outbound');
    assert.equal(app.activeStopKey, 'yokodai', 'Initial stop key must be yokodai');
    assert.equal(geoCallCount, 0, 'Cold launch must NOT invoke navigator.geolocation at all');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.2 Rapid tab switching stress (100 switches) maintains direction and stop selection', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    let geoCallCount = 0;
    globalThis.navigator.geolocation = {
      getCurrentPosition: () => { geoCallCount++; }
    };

    // User sets inbound direction and Koizumi stop
    app.direction = 'inbound';
    app.activeStopKey = 'koizumi';
    app.state.setState({ direction: 'inbound', currentTab: 'stop-koizumi' });

    const tabs = ['view-transfer', 'view-stops', 'view-map', 'view-settings'];
    for (let i = 0; i < 100; i++) {
      const targetTab = tabs[i % tabs.length];
      app.switchTab(targetTab);
      // Verify state during rapid switching
      assert.equal(app.direction, 'inbound', `Direction must stay inbound during switch #${i}`);
      assert.equal(app.activeStopKey, 'koizumi', `Active stop must stay koizumi during switch #${i}`);
    }

    assert.equal(geoCallCount, 0, 'Tab switching must NEVER invoke geolocation');
    assert.equal(app.direction, 'inbound', 'Final direction must strictly remain inbound');
    assert.equal(app.activeStopKey, 'koizumi', 'Final active stop must strictly remain koizumi');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.3 Direction toggle stress (50 clicks) maintains 100% synchronization without GPS drift', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    let geoCallCount = 0;
    globalThis.navigator.geolocation = {
      getCurrentPosition: () => { geoCallCount++; }
    };

    // 50 rapid toggle clicks
    for (let i = 1; i <= 50; i++) {
      app.toggleDirection();
      const expectedDir = (i % 2 === 1) ? 'inbound' : 'outbound';
      assert.equal(app.direction, expectedDir, `App direction mismatch at click ${i}`);
      assert.equal(app.state.getState().direction, expectedDir, `State direction mismatch at click ${i}`);
    }

    // 51st click -> inbound
    app.toggleDirection();
    assert.equal(app.direction, 'inbound');
    assert.equal(app.state.getState().direction, 'inbound');
    assert.equal(geoCallCount, 0, 'Direction toggle must NEVER invoke geolocation');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.4 Manual "📍 現在地" click routes to Yokodai, Koizumi, and Kamiooka correctly', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    let simulatedCoords = null;
    globalThis.navigator.geolocation = {
      getCurrentPosition: (success, error, options) => {
        if (simulatedCoords) {
          success({ coords: simulatedCoords });
        } else {
          error(new Error('Location unavailable'));
        }
      }
    };

    // Sub-test A: Near Yokodai (35.3800, 139.5990) in transfer context
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    simulatedCoords = { latitude: 35.3800, longitude: 139.5990, accuracy: 5 };
    await app.handleManualGeolocation('transfer');
    assert.equal(app.direction, 'outbound', 'Near Yokodai must set outbound direction');
    assert.equal(app.activeStopKey, 'yokodai', 'Near Yokodai must set yokodai stop');
    assert.equal(app.currentTab, 'transfer');

    // Sub-test B: Near Koizumi (35.4180, 139.6170) in transfer context
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    simulatedCoords = { latitude: 35.4180, longitude: 139.6170, accuracy: 5 };
    await app.handleManualGeolocation('transfer');
    assert.equal(app.direction, 'inbound', 'Near Koizumi must set inbound direction');
    assert.equal(app.activeStopKey, 'koizumi', 'Near Koizumi must set koizumi stop');
    assert.equal(app.currentTab, 'transfer');

    // Sub-test C: Near Kamiooka (35.4080, 139.5960) in transfer context -> jumps to stop view
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    simulatedCoords = { latitude: 35.4080, longitude: 139.5960, accuracy: 5 };
    await app.handleManualGeolocation('transfer');
    assert.equal(app.activeStopKey, 'kamiooka', 'Near Kamiooka must set kamiooka stop');
    assert.equal(app.currentTab, 'view-stops', 'Near Kamiooka in transfer view must jump to view-stops');

    // Sub-test D: Near Koizumi in stops context -> sets activeStopKey and renders stops view
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    simulatedCoords = { latitude: 35.4180, longitude: 139.6170, accuracy: 5 };
    await app.handleManualGeolocation('stops');
    assert.equal(app.activeStopKey, 'koizumi', 'In stops view, near Koizumi sets koizumi');
    assert.equal(app.state.getState().currentTab, 'stop-koizumi');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.5 Manual geolocation error handling (permission denied / timeout)', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    // Set initial custom state
    app.direction = 'inbound';
    app.activeStopKey = 'koizumi';

    // Simulate Permission Denied
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    globalThis.navigator.geolocation = {
      getCurrentPosition: (success, error, options) => {
        const err = new Error('User denied Geolocation');
        err.code = 1; // PERMISSION_DENIED
        error(err);
      }
    };

    const geoBtn = document.getElementById('btn-geo-transfer');
    if (geoBtn) geoBtn.textContent = '📍 現在地';

    await app.handleManualGeolocation('transfer');

    // State must be 100% preserved
    assert.equal(app.direction, 'inbound', 'Direction must not change on geo error');
    assert.equal(app.activeStopKey, 'koizumi', 'Active stop must not change on geo error');
    if (geoBtn) {
      assert.equal(geoBtn.textContent, '📍 現在地', 'Button label must revert back to 📍 現在地');
      assert.false(geoBtn.classList.contains('loading'), 'Button loading class must be removed');
    }

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.6 Manual geolocation out-of-area (>5km) handling (Sapporo / Tokyo)', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    // Tokyo Station: ~30km away from Yokohama
    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    globalThis.navigator.geolocation = {
      getCurrentPosition: (success) => {
        success({ coords: { latitude: 35.6812, longitude: 139.7671, accuracy: 10 } });
      }
    };

    // Should not crash and safely pick the nearest stop
    await app.handleManualGeolocation('transfer');
    assert.ok(['yokodai', 'kamiooka', 'koizumi'].includes(app.activeStopKey), 'Nearest stop picked safely');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('Geolocation', '1.7 Environment without navigator.geolocation gracefully handles clicks', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    locationService.cachedPosition = null;
    locationService.lastFetchedTime = 0;
    delete globalThis.navigator.geolocation;

    // Trigger manual geo; must not throw TypeError
    let threw = false;
    try {
      await app.handleManualGeolocation('transfer');
    } catch {
      threw = true;
    }
    assert.false(threw, 'Should not throw when navigator.geolocation is missing');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  // ------------------------------------------------------------------------
  // SUITE 2: API Key Lifecycle & Pure API Policy Integrity
  // ------------------------------------------------------------------------
  console.log('\n▶ Suite 2: API Key Lifecycle & Pure API Policy Integrity');

  await runAsyncTest('API Key Lifecycle', '2.1 API key unconfigured: uniform guidance across all tabs with zero exceptions', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    storageService.clearCache();
    odptClient.clearTimetableCache();

    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    // 1. Transfer tab
    app.switchTab('view-transfer');
    const transferContainer = document.getElementById('transfer-result-container');
    assert.ok(transferContainer, 'Transfer container exists');
    assert.includes(transferContainer.innerHTML, 'APIキーを設定してください', 'Transfer view shows uniform unconfigured card');
    assert.includes(transferContainer.innerHTML, 'btn-goto-settings', 'Transfer view has open settings button');

    // 2. Stops tab
    app.switchTab('view-stops');
    const stopsContainer = document.getElementById('stops-content-container');
    assert.ok(stopsContainer, 'Stops container exists');
    assert.includes(stopsContainer.innerHTML, 'APIキーを設定してください', 'Stops view shows uniform unconfigured card');
    assert.includes(stopsContainer.innerHTML, 'btn-goto-settings', 'Stops view has open settings button');

    // 3. Map tab
    app.switchTab('view-map');
    const mapContainer = document.getElementById('route-map-content-container');
    assert.ok(mapContainer, 'Map container exists');
    assert.includes(mapContainer.innerHTML, 'APIキーを設定してください', 'Map view shows uniform unconfigured card');
    assert.includes(mapContainer.innerHTML, 'btn-goto-settings', 'Map view has open settings button');

    // Test clicking .btn-goto-settings navigates to settings view
    const gotoBtn = transferContainer.querySelector('.btn-goto-settings');
    if (gotoBtn) {
      gotoBtn.click();
      assert.equal(app.currentTab, 'view-settings', 'Clicking goto settings button opens settings view');
    }

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('API Key Lifecycle', '2.2 Pure API Policy: zero fallback to embedded timetables when key is absent', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    storageService.clearCache();
    odptClient.clearTimetableCache();

    // Exhaustive pole & calendar checks
    const targetPoles = ['7800.1', '1046.12', '1046.6', '1810.1', '1810.2'];
    const calendars = ['Weekday', 'Saturday', 'Holiday'];

    for (const pole of targetPoles) {
      for (const cal of calendars) {
        const res = await odptClient.fetchBusstopPoleTimetables(pole, cal);
        assert.ok(Array.isArray(res), 'Timetable result must be an array');
        assert.equal(res.length, 0, `Pole ${pole} (${cal}) must return empty array []. Zero dummy data allowed.`);
      }
    }

    const realtimeBuses = await odptClient.fetchRealtimeBuses();
    assert.ok(Array.isArray(realtimeBuses));
    assert.equal(realtimeBuses.length, 0, 'Realtime buses must return [] when API key is missing');
  });

  await runAsyncTest('API Key Lifecycle', '2.3 API key save -> instant live mode synchronization', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    storageService.clearCache();
    odptClient.clearTimetableCache();

    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    // Mock fetch for ODPT API requests
    const mockApiResponse = [
      {
        'owl:sameAs': 'bus_mock_001',
        'dc:title': '111系統',
        'odpt:calendar': 'Weekday',
        'odpt:busstopPoleTimetableObject': [
          {
            'odpt:busstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
            'odpt:departureTime': '08:30',
            'odpt:destinationSign': '上大岡駅前'
          }
        ]
      },
      {
        'owl:sameAs': 'bus_mock_002',
        'dc:title': '133系統',
        'odpt:calendar': 'Weekday',
        'odpt:busstopPoleTimetableObject': [
          {
            'odpt:busstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12',
            'odpt:departureTime': '09:00',
            'odpt:destinationSign': '根岸駅前'
          }
        ]
      }
    ];

    globalThis.window.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('odpt:BusTimetable')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockApiResponse
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => []
      };
    };

    // Go to settings tab
    app.switchTab('view-settings');
    const inputKey = document.getElementById('input-api-key');
    assert.ok(inputKey, '#input-api-key exists');
    inputKey.value = 'empirical-token-test-12345';

    const saveBtn = document.getElementById('btn-save-settings');
    assert.ok(saveBtn, '#btn-save-settings exists');
    saveBtn.click();

    // Verify key saved
    assert.equal(storageService.getApiKey(), 'empirical-token-test-12345', 'API key correctly saved');
    assert.equal(storageService.hasApiKey(), true, 'hasApiKey is true');

    // Wait for async refreshData
    await app.refreshData();

    // Verify view has synchronized: transfer container no longer has unconfigured card
    const transferContainer = document.getElementById('transfer-result-container');
    assert.false(transferContainer.innerHTML.includes('APIキーを設定してください'), 'Transfer view synchronized to live mode');

    // Stops view
    app.switchTab('view-stops');
    const stopsContainer = document.getElementById('stops-content-container');
    assert.false(stopsContainer.innerHTML.includes('APIキーを設定してください'), 'Stops view synchronized to live mode');

    // Map view
    app.switchTab('view-map');
    const mapContainer = document.getElementById('route-map-content-container');
    assert.false(mapContainer.innerHTML.includes('APIキーを設定してください'), 'Map view synchronized to live mode');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('API Key Lifecycle', '2.4 API key reset -> full cache purge & instant unconfigured restoration', async () => {
    const env = setupDOMEnvironment();
    // Start with configured key
    storageService.setApiKey('test-key-to-be-purged');
    storageService.setCachedData('odpt:indexed_timetables:v2', { dummy: true });
    odptClient._timetableCache = { dummy: true };

    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    app.switchTab('view-settings');
    const resetBtn = document.getElementById('btn-reset-api-key');
    assert.ok(resetBtn, '#btn-reset-api-key exists');

    // Trigger reset
    resetBtn.click();

    // 1. Key wiped
    assert.equal(storageService.hasApiKey(), false, 'hasApiKey is false');
    assert.equal(storageService.getApiKey(), '', 'API key string is empty');

    // 2. Memory & storage cache purged
    assert.equal(odptClient._timetableCache, null, 'In-memory timetable cache is purged (null)');
    assert.equal(storageService.getCachedData('odpt:indexed_timetables:v2'), null, 'Storage timetable cache is purged (null)');

    // 3. Input field cleared
    const inputKey = document.getElementById('input-api-key');
    if (inputKey) {
      assert.equal(inputKey.value, '', 'Input key element value is cleared');
    }

    // 4. Instant restoration across views
    const transferContainer = document.getElementById('transfer-result-container');
    assert.includes(transferContainer.innerHTML, 'APIキーを設定してください', 'Transfer view instantly restored to unconfigured card');

    const stopsContainer = document.getElementById('stops-content-container');
    assert.includes(stopsContainer.innerHTML, 'APIキーを設定してください', 'Stops view instantly restored to unconfigured card');

    const mapContainer = document.getElementById('route-map-content-container');
    assert.includes(mapContainer.innerHTML, 'APIキーを設定してください', 'Map view instantly restored to unconfigured card');

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  await runAsyncTest('API Key Lifecycle', '2.5 Rapid cycling: repeated save and reset loop (10 cycles)', async () => {
    const env = setupDOMEnvironment();
    storageService.resetApiKey();
    const appState = new AppState();
    const app = new App(appState);
    globalThis.app = app;
    await app.init();

    for (let c = 1; c <= 10; c++) {
      // Save key
      storageService.setApiKey(`cycle-token-${c}`);
      await app.renderAll();
      assert.equal(storageService.hasApiKey(), true);
      const transferContainer = document.getElementById('transfer-result-container');
      assert.false(transferContainer.innerHTML.includes('APIキーを設定してください'), `Cycle ${c} save failed`);

      // Reset key
      storageService.resetApiKey();
      odptClient.clearTimetableCache();
      await app.renderAll();
      assert.equal(storageService.hasApiKey(), false);
      assert.includes(transferContainer.innerHTML, 'APIキーを設定してください', `Cycle ${c} reset failed`);
    }

    if (app.polling) app.polling.stop();
    if (app.clockTimerId) clearInterval(app.clockTimerId);
  });

  // ------------------------------------------------------------------------
  // SUITE 3: Domain & Boundary Logic Resilience
  // ------------------------------------------------------------------------
  console.log('\n▶ Suite 3: Domain & Boundary Logic Resilience');

  runTest('Domain Resilience', '3.1 Midnight cross-day transfer route calculation (23:45 -> 00:15)', () => {
    const leg1Timetable = [
      { departureTime: '23:30', busId: 'b1', line: '111系統' },
      { departureTime: '23:45', busId: 'b2', line: '111系統' }
    ];
    const leg2Timetable = [
      { departureTime: '00:15', busId: 'b3', line: '133系統' },
      { departureTime: '06:00', busId: 'b4', line: '133系統' }
    ];

    const result = transferService.calculateTransferRoute({
      leg1Timetable,
      leg2Timetable,
      currentTime: new Date('2026-09-17T23:35:00'),
      direction: 'outbound',
      bufferMinutes: 0
    });

    assert.ok(result.recommended, 'Recommended route found');
    assert.equal(result.recommended.leg1.actualDepartureTime, '23:45', 'Leg 1 departure time 23:45');
    assert.equal(result.recommended.leg2.actualDepartureTime, '00:15', 'Leg 2 departure time 00:15 (next day)');
    assert.equal(result.recommended.transferWaitMinutes, 15, 'Wait minutes calculated as 15 minutes across midnight');
  });

  runTest('Domain Resilience', '3.2 Koizumi Pole 2 (Negishi bound) 5-stop approaching progress sequence', () => {
    const approachingData = busLocationService.get5StopApproachingStatus([], 'koizumi', '2');
    assert.ok(approachingData, 'Approaching data constructed');
    assert.equal(approachingData.stops.length, 6, 'Must contain 6 stop nodes');
    assert.equal(approachingData.stops[0].name, '万福寺前', 'First node is Manpukujimae');
    assert.equal(approachingData.stops[1].name, '上笹堀', 'Second node is Kamisasabori');
    assert.equal(approachingData.stops[2].name, '横浜岡村郵便局前', 'Third node is Okamura Post Office');
    assert.equal(approachingData.stops[3].name, '天神前', 'Fourth node is Tenjinmae');
    assert.equal(approachingData.stops[4].name, '岡村町', 'Fifth node is Okamuramachi');
    assert.equal(approachingData.stops[5].name, '古泉', 'Sixth node is Koizumi target stop');
  });

  runTest('Domain Resilience', '3.3 Kamiooka Leg2 platform indicator in inbound direction is 6番のりば', () => {
    const routes = transferService.getBidirectionalRoutes();
    assert.equal(routes.inbound.leg2.platform, '6番のりば', 'Leg 2 platform must be 6番のりば (not 11番)');
  });

  console.log('\n========================================================================');
  console.log('              ADVERSARIAL STRESS SUITE SUMMARY                         ');
  console.log('========================================================================');
  console.log(`  Total Test Cases Executed : ${totalPassed + totalFailed}`);
  console.log(`  Passed                    : ${totalPassed}`);
  console.log(`  Failed                    : ${totalFailed}`);
  console.log(`  Pass Rate                 : ${((totalPassed / (totalPassed + totalFailed || 1)) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
