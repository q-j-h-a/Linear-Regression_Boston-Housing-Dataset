// Train Page.

let activeTrainStep = viewStateStore.activeTrainStepV1 || "process";
let trainProgressStep = viewStateStore.trainProgressStepV1 || activeTrainStep;
let trainCompareData = null;
let trainCompareViewsKey = "";
let trainCompareEntered = false;
let trainLossViewsKey = "";
let trainOptimizationViewsKey = "";
let trainCustomViewsKey = "";

const TRAIN_STEPS = [
  { id: "process", no: "01", views: ["model_train", "learning"] },
  { id: "preprocess_effect", no: "02", views: ["raw_scatter", "standard_scatter"] },
  { id: "loss", no: "03", views: ["model_train", "learning", "calc"] },
  { id: "optimization", no: "04", views: ["gradient_descent", "gradient", "w_path", "b_path"] },
  { id: "custom", no: "05", views: ["model_train", "learning", "w_path", "b_path", "calc"] },
];

const TRAIN_STEP_DEFAULTS = {
  process: { trainStd: "true", trainFeature: DEFAULT_FEATURE, w0: "0", b0: "0", lr: "0.030", epochs: "200", speed: "90" },
  preprocess_effect: { trainStd: "true", trainFeature: DEFAULT_FEATURE, w0: "0", b0: "0", lr: "0.030", epochs: "100", speed: "90" },
  loss: { trainStd: "true", trainFeature: DEFAULT_FEATURE, w0: "0", b0: "0", lr: "0.030", epochs: "120", speed: "120" },
  optimization: { trainStd: "true", trainFeature: DEFAULT_FEATURE, w0: "0", b0: "0", lr: "0.030", epochs: "160", speed: "120" },
  custom: { trainStd: "true", trainFeature: DEFAULT_FEATURE, w0: "0", b0: "0", lr: "0.030", epochs: "120", speed: "90" },
};

const TRAIN_COMPARE_VIEWS = [
  { id: "raw_scatter", label: "\u539f\u59cb\u6563\u70b9\u56fe", mode: "raw" },
  { id: "standard_scatter", label: "\u6807\u51c6\u5316\u6563\u70b9\u56fe", mode: "standard" },
];

const TRAIN_LOSS_RESIDUAL_MODES = [
  { id: "single", label: "\u5355\u6837\u672c\u6b8b\u5dee" },
  { id: "random10", label: "\u968f\u673a 10 \u4e2a\u6837\u672c" },
  { id: "top5", label: "\u6700\u5927\u6b8b\u5dee\u524d 5" },
];

const TRAIN_LOSS_OVERALL_VIEWS = [
  { id: "residual_scatter", label: "\u6b8b\u5dee\u6563\u70b9\u56fe" },
  { id: "residual_hist", label: "\u6b8b\u5dee\u76f4\u65b9\u56fe" },
];

const TRAIN_OPT_SLICE_MODES = [
  { id: "w", label: "\u56fa\u5b9a b\uff0c\u770b w" },
  { id: "b", label: "\u56fa\u5b9a w\uff0c\u770b b" },
  { id: "neg_grad", label: "\u6cbf\u8d1f\u68af\u5ea6\u65b9\u5411" },
];

function ensureTrainTopFlow() {
  const slot = $("pageTopSlot");
  if (!slot) return null;
  slot.classList.add("has-content");
  if (!$("trainFlow")) {
    slot.innerHTML = `<div class="preprocess-flow" id="trainFlow"></div>`;
  }
  return $("trainFlow");
}

function trainStepIndex(stepId) {
  const index = TRAIN_STEPS.findIndex(step => step.id === stepId);
  return index < 0 ? 0 : index;
}

function trainStep() {
  return TRAIN_STEPS.find(step => step.id === activeTrainStep) || TRAIN_STEPS[0];
}

function trainStepLabel(stepId = activeTrainStep) {
  return ({
    process: "\u719f\u6089\u56de\u5f52\u8fc7\u7a0b",
    preprocess_effect: "\u719f\u6089\u9884\u5904\u7406\u5f71\u54cd",
    loss: "\u719f\u6089\u635f\u5931\u51fd\u6570",
    optimization: "\u719f\u6089\u4f18\u5316\u51c6\u5219",
    custom: "\u81ea\u5b9a\u4e49\u53c2\u6570\u8bad\u7ec3",
  })[stepId] || "\u719f\u6089\u56de\u5f52\u8fc7\u7a0b";
}

function markTrainProgress(stepId) {
  if (trainStepIndex(stepId) <= trainStepIndex(trainProgressStep)) return;
  trainProgressStep = stepId;
  viewStateStore.trainProgressStepV1 = trainProgressStep;
}

function renderTrainFlow() {
  const flow = ensureTrainTopFlow();
  if (!flow) return;
  const progressIndex = trainStepIndex(trainProgressStep);
  flow.innerHTML = TRAIN_STEPS.map((step, index) => {
    const classes = ["flow-step"];
    if (step.id === activeTrainStep) classes.push("active");
    else if (index <= progressIndex) classes.push("done");
    return `<button class="${classes.join(" ")}" type="button" data-train-step="${escapeHtml(step.id)}"><span>${step.no}</span><strong>${escapeHtml(trainStepLabel(step.id))}</strong></button>`;
  }).join("");
}

function bindTrainFlow() {
  const flow = ensureTrainTopFlow();
  if (!flow || flow.dataset.bound === "true") return;
  flow.dataset.bound = "true";
  flow.addEventListener("click", async event => {
    const btn = event.target.closest("[data-train-step]");
    if (!btn || !flow.contains(btn)) return;
    stopAuto();
    const previousStep = activeTrainStep;
    activeTrainStep = btn.dataset.trainStep;
    if (activeTrainStep === "preprocess_effect" && previousStep !== activeTrainStep) {
      ensureTrainCompareState();
      trainCompareViewsKey = "";
      trainCompareEntered = true;
    }
    viewStateStore.activeTrainStepV1 = activeTrainStep;
    markTrainProgress(activeTrainStep);
    await renderTrainCurrentStep();
  });
}

function trainStepDefaults() {
  return { ...TRAIN_STEP_DEFAULTS.process, ...(TRAIN_STEP_DEFAULTS[activeTrainStep] || {}) };
}

function trainStepViews() {
  if (activeTrainStep === "preprocess_effect") {
    return TRAIN_COMPARE_VIEWS.map(item => item.id);
  }
  if (activeTrainStep === "custom") {
    const saved = viewStateStore.trainSelectedViewsV1;
    if (Array.isArray(saved) && saved.length) return saved;
  }
  return [...trainStep().views];
}

function trainLossResidualMode() {
  const saved = viewStateStore.trainLossResidualModeV1;
  return TRAIN_LOSS_RESIDUAL_MODES.some(item => item.id === saved) ? saved : "single";
}

function trainLossOverallView() {
  const saved = viewStateStore.trainLossOverallViewV1;
  return TRAIN_LOSS_OVERALL_VIEWS.some(item => item.id === saved) ? saved : "residual_scatter";
}

function trainOptimizationSliceMode() {
  const saved = viewStateStore.trainOptimizationSliceModeV1;
  return TRAIN_OPT_SLICE_MODES.some(item => item.id === saved) ? saved : "w";
}

function trainLossSampleIndex() {
  const count = trainData?.scatter?.x?.length || 0;
  const saved = Number(viewStateStore.trainLossSampleIndexV1 ?? 0);
  if (!count) return 0;
  return Math.max(0, Math.min(count - 1, Number.isFinite(saved) ? saved : 0));
}

function setTrainLossSampleIndex(index) {
  const count = trainData?.scatter?.x?.length || 0;
  if (!count) {
    viewStateStore.trainLossSampleIndexV1 = 0;
    return 0;
  }
  const next = ((Math.round(Number(index) || 0) % count) + count) % count;
  viewStateStore.trainLossSampleIndexV1 = next;
  return next;
}

function setTrainCheckedViews(views) {
  const allowed = new Set(views);
  document.querySelectorAll('input[name="trainViews"]').forEach(el => {
    el.checked = allowed.has(el.value);
  });
}

function selectedTrainCompareViews() {
  if (activeTrainStep === "preprocess_effect") return TRAIN_COMPARE_VIEWS.map(item => item.id);
  const values = selectedValues("trainCompareViews");
  return values;
}

function trainUseStandardized() {
  const value = $("trainStd")?.value;
  return value === "1" || value === "true" || value === true;
}

function renderTrainDashboard(grid, views, frame) {
  dataGridMode = "train";
  grid.classList.add("dashboard-grid", "grid-stack");
  grid.classList.remove("single");
  const saved = loadTrainGridLayout();
  grid.innerHTML = views.map(view => {
    const layout = normalizeTrainGridLayout(view, saved[view] || defaultTrainGridLayout(view));
    return trainGridItemHtml(view, layout, frame);
  }).join("");
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

function defaultTrainGridLayout(view) {
  return ({
    model_train: { x: 0, y: 0, w: 2, h: 2 },
    learning: { x: 2, y: 0, w: 2, h: 2 },
    gradient: { x: 0, y: 2, w: 2, h: 2 },
    loss_surface_3d: { x: 0, y: 4, w: 2, h: 2 },
    w_path: { x: 2, y: 2, w: 1, h: 1 },
    b_path: { x: 2, y: 3, w: 1, h: 1 },
    rmse: { x: 3, y: 2, w: 1, h: 2 },
    mae: { x: 2, y: 4, w: 1, h: 2 },
    r2: { x: 3, y: 4, w: 1, h: 2 },
    gradient_descent: { x: 0, y: 6, w: 1, h: 2 },
    calc: { x: 0, y: 8, w: 4, h: 4 },
    table: { x: 0, y: 12, w: 4, h: 1 }
  })[view] || { x: 0, y: 0, w: 1, h: 1 };
}

function normalizeTrainGridLayout(view, layout) {
  const next = { ...defaultTrainGridLayout(view), ...layout };
  next.w = Math.max(1, Math.min(4, Number(next.w) || 1));
  next.h = Math.max(1, Number(next.h) || 1);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}

function trainGridItemHtml(view, layout, frame) {
  return `<div class="grid-stack-item" data-view="${view}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${trainViewHtml(view, frame, trainChartDataCache[view])}</div></div>`;
}

function updateTrainInfoCards(frame) {
  selectedValues("trainViews").filter(isTrainInfoView).forEach(view => {
    const item = Array.from(document.querySelectorAll(".grid-stack-item"))
      .find(el => el.dataset.view === view)
      ?.querySelector(".grid-stack-item-content");
    if (item) item.innerHTML = trainViewHtml(view, frame, trainChartDataCache[view]);
  });
}

async function renderTrainShell() {
  await loadTrainPageSchema();
  document.querySelector(".shell").classList.remove("theory");
  ensureTrainTopFlow();
  bindTrainFlow();
  await renderTrainCurrentStep();
}

async function renderTrainCurrentStep() {
  renderTrainFlow();
  $("main").innerHTML = `<div id="trainContent"></div>`;
  if (activeTrainStep === "preprocess_effect" && !trainCompareEntered) {
    ensureTrainCompareState();
    trainCompareViewsKey = "";
    trainCompareEntered = true;
  }
  $("rightPanel").innerHTML = renderTrainStepPanel();
  bindTrainStepPanel();
  if (activeTrainStep === "preprocess_effect") {
    await prepareTrainCompare();
    return;
  }
  if (trainDataMatchesCurrentForm()) {
    restoreTrainView();
  } else {
    await prepareTraining();
  }
}

function trainDataMatchesCurrentForm() {
  if (!trainData) return false;
  const first = trainData.history?.[0] || {};
  const sameFeature = trainData.feature === $("trainFeature")?.value;
  const sameScale = trainData.use_standardized === trainUseStandardized();
  const sameLr = Math.abs(Number(trainData.learning_rate) - Number($("lr")?.value)) < 1e-12;
  const sameEpochs = Number(trainData.epochs) === Number($("epochs")?.value);
  const sameW = Math.abs(Number(first.w) - Number($("w0")?.value)) < 1e-12;
  const sameB = Math.abs(Number(first.b) - Number($("b0")?.value)) < 1e-12;
  return sameFeature && sameScale && sameLr && sameEpochs && sameW && sameB;
}

function ensureTrainCompareState() {
  if (!Array.isArray(viewStateStore.trainCompareViewsV1)) {
    viewStateStore.trainCompareViewsV1 = [];
  }
  const saved = viewStateStore.trainFormStateV1 || {};
  viewStateStore.trainFormStateV1 = {
    ...TRAIN_STEP_DEFAULTS.preprocess_effect,
    ...saved,
    trainFeature: saved.trainFeature || "RM",
  };
}

function renderTrainStepPanel() {
  if (activeTrainStep === "process") return renderRegressionProcessPanel();
  if (activeTrainStep === "preprocess_effect") return renderPreprocessEffectPanel();
  if (activeTrainStep === "loss") return renderLossFunctionPanel();
  if (activeTrainStep === "optimization") return renderOptimizationCriterionPanel();
  if (activeTrainStep === "custom") return renderCustomParameterPanel();
  const saved = activeTrainStep === "custom" ? (viewStateStore.trainFormStateV1 || {}) : {};
  const defaults = { ...trainStepDefaults(), ...saved };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  const views = trainStepViews();
  const fixed = activeTrainStep !== "custom";
  return `
    <div class="right-title">\u6a21\u578b\u8bad\u7ec3</div>
    <div class="control-card dataset-load-card">
      <h3>${escapeHtml(trainStepLabel())}</h3>
      <div class="mini-stats">
        <div class="mini-stat"><span>\u6837\u672c\u603b\u6570</span><strong id="sampleCount">${escapeHtml(currentDatasetMeta?.row_count ?? "--")}</strong></div>
        <div class="mini-stat"><span>\u7279\u5f81\u6570\u91cf</span><strong id="featureCount">${escapeHtml(currentDatasetMeta?.features?.length ?? FEATURE_NAMES.length)}</strong></div>
      </div>
      <div class="control-group">
        <label class="control-label" for="trainStd">\u8bad\u7ec3\u6570\u636e</label>
        <select id="trainStd" ${activeTrainStep === "process" ? "disabled" : ""}>
          <option value="true"${defaults.trainStd !== "false" ? " selected" : ""}>\u6807\u51c6\u5316\u7279\u5f81</option>
          <option value="false"${defaults.trainStd === "false" ? " selected" : ""}>\u539f\u59cb\u7279\u5f81</option>
        </select>
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature" ${fixed ? "disabled" : ""}>
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      ${renderTrainStepSpecificControls(defaults)}
      ${renderTrainChartSelector(views)}
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d epoch</span><strong id="epochNow">--</strong></div>
        <div><span>\u5f53\u524d Loss</span><strong id="lossNow">--</strong></div>
      </div>
      <div class="status-line" id="trainRunMessage">${escapeHtml(trainStepHint())}</div>
    </div>`;
}

function renderRegressionProcessPanel() {
  const saved = viewStateStore.trainFormStateV1 || {};
  const defaults = { ...TRAIN_STEP_DEFAULTS.process, ...saved, trainFeature: saved.trainFeature || "RM" };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card dataset-load-card">
      <h3>\u719f\u6089\u56de\u5f52\u8fc7\u7a0b</h3>
      <div class="control-group">
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature">
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        <input id="trainStd" type="hidden" value="true">
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u5468\u671f\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d\u5468\u671f</span><strong id="epochNow">--</strong></div>
        <div><span>\u6807\u51c6 Loss</span><strong id="stdLossNow">--</strong></div>
      </div>
      <div class="status-line hidden" id="trainRunMessage"></div>
    </div>`;
}

function renderPreprocessEffectPanel() {
  const saved = viewStateStore.trainFormStateV1 || {};
  const defaults = { ...TRAIN_STEP_DEFAULTS.preprocess_effect, ...saved, trainFeature: saved.trainFeature || "RM" };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card dataset-load-card">
      <h3>\u719f\u6089\u9884\u5904\u7406\u7684\u5f71\u54cd</h3>
      <div class="control-group">
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature">
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        <input id="trainStd" type="hidden" value="true">
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u5468\u671f\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d\u5468\u671f</span><strong id="epochNow">--</strong></div>
        <div><span>\u539f\u59cb Loss</span><strong id="rawLossNow">--</strong></div>
        <div><span>\u6807\u51c6\u5316 Loss</span><strong id="stdLossNow">--</strong></div>
      </div>
    </div>`;
}

function renderLossFunctionPanel() {
  const saved = viewStateStore.trainFormStateV1 || {};
  const defaults = { ...TRAIN_STEP_DEFAULTS.loss, ...saved, trainFeature: saved.trainFeature || "RM" };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card dataset-load-card">
      <h3>\u719f\u6089\u635f\u5931\u51fd\u6570</h3>
      <div class="control-group">
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature">
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        <input id="trainStd" type="hidden" value="true">
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u5468\u671f\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d\u5468\u671f</span><strong id="epochNow">--</strong></div>
        <div><span>MSE</span><strong id="lossNow">--</strong></div>
      </div>
      <div class="status-line hidden" id="trainRunMessage"></div>
    </div>`;
}

function renderOptimizationCriterionPanel() {
  const saved = viewStateStore.trainFormStateV1 || {};
  const defaults = { ...TRAIN_STEP_DEFAULTS.optimization, ...saved, trainFeature: saved.trainFeature || "RM" };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card dataset-load-card">
      <h3>\u719f\u6089\u4f18\u5316\u51c6\u5219</h3>
      <div class="control-group">
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature">
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        <input id="trainStd" type="hidden" value="true">
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u5468\u671f\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d\u5468\u671f</span><strong id="epochNow">--</strong></div>
        <div><span>dw</span><strong id="dwNow">--</strong></div>
        <div><span>db</span><strong id="dbNow">--</strong></div>
        <div><span>MSE</span><strong id="lossNow">--</strong></div>
      </div>
      <div class="status-line hidden" id="trainRunMessage"></div>
    </div>`;
}

function renderCustomParameterPanel() {
  const saved = viewStateStore.trainFormStateV1 || {};
  const defaults = { ...TRAIN_STEP_DEFAULTS.custom, ...saved, trainFeature: saved.trainFeature || "RM" };
  const features = currentDatasetMeta?.features || FEATURE_NAMES;
  const feature = defaults.trainFeature && features.includes(defaults.trainFeature) ? defaults.trainFeature : (features[0] || DEFAULT_FEATURE);
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card dataset-load-card">
      <h3>\u81ea\u5b9a\u4e49\u53c2\u6570\u8bad\u7ec3</h3>
      <div class="control-group">
        <label class="control-label" for="trainFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="trainFeature">
          ${features.map(item => optionHtml(item, feature, item)).join("")}
        </select>
      </div>
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        <input id="trainStd" type="hidden" value="true">
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u5468\u671f\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>
      ${renderTrainButtons()}
      <div class="runtime">
        <div><span>\u5f53\u524d\u5468\u671f</span><strong id="epochNow">--</strong></div>
        <div><span>Loss</span><strong id="lossNow">--</strong></div>
        <div><span>w</span><strong id="wNow">--</strong></div>
        <div><span>b</span><strong id="bNow">--</strong></div>
      </div>
      <div class="status-line hidden" id="trainRunMessage"></div>
    </div>`;
}

function renderTrainStepSpecificControls(defaults) {
  if (activeTrainStep === "custom") {
    return `
      <div class="control-group">
        <div class="field-grid">
          <label class="control-label train-param-input">\u521d\u59cb w<input id="w0" type="text" inputmode="decimal" value="${escapeHtml(defaults.w0)}"></label>
          <label class="control-label train-param-input">\u521d\u59cb b<input id="b0" type="text" inputmode="decimal" value="${escapeHtml(defaults.b0)}"></label>
        </div>
        ${trainRangeHtml("lr", "\u5b66\u4e60\u7387", defaults.lr, 0.001, 0.2, 0.001, "lrText", value => Number(value).toFixed(3))}
        ${trainRangeHtml("epochs", "\u8bad\u7ec3\u8f6e\u6570", defaults.epochs, 1, 500, 1, "epochsText", value => value)}
        ${trainRangeHtml("speed", "\u52a8\u753b\u901f\u5ea6", defaults.speed, 30, 600, 10, "speedText", value => `${value}ms`)}
      </div>`;
  }
  const params = trainStepDefaults();
  return `
    <input id="w0" type="hidden" value="${escapeHtml(params.w0)}">
    <input id="b0" type="hidden" value="${escapeHtml(params.b0)}">
    <input id="lr" type="hidden" value="${escapeHtml(params.lr)}">
    <input id="epochs" type="hidden" value="${escapeHtml(params.epochs)}">
    <div class="control-group">
      <label class="control-label" for="speed">\u52a8\u753b\u901f\u5ea6</label>
      <input id="speed" type="range" min="30" max="600" step="10" value="${escapeHtml(params.speed)}">
      <div class="range-line"><span>\u5feb</span><strong id="speedText">${escapeHtml(params.speed)}ms</strong><span>\u6162</span></div>
      <div class="teaching-note">${escapeHtml(trainStepHint())}</div>
    </div>`;
}

function renderTrainButtons() {
  return `
    <div class="button-grid">
      <button class="btn primary" id="stepBtn" type="button">\u5355\u6b65\u8bad\u7ec3</button>
      <button class="btn green" id="autoBtn" type="button">\u81ea\u52a8\u6f14\u793a</button>
      <button class="btn dark" id="pauseBtn" type="button">\u6682\u505c</button>
      <button class="btn rose" id="resetBtn" type="button">\u91cd\u7f6e</button>
    </div>`;
}

function trainRangeHtml(id, label, value, min, max, step, valueId, formatter) {
  return `
    <label class="control-label range-label" for="${id}">${label}</label>
    <div class="range-control">
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}">
      <div class="range-stepper" aria-label="${escapeHtml(label)}\u5fae\u8c03">
        <button class="range-step-btn" type="button" data-step-target="${escapeHtml(id)}" data-step-dir="1" aria-label="\u589e\u52a0${escapeHtml(label)}">&#9650;</button>
        <button class="range-step-btn" type="button" data-step-target="${escapeHtml(id)}" data-step-dir="-1" aria-label="\u51cf\u5c11${escapeHtml(label)}">&#9660;</button>
      </div>
    </div>
    <div class="range-line"><span>${min}</span><strong id="${valueId}">${escapeHtml(formatter(value))}</strong><span>${max}</span></div>`;
}

function renderTrainChartSelector(views) {
  const options = trainChartRegistry.map(chart => checkboxRowHtml("trainViews", chart.id, chart.title, views.includes(chart.id)));
  return `
    <div class="control-group">
      <label class="control-label">\u663e\u793a\u6a21\u5757</label>
      <details class="mode-menu" open>
        <summary id="trainModeSummary">\u5df2\u9009 ${views.length} \u4e2a\u56fe\u8868</summary>
        <div class="check-list">${options.join("")}</div>
      </details>
    </div>`;
}

function trainStepHint() {
  return ({
    process: "\u4f7f\u7528\u9ed8\u8ba4\u53c2\u6570\u6f14\u793a\u56de\u5f52\u7ebf\u5982\u4f55\u9010\u6b65\u9760\u8fd1\u6837\u672c\u8d8b\u52bf\uff1b\u8fbe\u5230 200 \u8f6e\u3001Loss \u6536\u655b\u6216\u53d1\u6563\u65f6\u81ea\u52a8\u505c\u6b62\u3002",
    preprocess_effect: "\u8bf7\u5728\u53f3\u4fa7\u540c\u65f6\u9009\u62e9\u539f\u59cb\u6563\u70b9\u56fe\u548c\u6807\u51c6\u5316\u6563\u70b9\u56fe\uff0c\u9009\u62e9\u7279\u5f81\uff0c\u89c2\u5bdf\u5728\u5176\u5b83\u53c2\u6570\u76f8\u540c\u7684\u60c5\u51b5\u4e0b\uff0c\u8bad\u7ec3\u6a21\u578b\u65f6\u56de\u5f52\u7684\u533a\u522b",
    loss: "\u91cd\u70b9\u89c2\u5bdf MSE Loss\uff1a\u5355\u4e2a\u8bef\u5dee\u4f1a\u88ab\u5e73\u65b9\u540e\u6c47\u603b\u6210\u6574\u4f53\u8bad\u7ec3\u76ee\u6807\u3002",
    optimization: "\u91cd\u70b9\u89c2\u5bdf\u68af\u5ea6\u4e0b\u964d\uff1adw\u3001db \u6307\u793a\u53c2\u6570\u66f4\u65b0\u65b9\u5411\uff0c\u5b66\u4e60\u7387\u63a7\u5236\u6bcf\u4e00\u6b65\u8d70\u591a\u8fdc\u3002",
    custom: "\u81ea\u7531\u8c03\u6574\u5b66\u4e60\u7387\u3001\u521d\u59cb w/b \u548c\u8bad\u7ec3\u8f6e\u6570\uff0c\u9a8c\u8bc1\u524d\u9762\u51e0\u6b65\u5f62\u6210\u7684\u5224\u65ad\u3002",
  })[activeTrainStep] || "";
}

function bindTrainStepPanel() {
  setTrainCheckedViews(trainStepViews());
  updateTrainRangeText();
  bindRangeStepperButtons();
  ["trainFeature", "trainStd", "w0", "b0", "lr", "epochs"].forEach(id => {
    const el = $(id);
    if (!el || el.disabled) return;
    el.addEventListener("change", () => {
      if (activeTrainStep === "preprocess_effect") prepareTrainCompare();
      else prepareTraining();
    });
  });
  $("speed")?.addEventListener("input", updateTrainRangeText);
  $("lr")?.addEventListener("input", updateTrainRangeText);
  $("epochs")?.addEventListener("input", updateTrainRangeText);
  document.querySelectorAll('input[name="trainViews"]').forEach(el => el.addEventListener("change", () => {
    if (activeTrainStep === "custom") saveCheckedValues("trainViews", "trainSelectedViewsV1");
    renderTrainFrame(currentFrame);
  }));
  document.querySelectorAll('input[name="trainCompareViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("trainCompareViews", "trainCompareViewsV1");
    renderTrainCompareFrame(currentFrame);
  }));
  $("stepBtn")?.addEventListener("click", () => {
    if (activeTrainStep === "preprocess_effect") renderTrainCompareFrame(currentFrame + 1);
    else if (activeTrainStep === "process") renderTrainProcessFrame(currentFrame + 1);
    else if (activeTrainStep === "loss") renderTrainLossFrame(currentFrame + 1);
    else if (activeTrainStep === "optimization") renderTrainOptimizationFrame(currentFrame + 1);
    else if (activeTrainStep === "custom") renderTrainCustomFrame(currentFrame + 1);
    else renderTrainFrame(currentFrame + 1);
  });
  $("autoBtn")?.addEventListener("click", startAuto);
  $("pauseBtn")?.addEventListener("click", stopAuto);
  $("resetBtn")?.addEventListener("click", () => {
    stopAuto();
    if (activeTrainStep === "preprocess_effect") renderTrainCompareFrame(0);
    else if (activeTrainStep === "process") renderTrainProcessFrame(0);
    else if (activeTrainStep === "loss") renderTrainLossFrame(0);
    else if (activeTrainStep === "optimization") renderTrainOptimizationFrame(0);
    else if (activeTrainStep === "custom") renderTrainCustomFrame(0);
    else renderTrainFrame(0);
    setTrainRunMessage(trainStepHint());
  });
}

function updateTrainRangeText() {
  if ($("lr") && $("lrText")) $("lrText").textContent = Number($("lr").value).toFixed(3);
  if ($("epochs") && $("epochsText")) $("epochsText").textContent = $("epochs").value;
  if ($("speed") && $("speedText")) $("speedText").textContent = `${$("speed").value}ms`;
}

function persistTrainFormState() {
  const ids = ["trainFeature", "trainStd", "w0", "b0", "lr", "epochs", "speed"];
  const state = {};
  ids.forEach(id => {
    const el = $(id);
    if (el) state[id] = el.value;
  });
  viewStateStore.trainFormStateV1 = state;
}

function restoreTrainFormState() {
  const state = viewStateStore.trainFormStateV1 || {};
  if (!state.trainFeature && trainData?.feature) state.trainFeature = trainData.feature;
  if (!state.trainStd && trainData) state.trainStd = trainData.use_standardized ? "true" : "false";
  ["trainFeature", "trainStd", "w0", "b0", "lr", "epochs", "speed"].forEach(id => {
    const el = $(id);
    if (!el || state[id] == null) return;
    if (el.tagName === "SELECT" && ![...el.options].some(opt => opt.value === state[id])) return;
    el.value = state[id];
  });
  updateTrainRangeText();
}

function setTrainRunMessage(message) {
  const el = $("trainRunMessage");
  if (el) el.textContent = message || "";
}

function trainEmptyState(message) {
  destroyDataGrid();
  disposeCharts();
  trainCompareViewsKey = "";
  trainLossViewsKey = "";
  trainOptimizationViewsKey = "";
  trainCustomViewsKey = "";
  $("main").innerHTML = `
    <div class="empty-state">
      ${escapeHtml(message || "\u8bf7\u5148\u5728\u201c\u6570\u636e\u9884\u5904\u7406\u201d\u9875\u52a0\u8f7d\u6570\u636e\u96c6\uff0c\u7136\u540e\u518d\u8fdb\u884c\u6a21\u578b\u8bad\u7ec3\u3002")}
    </div>`;
  if ($("epochNow")) $("epochNow").textContent = "--";
  if ($("lossNow")) $("lossNow").textContent = "--";
  if ($("stdLossNow")) $("stdLossNow").textContent = "--";
  if ($("rawLossNow")) $("rawLossNow").textContent = "--";
  if ($("wNow")) $("wNow").textContent = "--";
  if ($("bNow")) $("bNow").textContent = "--";
  if ($("dwNow")) $("dwNow").textContent = "--";
  if ($("dbNow")) $("dbNow").textContent = "--";
}

function restoreTrainView() {
  restoreTrainFormState();
  if ($("sampleCount")) $("sampleCount").textContent = trainData?.scatter?.x?.length ?? "--";
  if ($("featureCount")) $("featureCount").textContent = currentDatasetMeta?.features?.length ?? FEATURE_NAMES.length;
  if (trainData?.feature && $("topFeature")) $("topFeature").textContent = `\u5f53\u524d\u7279\u5f81 ${trainData.feature}`;
  if (activeTrainStep === "process") renderTrainProcessFrame(currentFrame);
  else if (activeTrainStep === "loss") renderTrainLossFrame(currentFrame);
  else if (activeTrainStep === "optimization") renderTrainOptimizationFrame(currentFrame);
  else if (activeTrainStep === "custom") renderTrainCustomFrame(currentFrame);
  else renderTrainFrame(currentFrame);
}

async function prepareTraining() {
  currentDatasetMeta = currentDatasetMeta || viewStateStore.currentDatasetMetaV1 || null;
  if (!currentDatasetMeta) {
    trainEmptyState("\u8bf7\u5148\u5728\u201c\u6570\u636e\u9884\u5904\u7406\u201d\u9875\u52a0\u8f7d\u6570\u636e\u96c6\uff0c\u6a21\u578b\u8bad\u7ec3\u4f1a\u4f7f\u7528\u8be5\u6570\u636e\u96c6\u7684\u7279\u5f81\u548c\u76ee\u6807\u503c\u3002");
    return;
  }
  stopAuto();
  persistTrainFormState();
  const feature = $("trainFeature").value;
  if ($("topFeature")) $("topFeature").textContent = `\u5f53\u524d\u7279\u5f81 ${feature}`;
  try {
    trainData = await runAction("prepare_train", {
      feature,
      dataset_id: currentDatasetMeta?.dataset_id || "boston_housing",
      use_standardized: trainUseStandardized(),
      learning_rate: Number($("lr").value),
      epochs: Number($("epochs").value),
      w0: Number($("w0").value),
      b0: Number($("b0").value)
    });
    if ($("sampleCount")) $("sampleCount").textContent = trainData.scatter.x.length;
    if ($("featureCount")) $("featureCount").textContent = currentDatasetMeta?.features?.length ?? FEATURE_NAMES.length;
    currentFrame = 0;
    setTrainRunMessage(trainStepHint());
    if (activeTrainStep === "process") renderTrainProcessFrame(0);
    else if (activeTrainStep === "loss") renderTrainLossFrame(0);
    else if (activeTrainStep === "optimization") renderTrainOptimizationFrame(0);
    else if (activeTrainStep === "custom") renderTrainCustomFrame(0);
    else renderTrainFrame(0);
  } catch (err) {
    console.warn("Training preparation skipped:", err);
    trainEmptyState("\u8bf7\u5148\u5728\u201c\u6570\u636e\u9884\u5904\u7406\u201d\u9875\u52a0\u8f7d\u6570\u636e\u96c6\uff0c\u7136\u540e\u56de\u5230\u6a21\u578b\u8bad\u7ec3\u9875\u5f00\u59cb\u8bad\u7ec3\u3002");
  }
}

async function prepareTrainCompare() {
  currentDatasetMeta = currentDatasetMeta || viewStateStore.currentDatasetMetaV1 || null;
  if (!currentDatasetMeta) {
    trainEmptyState("\u8bf7\u5148\u5728\u201c\u6570\u636e\u9884\u5904\u7406\u201d\u9875\u52a0\u8f7d\u6570\u636e\u96c6\uff0c\u9884\u5904\u7406\u5bf9\u6bd4\u4f1a\u5728\u6570\u636e\u51c6\u5907\u597d\u540e\u663e\u793a\u3002");
    return;
  }
  stopAuto();
  persistTrainFormState();
  const feature = $("trainFeature").value;
  const payload = {
    feature,
    dataset_id: currentDatasetMeta?.dataset_id || "boston_housing",
    learning_rate: Number($("lr").value),
    epochs: Number($("epochs").value),
    w0: Number($("w0").value),
    b0: Number($("b0").value)
  };
  if ($("topFeature")) $("topFeature").textContent = `\u5f53\u524d\u7279\u5f81 ${feature}`;
  let raw = null;
  let standard = null;
  try {
    [raw, standard] = await Promise.all([
      runAction("prepare_train", { ...payload, use_standardized: false }),
      runAction("prepare_train", { ...payload, use_standardized: true }),
    ]);
  } catch (err) {
    console.warn("Training comparison preparation skipped:", err);
    trainEmptyState("\u8bf7\u5148\u5728\u201c\u6570\u636e\u9884\u5904\u7406\u201d\u9875\u52a0\u8f7d\u6570\u636e\u96c6\uff0c\u7136\u540e\u56de\u5230\u8fd9\u91cc\u89c2\u5bdf\u539f\u59cb\u7279\u5f81\u548c\u6807\u51c6\u5316\u7279\u5f81\u7684\u8bad\u7ec3\u5dee\u5f02\u3002");
    return;
  }
  trainCompareData = { raw, standard };
  trainData = standard;
  currentFrame = 0;
  setTrainRunMessage(trainStepHint());
  try {
    renderTrainCompareFrame(0);
  } catch (err) {
    console.warn("Train compare render fallback:", err);
    trainCompareViewsKey = "";
    renderTrainCompareFrame(0);
  }
}

function renderTrainProcessFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  if ($("epochNow")) $("epochNow").textContent = frame.epoch;
  if ($("stdLossNow")) $("stdLossNow").textContent = Number(frame.loss).toFixed(4);
  renderTrainProcessMain();
}

function renderTrainProcessMain() {
  const grid = ensureTrainProcessGrid();
  const viewsKey = "standard_scatter";
  if (trainCompareViewsKey !== viewsKey || !charts.get("chart_process_standard_scatter")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "train_process";
    grid.innerHTML = `
      <div class="grid-stack-item" data-view="process_standard_scatter" gs-x="0" gs-y="0" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
        <div class="grid-stack-item-content">${chartCardHtml("process_standard_scatter", "\u6807\u51c6\u5316\u6563\u70b9\u56fe", "\u6807\u51c6\u5316\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b", "")}</div>
      </div>`;
    if (window.GridStack) {
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
      dataGrid.on("change dragstop resizestop", () => {
        syncDataGridAttributes();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      });
      syncDataGridAttributes();
    }
    trainCompareViewsKey = viewsKey;
  }
  const ch = charts.get("chart_process_standard_scatter") || initChart("chart_process_standard_scatter");
  ch.setOption(trainProcessScatterOption(), true);
  requestAnimationFrame(() => charts.forEach(chart => chart.resize()));
}

function ensureTrainProcessGrid() {
  if (!$("trainProcessWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="trainProcessWrap"></div>`;
    trainCompareViewsKey = "";
  }
  return $("trainProcessWrap");
}

function trainProcessScatterOption() {
  const frame = trainData.history[currentFrame];
  const points = trainData.scatter.x.map((x, i) => [x, trainData.scatter.y[i]]);
  const currentLine = lineForParams(frame.w, frame.b);
  const bestLine = lineForParams(trainData.best.w, trainData.best.b);
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: trainData.x_column, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: trainData.target || "MEDV", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(15,159,120,.62)" } },
      { name: "\u5f53\u524d\u56de\u5f52\u7ebf", type: "line", data: currentLine, showSymbol: false, lineStyle: { color: "#d9354f", width: 3 } },
      { name: "\u6700\u4f18\u53c2\u8003\u7ebf", type: "line", data: bestLine, showSymbol: false, lineStyle: { color: "#0f9f78", width: 2.6, type: "dashed" } }
    ]
  };
}

function renderTrainOptimizationFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  if ($("epochNow")) $("epochNow").textContent = frame.epoch;
  if ($("dwNow")) $("dwNow").textContent = num(frame.dw, 4);
  if ($("dbNow")) $("dbNow").textContent = num(frame.db, 4);
  if ($("lossNow")) $("lossNow").textContent = Number(frame.mse ?? frame.loss).toFixed(4);
  renderTrainOptimizationMain();
}

function renderTrainOptimizationMain() {
  const grid = ensureTrainOptimizationGrid();
  const viewsKey = trainOptimizationSliceMode();
  if (trainOptimizationViewsKey !== viewsKey || !charts.get("chart_opt_contour") || !charts.get("chart_opt_slice") || !charts.get("chart_opt_loss") || !charts.get("chart_loss_surface_3d")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "train_optimization";
    grid.innerHTML = trainOptimizationGridHtml();
    if (window.GridStack) {
      dataGrid = GridStack.init({
        column: 4,
        cellHeight: 250,
        margin: 8,
        float: true,
        animate: true,
        draggable: { handle: ".chart-head" },
        resizable: { handles: "e, s, se" }
      }, grid);
      grid.setAttribute("gs-column", "4");
      updateDataGridCellHeight();
      dataGrid.on("change dragstop resizestop", () => {
        syncDataGridAttributes();
        saveDataGridLayout();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      });
      syncDataGridAttributes();
    }
    bindTrainOptimizationControls();
    trainOptimizationViewsKey = viewsKey;
  }

  const contour = charts.get("chart_opt_contour") || initChart("chart_opt_contour");
  contour.setOption(trainOptimizationContourOption(), true);

  const slice = charts.get("chart_opt_slice") || initChart("chart_opt_slice");
  slice.setOption(trainOptimizationSliceOption(), true);

  const loss = charts.get("chart_opt_loss") || initChart("chart_opt_loss");
  loss.setOption(trainOptimizationLossOption(), true);

  const surface = charts.get("chart_loss_surface_3d") || initChart("chart_loss_surface_3d");
  surface.setOption(lossSurface3DOption(currentFrame), false);
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function ensureTrainOptimizationGrid() {
  if (!$("trainOptimizationWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="trainOptimizationWrap"></div>`;
    trainOptimizationViewsKey = "";
  }
  return $("trainOptimizationWrap");
}

function trainOptimizationGridHtml() {
  return `
    <div class="grid-stack-item" data-view="opt_contour" gs-x="0" gs-y="0" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainOptimizationContourCardHtml()}</div>
    </div>
    <div class="grid-stack-item" data-view="opt_slice" gs-x="2" gs-y="0" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainOptimizationSliceCardHtml()}</div>
    </div>
    <div class="grid-stack-item" data-view="opt_loss" gs-x="0" gs-y="2" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainOptimizationLossCardHtml()}</div>
    </div>
    <div class="grid-stack-item" data-view="opt_surface_3d" gs-x="2" gs-y="2" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainOptimizationSurfaceCardHtml()}</div>
    </div>`;
}

function trainOptimizationContourCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="opt_contour">
    <div class="chart-head">
      <div><div class="chart-title">Loss \u7b49\u9ad8\u7ebf\u56fe</div><div class="chart-sub">J(w,b) \u5728\u53c2\u6570\u7a7a\u95f4\u4e2d\u7684\u5206\u5e03</div></div>
    </div>
    <div class="chart-toolbar">
      <div class="legend-strip">
        <span><i style="background:#ef4444"></i>\u5f53\u524d\u53c2\u6570</span>
        <span><i style="background:#16a34a"></i>-\u2207J \u4e0b\u964d\u65b9\u5411</span>
        <span><i style="background:#dc2626"></i>\u2207J \u68af\u5ea6\u65b9\u5411</span>
        <span><i style="background:#2563eb"></i>\u66f4\u65b0\u8f68\u8ff9</span>
      </div>
    </div>
    <div class="chart" id="chart_opt_contour"></div>
  </section>`;
}

function trainOptimizationSliceCardHtml() {
  const mode = trainOptimizationSliceMode();
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="opt_slice">
    <div class="chart-head">
      <div><div class="chart-title">\u5207\u9762\u56fe</div><div class="chart-sub">\u89c2\u5bdf\u5f53\u524d\u70b9\u9644\u8fd1 Loss \u7684\u5761\u5ea6\u53d8\u5316</div></div>
    </div>
    <div class="chart-toolbar">
      <div class="segmented-control" role="group" aria-label="\u5207\u9762\u9009\u62e9">
        ${TRAIN_OPT_SLICE_MODES.map(item => `<button class="seg-btn${item.id === mode ? " active" : ""}" type="button" data-opt-slice-mode="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
    <div class="chart" id="chart_opt_slice"></div>
  </section>`;
}

function trainOptimizationLossCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="opt_loss">
    <div class="chart-head">
      <div><div class="chart-title">MSE Loss \u968f epoch \u7684\u53d8\u5316</div><div class="chart-sub">\u89c2\u5bdf\u4f18\u5316\u8fc7\u7a0b\u4e2d\u7684 Loss \u4e0b\u964d\u8d8b\u52bf</div></div>
    </div>
    <div class="chart" id="chart_opt_loss"></div>
  </section>`;
}

function trainOptimizationSurfaceCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="opt_surface_3d">
    <div class="chart-head">
      <div><div class="chart-title">3D Loss \u66f2\u9762\u56fe</div><div class="chart-sub">\u611f\u53d7 J(w,b) \u50cf\u4e00\u4e2a\u53c2\u6570\u7a7a\u95f4\u4e2d\u7684\u7897\u5f62\u66f2\u9762</div></div>
    </div>
    <div class="chart" id="chart_loss_surface_3d"></div>
  </section>`;
}

function bindTrainOptimizationControls() {
  document.querySelectorAll("[data-opt-slice-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      viewStateStore.trainOptimizationSliceModeV1 = btn.dataset.optSliceMode;
      trainOptimizationViewsKey = "";
      renderTrainOptimizationFrame(currentFrame);
    });
  });
}

function trainOptimizationContourOption() {
  const c = trainData.contour;
  const frame = trainData.history[currentFrame];
  const best = trainData.best;
  const path = trainData.history.slice(0, currentFrame + 1).map(row => [row.w, row.b]);
  const next = trainOptimizationNextParams(frame);
  const vectorScale = trainOptimizationVectorScale(frame, c);
  const gradEnd = [frame.w + frame.dw * vectorScale, frame.b + frame.db * vectorScale];
  const negEnd = [frame.w - frame.dw * vectorScale, frame.b - frame.db * vectorScale];
  return {
    tooltip: {
      trigger: "item",
      formatter: p => {
        const value = Array.isArray(p.value) ? p.value : [];
        if (p.seriesName === "\u5f53\u524d\u53c2\u6570") return `w=${num(frame.w, 4)}<br>b=${num(frame.b, 4)}<br>MSE=${num(frame.mse ?? frame.loss, 4)}`;
        if (p.seriesName === "\u4e0b\u4e00\u6b65\u53c2\u6570") return `w_new=${num(next.w, 4)}<br>b_new=${num(next.b, 4)}`;
        if (p.seriesName === "\u6700\u4f18\u53c2\u8003") return `w*=${num(best.w, 4)}<br>b*=${num(best.b, 4)}`;
        if (value.length >= 2) return `${escapeHtml(p.seriesName)}<br>w=${num(value[0], 4)}<br>b=${num(value[1], 4)}`;
        return escapeHtml(p.seriesName);
      }
    },
    grid: { left: 58, right: 28, top: 36, bottom: 48 },
    xAxis: { type: "value", name: "w", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: "b", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      ...lossContourSeries(c),
      {
        name: "\u66f4\u65b0\u8f68\u8ff9",
        type: "line",
        data: path,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#2563eb", width: 2.8, type: "dashed" },
        itemStyle: { color: "#fff", borderColor: "#2563eb", borderWidth: 1.5 },
        z: 8
      },
      {
        name: "\u2207J \u68af\u5ea6\u65b9\u5411",
        type: "lines",
        coordinateSystem: "cartesian2d",
        symbol: ["none", "arrow"],
        symbolSize: 10,
        data: [{ coords: [[frame.w, frame.b], gradEnd] }],
        lineStyle: { color: "#dc2626", width: 2.8 },
        z: 10
      },
      {
        name: "-\u2207J \u4e0b\u964d\u65b9\u5411",
        type: "lines",
        coordinateSystem: "cartesian2d",
        symbol: ["none", "arrow"],
        symbolSize: 10,
        data: [{ coords: [[frame.w, frame.b], negEnd] }],
        lineStyle: { color: "#16a34a", width: 2.8 },
        z: 10
      },
      {
        name: "\u5f53\u524d\u53c2\u6570",
        type: "scatter",
        data: [[frame.w, frame.b]],
        symbolSize: 16,
        itemStyle: { color: "#ef4444", borderColor: "#fff", borderWidth: 3 },
        z: 12
      },
      {
        name: "\u4e0b\u4e00\u6b65\u53c2\u6570",
        type: "scatter",
        data: [[next.w, next.b]],
        symbolSize: 13,
        itemStyle: { color: "#2563eb", borderColor: "#fff", borderWidth: 2 },
        z: 11
      },
      {
        name: "\u6700\u4f18\u53c2\u8003",
        type: "scatter",
        data: [[best.w, best.b]],
        symbol: "diamond",
        symbolSize: 15,
        itemStyle: { color: "#0f9f78", borderColor: "#fff", borderWidth: 2 },
        z: 9
      }
    ]
  };
}

function trainOptimizationSliceOption() {
  const mode = trainOptimizationSliceMode();
  if (mode === "b") return trainOptimizationAxisSliceOption("b");
  if (mode === "neg_grad") return trainOptimizationDirectionSliceOption();
  return trainOptimizationAxisSliceOption("w");
}

function trainOptimizationAxisSliceOption(axis) {
  const frame = trainData.history[currentFrame];
  const c = trainData.contour;
  const next = trainOptimizationNextParams(frame);
  const values = axis === "w" ? c.w_axis : c.b_axis;
  const fixedValue = axis === "w" ? frame.b : frame.w;
  const data = values.map(value => axis === "w"
    ? [value, mseAtParams(value, fixedValue)]
    : [value, mseAtParams(fixedValue, value)]);
  const currentX = axis === "w" ? frame.w : frame.b;
  const nextX = axis === "w" ? next.w : next.b;
  const slope = axis === "w" ? frame.dw : frame.db;
  const span = Math.max(...values) - Math.min(...values);
  const delta = Math.max(span * 0.12, 0.2);
  const currentY = Number(frame.mse ?? frame.loss);
  const tangent = [
    [currentX - delta, currentY - slope * delta],
    [currentX + delta, currentY + slope * delta]
  ];
  const title = axis === "w" ? `J(w, ${num(frame.b, 2)})` : `J(${num(frame.w, 2)}, b)`;
  const subtitle = axis === "w" ? `\u56fa\u5b9a b=${num(frame.b, 3)}\uff0c\u53ea\u89c2\u5bdf w \u65b9\u5411\u7684\u5761\u5ea6` : `\u56fa\u5b9a w=${num(frame.w, 3)}\uff0c\u53ea\u89c2\u5bdf b \u65b9\u5411\u7684\u5761\u5ea6`;
  return trainOptimizationSliceBaseOption({
    title,
    subtitle,
    xName: axis,
    yName: "MSE",
    data,
    tangent,
    current: [currentX, currentY],
    next: [nextX, axis === "w" ? mseAtParams(nextX, frame.b) : mseAtParams(frame.w, nextX)],
    slopeName: axis === "w" ? "\u2202J/\u2202w" : "\u2202J/\u2202b",
    slope
  });
}

function trainOptimizationDirectionSliceOption() {
  const frame = trainData.history[currentFrame];
  const norm = Math.hypot(frame.dw, frame.db);
  const dirW = norm > 1e-9 ? -frame.dw / norm : 0;
  const dirB = norm > 1e-9 ? -frame.db / norm : 0;
  const c = trainData.contour;
  const wSpan = Math.max(...c.w_axis) - Math.min(...c.w_axis);
  const bSpan = Math.max(...c.b_axis) - Math.min(...c.b_axis);
  const range = Math.max(0.8, Math.min(wSpan || 2, bSpan || 2) * 0.35);
  const count = 80;
  const data = Array.from({ length: count }, (_, index) => {
    const lambda = -range + (2 * range * index) / (count - 1);
    return [lambda, mseAtParams(frame.w + lambda * dirW, frame.b + lambda * dirB)];
  });
  const currentY = Number(frame.mse ?? frame.loss);
  const nextLambda = Number($("lr")?.value || TRAIN_STEP_DEFAULTS.optimization.lr) * norm;
  const delta = range * 0.22;
  const slope = -norm;
  return trainOptimizationSliceBaseOption({
    title: "J(\u03b8 + \u03bbd)",
    subtitle: "\u6cbf\u8d1f\u68af\u5ea6\u65b9\u5411\u5207\u4e00\u5200\uff0c\u770b\u4e00\u6b65\u4e4b\u5185 Loss \u5982\u4f55\u53d8\u5316",
    xName: "\u03bb",
    yName: "MSE",
    data,
    tangent: [[-delta, currentY - slope * delta], [delta, currentY + slope * delta]],
    current: [0, currentY],
    next: [nextLambda, mseAtParams(frame.w + nextLambda * dirW, frame.b + nextLambda * dirB)],
    slopeName: "\u65b9\u5411\u5bfc\u6570",
    slope
  });
}

function trainOptimizationSliceBaseOption(config) {
  return {
    title: {
      text: config.title,
      subtext: config.subtitle,
      left: 10,
      top: 4,
      textStyle: { fontSize: 13, fontWeight: 800, color: "#172033" },
      subtextStyle: { fontSize: 11, color: "#6b7280" }
    },
    tooltip: {
      trigger: "item",
      formatter: p => {
        const value = Array.isArray(p.value) ? p.value : [];
        if (p.seriesName === "\u5f53\u524d\u70b9") return `${config.slopeName} = ${num(config.slope, 4)}<br>${config.xName}=${num(value[0], 4)}<br>MSE=${num(value[1], 4)}`;
        if (value.length >= 2) return `${escapeHtml(p.seriesName)}<br>${config.xName}=${num(value[0], 4)}<br>MSE=${num(value[1], 4)}`;
        return escapeHtml(p.seriesName);
      }
    },
    legend: { top: 44 },
    grid: { left: 58, right: 24, top: 78, bottom: 46 },
    xAxis: { type: "value", name: config.xName, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: config.yName, nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "Loss \u5207\u9762", type: "line", data: config.data, showSymbol: false, smooth: true, lineStyle: { color: "#2563eb", width: 2.8 } },
      { name: "\u5f53\u524d\u5207\u7ebf", type: "line", data: config.tangent, showSymbol: false, lineStyle: { color: "#ef4444", width: 2.2, type: "dashed" } },
      { name: "\u5f53\u524d\u70b9", type: "scatter", data: [config.current], symbolSize: 14, itemStyle: { color: "#ef4444", borderColor: "#fff", borderWidth: 2 }, z: 5 },
      { name: "\u66f4\u65b0\u540e", type: "scatter", data: [config.next], symbolSize: 12, itemStyle: { color: "#16a34a", borderColor: "#fff", borderWidth: 2 }, z: 5 }
    ]
  };
}

function trainOptimizationLossOption() {
  const rows = trainData.history.slice(0, currentFrame + 1);
  const current = trainData.history[currentFrame];
  return {
    tooltip: { trigger: "axis" },
    legend: { top: 10 },
    grid: { left: 58, right: 24, top: 48, bottom: 46 },
    xAxis: { type: "value", name: "epoch", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: "MSE", nameLocation: "middle", nameGap: 40 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      {
        name: "MSE Loss",
        type: "line",
        data: rows.map(row => [row.epoch, row.mse ?? row.loss]),
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: "#5b35f5", width: 3 },
        areaStyle: { color: "#5b35f522" }
      },
      {
        name: "\u5f53\u524d epoch",
        type: "scatter",
        data: [[current.epoch, current.mse ?? current.loss]],
        symbolSize: 13,
        itemStyle: { color: "#ef4444", borderColor: "#fff", borderWidth: 2 },
        z: 5
      }
    ]
  };
}

function trainOptimizationVectorScale(frame, c) {
  const norm = Math.hypot(frame.dw, frame.db);
  if (!Number.isFinite(norm) || norm <= 1e-9) return 0;
  const wSpan = Math.max(...c.w_axis) - Math.min(...c.w_axis);
  const bSpan = Math.max(...c.b_axis) - Math.min(...c.b_axis);
  return Math.min(wSpan || 1, bSpan || 1) * 0.18 / norm;
}

function trainOptimizationNextParams(frame) {
  const fallbackLr = Number($("lr")?.value || TRAIN_STEP_DEFAULTS.optimization.lr);
  return {
    w: Number.isFinite(Number(frame.new_w)) ? Number(frame.new_w) : frame.w - fallbackLr * frame.dw,
    b: Number.isFinite(Number(frame.new_b)) ? Number(frame.new_b) : frame.b - fallbackLr * frame.db
  };
}

function renderTrainCustomFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  if ($("epochNow")) $("epochNow").textContent = frame.epoch;
  if ($("lossNow")) $("lossNow").textContent = Number(frame.mse ?? frame.loss).toFixed(4);
  if ($("wNow")) $("wNow").textContent = num(frame.w, 4);
  if ($("bNow")) $("bNow").textContent = num(frame.b, 4);
  renderTrainCustomMain();
}

function renderTrainCustomMain() {
  const grid = ensureTrainCustomGrid();
  const viewsKey = "custom_fixed_v1";
  if (trainCustomViewsKey !== viewsKey || !charts.get("chart_custom_standard_scatter") || !charts.get("chart_custom_loss") || !charts.get("chart_custom_w_path") || !charts.get("chart_custom_b_path") || !$("customCalcCard")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "train_custom";
    grid.innerHTML = trainCustomGridHtml();
    if (window.GridStack) {
      dataGrid = GridStack.init({
        column: 4,
        cellHeight: 250,
        margin: 8,
        float: true,
        animate: true,
        draggable: { handle: ".chart-head" },
        resizable: { handles: "e, s, se" }
      }, grid);
      grid.setAttribute("gs-column", "4");
      updateDataGridCellHeight();
      dataGrid.on("change dragstop resizestop", () => {
        syncDataGridAttributes();
        saveDataGridLayout();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      });
      syncDataGridAttributes();
    }
    trainCustomViewsKey = viewsKey;
  }

  const scatter = charts.get("chart_custom_standard_scatter") || initChart("chart_custom_standard_scatter");
  scatter.setOption(trainCustomScatterOption(), true);

  const loss = charts.get("chart_custom_loss") || initChart("chart_custom_loss");
  loss.setOption(trainCustomLossOption(), true);

  const wPath = charts.get("chart_custom_w_path") || initChart("chart_custom_w_path");
  wPath.setOption(trainCustomParamPathOption("w"), true);

  const bPath = charts.get("chart_custom_b_path") || initChart("chart_custom_b_path");
  bPath.setOption(trainCustomParamPathOption("b"), true);

  updateTrainCustomCalcCard();
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function ensureTrainCustomGrid() {
  if (!$("trainCustomWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="trainCustomWrap"></div>`;
    trainCustomViewsKey = "";
  }
  return $("trainCustomWrap");
}

function trainCustomGridHtml() {
  const saved = loadTrainGridLayout();
  const items = [
    { id: "custom_standard_scatter", layout: { x: 0, y: 0, w: 2, h: 2 }, html: chartCardHtml("custom_standard_scatter", "\u6807\u51c6\u5316\u6563\u70b9\u56fe", "\u6807\u51c6\u5316\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b", "") },
    { id: "custom_loss", layout: { x: 2, y: 0, w: 2, h: 2 }, html: chartCardHtml("custom_loss", "MSE Loss \u968f epoch \u7684\u53d8\u5316", "\u89c2\u5bdf\u4f18\u5316\u8fc7\u7a0b\u4e2d\u7684 Loss \u4e0b\u964d\u8d8b\u52bf", "") },
    { id: "custom_w_path", layout: { x: 0, y: 2, w: 2, h: 2 }, html: chartCardHtml("custom_w_path", "w \u53c2\u6570\u8f68\u8ff9\u56fe", "\u89c2\u5bdf w \u5728\u8bad\u7ec3\u4e2d\u5982\u4f55\u66f4\u65b0", "") },
    { id: "custom_b_path", layout: { x: 2, y: 2, w: 2, h: 2 }, html: chartCardHtml("custom_b_path", "b \u53c2\u6570\u8f68\u8ff9\u56fe", "\u89c2\u5bdf b \u5728\u8bad\u7ec3\u4e2d\u5982\u4f55\u66f4\u65b0", "") },
    { id: "custom_calc", layout: { x: 0, y: 4, w: 4, h: 4 }, html: `<div id="customCalcCard" style="height:100%"></div>` },
  ];
  return items.map(item => {
    const layout = normalizeTrainGridLayout(item.id, saved[item.id] || item.layout);
    return `<div class="grid-stack-item" data-view="${escapeHtml(item.id)}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${item.html}</div></div>`;
  }).join("");
}

function trainCustomScatterOption() {
  const frame = trainData.history[currentFrame];
  const points = trainData.scatter.x.map((x, i) => [x, trainData.scatter.y[i]]);
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: trainData.x_column, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: trainData.target || "MEDV", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(15,159,120,.62)" } },
      { name: "\u5f53\u524d\u56de\u5f52\u7ebf", type: "line", data: lineForParams(frame.w, frame.b), showSymbol: false, lineStyle: { color: "#d9354f", width: 3 } },
      { name: "\u6700\u4f18\u53c2\u8003\u7ebf", type: "line", data: lineForParams(trainData.best.w, trainData.best.b), showSymbol: false, lineStyle: { color: "#0f9f78", width: 2.6, type: "dashed" } }
    ]
  };
}

function trainCustomLossOption() {
  const rows = trainData.history.slice(0, currentFrame + 1);
  const current = trainData.history[currentFrame];
  return {
    tooltip: { trigger: "axis" },
    legend: { top: 10 },
    grid: { left: 58, right: 24, top: 48, bottom: 46 },
    xAxis: { type: "value", name: "epoch", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: "MSE", nameLocation: "middle", nameGap: 40 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "MSE Loss", type: "line", data: rows.map(row => [row.epoch, row.mse ?? row.loss]), smooth: true, symbolSize: 5, lineStyle: { color: "#5b35f5", width: 3 }, areaStyle: { color: "#5b35f522" } },
      { name: "\u5f53\u524d epoch", type: "scatter", data: [[current.epoch, current.mse ?? current.loss]], symbolSize: 13, itemStyle: { color: "#ef4444", borderColor: "#fff", borderWidth: 2 }, z: 5 }
    ]
  };
}

function trainCustomParamPathOption(key) {
  const rows = trainData.history.slice(0, currentFrame + 1);
  const current = trainData.history[currentFrame];
  const color = key === "w" ? "#0f9f78" : "#c47a11";
  return {
    tooltip: { trigger: "axis" },
    legend: { top: 10 },
    grid: { left: 58, right: 24, top: 48, bottom: 46 },
    xAxis: { type: "value", name: "epoch", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: key, nameLocation: "middle", nameGap: 36 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: `${key} \u53c2\u6570`, type: "line", data: rows.map(row => [row.epoch, row[key]]), smooth: true, symbolSize: 5, lineStyle: { color, width: 3 }, areaStyle: { color: color + "20" } },
      { name: "\u5f53\u524d\u503c", type: "scatter", data: [[current.epoch, current[key]]], symbolSize: 13, itemStyle: { color: "#ef4444", borderColor: "#fff", borderWidth: 2 }, z: 5 }
    ]
  };
}

function updateTrainCustomCalcCard() {
  const slot = $("customCalcCard");
  if (!slot) return;
  slot.innerHTML = trainInfoHtml("calc", trainData.history[currentFrame], { frame: trainData.history[currentFrame], best: trainData.best, learning_rate: trainData.learning_rate, sample_count: trainData.scatter?.x?.length });
}

function renderTrainLossFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  if ($("epochNow")) $("epochNow").textContent = frame.epoch;
  if ($("lossNow")) $("lossNow").textContent = Number(frame.mse ?? frame.loss).toFixed(4);
  renderTrainLossMain();
}

function renderTrainLossMain() {
  const grid = ensureTrainLossGrid();
  const viewsKey = `${trainLossResidualMode()}|${trainLossOverallView()}`;
  if (trainLossViewsKey !== viewsKey || !charts.get("chart_loss_residual_main") || !charts.get("chart_loss_overall")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "train_loss";
    grid.innerHTML = trainLossGridHtml();
    if (window.GridStack) {
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
      dataGrid.on("change dragstop resizestop", () => {
        syncDataGridAttributes();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      });
      syncDataGridAttributes();
    }
    bindTrainLossControls();
    trainLossViewsKey = viewsKey;
  }

  const residualChart = charts.get("chart_loss_residual_main") || initChart("chart_loss_residual_main");
  residualChart.setOption(trainLossResidualOption(), true);
  residualChart.off("click");
  residualChart.on("click", params => {
    if (params.seriesName !== "\u6837\u672c\u70b9") return;
    setTrainLossSampleIndex(params.dataIndex);
    viewStateStore.trainLossResidualModeV1 = "single";
    trainLossViewsKey = "";
    renderTrainLossFrame(currentFrame);
  });

  const overallChart = charts.get("chart_loss_overall") || initChart("chart_loss_overall");
  overallChart.setOption(trainLossOverallOption(), true);
  updateTrainLossSampleNote();
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function ensureTrainLossGrid() {
  if (!$("trainLossWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="trainLossWrap"></div>`;
    trainLossViewsKey = "";
  }
  return $("trainLossWrap");
}

function trainLossGridHtml() {
  return `
    <div class="grid-stack-item" data-view="loss_residual_main" gs-x="0" gs-y="0" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainLossResidualCardHtml()}</div>
    </div>
    <div class="grid-stack-item" data-view="loss_overall" gs-x="2" gs-y="0" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1">
      <div class="grid-stack-item-content">${trainLossOverallCardHtml()}</div>
    </div>`;
}

function trainLossResidualCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="loss_residual_main">
    <div class="chart-head">
      <div><div class="chart-title">\u6b8b\u5dee\u4e0e\u56de\u5f52\u7ebf</div><div class="chart-sub">\u5c40\u90e8\u7528\u6b8b\u5dee\u7ebf\u89e3\u91ca\u5355\u4e2a\u6216\u5c11\u91cf\u6837\u672c\u7684\u9884\u6d4b\u8bef\u5dee</div></div>
    </div>
    <div class="chart-toolbar" data-loss-toolbar="residual">
      <div class="segmented-control" role="group" aria-label="\u6b8b\u5dee\u663e\u793a">
        ${TRAIN_LOSS_RESIDUAL_MODES.map(item => `<button class="seg-btn${item.id === trainLossResidualMode() ? " active" : ""}" type="button" data-loss-residual-mode="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
      <div class="sample-nav">
        <button class="mini-action" type="button" data-loss-sample-step="-1">\u4e0a\u4e00\u4e2a</button>
        <button class="mini-action" type="button" data-loss-sample-step="1">\u4e0b\u4e00\u4e2a</button>
        <button class="mini-action" type="button" data-loss-random-sample="1">\u968f\u673a</button>
      </div>
    </div>
    <div class="chart" id="chart_loss_residual_main"></div>
    <div class="loss-sample-note" id="lossSampleNote"></div>
  </section>`;
}

function trainLossOverallCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="loss_overall">
    <div class="chart-head">
      <div><div class="chart-title">\u6574\u4f53\u8bef\u5dee\u5206\u5e03</div><div class="chart-sub">\u6574\u4f53\u4e0d\u753b\u6ee1\u5c4f\u6b8b\u5dee\u7ebf\uff0c\u6539\u7528\u7edf\u8ba1\u89c6\u56fe\u7406\u89e3 MSE</div></div>
    </div>
    <div class="chart-toolbar">
      <div class="segmented-control" role="group" aria-label="\u6574\u4f53\u8bef\u5dee\u89c6\u56fe">
        ${TRAIN_LOSS_OVERALL_VIEWS.map(item => `<button class="seg-btn${item.id === trainLossOverallView() ? " active" : ""}" type="button" data-loss-overall-view="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
    <div class="chart" id="chart_loss_overall"></div>
    <div class="loss-formula-note">MSE = mean((y - \u0177)^2) = <strong id="lossFormulaMse">${escapeHtml(Number(trainData?.history?.[currentFrame]?.mse ?? trainData?.history?.[currentFrame]?.loss ?? 0).toFixed(4))}</strong></div>
  </section>`;
}

function bindTrainLossControls() {
  document.querySelectorAll("[data-loss-residual-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      viewStateStore.trainLossResidualModeV1 = btn.dataset.lossResidualMode;
      trainLossViewsKey = "";
      renderTrainLossFrame(currentFrame);
    });
  });
  document.querySelectorAll("[data-loss-overall-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      viewStateStore.trainLossOverallViewV1 = btn.dataset.lossOverallView;
      trainLossViewsKey = "";
      renderTrainLossFrame(currentFrame);
    });
  });
  document.querySelectorAll("[data-loss-sample-step]").forEach(btn => {
    btn.addEventListener("click", () => {
      setTrainLossSampleIndex(trainLossSampleIndex() + Number(btn.dataset.lossSampleStep || 0));
      viewStateStore.trainLossResidualModeV1 = "single";
      trainLossViewsKey = "";
      renderTrainLossFrame(currentFrame);
    });
  });
  document.querySelector("[data-loss-random-sample]")?.addEventListener("click", () => {
    const count = trainData?.scatter?.x?.length || 0;
    if (count) setTrainLossSampleIndex(Math.floor(Math.random() * count));
    viewStateStore.trainLossResidualModeV1 = "single";
    trainLossViewsKey = "";
    renderTrainLossFrame(currentFrame);
  });
}

function trainLossRows(frame = trainData?.history?.[currentFrame]) {
  const xs = trainData?.scatter?.x || [];
  const ys = trainData?.scatter?.y || [];
  return xs.map((x, index) => {
    const y = ys[index];
    const yhat = frame.w * x + frame.b;
    const residual = y - yhat;
    return { index, x, y, yhat, residual, squared: residual * residual };
  });
}

function lineForParams(w, b) {
  const xs = trainData?.line_x?.length
    ? trainData.line_x
    : [Math.min(...(trainData?.scatter?.x || [0])), Math.max(...(trainData?.scatter?.x || [1]))];
  return xs.map(x => [x, w * x + b]);
}

function trainLossCurrentSample(frame = trainData?.history?.[currentFrame]) {
  const rows = trainLossRows(frame);
  return rows[trainLossSampleIndex()] || null;
}

function trainLossResidualIndices(rows) {
  const mode = trainLossResidualMode();
  if (mode === "single") return [trainLossSampleIndex()];
  if (mode === "top5") return [...rows].sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual)).slice(0, 5).map(row => row.index);
  const count = rows.length;
  if (!count) return [];
  const start = (currentFrame * 7 + trainLossSampleIndex()) % count;
  const indices = [];
  for (let i = 0; i < Math.min(10, count); i += 1) indices.push((start + i * 37) % count);
  return indices;
}

function trainLossResidualOption() {
  const frame = trainData.history[currentFrame];
  const rows = trainLossRows(frame);
  const points = rows.map(row => [row.x, row.y]);
  const selected = new Set(trainLossResidualIndices(rows));
  const residualLines = rows.filter(row => selected.has(row.index)).map(row => ({ coords: [[row.x, row.y], [row.x, row.yhat]] }));
  const selectedPoints = rows.filter(row => selected.has(row.index)).map(row => [row.x, row.y]);
  const currentLine = lineForParams(frame.w, frame.b);
  return {
    tooltip: {
      trigger: "item",
      formatter: p => {
        if (p.seriesName === "\u6837\u672c\u70b9") {
          const row = rows[p.dataIndex];
          return `#${row.index + 1}<br>${escapeHtml(trainData.x_column)}=${num(row.x, 4)}<br>${escapeHtml(trainData.target || "MEDV")}=${num(row.y, 2)}<br>\u0177=${num(row.yhat, 2)}<br>e=${num(row.residual, 4)}`;
        }
        return p.seriesName;
      }
    },
    legend: { top: 8 },
    grid: { left: 58, right: 24, top: 52, bottom: 44 },
    xAxis: { type: "value", name: trainData.x_column, nameLocation: "middle", nameGap: 26 },
    yAxis: { type: "value", name: trainData.target || "MEDV", nameLocation: "middle", nameGap: 36 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(37,99,235,.58)" }, z: 3 },
      { name: "\u5f53\u524d\u56de\u5f52\u7ebf", type: "line", data: currentLine, showSymbol: false, lineStyle: { color: "#d9354f", width: 3 }, z: 4 },
      { name: "\u6b8b\u5dee\u7ebf", type: "lines", coordinateSystem: "cartesian2d", data: residualLines, lineStyle: { color: "#ef4444", width: 2.4, opacity: 0.82 }, z: 5 },
      { name: "\u5f53\u524d\u89c2\u5bdf\u6837\u672c", type: "scatter", data: selectedPoints, symbolSize: 13, itemStyle: { color: "#f59e0b", borderColor: "#fff", borderWidth: 2 }, z: 6 }
    ]
  };
}

function trainLossOverallOption() {
  const frame = trainData.history[currentFrame];
  const rows = trainLossRows(frame);
  const view = trainLossOverallView();
  if (view === "residual_hist") return trainLossHistogramOption(rows);
  return trainLossResidualScatterOption(rows);
}

function trainLossResidualScatterOption(rows) {
  return {
    tooltip: {
      trigger: "item",
      formatter: p => {
        const row = rows[p.dataIndex];
        return `#${row.index + 1}<br>${escapeHtml(trainData.x_column)}=${num(row.x, 4)}<br>e=${num(row.residual, 4)}`;
      }
    },
    grid: { left: 58, right: 24, top: 36, bottom: 44 },
    xAxis: { type: "value", name: trainData.x_column, nameLocation: "middle", nameGap: 26 },
    yAxis: { type: "value", name: "\u6b8b\u5dee e", nameLocation: "middle", nameGap: 36 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6b8b\u5dee", type: "scatter", data: rows.map(row => [row.x, row.residual]), symbolSize: 6, itemStyle: { color: "rgba(15,159,120,.62)" } }
    ]
  };
}

function trainLossHistogramOption(rows) {
  const values = rows.map(row => row.residual);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = 16;
  const step = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({ label: `${num(min + i * step, 1)}~${num(min + (i + 1) * step, 1)}`, count: 0 }));
  values.forEach(value => {
    const index = Math.max(0, Math.min(binCount - 1, Math.floor((value - min) / step)));
    bins[index].count += 1;
  });
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 48, right: 20, top: 34, bottom: 70 },
    xAxis: { type: "category", data: bins.map(bin => bin.label), axisLabel: { rotate: 36, fontSize: 10 } },
    yAxis: { type: "value", name: "\u6837\u672c\u6570" },
    series: [{ name: "\u6b8b\u5dee\u5206\u5e03", type: "bar", data: bins.map(bin => bin.count), itemStyle: { color: "#5b35f5" }, barMaxWidth: 28 }]
  };
}

function updateTrainLossSampleNote() {
  const sample = trainLossCurrentSample();
  const el = $("lossSampleNote");
  if (el && sample) {
    el.innerHTML = `<span>#${sample.index + 1}</span><span>x = ${num(sample.x, 4)}</span><span>y = ${num(sample.y, 2)}</span><span>\u0177 = ${num(sample.yhat, 2)}</span><strong>e = ${num(sample.residual, 4)}</strong>`;
  }
  if ($("lossFormulaMse")) {
    const frame = trainData?.history?.[currentFrame];
    $("lossFormulaMse").textContent = Number(frame?.mse ?? frame?.loss ?? 0).toFixed(4);
  }
}

async function renderTrainFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  if ($("epochNow")) $("epochNow").textContent = frame.epoch;
  if ($("lossNow")) $("lossNow").textContent = Number(frame.loss).toFixed(4);

  let canReuseTrainGrid = false;
  await experimentRefreshCharts({
    viewName: "trainViews",
    storageKey: "trainSelectedViewsV1",
    summaryId: "trainModeSummary",
    contextId: trainData?.context_id,
    page: "train_eval",
    state: { frame_index: currentFrame },
    label: "train chart_data",
    beforeRender: ({ views, viewsKey, grid }) => {
      canReuseTrainGrid = dataGridMode === "train" && dataGrid && trainRenderViewsKey === viewsKey;
      if (!views.length) {
        destroyDataGrid();
        disposeCharts();
        trainRenderViewsKey = "";
        grid.classList.remove("dashboard-grid", "grid-stack");
      }
    },
    onChartData: chartData => {
      trainChartDataCache = chartData;
    },
    renderDashboard: ({ grid, views, viewsKey }) => {
      if (canReuseTrainGrid) {
        updateTrainInfoCards(frame);
        return;
      }
      destroyDataGrid();
      disposeCharts();
      grid.classList.remove("dashboard-grid", "grid-stack");
      renderTrainDashboard(grid, views, frame);
      trainRenderViewsKey = viewsKey;
    },
    renderFallback: ({ grid, views, viewsKey }) => {
      if (canReuseTrainGrid) {
        updateTrainInfoCards(frame);
        return;
      }
      destroyDataGrid();
      disposeCharts();
      grid.classList.remove("dashboard-grid", "grid-stack");
      grid.innerHTML = views.map(view => trainViewHtml(view, frame, trainChartDataCache[view])).join("");
      trainRenderViewsKey = viewsKey;
    },
    renderCharts: ({ views }) => {
      views.forEach(view => {
        if (isTrainInfoView(view)) return;
        const chartId = `chart_${view}`;
        const ch = charts.get(chartId) || initChart(chartId);
        const meta = trainChartMeta(view);
        const option = trainChartOption(meta, currentFrame, trainChartDataCache[view]);
        if (option) ch.setOption(option, meta?.renderer !== "loss_surface_3d");
      });
    },
  });
}

function renderTrainCompareFrame(index) {
  if (!trainCompareData) return;
  const maxIndex = Math.max(trainCompareData.raw.history.length, trainCompareData.standard.history.length) - 1;
  currentFrame = Math.max(0, Math.min(index, maxIndex));
  const rawFrame = trainCompareFrame("raw", currentFrame);
  const stdFrame = trainCompareFrame("standard", currentFrame);
  if ($("epochNow")) $("epochNow").textContent = currentFrame;
  if ($("rawLossNow")) $("rawLossNow").textContent = rawFrame ? Number(rawFrame.loss).toFixed(4) : "--";
  if ($("stdLossNow")) $("stdLossNow").textContent = stdFrame ? Number(stdFrame.loss).toFixed(4) : "--";
  renderTrainCompareMain();
}

function renderTrainCompareMain() {
  const views = selectedTrainCompareViews();
  const viewsKey = views.join("|");
  if (!views.length) {
    destroyDataGrid();
    disposeCharts();
    trainCompareViewsKey = "";
    $("main").innerHTML = trainCompareHintHtml("min-height:70vh");
    return;
  }
  const grid = ensureTrainCompareGrid();
  if (trainCompareViewsKey !== viewsKey) {
    destroyDataGrid();
    disposeCharts();
    grid.classList.remove("single");
    grid.innerHTML = views.map((view, index) => compareGridItemHtml(view, index)).join("");
    if (window.GridStack) {
      try {
        dataGridMode = "train_compare";
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
        dataGrid.on("change dragstop resizestop", () => {
          syncDataGridAttributes();
          requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
        });
        syncDataGridAttributes();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      } catch (err) {
        console.warn("Train compare GridStack fallback:", err);
        dataGrid = null;
        dataGridMode = null;
        grid.classList.remove("grid-stack");
        grid.classList.add("chart-grid");
        grid.innerHTML = views.map(view => {
          const config = TRAIN_COMPARE_VIEWS.find(item => item.id === view);
          const sub = config?.mode === "raw" ? "\u539f\u59cb\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b" : "\u6807\u51c6\u5316\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b";
          return chartCardHtml(view, config?.label || view, sub, "");
        }).join("");
      }
    }
    trainCompareViewsKey = viewsKey;
  }
  views.forEach(view => {
    const config = TRAIN_COMPARE_VIEWS.find(item => item.id === view);
    if (!config) return;
    const chartId = `chart_${view}`;
    const ch = charts.get(chartId) || initChart(chartId);
    ch.setOption(trainCompareScatterOption(config.mode, currentFrame), true);
  });
}

function ensureTrainCompareGrid() {
  if (!$("trainCompareWrap")) {
    destroyDataGrid();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="trainCompareWrap"></div>`;
  }
  return $("trainCompareWrap");
}

function trainCompareHintHtml(style = "") {
  return `<section class="chart-card wide load-dataset-card" style="${style}">
    <div class="chart-head" aria-label="\u63d0\u793a\u5361\u7247"></div>
    <div class="load-dataset-hint">\u8bf7\u5728\u53f3\u4fa7\u540c\u65f6\u9009\u62e9\u539f\u59cb\u6563\u70b9\u56fe\u548c\u6807\u51c6\u5316\u6563\u70b9\u56fe\uff0c\u9009\u62e9\u7279\u5f81\uff0c\u89c2\u5bdf\u5728\u5176\u5b83\u53c2\u6570\u76f8\u540c\u7684\u60c5\u51b5\u4e0b\uff0c\u8bad\u7ec3\u6a21\u578b\u65f6\u56de\u5f52\u7684\u533a\u522b</div>
  </section>`;
}

function compareGridItemHtml(view, index) {
  const config = TRAIN_COMPARE_VIEWS.find(item => item.id === view);
  const sub = config?.mode === "raw" ? "\u539f\u59cb\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b" : "\u6807\u51c6\u5316\u7279\u5f81\u5c3a\u5ea6\u4e0b\u7684\u8bad\u7ec3\u8fc7\u7a0b";
  const x = index % 2 === 0 ? 0 : 2;
  const y = Math.floor(index / 2) * 2;
  return `<div class="grid-stack-item" data-view="${escapeHtml(view)}" gs-x="${x}" gs-y="${y}" gs-w="2" gs-h="2" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${chartCardHtml(view, config?.label || view, sub, "")}</div></div>`;
}

function trainCompareFrame(mode, frameIndex) {
  const data = mode === "raw" ? trainCompareData?.raw : trainCompareData?.standard;
  if (!data?.history?.length) return null;
  return data.history[Math.min(frameIndex, data.history.length - 1)];
}

function trainCompareScatterOption(mode, frameIndex) {
  const data = mode === "raw" ? trainCompareData.raw : trainCompareData.standard;
  const frame = trainCompareFrame(mode, frameIndex);
  const points = data.scatter.x.map((x, i) => [x, data.scatter.y[i]]);
  const currentLine = data.line_x.map(x => [x, frame.w * x + frame.b]);
  const bestLine = data.line_x.map(x => [x, data.best.w * x + data.best.b]);
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: data.x_column, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: data.target || "MEDV", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: mode === "raw" ? "rgba(37,99,235,.62)" : "rgba(15,159,120,.62)" } },
      { name: "\u5f53\u524d\u56de\u5f52\u7ebf", type: "line", data: currentLine, showSymbol: false, lineStyle: { color: "#d9354f", width: 3 } },
      { name: "\u6700\u4f18\u53c2\u8003\u7ebf", type: "line", data: bestLine, showSymbol: false, lineStyle: { color: "#0f9f78", width: 2.6, type: "dashed" } }
    ]
  };
}

function trainChartOption(meta, frameIndex, chartData = null) {
  if (!meta) return null;
  const metric = meta.metric || ({
    w_path: "w",
    b_path: "b",
    rmse: "rmse",
    mae: "mae",
    r2: "r2",
  })[meta.id];

  if (meta.renderer === "linear_train_scatter") return trainScatterOption(frameIndex, chartData);
  if (meta.renderer === "loss_curve") return lossOption(frameIndex, chartData);
  if (meta.renderer === "loss_contour") return contourOption(frameIndex, chartData);
  if (meta.renderer === "loss_surface_3d") return lossSurface3DOption(frameIndex, chartData);
  if (meta.renderer === "gradient_descent") return gradientDescentOption(frameIndex, chartData);
  if (meta.renderer === "param_path") return paramPathOption(metric, frameIndex, chartData);
  if (meta.renderer === "metric_gauge") return metricOption(metric, frameIndex, chartData);
  return null;
}

function startAuto() {
  if (activeTrainStep === "preprocess_effect") {
    startTrainCompareAuto();
    return;
  }
  if (!trainData) return;
  stopAuto();
  setTrainRunMessage("\u81ea\u52a8\u6f14\u793a\u4e2d\uff1a\u7cfb\u7edf\u4f1a\u5728\u8fbe\u5230\u6700\u5927\u8f6e\u6570\u3001Loss \u6536\u655b\u6216\u53d1\u6563\u65f6\u505c\u6b62\u3002");
  timer = setInterval(() => {
    const stopReason = trainAutoStopReason(currentFrame);
    if (stopReason) {
      setTrainRunMessage(stopReason);
      stopAuto();
      return;
    }
    if (activeTrainStep === "process") renderTrainProcessFrame(currentFrame + 1);
    else if (activeTrainStep === "loss") renderTrainLossFrame(currentFrame + 1);
    else if (activeTrainStep === "optimization") renderTrainOptimizationFrame(currentFrame + 1);
    else if (activeTrainStep === "custom") renderTrainCustomFrame(currentFrame + 1);
    else renderTrainFrame(currentFrame + 1);
  }, Number($("speed").value));
}

function startTrainCompareAuto() {
  if (!trainCompareData) return;
  stopAuto();
  setTrainRunMessage("\u81ea\u52a8\u6f14\u793a\u4e2d\uff1a\u4fdd\u6301\u4e24\u7ec4\u53c2\u6570\u76f8\u540c\uff0c\u5bf9\u6bd4\u539f\u59cb\u4e0e\u6807\u51c6\u5316\u8bad\u7ec3\u5dee\u5f02\u3002");
  timer = setInterval(() => {
    const stopReason = trainCompareAutoStopReason(currentFrame);
    if (stopReason) {
      setTrainRunMessage(stopReason);
      stopAuto();
      return;
    }
    renderTrainCompareFrame(currentFrame + 1);
  }, Number($("speed").value));
}

function stopAuto() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function trainAutoStopReason(frameIndex) {
  if (!trainData?.history?.length) return "\u6682\u65e0\u8bad\u7ec3\u6570\u636e\u3002";
  if (frameIndex >= trainData.history.length - 1) return "\u5df2\u8fbe\u5230\u672c\u6b21\u8bad\u7ec3\u7684\u6700\u5927\u8f6e\u6570\u3002";
  const frame = trainData.history[frameIndex];
  if (!Number.isFinite(Number(frame?.loss))) return "Loss \u51fa\u73b0\u5f02\u5e38\uff0c\u5df2\u505c\u6b62\u6f14\u793a\u3002";
  if (Number(frame.loss) > 1e12) return "Loss \u660e\u663e\u53d1\u6563\uff0c\u5df2\u505c\u6b62\u6f14\u793a\u3002";
  if (frameIndex < 10) return "";
  const recent = trainData.history.slice(Math.max(0, frameIndex - 8), frameIndex + 1).map(item => Number(item.loss));
  if (recent.some(value => !Number.isFinite(value))) return "Loss \u51fa\u73b0\u5f02\u5e38\uff0c\u5df2\u505c\u6b62\u6f14\u793a\u3002";
  const deltas = recent.slice(1).map((value, index) => Math.abs(value - recent[index]));
  const maxDelta = Math.max(...deltas);
  const scale = Math.max(1, Math.abs(recent[0]));
  if (maxDelta / scale < 1e-7) return "Loss \u8fde\u7eed\u591a\u8f6e\u51e0\u4e4e\u4e0d\u53d8\uff0c\u5df2\u89c6\u4e3a\u6536\u655b\u5e76\u505c\u6b62\u6f14\u793a\u3002";
  return "";
}

function trainCompareAutoStopReason(frameIndex) {
  if (!trainCompareData?.raw?.history?.length || !trainCompareData?.standard?.history?.length) return "\u6682\u65e0\u8bad\u7ec3\u6570\u636e\u3002";
  const maxIndex = Math.max(trainCompareData.raw.history.length, trainCompareData.standard.history.length) - 1;
  if (frameIndex >= maxIndex) return "\u5df2\u8fbe\u5230\u672c\u6b21\u5bf9\u6bd4\u8bad\u7ec3\u7684\u6700\u5927\u5468\u671f\u3002";
  const rawFrame = trainCompareFrame("raw", frameIndex);
  const stdFrame = trainCompareFrame("standard", frameIndex);
  if (!Number.isFinite(Number(rawFrame?.loss)) || !Number.isFinite(Number(stdFrame?.loss))) return "Loss \u51fa\u73b0\u5f02\u5e38\uff0c\u5df2\u505c\u6b62\u6f14\u793a\u3002";
  if (Number(rawFrame.loss) > 1e12 || Number(stdFrame.loss) > 1e12) return "Loss \u660e\u663e\u53d1\u6563\uff0c\u5df2\u505c\u6b62\u6f14\u793a\u3002";
  return "";
}
