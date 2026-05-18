// AI assistant settings page.

const ASSISTANT_VOICE_KEY = "linearRegressionTheoryAssistantVoice";
const ASSISTANT_RATE_KEY = "linearRegressionTheoryAssistantRate";
const ASSISTANT_TTS_PROVIDER_KEY = "linearRegressionTheoryAssistantTtsProvider";
const ASSISTANT_SAMPLE_TEXT = "你好，我是 AI 助教。这是当前音色和语速的试听效果。";

const ASSISTANT_VOICE_OPTIONS = [
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
  { value: "cosyvoice:中文女", label: "CosyVoice 中文女 · 本地模型" },
  { value: "cosyvoice:中文男", label: "CosyVoice 中文男 · 本地模型" },
  { value: "cosyvoice:粤语女", label: "CosyVoice 粤语女 · 本地模型" },
  { value: "cosyvoice:英文女", label: "CosyVoice 英文女 · 本地模型" },
  { value: "cosyvoice:英文男", label: "CosyVoice 英文男 · 本地模型" },
  { value: "mlx_audio:zf_xiaobei", label: "Kokoro 小北 · 中文女声 · MLX" },
  { value: "mlx_audio:zf_xiaoni", label: "Kokoro 小妮 · 中文女声 · MLX" },
  { value: "mlx_audio:zf_xiaoxiao", label: "Kokoro 晓晓 · 中文女声 · MLX" },
  { value: "mlx_audio:zf_xiaoyi", label: "Kokoro 小艺 · 中文女声 · MLX" },
  { value: "mlx_audio:zm_yunxi", label: "Kokoro 云希 · 中文男声 · MLX" },
  { value: "mlx_audio:zm_yunxia", label: "Kokoro 云夏 · 中文男声 · MLX" },
  { value: "mlx_audio:zm_yunyang", label: "Kokoro 云扬 · 中文男声 · MLX" },
  { value: "mlx_audio:zm_yunjian", label: "Kokoro 云健 · 中文男声 · MLX" },
  { value: "qwen3_tts:vivian", label: "Qwen3 Vivian · 中文女声" },
  { value: "qwen3_tts:serena", label: "Qwen3 Serena · 中文女声" },
  { value: "qwen3_tts:uncle_fu", label: "Qwen3 Uncle Fu · 中文男声" },
  { value: "qwen3_tts:dylan", label: "Qwen3 Dylan · 北京男声" },
  { value: "qwen3_tts:eric", label: "Qwen3 Eric · 成都男声" },
  { value: "qwen3_tts:ryan", label: "Qwen3 Ryan · 英文男声" },
  { value: "qwen3_tts:aiden", label: "Qwen3 Aiden · 英文男声" },
  { value: "qwen3_tts:ono_anna", label: "Qwen3 Ono Anna · 日文女声" },
  { value: "qwen3_tts:sohee", label: "Qwen3 Sohee · 韩文女声" },
];

let settingsAudioUrl = "";

function readAssistantSetting(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (err) {
    return "";
  }
}

function writeAssistantSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {}
}

function assistantProviderLabel(provider) {
  if (provider === "ollama") return "仅本地 Ollama";
  if (provider === "external") return "仅外部 API";
  return "本地优先";
}

function assistantRuntimeLabel(provider, model) {
  if (provider === "ollama") return `本地 Ollama · ${model || "-"}`;
  if (provider === "external") return `外部 API · ${model || "-"}`;
  return model || "-";
}

function assistantTtsProviderLabel(provider) {
  if (provider === "qwen3_tts") return "Qwen3-TTS 本地语音";
  if (provider === "mlx_audio") return "MLX-Audio Kokoro 本地语音";
  if (provider === "cosyvoice") return "CosyVoice 本地模型";
  if (provider === "melotts") return "MeloTTS 本地模型";
  if (provider === "macos") return "macOS 本机语音";
  return "Edge TTS 在线语音";
}

function assistantVoiceLabel(value) {
  return ASSISTANT_VOICE_OPTIONS.find(item => item.value === value)?.label || value || "未设置";
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
  const cosyVoices = new Set(["cosyvoice:中文女", "cosyvoice:中文男", "cosyvoice:粤语女", "cosyvoice:英文女", "cosyvoice:英文男"]);
  const mlxAudioVoices = new Set([
    "mlx_audio:zf_xiaobei",
    "mlx_audio:zf_xiaoni",
    "mlx_audio:zf_xiaoxiao",
    "mlx_audio:zf_xiaoyi",
    "mlx_audio:zm_yunxi",
    "mlx_audio:zm_yunxia",
    "mlx_audio:zm_yunyang",
    "mlx_audio:zm_yunjian",
  ]);
  const qwen3Voices = new Set([
    "qwen3_tts:vivian",
    "qwen3_tts:serena",
    "qwen3_tts:uncle_fu",
    "qwen3_tts:dylan",
    "qwen3_tts:eric",
    "qwen3_tts:ryan",
    "qwen3_tts:aiden",
    "qwen3_tts:ono_anna",
    "qwen3_tts:sohee",
  ]);
  if (provider === "qwen3_tts") return qwen3Voices.has(voice) ? voice : "qwen3_tts:vivian";
  if (provider === "mlx_audio") return mlxAudioVoices.has(voice) ? voice : "mlx_audio:zf_xiaoxiao";
  if (provider === "cosyvoice") return cosyVoices.has(voice) ? voice : "cosyvoice:中文女";
  if (provider === "melotts") return "melotts:ZH";
  if (provider === "macos") return macosVoices.has(voice) ? voice : "Tingting";
  return edgeVoices.has(voice) ? voice : "zh-CN-XiaoxiaoNeural";
}

function currentAssistantAudioSettings(config = null) {
  const savedProvider = readAssistantSetting(ASSISTANT_TTS_PROVIDER_KEY);
  const provider = ["edge", "macos", "melotts", "cosyvoice", "mlx_audio", "qwen3_tts"].includes(savedProvider)
    ? savedProvider
    : (config?.tts?.provider || "edge");
  const savedVoice = readAssistantSetting(ASSISTANT_VOICE_KEY);
  const configVoice = config?.tts?.default_voice || "";
  const voice = ASSISTANT_VOICE_OPTIONS.some(item => item.value === savedVoice)
    ? savedVoice
    : (ASSISTANT_VOICE_OPTIONS.some(item => item.value === configVoice) ? configVoice : "zh-CN-XiaoxiaoNeural");
  const rateValue = Number(readAssistantSetting(ASSISTANT_RATE_KEY));
  const configRate = Number(config?.tts?.default_rate);
  const rate = Number.isFinite(rateValue) && rateValue >= 0.85 && rateValue <= 1.45
    ? rateValue
    : (Number.isFinite(configRate) && configRate >= 0.85 && configRate <= 1.45 ? configRate : 1.15);
  return { provider, voice: normalizeVoiceForProvider(provider, voice), rate };
}

function providerPill(provider, model) {
  const isExternal = provider === "external";
  return `<span class="settings-provider-pill${isExternal ? " external" : ""}">${escapeHtml(assistantRuntimeLabel(provider, model))}</span>`;
}

function renderSettingsSide(config, audio, latestTest = null) {
  const provider = config?.provider || "ollama_first";
  const apiKeyState = config?.external?.api_key_configured ? "外部 API key 已配置" : "外部 API key 未配置";
  const testHtml = latestTest
    ? `
      <div class="settings-test-box">
        <strong>最近一次模型测试</strong>
        <p>${providerPill(latestTest.provider, latestTest.model)}</p>
        <p style="margin-top:8px">${escapeHtml(latestTest.answer || "")}</p>
        <p class="settings-hint">耗时：${escapeHtml(String(latestTest.elapsed_ms || "-"))} ms</p>
      </div>
    `
    : `
      <div class="settings-test-box">
        <strong>模型测试结果</strong>
        <p>点击“测试当前模型”后，这里会显示实际调用来源、模型名和回复内容。</p>
      </div>
    `;

  $("rightPanel").innerHTML = `
    <div class="right-title">当前助教配置</div>
    <div class="helper-card">
      <h3>模型模式</h3>
      <p>${escapeHtml(assistantProviderLabel(provider))}</p>
      <div class="settings-badges">
        <span class="settings-badge">Ollama：${escapeHtml(config?.ollama?.model || "-")}</span>
        <span class="settings-badge">外部：${escapeHtml(config?.external?.model || "-")}</span>
      </div>
    </div>
    <div class="helper-card">
      <h3>语音设置</h3>
      <p>${escapeHtml(assistantTtsProviderLabel(audio.provider))}</p>
      <p>${escapeHtml(assistantVoiceLabel(audio.voice))}</p>
      <p>语速：${audio.rate.toFixed(2)}x</p>
      ${audio.provider === "melotts" ? `<p>服务：${escapeHtml(config?.tts?.melotts?.service_url || "http://127.0.0.1:8000/speech")}</p>` : ""}
      ${audio.provider === "melotts" ? `<p>命令：${escapeHtml(config?.tts?.melotts?.command || "melo")}</p>` : ""}
      ${audio.provider === "cosyvoice" ? `<p>服务：${escapeHtml(config?.tts?.cosyvoice?.service_url || "http://127.0.0.1:50000/inference_sft")}</p>` : ""}
      ${audio.provider === "cosyvoice" ? `<p>角色：${escapeHtml(config?.tts?.cosyvoice?.speaker || "中文女")}</p>` : ""}
      ${audio.provider === "mlx_audio" ? `<p>服务：${escapeHtml(config?.tts?.mlx_audio?.service_url || "http://127.0.0.1:50010/v1/audio/speech")}</p>` : ""}
      ${audio.provider === "mlx_audio" ? `<p>模型：${escapeHtml(config?.tts?.mlx_audio?.model || "mlx-community/Kokoro-82M-bf16")}</p>` : ""}
      ${audio.provider === "mlx_audio" ? `<p>音色：${escapeHtml(config?.tts?.mlx_audio?.voice || "zf_xiaoxiao")}</p>` : ""}
      ${audio.provider === "qwen3_tts" ? `<p>服务：${escapeHtml(config?.tts?.qwen3_tts?.service_url || "http://127.0.0.1:50010/v1/audio/speech")}</p>` : ""}
      ${audio.provider === "qwen3_tts" ? `<p>模型：${escapeHtml(config?.tts?.qwen3_tts?.model || ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit")}</p>` : ""}
      ${audio.provider === "qwen3_tts" ? `<p>角色：${escapeHtml(config?.tts?.qwen3_tts?.voice || "vivian")}</p>` : ""}
    </div>
    <div class="helper-card">
      <h3>外部接口</h3>
      <p>${escapeHtml(apiKeyState)}</p>
      <p>API key 不会在页面里回显。填入新 key 后，只会更新当前后端运行进程。</p>
    </div>
    ${testHtml}
  `;
}

function renderModelButtons(models, activeModel) {
  if (!Array.isArray(models) || !models.length) {
    return `<div class="empty-state" style="min-height:160px">没有读取到模型列表。</div>`;
  }
  return models
    .map(model => `
      <button class="${model === activeModel ? "active" : ""}" type="button" data-ollama-model="${escapeHtml(model)}">
        ${escapeHtml(model)}
      </button>
    `)
    .join("");
}

async function loadAssistantConfig() {
  const resp = await fetch("/api/assistant_config");
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "读取设置失败");
  return data;
}

function renderSettingsSummary(config, audio) {
  const provider = config?.provider || "ollama_first";
  return `
    <section class="settings-card settings-hero">
      <div>
        <h2>AI 助教设置</h2>
        <p class="settings-lead">本页用于演示前快速检查模型、接口、音色和语速。默认优先使用本机 Ollama，外部 API 作为可选方案。</p>
        <div class="settings-state-grid">
          <div class="settings-state-card">
            <span>模型模式</span>
            <strong id="settingsModeValue">${escapeHtml(assistantProviderLabel(provider))}</strong>
          </div>
          <div class="settings-state-card">
            <span>本地模型</span>
            <strong id="settingsModelValue">${escapeHtml(config?.ollama?.model || "-")}</strong>
          </div>
          <div class="settings-state-card">
            <span>朗读声音</span>
            <strong id="settingsVoiceValue">${escapeHtml(assistantTtsProviderLabel(audio.provider))} · ${escapeHtml(assistantVoiceLabel(audio.voice))} · ${audio.rate.toFixed(2)}x</strong>
          </div>
        </div>
      </div>
      <div class="settings-hero-mark">AI</div>
    </section>
  `;
}

function updateSettingsSummary(config, audio) {
  const modeEl = $("settingsModeValue");
  const modelEl = $("settingsModelValue");
  const voiceEl = $("settingsVoiceValue");
  if (modeEl) modeEl.textContent = assistantProviderLabel(config?.provider || "ollama_first");
  if (modelEl) modelEl.textContent = config?.ollama?.model || "-";
  if (voiceEl) voiceEl.textContent = `${assistantTtsProviderLabel(audio.provider)} · ${assistantVoiceLabel(audio.voice)} · ${audio.rate.toFixed(2)}x`;
}

function currentFormAudio(providerEl, voiceEl, rateEl) {
  const rateValue = Number(rateEl.value);
  return {
    provider: providerEl.value || "edge",
    voice: normalizeVoiceForProvider(providerEl.value || "edge", voiceEl.value || "zh-CN-XiaoxiaoNeural"),
    rate: Number.isFinite(rateValue) ? rateValue : 1.15,
  };
}

async function renderSettingsShell() {
  document.querySelector(".shell").classList.remove("theory");
  if (window.TheoryAssistant) window.TheoryAssistant.hide();

  let config;
  let initialError = "";
  try {
    config = await loadAssistantConfig();
  } catch (err) {
    initialError = err.message;
    config = {
      provider: "ollama_first",
      ollama: { base_url: "http://127.0.0.1:11434/v1", model: "gpt-oss:20b" },
      external: { base_url: "https://api.masterjie.eu.cc/v1", model: "JoyAI-1.3T", api_key_configured: false },
      tts: {
        provider: "edge",
        default_voice: "zh-CN-XiaoxiaoNeural",
        default_rate: 1.15,
        melotts: { service_url: "http://127.0.0.1:8000/speech", command: "melo", language: "ZH", speaker: "ZH" },
        cosyvoice: { service_url: "http://127.0.0.1:50000/inference_sft", speaker: "中文女", sample_rate: 22050 },
        mlx_audio: { service_url: "http://127.0.0.1:50010/v1/audio/speech", model: "mlx-community/Kokoro-82M-bf16", voice: "zf_xiaoxiao" },
        qwen3_tts: { service_url: "http://127.0.0.1:50010/v1/audio/speech", model: ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit", voice: "vivian", language: "chinese" },
      },
    };
  }
  const audio = currentAssistantAudioSettings(config);

  $("main").innerHTML = `
    ${renderSettingsSummary(config, audio)}
    <div class="settings-layout" style="margin-top:18px">
      <section class="settings-card">
        <form class="settings-form" id="assistantSettingsForm">
          <div class="settings-section">
            <h3>模型配置</h3>
            <div class="settings-grid">
              <div class="settings-field wide">
                <label for="assistantProvider">模型模式</label>
                <select id="assistantProvider">
                  <option value="ollama_first">本地优先：Ollama 不可用时再用外部 API</option>
                  <option value="ollama">仅本地 Ollama</option>
                  <option value="external">仅外部 API</option>
                </select>
              </div>
              <div class="settings-field">
                <label for="ollamaBaseUrl">Ollama 接口地址</label>
                <input id="ollamaBaseUrl" type="url" autocomplete="off">
                <p class="settings-hint">推荐：<code>http://127.0.0.1:11434/v1</code></p>
              </div>
              <div class="settings-field">
                <label for="ollamaModel">Ollama 模型名</label>
                <input id="ollamaModel" type="text" autocomplete="off">
                <p class="settings-hint">推荐：<code>gpt-oss:20b</code></p>
              </div>
              <div class="settings-field">
                <label for="externalBaseUrl">外部 API 地址</label>
                <input id="externalBaseUrl" type="url" autocomplete="off">
              </div>
              <div class="settings-field">
                <label for="externalModel">外部模型名</label>
                <input id="externalModel" type="text" autocomplete="off">
              </div>
              <div class="settings-field wide">
                <label for="externalApiKey">外部 API key</label>
                <input id="externalApiKey" type="password" autocomplete="off" placeholder="不填则保留当前后端配置">
                <p class="settings-hint"><label style="display:inline-flex;gap:8px;align-items:center;margin:8px 0 0;font-weight:800"><input id="clearExternalKey" type="checkbox"> 清空当前后端里的外部 API key</label></p>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3>语音配置</h3>
            <div class="settings-grid">
              <div class="settings-field">
                <label for="assistantTtsProvider">语音引擎</label>
                <select id="assistantTtsProvider">
                  <option value="edge">Edge TTS 在线语音</option>
                  <option value="melotts">MeloTTS 本地模型</option>
                  <option value="cosyvoice">CosyVoice 本地模型</option>
                  <option value="mlx_audio">MLX-Audio Kokoro 本地语音</option>
                  <option value="qwen3_tts">Qwen3-TTS 本地语音</option>
                  <option value="macos">macOS 本机语音</option>
                </select>
                <p class="settings-hint">演示音质优先用 Edge TTS；离线演示可用 MeloTTS、CosyVoice、Kokoro 或 Qwen3-TTS；macOS 语音只作为备用。</p>
              </div>
              <div class="settings-field">
                <label for="assistantVoice">音色</label>
                <select id="assistantVoice">
                  ${ASSISTANT_VOICE_OPTIONS.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}
                </select>
                <p class="settings-hint">MeloTTS 使用本地模型，页面里的音色名只用于显示。</p>
              </div>
              <div class="settings-field">
                <div class="settings-label"><span>语速</span><strong id="assistantRateValue">1.15x</strong></div>
                <input id="assistantRate" type="range" min="0.85" max="1.45" step="0.05" value="1.15">
                <p class="settings-hint">会同步到朗读当前页和 AI 回答朗读。</p>
              </div>
              <div class="settings-field">
                <label for="melottsServiceUrl">MeloTTS 服务地址</label>
                <input id="melottsServiceUrl" type="url" autocomplete="off" placeholder="http://127.0.0.1:8000/speech">
                <p class="settings-hint">推荐使用服务地址。文章里的 FastAPI 服务是 <code>/speech</code>；Docker 版通常是 <code>/tts/convert/tts</code>。</p>
              </div>
              <div class="settings-field">
                <label for="melottsCommand">MeloTTS 命令</label>
                <input id="melottsCommand" type="text" autocomplete="off" placeholder="melo">
                <p class="settings-hint">只在服务地址留空时使用。如果命令不在 PATH，可以写完整路径。</p>
              </div>
              <div class="settings-field">
                <label for="melottsLanguage">MeloTTS 语言</label>
                <input id="melottsLanguage" type="text" autocomplete="off" placeholder="ZH">
              </div>
              <div class="settings-field">
                <label for="melottsSpeaker">MeloTTS 说话人</label>
                <input id="melottsSpeaker" type="text" autocomplete="off" placeholder="默认即可">
                <p class="settings-hint">中文一般填 <code>ZH</code>；如果本地模型有多个 speaker，再填写对应名称。</p>
              </div>
              <div class="settings-field">
                <label for="cosyvoiceServiceUrl">CosyVoice 服务地址</label>
                <input id="cosyvoiceServiceUrl" type="url" autocomplete="off" placeholder="http://127.0.0.1:50000/inference_sft">
                <p class="settings-hint">官方 FastAPI 的 SFT 接口是 <code>/inference_sft</code>。</p>
              </div>
              <div class="settings-field">
                <label for="cosyvoiceSpeaker">CosyVoice 角色</label>
                <input id="cosyvoiceSpeaker" type="text" autocomplete="off" placeholder="中文女">
                <p class="settings-hint">常用：<code>中文女</code>、<code>中文男</code>。实际可用值取决于启动的 CosyVoice 模型。</p>
              </div>
              <div class="settings-field">
                <label for="cosyvoiceSampleRate">CosyVoice 采样率</label>
                <input id="cosyvoiceSampleRate" type="number" min="8000" max="48000" step="1" autocomplete="off" placeholder="22050">
                <p class="settings-hint">官方 FastAPI client 默认按 <code>22050</code> 保存音频。</p>
              </div>
              <div class="settings-field">
                <label for="mlxAudioServiceUrl">MLX-Audio 服务地址</label>
                <input id="mlxAudioServiceUrl" type="url" autocomplete="off" placeholder="http://127.0.0.1:50010/v1/audio/speech">
                <p class="settings-hint">本项目的 Kokoro 服务保持 OpenAI 兼容的 <code>/v1/audio/speech</code> 接口。</p>
              </div>
              <div class="settings-field">
                <label for="mlxAudioModel">MLX-Audio 模型</label>
                <input id="mlxAudioModel" type="text" autocomplete="off" placeholder="mlx-community/Kokoro-82M-bf16">
                <p class="settings-hint">当前已配置 Kokoro 82M 的 MLX 版本。</p>
              </div>
              <div class="settings-field">
                <label for="mlxAudioVoice">MLX-Audio 音色 ID</label>
                <input id="mlxAudioVoice" type="text" autocomplete="off" placeholder="zf_xiaoxiao">
                <p class="settings-hint">常用中文音色：<code>zf_xiaoxiao</code>、<code>zf_xiaobei</code>、<code>zm_yunxi</code>。</p>
              </div>
              <div class="settings-field">
                <label for="qwen3TtsServiceUrl">Qwen3-TTS 服务地址</label>
                <input id="qwen3TtsServiceUrl" type="url" autocomplete="off" placeholder="http://127.0.0.1:50010/v1/audio/speech">
                <p class="settings-hint">复用本项目 MLX-Audio 本地服务，接口同样是 <code>/v1/audio/speech</code>。</p>
              </div>
              <div class="settings-field">
                <label for="qwen3TtsModel">Qwen3-TTS 模型</label>
                <input id="qwen3TtsModel" type="text" autocomplete="off" placeholder=".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit">
                <p class="settings-hint">当前使用本机已下载的 <code>0.6B CustomVoice 4bit</code>。</p>
              </div>
              <div class="settings-field">
                <label for="qwen3TtsVoice">Qwen3-TTS 角色 ID</label>
                <input id="qwen3TtsVoice" type="text" autocomplete="off" placeholder="vivian">
                <p class="settings-hint">中文推荐：<code>vivian</code>、<code>serena</code>、<code>uncle_fu</code>、<code>dylan</code>、<code>eric</code>。</p>
              </div>
              <div class="settings-field">
                <label for="qwen3TtsLanguage">Qwen3-TTS 语言</label>
                <input id="qwen3TtsLanguage" type="text" autocomplete="off" placeholder="chinese">
                <p class="settings-hint">中文填 <code>chinese</code>。也可以填 <code>auto</code> 自动判断。</p>
              </div>
            </div>
          </div>

          <div class="settings-actions">
            <button class="primary" id="saveAssistantSettings" type="submit">保存设置</button>
            <button id="testAssistantModel" type="button">测试当前模型</button>
            <button id="testAssistantVoice" type="button">试听语音</button>
            <button id="checkOllamaModels" type="button">读取 Ollama 模型</button>
            <span class="settings-status" id="assistantSettingsStatus"></span>
          </div>
        </form>
      </section>

      <section class="settings-card">
        <h3>本机 Ollama 模型</h3>
        <p class="settings-lead">点击模型名可以写入左侧模型配置。演示前建议点一次读取，确认本机模型服务正常。</p>
        <div class="settings-model-list" id="ollamaModelList">
          <div class="empty-state" style="min-height:160px">点击“读取 Ollama 模型”后显示。</div>
        </div>
        <div class="settings-test-box" id="assistantTestResult">
          <strong>模型测试结果</strong>
          <p>点击“测试当前模型”后，这里会显示实际调用来源、模型名和回复内容。</p>
        </div>
      </section>
    </div>
  `;

  const providerEl = $("assistantProvider");
  const ollamaBaseEl = $("ollamaBaseUrl");
  const ollamaModelEl = $("ollamaModel");
  const externalBaseEl = $("externalBaseUrl");
  const externalModelEl = $("externalModel");
  const externalKeyEl = $("externalApiKey");
  const clearKeyEl = $("clearExternalKey");
  const ttsProviderEl = $("assistantTtsProvider");
  const voiceEl = $("assistantVoice");
  const rateEl = $("assistantRate");
  const rateValueEl = $("assistantRateValue");
  const melottsServiceUrlEl = $("melottsServiceUrl");
  const melottsCommandEl = $("melottsCommand");
  const melottsLanguageEl = $("melottsLanguage");
  const melottsSpeakerEl = $("melottsSpeaker");
  const cosyvoiceServiceUrlEl = $("cosyvoiceServiceUrl");
  const cosyvoiceSpeakerEl = $("cosyvoiceSpeaker");
  const cosyvoiceSampleRateEl = $("cosyvoiceSampleRate");
  const mlxAudioServiceUrlEl = $("mlxAudioServiceUrl");
  const mlxAudioModelEl = $("mlxAudioModel");
  const mlxAudioVoiceEl = $("mlxAudioVoice");
  const qwen3TtsServiceUrlEl = $("qwen3TtsServiceUrl");
  const qwen3TtsModelEl = $("qwen3TtsModel");
  const qwen3TtsVoiceEl = $("qwen3TtsVoice");
  const qwen3TtsLanguageEl = $("qwen3TtsLanguage");
  const statusEl = $("assistantSettingsStatus");
  const modelListEl = $("ollamaModelList");
  const testBoxEl = $("assistantTestResult");
  const testModelBtn = $("testAssistantModel");
  const testVoiceBtn = $("testAssistantVoice");

  providerEl.value = config.provider || "ollama_first";
  ollamaBaseEl.value = config.ollama?.base_url || "http://127.0.0.1:11434/v1";
  ollamaModelEl.value = config.ollama?.model || "gpt-oss:20b";
  externalBaseEl.value = config.external?.base_url || "https://api.masterjie.eu.cc/v1";
  externalModelEl.value = config.external?.model || "JoyAI-1.3T";
  ttsProviderEl.value = audio.provider;
  voiceEl.value = audio.voice;
  rateEl.value = String(audio.rate);
  rateValueEl.textContent = `${audio.rate.toFixed(2)}x`;
  melottsServiceUrlEl.value = config.tts?.melotts?.service_url || "http://127.0.0.1:8000/speech";
  melottsCommandEl.value = config.tts?.melotts?.command || "melo";
  melottsLanguageEl.value = config.tts?.melotts?.language || "ZH";
  melottsSpeakerEl.value = config.tts?.melotts?.speaker || "ZH";
  cosyvoiceServiceUrlEl.value = config.tts?.cosyvoice?.service_url || "http://127.0.0.1:50000/inference_sft";
  cosyvoiceSpeakerEl.value = config.tts?.cosyvoice?.speaker || "中文女";
  cosyvoiceSampleRateEl.value = String(config.tts?.cosyvoice?.sample_rate || 22050);
  mlxAudioServiceUrlEl.value = config.tts?.mlx_audio?.service_url || "http://127.0.0.1:50010/v1/audio/speech";
  mlxAudioModelEl.value = config.tts?.mlx_audio?.model || "mlx-community/Kokoro-82M-bf16";
  mlxAudioVoiceEl.value = config.tts?.mlx_audio?.voice || "zf_xiaoxiao";
  qwen3TtsServiceUrlEl.value = config.tts?.qwen3_tts?.service_url || "http://127.0.0.1:50010/v1/audio/speech";
  qwen3TtsModelEl.value = config.tts?.qwen3_tts?.model || ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit";
  qwen3TtsVoiceEl.value = config.tts?.qwen3_tts?.voice || "vivian";
  qwen3TtsLanguageEl.value = config.tts?.qwen3_tts?.language || "chinese";
  renderSettingsSide(config, audio);

  const setStatus = (text, type = "") => {
    statusEl.textContent = text;
    statusEl.className = `settings-status ${type}`.trim();
  };
  if (initialError) setStatus(initialError, "error");

  function syncSummary() {
    updateSettingsSummary(
      {
        provider: providerEl.value,
        ollama: { model: ollamaModelEl.value.trim() },
      },
      currentFormAudio(ttsProviderEl, voiceEl, rateEl)
    );
  }

  function syncMlxVoiceField() {
    if (voiceEl.value.startsWith("mlx_audio:")) {
      mlxAudioVoiceEl.value = voiceEl.value.split(":", 2)[1] || "zf_xiaoxiao";
    }
  }

  function syncQwen3VoiceField() {
    if (voiceEl.value.startsWith("qwen3_tts:")) {
      qwen3TtsVoiceEl.value = voiceEl.value.split(":", 2)[1] || "vivian";
    }
  }

  function updateTestBox(html) {
    testBoxEl.innerHTML = html;
  }

  async function refreshModels() {
    setStatus("正在读取 Ollama 模型...");
    const url = `/api/assistant_models?base_url=${encodeURIComponent(ollamaBaseEl.value.trim())}`;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "模型列表读取失败");
    modelListEl.innerHTML = renderModelButtons(data.models || [], ollamaModelEl.value.trim());
    modelListEl.querySelectorAll("[data-ollama-model]").forEach(btn => {
      btn.addEventListener("click", () => {
        ollamaModelEl.value = btn.dataset.ollamaModel || "";
        modelListEl.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === btn));
        syncSummary();
      });
    });
    setStatus(`读取到 ${data.models?.length || 0} 个模型。`, "ready");
  }

  async function saveSettings({ quiet = false } = {}) {
    const nextRate = Number(rateEl.value);
    const payload = {
      provider: providerEl.value,
      ollama_base_url: ollamaBaseEl.value.trim(),
      ollama_model: ollamaModelEl.value.trim(),
      external_base_url: externalBaseEl.value.trim(),
      external_model: externalModelEl.value.trim(),
      clear_external_api_key: clearKeyEl.checked,
      tts_provider: ttsProviderEl.value,
      tts_voice: voiceEl.value,
      tts_rate: nextRate,
      melotts_service_url: melottsServiceUrlEl.value.trim(),
      melotts_command: melottsCommandEl.value.trim(),
      melotts_language: melottsLanguageEl.value.trim(),
      melotts_speaker: melottsSpeakerEl.value.trim(),
      cosyvoice_service_url: cosyvoiceServiceUrlEl.value.trim(),
      cosyvoice_speaker: cosyvoiceSpeakerEl.value.trim(),
      cosyvoice_sample_rate: Number(cosyvoiceSampleRateEl.value || 22050),
      mlx_audio_service_url: mlxAudioServiceUrlEl.value.trim(),
      mlx_audio_model: mlxAudioModelEl.value.trim(),
      mlx_audio_voice: voiceEl.value.startsWith("mlx_audio:")
        ? (voiceEl.value.split(":", 2)[1] || "zf_xiaoxiao")
        : mlxAudioVoiceEl.value.trim(),
      qwen3_tts_service_url: qwen3TtsServiceUrlEl.value.trim(),
      qwen3_tts_model: qwen3TtsModelEl.value.trim(),
      qwen3_tts_voice: voiceEl.value.startsWith("qwen3_tts:")
        ? (voiceEl.value.split(":", 2)[1] || "vivian")
        : qwen3TtsVoiceEl.value.trim(),
      qwen3_tts_language: qwen3TtsLanguageEl.value.trim(),
    };
    const apiKey = externalKeyEl.value.trim();
    if (apiKey) payload.external_api_key = apiKey;
    if (!quiet) setStatus("正在保存...");
    const saved = await postJson("/api/assistant_config", payload);
    const audioSettings = currentFormAudio(ttsProviderEl, voiceEl, rateEl);
    writeAssistantSetting(ASSISTANT_TTS_PROVIDER_KEY, audioSettings.provider);
    writeAssistantSetting(ASSISTANT_VOICE_KEY, audioSettings.voice);
    writeAssistantSetting(ASSISTANT_RATE_KEY, String(Number.isFinite(nextRate) ? nextRate : 1.15));
    if (window.TheoryAssistant?.updateAudioSettings) {
      window.TheoryAssistant.updateAudioSettings({
        ttsProvider: audioSettings.provider,
        voiceURI: audioSettings.voice,
        rate: audioSettings.rate,
      });
    }
    externalKeyEl.value = "";
    clearKeyEl.checked = false;
    config = saved;
    renderSettingsSide(saved, audioSettings);
    updateSettingsSummary(saved, audioSettings);
    if (!quiet) setStatus("设置已保存。", "ready");
    return saved;
  }

  [providerEl, ollamaBaseEl, ollamaModelEl, externalBaseEl, externalModelEl, ttsProviderEl, voiceEl, melottsServiceUrlEl, melottsCommandEl, melottsLanguageEl, melottsSpeakerEl, cosyvoiceServiceUrlEl, cosyvoiceSpeakerEl, cosyvoiceSampleRateEl, mlxAudioServiceUrlEl, mlxAudioModelEl, mlxAudioVoiceEl, qwen3TtsServiceUrlEl, qwen3TtsModelEl, qwen3TtsVoiceEl, qwen3TtsLanguageEl].forEach(el => {
    el.addEventListener("input", syncSummary);
    el.addEventListener("change", syncSummary);
  });

  ttsProviderEl.addEventListener("change", () => {
    voiceEl.value = normalizeVoiceForProvider(ttsProviderEl.value, voiceEl.value);
    syncMlxVoiceField();
    syncQwen3VoiceField();
    syncSummary();
  });

  voiceEl.addEventListener("change", () => {
    syncMlxVoiceField();
    syncQwen3VoiceField();
    syncSummary();
  });

  rateEl.addEventListener("input", () => {
    const nextRate = Number(rateEl.value);
    rateValueEl.textContent = `${(Number.isFinite(nextRate) ? nextRate : 1.15).toFixed(2)}x`;
    syncSummary();
  });

  $("checkOllamaModels").addEventListener("click", async () => {
    try {
      await refreshModels();
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  testModelBtn.addEventListener("click", async () => {
    try {
      testModelBtn.disabled = true;
      await saveSettings({ quiet: true });
      setStatus("正在测试当前模型...");
      updateTestBox(`
        <strong>模型测试结果</strong>
        <p>正在请求当前模型，请稍等。</p>
      `);
      const result = await postJson("/api/assistant_test", {
        question: "请用一句话说明你现在是否可以作为本地机器学习实验助教工作。",
      });
      updateTestBox(`
        <strong>模型测试结果</strong>
        <p>${providerPill(result.provider, result.model)}</p>
        <p style="margin-top:8px">${escapeHtml(result.answer || "")}</p>
        <p class="settings-hint">耗时：${escapeHtml(String(result.elapsed_ms || "-"))} ms</p>
      `);
      renderSettingsSide(config, currentFormAudio(ttsProviderEl, voiceEl, rateEl), result);
      setStatus("模型测试通过。", "ready");
    } catch (err) {
      updateTestBox(`
        <strong>模型测试失败</strong>
        <p>${escapeHtml(err.message)}</p>
      `);
      setStatus(err.message, "error");
    } finally {
      testModelBtn.disabled = false;
    }
  });

  testVoiceBtn.addEventListener("click", async () => {
    try {
      testVoiceBtn.disabled = true;
      await saveSettings({ quiet: true });
      const audioSettings = currentFormAudio(ttsProviderEl, voiceEl, rateEl);
      writeAssistantSetting(ASSISTANT_TTS_PROVIDER_KEY, audioSettings.provider);
      writeAssistantSetting(ASSISTANT_VOICE_KEY, audioSettings.voice);
      writeAssistantSetting(ASSISTANT_RATE_KEY, String(audioSettings.rate));
      if (window.TheoryAssistant?.updateAudioSettings) {
        window.TheoryAssistant.updateAudioSettings({
          ttsProvider: audioSettings.provider,
          voiceURI: audioSettings.voice,
          rate: audioSettings.rate,
        });
      }
      setStatus("正在生成试听语音...");
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ASSISTANT_SAMPLE_TEXT,
          provider: audioSettings.provider,
          voice: audioSettings.voice,
          rate: audioSettings.rate,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `试听失败：${resp.status}`);
      }
      const blob = await resp.blob();
      if (settingsAudioUrl) URL.revokeObjectURL(settingsAudioUrl);
      settingsAudioUrl = URL.createObjectURL(blob);
      await new Audio(settingsAudioUrl).play();
      renderSettingsSide(config, audioSettings);
      updateSettingsSummary(config, audioSettings);
      setStatus("语音试听已播放。", "ready");
    } catch (err) {
      setStatus(err.message, "error");
    } finally {
      testVoiceBtn.disabled = false;
    }
  });

  $("assistantSettingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await saveSettings();
    } catch (err) {
      setStatus(err.message, "error");
    }
  });
}
