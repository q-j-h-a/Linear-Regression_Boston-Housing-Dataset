// Predict Page.

async function renderPredictShell() {
  predictPageSchema = predictPageSchema || await loadPanelSchema("predict", {
    title: "控制面板",
    sections: []
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `
    <section class="hero-card">
      <div class="hero-line">
        <div>
          <div class="eyebrow">实验部分</div>
          <h2>模型预测</h2>
        </div>
      </div>
      <div class="chart-grid" id="chartGrid"></div>
    </section>`;
  $("rightPanel").innerHTML = renderPredictPanel(predictPageSchema);
  $("predictFeature").addEventListener("change", loadPrediction);
  $("predictStd").addEventListener("change", loadPrediction);
  $("predictRun").addEventListener("click", loadPrediction);
  $("predictInput").addEventListener("keydown", event => {
    if (event.key === "Enter") loadPrediction();
  });
  restoreCheckedValues("predictViews", "predictSelectedViewsV1");
  document.querySelectorAll('input[name="predictViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("predictViews", "predictSelectedViewsV1");
    renderPredictCharts();
  }));
}

async function loadPrediction() {
  const feature = $("predictFeature").value;
  $("topFeature").textContent = `当前特征 ${feature}`;
  try {
    predictData = await runAction("predict", {
      feature,
      value: Number($("predictInput").value || 0),
      use_standardized: $("predictStd").value === "1" || $("predictStd").value === "true"
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
  destroyDataGrid();
  disposeCharts();
  const views = selectedValues("predictViews");
  saveCheckedValues("predictViews", "predictSelectedViewsV1");
  let grid = $("chartGrid");
  if (!grid) {
    $("main").innerHTML = `
      <section class="hero-card">
        <div class="hero-line">
          <div>
            <div class="eyebrow">实验部分</div>
            <h2>模型预测</h2>
          </div>
        </div>
        <div class="chart-grid" id="chartGrid"></div>
      </section>`;
    grid = $("chartGrid");
  }
  $("predictModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择显示模式";
  grid.classList.toggle("single", views.length === 1);
  grid.classList.remove("dashboard-grid", "grid-stack");
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
  if (window.GridStack) {
    renderPredictDashboard(grid, views);
  } else {
    grid.innerHTML = views.map(view => predictViewHtml(view, predictChartDataCache[view])).join("");
  }
  views.forEach(view => {
    const meta = predictChartMeta(view);
    if (meta?.renderer !== "predict_chart") return;
    const ch = initChart(`chart_${view}`);
    ch.setOption(predictChartOption(predictChartDataCache[view]), true);
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
    result: { x: 0, y: 0, w: 1, h: 1 },
    calc: { x: 1, y: 0, w: 3, h: 1 },
    chart: { x: 0, y: 1, w: 3, h: 2 },
    nearby: { x: 3, y: 1, w: 1, h: 2 }
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
