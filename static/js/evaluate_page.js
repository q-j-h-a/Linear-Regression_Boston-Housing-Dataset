// Evaluate Page.

function evaluateChartMeta(view) {
  return experimentChartMeta(evaluatePageSchema, view);
}

function evaluateDefaultViews() {
  return experimentDefaultViews(evaluatePageSchema);
}

function renderEvaluateDashboard(grid, views) {
  experimentRenderGridStack({
    grid,
    mode: "evaluate",
    views,
    loadLayout: loadEvaluateGridLayout,
    defaultLayout: defaultEvaluateGridLayout,
    normalizeLayout: normalizeEvaluateGridLayout,
    htmlForView: view => evaluateViewHtml(view, evaluateChartDataCache[view]),
  });
}

function defaultEvaluateGridLayout(view) {
  return ({
    model_fit: { x: 0, y: 0, w: 2, h: 2 },
    rmse: { x: 2, y: 0, w: 1, h: 2 },
    mae: { x: 3, y: 0, w: 1, h: 2 },
    r2: { x: 0, y: 2, w: 1, h: 2 },
    explanation: { x: 1, y: 2, w: 3, h: 2 },
  })[view] || { x: 0, y: 0, w: 1, h: 1 };
}

function normalizeEvaluateGridLayout(view, layout) {
  const next = { ...defaultEvaluateGridLayout(view), ...layout };
  next.w = Math.max(1, Math.min(4, Number(next.w) || 1));
  next.h = Math.max(1, Number(next.h) || 1);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}

function evaluatePanelHtml(schema) {
  const charts = experimentCharts(schema);
  const options = charts.map(chart => ({
    label: chart.title || chart.id,
    value: chart.id,
    default: Boolean(chart.default),
  }));
  return `
    <div class="right-title">${escapeHtml(schema.panel?.title || "模型评估")}</div>
    <div class="control-card">
      <div class="mini-stats">
        <div class="mini-stat"><span>数据集</span><strong id="evaluateDataset">--</strong></div>
        <div class="mini-stat"><span>特征</span><strong id="evaluateFeature">--</strong></div>
        <div class="mini-stat"><span>评估轮次</span><strong id="evaluateEpoch">--</strong></div>
      </div>
      <div class="control-group" aria-label="评估状态">
        <label class="control-label">当前模型</label>
        <div class="formula-box" id="evaluateModelStatus">请先在“模型训练”页完成一次训练。</div>
      </div>
      <div class="control-group" aria-label="评估视图">
        <label class="control-label">评估视图</label>
        <details class="mode-menu">
          <summary id="evaluateModeSummary">已选择 1 项</summary>
          <div class="check-list">${checkboxOptionsHtml("evaluateViews", options)}</div>
        </details>
      </div>
    </div>`;
}

function evaluateEmptyState() {
  $("main").innerHTML = `
    <div class="empty-state">
      请先在“数据预处理”页加载数据集，并在“模型训练”页完成一次训练。
    </div>`;
  if ($("evaluateModelStatus")) {
    $("evaluateModelStatus").textContent = "评估页会复用最近一次训练得到的模型参数和训练上下文。";
  }
}

function updateEvaluateSummary() {
  const frame = trainData?.history?.[currentFrame] || trainData?.history?.[trainData.history.length - 1] || null;
  if ($("evaluateDataset")) $("evaluateDataset").textContent = trainData?.dataset_label || currentDatasetMeta?.label || "--";
  if ($("evaluateFeature")) $("evaluateFeature").textContent = trainData?.feature || "--";
  if ($("evaluateEpoch")) $("evaluateEpoch").textContent = frame?.epoch ?? "--";
  if ($("evaluateModelStatus")) {
    if (!trainData || !frame) {
      $("evaluateModelStatus").textContent = "请先在“模型训练”页完成一次训练。";
      return;
    }
    $("evaluateModelStatus").textContent = `w = ${num(frame.w, 6)}, b = ${num(frame.b, 6)}
RMSE = ${num(frame.rmse, 4)}, MAE = ${num(frame.mae, 4)}, R² = ${num(frame.r2, 4)}`;
  }
}

async function renderEvaluateShell() {
  evaluatePageSchema = evaluatePageSchema || await loadPanelSchema("evaluate", {
    title: "模型评估",
    sections: [],
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `<div class="chart-grid" id="chartGrid"></div>`;
  $("rightPanel").innerHTML = evaluatePanelHtml(evaluatePageSchema);
  restoreCheckedValues("evaluateViews", "evaluateSelectedViewsV1");
  document.querySelectorAll('input[name="evaluateViews"]').forEach(el => {
    el.addEventListener("change", () => {
      saveCheckedValues("evaluateViews", "evaluateSelectedViewsV1");
      renderEvaluation();
    });
  });
  if (!trainData) {
    evaluateEmptyState();
    updateEvaluateSummary();
    return;
  }
  updateEvaluateSummary();
  await renderEvaluation();
}

function evaluateViewHtml(view, chartData = null) {
  const meta = evaluateChartMeta(view);
  const title = meta?.title || view;
  const sub = meta?.subtitle || "";
  if (meta?.renderer === "evaluation_explanation") {
    return `<section class="chart-card wide">
      <div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div><div class="chart-sub">${escapeHtml(sub)}</div></div></div>
      <div style="padding:18px">${evaluateExplanationHtml(chartData)}</div>
    </section>`;
  }
  return chartCardHtml(view, title, sub, meta?.size || "");
}

function evaluateExplanationHtml(data = null) {
  if (!data) return `<div class="formula-box">暂无评估解释。</div>`;
  const notes = (data.notes || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  return `<div class="best-param-grid">
    <div class="best-param"><span>判断</span><strong>${escapeHtml(data.quality || "--")}</strong></div>
    <div class="best-param"><span>RMSE</span><strong>${num(data.rmse, 4)}</strong></div>
    <div class="best-param"><span>MAE</span><strong>${num(data.mae, 4)}</strong></div>
    <div class="best-param"><span>R²</span><strong>${num(data.r2, 4)}</strong></div>
  </div>
  <div class="formula-box"><ul>${notes}</ul></div>`;
}

async function renderEvaluation() {
  if (!trainData) {
    evaluateEmptyState();
    return;
  }
  const frameIndex = Math.max(0, Math.min(currentFrame, trainData.history.length - 1));
  const frame = trainData.history[frameIndex];
  updateEvaluateSummary();
  await experimentRefreshCharts({
    viewName: "evaluateViews",
    storageKey: "evaluateSelectedViewsV1",
    summaryId: "evaluateModeSummary",
    contextId: trainData.context_id,
    page: "evaluate",
    state: { frame_index: frameIndex },
    fallbackViews: evaluateDefaultViews(),
    label: "evaluate chart_data",
    beforeRender: ({ views, grid }) => {
      if (!views.length) {
        destroyDataGrid();
        disposeCharts();
        evaluateRenderViewsKey = "";
        grid.classList.remove("dashboard-grid", "grid-stack");
      }
    },
    onChartData: chartData => {
      evaluateChartDataCache = chartData;
    },
    renderDashboard: ({ grid, views, viewsKey }) => {
      destroyDataGrid();
      disposeCharts();
      grid.classList.remove("dashboard-grid", "grid-stack");
      renderEvaluateDashboard(grid, views);
      evaluateRenderViewsKey = viewsKey;
    },
    renderFallback: ({ grid, views, viewsKey }) => {
      destroyDataGrid();
      disposeCharts();
      grid.classList.remove("dashboard-grid", "grid-stack");
      grid.innerHTML = views.map(view => evaluateViewHtml(view, evaluateChartDataCache[view])).join("");
      evaluateRenderViewsKey = viewsKey;
    },
    renderCharts: ({ views }) => {
      views.forEach(view => {
        const meta = evaluateChartMeta(view);
        if (!meta || meta.kind === "info" || meta.renderer === "evaluation_explanation") return;
        const chartId = `chart_${view}`;
        const ch = charts.get(chartId) || initChart(chartId);
        const option = trainChartOption(meta, frameIndex, evaluateChartDataCache[view]);
        if (option) setChartOptionWhenReady(ch, option, meta.renderer !== "loss_surface_3d");
      });
    },
  });
  if ($("evaluateEpoch")) $("evaluateEpoch").textContent = frame?.epoch ?? "--";
}
