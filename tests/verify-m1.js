import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Milestone 1: PWA Shell & UI Files Verification ===');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

// 1. Check manifest.json
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert(manifest.name === '横浜市営バス 運行ナビ', 'manifest.json name matches');
  assert(manifest.short_name === '市営バスナビ', 'manifest.json short_name matches');
  assert(manifest.start_url === './index.html', 'manifest.json start_url is ./index.html');
  assert(manifest.display === 'standalone', 'manifest.json display is standalone');
  assert(manifest.theme_color === '#004098', 'manifest.json theme_color matches');
  assert(manifest.icons && manifest.icons.length >= 3, 'manifest.json has icons');
} catch (e) {
  assert(false, `manifest.json parsing error: ${e.message}`);
}

// 2. Check SVG icons
const iconFiles = [
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.svg',
  'assets/icons/icon-512.svg'
];

iconFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.includes('<svg') && content.includes('</svg>'), `${file} is valid SVG markup`);
  } catch (e) {
    assert(false, `${file} read error: ${e.message}`);
  }
});

// 3. Check CSS files
const cssFiles = [
  'css/variables.css',
  'css/base.css',
  'css/components.css',
  'css/responsive.css'
];

cssFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.length > 100, `${file} contains CSS definitions (${content.length} bytes)`);
    if (file === 'css/variables.css') {
      assert(content.includes('--color-primary: #004098'), 'variables.css has primary bus blue');
      assert(content.includes('[data-theme="dark"]'), 'variables.css has dark mode overrides');
    }
  } catch (e) {
    assert(false, `${file} read error: ${e.message}`);
  }
});

// 4. Check sw.js
try {
  const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  assert(sw.includes('CACHE_NAME'), 'sw.js defines CACHE_NAME');
  assert(sw.includes("addEventListener('install'"), 'sw.js has install listener');
  assert(sw.includes("addEventListener('activate'"), 'sw.js has activate listener');
  assert(sw.includes("addEventListener('fetch'"), 'sw.js has fetch listener');
} catch (e) {
  assert(false, `sw.js read error: ${e.message}`);
}

// 5. Check index.html required elements
try {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(html.includes('<!DOCTYPE html>'), 'index.html has DOCTYPE');
  assert(html.includes('<html lang="ja">'), 'index.html has lang=ja');

  const requiredIds = [
    'direction-toggle-btn',
    'status-banner',
    'view-tabs',
    'main-transfer-card',
    'alternative-options-card',
    'stop-views-container',
    'filter-bar',
    'bottom-nav',
    'settings-modal',
    'timetable-modal',
    'toast-container',
    'theme-toggle-btn',
    'refresh-btn',
    'api-key-input',
    'buffer-input',
    'setting-refresh-interval',
    'setting-theme-select',
    'btn-clear-cache',
    'save-settings-btn'
  ];

  requiredIds.forEach(id => {
    assert(html.includes(`id="${id}"`), `index.html includes id="${id}"`);
  });
} catch (e) {
  assert(false, `index.html read error: ${e.message}`);
}

console.log(`\nVerification Summary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All Milestone 1 checks passed successfully!');
}
