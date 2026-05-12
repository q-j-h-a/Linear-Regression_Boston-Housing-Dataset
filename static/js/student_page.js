// Student Page.

function studentStandardizedReady() {
  return Boolean(studentMeta?.standardized_ready || studentMeta?.source_type === "standardized");
}

function studentTargetValue(columns = studentMeta?.numeric_columns || []) {
  const live = $("studentTarget")?.value;
  const saved = studentMeta?.target;
  if (live && columns.includes(live)) return live;
  if (saved && columns.includes(saved)) return saved;
  return columns[columns.length - 1] || "";
}

function studentFeatureSet(features = [], target = "") {
  const live = studentSelectedFeatures().filter(col => features.includes(col) && col !== target);
  const saved = Array.isArray(studentMeta?.features)
    ? studentMeta.features.filter(col => features.includes(col) && col !== target)
    : [];
  const selected = live.length ? live : (saved.length ? saved : features.slice(0, Math.min(4, features.length)));
  return new Set(selected);
}

function studentStdSelectValue() {
  if (!studentStandardizedReady()) return "0";
  const live = $("studentStd")?.value;
  if (live === "0" || live === "1") return live;
  return studentMeta?.source_type === "standardized" ? "1" : "0";
}

function studentUseStandardized() {
  return studentStandardizedReady() && studentStdSelectValue() === "1";
}

function studentFeatureVersionLabel() {
  return studentUseStandardized() ? "标准化特征" : "原始特征";
}

function studentAllowedDataViews(views) {
  const allowed = new Set(["raw", "corr"]);
  if (studentStandardizedReady()) {
    allowed.add("standardized");
    allowed.add("table");
  }
  return views.filter(view => allowed.has(view));
}

function currentStudentTrainFrame(payload) {
  if (!studentTrainData || studentTrainDirty || !payload) return null;
  if (studentTrainData.feature !== payload.feature) return null;
  if (studentTrainData.use_standardized !== payload.use_standardized) return null;
  return studentTrainData.history[studentCurrentFrame] || studentTrainData.history[studentTrainData.history.length - 1] || null;
}

async function renderStudentShell() {
  studentPageSchema = studentPageSchema || await loadPanelSchema("student", {
    title: "自主实验",
    sections: []
  });
  document.querySelector(".shell").classList.remove("theory");
  $("main").innerHTML = `
    <section class="hero-card">
      <div class="hero-line">
        <div>
          <div class="eyebrow">实验部分</div>
          <h2>自主实验</h2>
          <p class="lead">上传自己的 CSV 数据集，选择目标列和特征列，然后按数据预处理、模型训练与评估、模型预测的顺序完成一次完整实验。</p>
        </div>
      </div>
      <div id="studentWorkspace"></div>
    </section>`;
  renderStudentPanel();
  renderStudentWorkspace();
  restoreStudentWorkspaceState();
}

function renderStudentPanel() {
  const standardizedReady = studentStandardizedReady();
  $("rightPanel").innerHTML = studentPanelHtml();
  applyStudentSchemaPanelParts(standardizedReady);
  restoreCheckedValues("studentDataViews", "studentDataSelectedViewsV1");
  restoreCheckedValues("studentTrainViews", "studentTrainSelectedViewsV1");
  restoreCheckedValues("studentPredictViews", "studentPredictSelectedViewsV1");
  $("studentUploadBtn").addEventListener("click", uploadStudentDataset);
  if (!studentMeta) return;
  restoreStudentFormState();
  $("studentTarget").addEventListener("change", () => {
    const nextTarget = $("studentTarget").value;
    const state = viewStateStore.studentFormStateV1 || {};
    state.studentTarget = nextTarget;
    delete state.studentFeature;
    delete state.studentFeatures;
    viewStateStore.studentFormStateV1 = state;
    studentMeta.target = nextTarget;
    studentMeta.features = [];
    studentData = null;
    studentTrainData = null;
    studentPredictData = null;
    studentTrainDirty = false;
    renderStudentPanel();
    renderStudentWorkspace();
  });
  document.querySelectorAll('input[name="studentFeatures"]').forEach(el => el.addEventListener("change", () => {
    updateStudentFeatureSelect();
    studentMeta.features = studentSelectedFeatures();
    refreshStudentStageStrip();
    studentData = null;
    studentTrainData = null;
    studentPredictData = null;
    studentTrainDirty = false;
  }));
  updateStudentFeatureSelect();
  $("studentPrepareDataBtn").addEventListener("click", prepareStudentDataView);
  $("studentPreprocessBtn").addEventListener("click", preprocessStudentDataset);
  $("studentDataBtn").addEventListener("click", loadStudentDataView);
  $("studentTrainBtn").addEventListener("click", prepareStudentTraining);
  $("studentResetBtn").addEventListener("click", () => {
    stopAuto();
    if (studentTrainDirty) return showStudentMessage("训练参数已修改，请先重新点击“准备训练”。", true);
    renderStudentTrainFrame(0);
  });
  $("studentStepBtn").addEventListener("click", () => {
    if (studentTrainDirty) return showStudentMessage("训练参数已修改，请先重新点击“准备训练”。", true);
    renderStudentTrainFrame(studentCurrentFrame + 1);
  });
  $("studentAutoBtn").addEventListener("click", startStudentAuto);
  $("studentPauseBtn").addEventListener("click", stopAuto);
  $("studentSpeed").addEventListener("input", () => $("studentSpeedText").textContent = `${$("studentSpeed").value}ms`);
  $("studentLr").addEventListener("input", () => $("studentLrText").textContent = Number($("studentLr").value).toFixed(3));
  $("studentEpochs").addEventListener("input", () => $("studentEpochsText").textContent = $("studentEpochs").value);
  bindRangeStepperButtons();
  ["studentStd", "studentW0", "studentB0", "studentLr", "studentEpochs"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("change", markStudentTrainingDirty);
  });
  $("studentFeature").addEventListener("change", markStudentTrainingDirty);
  $("studentPreparePredictBtn").addEventListener("click", prepareStudentPredictionView);
  $("studentPredictBtn").addEventListener("click", loadStudentPrediction);
  document.querySelectorAll('input[name="studentDataViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("studentDataViews", "studentDataSelectedViewsV1");
    if (studentData) renderStudentDataDashboard();
  }));
  document.querySelectorAll('input[name="studentTrainViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("studentTrainViews", "studentTrainSelectedViewsV1");
    if (studentTrainData) renderStudentTrainFrame(studentCurrentFrame);
  }));
  document.querySelectorAll('input[name="studentPredictViews"]').forEach(el => el.addEventListener("change", () => {
    saveCheckedValues("studentPredictViews", "studentPredictSelectedViewsV1");
    if (studentPredictData) renderStudentPredictDashboard();
  }));
}

function studentFormatCardHtml(message = "") {
  const rawRows = [
    { area: 80, rooms: 2, price: 120 },
    { area: 100, rooms: 3, price: 160 },
    { area: 120, rooms: 3, price: 180 }
  ];
  const stdRows = [
    { area: 80, rooms: 2, price: 120, area_standardized: -1.1355, rooms_standardized: -1.2247 },
    { area: 100, rooms: 3, price: 160, area_standardized: -0.1622, rooms_standardized: 0 },
    { area: 120, rooms: 3, price: 180, area_standardized: 0.8111, rooms_standardized: 0 }
  ];
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据格式</div>
        <div class="chart-sub">CSV 列名、原始数据和预处理数据示例</div>
      </div>
    </div>
    <div class="info-card-body" style="padding:18px">
      <div class="format-grid">
        <div>
          <p>CSV 第一行必须是列名，至少包含 1 个数值特征列和 1 个数值目标列。原始数据集可以点击预处理生成 <code>特征名_standardized</code> 列；已预处理数据集建议保留原始特征列、目标列和对应标准化列。</p>
          <div class="format-points">
            <div class="format-point"><strong>原始数据集</strong>只需要原始特征列和目标列，例如 <code>area</code>、<code>rooms</code>、<code>price</code>。</div>
            <div class="format-point"><strong>已预处理数据集</strong>需要同时包含原始特征列、目标列和 <code>特征名_standardized</code> 列。</div>
          </div>
        </div>
        <div>
          <p class="sample-caption">原始 CSV 示例</p>
          ${studentPreviewTable(rawRows)}
          <p class="sample-caption" style="margin-top:14px">预处理后 CSV 示例</p>
          ${studentPreviewTable(stdRows)}
        </div>
      </div>
      ${message ? `<p class="status-line">${escapeHtml(message)}</p>` : ""}
    </div>
  </section>`;
}

function studentUploadPlaceholderHtml() {
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据集上传</div>
        <div class="chart-sub">在右侧选择 CSV 文件并点击“加载数据集”</div>
      </div>
    </div>
    <div class="empty-state">请先在右侧上传 CSV 数据集。</div>
  </section>`;
}

function studentPreviewCardHtml() {
  const preview = studentMeta?.preview || [];
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据预览</div>
        <div class="chart-sub">检测到 ${escapeHtml(studentMeta?.row_count ?? "--")} 行，数值列 ${escapeHtml(studentMeta?.numeric_columns?.length ?? "--")} 个</div>
      </div>
    </div>
    <div class="info-card-body" style="padding:18px">
      ${studentPreviewTable(preview)}
    </div>
  </section>`;
}

function renderStudentWorkspace(message = "") {
  $("studentWorkspace").innerHTML = `
    ${studentMeta ? studentStageStrip() : ""}
    <div class="chart-grid" id="studentChartGrid"></div>`;
  renderStudentGrid(studentMeta ? ["format", "preview"] : ["format", "upload"], view => {
    if (view === "format") return studentFormatCardHtml(message);
    if (view === "preview") return studentPreviewCardHtml();
    return studentUploadPlaceholderHtml();
  });
}

function restoreStudentWorkspaceState() {
  if (!studentMeta) return;
  if (studentStageKind === "predict" && studentPredictData) {
    renderStudentPredictDashboard();
    return;
  }
  if (studentStageKind === "train" && studentTrainData) {
    renderStudentTrainFrame(studentCurrentFrame);
    return;
  }
  if (studentStageKind === "data" && studentData) {
    if (studentData.raw || studentData.context_id) renderStudentDataDashboard();
    else renderStudentStandardizeTable(studentData.standardize_table || []);
  }
}

function refreshStudentStageStrip() {
  const strip = $("studentStageStrip");
  if (strip) strip.outerHTML = studentStageStrip();
}

function showStudentMessage(message, isError = false) {
  const grid = $("studentChartGrid");
  if (grid) {
    grid.classList.remove("dashboard-grid", "grid-stack");
    grid.innerHTML = `<div class="status-line ${isError ? "error" : ""}">${escapeHtml(message)}</div>`;
  }
}

function markStudentTrainingDirty() {
  refreshStudentStageStrip();
  if (!studentTrainData) return;
  studentTrainDirty = true;
  stopAuto();
  showStudentMessage("训练参数已修改，请重新点击“准备训练”生成新的训练过程。");
}

function studentSelectedFeatures() {
  return [...document.querySelectorAll('input[name="studentFeatures"]:checked')].map(el => el.value);
}

function updateStudentFeatureSelect() {
  const select = $("studentFeature");
  if (!select) return;
  const selected = studentSelectedFeatures();
  const current = select.value;
  const selectedValue = selected.includes(current) ? current : selected[0];
  select.innerHTML = selected.map(col => optionHtml(col, selectedValue)).join("");
}

function studentPayload(extra = {}) {
  const features = studentSelectedFeatures();
  const useStandardized = studentUseStandardized();
  return {
    dataset_id: studentMeta?.dataset_id,
    target: $("studentTarget")?.value,
    features,
    feature: $("studentFeature")?.value || features[0],
    use_standardized: useStandardized,
    ...extra
  };
}

async function uploadStudentDataset() {
  const file = $("studentFile").files?.[0];
  if (!file) {
    renderStudentWorkspace("请先选择一个 CSV 文件。");
    return;
  }
  const btn = $("studentUploadBtn");
  const status = $("studentStatus");
  const message = $("studentUploadMessage");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "加载中...";
  }
  if (status) status.textContent = "加载中";
  if (message) {
    message.classList.remove("hidden", "error");
    message.textContent = "正在读取 CSV，请稍等。";
  }
  const formData = new FormData();
  formData.append("action", "student_upload");
  formData.append("file", file);
  formData.append("source_type", $("studentSourceType").value);
  try {
    const resp = await fetch("/api/run_action", { method: "POST", body: formData });
    const text = await resp.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(`上传接口没有返回 JSON，状态码 ${resp.status}。请重启 Flask 服务后再试。`);
    }
    if (!resp.ok) throw new Error(data.error || `上传失败，状态码 ${resp.status}`);
    studentMeta = data;
    studentMeta.standardized_ready = data.source_type === "standardized";
    studentMeta.target = "";
    studentMeta.features = [];
    studentData = null;
    studentPredictData = null;
    studentTrainData = null;
    studentPredictData = null;
    studentStage = "数据集";
    studentStageKind = "dataset";
    studentTrainDirty = false;
    renderStudentPanel();
    renderStudentWorkspace("数据集已加载，请选择目标列和特征列。");
  } catch (err) {
    if (status) status.textContent = "加载失败";
    if (message) {
      message.classList.remove("hidden");
      message.classList.add("error");
      message.textContent = err.message || "上传失败。";
    }
    renderStudentWorkspace(err.message || "上传失败。");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "加载数据集";
    }
  }
}

function prepareStudentDataView() {
  studentStage = "数据预处理";
  studentStageKind = "data";
  renderStudentWorkspace(studentStandardizedReady() ? "已准备数据预处理区域。可以查看原始数据、预处理数据和标准化表。" : "已准备数据预处理区域。当前先使用原始特征，点击“预处理”后可以查看标准化结果。");
  const views = studentAllowedDataViews(selectedValues("studentDataViews"));
  renderStudentGrid(views.length ? views : studentAllowedDataViews(["raw", "standardized", "corr"]), view => {
    if (view === "raw") return chartCardHtml("student_raw", "原始散点图", "点击“看数据”后显示当前特征与目标列的原始关系");
    if (view === "standardized") return chartCardHtml("student_standardized", "预处理散点图", "点击“预处理”或“看数据”后显示标准化特征关系");
    if (view === "corr") return chartCardHtml("student_corr", "相关系数", "点击“看数据”后显示已选特征与目标列的相关性");
    return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">标准化表</div><div class="chart-sub">点击“预处理”后生成</div></div></div><div style="padding:18px"><div class="empty-state">等待预处理结果。</div></div></section>`;
  });
}

async function preprocessStudentDataset() {
  try {
    studentStage = "数据预处理";
    studentStageKind = "data";
    const data = await runAction("student_preprocess", studentPayload());
    studentMeta.preview = data.preview;
    studentMeta.row_count = data.row_count;
    studentMeta.target = data.target;
    studentMeta.features = data.features;
    studentMeta.standardized_ready = true;
    studentData = { standardize_table: data.standardize_table };
    studentTrainData = null;
    studentPredictData = null;
    studentTrainDirty = false;
    renderStudentPanel();
    renderStudentWorkspace("预处理完成，已生成标准化特征列。");
    renderStudentStandardizeTable(data.standardize_table);
  } catch (err) {
    renderStudentWorkspace(err.message);
  }
}

function renderStudentStandardizeTable(rows) {
  const grid = $("studentChartGrid");
  if (!grid) return;
  renderStudentGrid(["table"], view => studentDataViewHtml(view, { standardize_table: rows }));
}

async function loadStudentDataView() {
  try {
    studentStage = "数据预处理";
    studentStageKind = "data";
    const payload = studentPayload();
    studentData = await runAction("student_data_view", payload);
    studentMeta.target = payload.target;
    studentMeta.features = payload.features;
    refreshStudentStageStrip();
    renderStudentDataDashboard();
  } catch (err) {
    renderStudentWorkspace(err.message);
  }
}

async function loadStudentChartData(source, views, frameIndex = 0) {
  if (!source?.context_id) return {};
  return await postJson("/api/chart_data", {
    context_id: source.context_id,
    page: "student",
    charts: views,
    state: { frame_index: frameIndex },
  });
}

function studentChartOption(view, chartData = null) {
  const meta = studentChartMeta(view);
  if (!meta) return null;
  if (meta.renderer === "scatter_trend" && chartData) return scatterOption(chartData.scatter, chartData.trend_line, chartData.x_name, meta.title, chartData.y_name);
  if (meta.renderer === "all_corr" && chartData) return allCorrOption(chartData.rows, chartData.current_feature);
  if (meta.renderer === "linear_train_scatter" && chartData) return trainScatterOption(studentCurrentFrame, chartData);
  if (meta.renderer === "loss_curve" && chartData) return lossOption(studentCurrentFrame, chartData);
  if (meta.renderer === "student_param_path") return studentParamPathChartOption(chartData);
  if (meta.renderer === "student_metrics") return studentMetricsOption(chartData);
  if (meta.renderer === "predict_chart") return predictChartOption(chartData);
  return null;
}

async function renderStudentDataDashboard() {
  const views = studentAllowedDataViews(selectedValues("studentDataViews"));
  if ($("studentDataModeSummary")) $("studentDataModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择显示图表";
  try {
    studentChartDataCache = await loadStudentChartData(studentData, views);
  } catch (err) {
    studentChartDataCache = {};
    console.warn("student data chart_data fallback:", err);
  }
  renderStudentGrid(views, view => studentChartDataCache[view] ? studentViewHtml(view, studentChartDataCache[view]) : studentDataViewHtml(view, studentData));
  views.forEach(view => {
    if (view === "table") return;
    const ch = initChart(`chart_student_${view}`);
    const option = studentChartOption(view, studentChartDataCache[view]);
    if (option) {
      ch.setOption(option, true);
      requestAnimationFrame(() => ch.resize());
      return;
    }
    if (view === "raw") ch.setOption(scatterOption(studentData.raw.scatter, studentData.raw.trend_line, studentData.feature, "原始散点图", studentData.target), true);
    if (view === "standardized") ch.setOption(scatterOption(studentData.standardized.scatter, studentData.standardized.trend_line, studentData.standardized.feature_name, "预处理散点图", studentData.target), true);
    if (view === "corr") ch.setOption(allCorrOption(studentData.correlations, studentData.feature), true);
  });
}

async function prepareStudentTraining() {
  try {
    studentStage = "模型训练与评估";
    studentStageKind = "train";
    const payload = studentPayload({
      learning_rate: Number($("studentLr").value),
      epochs: Number($("studentEpochs").value),
      w0: Number($("studentW0").value),
      b0: Number($("studentB0").value)
    });
    studentTrainData = await runAction("student_train_prepare", payload);
    studentMeta.target = payload.target;
    studentMeta.features = payload.features;
    studentCurrentFrame = 0;
    studentTrainDirty = false;
    studentPredictData = null;
    renderStudentTrainFrame(0);
  } catch (err) {
    renderStudentWorkspace(err.message);
  }
}

async function renderStudentTrainFrame(index) {
  if (!studentTrainData) return;
  studentCurrentFrame = Math.max(0, Math.min(index, studentTrainData.history.length - 1));
  const frame = studentTrainData.history[studentCurrentFrame];
  studentStage = "模型训练与评估";
  studentStageKind = "train";
  refreshStudentStageStrip();
  if ($("studentEpochNow")) $("studentEpochNow").textContent = frame.epoch;
  if ($("studentLossNow")) $("studentLossNow").textContent = Number(frame.loss).toFixed(4);
  const views = selectedValues("studentTrainViews");
  const displayViews = expandStudentTrainViews(views);
  if ($("studentTrainModeSummary")) $("studentTrainModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择训练图表";
  try {
    studentChartDataCache = await loadStudentChartData(studentTrainData, displayViews, studentCurrentFrame);
  } catch (err) {
    studentChartDataCache = {};
    console.warn("student train chart_data fallback:", err);
  }
  renderStudentGrid(displayViews, view => studentChartDataCache[view] ? studentViewHtml(view, studentChartDataCache[view]) : studentTrainViewHtml(view, frame));
  displayViews.forEach(view => {
    if (view === "calc" || view === "table") return;
    const ch = initChart(`chart_student_${view}`);
    const option = studentChartOption(view, studentChartDataCache[view]);
    if (option) {
      ch.setOption(option, true);
      requestAnimationFrame(() => ch.resize());
      return;
    }
    if (view === "model_train") ch.setOption(trainScatterOption(studentCurrentFrame), true);
    if (view === "learning") ch.setOption(lossOption(studentCurrentFrame), true);
    if (view === "param_path") ch.setOption(studentParamPathOption(studentCurrentFrame), true);
    if (view === "rmse_gauge") ch.setOption(studentSingleGaugeOption("RMSE", frame.rmse, Math.max(...studentTrainData.history.map(r => r.rmse), 1), "#5b35f5"), true);
    if (view === "mae_gauge") ch.setOption(studentSingleGaugeOption("MAE", frame.mae, Math.max(...studentTrainData.history.map(r => r.mae), 1), "#c47a11"), true);
    if (view === "r2_gauge") ch.setOption(studentSingleGaugeOption("R²", Math.max(0, Math.min(1, frame.r2)), 1, "#0f9f78"), true);
  });
}

function expandStudentTrainViews(views) {
  return views;
}

function startStudentAuto() {
  if (!studentTrainData) return;
  if (studentTrainDirty) return showStudentMessage("训练参数已修改，请先重新点击“准备训练”。", true);
  stopAuto();
  timer = setInterval(() => {
    if (studentCurrentFrame >= studentTrainData.history.length - 1) {
      stopAuto();
      return;
    }
    renderStudentTrainFrame(studentCurrentFrame + 1);
  }, Number($("studentSpeed")?.value || 90));
}

function prepareStudentPredictionView() {
  studentStage = "模型预测";
  studentStageKind = "predict";
  refreshStudentStageStrip();
  const views = selectedValues("studentPredictViews");
  renderStudentGrid(views.length ? views : ["result", "chart"], view => {
    if (view === "chart") return chartCardHtml("student_predict_chart", "预测可视化", "点击“开始预测”后显示预测点和回归线", "wide");
    if (view === "calc") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测计算过程</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">点击“开始预测”后显示计算过程。</div></div></section>`;
    if (view === "nearby") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">相近样本对比</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">点击“开始预测”后显示相近样本。</div></div></section>`;
    return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测输入与结果</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">输入特征值后点击“开始预测”。</div></div></section>`;
  });
}

async function loadStudentPrediction() {
  try {
    studentStage = "模型预测";
    studentStageKind = "predict";
    const payload = studentPayload({
      value: Number($("studentPredictInput").value || 0)
    });
    const frame = currentStudentTrainFrame(payload);
    if (frame) {
      payload.w = frame.w;
      payload.b = frame.b;
    }
    studentPredictData = await runAction("student_predict", payload);
    studentMeta.target = payload.target;
    studentMeta.features = payload.features;
    refreshStudentStageStrip();
    renderStudentPredictDashboard();
  } catch (err) {
    renderStudentWorkspace(err.message);
  }
}

async function renderStudentPredictDashboard() {
  const views = selectedValues("studentPredictViews");
  if ($("studentPredictModeSummary")) $("studentPredictModeSummary").textContent = views.length ? `已选择 ${views.length} 项` : "请选择预测图表";
  try {
    studentChartDataCache = await loadStudentChartData(studentPredictData, views);
  } catch (err) {
    studentChartDataCache = {};
    console.warn("student predict chart_data fallback:", err);
  }
  renderStudentGrid(views, view => studentChartDataCache[view] ? studentViewHtml(view, studentChartDataCache[view]) : studentPredictViewHtml(view));
  views.forEach(view => {
    if (view !== "chart") return;
    setChartOptionWhenReady(
      initChart(studentChartDataCache[view] ? "chart_student_chart" : "chart_student_predict_chart"),
      predictChartOption(studentChartDataCache[view]),
      true
    );
  });
}

function renderStudentGrid(views, htmlForView) {
  destroyDataGrid();
  disposeCharts();
  const grid = $("studentChartGrid");
  if (!grid) return;
  if (!views.length) {
    grid.classList.remove("dashboard-grid", "grid-stack");
    grid.innerHTML = `<div class="empty-state">请选择至少一个显示图表。</div>`;
    return;
  }
  if (!window.GridStack) {
    grid.classList.remove("dashboard-grid", "grid-stack");
    grid.innerHTML = views.map(htmlForView).join("");
    return;
  }
  dataGridMode = "student";
  grid.classList.add("dashboard-grid", "grid-stack");
  grid.classList.remove("single");
  const saved = loadStudentGridLayout();
  grid.innerHTML = views.map(view => {
    const layout = normalizeStudentGridLayout(view, saved[view] || defaultStudentGridLayout(view));
    return `<div class="grid-stack-item" data-view="${view}" gs-x="${layout.x}" gs-y="${layout.y}" gs-w="${layout.w}" gs-h="${layout.h}" gs-min-w="1" gs-min-h="1"><div class="grid-stack-item-content">${htmlForView(view)}</div></div>`;
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

function defaultStudentGridLayout(view) {
  return ({
    format: { x: 0, y: 0, w: 4, h: 2 },
    upload: { x: 0, y: 2, w: 4, h: 1 },
    preview: { x: 0, y: 2, w: 4, h: 2 },
    raw: { x: 0, y: 0, w: 2, h: 2 },
    standardized: { x: 2, y: 0, w: 2, h: 2 },
    corr: { x: 0, y: 2, w: 2, h: 2 },
    table: { x: 2, y: 2, w: 2, h: 2 },
    model_train: { x: 0, y: 0, w: 2, h: 2 },
    learning: { x: 2, y: 0, w: 2, h: 2 },
    param_path: { x: 0, y: 2, w: 2, h: 2 },
    metrics: { x: 2, y: 2, w: 2, h: 2 },
    rmse_gauge: { x: 2, y: 2, w: 1, h: 1 },
    mae_gauge: { x: 3, y: 2, w: 1, h: 1 },
    r2_gauge: { x: 2, y: 3, w: 1, h: 1 },
    calc: { x: 0, y: 4, w: 4, h: 3 },
    result: { x: 0, y: 0, w: 1, h: 1 },
    chart: { x: 1, y: 0, w: 3, h: 2 },
    nearby: { x: 0, y: 2, w: 2, h: 2 }
  })[view] || { x: 0, y: 0, w: 2, h: 2 };
}

function normalizeStudentGridLayout(view, layout) {
  const next = { ...defaultStudentGridLayout(view), ...layout };
  next.w = Math.max(1, Math.min(4, Number(next.w) || 1));
  next.h = Math.max(1, Number(next.h) || 1);
  next.x = Math.max(0, Math.min(4 - next.w, Number(next.x) || 0));
  next.y = Math.max(0, Number(next.y) || 0);
  return next;
}
