// Schema Registry.

function fallbackTrainCharts() {
  return [
    { id: "model_train", title: "模型训练", subtitle: "样本点、当前回归线和最优参考线", renderer: "linear_train_scatter", size: "wide", default: true },
    { id: "learning", title: "学习准则", subtitle: "MSE Loss 随 epoch 的变化", renderer: "loss_curve", size: "", default: false },
    { id: "gradient", title: "Loss 等高线图", subtitle: "w-b 参数空间中的 MSE 损失等高线", renderer: "loss_contour", size: "wide", default: false },
    { id: "loss_surface_3d", title: "Loss 三维曲面图", subtitle: "J(w,b) 曲面、下降轨迹与偏导切线", renderer: "loss_surface_3d", size: "wide", default: true },
    { id: "gradient_descent", title: "梯度下降图", subtitle: "dw、db 随训练轮数的变化", renderer: "gradient_descent", size: "small", default: false },
    { id: "w_path", title: "w 参数轨迹", subtitle: "w 随训练轮数的变化", renderer: "param_path", metric: "w", size: "small", default: false },
    { id: "b_path", title: "b 参数轨迹", subtitle: "b 随训练轮数的变化", renderer: "param_path", metric: "b", size: "small", default: false },
    { id: "rmse", title: "RMSE", subtitle: "评价指标随训练轮数的变化", renderer: "metric_gauge", metric: "rmse", size: "small", default: false },
    { id: "mae", title: "MAE", subtitle: "评价指标随训练轮数的变化", renderer: "metric_gauge", metric: "mae", size: "small", default: false },
    { id: "r2", title: "R²", subtitle: "评价指标随训练轮数的变化", renderer: "metric_gauge", metric: "r2", size: "small", default: false },
    { id: "calc", title: "本轮计算过程", subtitle: "随当前 epoch 更新", renderer: "calc_detail", size: "wide", default: false, kind: "info" },
    { id: "table", title: "每轮参数表", subtitle: "随当前 epoch 更新", renderer: "training_table", size: "wide", default: false, kind: "info" }
  ];
}

function trainChartMeta(view) {
  return trainChartRegistry.find(chart => chart.id === view) || fallbackTrainCharts().find(chart => chart.id === view) || null;
}

async function loadTrainChartRegistry() {
  if (trainChartRegistryLoaded) return trainChartRegistry;
  try {
    const resp = await fetch(`/api/chart_registry?${experimentQueryParam()}&page=train_eval`, { cache: "no-store" });
    const data = await resp.json();
    trainChartRegistry = resp.ok && Array.isArray(data.charts) && data.charts.length ? data.charts : fallbackTrainCharts();
  } catch (err) {
    trainChartRegistry = fallbackTrainCharts();
  }
  trainChartRegistryLoaded = true;
  return trainChartRegistry;
}

async function loadTrainPageSchema() {
  if (trainPageSchema) return trainPageSchema;
  try {
    const resp = await fetch(`/api/page_schema?${experimentQueryParam()}&page=train_eval`, { cache: "no-store" });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Failed to load page schema");
    trainPageSchema = data;
    trainChartRegistry = Array.isArray(data.charts) && data.charts.length ? data.charts : fallbackTrainCharts();
    trainChartRegistryLoaded = true;
  } catch (err) {
    trainPageSchema = {
      page: "train_eval",
      panel: fallbackTrainPanel(),
      charts: fallbackTrainCharts(),
      defaults: {},
      sources: { feature_columns: FEATURE_NAMES, feature_count: FEATURE_NAMES.length }
    };
    trainChartRegistry = trainPageSchema.charts;
    trainChartRegistryLoaded = true;
  }
  return trainPageSchema;
}

async function loadPanelSchema(page, fallbackPanel) {
  try {
    const resp = await fetch(`/api/page_schema?${experimentQueryParam()}&page=${encodeURIComponent(page)}`, { cache: "no-store" });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Failed to load page schema");
    return data;
  } catch (err) {
    return {
      page,
      panel: fallbackPanel,
      charts: [],
      defaults: {},
      sources: { feature_columns: FEATURE_NAMES, feature_count: FEATURE_NAMES.length }
    };
  }
}

function fallbackTrainPanel() {
  return {
    title: "控制面板",
    sections: [
      {
        id: "dataset",
        title: "数据集",
        controls: [
          { type: "stat", name: "sample_count", label: "样本总数", value_id: "sampleCount" },
          { type: "stat", name: "feature_count", label: "特征数量", value_id: "featureCount", default: FEATURE_NAMES.length },
          { type: "select", name: "feature", label: "特征选择", element_id: "trainFeature", source: "feature_columns", default: DEFAULT_FEATURE, auto_prepare: true },
          {
            type: "select",
            name: "use_standardized",
            label: "数据版本",
            element_id: "trainStd",
            default: true,
            auto_prepare: true,
            options: [{ label: "标准化特征", value: true }, { label: "原始特征", value: false }]
          }
        ]
      },
      { id: "display", title: "显示内容", controls: [{ type: "chart_selector", name: "trainViews", label: "显示模式", summary_id: "trainModeSummary" }] },
      {
        id: "params",
        title: "训练参数",
        controls: [
          { type: "number", name: "w0", label: "初始 w", element_id: "w0", step: 0.1, default: 0, auto_prepare: true },
          { type: "number", name: "b0", label: "初始 b", element_id: "b0", step: 0.1, default: 0, auto_prepare: true },
          { type: "range", name: "learning_rate", label: "学习率", element_id: "lr", value_id: "lrText", min_label: "0.001", max_label: "0.200", min: 0.001, max: 0.2, step: 0.001, default: 0.03, format: "fixed3", auto_prepare: true },
          { type: "range", name: "epochs", label: "训练轮数", element_id: "epochs", value_id: "epochsText", min_label: "1", max_label: "500", min: 1, max: 500, step: 1, default: 120, auto_prepare: true },
          { type: "range", name: "speed", label: "动画速度", element_id: "speed", value_id: "speedText", min_label: "快", max_label: "慢", min: 30, max: 600, step: 10, default: 90, suffix: "ms" }
        ]
      },
      { id: "actions", title: "操作", controls: [
        { type: "button", label: "训练一轮", element_id: "stepBtn", style: "primary" },
        { type: "button", label: "自动训练", element_id: "autoBtn", style: "green" },
        { type: "button", label: "暂停", element_id: "pauseBtn", style: "dark" },
        { type: "button", label: "重置", element_id: "resetBtn", style: "rose" }
      ] },
      { id: "runtime", title: "运行状态", controls: [
        { type: "runtime_stat", label: "当前 epoch", value_id: "epochNow" },
        { type: "runtime_stat", label: "当前 Loss", value_id: "lossNow" }
      ] }
    ]
  };
}

function preprocessChartMeta(view) {
  return preprocessPageSchema?.charts?.find(chart => chart.id === view) || null;
}


function predictChartMeta(view) {
  return predictPageSchema?.charts?.find(chart => chart.id === view) || null;
}

function trainChartRenderer(view) {
  return trainChartMeta(view)?.renderer || "";
}

function isTrainInfoView(view) {
  return ["calc_detail", "training_table"].includes(trainChartRenderer(view));
}

function dataCardSize(view) {
  const meta = preprocessChartMeta(view);
  if (meta && meta.size !== undefined) return meta.size || "";
  return view === "all_corr" ? "wide" : "";
}

function trainCardSize(view) {
  const meta = trainChartMeta(view);
  if (meta && meta.size !== undefined) return meta.size || "";
  if (["gradient", "loss_surface_3d", "model_train"].includes(view)) return "wide";
  if (["w_path", "b_path", "rmse", "mae", "r2", "gradient_descent"].includes(view)) return "small";
  return "";
}

function chartTitle(view) {
  const meta = trainChartMeta(view) || preprocessChartMeta(view) || predictChartMeta(view);
  if (meta && meta.title) return meta.title;
  if (view === "loss_surface_3d") return "Loss 三维曲面图";
  if (view === "gradient_descent") return "梯度下降图";
  if (view === "gradient") return "Loss 等高线图";
  if (view === "r2") return "R²";
  return ({
    raw: "原始散点图",
    standardized: "预处理散点图",
    single_corr: "单特征线性相关系数",
    all_corr: "全特征线性相关系数",
    model_train: "模型训练",
    learning: "学习准则",
    gradient: "梯度下降图",
    w_path: "w 参数轨迹",
    b_path: "b 参数轨迹",
    rmse: "RMSE",
    mae: "MAE",
    r2: "R 平方"
  })[view] || view;
}

function chartSub(view, data) {
  const meta = trainChartMeta(view) || preprocessChartMeta(view) || predictChartMeta(view);
  if (meta && meta.subtitle) return meta.subtitle;
  if (view === "loss_surface_3d") return "J(w,b) 曲面、下降轨迹与偏导切线";
  if (view === "gradient_descent") return "dw、db 随训练轮数的变化";
  if (view === "gradient") return "w-b 参数空间中的 MSE 损失等高线";
  if (view === "raw") return `${data.feature} 与 MEDV 的原始关系`;
  if (view === "standardized") return `${data.standardized?.feature_name || data.x_column} 与 MEDV 的关系`;
  if (view === "single_corr") return "当前特征与 MEDV 的 Pearson 相关系数";
  if (view === "all_corr") return "所有特征与 MEDV 的 Pearson 相关系数";
  if (view === "model_train") return "样本点、当前回归线和最优参考线";
  if (view === "learning") return "MSE Loss 随 epoch 的变化";
  if (view === "gradient") return "w-b 参数空间中的损失变化";
  if (view === "w_path") return "w 随训练轮数的变化";
  if (view === "b_path") return "b 随训练轮数的变化";
  if (["rmse", "mae", "r2"].includes(view)) return "评价指标随训练轮数的变化";
  return "";
}
