import { createBrowserEnv } from './test-harness.js';
import assert from 'assert';

async function testAdversarialScenarios() {
  console.log('=== Adversarial & Accessibility Stress Check ===');
  const env = createBrowserEnv();
  const fs = await import('fs');
  const htmlContent = fs.readFileSync('./index.html', 'utf8');
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    env.document.body.innerHTML = bodyMatch[1];
  }
  globalThis.document = env.document;
  globalThis.window = env.window;
  globalThis.localStorage = env.localStorage;

  const { App } = await import('../js/app.js');
  const app = new App();
  await app.init();
  globalThis.window.app = app;
  
  // Test 1: Rapid button spamming on geolocation
  console.log('[Stress 1] Rapid geolocation trigger...');
  const p1 = app.handleManualGeolocation('transfer');
  const p2 = app.handleManualGeolocation('transfer');
  await Promise.all([p1, p2]);
  console.log('  ✔ PASS: Rapid geolocation handled cleanly');

  // Test 2: Rapid tab switching without API key
  console.log('[Stress 2] Rapid tab switching without API key...');
  env.localStorage.removeItem('transporter_api_key');
  app.switchTab('view-transfer');
  await app.renderAll();
  assert(env.document.getElementById('transfer-result-container')?.innerHTML.includes('APIキーを設定してください'));

  app.switchTab('view-stops');
  await app.renderAll();
  assert(env.document.getElementById('stops-content-container')?.innerHTML.includes('APIキーを設定してください'));

  app.switchTab('view-map');
  app.renderRouteMapView();
  assert(env.document.getElementById('route-map-content-container')?.innerHTML.includes('APIキーを設定してください'));
  console.log('  ✔ PASS: Tab switching with no API key renders consistent warning cards without crashing');

  // Test 3: Koizumi pole toggling preserves consistency
  console.log('[Stress 3] Koizumi pole switching and timetable reactivity...');
  app.activeStopKey = 'koizumi';
  app.activePoles['koizumi'] = '1';
  await app.renderStopsView();
  assert(env.document.getElementById('stops-content-container')?.innerHTML.includes('上大岡方面'));

  app.activePoles['koizumi'] = '2';
  await app.renderStopsView();
  assert(env.document.getElementById('stops-content-container')?.innerHTML.includes('根岸方面'));
  console.log('  ✔ PASS: Koizumi pole switching toggles poles and stops view smoothly');

  console.log('\nAll Adversarial stress scenarios PASSED successfully!');
  process.exit(0);
}

testAdversarialScenarios().catch(err => {
  console.error('\n❌ Stress test failed:', err);
  process.exit(1);
});
