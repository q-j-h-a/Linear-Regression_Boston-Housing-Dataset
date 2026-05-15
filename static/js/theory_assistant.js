// Theory assistant floating panel.

(function initTheoryAssistant() {
  const state = {
    pageId: "",
    title: "当前理论页",
    text: "",
    explanation: "",
    open: false,
    speaking: false,
    paused: false,
    listening: false,
  };

  const supportSpeech = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supportRecognition = Boolean(Recognition);

  const shell = document.createElement("div");
  shell.innerHTML = `
    <button class="theory-assistant-fab" id="theoryAssistantFab" type="button" aria-label="打开理论智能助手">AI</button>
    <section class="theory-assistant-panel" id="theoryAssistantPanel" aria-label="理论智能助手">
      <div class="theory-assistant-head">
        <div>
          <strong id="theoryAssistantTitle">理论智能助手</strong>
          <span id="theoryAssistantSub">可讲解或朗读当前理论页</span>
        </div>
        <button class="theory-assistant-close" id="theoryAssistantClose" type="button" aria-label="关闭理论智能助手">×</button>
      </div>
      <div class="theory-assistant-actions">
        <button class="primary" id="theoryExplainBtn" type="button">讲解当前页</button>
        <button id="theoryReadBtn" type="button">朗读全文</button>
      </div>
      <div class="theory-assistant-ask">
        <textarea id="theoryQuestionInput" rows="2" placeholder="围绕当前页提问"></textarea>
        <div class="theory-assistant-ask-actions">
          <button id="theoryAskBtn" type="button">提问</button>
          <button id="theoryVoiceBtn" type="button">语音提问</button>
        </div>
      </div>
      <div class="theory-assistant-body" id="theoryAssistantBody">打开一个理论页面后，可以让助手讲解或朗读当前内容。</div>
      <div class="theory-assistant-control">
        <button id="theoryPauseBtn" type="button" disabled>暂停</button>
        <button id="theoryResumeBtn" type="button" disabled>继续</button>
        <button id="theoryStopBtn" type="button" disabled>停止</button>
        <div class="theory-assistant-status" id="theoryAssistantStatus"></div>
      </div>
    </section>
  `;
  document.body.append(...Array.from(shell.children));

  const fab = document.getElementById("theoryAssistantFab");
  const panel = document.getElementById("theoryAssistantPanel");
  const closeBtn = document.getElementById("theoryAssistantClose");
  const explainBtn = document.getElementById("theoryExplainBtn");
  const readBtn = document.getElementById("theoryReadBtn");
  const questionInput = document.getElementById("theoryQuestionInput");
  const askBtn = document.getElementById("theoryAskBtn");
  const voiceBtn = document.getElementById("theoryVoiceBtn");
  const pauseBtn = document.getElementById("theoryPauseBtn");
  const resumeBtn = document.getElementById("theoryResumeBtn");
  const stopBtn = document.getElementById("theoryStopBtn");
  const titleEl = document.getElementById("theoryAssistantTitle");
  const subEl = document.getElementById("theoryAssistantSub");
  const bodyEl = document.getElementById("theoryAssistantBody");
  const statusEl = document.getElementById("theoryAssistantStatus");

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function updateButtons() {
    const hasText = state.text.length > 20;
    const hasQuestion = questionInput.value.trim().length >= 2;
    explainBtn.disabled = !hasText;
    readBtn.disabled = !hasText || !supportSpeech;
    askBtn.disabled = !hasText || !hasQuestion;
    voiceBtn.disabled = !hasText || !supportRecognition || state.listening;
    pauseBtn.disabled = !state.speaking || state.paused;
    resumeBtn.disabled = !state.speaking || !state.paused;
    stopBtn.disabled = !state.speaking;
  }

  function openPanel() {
    state.open = true;
    panel.classList.add("open");
    updateButtons();
  }

  function closePanel() {
    state.open = false;
    panel.classList.remove("open");
  }

  function normalizeSpeechText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/([。！？；])/g, "$1\n")
      .trim();
  }

  function speak(text) {
    if (!supportSpeech) {
      setStatus("当前浏览器不支持本地朗读。");
      return;
    }
    const speechText = normalizeSpeechText(text);
    if (!speechText) {
      setStatus("当前页面没有可朗读文本。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => {
      state.speaking = true;
      state.paused = false;
      setStatus("正在朗读。");
      updateButtons();
    };
    utterance.onpause = () => {
      state.paused = true;
      setStatus("已暂停。");
      updateButtons();
    };
    utterance.onresume = () => {
      state.paused = false;
      setStatus("继续朗读。");
      updateButtons();
    };
    utterance.onend = () => {
      state.speaking = false;
      state.paused = false;
      setStatus("朗读结束。");
      updateButtons();
    };
    utterance.onerror = () => {
      state.speaking = false;
      state.paused = false;
      setStatus("朗读失败，请重新尝试。");
      updateButtons();
    };
    window.speechSynthesis.speak(utterance);
  }

  async function explainCurrentPage() {
    if (!state.text) return;
    openPanel();
    explainBtn.disabled = true;
    bodyEl.textContent = "正在生成当前页讲解...";
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
      bodyEl.textContent = state.explanation || "没有生成可用讲解。";
      setStatus(data.model ? `讲解已生成，模型：${data.model}` : "讲解已生成。");
      if (state.explanation) speak(state.explanation);
    } catch (err) {
      bodyEl.textContent = `讲解生成失败：${err.message}`;
      setStatus("可以先使用“朗读全文”。");
    } finally {
      updateButtons();
    }
  }

  async function askCurrentPage(question) {
    const cleanQuestion = String(question || "").trim();
    if (!state.text || cleanQuestion.length < 2) return;
    openPanel();
    askBtn.disabled = true;
    bodyEl.textContent = `你问：${cleanQuestion}\n\n正在回答...`;
    setStatus("AI 正在根据当前理论页回答。");
    try {
      const resp = await fetch("/api/theory_chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: state.pageId,
          title: state.title,
          text: state.text,
          question: cleanQuestion,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `请求失败：${resp.status}`);
      const answer = data.answer || "";
      bodyEl.textContent = `你问：${cleanQuestion}\n\n助手：${answer || "没有生成可用回答。"}`;
      setStatus(data.model ? `回答已生成，模型：${data.model}` : "回答已生成。");
      if (answer) speak(answer);
    } catch (err) {
      bodyEl.textContent = `问答失败：${err.message}`;
      setStatus("可以换个问法，或先使用“讲解当前页”。");
    } finally {
      updateButtons();
    }
  }

  function readCurrentPage() {
    openPanel();
    bodyEl.textContent = state.text || "当前页面没有可朗读文本。";
    speak(state.text);
  }

  function startVoiceQuestion() {
    if (!supportRecognition) {
      setStatus("当前浏览器不支持语音提问，可以使用文字提问。");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      state.listening = true;
      setStatus("正在听，请说出你的问题。");
      updateButtons();
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      questionInput.value = transcript;
      updateButtons();
      if (transcript) askCurrentPage(transcript);
    };
    recognition.onerror = () => {
      setStatus("语音提问失败，可以使用文字提问。");
    };
    recognition.onend = () => {
      state.listening = false;
      updateButtons();
    };
    recognition.start();
  }

  fab.addEventListener("click", () => {
    if (state.open) {
      closePanel();
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener("click", closePanel);
  explainBtn.addEventListener("click", explainCurrentPage);
  readBtn.addEventListener("click", readCurrentPage);
  questionInput.addEventListener("input", updateButtons);
  askBtn.addEventListener("click", () => askCurrentPage(questionInput.value));
  voiceBtn.addEventListener("click", startVoiceQuestion);
  pauseBtn.addEventListener("click", () => {
    if (supportSpeech) window.speechSynthesis.pause();
  });
  resumeBtn.addEventListener("click", () => {
    if (supportSpeech) window.speechSynthesis.resume();
  });
  stopBtn.addEventListener("click", () => {
    if (supportSpeech) window.speechSynthesis.cancel();
    state.speaking = false;
    state.paused = false;
    setStatus("已停止。");
    updateButtons();
  });
  window.addEventListener("beforeunload", () => {
    if (supportSpeech) window.speechSynthesis.cancel();
  });

  window.TheoryAssistant = {
    show(pageId, title) {
      document.body.classList.add("has-theory-assistant");
      state.pageId = pageId || state.pageId;
      state.title = title || state.title;
      titleEl.textContent = state.title;
      subEl.textContent = "可讲解或朗读当前理论页";
      updateButtons();
    },
    hide() {
      document.body.classList.remove("has-theory-assistant");
      closePanel();
      if (supportSpeech) window.speechSynthesis.cancel();
      state.speaking = false;
      state.paused = false;
      state.listening = false;
      updateButtons();
    },
    setPage(page) {
      state.pageId = page.id || "";
      state.title = page.title || "当前理论页";
      state.text = page.text || "";
      state.explanation = "";
      questionInput.value = "";
      titleEl.textContent = state.title;
      bodyEl.textContent = state.text
        ? "已读取当前理论页内容。可以点击“讲解当前页”、朗读全文，或围绕当前页提问。"
        : "当前理论页内容还在加载，稍后再试。";
      const unsupported = [];
      if (!supportSpeech) unsupported.push("本地朗读");
      if (!supportRecognition) unsupported.push("语音提问");
      setStatus(unsupported.length ? `当前浏览器不支持${unsupported.join("、")}。` : "");
      updateButtons();
    },
  };
})();
