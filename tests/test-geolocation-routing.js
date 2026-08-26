/**
 * test-geolocation-routing.js
 * Geolocation nearest stop identification and automatic routing test
 */

import { locationService } from '../js/services/location-service.js';
import { STOPS } from '../js/config.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`✔ PASS: ${msg}`);
    passed++;
  }
}

// 1. Near Yokodai (洋光台北口 付近)
const nearYokodai = { latitude: 35.3831, longitude: 139.5985 };
const resYokodai = locationService.getNearestStop(nearYokodai);
assert(resYokodai.stopKey === 'yokodai', 'Near Yokodai resolves to yokodai');
assert(resYokodai.distance === 0, 'Exact Yokodai distance is 0m');

// 2. Near Kamiooka (上大岡駅前 付近)
const nearKamiooka = { latitude: 35.4086, longitude: 139.5964 };
const resKamiooka = locationService.getNearestStop(nearKamiooka);
assert(resKamiooka.stopKey === 'kamiooka', 'Near Kamiooka resolves to kamiooka');
assert(resKamiooka.distance === 0, 'Exact Kamiooka distance is 0m');

// 3. Near Koizumi (古泉 付近)
const nearKoizumi = { latitude: 35.4215, longitude: 139.6152 };
const resKoizumi = locationService.getNearestStop(nearKoizumi);
assert(resKoizumi.stopKey === 'koizumi', 'Near Koizumi resolves to koizumi');
assert(resKoizumi.distance === 0, 'Exact Koizumi distance is 0m');

// 4. Initial navigation behavior resolution
// Yokodai -> Outbound Transfer
const navYokodai = locationService.getNearestStop({ latitude: 35.3850, longitude: 139.5990 });
assert(navYokodai.stopKey === 'yokodai', 'Offset Yokodai resolves to yokodai');

// Koizumi -> Inbound Transfer
const navKoizumi = locationService.getNearestStop({ latitude: 35.4200, longitude: 139.6140 });
assert(navKoizumi.stopKey === 'koizumi', 'Offset Koizumi resolves to koizumi');

// Kamiooka -> Direct Stop View
const navKamiooka = locationService.getNearestStop({ latitude: 35.4090, longitude: 139.5970 });
assert(navKamiooka.stopKey === 'kamiooka', 'Offset Kamiooka resolves to kamiooka');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
