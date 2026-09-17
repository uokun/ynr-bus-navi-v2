/**
 * test-approaching-and-double-track.js
 * 
 * 手前5停留所横並びプログレスバー & JR東日本風上下線複線走行位置マップの検証テスト
 */

import { busLocationService } from '../js/services/bus-location-service.js';
import { stepTimelineComponent } from '../js/ui/step-timeline.js';
import { renderStopViews } from '../js/ui/render-stop-view.js';
import { renderRouteMapView } from '../js/ui/render-route-map.js';
import { timetableService } from '../js/services/timetable-service.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL: ${message}`);
  }
}

console.log('=== Step 1: 5-Stop Approaching Status Engine Tests ===');

// Test 1: Yokodai 5-stop sequence
const yokodaiStatus = busLocationService.get5StopApproachingStatus([], 'yokodai');
assert(yokodaiStatus.targetStopName === '洋光台北口', 'Yokodai targetStopName is 洋光台北口');
assert(yokodaiStatus.stops.length === 6, 'Yokodai sequence contains exactly 6 stops (5 previous + target)');
assert(yokodaiStatus.stops[0].name === 'バイパス下', 'Yokodai stop 0 is バイパス下');
assert(yokodaiStatus.stops[1].name === '洋光台五丁目', 'Yokodai stop 1 is 洋光台五丁目');
assert(yokodaiStatus.stops[2].name === '洋光台駅前', 'Yokodai stop 2 is 洋光台駅前');
assert(yokodaiStatus.stops[3].name === '西公園前', 'Yokodai stop 3 is 西公園前');
assert(yokodaiStatus.stops[4].name === '洋光台二丁目', 'Yokodai stop 4 is 洋光台二丁目');
assert(yokodaiStatus.stops[5].name === '洋光台北口', 'Yokodai stop 5 is 洋光台北口 (target)');
assert(yokodaiStatus.stops[5].isTarget === true, 'Target stop has isTarget === true');

// Test 2: Koizumi 5-stop sequence
const koizumiStatus = busLocationService.get5StopApproachingStatus([], 'koizumi');
assert(koizumiStatus.targetStopName === '古泉', 'Koizumi targetStopName is 古泉');
assert(koizumiStatus.stops.length === 6, 'Koizumi sequence contains exactly 6 stops');
assert(koizumiStatus.stops[0].name === '坂下公園前', 'Koizumi stop 0 is 坂下公園前');
assert(koizumiStatus.stops[1].name === '滝頭', 'Koizumi stop 1 is 滝頭');
assert(koizumiStatus.stops[2].name === '市電保存館前', 'Koizumi stop 2 is 市電保存館前');
assert(koizumiStatus.stops[3].name === '滝頭地域ケアプラザ前', 'Koizumi stop 3 is 滝頭地域ケアプラザ前');
assert(koizumiStatus.stops[4].name === '仲之町', 'Koizumi stop 4 is 仲之町');
assert(koizumiStatus.stops[5].name === '古泉', 'Koizumi stop 5 is 古泉 (target)');
assert(koizumiStatus.stops[5].isTarget === true, 'Koizumi target has isTarget === true');

// Test 3: Kamiooka is Terminus
const kamiookaStatus = busLocationService.get5StopApproachingStatus([], 'kamiooka');
assert(kamiookaStatus.isTerminus === true, 'Kamiooka is marked as terminus');
assert(kamiookaStatus.targetStopName === '上大岡駅前', 'Kamiooka targetStopName is 上大岡駅前');

// Test 4: Live bus tracking in 5-stop progress bar
const mockLiveBusYokodai = [
  {
    '@id': 'test-bus-111',
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiStation.7806.2',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.NishiPark.4223.1',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:delay': 120
  }
];

const liveYokodaiStatus = busLocationService.get5StopApproachingStatus(mockLiveBusYokodai, 'yokodai');
assert(liveYokodaiStatus.status === 'en_route', 'Live bus status is en_route');
assert(liveYokodaiStatus.delayMinutes === 2, 'Live bus delayMinutes is 2');
assert(liveYokodaiStatus.delayText === '+2分遅れ', 'Live bus delayText is +2分遅れ');
assert(liveYokodaiStatus.busPosition.segmentIndex === 2, 'Bus segmentIndex points to 洋光台駅前 ➔ 西公園前 (index 2)');

console.log('\n=== Step 2: 5-Stop Horizontal Progress Bar Component Tests ===');

const hProgressBarHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(liveYokodaiStatus);
assert(hProgressBarHtml.includes('h-5stop-container'), 'HTML contains h-5stop-container');
assert(hProgressBarHtml.includes('洋光台北口'), 'HTML contains target stop name 洋光台北口');
assert(hProgressBarHtml.includes('洋光台駅前'), 'HTML contains stop node 洋光台駅前');
assert(hProgressBarHtml.includes('h-bus-marker'), 'HTML contains h-bus-marker');
assert(hProgressBarHtml.includes('+2分遅れ'), 'HTML contains delay tag +2分遅れ');

const terminusBannerHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(kamiookaStatus);
assert(terminusBannerHtml.includes('terminus'), 'Kamiooka HTML contains terminus class');
assert(terminusBannerHtml.includes('始発停留所'), 'Kamiooka HTML contains 始発停留所 banner');

// Test 4b: Kamiooka Live At-Stop & Approaching Banner
const kamiookaAtStopStatus = {
  targetStopName: '上大岡駅前',
  isTerminus: true,
  status: 'at_stop',
  statusText: '乗り場に停車中（ご乗車いただけます）',
  stopsAway: 0
};
const kamiookaAtStopHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(kamiookaAtStopStatus);
assert(kamiookaAtStopHtml.includes('乗り場に停車中'), 'Kamiooka at-stop HTML renders 乗り場に停車中 banner');

const kamiookaApproachingStatus = {
  targetStopName: '上大岡駅前',
  isTerminus: true,
  status: 'approaching',
  statusText: 'まもなく乗り場へ入線（手前停留所を走行中）',
  stopsAway: 1
};
const kamiookaApproachingHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(kamiookaApproachingStatus);
assert(kamiookaApproachingHtml.includes('まもなく入線'), 'Kamiooka approaching HTML renders まもなく入線 banner');

// Test 4c: En-route beyond 5 stops formatting
const farBusStatus = {
  targetStopName: '洋光台北口',
  isTerminus: false,
  status: 'en_route',
  statusText: '8個前を走行中',
  stopsAway: 8,
  fromStopName: '洋光台五丁目',
  toStopName: '洋光台駅前',
  stops: [
    { name: 'バイパス下', isTarget: false, isCurrent: false, isPassed: false },
    { name: '洋光台北口', isTarget: true, isCurrent: false, isPassed: false }
  ]
};
const farBusHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(farBusStatus);
assert(farBusHtml.includes('8停留所手前を走行中'), 'Far bus renders 8停留所手前を走行中');
assert(farBusHtml.includes('洋光台五丁目'), 'Far bus detail text includes fromStopName 洋光台五丁目');

// Test 4d: Reverse bus direction isolation (downbound 11100 not matching upbound Yokodai)
const downboundBus = [
  {
    '@id': 'bus-111-down',
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
    'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.11100.10_1',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.2',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.4800.1'
  }
];
const upboundYokodaiStatus = busLocationService.get5StopApproachingStatus(downboundBus, 'yokodai', '1');
assert(upboundYokodaiStatus.status === 'scheduled', 'Downbound bus 11100 is isolated from upbound Yokodai Pole 1');

console.log('\n=== Step 3: Double Track Route Map Engine Tests ===');

const mockBusesDoubleTrack = [
  // 111 Upbound (to Kamiooka)
  {
    '@id': 'bus-111-up',
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.HinoChuoKoenIriguchi.5256.1',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
    'odpt:delay': 60
  },
  // 111 Downbound (to Konandai)
  {
    '@id': 'bus-111-down',
    'odpt:busroute': 'odpt.Busroute:YokohamaMunicipal.111',
    'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6',
    'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.2',
    'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
    'odpt:delay': 0
  }
];

const dt111 = busLocationService.getDoubleTrackRouteMap(mockBusesDoubleTrack, '111');
assert(dt111.lineKey === '111', 'LineKey is 111');
assert(dt111.upboundBusCount === 1, 'Upbound bus count is 1');
assert(dt111.downboundBusCount === 1, 'Downbound bus count is 1');
assert(dt111.totalBusCount === 2, 'Total bus count is 2');
assert(dt111.stops.length === 21, '111 route has 21 stops from Kamiooka to Konandai');
assert(dt111.stops[0].name === '上大岡駅前', 'First stop is 上大岡駅前');
assert(dt111.stops[0].isMajor === true, '上大岡駅前 is major stop');
assert(dt111.stops[8].name === '洋光台北口', 'Stop 8 is 洋光台北口');
assert(dt111.stops[8].isMajor === true, '洋光台北口 is major stop');
assert(dt111.stops[20].name === '港南台駅前', 'Stop 20 is 港南台駅前');
assert(dt111.stops[20].isMajor === true, '港南台駅前 is major stop');

// Check bus placement
const yokodaiNode = dt111.stops.find(s => s.name === '洋光台北口');
assert(yokodaiNode.upboundBusesEnRoute.length === 1, 'Yokodai has 1 upbound bus en-route');

const kamiookaNode = dt111.stops.find(s => s.name === '上大岡駅前');
assert(kamiookaNode.downboundBusesEnRoute.length === 1, 'Kamiooka has 1 downbound bus en-route');

// Test 133 Double Track
const dt133 = busLocationService.getDoubleTrackRouteMap([], '133');
assert(dt133.lineKey === '133', 'LineKey is 133');
assert(dt133.stops.length === 19, '133 route has 19 stops from Kamiooka to Negishi');
assert(dt133.stops[0].name === '上大岡駅前', '133 first stop is 上大岡駅前');
const koizumiNode = dt133.stops.find(s => s.name === '古泉');
assert(koizumiNode && koizumiNode.isMajor === true, '古泉 is major stop in 133');

console.log('\n=== Step 4: Double Track Route Map Component HTML Tests ===');

const dtMapHtml = stepTimelineComponent.renderDoubleTrackRouteMap(dt111);
assert(dtMapHtml.includes('jr-double-track-map-container'), 'HTML contains jr-double-track-map-container');
assert(dtMapHtml.includes('dt-header-bar'), 'HTML contains dt-header-bar');
assert(dtMapHtml.includes('上大岡駅前 方面'), 'HTML contains 上大岡駅前 方面');
assert(dtMapHtml.includes('港南台駅前 方面'), 'HTML contains 港南台駅前 方面');
assert(dtMapHtml.includes('major-stop'), 'HTML contains major-stop highlighted row');
assert(dtMapHtml.includes('dt-bus-pill upbound'), 'HTML contains upbound bus pill');
assert(dtMapHtml.includes('dt-bus-pill downbound'), 'HTML contains downbound bus pill');

console.log('\n=== Step 5: Route Map View Renderer Integration Tests ===');

const mockContainer = { innerHTML: '' };
renderRouteMapView(mockContainer, {
  activeLine: '111',
  realtimeBuses: mockBusesDoubleTrack
});

assert(mockContainer.innerHTML.includes('map-view-header-card'), 'Rendered route map contains header card');
assert(mockContainer.innerHTML.includes('map-line-tab'), 'Rendered route map contains line tabs');
assert(mockContainer.innerHTML.includes('jr-double-track-map-container'), 'Rendered route map contains double track container');

console.log('\n=== Step 6: First Departure & Approaching Bar Full Synchronization Tests ===');

const mockFirstDep = {
  departureTime: '12:05',
  actualDepartureTime: '12:05',
  delayMinutes: 0,
  line: '111系統',
  destination: '上大岡駅前 行',
  countdownText: 'あと5分',
  matchedBus: {
    '@id': 'bus-test-sync',
    'odpt:busroutePattern': '11101',
    'odpt:fromBusstopPole': '7806.2',
    'odpt:toBusstopPole': '4223.1',
    'odpt:delay': 0
  },
  locationStatus: {
    status: 'en_route',
    statusText: '2個前を走行中',
    fromStopName: '洋光台駅前',
    toStopName: '西公園前',
    stopsAway: 2,
    delayMinutes: 0,
    delayText: '定刻'
  }
};

// 1. renderStopViews generates Hero Card containing hero-mini-loc
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const stopContainer = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
  nodeType: 1
};
renderStopViews(stopContainer, {
  activeStopKey: 'yokodai',
  activePole: '1',
  departures: [mockFirstDep],
  realtimeBuses: [],
  hasApiKey: true
});

assert(stopContainer.innerHTML.includes('stop-hero-card'), 'Stop view contains stop-hero-card');
assert(stopContainer.innerHTML.includes('hero-mini-loc'), 'Stop view Hero card embeds hero-mini-loc');
assert(stopContainer.innerHTML.includes('洋光台駅前〜西公園前間 (あと2駅)'), 'Hero card displays exact live segment and stops away');

// 2. get5StopApproachingStatus synchronizes with firstDep
const syncedApproaching = busLocationService.get5StopApproachingStatus([], 'yokodai', '1', mockFirstDep);
assert(syncedApproaching.status === 'en_route', 'Approaching bar status matches firstDep');
assert(syncedApproaching.stopsAway === 2, 'Approaching bar stopsAway matches firstDep');
assert(syncedApproaching.fromStopName === '洋光台駅前', 'Approaching bar fromStopName matches firstDep');
assert(syncedApproaching.toStopName === '西公園前', 'Approaching bar toStopName matches firstDep');

console.log('\n=== Step 7: Elimination of False "Just Departed" (発車直後) When Bus Still En-Route ===');

// 1. Bus is 2 stops away but scheduled time has elapsed (-45s) -> Must NOT show '発車直後'
const delayed2StopsStatus = {
  status: 'en_route',
  stopsAway: 2,
  fromStopName: '滝頭地域ケアプラザ前',
  toStopName: '仲之町'
};
const cdDelayed2Stops = timetableService.formatCountdown(0, -45, delayed2StopsStatus);
assert(cdDelayed2Stops.text !== '発車直後', 'Diff -45s with bus 2 stops away is NOT 発車直後');
assert(cdDelayed2Stops.text.includes('接近中') && cdDelayed2Stops.text.includes('あと2駅'), 'Diff -45s with bus 2 stops away displays 遅延 接近中 (あと2駅)');
assert(cdDelayed2Stops.badgeClass === 'badge-soon', 'Delayed approaching badge class is badge-soon');

// 2. Bus is approaching (1 stop away) and scheduled time has elapsed (-30s) -> 'まもなく到着'
const approachingStatus = {
  status: 'approaching',
  stopsAway: 1
};
const cdApproaching = timetableService.formatCountdown(0, -30, approachingStatus);
assert(cdApproaching.text === 'まもなく到着', 'Diff -30s with approaching bus displays まもなく到着');

// 3. Bus is at_stop and scheduled time has elapsed (-10s) -> '停車中'
const atStopStatus = {
  status: 'at_stop',
  stopsAway: 0
};
const cdAtStop = timetableService.formatCountdown(0, -10, atStopStatus);
assert(cdAtStop.text === '停車中', 'Diff -10s with bus at stop displays 停車中');

// 4. Backward compatibility: When no locationStatus (or passed), normal '発車直後' is preserved
const cdNoStatus = timetableService.formatCountdown(0, -30, null);
assert(cdNoStatus.text === '発車直後', 'Diff -30s with no location status preserves 発車直後');

const cdPassed = timetableService.formatCountdown(0, -30, { status: 'passed' });
assert(cdPassed.text === '発車直後', 'Diff -30s with passed bus preserves 発車直後');

// 5. Hero card and sub items contain data-status and data-stops-away attributes
assert(stopContainer.innerHTML.includes('data-status="en_route"'), 'Hero card contains data-status="en_route"');
assert(stopContainer.innerHTML.includes('data-stops-away="2"'), 'Hero card contains data-stops-away="2"');

console.log('\n==================================================');
console.log(`Summary: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
console.log('==================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Approaching & Double Track Tests PASSED successfully!');
}
