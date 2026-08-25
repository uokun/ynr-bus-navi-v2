/**
 * render-main.js
 * 
 * 総合乗り継ぎダッシュボード (Transfer View) のUIレンダラー
 * スマートフォンライクなHeroカード、駅間接続タイムライン、次発候補、バッファ切替
 */

import { escapeHtml, formatTime, getRouteBadgeHtml, getDelayBadgeHtml, calculateCountdown } from './ui-helpers.js';
import { stepTimelineComponent } from './step-timeline.js';
import { timetableService } from '../services/timetable-service.js';

/**
 * 乗り継ぎ案内メインビューの描画
 * @param {HTMLElement|Object} containerOrState 
 * @param {Object} [maybeData=null]
 */
export function renderMainTransfer(containerOrState, maybeData = null) {
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

  const {
    direction = 'outbound',
    bufferMinutes = data.buffer ?? 0,
    buffer = bufferMinutes,
    transferResult = null,
    originName = (direction === 'outbound' ? '洋光台北口' : '古泉'),
    destName = (direction === 'outbound' ? '古泉' : '洋光台北口')
  } = data;

  const isOutbound = (direction === 'outbound');
  const recommended = data.recommended || transferResult?.recommended || null;
  const alternatives = data.alternatives || transferResult?.alternatives || [];
  const status = data.status || transferResult?.status || (recommended ? 'ok' : 'no_buses_available');

  // If container is provided, generate rich mobile view HTML
  if (container) {
    const dirLabelFrom = isOutbound ? '洋光台北口' : '古泉';
    const dirLabelTo = isOutbound ? '古泉' : '洋光台北口';
    const dirPlatformFrom = isOutbound ? '1番のりば' : '1番のりば';
    const dirVia = '上大岡駅前 経由';

    const leg1 = recommended?.leg1 || {};
    const leg2 = recommended?.leg2 || {};

    const leg1DepTime = leg1.actualDepartureTime || leg1.departureTime;
    const initialCountdown = leg1DepTime ? calculateCountdown(leg1DepTime, new Date()) : { text: '' };
    const leg1CountdownStr = leg1.countdownText || initialCountdown.text || '';

    // Minimal compact header with clean SVG direction swap button
    let html = `
      <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
        <button id="btn-swap-direction" class="direction-switch-pill" style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; font-size:0.82rem; font-weight:700; background:var(--surface-color); color:var(--primary-color); border:1px solid var(--border-color); border-radius:var(--radius-pill); cursor:pointer;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/>
          </svg>
          <span>${isOutbound ? '洋光台北口 発' : '古泉 発'}</span>
        </button>
      </div>
    `;

    if (status === 'error' || status === 'no_api_key' || !recommended) {
      const isApiKeyMissing = (status === 'no_api_key' || !data.hasApiKey);
      html += `
        <div class="card" style="padding:24px 16px; text-align:center; margin-top:12px; border:1px solid var(--border-color); background:var(--surface-color);">
          <div style="font-size:2rem; margin-bottom:8px;">⚠️</div>
          <div style="font-size:1rem; font-weight:800; color:var(--text-main); margin-bottom:6px;">
            時刻表データを取得できませんでした
          </div>
          <p style="font-size:0.82rem; color:var(--text-sub); line-height:1.4; margin-bottom:16px;">
            ${isApiKeyMissing 
              ? 'ODPT APIキーが設定されていないため、運行情報・時刻表を取得できません。設定タブよりAPIキーを入力してください。' 
              : 'ODPT APIからの時刻表データ取得に失敗したか、運行データが存在しません。通信状態または設定のAPIキーをご確認ください。'}
          </p>
          <button class="btn-primary-large" onclick="if(window.app) window.app.switchTab('view-settings');" style="max-width:240px; margin:0 auto; padding:10px 16px; font-size:0.85rem;">
            設定画面を開く
          </button>
        </div>
      `;
      container.innerHTML = html;
      return;
    }

    const totalDuration = recommended.totalDurationMinutes || 27;
    const waitMin = recommended.transferWaitMinutes || 0;

    const leg1Duration = isOutbound ? 15 : 12;
    const leg1ArrTime = leg1.estimatedArrivalTime || timetableService.minutesToTimeString(timetableService.timeStringToMinutes(leg1DepTime) + leg1Duration);
    
    const leg2DepTime = leg2.actualDepartureTime || leg2.departureTime;
    const leg2Duration = isOutbound ? 12 : 15;
    const leg2ArrTime = leg2.estimatedArrivalTime || timetableService.minutesToTimeString(timetableService.timeStringToMinutes(leg2DepTime) + leg2Duration);

    const leg1Line = leg1.line || (isOutbound ? '111系統' : '133系統');
    const leg2Line = leg2.line || (isOutbound ? '133系統' : '111系統');
    const leg1RouteClass = leg1Line.includes('111') ? 'route-111' : leg1Line.includes('133') ? 'route-133' : 'route-64';
    const leg2RouteClass = leg2Line.includes('111') ? 'route-111' : leg2Line.includes('133') ? 'route-133' : 'route-64';

    const leg1Dest = leg1.destination || '上大岡駅前 行';
    const leg2Dest = leg2.destination || (isOutbound ? '根岸駅前 行 (古泉経由)' : '港南台駅前 行 (洋光台北口経由)');

    const miniLoc1Html = stepTimelineComponent.renderMini(leg1.locationStatus);
    const miniLoc2Html = stepTimelineComponent.renderMini(leg2.locationStatus);

    html += `
      <div class="gmaps-transit-card">
        <div class="gmaps-timeline">
          
          <!-- Row 1: Origin Departure Stop -->
          <div class="gmaps-step-row departure-item" data-dep-time="${escapeHtml(leg1DepTime)}">
            <div class="gmaps-col-time time-hero">${escapeHtml(leg1DepTime)}</div>
            <div class="gmaps-col-track">
              <span class="gmaps-node-circle origin"></span>
              <span class="gmaps-track-line bus-line"></span>
            </div>
            <div class="gmaps-col-body" style="display:flex; justify-content:space-between; align-items:center; padding-right:8px;">
              <div class="gmaps-stop-title" style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${escapeHtml(originName)}</div>
              <span class="origin-t-minus-pill countdown-val dep-countdown" style="font-size:0.95rem; font-weight:800; color:#D97706; background:var(--surface-subtle); padding:4px 12px; border-radius:var(--radius-pill); border:1px solid var(--border-subtle);">${escapeHtml(leg1CountdownStr)}</span>
            </div>
          </div>

          <!-- Row 2: Bus Leg 1 Ride -->
          <div class="gmaps-step-row transit-segment">
            <div class="gmaps-col-time icon-col"></div>
            <div class="gmaps-col-track">
              <span class="gmaps-track-line bus-line"></span>
            </div>
            <div class="gmaps-col-body segment-body">
              <div class="gmaps-transit-head">
                <span class="gmaps-route-badge ${leg1RouteClass}">${escapeHtml(leg1Line)}</span>
                <span class="gmaps-dest-label">${escapeHtml(leg1Dest)}</span>
              </div>
              ${miniLoc1Html}
            </div>
          </div>

          <!-- Row 3: Transfer Hub Arrival -->
          <div class="gmaps-step-row">
            <div class="gmaps-col-time">${escapeHtml(leg1ArrTime)}</div>
            <div class="gmaps-col-track">
              <span class="gmaps-node-circle transfer"></span>
              <span class="gmaps-track-line walk-line"></span>
            </div>
            <div class="gmaps-col-body">
              <div class="gmaps-stop-title">上大岡駅前</div>
            </div>
          </div>

          <!-- Row 4: Transfer Walk / Waiting -->
          <div class="gmaps-step-row walk-segment">
            <div class="gmaps-col-time icon-col"></div>
            <div class="gmaps-col-track">
              <span class="gmaps-track-line walk-line"></span>
            </div>
            <div class="gmaps-col-body segment-body">
              <div class="gmaps-transit-head">
                <span class="gmaps-walk-title">乗り換え約${escapeHtml(waitMin)}分</span>
              </div>
            </div>
          </div>

          <!-- Row 5: Transfer Hub Departure -->
          <div class="gmaps-step-row">
            <div class="gmaps-col-time">${escapeHtml(leg2DepTime)}</div>
            <div class="gmaps-col-track">
              <span class="gmaps-node-circle transfer"></span>
              <span class="gmaps-track-line bus-line"></span>
            </div>
            <div class="gmaps-col-body">
              <div class="gmaps-stop-title">上大岡駅前</div>
            </div>
          </div>

          <!-- Row 6: Bus Leg 2 Ride -->
          <div class="gmaps-step-row transit-segment">
            <div class="gmaps-col-time icon-col"></div>
            <div class="gmaps-col-track">
              <span class="gmaps-track-line bus-line"></span>
            </div>
            <div class="gmaps-col-body segment-body">
              <div class="gmaps-transit-head">
                <span class="gmaps-route-badge ${leg2RouteClass}">${escapeHtml(leg2Line)}</span>
                <span class="gmaps-dest-label">${escapeHtml(leg2Dest)}</span>
              </div>
              ${miniLoc2Html}
            </div>
          </div>

          <!-- Row 7: Destination Arrival -->
          <div class="gmaps-step-row destination-row">
            <div class="gmaps-col-time time-hero">${escapeHtml(leg2ArrTime)}</div>
            <div class="gmaps-col-track">
              <span class="gmaps-node-circle dest"></span>
            </div>
            <div class="gmaps-col-body">
              <div class="gmaps-stop-title" style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${escapeHtml(destName)}</div>
            </div>
          </div>

        </div>
      </div>
    `;

    if (Array.isArray(alternatives) && alternatives.length > 0) {
      let altItemsHtml = alternatives.map((alt, idx) => {
        const altLeg1 = alt.leg1 || {};
        const altLeg2 = alt.leg2 || {};
        const altWait = alt.transferWaitMinutes || 0;
        const altDep1 = altLeg1.actualDepartureTime || altLeg1.departureTime;
        const altArr2 = altLeg2.estimatedArrivalTime || timetableService.minutesToTimeString(timetableService.timeStringToMinutes(altLeg2.actualDepartureTime || altLeg2.departureTime) + (isOutbound ? 12 : 15));

        return `
          <div class="gmaps-alt-item">
            <div class="gmaps-alt-top">
              <div class="gmaps-alt-times">
                <span class="alt-time-bold">${escapeHtml(altDep1)}</span>
                <span class="alt-time-label">発</span>
                <span class="alt-time-arrow">➔</span>
                <span class="alt-time-bold">${escapeHtml(altArr2)}</span>
                <span class="alt-time-label">着</span>
              </div>
            </div>
            <div class="gmaps-alt-legs">
              ${getRouteBadgeHtml(altLeg1.line)}
              <span class="gmaps-alt-sep">➔</span>
              <span class="gmaps-alt-wait">乗り換え約${escapeHtml(altWait)}分</span>
              <span class="gmaps-alt-sep">➔</span>
              ${getRouteBadgeHtml(altLeg2.line)}
            </div>
          </div>
        `;
      }).join('');

      html += `
        <div class="card gmaps-alts-card">
          <div class="card-section-title">
            <span>後続の乗り継ぎ候補</span>
            <span class="alt-count-tag">${alternatives.length}便</span>
          </div>
          <div class="gmaps-alts-list">
            ${altItemsHtml}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Also update standalone elements if they exist in DOM (for unit test compatibility)
  const elBadge = document.getElementById('direction-badge');
  const elOrigin = document.getElementById('origin-name');
  const elVia = document.getElementById('via-stop-name');
  const elDest = document.getElementById('dest-name');
  const elBufVal = document.getElementById('buffer-display-val');
  const elBufferTag = document.getElementById('transfer-buffer-tag');
  const elTotalTime = document.getElementById('main-card-total-time');
  const elLeg1Badge = document.getElementById('leg-1-route-badge');
  const elLeg1Dest = document.getElementById('leg-1-dest-label');
  const elLeg1Dep = document.getElementById('leg-1-dep-time');
  const elWaitMin = document.getElementById('transfer-wait-minutes');
  const elLeg2Badge = document.getElementById('leg-2-route-badge');
  const elLeg2Dest = document.getElementById('leg-2-dest-label');
  const elLeg2Dep = document.getElementById('leg-2-dep-time');
  const elAltCount = document.getElementById('alt-options-count');
  const elAltList = document.getElementById('alt-connections-list');

  if (elBadge) elBadge.textContent = isOutbound ? '往路' : '復路';
  if (elOrigin) elOrigin.textContent = isOutbound ? '🚏 洋光台北口' : '🚏 古泉';
  if (elVia) elVia.textContent = '上大岡駅前 経由';
  if (elDest) elDest.textContent = isOutbound ? '🚏 古泉' : '🚏 洋光台北口';
  if (elBufVal) elBufVal.textContent = `${buffer}分`;
  if (elBufferTag) elBufferTag.textContent = buffer > 0 ? `バッファ ${buffer}分 確保` : '';
  if (elLeg1Badge) elLeg1Badge.textContent = isOutbound ? '111系統' : '133系統';
  if (elLeg1Dest) elLeg1Dest.textContent = '上大岡駅前 行';
  if (elLeg2Badge) elLeg2Badge.textContent = isOutbound ? '133系統' : '111系統';
  if (elLeg2Dest) elLeg2Dest.textContent = isOutbound ? '根岸駅前 行 (古泉経由)' : '港南台駅前 行 (洋光台北口経由)';

  if (!recommended || status === 'no_buses_available') {
    if (elTotalTime) elTotalTime.textContent = '本日の運行終了';
    if (elAltCount) elAltCount.textContent = '0便';
    if (elAltList) elAltList.innerHTML = '<div class="no-buses-notice">本日の運行はすべて終了しました</div>';
  } else {
    const leg1 = recommended.leg1 || {};
    const leg2 = recommended.leg2 || {};
    if (elTotalTime) elTotalTime.textContent = `所要時間: 約${recommended.totalDurationMinutes || 28}分`;
    if (elLeg1Dep) elLeg1Dep.textContent = leg1.departureTime || '';
    if (elWaitMin) elWaitMin.textContent = `${recommended.transferWaitMinutes || 0}分`;
    if (elLeg2Dep) elLeg2Dep.textContent = leg2.departureTime || '';
    if (elAltCount) elAltCount.textContent = `${alternatives.length}便利用可能`;
    if (elAltList && alternatives.length > 0) {
      elAltList.innerHTML = alternatives.map((a, i) => `
        <div class="alt-connection-item">
          <span>候補${i + 1}: ${a.leg1.departureTime}発 ➔ ${a.leg2.destination} (${a.totalDurationMinutes}分)</span>
        </div>
      `).join('');
    }
  }
}
