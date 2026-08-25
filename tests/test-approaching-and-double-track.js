/**
 * test-approaching-and-double-track.js
 * 
 * 手前5停留所横並びプログレスバー & JR東日本風上下線複線走行位置マップの検証テスト
 */

import { busLocationService } from '../js/services/bus-location-service.js';
import { stepTimelineComponent } from '../js/ui/step-timeline.js';
import { renderStopViews } from '../js/ui/render-stop-view.js';
import { renderRouteMapView } from '../js/ui/render-route-map.js';

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

console.log('\n==================================================');
console.log(`Summary: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
console.log('==================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Approaching & Double Track Tests PASSED successfully!');
}
