/**
 * Tor Dark Web Agent (Noir) - Frontend Client Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const welcomeView = document.getElementById('welcome-view');
  const chatView = document.getElementById('chat-view');
  const chatMessages = document.getElementById('chat-messages');
  const queryForm = document.getElementById('query-form');
  const queryInput = document.getElementById('query-input');
  const submitBtn = document.getElementById('submit-btn');
  const activityIndicator = document.getElementById('activity-indicator');
  const activityText = document.getElementById('activity-text');

  // Sidebar Toggling
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const appSidebar = document.getElementById('app-sidebar');

  // Settings Modal & Triggers
  const settingsModal = document.getElementById('settings-modal');
  const sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // Settings Modal Inputs
  const systemPromptInput = document.getElementById('settings-system-prompt');
  const modelInput = document.getElementById('settings-model');
  const temperatureInput = document.getElementById('settings-temperature');
  const maxIterationsInput = document.getElementById('settings-max-iterations');
  
  // Custom Select Elements inside settings modal
  const customModelGroup = document.getElementById('custom-model-group');
  const customModelInput = document.getElementById('settings-custom-model');
  const modelTrigger = document.getElementById('model-trigger');
  const modelTriggerText = document.getElementById('model-trigger-text');
  const modelOptions = document.getElementById('model-options');
  const customOptionsList = document.querySelectorAll('.custom-option');

  // Slider Displays
  const tempValDisplay = document.getElementById('temp-val-display');
  const iterationsValDisplay = document.getElementById('iterations-val-display');

  // --- Premium Glowing SVGs for Avatars ---
  const NOIR_AVATAR_SVG = `
    <div class="message-avatar" style="border: none; background: transparent; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
      <svg viewBox="0 0 24 24" width="30" height="30" style="filter: drop-shadow(0 0 6px rgba(0, 240, 255, 0.4));">
        <path fill="url(#neonGrad)" d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z"/>
        <defs>
          <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00f0ff" />
            <stop offset="100%" stop-color="#7000ff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  `;

  const USER_AVATAR_SVG = `
    <div class="message-avatar" style="border: none; background: transparent; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
      <svg viewBox="0 0 24 24" width="30" height="30">
        <circle cx="12" cy="12" r="10" fill="url(#userGrad)"/>
        <text x="12" y="15.5" font-family="'Outfit', sans-serif" font-weight="600" font-size="10" fill="#131314" text-anchor="middle">U</text>
        <defs>
          <linearGradient id="userGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#a8c7fa" />
            <stop offset="100%" stop-color="#c2e7ff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  `;

  // --- Greetings Helper ---
  const greetings = [
    "¿Qué misterio de la red profunda rastreamos hoy?",
    "Exploremos la internet invisible con total anonimato.",
    "El laberinto encriptado de Tor está listo. Consulta lo que desees.",
    "Buscador de amenazas activado. ¿Cuál es tu objetivo?",
    "Privacidad asegurada. Listo para auditar los rincones ocultos."
  ];

  const subgreetingText = document.querySelector('.gemini-subgreeting');
  if (subgreetingText) {
    const randomIdx = Math.floor(Math.random() * greetings.length);
    subgreetingText.textContent = greetings[randomIdx];
  }

  // --- Sidebar Toggle Bindings ---
  if (sidebarToggleBtn && appSidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('collapsed');
    });
  }

  // --- Activity Control ---
  function showActivity(text) {
    if (!activityIndicator) return;
    activityText.textContent = text;
    activityIndicator.classList.remove('hidden');
    scrollToBottom();
  }

  function hideActivity() {
    if (!activityIndicator) return;
    activityIndicator.classList.add('hidden');
  }

  // --- Header Model Pill Auto-Updater ---
  function updateHeaderModelDisplay(modelVal) {
    const modelSelectorTriggerSpan = document.querySelector('#model-selector-trigger span');
    if (!modelSelectorTriggerSpan) return;

    let label = modelVal;
    // Find matching display text in custom option list
    const matchingOpt = Array.from(customOptionsList).find(opt => opt.getAttribute('data-value') === modelVal);
    if (matchingOpt) {
      label = matchingOpt.textContent.replace(' (Recomendado)', '');
    } else if (modelVal && modelVal !== 'custom') {
      label = modelVal;
    }
    modelSelectorTriggerSpan.textContent = `Noir (${label})`;
  }

  // --- Settings Manager ---
  function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('noir_settings')) || {
      systemPrompt: '',
      model: 'deepseek-v4-flash',
      temperature: 0.1,
      maxIterations: 6
    };

    systemPromptInput.value = settings.systemPrompt || '';
    temperatureInput.value = settings.temperature;
    maxIterationsInput.value = settings.maxIterations;

    tempValDisplay.textContent = settings.temperature;
    iterationsValDisplay.textContent = settings.maxIterations;

    // Reset dropdown state
    customOptionsList.forEach(opt => opt.classList.remove('selected'));

    const targetModel = settings.model;
    let found = false;

    customOptionsList.forEach(opt => {
      const val = opt.getAttribute('data-value');
      if (val === targetModel && val !== 'custom') {
        opt.classList.add('selected');
        modelTriggerText.textContent = opt.textContent;
        modelInput.value = targetModel;
        customModelGroup.classList.add('hidden');
        found = true;
      }
    });

    if (!found) {
      const customOpt = document.querySelector('.custom-option[data-value="custom"]');
      if (customOpt) customOpt.classList.add('selected');
      modelTriggerText.textContent = 'Otro (Modelo personalizado)...';
      modelInput.value = 'custom';
      customModelInput.value = targetModel;
      customModelGroup.classList.remove('hidden');
    }

    updateHeaderModelDisplay(settings.model);
    return settings;
  }

  function saveSettings() {
    const selectedModelType = modelInput.value;
    const modelValue = selectedModelType === 'custom'
      ? customModelInput.value.trim()
      : selectedModelType;

    const settings = {
      systemPrompt: systemPromptInput.value,
      model: modelValue || 'deepseek-v4-flash',
      temperature: parseFloat(temperatureInput.value),
      maxIterations: parseInt(maxIterationsInput.value, 10)
    };

    localStorage.setItem('noir_settings', JSON.stringify(settings));
    updateHeaderModelDisplay(settings.model);
    return settings;
  }

  // Load configuration immediately
  let activeSettings = loadSettings();

  // Settings Select trigger toggle
  modelTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    modelOptions.classList.toggle('hidden');
  });

  // Modal Custom Options Select Bindings
  customOptionsList.forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = option.getAttribute('data-value');

      customOptionsList.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');

      modelTriggerText.textContent = option.textContent;
      modelInput.value = val;
      modelOptions.classList.add('hidden');

      if (val === 'custom') {
        customModelGroup.classList.remove('hidden');
        customModelInput.focus();
      } else {
        customModelGroup.classList.add('hidden');
      }
    });
  });

  document.addEventListener('click', () => {
    modelOptions.classList.add('hidden');
  });

  // Modal display listeners
  const openSettings = () => {
    loadSettings();
    settingsModal.classList.remove('hidden');
  };

  if (sidebarSettingsBtn) sidebarSettingsBtn.addEventListener('click', openSettings);

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  temperatureInput.addEventListener('input', (e) => {
    tempValDisplay.textContent = e.target.value;
  });

  maxIterationsInput.addEventListener('input', (e) => {
    iterationsValDisplay.textContent = e.target.value;
  });

  saveSettingsBtn.addEventListener('click', () => {
    activeSettings = saveSettings();
    settingsModal.classList.add('hidden');
  });

  // Clear session history logic
  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('¿Estás seguro de que quieres borrar el historial de este chat de forma permanente?')) {
      return;
    }

    try {
      const response = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: currentThreadId })
      });
      if (response.ok) {
        chatMessages.innerHTML = '';
        welcomeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        settingsModal.classList.add('hidden');
      } else {
        alert('Fallo al limpiar el historial.');
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`);
    }
  });

  // --- KaTeX & Markdown Rendering ---
  function renderMarkdownAndMath(text, container) {
    if (!text) {
      container.innerHTML = '';
      return;
    }

    try {
      // Extract block math ($$ ... $$) to protect from Marked.js
      let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
        try {
          const b64 = btoa(unescape(encodeURIComponent(expr.trim())));
          return `<div class="math-block-placeholder" data-expr="${b64}"></div>`;
        } catch (e) {
          return match;
        }
      });

      // Extract inline math ($ ... $)
      processed = processed.replace(/\$([^$\n]+?)\$/g, (match, expr) => {
        try {
          const b64 = btoa(unescape(encodeURIComponent(expr.trim())));
          return `<span class="math-inline-placeholder" data-expr="${b64}"></span>`;
        } catch (e) {
          return match;
        }
      });

      // Render Markdown
      let htmlResult = '';
      if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        htmlResult = marked.parse(processed);
      } else {
        htmlResult = processed.replace(/\n/g, '<br>');
      }

      container.innerHTML = htmlResult;

      // Render KaTeX Math blocks
      if (typeof katex !== 'undefined') {
        container.querySelectorAll('.math-block-placeholder').forEach(el => {
          try {
            const expr = decodeURIComponent(escape(atob(el.getAttribute('data-expr'))));
            katex.render(expr, el, { displayMode: true, throwOnError: false });
            el.className = 'math-block-rendered';
          } catch (err) {
            el.textContent = `$$${err.message}$$`;
          }
        });

        container.querySelectorAll('.math-inline-placeholder').forEach(el => {
          try {
            const expr = decodeURIComponent(escape(atob(el.getAttribute('data-expr'))));
            katex.render(expr, el, { displayMode: false, throwOnError: false });
            el.className = 'math-inline-rendered';
          } catch (err) {
            el.textContent = `$${err.message}$`;
          }
        });
      }
    } catch (error) {
      console.error('[Renderer Error] Failed to render content:', error);
      container.textContent = text;
    }
  }

  function scrollToBottom() {
    chatView.scrollTo({
      top: chatView.scrollHeight,
      behavior: 'smooth'
    });
  }

  // --- Step Accordion Creator ---
  function createStepAccordion(title, iconSvg) {
    const stepItem = document.createElement('div');
    stepItem.className = 'step-item';

    const header = document.createElement('div');
    header.className = 'step-header';
    header.innerHTML = `
      <div class="step-title-wrapper">
        <span class="step-icon">${iconSvg}</span>
        <span>${title}</span>
      </div>
      <svg class="step-arrow" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
    `;

    const content = document.createElement('div');
    content.className = 'step-content';

    stepItem.appendChild(header);
    stepItem.appendChild(content);

    header.addEventListener('click', () => {
      stepItem.classList.toggle('open');
    });

    return {
      element: stepItem,
      updateContent: (text) => {
        content.textContent = text;
      },
      open: () => {
        stepItem.classList.add('open');
      },
      close: () => {
        stepItem.classList.remove('open');
      }
    };
  }

  const THOUGHT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
  const TOOL_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.1z"/></svg>`;

  // --- Thread Management ---
  const newChatBtn = document.getElementById('new-chat-btn');
  const threadListContainer = document.getElementById('thread-list');
  let currentThreadId = localStorage.getItem('noir_current_thread_id') || null;

  async function fetchThreads() {
    try {
      const response = await fetch('/api/threads');
      if (!response.ok) return;

      const { threads } = await response.json();
      threadListContainer.innerHTML = '';

      if (threads && threads.length > 0) {
        threads.forEach(thread => {
          const item = document.createElement('div');
          item.className = 'thread-item';
          if (thread.id === currentThreadId) {
            item.classList.add('active');
          }
          item.setAttribute('data-id', thread.id);

          const titleSpan = document.createElement('span');
          titleSpan.className = 'thread-title';
          titleSpan.textContent = thread.title;
          titleSpan.addEventListener('click', () => switchThread(thread.id));
          item.appendChild(titleSpan);

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-thread-btn';
          deleteBtn.title = 'Eliminar Chat';
          deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          `;
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteThreadHandler(thread.id);
          });
          item.appendChild(deleteBtn);

          threadListContainer.appendChild(item);
        });

        const currentExists = threads.some(t => t.id === currentThreadId);
        if (!currentThreadId || !currentExists) {
          switchThread(threads[0].id);
        }
      } else {
        await createNewThread();
      }
    } catch (err) {
      console.warn('[Threads] Could not fetch threads:', err.message);
    }
  }

  async function createNewThread() {
    const threadId = 'thread_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: threadId, title: 'Nuevo Chat' })
      });
      if (response.ok) {
        currentThreadId = threadId;
        localStorage.setItem('noir_current_thread_id', threadId);
        chatMessages.innerHTML = '';
        welcomeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        await fetchThreads();
      }
    } catch (err) {
      console.error('[Threads] Failed to create new thread:', err.message);
    }
  }

  function switchThread(threadId) {
    currentThreadId = threadId;
    localStorage.setItem('noir_current_thread_id', threadId);

    const items = threadListContainer.querySelectorAll('.thread-item');
    items.forEach(item => {
      if (item.getAttribute('data-id') === threadId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    loadChatHistory(threadId);
  }

  async function deleteThreadHandler(threadId) {
    if (!confirm('¿Estás seguro de que quieres borrar este chat de forma permanente?')) {
      return;
    }

    try {
      const response = await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
      if (response.ok) {
        if (currentThreadId === threadId) {
          currentThreadId = null;
          localStorage.removeItem('noir_current_thread_id');
        }
        await fetchThreads();
      }
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  }

  async function loadChatHistory(threadId) {
    if (!threadId) return;
    try {
      const response = await fetch(`/api/chat/history?threadId=${threadId}`);
      if (!response.ok) return;

      const { messages } = await response.json();
      chatMessages.innerHTML = '';

      if (messages && messages.length > 0) {
        welcomeView.classList.add('hidden');
        chatView.classList.remove('hidden');

        messages.forEach(msg => {
          const node = document.createElement('div');
          
          if (msg.role === 'user') {
            node.className = 'message-node message-user';
            node.innerHTML = `
              ${USER_AVATAR_SVG}
              <div class="message-content-wrapper">
                <div class="bubble-user"></div>
              </div>
            `;
            node.querySelector('.bubble-user').textContent = msg.content;
          } else {
            node.className = 'message-node message-agent';
            node.innerHTML = `
              ${NOIR_AVATAR_SVG}
              <div class="message-content-wrapper">
                <div class="bubble-agent">
                  <div class="agent-answer"></div>
                </div>
              </div>
            `;
            const answer = node.querySelector('.agent-answer');
            renderMarkdownAndMath(msg.content, answer);
          }

          chatMessages.appendChild(node);
        });

        setTimeout(scrollToBottom, 100);
      } else {
        welcomeView.classList.remove('hidden');
        chatView.classList.add('hidden');
      }
    } catch (err) {
      console.warn('[History] Could not retrieve chat history:', err.message);
    }
  }

  newChatBtn.addEventListener('click', createNewThread);
  fetchThreads();

  // --- Suggestion Cards Grid click handler ---
  const suggestionCards = document.querySelectorAll('.suggestion-card');
  suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const query = card.getAttribute('data-query');
      if (query) {
        queryInput.value = query;
        queryForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  });

  // --- Form Submission & Streaming Response ---
  queryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    if (!query) return;

    // Auto-rename thread if it currently has default name "Nuevo Chat"
    const currentActiveItem = threadListContainer.querySelector(`.thread-item[data-id="${currentThreadId}"]`);
    if (currentActiveItem) {
      const titleSpan = currentActiveItem.querySelector('.thread-title');
      if (titleSpan && titleSpan.textContent === 'Nuevo Chat') {
        const newTitle = query.length > 25 ? query.substring(0, 25) + '...' : query;
        titleSpan.textContent = newTitle;
        fetch(`/api/threads/${currentThreadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        }).catch(err => console.warn('[Rename Thread] Failed to save name:', err.message));
      }
    }

    welcomeView.classList.add('hidden');
    chatView.classList.remove('hidden');

    // User Message Bubble
    const userNode = document.createElement('div');
    userNode.className = 'message-node message-user';
    userNode.innerHTML = `
      ${USER_AVATAR_SVG}
      <div class="message-content-wrapper">
        <div class="bubble-user"></div>
      </div>
    `;
    userNode.querySelector('.bubble-user').textContent = query;
    chatMessages.appendChild(userNode);
    
    queryInput.value = '';
    queryInput.disabled = true;
    submitBtn.disabled = true;
    
    showActivity('Conectando con el agente...');
    scrollToBottom();

    // Agent Message Bubble (Structured in Gemini style with loading skeleton)
    const agentNode = document.createElement('div');
    agentNode.className = 'message-node message-agent loading';
    agentNode.innerHTML = `
      ${NOIR_AVATAR_SVG}
      <div class="message-content-wrapper">
        <div class="agent-skeleton">
          <div class="skeleton-line" style="width: 100%;"></div>
          <div class="skeleton-line" style="width: 85%;"></div>
          <div class="skeleton-line" style="width: 60%;"></div>
        </div>
        <div class="steps-container"></div>
        <div class="bubble-agent">
          <div class="agent-answer hidden"></div>
        </div>
      </div>
    `;
    
    const stepsContainer = agentNode.querySelector('.steps-container');
    const answerCard = agentNode.querySelector('.agent-answer');
    const skeleton = agentNode.querySelector('.agent-skeleton');

    const clearLoadingState = () => {
      if (skeleton) {
        skeleton.remove();
      }
      agentNode.classList.remove('loading');
    };

    chatMessages.appendChild(agentNode);
    scrollToBottom();

    let currentThoughtAccordion = null;
    let currentToolAccordion = null;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          settings: activeSettings,
          threadId: currentThreadId
        })
      });

      if (!response.ok) {
        throw new Error(`Error en servidor: HTTP ${response.status}`);
      }

      showActivity('Esperando respuesta...');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          const rawData = line.substring(6);
          let event = null;
          try {
            event = JSON.parse(rawData);
          } catch (err) {
            continue;
          }

          const { type, data } = event;

          if (type === 'thought') {
            clearLoadingState();
            if (currentThoughtAccordion) currentThoughtAccordion.close();
            if (currentToolAccordion) currentToolAccordion.close();

            showActivity('Noir está razonando...');

            currentThoughtAccordion = createStepAccordion('Pensando...', THOUGHT_ICON);
            stepsContainer.appendChild(currentThoughtAccordion.element);
            currentThoughtAccordion.updateContent(data);
            currentThoughtAccordion.open();
            scrollToBottom();
          }

          else if (type === 'action') {
            clearLoadingState();
            if (currentThoughtAccordion) currentThoughtAccordion.close();
            if (currentToolAccordion) currentToolAccordion.close();

            showActivity(`Llamando a herramienta Tor: ${data.tool}...`);

            const title = `Llamando a herramienta: ${data.tool}`;
            currentToolAccordion = createStepAccordion(title, TOOL_ICON);
            stepsContainer.appendChild(currentToolAccordion.element);
            currentToolAccordion.updateContent(`Parámetros:\n${JSON.stringify(data.args, null, 2)}`);
            currentToolAccordion.open();
            scrollToBottom();
          }

          else if (type === 'observation') {
            showActivity('Recibiendo datos de la red Tor...');
            if (currentToolAccordion) {
              const currentContent = currentToolAccordion.element.querySelector('.step-content').textContent;
              currentToolAccordion.updateContent(`${currentContent}\n\nObservación:\n${data}`);
            }
            scrollToBottom();
          }

          else if (type === 'finalAnswer') {
            clearLoadingState();
            hideActivity();
            if (currentThoughtAccordion) currentThoughtAccordion.close();
            if (currentToolAccordion) currentToolAccordion.close();

            answerCard.classList.remove('hidden');
            renderMarkdownAndMath(data, answerCard);
            scrollToBottom();
          }

          else if (type === 'error') {
            clearLoadingState();
            hideActivity();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'bubble-user';
            errorDiv.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
            errorDiv.style.borderColor = '#ff5252';
            errorDiv.innerHTML = `<strong>Error de ejecución:</strong><br>${data}`;
            agentNode.querySelector('.message-content-wrapper').appendChild(errorDiv);
            scrollToBottom();
          }
        }
      }

    } catch (error) {
      console.error(error);
      clearLoadingState();
      hideActivity();
      const errorDiv = document.createElement('div');
      errorDiv.className = 'bubble-user';
      errorDiv.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
      errorDiv.style.borderColor = '#ff5252';
      errorDiv.innerHTML = `<strong>Fallo de Red:</strong><br>${error.message}`;
      agentNode.querySelector('.message-content-wrapper').appendChild(errorDiv);
      scrollToBottom();
    } finally {
      clearLoadingState();
      hideActivity();
      queryInput.disabled = false;
      submitBtn.disabled = false;
      queryInput.focus();
    }
  });

});
