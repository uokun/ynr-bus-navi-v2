/**
 * render-stop-view.js
 * 
 * 停留所発車案内ビュー (洋光台北口 / 上大岡駅前 / 古泉)
 * セグメント切替、のりばピル、先発便Heroカード、後続便リスト、全時刻表モーダル呼出
 */

import { escapeHtml, getRouteBadgeHtml } from './ui-helpers.js';
import { timetableService } from '../services/timetable-service.js';
import { busLocationService } from '../services/bus-location-service.js';
import { stepTimelineComponent } from './step-timeline.js';

export const STOP_PLATFORMS = {
  yokodai: [
    { pole: '1', label: '上大岡駅前方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1' }
  ],
  kamiooka: [
    { pole: '12', label: '古泉方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12' },
    { pole: '6', label: '洋光台方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6' }
  ],
  koizumi: [
    { pole: '1', label: '上大岡駅前方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1' }
  ]
};

export const STOP_ROUTES = {
  yokodai: ['111'],
  kamiooka: ['133', '111'],
  koizumi: ['133']
};

export const STOP_DISPLAY_NAMES = {
  yokodai: '洋光台北口',
  kamiooka: '上大岡駅前',
  koizumi: '古泉'
};

/**
 * 停留所ビュー全体のレンダリング
 * @param {HTMLElement|Object} containerOrState 
 * @param {Object} [maybeData=null]
 */
export function renderStopViews(containerOrState, maybeData = null) {
  if (typeof document === 'undefined') return;

  let container = null;
  let data = {};

  const isDomElement = (obj) => {
    return obj && (
      (typeof Element !== 'undefined' && obj instanceof Element) ||
      (typeof obj.nodeType === 'number') ||
      (typeof obj.querySelector === 'function')
    );
  };

  if (isDomElement(containerOrState)) {
    container = containerOrState;
    data = maybeData || {};
  } else {
    data = containerOrState || {};
  }

  const currentTab = data.currentTab || 'stop-yokodai';
  let activeStopKey = data.activeStopKey;
  if (!activeStopKey) {
    if (currentTab === 'stop-yokodai') activeStopKey = 'yokodai';
    else if (currentTab === 'stop-kamiooka') activeStopKey = 'kamiooka';
    else if (currentTab === 'stop-koizumi') activeStopKey = 'koizumi';
    else activeStopKey = 'yokodai';
  }

  const availableRoutes = STOP_ROUTES[activeStopKey] || ['111', '133'];
  const activePole = data.activePole || (activeStopKey === 'kamiooka' ? '12' : '1');
  let departures = data.departures;

  const filter = data.activeFilter || data.filter || (typeof window !== 'undefined' && window.app?.state?.getState().activeFilter) || 'all';

  if (!departures) {
    let ttList = [];
    if (data.timetables) {
      if (activeStopKey === 'yokodai') {
        ttList = data.timetables.line111Outbound || [];
      } else if (activeStopKey === 'kamiooka') {
        if (activePole === '6') {
          ttList = data.timetables.line111Inbound || [];
        } else {
          ttList = data.timetables.line133Outbound || [];
        }
      } else if (activeStopKey === 'koizumi') {
        ttList = data.timetables.line133Inbound || [];
      }
    }
    const filtered = timetableService.filterTimetable(ttList, { route: filter });
    const merged = timetableService.mergeRealtimeDelays(filtered, data.realtimeBuses || [], '7800.1');
    departures = timetableService.getNextDepartures(merged, new Date(), 8);
    if (!container && (!departures || departures.length === 0) && filtered.length > 0) {
      departures = filtered.slice(0, 5);
    }
  }

  departures = departures || [];

  const stopName = STOP_DISPLAY_NAMES[activeStopKey] || '洋光台北口';
  const platforms = STOP_PLATFORMS[activeStopKey] || STOP_PLATFORMS.yokodai;

  // If container is provided, render full mobile stop UI
  if (container) {
    let stopTabsHtml = Object.entries(STOP_DISPLAY_NAMES).map(([key, name]) => {
      const isActive = (key === activeStopKey);
      return `<button class="stop-tab-btn ${isActive ? 'active' : ''}" data-stop-key="${key}">${name}</button>`;
    }).join('');

    // 方面選択ピル: 選択肢が複数ある場合（上大岡駅前の「古泉方面」「洋光台方面」）のみ表示
    let platformSelectorHtml = '';
    if (platforms.length > 1) {
      let platformPillsHtml = platforms.map(p => {
        const isActive = (String(p.pole) === String(activePole));
        return `<button class="pole-pill-btn ${isActive ? 'active' : ''}" data-pole="${p.pole}">${escapeHtml(p.label)}</button>`;
      }).join('');
      platformSelectorHtml = `
        <div class="platform-selector-scroll">
          ${platformPillsHtml}
        </div>
      `;
    }

    const firstDep = departures[0];
    let firstHeroHtml = '';
    let firstTimelineHtml = '';

    // 手前5停留所の横並び接近プログレスバー (洋光台北口 / 古泉) または始発案内 (上大岡駅前)
    const approachingData = busLocationService.get5StopApproachingStatus(data.realtimeBuses || [], activeStopKey);
    const approachingProgressBarHtml = stepTimelineComponent.renderHorizontal5StopProgressBar(approachingData);

    if (firstDep) {
      const isDelay = firstDep.delayMinutes > 0;
      const delayBadgeClass = isDelay ? 'delay-some' : 'delay-none';
      const delayBadgeText = isDelay ? `+${firstDep.delayMinutes}分` : '定刻';
      const actualDepTime = firstDep.actualDepartureTime || firstDep.departureTime;

      firstHeroHtml = `
        <div class="card stop-hero-card departure-item" data-dep-time="${escapeHtml(actualDepTime)}">
          <div class="hero-top-row">
            <span class="hero-label">先発便</span>
            <span class="delay-badge ${escapeHtml(delayBadgeClass)}">${escapeHtml(delayBadgeText)}</span>
          </div>

          <div class="hero-time-dest-row">
            <div class="hero-time-group">
              <span class="hero-dep-time">${escapeHtml(firstDep.departureTime)}</span>
              ${firstDep.countdownText ? `<span class="hero-countdown-val countdown-val">${escapeHtml(firstDep.countdownText)}</span>` : ''}
            </div>
            <div class="hero-route-group">
              ${getRouteBadgeHtml(firstDep.line)}
              <span class="hero-destination">${escapeHtml(firstDep.destination || '上大岡駅前 行')}</span>
            </div>
          </div>
        </div>
      `;

      firstTimelineHtml = approachingProgressBarHtml;
    } else {
      firstHeroHtml = `
        <div class="card empty-stop-card" style="padding:20px 16px; text-align:center;">
          <p class="empty-title" style="font-weight:800; margin-bottom:4px;">発車予定便を取得できませんでした</p>
          <p class="empty-sub" style="font-size:0.8rem; color:var(--text-sub);">ODPT APIキーが未設定か、運行データが存在しません。</p>
          <button class="btn-primary-large" onclick="if(window.app) window.app.switchTab('view-settings');" style="margin-top:12px; max-width:200px; margin-left:auto; margin-right:auto; padding:8px 14px; font-size:0.82rem;">
            設定画面を開く
          </button>
        </div>
      `;
    }

    let html = `
      <div class="stop-view-segmented-tabs">
        ${stopTabsHtml}
      </div>

      ${platformSelectorHtml}

      <div class="stop-hero-section">
        ${firstHeroHtml}
        ${firstTimelineHtml}
      </div>
    `;

    if (departures.length > 1) {
      const subsequent = departures.slice(1);
      let subItemsHtml = subsequent.map((dep, idx) => {
        const delayCls = dep.delayMinutes > 0 ? 'delay-some' : 'delay-none';
        const delayTxt = dep.delayMinutes > 0 ? `+${dep.delayMinutes}分` : '定刻';
        const actualDep = dep.actualDepartureTime || dep.departureTime;
        const timelineHtml = stepTimelineComponent.render(dep.locationStatus, { showScheduled: false });

        return `
          <div class="sub-departure-item departure-item" data-dep-time="${escapeHtml(actualDep)}">
            <div class="sub-dep-header">
              <div class="sub-dep-left">
                <span class="sub-dep-time">${escapeHtml(dep.departureTime)}</span>
              </div>
              <div class="sub-dep-right">
                ${dep.countdownText ? `<span class="dep-countdown">${escapeHtml(dep.countdownText)}</span>` : ''}
                <span class="delay-badge ${escapeHtml(delayCls)}">${escapeHtml(delayTxt)}</span>
              </div>
            </div>
            ${timelineHtml}
          </div>
        `;
      }).join('');

      html += `
        <div class="card upcoming-departures-card">
          <div class="card-section-title">
            <span>後続便一覧</span>
            <span class="alt-count-tag">${subsequent.length}便</span>
          </div>
          <div class="upcoming-departures-list">
            ${subItemsHtml}
          </div>
        </div>
      `;
    }

    html += `
      <div class="stop-view-bottom-actions">
        <button class="btn-secondary-full btn-open-timetable" data-stop="${activeStopKey}">
          ${escapeHtml(stopName)} の全時間帯時刻表を見る
        </button>
      </div>
    `;

    container.innerHTML = html;
  }

  // Also update standalone elements in test environment if present
  const stopViewsContainer = document.getElementById('stop-views-container');
  const mainCard = document.getElementById('main-transfer-card');
  const altCard = document.getElementById('alternative-options-card');
  const titleName = document.getElementById('stop-view-title-name');
  const depList = document.getElementById('stop-departure-list');
  const countBadge = document.getElementById('stop-view-count');

  if (countBadge) {
    countBadge.textContent = `直近${departures.length}便`;
  }

  if (stopViewsContainer) {
    if (currentTab.startsWith('stop-')) {
      stopViewsContainer.classList.remove('hidden');
      if (mainCard) mainCard.classList.add('hidden');
      if (altCard) altCard.classList.add('hidden');
      if (titleName) titleName.textContent = stopName;
      if (depList) {
        if (departures.length === 0) {
          depList.innerHTML = '<div class="no-buses-notice">該当する出発予定便はありません</div>';
        } else {
          depList.innerHTML = departures.map(d => `
            <div class="departure-item dep-item">${d.departureTime} ${d.line} ${d.destination}</div>
          `).join('');
        }
      }
    } else {
      stopViewsContainer.classList.add('hidden');
      if (mainCard) mainCard.classList.remove('hidden');
      if (altCard) altCard.classList.remove('hidden');
    }
  }
}
