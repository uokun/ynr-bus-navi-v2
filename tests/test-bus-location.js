/**
 * tests/test-bus-location.js
 * 
 * Milestone 1: バス在線位置計算エンジン (bus-location-service.js) および
 * 路線データ基盤 (config.js, mock-data.js) の包括的単体テストスイート
 */

import { CONFIG, STOPS, ROUTES } from '../js/config.js';
import { MOCK_BUSES, getMockRealtimeBuses, getMockBusesForStop } from '../js/api/mock-data.js';
import {
  BusLocationService,
  busLocationService,
  getStopNameFromPole,
  normalizePoleId,
  getStopsForRoute,
  findStopIndex,
  formatDelayText,
  formatStatusText
} from '../js/services/bus-location-service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    passed++;
    console.log(`✔ PASS: ${message}`);
  }
}

console.log('=== Milestone 1: Bus Location Calculation Engine Verification ===\n');

// =========================================================================
// 1. ポールID正規化 & 停留所名解決テスト
// =========================================================================
console.log('--- 1. Pole Normalization & Stop Name Lookup ---');

assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1') === '洋光台北口', 'Resolves full URI for YokodaiKitaguchi 7800.1');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.2') === '洋光台北口', 'Resolves full URI for YokodaiKitaguchi 7800.2');
assert(getStopNameFromPole('7800.1') === '洋光台北口', 'Resolves short code 7800.1');
assert(getStopNameFromPole('YokodaiKitaguchi') === '洋光台北口', 'Resolves key YokodaiKitaguchi');

assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6') === '上大岡駅前', 'Resolves KamiookaStation 1046.6');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12') === '上大岡駅前', 'Resolves KamiookaStation 1046.12');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13') === '上大岡駅前', 'Resolves KamiookaStation 1046.13');
assert(getStopNameFromPole('1046.1') === '上大岡駅前', 'Resolves short code 1046.1');

assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1') === '古泉', 'Resolves Koizumi 1810.1');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.2') === '古泉', 'Resolves Koizumi 1810.2');

assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1') === '吉原', 'Resolves Yoshihara');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1') === '関の下', 'Resolves Sekinoshita');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Tenjinmae.3609.2') === '天神前', 'Resolves Tenjinmae');
assert(getStopNameFromPole('odpt.BusstopPole:YokohamaMunicipal.Okamuracho.827.2') === '岡村町', 'Resolves Okamuracho');

assert(getStopNameFromPole(null) === '', 'Handles null gracefully');
assert(getStopNameFromPole('') === '', 'Handles empty string gracefully');

// =========================================================================
// 2. 系統・停留所順序取得テスト
// =========================================================================
console.log('\n--- 2. Route Stop Sequence Resolution ---');

const stops111Out = getStopsForRoute(ROUTES.ROUTE_111.patternOutbound, 'outbound');
assert(stops111Out.includes('洋光台北口') && stops111Out.includes('上大岡駅前'), '111 outbound contains 洋光台北口 and 上大岡駅前');
assert(stops111Out.indexOf('洋光台北口') < stops111Out.indexOf('上大岡駅前'), '洋光台北口 comes before 上大岡駅前 in 111 outbound');
assert(stops111Out[stops111Out.length - 1] === '上大岡駅前', '上大岡駅前 is the terminus of 111 outbound');

const stops111In = getStopsForRoute(ROUTES.ROUTE_111.patternInbound, 'inbound');
assert(stops111In.includes('上大岡駅前') && stops111In.includes('洋光台北口'), '111 inbound contains 上大岡駅前 and 洋光台北口');
assert(stops111In.indexOf('上大岡駅前') < stops111In.indexOf('洋光台北口'), '上大岡駅前 comes before 洋光台北口 in 111 inbound');

const stops133Out = getStopsForRoute(ROUTES.ROUTE_133.patternOutbound, 'outbound');
assert(stops133Out[0] === '上大岡駅前', '上大岡駅前 is start of 133 outbound');
assert(stops133Out.includes('古泉'), '133 outbound contains 古泉');
assert(stops133Out.indexOf('上大岡駅前') < stops133Out.indexOf('古泉'), '上大岡駅前 comes before 古泉 in 133 outbound');

const stops133In = getStopsForRoute(ROUTES.ROUTE_133.patternInbound, 'inbound');
assert(stops133In.includes('古泉') && stops133In.includes('上大岡駅前'), '133 inbound contains 古泉 and 上大岡駅前');
assert(stops133In.indexOf('古泉') < stops133In.indexOf('上大岡駅前'), '古泉 comes before 上大岡駅前 in 133 inbound');

// =========================================================================
// 3. インデックス検索 (findStopIndex) テスト
// =========================================================================
console.log('\n--- 3. Stop Index Lookup ---');

assert(findStopIndex(stops111Out, '吉原') !== -1, 'Finds 吉原 by name');
assert(findStopIndex(stops111Out, 'odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1') !== -1, 'Finds 吉原 by full pole URI');
assert(findStopIndex(stops111Out, '7816.1') !== -1, 'Finds 吉原 by short code');
assert(findStopIndex(stops111Out, 'NonexistentStop') === -1, 'Returns -1 for unknown stop');

// =========================================================================
// 4. 遅延時間 & ステータステキストフォーマットテスト
// =========================================================================
console.log('\n--- 4. Delay & Status Text Formatting ---');

const d0 = formatDelayText(0);
assert(d0.delayMinutes === 0 && d0.delayText === '定刻', '0s delay is 定刻');
const d60 = formatDelayText(60);
assert(d60.delayMinutes === 1 && d60.delayText === '+1分遅れ', '60s delay is +1分遅れ');
const d180 = formatDelayText(180);
assert(d180.delayMinutes === 3 && d180.delayText === '+3分遅れ', '180s delay is +3分遅れ');
const dUndef = formatDelayText(undefined);
assert(dUndef.delayMinutes === 0 && dUndef.delayText === '定刻', 'Undefined delay defaults to 定刻');

assert(formatStatusText('at_stop', 0) === '当バス停に到着/停車中', 'at_stop text is correct');
assert(formatStatusText('approaching', 1, '関の下') === 'まもなく到着 (関の下を出発)', 'approaching text contains fromStop');
assert(formatStatusText('en_route', 3, '吉原', '港南区総合庁舎前') === '3個前 (吉原〜港南区総合庁舎前間) を走行中', 'en_route text formatted with stops away and segment');
assert(formatStatusText('passed', null) === '通過済', 'passed text is correct');
assert(formatStatusText('scheduled', null) === '運行前/予定', 'scheduled text is correct');

// =========================================================================
// 5. 在線位置相対計算 (getBusLocationStatus) シナリオテスト
// =========================================================================
console.log('\n--- 5. Relative Position & Status Calculation Scenarios ---');

// シナリオ A: 111系統 上大岡駅前行、吉原を出発して港南区総合庁舎前へ走行中 (3個前)
const bus3StopsAway = {
  'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Yoshihara.7816.1',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonanWardOffice.1827.1',
  'odpt:delay': 180
};
const resA = busLocationService.getBusLocationStatus(bus3StopsAway, STOPS.KAMIOOKA.idArrival, ROUTES.ROUTE_111.patternOutbound);
assert(resA.status === 'en_route', 'Scenario A status is en_route');
assert(resA.stopsAway === 4 || resA.stopsAway === 3 || resA.stopsAway > 1, `Scenario A stopsAway is calculated (${resA.stopsAway})`);
assert(resA.fromStopName === '吉原', 'Scenario A fromStop is 吉原');
assert(resA.toStopName === '港南区総合庁舎前', 'Scenario A toStop is 港南区総合庁舎前');
assert(resA.delayMinutes === 3, 'Scenario A delayMinutes is 3');
assert(resA.delayText === '+3分遅れ', 'Scenario A delayText is +3分遅れ');
assert(resA.timelineNodes.length >= 3, 'Scenario A has at least 3 timeline nodes');
assert(resA.timelineNodes[resA.timelineNodes.length - 1].isTarget === true, 'Scenario A target node is last in timeline');

// シナリオ B: 111系統 上大岡駅前行、関の下を出発して上大岡駅前へ向かう (まもなく到着 / 1個前)
const busApproaching = {
  'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Sekinoshita.2604.1',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
  'odpt:delay': 0
};
const resB = busLocationService.getBusLocationStatus(busApproaching, STOPS.KAMIOOKA.idArrival, ROUTES.ROUTE_111.patternOutbound);
assert(resB.status === 'approaching', 'Scenario B status is approaching');
assert(resB.stopsAway === 1, 'Scenario B stopsAway is 1');
assert(resB.delayMinutes === 0, 'Scenario B delayMinutes is 0');
assert(resB.delayText === '定刻', 'Scenario B delayText is 定刻');
assert(resB.busSegmentIndex === resB.timelineNodes.length - 2, 'Scenario B busSegmentIndex points to last segment before target');

// シナリオ C: 当バス停に到着/停車中 (at_stop / 0個前)
const busAtStop = {
  'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
  'odpt:delay': 60
};
const resC = busLocationService.getBusLocationStatus(busAtStop, STOPS.KAMIOOKA.idArrival, ROUTES.ROUTE_111.patternOutbound);
assert(resC.status === 'at_stop', 'Scenario C status is at_stop');
assert(resC.stopsAway === 0, 'Scenario C stopsAway is 0');
assert(resC.statusText === '当バス停に到着/停車中', 'Scenario C statusText is 当バス停に到着/停車中');

// シナリオ D: 通過済み (passed)
const busPassed = {
  'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KonandaiStation.1823.3',
  'odpt:delay': 0
};
// ターゲットが手前の「洋光台北口」の場合
const resD = busLocationService.getBusLocationStatus(busPassed, STOPS.YOKODAI.id, ROUTES.ROUTE_111.patternOutbound);
assert(resD.status === 'passed', 'Scenario D status is passed');
assert(resD.stopsAway === null, 'Scenario D stopsAway is null');
assert(resD.statusText === '通過済', 'Scenario D statusText is 通過済');

// シナリオ E: 運行前 / 予定便 (scheduled)
const resE = busLocationService.getBusLocationStatus(null, STOPS.KAMIOOKA.id, ROUTES.ROUTE_111.patternOutbound);
assert(resE.status === 'scheduled', 'Scenario E (null bus) status is scheduled');
assert(resE.stopsAway === null, 'Scenario E stopsAway is null');
assert(resE.timelineNodes.length > 0, 'Scenario E generates default timeline nodes');
assert(resE.timelineNodes[resE.timelineNodes.length - 1].isTarget === true, 'Scenario E target is marked');

// =========================================================================
// 6. 133系統 (古泉・上大岡) の在線計算テスト
// =========================================================================
console.log('\n--- 6. Route 133 (Koizumi & Kamiooka) Verification ---');

// 133系統 往路 (岡村町 -> 古泉へ走行中: 1個前)
const bus133ApproachingKoizumi = {
  'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Okamuracho.827.2',
  'odpt:toBusstopPole': STOPS.KOIZUMI.idInbound,
  'odpt:delay': 300
};
const res133 = busLocationService.getBusLocationStatus(bus133ApproachingKoizumi, STOPS.KOIZUMI.idInbound, ROUTES.ROUTE_133.patternOutbound);
assert(res133.status === 'approaching', '133 to Koizumi is approaching');
assert(res133.stopsAway === 1, '133 to Koizumi stopsAway is 1');
assert(res133.delayMinutes === 5, '133 delay is 5 min');
assert(res133.delayText === '+5分遅れ', '133 delayText is +5分遅れ');

// 133系統 往路 (横浜岡村郵便局前 -> 天神前: 古泉まで3個前)
const bus133_3Stops = {
  'odpt:busroutePattern': ROUTES.ROUTE_133.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.YokohamaOkamuraPostOffice.7848.2',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Tenjinmae.3609.2',
  'odpt:delay': 0
};
const res133_3 = busLocationService.getBusLocationStatus(bus133_3Stops, STOPS.KOIZUMI.idInbound, ROUTES.ROUTE_133.patternOutbound);
assert(res133_3.status === 'en_route', '133 3 stops away status is en_route');
assert(res133_3.stopsAway === 3, '133 3 stops away is exactly 3');

// =========================================================================
// 7. MOCK_BUSES 整合性テスト
// =========================================================================
console.log('\n--- 7. MOCK_BUSES Realtime Simulation Integrity ---');

assert(MOCK_BUSES.length >= 8, `MOCK_BUSES contains rich scenarios (count: ${MOCK_BUSES.length})`);

MOCK_BUSES.forEach((bus, i) => {
  const targetPole = bus['odpt:toBusstopPole'] || bus['odpt:fromBusstopPole'];
  const status = busLocationService.getBusLocationStatus(bus, targetPole);
  assert(status && typeof status.status === 'string', `Mock bus #${i} (${bus['owl:sameAs']}) computes valid status (${status.status})`);
  assert(Array.isArray(status.timelineNodes) && status.timelineNodes.length > 0, `Mock bus #${i} has valid timeline nodes`);
});

// =========================================================================
// 8. エッジケース・堅牢性テスト
// =========================================================================
console.log('\n--- 8. Edge Cases & Resilience ---');

// 終着停留所 (toBusstopPole が null または空)
const busTerminus = {
  'odpt:busroutePattern': ROUTES.ROUTE_111.patternOutbound,
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.13',
  'odpt:toBusstopPole': null,
  'odpt:delay': 0
};
const resTerminus = busLocationService.getBusLocationStatus(busTerminus, STOPS.KAMIOOKA.idArrival, ROUTES.ROUTE_111.patternOutbound);
assert(resTerminus.status === 'at_stop', 'Terminus bus at destination is at_stop');

// 不正なポールID (未知のID)
const busCorrupted = {
  'odpt:busroutePattern': 'unknown.pattern.999',
  'odpt:fromBusstopPole': 'unknown.pole.999',
  'odpt:toBusstopPole': 'unknown.pole.888',
  'odpt:delay': 'not a number'
};
const resCorrupted = busLocationService.getBusLocationStatus(busCorrupted, STOPS.KAMIOOKA.id);
assert(resCorrupted && resCorrupted.status !== undefined, 'Corrupted bus object handled without exception');

console.log(`\n========================================`);
console.log(`Milestone 1 Tests: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
