import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [ (num >> 16) & 255, (num >> 8) & 255, num & 255 ];
}

function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrast(rgb1, rgb2) {
  const lum1 = luminance(...rgb1);
  const lum2 = luminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function blend(fgRgba, bgRgb) {
  const [r, g, b, a] = fgRgba;
  return [
    Math.round(r * a + bgRgb[0] * (1 - a)),
    Math.round(g * a + bgRgb[1] * (1 - a)),
    Math.round(b * a + bgRgb[2] * (1 - a))
  ];
}

console.log('=== WCAG 2.1 Contrast Ratio Verification ===\n');

const contrastTests = [
  { name: 'Light Primary Text (#1E293B) on Card (#FFFFFF)', fg: '#1E293B', bg: '#FFFFFF' },
  { name: 'Light Primary Text (#1E293B) on App BG (#F4F6F9)', fg: '#1E293B', bg: '#F4F6F9' },
  { name: 'Light Secondary Text (#64748B) on Card (#FFFFFF)', fg: '#64748B', bg: '#FFFFFF' },
  { name: 'Light Secondary Text (#64748B) on Subcard (#F8FAFC)', fg: '#64748B', bg: '#F8FAFC' },
  { name: 'Light Header Brand (#FFFFFF) on Header BG (#004098)', fg: '#FFFFFF', bg: '#004098' },
  { name: 'Light Normal Status Text (#14532D) on Normal BG (#E8F5E9)', fg: '#14532D', bg: '#E8F5E9' },
  { name: 'Light Delay Status Text (#92400E) on Delay BG (#FEF3C7)', fg: '#92400E', bg: '#FEF3C7' },
  { name: 'Light Alert Status Text (#991B1B) on Alert BG (#FEE2E2)', fg: '#991B1B', bg: '#FEE2E2' },
  { name: 'Light Route 111 Badge Text (#004098) on Badge BG (#E8F0FE)', fg: '#004098', bg: '#E8F0FE' },
  { name: 'Light Route 133 Badge Text (#0F766E) on Badge BG (#CCFBF1)', fg: '#0F766E', bg: '#CCFBF1' },
  { name: 'Light Route 64 Badge Text (#6D28D9) on Badge BG (#EDE9FE)', fg: '#6D28D9', bg: '#EDE9FE' },

  { name: 'Dark Primary Text (#F8FAFC) on Dark Card (#1E293B)', fg: '#F8FAFC', bg: '#1E293B' },
  { name: 'Dark Primary Text (#F8FAFC) on Dark App BG (#0F172A)', fg: '#F8FAFC', bg: '#0F172A' },
  { name: 'Dark Secondary Text (#94A3B8) on Dark Card (#1E293B)', fg: '#94A3B8', bg: '#1E293B' },
  { name: 'Dark Secondary Text (#94A3B8) on Dark App BG (#0F172A)', fg: '#94A3B8', bg: '#0F172A' },
  { name: 'Dark Header Text (#F8FAFC) on Header BG (#0F172A)', fg: '#F8FAFC', bg: '#0F172A' },
  { name: 'Dark Normal Status (#6EE7B7) on Blended BG', fg: '#6EE7B7', bg: blend([16, 185, 129, 0.15], hexToRgb('#1E293B')) },
  { name: 'Dark Delay Status (#FCD34D) on Blended BG', fg: '#FCD34D', bg: blend([245, 158, 11, 0.15], hexToRgb('#1E293B')) },
  { name: 'Dark Alert Status (#FCA5A5) on Blended BG', fg: '#FCA5A5', bg: blend([239, 68, 68, 0.15], hexToRgb('#1E293B')) },
  { name: 'Dark Route 111 Badge (#93C5FD) on Blended BG', fg: '#93C5FD', bg: blend([59, 130, 246, 0.2], hexToRgb('#1E293B')) },
  { name: 'Dark Route 133 Badge (#5EEAD4) on Blended BG', fg: '#5EEAD4', bg: blend([13, 148, 136, 0.2], hexToRgb('#1E293B')) },
  { name: 'Dark Route 64 Badge (#C4B5FD) on Blended BG', fg: '#C4B5FD', bg: blend([124, 58, 237, 0.2], hexToRgb('#1E293B')) },
];

let wcagFails = 0;
for (const t of contrastTests) {
  const fgRgb = typeof t.fg === 'string' ? hexToRgb(t.fg) : t.fg;
  const bgRgb = typeof t.bg === 'string' ? hexToRgb(t.bg) : t.bg;
  const ratio = contrast(fgRgb, bgRgb);
  const passAA = ratio >= 4.5;
  const passAALarge = ratio >= 3.0;
  const passAAA = ratio >= 7.0;
  
  let grade = passAAA ? 'AAA' : (passAA ? 'AA' : (passAALarge ? 'AA-Large' : 'FAIL'));
  console.log(`  [${grade}] ${t.name} => ${ratio.toFixed(2)}:1`);
  if (!passAALarge) {
    wcagFails++;
  }
}

console.log(`\nWCAG Result: ${contrastTests.length - wcagFails}/${contrastTests.length} Passed (Fails: ${wcagFails})\n`);

// Integrity Check: Search for cheating patterns across source code
console.log('=== Integrity & Facade Implementation Audit ===\n');

const jsFiles = [
  'js/config.js',
  'js/state.js',
  'js/app.js',
  'js/api/odpt-client.js',
  'js/api/mock-data.js',
  'js/services/bus-location-service.js',
  'js/services/calendar-service.js',
  'js/services/timetable-service.js',
  'js/services/transfer-service.js',
  'js/services/storage-service.js',
  'js/services/polling-service.js',
  'js/ui/step-timeline.js',
  'js/ui/render-status.js',
  'sw.js'
];

let integrityViolations = [];

for (const relPath of jsFiles) {
  const absPath = path.join(rootDir, relPath);
  if (!fs.existsSync(absPath)) {
    integrityViolations.push(`Missing source file: ${relPath}`);
    continue;
  }
  const content = fs.readFileSync(absPath, 'utf8');

  // Check 1: Hardcoded test case names or test markers in implementation
  if (content.includes('T1.') || content.includes('T2.') || content.includes('T3.') || content.includes('T4.') || content.includes('tier1-') || content.includes('tier2-')) {
    integrityViolations.push(`Suspicious test marker in source code: ${relPath}`);
  }

  // Check 2: Dummy empty methods returning hardcoded strings without logic
  if (/function\s+\w+\([^)]*\)\s*\{\s*return\s+true;\s*\}/.test(content) && !relPath.includes('mock-data')) {
    integrityViolations.push(`Possible facade boolean stub in ${relPath}`);
  }

  // Check 3: Check that transfer service actually calculates arrival/wait times dynamically
  if (relPath.includes('transfer-service.js')) {
    if (!content.includes('calculateTransferRoute') || !content.includes('actualDep1') || !content.includes('minConnectingTime')) {
      integrityViolations.push(`Transfer service missing dynamic connection logic in ${relPath}`);
    }
  }

  // Check 4: Check that calendar service calculates astronomical and substitute holidays dynamically
  if (relPath.includes('calendar-service.js')) {
    if (!content.includes('isJapaneseHoliday') || !content.includes('vernalDay') || !content.includes('autumnalDay')) {
      integrityViolations.push(`Calendar service missing dynamic holiday computation in ${relPath}`);
    }
  }

  // Check 5: Check that polling service uses Page Visibility API
  if (relPath.includes('polling-service.js')) {
    if (!content.includes('visibilitychange') || !content.includes('visibilityState')) {
      integrityViolations.push(`Polling service missing Page Visibility handling in ${relPath}`);
    }
  }
}

console.log(`Integrity Violations Found: ${integrityViolations.length}`);
if (integrityViolations.length > 0) {
  console.error('Integrity Violations:', integrityViolations);
  process.exit(1);
} else {
  console.log('✔ All integrity and facade checks passed completely!\n');
}

if (wcagFails > 0) {
  process.exit(1);
}
