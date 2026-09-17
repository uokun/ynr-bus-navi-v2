import { createBrowserEnv } from './test-harness.js';
import assert from 'assert';
import fs from 'fs';

async function runReviewerChecks() {
  console.log('=== Reviewer R2-2 Comprehensive Verification ===\n');

  // --- Check 0: Pure API & Integrity Verification ---
  console.log('[Check 0] Integrity & Pure API Verification...');
  const odptSrc = fs.readFileSync('./js/api/odpt-client.js', 'utf8');
  assert(!odptSrc.includes('REAL_TIMETABLES'), 'REAL_TIMETABLES must not be imported in odpt-client.js');
  assert(!odptSrc.includes('real-timetable-data.js'), 'real-timetable-data.js must not be referenced in odpt-client.js');
  const codeLines = odptSrc.split('\n').filter(line => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
  assert(!codeLines.some(l => l.includes("dest.includes('')") || l.includes("clean.includes('')")), "dest.includes('') bug must not be in executable code");
  console.log('  ✔ PASS: No REAL_TIMETABLES or dest.includes empty string in odpt-client.js code');

 const { odptClient } = await import('../js/api/odpt-client.js');
 const emptyRes = await odptClient.fetchBusstopPoleTimetables('7800.1', 'Weekday');
 assert(Array.isArray(emptyRes) && emptyRes.length === 0, 'Must return empty array on missing API key');
 console.log(' ✔ PASS: API client returns empty array when key is unconfigured');

 // Setup DOM environment
 const env = createBrowserEnv();
 globalThis.document = env.document;
 globalThis.window = env.window;
 globalThis.localStorage = env.localStorage;

 // Mock app object for button clicks
 let switchedTab = null;
 window.app = {
 switchTab: (tabId) => { switchedTab = tabId; }
 };

 const { renderMainTransfer } = await import('../js/ui/render-main.js');
 const { renderStopViews, STOP_PLATFORMS } = await import('../js/ui/render-stop-view.js');
 const { renderRouteMapView } = await import('../js/ui/render-route-map.js');
 const { stepTimelineComponent } = await import('../js/ui/step-timeline.js');
 const { busLocationService } = await import('../js/services/bus-location-service.js');
 const { transferService } = await import('../js/services/transfer-service.js');

 // --- Check 1: API key unconfigured warning on all 3 screens ---
 console.log('\n[Check 1] API key unconfigured warning on all 3 screens...');
 // Screen A: Transfer View
 const transferDiv = document.createElement('div');
 renderMainTransfer(transferDiv, { hasApiKey: false, recommended: null });
 assert(transferDiv.innerHTML.includes('APIキーを設定してください'), 'Transfer view must show API key required card');
 assert(transferDiv.innerHTML.includes('⚠️'), 'Transfer view must show warning icon');
 assert(transferDiv.innerHTML.includes('btn-goto-settings'), 'Transfer view must include settings button');
 assert(transferDiv.innerHTML.includes('view-settings'), 'Transfer view button must trigger view-settings');

 // Screen B: Stops View
 const stopsDiv = document.createElement('div');
 renderStopViews(stopsDiv, { hasApiKey: false, departures: [] });
 assert(stopsDiv.innerHTML.includes('APIキーを設定してください'), 'Stops view must show API key required card');
 assert(stopsDiv.innerHTML.includes('⚠️'), 'Stops view must show warning icon');
 assert(stopsDiv.innerHTML.includes('btn-goto-settings'), 'Stops view must include settings button');
 assert(stopsDiv.innerHTML.includes('view-settings'), 'Stops view button must trigger view-settings');

 // Screen C: Route Map View
 const mapDiv = document.createElement('div');
 renderRouteMapView(mapDiv, { hasApiKey: false, realtimeBuses: [] });
 assert(mapDiv.innerHTML.includes('APIキーを設定してください'), 'Route map view must show API key required card');
 assert(mapDiv.innerHTML.includes('⚠️'), 'Route map view must show warning icon');
 assert(mapDiv.innerHTML.includes('btn-goto-settings'), 'Route map view must include settings button');
 assert(mapDiv.innerHTML.includes('view-settings'), 'Route map view button must trigger view-settings');

 // Test button click handler invocation
 const btn = mapDiv.querySelector('.btn-goto-settings');
 assert(btn, 'Settings button element must exist in card');
 eval(btn.getAttribute('onclick'));
 assert.strictEqual(switchedTab, 'view-settings', 'Clicking settings button must switch to view-settings');
 console.log(' ✔ PASS: All 3 screens render unified API key required card and can switch to settings');

 // --- Check 2: Koizumi platform switching pills (Pole 1 vs Pole 2) ---
 console.log('\n[Check 2] Koizumi platform switching pills (Pole 1 vs Pole 2)...');
 const koizumiPlatforms = STOP_PLATFORMS.koizumi;
 assert(Array.isArray(koizumiPlatforms) && koizumiPlatforms.length === 2, 'Koizumi must have 2 platforms');
 assert.strictEqual(koizumiPlatforms[0].pole, '1');
 assert.strictEqual(koizumiPlatforms[0].label, '上大岡方面');
 assert.strictEqual(koizumiPlatforms[1].pole, '2');
 assert.strictEqual(koizumiPlatforms[1].label, '根岸方面');

 const koizumiDiv1 = document.createElement('div');
 renderStopViews(koizumiDiv1, {
 hasApiKey: true,
 activeStopKey: 'koizumi',
 activePole: '1',
 departures: [{ departureTime: '10:00', line: '133系統', destination: '上大岡駅前 行', delayMinutes: 0 }]
 });
 const pills1 = koizumiDiv1.querySelectorAll('.pole-pill-btn');
 assert(pills1.length === 2, 'Must render 2 platform pills for Koizumi');
 assert(pills1[0].classList.contains('active'), 'Pole 1 must be active initially');
 assert(!pills1[1].classList.contains('active'), 'Pole 2 must not be active');

 const koizumiDiv2 = document.createElement('div');
 renderStopViews(koizumiDiv2, {
 hasApiKey: true,
 activeStopKey: 'koizumi',
 activePole: '2',
 departures: [{ departureTime: '10:15', line: '133系統', destination: '根岸駅前 行', delayMinutes: 0 }]
 });
 const pills2 = koizumiDiv2.querySelectorAll('.pole-pill-btn');
 assert(!pills2[0].classList.contains('active'), 'Pole 1 must not be active');
 assert(pills2[1].classList.contains('active'), 'Pole 2 must be active');

 // Check 5-stop approaching calculation for Koizumi pole 2
 const koizumiPole2Status = busLocationService.get5StopApproachingStatus([], 'koizumi', '2');
 assert.strictEqual(koizumiPole2Status.targetStopName, '古泉');
 assert.strictEqual(koizumiPole2Status.stops.length, 6);
 assert.strictEqual(koizumiPole2Status.stops[0].name, '万福寺前');
 assert.strictEqual(koizumiPole2Status.stops[5].name, '古泉');
 console.log(' ✔ PASS: Koizumi platform pills and approaching calculation for Pole 1 & Pole 2 work correctly');

 // --- Check 3: Manual Geolocation buttons in Transfer and Stop views ---
 console.log('\n[Check 3] Manual Geolocation buttons in Transfer and Stop views...');
 assert(transferDiv.querySelector('#btn-geo-transfer'), 'Transfer view must contain #btn-geo-transfer button');
 assert(stopsDiv.querySelector('#btn-geo-stops'), 'Stop view must contain #btn-geo-stops button');

 // Verify app.js event delegation logic
 const appSrc = fs.readFileSync('./js/app.js', 'utf8');
 assert(appSrc.includes('handleManualGeolocation'), 'app.js must implement handleManualGeolocation');
 assert(appSrc.includes('#btn-geo-transfer'), 'app.js must handle #btn-geo-transfer');
 assert(appSrc.includes('#btn-geo-stops'), 'app.js must handle #btn-geo-stops');
 assert(!appSrc.includes('determineInitialNavigation()'), 'Auto-navigation on launch must be eliminated');
 console.log(' ✔ PASS: Manual geolocation buttons exist and are bound to handleManualGeolocation');

 // --- Check 4: End of Service card after final bus ---
 console.log('\n[Check 4] End of Service card after final bus...');
 const endOfServiceDiv = document.createElement('div');
 renderMainTransfer(endOfServiceDiv, {
 hasApiKey: true,
 status: 'no_buses_available',
 recommended: null
 });
 assert(endOfServiceDiv.innerHTML.includes('本日の運行は終了しました'), 'Must render end of service card');
 assert(endOfServiceDiv.innerHTML.includes('🌙'), 'Must contain moon icon');
 assert(endOfServiceDiv.innerHTML.includes('停留所別時刻表'), 'Must contain timetable link button');
 assert(endOfServiceDiv.innerHTML.includes('view-stops'), 'Timetable button must route to view-stops');
 console.log(' ✔ PASS: End-of-service card correctly displayed with navigation to view-stops');

 // --- Check 5: Double Track Route Map Upbound (-20px) / Downbound (+20px) offsets ---
 console.log('\n[Check 5] Double Track Route Map vertical offsets...');
 const mockDoubleTrackData = {
 lineKey: '111',
 lineTitle: '111系統',
 totalBusCount: 2,
 upboundBusCount: 1,
 downboundBusCount: 1,
 stops: [
 {
 name: '洋光台北口',
 poleId: '7800.1',
 isMajor: true,
 upboundBusesAtStop: [],
 upboundBusesEnRoute: [{ busId: 'bus_up_1', delayMinutes: 0, delayText: '定刻', delayClass: 'delay-none' }],
 downboundBusesAtStop: [],
 downboundBusesEnRoute: [{ busId: 'bus_down_1', delayMinutes: 3, delayText: '+3分遅延', delayClass: 'delay-some' }]
 }
 ]
 };
 const renderedMapHtml = stepTimelineComponent.renderDoubleTrackRouteMap(mockDoubleTrackData);
 assert(renderedMapHtml.includes('translateY(-20px)'), 'Upbound en-route bus must have translateY(-20px)');
 assert(renderedMapHtml.includes('translateY(20px)'), 'Downbound en-route bus must have translateY(20px)');
 assert(renderedMapHtml.includes('↑'), 'Upbound must show up arrow');
 assert(renderedMapHtml.includes('↓'), 'Downbound must show down arrow');
 console.log(' ✔ PASS: Upbound (-20px) and downbound (+20px) offsets correctly applied with arrows');

 console.log('\n========================================');
 console.log('All Reviewer R2-2 Verification Checks PASSED!');
 console.log('========================================\n');
}

runReviewerChecks().catch(err => {
 console.error('\n❌ Verification FAILED with error:', err);
 process.exit(1);
});
