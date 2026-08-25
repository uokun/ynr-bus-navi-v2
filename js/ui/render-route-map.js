/**
 * render-route-map.js
 * 
 * JR東日本アプリ「列車走行位置」風 上下線複線リアルタイム走行位置マップ UIレンダラー
 * 系統切替 (111系統 / 133系統)、上り・下り複線縦型路線図
 */

import { escapeHtml, getRouteBadgeHtml } from './ui-helpers.js';
import { busLocationService } from '../services/bus-location-service.js';
import { stepTimelineComponent } from './step-timeline.js';

export const ROUTE_MAP_CONFIGS = {
  '111': {
    line: '111系統',
    name: '111系統 (港南台駅前 〜 洋光台北口 〜 上大岡駅前)',
    upboundDest: '上大岡駅前',
    downboundDest: '港南台駅前'
  },
  '133': {
    line: '133系統',
    name: '133系統 (根岸駅前 〜 古泉 〜 上大岡駅前)',
    upboundDest: '上大岡駅前',
    downboundDest: '根岸駅前'
  }
};

/**
 * 走行位置ビューのレンダリング (JR東日本アプリ風 上下線複線マップ)
 * @param {HTMLElement} container 
 * @param {Object} mapState { activeLine, realtimeBuses }
 */
export function renderRouteMapView(container, mapState = {}) {
  if (!container) return;

  const {
    activeLine = '111',
    realtimeBuses = []
  } = mapState;

  const safeLine = (activeLine === '133') ? '133' : '111';
  const cfg = ROUTE_MAP_CONFIGS[safeLine] || ROUTE_MAP_CONFIGS['111'];

  // 1. 系統選択タブ (111系統 / 133系統)
  const lineTabsHtml = Object.keys(ROUTE_MAP_CONFIGS).map(key => {
    const isActive = (key === safeLine);
    const item = ROUTE_MAP_CONFIGS[key];
    return `
      <button class="map-line-tab ${isActive ? 'active' : ''}" data-line="${key}">
        ${escapeHtml(item.line)}
      </button>
    `;
  }).join('');

  // 2. 上下線複線マップデータの生成
  const doubleTrackData = busLocationService.getDoubleTrackRouteMap(realtimeBuses, safeLine);
  const doubleTrackHtml = stepTimelineComponent.renderDoubleTrackRouteMap(doubleTrackData);

  const totalBuses = doubleTrackData.totalBusCount || 0;

  const html = `
    <!-- Top Route Selector Header -->
    <div class="map-view-header-card">
      <div class="map-view-nav-row">
        <div class="map-line-tabs-group">
          ${lineTabsHtml}
        </div>
        <div class="map-status-pill ${totalBuses > 0 ? 'live' : 'scheduled'}">
          <span class="pulse-indicator ${totalBuses > 0 ? 'live' : 'scheduled'}"></span>
          <span>運行中 <strong>${totalBuses}台</strong></span>
        </div>
      </div>
      <div class="map-route-sub">${escapeHtml(cfg.name)}</div>
    </div>

    <!-- Double Track Route Map Container -->
    <div class="map-double-track-wrapper">
      ${doubleTrackHtml}
    </div>
  `;

  container.innerHTML = html;
}
