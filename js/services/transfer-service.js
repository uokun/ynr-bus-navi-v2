/**
 * transfer-service.js
 * Core transfer calculation engine for Yokohama Municipal Bus navigation.
 * Computes optimal connections, transfer buffers, wait times, and alternative options.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { STOPS, ROUTES, DEFAULT_TRANSFER_BUFFER_MINUTES } from '../config.js';
import { timetableService } from './timetable-service.js';

export class TransferService {
  constructor(timetableSvc = null) {
    this.timetableService = timetableSvc || timetableService;
  }

  /**
   * Returns bidirectional route configurations (outbound & inbound).
   * @returns {{ outbound: Object, inbound: Object }}
   */
  getBidirectionalRoutes() {
    return {
      outbound: {
        id: 'outbound',
        name: '洋光台北口 ➔ 古泉 (上大岡経由)',
        label: '洋光台北口 → 上大岡 → 古泉',
        origin: STOPS.YOKODAI,
        via: STOPS.KAMIOOKA,
        destination: STOPS.KOIZUMI,
        leg1: {
          line: '111系統',
          routeId: ROUTES.ROUTE_111.id,
          patternId: ROUTES.ROUTE_111.patternOutbound,
          from: '洋光台北口',
          to: '上大岡駅前',
          destinationLabel: '上大岡駅前 行',
          durationMinutes: 15,
          platform: '1番のりば'
        },
        leg2: {
          line: '133系統',
          routeId: ROUTES.ROUTE_133.id,
          patternId: ROUTES.ROUTE_133.patternOutbound,
          from: '上大岡駅前',
          to: '古泉',
          destinationLabel: '根岸駅前 行 (古泉経由)',
          durationMinutes: 12,
          platform: '12番のりば'
        }
      },
      inbound: {
        id: 'inbound',
        name: '古泉 ➔ 洋光台北口 (上大岡経由)',
        label: '古泉 → 上大岡 → 洋光台北口',
        origin: STOPS.KOIZUMI,
        via: STOPS.KAMIOOKA,
        destination: STOPS.YOKODAI,
        leg1: {
          line: '133系統',
          routeId: ROUTES.ROUTE_133.id,
          patternId: ROUTES.ROUTE_133.patternInbound,
          from: '古泉',
          to: '上大岡駅前',
          destinationLabel: '上大岡駅前 行',
          durationMinutes: 12,
          platform: '1番のりば'
        },
        leg2: {
          line: '111系統',
          routeId: ROUTES.ROUTE_111.id,
          patternId: ROUTES.ROUTE_111.patternInbound,
          from: '上大岡駅前',
          to: '洋光台北口',
          destinationLabel: '港南台駅前 行 (洋光台北口経由)',
          durationMinutes: 15,
          platform: '11番のりば'
        }
      }
    };
  }

  /**
   * Calculates optimal transfer connection and subsequent alternative options.
   * @param {Object} options
   * @param {Array} [options.leg1Timetable=[]]
   * @param {Array} [options.leg2Timetable=[]]
   * @param {'outbound'|'inbound'} [options.direction='outbound']
   * @param {number} [options.bufferMinutes=0]
   * @param {Object} [options.realtimeDelays={}]
   * @param {Date} [options.currentTime=new Date()]
   * @returns {{ recommended: Object|null, alternatives: Array, status: string }}
   */
  calculateTransferRoute(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const {
      leg1Timetable = [],
      leg2Timetable = [],
      direction = 'outbound',
      bufferMinutes = DEFAULT_TRANSFER_BUFFER_MINUTES,
      realtimeDelays = {},
      currentTime = new Date()
    } = opts;

    const l1Table = Array.isArray(leg1Timetable) ? leg1Timetable : [];
    const l2Table = Array.isArray(leg2Timetable) ? leg2Timetable : [];
    const delays = (realtimeDelays && typeof realtimeDelays === 'object') ? realtimeDelays : {};

    // 1. Sanitize buffer minutes (default to 0 min direct transfer)
    let buffer = typeof bufferMinutes === 'number' && !isNaN(bufferMinutes)
      ? Math.max(0, bufferMinutes)
      : DEFAULT_TRANSFER_BUFFER_MINUTES;

    let cTime = currentTime;
    if (!(cTime instanceof Date) || isNaN(cTime.getTime())) {
      cTime = new Date();
    }

    const curMinutes = cTime.getHours() * 60 + cTime.getMinutes();

    // Standard durations:
    // Outbound: Leg 1 (Yokodai->Kamiooka) = 15m, Leg 2 (Kamiooka->Koizumi) = 12m
    // Inbound:  Leg 1 (Koizumi->Kamiooka) = 12m, Leg 2 (Kamiooka->Yokodai) = 15m
    const leg1TravelTime = direction === 'outbound' ? 15 : 12;
    const leg2TravelTime = direction === 'outbound' ? 12 : 15;

    const validOptions = [];

    for (const b1 of l1Table) {
      if (!b1 || b1.isCancelled) continue;

      const dep1Min = this.timetableService.timeStringToMinutes(b1.departureTime);
      const delay1 = delays[b1.busId] || delays[b1.line] || b1.delayMinutes || 0;
      const actualDep1 = dep1Min + delay1;

      // Must be future departure or departing now
      if (actualDep1 < curMinutes) continue;

      const arr1Min = actualDep1 + leg1TravelTime;
      const minConnectingTime = arr1Min + buffer;

      // Find suitable Leg 2 departures
      for (const b2 of l2Table) {
        if (!b2 || b2.isCancelled) continue;

        const dep2Min = this.timetableService.timeStringToMinutes(b2.departureTime);
        const delay2 = delays[b2.busId] || delays[b2.line] || b2.delayMinutes || 0;
        const actualDep2 = dep2Min + delay2;

        if (actualDep2 >= minConnectingTime) {
          const waitMinutes = actualDep2 - arr1Min;
          const arr2Min = actualDep2 + leg2TravelTime;

          validOptions.push({
            leg1: {
              ...b1,
              actualDepartureTime: this.timetableService.minutesToTimeString(actualDep1),
              estimatedArrivalTime: this.timetableService.minutesToTimeString(arr1Min),
              delayMinutes: delay1
            },
            leg2: {
              ...b2,
              actualDepartureTime: this.timetableService.minutesToTimeString(actualDep2),
              estimatedArrivalTime: this.timetableService.minutesToTimeString(arr2Min),
              delayMinutes: delay2
            },
            transferWaitMinutes: waitMinutes,
            bufferMinutes: buffer,
            totalDurationMinutes: arr2Min - actualDep1
          });
          break; // Found the best match for this Leg 1 bus
        }
      }
    }

    if (validOptions.length === 0) {
      return {
        recommended: null,
        alternatives: [],
        status: 'no_buses_available'
      };
    }

    return {
      recommended: validOptions[0],
      alternatives: validOptions.slice(1, 4),
      status: 'ok'
    };
  }

  /**
   * Finds next connection candidates for transfer.
   * @param {Object} [options={}]
   * @returns {Array}
   */
  findNextConnections(options = {}) {
    const res = this.calculateTransferRoute(options);
    if (!res || res.status !== 'ok') return [];
    return [res.recommended, ...res.alternatives].filter(Boolean);
  }

  /**
   * Alias for calculateTransferRoute
   */
  calculateTransfer(params) {
    return this.calculateTransferRoute(params);
  }
}

export const transferService = new TransferService();
export default transferService;
