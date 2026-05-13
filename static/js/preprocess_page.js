// Preprocess Page.

async function renderDataShell() {
  preprocessPageSchema = preprocessPageSchema || await loadPanelSchema("preprocess", {
    title: "控制面板",
    sections: [
      { id: "dataset", controls: [
        { type: "stat", label: "样本总数", value_id: "sampleCount" },
        { type: "stat", label: "特征数量", value_id: "featureCount", default: FEATURE_NAMES.length },
        { type: "select", name: "feature", label: "特征选择", element_id: "dataFeature", source: "feature_columns" }
      ] },
      { id: "display", controls: [{ type: "chart_selector", name: "dataViews", label: "显示模式", summary_id: "dataModeSummary", options: [
        { label: "原始散点图", value: "raw", default: true },
        { label: "预处理散点图", value: "standardized" },
        { label: "单特征线性相关系数", value: "single_corr" },
        { label: "全特征线性相关系数", value: "all_corr" }
      ] }] }
    ]
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `
    <section class="hero-card">
      <div class="hero-line">
        <div>
          <div class="eyebrow">实验部分</div>
          <h2>数据预处理</h2>
        </div>
      </div>
      <div class="chart-grid" id="chartGrid"></div>
  </section>`;
  $("rightPanel").innerHTML = renderPreprocessPanel(preprocessPageSchema);
  restoreDataFormState();
  $("dataFeature").addEventListener("change", loadDataView);
  restoreCheckedValues("dataViews", "preprocessSelectedViewsV1");
  document.querySelectorAll('input[name="dataViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("dataViews", "preprocessSelectedViewsV1");
    renderDataCharts();
  }));
}

function persistDataFormState() {
  if ($("dataFeature")) viewStateStore.preprocessFormStateV1 = { feature: $("dataFeature").value };
}

function restoreDataFormState() {
  const state = viewStateStore.preprocessFormStateV1 || {};
  if ($("dataFeature") && state.feature && FEATURE_NAMES.includes(state.feature)) {
    $("dataFeature").value = state.feature;
  } else if ($("dataFeature") && dataCache?.feature) {
    $("dataFeature").value = dataCache.feature;
  }
}

function restoreDataView() {
  restoreDataFormState();
  if ($("sampleCount")) $("sampleCount").textContent = dataCache?.raw?.summary?.sample_count ?? "--";
  if ($("featureCount")) $("featureCount").textContent = dataCache?.correlations?.length ?? FEATURE_NAMES.length;
  if (dataCache?.feature) $("topFeature").textContent = `当前特征 ${dataCache.feature}`;
  renderDataCharts();
}

async function loadDataView() {
  const feature = $("dataFeature").value;
  persistDataFormState();
  $("topFeature").textContent = `当前特征 ${feature}`;
  try {
    dataCache = await runAction("data_view", { feature });
    $("sampleCount").textContent = dataCache.raw.summary.sample_count;
    $("featureCount").textContent = dataCache.correlations.length;
    renderDataCharts();
  } catch (err) {
    renderError(err.message);
  }
}

async function loadDataChartData(views) {
  if (!dataCache?.context_id) return {};
  return await postJson("/api/chart_data", {
    context_id: dataCache.context_id,
    page: "preprocess",
    charts: views,
    state: {},
  });
}

async function renderDataCharts() {
  if (!dataCache) return;
  destroyDataGrid();
  disposeCharts();
  const views = selectedValues("dataViews");
  saveCheckedValues("dataViews", "preprocessSelectedViewsV1");
  const grid = $("chartGrid");
  $("dataModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择显示模式";
  grid.classList.toggle("single", views.length === 1);
  grid.classList.remove("dashboard-grid", "grid-stack");
  if (!views.length) {
    grid.innerHTML = `<div class="empty-state">请选择至少一个显示模式。</div>`;
    return;
  }
  try {
    dataChartDataCache = await loadDataChartData(views);
  } catch (err) {
    dataChartDataCache = {};
    console.warn("preprocess chart_data fallback:", err);
  }
  if (window.GridStack) {
    renderDataDashboard(grid, views);
  } else {
    grid.innerHTML = views.map(view => chartCardHtml(view, chartTitle(view), chartSub(view, dataCache), dataCardSize(view))).join("");
  }
  views.forEach(view => {
    const ch = initChart(`chart_${view}`);
    const option = preprocessChartOption(preprocessChartMeta(view), dataChartDataCache[view]);
    if (option) ch.setOption(option, true);
  });
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
