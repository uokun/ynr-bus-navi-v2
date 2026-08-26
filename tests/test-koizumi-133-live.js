import { busLocationService, getStopsForRoute, findStopIndex, getStopNameFromPole } from '../js/services/bus-location-service.js';
import { stepTimelineComponent } from '../js/ui/step-timeline.js';

console.log('=== Test: 133 Line from Koizumi (Inbound to Kamiooka) ===');

const mockBus = {
  'odpt:busroutePattern': 'odpt.BusroutePattern:YokohamaMunicipal.13300.1',
  'odpt:fromBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.Takigashira.3034.1',
  'odpt:toBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.ShidenHozonkanmae.2288.1',
  'odpt:destinationBusstopPole': 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.1',
  'odpt:delay': 60
};

const targetPole = 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1';

const targetStopName = getStopNameFromPole(targetPole);
const fromStopName = getStopNameFromPole(mockBus['odpt:fromBusstopPole']);
const toStopName = getStopNameFromPole(mockBus['odpt:toBusstopPole']);
const stopsList = getStopsForRoute('133系統', 'inbound', targetPole, '上大岡駅前 行');

console.log('Debug info:');
console.log(' - targetStopName:', targetStopName);
console.log(' - fromStopName:', fromStopName);
console.log(' - toStopName:', toStopName);
console.log(' - stopsList:', stopsList);
console.log(' - targetIdx:', findStopIndex(stopsList, targetStopName));
console.log(' - fromIdx:', findStopIndex(stopsList, fromStopName));
console.log(' - toIdx:', findStopIndex(stopsList, toStopName));

const status = busLocationService.getBusLocationStatus(
  mockBus,
  targetPole,
  '133系統',
  { direction: 'inbound', destination: '上大岡駅前 行' }
);

console.log('Location status calculated:');
console.log(' - status:', status.status);
console.log(' - stopsAway:', status.stopsAway);
console.log(' - fromStopName:', status.fromStopName);
console.log(' - toStopName:', status.toStopName);
console.log(' - statusText:', status.statusText);

const miniHtml = stepTimelineComponent.renderMini(status);
console.log('Rendered mini badge HTML:');
console.log(miniHtml);

if (!miniHtml.includes('滝頭') || !miniHtml.includes('あと')) {
  console.error('FAIL: Expected specific stop name and remaining stations in badge!');
  process.exit(1);
}

console.log('SUCCESS: Specific stop location and remaining stations correctly displayed!');
