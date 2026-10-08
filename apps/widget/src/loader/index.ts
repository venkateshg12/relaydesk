(() => {
  try {
    // 1. Identify script tag and public key
    const currentScript =
      (document.currentScript as HTMLScriptElement | null) ||
      (() => {
        const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-key]');
        return scripts.length > 0 ? scripts[scripts.length - 1] : null;
      })();

    if (!currentScript) {
      return;
    }

    const publicKey = currentScript.getAttribute('data-key');
    if (!publicKey) {
      return;
    }

    // Determine widget origin dynamically from the script src
    const scriptUrl = new URL(currentScript.src, window.location.href);
    const widgetOrigin = scriptUrl.origin;

    const initWidget = () => {
      // Prevent duplicate initialization
      if (document.getElementById('rd-widget-frame')) {
        return;
      }

      // 2. Create the host iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'rd-widget-frame';
      iframe.title = 'Chat';
      iframe.allow = 'clipboard-write';
      iframe.tabIndex = 0;

      // Sized to the launcher plus room for its shadow, 20px from the page's corner (the launcher sits
      // 20px inside the iframe). `rd:resize` grows it when the window opens.
      const frameStyle = iframe.style;
      frameStyle.position = 'fixed';
      frameStyle.border = 'none';
      frameStyle.outline = 'none';
      frameStyle.zIndex = '2147483647';
      frameStyle.colorScheme = 'normal';
      frameStyle.background = 'transparent';
      frameStyle.overflow = 'hidden';
      const setBox = (box: { top?: string; right?: string; bottom?: string; left?: string; width: string; height: string }) => {
        frameStyle.top = box.top ?? 'auto';
        frameStyle.left = box.left ?? 'auto';
        frameStyle.right = box.right ?? '0';
        frameStyle.bottom = box.bottom ?? '0';
        frameStyle.width = box.width;
        frameStyle.height = box.height;
      };
      setBox({ width: '96px', height: '96px' });

      // 3. Set iframe source
      const hostOrigin = window.location.origin;
      const frameUrl = `${widgetOrigin}/frame.html?key=${encodeURIComponent(publicKey)}&origin=${encodeURIComponent(hostOrigin)}`;
      iframe.src = frameUrl;

      // 4. Tell the frame where the visitor is, and how wide the window is (the frame can't know:
      // its own width is the iframe's).
      const sendContext = () => {
        try {
          if (!iframe.contentWindow) return;
          iframe.contentWindow.postMessage(
            {
              type: 'rd:context',
              url: window.location.href,
              title: document.title,
              referrer: document.referrer || '',
              viewport: window.innerWidth,
            },
            widgetOrigin
          );
        } catch {
          // Never throw to host page
        }
      };

      // 5. Handle messages from the frame — only from the widget's origin and its own window.
      window.addEventListener('message', (event) => {
        try {
          if (event.origin !== widgetOrigin || event.source !== iframe.contentWindow) return;

          const data = event.data;
          if (!data || typeof data !== 'object') return;

          if (data.type === 'rd:ready') {
            sendContext();
          } else if (data.type === 'rd:resize') {
            if (data.state === 'bubble') {
              setBox({ width: '96px', height: '96px' });
            } else if (data.state === 'open') {
              // 380px window + 20px margin each side; as tall as the window needs, never taller than the page.
              setBox({ width: '420px', height: 'min(748px, 100vh)' });
            } else if (data.state === 'fullscreen') {
              setBox({ top: '0', left: '0', width: '100vw', height: '100dvh' });
            }
          }
        } catch {
          // Guard host page
        }
      });

      // 6. SPA navigation observers
      window.addEventListener('popstate', () => {
        sendContext();
      });

      const originalPushState = history.pushState;
      if (originalPushState) {
        history.pushState = function (...args) {
          const result = originalPushState.apply(this, args);
          sendContext();
          return result;
        };
      }

      const originalReplaceState = history.replaceState;
      if (originalReplaceState) {
        history.replaceState = function (...args) {
          const result = originalReplaceState.apply(this, args);
          sendContext();
          return result;
        };
      }

      // A narrower or wider window can change what the frame should look like (phone vs desktop).
      window.addEventListener('resize', sendContext);

      // Deliver initial context once loaded
      iframe.addEventListener('load', () => {
        sendContext();
      });

      document.body.appendChild(iframe);
    };

    // Wait for window load if not already complete
    if (document.readyState === 'complete') {
      initWidget();
    } else {
      window.addEventListener('load', initWidget, { once: true });
    }
  } catch {
    // Total safety: never leak errors to the host
  }
})();
export {};
