/**
 * test-deep-edge-cases.js
 * Testing edge cases for TransferService & TimetableService
 */
import { transferService } from '../js/services/transfer-service.js';
import { timetableService } from '../js/services/timetable-service.js';
import { calendarService } from '../js/services/calendar-service.js';
import { storageService } from '../js/services/storage-service.js';

console.log('=== Deep Edge Case Analysis ===');

// 1. Test missing departureTime at midnight
const malformedLeg1 = [{ line: '111系統' }];
const normalLeg2 = [{ line: '133系統', departureTime: '00:30' }];
const midnightRes = transferService.calculateTransferRoute({
  leg1Timetable: malformedLeg1,
  leg2Timetable: normalLeg2,
  currentTime: new Date(2026, 7, 24, 0, 0, 0)
});
console.log('Midnight with missing departureTime result:', midnightRes);

// 2. Test params = null
try {
  transferService.calculateTransferRoute(null);
  console.log('transferService(null) succeeded');
} catch (e) {
  console.log('transferService(null) threw:', e.name, e.message);
}

// 3. Test realtimeDelays = null
try {
  transferService.calculateTransferRoute({
    leg1Timetable: [{ line: '111系統', departureTime: '08:00' }],
    leg2Timetable: [{ line: '133系統', departureTime: '08:30' }],
    realtimeDelays: null,
    currentTime: new Date(2026, 7, 24, 7, 0, 0)
  });
  console.log('realtimeDelays=null succeeded');
} catch (e) {
  console.log('realtimeDelays=null threw:', e.name, e.message);
}

// 4. Test CalendarService astronomical calculations across years
const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2035, 2040];
for (const y of years) {
  const vernalDay = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  const autumnalDay = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
  const vernalDate = new Date(y, 2, vernalDay);
  const autumnDate = new Date(y, 8, autumnalDay);
  const vHol = calendarService.isJapaneseHoliday(vernalDate);
  const aHol = calendarService.isJapaneseHoliday(autumnDate);
  console.log(`Year ${y}: Vernal day March ${vernalDay} (isHoliday: ${vHol}), Autumn day Sept ${autumnalDay} (isHoliday: ${aHol})`);
}

// 5. Test Silver Week (Citizen's holiday) scenario:
// e.g. Year 2026: Respect for the Aged Day is Sep 3rd Monday (Sep 21).
// Autumn Equinox 2026 is Sep 23.
// Sep 22 (Tuesday) should be Citizen's Holiday (国民の休日).
const sep21_2026 = new Date(2026, 8, 21); // Respect for Aged
const sep22_2026 = new Date(2026, 8, 22); // Citizen's Holiday
const sep23_2026 = new Date(2026, 8, 23); // Autumn Equinox
console.log('2026-09-21 (敬老の日):', calendarService.isJapaneseHoliday(sep21_2026), calendarService.getCalendarType(sep21_2026));
console.log('2026-09-22 (国民の休日):', calendarService.isJapaneseHoliday(sep22_2026), calendarService.getCalendarType(sep22_2026));
console.log('2026-09-23 (秋分の日):', calendarService.isJapaneseHoliday(sep23_2026), calendarService.getCalendarType(sep23_2026));
