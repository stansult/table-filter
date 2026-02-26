chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'run') return;

  const tabId = message.tabId || sender?.tab?.id;
  if (!tabId) {
    sendResponse({ ok: false, error: 'No active tab context' });
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ['content.js']
    },
    () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    }
  );

  return true;
});

chrome.action.onClicked.addListener(tab => {
  const tabId = tab?.id;
  if (!tabId) return;

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
          return { toggled: 'closed' };
        }

        const panel = document.getElementById(panelId);
        const style = document.getElementById(styleId);
        if (panel || style) {
          if (panel) panel.remove();
          if (style) style.remove();
          document.querySelectorAll(`.${hiddenClass}`).forEach(node => {
            node.classList.remove(hiddenClass);
          });
          delete window.__albumFilterApp;
          return { toggled: 'closed' };
        }

        return { toggled: 'open' };
      }
    },
    results => {
      if (chrome.runtime.lastError) return;
      const state = results?.[0]?.result?.toggled;
      if (state !== 'open') {
        if (state === 'closed') {
          chrome.tabs.sendMessage(tabId, {
            action: 'showToast',
            text: 'Table Filter closed.',
            level: 'expired',
            duration: 1600
          }, () => {
            if (!chrome.runtime.lastError) return;
            chrome.scripting.executeScript({
              target: { tabId },
              func: () => {
                const existing = document.getElementById('table-filter-toast');
                if (existing) existing.remove();
                const toast = document.createElement('div');
                toast.id = 'table-filter-toast';
                toast.textContent = 'Table Filter closed.';
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
                  background: 'rgba(60, 60, 60, 0.75)',
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
                }, 1600);
              }
            });
          });
        }
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ['content.js']
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    }
  );
});
