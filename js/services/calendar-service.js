/**
 * calendar-service.js
 * Japanese National Holiday calculation & bus timetable schedule type determination.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

export class CalendarService {
  /**
   * Checks if a date is a Japanese National Holiday or Year-End/New Year special holiday.
   * @param {Date} date
   * @returns {boolean}
   */
  isJapaneseHoliday(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date();
    }

    const y = date.getFullYear();
    const m = date.getMonth() + 1; // 1-12
    const d = date.getDate();
    const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    // 1. Year-End / New Year Special Municipal Schedule (Dec 29 - Jan 3)
    if ((m === 12 && d >= 29) || (m === 1 && d <= 3)) {
      return true;
    }

    // 2. Fixed National Holidays
    const fixedHolidays = [
      { m: 1, d: 1, name: '元日' },
      { m: 2, d: 11, name: '建国記念の日' },
      { m: 2, d: 23, name: '天皇誕生日' },
      { m: 4, d: 29, name: '昭和の日' },
      { m: 5, d: 3, name: '憲法記念日' },
      { m: 5, d: 4, name: 'みどりの日' },
      { m: 5, d: 5, name: 'こどもの日' },
      { m: 8, d: 11, name: '山の日' },
      { m: 11, d: 3, name: '文化の日' },
      { m: 11, d: 23, name: '勤労感謝の日' }
    ];

    for (const h of fixedHolidays) {
      if (m === h.m && d === h.d) return true;
    }

    // 3. Happy Monday Holidays
    // 成人の日: Jan 2nd Monday (8-14)
    if (m === 1 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;
    // 海の日: Jul 3rd Monday (15-21)
    if (m === 7 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
    // 敬老の日: Sep 3rd Monday (15-21)
    if (m === 9 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
    // スポーツの日: Oct 2nd Monday (8-14)
    if (m === 10 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;

    // 4. Astronomical Equinox Holidays (Vernal & Autumnal)
    // Spring equinox (春分の日)
    const vernalDay = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    if (m === 3 && d === vernalDay) return true;

    // Autumn equinox (秋分の日)
    const autumnalDay = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    if (m === 9 && d === autumnalDay) return true;

    // 5. Citizen's Holiday (国民の休日: weekday between two national holidays)
    // Most common in September between Respect for the Aged Day and Autumn Equinox Day
    if (m === 9 && dayOfWeek === 2 && d >= 16 && d <= 23) {
      const prevDay = new Date(y, 8, d - 1);
      const nextDay = new Date(y, 8, d + 1);
      if (this._isPureNationalHoliday(prevDay) && this._isPureNationalHoliday(nextDay)) {
        return true;
      }
    }

    // 6. Substitute Holidays (振替休日)
    // If yesterday was a national holiday and yesterday was Sunday
    const yesterday = new Date(y, m - 1, d - 1);
    if (yesterday.getDay() === 0 && this._isPureNationalHoliday(yesterday)) {
      return true;
    }
    // Special Golden Week rule for May 6:
    // If May 3 or May 4 was Sunday, May 6 is a substitute holiday
    if (m === 5 && d === 6) {
      const may3 = new Date(y, 4, 3);
      const may4 = new Date(y, 4, 4);
      if (may3.getDay() === 0 || may4.getDay() === 0) {
        return true;
      }
    }

    return false;
  }

  isHoliday(date) {
    return this.isJapaneseHoliday(date);
  }

  /**
   * Internal check for pure national holiday (excluding substitute / year-end checks).
   * @private
   */
  _isPureNationalHoliday(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const dayOfWeek = date.getDay();

    const fixedHolidays = [
      { m: 1, d: 1 }, { m: 2, d: 11 }, { m: 2, d: 23 },
      { m: 4, d: 29 }, { m: 5, d: 3 }, { m: 5, d: 4 }, { m: 5, d: 5 },
      { m: 8, d: 11 }, { m: 11, d: 3 }, { m: 11, d: 23 }
    ];
    for (const h of fixedHolidays) {
      if (m === h.m && d === h.d) return true;
    }

    if (m === 1 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;
    if (m === 7 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
    if (m === 9 && dayOfWeek === 1 && d >= 15 && d <= 21) return true;
    if (m === 10 && dayOfWeek === 1 && d >= 8 && d <= 14) return true;

    const vernalDay = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    if (m === 3 && d === vernalDay) return true;

    const autumnalDay = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    if (m === 9 && d === autumnalDay) return true;

    return false;
  }

  /**
   * Determines whether the given date uses 'Weekday', 'Saturday', or 'Holiday' timetable.
   * @param {Date} [date=new Date()]
   * @returns {'Weekday' | 'Saturday' | 'Holiday'}
   */
  getCalendarType(date = new Date()) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date();
    }

    // Any holiday or Sunday -> 'Holiday'
    if (this.isJapaneseHoliday(date)) {
      return 'Holiday';
    }

    const day = date.getDay();
    if (day === 0) {
      return 'Holiday'; // Sunday
    }
    if (day === 6) {
      return 'Saturday'; // Saturday
    }
    return 'Weekday'; // Monday to Friday
  }
}

export const calendarService = new CalendarService();
export default calendarService;
