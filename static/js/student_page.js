// Student Page.

function studentStandardizedReady() {
  return Boolean(studentMeta?.standardized_ready || studentMeta?.source_type === "standardized");
}

function studentTargetValue(columns = studentMeta?.numeric_columns || []) {
  if (studentMeta?.target && columns.includes(studentMeta.target)) return studentMeta.target;
  const liveEl = $("studentTarget");
  const live = liveEl && !liveEl.closest("[hidden]") ? liveEl.value : "";
  if (live && columns.includes(live)) return live;
  return columns[columns.length - 1] || "";
}

function studentFeatureSet(features = [], target = "") {
  const live = studentSelectedFeatures().filter(col => features.includes(col) && col !== target);
  const saved = Array.isArray(studentMeta?.features)
    ? studentMeta.features.filter(col => features.includes(col) && col !== target)
    : [];
  const selected = live.length ? live : (saved.length ? saved : features);
  return new Set(selected);
}

function studentAllFeatureColumns(columns = studentMeta?.numeric_columns || []) {
  const target = studentTargetValue(columns);
  return columns.filter(col => col !== target);
}

function studentStdSelectValue() {
  if (!studentStandardizedReady()) return "0";
  const live = $("studentStd")?.value;
  if (live === "0" || live === "1") return live;
  if (studentMeta?.train_use_standardized === "0" || studentMeta?.train_use_standardized === "1") return studentMeta.train_use_standardized;
  return "1";
}

function studentUseStandardized() {
  return studentStandardizedReady() && studentStdSelectValue() === "1";
}

function studentFeatureVersionLabel() {
  return studentUseStandardized() ? "标准化特征" : "原始特征";
}

function studentAllowedDataViews(views) {
  const allowed = new Set(["raw", "single_corr", "all_corr"]);
  if (studentStandardizedReady()) {
    allowed.add("standardized");
  }
  return views.filter(view => allowed.has(view));
}

function studentCurrentFeatureValue() {
  const features = studentSelectedFeatures();
  const live = $("studentDataFeature")?.value || $("studentFeature")?.value;
  if (live && features.includes(live)) return live;
  if (studentMeta?.feature && features.includes(studentMeta.feature)) return studentMeta.feature;
  return features[0] || "";
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
    <div id="studentWorkspace"></div>`;
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
  restoreCheckedValues("studentPredictViews", "studentPredictSelectedViewsV2");
  $("studentUploadBtn").addEventListener("click", uploadStudentDataset);
  if (!studentMeta) return;
  restoreStudentFormState();
  if ($("studentTarget")) $("studentTarget").addEventListener("change", () => {
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
    studentHasTrained = false;
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
    studentHasTrained = false;
  }));
  updateStudentFeatureSelect();
  if ($("studentDataFeature")) $("studentDataFeature").addEventListener("change", () => {
    studentMeta.feature = $("studentDataFeature").value;
    if ($("studentFeature")) $("studentFeature").value = studentMeta.feature;
    refreshStudentStageStrip();
    if (studentData?.context_id) loadStudentDataView();
  });
  $("studentPreprocessBtn").addEventListener("click", preprocessStudentDataset);
  $("studentDataBtn").addEventListener("click", loadStudentDataView);
  $("studentTrainBtn").addEventListener("click", prepareStudentTraining);
  $("studentResetBtn").addEventListener("click", () => {
    stopAuto();
    if (studentTrainDirty) return showStudentMessage("训练参数已修改，请先重新点击“准备训练”。", true);
    studentHasTrained = false;
    renderStudentTrainFrame(0);
    refreshStudentTrainStatus();
  });
  $("studentStepBtn").addEventListener("click", () => {
    if (studentTrainDirty) return showStudentMessage("训练参数已修改，请先重新点击“准备训练”。", true);
    studentHasTrained = true;
    renderStudentTrainFrame(studentCurrentFrame + 1);
    refreshStudentTrainStatus();
  });
  $("studentAutoBtn").addEventListener("click", startStudentAuto);
  $("studentPauseBtn").addEventListener("click", stopAuto);
  $("studentSpeed").addEventListener("input", () => $("studentSpeedText").textContent = `${$("studentSpeed").value}ms`);
  $("studentLr").addEventListener("input", () => $("studentLrText").textContent = Number($("studentLr").value).toFixed(3));
  $("studentEpochs").addEventListener("input", () => $("studentEpochsText").textContent = $("studentEpochs").value);
  bindRangeStepperButtons();
  ["studentStd", "studentW0", "studentB0", "studentLr", "studentEpochs"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("change", () => {
      if (id === "studentStd") studentMeta.train_use_standardized = el.value;
      markStudentTrainingDirty();
    });
  });
  if ($("studentFeature")) $("studentFeature").addEventListener("change", markStudentTrainingDirty);
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
    saveCheckedValues("studentPredictViews", "studentPredictSelectedViewsV2");
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
    { area_standardized: -1.1355, rooms_standardized: -1.2247, price: 120 },
    { area_standardized: -0.1622, rooms_standardized: 0, price: 160 },
    { area_standardized: 0.8111, rooms_standardized: 0, price: 180 }
  ];
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据格式</div>
      </div>
    </div>
    <div class="info-card-body" style="padding:18px">
      <div class="format-intro">
        <p><strong>规则：</strong>系统始终把 CSV 最后一列作为标签列 y；最后一列不参与预处理标准化，其余数值列作为特征列 x 并生成 <code>特征名_standardized</code>。</p>
        <p>CSV 第一行必须是列名，至少包含 1 个数值特征列和 1 个数值目标列，最后一列作为目标列。原始数据集可以点击预处理生成 <code>特征名_standardized</code> 列；已预处理数据集应使用标准化特征列和目标列。</p>
      </div>
      <div class="format-grid">
        <div class="format-column">
          <div class="format-point"><strong>原始数据集</strong>只需要原始特征列和目标列，目标列放最后，例如 <code>area</code>、<code>rooms</code>、<code>price</code>。</div>
          <p class="sample-caption">原始 CSV 示例</p>
          ${studentPreviewTable(rawRows)}
        </div>
        <div class="format-column">
          <div class="format-point"><strong>已预处理数据集</strong>使用 <code>特征名_standardized</code> 列和目标列，目标列放最后。</div>
          <p class="sample-caption">预处理后 CSV 示例</p>
          ${studentPreviewTable(stdRows)}
        </div>
      </div>
      ${!studentMeta ? `<div class="format-upload-hint">请先在右侧上传 CSV 数据集。</div>` : ""}
      ${message ? `<p class="status-line">${escapeHtml(message)}</p>` : ""}
    </div>
  </section>`;
}

function studentPreviewColumns() {
  if (Array.isArray(studentMeta?.preview_columns) && studentMeta.preview_columns.length) {
    return studentMeta.preview_columns;
  }
  return studentMeta?.preview?.[0] ? Object.keys(studentMeta.preview[0]) : [];
}

function studentUploadPlaceholderHtml() {
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">数据集上传</div>
      </div>
    </div>
    <div class="empty-state student-upload-empty">请先在右侧上传 CSV 数据集。</div>
  </section>`;
}

function studentPreviewCardHtml() {
  const preview = studentMeta?.preview || [];
  const isPreprocessed = studentMeta?.preview_stage === "preprocessed";
  const title = isPreprocessed ? "预处理预览" : "数据预览";
  const sub = isPreprocessed
    ? `已生成标准化特征列，目标列 ${escapeHtml(studentMeta?.target || "--")} 保留在最后`
    : `检测到 ${escapeHtml(studentMeta?.row_count ?? "--")} 行，数值列 ${escapeHtml(studentMeta?.numeric_columns?.length ?? "--")} 个`;
  return `<section class="chart-card wide">
    <div class="chart-head">
      <div>
        <div class="chart-title">${title}</div>
        <div class="chart-sub">${sub}</div>
      </div>
    </div>
    <div class="info-card-body" style="padding:18px">
      ${studentPreviewTable(preview, studentPreviewColumns())}
    </div>
  </section>`;
}

function renderStudentWorkspace(message = "") {
  $("studentWorkspace").innerHTML = `
    ${studentMeta ? studentStageStrip() : ""}
    <div class="chart-grid" id="studentChartGrid"></div>`;
  renderStudentGrid(studentMeta ? ["preview"] : ["format"], view => {
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
    if (studentData.preview) {
      renderStudentWorkspace();
      return;
    }
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
  refreshStudentPredictModelStatus();
  showStudentMessage("训练参数已修改，请重新点击“准备训练”生成新的训练过程。");
}

function refreshStudentTrainStatus() {
  const el = $("studentTrainStatus");
  if (!el) return;
  el.textContent = studentHasTrained ? "\u5df2\u8bad\u7ec3" : "\u672a\u8bad\u7ec3";
  el.className = `section-status ${studentHasTrained ? "ready" : ""}`;
}

function refreshStudentPredictStatus() {
  const el = $("studentPredictStatus");
  if (!el) return;
  el.textContent = studentPredictData ? "已预测" : "待预测";
  el.className = `section-status ${studentPredictData ? "ready" : ""}`;
}

function refreshStudentPredictModelStatus() {
  const el = $("studentPredictModelStatus");
  const input = $("studentPredictInput");
  const mode = $("studentPredictInputMode");
  if (!el) return;
  const frame = studentTrainData?.history?.[studentCurrentFrame] || studentTrainData?.history?.[studentTrainData.history.length - 1] || null;
  const ready = Boolean(studentTrainData && !studentTrainDirty && frame);
  if (!ready) {
    el.innerHTML = `<div class="model-status-empty">暂无训练模型。请先在“03 模型训练与评估”中准备训练，再切换到希望用于预测的 epoch。</div>`;
    if (input) input.disabled = true;
    if (mode) mode.disabled = true;
    return;
  }
  if (input) input.disabled = false;
  if (mode) {
    mode.disabled = false;
    [...mode.options].forEach(option => {
      option.disabled = option.value === "standardized" && !studentTrainData.use_standardized;
    });
    if (!studentTrainData.use_standardized && mode.value === "standardized") mode.value = "raw";
  }
  el.innerHTML = `
    <div class="model-status-grid">
      <div class="model-status-main"><span>来源</span><strong>自主实验 epoch ${escapeHtml(frame.epoch)}</strong></div>
      <div class="model-status-pair"><span>特征</span><strong>${escapeHtml(studentTrainData.feature || studentCurrentFeatureValue())}</strong></div>
      <div class="model-status-pair"><span>输入空间</span><strong>${escapeHtml(studentTrainData.use_standardized ? "标准化特征" : "原始特征")}</strong></div>
      <div class="model-param-row">
        <div><span>w</span><strong>${Number(frame.w).toFixed(6)}</strong></div>
        <div><span>b</span><strong>${Number(frame.b).toFixed(6)}</strong></div>
      </div>
    </div>`;
}

function studentSelectedFeatures() {
  const checked = [...document.querySelectorAll('input[name="studentFeatures"]:checked')]
    .filter(el => !el.closest("[hidden]"))
    .map(el => el.value);
  if (checked.length) return checked;
  const columns = studentMeta?.numeric_columns || [];
  return studentAllFeatureColumns(columns);
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
  const feature = studentCurrentFeatureValue();
  return {
    dataset_id: studentMeta?.dataset_id,
    target: $("studentTarget")?.value || studentTargetValue(),
    features,
    feature,
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
    studentMeta.target = data.target || studentTargetValue(data.numeric_columns || []);
    studentMeta.features = data.features || studentAllFeatureColumns(data.numeric_columns || []);
    studentMeta.feature = studentMeta.features[0] || "";
    studentMeta.preview_columns = data.preview_columns || data.columns || [];
    studentMeta.preview_stage = "raw";
    studentData = null;
    studentPredictData = null;
    studentTrainData = null;
    studentPredictData = null;
    studentStage = "数据集";
    studentStageKind = "dataset";
    studentTrainDirty = false;
    studentHasTrained = false;
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
  renderStudentGrid(views.length ? views : studentAllowedDataViews(["raw", "standardized", "single_corr", "all_corr"]), view => {
    if (view === "raw") return chartCardHtml("student_raw", "原始散点图", "点击“看数据”后显示当前特征与目标列的原始关系");
    if (view === "standardized") return chartCardHtml("student_standardized", "预处理散点图", "点击“预处理”或“看数据”后显示标准化特征关系");
    if (view === "single_corr") return chartCardHtml("student_single_corr", "单特征线性相关系数", "点击“看数据”后显示当前特征与目标列的 Pearson 相关系数");
    if (view === "all_corr") return chartCardHtml("student_all_corr", "全特征线性相关系数", "点击“看数据”后显示所有特征与目标列的相关性");
    return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">标准化表</div><div class="chart-sub">点击“预处理”后生成</div></div></div><div style="padding:18px"><div class="empty-state">等待预处理结果。</div></div></section>`;
  });
}

async function preprocessStudentDataset() {
  try {
    studentStage = "数据预处理";
    studentStageKind = "data";
    const data = await runAction("student_preprocess", studentPayload());
    studentMeta.preview = data.preview;
    studentMeta.preview_columns = data.preview_columns || [];
    studentMeta.row_count = data.row_count;
    studentMeta.target = data.target;
    studentMeta.features = data.features;
    studentMeta.feature = studentCurrentFeatureValue() || data.features?.[0] || "";
    studentMeta.standardized_ready = true;
    studentMeta.train_use_standardized = "1";
    studentMeta.preview_stage = "preprocessed";
    studentData = { standardize_table: data.standardize_table, preview: data.preview };
    studentTrainData = null;
    studentPredictData = null;
    studentTrainDirty = false;
    studentHasTrained = false;
    renderStudentPanel();
    renderStudentWorkspace();
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
    studentMeta.feature = payload.feature;
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
  if (meta.renderer === "single_corr" && chartData) return singleCorrOptionFromData(chartData);
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
    if (view === "single_corr") ch.setOption(singleCorrOptionFromData({ feature: studentData.feature, corr: studentData.raw.summary.corr }), true);
    if (view === "all_corr") ch.setOption(allCorrOption(studentData.correlations, studentData.feature), true);
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
    studentMeta.train_use_standardized = payload.use_standardized ? "1" : "0";
    studentCurrentFrame = 0;
    studentTrainDirty = false;
    studentHasTrained = false;
    studentPredictData = null;
    renderStudentTrainFrame(0);
    refreshStudentTrainStatus();
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
  refreshStudentPredictModelStatus();
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
  studentHasTrained = true;
  refreshStudentTrainStatus();
  timer = setInterval(() => {
    if (studentCurrentFrame >= studentTrainData.history.length - 1) {
      stopAuto();
      return;
    }
    renderStudentTrainFrame(studentCurrentFrame + 1);
  }, Number($("studentSpeed")?.value || 90));
}

function prepareStudentPredictionView() {
  if (!studentTrainData || studentTrainDirty) {
    studentPredictData = null;
    studentStage = "模型预测";
    studentStageKind = "predict";
    refreshStudentStageStrip();
    showStudentMessage("请先在“03 模型训练与评估”中完成准备训练，再回到这里使用当前模型预测。", true);
    return;
  }
  studentStage = "模型预测";
  studentStageKind = "predict";
  refreshStudentStageStrip();
  const views = selectedValues("studentPredictViews");
  renderStudentGrid(views.length ? views : ["chart", "calc"], view => {
    if (view === "chart") return chartCardHtml("student_predict_chart", "预测可视化", "点击“开始预测”后显示预测点和回归线", "wide");
    if (view === "calc") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测计算过程</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">点击“开始预测”后显示计算过程。</div></div></section>`;
    if (view === "nearby") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">相近样本对比</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">点击“开始预测”后显示相近样本。</div></div></section>`;
    return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测输入与结果</div><div class="chart-sub">等待预测输入</div></div></div><div style="padding:18px"><div class="empty-state">输入特征值后点击“开始预测”。</div></div></section>`;
  });
}

async function loadStudentPrediction() {
  try {
    if (!studentTrainData || studentTrainDirty) {
      studentPredictData = null;
      studentStage = "模型预测";
      studentStageKind = "predict";
      refreshStudentStageStrip();
      showStudentMessage("请先在“03 模型训练与评估”中完成准备训练，再回到这里使用当前模型预测。", true);
      return;
    }
    studentStage = "模型预测";
    studentStageKind = "predict";
    const payload = studentPayload({
      value: Number($("studentPredictInput").value || 0),
      input_mode: $("studentPredictInputMode")?.value || "raw"
    });
    const frame = currentStudentTrainFrame(payload);
    if (!frame) {
      showStudentMessage("当前预测设置和已准备的训练模型不一致，请重新准备训练后再预测。", true);
      return;
    }
    if (frame) {
      payload.w = frame.w;
      payload.b = frame.b;
      payload.epoch = frame.epoch;
    }
    studentPredictData = await runAction("student_predict", payload);
    studentMeta.target = payload.target;
    studentMeta.features = payload.features;
    refreshStudentStageStrip();
    refreshStudentPredictStatus();
    renderStudentPredictDashboard();
  } catch (err) {
    renderStudentWorkspace(err.message);
  }
}

async function renderStudentPredictDashboard() {
  const views = selectedValues("studentPredictViews");
  const displayViews = views.length ? views : ["chart", "calc"];
  if ($("studentPredictModeSummary")) $("studentPredictModeSummary").textContent = displayViews.length ? `已选择 ${displayViews.length} 项` : "请选择预测图表";
  try {
    studentChartDataCache = await loadStudentChartData(studentPredictData, displayViews);
  } catch (err) {
    studentChartDataCache = {};
    console.warn("student predict chart_data fallback:", err);
  }
  renderStudentGrid(displayViews, view => studentChartDataCache[view] ? studentViewHtml(view, studentChartDataCache[view]) : studentPredictViewHtml(view));
  displayViews.forEach(view => {
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
    single_corr: { x: 0, y: 2, w: 2, h: 2 },
    all_corr: { x: 2, y: 2, w: 2, h: 2 },
    model_train: { x: 0, y: 0, w: 2, h: 2 },
    learning: { x: 2, y: 0, w: 2, h: 2 },
    param_path: { x: 0, y: 2, w: 2, h: 2 },
    metrics: { x: 0, y: 2, w: 4, h: 1 },
    table: { x: 0, y: 3, w: 4, h: 1 },
    rmse_gauge: { x: 2, y: 2, w: 1, h: 1 },
    mae_gauge: { x: 3, y: 2, w: 1, h: 1 },
    r2_gauge: { x: 2, y: 3, w: 1, h: 1 },
    calc: { x: 0, y: 2, w: 4, h: 3 },
    result: { x: 0, y: 0, w: 1, h: 1 },
    chart: { x: 0, y: 0, w: 4, h: 2 },
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
