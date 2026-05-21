// Evaluate Page.

const EVALUATE_METRICS = [
  { id: "rmse", label: "RMSE" },
  { id: "mae", label: "MAE" },
  { id: "r2", label: "R²" },
];

function evaluateMetricMode() {
  const saved = viewStateStore.evaluateMetricModeV1;
  return EVALUATE_METRICS.some(item => item.id === saved) ? saved : "rmse";
}

function evaluatePanelHtml() {
  return `<div class="right-title">\u63a7\u5236\u9762\u677f</div>`;
}

function defaultEvaluateGridLayout(view) {
  return ({
    evaluate_fit: { x: 0, y: 0, w: 2, h: 2 },
    evaluate_metric: { x: 2, y: 0, w: 2, h: 2 },
  })[view] || { x: 0, y: 0, w: 2, h: 2 };
}

function normalizeEvaluateGridLayout(view, layout) {
  const next = { ...defaultEvaluateGridLayout(view), ...layout };
  next.w = Math.max(1, Math.min(4, Number(next.w) || 2));
  next.h = Math.max(1, Number(next.h) || 2);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}

function evaluateEmptyState() {
  destroyDataGrid();
  disposeCharts();
  $("main").innerHTML = `
    <div class="empty-state">
      \u8bf7\u5148\u5728\u201c\u6a21\u578b\u8bad\u7ec3\u201d\u9875\u5b8c\u6210\u4e00\u6b21\u8bad\u7ec3\uff0c\u8bc4\u4f30\u9875\u4f1a\u590d\u7528\u6700\u8fd1\u4e00\u6b21\u8bad\u7ec3\u5f97\u5230\u7684\u6a21\u578b\u53c2\u6570\u548c\u8bad\u7ec3\u4e0a\u4e0b\u6587\u3002
    </div>`;
}

async function renderEvaluateShell() {
  evaluatePageSchema = evaluatePageSchema || await loadPanelSchema("evaluate", {
    title: "\u6a21\u578b\u8bc4\u4f30",
    sections: [],
  });
  document.querySelector(".shell").classList.remove("theory");
  $("rightPanel").innerHTML = evaluatePanelHtml();
  if (!trainData) {
    evaluateEmptyState();
    return;
  }
  renderEvaluation();
}

function renderEvaluation() {
  if (!trainData) {
    evaluateEmptyState();
    return;
  }
  const grid = ensureEvaluateGrid();
  const viewsKey = evaluateMetricMode();
  if (evaluateRenderViewsKey !== viewsKey || !charts.get("chart_evaluate_fit") || !charts.get("chart_evaluate_metric")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "evaluate";
    grid.innerHTML = evaluateGridHtml();
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
    bindEvaluateMetricControls();
    evaluateRenderViewsKey = viewsKey;
  }

  const frameIndex = evaluateFrameIndex();
  const fit = charts.get("chart_evaluate_fit") || initChart("chart_evaluate_fit");
  fit.setOption(evaluateFitOption(frameIndex), true);

  const metric = charts.get("chart_evaluate_metric") || initChart("chart_evaluate_metric");
  metric.setOption(evaluateGaugeOnlyOption(evaluateMetricMode(), frameIndex), true);
  updateEvaluateExplanation();
  requestAnimationFrame(() => charts.forEach(ch => ch.resize()));
}

function ensureEvaluateGrid() {
  if (!$("evaluateWrap")) {
    destroyDataGrid();
    disposeCharts();
    dataGridMode = "";
    $("main").innerHTML = `<div class="dashboard-grid grid-stack" id="evaluateWrap"></div>`;
    evaluateRenderViewsKey = "";
  }
  return $("evaluateWrap");
}

function evaluateGridHtml() {
  const saved = loadEvaluateGridLayout();
  const items = [
    { id: "evaluate_fit", layout: { x: 0, y: 0, w: 2, h: 2 }, html: evaluateFitCardHtml() },
    { id: "evaluate_metric", layout: { x: 2, y: 0, w: 2, h: 2 }, html: evaluateMetricCardHtml() },
  ];
  return items.map(item => {
    const layout = normalizeEvaluateGridLayout(item.id, saved[item.id] || item.layout);
    return `<div class="grid-stack-item" data-view="${escapeHtml(item.id)}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${item.html}</div></div>`;
  }).join("");
}

function evaluateFitCardHtml() {
  return `<section class="chart-card chart-interaction-prototype" data-chart-card="evaluate_fit">
    <div class="chart-head">
      <div><div class="chart-title">\u6807\u51c6\u5316\u6563\u70b9\u56fe</div><div class="chart-sub">\u540c\u6b65\u81ea\u5b9a\u4e49\u53c2\u6570\u8bad\u7ec3\u4e2d\u7684\u5f53\u524d\u6a21\u578b\u62df\u5408\u6548\u679c</div></div>
    </div>
    <div class="chart" id="chart_evaluate_fit"></div>
  </section>`;
}

function evaluateMetricCardHtml() {
  const mode = evaluateMetricMode();
  return `<section class="chart-card chart-interaction-prototype evaluation-metric-card" data-chart-card="evaluate_metric">
    <div class="chart-head">
      <div><div class="chart-title">\u8bc4\u4f30\u6307\u6807\u56fe</div><div class="chart-sub">\u5207\u6362 RMSE\u3001MAE \u548c R²\uff0c\u89c2\u5bdf\u5f53\u524d\u6a21\u578b\u7684\u8bc4\u4f30\u7ed3\u679c</div></div>
    </div>
    <div class="chart-toolbar">
      <div class="segmented-control" role="group" aria-label="\u8bc4\u4f30\u6307\u6807\u9009\u62e9">
        ${EVALUATE_METRICS.map(item => `<button class="seg-btn${item.id === mode ? " active" : ""}" type="button" data-evaluate-metric="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")}
      </div>
    </div>
    <div class="chart" id="chart_evaluate_metric"></div>
    <div class="loss-formula-note evaluate-explanation-note" id="evaluateExplanationNote"></div>
  </section>`;
}

function bindEvaluateMetricControls() {
  document.querySelectorAll("[data-evaluate-metric]").forEach(btn => {
    btn.addEventListener("click", () => {
      viewStateStore.evaluateMetricModeV1 = btn.dataset.evaluateMetric;
      evaluateRenderViewsKey = "";
      renderEvaluation();
    });
  });
}

function evaluateFrameIndex() {
  if (!trainData?.history?.length) return 0;
  return Math.max(0, Math.min(currentFrame, trainData.history.length - 1));
}

function evaluateFitOption(frameIndex) {
  const frame = trainData.history[frameIndex];
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

function evaluateGaugeOnlyOption(key, frameIndex) {
  const rows = trainData.history.slice(0, frameIndex + 1);
  const current = rows[rows.length - 1]?.[key] ?? 0;
  const config = metricGaugeConfig(key, rows);
  return {
    tooltip: {
      formatter: () => `${escapeHtml(config.label)}<br>${num(current, 4)}`
    },
    series: [
      {
        name: config.label,
        type: "gauge",
        center: ["50%", "54%"],
        radius: "82%",
        startAngle: 205,
        endAngle: -25,
        min: config.min,
        max: config.max,
        splitNumber: 5,
        progress: {
          show: true,
          width: 14,
          itemStyle: { color: config.color }
        },
        axisLine: {
          lineStyle: {
            width: 14,
            color: [[1, "#e8ecf4"]]
          }
        },
        axisTick: { distance: -20, length: 5, lineStyle: { color: "#8b95a5", width: 1 } },
        splitLine: { distance: -22, length: 10, lineStyle: { color: "#8b95a5", width: 1.2 } },
        axisLabel: { distance: -6, color: "#6b7280", fontSize: 10 },
        pointer: { length: "58%", width: 5, itemStyle: { color: "#172033" } },
        anchor: { show: true, size: 8, itemStyle: { color: "#172033" } },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "28%"],
          fontSize: 24,
          fontWeight: 900,
          color: "#172033",
          formatter: () => Number(current).toFixed(2)
        },
        title: {
          offsetCenter: [0, "46%"],
          fontSize: 12,
          fontWeight: 800,
          color: "#6b7280"
        },
        data: [{ value: config.gaugeValue(current), name: config.label }]
      }
    ]
  };
}

function updateEvaluateExplanation() {
  const el = $("evaluateExplanationNote");
  if (!el || !trainData?.history?.length) return;
  const frame = trainData.history[evaluateFrameIndex()];
  const mode = evaluateMetricMode();
  const quality = evaluateQuality(frame);
  const value = mode === "rmse" ? frame.rmse : mode === "mae" ? frame.mae : frame.r2;
  const text = ({
    rmse: `RMSE = ${num(value, 4)}，越小表示整体预测偏差越小；它会放大较大的误差，所以能提醒模型是否存在明显偏离点。`,
    mae: `MAE = ${num(value, 4)}，越小表示平均绝对误差越小；它比 RMSE 更直观，表示一次预测通常会偏离多少。`,
    r2: `R² = ${num(value, 4)}，越接近 1 表示模型解释能力越强；接近 0 说明当前特征和直线对目标值解释有限。`,
  })[mode];
  el.innerHTML = `<span>\u5224\u65ad</span><strong>${escapeHtml(quality)}</strong><span>${escapeHtml(text)}</span>`;
}

function evaluateQuality(frame) {
  const r2 = Number(frame?.r2 ?? 0);
  if (r2 >= 0.7) return "\u62df\u5408\u8f83\u597d";
  if (r2 >= 0.3) return "\u62df\u5408\u4e00\u822c";
  return "\u62df\u5408\u8f83\u5f31";
}
