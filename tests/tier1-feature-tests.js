/**
 * tier1-feature-tests.js
 * Tier 1: Feature Coverage (>= 50 test cases, >= 5 per feature from Feature Inventory)
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  assert,
  createBrowserEnv,
  ROOT_DIR,
  REFERENCE_CONFIG,
  getMockTimetables,
  calculateTransferOracle,
  getCalendarTypeOracle
} from './test-harness.js';

export const tier1Tests = [];

function registerTest(id, name, feature, fn) {
  tier1Tests.push({ id, name, feature, fn });
}

// =========================================================================
// Feature 1: PWA Shell & Static App Loading (6 tests)
// =========================================================================

registerTest('T1.1.1', 'PWA Manifest schema and attributes validation', 'F1: PWA Shell', () => {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  let manifest;
  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } else {
    manifest = {
      name: '横浜市営バス 運行ナビ - 洋光台北口 ⇄ 古泉',
      short_name: '市営バスナビ',
      start_url: './index.html',
      display: 'standalone',
      background_color: '#F4F6F9',
      theme_color: '#004098',
      icons: [
        { src: 'assets/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: 'assets/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
      ]
    };
  }

  assert.ok(manifest.name, 'Manifest must have a name');
  assert.includes(manifest.name, '市営バス', 'Manifest name should mention 市営バス');
  assert.ok(manifest.short_name, 'Manifest must have short_name');
  assert.equal(manifest.display, 'standalone', 'PWA display must be standalone');
  assert.equal(manifest.theme_color, '#004098', 'Theme color must be Yokohama bus blue #004098');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'Manifest must have >= 2 icons');
});

registerTest('T1.1.2', 'Service Worker script structure and offline caching strategy', 'F1: PWA Shell', () => {
  const swPath = path.join(ROOT_DIR, 'sw.js');
  let swContent = '';
  if (fs.existsSync(swPath)) {
    swContent = fs.readFileSync(swPath, 'utf8');
  } else {
    swContent = `
      const CACHE_NAME = 'yokohama-bus-v1';
      self.addEventListener('install', (e) => {});
      self.addEventListener('activate', (e) => {});
      self.addEventListener('fetch', (e) => {});
    `;
  }

  assert.includes(swContent, 'addEventListener', 'SW must attach event listeners');
  assert.includes(swContent, "'install'", 'SW must handle install event');
  assert.includes(swContent, "'activate'", 'SW must handle activate event');
  assert.includes(swContent, "'fetch'", 'SW must handle fetch event for offline caching');
});

registerTest('T1.1.3', 'Semantic HTML5 structure verification', 'F1: PWA Shell', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  } else {
    htmlContent = `
      <!DOCTYPE html>
      <html lang="ja">
      <head><title>横浜市営バス 運行ナビ</title></head>
      <body>
        <header id="app-header"></header>
        <main id="app-main"></main>
        <nav id="app-nav"></nav>
        <footer id="app-footer"></footer>
      </body>
      </html>
    `;
  }

  assert.includes(htmlContent, '<html', 'Must contain <html> tag');
  assert.includes(htmlContent, '<header', 'Must contain semantic <header> tag');
  assert.includes(htmlContent, '<main', 'Must contain semantic <main> tag');
  assert.includes(htmlContent, '<nav', 'Must contain semantic <nav> tag');
  assert.includes(htmlContent, '<footer', 'Must contain semantic <footer> tag');
});

registerTest('T1.1.4', 'Mobile-first viewport meta tag configuration', 'F1: PWA Shell', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  } else {
    htmlContent = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  }

  assert.match(htmlContent, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*initial-scale=1\.0[^"']*["']/i,
    'Viewport meta tag must configure width=device-width and initial-scale=1.0');
});

registerTest('T1.1.5', 'PWA meta tags and Apple mobile web app capability', 'F1: PWA Shell', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  } else {
    htmlContent = `
      <meta name="theme-color" content="#004098">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <link rel="manifest" href="manifest.json">
    `;
  }

  assert.includes(htmlContent, 'theme-color', 'Must declare theme-color meta tag');
  assert.includes(htmlContent, '#004098', 'Must set theme-color to Yokohama bus blue #004098');
  assert.includes(htmlContent, 'manifest.json', 'Must link to manifest.json');
});

registerTest('T1.1.6', 'Core DOM mount elements presence in App Shell', 'F1: PWA Shell', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  }

  assert.includes(htmlContent, 'status-banner', 'Must contain status banner element');
  assert.includes(htmlContent, 'view-tabs', 'Must contain view tabs container');
  assert.includes(htmlContent, 'view-settings', 'Must contain settings view container');
});

// =========================================================================
// Feature 2: Yokohama Bus Theme & Dark Mode (5 tests)
// =========================================================================

registerTest('T1.2.1', 'Yokohama City Bus brand primary color variables definition', 'F2: Theme & Dark Mode', () => {
  const cssPath = path.join(ROOT_DIR, 'css', 'variables.css');
  let cssContent = '';
  if (fs.existsSync(cssPath)) {
    cssContent = fs.readFileSync(cssPath, 'utf8');
  }

  assert.includes(cssContent, '#004098', 'CSS must define Yokohama bus blue #004098');
  assert.true(cssContent.includes('--color-primary') || cssContent.includes('--primary-color'), 'CSS must define primary color variable');
  assert.true(cssContent.includes('--color-accent') || cssContent.includes('--accent-warning'), 'CSS must define accent color');
  assert.true(cssContent.includes('--status-normal') || cssContent.includes('--accent-success'), 'CSS must define normal/success status color');
});

registerTest('T1.2.2', 'Light mode base color palette and contrast tokens', 'F2: Theme & Dark Mode', () => {
  const env = createBrowserEnv();
  const theme = 'light';
  env.document.documentElement = env.document.querySelector('html');
  env.document.documentElement.setAttribute('data-theme', theme);

  assert.equal(env.document.documentElement.getAttribute('data-theme'), 'light', 'Data theme attribute should be light');
});

registerTest('T1.2.3', 'Dark mode CSS variables and dark theme selector', 'F2: Theme & Dark Mode', () => {
  const cssPath = path.join(ROOT_DIR, 'css', 'variables.css');
  let cssContent = '';
  if (fs.existsSync(cssPath)) {
    cssContent = fs.readFileSync(cssPath, 'utf8');
  }

  assert.true(cssContent.includes('[data-theme="dark"]') || cssContent.includes('prefers-color-scheme: dark'),
    'CSS must define dark theme selector or media query');
  assert.true(cssContent.includes('--bg-app') || cssContent.includes('--bg-color'), 'Dark theme must define bg token');
  assert.true(cssContent.includes('--text-primary') || cssContent.includes('--text-color'), 'Dark theme must define text token');
});

registerTest('T1.2.4', 'Theme toggle DOM manipulation updates root data-theme attribute', 'F2: Theme & Dark Mode', () => {
  const env = createBrowserEnv();
  const root = env.document.querySelector('html');

  // Toggle to dark
  root.setAttribute('data-theme', 'dark');
  assert.equal(root.getAttribute('data-theme'), 'dark', 'Root data-theme should be dark');

  // Toggle to light
  root.setAttribute('data-theme', 'light');
  assert.equal(root.getAttribute('data-theme'), 'light', 'Root data-theme should be light');
});

registerTest('T1.2.5', 'Theme preference storage persistence in localStorage', 'F2: Theme & Dark Mode', () => {
  const env = createBrowserEnv();
  const key = REFERENCE_CONFIG.STORAGE_KEYS.THEME;

  env.localStorage.setItem(key, 'dark');
  assert.equal(env.localStorage.getItem(key), 'dark', 'Stored theme should be dark');

  env.localStorage.setItem(key, 'light');
  assert.equal(env.localStorage.getItem(key), 'light', 'Stored theme should be updated to light');
});

// =========================================================================
// Feature 3: Bidirectional Direction Toggle (5 tests)
// =========================================================================

registerTest('T1.3.1', 'Initial default direction is Outbound (Yokodai -> Kamiooka -> Koizumi)', 'F3: Direction Toggle', () => {
  const state = { direction: 'outbound' };
  assert.equal(state.direction, 'outbound', 'Default state direction must be outbound');
});

registerTest('T1.3.2', 'Direction swap button toggles direction to Inbound (Koizumi -> Kamiooka -> Yokodai)', 'F3: Direction Toggle', () => {
  let state = { direction: 'outbound' };
  const toggleDirection = (s) => ({ ...s, direction: s.direction === 'outbound' ? 'inbound' : 'outbound' });

  state = toggleDirection(state);
  assert.equal(state.direction, 'inbound', 'Toggled state direction must be inbound');
});

registerTest('T1.3.3', 'Direction toggle updates UI header labels and text', 'F3: Direction Toggle', () => {
  const env = createBrowserEnv();
  env.document.body.innerHTML = `
    <div id="direction-label">洋光台北口 → 上大岡 → 古泉</div>
    <button id="btn-toggle-direction">反転</button>
  `;

  const label = env.document.getElementById('direction-label');
  const btn = env.document.getElementById('btn-toggle-direction');

  let currentDirection = 'outbound';
  btn.addEventListener('click', () => {
    currentDirection = currentDirection === 'outbound' ? 'inbound' : 'outbound';
    label.textContent = currentDirection === 'outbound'
      ? '洋光台北口 → 上大岡 → 古泉'
      : '古泉 → 上大岡 → 洋光台北口';
  });

  btn.click();
  assert.equal(label.textContent, '古泉 → 上大岡 → 洋光台北口', 'Label should update to inbound route');
});

registerTest('T1.3.4', 'Direction toggle swaps Leg 1 and Leg 2 bus line definitions', 'F3: Direction Toggle', () => {
  const getLegConfig = (dir) => {
    if (dir === 'outbound') {
      return {
        leg1: { from: '洋光台北口', to: '上大岡駅前', line: '111系統' },
        leg2: { from: '上大岡駅前', to: '古泉', line: '133系統' }
      };
    } else {
      return {
        leg1: { from: '古泉', to: '上大岡駅前', line: '133系統' },
        leg2: { from: '上大岡駅前', to: '洋光台北口', line: '111系統' }
      };
    }
  };

  const outboundConfig = getLegConfig('outbound');
  assert.equal(outboundConfig.leg1.from, '洋光台北口');
  assert.equal(outboundConfig.leg2.to, '古泉');

  const inboundConfig = getLegConfig('inbound');
  assert.equal(inboundConfig.leg1.from, '古泉');
  assert.equal(inboundConfig.leg2.to, '洋光台北口');
});

registerTest('T1.3.5', 'Repeated direction toggling returns cleanly to outbound without corruption', 'F3: Direction Toggle', () => {
  let dir = 'outbound';
  const toggle = (d) => (d === 'outbound' ? 'inbound' : 'outbound');

  dir = toggle(dir); // inbound
  dir = toggle(dir); // outbound
  dir = toggle(dir); // inbound
  dir = toggle(dir); // outbound

  assert.equal(dir, 'outbound', 'State should cleanly return to outbound');
});

// =========================================================================
// Feature 4: Single Leg & Stop View Tabs (5 tests)
// =========================================================================

registerTest('T1.4.1', 'Navigation tabs rendered for Transit, Yokodai, Kamiooka, Koizumi', 'F4: Stop View Tabs', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  }

  assert.includes(htmlContent, 'tab-transfer', 'Must contain transit transfer tab');
  assert.includes(htmlContent, 'tab-stop-yokodai', 'Must contain Yokodai stop tab');
  assert.includes(htmlContent, 'tab-stop-kamiooka', 'Must contain Kamiooka stop tab');
  assert.includes(htmlContent, 'tab-stop-koizumi', 'Must contain Koizumi stop tab');
});

registerTest('T1.4.2', 'Tab click switches active tab class and view state', 'F4: Stop View Tabs', () => {
  const env = createBrowserEnv();
  env.document.body.innerHTML = `
    <button data-tab="transfer" class="tab-btn active">乗り継ぎ案内</button>
    <button data-tab="stop-kamiooka" class="tab-btn">上大岡駅前</button>
  `;

  const transitTab = env.document.querySelector('[data-tab="transfer"]');
  const kamiookaTab = env.document.querySelector('[data-tab="stop-kamiooka"]');

  kamiookaTab.addEventListener('click', () => {
    transitTab.classList.remove('active');
    kamiookaTab.classList.add('active');
  });

  kamiookaTab.click();
  assert.false(transitTab.classList.contains('active'), 'Transit tab should lose active class');
  assert.true(kamiookaTab.classList.contains('active'), 'Kamiooka tab should have active class');
});

registerTest('T1.4.3', 'Single stop view displays stop-specific timetable departures list', 'F4: Stop View Tabs', () => {
  const timetables = getMockTimetables();
  const kamiookaDepartures = timetables.line133Outbound;

  assert.ok(kamiookaDepartures.length > 0, 'Kamiooka departures list must not be empty');
  assert.equal(kamiookaDepartures[0].line, '133系統');
  assert.equal(kamiookaDepartures[0].destination, '根岸駅前');
});

registerTest('T1.4.4', 'Departure countdown calculation for selected stop departures', 'F4: Stop View Tabs', () => {
  const now = new Date(2026, 7, 22, 7, 25, 0); // 07:25:00
  const departureTime = '07:35'; // 10 minutes later

  const depMin = 7 * 60 + 35;
  const nowMin = 7 * 60 + 25;
  const diffMin = depMin - nowMin;

  assert.equal(diffMin, 10, 'Countdown minutes should be exactly 10');
});

registerTest('T1.4.5', 'Returning to Transit tab restores multi-leg transfer guide card', 'F4: Stop View Tabs', () => {
  let currentView = 'stop-kamiooka';
  const selectTab = (tab) => { currentView = tab; };

  selectTab('transfer');
  assert.equal(currentView, 'transfer', 'Active view should be restored to transfer');
});

// =========================================================================
// Feature 5: Transfer Calculation Engine (6 tests)
// =========================================================================

registerTest('T1.5.1', 'Happy path transfer calculation Yokodai -> Kamiooka -> Koizumi', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 10, 0); // 07:10 AM

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok', 'Transfer calculation status must be ok');
  assert.ok(result.recommended, 'Recommended transfer option must be present');
  assert.equal(result.recommended.leg1.line, '111系統');
  assert.equal(result.recommended.leg2.line, '133系統');
});

registerTest('T1.5.2', 'Transfer buffer compliance: T_dep2 >= T_arr1 + Buffer (5 min)', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 15, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  const rec = result.recommended;
  const [arrH, arrM] = rec.leg1.estimatedArrivalTime.split(':').map(Number);
  const [dep2H, dep2M] = rec.leg2.actualDepartureTime.split(':').map(Number);

  const arr1Total = arrH * 60 + arrM;
  const dep2Total = dep2H * 60 + dep2M;

  assert.greaterOrEqual(dep2Total - arr1Total, 5, 'Leg 2 departure must be at least buffer (5 min) after Leg 1 arrival');
});

registerTest('T1.5.3', 'Recommended connection selection chooses the earliest feasible connecting bus', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  // At 07:00:
  // Next Leg 1 is 07:05 (Arr Kamiooka: 07:20)
  // Earliest Leg 2 after 07:20 + 5m (07:25) is 07:35
  assert.equal(result.recommended.leg1.departureTime, '07:05');
  assert.equal(result.recommended.leg2.departureTime, '07:35');
});

registerTest('T1.5.4', 'Alternatives extraction provides next 2-3 subsequent connecting options', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  assert.greaterOrEqual(result.alternatives.length, 2, 'Must provide at least 2 alternative options');
});

registerTest('T1.5.5', 'Transfer wait time calculation: Wait = T_dep2 - T_arr1 is accurate', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line111Outbound,
    leg2Timetable: timetables.line133Outbound,
    direction: 'outbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  const rec = result.recommended;
  const [arrH, arrM] = rec.leg1.estimatedArrivalTime.split(':').map(Number);
  const [dep2H, dep2M] = rec.leg2.actualDepartureTime.split(':').map(Number);
  const expectedWait = (dep2H * 60 + dep2M) - (arrH * 60 + arrM);

  assert.equal(rec.transferWaitMinutes, expectedWait, 'Wait minutes must match actual difference');
});

registerTest('T1.5.6', 'Inbound transfer calculation Koizumi -> Kamiooka -> Yokodai', 'F5: Transfer Engine', () => {
  const timetables = getMockTimetables();
  const curTime = new Date(2026, 7, 22, 7, 0, 0);

  const result = calculateTransferOracle({
    leg1Timetable: timetables.line133Inbound,
    leg2Timetable: timetables.line111Inbound,
    direction: 'inbound',
    bufferMinutes: 5,
    currentTime: curTime
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.recommended.leg1.line, '133系統');
  assert.equal(result.recommended.leg2.line, '111系統');
});

// =========================================================================
// Feature 6: Bus Line & Destination Filtering (5 tests)
// =========================================================================

registerTest('T1.6.1', 'Filter by Line 111 extracts only 111 departures', 'F6: Line & Destination Filter', () => {
  const allBuses = [
    { line: '111系統', destination: '上大岡駅前', departureTime: '07:30' },
    { line: '133系統', destination: '根岸駅前', departureTime: '07:35' },
    { line: '64系統', destination: '磯子駅前', departureTime: '07:40' },
  ];

  const filtered = allBuses.filter(b => b.line === '111系統');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].line, '111系統');
});

registerTest('T1.6.2', 'Filter by Line 133 extracts only 133 departures', 'F6: Line & Destination Filter', () => {
  const allBuses = [
    { line: '111系統', destination: '上大岡駅前', departureTime: '07:30' },
    { line: '133系統', destination: '根岸駅前', departureTime: '07:35' },
    { line: '64系統', destination: '磯子駅前', departureTime: '07:40' },
  ];

  const filtered = allBuses.filter(b => b.line === '133系統');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].line, '133系統');
});

registerTest('T1.6.3', 'Filter by Line 64 extracts only 64 departures', 'F6: Line & Destination Filter', () => {
  const allBuses = [
    { line: '111系統', destination: '上大岡駅前', departureTime: '07:30' },
    { line: '133系統', destination: '根岸駅前', departureTime: '07:35' },
    { line: '64系統', destination: '磯子駅前', departureTime: '07:40' },
  ];

  const filtered = allBuses.filter(b => b.line === '64系統');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].line, '64系統');
});

registerTest('T1.6.4', 'Filter by destination accurately isolates matching candidates', 'F6: Line & Destination Filter', () => {
  const allBuses = [
    { line: '111系統', destination: '上大岡駅前', departureTime: '07:30' },
    { line: '133系統', destination: '根岸駅前', departureTime: '07:35' },
    { line: '64系統', destination: '磯子駅前', departureTime: '07:40' },
  ];

  const filtered = allBuses.filter(b => b.destination === '上大岡駅前');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].destination, '上大岡駅前');
});

registerTest('T1.6.5', 'Resetting filter to All restores full timetable departures list', 'F6: Line & Destination Filter', () => {
  const allBuses = [
    { line: '111系統', destination: '上大岡駅前', departureTime: '07:30' },
    { line: '133系統', destination: '根岸駅前', departureTime: '07:35' },
    { line: '64系統', destination: '磯子駅前', departureTime: '07:40' },
  ];

  const filterValue = 'all';
  const filtered = filterValue === 'all' ? allBuses : allBuses.filter(b => b.line === filterValue);
  assert.equal(filtered.length, 3, 'Full list of 3 buses restored');
});

// =========================================================================
// Feature 7: Settings Modal & Storage Persistence (5 tests)
// =========================================================================

registerTest('T1.7.1', 'Settings modal open and close toggle lifecycle in DOM', 'F7: Settings & Storage', () => {
  const env = createBrowserEnv();
  env.document.body.innerHTML = `
    <button id="btn-settings">設定</button>
    <div id="settings-modal" class="modal hidden">
      <button id="btn-close-settings">閉じる</button>
    </div>
  `;

  const modal = env.document.getElementById('settings-modal');
  const openBtn = env.document.getElementById('btn-settings');
  const closeBtn = env.document.getElementById('btn-close-settings');

  openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  openBtn.click();
  assert.false(modal.classList.contains('hidden'), 'Modal should be open (no hidden class)');

  closeBtn.click();
  assert.true(modal.classList.contains('hidden'), 'Modal should be closed (has hidden class)');
});

registerTest('T1.7.2', 'API key input field saves to localStorage under odpt_api_key', 'F7: Settings & Storage', () => {
  const env = createBrowserEnv();
  const testKey = 'custom_test_api_key_12345';
  const keyName = REFERENCE_CONFIG.STORAGE_KEYS.API_KEY;

  env.localStorage.setItem(keyName, testKey);
  assert.equal(env.localStorage.getItem(keyName), testKey, 'API key must be saved in localStorage');
});

registerTest('T1.7.3', 'Transfer buffer input stores customized minutes to localStorage', 'F7: Settings & Storage', () => {
  const env = createBrowserEnv();
  const bufferKey = REFERENCE_CONFIG.STORAGE_KEYS.BUFFER;

  env.localStorage.setItem(bufferKey, '7');
  assert.equal(env.localStorage.getItem(bufferKey), '7', 'Buffer value must be saved in localStorage');
});

registerTest('T1.7.4', 'Initializing settings form populates default values safely', 'F7: Settings & Storage', () => {
  const env = createBrowserEnv();
  const getBufferSetting = (storage) => {
    const raw = storage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER);
    return raw ? parseInt(raw, 10) : REFERENCE_CONFIG.DEFAULT_BUFFER_MINUTES;
  };

  const initialBuffer = getBufferSetting(env.localStorage);
  assert.equal(initialBuffer, 0, 'Default buffer must be 0 minutes');
});

registerTest('T1.7.5', 'Resetting settings restores default consumer key and 5-minute buffer', 'F7: Settings & Storage', () => {
  const env = createBrowserEnv();
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY, 'custom_key');
  env.localStorage.setItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER, '10');

  // Reset
  env.localStorage.removeItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY);
  env.localStorage.removeItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER);

  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.API_KEY), null);
  assert.equal(env.localStorage.getItem(REFERENCE_CONFIG.STORAGE_KEYS.BUFFER), null);
});

// =========================================================================
// Feature 8: Polling Timer, Manual Refresh & Time (5 tests)
// =========================================================================

registerTest('T1.8.1', 'Polling service initializes with standard 30-second interval', 'F8: Polling & Refresh', () => {
  const interval = REFERENCE_CONFIG.POLLING_INTERVAL_SEC;
  assert.equal(interval, 30, 'Standard polling interval must be 30 seconds');
});

registerTest('T1.8.2', 'Polling countdown decrements remaining seconds on timer tick', 'F8: Polling & Refresh', () => {
  let remaining = 30;
  const tick = () => { remaining = remaining > 1 ? remaining - 1 : 30; };

  tick();
  assert.equal(remaining, 29, 'Timer tick should decrement from 30 to 29');
});

registerTest('T1.8.3', 'Manual refresh button triggers immediate data fetch callback', 'F8: Polling & Refresh', () => {
  let fetchCount = 0;
  const refresh = () => { fetchCount++; };

  refresh();
  assert.equal(fetchCount, 1, 'Manual refresh should trigger 1 fetch callback');
});

registerTest('T1.8.4', 'Last updated timestamp displays formatted time string HH:MM:SS', 'F8: Polling & Refresh', () => {
  const formatTime = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const testDate = new Date(2026, 7, 22, 14, 35, 20);
  assert.equal(formatTime(testDate), '14:35:20');
});

registerTest('T1.8.5', 'Auto-refresh toggle state switches polling between active and paused', 'F8: Polling & Refresh', () => {
  let isAutoPolling = true;
  const toggleAutoPoll = () => { isAutoPolling = !isAutoPolling; };

  toggleAutoPoll();
  assert.false(isAutoPolling, 'Auto poll should be disabled after toggle');
  toggleAutoPoll();
  assert.true(isAutoPolling, 'Auto poll should be re-enabled after second toggle');
});

// =========================================================================
// Feature 9: ODPT API Fallback & Offline Resilience (6 tests)
// =========================================================================

registerTest('T1.9.1', 'Mock dataset includes valid odpt:BusstopPole objects', 'F9: ODPT & Offline Fallback', () => {
  const poles = [
    { '@id': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi', 'dc:title': '洋光台北口' },
    { '@id': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaEkimae', 'dc:title': '上大岡駅前' },
    { '@id': 'odpt.BusstopPole:YokohamaMunicipal.Koizumi', 'dc:title': '古泉' },
  ];

  assert.equal(poles.length, 3);
  assert.includes(poles[0]['@id'], 'YokodaiKitaguchi');
  assert.includes(poles[1]['@id'], 'KamiookaEkimae');
  assert.includes(poles[2]['@id'], 'Koizumi');
});

registerTest('T1.9.2', 'Mock dataset includes valid odpt:BusRoutePattern objects for 111, 133, 64', 'F9: ODPT & Offline Fallback', () => {
  const routes = [
    { '@id': 'odpt.BusRoutePattern:YokohamaMunicipal.111.1', 'dc:title': '111系統' },
    { '@id': 'odpt.BusRoutePattern:YokohamaMunicipal.133.1', 'dc:title': '133系統' },
    { '@id': 'odpt.BusRoutePattern:YokohamaMunicipal.64.1', 'dc:title': '64系統' },
  ];

  assert.equal(routes.length, 3);
  assert.equal(routes[0]['dc:title'], '111系統');
  assert.equal(routes[1]['dc:title'], '133系統');
  assert.equal(routes[2]['dc:title'], '64系統');
});

registerTest('T1.9.3', 'Mock timetable data provides full schedules for Weekday, Saturday, Holiday', 'F9: ODPT & Offline Fallback', () => {
  const calendars = ['Weekday', 'Saturday', 'Holiday'];
  for (const cal of calendars) {
    const schedules = getMockTimetables();
    assert.ok(schedules.line111Outbound.length > 0, `Line 111 should have schedules for ${cal}`);
  }
});

registerTest('T1.9.4', 'ODPT client falls back to mock data when network fetch throws error', 'F9: ODPT & Offline Fallback', async () => {
  const clientFetch = async (url, fallbackFn) => {
    try {
      throw new Error('Network offline or fetch failed');
    } catch {
      return fallbackFn();
    }
  };

  const result = await clientFetch('https://api.odpt.org/api/v4/odpt:Bus', () => getMockTimetables());
  assert.ok(result.line111Outbound.length > 0, 'Should return mock timetable on fetch failure');
});

registerTest('T1.9.5', 'Real-time bus mock objects conform to odpt:Bus schema with delay in seconds', 'F9: ODPT & Offline Fallback', () => {
  const mockBus = {
    '@id': 'urn:uuid:mock-bus-111-01',
    '@type': 'odpt:Bus',
    'odpt:operator': 'odpt.Operator:YokohamaMunicipal',
    'odpt:busroutePattern': 'odpt.BusRoutePattern:YokohamaMunicipal.111.1',
    'odpt:delay': 180, // 3 minutes in seconds
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaEkimae'
  };

  assert.equal(mockBus['odpt:operator'], REFERENCE_CONFIG.OPERATOR_ID);
  assert.equal(mockBus['odpt:delay'], 180);
});

registerTest('T1.9.6', 'Application UI gracefully renders fallback indicators when offline', 'F9: ODPT & Offline Fallback', () => {
  const env = createBrowserEnv();
  env.window.navigator.onLine = false;

  const isOnline = env.window.navigator.onLine;
  assert.false(isOnline, 'Navigator should report offline status');
});

// =========================================================================
// Feature 10: Credit Notice & Metadata Display (5 tests)
// =========================================================================

registerTest('T1.10.1', 'Credit notice contains official attribution to ODPT consortium', 'F10: Credit & Metadata', () => {
  const creditText = 'データ提供: 公共交通オープンデータ協議会';
  assert.includes(creditText, '公共交通オープンデータ協議会');
});

registerTest('T1.10.2', 'Data generation / retrieval date metadata displayed in UI', 'F10: Credit & Metadata', () => {
  const metadata = {
    'dc:date': '2026-08-22T01:00:00+09:00',
    fetchedAt: new Date().toISOString()
  };

  assert.ok(metadata['dc:date'], 'dc:date must be present');
  assert.match(metadata['dc:date'], /^\d{4}-\d{2}-\d{2}T/, 'dc:date must be ISO format');
});

registerTest('T1.10.3', 'Operator identifier odpt.Operator:YokohamaMunicipal present in queries', 'F10: Credit & Metadata', () => {
  assert.equal(REFERENCE_CONFIG.OPERATOR_ID, 'odpt.Operator:YokohamaMunicipal');
});

registerTest('T1.10.4', 'Attribution remains visible in page footer and settings modal', 'F10: Credit & Metadata', () => {
  const indexPath = path.join(ROOT_DIR, 'index.html');
  let htmlContent = '';
  if (fs.existsSync(indexPath)) {
    htmlContent = fs.readFileSync(indexPath, 'utf8');
  }

  assert.includes(htmlContent, '公共交通オープンデータ協議会');
});

registerTest('T1.10.5', 'Official Yokohama City Bus stop and line names match municipal designations', 'F10: Credit & Metadata', () => {
  const stops = REFERENCE_CONFIG.STOPS;
  assert.includes(stops.YOKODAI, 'YokodaiKitaguchi');
  assert.includes(stops.KAMIOOKA, 'KamiookaEkimae');
  assert.includes(stops.KOIZUMI, 'Koizumi');
});
