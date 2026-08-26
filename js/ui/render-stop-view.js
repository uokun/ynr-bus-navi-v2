/**
 * render-stop-view.js
 * 
 * 停留所発車案内ビュー (洋光台北口 / 上大岡駅前 / 古泉)
 * セグメント切替、のりばピル、先発便Heroカード、後続便リスト、インライン全時間帯時刻表
 */

import { escapeHtml, getRouteBadgeHtml } from './ui-helpers.js';
import { timetableService } from '../services/timetable-service.js';
import { busLocationService } from '../services/bus-location-service.js';
import { stepTimelineComponent } from './step-timeline.js';
import { calendarService } from '../services/calendar-service.js';

export const STOP_PLATFORMS = {
  yokodai: [
    { pole: '1', label: '上大岡方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.YokodaiKitaguchi.7800.1' }
  ],
  kamiooka: [
    { pole: '12', label: '古泉方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.12' },
    { pole: '6', label: '洋光台方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.KamiookaStation.1046.6' }
  ],
  koizumi: [
    { pole: '1', label: '上大岡方面', poleId: 'odpt.BusstopPole:YokohamaMunicipal.Koizumi.1810.1' }
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

  const activePole = data.activePole || (activeStopKey === 'kamiooka' ? '12' : '1');
  const subMode = data.subMode || 'departures'; // 'departures' | 'timetable'
  const calType = data.calType || calendarService.getCalendarType(new Date());
  const filter = data.activeFilter || data.filter || (typeof window !== 'undefined' && window.app?.state?.getState().activeFilter) || 'all';

  let departures = data.departures;

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
  const currentPlatform = platforms.find(p => String(p.pole) === String(activePole)) || platforms[0];

  // If container is provided, render full mobile stop UI
  if (container) {
    // 1. Top Stop Switcher (洋光台北口 / 上大岡駅前 / 古泉)
    let stopTabsHtml = Object.entries(STOP_DISPLAY_NAMES).map(([key, name]) => {
      const isActive = (key === activeStopKey);
      return `<button class="stop-tab-btn ${isActive ? 'active' : ''}" data-stop-key="${key}">${name}</button>`;
    }).join('');

    // 2. Sub-mode Selector ("⏱ 直近発車便" vs "📖 全時刻表")
    const isTimetableMode = (subMode === 'timetable');
    const subModeHtml = `
      <div class="stop-submode-tabs" role="tablist" aria-label="表示切替">
        <button class="stop-submode-btn ${!isTimetableMode ? 'active' : ''}" data-submode="departures" role="tab" aria-selected="${!isTimetableMode}">
          ⏱ 直近発車便
        </button>
        <button class="stop-submode-btn ${isTimetableMode ? 'active' : ''}" data-submode="timetable" role="tab" aria-selected="${isTimetableMode}">
          📖 全時間帯 時刻表
        </button>
      </div>
    `;

    // 3. Platform Selector (上大岡駅前のみ「12番 古泉方面」「6番 洋光台方面」を表示)
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

    let mainContentHtml = '';

    if (isTimetableMode) {
      // --- Timetable Mode (インライン全時間帯時刻表) ---
      const fullTimetableList = data.fullTimetable || [];
      mainContentHtml = renderInlineTimetableGrid({
        stopKey: activeStopKey,
        stopName: stopName,
        platform: currentPlatform,
        calType: calType,
        timetable: fullTimetableList
      });
    } else {
      // --- Departures Mode (直近発車便) ---
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
            <p class="empty-sub" style="font-size:0.8rem; color:var(--text-sub);">ODPT APIキーが未設定か、本日の運行は終了しました。</p>
            <button class="btn-primary-large btn-switch-to-timetable" data-submode="timetable" style="margin-top:12px; max-width:220px; margin-left:auto; margin-right:auto; padding:8px 14px; font-size:0.82rem;">
              📖 全時刻表を確認する
            </button>
          </div>
        `;
      }

      let subsequentHtml = '';
      if (departures.length > 1) {
        const subsequent = departures.slice(1);
        let subItemsHtml = subsequent.map((dep) => {
          const delayCls = dep.delayMinutes > 0 ? 'delay-some' : 'delay-none';
          const delayTxt = dep.delayMinutes > 0 ? `+${dep.delayMinutes}分` : '定刻';
          const actualDep = dep.actualDepartureTime || dep.departureTime;
          const miniLocHtml = stepTimelineComponent.renderMini(dep.locationStatus);

          return `
            <div class="sub-departure-item departure-item" data-dep-time="${escapeHtml(actualDep)}">
              <div class="sub-dep-header">
                <div class="sub-dep-left">
                  <span class="sub-dep-time">${escapeHtml(dep.departureTime)}</span>
                  <span class="sub-dep-dest" style="font-size:0.8rem; font-weight:700; margin-left:8px; color:var(--text-sub);">${escapeHtml(dep.destination || '')}</span>
                </div>
                <div class="sub-dep-right">
                  ${dep.countdownText ? `<span class="dep-countdown">${escapeHtml(dep.countdownText)}</span>` : ''}
                  <span class="delay-badge ${escapeHtml(delayCls)}">${escapeHtml(delayTxt)}</span>
                </div>
              </div>
              ${miniLocHtml ? `<div class="sub-dep-mini-loc">${miniLocHtml}</div>` : ''}
            </div>
          `;
        }).join('');

        subsequentHtml = `
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

      mainContentHtml = `
        <div class="stop-hero-section">
          ${firstHeroHtml}
          ${firstTimelineHtml}
        </div>
        ${subsequentHtml}
        <div class="stop-view-bottom-actions">
          <button class="btn-secondary-full btn-open-timetable btn-switch-to-timetable" data-stop="${activeStopKey}" data-submode="timetable">
            📖 ${escapeHtml(stopName)} の全時間帯時刻表を見る
          </button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="stop-view-segmented-tabs">
        ${stopTabsHtml}
      </div>

      ${subModeHtml}

      ${platformSelectorHtml}

      <div class="stop-view-main-area">
        ${mainContentHtml}
      </div>
    `;
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
    if (currentTab.startsWith('stop-') || currentTab === 'view-stops') {
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

/**
 * インライン全時間帯時刻表グリッドのHTML生成
 */
export function renderInlineTimetableGrid(options = {}) {
  const { stopKey, stopName, platform, calType = 'Weekday', timetable = [] } = options;
  const currentHour = new Date().getHours();

  // Group departures by Hour (5 to 24)
  const hourMap = {};
  for (let h = 5; h <= 24; h++) {
    hourMap[h] = [];
  }

  timetable.forEach(item => {
    if (!item.departureTime) return;
    const [hStr, mStr] = item.departureTime.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (!isNaN(h) && hourMap[h]) {
      hourMap[h].push({
        minute: m,
        minStr: mStr,
        line: item.line || '',
        dest: item.destination || '',
        isMidnight: Boolean(item.isMidnight)
      });
    }
  });

  Object.keys(hourMap).forEach(h => {
    hourMap[h].sort((a, b) => a.minute - b.minute);
  });

  let totalBuses = timetable.length;
  let firstBusTime = timetable[0]?.departureTime || '--:--';
  let lastBusTime = timetable[timetable.length - 1]?.departureTime || '--:--';

  let gridRowsHtml = '';
  for (let h = 5; h <= 24; h++) {
    const deps = hourMap[h];
    if (deps.length === 0 && (h < 6 || h > 23)) continue;

    const isCurrentHour = (h === currentHour);
    const currentClass = isCurrentHour ? 'current-hour-row' : '';

    const chipsHtml = deps.map(d => {
      const isPast = (isCurrentHour && d.minute < new Date().getMinutes());
      const chipClass = isPast ? 'past-bus' : '';
      const destShort = d.dest ? d.dest.replace(/駅前|行/g, '').trim() : '';

      return `
        <span class="inline-tt-chip ${chipClass}" title="${escapeHtml(d.line)} ${escapeHtml(d.dest)}">
          <span class="inline-tt-min">${escapeHtml(d.minStr)}</span>
          ${destShort ? `<span class="inline-tt-dest">${escapeHtml(destShort)}</span>` : ''}
        </span>
      `;
    }).join('');

    gridRowsHtml += `
      <div class="inline-tt-row ${currentClass}">
        <div class="inline-tt-hour">
          <span class="hour-num">${String(h).padStart(2, '0')}</span>
          ${isCurrentHour ? '<span class="current-hour-tag">現在</span>' : ''}
        </div>
        <div class="inline-tt-minutes">
          ${chipsHtml || '<span class="inline-tt-empty">-</span>'}
        </div>
      </div>
    `;
  }

  const todayDetail = calendarService.getDayDetail(new Date());

  return `
    <div class="card inline-timetable-card">
      <div class="inline-tt-header">
        <div class="inline-tt-title-group">
          <div class="inline-tt-top-bar">
            <h3 class="inline-tt-title">📖 ${escapeHtml(stopName)} ${platform?.label ? `(${escapeHtml(platform.label)})` : ''}</h3>
            <span class="inline-tt-today-badge ${todayDetail.dayCategory}">📅 今日は ${escapeHtml(todayDetail.badgeText)}</span>
          </div>
          <p class="inline-tt-summary">1日計 ${totalBuses}便 (始発: ${firstBusTime} / 終発: ${lastBusTime})</p>
        </div>
      </div>

      <!-- Calendar Switcher Pills (平日 / 土曜 / 休日) -->
      <div class="inline-tt-cal-tabs" role="tablist" aria-label="ダイヤ選択">
        <button class="inline-tt-cal-btn ${calType === 'Weekday' ? 'active' : ''}" data-cal="Weekday" role="tab">
          平日ダイヤ${todayDetail.calendarType === 'Weekday' ? ' <span class="today-tag">今日</span>' : ''}
        </button>
        <button class="inline-tt-cal-btn ${calType === 'Saturday' ? 'active' : ''}" data-cal="Saturday" role="tab">
          土曜ダイヤ${todayDetail.calendarType === 'Saturday' ? ' <span class="today-tag">今日</span>' : ''}
        </button>
        <button class="inline-tt-cal-btn ${calType === 'Holiday' ? 'active' : ''}" data-cal="Holiday" role="tab">
          休日ダイヤ${todayDetail.calendarType === 'Holiday' ? ' <span class="today-tag">今日</span>' : ''}
        </button>
      </div>

      <!-- Timetable Grid Body -->
      <div class="inline-tt-grid-wrapper">
        ${gridRowsHtml}
      </div>

      <div class="inline-tt-footer">
        <button class="btn-secondary-full btn-switch-to-departures" data-submode="departures">
          ⏱ 直近発車便の案内に戻る
        </button>
      </div>
    </div>
  `;
}

