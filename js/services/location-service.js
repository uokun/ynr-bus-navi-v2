/**
 * location-service.js
 * Geolocation API wrapper & Nearest Stop calculation engine.
 * Yokohama Municipal Bus Transit Guide & Real-Time Operation Web App
 */

import { STOPS } from '../config.js';

export class LocationService {
  constructor() {
    this.cachedPosition = null;
    this.lastFetchedTime = 0;
    this.CACHE_DURATION_MS = 60000; // 1分間キャッシュ
  }

  /**
   * 2点間の距離を算出 (Haversine formula, メートル単位)
   * @param {number} lat1 
   * @param {number} lon1 
   * @param {number} lat2 
   * @param {number} lon2 
   * @returns {number} 距離 (m)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') {
      return Infinity;
    }
    const R = 6371000; // 地球の半径 (m)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 現在位置（緯度・経度）を取得
   * @param {Object} [options]
   * @returns {Promise<{ latitude: number, longitude: number, accuracy?: number } | null>}
   */
  async getCurrentPosition(options = { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    const now = Date.now();
    if (this.cachedPosition && (now - this.lastFetchedTime < this.CACHE_DURATION_MS)) {
      return this.cachedPosition;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!pos || !pos.coords) {
            resolve(null);
            return;
          }
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          this.cachedPosition = coords;
          this.lastFetchedTime = Date.now();
          resolve(coords);
        },
        (err) => {
          // Geolocation error or denied (silent fallback)
          resolve(null);
        },
        options
      );
    });
  }

  /**
   * 最も近い停留所キー ('yokodai' | 'kamiooka' | 'koizumi') を判定
   * @param {{ latitude: number, longitude: number }} [coords]
   * @returns {{ stopKey: 'yokodai' | 'kamiooka' | 'koizumi', distance: number, allDistances: Object }}
   */
  getNearestStop(coords) {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      return { stopKey: 'yokodai', distance: 0, allDistances: {} };
    }

    const targetStops = [
      { key: 'yokodai', name: STOPS.YOKODAI.name, lat: STOPS.YOKODAI.lat, lon: STOPS.YOKODAI.long },
      { key: 'kamiooka', name: STOPS.KAMIOOKA.name, lat: STOPS.KAMIOOKA.lat, lon: STOPS.KAMIOOKA.long },
      { key: 'koizumi', name: STOPS.KOIZUMI.name, lat: STOPS.KOIZUMI.lat, lon: STOPS.KOIZUMI.long }
    ];

    let minDistance = Infinity;
    let nearestKey = 'yokodai';
    const allDistances = {};

    for (const stop of targetStops) {
      const dist = this.calculateDistance(coords.latitude, coords.longitude, stop.lat, stop.lon);
      allDistances[stop.key] = Math.round(dist);
      if (dist < minDistance) {
        minDistance = dist;
        nearestKey = stop.key;
      }
    }

    return {
      stopKey: nearestKey,
      distance: Math.round(minDistance),
      allDistances
    };
  }

  /**
   * 現在地から最適な初期ナビゲーション（タブ・方向・停留所）を判定
   * - 洋光台北口が近い -> direction: 'outbound', activeStopKey: 'yokodai', targetTab: 'view-transfer'
   * - 古泉が近い -> direction: 'inbound', activeStopKey: 'koizumi', targetTab: 'view-transfer'
   * - 上大岡駅前が近い -> activeStopKey: 'kamiooka', targetTab: 'view-stops' (乗り換えではなく停留所の上大岡駅前を自動選択)
   * @returns {Promise<Object|null>}
   */
  async determineInitialNavigation() {
    const coords = await this.getCurrentPosition();
    if (!coords) {
      return null;
    }

    const { stopKey, distance, allDistances } = this.getNearestStop(coords);

    if (stopKey === 'kamiooka') {
      return {
        nearestStopKey: 'kamiooka',
        targetTab: 'view-stops',
        activeStopKey: 'kamiooka',
        direction: 'outbound',
        distance,
        allDistances
      };
    } else if (stopKey === 'koizumi') {
      return {
        nearestStopKey: 'koizumi',
        targetTab: 'view-transfer',
        activeStopKey: 'koizumi',
        direction: 'inbound',
        distance,
        allDistances
      };
    } else {
      // yokodai
      return {
        nearestStopKey: 'yokodai',
        targetTab: 'view-transfer',
        activeStopKey: 'yokodai',
        direction: 'outbound',
        distance,
        allDistances
      };
    }
  }
}

export const locationService = new LocationService();
export default locationService;
