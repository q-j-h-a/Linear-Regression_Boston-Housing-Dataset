// Preprocess Page.

let activePreprocessStep = viewStateStore.activePreprocessStepV1 || "load";
let preprocessProgressStep = viewStateStore.preprocessProgressStepV1 || activePreprocessStep;
let loadingDataView = false;

const PREPROCESS_STEPS = [
  { id: "load", no: "01", label: "加载原始数据集", needsData: false },
  { id: "detail", no: "02", label: "数据详情", needsData: true },
  { id: "raw_viz", no: "03", label: "原始数据可视化", needsData: true, views: ["raw", "single_corr", "all_corr"] },
  { id: "standardize", no: "04", label: "数据标准化", needsData: true },
  { id: "standard_viz", no: "05", label: "标准数据可视化", needsData: true, views: ["standardized"] },
];

PREPROCESS_STEPS[0].label = "加载原始数据";

const BOSTON_FIELD_MEANINGS = {
  CRIM: "城镇人均犯罪率",
  ZN: "大面积住宅用地比例",
  INDUS: "非零售商业用地比例",
  CHAS: "是否靠近查尔斯河",
  NOX: "一氧化氮浓度",
  RM: "住宅平均房间数",
  AGE: "1940年前建成的自住房比例",
  DIS: "到波士顿就业中心的加权距离",
  RAD: "到放射状高速公路的可达性指数",
  TAX: "每10000美元房产税率",
  PTRATIO: "城镇师生比例",
  B: "历史人口统计相关变量",
  LSTAT: "低收入人口比例",
  MEDV: "房价中位数",
};

function ensurePreprocessTopFlow() {
  const slot = $("pageTopSlot");
  if (!slot) return null;
  slot.classList.add("has-content");
  if (!$("preprocessFlow")) {
    slot.innerHTML = `<div class="preprocess-flow" id="preprocessFlow"></div>`;
  }
  return $("preprocessFlow");
}

function preprocessStepIndex(stepId) {
  const index = PREPROCESS_STEPS.findIndex(step => step.id === stepId);
  return index < 0 ? 0 : index;
}

function markPreprocessProgress(stepId) {
  if (preprocessStepIndex(stepId) <= preprocessStepIndex(preprocessProgressStep)) return;
  preprocessProgressStep = stepId;
  viewStateStore.preprocessProgressStepV1 = preprocessProgressStep;
}

async function renderDataShell() {
  preprocessPageSchema = preprocessPageSchema || await loadPanelSchema("preprocess", {
    title: "鎺у埗闈㈡澘",
    sections: [
      { id: "dataset", controls: [
        { type: "stat", label: "鏍锋湰鎬绘暟", value_id: "sampleCount" },
        { type: "stat", label: "鐗瑰緛鏁伴噺", value_id: "featureCount", default: FEATURE_NAMES.length },
        { type: "select", name: "feature", label: "鐗瑰緛閫夋嫨", element_id: "dataFeature", source: "feature_columns" }
      ] },
      { id: "display", controls: [{ type: "chart_selector", name: "dataViews", label: "鏄剧ず妯″紡", summary_id: "dataModeSummary", options: [
        { label: "原始散点图", value: "raw", default: true },
        { label: "标准化散点图", value: "standardized" },
        { label: "单特征线性相关系数", value: "single_corr" },
        { label: "全特征线性相关系数", value: "all_corr" }
      ] }] }
    ]
  });
  document.querySelector(".shell").classList.remove("theory");
  currentDatasetMeta = currentDatasetMeta || viewStateStore.currentDatasetMetaV1 || null;
  $("main").innerHTML = `<div id="preprocessContent"></div>`;
  ensurePreprocessTopFlow();
  renderPreprocessRightPanel();
  if (currentDatasetMeta) {
    applyDatasetMeta(currentDatasetMeta, { silent: true });
  } else {
    setPreprocessStageReady(false);
  }
  restoreDataFormState();
  bindPreprocessFlow();
  setPreprocessStageReady(Boolean(currentDatasetMeta));
  renderPreprocessFlow();
}

function renderPreprocessRightPanel() {
  if (activePreprocessStep === "raw_viz") {
    $("rightPanel").innerHTML = renderRawDataVizPanel();
  } else if (activePreprocessStep === "standard_viz") {
    $("rightPanel").innerHTML = renderStandardDataVizPanel();
  } else if (activePreprocessStep === "standardize") {
    $("rightPanel").innerHTML = renderStandardizePanel();
  } else if (activePreprocessStep === "load") {
    $("rightPanel").innerHTML = renderPreprocessLoadPanel();
  } else {
    $("rightPanel").innerHTML = `<div class="right-title">控制面板</div>`;
  }
  bindDatasetLoader();
  bindPreprocessControls();
}

function renderPreprocessLoadPanel() {
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>加载数据集</h3>
      <select id="datasetSource" aria-label="选择数据集">
        <option value="boston_housing">Boston 原始数据集</option>
      </select>
      <div class="btn-row">
        <button class="primary-btn" id="loadDatasetBtn" type="button">加载数据集</button>
      </div>
      <div class="status-line hidden" id="datasetLoadMessage"></div>
    </div>`;
}

function renderStandardizePanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>数据标准化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
    </div>`;
}

function bindPreprocessControls() {
  restoreDataFormState();
  if ($("dataFeature")) {
    $("dataFeature").addEventListener("change", async () => {
      if (activePreprocessStep === "raw_viz" || activePreprocessStep === "standard_viz") {
        await loadDataView({ deferRender: true });
        await renderDataCharts();
      } else {
        await loadDataView();
      }
    });
  }
  document.querySelectorAll('input[name="dataViews"]').forEach(el => el.addEventListener("change", async () => {
    saveCheckedValues("dataViews", preprocessDataViewsStorageKey());
    if (activePreprocessStep === "raw_viz" || activePreprocessStep === "standard_viz") {
      if (selectedValues("dataViews").length) {
        if (!dataCache && !loadingDataView) {
          await loadDataView({ deferRender: true });
        }
        await renderDataCharts();
      } else {
        renderChartGridShell();
        renderRawVizPrompt();
        if ($("dataModeSummary")) $("dataModeSummary").textContent = "请选择显示模块";
      }
    }
  }));
}

function preprocessDataViewsStorageKey() {
  if (activePreprocessStep === "raw_viz") return "rawVizSelectedViewsV1";
  if (activePreprocessStep === "standard_viz") return "standardVizSelectedViewsV1";
  return "preprocessSelectedViewsV1";
}

function rawVizSelectedViews() {
  return ["raw", "all_corr"];
}

function standardVizSelectedViews() {
  return ["standardized", "all_corr"];
}

function renderRawDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = rawVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "原始散点图", value: "raw" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>加载数据集</h3>
      <select id="datasetSource" aria-label="选择数据集">
        <option value="boston_housing">Boston 原始数据集</option>
      </select>
      <div class="btn-row">
        <button class="primary-btn" id="loadDatasetBtn" type="button">加载数据集</button>
      </div>
      <div class="status-line hidden" id="datasetLoadMessage"></div>
    </div>
    <details class="control-card stage-card" open>
      <summary><strong>原始数据可视化</strong><span class="stage-badge">${datasetLoaded ? "待选择" : "待加载"}</span></summary>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <details class="mode-menu" open>
          <summary id="dataModeSummary">${views.length ? `已选择 ${views.length} 个模块` : "请选择显示模块"}</summary>
          <div class="check-list">${moduleOptionsHtml}</div>
        </details>
      </div>
    </details>`;
}

function renderRawDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = rawVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "原始散点图", value: "raw" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>加载数据集</h3>
      <select id="datasetSource" aria-label="选择数据集">
        <option value="boston_housing">Boston 原始数据集</option>
      </select>
      <div class="btn-row">
        <button class="primary-btn" id="loadDatasetBtn" type="button">加载数据集</button>
      </div>
      <div class="status-line hidden" id="datasetLoadMessage"></div>
    </div>
    <div class="control-card stage-card">
      <h3>原始数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <details class="mode-menu" open>
          <summary id="dataModeSummary">${views.length ? `已选择 ${views.length} 个模块` : "请选择显示模块"}</summary>
          <div class="check-list">${moduleOptionsHtml}</div>
        </details>
      </div>
    </div>`;
}

function renderRawDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = rawVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "原始散点图", value: "raw" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>原始数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <div class="check-list">${moduleOptionsHtml}</div>
      </div>
    </div>`;
}

function renderStandardDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = standardVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "标准化散点图", value: "standardized" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>标准数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <div class="check-list">${moduleOptionsHtml}</div>
      </div>
    </div>`;
}

function renderRawDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = rawVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "原始散点图", value: "raw" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>原始数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <div class="check-list">${moduleOptionsHtml}</div>
      </div>
    </div>`;
}

function renderStandardDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = standardVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "标准化散点图", value: "standardized" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>标准数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <div class="check-list">${moduleOptionsHtml}</div>
      </div>
    </div>`;
}

function renderStandardDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = standardVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "标准化散点图", value: "standardized" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>标准数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <details class="mode-menu" open>
          <summary id="dataModeSummary">${views.length ? `已选择 ${views.length} 个模块` : "请选择显示模块"}</summary>
          <div class="check-list">${moduleOptionsHtml}</div>
        </details>
      </div>
    </div>`;
}

function bindPreprocessFlow() {
  const flow = $("preprocessFlow");
  if (!flow || flow.dataset.bound === "1") return;
  flow.dataset.bound = "1";
  flow.addEventListener("click", async event => {
    const btn = event.target.closest("[data-preprocess-step]");
    if (!btn) return;
    await setPreprocessStep(btn.dataset.preprocessStep);
  });
}

function renderPreprocessFlow() {
  const flow = $("preprocessFlow");
  if (!flow) return;
  const loaded = Boolean(currentDatasetMeta);
  const progressIndex = loaded ? preprocessStepIndex(preprocessProgressStep) : preprocessStepIndex(activePreprocessStep);
  flow.innerHTML = PREPROCESS_STEPS.map((step, index) => {
    const ready = !step.needsData || loaded;
    const active = step.id === activePreprocessStep;
    const done = loaded && index <= progressIndex && !active;
    const classes = [
      "flow-step",
      active ? "active" : "",
      done ? "done" : "",
      ready ? "" : "disabled",
    ].filter(Boolean).join(" ");
    return `<button class="${classes}" type="button" data-preprocess-step="${escapeHtml(step.id)}" ${ready ? "" : "aria-disabled=\"true\""}>
      <span>${escapeHtml(step.no)}</span>
      <strong>${escapeHtml(step.label)}</strong>
    </button>`;
  }).join("");
}

async function setPreprocessStep(stepId) {
  const step = PREPROCESS_STEPS.find(item => item.id === stepId) || PREPROCESS_STEPS[0];
  if (step.needsData && !currentDatasetMeta) {
    activePreprocessStep = "load";
    viewStateStore.activePreprocessStepV1 = activePreprocessStep;
    datasetMessage("请先加载数据集，再查看后续流程。", true);
  } else {
    activePreprocessStep = step.id;
    viewStateStore.activePreprocessStepV1 = activePreprocessStep;
    if (step.needsData) markPreprocessProgress(step.id);
    datasetMessage("");
    if (step.needsData && !dataCache && !loadingDataView) {
      await loadDataView({ deferRender: true });
    }
  }
  renderPreprocessFlow();
  renderPreprocessRightPanel();
  await renderPreprocessCurrentStep();
}

async function renderPreprocessCurrentStep() {
  renderPreprocessFlow();
  if (activePreprocessStep === "load") {
    renderChartGridShell();
    if (currentDatasetMeta) {
      renderDataOverview();
    } else {
      renderDatasetEmptyState();
    }
    return;
  }
  if (!currentDatasetMeta) {
    activePreprocessStep = "load";
    renderPreprocessFlow();
    renderChartGridShell();
    renderDatasetEmptyState();
    return;
  }
  if (!dataCache && !loadingDataView) {
    await loadDataView({ deferRender: true });
  }
  if (!dataCache) return;
  if (activePreprocessStep === "detail") {
    renderChartGridShell();
    renderPreprocessDetailGrid();
    return;
  }
  if (activePreprocessStep === "standardize") {
    renderChartGridShell();
    renderPreprocessStandardizeGrid();
    return;
  }
  if (activePreprocessStep === "raw_viz") {
    renderChartGridShell();
    if (!dataCache && !loadingDataView) {
      await loadDataView({ deferRender: true });
    }
    await renderDataCharts();
    return;
  }
  if (activePreprocessStep === "standard_viz") {
    renderChartGridShell();
    if (!dataCache && !loadingDataView) {
      await loadDataView({ deferRender: true });
    }
    await renderDataCharts();
  }
}

function renderChartGridShell() {
  const content = $("preprocessContent");
  if (!content) return;
  content.innerHTML = `<div class="chart-grid" id="chartGrid"></div>`;
}

function setPreprocessSelectedViews(views, storageKey = "preprocessSelectedViewsV1") {
  document.querySelectorAll('input[name="dataViews"]').forEach(el => {
    el.checked = views.includes(el.value);
  });
  saveCheckedValues("dataViews", storageKey);
}

function bindDatasetLoader() {
  const source = $("datasetSource");
  const button = $("loadDatasetBtn");
  if (!source || !button) return;
  source.value = "boston_housing";
  button.addEventListener("click", loadSelectedDataset);
}

function datasetMessage(text, isError = false) {
  const el = $("datasetLoadMessage");
  if (!el) return;
  el.classList.toggle("hidden", !text);
  el.classList.toggle("error", isError);
  el.textContent = text || "";
}

function setPreprocessStageReady(ready) {
  if ($("dataFeature")) $("dataFeature").disabled = !ready;
  document.querySelectorAll('input[name="dataViews"]').forEach(el => {
    el.disabled = !ready;
  });
  if (!ready) {
    if ($("sampleCount")) $("sampleCount").textContent = "--";
    if ($("featureCount")) $("featureCount").textContent = "--";
    if ($("datasetStatusText")) $("datasetStatusText").textContent = "未加载";
    if ($("datasetSampleText")) $("datasetSampleText").textContent = "--";
    if ($("dataModeSummary")) $("dataModeSummary").textContent = "请先加载数据集";
  }
}

function updateFeatureSelectOptions(selectId, features = [], selected = null) {
  const el = $(selectId);
  if (!el) return;
  if (!features.length) {
    el.innerHTML = "";
    el.disabled = true;
    return;
  }
  el.disabled = false;
  const next = selected && features.includes(selected) ? selected : features[0];
  el.innerHTML = features.map(feature => `<option value="${escapeHtml(feature)}"${feature === next ? " selected" : ""}>${escapeHtml(feature)}</option>`).join("");
}

function applyDatasetMeta(meta, options = {}) {
  if (!meta) return;
  currentDatasetMeta = meta;
  viewStateStore.currentDatasetMetaV1 = meta;
  updateFeatureSelectOptions("dataFeature", meta.features || FEATURE_NAMES, dataCache?.feature || meta.features?.[0]);
  updateFeatureSelectOptions("trainFeature", meta.features || FEATURE_NAMES, trainData?.feature || meta.features?.[0]);
  if ($("sampleCount")) $("sampleCount").textContent = meta.row_count ?? "--";
  if ($("featureCount")) $("featureCount").textContent = meta.features?.length ?? FEATURE_NAMES.length;
  if ($("datasetStatusText")) $("datasetStatusText").textContent = "已加载";
  if ($("datasetSampleText")) $("datasetSampleText").textContent = meta.row_count ?? "--";
  setPreprocessStageReady(true);
  renderPreprocessFlow();
  if (!options.silent) datasetMessage(`已加载：${meta.label || meta.dataset_id || "dataset"}`);
}

async function loadSelectedDataset() {
  const source = $("datasetSource")?.value || "boston_housing";
  try {
    const meta = await runAction("load_dataset", { source });
    meta.source = source;
    dataCache = null;
    trainData = null;
    predictData = null;
    applyDatasetMeta(meta);
    renderPreprocessRightPanel();
    renderPreprocessFlow();
    await renderPreprocessCurrentStep();
  } catch (err) {
    datasetMessage(err.message, true);
  }
}

function persistDataFormState() {
  if ($("dataFeature")) {
    viewStateStore.preprocessFormStateV1 = {
      feature: $("dataFeature").value,
      dataset_id: currentDatasetMeta?.dataset_id || "boston_housing",
    };
  }
}

function restoreDataFormState() {
  const state = viewStateStore.preprocessFormStateV1 || {};
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  if ($("dataFeature") && state.feature && features.includes(state.feature)) {
    $("dataFeature").value = state.feature;
  } else if ($("dataFeature") && dataCache?.feature) {
    $("dataFeature").value = dataCache.feature;
  }
}

function restoreDataView() {
  restoreDataFormState();
  if ($("sampleCount")) $("sampleCount").textContent = dataCache?.raw?.summary?.sample_count ?? "--";
  if ($("featureCount")) $("featureCount").textContent = dataCache?.correlations?.length ?? FEATURE_NAMES.length;
  if (dataCache?.feature) $("topFeature").textContent = `褰撳墠鐗瑰緛 ${dataCache.feature}`;
  renderPreprocessCurrentStep();
}

async function loadDataView(options = {}) {
  if (!currentDatasetMeta) {
    renderPreprocessCurrentStep();
    return;
  }
  const feature = $("dataFeature")?.value || dataCache?.feature || currentDatasetMeta?.features?.[0] || DEFAULT_FEATURE;
  persistDataFormState();
  $("topFeature").textContent = `褰撳墠鐗瑰緛 ${feature}`;
  loadingDataView = true;
  try {
    dataCache = await runAction("data_view", {
      feature,
      dataset_id: currentDatasetMeta.dataset_id,
    });
    if ($("sampleCount")) $("sampleCount").textContent = dataCache.raw.summary.sample_count;
    if ($("featureCount")) $("featureCount").textContent = dataCache.correlations.length;
    if (!options.deferRender) await renderPreprocessCurrentStep();
  } catch (err) {
    renderError(err.message);
  } finally {
    loadingDataView = false;
    renderPreprocessFlow();
  }
}

async function renderDataCharts() {
  if (!dataCache) return;
  destroyDataGrid();
  disposeCharts();
  const fixedViews = activePreprocessStep === "raw_viz"
    ? rawVizSelectedViews()
    : (activePreprocessStep === "standard_viz" ? standardVizSelectedViews() : []);
  await experimentRefreshCharts({
    viewName: "dataViews",
    storageKey: preprocessDataViewsStorageKey(),
    summaryId: "dataModeSummary",
    contextId: dataCache?.context_id,
    page: "preprocess",
    state: {},
    fallbackViews: fixedViews,
    label: "preprocess chart_data",
    beforeRender: ({ grid }) => {
      grid.classList.remove("dashboard-grid", "grid-stack");
    },
    onChartData: chartData => {
      dataChartDataCache = chartData;
    },
    renderDashboard: ({ grid, views }) => {
      renderDataDashboard(grid, views);
    },
    renderFallback: ({ grid, views }) => {
      grid.innerHTML = views.map(view => chartCardHtml(view, chartTitle(view), chartSub(view, dataCache), dataCardSize(view))).join("");
    },
    renderCharts: ({ views }) => {
      views.forEach(view => {
        const ch = initChart(`chart_${view}`);
        const option = preprocessChartOption(preprocessChartMeta(view), dataChartDataCache[view]);
        if (option) ch.setOption(option, true);
      });
    },
  });
  if ((activePreprocessStep === "raw_viz" || activePreprocessStep === "standard_viz") && $("dataModeSummary")) {
    const count = selectedValues("dataViews").length;
    $("dataModeSummary").textContent = count ? `已选择 ${count} 个模块` : "请选择显示模块";
  }
}

function renderDataOverview() {
  const grid = $("chartGrid");
  if (!grid) return;
  experimentRenderGridStack({
    grid,
    mode: "preprocess",
    views: ["loaded_dataset"],
    loadLayout: loadDataGridLayout,
    defaultLayout: () => ({ x: 0, y: 0, w: 4, h: 2 }),
    normalizeLayout: (_view, layout) => normalizeDataGridLayout("loaded_dataset", layout),
    htmlForView: () => preprocessLoadedDatasetHtml(),
    minWidthForView: () => 2,
    minHeightForView: () => 1,
  });
}

function metricBlockHtml(items, extraClass = "") {
  return `<div class="preprocess-metrics ${escapeHtml(extraClass)}">${items.map(item => `
    <div class="preprocess-metric">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>`).join("")}</div>`;
}

function summaryRowsHtml(rows = []) {
  if (!rows.length) return `<div class="empty-state">暂无统计摘要。</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>特征</th><th>最小值</th><th>最大值</th><th>平均值</th><th>标准差</th></tr></thead><tbody>${rows.map(row => `
    <tr>
      <td>${escapeHtml(row.feature)}</td>
      <td>${num(row.min, 4)}</td>
      <td>${num(row.max, 4)}</td>
      <td>${num(row.mean, 4)}</td>
      <td>${num(row.std, 4)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function dataDictionaryHtml(rows = []) {
  if (!rows.length) return `<div class="empty-state">暂无字段说明。</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>字段</th><th>角色</th><th>中文意义</th></tr></thead><tbody>${rows.map(row => `
    <tr>
      <td>${escapeHtml(row.field)}</td>
      <td>${escapeHtml(row.role)}</td>
      <td>${escapeHtml(row.meaning || "")}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function fallbackDataDictionaryRows(features = [], target = "MEDV") {
  const rows = (features || []).map(feature => ({
    field: feature,
    role: "特征",
    meaning: BOSTON_FIELD_MEANINGS[feature] || "",
  }));
  if (target) {
    rows.push({
      field: target,
      role: "目标",
      meaning: BOSTON_FIELD_MEANINGS[target] || "预测目标",
    });
  }
  return rows;
}

function renderPreprocessDetailGrid() {
  const grid = $("chartGrid");
  if (!grid) return;
  experimentRenderGridStack({
    grid,
    mode: "preprocess",
    views: ["detail_overview"],
    loadLayout: loadDataGridLayout,
    defaultLayout: () => ({ x: 0, y: 0, w: 4, h: 4 }),
    normalizeLayout: (_view, layout) => normalizeDataGridLayout("detail_overview", layout),
    htmlForView: view => preprocessDetailCardHtml(view),
    minWidthForView: () => 2,
    minHeightForView: () => 2,
  });
}

function preprocessInfoCardHtml(title, body) {
  return `<section class="chart-card wide preprocess-info-card">
    <div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div></div></div>
    <div class="info-card-body preprocess-step-body">${body}</div>
  </section>`;
}

function preprocessDetailCardHtml(view) {
  const meta = currentDatasetMeta || {};
  const quality = dataCache?.data_quality || {};
  const features = dataCache?.features || meta.features || [];
  if (view === "detail_overview") {
    return `<section class="chart-card wide preprocess-info-card standardize-overview-card">
      <div class="chart-head" aria-label="拖动卡片"></div>
      <div class="info-card-body preprocess-step-body standardize-overview-body">
        ${preprocessDetailCardHtml("detail_scale")}
        ${preprocessDetailCardHtml("detail_stats")}
      </div>
    </section>`;
  }
  if (view === "detail_scale") {
    return preprocessInfoCardHtml("数据规模", `
      ${metricBlockHtml([
        { label: "样本数量", value: meta.row_count ?? dataCache?.raw?.summary?.sample_count ?? "--" },
        { label: "特征数量", value: features.length || "--" },
        { label: "目标列", value: dataCache?.target || meta.target || "--" },
      ], "metrics-three")}
      ${dataDictionaryHtml(dataCache?.data_dictionary?.length ? dataCache.data_dictionary : fallbackDataDictionaryRows(features, dataCache?.target || meta.target))}
    `);
  }
  if (view === "detail_stats") {
    return preprocessInfoCardHtml("统计详情", `
      ${metricBlockHtml([
        { label: "缺失值数量", value: quality.missing_count ?? 0 },
        { label: "重复样本数量", value: quality.duplicate_count ?? 0 },
        { label: "数值型列数量", value: quality.numeric_column_count ?? "--" },
        { label: "非数值型列数量", value: quality.non_numeric_column_count ?? "--" },
      ])}
      ${summaryRowsHtml(dataCache?.statistical_summary || [])}
    `);
  }
  if (view === "detail_quality") {
    return preprocessInfoCardHtml("数据质量", metricBlockHtml([
      { label: "缺失值数量", value: quality.missing_count ?? 0 },
      { label: "重复样本数量", value: quality.duplicate_count ?? 0 },
      { label: "数值型列数量", value: quality.numeric_column_count ?? "--" },
      { label: "非数值型列数量", value: quality.non_numeric_column_count ?? "--" },
    ]));
  }
  return preprocessInfoCardHtml("统计摘要", summaryRowsHtml(dataCache?.statistical_summary || []));
}

function preprocessLoadedDatasetHtml() {
  const meta = currentDatasetMeta || {};
  return `<section class="chart-card wide preprocess-info-card">
    <div class="chart-head">
      <div>
        <div class="chart-title">原始数据集已加载</div>
        <div class="chart-sub">继续点击上方实验流程查看数据详情、标准化过程和可视化结果。</div>
      </div>
    </div>
    <div class="info-card-body preprocess-step-body">
      ${metricBlockHtml([
        { label: "样本数量", value: meta.row_count ?? "--" },
        { label: "特征数量", value: meta.features?.length ?? "--" },
        { label: "目标列", value: meta.target || "--" },
        { label: "数据来源", value: meta.label || meta.dataset_id || "--" },
      ])}
      <p class="teaching-note">数据预处理的第一步是明确数据集是否已经进入实验环境。加载完成后，后面的统计、标准化和图表都会围绕这份数据展开。</p>
      ${previewTableHtml(meta.preview || [], meta.preview_columns || null)}
    </div>
  </section>`;
}

function preprocessDetailHtml() {
  const meta = currentDatasetMeta || {};
  const quality = dataCache?.data_quality || {};
  const features = dataCache?.features || meta.features || [];
  return `<div class="preprocess-step-stack">
    <section class="content-card preprocess-lesson">
      <h2>第一类：数据规模</h2>
      <p>显示：</p>
      ${metricBlockHtml([
        { label: "样本数量", value: meta.row_count ?? dataCache?.raw?.summary?.sample_count ?? "--" },
        { label: "特征数量", value: features.length || "--" },
        { label: "目标列", value: dataCache?.target || meta.target || "--" },
        { label: "当前特征列", value: features.join("、") || "--" },
      ])}
      <div class="teaching-note">让学生知道模型有多少条样本、多少个输入特征，预测目标是哪一列。</div>
    </section>
    <section class="content-card preprocess-lesson">
      <h2>第二类：数据质量</h2>
      <p>显示：</p>
      ${metricBlockHtml([
        { label: "缺失值数量", value: quality.missing_count ?? 0 },
        { label: "重复样本数量", value: quality.duplicate_count ?? 0 },
        { label: "数值型列数量", value: quality.numeric_column_count ?? "--" },
        { label: "非数值型列数量", value: quality.non_numeric_column_count ?? "--" },
      ])}
      <div class="teaching-note">训练模型前要检查数据是否能直接使用。如果有缺失值，需要先处理，否则模型可能无法训练。</div>
    </section>
    <section class="content-card preprocess-lesson">
      <h2>第三类：统计摘要</h2>
      <p>这里显示每个特征的最小值、最大值、平均值和标准差。</p>
      ${summaryRowsHtml(dataCache?.statistical_summary || [])}
    </section>
  </div>`;
}

function preprocessStandardizeHtml() {
  const feature = dataCache?.feature || $("dataFeature")?.value || "";
  const row = (dataCache?.standardize_table || []).find(item => item.feature === feature);
  return `<div class="preprocess-step-stack">
    <section class="content-card preprocess-lesson">
      <h2>数据标准化</h2>
      <p>标准化把不同量纲的特征转换到更容易比较和训练的尺度上。</p>
      <div class="formula">z = (x - mean) / std

当前特征：${escapeHtml(feature)}
mean = ${row ? num(row.mean, 6) : "--"}
std  = ${row ? num(row.std, 6) : "--"}</div>
      <div class="teaching-note">标准化后，特征均值会接近 0，标准差会接近 1。后续训练可以选择使用标准化特征。</div>
    </section>
    <section class="content-card preprocess-lesson">
      <h2>标准化后前 5 行</h2>
      <p>直接观察原始特征与标准化特征的数值变化。</p>
      ${previewTableHtml(dataCache?.standardized_preview || [])}
    </section>
    <section class="content-card preprocess-lesson">
      <h2>标准化范围对比</h2>
      ${standardizeTableHtml(row ? [row] : dataCache?.standardize_table || [])}
    </section>
  </div>`;
}

function renderPreprocessStandardizeGrid() {
  const grid = $("chartGrid");
  if (!grid) return;
  const feature = dataCache?.feature || $("dataFeature")?.value || "";
  const row = (dataCache?.standardize_table || []).find(item => item.feature === feature);
  const views = ["standardize_overview"];
  experimentRenderGridStack({
    grid,
    mode: "preprocess",
    views,
    loadLayout: loadDataGridLayout,
    defaultLayout: () => ({ x: 0, y: 0, w: 4, h: 4 }),
    normalizeLayout: (view, layout) => normalizeDataGridLayout(view, layout),
    htmlForView: () => preprocessStandardizeCardHtml("overview", feature, row),
    minWidthForView: () => 2,
    minHeightForView: () => 2,
  });
}

function preprocessStandardizeCardHtml(kind, feature, row) {
  if (kind === "overview") {
    return `<section class="chart-card wide preprocess-info-card standardize-overview-card">
      <div class="chart-head" aria-label="拖动卡片"></div>
      <div class="info-card-body preprocess-step-body standardize-overview-body">
        ${preprocessStandardizeSectionHtml("formula", feature, row)}
        ${preprocessStandardizeSectionHtml("preview", feature, row)}
        ${preprocessStandardizeSectionHtml("range", feature, row)}
      </div>
    </section>`;
  }
  return preprocessStandardizeSectionHtml(kind, feature, row);
}

function preprocessStandardizeSectionHtml(kind, feature, row) {
  if (kind === "formula") {
    return `<section class="content-card preprocess-lesson">
        <h2>数据标准化</h2>
        <p>标准化把不同量纲的特征转换到更容易比较和训练的尺度上。</p>
        <div class="formula">z = (x - mean) / std

当前特征：${escapeHtml(feature)}
mean = ${row ? num(row.mean, 6) : "--"}
std  = ${row ? num(row.std, 6) : "--"}</div>
        <div class="teaching-note">标准化后，特征均值会接近 0，标准差会接近 1。后续训练可以选择使用标准化特征。</div>
      </section>`;
  }
  if (kind === "preview") {
    return `<section class="content-card preprocess-lesson">
        <h2>标准化后前 5 行</h2>
        <p>直接观察原始特征与标准化特征的数值变化。</p>
        ${previewTableHtml(dataCache?.standardized_preview || [])}
      </section>`;
  }
  return `<section class="content-card preprocess-lesson">
      <h2>标准化范围对比</h2>
      ${standardizeTableHtml(row ? [row] : dataCache?.standardize_table || [])}
    </section>`;
}

function renderDatasetEmptyState() {
  const grid = $("chartGrid");
  if (!grid) return;
  experimentRenderGridStack({
    grid,
    mode: "preprocess",
    views: ["load_hint"],
    loadLayout: loadDataGridLayout,
    defaultLayout: () => ({ x: 0, y: 0, w: 4, h: 2 }),
    normalizeLayout: (_view, layout) => normalizeDataGridLayout("load_hint", layout),
    htmlForView: () => preprocessLoadHintCardHtml(),
    minWidthForView: () => 2,
  });
  return;
  destroyDataGrid();
  disposeCharts();
  grid.classList.remove("dashboard-grid", "grid-stack");
  grid.innerHTML = preprocessLoadHintCardHtml();
  return;
  grid.innerHTML = `<div class="empty-state">请先在右侧加载数据集。</div>`;
}

function renderRawVizPrompt() {
  const grid = $("chartGrid");
  if (!grid) return;
  experimentRenderGridStack({
    grid,
    mode: "preprocess",
    views: ["raw_viz_hint"],
    loadLayout: loadDataGridLayout,
    defaultLayout: () => ({ x: 0, y: 0, w: 4, h: 2 }),
    normalizeLayout: (_view, layout) => normalizeDataGridLayout("raw_viz_hint", layout),
    htmlForView: () => `<section class="chart-card wide load-dataset-card">
      <div class="chart-head" aria-label="拖动提示卡片"></div>
      <div class="load-dataset-hint">请在右侧选择特征和显示模块</div>
    </section>`,
    minWidthForView: () => 2,
  });
}

function preprocessLoadHintCardHtml() {
  return `<section class="chart-card wide load-dataset-card">
    <div class="chart-head" aria-label="拖动提示卡片"></div>
    <div class="load-dataset-hint">请先从右侧加载数据集</div>
  </section>`;
  return `<section class="chart-card wide load-dataset-card">
    <div class="chart-head" aria-label="拖动提示卡片"></div>
    <div class="load-dataset-hint">请先在右侧 数据集 中加载数据集。</div>
  </section>`;
}

function preprocessFormatCardHtml() {
  const rawRows = [
    { area: 80, rooms: 2, price: 120 },
    { area: 100, rooms: 3, price: 160 },
    { area: 120, rooms: 3, price: 180 },
  ];
  const bostonRows = [
    { CRIM: 0.00632, RM: 6.575, LSTAT: 4.98, MEDV: 24.0 },
    { CRIM: 0.02731, RM: 6.421, LSTAT: 9.14, MEDV: 21.6 },
    { CRIM: 0.02729, RM: 7.185, LSTAT: 4.03, MEDV: 34.7 },
  ];
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据格式</div>
        <div class="chart-sub">请先在右侧加载数据集，加载成功后再选择特征并执行预处理查看。</div>
      </div>
    </div>
    <div class="info-card-body" style="padding:18px">
      <div class="format-intro">
        <p><strong>规则：</strong>系统把最后一列作为目标列 y，其余数值列作为候选特征 x。预处理阶段会按所选特征生成标准化视图，并用于后续训练。</p>
        <p>内置 Boston 会作为原始数据集加载；上传 CSV 需要第一行是列名，至少包含 1 个数值特征列和 1 个数值目标列。</p>
      </div>
      <div class="format-grid">
        <div class="format-column">
          <div class="format-point"><strong>通用 CSV 示例</strong>目标列放在最后，例如 <code>area</code>、<code>rooms</code>、<code>price</code>。</div>
          <p class="sample-caption">原始 CSV 示例</p>
          ${previewTableHtml(rawRows)}
        </div>
        <div class="format-column">
          <div class="format-point"><strong>Boston 原始数据集</strong>目标列为 <code>MEDV</code>，其余数值列可作为特征。</div>
          <p class="sample-caption">Boston 示例</p>
          ${previewTableHtml(bostonRows)}
        </div>
      </div>
      <div class="format-upload-hint">请先在右侧 01 数据集 中加载数据集。</div>
    </div>
  </section>`;
}

function renderDataDashboard(grid, views) {
  dataGridMode = "preprocess";
  grid.classList.add("dashboard-grid", "grid-stack");
  grid.classList.remove("single");
  const saved = loadDataGridLayout();
  grid.innerHTML = views.map(view => dataGridItemHtml(view, normalizeDataGridLayout(view, saved[view] || defaultDataGridLayout(view, views.length)))).join("");
  dataGrid = GridStack.init({
    column: 4,
    cellHeight: 260,
    margin: 8,
    float: true,
    animate: true,
    draggable: { handle: ".chart-head" },
    resizable: { handles: "e, s, se" }
  }, grid);
  grid.setAttribute("gs-column", "4");
  updateDataGridCellHeight();
  dataGrid.compact();
  dataGrid.on("change dragstop resizestop", () => {
    syncDataGridAttributes();
    saveDataGridLayout();
    requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
  });
  syncDataGridAttributes();
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function defaultDataGridLayout(view, viewCount = 2) {
  return ({
    load_hint: { x: 0, y: 0, w: 4, h: 1 },
    raw: { x: 0, y: 0, w: 2, h: 2 },
    standardized: { x: 2, y: 0, w: 2, h: 2 },
    single_corr: { x: 0, y: 2, w: 2, h: 2 },
    all_corr: { x: 2, y: 2, w: 2, h: 2 }
  })[view] || { x: 0, y: 0, w: 2, h: 2 };
}

function dataGridMinWidth(view) {
  return 1;
}

function normalizeDataGridLayout(view, layout) {
  const minW = dataGridMinWidth(view);
  const next = { ...defaultDataGridLayout(view), ...layout };
  next.w = Math.max(minW, Math.min(4, Number(next.w) || minW));
  next.h = Math.max(1, Number(next.h) || 1);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}

function dataGridItemHtml(view, layout) {
  const minW = dataGridMinWidth(view);
  return `<div class="grid-stack-item" data-view="${view}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="${minW}" gs-min-h="1"><div class="grid-stack-item-content">${chartCardHtml(view, chartTitle(view), chartSub(view, dataCache), dataCardSize(view))}</div></div>`;
}

function preprocessChartOption(meta, chartData = null) {
  if (!meta) return null;
  if (meta.renderer === "scatter_trend") {
    const data = chartData || (() => {
      const fallback = meta.id === "standardized" ? dataCache.standardized : dataCache.raw;
      return {
      scatter: fallback.scatter,
      trend_line: fallback.trend_line,
      x_name: meta.id === "standardized" ? dataCache.standardized.feature_name : dataCache.feature,
      y_name: dataCache.target || "MEDV",
      };
    })();
    return scatterOption(data.scatter, data.trend_line, data.x_name, meta.title, data.y_name);
  }
  if (meta.renderer === "single_corr") {
    const data = chartData || {
      feature: dataCache.feature,
      corr: dataCache.raw.summary.corr,
    };
    return singleCorrOptionFromData(data);
  }
  if (meta.renderer === "all_corr") {
    const data = chartData || {
      rows: dataCache.correlations,
      current_feature: dataCache.feature,
    };
    return allCorrOption(data.rows, data.current_feature);
  }
  return null;
}

function renderRawDataVizPanel() {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const views = rawVizSelectedViews();
  const moduleOptionsHtml = [
    { label: "原始散点图", value: "raw" },
    { label: "全特征线性相关系数", value: "all_corr" },
  ].map(opt => checkboxRowHtml("dataViews", opt.value, opt.label, views.includes(opt.value), !datasetLoaded)).join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>原始数据可视化</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <details class="mode-menu" open>
          <summary id="dataModeSummary">${views.length ? `已选择 ${views.length} 个模块` : "请选择显示模块"}</summary>
          <div class="check-list">${moduleOptionsHtml}</div>
        </details>
      </div>
    </div>`;
}
function visualizationPanelHtml({ title }) {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="显示模块">
        <label class="control-label">显示模块</label>
        <div class="check-list">${moduleOptionsHtml}</div>
      </div>
    </div>`;
}

function renderRawDataVizPanel() {
  return visualizationPanelHtml({
    title: "原始数据可视化",
    views: rawVizSelectedViews(),
    modules: [
      { label: "原始散点图", value: "raw" },
      { label: "全特征线性相关系数", value: "all_corr" },
    ],
  });
}

function renderStandardDataVizPanel() {
  return visualizationPanelHtml({
    title: "标准数据可视化",
    views: standardVizSelectedViews(),
    modules: [
      { label: "标准化散点图", value: "standardized" },
      { label: "全特征线性相关系数", value: "all_corr" },
    ],
  });
}

function visualizationPanelHtmlClean({ title }) {
  const datasetLoaded = Boolean(currentDatasetMeta);
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || viewStateStore.preprocessFormStateV1?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  return `
    <div class="right-title">控制面板</div>
    <div class="control-card dataset-load-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="control-group" aria-label="特征选择">
        <label class="control-label" for="dataFeature">特征选择</label>
        <select id="dataFeature" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
    </div>`;
}

visualizationPanelHtml = visualizationPanelHtmlClean;
