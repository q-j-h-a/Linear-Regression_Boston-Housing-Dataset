// View HTML renderers. Depends on globals defined by the page runtime.

function studentStageStrip() {
  const cols = studentMeta?.numeric_columns || [];
  const target = studentTargetValue(cols) || "--";
  const feature = $("studentFeature")?.value || studentSelectedFeatures()[0] || "--";
  const featureText = feature === "--" ? feature : `${feature}（${studentFeatureVersionLabel()}）`;
  return `<div class="stage-strip" id="studentStageStrip">
    <div class="stage-chip active"><span>当前阶段</span><strong>${escapeHtml(studentStage)}</strong></div>
    <div class="stage-chip"><span>样本数量</span><strong>${escapeHtml(studentMeta?.row_count ?? "--")}</strong></div>
    <div class="stage-chip"><span>目标列</span><strong>${escapeHtml(target)}</strong></div>
    <div class="stage-chip"><span>当前特征</span><strong>${escapeHtml(featureText)}</strong></div>
  </div>`;
}

function studentPreviewTable(rows, explicitColumns = null) {
  if (!rows.length) return `<div class="empty-state">暂无预览数据。</div>`;
  const columns = explicitColumns?.length ? explicitColumns : Object.keys(rows[0]);
  return `<div class="table-wrap"><table><thead><tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(col => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function standardizeTableHtml(rows = []) {
  if (!rows.length) return `<div class="empty-state">还没有标准化结果。</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>特征</th><th>标准化列</th><th>均值</th><th>标准差</th><th>原始最小</th><th>原始最大</th><th>标准化最小</th><th>标准化最大</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.feature)}</td><td>${escapeHtml(row.standardized_feature)}</td><td>${num(row.mean, 4)}</td><td>${num(row.std, 4)}</td><td>${num(row.min_before, 4)}</td><td>${num(row.max_before, 4)}</td><td>${row.min_after == null ? "--" : num(row.min_after, 4)}</td><td>${row.max_after == null ? "--" : num(row.max_after, 4)}</td></tr>`).join("")}</tbody></table></div>`;
}

function studentInfoCard(key, title, sub, html) {
  const subHtml = sub ? `<div class="chart-sub">${escapeHtml(sub)}</div>` : "";
  return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div>${subHtml}</div></div><div style="padding:18px">${html}</div></section>`;
}

function studentViewHtml(view, chartData = null) {
  const meta = studentChartMeta(view);
  const title = meta?.title || chartTitle(view);
  const sub = meta?.subtitle ?? chartSub(view, studentData || studentTrainData || studentPredictData);
  if (meta?.renderer === "student_table") {
    if (chartData?.stage === "train_prepare") return studentInfoCard(`student_${view}`, title, sub, tableHtmlFromRows(chartData.rows, studentCurrentFrame));
    return studentInfoCard(`student_${view}`, title, sub, standardizeTableHtml(chartData?.rows || studentData?.standardize_table || []));
  }
  if (meta?.renderer === "student_calc") {
    if (chartData?.stage === "predict") return studentInfoCard(`student_${view}`, title, sub, predictCalcHtml(chartData));
    if (chartData?.stage === "train_prepare") return studentInfoCard(`student_${view}`, title, sub, calcHtml(chartData.frame || studentTrainData?.history?.[studentCurrentFrame], chartData));
  }
  if (meta?.renderer === "predict_result") return studentInfoCard(`student_${view}`, title, sub, predictResultHtml(chartData));
  if (meta?.renderer === "predict_nearby") return studentInfoCard(`student_${view}`, title, sub, predictNearbyHtml(chartData));
  return chartCardHtml(`student_${view}`, title, sub, meta?.size || "wide");
}

function studentDataViewHtml(view, data) {
  if (view === "raw") return chartCardHtml("student_raw", "原始散点图", `${data.feature} 与 ${data.target} 的关系`);
  if (view === "standardized") return chartCardHtml("student_standardized", "预处理散点图", `${data.standardized?.feature_name || ""} 与 ${data.target || ""} 的关系`);
  if (view === "single_corr") return chartCardHtml("student_single_corr", "单特征线性相关系数", `${data.feature} 与 ${data.target || "目标列"} 的 Pearson 相关系数`);
  if (view === "all_corr") return chartCardHtml("student_all_corr", "全特征线性相关系数", `所有特征与 ${data.target || "目标列"} 的 Pearson 相关系数`);
  return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">标准化表</div><div class="chart-sub">当前特征集合的标准化摘要</div></div></div><div style="padding:18px">${standardizeTableHtml(data.standardize_table || [])}</div></section>`;
}

function studentTrainViewHtml(view, frame) {
  if (view === "calc") return infoCardHtml("student_calc", "本轮计算过程", calcHtml(frame));
  if (view === "table") return studentInfoCard("student_table", "参数表", "", tableHtml(studentCurrentFrame));
  if (view === "param_path") return chartCardHtml("student_param_path", "参数轨迹图", "w、b 随 epoch 的变化");
  if (view === "rmse_gauge") return chartCardHtml("student_rmse_gauge", "RMSE", "均方根误差，越小越好", "small");
  if (view === "mae_gauge") return chartCardHtml("student_mae_gauge", "MAE", "平均绝对误差，越小越好", "small");
  if (view === "r2_gauge") return chartCardHtml("student_r2_gauge", "R²", "模型解释能力，越接近 1 越好", "small");
  if (view === "learning") return chartCardHtml("student_learning", "学习准则图", "MSE Loss 随 epoch 的变化");
  return chartCardHtml("student_model_train", "模型训练图", "样本点、当前回归线和最优参考线");
}

function studentPredictViewHtml(view) {
  if (view === "result") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测输入与结果</div><div class="chart-sub">使用学生数据拟合出的线性模型</div></div></div><div style="padding:18px">${predictResultHtml(studentPredictData)}</div></section>`;
  if (view === "calc") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">预测计算过程</div><div class="chart-sub">标准化转换和线性模型代入</div></div></div><div style="padding:18px">${predictCalcHtml(studentPredictData)}</div></section>`;
  if (view === "nearby") return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">相近样本对比</div><div class="chart-sub">与输入值最接近的 5 条样本</div></div></div><div style="padding:18px">${predictNearbyHtml(studentPredictData)}</div></section>`;
  return chartCardHtml("student_predict_chart", "预测可视化", "样本点、回归线、输入点与预测点", "wide");
}

function predictViewHtml(view, chartData = null) {
  const meta = predictChartMeta(view);
  const title = meta?.title || chartTitle(view);
  const sub = meta?.subtitle || chartSub(view, predictData);
  if (meta?.renderer === "predict_result") return predictInfoCard(view, title, sub, predictResultHtml(chartData));
  if (meta?.renderer === "predict_calc") return predictInfoCard(view, title, sub, predictCalcHtml(chartData));
  if (meta?.renderer === "predict_nearby") return predictInfoCard(view, title, sub, predictNearbyHtml(chartData));
  return chartCardHtml(view, title, sub, meta?.size || "wide");
}

function predictInfoCard(key, title, sub, html) {
  return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div><div class="chart-sub">${escapeHtml(sub || "使用训练页当前模型参数预测")}</div></div></div><div style="padding:18px">${html}</div></section>`;
}

function predictResultHtml(data = null) {
  const d = data || predictData;
  const inputLabel = d.input_mode === "standardized" ? "标准化输入" : "原始输入";
  return `<div class="best-param-grid">
    <div class="best-param"><span>输入特征</span><strong>${escapeHtml(d.feature)}</strong></div>
    <div class="best-param"><span>${escapeHtml(inputLabel)}</span><strong>${num(d.input_value ?? d.raw_value, 4)}</strong></div>
    <div class="best-param"><span>模型输入 x</span><strong>${num(d.model_x, 4)}</strong></div>
    <div class="best-param"><span>预测 ${escapeHtml(d.target)}</span><strong>${num(d.prediction, 2)}</strong></div>
  </div>
  <div class="formula-box">模型来源：${escapeHtml(d.model_source || "训练页当前模型")}
当前使用参数：w = ${num(d.w, 6)}, b = ${num(d.b, 6)}
目标列 ${escapeHtml(d.target)} 的预测值由当前单特征线性模型给出。</div>`;
}

function predictCalcHtml(data = null) {
  const d = data || predictData;
  const inputValue = d.input_value ?? d.raw_value;
  const inputStep = d.input_mode === "standardized"
    ? `1. 读取标准化输入
x_model = ${num(inputValue, 6)}
`
    : `1. 读取原始输入
输入特征 ${d.feature} = ${num(inputValue, 6)}
`;

  let transformStep = "";
  if (d.use_standardized && d.input_mode === "standardized") {
    transformStep = `2. 换算对应的原始特征值
x_raw = x_model * std + mean
      = ${num(d.model_x, 6)} * ${num(d.std, 6)} + ${num(d.mean, 6)}
      = ${num(d.raw_value, 6)}
`;
  } else if (d.use_standardized) {
    transformStep = `2. 按训练时的数据版本转换模型输入
当前模型使用标准化特征：
x_model = (x_raw - mean) / std
        = (${num(d.raw_value, 6)} - ${num(d.mean, 6)}) / ${num(d.std, 6)}
        = ${num(d.model_x, 6)}
`;
  } else {
    transformStep = `2. 按训练时的数据版本转换模型输入
当前模型使用原始特征：
x_model = x_raw = ${num(d.model_x, 6)}
`;
  }

  return `<div class="formula-box">${inputStep}
${transformStep}
3. 代入训练页当前模型
模型来源：${escapeHtml(d.model_source || "模型训练与评估页当前模型")}
w = ${num(d.w, 6)}, b = ${num(d.b, 6)}

y_hat = w * x_model + b
      = ${num(d.w, 6)} * ${num(d.model_x, 6)} + ${num(d.b, 6)}
      = ${num(d.prediction, 6)}

4. 预测结果
预测 ${escapeHtml(d.target)} = ${num(d.prediction, 2)}</div>`;
}

function predictNearbyHtml(data = null) {
  const d = data || predictData;
  const rows = d.nearby || [];
  return `<div class="table-wrap"><table><thead><tr><th>#</th><th>${escapeHtml(d.feature)}</th><th>${escapeHtml(d.target)}</th><th>距离</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${num(r.raw_x, 3)}</td><td>${num(r.y, 2)}</td><td>${num(r.distance, 3)}</td></tr>`).join("")}</tbody></table></div>`;
}

function trainInfoHtml(view, frame, chartData = null) {
  const meta = trainChartMeta(view);
  if (meta?.renderer === "calc_detail") return infoCardHtml(view, chartTitle(view), calcHtml(chartData?.frame || frame, chartData));
  if (meta?.renderer === "training_table") return infoCardHtml(view, chartTitle(view), tableHtmlFromRows(chartData?.rows, currentFrame));
  return "";
}

function trainViewHtml(view, frame, chartData = null) {
  if (isTrainInfoView(view)) return trainInfoHtml(view, frame, chartData);
  return chartCardHtml(view, chartTitle(view), chartSub(view, trainData), trainCardSize(view));
}

function chartCardHtml(key, title, sub, size = "") {
  return `<section class="chart-card ${size} chart-interaction-prototype" data-chart-card="${escapeHtml(key)}"><div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div><div class="chart-sub">${escapeHtml(sub)}</div></div></div><div class="chart" id="chart_${key}"></div></section>`;
}

function infoCardHtml(key, title, html) {
  return `<section class="chart-card wide"><div class="chart-head"><div><div class="chart-title">${escapeHtml(title)}</div><div class="chart-sub">随当前 epoch 更新</div></div></div><div style="padding:18px">${html}</div></section>`;
}

function calcHtml(frame, chartData = null) {
  const bestW = chartData?.best?.w ?? trainData?.best?.w ?? 0;
  const bestB = chartData?.best?.b ?? trainData?.best?.b ?? 0;
  const distanceW = bestW - frame.w;
  const distanceB = bestB - frame.b;
  const bestBlock = `<div class="best-param-panel">
    <div class="best-param"><span>最优 w</span><strong>${bestW.toFixed(6)}</strong></div>
    <div class="best-param"><span>最优 b</span><strong>${bestB.toFixed(6)}</strong></div>
    <div class="best-param"><span>w 距离</span><strong>${distanceW.toFixed(6)}</strong></div>
    <div class="best-param"><span>b 距离</span><strong>${distanceB.toFixed(6)}</strong></div>
  </div>`;
  return bestBlock + calcHtmlDetailed(frame, chartData);
}

function calcHtmlDetailed(frame, chartData = null) {
  const lr = chartData?.learning_rate ?? trainData?.learning_rate ?? Number($("lr")?.value || 0);
  const m = chartData?.sample_count ?? trainData?.scatter?.x?.length ?? 0;
  const rows = (frame.x_first5 || []).map((x, i) => {
    const y = frame.y_first5?.[i] ?? 0;
    const pred = frame.pred_first5?.[i] ?? 0;
    const err = frame.err_first5?.[i] ?? 0;
    return `  ${i + 1}. x=${Number(x).toFixed(4)}, y=${Number(y).toFixed(4)}, y_hat=${Number(pred).toFixed(4)}, 预测误差=${Number(err).toFixed(4)}`;
  }).join("\n");

  return `<div class="formula">epoch = ${frame.epoch}

1. 当前参数
w = ${frame.w.toFixed(6)}
b = ${frame.b.toFixed(6)}

2. 前 5 个样本的预测与误差
y_hat = w * x + b
预测误差 = y_hat - y
${rows}

3. 本轮损失与评价指标
MSE = mean(预测误差^2) = ${frame.mse.toFixed(6)}
RMSE = sqrt(MSE) = ${frame.rmse.toFixed(6)}
MAE = mean(abs(预测误差)) = ${frame.mae.toFixed(6)}
R 平方 = ${frame.r2.toFixed(6)}

4. 梯度计算
dw = (2 / m) * sum(预测误差 * x), m = ${m}
db = (2 / m) * sum(预测误差)
dw = ${frame.dw.toFixed(6)}
db = ${frame.db.toFixed(6)}

5. 参数更新
learning_rate = ${Number(lr).toFixed(6)}
new_w = w - learning_rate * dw
      = ${frame.w.toFixed(6)} - ${Number(lr).toFixed(6)} * ${frame.dw.toFixed(6)}
      = ${frame.new_w.toFixed(6)}
new_b = b - learning_rate * db
      = ${frame.b.toFixed(6)} - ${Number(lr).toFixed(6)} * ${frame.db.toFixed(6)}
      = ${frame.new_b.toFixed(6)}</div>`;
}

function tableHtmlFromRows(rows, frameIndex) {
  if (!Array.isArray(rows)) return tableHtml(frameIndex);
  const visibleRows = rows.slice(-50);
  const firstEpoch = visibleRows[0]?.epoch ?? 0;
  const lastEpoch = visibleRows[visibleRows.length - 1]?.epoch ?? 0;
  const note = rows.length > 50
    ? `<div class="table-note">当前显示最近 50 条：epoch ${firstEpoch} - ${lastEpoch}，已运行 ${rows.length} 条</div>`
    : `<div class="table-note">当前显示 ${rows.length} 条：epoch ${firstEpoch} - ${lastEpoch}</div>`;
  return `${note}<div class="table-wrap"><table><thead><tr><th>Epoch</th><th>w</th><th>b</th><th>MSE</th><th>RMSE</th><th>MAE</th><th>R 平方</th><th>dw</th><th>db</th></tr></thead><tbody>${visibleRows.map(r => `<tr><td>${r.epoch}</td><td>${r.w.toFixed(6)}</td><td>${r.b.toFixed(6)}</td><td>${r.mse.toFixed(6)}</td><td>${r.rmse.toFixed(6)}</td><td>${r.mae.toFixed(6)}</td><td>${r.r2.toFixed(6)}</td><td>${r.dw.toFixed(6)}</td><td>${r.db.toFixed(6)}</td></tr>`).join("")}</tbody></table></div>`;
}

function tableHtml(frameIndex) {
  const allRows = trainData.history.slice(0, frameIndex + 1);
  const rows = allRows.slice(-50);
  const firstEpoch = rows[0]?.epoch ?? 0;
  const lastEpoch = rows[rows.length - 1]?.epoch ?? 0;
  const note = allRows.length > 50
    ? `<div class="table-note">当前显示最近 50 条：epoch ${firstEpoch} - ${lastEpoch}，已运行 ${allRows.length} 条</div>`
    : `<div class="table-note">当前显示 ${allRows.length} 条：epoch ${firstEpoch} - ${lastEpoch}</div>`;
  return `${note}<div class="table-wrap"><table><thead><tr><th>Epoch</th><th>w</th><th>b</th><th>MSE</th><th>RMSE</th><th>MAE</th><th>R 平方</th><th>dw</th><th>db</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.epoch}</td><td>${r.w.toFixed(6)}</td><td>${r.b.toFixed(6)}</td><td>${r.mse.toFixed(6)}</td><td>${r.rmse.toFixed(6)}</td><td>${r.mae.toFixed(6)}</td><td>${r.r2.toFixed(6)}</td><td>${r.dw.toFixed(6)}</td><td>${r.db.toFixed(6)}</td></tr>`).join("")}</tbody></table></div>`;
}
