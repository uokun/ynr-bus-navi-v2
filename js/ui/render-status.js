/**
 * render-status.js
 * 
 * リアルタイム運行情報ステータスバナー、ライブ時計、自動更新タイマー
 */

import { escapeHtml } from './ui-helpers.js';

export function renderStatusBanner(statusObj = {}) {
  if (typeof document === 'undefined') return;

  const banner = document.getElementById('status-banner');
  const pill = document.getElementById('status-pill');
  const pillText = document.getElementById('status-pill-text');
  const updateTime = document.getElementById('status-update-time');
  const statusMsg = document.getElementById('status-message');
  const statusIcon = document.getElementById('status-icon');

  const { isOffline, busInformation = [], lastUpdated, isPolling, isLoading, isApiKeyMissing } = statusObj;

  const hasDisruption = busInformation && busInformation.some(info => {
    const status = info['odpt:informationStatus'] || info.status || '';
    const text = info['odpt:informationText'] || info.text || '';
    return (status.toLowerCase() !== 'normal' && status !== '') || text.includes('遅延') || text.includes('見合わせ');
  });

  if (banner) {
    if (isApiKeyMissing) {
      banner.style.display = 'flex';
      banner.className = 'status-banner status-warning alert warning';
      if (statusIcon) statusIcon.textContent = '🔑';
    } else if (isOffline) {
      banner.style.display = 'flex';
      banner.className = 'status-banner status-urgent offline urgent';
      if (statusIcon) statusIcon.textContent = '📡';
    } else if (hasDisruption) {
      banner.style.display = 'flex';
      banner.className = 'status-banner status-warning alert warning';
      if (statusIcon) statusIcon.textContent = '⚠️';
    } else {
      banner.style.display = 'none';
      banner.className = 'status-banner status-normal normal';
      if (statusIcon) statusIcon.textContent = '';
    }
  }

  if (pillText) {
    if (isApiKeyMissing) {
      pillText.textContent = 'APIキー未設定';
    } else if (isOffline) {
      pillText.textContent = 'オフライン';
    } else if (isLoading) {
      pillText.textContent = '更新中...';
    } else if (hasDisruption) {
      pillText.textContent = '運行支障';
    } else {
      pillText.textContent = '平常運転';
    }
  }

  if (updateTime) {
    if (lastUpdated instanceof Date) {
      const timeStr = lastUpdated.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      updateTime.textContent = `最終更新: ${timeStr}`;
    } else if (typeof lastUpdated === 'string') {
      updateTime.textContent = lastUpdated.includes('最終更新:') ? lastUpdated : `最終更新: ${lastUpdated}`;
    }
  }

  if (statusMsg) {
    if (busInformation && busInformation.length > 0) {
      const infoText = busInformation[0]['odpt:informationText'] || busInformation[0].text || '';
      statusMsg.textContent = infoText;
      statusMsg.style.display = 'block';
    } else {
      statusMsg.textContent = '';
      statusMsg.style.display = 'none';
    }
  }
}

export function updateCountdownIndicator(seconds, isPaused = false) {
  if (typeof document === 'undefined') return;

  const timer = document.getElementById('refresh-timer-display');
  if (timer) {
    if (isPaused) {
      timer.textContent = '停止中';
    } else {
      timer.textContent = `${seconds}s`;
    }
  }
}

export function updateLiveClock(date = new Date()) {
  if (typeof document === 'undefined') return;
  const clockEl = document.getElementById('live-clock');
  if (clockEl && date instanceof Date) {
    clockEl.textContent = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
