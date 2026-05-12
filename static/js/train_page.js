// Train Page.

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
  const schema = await loadTrainPageSchema();
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `
    <section class="hero-card">
      <div class="hero-line">
        <div>
          <div class="eyebrow">实验部分</div>
          <h2>模型训练与评估</h2>
        </div>
      </div>
      <div class="chart-grid" id="chartGrid"></div>
    </section>`;
  $("rightPanel").innerHTML = renderTrainControlPanel(schema);
  bindTrainControlPanel();
  $("trainFeature").addEventListener("change", prepareTraining);
  $("trainStd").addEventListener("change", prepareTraining);
  $("w0").addEventListener("change", prepareTraining);
  $("b0").addEventListener("change", prepareTraining);
  $("lr").addEventListener("input", () => $("lrText").textContent = Number($("lr").value).toFixed(3));
  $("epochs").addEventListener("input", () => $("epochsText").textContent = $("epochs").value);
  $("speed").addEventListener("input", () => $("speedText").textContent = `${$("speed").value}ms`);
  $("lr").addEventListener("change", prepareTraining);
  $("epochs").addEventListener("change", prepareTraining);
  restoreCheckedValues("trainViews", "trainSelectedViewsV1");
  document.querySelectorAll('input[name="trainViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("trainViews", "trainSelectedViewsV1");
    renderTrainFrame(currentFrame);
  }));
  $("stepBtn").addEventListener("click", () => renderTrainFrame(currentFrame + 1));
  $("autoBtn").addEventListener("click", startAuto);
  $("pauseBtn").addEventListener("click", stopAuto);
  $("resetBtn").addEventListener("click", () => { stopAuto(); renderTrainFrame(0); });
  prepareTraining();
}

async function prepareTraining() {
  const feature = $("trainFeature").value;
  $("topFeature").textContent = `当前特征 ${feature}`;
  try {
    trainData = await runAction("prepare_train", {
      feature,
      use_standardized: $("trainStd").value === "1" || $("trainStd").value === "true",
      learning_rate: Number($("lr").value),
      epochs: Number($("epochs").value),
      w0: Number($("w0").value),
      b0: Number($("b0").value)
    });
    $("sampleCount").textContent = trainData.scatter.x.length;
  $("featureCount").textContent = FEATURE_NAMES.length;
  currentFrame = 0;
  renderTrainFrame(0);
  } catch (err) {
    renderError(err.message);
  }
}

async function loadTrainChartData(views, frameIndex) {
  if (!trainData?.context_id) return {};
  return await postJson("/api/chart_data", {
    context_id: trainData.context_id,
    page: "train_eval",
    charts: views,
    state: { frame_index: frameIndex },
  });
}

async function renderTrainFrame(index) {
  if (!trainData) return;
  currentFrame = Math.max(0, Math.min(index, trainData.history.length - 1));
  const frame = trainData.history[currentFrame];
  $("epochNow").textContent = frame.epoch;
  $("lossNow").textContent = Number(frame.loss).toFixed(4);

  const views = selectedValues("trainViews");
  const viewsKey = views.join("|");
  saveCheckedValues("trainViews", "trainSelectedViewsV1");
  const grid = $("chartGrid");
  $("trainModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择显示模式";
  grid.classList.toggle("single", views.length === 1);

  const canReuseTrainGrid = dataGridMode === "train" && dataGrid && trainRenderViewsKey === viewsKey;
  if (!views.length) {
    destroyDataGrid();
    disposeCharts();
    grid.classList.remove("dashboard-grid", "grid-stack");
    grid.innerHTML = `<div class="empty-state">请选择至少一个显示模式。</div>`;
    return;
  }

  try {
    trainChartDataCache = await loadTrainChartData(views, currentFrame);
  } catch (err) {
    trainChartDataCache = {};
    console.warn("chart_data fallback:", err);
  }

  if (canReuseTrainGrid) {
    updateTrainInfoCards(frame);
  } else {
    destroyDataGrid();
    disposeCharts();
    grid.classList.remove("dashboard-grid", "grid-stack");
    if (window.GridStack) {
      renderTrainDashboard(grid, views, frame);
    } else {
      grid.innerHTML = views.map(view => trainViewHtml(view, frame, trainChartDataCache[view])).join("");
    }
    trainRenderViewsKey = viewsKey;
  }
  views.forEach(view => {
    if (isTrainInfoView(view)) return;
    const chartId = `chart_${view}`;
    const ch = charts.get(chartId) || initChart(chartId);
    const meta = trainChartMeta(view);
    const option = trainChartOption(meta, currentFrame, trainChartDataCache[view]);
    if (option) ch.setOption(option, meta?.renderer !== "loss_surface_3d");
  });
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
  if (!trainData) return;
  stopAuto();
  timer = setInterval(() => {
    if (currentFrame >= trainData.history.length - 1) {
      stopAuto();
      return;
    }
    renderTrainFrame(currentFrame + 1);
  }, Number($("speed").value));
}

function stopAuto() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
