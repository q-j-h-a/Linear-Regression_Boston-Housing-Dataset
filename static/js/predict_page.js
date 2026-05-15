// Predict Page.

async function renderPredictShell() {
  predictPageSchema = predictPageSchema || await loadPanelSchema("predict", {
    title: "控制面板",
    sections: []
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `
    <div class="chart-grid" id="chartGrid"></div>`;
  $("rightPanel").innerHTML = renderPredictPanel(predictPageSchema);
  syncPredictPanelWithTrainModel();
  $("predictFeature").addEventListener("change", loadPrediction);
  $("predictStd").addEventListener("change", loadPrediction);
  $("predictRun").addEventListener("click", loadPrediction);
  $("predictInputMode").addEventListener("change", loadPrediction);
  $("predictInput").addEventListener("keydown", event => {
    if (event.key === "Enter") loadPrediction();
  });
  restorePredictFormState();
  restoreCheckedValues("predictViews", "predictSelectedViewsV2");
  document.querySelectorAll('input[name="predictViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("predictViews", "predictSelectedViewsV2");
    renderPredictCharts();
  }));
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
  if ($("predictValue")) $("predictValue").textContent = Number(predictData.prediction).toFixed(2);
  if ($("predictModelX")) $("predictModelX").textContent = Number(predictData.model_x).toFixed(3);
  if (predictData?.feature) $("topFeature").textContent = `当前特征 ${predictData.feature}`;
  renderPredictCharts();
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
  const stdEl = $("predictStd");
  const runEl = $("predictRun");
  const statusEl = $("predictModelStatus");
  const inputModeEl = $("predictInputMode");
  if (!state) {
    if (featureEl) featureEl.disabled = true;
    if (stdEl) stdEl.disabled = true;
    if (runEl) runEl.disabled = true;
    if (inputModeEl) {
      inputModeEl.value = "raw";
      inputModeEl.disabled = true;
      [...inputModeEl.options].forEach(option => option.disabled = option.value !== "raw");
    }
    if (statusEl) {
      statusEl.className = "model-status-empty";
      statusEl.textContent = "暂无训练模型。请先进入“模型训练与评估”，准备训练并切换到希望用于预测的 epoch。";
    }
    return;
  }
  if (featureEl) {
    featureEl.value = state.feature;
    featureEl.disabled = true;
  }
  if (stdEl) {
    stdEl.value = state.useStandardized ? "true" : "false";
    stdEl.disabled = true;
  }
  if (inputModeEl) {
    [...inputModeEl.options].forEach(option => {
      option.disabled = option.value === "standardized" && !state.useStandardized;
    });
    if (!state.useStandardized && inputModeEl.value === "standardized") inputModeEl.value = "raw";
    inputModeEl.disabled = false;
  }
  if (runEl) runEl.disabled = false;
  if (statusEl) {
    statusEl.className = "model-status-grid";
    statusEl.innerHTML = `
      <div class="model-status-main">
        <span>来源</span>
        <strong>训练页 epoch ${escapeHtml(state.frame.epoch)}</strong>
      </div>
      <div class="model-status-pair">
        <span>特征</span>
        <strong>${escapeHtml(state.feature)}</strong>
      </div>
      <div class="model-status-pair">
        <span>输入空间</span>
        <strong>${escapeHtml(state.useStandardized ? "标准化特征" : "原始特征")}</strong>
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
    $("predictValue").textContent = "--";
    $("predictModelX").textContent = "--";
    const grid = $("chartGrid");
    if (grid) grid.innerHTML = `<div class="empty-state">请先在“模型训练与评估”页完成一次训练，再回到这里使用当前模型预测。</div>`;
    return;
  }
  const feature = trainState.feature;
  $("topFeature").textContent = `当前特征 ${feature}`;
  try {
    predictData = await runAction("predict", {
      value: Number($("predictInput").value || 0),
      input_mode: $("predictInputMode")?.value || "raw",
      train_context_id: trainState.contextId,
      train_frame_index: trainState.frameIndex
    });
    $("predictValue").textContent = Number(predictData.prediction).toFixed(2);
    $("predictModelX").textContent = Number(predictData.model_x).toFixed(3);
    renderPredictCharts();
  } catch (err) {
    renderError(err.message);
  }
}

async function loadPredictChartData(views) {
  if (!predictData?.context_id) return {};
  return await postJson("/api/chart_data", {
    context_id: predictData.context_id,
    page: "predict",
    charts: views,
    state: {},
  });
}

async function renderPredictCharts() {
  if (!predictData) return;
  const views = selectedValues("predictViews");
  const viewsKey = views.join("|");
  saveCheckedValues("predictViews", "predictSelectedViewsV2");
  let grid = $("chartGrid");
  if (!grid) {
    $("main").innerHTML = `
      <div class="chart-grid" id="chartGrid"></div>`;
    grid = $("chartGrid");
  }
  $("predictModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择显示模式";
  grid.classList.toggle("single", views.length === 1);
  const canReusePredictGrid = dataGridMode === "predict" && dataGrid && predictRenderViewsKey === viewsKey;
  if (!views.length) {
    grid.innerHTML = `<div class="empty-state">请选择至少一个显示模式。</div>`;
    return;
  }
  try {
    predictChartDataCache = await loadPredictChartData(views);
  } catch (err) {
    predictChartDataCache = {};
    console.warn("predict chart_data fallback:", err);
  }

  if (canReusePredictGrid) {
    updatePredictInfoCards(views);
  } else {
    destroyDataGrid();
    disposeCharts();
    grid.classList.remove("dashboard-grid", "grid-stack");
    if (window.GridStack) {
      renderPredictDashboard(grid, views);
    } else {
      grid.innerHTML = views.map(view => predictViewHtml(view, predictChartDataCache[view])).join("");
    }
    predictRenderViewsKey = viewsKey;
  }
  views.forEach(view => {
    const meta = predictChartMeta(view);
    if (meta?.renderer !== "predict_chart") return;
    const ch = initChart(`chart_${view}`);
    ch.setOption(predictChartOption(predictChartDataCache[view]), true);
  });
}

function updatePredictInfoCards(views) {
  views.forEach(view => {
    const meta = predictChartMeta(view);
    if (meta?.renderer === "predict_chart") return;
    const item = Array.from(document.querySelectorAll(".grid-stack-item"))
      .find(el => el.dataset.view === view)
      ?.querySelector(".grid-stack-item-content");
    if (item) item.innerHTML = predictViewHtml(view, predictChartDataCache[view]);
  });
}

function renderPredictDashboard(grid, views) {
  dataGridMode = "predict";
  grid.classList.add("dashboard-grid", "grid-stack");
  grid.classList.remove("single");
  const saved = loadPredictGridLayout();
  grid.innerHTML = views.map(view => {
    const layout = normalizePredictGridLayout(view, saved[view] || defaultPredictGridLayout(view));
    return `<div class="grid-stack-item" data-view="${view}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${predictViewHtml(view, predictChartDataCache[view])}</div></div>`;
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

function defaultPredictGridLayout(view) {
  return ({
    chart: { x: 0, y: 0, w: 4, h: 2 },
    calc: { x: 0, y: 2, w: 4, h: 3 }
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
