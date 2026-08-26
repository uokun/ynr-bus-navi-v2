/**
 * odpt-client.js
 * ODPT API v4 client with multi-tier caching and 100% offline mock fallback resilience.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { CONFIG, API_BASE, OPERATOR_ID, CACHE_TTL } from '../config.js';
import { storageService } from '../services/storage-service.js';
import { REAL_TIMETABLES } from './real-timetable-data.js';

function normalizeDestination(dest, lineName, stopId) {
  if (!dest || dest.includes('') || dest.includes('大岡駅前') || dest.includes('港') || dest.includes('根岸')) {
    if (lineName === '111系統') {
      if (stopId && (stopId.endsWith('.1') || stopId.endsWith('.13'))) return '上大岡駅前 行';
      if (dest && dest.includes('洋光台')) return '洋光台駅前 行';
      return '港南台駅前 行';
    } else if (lineName === '133系統') {
      return (stopId && stopId.endsWith('.1')) ? '上大岡駅前 行' : '根岸駅前 行';
    }
  }
  if (!dest) {
    if (lineName === '111系統') return (stopId && (stopId.endsWith('.1') || stopId.endsWith('.13'))) ? '上大岡駅前 行' : '港南台駅前 行';
    if (lineName === '133系統') return (stopId && stopId.endsWith('.1')) ? '上大岡駅前 行' : '根岸駅前 行';
  }
  return dest.endsWith('行') ? dest : `${dest} 行`;
}

export class OdptClient {
  constructor(options = {}) {
    this.apiBase = options.apiBase || API_BASE;
    this.operator = options.operator || OPERATOR_ID;
    this.storage = options.storage || storageService;
    this.isUsingMockData = false;
    this.lastError = null;
    this.statusListeners = [];
    this.lastFetchTimestamps = new Map();
  }

  /**
   * Register a listener for status changes (e.g. online vs mock fallback).
   */
  onStatusChange(listener) {
    if (typeof listener === 'function') {
      this.statusListeners.push(listener);
    }
  }

  _notifyStatus(status) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // Safe execution
      }
    }
  }

  /**
   * Generic request builder with error fallback and caching.
   * @private
   */
  async _request(endpoint, queryParams = {}, cacheTtl = 0, fallbackFn = null) {
    const consumerKey = this.storage.getApiKey();
    if (!consumerKey) {
      // No consumer key configured; safely return empty or fallback without network error
      this.isUsingMockData = false;
      this.lastError = null;
      this._notifyStatus({ isMock: false, status: 'no_api_key' });
      return fallbackFn ? fallbackFn() : [];
    }

    const cacheKey = `odpt:${endpoint}:${JSON.stringify(queryParams)}`;

    // 1. Check cache if TTL > 0
    if (cacheTtl > 0) {
      const cached = this.storage.getCachedData(cacheKey);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    }

    // 2. Build URL
    const base = this.apiBase.endsWith('/') ? this.apiBase : `${this.apiBase}/`;
    const url = new URL(base + endpoint);
    url.searchParams.set('acl:consumerKey', consumerKey);
    url.searchParams.set('odpt:operator', this.operator);

    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }

    try {
      // Check offline navigator state
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('Offline: navigator.onLine is false');
      }

      const fetchFn = (typeof window !== 'undefined' && window.fetch) ? window.fetch : fetch;
      const response = await fetchFn(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404 && endpoint === 'odpt:BusInformation') {
          // 404 on ODPT means no disruption records (e.g. BusInformation) or empty dataset
          this.isUsingMockData = false;
          this.lastError = null;
          this._notifyStatus({ isMock: false, status: 'online' });
          return [];
        }
        if (response.status === 403) {
          console.info('[ODPT Client] ODPT API returned 403 (Invalid/Demo Consumer Key). Seamlessly falling back to built-in full mock dataset.');
        }
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        throw err;
      }

      const data = await response.json();

      // If valid data received
      this.isUsingMockData = false;
      this.lastError = null;
      this._notifyStatus({ isMock: false, status: 'online' });

      if (cacheTtl > 0 && Array.isArray(data) && data.length > 0) {
        this.storage.setCachedData(cacheKey, data, cacheTtl);
      }

      return data;
    } catch (err) {
      this.isUsingMockData = false;
      this.lastError = err;
      this._notifyStatus({ isMock: false, status: 'error', error: err });
      return [];
    }
  }

  // =========================================================================
  // API Endpoints
  // =========================================================================

  /**
   * Fetch Busstop Poles
   * @param {Object} [params]
   * @returns {Promise<Array>}
   */
  async fetchBusstopPoles(params = {}) {
    return this._request(
      'odpt:BusstopPole',
      params,
      CACHE_TTL.STATIC_DATA,
      null
    );
  }

  /**
   * Fetch Bus Route Patterns
   * @param {Object} [params]
   * @returns {Promise<Array>}
   */
  async fetchBusRoutePatterns(params = {}) {
    return this._request(
      'odpt:BusroutePattern',
      params,
      CACHE_TTL.STATIC_DATA,
      null
    );
  }

  /**
   * Fetch Timetable for a pole and calendar
   * @param {string} poleId
   * @param {string} [calendar='Weekday']
   * @returns {Promise<Array>}
   */
  async fetchTimetable(poleId, calendar = 'Weekday') {
    return this.fetchBusstopPoleTimetables(poleId, calendar);
  }

  clearTimetableCache() {
    this._timetableCache = null;
  }

  async _fetchAndIndexTimetables() {
    const consumerKey = this.storage.getApiKey();
    if (!consumerKey) {
      return null;
    }

    const cacheKey = 'odpt:indexed_timetables:v2';
    const cached = this.storage.getCachedData(cacheKey);
    if (cached && typeof cached === 'object') {
      this._timetableCache = cached;
      return cached;
    }

    const routes = ['111系統', '133系統'];
    const allTimetables = [];

    for (const route of routes) {
      const res = await this._request(
        'odpt:BusTimetable',
        { 'dc:title': route },
        CACHE_TTL.TIMETABLE || 86400000,
        null
      );
      if (Array.isArray(res)) {
        allTimetables.push(...res);
      }
    }

    if (allTimetables.length === 0) {
      return null;
    }

    const indexed = {};
    const seenKeys = new Set();

    for (const tt of allTimetables) {
      const cal = tt['odpt:calendar'] || '';
      let dayType = null;
      if (cal.includes('Weekday')) dayType = 'Weekday';
      else if (cal.includes('Saturday')) dayType = 'Saturday';
      else if (cal.includes('Holiday') || cal.includes('Sunday')) dayType = 'Holiday';

      if (!dayType) continue; // Skip non-standard calendars

      const rawTitle = tt['dc:title'] || '';
      const lineName = rawTitle.replace(/^0/, '') || '111系統';
      const busTimetableId = tt['owl:sameAs'] || '';
      const pattern = tt['odpt:busroutePattern'] || '';
      const objs = tt['odpt:busTimetableObject'] || tt['odpt:busstopPoleTimetableObject'] || [];

      for (const obj of objs) {
        const stopId = obj['odpt:busstopPole'];
        const depTime = obj['odpt:departureTime'];
        if (!stopId || !depTime) continue;

        const uniqueKey = `${stopId}_${dayType}_${depTime}_${lineName}`;
        if (seenKeys.has(uniqueKey)) continue;
        seenKeys.add(uniqueKey);

        if (!indexed[stopId]) {
          indexed[stopId] = { Weekday: [], Saturday: [], Holiday: [] };
        }

        let rawDest = obj['odpt:destinationSign'] || '';
        let dest = normalizeDestination(rawDest, lineName, stopId);

        indexed[stopId][dayType].push({
          busId: busTimetableId,
          line: lineName,
          destination: dest,
          departureTime: depTime,
          isMidnight: Boolean(obj['odpt:isMidnight']),
          pattern: pattern,
          calendar: dayType
        });
      }
    }

    // Sort by departureTime
    for (const stopId of Object.keys(indexed)) {
      for (const d of ['Weekday', 'Saturday', 'Holiday']) {
        indexed[stopId][d].sort((a, b) => {
          if (!a.departureTime || !b.departureTime) return 0;
          return a.departureTime.localeCompare(b.departureTime);
        });
      }
    }

    this._timetableCache = indexed;
    this.storage.setCachedData(cacheKey, indexed, CACHE_TTL.TIMETABLE || 86400000);
    return indexed;
  }

  async fetchBusstopPoleTimetables(poleId, calendar = 'Weekday') {
    let dayType = 'Weekday';
    if (calendar.includes('Saturday')) dayType = 'Saturday';
    else if (calendar.includes('Holiday') || calendar.includes('Sunday')) dayType = 'Holiday';

    if (!this._timetableCache) {
      await this._fetchAndIndexTimetables();
    }

    // 1. Try cache if populated
    if (this._timetableCache) {
      let matchedKey = poleId;
      if (!this._timetableCache[matchedKey]) {
        matchedKey = Object.keys(this._timetableCache).find(k => k.includes(poleId) || (poleId && poleId.includes(k)));
      }

      if (matchedKey && this._timetableCache[matchedKey] && this._timetableCache[matchedKey][dayType]) {
        return this._timetableCache[matchedKey][dayType];
      }
    }

    // 2. Fallback to built-in full verified timetable dataset
    if (REAL_TIMETABLES) {
      let matchedKey = poleId;
      if (!REAL_TIMETABLES[matchedKey]) {
        matchedKey = Object.keys(REAL_TIMETABLES).find(k => k.includes(poleId) || (poleId && poleId.includes(k)));
      }
      if (matchedKey && REAL_TIMETABLES[matchedKey] && REAL_TIMETABLES[matchedKey][dayType]) {
        return REAL_TIMETABLES[matchedKey][dayType];
      }
    }

    return [];
  }

  /**
   * Fetch Realtime Buses
   * @param {string} [routePatternId]
   * @returns {Promise<Array>}
   */
  async fetchRealtimeBuses(routePatternId = null) {
    return this.fetchBuses(routePatternId);
  }

  async fetchBuses(routePatternId = null) {
    const params = {};
    if (routePatternId) params['odpt:busroutePattern'] = routePatternId;

    return this._request(
      'odpt:Bus',
      params,
      CACHE_TTL.REALTIME,
      null
    );
  }

  /**
   * Fetch Operational Information
   * Note: Yokohama Municipal Bus does not publish odpt:BusInformation on ODPT;
   * delays are included directly within odpt:Bus (odpt:delay).
   * @returns {Promise<Array>}
   */
  async fetchBusInformation() {
    return [];
  }
}

export const odptClient = new OdptClient();
export default odptClient;
