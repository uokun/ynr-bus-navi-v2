/**
 * timetable-service.js
 * Timetable parsing, filtering, countdown generation, and realtime delay merging.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { busLocationService } from './bus-location-service.js';

export class TimetableService {
  /**
   * Converts a time string (e.g. "07:35", "24:15") to total minutes from midnight.
   * @param {string} timeStr
   * @returns {number}
   */
  timeStringToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }

  /**
   * Converts total minutes from midnight into standard "HH:mm" format.
   * @param {number} totalMinutes
   * @param {boolean} [wrap24=true]
   * @returns {string}
   */
  minutesToTimeString(totalMinutes, wrap24 = true) {
    if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) return '00:00';
    let mins = Math.round(totalMinutes);
    if (wrap24) {
      mins = ((mins % 1440) + 1440) % 1440;
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Formats countdown text and status given difference in minutes/seconds.
   * @param {number} diffMinutes
   * @param {number} [diffSeconds]
   * @param {Object} [locationStatus] リアルタイム走行状態 ({ status, stopsAway, ... })
   * @returns {{ text: string, shortText?: string, status: 'urgent' | 'soon' | 'normal' | 'past', badgeClass: string }}
   */
  formatCountdown(diffMinutes, diffSeconds = null, locationStatus = null) {
    const totalSec = diffSeconds !== null ? diffSeconds : Math.round(diffMinutes * 60);
    const mins = Math.floor(totalSec / 60);

    // リアルタイム位置情報があり、バスがまだ停留所手前にある場合は「発車直後」を完全に抑止
    if (locationStatus && (locationStatus.status === 'at_stop' || locationStatus.status === 'approaching' || locationStatus.status === 'en_route')) {
      if (locationStatus.status === 'at_stop') {
        return {
          text: '停車中',
          shortText: '停車中',
          status: 'urgent',
          badgeClass: 'badge-urgent'
        };
      }
      if (locationStatus.status === 'approaching' || locationStatus.stopsAway === 1) {
        return {
          text: 'まもなく到着',
          shortText: 'まもなく',
          status: 'urgent',
          badgeClass: 'badge-soon'
        };
      }
      if (locationStatus.status === 'en_route') {
        const away = typeof locationStatus.stopsAway === 'number' ? locationStatus.stopsAway : null;
        if (totalSec <= 0) {
          // 所定時刻を経過しているがまだ手前を走行中（遅延中）
          return {
            text: away ? `遅延 接近中 (あと${away}駅)` : '遅延 接近中',
            shortText: away ? `あと${away}駅` : '接近中',
            status: 'soon',
            badgeClass: 'badge-soon'
          };
        }
      }
    }

    if (totalSec < -120) {
      return {
        text: '発車済み',
        shortText: '発車済',
        status: 'past',
        badgeClass: 'badge-past'
      };
    }
    if (totalSec < 0) {
      return {
        text: '発車直後',
        shortText: '直後',
        status: 'urgent',
        badgeClass: 'badge-urgent'
      };
    }

    if (totalSec < 3600) {
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      const mStr = String(m).padStart(2, '0');
      const sStr = String(s).padStart(2, '0');
      return {
        text: `T-${mStr}:${sStr}`,
        shortText: `${mStr}:${sStr}`,
        status: m <= 5 ? 'soon' : 'normal',
        badgeClass: m <= 5 ? 'badge-soon' : 'badge-normal'
      };
    }

    const h = Math.floor(totalSec / 3600);
    const remSec = totalSec % 3600;
    const m = Math.floor(remSec / 60);
    const s = remSec % 60;
    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    return {
      text: `T-${hStr}:${mStr}:${sStr}`,
      shortText: `${hStr}:${mStr}:${sStr}`,
      status: 'normal',
      badgeClass: 'badge-normal'
    };
  }

  calculateCountdown(depTimeStr, now = new Date(), locationStatus = null) {
    if (!depTimeStr) return { text: '', status: 'none', badgeClass: '' };
    const depMin = this.timeStringToMinutes(depTimeStr);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowSec = now.getSeconds();
    let diffSec = (depMin - nowMin) * 60 - nowSec;
    if (nowMin >= 22 * 60 && depMin < 4 * 60) diffSec += 86400;
    else if (nowMin < 4 * 60 && depMin >= 22 * 60) diffSec -= 86400;
    const diffMin = Math.floor(diffSec / 60);
    return this.formatCountdown(diffMin, diffSec, locationStatus);
  }

  /**
   * Filters timetable entries by route, destination, or start time.
   * @param {Array} entries
   * @param {Object} [filterOptions]
   * @param {string} [filterOptions.route]
   * @param {string} [filterOptions.destination]
   * @param {string|number} [filterOptions.timeFrom]
   * @returns {Array}
   */
  filterTimetable(entries = [], filterOptions = {}) {
    if (!Array.isArray(entries)) return [];
    const { route, destination, timeFrom } = filterOptions;

    let result = entries;

    // Filter by route
    if (route && route !== 'all') {
      const normalizedRoute = String(route).trim();
      result = result.filter(b => {
        const line = b.line || b['odpt:busroute'] || '';
        return line.includes(normalizedRoute);
      });
    }

    // Filter by destination
    if (destination && destination !== 'all') {
      const normalizedDest = String(destination).trim();
      result = result.filter(b => {
        const dest = b.destination || b['odpt:destinationBusstopPole'] || '';
        return dest.includes(normalizedDest);
      });
    }

    // Filter by timeFrom
    if (timeFrom !== undefined && timeFrom !== null) {
      const fromMin = typeof timeFrom === 'number' ? timeFrom : this.timeStringToMinutes(timeFrom);
      result = result.filter(b => {
        const depMin = this.timeStringToMinutes(b.departureTime || b['odpt:departureTime']);
        return depMin >= fromMin;
      });
    }

    return result;
  }

  /**
   * Returns the next N departures starting at or after currentTime.
   * @param {Array} timetable
   * @param {Date} [currentTime=new Date()]
   * @param {number} [count=5]
   * @returns {Array}
   */
  getNextDepartures(timetable = [], currentTime = new Date(), count = 5) {
    if (!Array.isArray(timetable) || timetable.length === 0) return [];
    if (!(currentTime instanceof Date) || isNaN(currentTime.getTime())) {
      currentTime = new Date();
    }

    const curMin = currentTime.getHours() * 60 + currentTime.getMinutes();
    const curSec = currentTime.getSeconds();
    const curTotalSec = curMin * 60 + curSec;

    // Sort by departure time (with midnight rollover awareness)
    const sorted = [...timetable].sort((a, b) => {
      let aMin = this.timeStringToMinutes(a.actualDepartureTime || a.departureTime);
      let bMin = this.timeStringToMinutes(b.actualDepartureTime || b.departureTime);
      if (curMin >= 22 * 60) {
        if (aMin < 4 * 60) aMin += 1440;
        if (bMin < 4 * 60) bMin += 1440;
      }
      return aMin - bMin;
    });

    const results = [];
    for (const item of sorted) {
      const depMin = this.timeStringToMinutes(item.actualDepartureTime || item.departureTime);
      let depSec = depMin * 60;
      let diffSec = depSec - curTotalSec;

      // Handle midnight rollover
      if (curMin >= 22 * 60 && depMin < 4 * 60) {
        diffSec += 86400;
      } else if (curMin < 4 * 60 && depMin >= 22 * 60) {
        diffSec -= 86400;
      }

      const diffMin = Math.floor(diffSec / 60);

      // Exclude departures older than 2 minutes in the past, UNLESS the bus is currently approaching, at stop, or actively en route to this stop
      const isBusStillActive = item.locationStatus && (
        item.locationStatus.status === 'at_stop' ||
        item.locationStatus.status === 'approaching' ||
        (item.locationStatus.status === 'en_route' && typeof item.locationStatus.stopsAway === 'number' && item.locationStatus.stopsAway <= 3)
      );

      if (diffSec < -120 && !isBusStillActive) continue;
      // Even if active, drop ancient ghost trips older than 15 minutes
      if (diffSec < -900) continue;

      const countdown = this.formatCountdown(diffMin, diffSec, item.locationStatus);
      results.push({
        ...item,
        diffMinutes: diffMin,
        diffSeconds: diffSec,
        countdownText: countdown.text,
        countdownStatus: countdown.status,
        badgeClass: countdown.badgeClass
      });

      if (results.length >= count) break;
    }

    return results;
  }

  /**
   * Merges real-time delay data from ODPT odpt:Bus into timetable entries,
   * calculating relative stop position, timeline nodes, and delay status via busLocationService.
   * 
   * @param {Array} timetableEntries
   * @param {Array} realtimeBuses
   * @param {string} [targetPoleId=null] 目的停留所ポールIDまたは停留所名
   * @param {string} [routePatternId=null] 運行経路パターンID
   * @returns {Array}
   */
  mergeRealtimeDelays(timetableEntries = [], realtimeBuses = [], targetPoleId = null, routePatternId = null) {
    if (!Array.isArray(timetableEntries)) return [];

    if (!Array.isArray(realtimeBuses) || realtimeBuses.length === 0) {
      return timetableEntries.map(e => {
        const pole = targetPoleId || e.targetPoleId || e.poleId || e.fromPole || e.destination || '';
        const pattern = routePatternId || e.routePatternId || e.line || '';
        const locationStatus = busLocationService.getBusLocationStatus(null, pole, pattern, { direction: e.direction, destination: e.destination });
        return {
          ...e,
          delayMinutes: e.delayMinutes || 0,
          delaySeconds: e.delaySeconds || 0,
          actualDepartureTime: e.actualDepartureTime || e.departureTime,
          estimatedDepartureTime: e.estimatedDepartureTime || e.departureTime,
          locationStatus
        };
      });
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const matchedLiveBuses = new Set();
    const entryMatches = new Map(); // entryIndex -> liveBus

    // Pass 1: Direct ID matching (timetable ID, trip ID, or vehicle number)
    timetableEntries.forEach((entry, idx) => {
      if (!entry) return;
      for (const b of realtimeBuses) {
        if (!b || matchedLiveBuses.has(b)) continue;

        const id = b['@id'] || '';
        const sameAs = b['owl:sameAs'] || '';
        const busTimetable = b['odpt:busTimetable'] || '';

        let isMatch = false;
        if (entry.busId) {
          if (id === entry.busId || sameAs === entry.busId || busTimetable === entry.busId) {
            isMatch = true;
          } else if (id.includes(entry.busId) || sameAs.includes(entry.busId) || busTimetable.includes(entry.busId)) {
            isMatch = true;
          } else {
            const idParts = entry.busId.split('-');
            const busNum = idParts[idParts.length - 1];
            if (busNum && busNum.length >= 3 && /^[0-9]+$/.test(busNum)) {
              if (id.includes(busNum) || sameAs.includes(busNum)) {
                isMatch = true;
              }
            }
          }
        }

        if (!isMatch && entry.id && (id === entry.id || sameAs === entry.id)) {
          isMatch = true;
        }

        if (isMatch) {
          entryMatches.set(idx, b);
          matchedLiveBuses.add(b);
          break;
        }
      }
    });

    // Pass 2: Proximity / Route matching for remaining generic live buses
    for (const b of realtimeBuses) {
      if (matchedLiveBuses.has(b)) continue;

      const id = b['@id'] || '';
      const sameAs = b['owl:sameAs'] || '';
      const routeStr = b['odpt:busroute'] || b['odpt:busroutePattern'] || sameAs || id;

      // If the live bus contains a specific trip pattern (e.g. -out-0, -in-1) that didn't match in Pass 1,
      // do not broadcast it to other unrelated timetable entries.
      const hasSpecificTripId = /-(?:out|in)-\d+/i.test(id) || /-(?:out|in)-\d+/i.test(sameAs);
      if (hasSpecificTripId) continue;

      // Extract line number
      const routeLineMatch = routeStr.match(/\.(\d{2,3})(?:\.|$)/) || routeStr.match(/(\d{2,3})系統/) || routeStr.match(/(\d{2,3})/);
      const liveLineNum = routeLineMatch ? routeLineMatch[1] : null;
      if (!liveLineNum) continue;

      let bestEntryIdx = -1;
      let minTimeDiff = Infinity;

      // Calculate bus location status against target pole
      const defaultTargetPole = targetPoleId || '';

      timetableEntries.forEach((entry, idx) => {
        if (!entry || entryMatches.has(idx)) return;
        const entryLine = entry.line || entry['odpt:busroute'] || '';
        const entryLineNum = entryLine.replace(/[^0-9]/g, '');
        if (entryLineNum !== liveLineNum) return;

        // Direction / destination check if available
        const rawEntryDest = entry.destination || entry['odpt:destinationBusstopPole'] || '';
        const rawBusDest = b['odpt:destinationBusstopPole'] || b['odpt:terminalBusstopPole'] || '';
        if (rawEntryDest && rawBusDest) {
          const entryDestName = busLocationService.getStopName(rawEntryDest);
          const busDestName = busLocationService.getStopName(rawBusDest);

          const matches = (
            (busDestName && entryDestName && (busDestName.includes(entryDestName) || entryDestName.includes(busDestName))) ||
            rawBusDest.includes(rawEntryDest) ||
            rawEntryDest.includes(rawBusDest)
          );

          if (!matches) {
            return;
          }
        }

        const pole = defaultTargetPole || entry.targetPoleId || entry.poleId || entry.fromPole || '';
        const pattern = routePatternId || entry.routePatternId || entry.line || b['odpt:busroutePattern'] || '';
        const locStatus = busLocationService.getBusLocationStatus(
          b,
          pole,
          pattern,
          { direction: entry.direction, destination: entry.destination }
        );

        // Do not match buses that have already passed this stop to future departure entries
        if (locStatus.status === 'passed') {
          return;
        }

        if (entry.departureTime) {
          const entryMin = this.timeStringToMinutes(entry.departureTime);

          // Estimate arrival minutes based on stopsAway (approx 1.5 - 2 min per stop) and delay
          let estimatedArrival = nowMin;
          if (locStatus.status === 'at_stop') {
            estimatedArrival = nowMin;
          } else if (locStatus.status === 'approaching') {
            estimatedArrival = nowMin + 2;
          } else if (typeof locStatus.stopsAway === 'number') {
            estimatedArrival = nowMin + Math.max(1, Math.round(locStatus.stopsAway * 2)) + (locStatus.delayMinutes || 0);
          }

          // Match closeness between timetable departure time and estimated arrival time
          const diff = Math.abs(entryMin - estimatedArrival);
          if (diff < minTimeDiff && diff <= 35) { // within 35 minutes tolerance
            minTimeDiff = diff;
            bestEntryIdx = idx;
          }
        } else if (bestEntryIdx === -1) {
          bestEntryIdx = idx;
        }
      });

      if (bestEntryIdx !== -1) {
        entryMatches.set(bestEntryIdx, b);
        matchedLiveBuses.add(b);
      }
    }

    return timetableEntries.map((entry, idx) => {
      const matchedBus = entryMatches.get(idx) || null;

      let delaySeconds = (matchedBus && typeof matchedBus['odpt:delay'] === 'number')
        ? matchedBus['odpt:delay']
        : (entry.delaySeconds || 0);

      let delayMinutes = Math.round(delaySeconds / 60);
      const schedMin = this.timeStringToMinutes(entry.departureTime);

      const pole = targetPoleId || entry.targetPoleId || entry.poleId || entry.fromPole || entry.destination || '';
      const pattern = routePatternId || entry.routePatternId || entry.line || (matchedBus ? matchedBus['odpt:busroutePattern'] : '');

      const locationStatus = busLocationService.getBusLocationStatus(
        matchedBus,
        pole,
        pattern,
        { direction: entry.direction, destination: entry.destination }
      );

      // バスがまだ手前（en_route / approaching / at_stop）にいる場合、
      // かつ、所定発車時刻が現在時刻の近傍（±35分以内）である場合に限り、
      // 手前停留所数に基づく推定所要時間（1駅約1.5〜2分）から推定到着時刻を算出。
      // 所定時刻を経過している場合、実質遅延（effectiveDelayMinutes）を自動加算。
      const isNearCurrentTime = Math.abs(schedMin - nowMin) <= 35;
      if (isNearCurrentTime && locationStatus && (locationStatus.status === 'at_stop' || locationStatus.status === 'approaching' || locationStatus.status === 'en_route')) {
        let estimatedArrival = nowMin;
        if (locationStatus.status === 'at_stop') {
          estimatedArrival = nowMin;
        } else if (locationStatus.status === 'approaching' || locationStatus.stopsAway === 1) {
          estimatedArrival = nowMin + 1;
        } else if (typeof locationStatus.stopsAway === 'number' && locationStatus.stopsAway >= 2) {
          estimatedArrival = nowMin + Math.max(1, Math.round(locationStatus.stopsAway * 2));
        }

        // 所定発車時刻よりも推定到着時刻が遅い場合、実質遅延として反映
        if (estimatedArrival > schedMin) {
          const estimatedDelay = estimatedArrival - schedMin;
          if (estimatedDelay > delayMinutes && estimatedDelay <= 30) {
            delayMinutes = estimatedDelay;
            delaySeconds = estimatedDelay * 60;
            // locationStatus 側の遅延表記も同期
            locationStatus.delayMinutes = delayMinutes;
            locationStatus.delayText = `+${delayMinutes}分遅れ`;
          }
        }
      }

      const actualMin = schedMin + delayMinutes;
      const actualDepTime = this.minutesToTimeString(actualMin);

      return {
        ...entry,
        delaySeconds,
        delayMinutes,
        actualDepartureTime: actualDepTime,
        estimatedDepartureTime: actualDepTime,
        locationStatus,
        matchedBus,
        liveLocation: matchedBus ? {
          lat: matchedBus['geo:lat'],
          long: matchedBus['geo:long'],
          toStop: matchedBus['odpt:toBusstopPole']
        } : null
      };
    });
  }
}

export const timetableService = new TimetableService();
export default timetableService;
