/* ============================================
   FREE Embed — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ---- DOM References ----
  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.editor-pane');
  const previewIframe = document.getElementById('preview-iframe');
  const outputCode = document.getElementById('output-code');
  const btnCopy = document.getElementById('btn-copy');
  const btnCopyRaw = document.getElementById('btn-copy-raw');
  const btnRefresh = document.getElementById('btn-refresh');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');

  // ---- CodeMirror Instances ----
  const editors = {};

  const commonOptions = {
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    scrollbarStyle: 'native',
  };

  editors.html = CodeMirror.fromTextArea(document.getElementById('code-html'), {
    ...commonOptions,
    mode: 'htmlmixed',
    placeholder: 'Paste your HTML here…',
  });

  editors.css = CodeMirror.fromTextArea(document.getElementById('code-css'), {
    ...commonOptions,
    mode: 'css',
    placeholder: 'Paste your CSS here…',
  });

  editors.js = CodeMirror.fromTextArea(document.getElementById('code-js'), {
    ...commonOptions,
    mode: 'javascript',
    placeholder: 'Paste your JavaScript here…',
  });

  // Set starter code so preview isn't blank
  editors.html.setValue(`<div class="embed-container">\n  <h2>Hello Webflow 👋</h2>\n  <p>Edit this code and see it update live.</p>\n</div>`);
  editors.css.setValue(`.embed-container {\n  font-family: 'Inter', sans-serif;\n  text-align: center;\n  padding: 40px 20px;\n}\n\n.embed-container h2 {\n  font-size: 1.5rem;\n  margin-bottom: 8px;\n}\n\n.embed-container p {\n  color: #666;\n}`);
  editors.js.setValue(`// Your JavaScript goes here\nconsole.log('Embed loaded!');`);

  // ---- Tab Switching ----
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panes.forEach((p) => p.classList.remove('active'));
      document.getElementById(`pane-${target}`).classList.add('active');

      editors[target].refresh();
    });
  });

  // ---- Build combined HTML embed code ----
  function buildEmbedCode() {
    const html = editors.html.getValue().trim();
    const css = editors.css.getValue().trim();
    const js = editors.js.getValue().trim();

    let embed = '';

    if (css) {
      embed += `<style>\n${css}\n</style>\n\n`;
    }

    if (html) {
      embed += html;
    }

    if (js) {
      embed += `\n\n<script>\n${js}\n<\/script>`;
    }

    return embed.trim();
  }

  // ---- Generate a simple unique ID (like Webflow uses) ----
  function generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 24; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  // ---- Build Webflow XscpData payload ----
  function buildWebflowPayload(embedCode) {
    return {
      type: '@webflow/XscpData',
      payload: {
        nodes: [
          {
            _id: generateId(),
            type: 'HtmlEmbed',
            tag: 'div',
            classes: [],
            children: [],
            v: embedCode,
            data: {
              embed: {
                type: 'html',
                meta: {
                  html: embedCode,
                  div: false,
                  iframe: false,
                  script: true,
                  compilable: false
                }
              },
              search: {
                exclude: true
              }
            }
          },
        ],
        styles: [],
        assets: [],
        ix1: [],
        ix2: {
          interactions: [],
          events: [],
          actionLists: [],
        },
      },
      meta: {
        unlinkedSymbolCount: 0,
        droppedLinks: 0,
        dynBindRemovedCount: 0,
      },
    };
  }

  // ---- Update Preview ----
  let previewTimeout;

  function updatePreview() {
    const html = editors.html.getValue();
    const css = editors.css.getValue();
    const js = editors.js.getValue();

    const previewDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; }
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>${js}<\/script>
</body>
</html>`;

    previewIframe.srcdoc = previewDoc;
  }

  function schedulePreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 400);
  }

  // ---- Update Output ----
  function updateOutput() {
    const embedCode = buildEmbedCode();
    const payload = buildWebflowPayload(embedCode);
    outputCode.textContent = JSON.stringify(payload, null, 2);
  }

  // ---- Debounced Update ----
  function onCodeChange() {
    schedulePreview();
    updateOutput();
  }

  Object.values(editors).forEach((editor) => {
    editor.on('change', onCodeChange);
  });

  // ==========================================================
  //  COPY TO WEBFLOW — uses execCommand('copy') + clipboardData
  //  to set application/json, which Webflow Designer reads.
  //  The async ClipboardItem API does NOT support application/json
  //  in most browsers, so we must use this approach.
  // ==========================================================
  btnCopy.addEventListener('click', () => {
    const embedCode = buildEmbedCode();

    if (!embedCode) {
      showToast('Nothing to copy — add some code first.', false);
      return;
    }

    const payload = buildWebflowPayload(embedCode);
    const jsonString = JSON.stringify(payload);

    // Attach a one-time copy event listener that sets clipboard data
    const copyHandler = (e) => {
      e.preventDefault();
      e.clipboardData.setData('application/json', jsonString);
      e.clipboardData.setData('text/plain', jsonString);
    };

    document.addEventListener('copy', copyHandler, { once: true });

    // Trigger the copy command — this fires the 'copy' event above
    const success = document.execCommand('copy');

    if (success) {
      showToast('Webflow component copied! Paste into Webflow Designer (Cmd/Ctrl+V).', true);
      animateCopyButton(btnCopy);
    } else {
      // Clean up if execCommand failed
      document.removeEventListener('copy', copyHandler);
      showToast('Copy failed. Try selecting the JSON below and copying manually.', false);
    }
  });

  // ---- Copy Raw Code (plain text) ----
  if (btnCopyRaw) {
    btnCopyRaw.addEventListener('click', async () => {
      const embedCode = buildEmbedCode();

      if (!embedCode) {
        showToast('Nothing to copy — add some code first.', false);
        return;
      }

      try {
        await navigator.clipboard.writeText(embedCode);
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = embedCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast('Raw embed code copied to clipboard!', true);
      animateCopyButton(btnCopyRaw);
    });
  }

  // ---- Refresh Preview ----
  btnRefresh.addEventListener('click', () => {
    updatePreview();
  });

  // ---- Button copy animation ----
  function animateCopyButton(btn) {
    btn.classList.add('copied');
    const label = btn.querySelector('.btn-label');
    const originalText = label.textContent;
    label.textContent = 'Copied!';

    setTimeout(() => {
      btn.classList.remove('copied');
      label.textContent = originalText;
    }, 2000);
  }

  // ---- Toast Notification ----
  let toastTimer;

  function showToast(message, success) {
    clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toast.style.color = success ? 'var(--accent-green)' : 'var(--accent-warn)';
    toast.classList.add('show');

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  // ---- Keyboard Shortcut: Ctrl/Cmd+S to copy Webflow component ----
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      btnCopy.click();
    }
  });

  // ---- Initial render ----
  updatePreview();
  updateOutput();
})();
