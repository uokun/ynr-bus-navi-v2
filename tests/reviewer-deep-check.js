import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('=== Reviewer Adversarial & Deep Verification Suite ===\n');

let pass = 0;
let fail = 0;
let warnings = [];

function check(title, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${title}`);
    pass++;
  } else {
    console.error(`[FAIL] ${title} - ${detail}`);
    fail++;
  }
}

function warn(title, message) {
  console.warn(`[WARN] ${title} - ${message}`);
  warnings.push({ title, message });
}

// 1. Check all App Shell assets listed in sw.js actually exist on disk
console.log('--- 1. Service Worker & Offline Asset Integrity ---');
const swContent = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
const assetMatches = swContent.match(/APP_SHELL_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (assetMatches) {
  const rawAssets = assetMatches[1]
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(s => s && s !== './');
  
  for (const asset of rawAssets) {
    const cleaned = asset.replace(/^\.\//, '');
    const fullPath = path.join(rootDir, cleaned);
    const exists = fs.existsSync(fullPath);
    check(`sw.js cached asset exists: ${asset}`, exists, `File not found at ${fullPath}`);
  }
} else {
  check('sw.js defines APP_SHELL_ASSETS', false, 'Could not parse APP_SHELL_ASSETS');
}

// 2. Check manifest.json icon files exist on disk and have valid sizes
console.log('\n--- 2. Manifest.json Spec & Asset Resolution ---');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
check('manifest.json has valid name', manifest.name && manifest.name.length > 0);
check('manifest.json has valid short_name', manifest.short_name && manifest.short_name.length > 0);
check('manifest.json scope is valid', manifest.scope === './' || manifest.scope === '/');
check('manifest.json theme_color is bus blue #004098', manifest.theme_color.toLowerCase() === '#004098');

for (const icon of manifest.icons) {
  const iconPath = path.join(rootDir, icon.src.replace(/^\.\//, ''));
  const exists = fs.existsSync(iconPath);
  check(`manifest icon file exists: ${icon.src}`, exists);
  if (exists) {
    const svg = fs.readFileSync(iconPath, 'utf8');
    check(`manifest icon ${icon.src} is non-empty SVG`, svg.includes('<svg') && svg.includes('</svg>'));
  }
}

// 3. Check HTML Elements & IDs for Milestones 2-5 compatibility
console.log('\n--- 3. DOM Elements & Contract Alignment ---');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const contractIds = [
  // Header
  'header-clock', 'live-time', 'theme-toggle-btn', 'header-settings-btn',
  // Direction
  'direction-badge', 'direction-route-display', 'origin-name', 'via-stop-name', 'dest-name', 'direction-toggle-btn',
  // Status Banner
  'status-banner', 'status-pill', 'status-pill-text', 'status-message', 'status-update-time',
  // Navigation Tabs
  'view-tabs', 'tab-transfer', 'tab-stop-yokodai', 'tab-stop-kamiooka', 'tab-stop-koizumi', 'tab-timetable-all',
  // Filters
  'filter-bar', 'route-filter-chips',
  // Main Transfer Card
  'main-transfer-card', 'main-card-total-time',
  'leg-1-container', 'leg-1-route-badge', 'leg-1-dest-label', 'leg-1-delay-badge', 'leg-1-countdown',
  'leg-1-dep-time', 'leg-1-arr-time', 'leg-1-dep-stop', 'leg-1-platform-sub', 'leg-1-arr-stop',
  'transfer-wait-indicator', 'transfer-wait-minutes',
  'leg-2-container', 'leg-2-route-badge', 'leg-2-dest-label', 'leg-2-delay-badge', 'leg-2-countdown',
  'leg-2-dep-time', 'leg-2-arr-time', 'leg-2-dep-stop', 'leg-2-platform-sub', 'leg-2-arr-stop',
  // Alternative Card
  'alternative-options-card', 'alt-options-count', 'alt-connections-list',
  // Stop Views
  'stop-views-container', 'stop-view-title-name', 'stop-view-pole-info', 'stop-view-count', 'stop-departure-list',
  // Bottom Action Bar
  'bottom-nav', 'refresh-btn', 'refresh-icon', 'refresh-timer-display', 'btn-nav-direction', 'timetable-btn', 'settings-btn',
  // Settings View & Controls
  'view-settings', 'input-api-key', 'btn-reset-api-key',
  'setting-refresh-interval', 'setting-theme-select', 'cache-size-display', 'btn-clear-cache',
  'btn-save-settings',
  // Timetable Modal
  'timetable-modal', 'timetable-modal-backdrop', 'timetable-modal-close', 'timetable-stop-select',
  'btn-cal-weekday', 'btn-cal-saturday', 'btn-cal-holiday', 'timetable-grid-container', 'timetable-tbody', 'btn-close-timetable',
  // Toast
  'toast-container'
];

for (const id of contractIds) {
  const hasId = html.includes(`id="${id}"`);
  check(`DOM ID present: #${id}`, hasId, `Missing id="${id}" in index.html`);
}

// 4. Check CSS variables and rules completeness
console.log('\n--- 4. CSS Design System & Responsive Rules ---');
const varsCss = fs.readFileSync(path.join(rootDir, 'css/variables.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(rootDir, 'css/base.css'), 'utf8');
const compCss = fs.readFileSync(path.join(rootDir, 'css/components.css'), 'utf8');
const respCss = fs.readFileSync(path.join(rootDir, 'css/responsive.css'), 'utf8');

check('variables.css defines --color-primary (#004098)', varsCss.includes('--color-primary: #004098'));
check('variables.css defines --color-accent (#FF9800)', varsCss.includes('--color-accent: #FF9800'));
check('variables.css defines --badge-111, --badge-133, --badge-64',
  varsCss.includes('--badge-111') && varsCss.includes('--badge-133') && varsCss.includes('--badge-64'));
check('variables.css supports data-theme="dark"', varsCss.includes('[data-theme="dark"]'));
check('variables.css supports prefers-color-scheme: dark', varsCss.includes('@media (prefers-color-scheme: dark)'));

check('base.css defines .app-container with max-width 640px', baseCss.includes('.app-container') && baseCss.includes('max-width: 640px'));
check('base.css defines focus-visible outline', baseCss.includes(':focus-visible'));

check('responsive.css defines 44px min touch target', respCss.includes('min-height: 44px'));
check('responsive.css handles env(safe-area-inset-bottom)', respCss.includes('env(safe-area-inset-bottom'));
check('responsive.css handles prefers-reduced-motion', respCss.includes('prefers-reduced-motion'));
check('responsive.css handles desktop centering (>769px)', respCss.includes('@media (min-width: 769px)'));

// 5. Check Accessibility & ARIA semantics
console.log('\n--- 5. Accessibility & ARIA Semantic Structure ---');
check('index.html has lang="ja"', html.includes('<html lang="ja">'));
check('index.html has viewport-fit=cover', html.includes('viewport-fit=cover'));
check('index.html has role="tablist" on view-tabs', html.includes('id="view-tabs" role="tablist"'));
check('index.html has role="tabpanel" on view-settings',
  html.includes('id="view-settings"') && html.includes('role="tabpanel"'));
check('index.html has role="dialog" and aria-modal="true" on timetable modal',
  html.includes('id="timetable-modal"') && html.includes('role="dialog"') && html.includes('aria-modal="true"'));
check('index.html has aria-live="polite" on status-banner', html.includes('aria-live="polite"'));
check('index.html has aria-live="assertive" on toast-container', html.includes('aria-live="assertive"'));

// 6. Check Service Worker Strategy details
console.log('\n--- 6. Service Worker Logic Validation ---');
check('sw.js has skipWaiting in install', swContent.includes('self.skipWaiting()'));
check('sw.js has clients.claim in activate', swContent.includes('self.clients.claim()'));
check('sw.js isolates api.odpt.org from stale cache', swContent.includes('api.odpt.org'));
check('sw.js provides 503 offline JSON response for ODPT', swContent.includes('status: 503'));
check('sw.js has message event listener for skipWaiting', swContent.includes("addEventListener('message'"));

console.log(`\n========================================`);
console.log(`Deep Review Summary: ${pass} passed, ${fail} failed, ${warnings.length} warnings.`);
if (fail > 0) {
  process.exit(1);
} else {
  console.log('All deep checks passed successfully!');
}
