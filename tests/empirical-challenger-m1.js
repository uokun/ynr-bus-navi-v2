/**
 * empirical-challenger-m1.js
 * Comprehensive Empirical Adversarial Stress Test Suite for Milestone 1
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
const testResults = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
    testResults.push({ name, status: 'PASS' });
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Reason: ${err.message}`);
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

console.log('================================================================');
console.log('  MILESTONE 1 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('================================================================\n');

const htmlPath = path.join(ROOT_DIR, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// -----------------------------------------------------------------
// 1. Critical DOM IDs Verification (USER_REQUEST requirements)
// -----------------------------------------------------------------
console.log('--- Suite 1: Critical DOM IDs Presence (USER_REQUEST) ---');

const promptRequiredIds = [
  { id: 'direction-toggle-btn', role: 'Direction flip trigger' },
  { id: 'origin-name', role: 'Origin stop name display' },
  { id: 'dest-name', role: 'Destination stop name display' },
  { id: 'main-transfer-card', role: 'Main recommended transit guide card' },
  { id: 'alt-connections-list', role: 'Alternative transit options container' },
  { id: 'view-tabs', role: 'Stop and transit view tabs bar' },
  { id: 'stop-views-container', role: 'Single stop departures container' },
  { id: 'filter-bar', role: 'Route and buffer filter container' },
  { id: 'filter-all', role: 'All routes filter button' },
  { id: 'filter-111', role: 'Route 111 filter button' },
  { id: 'filter-133', role: 'Route 133 filter button' },
  { id: 'filter-64', role: 'Route 64 filter button' },
  { id: 'refresh-btn', role: 'Manual refresh button' },
  { id: 'settings-btn', role: 'Settings modal trigger button' },
  { id: 'timetable-btn', role: 'Full timetable modal trigger button' },
  { id: 'settings-modal', role: 'Settings dialog modal' },
  { id: 'api-key-input', role: 'Consumer key text input' },
  { id: 'buffer-input', role: 'Transfer buffer range slider' },
  { id: 'save-settings-btn', role: 'Settings save button' },
  { id: 'timetable-modal', role: 'Full timetable dialog modal' },
  { id: 'status-banner', role: 'Operation alert / status banner' },
  { id: 'toast-container', role: 'Toast notification container' }
];

promptRequiredIds.forEach(({ id, role }) => {
  test(`Prompt DOM ID check: #${id} (${role})`, () => {
    const hasId = new RegExp(`id=["']${id}["']`).test(htmlContent);
    assert(hasId, `index.html is missing required ID: id="${id}"`);
  });
});

// -----------------------------------------------------------------
// 2. HTML Tag Balance, Duplicates & Accessibility Semantics
// -----------------------------------------------------------------
console.log('\n--- Suite 2: HTML Structural & Semantic Integrity ---');

test('No duplicate DOM IDs exist in index.html', () => {
  const idMatches = [...htmlContent.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
  const counts = {};
  const duplicates = [];
  for (const id of idMatches) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] === 2) duplicates.push(id);
  }
  assert(duplicates.length === 0, `Duplicate DOM IDs found: ${duplicates.join(', ')}`);
});

test('Semantic HTML5 landmark elements are all properly closed and balanced', () => {
  const tags = ['header', 'main', 'section', 'nav', 'footer', 'div', 'button', 'select', 'table', 'tbody'];
  for (const tag of tags) {
    const openCount = (htmlContent.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
    const closeCount = (htmlContent.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    assert(openCount === closeCount, `Tag <${tag}> mismatch: opened ${openCount} times, closed ${closeCount} times`);
  }
});

test('Accessibility: Interactive modals have role="dialog" and aria-modal="true"', () => {
  assert(htmlContent.includes('role="dialog"'), 'Must have role="dialog"');
  assert(htmlContent.includes('aria-modal="true"'), 'Must have aria-modal="true"');
});

test('Accessibility: Status banner has role="status" and aria-live="polite"', () => {
  assert(htmlContent.includes('role="status"'), 'Status banner missing role="status"');
  assert(htmlContent.includes('aria-live="polite"'), 'Status banner missing aria-live="polite"');
});

test('Accessibility: Tab navigation has role="tablist" and role="tab"', () => {
  assert(htmlContent.includes('role="tablist"'), 'Tab navigation missing role="tablist"');
  assert(htmlContent.includes('role="tab"'), 'Tab buttons missing role="tab"');
});

// -----------------------------------------------------------------
// 3. Asset Paths & Links Verification
// -----------------------------------------------------------------
console.log('\n--- Suite 3: Asset Existence & Path Integrity ---');

test('All stylesheet link paths in index.html exist on disk', () => {
  const cssMatches = [...htmlContent.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)];
  assert(cssMatches.length > 0, 'No stylesheets found in index.html');
  for (const match of cssMatches) {
    const relPath = match[1];
    const fullPath = path.join(ROOT_DIR, relPath);
    assert(fs.existsSync(fullPath), `Linked stylesheet not found on disk: ${relPath}`);
  }
});

test('All icon and manifest links in index.html exist on disk', () => {
  const manifestMatch = htmlContent.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/);
  assert(manifestMatch, 'manifest link missing in index.html');
  assert(fs.existsSync(path.join(ROOT_DIR, manifestMatch[1])), `manifest.json missing: ${manifestMatch[1]}`);

  const iconMatches = [...htmlContent.matchAll(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/g)];
  for (const match of iconMatches) {
    const relPath = match[1];
    const fullPath = path.join(ROOT_DIR, relPath);
    assert(fs.existsSync(fullPath), `Linked icon not found on disk: ${relPath}`);
  }
});

// -----------------------------------------------------------------
// 4. Manifest.json Validation
// -----------------------------------------------------------------
console.log('\n--- Suite 4: Web App Manifest Integrity ---');
const manifestPath = path.join(ROOT_DIR, 'manifest.json');

test('manifest.json is valid JSON and contains required PWA fields', () => {
  assert(fs.existsSync(manifestPath), 'manifest.json does not exist');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'name is invalid');
  assert(typeof manifest.short_name === 'string' && manifest.short_name.length > 0, 'short_name is invalid');
  assert(typeof manifest.start_url === 'string', 'start_url is invalid');
  assert(manifest.display === 'standalone', 'display must be standalone');
  assert(manifest.theme_color === '#004098', 'theme_color must be #004098');
  assert(manifest.background_color === '#F4F6F9', 'background_color must be #F4F6F9');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'icons array is missing or < 2');

  manifest.icons.forEach((icon) => {
    const iconPath = path.join(ROOT_DIR, icon.src.replace(/^\.\//, ''));
    assert(fs.existsSync(iconPath), `Manifest icon file missing on disk: ${icon.src}`);
  });
});

// -----------------------------------------------------------------
// 5. Service Worker (sw.js) Integrity
// -----------------------------------------------------------------
console.log('\n--- Suite 5: Service Worker & Offline Cache Strategy ---');
const swPath = path.join(ROOT_DIR, 'sw.js');

test('sw.js exists, defines cache assets and event listeners', () => {
  assert(fs.existsSync(swPath), 'sw.js does not exist');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes('CACHE_NAME'), 'CACHE_NAME not defined in sw.js');
  assert(swContent.includes("addEventListener('install'"), 'install listener missing');
  assert(swContent.includes("addEventListener('activate'"), 'activate listener missing');
  assert(swContent.includes("addEventListener('fetch'"), 'fetch listener missing');

  const match = swContent.match(/APP_SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert(match, 'APP_SHELL_ASSETS array missing in sw.js');
  const assetUrls = match[1]
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(s => s.length > 0 && s !== './');

  assetUrls.forEach((assetRel) => {
    const assetPath = path.join(ROOT_DIR, assetRel.replace(/^\.\//, ''));
    assert(fs.existsSync(assetPath), `Service worker cached asset missing on disk: ${assetRel}`);
  });
});

test('sw.js handles ODPT API 503 fallback when network is offline', () => {
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes('api.odpt.org'), 'sw.js must route api.odpt.org requests');
  assert(swContent.includes('503') || swContent.includes('offline'), 'sw.js must provide offline fallback response for API errors');
});

// -----------------------------------------------------------------
// 6. CSS Variable Definition & Usage Integrity
// -----------------------------------------------------------------
console.log('\n--- Suite 6: CSS Variable Definition Integrity ---');

const cssDir = path.join(ROOT_DIR, 'css');
const varContent = fs.readFileSync(path.join(cssDir, 'variables.css'), 'utf8');

const definedVars = new Set();
for (const match of varContent.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
  definedVars.add(`--${match[1]}`);
}

const cssFilesToCheck = ['base.css', 'components.css', 'responsive.css'];
cssFilesToCheck.forEach((fileName) => {
  test(`Check all var(--...) in ${fileName} are defined in variables.css or locally`, () => {
    const content = fs.readFileSync(path.join(cssDir, fileName), 'utf8');
    const localVars = new Set(definedVars);
    for (const match of content.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
      localVars.add(`--${match[1]}`);
    }

    const undefinedVars = new Set();
    for (const match of content.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)/g)) {
      const varName = match[1];
      const fallback = match[2];
      if (!localVars.has(varName) && !fallback) {
        undefinedVars.add(varName);
      }
    }

    assert(undefinedVars.size === 0, `Undefined CSS variables in ${fileName}: ${[...undefinedVars].join(', ')}`);
  });
});

// -----------------------------------------------------------------
// 7. Responsive Breakpoint & Layout Stress Testing
// -----------------------------------------------------------------
console.log('\n--- Suite 7: Responsive Layout & Mobile-First Constraints ---');

const respContent = fs.readFileSync(path.join(cssDir, 'responsive.css'), 'utf8');
const baseContent = fs.readFileSync(path.join(cssDir, 'base.css'), 'utf8');

test('Responsive stylesheet handles <=360px viewport (320px support)', () => {
  assert(respContent.includes('360px'), 'responsive.css should have small screen breakpoint (<=360px)');
  assert(respContent.includes('--font-size-base') || respContent.includes('.header-title'), 'Small screen rules should adjust typography/spacing');
});

test('Responsive stylesheet handles tablet viewport (481px - 768px)', () => {
  assert(respContent.includes('481px') || respContent.includes('768px'), 'responsive.css should handle tablet breakpoint');
});

test('Responsive stylesheet handles desktop viewport (>768px / 1200px)', () => {
  assert(respContent.includes('769px') || respContent.includes('min-width: 768px'), 'responsive.css should handle desktop max-width container centering');
});

test('Safe Area Insets (env(safe-area-inset-*)) are handled for notched devices', () => {
  assert(respContent.includes('safe-area-inset-top') || respContent.includes('safe-area-inset-bottom'), 'Safe area insets must be configured');
});

test('Touch targets enforce minimum 44px for primary interactive elements', () => {
  assert(respContent.includes('44px'), 'Minimum touch target of 44px must be enforced in CSS');
});

test('Print media stylesheet is configured to hide navigation and modals', () => {
  assert(respContent.includes('@media print'), 'Print stylesheet missing');
  assert(respContent.includes('.bottom-nav') && respContent.includes('display: none'), 'Print style must hide bottom navigation');
});

test('Reduced motion media query is configured for accessibility', () => {
  assert(respContent.includes('prefers-reduced-motion'), 'Reduced motion accessibility query missing');
});

// -----------------------------------------------------------------
// Summary
// -----------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  console.log('\n[VERDICT]: REQUEST_CHANGES - One or more empirical stress tests failed.');
  process.exit(1);
} else {
  console.log('\n[VERDICT]: APPROVE - All empirical stress tests passed.');
  process.exit(0);
}
