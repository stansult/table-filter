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
  const READY_TOAST_TEXT = 'Table Filter is ready to use';
  let toastHideTimer = null;
  let toastRemoveTimer = null;

  function getToastBackground(level) {
    if (level === 'success') return 'rgba(20, 70, 40, 0.8)';
    if (level === 'error') return 'rgba(120, 30, 30, 0.88)';
    if (level === 'expired') return 'rgba(60, 60, 60, 0.78)';
    if (level === 'progress') return 'rgba(45, 60, 80, 0.82)';
    return 'rgba(20, 40, 70, 0.78)';
  }

  function clearToastTimers() {
    if (toastHideTimer) {
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
    }
    if (toastRemoveTimer) {
      clearTimeout(toastRemoveTimer);
      toastRemoveTimer = null;
    }
  }

  function showToast(text, level = 'info', duration = 1800) {
    clearToastTimers();
    let toast = document.getElementById(TOAST_ID);
    const isNew = !toast;
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
    }
    toast.textContent = text;
    const background = getToastBackground(level);

    const style = {
      position: 'fixed',
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
    };

    if (level === 'progress') {
      style.top = '72px';
      style.left = '50%';
      style.right = 'auto';
      style.transform = 'translateX(-50%)';
    } else {
      style.top = '14px';
      style.right = '14px';
      style.left = 'auto';
      style.transform = 'none';
    }

    Object.assign(toast.style, style);

    if (isNew) {
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
      });
    } else {
      toast.style.opacity = '1';
    }

    if (duration > 0) {
      toastHideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toastRemoveTimer = setTimeout(() => {
          toast.remove();
          toastRemoveTimer = null;
        }, 220);
        toastHideTimer = null;
      }, duration);
    }
  }

  function showProgressToast(foundCount) {
    showToast(`Table Filter is scanning all rows... ${foundCount} found`, 'progress', 0);
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

    const host = findToolbarHost(table);
    if (!host) {
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
    panel.style.display = 'flex';
    panel.style.alignItems = 'center';
    panel.style.gap = '8px';
    panel.style.flexWrap = 'wrap';
    panel.style.flex = '1 1 auto';

    const searchWrap = document.createElement('div');
    searchWrap.style.position = 'relative';
    searchWrap.style.display = 'inline-flex';
    searchWrap.style.alignItems = 'center';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Filter TV Shows...';
    searchInput.className = inputClass;
    searchInput.style.width = '250px';
    searchInput.style.minWidth = '220px';
    searchInput.style.paddingRight = '28px';

    const searchClearBtn = document.createElement('button');
    searchClearBtn.type = 'button';
    searchClearBtn.className = buttonClass;
    searchClearBtn.textContent = '×';
    searchClearBtn.setAttribute('aria-label', 'Clear search filter');
    searchClearBtn.style.position = 'absolute';
    searchClearBtn.style.right = '4px';
    searchClearBtn.style.top = '50%';
    searchClearBtn.style.transform = 'translateY(-50%)';
    searchClearBtn.style.height = '22px';
    searchClearBtn.style.minWidth = '22px';
    searchClearBtn.style.padding = '0';
    searchClearBtn.style.border = '0';
    searchClearBtn.style.background = 'transparent';
    searchClearBtn.style.boxShadow = 'none';
    searchClearBtn.style.fontSize = '16px';
    searchClearBtn.style.lineHeight = '1';

    searchWrap.appendChild(searchInput);
    searchWrap.appendChild(searchClearBtn);

    const statusWrap = document.createElement('div');
    statusWrap.style.position = 'relative';
    statusWrap.style.display = 'inline-flex';
    statusWrap.style.alignItems = 'center';

    const statusButton = document.createElement('button');
    statusButton.type = 'button';
    statusButton.className = buttonClass;
    statusButton.textContent = 'Status';
    statusButton.style.minWidth = '120px';

    const statusMenu = document.createElement('div');
    statusMenu.style.position = 'absolute';
    statusMenu.style.top = 'calc(100% + 6px)';
    statusMenu.style.left = '0';
    statusMenu.style.minWidth = '180px';
    statusMenu.style.maxHeight = '240px';
    statusMenu.style.overflow = 'auto';
    statusMenu.style.padding = '8px';
    statusMenu.style.border = '1px solid rgba(148, 163, 184, 0.35)';
    statusMenu.style.borderRadius = '8px';
    statusMenu.style.background = '#fff';
    statusMenu.style.boxShadow = '0 10px 25px rgba(0,0,0,0.12)';
    statusMenu.style.display = 'none';
    statusMenu.style.zIndex = '999999';

    statusWrap.appendChild(statusButton);
    statusWrap.appendChild(statusMenu);

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
    clearBtn.textContent = '×';
    clearBtn.setAttribute('aria-label', 'Clear pending filter');
    clearBtn.style.paddingLeft = '0.55rem';
    clearBtn.style.paddingRight = '0.55rem';

    const rescanBtn = document.createElement('button');
    rescanBtn.type = 'button';
    rescanBtn.className = buttonClass;
    rescanBtn.textContent = 'Rescan';

    panel.appendChild(searchWrap);
    panel.appendChild(statusWrap);
    panel.appendChild(label);
    panel.appendChild(opSelect);
    panel.appendChild(valueInput);
    panel.appendChild(clearBtn);
    panel.appendChild(rescanBtn);

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
      restoreWindowY: 0,
      nextOrder: 0,
      sortKey: '',
      sortDir: 'asc',
      selectedStatuses: new Set()
    };
    const originalTbody = table.tBodies?.[0] || null;
    const originalTableDisplay = table.style.display;
    const originalTableLayout = table.style.tableLayout;
    let syntheticTbody = null;
    const firstBodyRow = originalTbody?.querySelector('tr');
    const rowClassName = firstBodyRow?.className || '';
    const cellClassNames = Array.from(firstBodyRow?.querySelectorAll('td') || []).map(cell => cell.className || '');
    const defaultCellClassName = cellClassNames[0] || '';
    const indexCellClassName = cellClassNames[1] || defaultCellClassName;
    const originalThead = table.tHead || null;
    const headers = getHeaderCells(table);
    const columnCount = Math.max(headers.length, 1);
    const sourceTableWidth = Math.round(table.getBoundingClientRect().width);
    const sourceColumnWidths = headers.map(header => Math.round(header.getBoundingClientRect().width));
    const headerClassNames = headers.map(header => header.className || '');
    const defaultHeaderClassName = headerClassNames[0] || '';
    const indexHeaderClassName = headerClassNames[1] || defaultHeaderClassName;
    const columnKeys = headers.map((header, index) => {
      const key = (header?.getAttribute('data-adri') || '').toLowerCase();
      if (key) return key;
      return normalizeText(header?.textContent || '').toLowerCase() || `col${index}`;
    });
    const getColumnIndex = (...keys) => columnKeys.findIndex(key => keys.includes(key));
    const nameColumnIndex = getColumnIndex('name');
    const statusColumnIndex = getColumnIndex('status');
    const pendingDataColumnIndex = getColumnIndex('pending');
    const addedColumnIndex = getColumnIndex('added', 'followed on');
    const showStatusColumnIndex = getColumnIndex('show status');
    const progressColumnIndex = getColumnIndex('progress');
    const toolbarRow = host.parentElement;
    const hostChildren = Array.from(host.children);
    const hostChildDisplays = hostChildren.map(node => node.style.display);
    const toolbarStickyState = toolbarRow ? {
      position: toolbarRow.style.position,
      top: toolbarRow.style.top,
      zIndex: toolbarRow.style.zIndex,
      background: toolbarRow.style.background,
      paddingTop: toolbarRow.style.paddingTop,
      paddingBottom: toolbarRow.style.paddingBottom
    } : null;
    const rightPane = toolbarRow
      ? Array.from(toolbarRow.children).find(child => child !== host) || null
      : null;
    const viewButton = rightPane
      ? Array.from(rightPane.querySelectorAll('button')).find(node => /view/i.test(normalizeText(node.textContent || ''))) || null
      : null;
    const viewButtonDisplay = viewButton ? viewButton.style.display : '';
    const summaryNode = rightPane
      ? Array.from(rightPane.querySelectorAll('div')).find(node => /tv shows/i.test(normalizeText(node.textContent || ''))) || null
      : null;
    const originalSummaryText = summaryNode ? summaryNode.textContent : '';
    const summaryMatch = (originalSummaryText || '').match(/(\d+)\s*\/\s*(\d+)/);
    const sourceTotal = summaryMatch ? Number(summaryMatch[2]) : 0;
    const heroTitle = Array.from(document.querySelectorAll('div, h1, h2'))
      .find(node => normalizeText(node.textContent || '') === 'My Shows') || null;
    const heroLayout = heroTitle ? heroTitle.parentElement : null;
    const heroCards = heroTitle && heroTitle.nextElementSibling && heroTitle.nextElementSibling.tagName === 'DIV'
      ? heroTitle.nextElementSibling
      : null;
    const heroSection = heroTitle ? heroTitle.closest('.bg-black') : null;
    const heroBottomStrip = heroSection
      ? Array.from(heroSection.querySelectorAll('div')).find(node =>
        node.classList.contains('absolute') &&
        node.classList.contains('bottom-0') &&
        node.classList.contains('rounded-t-xl') &&
        node.classList.contains('bg-background-200')) || null
      : null;
    const heroRelativeWrap = heroBottomStrip ? heroBottomStrip.parentElement : null;
    const heroState = {
      cardsDisplay: heroCards ? heroCards.style.display : '',
      bottomStripDisplay: heroBottomStrip ? heroBottomStrip.style.display : '',
      layoutGap: heroLayout ? heroLayout.style.gap : '',
      layoutPaddingTop: heroLayout ? heroLayout.style.paddingTop : '',
      layoutPaddingBottom: heroLayout ? heroLayout.style.paddingBottom : '',
      relativeMarginBottom: heroRelativeWrap ? heroRelativeWrap.style.marginBottom : ''
    };
    const controls = [searchInput, searchClearBtn, statusButton, opSelect, valueInput, clearBtn, rescanBtn];
    const sortCleanup = [];
    let syntheticThead = null;
    let syntheticColgroup = null;
    const headerState = new Map();
    let floatingHeaderWrap = null;
    let floatingThead = null;
    const floatingHeaderState = new Map();
    const stickySurface = toolbarRow?.closest('.bg-background-200') || toolbarRow;
    const stickySurfaceColor = stickySurface ? window.getComputedStyle(stickySurface).backgroundColor : '';
    const stickyHeaderBackground =
      stickySurfaceColor && stickySurfaceColor !== 'rgba(0, 0, 0, 0)' && stickySurfaceColor !== 'transparent'
        ? stickySurfaceColor
        : 'rgb(226, 232, 240)';

    function getDatasetKey() {
      return `${window.location.pathname}${window.location.search}`;
    }

    function getTopNavHeight() {
      const fixedTop = document.querySelector('body > div > div.fixed.inset-x-0.top-0');
      if (!fixedTop) return 0;
      const rect = fixedTop.getBoundingClientRect();
      return Math.max(0, Math.round(rect.height));
    }

    function getToolbarStickyTop() {
      return getTopNavHeight();
    }

    function getHeaderStickyTop() {
      if (!toolbarRow) return getTopNavHeight();
      return getTopNavHeight() + Math.round(toolbarRow.getBoundingClientRect().height);
    }

    function setControlsDisabled(disabled) {
      controls.forEach(control => {
        control.disabled = disabled;
      });
    }

    function updateSummary(visible, total, prefix = '') {
      if (!summaryNode) return;
      if (prefix) {
        summaryNode.textContent = prefix;
        return;
      }
      summaryNode.textContent = `${visible}/${total} TV Shows`;
    }

    function applyHeroCollapse() {
      if (!heroTitle || !heroLayout) return;
      if (heroCards) {
        heroCards.style.display = 'none';
      }
      if (heroBottomStrip) {
        heroBottomStrip.style.display = 'none';
      }
      if (heroRelativeWrap) {
        heroRelativeWrap.style.marginBottom = '0';
      }
      heroLayout.style.gap = '0';
      heroLayout.style.paddingTop = '1.25rem';
      heroLayout.style.paddingBottom = '1rem';
    }

    function restoreHeroLayout() {
      if (heroCards) {
        heroCards.style.display = heroState.cardsDisplay;
      }
      if (heroBottomStrip) {
        heroBottomStrip.style.display = heroState.bottomStripDisplay;
      }
      if (heroRelativeWrap) {
        heroRelativeWrap.style.marginBottom = heroState.relativeMarginBottom;
      }
      if (heroLayout) {
        heroLayout.style.gap = heroState.layoutGap;
        heroLayout.style.paddingTop = heroState.layoutPaddingTop;
        heroLayout.style.paddingBottom = heroState.layoutPaddingBottom;
      }
    }

    function applyToolbarSticky() {
      if (!toolbarRow) return;
      toolbarRow.style.position = 'sticky';
      toolbarRow.style.top = `${getToolbarStickyTop()}px`;
      toolbarRow.style.zIndex = '30';
      toolbarRow.style.background = stickyHeaderBackground;
      toolbarRow.style.paddingTop = '0.25rem';
      toolbarRow.style.paddingBottom = '0.25rem';
    }

    function restoreToolbarSticky() {
      if (!toolbarRow || !toolbarStickyState) return;
      toolbarRow.style.position = toolbarStickyState.position;
      toolbarRow.style.top = toolbarStickyState.top;
      toolbarRow.style.zIndex = toolbarStickyState.zIndex;
      toolbarRow.style.background = toolbarStickyState.background;
      toolbarRow.style.paddingTop = toolbarStickyState.paddingTop;
      toolbarRow.style.paddingBottom = toolbarStickyState.paddingBottom;
    }

    function removeFloatingHeader() {
      if (floatingHeaderWrap && floatingHeaderWrap.parentNode) {
        floatingHeaderWrap.remove();
      }
      floatingHeaderWrap = null;
      floatingThead = null;
    }

    function syncFloatingHeader() {
      if (!syntheticThead || !floatingHeaderWrap || !floatingThead) return;

      const tableRect = table.getBoundingClientRect();
      const headerRect = syntheticThead.getBoundingClientRect();
      const stickyTop = getHeaderStickyTop();
      const sourceRow = syntheticThead.rows?.[0];
      const floatingRow = floatingThead.rows?.[0];
      const floatingTable = floatingHeaderWrap.querySelector('table');

      floatingThead.style.background = stickyHeaderBackground;
      if (floatingRow) {
        floatingRow.style.background = stickyHeaderBackground;
      }
      floatingHeaderWrap.style.top = `${stickyTop}px`;
      floatingHeaderWrap.style.left = `${Math.round(tableRect.left)}px`;
      floatingHeaderWrap.style.width = `${Math.round(tableRect.width)}px`;

      if (floatingTable) {
        floatingTable.style.width = `${Math.round(tableRect.width)}px`;
      }

      const sourceCells = Array.from(sourceRow?.cells || []);
      const floatingCells = Array.from(floatingRow?.cells || []);
      floatingCells.forEach((cell, index) => {
        const sourceCell = sourceCells[index];
        if (!sourceCell) return;
        const width = Math.max(1, Math.round(sourceCell.getBoundingClientRect().width));
        cell.style.width = `${width}px`;
        cell.style.minWidth = `${width}px`;
        cell.style.maxWidth = `${width}px`;
        cell.style.background = stickyHeaderBackground;
      });

      const shouldShow =
        tableRect.width > 0 &&
        headerRect.top <= stickyTop &&
        tableRect.bottom > stickyTop + headerRect.height;
      floatingHeaderWrap.style.display = shouldShow ? 'block' : 'none';
    }

    function ensureFloatingHeader() {
      if (!syntheticThead || floatingHeaderWrap) return;

      floatingHeaderWrap = document.createElement('div');
      floatingHeaderWrap.dataset.tfFloatingHeader = '1';
      floatingHeaderWrap.style.position = 'fixed';
      floatingHeaderWrap.style.left = '0';
      floatingHeaderWrap.style.top = '0';
      floatingHeaderWrap.style.zIndex = '25';
      floatingHeaderWrap.style.display = 'none';
      floatingHeaderWrap.style.overflow = 'hidden';
      floatingHeaderWrap.style.boxSizing = 'border-box';
      floatingHeaderWrap.style.background = stickyHeaderBackground;

      const floatingTable = document.createElement('table');
      floatingTable.className = table.className || '';
      floatingTable.style.tableLayout = 'fixed';
      floatingTable.style.display = 'table';
      floatingTable.style.margin = '0';
      floatingTable.style.width = '100%';
      floatingTable.style.background = stickyHeaderBackground;

      floatingThead = syntheticThead.cloneNode(true);
      floatingThead.querySelectorAll('[id]').forEach(node => {
        node.removeAttribute('id');
      });

      floatingHeaderWrap.appendChild(floatingTable);
      floatingTable.appendChild(floatingThead);
      document.body.appendChild(floatingHeaderWrap);

      syncFloatingHeader();
    }

    function resetCache() {
      state.cache.clear();
      state.scanComplete = false;
      state.datasetKey = getDatasetKey();
      state.nextOrder = 0;
      state.selectedStatuses.clear();
      statusMenu.innerHTML = '';
      statusButton.textContent = 'Status';
    }

    function updateStatusButtonLabel() {
      const count = state.selectedStatuses.size;
      statusButton.textContent = count ? `Status (${count})` : 'Status';
    }

    function buildStatusOptions() {
      const previous = new Set(state.selectedStatuses);
      state.selectedStatuses.clear();
      statusMenu.innerHTML = '';
      const statuses = Array.from(new Set(Array.from(state.cache.values())
        .map(entry => entry.status)
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));

      if (!statuses.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No statuses';
        empty.style.fontSize = '13px';
        empty.style.color = '#64748b';
        statusMenu.appendChild(empty);
      }

      statuses.forEach(status => {
        const item = document.createElement('label');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        item.style.fontSize = '13px';
        item.style.padding = '4px 0';
        item.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = status;
        checkbox.checked = previous.has(status);
        if (checkbox.checked) {
          state.selectedStatuses.add(status);
        }
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            state.selectedStatuses.add(status);
          } else {
            state.selectedStatuses.delete(status);
          }
          updateStatusButtonLabel();
          applyLocalFilters();
        });

        const text = document.createElement('span');
        text.textContent = status;

        item.appendChild(checkbox);
        item.appendChild(text);
        statusMenu.appendChild(item);
      });
      updateStatusButtonLabel();
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
        const existing = state.cache.get(entry.key);
        entry.order = existing?.order ?? state.nextOrder;
        if (!existing) {
          state.nextOrder += 1;
        }
        entry.name = nameColumnIndex >= 0 ? (entry.cells[nameColumnIndex] || '') : '';
        entry.status = statusColumnIndex >= 0 ? (entry.cells[statusColumnIndex] || '') : '';
        entry.showStatus = showStatusColumnIndex >= 0 ? (entry.cells[showStatusColumnIndex] || '') : '';
        entry.added = addedColumnIndex >= 0 ? (entry.cells[addedColumnIndex] || '') : '';
        const progressText = progressColumnIndex >= 0 ? (entry.cells[progressColumnIndex] || '') : '';
        const progressMatch = progressText.match(/-?\d+/);
        entry.progress = progressMatch ? Number(progressMatch[0]) : null;
        entry.addedAt = Date.parse(entry.added || '') || 0;
        state.cache.set(entry.key, entry);
      });
    }

    function restoreOriginalRows() {
      table.style.display = originalTableDisplay;
      table.style.tableLayout = originalTableLayout;
      if (originalTbody) {
        originalTbody.style.display = '';
      }
      if (syntheticTbody && syntheticTbody.parentNode) {
        syntheticTbody.remove();
      }
      syntheticTbody = null;
    }

    function restoreOriginalHeader() {
      sortCleanup.splice(0, sortCleanup.length).forEach(unbind => unbind());
      if (syntheticColgroup && syntheticColgroup.parentNode) {
        syntheticColgroup.remove();
      }
      syntheticColgroup = null;
      if (syntheticThead && syntheticThead.parentNode) {
        syntheticThead.remove();
      }
      syntheticThead = null;
      removeFloatingHeader();
      floatingHeaderState.clear();
      if (originalThead) {
        originalThead.style.display = '';
      }
    }

    function registerSortHandlers(headerCells, targetState) {
      targetState.clear();
      headerCells.forEach((header, index) => {
        const key = columnKeys[index];
        if (key === 'image') return;

        const marker = header.querySelector('.tf-sort-marker');
        targetState.set(key, { header, marker });

        const handleSort = event => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }
          if (!state.scanComplete) return;
          setSort(key);
        };

        header.style.cursor = 'pointer';
        header.addEventListener('click', handleSort, true);
        const button = header.querySelector('button');
        if (button) {
          button.addEventListener('click', handleSort, true);
        }

        sortCleanup.push(() => {
          header.removeEventListener('click', handleSort, true);
          if (button) {
            button.removeEventListener('click', handleSort, true);
          }
        });
      });
    }

    function bindSortHandlers(headerCells, floatingHeaderCells = []) {
      sortCleanup.splice(0, sortCleanup.length).forEach(unbind => unbind());
      headerState.clear();
      floatingHeaderState.clear();
      registerSortHandlers(headerCells, headerState);
      if (floatingHeaderCells.length) {
        registerSortHandlers(floatingHeaderCells, floatingHeaderState);
      }
      updateSortIndicators();
    }

    function useStaticTableLayout(element, display) {
      element.style.display = display;
      element.style.position = 'static';
      element.style.inset = 'auto';
      element.style.gridColumn = 'auto';
      element.style.gridRow = 'auto';
      element.style.order = '0';
      element.style.transform = 'none';
    }

    function ensureSyntheticColumns() {
      if (syntheticColgroup) return;

      const indexWidth = 56;
      const availableWidth = Math.max(1, sourceTableWidth - indexWidth);
      const totalSourceWidth = sourceColumnWidths.reduce((total, width) => total + width, 0) || 1;

      syntheticColgroup = document.createElement('colgroup');
      syntheticColgroup.dataset.tfSynthetic = '1';

      const indexCol = document.createElement('col');
      indexCol.style.width = `${indexWidth}px`;
      syntheticColgroup.appendChild(indexCol);

      sourceColumnWidths.forEach(width => {
        const col = document.createElement('col');
        col.style.width = `${Math.max(1, Math.round((width / totalSourceWidth) * availableWidth))}px`;
        syntheticColgroup.appendChild(col);
      });

      table.insertBefore(syntheticColgroup, table.firstChild);
    }

    function ensureSyntheticHeader() {
      if (!originalThead || syntheticThead) return;
      syntheticThead = originalThead.cloneNode(true);
      syntheticThead.dataset.tfSynthetic = '1';
      syntheticThead.querySelectorAll('[id]').forEach(node => {
        node.removeAttribute('id');
      });
      syntheticThead.querySelectorAll('svg').forEach(node => {
        node.remove();
      });

      const headerRow = syntheticThead.rows?.[0];
      if (headerRow) {
        useStaticTableLayout(syntheticThead, 'table-header-group');
        useStaticTableLayout(headerRow, 'table-row');
        const blankHeader = document.createElement('th');
        if (indexHeaderClassName) blankHeader.className = indexHeaderClassName;
        blankHeader.textContent = '#';
        blankHeader.style.width = '56px';
        blankHeader.style.minWidth = '56px';
        headerRow.insertBefore(blankHeader, headerRow.firstChild);

        Array.from(headerRow.cells || []).forEach((header, headerIndex) => {
          useStaticTableLayout(header, 'table-cell');
          if (headerIndex === 0) return;
          const index = headerIndex - 1;
          const key = columnKeys[index];
          if (key === 'image') return;

          const marker = document.createElement('span');
          marker.className = 'tf-sort-marker';
          marker.textContent = '↕';
          marker.style.display = 'inline-block';
          marker.style.marginLeft = '8px';
          marker.style.fontSize = '14px';
          marker.style.lineHeight = '1';
          marker.style.opacity = '0.75';

          const button = header.querySelector('button');
          if (button) {
            button.appendChild(marker);
          } else {
            header.appendChild(marker);
          }
        });

      }

      originalThead.style.display = 'none';
      ensureSyntheticColumns();
      table.insertBefore(syntheticThead, originalThead);
      ensureFloatingHeader();

      const syntheticHeaderCells = Array.from(headerRow?.cells || []).slice(1);
      const floatingHeaderCells = Array.from(floatingThead?.rows?.[0]?.cells || []).slice(1);
      bindSortHandlers(syntheticHeaderCells, floatingHeaderCells);
      syncFloatingHeader();
    }

    function renderRows(rows) {
      if (!originalTbody) return;

      restoreOriginalRows();
      ensureSyntheticHeader();

      syntheticTbody = document.createElement('tbody');
      syntheticTbody.dataset.tfSynthetic = '1';
      // The source tbody is a virtualizer viewport (`relative block` with a
      // fixed height). Results are static rows, so they need normal table flow.
      useStaticTableLayout(syntheticTbody, 'table-row-group');
      syntheticTbody.style.height = 'auto';
      syntheticTbody.style.contain = 'none';

      if (!rows.length) {
        const tr = document.createElement('tr');
        if (rowClassName) tr.className = rowClassName;
        useStaticTableLayout(tr, 'table-row');
        const td = document.createElement('td');
        td.colSpan = columnCount + 1;
        if (indexCellClassName) td.className = indexCellClassName;
        useStaticTableLayout(td, 'table-cell');
        td.textContent = 'No matching rows';
        tr.appendChild(td);
        syntheticTbody.appendChild(tr);
      } else {
        rows.forEach((entry, rowIndex) => {
          const tr = document.createElement('tr');
          if (rowClassName) tr.className = rowClassName;
          useStaticTableLayout(tr, 'table-row');
          tr.style.height = 'auto';

          const indexTd = document.createElement('td');
          if (indexCellClassName) indexTd.className = indexCellClassName;
          useStaticTableLayout(indexTd, 'table-cell');
          indexTd.style.paddingTop = '0.6rem';
          indexTd.style.paddingBottom = '0.6rem';
          indexTd.style.lineHeight = '1.25';
          indexTd.textContent = String(rowIndex + 1);
          tr.appendChild(indexTd);

          for (let i = 0; i < columnCount; i += 1) {
            const td = document.createElement('td');
            const cellClassName = cellClassNames[i] || defaultCellClassName;
            if (cellClassName) td.className = cellClassName;
            useStaticTableLayout(td, 'table-cell');
            if (i !== 0) {
              td.style.paddingTop = '0.6rem';
              td.style.paddingBottom = '0.6rem';
              td.style.lineHeight = '1.25';
            }
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
              link.style.lineHeight = '1.25';
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
      // TrackSeries uses a CSS grid for its virtualized source table. Static
      // extension results need normal table layout so their rows get height.
      table.style.display = 'table';
      table.style.tableLayout = 'fixed';
      syncFloatingHeader();
    }

    function compareEntries(a, b, key) {
      if (key === 'name') {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      if (key === 'status') {
        return (a.status || '').localeCompare(b.status || '', undefined, { sensitivity: 'base' });
      }
      if (key === 'show status') {
        return (a.showStatus || '').localeCompare(b.showStatus || '', undefined, { sensitivity: 'base' });
      }
      if (key === 'image') {
        return (a.imageAlt || a.name || '').localeCompare(b.imageAlt || b.name || '', undefined, { sensitivity: 'base' });
      }
      if (key === 'pending') {
        return (a.pending ?? Number.NEGATIVE_INFINITY) - (b.pending ?? Number.NEGATIVE_INFINITY);
      }
      if (key === 'progress') {
        return (a.progress ?? Number.NEGATIVE_INFINITY) - (b.progress ?? Number.NEGATIVE_INFINITY);
      }
      if (key === 'added' || key === 'followed on') {
        return (a.addedAt || 0) - (b.addedAt || 0);
      }

      const columnIndex = columnKeys.indexOf(key);
      if (columnIndex < 0) return a.order - b.order;

      const aText = a.cells[columnIndex] || '';
      const bText = b.cells[columnIndex] || '';
      const aNumText = aText.replace(/[^0-9.-]+/g, '');
      const bNumText = bText.replace(/[^0-9.-]+/g, '');
      const aHasNum = aNumText !== '' && aNumText !== '-' && aNumText !== '.' && aNumText !== '-.';
      const bHasNum = bNumText !== '' && bNumText !== '-' && bNumText !== '.' && bNumText !== '-.';
      const aNum = aHasNum ? Number(aNumText) : Number.NaN;
      const bNum = bHasNum ? Number(bNumText) : Number.NaN;
      if (aHasNum && bHasNum) {
        return aNum - bNum;
      }
      return aText.localeCompare(bText, undefined, { sensitivity: 'base' });
    }

    function updateSortIndicators() {
      [headerState, floatingHeaderState].forEach(stateMap => {
        stateMap.forEach((value, key) => {
          const isActive = state.sortKey === key;
          const { header, marker } = value;
          if (header) {
            header.style.opacity = isActive ? '1' : '0.92';
          }
          if (marker) {
            marker.textContent = !isActive ? '↕' : state.sortDir === 'desc' ? '↓' : '↑';
            marker.style.opacity = isActive ? '1' : '0.75';
          }
        });
      });
    }

    function getVisibleEntries() {
      const searchTerm = normalizeText(searchInput.value || '').toLowerCase();
      const statusValues = state.selectedStatuses;
      const rawValue = valueInput.value;
      const hasPendingFilter = rawValue !== '' && rawValue != null;
      const pendingTarget = hasPendingFilter ? Number(rawValue) : null;
      const operator = opSelect.value;

      let entries = Array.from(state.cache.values()).filter(entry => {
        if (searchTerm && !(entry.name || '').toLowerCase().includes(searchTerm)) return false;
        if (statusValues.size && !statusValues.has(entry.status)) return false;
        if (hasPendingFilter && !Number.isNaN(pendingTarget) && pendingTarget >= 0) {
          if (!compare(entry.pending, operator, pendingTarget)) return false;
        }
        return true;
      });

      if (state.sortKey) {
        const direction = state.sortDir === 'desc' ? -1 : 1;
        entries = entries.slice().sort((a, b) => {
          const primary = compareEntries(a, b, state.sortKey) * direction;
          if (primary !== 0) return primary;
          return a.order - b.order;
        });
      } else {
        entries = entries.slice().sort((a, b) => a.order - b.order);
      }

      return entries;
    }

    function renderCurrentView() {
      if (!state.scanComplete) return;
      const rows = getVisibleEntries();
      renderRows(rows);
      updateSummary(rows.length, state.cache.size);
    }

    function setSort(key) {
      if (!key) return;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = (key === 'added' || key === 'followed on') ? 'desc' : 'asc';
      }
      updateSortIndicators();
      renderCurrentView();
    }

    function startScan() {
      if (state.scanRunning) return;
      const nextKey = getDatasetKey();
      if (nextKey !== state.datasetKey) {
        state.datasetKey = nextKey;
      }
      resetCache();
      restoreOriginalHeader();
      restoreOriginalRows();
      setControlsDisabled(true);
      updateSummary(0, 0, 'Scanning 0 TV Shows');
      showProgressToast(0);

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
        updateSummary(currentCount, currentCount, `Scanning ${currentCount} TV Shows`);
        showProgressToast(currentCount);

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

        const reachedKnownTotal = sourceTotal > 0 && currentCount >= sourceTotal;
        if (reachedKnownTotal || state.stagnantCycles >= SCAN_STAGNANT_LIMIT || state.cycles >= SCAN_MAX_CYCLES) {
          stopScan({ restoreScroll: true, markComplete: true });
          buildStatusOptions();
          setControlsDisabled(false);
          renderCurrentView();
          statusMenu.style.display = 'none';
          showToast(READY_TOAST_TEXT, 'success');
        }
      }, SCAN_INTERVAL_MS);
    }

    function applyLocalFilters() {
      if (valueInput.value !== '' && Number(valueInput.value) < 0) {
        valueInput.value = '0';
      }
      renderCurrentView();
    }

    hostChildren.forEach((node, index) => {
      node.style.display = 'none';
      node.dataset.tfHiddenByApp = '1';
      node.dataset.tfPrevDisplay = hostChildDisplays[index] || '';
    });
    applyHeroCollapse();
    applyToolbarSticky();
    if (viewButton) {
      viewButton.style.display = 'none';
    }
    host.appendChild(panel);
    setControlsDisabled(true);

    searchInput.addEventListener('input', applyLocalFilters);
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      renderCurrentView();
      searchInput.focus({ preventScroll: true });
    });
    statusButton.addEventListener('click', () => {
      if (statusButton.disabled) return;
      statusMenu.style.display = statusMenu.style.display === 'none' ? 'block' : 'none';
    });
    opSelect.addEventListener('change', applyLocalFilters);
    valueInput.addEventListener('input', applyLocalFilters);

    const onDocumentPointerDown = event => {
      if (!statusWrap.contains(event.target)) {
        statusMenu.style.display = 'none';
      }
    };
    const onWindowResize = () => {
      applyToolbarSticky();
      syncFloatingHeader();
    };
    const onWindowScroll = () => {
      syncFloatingHeader();
    };
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('scroll', onWindowScroll, true);

    clearBtn.addEventListener('click', () => {
      valueInput.value = '';
      renderCurrentView();
      valueInput.focus({ preventScroll: true });
    });

    rescanBtn.addEventListener('click', () => {
      startScan();
    });

    startScan();
    searchInput.focus({ preventScroll: true });

    return {
      __version: APP_VERSION,
      destroy() {
        document.removeEventListener('pointerdown', onDocumentPointerDown, true);
        window.removeEventListener('resize', onWindowResize);
        window.removeEventListener('scroll', onWindowScroll, true);
        stopScan({ restoreScroll: true });
        restoreOriginalHeader();
        restoreOriginalRows();
        clearHiddenRows(table);
        if (panel && panel.parentNode) panel.remove();
        hostChildren.forEach((node, index) => {
          node.style.display = hostChildDisplays[index] || '';
          delete node.dataset.tfHiddenByApp;
          delete node.dataset.tfPrevDisplay;
        });
        if (summaryNode) {
          summaryNode.textContent = originalSummaryText;
        }
        if (viewButton) {
          viewButton.style.display = viewButtonDisplay;
        }
        restoreToolbarSticky();
        restoreHeroLayout();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
      },
      reactivate() {
        searchInput.focus({ preventScroll: true });
      }
    };
  }

  function run() {
    const existing = window[APP_KEY];
    if (existing) {
      if (existing.__version === APP_VERSION && typeof existing.reactivate === 'function') {
        existing.reactivate();
        showToast(READY_TOAST_TEXT, 'success');
        return;
      }
      if (typeof existing.destroy === 'function') existing.destroy();
      delete window[APP_KEY];
    }

    const app = createApp();
    if (!app) return;

    window[APP_KEY] = app;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== TOAST_ACTION) return;
    showToast(message.text || '', message.level || 'info', typeof message.duration === 'number' ? message.duration : 1800);
    sendResponse({ ok: true });
    return true;
  });

  run();
})();
