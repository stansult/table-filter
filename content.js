(() => {
  const PANEL_ID = 'table-filter-panel';
  const STYLE_ID = 'table-filter-style';
  const NOTICE_ID = 'table-filter-inline-notice';
  const MATCHED_CLASS = 'table-filter-card-hidden';
  const MATCH_CLASS = 'table-filter-card-match';
  const SLOT_MATCH_CLASS = 'table-filter-slot-match';
  const PENDING_CLASS = 'table-filter-card-pending';
  const NON_ALBUM_HIDDEN_CLASS = 'table-filter-non-album-hidden';
  const SUPPORTED_PATH = /\/photos_albums(?:[/?#]|$)/i;
  const APP_VERSION = '1.1.0';
  const MAX_STAGNANT_CYCLES = 3;
  const PENDING_HIDE_DELAY_MS = 160;
  const TOAST_INFO_BG = 'rgba(20, 40, 70, 0.75)';
  const TOAST_SUCCESS_BG = 'rgba(20, 70, 40, 0.75)';
  const TOAST_EXPIRED_BG = 'rgba(60, 60, 60, 0.75)';
  const TOAST_ERROR_BG = 'rgba(120, 30, 30, 0.85)';

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function parseQuery(rawQuery) {
    const trimmed = String(rawQuery || '').trim();
    const doubleQuoted = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');
    const singleQuoted = trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'");
    if (doubleQuoted || singleQuoted) {
      return {
        mode: 'phrase',
        phrase: normalize(trimmed.slice(1, -1))
      };
    }
    const norm = normalize(trimmed);
    const tokens = norm ? norm.split(' ').filter(Boolean) : [];
    return {
      mode: 'tokens',
      tokens
    };
  }

  function isSupportedPage() {
    const isFacebookAlbums = window.location.hostname.includes('facebook.com')
      && SUPPORTED_PATH.test(window.location.pathname + window.location.search);

    if (isFacebookAlbums) return true;

    // Allow local/hosted test playground usage.
    return !!document.querySelector('[data-af-album-grid]');
  }

  function isTestPlaygroundPage() {
    return !!document.querySelector('[data-af-album-grid]');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        width: 320px;
        background: #ffffff;
        color: #111827;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.35;
        overflow: hidden;
      }
      #${PANEL_ID} .af-head {
        background: #f8fafc;
        border-bottom: 1px solid #e5e7eb;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .af-title {
        font-weight: 700;
        color: #1f2937;
      }
      #${PANEL_ID} .af-close {
        border: 1px solid #d1d5db;
        background: #fff;
        border-radius: 6px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
      }
      #${PANEL_ID} .af-body {
        padding: 10px;
        display: grid;
        gap: 8px;
      }
      #${PANEL_ID} .af-input-wrap {
        position: relative;
      }
      #${PANEL_ID} .af-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 7px 30px 7px 9px;
        font-size: 13px;
      }
      #${PANEL_ID} .af-input-clear {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        border: 0;
        background: transparent;
        color: #64748b;
        font-size: 16px;
        line-height: 1;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      #${PANEL_ID} .af-input-clear:hover {
        background: #e2e8f0;
        color: #334155;
      }
      #${PANEL_ID} .af-input-clear:disabled {
        cursor: default;
        opacity: 0.35;
      }
      #${PANEL_ID} .af-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }
      #${PANEL_ID} .af-btn {
        border: 1px solid #c7d2fe;
        background: #eef2ff;
        color: #111827;
        border-radius: 7px;
        padding: 6px 4px;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      #${PANEL_ID} .af-btn:hover {
        background: #e0e7ff;
      }
      #${PANEL_ID} .af-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      #${PANEL_ID} .af-btn[aria-pressed="true"] {
        background: #dbeafe;
        border-color: #60a5fa;
        box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.35);
      }
      #${PANEL_ID} .af-btn.secondary {
        background: #f8fafc;
        border-color: #d1d5db;
      }
      #${PANEL_ID} .af-btn.secondary:hover {
        background: #f1f5f9;
      }
      #${PANEL_ID} .af-status {
        color: #334155;
        font-size: 14px;
        font-weight: 600;
      }
      #${PANEL_ID} .af-status.warn {
        color: #b45309;
      }
      #${PANEL_ID} .af-help {
        color: #64748b;
        font-size: 11px;
        white-space: pre-line;
      }
      #${PANEL_ID} .af-auto-warn {
        display: none;
        padding: 7px 9px;
        border: 1px solid #fecaca;
        border-radius: 8px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 12px;
        line-height: 1.3;
      }
      #${PANEL_ID} .af-auto-warn.show {
        display: block;
      }
      .${MATCHED_CLASS} {
        display: none !important;
      }
      .${NON_ALBUM_HIDDEN_CLASS} {
        display: none !important;
      }
      .${PENDING_CLASS} {
        opacity: 0.2 !important;
      }
      [data-af-layout-root][data-af-compact="true"] {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)) !important;
        gap: 0 !important;
        align-items: start !important;
      }
      [data-af-layout-root][data-af-compact="true"][data-af-query-active="true"] > * {
        opacity: 0.2 !important;
      }
      [data-af-layout-root][data-af-compact="true"][data-af-query-active="true"] > .${SLOT_MATCH_CLASS} {
        opacity: 1 !important;
      }
      [data-af-layout-root][data-af-compact="true"] > * {
        min-width: 0 !important;
        width: auto !important;
      }
      #${NOTICE_ID} {
        margin: 8px 0 10px;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        color: #334155;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.35;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function showToast(text, options = {}) {
    const {
      duration = 1800,
      level = 'info'
    } = options;
    const existing = document.getElementById('table-filter-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'table-filter-toast';
    toast.textContent = text;
    const panel = document.getElementById(PANEL_ID);
    const toastRight = panel ? `${panel.offsetWidth + 28}px` : '14px';
    const background = level === 'success'
      ? TOAST_SUCCESS_BG
      : level === 'expired'
        ? TOAST_EXPIRED_BG
        : level === 'error'
          ? TOAST_ERROR_BG
          : TOAST_INFO_BG;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '14px',
      right: toastRight,
      zIndex: '999999',
      padding: '8px 12px',
      borderRadius: '4px',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
      fontSize: '13px',
      lineHeight: '1.3',
      color: '#fff',
      background,
      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      opacity: '0',
      transition: 'opacity 0.2s ease'
    });

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function isCreateAnchor(anchor) {
    const href = anchor.getAttribute('href') || '';
    return href.includes('/media/set/create/');
  }

  function isAlbumAnchor(anchor) {
    const href = anchor.getAttribute('href') || '';
    return href.includes('/media/set/?set=') || href.includes('/media/set/?set=') || href.includes('/media/set/?set');
  }

  function readTitle(anchor) {
    const titleNodes = anchor.querySelectorAll('span[dir="auto"], div[dir="auto"]');
    for (const node of titleNodes) {
      const text = (node.textContent || '').trim();
      if (!text) continue;
      if (/^\d+\s+items?$/i.test(text)) continue;
      if (/^create album$/i.test(text)) continue;
      return text;
    }
    return (anchor.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function readCount(anchor) {
    const nodes = anchor.querySelectorAll('span[dir="auto"], div[dir="auto"]');
    for (const node of nodes) {
      const text = (node.textContent || '').trim();
      if (/^\d+\s+items?$/i.test(text)) return text;
    }
    return '';
  }

  function findCardContainer(anchor) {
    const byWidth = anchor.closest('div[style*="min-width: 168px"], div[style*="min-width:168px"]');
    if (byWidth) return byWidth;

    let current = anchor;
    for (let i = 0; i < 8 && current; i += 1) {
      current = current.parentElement;
      if (!current) break;
      if (current.querySelector('img') && /items?/i.test(current.textContent || '')) {
        return current;
      }
    }

    return anchor;
  }

  function createApp() {
    const state = {
      query: '',
      albums: [],
      autoScanActive: false,
      autoScanTimer: null,
      testPageAutoButton: null,
      stagnantCycles: 0,
      lastScanCount: 0,
      observer: null,
      rescanTimer: null,
      layoutRoot: null,
      knownAlbumKeys: new Set(),
      stickyMatchedKeys: new Set(),
      lastQuerySignature: '',
      pendingHideTimers: new Map()
    };

    ensureStyles();

    let panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();

    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="af-head">
        <div class="af-title">Table Filter</div>
        <button type="button" class="af-close" aria-label="Close panel">×</button>
      </div>
      <div class="af-body">
        <div class="af-input-wrap">
          <input class="af-input" type="text" placeholder="Filter albums by title...">
          <button type="button" class="af-input-clear" aria-label="Clear filter">×</button>
        </div>
        <div class="af-row">
          <button type="button" class="af-btn" data-action="scan">Rescan</button>
          <button type="button" class="af-btn" data-action="auto">Auto-load</button>
          <button type="button" class="af-btn secondary" data-action="stop">Stop</button>
        </div>
        <div class="af-auto-warn" aria-live="polite">Warning: Auto-load may scroll/jump the page to trigger more loading.</div>
        <div class="af-help">- Rescan refreshes albums already on the page.
- Auto-load fetches more pages.</div>
        <div class="af-status" aria-live="polite">Ready</div>
      </div>
    `;

    document.body.appendChild(panel);

    const input = panel.querySelector('.af-input');
    const status = panel.querySelector('.af-status');
    const scanBtn = panel.querySelector('button[data-action="scan"]');
    const autoBtn = panel.querySelector('button[data-action="auto"]');
    const stopBtn = panel.querySelector('button[data-action="stop"]');
    const clearBtn = panel.querySelector('.af-input-clear');
    const autoWarn = panel.querySelector('.af-auto-warn');

    function syncButtonState() {
      autoBtn.setAttribute('aria-pressed', state.autoScanActive ? 'true' : 'false');
      autoBtn.textContent = state.autoScanActive ? 'Auto-loading' : 'Auto-load';
      stopBtn.disabled = !state.autoScanActive;
      clearBtn.disabled = !state.query;
      scanBtn.disabled = false;
      autoWarn.classList.toggle('show', state.autoScanActive);
    }

    function stopTestPageAutoIfRunning() {
      if (!isTestPlaygroundPage()) return;
      const testAuto = document.getElementById('auto-load');
      if (!testAuto) return;
      state.testPageAutoButton = testAuto;
      if (testAuto.getAttribute('aria-pressed') === 'true') testAuto.click();
    }

    function setStatus(text, warn) {
      status.textContent = text;
      status.classList.toggle('warn', !!warn);
    }

    function removeInlineNotice() {
      const existing = document.getElementById(NOTICE_ID);
      if (existing) existing.remove();
    }

    function findNoticeAnchor() {
      const tablists = Array.from(document.querySelectorAll('[role="tablist"]'));
      const albumsTabs = tablists.find(node => /albums/i.test(node.textContent || ''));
      if (albumsTabs) return albumsTabs;
      if (state.layoutRoot && state.layoutRoot.parentElement) return state.layoutRoot.parentElement;
      return state.layoutRoot;
    }

    function upsertInlineNotice(hasQuery, shown, loaded) {
      if (!hasQuery) {
        removeInlineNotice();
        return;
      }

      const hidden = Math.max(0, loaded - shown);
      const text = hidden === 0
        ? 'Table Filter: active.'
        : shown === 0
          ? `Table Filter: active. No matching albums in loaded list (0 of ${loaded} loaded).`
          : state.autoScanActive
            ? 'Table Filter: active. Some albums are hidden.'
            : `Table Filter: active. Some albums are hidden (showing ${shown} of ${loaded} loaded).`;

      let notice = document.getElementById(NOTICE_ID);
      if (!notice) {
        notice = document.createElement('div');
        notice.id = NOTICE_ID;
      }
      if (notice.textContent !== text) {
        notice.textContent = text;
      }

      const anchor = findNoticeAnchor();
      if (anchor && anchor.parentElement) {
        if (notice.parentElement !== anchor.parentElement || notice.previousElementSibling !== anchor) {
          anchor.insertAdjacentElement('afterend', notice);
        }
      } else if (!notice.parentElement) {
        document.body.appendChild(notice);
      }
    }

    function setQueryActiveMode(enabled) {
      document.documentElement.setAttribute('data-af-query-active', enabled ? 'true' : 'false');
      if (!enabled) {
        document.querySelectorAll(`.${PENDING_CLASS}`).forEach(node => {
          node.classList.remove(PENDING_CLASS);
        });
      }
    }

    function clearPendingHideTimers() {
      state.pendingHideTimers.forEach(timerId => {
        clearTimeout(timerId);
      });
      state.pendingHideTimers.clear();
    }

    function cancelPendingHide(card) {
      const timerId = state.pendingHideTimers.get(card);
      if (timerId) {
        clearTimeout(timerId);
        state.pendingHideTimers.delete(card);
      }
    }

    function schedulePendingHide(card) {
      if (state.pendingHideTimers.has(card)) return;
      const timerId = setTimeout(() => {
        state.pendingHideTimers.delete(card);
        card.classList.add(MATCHED_CLASS);
        card.classList.remove(PENDING_CLASS);
      }, PENDING_HIDE_DELAY_MS);
      state.pendingHideTimers.set(card, timerId);
    }

    function hasActiveQuery() {
      const parsedQuery = parseQuery(state.query);
      return parsedQuery.mode === 'phrase'
        ? !!parsedQuery.phrase
        : parsedQuery.tokens.length > 0;
    }

    function clearCompactLayout() {
      if (state.layoutRoot && state.layoutRoot.isConnected) {
        state.layoutRoot.removeAttribute('data-af-layout-root');
        state.layoutRoot.removeAttribute('data-af-compact');
        state.layoutRoot.removeAttribute('data-af-query-active');
      }
      removeInlineNotice();
      document.querySelectorAll(`.${NON_ALBUM_HIDDEN_CLASS}`).forEach(node => {
        node.classList.remove(NON_ALBUM_HIDDEN_CLASS);
      });
      document.querySelectorAll(`.${SLOT_MATCH_CLASS}`).forEach(node => {
        node.classList.remove(SLOT_MATCH_CLASS);
      });
      state.layoutRoot = null;
    }

    function applySlotHighlighting(hasQuery) {
      if (!state.layoutRoot || !state.layoutRoot.isConnected) return;
      state.layoutRoot.setAttribute('data-af-query-active', hasQuery ? 'true' : 'false');

      Array.from(state.layoutRoot.children).forEach(child => {
        child.classList.remove(SLOT_MATCH_CLASS);
        if (!hasQuery) return;
        if (child.classList.contains(NON_ALBUM_HIDDEN_CLASS)) return;

        const hasAlbum = !!child.querySelector('a[href*="/media/set/?set"]');
        if (!hasAlbum) {
          child.classList.add(SLOT_MATCH_CLASS);
          return;
        }

        const hasMatched = child.classList.contains(MATCH_CLASS)
          || !!child.querySelector(`.${MATCH_CLASS}`);
        if (hasMatched) {
          child.classList.add(SLOT_MATCH_CLASS);
        }
      });
    }

    function detectLayoutRoot() {
      const counts = new Map();
      state.albums.forEach(album => {
        const parent = album.card?.parentElement;
        if (!parent) return;
        counts.set(parent, (counts.get(parent) || 0) + 1);
      });
      let bestNode = null;
      let bestCount = 0;
      counts.forEach((count, node) => {
        if (count > bestCount) {
          bestCount = count;
          bestNode = node;
        }
      });
      if (!bestNode || bestCount < 3) return null;
      return bestNode;
    }

    function applyCompactLayout(enabled) {
      if (isTestPlaygroundPage()) {
        clearCompactLayout();
        return;
      }

      if (!enabled) {
        clearCompactLayout();
        return;
      }

      const root = detectLayoutRoot();
      if (!root) {
        clearCompactLayout();
        return;
      }

      if (state.layoutRoot && state.layoutRoot !== root) {
        clearCompactLayout();
      }
      state.layoutRoot = root;
      root.setAttribute('data-af-layout-root', 'true');
      root.setAttribute('data-af-compact', 'true');

      Array.from(root.children).forEach(child => {
        const hasAlbum = !!child.querySelector('a[href*="/media/set/?set"]');
        const isCreate = !!child.querySelector('a[href*="/media/set/create/"]');
        child.classList.toggle(NON_ALBUM_HIDDEN_CLASS, !hasAlbum && !isCreate);
      });
      applySlotHighlighting(enabled);
    }

    function setTestScrollLoadGuard(enabled) {
      if (!isTestPlaygroundPage()) return;
      const sentinel = document.getElementById('scroll-sentinel');
      if (!sentinel) return;
      sentinel.style.display = enabled ? 'none' : '';
    }

    function collectAlbums() {
      const seen = new Set();
      const entries = [];
      const anchors = document.querySelectorAll('a[href*="/media/set/"]');

      anchors.forEach(anchor => {
        if (isCreateAnchor(anchor) || !isAlbumAnchor(anchor)) return;

        const href = anchor.href || anchor.getAttribute('href') || '';
        const card = findCardContainer(anchor);
        const title = readTitle(anchor);
        const count = readCount(anchor);
        const key = `${href}::${title}`;

        if (!title || seen.has(key)) return;
        seen.add(key);

        entries.push({
          key,
          href,
          title,
          titleNorm: normalize(title),
          count,
          card
        });
      });

      const queryActive = hasActiveQuery();
      if (queryActive) {
        entries.forEach(entry => {
          if (!state.knownAlbumKeys.has(entry.key) && !state.stickyMatchedKeys.has(entry.key)) {
            entry.card.classList.add(PENDING_CLASS);
          }
        });
      }
      state.knownAlbumKeys = new Set(entries.map(entry => entry.key));

      state.albums = entries;
      return entries;
    }

    function applyFilter() {
      const parsedQuery = parseQuery(state.query);
      const hasQuery = parsedQuery.mode === 'phrase'
        ? !!parsedQuery.phrase
        : parsedQuery.tokens.length > 0;
      const querySignature = JSON.stringify(parsedQuery);
      if (querySignature !== state.lastQuerySignature) {
        state.stickyMatchedKeys.clear();
        state.lastQuerySignature = querySignature;
      }
      let shown = 0;
      setQueryActiveMode(hasQuery);
      if (!hasQuery) {
        clearPendingHideTimers();
      }

      state.albums.forEach(album => {
        let matches = true;
        if (parsedQuery.mode === 'phrase') {
          matches = !!parsedQuery.phrase && album.titleNorm.includes(parsedQuery.phrase);
        } else if (parsedQuery.tokens.length) {
          matches = parsedQuery.tokens.every(token => album.titleNorm.includes(token));
        }

        album.card.classList.toggle(MATCH_CLASS, matches);
        if (matches || !hasQuery) {
          cancelPendingHide(album.card);
          album.card.classList.remove(MATCHED_CLASS);
          album.card.classList.remove(PENDING_CLASS);
        } else if (album.card.classList.contains(PENDING_CLASS)) {
          album.card.classList.remove(MATCHED_CLASS);
          schedulePendingHide(album.card);
        } else {
          cancelPendingHide(album.card);
          album.card.classList.add(MATCHED_CLASS);
          album.card.classList.remove(PENDING_CLASS);
        }

        if (matches && hasQuery) {
          state.stickyMatchedKeys.add(album.key);
        }
        if (matches) shown += 1;
      });

      upsertInlineNotice(hasQuery, shown, state.albums.length);

      setStatus(`Albums loaded: ${state.albums.length} • Showing: ${shown}`);
      setTestScrollLoadGuard(hasQuery && !state.autoScanActive);
      applyCompactLayout(hasQuery);
      applySlotHighlighting(hasQuery);
    }

    function scanAndFilter() {
      collectAlbums();
      applyFilter();
    }

    function stopAutoScan(reason) {
      state.autoScanActive = false;
      state.stagnantCycles = 0;
      state.lastScanCount = state.albums.length;
      if (state.autoScanTimer) {
        clearInterval(state.autoScanTimer);
        state.autoScanTimer = null;
      }
      if (state.testPageAutoButton && state.testPageAutoButton.getAttribute('aria-pressed') === 'true') {
        state.testPageAutoButton.click();
      }
      if (reason) setStatus(reason);
      syncButtonState();
    }

    function triggerLoadFallback() {
      if (isTestPlaygroundPage()) return;
      const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (maxTop <= 0) return;
      window.scrollTo({ top: maxTop, left: 0, behavior: 'auto' });
    }

    function startAutoScan() {
      if (state.autoScanActive) return;
      state.autoScanActive = true;
      state.stagnantCycles = 0;
      state.lastScanCount = state.albums.length;
      setStatus('Auto-loading albums...');

      if (isTestPlaygroundPage()) {
        const testAuto = document.getElementById('auto-load');
        if (testAuto) {
          state.testPageAutoButton = testAuto;
          if (testAuto.getAttribute('aria-pressed') !== 'true') testAuto.click();
        }
      }
      syncButtonState();

      state.autoScanTimer = setInterval(() => {
        if (!state.autoScanActive) return;

        scanAndFilter();

        if (state.albums.length > state.lastScanCount) {
          state.lastScanCount = state.albums.length;
          state.stagnantCycles = 0;
          return;
        }

        if (isTestPlaygroundPage()) {
          const end = document.querySelector('[data-af-end]');
          const ended = !!end && !end.classList.contains('hidden');
          if (ended) {
            stopAutoScan(`Complete. Loaded ${state.albums.length} albums.`);
          }
          return;
        }

        state.stagnantCycles += 1;
        if (state.stagnantCycles === 1) {
          triggerLoadFallback();
        }
        if (state.stagnantCycles >= MAX_STAGNANT_CYCLES) {
          stopAutoScan(`Auto-scan stopped. No new albums after ${state.stagnantCycles} checks.`);
        }
      }, 1300);
    }

    function scheduleRescan() {
      if (state.rescanTimer) clearTimeout(state.rescanTimer);
      state.rescanTimer = setTimeout(() => {
        scanAndFilter();
      }, 250);
    }

    function closePanel() {
      stopAutoScan();
      if (state.observer) state.observer.disconnect();
      if (state.rescanTimer) clearTimeout(state.rescanTimer);
      clearPendingHideTimers();
      clearCompactLayout();
      setTestScrollLoadGuard(false);
      setQueryActiveMode(false);
      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();
      document.querySelectorAll(`.${MATCHED_CLASS}`).forEach(node => {
        node.classList.remove(MATCHED_CLASS);
      });
      document.querySelectorAll(`.${PENDING_CLASS}`).forEach(node => {
        node.classList.remove(PENDING_CLASS);
      });
      panel.remove();
      delete window.__albumFilterApp;
      removeInlineNotice();
      showToast('Table Filter closed.', { level: 'expired', duration: 1600 });
    }

    const closeBtn = panel.querySelector('.af-close');
    closeBtn.addEventListener('click', () => {
      closePanel();
    });

    panel.addEventListener('click', event => {
      const target = event.target.closest('button[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action === 'scan') {
        scanAndFilter();
        setStatus(`Refreshed. Albums loaded: ${state.albums.length}`);
        syncButtonState();
        return;
      }
      if (action === 'auto') {
        if (state.autoScanActive) {
          stopAutoScan('Auto-load stopped.');
        } else {
          startAutoScan();
        }
        return;
      }
      if (action === 'stop') {
        stopAutoScan('Auto-load stopped.');
        return;
      }
    });

    clearBtn.addEventListener('click', () => {
      if (!state.query) return;
      state.query = '';
      input.value = '';
      applyFilter();
      setStatus(`Filter cleared. Albums loaded: ${state.albums.length}`);
      syncButtonState();
      input.focus({ preventScroll: true });
    });

    input.addEventListener('input', () => {
      state.query = input.value || '';
      applyFilter();
      syncButtonState();
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePanel();
    });

    state.observer = new MutationObserver(() => {
      if (!state.autoScanActive && hasActiveQuery()) {
        scheduleRescan();
        return;
      }
      scheduleRescan();
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scanAndFilter();
    stopTestPageAutoIfRunning();
    syncButtonState();
    setTimeout(() => {
      if (document.body.contains(panel)) input.focus({ preventScroll: true });
    }, 0);

    return {
      __version: APP_VERSION,
      destroy() {
        stopAutoScan();
        if (state.observer) state.observer.disconnect();
        if (state.rescanTimer) clearTimeout(state.rescanTimer);
        clearPendingHideTimers();
        clearCompactLayout();
        setTestScrollLoadGuard(false);
        setQueryActiveMode(false);
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
        document.querySelectorAll(`.${MATCHED_CLASS}`).forEach(node => {
          node.classList.remove(MATCHED_CLASS);
        });
        document.querySelectorAll(`.${PENDING_CLASS}`).forEach(node => {
          node.classList.remove(PENDING_CLASS);
        });
        removeInlineNotice();
        if (panel && panel.parentNode) panel.remove();
      },
      reactivate() {
        if (!document.body.contains(panel)) {
          document.body.appendChild(panel);
        }
        stopTestPageAutoIfRunning();
        scanAndFilter();
        input.focus({ preventScroll: true });
      }
    };
  }

  async function run() {
    if (!isSupportedPage()) {
      showToast('No supported album list found on this page.', { level: 'error' });
      return;
    }

    const existingApp = window.__albumFilterApp;
    if (existingApp) {
      if (existingApp.__version === APP_VERSION && typeof existingApp.reactivate === 'function') {
        existingApp.reactivate();
        showToast('Table Filter ready.', { level: 'info' });
        return;
      }
      if (typeof existingApp.destroy === 'function') {
        existingApp.destroy();
      }
      const stalePanel = document.getElementById(PANEL_ID);
      if (stalePanel) stalePanel.remove();
      const staleStyle = document.getElementById(STYLE_ID);
      if (staleStyle) staleStyle.remove();
      delete window.__albumFilterApp;
    }

    window.__albumFilterApp = createApp();
    showToast('Table Filter injected.', { level: 'success' });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== 'showToast') return;
    showToast(message.text || '', {
      level: message.level || 'info',
      duration: typeof message.duration === 'number' ? message.duration : 1800
    });
    sendResponse({ ok: true });
    return true;
  });

  run();
})();
