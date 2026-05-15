// Theory assistant floating panel.

(function initTheoryAssistant() {
  const VOICE_KEY = "linearRegressionTheoryAssistantVoice";
  const RATE_KEY = "linearRegressionTheoryAssistantRate";
  const TTS_PROVIDER_KEY = "linearRegressionTheoryAssistantTtsProvider";
  const TTS_VOICES = [
    { value: "zh-CN-XiaoxiaoNeural", label: "晓晓 · 女声 · 温暖" },
    { value: "zh-CN-XiaoyiNeural", label: "小艺 · 女声 · 活泼" },
    { value: "zh-CN-YunxiNeural", label: "云希 · 男声 · 阳光" },
    { value: "zh-CN-YunyangNeural", label: "云扬 · 男声 · 稳重" },
    { value: "zh-CN-YunjianNeural", label: "云健 · 男声 · 有力" },
    { value: "zh-CN-YunxiaNeural", label: "云夏 · 男声 · 年轻" },
    { value: "Tingting", label: "婷婷 · 本机备用" },
    { value: "Meijia", label: "美佳 · macOS 本机" },
    { value: "Sinji", label: "善怡 · macOS 本机" },
    { value: "melotts:ZH", label: "MeloTTS 中文 · 本地模型" },
  ];

  function readStorage(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {}
  }

  function safeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function savedRate() {
    const value = Number(readStorage(RATE_KEY));
    return Number.isFinite(value) && value >= 0.75 && value <= 1.55 ? value : 1.15;
  }

  function normalizeVoiceForProvider(provider, voice) {
    const edgeVoices = new Set([
      "zh-CN-XiaoxiaoNeural",
      "zh-CN-XiaoyiNeural",
      "zh-CN-YunxiNeural",
      "zh-CN-YunyangNeural",
      "zh-CN-YunjianNeural",
      "zh-CN-YunxiaNeural",
    ]);
    const macosVoices = new Set(["Tingting", "Meijia", "Sinji"]);
    if (provider === "melotts") return "melotts:ZH";
    if (provider === "macos") return macosVoices.has(voice) ? voice : "Tingting";
    return edgeVoices.has(voice) ? voice : "zh-CN-XiaoxiaoNeural";
  }

  function savedTtsProvider() {
    const value = readStorage(TTS_PROVIDER_KEY);
    return ["edge", "macos", "melotts"].includes(value) ? value : "edge";
  }

  function savedVoice() {
    const value = readStorage(VOICE_KEY);
    const voice = TTS_VOICES.some(item => item.value === value) ? value : "zh-CN-XiaoxiaoNeural";
    return normalizeVoiceForProvider(savedTtsProvider(), voice);
  }

  const state = {
    pageId: "",
    title: "当前理论页",
    text: "",
    explanation: "",
    open: false,
    speaking: false,
    paused: false,
    rate: savedRate(),
    ttsProvider: savedTtsProvider(),
    voiceURI: savedVoice(),
    chatHistory: [],
    pageMemory: [],
    activeTurn: null,
  };

  const supportSpeech = "Audio" in window && "fetch" in window;
  let currentAudio = null;
  let currentAudioUrl = "";
  let streamTimer = 0;
  let streamToken = 0;
  let selectedTheoryText = "";
  let selectionCleanup = null;
  let selectionFrame = null;
  let selectionTimer = 0;

  const shell = document.createElement("div");
  shell.innerHTML = `
    <div class="theory-assistant-dock" id="theoryAssistantDock">
      <div class="theory-assistant-quick" aria-label="AI助教快捷操作">
        <button id="theoryQuickExplain" type="button">智能页面讲解</button>
        <button id="theoryQuickAsk" type="button">输入问题提问</button>
      </div>
      <div class="theory-audio-controls" aria-label="朗读控制">
        <button id="theoryFabPauseBtn" type="button">暂停</button>
        <button id="theoryFabResumeBtn" type="button">继续</button>
        <button id="theoryFabStopBtn" type="button">停止</button>
      </div>
      <div class="theory-dock-speech" id="theoryDockSpeech" aria-live="polite"></div>
      <button class="theory-assistant-fab" id="theoryAssistantFab" type="button" aria-label="打开理论智能助手">
        <span class="digital-lecturer digital-lecturer-fab" aria-hidden="true">
          <span class="lecturer-gif-stage">
            <img class="lecturer-static" src="/static/assets/digital-lecturer-static.png" alt="" decoding="async">
            <img class="lecturer-motion" src="/static/assets/digital-lecturer.gif" alt="" decoding="async">
          </span>
        </span>
      </button>
    </div>
    <button class="theory-selection-help" id="theorySelectionHelp" type="button">这部分没看懂？问AI助教</button>
    <section class="theory-assistant-panel" id="theoryAssistantPanel" aria-label="理论智能助手">
      <div class="theory-assistant-head">
        <div class="theory-assistant-identity">
          <span class="theory-assistant-mark" aria-hidden="true">
            <span class="digital-lecturer digital-lecturer-mini" aria-hidden="true">
              <span class="lecturer-gif-stage">
                <img class="lecturer-static" src="/static/assets/digital-lecturer-static.png" alt="" loading="lazy" decoding="async">
                <img class="lecturer-motion" src="/static/assets/digital-lecturer.gif" alt="" loading="lazy" decoding="async">
              </span>
            </span>
          </span>
          <div>
            <span class="theory-assistant-eyebrow">智能语音助教</span>
            <strong id="theoryAssistantTitle">AI助教</strong>
            <span id="theoryAssistantSub">理论页讲解 / 朗读 / 问答</span>
          </div>
        </div>
      </div>
      <div class="theory-live-stage">
        <span class="digital-lecturer digital-lecturer-panel" aria-hidden="true">
          <span class="lecturer-gif-stage">
            <img class="lecturer-static" src="/static/assets/digital-lecturer-static.png" alt="" loading="lazy" decoding="async">
            <img class="lecturer-motion" src="/static/assets/digital-lecturer.gif" alt="" loading="lazy" decoding="async">
          </span>
        </span>
        <div class="theory-live-copy">
          <span>语音会话</span>
          <strong id="theoryVoiceState">准备读取当前页</strong>
          <em id="theoryAssistantStatus" role="status" aria-live="polite"></em>
        </div>
        <div class="theory-voice-meter" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="theory-assistant-body" id="theoryAssistantBody">我会根据当前页内容回答你的问题。</div>
      <div class="theory-assistant-actions">
        <button id="theoryExplainBtn" type="button">智能页面讲解</button>
        <button id="theoryReadBtn" type="button">朗读全文</button>
      </div>
      <div class="theory-assistant-ask">
        <textarea id="theoryQuestionInput" rows="2"></textarea>
        <button id="theoryAskBtn" type="button">发送</button>
      </div>
      <div class="theory-assistant-control">
        <button id="theoryPauseBtn" type="button" disabled>暂停</button>
        <button id="theoryResumeBtn" type="button" disabled>继续</button>
        <button id="theoryStopBtn" type="button" disabled>停止</button>
      </div>
      <div class="theory-assistant-voice" hidden>
        <label>
          <span>音色</span>
          <select id="theoryVoiceSelect"></select>
        </label>
        <label>
          <span>语速 <strong id="theoryRateValue">1.15x</strong></span>
          <input id="theoryRateInput" type="range" min="0.85" max="1.45" step="0.05" value="1.15">
        </label>
      </div>
    </section>
  `;
  document.body.append(...Array.from(shell.children));

  const fab = document.getElementById("theoryAssistantFab");
  const selectionHelpBtn = document.getElementById("theorySelectionHelp");
  const panel = document.getElementById("theoryAssistantPanel");
  const explainBtn = document.getElementById("theoryExplainBtn");
  const readBtn = document.getElementById("theoryReadBtn");
  const voiceSelect = document.getElementById("theoryVoiceSelect");
  const rateInput = document.getElementById("theoryRateInput");
  const rateValue = document.getElementById("theoryRateValue");
  const questionInput = document.getElementById("theoryQuestionInput");
  const askBtn = document.getElementById("theoryAskBtn");
  const pauseBtn = document.getElementById("theoryPauseBtn");
  const resumeBtn = document.getElementById("theoryResumeBtn");
  const stopBtn = document.getElementById("theoryStopBtn");
  const fabPauseBtn = document.getElementById("theoryFabPauseBtn");
  const fabResumeBtn = document.getElementById("theoryFabResumeBtn");
  const fabStopBtn = document.getElementById("theoryFabStopBtn");
  const quickExplainBtn = document.getElementById("theoryQuickExplain");
  const quickAskBtn = document.getElementById("theoryQuickAsk");
  const dockSpeech = document.getElementById("theoryDockSpeech");
  const titleEl = document.getElementById("theoryAssistantTitle");
  const subEl = document.getElementById("theoryAssistantSub");
  const bodyEl = document.getElementById("theoryAssistantBody");
  const statusEl = document.getElementById("theoryAssistantStatus");
  const voiceStateEl = document.getElementById("theoryVoiceState");
  let dockSpeechActive = false;
  let dockSpeechText = "";
  let dockSpeechLoading = false;

  function setStatus(message) {
    statusEl.textContent = message || "";
    statusEl.hidden = !message;
  }

  function renderAssistantMessage(text, { loading = false, error = false } = {}) {
    bodyEl.className = "theory-assistant-body";
    bodyEl.textContent = text || "";
    bodyEl.classList.toggle("is-loading", loading);
    bodyEl.classList.toggle("is-error", error);
  }

  function renderAssistantBubble(text, { loading = false, error = false } = {}) {
    bodyEl.className = "theory-assistant-body theory-conversation";
    bodyEl.innerHTML = `
      <div class="theory-message theory-message-assistant${loading ? " is-loading" : ""}${error ? " is-error" : ""}">
        <span class="theory-message-avatar theory-message-avatar-assistant" aria-hidden="true">
          <img src="/static/assets/assistant-avatar.svg" alt="" loading="lazy" decoding="async">
        </span>
        <div class="theory-message-content">
          <span class="theory-message-name">AI助教</span>
          <p>${safeHtml(text)}</p>
        </div>
      </div>
    `;
  }

  function renderCurrentTurnMessage(turn) {
    const pageLabel = turn.title ? ` · ${turn.title}` : "";
    return `
      <div class="theory-message theory-message-user theory-message-current">
        <span class="theory-message-avatar theory-message-avatar-user" aria-hidden="true">
          <img src="/static/assets/trainee-avatar.svg" alt="" loading="lazy" decoding="async">
        </span>
        <div class="theory-message-content">
          <span class="theory-message-name">${safeHtml(`参训学员${pageLabel}`)}</span>
          <p>${safeHtml(turn.question)}</p>
        </div>
      </div>
      <div class="theory-message theory-message-assistant theory-message-current${turn.loading ? " is-loading" : ""}${turn.error ? " is-error" : ""}">
        <span class="theory-message-avatar theory-message-avatar-assistant" aria-hidden="true">
          <img src="/static/assets/assistant-avatar.svg" alt="" loading="lazy" decoding="async">
        </span>
        <div class="theory-message-content">
          <span class="theory-message-name">${safeHtml(`AI助教${pageLabel}`)}</span>
          <p>${turn.loading && !turn.answer ? '<span class="typing-dots" aria-label="正在回答"><span></span><span></span><span></span></span>' : safeHtml(turn.answer)}</p>
        </div>
      </div>
    `;
  }

  function renderActiveTurn(options = {}) {
    const { scrollToEnd = false } = options;
    if (!state.activeTurn) return false;
    const historyHtml = state.chatHistory.slice(-16).map(renderHistoryMessage).join("");
    bodyEl.className = "theory-assistant-body theory-conversation";
    bodyEl.innerHTML = `${historyHtml}${renderCurrentTurnMessage(state.activeTurn)}`;
    if (scrollToEnd) {
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
    return true;
  }

  function renderConversation(question, answer, { loading = false, error = false } = {}) {
    state.activeTurn = {
      question,
      answer,
      loading,
      error,
      page: state.pageId,
      title: state.title,
    };
    renderActiveTurn({ scrollToEnd: true });
  }

  function renderHistoryMessage(item) {
    const isUser = item.role === "user";
    const name = isUser ? "参训学员" : "AI助教";
    const pageLabel = item.title ? ` · ${item.title}` : "";
    const avatar = isUser ? "/static/assets/trainee-avatar.svg" : "/static/assets/assistant-avatar.svg";
    const typeClass = isUser ? "theory-message-user" : "theory-message-assistant";
    const avatarClass = isUser ? "theory-message-avatar-user" : "theory-message-avatar-assistant";
    return `
      <div class="theory-message ${typeClass}">
        <span class="theory-message-avatar ${avatarClass}" aria-hidden="true">
          <img src="${avatar}" alt="" loading="lazy" decoding="async">
        </span>
        <div class="theory-message-content">
          <span class="theory-message-name">${safeHtml(name + pageLabel)}</span>
          <p>${safeHtml(item.content)}</p>
        </div>
      </div>
    `;
  }

  function renderChatHistory(options = {}) {
    const { scrollToEnd = false } = options;
    const history = state.chatHistory.slice(-16);
    if (!history.length) return false;
    bodyEl.className = "theory-assistant-body theory-conversation";
    bodyEl.innerHTML = history.map(renderHistoryMessage).join("");
    if (scrollToEnd) {
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
    return true;
  }

  function updateActiveTurnAnswer(answer, { loading = false, error = false } = {}) {
    if (!state.activeTurn) return null;
    state.activeTurn.answer = answer;
    state.activeTurn.loading = loading;
    state.activeTurn.error = error;
    if (!state.open) return null;
    let assistantMessage = bodyEl.querySelector(".theory-message-current.theory-message-assistant");
    let answerEl = assistantMessage?.querySelector("p");
    if (!assistantMessage || !answerEl) {
      renderActiveTurn({ scrollToEnd: true });
      assistantMessage = bodyEl.querySelector(".theory-message-current.theory-message-assistant");
      answerEl = assistantMessage?.querySelector("p");
    }
    if (!assistantMessage || !answerEl) return null;
    assistantMessage.classList.toggle("is-loading", loading);
    assistantMessage.classList.toggle("is-error", error);
    if (loading && !answer) {
      answerEl.innerHTML = '<span class="typing-dots" aria-label="正在回答"><span></span><span></span><span></span></span>';
    } else {
      answerEl.textContent = answer;
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return answerEl;
  }

  function stopAnswerStream() {
    streamToken += 1;
    if (streamTimer) {
      clearTimeout(streamTimer);
      streamTimer = 0;
    }
  }

  function dockSpeechSnippet(text) {
    const cleanText = String(text || "").replace(/\s+/g, " ").trim();
    return cleanText.length > 420 ? cleanText.slice(-420) : cleanText;
  }

  function updateDockSpeech() {
    const shouldShow = dockSpeechActive && !state.open && (Boolean(dockSpeechText) || dockSpeechLoading);
    if (dockSpeechLoading && !dockSpeechText) {
      dockSpeech.innerHTML = '<span class="dock-typing-dots" aria-label="正在回答"><span></span><span></span><span></span></span>';
    } else {
      dockSpeech.textContent = dockSpeechText;
    }
    dockSpeech.classList.toggle("is-loading", dockSpeechLoading && !dockSpeechText);
    dockSpeech.classList.toggle("show", shouldShow);
    if (shouldShow) {
      dockSpeech.scrollTop = dockSpeech.scrollHeight;
    }
  }

  function setDockSpeech(text, active = true, options = {}) {
    const { loading = false } = options;
    dockSpeechText = dockSpeechSnippet(text);
    dockSpeechLoading = loading;
    dockSpeechActive = active && (Boolean(dockSpeechText) || loading);
    updateDockSpeech();
  }

  function hideDockSpeech() {
    dockSpeechText = "";
    dockSpeechLoading = false;
    dockSpeechActive = false;
    updateDockSpeech();
  }

  function clipContextText(text, limit = 900) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function currentChatHistory() {
    return state.chatHistory.slice(-12);
  }

  function rememberTurn(question, answer) {
    const cleanQuestion = clipContextText(question);
    const cleanAnswer = clipContextText(answer);
    if (!cleanQuestion || !cleanAnswer) return;
    state.chatHistory.push(
      { role: "user", content: cleanQuestion, page: state.pageId, title: state.title },
      { role: "assistant", content: cleanAnswer, page: state.pageId, title: state.title }
    );
    state.chatHistory = state.chatHistory.slice(-16);
  }

  function rememberPage(page) {
    const pageId = String(page?.id || "").trim();
    const title = String(page?.title || "当前理论页").trim();
    const text = clipContextText(page?.text || "", 1800);
    if (!pageId || text.length < 20) return;
    state.pageMemory = state.pageMemory.filter(item => item.id !== pageId);
    state.pageMemory.push({ id: pageId, title, text });
    state.pageMemory = state.pageMemory.slice(-8);
  }

  function currentPageContext() {
    if (state.pageId && state.text.length >= 20) {
      rememberPage({ id: state.pageId, title: state.title, text: state.text });
    }
    return state.pageMemory.slice(-8);
  }

  function streamConversation(question, answer, options = {}) {
    const { audio = null } = options;
    stopAnswerStream();
    const token = streamToken;
    const cleanAnswer = String(answer || "");
    renderConversation(question, "", { loading: true });
    if (!cleanAnswer) {
      renderConversation(question, "没有生成可用回答。");
      return Promise.resolve();
    }
    let index = 0;
    const fallbackMs = Math.max(2200, cleanAnswer.length * 130 / Math.max(state.rate, 0.85));
    let fallbackElapsedMs = 0;
    let lastTickAt = performance.now();

    function finish(resolve) {
      updateActiveTurnAnswer(cleanAnswer);
      setDockSpeech(cleanAnswer, Boolean(audio && currentAudio === audio && !audio.ended));
      streamTimer = 0;
      resolve();
    }

    return new Promise(resolve => {
      setDockSpeech("", true, { loading: true });
      const fixedTick = () => {
        if (token !== streamToken) {
          resolve();
          return;
        }
        const step = Math.max(1, Math.ceil(cleanAnswer.length / 320));
        index = Math.min(cleanAnswer.length, index + step);
        const partialAnswer = cleanAnswer.slice(0, index);
        updateActiveTurnAnswer(partialAnswer);
        setDockSpeech(partialAnswer, true);
        if (index >= cleanAnswer.length) {
          finish(resolve);
          return;
        }
        streamTimer = setTimeout(fixedTick, 42);
      };

      const audioTick = () => {
        if (token !== streamToken) {
          resolve();
          return;
        }
        if (audio !== currentAudio && !audio.ended) {
          assistantMessage.classList.remove("is-loading");
          streamTimer = 0;
          resolve();
          return;
        }

        const now = performance.now();
        if (!audio.paused) {
          fallbackElapsedMs += now - lastTickAt;
        }
        lastTickAt = now;

        const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        const progress = duration
          ? Math.min(1, Math.max(0, audio.currentTime / duration))
          : Math.min(1, fallbackElapsedMs / fallbackMs);
        const nextIndex = Math.max(index, Math.min(cleanAnswer.length, Math.ceil(cleanAnswer.length * progress)));

        if (nextIndex > index) {
          index = nextIndex;
          const partialAnswer = cleanAnswer.slice(0, index);
          updateActiveTurnAnswer(partialAnswer);
          setDockSpeech(partialAnswer, true);
        }
        if (audio.ended || progress >= 0.995) {
          finish(resolve);
          return;
        }
        streamTimer = setTimeout(audioTick, 90);
      };

      if (audio) {
        audioTick();
      } else {
        fixedTick();
      }
    });
  }

  function updateButtons() {
    const hasText = state.text.length > 20;
    const hasQuestion = questionInput.value.trim().length >= 2;
    const voiceState = state.speaking && state.paused
      ? "朗读已暂停"
      : state.speaking
        ? "正在朗读"
        : hasText
          ? "可以开始讲解或提问"
          : "等待理论页内容";
    document.body.classList.toggle("assistant-open", state.open);
    document.body.classList.toggle("assistant-speaking", state.speaking && !state.paused);
    document.body.classList.toggle("assistant-audio-active", state.speaking);
    document.body.classList.toggle("assistant-paused", state.speaking && state.paused);
    voiceStateEl.textContent = voiceState;
    explainBtn.disabled = !hasText;
    readBtn.disabled = !hasText || !supportSpeech;
    askBtn.disabled = !hasText || !hasQuestion;
    quickExplainBtn.disabled = !hasText;
    quickAskBtn.disabled = !hasText;
    voiceSelect.disabled = !supportSpeech;
    rateInput.disabled = !supportSpeech;
    pauseBtn.disabled = !state.speaking || state.paused;
    resumeBtn.disabled = !state.speaking || !state.paused;
    stopBtn.disabled = !state.speaking;
    fabPauseBtn.disabled = !state.speaking || state.paused;
    fabResumeBtn.disabled = !state.speaking || !state.paused;
    fabStopBtn.disabled = !state.speaking;
  }

  function openPanel(mode = "ask") {
    state.open = true;
    panel.dataset.mode = mode;
    panel.classList.add("open");
    updateDockSpeech();
    updateButtons();
  }

  function closePanel() {
    state.open = false;
    panel.dataset.mode = "";
    panel.classList.remove("open");
    updateDockSpeech();
  }

  function openQuestionPanel() {
    openPanel("ask");
    if (state.activeTurn && renderActiveTurn({ scrollToEnd: true })) {
      window.requestAnimationFrame(() => questionInput.focus());
      return;
    }
    if (renderChatHistory({ scrollToEnd: true })) {
      window.requestAnimationFrame(() => questionInput.focus());
      return;
    }
    if (
      !bodyEl.textContent ||
      bodyEl.textContent.includes("我已经读完这一页了") ||
      bodyEl.textContent.includes("这页哪里没看懂")
    ) {
      renderAssistantBubble("这页哪里没看懂？可以直接问我。");
    }
    window.requestAnimationFrame(() => questionInput.focus());
  }

  function hideSelectionHelp() {
    selectedTheoryText = "";
    selectionHelpBtn.classList.remove("show");
  }

  function showSelectionHelp(iframe, selection) {
    if (!selection || selection.rangeCount === 0) {
      hideSelectionHelp();
      return;
    }
    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (selectedText.length < 6) {
      hideSelectionHelp();
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideSelectionHelp();
      return;
    }
    const iframeRect = iframe.getBoundingClientRect();
    const centerX = iframeRect.left + rect.left + rect.width / 2;
    const top = iframeRect.top + rect.bottom + 10;
    selectedTheoryText = selectedText.slice(0, 1200);
    selectionHelpBtn.style.left = `${Math.min(window.innerWidth - 120, Math.max(120, centerX))}px`;
    selectionHelpBtn.style.top = `${Math.min(window.innerHeight - 58, Math.max(12, top))}px`;
    selectionHelpBtn.classList.add("show");
  }

  function scheduleSelectionHelp(iframe) {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        showSelectionHelp(iframe, doc.getSelection());
      } catch (err) {
        hideSelectionHelp();
      }
    }, 80);
  }

  function attachSelectionTarget(iframe) {
    if (selectionCleanup) selectionCleanup();
    selectionCleanup = null;
    selectionFrame = iframe || null;
    hideSelectionHelp();
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc) return;
      const onSelection = () => scheduleSelectionHelp(iframe);
      const onScrollOrBlur = () => hideSelectionHelp();
      const onFramePointerDown = () => {
        if (state.open) closePanel();
        hideSelectionHelp();
      };
      doc.addEventListener("pointerdown", onFramePointerDown, true);
      doc.addEventListener("mouseup", onSelection);
      doc.addEventListener("keyup", onSelection);
      doc.addEventListener("selectionchange", onSelection);
      iframe.contentWindow.addEventListener("scroll", onScrollOrBlur, true);
      window.addEventListener("resize", onScrollOrBlur);
      selectionCleanup = () => {
        clearTimeout(selectionTimer);
        doc.removeEventListener("pointerdown", onFramePointerDown, true);
        doc.removeEventListener("mouseup", onSelection);
        doc.removeEventListener("keyup", onSelection);
        doc.removeEventListener("selectionchange", onSelection);
        try {
          iframe.contentWindow.removeEventListener("scroll", onScrollOrBlur, true);
        } catch (err) {}
        window.removeEventListener("resize", onScrollOrBlur);
      };
    } catch (err) {}
  }

  function normalizeSpeechText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/([。！？；])/g, "$1\n")
      .trim();
  }

  function populateVoices() {
    if (!supportSpeech) {
      voiceSelect.innerHTML = `<option>浏览器不支持</option>`;
      updateButtons();
      return;
    }
    voiceSelect.innerHTML = TTS_VOICES
      .map(voice => `<option value="${safeHtml(voice.value)}">${safeHtml(voice.label)}</option>`)
      .join("");
    voiceSelect.value = state.voiceURI || "";
    updateButtons();
  }

  function updateRateLabel() {
    rateValue.textContent = `${state.rate.toFixed(2)}x`;
    rateInput.value = String(state.rate);
  }

  function providerModelLabel(data) {
    if (!data?.model) return "";
    if (data.provider === "ollama") return `本地 Ollama · ${data.model}`;
    if (data.provider === "external") return `外部 API · ${data.model}`;
    return data.model;
  }

  function stopAudio(message = "已停止。", options = {}) {
    const { cancelStream = true, keepDockSpeech = false } = options;
    if (cancelStream) {
      stopAnswerStream();
    }
    if (!keepDockSpeech) {
      hideDockSpeech();
    }
    if (currentAudio) {
      const audio = currentAudio;
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      currentAudio = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = "";
    }
    state.speaking = false;
    state.paused = false;
    setStatus(message);
    updateButtons();
  }

  async function speak(text, options = {}) {
    const { onPlay, keepDockSpeech = false } = options;
    if (!supportSpeech) {
      setStatus("当前浏览器不支持音频播放。");
      return false;
    }
    const speechText = normalizeSpeechText(text);
    if (!speechText) {
      setStatus("当前页面没有可朗读文本。");
      return false;
    }
    stopAudio("正在生成朗读音频。", { keepDockSpeech });
    try {
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: speechText,
          provider: state.ttsProvider || "edge",
          voice: state.voiceURI || "zh-CN-XiaoxiaoNeural",
          rate: state.rate,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `请求失败：${resp.status}`);
      }
      const blob = await resp.blob();
      currentAudioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentAudioUrl);
      let didCallOnPlay = false;
      currentAudio.onplay = () => {
        state.speaking = true;
        state.paused = false;
        setStatus("正在朗读。");
        updateButtons();
        if (!didCallOnPlay && typeof onPlay === "function") {
          didCallOnPlay = true;
          onPlay(currentAudio);
        }
      };
      currentAudio.onpause = () => {
        if (!currentAudio || currentAudio.ended) return;
        state.paused = true;
        setStatus("已暂停。");
        updateButtons();
      };
      currentAudio.onended = () => {
        stopAudio("朗读结束。", { cancelStream: false });
      };
      currentAudio.onerror = () => {
        stopAudio("朗读失败，请重新尝试。");
      };
      state.speaking = true;
      state.paused = false;
      updateButtons();
      await currentAudio.play();
      return true;
    } catch (err) {
      stopAudio(`朗读失败：${err.message}`);
      return false;
    }
  }

  async function explainCurrentPage() {
    if (!state.text) return;
    openPanel("ask");
    explainBtn.disabled = true;
    const explainQuestion = "请帮我讲解当前页内容";
    renderConversation(explainQuestion, "正在回答...", { loading: true });
    setDockSpeech("", true, { loading: true });
    setStatus("AI 正在根据当前理论页生成讲解。");
    try {
      const resp = await fetch("/api/theory_explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: state.pageId,
          title: state.title,
          text: state.text,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `请求失败：${resp.status}`);
      state.explanation = data.explanation || "";
      const visibleExplanation = state.explanation || "没有生成可用讲解。";
      if (state.explanation) {
        let streamStarted = false;
        let streamPromise = Promise.resolve();
        setStatus("讲解已生成，正在准备朗读。");
        const audioStarted = await speak(state.explanation, {
          keepDockSpeech: true,
          onPlay: (audio) => {
            streamStarted = true;
            streamPromise = streamConversation(explainQuestion, visibleExplanation, { audio });
          },
        });
        if (!audioStarted && !streamStarted) {
          streamPromise = streamConversation(explainQuestion, visibleExplanation);
        }
        await streamPromise;
        rememberTurn(explainQuestion, visibleExplanation);
        state.activeTurn = null;
        if (state.open) renderChatHistory({ scrollToEnd: true });
      } else {
        await streamConversation(explainQuestion, visibleExplanation);
      }
      const sourceLabel = providerModelLabel(data);
      setStatus(sourceLabel ? `讲解已生成，来源：${sourceLabel}` : "讲解已生成。");
    } catch (err) {
      renderConversation(explainQuestion, `讲解生成失败：${err.message}`, { error: true });
      setStatus("可以先使用“朗读全文”。");
    } finally {
      updateButtons();
    }
  }

  async function askCurrentPage(question) {
    const cleanQuestion = String(question || "").trim();
    if (!state.text || cleanQuestion.length < 2) return;
    openPanel("ask");
    questionInput.value = "";
    askBtn.disabled = true;
    updateButtons();
    renderConversation(cleanQuestion, "正在回答...", { loading: true });
    setDockSpeech("", true, { loading: true });
    setStatus("AI 正在根据当前理论页回答。");
    try {
      const resp = await fetch("/api/theory_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: state.pageId,
          title: state.title,
          text: state.text,
          history: currentChatHistory(),
          pages: currentPageContext(),
          question: cleanQuestion,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `请求失败：${resp.status}`);
      const answer = data.answer || "";
      const visibleAnswer = answer || "没有生成可用回答。";
      if (answer) {
        let streamStarted = false;
        let streamPromise = Promise.resolve();
        setStatus("回答已生成，正在准备朗读。");
        const audioStarted = await speak(answer, {
          keepDockSpeech: true,
          onPlay: (audio) => {
            streamStarted = true;
            streamPromise = streamConversation(cleanQuestion, visibleAnswer, { audio });
          },
        });
        if (!audioStarted && !streamStarted) {
          streamPromise = streamConversation(cleanQuestion, visibleAnswer);
        }
        await streamPromise;
        rememberTurn(cleanQuestion, visibleAnswer);
        state.activeTurn = null;
        if (state.open) renderChatHistory({ scrollToEnd: true });
      } else {
        await streamConversation(cleanQuestion, visibleAnswer);
      }
      const sourceLabel = providerModelLabel(data);
      setStatus(sourceLabel ? `回答已生成，来源：${sourceLabel}` : "回答已生成。");
    } catch (err) {
      renderConversation(cleanQuestion, `问答失败：${err.message}`, { error: true });
      setStatus("可以换个问法，或先使用“智能页面讲解”。");
    } finally {
      updateButtons();
    }
  }

  function readCurrentPage() {
    openPanel("explain");
    renderAssistantMessage(state.text || "当前页面没有可朗读文本。");
    speak(state.text);
  }

  fab.addEventListener("click", () => {
    if (state.open) {
      closePanel();
    } else {
      openQuestionPanel();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!state.open) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".theory-assistant-dock")) return;
    if (target.closest(".theory-selection-help")) return;
    if (target.closest(".theory-assistant-ask")) return;
    closePanel();
  });
  explainBtn.addEventListener("click", explainCurrentPage);
  readBtn.addEventListener("click", readCurrentPage);
  quickExplainBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    explainCurrentPage();
  });
  quickAskBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openQuestionPanel();
  });
  selectionHelpBtn.addEventListener("mousedown", event => {
    event.preventDefault();
  });
  selectionHelpBtn.addEventListener("click", () => {
    const text = selectedTheoryText;
    hideSelectionHelp();
    if (!text) return;
    askCurrentPage(`我选中的这部分没看懂，请结合当前页详细讲讲：\n${text}`);
    try {
      const doc = selectionFrame?.contentDocument || selectionFrame?.contentWindow?.document;
      doc?.getSelection()?.removeAllRanges();
    } catch (err) {}
  });
  questionInput.addEventListener("input", updateButtons);
  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      askCurrentPage(questionInput.value);
    }
  });
  askBtn.addEventListener("click", () => askCurrentPage(questionInput.value));
  voiceSelect.addEventListener("change", () => {
    state.voiceURI = normalizeVoiceForProvider(state.ttsProvider, voiceSelect.value);
    writeStorage(VOICE_KEY, state.voiceURI);
    populateVoices();
  });
  rateInput.addEventListener("input", () => {
    const nextRate = Number(rateInput.value);
    if (Number.isFinite(nextRate)) {
      state.rate = nextRate;
      writeStorage(RATE_KEY, String(nextRate));
      updateRateLabel();
    }
  });
  pauseBtn.addEventListener("click", () => {
    if (currentAudio) currentAudio.pause();
  });
  resumeBtn.addEventListener("click", () => {
    if (currentAudio) currentAudio.play();
  });
  stopBtn.addEventListener("click", () => {
    stopAudio("已停止。");
  });
  fabPauseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (currentAudio) currentAudio.pause();
  });
  fabResumeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (currentAudio) currentAudio.play();
  });
  fabStopBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    stopAudio("已停止。");
  });
  window.addEventListener("beforeunload", () => {
    stopAnswerStream();
    stopAudio("");
  });
  populateVoices();
  updateRateLabel();

  window.TheoryAssistant = {
    show(pageId, title) {
      document.body.classList.add("has-theory-assistant");
      state.pageId = pageId || state.pageId;
      state.title = title || state.title;
      titleEl.textContent = "AI助教";
      subEl.textContent = state.title ? `正在阅读：${state.title}` : "理论页讲解 / 朗读 / 问答";
      updateButtons();
    },
    hide() {
      document.body.classList.remove("has-theory-assistant");
      closePanel();
      stopAudio("");
      state.speaking = false;
      state.paused = false;
      hideSelectionHelp();
      updateButtons();
    },
    attachSelectionTarget,
    audioSettings() {
      return {
        voiceURI: state.voiceURI,
        ttsProvider: state.ttsProvider,
        rate: state.rate,
        voices: TTS_VOICES.slice(),
      };
    },
    updateAudioSettings(settings = {}) {
      if (settings.ttsProvider && ["edge", "macos", "melotts"].includes(settings.ttsProvider)) {
        state.ttsProvider = settings.ttsProvider;
        writeStorage(TTS_PROVIDER_KEY, state.ttsProvider);
      }
      if (settings.voiceURI && TTS_VOICES.some(voice => voice.value === settings.voiceURI)) {
        state.voiceURI = normalizeVoiceForProvider(state.ttsProvider, settings.voiceURI);
        writeStorage(VOICE_KEY, state.voiceURI);
      }
      const nextRate = Number(settings.rate);
      if (Number.isFinite(nextRate) && nextRate >= 0.85 && nextRate <= 1.45) {
        state.rate = nextRate;
        writeStorage(RATE_KEY, String(nextRate));
      }
      populateVoices();
      updateRateLabel();
      updateButtons();
    },
    setPage(page) {
      const nextPageId = page.id || "";
      state.pageId = nextPageId;
      state.title = page.title || "当前理论页";
      state.text = page.text || "";
      state.explanation = "";
      rememberPage({ id: state.pageId, title: state.title, text: state.text });
      questionInput.value = "";
      titleEl.textContent = "AI助教";
      subEl.textContent = state.title ? `正在阅读：${state.title}` : "理论页讲解 / 朗读 / 问答";
      if (!state.speaking && !streamTimer && !dockSpeechLoading) {
        const hasHistory = renderChatHistory({ scrollToEnd: true });
        if (!hasHistory) {
          renderAssistantMessage(
            state.text
              ? "我已经读完这一页了，可以帮你讲解，也可以回答你对这一页的疑问。"
              : "当前理论页内容还在加载，稍后再试。"
          );
        }
      }
      const unsupported = [];
      if (!supportSpeech) unsupported.push("本机朗读");
      setStatus(unsupported.length ? unsupported.join(" ") : "");
      updateButtons();
    },
  };
})();
