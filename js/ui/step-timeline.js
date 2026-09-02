/**
 * step-timeline.js
 * 
 * JR東日本在線位置案内風ステップタイムライン UIコンポーネント
 * 横浜市営バスのリアルタイム運行位置（何個前を走行中、まもなく到着、遅延状況）を
 * 停留所ノード、区間コネクタバー、脈動するバスアイコン（🚍）で視覚的に描画する。
 */

import { escapeHtml } from './ui-helpers.js';
export { escapeHtml };

export class StepTimelineComponent {
  /**
   * 個別停留所カード用 フルサイズJR風ステップタイムラインHTMLの生成
   * 
   * @param {Object|null} locationStatus busLocationService.getBusLocationStatus の戻り値オブジェクト
   * @param {Object} [options={}] 描画オプション
   * @param {boolean} [options.compact=false] コンパクト表示フラグ
   * @param {boolean} [options.showScheduled=true] 運行前便でも待機タイムラインを表示するか
   * @returns {string} レンダリングされたHTML文字列
   */
  render(locationStatus, options = {}) {
    if (!locationStatus) return '';

    const {
      status = 'scheduled',
      statusText = '運行前/予定',
      locationSummary = null,
      fromStopName = '',
      toStopName = '',
      delayMinutes = 0,
      delayText = '定刻',
      timelineNodes = [],
      busSegmentIndex = -1,
      busMarkerPercent = 50
    } = locationStatus;

    // 運行前/予定で表示対象外の場合は空文字
    if (status === 'scheduled' && options.showScheduled === false) {
      return '';
    }

    if (!Array.isArray(timelineNodes) || timelineNodes.length === 0) {
      return '';
    }

    const validStatuses = ['scheduled', 'at_stop', 'approaching', 'en_route', 'passed'];
    const safeStatus = (typeof status === 'string' && validStatuses.includes(status)) ? status : 'scheduled';
    const isLive = (safeStatus === 'at_stop' || safeStatus === 'approaching' || safeStatus === 'en_route');
    const delayClass = delayMinutes > 0 ? 'delay-some' : 'delay-none';
    const statusModifier = `status-${safeStatus}`;

    // サマリー見出しと補足説明の解決
    let headline = locationSummary?.headline || statusText;
    let subline = locationSummary?.subline || '';

    // マーカーラベルの構築 (例: "走行中 (+3分)", "まもなく (定刻)", "停車中")
    let markerLabel = '走行中';
    if (safeStatus === 'at_stop') {
      markerLabel = '停車中';
    } else if (safeStatus === 'approaching') {
      markerLabel = 'まもなく';
    }

    if (delayMinutes > 0) {
      markerLabel += ` (+${delayMinutes}分)`;
    } else {
      markerLabel += ' (定刻)';
    }

    let trackHtml = '';
    const totalNodes = timelineNodes.length;

    for (let i = 0; i < totalNodes; i++) {
      const node = (timelineNodes[i] && typeof timelineNodes[i] === 'object') ? timelineNodes[i] : {};
      const isTarget = !!node.isTarget;
      const nodeState = node.state || (isTarget ? 'target' : 'upcoming');
      const nodeName = escapeHtml(node.name || '');
      const relText = escapeHtml(node.relText || (isTarget ? '当バス停' : ''));

      // ノードのHTML
      trackHtml += `
        <div class="step-node ${escapeHtml(nodeState)} ${isTarget ? 'target' : ''}" data-index="${i}">
          <span class="node-dot ${isTarget ? 'target-dot' : ''}"></span>
          <span class="node-name ${isTarget ? 'target-name' : ''}" title="${nodeName}">${nodeName}</span>
          <span class="node-rel ${isTarget ? 'target-rel' : ''}">${relText}</span>
        </div>
      `;

      // ノード間の接続区間（セグメント）
      if (i < totalNodes - 1) {
        // このセグメントにバスが存在するか判定
        const isBusHere = isLive && (
          busSegmentIndex === i ||
          (safeStatus === 'at_stop' && i === totalNodes - 2 && busSegmentIndex >= totalNodes - 2)
        );

        // 過去区間またはバス到達区間
        const isPassedSegment = (busSegmentIndex > i);
        const isActiveSegment = isBusHere || isPassedSegment;

        let markerHtml = '';
        if (isBusHere) {
          const rawPercent = (typeof busMarkerPercent === 'number' && Number.isFinite(busMarkerPercent)) ? busMarkerPercent : 50;
          let leftPercent = Math.max(0, Math.min(100, rawPercent));
          if (safeStatus === 'at_stop' && busSegmentIndex >= totalNodes - 2) {
            leftPercent = 100;
          }
          markerHtml = `
            <div class="bus-marker-wrap" style="left: ${leftPercent}%;">
              <div class="bus-marker-icon ${isLive ? 'pulsing' : ''}" aria-hidden="true">🚍</div>
              <div class="bus-marker-label ${delayClass}">${escapeHtml(markerLabel)}</div>
            </div>
          `;
        }

        trackHtml += `
          <div class="step-segment ${isActiveSegment ? 'active' : ''} ${isBusHere ? 'has-bus' : ''}">
            <div class="step-line ${isActiveSegment ? 'active' : ''}"></div>
            ${markerHtml}
          </div>
        `;
      }
    }

    return `
      <div class="jr-step-timeline-container ${statusModifier} ${isLive ? 'is-live' : 'is-scheduled'}" role="region" aria-label="在線位置案内: ${escapeHtml(statusText)}">
        <div class="step-timeline-header">
          <div class="timeline-summary-content">
            <div class="timeline-headline">
              <span class="pulse-indicator ${isLive ? 'live' : 'scheduled'}"></span>
              <span class="headline-text">${escapeHtml(headline)}</span>
              <span class="timeline-status-pill ${isLive ? 'live' : 'scheduled'}">${escapeHtml(statusText)}</span>
            </div>
            ${subline ? `<div class="timeline-subline">${escapeHtml(subline)}</div>` : ''}
          </div>
          <span class="timeline-delay-badge ${delayClass}">${escapeHtml(delayText)}</span>
        </div>
        <div class="step-timeline-track">
          ${trackHtml}
        </div>
      </div>
    `;
  }

  /**
   * 乗り継ぎ案内カード用 コンパクト在線位置バッジHTMLの生成
   * 
   * @param {Object|null} locationStatus busLocationService.getBusLocationStatus の戻り値オブジェクト
   * @returns {string} レンダリングされたHTML文字列
   */
  renderMini(locationStatus) {
    if (!locationStatus) return '';

    const {
      status = 'scheduled',
      statusText = '運行前/予定',
      locationSummary = null,
      fromStopName = '',
      toStopName = '',
      stopsAway = null,
      delayMinutes = 0,
      delayText = '定刻'
    } = locationStatus;

    const validStatuses = ['scheduled', 'at_stop', 'approaching', 'en_route', 'passed'];
    const safeStatus = (typeof status === 'string' && validStatuses.includes(status)) ? status : 'scheduled';

    const isLive = (safeStatus === 'at_stop' || safeStatus === 'approaching' || safeStatus === 'en_route');
    const delayClass = delayMinutes > 0 ? 'delay-some' : 'delay-none';
    const delayBadgeText = delayMinutes > 0 ? `+${delayMinutes}分遅れ` : '定刻';

    if (!isLive || safeStatus === 'scheduled') {
      return '';
    }

    // 表示テキストの構築
    let displayText = '';
    if (safeStatus === 'at_stop') {
      displayText = '当バス停に停車中';
    } else if (safeStatus === 'approaching') {
      displayText = fromStopName ? `まもなく到着 (${fromStopName}発)` : 'まもなく到着';
    } else {
      // en_route
      if (fromStopName && toStopName && typeof stopsAway === 'number') {
        displayText = `${fromStopName}〜${toStopName}間 (あと${stopsAway}駅)`;
      } else if (fromStopName && typeof stopsAway === 'number') {
        displayText = `${fromStopName}付近 (あと${stopsAway}駅)`;
      } else if (fromStopName && toStopName) {
        displayText = `${fromStopName}〜${toStopName}間 走行中`;
      } else if (fromStopName) {
        displayText = `${fromStopName}付近 走行中`;
      } else if (typeof stopsAway === 'number') {
        displayText = `あと${stopsAway}駅前を走行中`;
      } else {
        displayText = statusText || '走行中';
      }
    }

    return `
      <div class="mini-bus-location live ${safeStatus}" role="status" aria-label="在線位置: ${escapeHtml(displayText)}">
        <span class="bus-loc-icon pulsing" aria-hidden="true">🚍</span>
        <span class="bus-loc-status">${escapeHtml(displayText)}</span>
        <span class="bus-loc-badge ${delayClass}">${escapeHtml(delayBadgeText)}</span>
      </div>
    `;
  }

  /**
   * 手前5停留所（6ノード）コンパクト横並びプログレスバーHTMLの生成
   * 
   * @param {Object} approachingData busLocationService.get5StopApproachingStatus の戻り値
   * @returns {string} レンダリングされたHTML文字列
   */
  renderHorizontal5StopProgressBar(approachingData) {
    if (!approachingData) return '';

    const {
      targetStopName = '',
      isTerminus = false,
      status = 'scheduled',
      statusText = '運行予定',
      stopsAway = null,
      delayMinutes = 0,
      delayText = '定刻',
      stops = [],
      busPosition = { segmentIndex: -1, percent: 50, isAtStop: false, atStopIndex: -1 }
    } = approachingData;

    // 上大岡駅前（始発）の場合
    if (isTerminus) {
      return `
        <div class="h-5stop-container terminus" role="region" aria-label="発車案内: ${escapeHtml(targetStopName)}始発">
          <div class="h-terminus-banner">
            <span class="h-terminus-badge">🚏 始発停留所</span>
            <span class="h-terminus-text">【${escapeHtml(targetStopName)}】始発のため、定刻に合わせて乗り場より発車します</span>
          </div>
        </div>
      `;
    }

    if (!Array.isArray(stops) || stops.length === 0) return '';

    const isLive = (status === 'at_stop' || status === 'approaching' || status === 'en_route');
    const delayClass = delayMinutes > 0 ? 'delay-some' : 'delay-none';
    const statusModifier = `status-${status}`;

    // サマリー見出しの生成
    let headline = statusText;
    let detailText = '';
    if (status === 'at_stop') {
      headline = `当バス停【${targetStopName}】に停車中`;
      detailText = 'まもなく乗車いただけます';
    } else if (status === 'approaching') {
      headline = `まもなく【${targetStopName}】に到着`;
      detailText = '次が当停留所です（お近くでお待ちください）';
    } else if (status === 'en_route' && typeof stopsAway === 'number') {
      headline = `${stopsAway}つ前のバス停付近を走行中`;
      const curStopName = stops.find(s => s.isCurrent)?.name || '';
      if (curStopName) {
        detailText = `現在位置: ${curStopName} 付近 (あと${stopsAway}駅)`;
      }
    } else if (status === 'scheduled') {
      headline = `運行前（所定ダイヤ通り運行見込み）`;
      detailText = '現在位置情報を受信次第、接近情報を更新します';
    }

    // 6ノードの横並びHTML生成
    const totalNodes = stops.length;
    let trackHtml = '';

    for (let i = 0; i < totalNodes; i++) {
      const stop = stops[i];
      const isTarget = !!stop.isTarget;
      const isCurrent = !!stop.isCurrent;
      const isPassed = !!stop.isPassed;
      const stopName = escapeHtml(stop.name || '');
      const relLabel = isTarget ? '当バス停' : (totalNodes - 1 - i) + '個前';

      let nodeStateClass = 'upcoming';
      if (isCurrent) nodeStateClass = 'current';
      else if (isTarget) nodeStateClass = 'target';
      else if (isPassed) nodeStateClass = 'passed';

      // ノード（駅・バス停）: 各停留所名と相対ラベルをスッキリ表示
      trackHtml += `
        <div class="h-node ${nodeStateClass} ${isTarget ? 'is-target' : ''}" data-index="${i}">
          <div class="h-node-dot-wrap">
            <span class="h-node-dot ${isTarget ? 'target-dot' : ''}"></span>
          </div>
          <span class="h-node-rel ${isTarget ? 'target-rel' : ''}">${escapeHtml(relLabel)}</span>
          <span class="h-node-name ${isTarget ? 'h-node-target-name' : ''}" title="${stopName}">${stopName}</span>
        </div>
      `;

      // ノード間の接続ライン（5区間）
      if (i < totalNodes - 1) {
        const segIdx = i;
        const isBusInSeg = (isLive && !busPosition.isAtStop && busPosition.segmentIndex === segIdx);
        const isPassedSeg = (!busPosition.isAtStop && busPosition.segmentIndex > segIdx) ||
                            (busPosition.isAtStop && busPosition.atStopIndex > segIdx);
        const isActiveSeg = isBusInSeg || isPassedSeg;

        let markerHtml = '';
        if (isBusInSeg) {
          markerHtml = `
            <div class="h-bus-marker">
              <span class="h-bus-icon pulsing" aria-hidden="true">🚍</span>
            </div>
          `;
        }

        trackHtml += `
          <div class="h-segment ${isActiveSeg ? 'active' : ''} ${isBusInSeg ? 'has-bus' : ''}">
            <div class="h-line ${isActiveSeg ? 'active' : ''}"></div>
            ${markerHtml}
          </div>
        `;
      }
    }

    return `
      <div class="h-5stop-container ${statusModifier} ${isLive ? 'is-live' : 'is-scheduled'}" role="region" aria-label="バス接近情報: ${escapeHtml(headline)}">
        <div class="h-5stop-header">
          <div class="h-5stop-title-group">
            <span class="pulse-indicator ${isLive ? 'live' : 'scheduled'}"></span>
            <div class="h-title-texts">
              <span class="h-headline">${escapeHtml(headline)}</span>
              ${detailText ? `<span class="h-subdetail">${escapeHtml(detailText)}</span>` : ''}
            </div>
          </div>
          <span class="h-delay-badge ${delayClass}">${escapeHtml(delayText)}</span>
        </div>
        <div class="h-5stop-track-wrapper">
          <div class="h-5stop-track">
            ${trackHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * JR東日本アプリ風: 上下線2本立て（複線）縦型路線図HTMLの生成
   * 
   * @param {Object} doubleTrackData busLocationService.getDoubleTrackRouteMap の戻り値
   * @returns {string} レンダリングされたHTML文字列
   */
  renderDoubleTrackRouteMap(doubleTrackData) {
    if (!doubleTrackData || !Array.isArray(doubleTrackData.stops) || doubleTrackData.stops.length === 0) {
      return `
        <div class="card" style="padding:24px 16px; text-align:center;">
          <p style="font-weight:700; color:var(--text-sub);">運行データを取得できませんでした</p>
        </div>
      `;
    }

    const {
      lineKey = '111',
      lineTitle = '111系統',
      upboundLabel = '上大岡駅前 方面 (上り)',
      downboundLabel = '港南台駅前 方面 (下り)',
      upboundBusCount = 0,
      downboundBusCount = 0,
      totalBusCount = 0,
      stops = []
    } = doubleTrackData;

    let rowsHtml = '';
    const totalStops = stops.length;

    for (let i = 0; i < totalStops; i++) {
      const stop = stops[i];
      const isLast = (i === totalStops - 1);
      const isFirst = (i === 0);
      const stopName = escapeHtml(stop.name || '');
      const isMajor = !!stop.isMajor;

      // 1. 左カラム: 上り線（上大岡駅前 行き）のバス描画
      let upStopBusesHtml = '';
      if (Array.isArray(stop.upboundBusesAtStop) && stop.upboundBusesAtStop.length > 0) {
        upStopBusesHtml = stop.upboundBusesAtStop.map(b => `
          <div class="dt-bus-pill upbound at-stop ${escapeHtml(b.delayClass || 'delay-none')}" title="上大岡行 (停車中 / ${escapeHtml(b.delayText || '定刻')})">
            <span class="dt-bus-icon pulsing">🚍</span>
            <span class="dt-bus-arrow">↑</span>
            <span class="dt-delay-badge">${escapeHtml(b.delayText || '定刻')}</span>
          </div>
        `).join('');
      }

      let upEnRouteBusesHtml = '';
      if (Array.isArray(stop.upboundBusesEnRoute) && stop.upboundBusesEnRoute.length > 0) {
        upEnRouteBusesHtml = stop.upboundBusesEnRoute.map(b => `
          <div class="dt-bus-pill upbound en-route ${escapeHtml(b.delayClass || 'delay-none')}" title="上大岡行 (走行中 / ${escapeHtml(b.delayText || '定刻')})">
            <span class="dt-bus-icon pulsing">🚍</span>
            <span class="dt-bus-arrow">↑</span>
            <span class="dt-delay-badge">${escapeHtml(b.delayText || '定刻')}</span>
          </div>
        `).join('');
      }

      // 2. 右カラム: 下り線（港南台/根岸 行き）のバス描画
      let downStopBusesHtml = '';
      if (Array.isArray(stop.downboundBusesAtStop) && stop.downboundBusesAtStop.length > 0) {
        downStopBusesHtml = stop.downboundBusesAtStop.map(b => `
          <div class="dt-bus-pill downbound at-stop ${escapeHtml(b.delayClass || 'delay-none')}" title="下り行 (停車中 / ${escapeHtml(b.delayText || '定刻')})">
            <span class="dt-delay-badge">${escapeHtml(b.delayText || '定刻')}</span>
            <span class="dt-bus-arrow">↓</span>
            <span class="dt-bus-icon pulsing">🚍</span>
          </div>
        `).join('');
      }

      let downEnRouteBusesHtml = '';
      if (Array.isArray(stop.downboundBusesEnRoute) && stop.downboundBusesEnRoute.length > 0) {
        downEnRouteBusesHtml = stop.downboundBusesEnRoute.map(b => `
          <div class="dt-bus-pill downbound en-route ${escapeHtml(b.delayClass || 'delay-none')}" title="下り行 (走行中 / ${escapeHtml(b.delayText || '定刻')})">
            <span class="dt-delay-badge">${escapeHtml(b.delayText || '定刻')}</span>
            <span class="dt-bus-arrow">↓</span>
            <span class="dt-bus-icon pulsing">🚍</span>
          </div>
        `).join('');
      }

      const rowClasses = [
        'dt-row',
        isMajor ? 'major-stop' : '',
        isFirst ? 'is-first' : '',
        isLast ? 'is-last' : ''
      ].filter(Boolean).join(' ');

      rowsHtml += `
        <div class="${rowClasses}" data-index="${i}">
          <!-- Left Track: Upbound -->
          <div class="dt-col-track upbound">
            <div class="dt-bus-slot upbound">
              ${upStopBusesHtml}
              ${upEnRouteBusesHtml}
            </div>
            <div class="dt-line-wrapper">
              <span class="dt-line upbound"></span>
              <span class="dt-dot upbound ${isMajor ? 'major-dot' : ''}"></span>
            </div>
          </div>

          <!-- Center: Stop Name -->
          <div class="dt-col-stop">
            <div class="dt-stop-name-wrap ${isMajor ? 'major-name' : ''}">
              <span class="dt-stop-name">${stopName}</span>
              ${isMajor ? '<span class="dt-major-tag">主要</span>' : ''}
            </div>
          </div>

          <!-- Right Track: Downbound -->
          <div class="dt-col-track downbound">
            <div class="dt-line-wrapper">
              <span class="dt-line downbound"></span>
              <span class="dt-dot downbound ${isMajor ? 'major-dot' : ''}"></span>
            </div>
            <div class="dt-bus-slot downbound">
              ${downStopBusesHtml}
              ${downEnRouteBusesHtml}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="jr-double-track-map-container" role="region" aria-label="${escapeHtml(lineTitle)} 上下線リアルタイム走行位置">
        <!-- Top Direction Headers -->
        <div class="dt-header-bar">
          <div class="dt-head-col upbound">
            <span class="dt-head-arrow">↑</span>
            <span class="dt-head-dest">上大岡駅前 方面</span>
            <span class="dt-head-count ${upboundBusCount > 0 ? 'live' : 'none'}">${upboundBusCount}台</span>
          </div>
          <div class="dt-head-col center">
            <span class="dt-head-center-label">停留所</span>
          </div>
          <div class="dt-head-col downbound">
            <span class="dt-head-dest">${escapeHtml(downboundLabel.replace(' 方面 (下り)', ''))} 方面</span>
            <span class="dt-head-arrow">↓</span>
            <span class="dt-head-count ${downboundBusCount > 0 ? 'live' : 'none'}">${downboundBusCount}台</span>
          </div>
        </div>

        <!-- Scrollable Tracks Body -->
        <div class="dt-tracks-body">
          ${rowsHtml}
        </div>
      </div>
    `;
  }
}

export const stepTimelineComponent = new StepTimelineComponent();
export default stepTimelineComponent;
