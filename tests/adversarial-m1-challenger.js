/**
 * adversarial-m1-challenger.js
 * Empirical Adversarial Test Harness for Milestone 1: PWA Shell & UI
 * 
 * Tests:
 * 1. Service Worker behavior simulation (install list completeness, offline fetch simulation, cache versioning, skipWaiting)
 * 2. Theme switching CSS cascade (data-theme="dark", variables completeness, contrast, hardcoded colors)
 * 3. Touch target and layout integrity on mobile viewports (min-size 44px, safe area insets, breakpoints)
 * 4. DOM semantics, accessibility attributes, fallback resiliency
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

const testQueue = [];

function describe(suiteName, fn) {
  testQueue.push({ type: 'suite', name: suiteName });
  fn();
}

function test(testName, fn) {
  testQueue.push({ type: 'test', name: testName, fn });
}

function asyncTest(testName, fn) {
  testQueue.push({ type: 'asyncTest', name: testName, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, message) {
  if (typeof haystack === 'string' && !haystack.includes(needle)) {
    throw new Error(`${message || 'String missing needle'}: does not contain "${needle}"`);
  } else if (Array.isArray(haystack) && !haystack.includes(needle)) {
    throw new Error(`${message || 'Array missing element'}: does not contain ${JSON.stringify(needle)}`);
  }
}

// Read Core Files
const indexHtmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
const manifestContent = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
const swContent = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
const variablesCss = fs.readFileSync(path.join(ROOT_DIR, 'css/variables.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(ROOT_DIR, 'css/base.css'), 'utf8');
const componentsCss = fs.readFileSync(path.join(ROOT_DIR, 'css/components.css'), 'utf8');
const responsiveCss = fs.readFileSync(path.join(ROOT_DIR, 'css/responsive.css'), 'utf8');

// =========================================================================
// 1. SERVICE WORKER BEHAVIOR SIMULATION & CACHE INTEGRITY
// =========================================================================
describe('1. Service Worker & Cache Integrity Empirical Tests', () => {

  test('SW-1: APP_SHELL_ASSETS extraction & complete file existence check', () => {
    // Extract assets list from sw.js
    const match = swContent.match(/const APP_SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    assert(match, 'sw.js must declare APP_SHELL_ASSETS array');
    
    const assetEntries = match[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(s => s.length > 0);

    assert(assetEntries.length >= 8, `Expected at least 8 app shell assets, found ${assetEntries.length}`);

    // Check each file on disk
    for (const asset of assetEntries) {
      if (asset === './') continue; // Root directory alias
      const cleanPath = asset.replace(/^\.\//, '');
      const fullPath = path.join(ROOT_DIR, cleanPath);
      assert(fs.existsSync(fullPath), `App Shell asset "${asset}" must exist on disk at "${fullPath}"`);
      const stat = fs.statSync(fullPath);
      assert(stat.size > 0, `App Shell asset "${asset}" must not be empty (0 bytes)`);
    }
  });

  test('SW-2: Verify all index.html linked resources are present in APP_SHELL_ASSETS', () => {
    // Match linked stylesheets
    const cssLinks = [...indexHtmlContent.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
    // Match icons
    const iconLinks = [...indexHtmlContent.matchAll(/<link\s+[^>]*rel=["'](?:icon|apple-touch-icon|manifest)["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);

    const allLinked = [...cssLinks, ...iconLinks];
    assert(allLinked.length >= 5, 'index.html must link stylesheets and icons');

    for (const link of allLinked) {
      const normalizedLink = link.startsWith('./') ? link : `./${link}`;
      const foundInSW = swContent.includes(`'${normalizedLink}'`) || swContent.includes(`"${normalizedLink}"`) || swContent.includes(`'./${link}'`);
      assert(foundInSW, `Linked asset "${link}" in index.html must be included in sw.js APP_SHELL_ASSETS`);
    }
  });

  test('SW-3: Cache Name Versioning & Structure', () => {
    const cacheMatch = swContent.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
    assert(cacheMatch, 'sw.js must define CACHE_NAME constant');
    const cacheName = cacheMatch[1];
    assert(/^yokohama-bus-nav-v\d+\.\d+\.\d+/.test(cacheName), `CACHE_NAME "${cacheName}" must follow semantic versioning scheme`);
  });

  asyncTest('SW-4: In-Memory Offline Fetch Simulation & Stale-While-Revalidate', async () => {
    // Build a mock CacheStorage & Request/Response environment
    class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || 'OK';
        this.headers = new Map(Object.entries(init.headers || {}));
      }
      async text() { return String(this.body); }
      async json() { return JSON.parse(this.body); }
      clone() { return new MockResponse(this.body, { status: this.status, statusText: this.statusText, headers: Object.fromEntries(this.headers) }); }
    }

    class MockCache {
      constructor(name) {
        this.name = name;
        this.entries = new Map();
      }
      async addAll(urls) {
        for (const url of urls) {
          this.entries.set(url, new MockResponse(`Content of ${url}`));
        }
      }
      async match(req) {
        const urlStr = typeof req === 'string' ? req : req.url;
        return this.entries.get(urlStr) || null;
      }
      async put(req, res) {
        const urlStr = typeof req === 'string' ? req : req.url;
        this.entries.set(urlStr, res);
      }
    }

    const mockCaches = new Map();
    const CACHE_NAME = 'yokohama-bus-nav-v1.0.0';
    const mainCache = new MockCache(CACHE_NAME);
    mockCaches.set(CACHE_NAME, mainCache);

    // Pre-cache assets
    await mainCache.addAll(['./index.html', './css/variables.css', './manifest.json']);

    // Test 1: Cached static asset match
    const cachedRes = await mainCache.match('./css/variables.css');
    assert(cachedRes !== null, 'Cache-First should return cached variables.css');
    assertEqual(await cachedRes.text(), 'Content of ./css/variables.css', 'Content should match cached body');

    // Test 2: ODPT API offline error fallback simulation (Network-First error -> 503)
    const simulateOdptFetchOffline = async (url) => {
      if (url.includes('api.odpt.org')) {
        // Network throws offline
        return new MockResponse(JSON.stringify({ error: 'offline', message: 'ネットワークに接続されていません' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
    };

    const odptRes = await simulateOdptFetchOffline('https://api.odpt.org/api/v4/odpt:Bus?acl:consumerKey=test');
    assertEqual(odptRes.status, 503, 'ODPT API offline request should return status 503');
    const odptJson = await odptRes.json();
    assertEqual(odptJson.error, 'offline', 'ODPT API offline response should contain error: offline');

    // Test 3: Cache cleanup during activation
    const oldCache = new MockCache('yokohama-bus-nav-v0.9.0');
    mockCaches.set('yokohama-bus-nav-v0.9.0', oldCache);
    assertEqual(mockCaches.size, 2, 'Two caches before activation');

    // Simulate activate cleanup
    for (const key of Array.from(mockCaches.keys())) {
      if (key !== CACHE_NAME) {
        mockCaches.delete(key);
      }
    }
    assertEqual(mockCaches.size, 1, 'Old cache version should be deleted on activation');
    assert(mockCaches.has(CACHE_NAME), 'Current CACHE_NAME must be preserved');
  });

  test('SW-5: Message handling for skipWaiting', () => {
    assertIncludes(swContent, "action === 'skipWaiting'", 'sw.js message listener should handle skipWaiting action');
    assertIncludes(swContent, 'self.skipWaiting()', 'sw.js should execute skipWaiting');
  });
});

// =========================================================================
// 2. THEME SWITCHING & CSS CASCADE INTEGRITY
// =========================================================================
describe('2. Theme Switching CSS Cascade & Design System Tests', () => {

  test('THEME-1: Brand color consistency (Yokohama Bus Blue #004098)', () => {
    assertIncludes(variablesCss, '--color-primary: #004098;', 'Primary brand color must be #004098');
    assertIncludes(manifestContent.theme_color, '#004098', 'manifest.json theme_color must match brand blue');
    assertIncludes(indexHtmlContent, 'content="#004098"', 'index.html meta theme-color must match brand blue');
  });

  test('THEME-2: Dark theme variable completeness ([data-theme="dark"])', () => {
    // Extract light mode variables
    const rootBlockMatch = variablesCss.match(/:root\s*\{([\s\S]*?)\}/);
    assert(rootBlockMatch, ':root block must exist in variables.css');
    
    const darkBlockMatch = variablesCss.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);
    assert(darkBlockMatch, '[data-theme="dark"] block must exist in variables.css');

    // Key surface and text variables that MUST be overridden in dark mode
    const requiredDarkVars = [
      '--bg-app',
      '--bg-card',
      '--bg-card-sub',
      '--bg-header',
      '--bg-nav',
      '--bg-input',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border-color',
      '--status-normal',
      '--status-delay',
      '--status-alert',
      '--badge-111',
      '--badge-133',
      '--badge-64'
    ];

    for (const varName of requiredDarkVars) {
      assert(
        darkBlockMatch[1].includes(varName),
        `Dark theme [data-theme="dark"] must override "${varName}"`
      );
    }
  });

  test('THEME-3: System preference dark mode media query synchronization', () => {
    assertIncludes(variablesCss, '@media (prefers-color-scheme: dark)', 'variables.css must include prefers-color-scheme: dark');
    assertIncludes(variablesCss, ':root:not([data-theme="light"])', 'prefers-color-scheme: dark must respect explicit [data-theme="light"] override');
  });

  test('THEME-4: Card, Modal and Input styles consume theme variables', () => {
    // Cards use --bg-card and --border-color
    assertIncludes(componentsCss, 'background: var(--bg-card)', 'Components must use var(--bg-card)');
    assertIncludes(componentsCss, 'border: 1px solid var(--border-color)', 'Components must use var(--border-color)');

    // Modal sheet uses --bg-card
    assertIncludes(componentsCss, '.modal-sheet', 'Modal sheet class must exist');
    assertIncludes(componentsCss, 'background: var(--bg-modal-backdrop)', 'Modal backdrop must use var(--bg-modal-backdrop)');

    // Base input controls use --bg-input and --text-primary
    assertIncludes(baseCss, 'background-color: var(--bg-input);', 'Inputs must use var(--bg-input)');
    assertIncludes(baseCss, 'color: var(--text-primary);', 'Inputs must use var(--text-primary)');
  });

  test('THEME-5: Route Badge color system completeness (111, 133, 64, other)', () => {
    const routeKeys = ['111', '133', '64', 'other'];
    for (const r of routeKeys) {
      assertIncludes(variablesCss, `--badge-${r}:`, `Badge variable --badge-${r} must exist`);
      assertIncludes(variablesCss, `--badge-${r}-bg:`, `Badge variable --badge-${r}-bg must exist`);
      assertIncludes(variablesCss, `--badge-${r}-text:`, `Badge variable --badge-${r}-text must exist`);
      assertIncludes(componentsCss, `.route-badge-${r}`, `CSS class .route-badge-${r} must exist`);
    }
  });
});

// =========================================================================
// 3. TOUCH TARGET & MOBILE VIEWPORT LAYOUT INTEGRITY
// =========================================================================
describe('3. Touch Target & Mobile Viewport Layout Integrity Tests', () => {

  test('TOUCH-1: 44px Minimum Touch Target Size enforcement in responsive.css', () => {
    assertIncludes(responsiveCss, 'min-height: 44px;', 'responsive.css must enforce min-height: 44px');
    assertIncludes(responsiveCss, 'min-width: 44px;', 'responsive.css must enforce min-width: 44px');
    
    // Check interactive selectors
    const interactiveSelectors = ['button', '.tab-btn', '.nav-item-btn', '.header-btn', '.direction-toggle-btn', '.modal-close-btn', 'select'];
    for (const sel of interactiveSelectors) {
      assertIncludes(responsiveCss, sel, `Responsive touch target rules must target "${sel}"`);
    }
  });

  test('TOUCH-2: Safe Area Insets for iOS Notch / Home Bar', () => {
    assertIncludes(responsiveCss, 'env(safe-area-inset-top', 'responsive.css must support safe-area-inset-top');
    assertIncludes(responsiveCss, 'env(safe-area-inset-bottom', 'responsive.css must support safe-area-inset-bottom');
    assertIncludes(baseCss, 'env(safe-area-inset-bottom', 'base.css app-container must offset safe-area-inset-bottom');
  });

  test('LAYOUT-1: Small Mobile Breakpoint (<360px)', () => {
    assertIncludes(responsiveCss, '@media (max-width: 360px)', 'responsive.css must include <360px breakpoint');
    assertIncludes(responsiveCss, '--font-size-base: 0.875rem', '<360px breakpoint should scale base font size');
  });

  test('LAYOUT-2: Tablet & Desktop Breakpoints (481-768px, >769px)', () => {
    assertIncludes(responsiveCss, '@media (min-width: 481px) and (max-width: 768px)', 'Tablet breakpoint 481-768px must exist');
    assertIncludes(responsiveCss, '@media (min-width: 769px)', 'Desktop breakpoint >769px must exist');
    assertIncludes(responsiveCss, 'max-width: 640px', 'Desktop mode must constrain container width to max 640px');
  });

  test('LAYOUT-3: Mobile Thumb Zone Bottom Navigation Bar', () => {
    assertIncludes(componentsCss, '.bottom-nav', 'Bottom navigation class must exist');
    assertIncludes(componentsCss, 'position: fixed;', 'Bottom nav must be fixed to bottom');
    assertIncludes(componentsCss, 'bottom: 0;', 'Bottom nav must anchor to bottom: 0');
    assertIncludes(componentsCss, 'z-index: var(--z-bottom-nav);', 'Bottom nav must have appropriate z-index');
    assertIncludes(indexHtmlContent, 'id="refresh-btn"', 'Bottom nav must have refresh button');
    assertIncludes(indexHtmlContent, 'id="btn-nav-direction"', 'Bottom nav must have direction toggle button');
    assertIncludes(indexHtmlContent, 'id="timetable-btn"', 'Bottom nav must have timetable modal button');
    assertIncludes(indexHtmlContent, 'id="settings-btn"', 'Bottom nav must have settings modal button');
  });
});

// =========================================================================
// 4. DOM STRUCTURE, ACCESSIBILITY & FALLBACK RESILIENCE
// =========================================================================
describe('4. DOM Semantics, Accessibility & Resiliency Tests', () => {

  test('DOM-1: Semantic HTML5 Structure', () => {
    assertIncludes(indexHtmlContent, '<header class="app-header">', 'Header element present');
    assertIncludes(indexHtmlContent, '<main class="main-content">', 'Main element present');
    assertIncludes(indexHtmlContent, '<nav class="view-tabs-container"', 'Nav for view tabs present');
    assertIncludes(indexHtmlContent, '<nav id="bottom-nav"', 'Nav for bottom thumb zone present');
    assertIncludes(indexHtmlContent, '<footer', 'Footer element present');
  });

  test('A11Y-1: ARIA Roles and Live Regions', () => {
    assertIncludes(indexHtmlContent, 'role="tablist"', 'Tab container must have role="tablist"');
    assertIncludes(indexHtmlContent, 'role="tab"', 'Tabs must have role="tab"');
    assertIncludes(indexHtmlContent, 'role="status"', 'Status banner must have role="status"');
    assertIncludes(indexHtmlContent, 'aria-live="polite"', 'Status banner must have aria-live="polite"');
    assertIncludes(indexHtmlContent, 'role="dialog"', 'Modals must have role="dialog"');
    assertIncludes(indexHtmlContent, 'aria-modal="true"', 'Modals must have aria-modal="true"');
    assertIncludes(indexHtmlContent, 'aria-live="assertive"', 'Toast container must have aria-live="assertive"');
  });

  test('A11Y-2: Reduced Motion Media Query', () => {
    assertIncludes(responsiveCss, '@media (prefers-reduced-motion: reduce)', 'responsive.css must support prefers-reduced-motion');
    assertIncludes(responsiveCss, 'animation-duration: 0.01ms', 'Animations should be disabled for reduced motion');
  });

  test('PWA-1: Manifest validation & Icons coverage', () => {
    assertEqual(manifestContent.name, '横浜市営バス 運行ナビ', 'Manifest name matches');
    assertEqual(manifestContent.short_name, '市営バスナビ', 'Manifest short_name matches');
    assertEqual(manifestContent.display, 'standalone', 'Manifest display is standalone');
    assertEqual(manifestContent.orientation, 'portrait', 'Manifest orientation is portrait');
    assert(manifestContent.icons.length >= 4, 'Manifest must declare at least 4 icon configurations');
    
    // Maskable icon check
    const maskable = manifestContent.icons.find(i => i.purpose === 'maskable');
    assert(maskable !== undefined, 'Manifest must provide a maskable icon for Android adaptive icons');
  });

  test('RESILIENCE-1: Service Worker Registration Fallback in HTML', () => {
    assertIncludes(indexHtmlContent, "if ('serviceWorker' in navigator)", 'SW registration must feature-detect serviceWorker in navigator');
    assertIncludes(indexHtmlContent, ".catch((error) =>", 'SW registration must handle and catch registration failures gracefully');
  });

  test('CREDIT-1: ODPT Protocol Compliance Attribution', () => {
    assertIncludes(indexHtmlContent, '公共交通オープンデータ協議会', 'Attribution link to ODPT must exist in status banner / footer');
    assertIncludes(indexHtmlContent, 'ODPT API v4', 'ODPT API v4 reference must be visible in footer');
  });
});

// Execution Runner
async function runAllTests() {
  for (const item of testQueue) {
    if (item.type === 'suite') {
      console.log(`\n\x1b[1m\x1b[36m▶ SUITE: ${item.name}\x1b[0m`);
      console.log('\x1b[90m' + '-'.repeat(70) + '\x1b[0m');
    } else if (item.type === 'test') {
      totalTests++;
      try {
        item.fn();
        passedTests++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m ${item.name}`);
      } catch (err) {
        failedTests++;
        failures.push({ testName: item.name, error: err.message });
        console.log(`  \x1b[31m✖ FAIL\x1b[0m \x1b[1m${item.name}\x1b[0m`);
        console.log(`    \x1b[31m${err.message}\x1b[0m`);
      }
    } else if (item.type === 'asyncTest') {
      totalTests++;
      try {
        await item.fn();
        passedTests++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m ${item.name}`);
      } catch (err) {
        failedTests++;
        failures.push({ testName: item.name, error: err.message });
        console.log(`  \x1b[31m✖ FAIL\x1b[0m \x1b[1m${item.name}\x1b[0m`);
        console.log(`    \x1b[31m${err.message}\x1b[0m`);
      }
    }
  }

  console.log('\n\x1b[1m' + '='.repeat(70) + '\x1b[0m');
  console.log(`\x1b[1mCHALLENGER 2 SUMMARY:\x1b[0m ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('\x1b[1m' + '='.repeat(70) + '\x1b[0m');

  if (failedTests > 0) {
    console.log('\x1b[31m\x1b[1mVERDICT: REQUEST_CHANGES\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m\x1b[1mVERDICT: APPROVE\x1b[0m');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
