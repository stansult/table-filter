const runButton = document.getElementById('run');

function getActiveTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    callback(tabs?.[0]?.id);
  });
}

function closeInjectedPanelIfOpen(tabId, callback) {
  if (!tabId) {
    callback(false);
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId },
      func: () => {
        const panelId = 'table-filter-panel';
        const styleId = 'table-filter-style';
        const hiddenClass = 'table-filter-card-hidden';

        const app = window.__albumFilterApp;
        if (app && typeof app.destroy === 'function') {
          app.destroy();
          delete window.__albumFilterApp;
          return true;
        }

        const panel = document.getElementById(panelId);
        const style = document.getElementById(styleId);
        if (!panel && !style) return false;

        if (panel) panel.remove();
        if (style) style.remove();
        document.querySelectorAll(`.${hiddenClass}`).forEach(node => {
          node.classList.remove(hiddenClass);
        });
        delete window.__albumFilterApp;
        return true;
      }
    },
    results => {
      if (chrome.runtime.lastError) {
        callback(false);
        return;
      }
      callback(!!results?.[0]?.result);
    }
  );
}

getActiveTab(tabId => {
  closeInjectedPanelIfOpen(tabId, wasClosed => {
    if (wasClosed) window.close();
  });
});

runButton.addEventListener('click', () => {
  getActiveTab(tabId => {
    chrome.runtime.sendMessage({ action: 'run', tabId }, () => {
      window.close();
    });
  });
});
