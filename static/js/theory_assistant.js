// Theory assistant floating panel.

(function initTheoryAssistant() {
  const VOICE_KEY = "linearRegressionTheoryAssistantVoice";
  const RATE_KEY = "linearRegressionTheoryAssistantRate";
  const TTS_VOICES = [
    { value: "zh-CN-XiaoxiaoNeural", label: "晓晓 · 女声 · 温暖" },
    { value: "zh-CN-XiaoyiNeural", label: "小艺 · 女声 · 活泼" },
    { value: "zh-CN-YunxiNeural", label: "云希 · 男声 · 阳光" },
    { value: "zh-CN-YunyangNeural", label: "云扬 · 男声 · 稳重" },
    { value: "zh-CN-YunjianNeural", label: "云健 · 男声 · 有力" },
    { value: "zh-CN-YunxiaNeural", label: "云夏 · 男声 · 年轻" },
    { value: "Tingting", label: "婷婷 · 本机备用" },
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

  function savedVoice() {
    const value = readStorage(VOICE_KEY);
    return TTS_VOICES.some(voice => voice.value === value) ? value : "zh-CN-XiaoxiaoNeural";
  }

  const state = {
    pageId: "",
    title: "当前理论页",
    text: "",
    explanation: "",
    open: false,
    speaking: false,
    paused: false,
    listening: false,
    rate: savedRate(),
    voiceURI: savedVoice(),
  };

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const supportSpeech = "Audio" in window && "fetch" in window;
  const hasRecognitionEngine = Boolean(Recognition);
  const hasMicrophoneApi = Boolean(navigator.mediaDevices?.getUserMedia);
  let currentAudio = null;
  let currentAudioUrl = "";
  let micStream = null;
  let micAudioContext = null;
  let micSource = null;
  let micMonitorFrame = 0;
  let micPeakLevel = 0;

  const shell = document.createElement("div");
  shell.innerHTML = `
    <button class="theory-assistant-fab" id="theoryAssistantFab" type="button" aria-label="打开理论智能助手">
      <img class="theory-assistant-logo" src="/static/aiLogo-Cusx885-.png" alt="">
    </button>
    <section class="theory-assistant-panel" id="theoryAssistantPanel" aria-label="理论智能助手">
      <div class="theory-assistant-head">
        <div class="theory-assistant-identity">
          <span class="theory-assistant-mark" aria-hidden="true">
            <img src="/static/aiLogo-Cusx885-.png" alt="">
          </span>
          <div>
            <strong id="theoryAssistantTitle">AI助教</strong>
            <span id="theoryAssistantSub">理论页讲解 / 朗读 / 问答</span>
          </div>
        </div>
        <button class="theory-assistant-close" id="theoryAssistantClose" type="button" aria-label="关闭理论智能助手">×</button>
      </div>
      <div class="theory-assistant-actions">
        <button class="primary" id="theoryExplainBtn" type="button">讲解当前页</button>
        <button id="theoryReadBtn" type="button">朗读全文</button>
      </div>
      <div class="theory-assistant-voice">
        <label>
          <span>神经音色</span>
          <select id="theoryVoiceSelect"></select>
        </label>
        <label>
          <span>语速 <strong id="theoryRateValue">1.15x</strong></span>
          <input id="theoryRateInput" type="range" min="0.85" max="1.45" step="0.05" value="1.15">
        </label>
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
        <div class="theory-assistant-status" id="theoryAssistantStatus" role="status" aria-live="polite"></div>
      </div>
    </section>
  `;
  document.body.append(...Array.from(shell.children));

  const fab = document.getElementById("theoryAssistantFab");
  const panel = document.getElementById("theoryAssistantPanel");
  const closeBtn = document.getElementById("theoryAssistantClose");
  const explainBtn = document.getElementById("theoryExplainBtn");
  const readBtn = document.getElementById("theoryReadBtn");
  const voiceSelect = document.getElementById("theoryVoiceSelect");
  const rateInput = document.getElementById("theoryRateInput");
  const rateValue = document.getElementById("theoryRateValue");
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

  function voiceQuestionIssue() {
    if (!window.isSecureContext) {
      return "语音提问需要浏览器信任的 HTTPS 或 localhost，证书未被信任也会被拦截。";
    }
    if (!hasMicrophoneApi) {
      return "当前浏览器无法读取麦克风。";
    }
    if (!AudioContextCtor) {
      return "当前浏览器无法检测麦克风音量。";
    }
    if (!hasRecognitionEngine) {
      return "当前浏览器没有语音识别能力，建议使用 Chrome。";
    }
    return "";
  }

  function updateButtons() {
    const hasText = state.text.length > 20;
    const hasQuestion = questionInput.value.trim().length >= 2;
    const voiceIssue = voiceQuestionIssue();
    explainBtn.disabled = !hasText;
    readBtn.disabled = !hasText || !supportSpeech;
    askBtn.disabled = !hasText || !hasQuestion;
    voiceBtn.disabled = !hasText || Boolean(voiceIssue) || state.listening;
    voiceBtn.textContent = state.listening ? "正在听..." : "语音提问";
    voiceBtn.title = voiceIssue || "";
    voiceSelect.disabled = !supportSpeech;
    rateInput.disabled = !supportSpeech;
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

  function stopAudio(message = "已停止。") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
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

  function stopMicMonitor() {
    if (micMonitorFrame) {
      cancelAnimationFrame(micMonitorFrame);
      micMonitorFrame = 0;
    }
    if (micSource) {
      micSource.disconnect();
      micSource = null;
    }
    if (micAudioContext) {
      micAudioContext.close().catch(() => {});
      micAudioContext = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }
  }

  function startMicMonitor(stream) {
    stopMicMonitor();
    micStream = stream;
    micPeakLevel = 0;
    micAudioContext = new AudioContextCtor();
    const analyser = micAudioContext.createAnalyser();
    analyser.fftSize = 1024;
    micSource = micAudioContext.createMediaStreamSource(stream);
    micSource.connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let lastStatusAt = 0;

    const readLevel = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const centered = (samples[index] - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      micPeakLevel = Math.max(micPeakLevel, rms);

      const now = performance.now();
      if (state.listening && now - lastStatusAt > 700) {
        if (rms > 0.025) {
          setStatus("正在听，麦克风已有输入。请直接说出完整问题。");
        } else if (now - startedAt > 1500) {
          setStatus("正在听，但麦克风音量很低。请检查系统输入设备是否选中了耳机麦克风。");
        }
        lastStatusAt = now;
      }

      micMonitorFrame = requestAnimationFrame(readLevel);
    };

    readLevel();
  }

  async function speak(text) {
    if (!supportSpeech) {
      setStatus("当前浏览器不支持音频播放。");
      return;
    }
    const speechText = normalizeSpeechText(text);
    if (!speechText) {
      setStatus("当前页面没有可朗读文本。");
      return;
    }
    stopAudio("正在生成朗读音频。");
    try {
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: speechText,
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
      currentAudio.onplay = () => {
        state.speaking = true;
        state.paused = false;
        setStatus("正在朗读。");
        updateButtons();
      };
      currentAudio.onpause = () => {
        if (!currentAudio || currentAudio.ended) return;
        state.paused = true;
        setStatus("已暂停。");
        updateButtons();
      };
      currentAudio.onended = () => {
        stopAudio("朗读结束。");
      };
      currentAudio.onerror = () => {
        stopAudio("朗读失败，请重新尝试。");
      };
      state.speaking = true;
      state.paused = false;
      updateButtons();
      await currentAudio.play();
    } catch (err) {
      stopAudio(`朗读失败：${err.message}`);
    }
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

  function microphoneErrorMessage(error) {
    const name = error?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
      return "麦克风权限被拒绝。请在地址栏允许麦克风，或在系统设置里给浏览器开启麦克风。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "没有检测到可用麦克风。请检查耳机麦克风或系统输入设备。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "麦克风暂时不可用，可能正在被其他应用占用。";
    }
    return `无法打开麦克风${error?.message ? `：${error.message}` : "。"}`;
  }

  function recognitionErrorMessage(error) {
    switch (error) {
      case "not-allowed":
      case "service-not-allowed":
        return "浏览器拒绝了语音识别。请允许麦克风权限，或换 Chrome 再试。";
      case "audio-capture":
        return "没有检测到可用麦克风。请检查耳机麦克风或系统输入设备。";
      case "no-speech":
        if (micPeakLevel < 0.018) {
          return "麦克风没有收到明显声音。请在系统声音输入里选择耳机麦克风，并确认输入音量没有被静音。";
        }
        return "麦克风有声音，但浏览器没有转成文字。建议换 Chrome，或接入后端语音转文字接口。";
      case "network":
        return "浏览器语音识别服务连接失败。可以换 Chrome，或后续接入后端语音转文字接口。";
      case "aborted":
        return "语音提问已取消。";
      default:
        return error ? `语音识别失败（${error}）。可以使用文字提问。` : "语音识别失败，可以使用文字提问。";
    }
  }

  async function requestMicrophoneStream() {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  async function startVoiceQuestion() {
    const issue = voiceQuestionIssue();
    if (issue) {
      setStatus(issue);
      return;
    }
    try {
      setStatus("正在请求麦克风权限。");
      const stream = await requestMicrophoneStream();
      startMicMonitor(stream);
    } catch (err) {
      stopMicMonitor();
      setStatus(microphoneErrorMessage(err));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      state.listening = true;
      setStatus("正在听，请看到这行提示后说出完整问题。");
      updateButtons();
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      questionInput.value = transcript;
      updateButtons();
      if (transcript) askCurrentPage(transcript);
    };
    recognition.onerror = (event) => {
      state.listening = false;
      setStatus(recognitionErrorMessage(event?.error));
      updateButtons();
    };
    recognition.onend = () => {
      state.listening = false;
      stopMicMonitor();
      updateButtons();
    };
    try {
      recognition.start();
    } catch (err) {
      stopMicMonitor();
      setStatus(`语音识别启动失败${err?.message ? `：${err.message}` : "。"}`);
      state.listening = false;
      updateButtons();
    }
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
  voiceSelect.addEventListener("change", () => {
    state.voiceURI = voiceSelect.value;
    writeStorage(VOICE_KEY, state.voiceURI);
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
  window.addEventListener("beforeunload", () => {
    stopMicMonitor();
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
      stopMicMonitor();
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
      titleEl.textContent = "AI助教";
      subEl.textContent = state.title ? `正在阅读：${state.title}` : "理论页讲解 / 朗读 / 问答";
      bodyEl.textContent = state.text
        ? "已读取当前理论页内容。可以点击“讲解当前页”、朗读全文，或围绕当前页提问。"
        : "当前理论页内容还在加载，稍后再试。";
      const unsupported = [];
      if (!supportSpeech) unsupported.push("本机朗读");
      const voiceIssue = voiceQuestionIssue();
      if (voiceIssue) unsupported.push(voiceIssue);
      setStatus(unsupported.length ? unsupported.join(" ") : "");
      updateButtons();
    },
  };
})();
