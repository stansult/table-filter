(() => {
  const PANEL_ID = 'table-filter-pending-inline';
  const STYLE_ID = 'table-filter-style';
  const HIDDEN_CLASS = 'table-filter-row-hidden';
  const APP_KEY = '__tableFilterApp';
  const APP_VERSION = '4.2.0';
  const TOAST_ID = 'table-filter-toast';
  const TOAST_ACTION = 'showToast';
  const FILTER_OFF_TITLE = 'Pending filter: off';
  const FILTER_INVALID_TITLE = 'Pending filter: invalid number';
  const OPERATORS = ['=', '!=', '>=', '<=', '>', '<'];
  const SCAN_INTERVAL_MS = 420;
  const SCAN_STAGNANT_LIMIT = 14;
  const SCAN_MAX_CYCLES = 520;
  const SCAN_STEP_RATIO = 0.85;

  function showToast(text, level = 'info', duration = 1800) {
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.textContent = text;
    const background = level === 'success'
      ? 'rgba(20, 70, 40, 0.8)'
      : level === 'error'
        ? 'rgba(120, 30, 30, 0.88)'
        : level === 'expired'
          ? 'rgba(60, 60, 60, 0.78)'
          : 'rgba(20, 40, 70, 0.78)';

    Object.assign(toast.style, {
      position: 'fixed',
      top: '14px',
      right: '14px',
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
      setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CLASS} {
        display: none !important;
      }
      #${PANEL_ID} {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      #${PANEL_ID} .tf-inline-label {
        color: hsl(var(--muted-foreground, 215 16% 47%));
        font-size: 0.875rem;
        white-space: nowrap;
      }
      #${PANEL_ID} .tf-inline-status {
        color: hsl(var(--muted-foreground, 215 16% 47%));
        font-size: 0.75rem;
        white-space: nowrap;
      }
      #${PANEL_ID} .tf-inline-value {
        width: 84px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getHeaderCells(table) {
    if (table.tHead && table.tHead.rows && table.tHead.rows[0]) {
      return Array.from(table.tHead.rows[0].cells || []);
    }
    const firstRow = table.rows && table.rows[0];
    return firstRow ? Array.from(firstRow.cells || []) : [];
  }

  function getPendingColumnIndex(table) {
    const headers = getHeaderCells(table);
    for (let i = 0; i < headers.length; i += 1) {
      const cell = headers[i];
      const key = (cell?.getAttribute('data-adri') || '').toLowerCase();
      if (key === 'pending') return i;
      const text = (cell?.textContent || '').trim().toLowerCase();
      if (text === 'pending') return i;
    }
    return -1;
  }

  function findTargetTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    for (const table of tables) {
      if (getPendingColumnIndex(table) >= 0) return table;
    }
    return null;
  }

  function getDataRows(table) {
    if (!table) return [];
    if (table.tBodies && table.tBodies.length) {
      const rows = [];
      Array.from(table.tBodies).forEach(body => {
        if (body.dataset.tfSynthetic === '1') return;
        rows.push(...Array.from(body.rows || []));
      });
      return rows;
    }
    return Array.from(table.rows || []).slice(1);
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function parsePending(row, pendingColumnIndex) {
    const cell = row?.cells?.[pendingColumnIndex];
    const text = (cell?.textContent || '').trim();
    const match = text.match(/-?\d+/);
    return match ? Number(match[0]) : null;
  }

  function getRowKey(row) {
    const href = row?.querySelector('a[href]')?.getAttribute('href');
    if (href) return `href:${href}`;
    return '';
  }

  function buildRowEntry(row, pendingColumnIndex) {
    const pending = parsePending(row, pendingColumnIndex);
    if (pending == null || Number.isNaN(pending)) return null;

    const image = row?.querySelector('img');
    const cells = Array.from(row.cells || []).map(cell => {
      if (cell.querySelector('img')) return '';
      return normalizeText(cell.textContent || '');
    });
    const href = row?.querySelector('a[href]')?.getAttribute('href') || '';
    const key = getRowKey(row) || `row:${cells.join('|')}`;
    if (!key || key === 'row:') return null;

    return {
      key,
      pending,
      cells,
      href,
      imageSrc: image?.getAttribute('src') || '',
      imageAlt: normalizeText(image?.getAttribute('alt') || cells[1] || '')
    };
  }

  function getScrollContainer(table) {
    const wrap = table.closest('div.w-full.overflow-auto');
    if (wrap && wrap.scrollHeight > wrap.clientHeight + 10) return wrap;
    return document.scrollingElement || document.documentElement;
  }

  function compare(value, operator, target) {
    if (value == null || Number.isNaN(value)) return false;
    if (operator === '=') return value === target;
    if (operator === '!=') return value !== target;
    if (operator === '>=') return value >= target;
    if (operator === '<=') return value <= target;
    if (operator === '>') return value > target;
    if (operator === '<') return value < target;
    return true;
  }

  function clearHiddenRows(table) {
    getDataRows(table).forEach(row => row.classList.remove(HIDDEN_CLASS));
  }

  function findToolbarHost(table) {
    const card = table.closest('[data-slot="card"]');
    const scope = card?.parentElement || card || document.body;
    const inputs = Array.from(scope.querySelectorAll('input[placeholder*="Filter TV Shows" i], input[placeholder*="TV Shows" i], input[placeholder*="Filter" i]'));
    const primaryInput = inputs.find(input => {
      if (table.contains(input)) return false;
      if (!input || !input.isConnected) return false;
      const rect = input.getBoundingClientRect();
      return !!input.offsetParent && rect.width > 0 && rect.height > 0;
    }) || null;

    if (primaryInput) {
      const row = primaryInput.parentElement;
      if (row) return row;
    }
    return null;
  }

  function createApp() {
    const table = findTargetTable();
    if (!table) {
      showToast('No table with Pending column found on this page.', 'error');
      return null;
    }

    const pendingColumnIndex = getPendingColumnIndex(table);
    if (pendingColumnIndex < 0) {
      showToast('Pending column not found.', 'error');
      return null;
    }

    ensureStyles();

    if (!findToolbarHost(table)) {
      showToast('Filter row not found.', 'error');
      return null;
    }
    const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2';
    const inputClass = 'h-8 rounded-md border border-input bg-background px-2 text-sm';
    let panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'flex items-center gap-2';
    panel.style.display = 'inline-flex';
    panel.style.alignItems = 'center';
    panel.style.gap = '8px';
    panel.style.flexWrap = 'nowrap';
    panel.style.position = 'fixed';
    panel.style.zIndex = '999998';
    panel.style.background = 'transparent';

    const label = document.createElement('span');
    label.className = 'tf-inline-label';
    label.textContent = 'Unwatched';
    label.style.fontSize = '12px';
    label.style.whiteSpace = 'nowrap';

    const opSelect = document.createElement('select');
    opSelect.className = inputClass;
    opSelect.style.width = '64px';
    opSelect.style.minWidth = '64px';
    OPERATORS.forEach(op => {
      const option = document.createElement('option');
      option.value = op;
      option.textContent = op;
      opSelect.appendChild(option);
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.step = '1';
    valueInput.min = '0';
    valueInput.placeholder = 'value';
    valueInput.className = `${inputClass} tf-inline-value`;
    valueInput.style.width = '78px';
    valueInput.style.minWidth = '78px';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = buttonClass;
    clearBtn.textContent = 'x';
    clearBtn.setAttribute('aria-label', 'Clear pending filter');
    clearBtn.style.paddingLeft = '0.55rem';
    clearBtn.style.paddingRight = '0.55rem';

    panel.appendChild(label);
    panel.appendChild(opSelect);
    panel.appendChild(valueInput);
    panel.appendChild(clearBtn);

    const state = {
      cache: new Map(),
      scanTimer: null,
      scanRunning: false,
      scanComplete: false,
      datasetKey: `${window.location.pathname}${window.location.search}`,
      stagnantCycles: 0,
      cycles: 0,
      lastCount: 0,
      restoreScrollTop: 0,
      restoreWindowY: 0
    };
    const originalTbody = table.tBodies?.[0] || null;
    let syntheticTbody = null;
    const firstBodyRow = originalTbody?.querySelector('tr');
    const rowClassName = firstBodyRow?.className || '';
    const cellClassNames = Array.from(firstBodyRow?.querySelectorAll('td') || []).map(cell => cell.className || '');
    const defaultCellClassName = cellClassNames[0] || '';
    const columnCount = Math.max(getHeaderCells(table).length, 1);

    function mountPanel() {
      const refreshedHost = findToolbarHost(table);
      if (!refreshedHost) return;

      if (!panel.isConnected || panel.parentElement !== document.body) {
        document.body.appendChild(panel);
      }

      const visibleButtons = Array.from(refreshedHost.querySelectorAll('button'))
        .filter(button => {
          if (table.contains(button)) return false;
          if (!button.isConnected) return false;
          const rect = button.getBoundingClientRect();
          return !!button.offsetParent && rect.width > 0 && rect.height > 0;
        });
      const resetBtn = visibleButtons.find(button => {
        const text = (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return text.includes('reset');
      }) || null;
      const statusBtn = visibleButtons.find(button => {
        const text = (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return text.includes('status');
      }) || null;
      const anchor = resetBtn || visibleButtons[visibleButtons.length - 1] || statusBtn;

      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        const top = rect.top + Math.max(0, Math.round((rect.height - panel.offsetHeight) / 2));
        panel.style.top = `${Math.max(4, top)}px`;
        panel.style.left = `${Math.max(4, rect.right + 8)}px`;
        return;
      }

      const input = refreshedHost.querySelector('input[placeholder*="Filter TV Shows" i], input[placeholder*="TV Shows" i], input[placeholder*="Filter" i]');
      if (input) {
        const rect = input.getBoundingClientRect();
        panel.style.top = `${Math.max(4, rect.top)}px`;
        panel.style.left = `${Math.max(4, rect.right + 8)}px`;
        return;
      }

      panel.style.top = '-9999px';
      panel.style.left = '-9999px';
    }

    mountPanel();

    function getDatasetKey() {
      return `${window.location.pathname}${window.location.search}`;
    }

    function resetCache() {
      state.cache.clear();
      state.scanComplete = false;
      state.datasetKey = getDatasetKey();
    }

    function syncDataset() {
      const nextKey = getDatasetKey();
      if (nextKey === state.datasetKey) return;
      stopScan({ restoreScroll: false });
      resetCache();
      restoreOriginalRows();
    }

    function stopScan(options = {}) {
      const { restoreScroll = true, markComplete = false } = options;
      if (state.scanTimer) {
        clearInterval(state.scanTimer);
        state.scanTimer = null;
      }
      if (markComplete) {
        state.scanComplete = true;
      }
      if (state.scanRunning && restoreScroll) {
        const scroller = getScrollContainer(table);
        if (scroller === (document.scrollingElement || document.documentElement)) {
          window.scrollTo({ top: state.restoreWindowY, left: 0, behavior: 'auto' });
        } else {
          scroller.scrollTop = state.restoreScrollTop;
        }
      }
      state.scanRunning = false;
    }

    function captureVisibleRows() {
      const rows = getDataRows(table);
      rows.forEach(row => {
        const entry = buildRowEntry(row, pendingColumnIndex);
        if (!entry) return;
        state.cache.set(entry.key, entry);
      });
    }

    function restoreOriginalRows() {
      if (originalTbody) {
        originalTbody.style.display = '';
      }
      if (syntheticTbody && syntheticTbody.parentNode) {
        syntheticTbody.remove();
      }
      syntheticTbody = null;
    }

    function renderFilteredRows(matches) {
      if (!originalTbody) return;

      restoreOriginalRows();

      syntheticTbody = document.createElement('tbody');
      syntheticTbody.dataset.tfSynthetic = '1';
      syntheticTbody.className = originalTbody.className || '';

      if (!matches.length) {
        const tr = document.createElement('tr');
        if (rowClassName) tr.className = rowClassName;
        const td = document.createElement('td');
        td.colSpan = columnCount;
        if (defaultCellClassName) td.className = defaultCellClassName;
        td.textContent = 'No matching rows';
        tr.appendChild(td);
        syntheticTbody.appendChild(tr);
      } else {
        matches.forEach(entry => {
          const tr = document.createElement('tr');
          if (rowClassName) tr.className = rowClassName;

          for (let i = 0; i < columnCount; i += 1) {
            const td = document.createElement('td');
            const cellClassName = cellClassNames[i] || defaultCellClassName;
            if (cellClassName) td.className = cellClassName;
            const text = entry.cells[i] || '';

            if (i === 0 && entry.imageSrc) {
              const img = document.createElement('img');
              img.src = entry.imageSrc;
              img.alt = entry.imageAlt || '';
              img.loading = 'lazy';
              img.style.display = 'block';
              img.style.width = '100%';
              img.style.height = 'auto';

              if (entry.href) {
                const link = document.createElement('a');
                link.href = entry.href;
                link.appendChild(img);
                td.appendChild(link);
              } else {
                td.appendChild(img);
              }
            } else if (i === 1 && entry.href) {
              const link = document.createElement('a');
              link.href = entry.href;
              link.textContent = text || '(untitled)';
              td.appendChild(link);
            } else {
              td.textContent = text;
            }

            tr.appendChild(td);
          }

          syntheticTbody.appendChild(tr);
        });
      }

      originalTbody.style.display = 'none';
      originalTbody.insertAdjacentElement('afterend', syntheticTbody);
    }

    function maybeStartScan() {
      if (state.scanRunning || state.scanComplete) return;
      state.scanRunning = true;
      state.stagnantCycles = 0;
      state.cycles = 0;
      state.lastCount = state.cache.size;

      const scroller = getScrollContainer(table);
      const pageScroller = document.scrollingElement || document.documentElement;
      state.restoreWindowY = window.scrollY || window.pageYOffset || 0;
      state.restoreScrollTop = scroller.scrollTop || 0;

      if (scroller === pageScroller) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } else {
        scroller.scrollTop = 0;
      }

      state.scanTimer = setInterval(() => {
        captureVisibleRows();
        const currentCount = state.cache.size;

        if (currentCount > state.lastCount) {
          state.stagnantCycles = 0;
        } else {
          state.stagnantCycles += 1;
        }
        state.lastCount = currentCount;
        state.cycles += 1;

        if (scroller === pageScroller) {
          const doc = document.documentElement;
          const prev = window.scrollY || window.pageYOffset || 0;
          const maxTop = Math.max(0, doc.scrollHeight - window.innerHeight);
          const step = Math.max(120, Math.floor(window.innerHeight * SCAN_STEP_RATIO));
          const targetTop = Math.min(maxTop, prev + step);
          window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });
          const currentTop = window.scrollY || window.pageYOffset || 0;
          if (currentTop === prev) state.stagnantCycles += 1;
        } else {
          const prev = scroller.scrollTop;
          const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          const step = Math.max(120, Math.floor(scroller.clientHeight * SCAN_STEP_RATIO));
          scroller.scrollTop = Math.min(maxTop, prev + step);
          if (scroller.scrollTop === prev) state.stagnantCycles += 1;
        }

        if (state.stagnantCycles >= SCAN_STAGNANT_LIMIT || state.cycles >= SCAN_MAX_CYCLES) {
          stopScan({ restoreScroll: true, markComplete: true });
          applyFilter();
        }
      }, SCAN_INTERVAL_MS);
    }

    function applyFilter() {
      syncDataset();

      const raw = valueInput.value;
      if (raw === '' || raw == null) {
        stopScan({ restoreScroll: false });
        restoreOriginalRows();
        clearHiddenRows(table);
        panel.title = FILTER_OFF_TITLE;
        return;
      }

      const target = Number(raw);
      if (Number.isNaN(target) || target < 0) {
        stopScan({ restoreScroll: false });
        restoreOriginalRows();
        clearHiddenRows(table);
        panel.title = FILTER_INVALID_TITLE;
        return;
      }

      const operator = opSelect.value;

      captureVisibleRows();
      maybeStartScan();

      if (state.scanRunning) {
        restoreOriginalRows();
        clearHiddenRows(table);
        panel.title = `Pending filter ${operator} ${target}: scanning ${state.cache.size}`;
        return;
      }

      const matches = Array.from(state.cache.values()).filter(entry => compare(entry.pending, operator, target));
      renderFilteredRows(matches);
      panel.title = `Pending filter ${operator} ${target}: ${matches.length}/${state.cache.size}`;
    }

    const tbody = table.tBodies?.[0] || table;
    const observer = new MutationObserver(() => {
      mountPanel();
      applyFilter();
    });
    observer.observe(tbody, { childList: true, subtree: true });

    const hostRoot = table.closest('[data-slot="card"]') || document.body;
    const hostObserver = new MutationObserver(() => {
      mountPanel();
    });
    hostObserver.observe(hostRoot, { childList: true, subtree: true });
    window.addEventListener('scroll', mountPanel, true);
    window.addEventListener('resize', mountPanel);

    opSelect.addEventListener('change', applyFilter);
    valueInput.addEventListener('input', () => {
      if (valueInput.value !== '' && Number(valueInput.value) < 0) {
        valueInput.value = '0';
      }
      applyFilter();
    });

    clearBtn.addEventListener('click', () => {
      valueInput.value = '';
      stopScan({ restoreScroll: false });
      restoreOriginalRows();
      clearHiddenRows(table);
      panel.title = FILTER_OFF_TITLE;
      valueInput.focus({ preventScroll: true });
    });

    mountPanel();
    applyFilter();
    valueInput.focus({ preventScroll: true });

    return {
      __version: APP_VERSION,
      destroy() {
        observer.disconnect();
        hostObserver.disconnect();
        window.removeEventListener('scroll', mountPanel, true);
        window.removeEventListener('resize', mountPanel);
        stopScan({ restoreScroll: false });
        restoreOriginalRows();
        clearHiddenRows(table);
        if (panel && panel.parentNode) panel.remove();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
      },
      reactivate() {
        mountPanel();
        valueInput.focus({ preventScroll: true });
      }
    };
  }

  function run() {
    const existing = window[APP_KEY];
    if (existing) {
      if (existing.__version === APP_VERSION && typeof existing.reactivate === 'function') {
        existing.reactivate();
        showToast('Pending filter ready.', 'info');
        return;
      }
      if (typeof existing.destroy === 'function') existing.destroy();
      delete window[APP_KEY];
    }

    const app = createApp();
    if (!app) return;

    window[APP_KEY] = app;
    showToast('Pending filter injected.', 'success');
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== TOAST_ACTION) return;
    showToast(message.text || '', message.level || 'info', typeof message.duration === 'number' ? message.duration : 1800);
    sendResponse({ ok: true });
    return true;
  });

  run();
})();
