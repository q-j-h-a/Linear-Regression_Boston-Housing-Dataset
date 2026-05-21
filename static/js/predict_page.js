// Predict Page.

let predictRawScatterData = null;
let predictRawScatterKey = "";

async function renderPredictShell() {
  predictPageSchema = predictPageSchema || await loadPanelSchema("predict", {
    title: "\u6a21\u578b\u9884\u6d4b",
    sections: []
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="predictWrap"></div>`;
  $("rightPanel").innerHTML = renderPredictPanel();
  syncPredictPanelWithTrainModel();
  $("predictRun")?.addEventListener("click", loadPrediction);
  $("predictInputMode")?.addEventListener("change", loadPrediction);
  $("predictInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") loadPrediction();
  });
  restorePredictFormState();
}

function renderPredictPanel() {
  return `
    <div class="right-title">\u63a7\u5236\u9762\u677f</div>
    <div class="control-card">
      <div class="mini-stats">
        <div class="mini-stat"><span>\u9884\u6d4b MEDV</span><strong id="predictValue">--</strong></div>
        <div class="mini-stat"><span>\u6a21\u578b\u8f93\u5165 x</span><strong id="predictModelX">--</strong></div>
      </div>
      <div class="control-group" aria-label="\u5f53\u524d\u6a21\u578b">
        <label class="control-label">\u5f53\u524d\u6a21\u578b</label>
        <div class="formula-box" id="predictModelStatus">\u8bf7\u5148\u5728\u201c\u6a21\u578b\u8bad\u7ec3\u201d\u9875\u5b8c\u6210\u4e00\u6b21\u8bad\u7ec3\u3002</div>
      </div>
      <div class="control-group">
        <label class="control-label" for="predictFeature">\u7279\u5f81\u9009\u62e9</label>
        <select id="predictFeature" disabled>
          ${(currentDatasetMeta?.features || FEATURE_NAMES).map(item => optionHtml(item, trainData?.feature || DEFAULT_FEATURE, item)).join("")}
        </select>
        <input id="predictStd" type="hidden" value="true">
      </div>
      <div class="control-group" aria-label="\u8f93\u5165\u8bbe\u7f6e">
        <div class="field-grid">
          <label class="control-label" for="predictInputMode">\u8f93\u5165\u7c7b\u578b
            <select id="predictInputMode">
              <option value="raw">\u539f\u59cb\u7279\u5f81\u503c</option>
              <option value="standardized">\u6807\u51c6\u7279\u5f81\u503c</option>
            </select>
          </label>
          <label class="control-label" for="predictInput">\u8f93\u5165\u7279\u5f81\u503c
            <input id="predictInput" type="number" value="6.5" step="0.1">
          </label>
        </div>
      </div>
      <div class="btn-row">
        <button class="primary-btn" id="predictRun" type="button">\u5f00\u59cb\u9884\u6d4b</button>
      </div>
    </div>`;
}

function persistPredictFormState() {
  const state = {};
  ["predictInput", "predictInputMode"].forEach(id => {
    const el = $(id);
    if (el) state[id] = el.value;
  });
  viewStateStore.predictFormStateV1 = state;
}

function restorePredictFormState() {
  const state = viewStateStore.predictFormStateV1 || {};
  ["predictInput", "predictInputMode"].forEach(id => {
    const el = $(id);
    if (!el || state[id] == null) return;
    if (el.tagName === "SELECT" && ![...el.options].some(opt => opt.value === state[id])) return;
    el.value = state[id];
  });
  syncPredictPanelWithTrainModel();
}

function restorePredictionView() {
  restorePredictFormState();
  if ($("predictValue")) $("predictValue").textContent = Number(predictDisplayPrediction()).toFixed(2);
  if ($("predictModelX")) $("predictModelX").textContent = Number(predictData.model_x).toFixed(3);
  if (predictData?.feature) $("topFeature").textContent = `\u5f53\u524d\u7279\u5f81 ${predictData.feature}`;
  ensurePredictRawScatterData()
    .catch(err => console.warn("Predict raw scatter fallback skipped:", err))
    .finally(() => renderPredictCharts());
}

function predictionMatchesCurrentState() {
  const trainState = currentTrainPredictionState();
  if (!predictData || !trainState) return false;
  const inputValue = Number($("predictInput")?.value || viewStateStore.predictFormStateV1?.predictInput || 0);
  const inputMode = $("predictInputMode")?.value || viewStateStore.predictFormStateV1?.predictInputMode || "raw";
  return predictData.train_context_id === trainState.contextId
    && Number(predictData.train_frame_index) === Number(trainState.frameIndex)
    && Number(predictData.input_value ?? predictData.raw_value) === inputValue
    && (predictData.input_mode || "raw") === inputMode;
}

function currentTrainPredictionState() {
  if (!trainData?.context_id || !Array.isArray(trainData.history) || !trainData.history.length) return null;
  const frameIndex = Math.max(0, Math.min(currentFrame, trainData.history.length - 1));
  const frame = trainData.history[frameIndex];
  return {
    contextId: trainData.context_id,
    frameIndex,
    frame,
    feature: trainData.feature,
    useStandardized: Boolean(trainData.use_standardized),
  };
}

function syncPredictPanelWithTrainModel() {
  const state = currentTrainPredictionState();
  const featureEl = $("predictFeature");
  const runEl = $("predictRun");
  const statusEl = $("predictModelStatus");
  const inputModeEl = $("predictInputMode");
  if (!state) {
    if (featureEl) featureEl.disabled = true;
    if (runEl) runEl.disabled = true;
    if (inputModeEl) inputModeEl.disabled = true;
    if (statusEl) {
      statusEl.className = "model-status-empty";
      statusEl.textContent = "\u6682\u65e0\u53ef\u7528\u8bad\u7ec3\u6a21\u578b\uff0c\u8bf7\u5148\u5b8c\u6210\u6a21\u578b\u8bad\u7ec3\u540e\u518d\u8fdb\u884c\u9884\u6d4b\u3002";
    }
    return;
  }
  if (featureEl) {
    featureEl.value = state.feature;
    featureEl.disabled = true;
  }
  if (inputModeEl) {
    inputModeEl.disabled = false;
    [...inputModeEl.options].forEach(option => {
      option.disabled = option.value === "standardized" && !state.useStandardized;
    });
    if (!state.useStandardized && inputModeEl.value === "standardized") inputModeEl.value = "raw";
  }
  if (runEl) runEl.disabled = false;
  if (statusEl) {
    statusEl.className = "model-status-grid";
    statusEl.innerHTML = `
      <div class="model-status-main">
        <span>\u8bad\u7ec3\u6765\u6e90</span>
        <strong>\u81ea\u5b9a\u4e49\u53c2\u6570\u8bad\u7ec3 epoch ${escapeHtml(state.frame.epoch)}</strong>
      </div>
      <div class="model-status-pair">
        <span>\u7279\u5f81</span>
        <strong>${escapeHtml(state.feature)}</strong>
      </div>
      <div class="model-status-pair">
        <span>\u6a21\u578b\u8f93\u5165</span>
        <strong>${escapeHtml(state.useStandardized ? "\u6807\u51c6\u5316\u7279\u5f81" : "\u539f\u59cb\u7279\u5f81")}</strong>
      </div>
      <div class="model-param-row">
        <div><span>w</span><strong>${Number(state.frame.w).toFixed(6)}</strong></div>
        <div><span>b</span><strong>${Number(state.frame.b).toFixed(6)}</strong></div>
      </div>`;
  }
}

async function loadPrediction() {
  persistPredictFormState();
  const trainState = currentTrainPredictionState();
  syncPredictPanelWithTrainModel();
  if (!trainState) {
    predictData = null;
    if ($("predictValue")) $("predictValue").textContent = "--";
    if ($("predictModelX")) $("predictModelX").textContent = "--";
    predictEmptyState();
    return;
  }
  const feature = trainState.feature;
  $("topFeature").textContent = `\u5f53\u524d\u7279\u5f81 ${feature}`;
  try {
    predictData = await runAction("predict", {
      value: Number($("predictInput").value || 0),
      input_mode: $("predictInputMode")?.value || "raw",
      train_context_id: trainState.contextId,
      train_frame_index: trainState.frameIndex
    });
    await ensurePredictRawScatterData();
    if ($("predictValue")) $("predictValue").textContent = Number(predictDisplayPrediction()).toFixed(2);
    if ($("predictModelX")) $("predictModelX").textContent = Number(predictData.model_x).toFixed(3);
    renderPredictCharts();
  } catch (err) {
    renderError(err.message);
  }
}

function predictEmptyState() {
  destroyDataGrid();
  disposeCharts();
  $("main").innerHTML = `
    <div class="empty-state">
      \u8bf7\u5148\u5728\u201c\u6a21\u578b\u8bad\u7ec3\u201d\u9875\u5b8c\u6210\u4e00\u6b21\u8bad\u7ec3\uff0c\u7136\u540e\u518d\u8fdb\u884c\u6a21\u578b\u9884\u6d4b\u3002
    </div>`;
}

async function ensurePredictRawScatterData() {
  if (!predictData) return null;
  const key = `${predictData.dataset_id || currentDatasetMeta?.dataset_id || "boston_housing"}|${predictData.feature}`;
  if (predictRawScatterData && predictRawScatterKey === key) return predictRawScatterData;
  const raw = await runAction("prepare_train", {
    feature: predictData.feature,
    dataset_id: predictData.dataset_id || currentDatasetMeta?.dataset_id || "boston_housing",
    use_standardized: false,
    learning_rate: 0.03,
    epochs: 1,
    w0: 0,
    b0: 0
  });
  predictRawScatterData = raw;
  predictRawScatterKey = key;
  return raw;
}

function renderPredictCharts() {
  if (!predictData) return;
  const grid = ensurePredictGrid();
  const viewsKey = "predict_fixed_v1";
  if (predictRenderViewsKey !== viewsKey || !charts.get("chart_predict_standard") || !charts.get("chart_predict_raw") || !$("predictCalcCard")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "predict";
    grid.innerHTML = predictGridHtml();
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
        saveDataGridLayout();
        requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
      });
      syncDataGridAttributes();
    }
    predictRenderViewsKey = viewsKey;
  }

  const standard = charts.get("chart_predict_standard") || initChart("chart_predict_standard");
  standard.setOption(predictStandardOption(), true);

  const raw = charts.get("chart_predict_raw") || initChart("chart_predict_raw");
  raw.setOption(predictRawOption(), true);

  updatePredictCalcCard();
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function ensurePredictGrid() {
  if (!$("predictWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="predictWrap"></div>`;
    predictRenderViewsKey = "";
  }
  return $("predictWrap");
}

function predictGridHtml() {
  const saved = loadPredictGridLayout();
  const items = [
    { id: "predict_standard", layout: { x: 0, y: 0, w: 2, h: 2 }, html: chartCardHtml("predict_standard", "\u9884\u6d4b\u53ef\u89c6\u5316", "x \u548c y \u5747\u4e3a\u6807\u51c6\u5316\u7a7a\u95f4\uff0c\u663e\u793a\u6a21\u578b\u56de\u5f52\u7ebf\u4e0e\u9884\u6d4b\u70b9", "") },
    { id: "predict_raw", layout: { x: 2, y: 0, w: 2, h: 2 }, html: chartCardHtml("predict_raw", "\u539f\u59cb\u6563\u70b9\u56fe", "\u4ec5\u663e\u793a\u539f\u59cb\u6837\u672c\u70b9\u548c\u53cd\u6807\u51c6\u5316\u540e\u7684\u9884\u6d4b\u70b9", "") },
    { id: "predict_calc", layout: { x: 0, y: 2, w: 4, h: 3 }, html: `<div id="predictCalcCard" style="height:100%"></div>` },
  ];
  return items.map(item => {
    const layout = normalizePredictGridLayout(item.id, saved[item.id] || item.layout);
    return `<div class="grid-stack-item" data-view="${escapeHtml(item.id)}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${item.html}</div></div>`;
  }).join("");
}

function defaultPredictGridLayout(view) {
  return ({
    predict_standard: { x: 0, y: 0, w: 2, h: 2 },
    predict_raw: { x: 2, y: 0, w: 2, h: 2 },
    predict_calc: { x: 0, y: 2, w: 4, h: 3 },
  })[view] || { x: 0, y: 0, w: 2, h: 1 };
}

function normalizePredictGridLayout(view, layout) {
  const next = { ...defaultPredictGridLayout(view), ...layout };
  next.w = Math.max(1, Math.min(4, Number(next.w) || 1));
  next.h = Math.max(1, Number(next.h) || 1);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}

function predictStandardOption() {
  const points = predictData.scatter.x.map((x, i) => [x, predictData.scatter.y[i]]);
  const lineData = Array.isArray(predictData.line)
    ? predictData.line
    : predictData.line.x.map((x, i) => [x, predictData.line.y[i]]);
  const inputPoint = [predictData.model_x, predictModelPrediction()];
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: predictData.x_column, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: `${predictData.target || "MEDV"}(std)`, nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(15,159,120,.62)" } },
      { name: "\u5f53\u524d\u56de\u5f52\u7ebf", type: "line", data: lineData, showSymbol: false, lineStyle: { color: "#0f9f78", width: 3 } },
      { name: "\u9884\u6d4b\u8f85\u52a9\u7ebf", type: "lines", coordinateSystem: "cartesian2d", data: [{ coords: [[predictData.model_x, 0], inputPoint] }], lineStyle: { color: "#f59e0b", width: 2, type: "dashed" } },
      { name: "\u9884\u6d4b\u70b9", type: "scatter", data: [inputPoint], symbolSize: 15, itemStyle: { color: "#e23b5a", borderColor: "#fff", borderWidth: 3 } }
    ]
  };
}

function predictRawOption() {
  const raw = predictRawScatterData;
  const points = raw?.scatter?.x?.map((x, i) => [x, raw.scatter.y[i]]) || [];
  const inputPoint = [predictData.raw_value, predictDisplayPrediction()];
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: predictData.feature, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: predictData.target || "MEDV", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "\u539f\u59cb\u6837\u672c\u70b9", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(37,99,235,.58)" } },
      { name: "\u9884\u6d4b\u70b9", type: "scatter", data: [inputPoint], symbolSize: 15, itemStyle: { color: "#e23b5a", borderColor: "#fff", borderWidth: 3 } }
    ]
  };
}

function updatePredictCalcCard() {
  const slot = $("predictCalcCard");
  if (!slot) return;
  slot.innerHTML = predictCalcCardHtml();
}

function predictCalcCardHtml() {
  const modelType = predictData.use_standardized ? "\u6807\u51c6\u5316\u7279\u5f81" : "\u539f\u59cb\u7279\u5f81";
  const conversion = predictData.use_standardized
    ? `x_std = (x_raw - mean) / std = (${num(predictData.raw_value, 6)} - ${num(predictData.mean, 6)}) / ${num(predictData.std, 6)} = ${num(predictData.model_x, 6)}`
    : `x_model = x_raw = ${num(predictData.model_x, 6)}`;
  const yConversion = predictData.use_standardized
    ? `\u0177_raw = \u0177_std * y_std + y_mean = ${num(predictModelPrediction(), 6)} * ${num(predictData.target_std, 6)} + ${num(predictData.target_mean, 6)} = ${num(predictDisplayPrediction(), 6)}`
    : `\u0177_raw = \u0177 = ${num(predictDisplayPrediction(), 6)}`;
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div><div class="chart-title">\u9884\u6d4b\u8ba1\u7b97\u8fc7\u7a0b</div><div class="chart-sub">\u8f93\u5165\u503c\u3001\u6807\u51c6\u5316\u6362\u7b97\u3001\u6a21\u578b\u4ee3\u5165\u548c\u9884\u6d4b\u8f93\u51fa</div></div>
    </div>
    <div style="padding:18px">
      <div class="formula">1. \u8bfb\u53d6\u8f93\u5165
\u8f93\u5165\u7c7b\u578b = ${predictData.input_mode === "standardized" ? "\u6807\u51c6\u7279\u5f81\u503c" : "\u539f\u59cb\u7279\u5f81\u503c"}
\u8f93\u5165\u503c = ${num(predictData.input_value, 6)}

2. \u6362\u7b97\u4e3a\u6a21\u578b\u8f93\u5165
\u5f53\u524d\u6a21\u578b\u4f7f\u7528\uff1a${modelType}
raw x = ${num(predictData.raw_value, 6)}
model x = ${num(predictData.model_x, 6)}
${conversion}

3. \u4ee3\u5165\u7ebf\u6027\u56de\u5f52\u6a21\u578b
\u0177_std = w * x_std + b
  = ${num(predictData.w, 6)} * ${num(predictData.model_x, 6)} + ${num(predictData.b, 6)}
  = ${num(predictModelPrediction(), 6)}

4. \u8fd8\u539f\u4e3a\u539f\u59cb MEDV
${yConversion}

5. \u56fe\u4e2d\u5bf9\u5e94
\u5de6\u56fe\u5728\u6807\u51c6\u5316\u7a7a\u95f4\u663e\u793a\u9884\u6d4b\u70b9\uff1a(${num(predictData.model_x, 4)}, ${num(predictModelPrediction(), 4)})
\u53f3\u56fe\u5728\u539f\u59cb\u6570\u636e\u7a7a\u95f4\u663e\u793a\u9884\u6d4b\u70b9\uff1a(${num(predictData.raw_value, 4)}, ${num(predictDisplayPrediction(), 4)})</div>
    </div>
  </section>`;
}

function predictModelPrediction() {
  return Number(predictData?.prediction_std ?? predictData?.prediction ?? 0);
}

function predictDisplayPrediction() {
  return Number(predictData?.prediction_raw ?? predictData?.prediction ?? 0);
}
