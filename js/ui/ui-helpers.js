/**
 * ui-helpers.js
 * 
 * スマートフォンライクなUI支援関数群
 * HTMLエスケープ、時刻・カウントダウン整形、系統・遅延バッジ生成、トースト通知
 */

/**
 * HTMLエスケープ
 * @param {string|number|null|undefined} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 時刻文字列のフォーマット
 * @param {Date|string|number} input 
 * @param {boolean} [includeSeconds=false] 
 * @returns {string}
 */
export function formatTime(input, includeSeconds = false) {
  if (!input) return '--:--';
  
  if (input instanceof Date) {
    const h = String(input.getHours()).padStart(2, '0');
    const m = String(input.getMinutes()).padStart(2, '0');
    const s = String(input.getSeconds()).padStart(2, '0');
    return includeSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  }

  if (typeof input === 'string') {
    const parts = input.trim().split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      if (includeSeconds && parts.length >= 3) {
        const s = parts[2].padStart(2, '0');
        return `${h}:${m}:${s}`;
      }
      return `${h}:${m}`;
    }
  }

  return String(input);
}

/**
 * カウントダウン文字列の整形
 * @param {number} diffMinutes 
 * @param {number|null} [diffSeconds=null] 
 * @returns {{ text: string, shortText: string, status: 'urgent'|'soon'|'normal'|'past', badgeClass: string }}
 */
export function formatCountdown(diffMinutes, diffSeconds = null) {
  const totalSec = diffSeconds !== null ? diffSeconds : Math.round(diffMinutes * 60);
  const mins = Math.floor(totalSec / 60);

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
    shortText: `${hStr}:${mStr}`,
    status: 'normal',
    badgeClass: 'badge-normal'
  };
}

/**
 * 出発時刻文字列からカウントダウンオブジェクトを算出
 * @param {string} depTimeStr 
 * @param {Date} [now=new Date()] 
 * @returns {{ text: string, shortText: string, status: 'urgent'|'soon'|'normal'|'past', badgeClass: string }}
 */
export function calculateCountdown(depTimeStr, now = new Date()) {
  if (!depTimeStr) return { text: '', shortText: '', status: 'none', badgeClass: '' };
  const parts = String(depTimeStr).split(':');
  if (parts.length < 2) return { text: '', shortText: '', status: 'none', badgeClass: '' };
  const depMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowSec = now.getSeconds();
  let diffSec = (depMin - nowMin) * 60 - nowSec;
  if (nowMin >= 22 * 60 && depMin < 4 * 60) diffSec += 86400;
  else if (nowMin < 4 * 60 && depMin >= 22 * 60) diffSec -= 86400;
  const diffMin = Math.floor(diffSec / 60);
  return formatCountdown(diffMin, diffSec);
}

/**
 * 系統バッジHTMLの生成
 * @param {string} line 
 * @returns {string}
 */
export function getRouteBadgeHtml(line = '') {
  const lineStr = String(line || '');
  let badgeClass = 'route-badge-other badge-route-default';
  let num = lineStr;

  if (lineStr.includes('111')) {
    badgeClass = 'route-badge-111 badge-route-111';
    num = '111系統';
  } else if (lineStr.includes('133')) {
    badgeClass = 'route-badge-133 badge-route-133';
    num = '133系統';
  } else if (lineStr.includes('64')) {
    badgeClass = 'route-badge-64 badge-route-64';
    num = '64系統';
  }

  return `<span class="route-badge ${badgeClass}">${escapeHtml(num)}</span>`;
}

/**
 * 遅延バッジHTMLの生成
 * @param {number} delayMinutes 
 * @returns {string}
 */
export function getDelayBadgeHtml(delayMinutes = 0) {
  const delay = Number(delayMinutes) || 0;
  if (delay <= 0) {
    return `<span class="delay-badge on-time delay-none">定刻</span>`;
  }
  return `<span class="delay-badge delayed delay-some">+${delay}分遅延</span>`;
}

/**
 * ステータスバッジHTMLの生成
 * @param {string} status 
 * @param {string} label 
 * @returns {string}
 */
export function getStatusBadgeHtml(status = 'normal', label = '平常運転') {
  return `<span class="status-pill ${escapeHtml(status)} status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

/**
 * トースト通知の表示
 * @param {string} message 
 * @param {'success'|'info'|'warning'|'error'} [type='info'] 
 * @param {number} [durationMs=2500] 
 */
export function showToast(message, type = 'info', durationMs = 2500) {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  } else {
    toast.classList.add('show');
  }

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, durationMs);
}
