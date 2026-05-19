// Shared helpers for pluggable experiment pages.

function experimentCharts(schema) {
  return Array.isArray(schema?.charts) ? schema.charts : [];
}

function experimentChartMeta(schema, view) {
  return experimentCharts(schema).find(chart => chart.id === view) || null;
}

function experimentDefaultViews(schema) {
  return experimentCharts(schema).filter(chart => chart.default).map(chart => chart.id);
}

function experimentSelectedViews(name, fallbackViews = []) {
  const selected = selectedValues(name);
  return selected.length ? selected : fallbackViews;
}

function experimentViewKey(views = []) {
  return views.join("|");
}

function experimentEnsureChartGrid(gridId = "chartGrid") {
  let grid = $(gridId);
  if (!grid) {
    $("main").innerHTML = `
      <div class="chart-grid" id="${gridId}"></div>`;
    grid = $(gridId);
  }
  return grid;
}

function experimentRenderGridStack({
  grid,
  mode,
  views = [],
  loadLayout = () => ({}),
  defaultLayout = () => ({ x: 0, y: 0, w: 2, h: 2 }),
  normalizeLayout = null,
  htmlForView,
  minWidthForView = () => 1,
  minHeightForView = () => 1,
}) {
  if (!grid || !views.length) return;
  destroyDataGrid();
  disposeCharts();
  if (!window.GridStack) {
    grid.classList.remove("dashboard-grid", "grid-stack");
    grid.innerHTML = views.map(view => htmlForView(view)).join("");
    return;
  }
  dataGridMode = mode;
  grid.classList.add("dashboard-grid", "grid-stack");
  grid.classList.remove("single");
  const saved = loadLayout() || {};
  grid.innerHTML = views.map(view => {
    const base = saved[view] || defaultLayout(view);
    const layout = normalizeLayout ? normalizeLayout(view, base) : base;
    const minW = Math.max(1, Number(minWidthForView(view)) || 1);
    const minH = Math.max(1, Number(minHeightForView(view)) || 1);
    return `<div class="grid-stack-item" data-view="${escapeHtml(view)}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="${minW}" gs-min-h="${minH}"><div class="grid-stack-item-content">${htmlForView(view)}</div></div>`;
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

function experimentToggleSingleGrid(grid, views = []) {
  if (grid) grid.classList.toggle("single", views.length === 1);
}

function experimentSetModeSummary(summaryId, views = []) {
  const el = summaryId ? $(summaryId) : null;
  if (!el) return;
  el.textContent = views.length ? `Selected ${views.length} charts` : "No charts selected";
}

async function requestExperimentChartData({ contextId, page, views, state = {} }) {
  if (!contextId) return {};
  return await postJson("/api/chart_data", {
    context_id: contextId,
    page,
    charts: views,
    state,
  });
}

async function experimentLoadChartDataSafe(options, label = "chart_data") {
  try {
    return await requestExperimentChartData(options);
  } catch (err) {
    console.warn(`${label} fallback:`, err);
    return {};
  }
}

async function experimentPrepareChartRefresh({
  viewName,
  storageKey,
  summaryId,
  gridId = "chartGrid",
  contextId,
  page,
  state = {},
  fallbackViews = [],
  label = "chart_data",
}) {
  const views = experimentSelectedViews(viewName, fallbackViews);
  const viewsKey = experimentViewKey(views);
  if (storageKey) saveCheckedValues(viewName, storageKey);
  const grid = experimentEnsureChartGrid(gridId);
  experimentSetModeSummary(summaryId, views);
  experimentToggleSingleGrid(grid, views);
  const chartData = views.length
    ? await experimentLoadChartDataSafe({ contextId, page, views, state }, label)
    : {};
  return { views, viewsKey, grid, chartData };
}

async function experimentRefreshCharts({
  viewName,
  storageKey,
  summaryId,
  gridId = "chartGrid",
  contextId,
  page,
  state = {},
  fallbackViews = [],
  label = "chart_data",
  emptyHtml = `<div class="empty-state">&#35831;&#33267;&#23569;&#36873;&#25321;&#19968;&#20010;&#26174;&#31034;&#22270;&#34920;&#12290;</div>`,
  beforeRender = null,
  onChartData = null,
  renderDashboard = null,
  renderFallback = null,
  renderCharts = null,
}) {
  const refresh = await experimentPrepareChartRefresh({
    viewName,
    storageKey,
    summaryId,
    gridId,
    contextId,
    page,
    state,
    fallbackViews,
    label,
  });
  const { views, grid, chartData } = refresh;
  if (beforeRender) beforeRender(refresh);
  if (!views.length) {
    grid.innerHTML = emptyHtml;
    return refresh;
  }
  if (onChartData) onChartData(chartData, refresh);
  if (window.GridStack && renderDashboard) {
    renderDashboard(refresh);
  } else if (renderFallback) {
    renderFallback(refresh);
  }
  if (renderCharts) renderCharts(refresh);
  return refresh;
}
