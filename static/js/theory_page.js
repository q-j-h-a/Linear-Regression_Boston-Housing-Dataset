// Theory Page: editable student-facing slide decks.

const THEORY_DECK_OVERRIDE_URL = apiUrl("/api/theory_deck_overrides");
const THEORY_PAGE_STATE = {
  pageId: "basic",
  currentSlide: 0,
  dirty: false,
  editing: false,
  deck: null,
  slideScaleObserver: null,
  selectedId: null,
  selectedIds: [],
  historyPast: [],
  historyFuture: [],
  snapToGrid: false,
  historyLocked: false,
  serverOverrides: {},
  saveTimer: null,
  saving: false,
  editVersion: 0,
  chartRuntime: {},
  formulaEditor: null,
  pendingReplaceImageId: null,
  activeTableCell: null,
};

const THEORY_HISTORY_LIMIT = 50;
const THEORY_SLIDE_WIDTH = 960;
const THEORY_GRID_SIZE = 8;
const THEORY_SLIDE_EDGE_X = 50;
const THEORY_SLIDE_EDGE_Y = 36;
const THEORY_SLIDE_GAP_X = 28;
const THEORY_SLIDE_GAP_Y = 16;
const THEORY_SLIDE_TITLE_WIDTH = 440;
const THEORY_SLIDE_IMAGE_WIDTH = 400;
const THEORY_SLIDE_IMAGE_X = 510;
const THEORY_SLIDE_TEXT_WIDTH = 420;

const SAFE_FONTS = [
  ["", "默认字体"],
  ['"Microsoft YaHei", sans-serif', "微软雅黑"],
  ['SimSun, serif', "宋体"],
  ['SimHei, sans-serif', "黑体"],
  ["Arial, sans-serif", "Arial"],
  ['"Times New Roman", serif', "Times New Roman"],
  ["Consolas, monospace", "Consolas"],
];

const THEORY_KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css";
const THEORY_KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.js";
const THEORY_FORMULA_STYLE_ID = "theory-formula-style";
const THEORY_KATEX_STYLE_ID = "theory-katex-style";
const THEORY_KATEX_SCRIPT_ID = "theory-katex-script";
const THEORY_DEFAULT_FORMULA = "\\hat{y}=wx+b";
const THEORY_DEFAULT_INLINE_FORMULA = `$${THEORY_DEFAULT_FORMULA}$`;
const THEORY_FORMULA_EDITOR_WIDTH = 340;
const THEORY_FORMULA_EDITOR_HEIGHT = 104;
const THEORY_CARD_DEFAULT_BACKGROUND = "rgba(248, 250, 252, 0.96)";
const THEORY_CARD_COLOR_SWATCHES = [
  { label: "默认", value: THEORY_CARD_DEFAULT_BACKGROUND },
  { label: "浅蓝", value: "#eff6ff" },
  { label: "浅绿", value: "#ecfdf5" },
  { label: "浅黄", value: "#fffbeb" },
  { label: "浅紫", value: "#f5f3ff" },
  { label: "浅红", value: "#fef2f2" },
  { label: "浅灰", value: "#f8fafc" },
  { label: "透明", value: "transparent" },
];

const THEORY_PAGE_IDS = ["basic", "purpose", "knowledge", "dataset", "model", "criterion", "optimization", "evaluation", "result", "thinking"];
const THEORY_PAGE_CONFIGS = window.THEORY_PAGE_CONFIGS || {};
window.THEORY_PAGE_CONFIGS = THEORY_PAGE_CONFIGS;

function theoryPageConfig(pageId) {
  return THEORY_PAGE_CONFIGS[pageId] || null;
}

function theoryTopic(pageId) {
  return theoryPageConfig(pageId)?.topic || null;
}

function theoryScenario(pageId) {
  return theoryPageConfig(pageId)?.scenario || null;
}

function theoryStudentDeck(pageId) {
  return theoryPageConfig(pageId)?.studentDeck || null;
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function layerLabelForType(type) {
  const labels = {
    p: "文本框",
    h1: "标题",
    h2: "副标题",
    eyebrow: "文本框",
    formula: "公式",
    image: "图片",
    table: "表格",
    chart: "图表",
    cards: "卡片",
    bullets: "要点",
    callout: "提示",
    visual: "示意",
  };
  return labels[type] || "图层";
}

function parseLayerZIndex(component, fallback = 1) {
  const raw = component?.zIndex ?? component?.position?.zIndex ?? component?.style?.zIndex ?? fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTheoryComponentLayerFields(component, countsByType, fallbackZIndex = 1) {
  const next = component;
  const type = next.type || "p";
  const count = (countsByType.get(type) || 0) + 1;
  countsByType.set(type, count);
  const zIndex = parseLayerZIndex(next, fallbackZIndex);
  const position = next.position ? { ...next.position } : null;
  if (position && !position.zIndex) position.zIndex = String(zIndex);
  next.position = position;
  next.zIndex = zIndex;
  next.visible = next.visible !== false;
  next.locked = Boolean(next.locked);
  next.layerName = String(next.layerName || `${layerLabelForType(type)} ${count}`);
  if (next.layerName.trim() === `${layerLabelForType(type)}`) next.layerName = `${layerLabelForType(type)} ${count}`;
  if (type === "image") {
    next.imageStyle = normalizeImageStyle(next.imageStyle);
    next.objectFit = normalizeImageObjectFit(next.objectFit);
    next.caption = String(next.caption || "");
    next.alt = next.alt || "课件图片";
  } else if (type === "table") {
    next.tableData = normalizeTableData(next.tableData);
    next.tableStyle = normalizeTableStyle(next.tableStyle);
  }
  return next;
}

function normalizeTheorySlideComponents(slide) {
  const nextSlide = slide ? clone(slide) : { components: [] };
  const countsByType = new Map();
  const components = Array.isArray(nextSlide.components) ? nextSlide.components.map((component, index) => {
    const next = normalizeTheoryComponentLayerFields({ ...component, style: component.style ? { ...component.style } : {}, position: component.position ? { ...component.position } : null }, countsByType, index + 1);
    return next;
  }) : [];
  nextSlide.components = components;
  return nextSlide;
}

function normalizeTheoryDeckForRuntime(pageId, deck) {
  const nextDeck = clone(deck);
  nextDeck.slides = (nextDeck.slides || []).map(slide => normalizeTheorySlideComponents(slide));
  if (pageId === "purpose") {
    const slide = nextDeck.slides?.[0];
    if (slide) slide.components = slide.components.filter(component => component.type !== "visual" && component.type !== "image" && component.type !== "chart");
  }
  return nextDeck;
}

function deckComponentLayers(slide) {
  return [...(slide?.components || [])].sort((a, b) => parseLayerZIndex(b, 1) - parseLayerZIndex(a, 1));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeImageStyle(value) {
  return ["clean", "card", "figure"].includes(value) ? value : "clean";
}

function normalizeImageObjectFit(value) {
  return ["contain", "cover", "fill"].includes(value) ? value : "contain";
}

function defaultTableData() {
  return {
    rows: 4,
    cols: 3,
    header: true,
    cells: [
      ["字段", "含义", "示例"],
      ["RM", "平均房间数", "6.5"],
      ["LSTAT", "低收入人口比例", "12.3"],
      ["MEDV", "房价中位数", "24.0"],
    ],
  };
}

function defaultTableStyle() {
  return {
    preset: "clean",
    fontSize: 15,
    headerBackground: "#eff6ff",
    borderColor: "#cbd5e1",
    textColor: "#0f172a",
    headerTextColor: "#1d4ed8",
  };
}

function normalizeTableData(tableData = null) {
  const fallback = defaultTableData();
  const sourceCells = Array.isArray(tableData?.cells) && tableData.cells.length ? tableData.cells : fallback.cells;
  const rows = Math.max(1, Number(tableData?.rows) || sourceCells.length || fallback.rows);
  const cols = Math.max(1, Number(tableData?.cols) || Math.max(...sourceCells.map(row => Array.isArray(row) ? row.length : 0), fallback.cols));
  const cells = Array.from({ length: rows }, (_, rowIndex) => (
    Array.from({ length: cols }, (_, colIndex) => String(sourceCells[rowIndex]?.[colIndex] ?? ""))
  ));
  return {
    rows,
    cols,
    header: tableData?.header !== false,
    cells,
  };
}

function normalizeTableStyle(tableStyle = null) {
  const fallback = defaultTableStyle();
  const preset = ["clean"].includes(tableStyle?.preset) ? tableStyle.preset : fallback.preset;
  return {
    ...fallback,
    ...(tableStyle || {}),
    preset,
    fontSize: Number(tableStyle?.fontSize) || fallback.fontSize,
  };
}

function makeComponent(type, data = {}) {
  return {
    id: data.id || uid(type),
    type,
    kind: data.kind || "",
    label: data.label || "",
    text: data.text || "",
    title: data.title || "",
    body: data.body || "",
    items: data.items ? clone(data.items) : [],
    style: data.style ? { ...data.style } : {},
    position: data.position ? { ...data.position } : null,
    src: data.src || "",
    alt: data.alt || "",
    caption: data.caption || "",
    imageStyle: data.imageStyle || "",
    objectFit: data.objectFit || "",
    tableData: data.tableData ? normalizeTableData(data.tableData) : null,
    tableStyle: data.tableStyle ? normalizeTableStyle(data.tableStyle) : null,
    chartSpec: data.chartSpec ? clone(data.chartSpec) : null,
    zIndex: data.zIndex ?? data.position?.zIndex ?? 1,
    layerName: data.layerName || layerLabelForType(type),
    locked: Boolean(data.locked),
    visible: data.visible !== false,
  };
}

function withDeckPosition(component, left, top, width, height, zIndex = 1) {
  return {
    ...component,
    position: {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: typeof height === "number" ? `${height}px` : height,
      zIndex
    }
  };
}

function makeDeckBadge(text) {
  return makeComponent("eyebrow", {
    text,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "999px",
      background: "#eef4ff",
      color: "#204ecf",
      fontSize: "13px",
      fontWeight: "800",
      letterSpacing: "0.08em",
      border: "1px solid rgba(32,78,207,0.12)",
      boxShadow: "0 8px 18px rgba(32,78,207,0.08)"
    }
  });
}

function makeDeckTitle(text) {
  return makeComponent("h1", {
    text,
    style: {
      fontSize: "56px",
      fontWeight: "900",
      lineHeight: "1.04",
      color: "#0f172a",
      margin: "0",
      letterSpacing: "-0.03em"
    }
  });
}

function makeDeckSection(text) {
  return makeComponent("h2", {
    text,
    style: {
      fontSize: "30px",
      fontWeight: "900",
      lineHeight: "1.18",
      color: "#0f172a",
      margin: "0",
      letterSpacing: "-0.02em"
    }
  });
}

function makeDeckText(text, style = {}) {
  return makeComponent("p", {
    text,
    style: {
      fontSize: "18px",
      lineHeight: "1.78",
      color: "#334155",
      margin: "0",
      whiteSpace: "pre-wrap",
      ...style
    }
  });
}

function makeDeckCard(title, body) {
  return makeComponent("cards", {
    items: [{
      id: uid("card"),
      title,
      body,
      style: {},
      titleStyle: {
        fontSize: "18px",
        fontWeight: "800",
        color: "#0f172a"
      },
      bodyStyle: {
        fontSize: "15px",
        lineHeight: "1.68",
        color: "#475569"
      }
    }]
  });
}

function chartLabel(kind, alt) {
  const labels = {
    learningflow: "学习流程",
    scatter: "散点关系",
    error: "误差示意",
    normalize: "标准化示意",
    datasetmap: "数据结构示意",
    fitanimate: "拟合过程",
    loss: "损失定义",
    losstrain: "损失下降",
    metriccards: "指标对比",
    hill: "梯度下降",
    contour: "参数路径",
    lrcompare: "学习率对比",
    resultflow: "结果链路",
    multifactor: "多特征关系",
    concepts: "核心概念",
    pipeline: "流程示意"
  };
  return labels[kind] || alt || "示意图";
}

function makeChartImage(kind, alt) {
  return makeComponent("visual", {
    kind,
    label: chartLabel(kind, alt),
    text: `${alt || chartLabel(kind, alt)}\n课堂示意图`,
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      textAlign: "left",
      whiteSpace: "pre-wrap",
      fontSize: "20px",
      fontWeight: "800",
      lineHeight: "1.42",
      color: "#0f172a",
      background: "linear-gradient(180deg, rgba(249,251,255,0.98), rgba(238,244,255,0.94))",
      border: "1px solid rgba(148,163,184,0.22)",
      borderRadius: "28px",
      boxShadow: "0 22px 50px rgba(15,23,42,0.10)"
    }
  });
}

function makeDeckChart(kind, text, chartSpec = {}) {
  return makeComponent("chart", {
    kind,
    label: chartSpec.label || chartLabel(kind, text),
    text: text || chartSpec.caption || chartLabel(kind, text),
    chartSpec,
    style: chartSpec.captionStyle ? { ...chartSpec.captionStyle } : {},
  });
}

function theoryChartTheme(kind) {
  const blue = "#2563eb";
  const sky = "#60a5fa";
  const slate = "#0f172a";
  const amber = "#f59e0b";
  const emerald = "#10b981";
  const rose = "#f43f5e";
  const violet = "#6366f1";
  if (kind === "learningflow") {
    return { blue, sky, slate, amber, emerald, rose, violet };
  }
  return { blue, sky, slate, amber, emerald, rose, violet };
}

function makeLearningFlowChartOption(chartSpec = {}, options = {}) {
  const theme = theoryChartTheme("learningflow");
  const steps = (Array.isArray(chartSpec.steps) && chartSpec.steps.length ? chartSpec.steps : [
    { name: "读懂数据", desc: "识别特征、目标值和样本含义", color: theme.blue },
    { name: "建立模型", desc: "理解 y = wx + b 如何完成预测", color: theme.violet },
    { name: "判断结果", desc: "用误差和指标解释模型效果", color: theme.amber },
  ]).map((step, index) => ({
    x: step.x ?? (18 + index * 31),
    y: step.y ?? (index === 1 ? 44 : 58),
    name: step.name || `步骤 ${index + 1}`,
    desc: step.desc || "",
    color: step.color || [theme.blue, theme.violet, theme.amber, theme.emerald][index % 4],
  }));
  const lineData = [];
  const pulseData = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    const from = steps[i];
    const to = steps[i + 1];
    lineData.push({
      coords: [[from.x, from.y], [to.x, to.y]],
      lineStyle: { color: from.color, width: 3, opacity: 0.8 },
    });
    pulseData.push({
      coords: [[from.x, from.y], [to.x, to.y]],
      lineStyle: { color: to.color, width: 0, opacity: 0 },
    });
  }
  return {
    animation: !options.staticMode,
    animationDuration: 900,
    animationDurationUpdate: 600,
    grid: { left: 8, right: 8, top: 18, bottom: 14, containLabel: false },
    xAxis: { min: 0, max: 100, show: false, type: "value" },
    yAxis: { min: 0, max: 100, show: false, type: "value" },
    series: [
      {
        type: "lines",
        coordinateSystem: "cartesian2d",
        z: 1,
        polyline: false,
        effect: options.staticMode ? { show: false } : {
          show: true,
          period: 3.8,
          trailLength: 0.16,
          symbol: "circle",
          symbolSize: 10,
          color: theme.sky,
        },
        lineStyle: {
          width: 3,
          curveness: 0.18,
          opacity: 0.9,
          color: theme.blue,
        },
        data: pulseData,
      },
      {
        type: "lines",
        coordinateSystem: "cartesian2d",
        z: 2,
        polyline: false,
        lineStyle: {
          width: 3,
          curveness: 0.18,
          opacity: 0.75,
          color: theme.blue,
        },
        data: lineData,
      },
      {
        type: "scatter",
        coordinateSystem: "cartesian2d",
        z: 3,
        symbolSize: 72,
        itemStyle: {
          shadowBlur: 24,
          shadowColor: "rgba(37,99,235,0.18)",
        },
        label: {
          show: true,
          formatter: params => `{name|${params.data.name}}\n{desc|${params.data.desc || ""}}`,
          rich: {
            name: { fontSize: 15, fontWeight: 800, color: theme.slate, lineHeight: 22 },
            desc: { fontSize: 11, color: "#475569", lineHeight: 16 },
          },
        },
        data: steps.map(step => ({
          value: [step.x, step.y],
          name: step.name,
          desc: step.desc,
          itemStyle: {
            color: "#ffffff",
            borderColor: step.color,
            borderWidth: 3,
          },
        })),
      }
    ],
    graphic: steps.map((step, index) => ({
      type: "text",
      left: `${step.x}%`,
      top: `${Math.max(10, step.y - 20)}%`,
      z: 10,
      style: {
        text: String(index + 1).padStart(2, "0"),
        fill: step.color,
        fontSize: 28,
        fontWeight: 800,
        textAlign: "center",
      }
    })),
  };
}

function makeDatasetHistogramChartOption(chartSpec = {}, options = {}) {
  const bins = Array.isArray(chartSpec.bins) && chartSpec.bins.length 
    ? chartSpec.bins 
    : [
        { label: "5-10", count: 8 },
        { label: "10-15", count: 25 },
        { label: "15-20", count: 68 },
        { label: "20-25", count: 95 },
        { label: "25-30", count: 52 },
        { label: "30-35", count: 30 },
        { label: "35-40", count: 18 },
        { label: "40-45", count: 12 },
        { label: "45-50", count: 9 },
        { label: "50+", count: 16 }
      ];
  const labels = bins.map(bin => bin.label);
  const values = bins.map(bin => Number(bin.count) || 0);
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 44, right: 18, top: 36, bottom: 42, containLabel: false },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: labels,
      name: chartSpec.xName || "MEDV 区间",
      nameLocation: "middle",
      nameGap: 30,
      axisTick: { alignWithLabel: true },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      name: chartSpec.yName || "样本数",
      nameTextStyle: { color: "#475569", fontSize: 11, padding: [0, 0, 4, 0] },
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
    },
    series: [{
      type: "bar",
      data: values,
      barWidth: "58%",
      itemStyle: {
        color: "#2563eb",
        borderRadius: [6, 6, 0, 0],
      },
      emphasis: { itemStyle: { color: "#1d4ed8" } },
    }],
  };
}

function makeDatasetScatterChartOption(chartSpec = {}, options = {}) {
  const points = Array.isArray(chartSpec.points) && chartSpec.points.length 
    ? chartSpec.points 
    : [
        [5.5, 18.0], [5.8, 20.0], [6.0, 22.5], [6.2, 21.0], [6.4, 25.0],
        [6.6, 28.0], [6.8, 30.0], [7.0, 32.5], [7.2, 35.0], [7.5, 42.0],
        [7.8, 48.0], [5.6, 17.5], [5.9, 19.5], [6.3, 24.0], [6.7, 27.5]
      ];
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 46, right: 20, top: 34, bottom: 44, containLabel: false },
    tooltip: {
      trigger: "item",
      formatter: params => `RM: ${params.value?.[0]}<br>MEDV: ${params.value?.[1]}`,
    },
    xAxis: {
      type: "value",
      min: chartSpec.xMin ?? 3.4,
      max: chartSpec.xMax ?? 9,
      name: chartSpec.xName || "RM 平均房间数",
      nameLocation: "middle",
      nameGap: 30,
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      min: chartSpec.yMin ?? 0,
      max: chartSpec.yMax ?? 52,
      name: chartSpec.yName || "MEDV",
      nameTextStyle: { color: "#475569", fontSize: 11 },
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    series: [{
      type: "scatter",
      data: points,
      symbolSize: 7,
      itemStyle: {
        color: "rgba(37, 99, 235, 0.72)",
        borderColor: "rgba(255, 255, 255, 0.86)",
        borderWidth: 1,
      },
    }],
  };
}

function makeDatasetTrainingFlowChartOption(chartSpec = {}, options = {}) {
  const theme = theoryChartTheme("learningflow");
  const steps = (Array.isArray(chartSpec.steps) && chartSpec.steps.length ? chartSpec.steps : [
    { name: "数据读取", desc: "载入 CSV" },
    { name: "分离 X / y", desc: "特征与目标" },
    { name: "划分数据集", desc: "训练 / 测试" },
    { name: "特征标准化", desc: "统一量纲" },
    { name: "模型训练", desc: "学习参数" },
    { name: "预测评估", desc: "检查误差" },
  ]).map((step, index, list) => ({
    x: list.length === 1 ? 50 : 8 + index * (84 / (list.length - 1)),
    y: 50,
    name: step.name || `步骤 ${index + 1}`,
    desc: step.desc || "",
    color: step.color || [theme.blue, theme.violet, theme.emerald, theme.amber, theme.rose, theme.slate][index % 6],
  }));
  return {
    animation: !options.staticMode,
    grid: { left: 8, right: 8, top: 20, bottom: 18, containLabel: false },
    xAxis: { min: 0, max: 100, show: false, type: "value" },
    yAxis: { min: 0, max: 100, show: false, type: "value" },
    series: [
      {
        type: "lines",
        coordinateSystem: "cartesian2d",
        z: 1,
        effect: options.staticMode ? { show: false } : {
          show: true,
          period: 4,
          trailLength: 0.12,
          symbol: "arrow",
          symbolSize: 9,
          color: "#60a5fa",
        },
        lineStyle: { color: "#94a3b8", width: 2.5, opacity: 0.9 },
        data: steps.slice(0, -1).map((step, index) => ({
          coords: [[step.x, step.y], [steps[index + 1].x, steps[index + 1].y]],
        })),
      },
      {
        type: "scatter",
        coordinateSystem: "cartesian2d",
        z: 2,
        symbol: "roundRect",
        symbolSize: [96, 58],
        label: {
          show: true,
          formatter: params => `{name|${params.data.name}}\n{desc|${params.data.desc}}`,
          rich: {
            name: { fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 22 },
            desc: { fontSize: 10, color: "#64748b", lineHeight: 15 },
          },
        },
        data: steps.map(step => ({
          value: [step.x, step.y],
          name: step.name,
          desc: step.desc,
          itemStyle: {
            color: "#ffffff",
            borderColor: step.color,
            borderWidth: 2.5,
            shadowColor: "rgba(15, 23, 42, 0.10)",
            shadowBlur: 12,
          },
        })),
      },
    ],
  };
}

function makeRegressionFitChartOption(chartSpec = {}, options = {}) {
  const points = Array.isArray(chartSpec.points) ? chartSpec.points : [
    [4.6, 17], [5.1, 20], [5.6, 21], [5.9, 24], [6.2, 25], [6.6, 29], [7.0, 32], [7.4, 36], [7.8, 39]
  ];
  const line = Array.isArray(chartSpec.line) ? chartSpec.line : [[4.4, 16], [8.0, 40]];
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    tooltip: { trigger: "item" },
    legend: {
      top: 12,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: "#475569", fontSize: 11 },
    },
    xAxis: {
      type: "value",
      min: chartSpec.xMin ?? 4.2,
      max: chartSpec.xMax ?? 8.2,
      name: chartSpec.xName || "地区特征",
      nameLocation: "middle",
      nameGap: 28,
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      min: chartSpec.yMin ?? 12,
      max: chartSpec.yMax ?? 44,
      name: chartSpec.yName || "房价",
      nameLocation: "middle",
      nameGap: 38,
      nameTextStyle: { color: "#475569", fontSize: 11 },
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    series: [
      {
        name: chartSpec.pointLabel || "真实样本",
        type: "scatter",
        data: points,
        symbolSize: 6,
        itemStyle: {
          color: "rgba(37,99,235,.7)",
        },
      },
      {
        name: chartSpec.lineLabel || "回归线",
        type: "line",
        data: line,
        showSymbol: false,
        lineStyle: { color: "#0f9f78", width: 3 },
      },
    ],
  };
}

function makeLossCurveChartOption(chartSpec = {}, options = {}) {
  const values = Array.isArray(chartSpec.values) && chartSpec.values.length
    ? chartSpec.values
    : [98, 74, 55, 41, 31, 24, 19, 16, 14, 13, 12.5, 12.2];
  return {
    animation: !options.staticMode,
    animationDuration: 800,
    grid: { left: 58, right: 24, top: 42, bottom: 42 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "value",
      name: chartSpec.xName || "epoch",
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      name: chartSpec.yName || "MSE",
      nameTextStyle: { color: "#475569", fontSize: 11 },
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
    },
    series: [{
      type: "line",
      data: values.map((value, index) => [index + 1, value]),
      smooth: true,
      symbolSize: 5,
      lineStyle: { color: "#5b35f5", width: 3 },
      itemStyle: { color: "#5b35f5" },
      areaStyle: { color: "#5b35f522" },
    }],
  };
}

function makeFeatureCoefficientChartOption(chartSpec = {}, options = {}) {
  const features = Array.isArray(chartSpec.features) && chartSpec.features.length ? chartSpec.features : ["RM", "LSTAT", "PTRATIO", "DIS", "NOX"];
  const values = Array.isArray(chartSpec.values) && chartSpec.values.length ? chartSpec.values : [3.8, -3.2, -1.9, 1.1, -1.4];
  return {
    animation: !options.staticMode,
    animationDuration: 800,
    grid: { left: 58, right: 26, top: 28, bottom: 36 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "category",
      data: features,
      axisLabel: { color: "#334155", fontSize: 12, fontWeight: 700 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      data: values.map(value => ({
        value,
        itemStyle: { color: value >= 0 ? "#5b35f5" : "#d9354f", borderRadius: value >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6] },
      })),
      barWidth: "46%",
      label: {
        show: true,
        position: "right",
        formatter: params => String(params.value),
        color: "#475569",
        fontSize: 11,
      },
    }],
  };
}

function makeActualPredictionCompareChartOption(chartSpec = {}, options = {}) {
  const actual = Number(chartSpec.actual ?? 25.0);
  const predicted = Number(chartSpec.predicted ?? 22.8);
  const error = Number((actual - predicted).toFixed(2));
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 48, right: 28, top: 42, bottom: 48 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: ["真实房价", "预测房价"],
      axisTick: { show: false },
      axisLabel: { color: "#334155", fontSize: 12, fontWeight: 700 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      name: chartSpec.yName || "MEDV",
      min: 0,
      max: Math.max(32, actual + 6, predicted + 6),
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        barWidth: "42%",
        data: [
          { value: actual, itemStyle: { color: "rgba(37,99,235,.72)", borderRadius: [8, 8, 0, 0] } },
          { value: predicted, itemStyle: { color: "#0f9f78", borderRadius: [8, 8, 0, 0] } },
        ],
        label: { show: true, position: "top", formatter: params => Number(params.value).toFixed(1), color: "#334155", fontSize: 12, fontWeight: 800 },
        markLine: {
          symbol: "none",
          label: {
            show: true,
            formatter: `预测误差 ${Math.abs(error).toFixed(1)}`,
            color: "#d9354f",
            fontSize: 12,
            fontWeight: 800,
          },
          lineStyle: { color: "#d9354f", type: "dashed", width: 2 },
          data: [{ yAxis: predicted }, { yAxis: actual }],
        },
      },
    ],
    graphic: [{
      type: "text",
      right: 18,
      top: 12,
      style: {
        text: `真实值 ${actual.toFixed(1)}  预测值 ${predicted.toFixed(1)}`,
        fill: "#475569",
        fontSize: 12,
        fontWeight: 700,
      },
    }],
  };
}

function makeResidualFitChartOption(chartSpec = {}, options = {}) {
  const points = Array.isArray(chartSpec.points) ? chartSpec.points : [
    [4.6, 17], [5.0, 19], [5.4, 21], [5.7, 23], [6.1, 25], [6.4, 27], [6.8, 31], [7.2, 34], [7.7, 38]
  ];
  const line = Array.isArray(chartSpec.line) ? chartSpec.line : [[4.4, 16], [8.0, 40]];
  const [x0, y0] = line[0];
  const [x1, y1] = line[line.length - 1];
  const slope = (y1 - y0) / (x1 - x0 || 1);
  const intercept = y0 - slope * x0;
  const residualLines = points.slice(1, 8).map(point => {
    const predicted = slope * point[0] + intercept;
    return { coords: [[point[0], predicted], point] };
  });
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    tooltip: { trigger: "item" },
    legend: { top: 12, textStyle: { color: "#475569", fontSize: 11 } },
    xAxis: {
      type: "value",
      min: chartSpec.xMin ?? 4.2,
      max: chartSpec.xMax ?? 8.2,
      name: chartSpec.xName || "特征值",
      nameLocation: "middle",
      nameGap: 28,
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      min: chartSpec.yMin ?? 12,
      max: chartSpec.yMax ?? 44,
      name: chartSpec.yName || "房价 MEDV",
      nameLocation: "middle",
      nameGap: 38,
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    series: [
      {
        name: "残差",
        type: "lines",
        coordinateSystem: "cartesian2d",
        data: residualLines,
        symbol: ["none", "none"],
        lineStyle: { color: "#d9354f", width: 2, type: "dashed", opacity: 0.75 },
        z: 1,
      },
      {
        name: "样本点",
        type: "scatter",
        data: points,
        symbolSize: 6,
        itemStyle: { color: "rgba(37,99,235,.7)" },
        z: 3,
      },
      {
        name: "回归线",
        type: "line",
        data: line,
        showSymbol: false,
        lineStyle: { color: "#0f9f78", width: 3 },
        z: 2,
      },
    ],
  };
}

function makeModelTrainingFlowChartOption(chartSpec = {}, options = {}) {
  const theme = theoryChartTheme("learningflow");
  const steps = (Array.isArray(chartSpec.steps) && chartSpec.steps.length ? chartSpec.steps : [
    { name: "X_train", desc: "训练特征", color: theme.blue },
    { name: "y_train", desc: "真实房价", color: theme.violet },
    { name: "LinearRegression()", desc: "创建模型", color: theme.emerald },
    { name: "model.fit()", desc: "学习参数", color: theme.amber },
    { name: "训练好的模型", desc: "用于预测", color: theme.rose },
  ]).map((step, index, list) => ({
    x: 50,
    y: list.length === 1 ? 50 : 10 + index * (80 / (list.length - 1)),
    name: step.name || `步骤 ${index + 1}`,
    desc: step.desc || "",
    color: step.color || [theme.blue, theme.violet, theme.emerald, theme.amber, theme.rose][index % 5],
  }));
  return {
    animation: !options.staticMode,
    grid: { left: 10, right: 10, top: 10, bottom: 10 },
    xAxis: { min: 0, max: 100, show: false, type: "value" },
    yAxis: { min: 0, max: 100, show: false, inverse: true, type: "value" },
    series: [
      {
        type: "lines",
        coordinateSystem: "cartesian2d",
        z: 1,
        effect: options.staticMode ? { show: false } : {
          show: true,
          period: 3.2,
          trailLength: 0.12,
          symbol: "arrow",
          symbolSize: 8,
          color: "#60a5fa",
        },
        lineStyle: { color: "#94a3b8", width: 2, opacity: 0.82 },
        data: steps.slice(0, -1).map((step, index) => ({
          coords: [[step.x, step.y + 7], [steps[index + 1].x, steps[index + 1].y - 7]],
        })),
      },
      {
        type: "scatter",
        coordinateSystem: "cartesian2d",
        z: 2,
        symbol: "roundRect",
        symbolSize: [190, 42],
        label: {
          show: true,
          formatter: params => `{name|${params.data.name}}\n{desc|${params.data.desc}}`,
          rich: {
            name: { fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 18 },
            desc: { fontSize: 10, color: "#64748b", lineHeight: 14 },
          },
        },
        data: steps.map(step => ({
          value: [step.x, step.y],
          name: step.name,
          desc: step.desc,
          itemStyle: {
            color: "#ffffff",
            borderColor: step.color,
            borderWidth: 2,
            shadowColor: "rgba(15, 23, 42, 0.08)",
            shadowBlur: 10,
          },
        })),
      },
    ],
  };
}

function makeFitBeforeAfterChartOption(chartSpec = {}, options = {}) {
  const points = Array.isArray(chartSpec.points) ? chartSpec.points : [[4.6, 17], [5.0, 19], [5.4, 21], [5.7, 23], [6.1, 25], [6.4, 27], [6.8, 31], [7.2, 34], [7.7, 38]];
  const before = Array.isArray(chartSpec.beforeLine) ? chartSpec.beforeLine : [[4.4, 29], [8.0, 24]];
  const after = Array.isArray(chartSpec.afterLine) ? chartSpec.afterLine : [[4.4, 16], [8.0, 40]];
  const baseAxis = {
    type: "value",
    splitLine: { lineStyle: { color: "#edf2f7" } },
    axisLabel: { color: "#475569", fontSize: 10 },
    axisLine: { lineStyle: { color: "#cbd5e1" } },
  };
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    tooltip: { trigger: "item" },
    legend: { top: 10, textStyle: { color: "#475569", fontSize: 11 } },
    grid: [
      { left: 44, right: "54%", top: 54, bottom: 44 },
      { left: "56%", right: 20, top: 54, bottom: 44 },
    ],
    xAxis: [
      { ...baseAxis, min: 4.2, max: 8.2, gridIndex: 0, name: "优化前", nameLocation: "middle", nameGap: 26 },
      { ...baseAxis, min: 4.2, max: 8.2, gridIndex: 1, name: "优化后", nameLocation: "middle", nameGap: 26 },
    ],
    yAxis: [
      { ...baseAxis, min: 12, max: 44, gridIndex: 0, name: "MEDV", nameGap: 30 },
      { ...baseAxis, min: 12, max: 44, gridIndex: 1 },
    ],
    series: [
      { name: "样本点", type: "scatter", xAxisIndex: 0, yAxisIndex: 0, data: points, symbolSize: 5, itemStyle: { color: "rgba(37,99,235,.7)" } },
      { name: "优化前拟合线", type: "line", xAxisIndex: 0, yAxisIndex: 0, data: before, showSymbol: false, lineStyle: { color: "#d9354f", width: 3 } },
      { name: "样本点", type: "scatter", xAxisIndex: 1, yAxisIndex: 1, data: points, symbolSize: 5, itemStyle: { color: "rgba(37,99,235,.7)" } },
      { name: "优化后拟合线", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: after, showSymbol: false, lineStyle: { color: "#0f9f78", width: 3 } },
    ],
  };
}

function makeMultipleParameterLinesChartOption(chartSpec = {}, options = {}) {
  const points = Array.isArray(chartSpec.points) ? chartSpec.points : [[4.6, 17], [5.0, 19], [5.4, 21], [5.7, 23], [6.1, 25], [6.4, 27], [6.8, 31], [7.2, 34], [7.7, 38]];
  const lines = Array.isArray(chartSpec.lines) && chartSpec.lines.length ? chartSpec.lines : [
    { name: "参数 A：整体偏低", data: [[4.4, 12], [8.0, 26]], color: "#d9354f" },
    { name: "参数 B：整体偏高", data: [[4.4, 30], [8.0, 43]], color: "#c47a11" },
    { name: "参数 C：更接近样本", data: [[4.4, 16], [8.0, 40]], color: "#0f9f78" },
  ];
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    tooltip: { trigger: "item" },
    legend: { top: 10, textStyle: { color: "#475569", fontSize: 11 } },
    grid: { left: 58, right: 24, top: 58, bottom: 48 },
    xAxis: { type: "value", min: 4.2, max: 8.2, name: "特征值", nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { color: "#edf2f7" } }, axisLabel: { color: "#475569", fontSize: 11 }, axisLine: { lineStyle: { color: "#cbd5e1" } } },
    yAxis: { type: "value", min: 10, max: 46, name: "房价 MEDV", nameLocation: "middle", nameGap: 38, splitLine: { lineStyle: { color: "#edf2f7" } }, axisLabel: { color: "#475569", fontSize: 11 }, axisLine: { lineStyle: { color: "#cbd5e1" } } },
    series: [
      { name: "样本点", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: "rgba(37,99,235,.7)" } },
      ...lines.map(line => ({ name: line.name, type: "line", data: line.data, showSymbol: false, lineStyle: { color: line.color, width: 3, type: line.type || "solid" } })),
    ],
  };
}

function makeGradientDescentPathChartOption(chartSpec = {}, options = {}) {
  const path = Array.isArray(chartSpec.path) && chartSpec.path.length ? chartSpec.path : [[-4.8, 6.4], [-3.2, 4.6], [-2.0, 3.2], [-1.1, 2.2], [-0.5, 1.5], [-0.12, 1.1]];
  const levels = [0.35, 0.75, 1.25, 1.9, 2.8, 4.1, 5.8].map((radius, index) => ({
    type: "circle",
    shape: { cx: 0, cy: 1, r: radius },
    style: { stroke: ["#c7d2fe", "#93c5fd", "#60a5fa", "#22c55e", "#eab308", "#f59e0b", "#f43f5e"][index], fill: "transparent", lineWidth: 1.4, opacity: 0.55 },
    silent: true,
  }));
  return {
    animation: !options.staticMode,
    animationDuration: 800,
    tooltip: { trigger: "item" },
    grid: { left: 56, right: 28, top: 42, bottom: 48 },
    xAxis: { type: "value", min: -6, max: 2, name: "w", nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { color: "#edf2f7" } } },
    yAxis: { type: "value", min: -1.5, max: 7, name: "b", nameLocation: "middle", nameGap: 34, splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [
      ...levels.map((level, index) => ({
        name: `loss_level_${index + 1}`,
        type: "custom",
        silent: true,
        renderItem: (params, api) => {
          const center = api.coord([level.shape.cx, level.shape.cy]);
          const edge = api.coord([level.shape.cx + level.shape.r, level.shape.cy]);
          return { type: "circle", shape: { cx: center[0], cy: center[1], r: Math.abs(edge[0] - center[0]) }, style: level.style };
        },
        data: [[0, 1]],
      })),
      { name: "update_path", type: "line", data: path, symbol: "circle", symbolSize: 6, lineStyle: { color: "#111827", width: 3 }, itemStyle: { color: "#fff", borderColor: "#111827", borderWidth: 1.5 }, z: 8 },
      { name: "current_params", type: "scatter", data: [path[path.length - 1]], symbolSize: 18, itemStyle: { color: "#5b35f5", borderColor: "#fff", borderWidth: 3 }, z: 10 },
      { name: "best_params", type: "scatter", data: [[0, 1]], symbol: "diamond", symbolSize: 16, itemStyle: { color: "#0f9f78", borderColor: "#fff", borderWidth: 2 }, z: 9 },
    ],
  };
}

function makeLearningRateCompareChartOption(chartSpec = {}, options = {}) {
  const slow = chartSpec.slow || [96, 91, 86, 81, 76, 72, 68, 64, 61, 58, 55, 53];
  const good = chartSpec.good || [96, 70, 50, 35, 25, 19, 16, 14, 13, 12.5, 12.2, 12.1];
  const large = chartSpec.large || [96, 64, 88, 52, 94, 70, 112, 90, 132, 118, 150, 142];
  const makeData = values => values.map((value, index) => [index + 1, value]);
  return {
    animation: !options.staticMode,
    animationDuration: 800,
    tooltip: { trigger: "axis" },
    legend: { top: 10, textStyle: { color: "#475569", fontSize: 11 } },
    grid: { left: 52, right: 24, top: 58, bottom: 42 },
    xAxis: { type: "value", name: "epoch", splitLine: { lineStyle: { color: "#edf2f7" } }, axisLabel: { color: "#475569", fontSize: 11 } },
    yAxis: { type: "value", name: "MSE", splitLine: { lineStyle: { color: "#edf2f7" } }, axisLabel: { color: "#475569", fontSize: 11 } },
    series: [
      { name: "学习率太小", type: "line", smooth: true, data: makeData(slow), showSymbol: false, lineStyle: { color: "#c47a11", width: 3 } },
      { name: "学习率合适", type: "line", smooth: true, data: makeData(good), showSymbol: false, lineStyle: { color: "#5b35f5", width: 3 }, areaStyle: { color: "#5b35f522" } },
      { name: "学习率太大", type: "line", smooth: true, data: makeData(large), showSymbol: false, lineStyle: { color: "#d9354f", width: 3, type: "dashed" } },
    ],
  };
}

function makeErrorSquareAmplifyChartOption(chartSpec = {}, options = {}) {
  const errors = Array.isArray(chartSpec.errors) && chartSpec.errors.length ? chartSpec.errors : [1, 2, 5];
  const squares = errors.map(value => value * value);
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 46, right: 22, top: 42, bottom: 42 },
    xAxis: {
      type: "category",
      data: errors.map(value => `误差 ${value}`),
      axisTick: { show: false },
      axisLabel: { color: "#334155", fontSize: 12, fontWeight: 700 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      name: "平方后",
      splitLine: { lineStyle: { color: "#edf2f7" } },
      axisLabel: { color: "#475569", fontSize: 11 },
    },
    series: [{
      type: "bar",
      barWidth: "42%",
      data: squares.map((value, index) => ({
        value,
        itemStyle: { color: index === squares.length - 1 ? "#d9354f" : "#5b35f5", borderRadius: [8, 8, 0, 0] },
      })),
      label: {
        show: true,
        position: "top",
        formatter: params => `${errors[params.dataIndex]}² = ${params.value}`,
        color: "#334155",
        fontSize: 12,
        fontWeight: 800,
      },
    }],
  };
}

function makeR2ScaleChartOption(chartSpec = {}, options = {}) {
  const value = Math.max(0, Math.min(1, Number(chartSpec.value ?? 0.78)));
  return {
    animation: !options.staticMode,
    animationDuration: 700,
    grid: { left: 48, right: 48, top: 80, bottom: 70 },
    xAxis: {
      type: "value",
      min: 0,
      max: 1,
      interval: 0.5,
      axisLabel: { color: "#475569", fontSize: 12, formatter: value => Number(value).toFixed(1) },
      axisLine: { lineStyle: { color: "#cbd5e1", width: 2 } },
      axisTick: { length: 8, lineStyle: { color: "#94a3b8" } },
      splitLine: { show: false },
    },
    yAxis: { type: "value", min: 0, max: 1, show: false },
    series: [
      {
        name: "解释能力",
        type: "bar",
        data: [[value, 0.5]],
        barWidth: 18,
        itemStyle: { color: "#5b35f5", borderRadius: 999 },
        encode: { x: 0, y: 1 },
        z: 3,
      },
      {
        name: "刻度背景",
        type: "bar",
        data: [[1, 0.5]],
        barWidth: 18,
        itemStyle: { color: "rgba(226, 232, 240, .95)", borderRadius: 999 },
        encode: { x: 0, y: 1 },
        barGap: "-100%",
        silent: true,
        z: 1,
      },
      {
        name: "当前 R²",
        type: "scatter",
        data: [[value, 0.5]],
        symbolSize: 18,
        itemStyle: { color: "#0f9f78", borderColor: "#fff", borderWidth: 3 },
        z: 4,
      },
    ],
    graphic: [
      { type: "text", left: "12%", bottom: 24, style: { text: "较弱", fill: "#64748b", fontSize: 13, fontWeight: 700 } },
      { type: "text", left: "47%", bottom: 24, style: { text: "一般", fill: "#64748b", fontSize: 13, fontWeight: 700 } },
      { type: "text", right: "10%", bottom: 24, style: { text: "较好", fill: "#64748b", fontSize: 13, fontWeight: 700 } },
      { type: "text", left: "center", top: 28, style: { text: `R² = ${value.toFixed(2)}`, fill: "#0f172a", fontSize: 24, fontWeight: 800, textAlign: "center" } },
      { type: "text", left: "center", top: 58, style: { text: "越接近 1，整体解释能力越强", fill: "#475569", fontSize: 13, textAlign: "center" } },
    ],
  };
}

function resolveTheoryChartOption(component, options = {}) {
  let kind = component.chartSpec?.kind || component.kind || "learningflow";
  
  // Align standard slide visual/chart kind mappings
  if (kind === "scatter") kind = "dataset-scatter";
  if (kind === "datasetmap") kind = "dataset-training-flow";
  if (kind === "pipeline" || kind === "resultflow") kind = "model-training-flow";
  if (kind === "loss" || kind === "losstrain") kind = "loss-curve";
  if (kind === "error") kind = "error-square-amplify";
  if (kind === "fitanimate") kind = "regression-fit";
  if (kind === "hill" || kind === "contour") kind = "gradient-descent-path";
  if (kind === "lrcompare") kind = "learning-rate-compare";
  if (kind === "metriccards") kind = "r2-scale";
  
  if (kind === "dataset-histogram") return makeDatasetHistogramChartOption(component.chartSpec || {}, options);
  if (kind === "dataset-scatter") return makeDatasetScatterChartOption(component.chartSpec || {}, options);
  if (kind === "dataset-training-flow") return makeDatasetTrainingFlowChartOption(component.chartSpec || {}, options);
  if (kind === "regression-fit") return makeRegressionFitChartOption(component.chartSpec || {}, options);
  if (kind === "loss-curve") return makeLossCurveChartOption(component.chartSpec || {}, options);
  if (kind === "feature-coefficients") return makeFeatureCoefficientChartOption(component.chartSpec || {}, options);
  if (kind === "actual-prediction-compare") return makeActualPredictionCompareChartOption(component.chartSpec || {}, options);
  if (kind === "residual-fit") return makeResidualFitChartOption(component.chartSpec || {}, options);
  if (kind === "model-training-flow") return makeModelTrainingFlowChartOption(component.chartSpec || {}, options);
  if (kind === "fit-before-after") return makeFitBeforeAfterChartOption(component.chartSpec || {}, options);
  if (kind === "multi-parameter-lines") return makeMultipleParameterLinesChartOption(component.chartSpec || {}, options);
  if (kind === "gradient-descent-path") return makeGradientDescentPathChartOption(component.chartSpec || {}, options);
  if (kind === "learning-rate-compare") return makeLearningRateCompareChartOption(component.chartSpec || {}, options);
  if (kind === "error-square-amplify") return makeErrorSquareAmplifyChartOption(component.chartSpec || {}, options);
  if (kind === "r2-scale") return makeR2ScaleChartOption(component.chartSpec || {}, options);
  if (kind === "learningflow") return makeLearningFlowChartOption(component.chartSpec || {}, options);
  return makeLearningFlowChartOption(component.chartSpec || {}, options);
}

function makeStudentTitleSlide(spec, pageId) {
  return {
    id: uid("slide"),
    layout: "default",
    components: [
      withDeckPosition(makeDeckBadge("理论部分"), 50, 36, 116, 32, 2),
      withDeckPosition(makeDeckTitle(spec.title || theoryTopic(pageId)?.title || "理论内容"), 50, 88, 430, 110, 2),
      withDeckPosition(makeDeckText(spec.subtitle || "", { fontSize: "18px" }), 50, 218, 420, 72, 2),
      withDeckPosition(makeChartImage(spec.heroKind || pageId, `${spec.title || "理论页"}概览`), 530, 88, 330, 280, 1)
    ]
  };
}

function makeStudentSlide(slideSpec = {}) {
  const components = [
    withDeckPosition(makeDeckSection(slideSpec.title || "理论内容"), 50, 48, 430, 48, 2)
  ];

  if (slideSpec.cards?.length) {
    components.push(withDeckPosition(makeComponent("cards", {
      items: slideSpec.cards.map(([title, body]) => ({
        id: uid("card"),
        title,
        body,
        style: {},
        titleStyle: { fontSize: "18px", fontWeight: "700", color: "#172033" },
        bodyStyle: { fontSize: "14px", lineHeight: "1.6", color: "#475569" }
      }))
    }), 50, 132, 840, "auto", 2));
  }

  if (slideSpec.formula) {
    components.push(withDeckPosition(makeComponent("formula", {
      text: slideSpec.formula,
      style: {
        whiteSpace: "pre-wrap",
        fontSize: "24px",
        lineHeight: "1.7",
        color: "#172033"
      }
    }), 50, 144, 430, 200, 2));
  } else if (slideSpec.text) {
    components.push(withDeckPosition(makeDeckText(slideSpec.text, { fontSize: "18px" }), 50, 144, 430, 190, 2));
  }

  if (slideSpec.chart) {
    const chartKind = slideSpec.chart.kind || slideSpec.chart.chartKind || "learningflow";
    components.push(withDeckPosition(makeDeckChart(chartKind, slideSpec.chart.caption || slideSpec.note || slideSpec.title || "图表示意", slideSpec.chart), 550, 136, 310, 220, 1));
  }

  if (slideSpec.image) {
    components.push(withDeckPosition(makeChartImage(slideSpec.image, slideSpec.note || slideSpec.title || "示意图"), 550, 136, 310, 220, 1));
  }

  if (slideSpec.note) {
    components.push(withDeckPosition(makeComponent("callout", {
      text: slideSpec.note,
      style: {
        fontSize: "15px",
        lineHeight: "1.65",
        color: "#7c5c00",
        background: "#fff6d6",
        border: "1px solid #f3d370",
        borderRadius: "18px",
        padding: "14px 18px",
        whiteSpace: "pre-wrap"
      }
    }), slideSpec.image ? 550 : 50, slideSpec.cards?.length ? 420 : 382, slideSpec.image ? 310 : 840, "auto", 2));
  }

  return {
    id: uid("slide"),
    layout: "default",
    components
  };
}

function buildBasicInfoSinglePageDeck(spec, pageId) {
  return {
    id: pageId,
    title: spec.title,
    subtitle: spec.subtitle,
    slides: [
      {
        id: uid("slide"),
        layout: "default",
        components: [
          withDeckPosition(makeDeckBadge("理论部分"), 50, 36, 116, 32, 2),
          withDeckPosition(makeDeckTitle(spec.title), 50, 88, 420, 96, 2),
          withDeckPosition(makeDeckText(spec.subtitle, { fontSize: "18px", lineHeight: "1.72", color: "#475569" }), 50, 208, 420, 56, 2),
          withDeckPosition(makeDeckCard("实验名称", "简单线性回归房价预测实验"), 50, 308, 404, 92, 2),
          withDeckPosition(makeDeckCard("实验时长", "建议 2 学时，约 90 分钟。"), 470, 308, 404, 92, 2),
          withDeckPosition(makeDeckCard("实验难度", "基础级。适合初次接触回归建模的学生。"), 50, 416, 404, 92, 2),
          withDeckPosition(makeDeckCard("实验环境", "Python 3.10+、Flask、NumPy、Pandas；浏览器端使用 ECharts 与 GridStack。"), 470, 416, 404, 92, 2)
        ]
      }
    ]
  };
}

function buildPurposeSinglePageDeck(spec, pageId) {
  return {
    id: pageId,
    title: spec.title,
    subtitle: spec.subtitle,
    slides: [
      {
        id: uid("slide"),
        layout: "default",
        components: [
          withDeckPosition(makeDeckBadge("理论部分"), 50, 36, 116, 32, 2),
          withDeckPosition(makeDeckTitle(spec.title), 50, 88, 420, 96, 2),
          withDeckPosition(makeDeckText("学生通过本实验学会看懂数据、理解模型、解释训练结果。", { fontSize: "18px", lineHeight: "1.72", color: "#475569" }), 50, 208, 420, 56, 2),
          withDeckPosition(makeDeckCard("看懂数据", "区分特征、标签和房价预测目标。"), 49, 277, 479, 84, 2),
          withDeckPosition(makeDeckCard("理解模型", "知道直线怎样把输入变成预测值。"), 336, 398, 268, 65, 2),
          withDeckPosition(makeDeckCard("解释结果", "能用误差和指标判断模型效果。"), 50, 404, 270, 84, 2)
        ]
      }
    ]
  };
}

function buildPurposeSinglePageDeckWithChart(spec, pageId) {
  const deck = buildPurposeSinglePageDeck(spec, pageId);
  const slide = deck.slides?.[0];
  if (!slide) return deck;
  slide.components = slide.components.filter(component => component.type !== "visual" && component.type !== "chart");
  return deck;
}

function buildStudentTheoryDeck(pageId) {
  const spec = theoryStudentDeck(pageId) || theoryStudentDeck("basic");
  if (pageId === "basic") return buildBasicInfoSinglePageDeck(spec, pageId);
  if (pageId === "purpose") return buildPurposeSinglePageDeckWithChart(spec, pageId);
  const slides = spec.includeTitleSlide === true
    ? [makeStudentTitleSlide(spec, pageId), ...spec.slides.map(makeStudentSlide)]
    : spec.slides.map(makeStudentSlide);
  return {
    id: pageId,
    title: spec.title,
    subtitle: spec.subtitle,
    slides
  };
}

function makeTemplateDeck(pageId) {
  if (theoryStudentDeck(pageId)) return buildStudentTheoryDeck(pageId);
  const topic = { ...(theoryTopic(pageId) || theoryTopic("dataset") || {}), pageId };
  const scenario = theoryScenario(pageId) || theoryScenario("dataset") || {};
  if (pageId === "basic") return buildBasicDeckRefined(pageId, topic, scenario);
  if (pageId === "purpose") return buildPurposeDeckRefined(pageId, topic, scenario);
  if (pageId === "knowledge") return buildKnowledgeDeckRefined(pageId, topic, scenario);
  if (pageId === "dataset") return buildDatasetDeckRefined(pageId, topic, scenario);
  if (pageId === "model") return buildModelDeckRefined(pageId, topic, scenario);
  if (pageId === "criterion") return buildCriterionDeckRefined(pageId, topic, scenario);
  if (pageId === "optimization") return buildOptimizationDeckRefined(pageId, topic, scenario);
  if (pageId === "evaluation") return buildEvaluationDeckRefined(pageId, topic, scenario);
  if (pageId === "result") return buildResultDeckRefined(pageId, topic, scenario);
  if (pageId === "thinking") return buildThinkingDeckRefined(pageId, topic, scenario);
  return {
    id: pageId,
    title: topic.title,
    subtitle: topic.subtitle,
    slides: [
      makeTitleSlide(topic, scenario),
      makeStackImageSlideRefined(
        "问题场景与任务定义",
        [makeDeckText((scenario.leadIn || "") + " " + (topic.subtitle || ""))],
        makeChartImage("pipeline", topic.title + " 概念流程示意"),
        topic.prompt || "保留核心概念、公式和图表解释。"
      ),
      makeDiscussionSlide("讨论问题与结论整理", scenario)
    ]
  };
}

const theoryPages = Object.fromEntries(THEORY_PAGE_IDS.filter(pageId => theoryPageConfig(pageId)).map(pageId => [pageId, makeTemplateDeck(pageId)]));

async function loadTheoryDeckOverrides() {
  try {
    const resp = await fetch(THEORY_DECK_OVERRIDE_URL, { cache: "no-store" });
    if (!resp.ok) throw new Error("load failed");
    const data = await resp.json();
    THEORY_PAGE_STATE.serverOverrides = data?.overrides && typeof data.overrides === "object" ? data.overrides : {};
  } catch (err) {
    THEORY_PAGE_STATE.serverOverrides = {};
    setTheoryStatus("项目课件加载失败");
  }
}

async function renderTheory(page) {
  document.querySelector(".shell").classList.add("theory");
  const pageId = theoryPages[page] ? page : "dataset";
  await loadTheoryDeckOverrides();
  THEORY_PAGE_STATE.pageId = pageId;
  THEORY_PAGE_STATE.currentSlide = 0;
  THEORY_PAGE_STATE.dirty = false;
  THEORY_PAGE_STATE.editing = false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  THEORY_PAGE_STATE.historyPast = [];
  THEORY_PAGE_STATE.historyFuture = [];
  THEORY_PAGE_STATE.snapToGrid = false;
  THEORY_PAGE_STATE.historyLocked = false;
  THEORY_PAGE_STATE.editVersion = 0;
  THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
  $("rightPanel").innerHTML = "";
  renderTheoryDeckDetail(pageId);
}

function renderTheoryEntry(pageId) {
  const deck = theoryPages[pageId] || theoryPages.dataset;
  return `
    <section class="content-card theory-entry-card">
      <div class="theory-entry-head">
        <div>
          <div class="eyebrow">理论部分</div>
          <h2>${escapeHtml(deck.title || "当前理论页")}</h2>
        </div>
        <div class="theory-entry-actions">
          <button class="theory-entry-detail" type="button" data-theory-detail="${escapeHtml(pageId)}">详情</button>
          <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-deck="${escapeHtml(pageId)}">课件</button>
        </div>
      </div>
      <p>${escapeHtml(deck.subtitle || "点击课件进入可编辑内容页。")}</p>
    </section>
  `;
}

function renderPageCharts(topicId) {
  return new Promise((resolve) => {
    const topicsWithCharts = ["knowledge", "dataset", "model", "criterion", "optimization", "evaluation", "result", "thinking"];
    if (!topicsWithCharts.includes(topicId)) {
      resolve({});
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.width = "640";
    iframe.height = "340";
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "640px";
    iframe.style.height = "340px";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
    
    let resolved = false;
    let attempts = 0;
    const maxAttempts = 60; // Maximum 3 seconds (60 * 50ms)
    
    const checkAndFinish = () => {
      if (resolved) return;
      
      let allReady = false;
      const chartImages = {};
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const canvases = Array.from(doc.querySelectorAll("canvas"));
        
        if (canvases.length > 0) {
          let readyCount = 0;
          canvases.forEach(canvas => {
            try {
              const base64 = canvas.toDataURL("image/png");
              // A blank canvas is extremely short in Base64 (usually < 1500 chars).
              // Once drawn with grid lines, labels, and datasets, the PNG data is easily > 2000 chars.
              if (base64.length > 2000) {
                readyCount++;
                chartImages[canvas.id] = {
                  src: base64,
                  width: canvas.offsetWidth || canvas.width || 600,
                  height: canvas.offsetHeight || canvas.height || 300
                };
              }
            } catch (e) {}
          });
          
          if (readyCount === canvases.length) {
            allReady = true;
          }
        }
      } catch (err) {}

      if (allReady) {
        resolved = true;
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
        resolve(chartImages);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          resolved = true;
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const canvases = Array.from(doc.querySelectorAll("canvas"));
            canvases.forEach(canvas => {
              if (!chartImages[canvas.id]) {
                try {
                  const base64 = canvas.toDataURL("image/png");
                  chartImages[canvas.id] = {
                    src: base64,
                    width: canvas.offsetWidth || canvas.width || 600,
                    height: canvas.offsetHeight || canvas.height || 300
                  };
                } catch (e) {}
              }
            });
          } catch (e) {}

          try {
            document.body.removeChild(iframe);
          } catch (e) {}
          resolve(chartImages);
        } else {
          setTimeout(checkAndFinish, 50);
        }
      }
    };

    iframe.onload = () => {
      setTimeout(checkAndFinish, 50);
    };

    iframe.onerror = () => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
      resolve({});
    };

    iframe.src = assetUrl(`/static/theory-html/${topicId}.html`);
  });
}

function getMathJax() {
  if (window.MathJax) return window.MathJax;
  const iframe = document.querySelector("#theoryDetailSplitContainer iframe");
  if (iframe && iframe.contentWindow?.MathJax) return iframe.contentWindow.MathJax;
  const iframes = document.querySelectorAll("iframe");
  for (const f of iframes) {
    if (f.contentWindow?.MathJax) return f.contentWindow.MathJax;
  }
  return null;
}

async function downloadTheoryDetailWord(pageId) {
  const downloadWordBtn = $("theoryDetailDownloadWordBtn");
  if (downloadWordBtn) {
    downloadWordBtn.disabled = true;
    downloadWordBtn.textContent = "正在生成讲义...";
  }

  const topics = [
    "basic", "purpose", "knowledge", "dataset", "model", 
    "criterion", "optimization", "evaluation", "result", "thinking"
  ];

  const topicLabels = {
    basic: "一、 实验背景",
    purpose: "二、 实验目的",
    knowledge: "三、 前置知识",
    dataset: "四、 数据探索与分析",
    model: "五、 模型构建",
    criterion: "六、 学习准则",
    optimization: "七、 参数优化",
    evaluation: "八、 评价指标",
    result: "九、 预期成果",
    thinking: "十、 思考拓展"
  };

  try {
    let combinedHtml = "";
    
    // 1. Fetch all 10 raw HTML texts in parallel
    const fetchPromises = topics.map(async (topicId) => {
      if (topicId === pageId && THEORY_PAGE_STATE.rawDetailHtml) {
        return { topicId, htmlText: THEORY_PAGE_STATE.rawDetailHtml };
      }
      
      const src = assetUrl(`/static/theory-html/${topicId}.html`);
      try {
        const resp = await fetch(src, { cache: "no-store" });
        if (!resp.ok) return { topicId, htmlText: "" };
        const htmlText = await resp.text();
        return { topicId, htmlText };
      } catch (err) {
        console.error(`Failed to fetch ${topicId}:`, err);
        return { topicId, htmlText: "" };
      }
    });

    // 2. Render all charts in hidden background iframes using pixel-polling
    const chartPromises = topics.map(topicId => renderPageCharts(topicId));

    const [htmlResults, chartResults] = await Promise.all([
      Promise.all(fetchPromises),
      Promise.all(chartPromises)
    ]);

    const allChartImages = {};
    chartResults.forEach(res => {
      Object.assign(allChartImages, res);
    });

    // 3. Robust MathJax Loader Fallback
    let mathjaxObj = getMathJax();
    if (!mathjaxObj) {
      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.async = true;
        script.onload = () => {
          mathjaxObj = window.MathJax;
          resolve();
        };
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }

    htmlResults.forEach(({ topicId, htmlText }) => {
      if (!htmlText) {
        console.warn(`Empty htmlText for topic: ${topicId}`);
        return;
      }
      
      console.log(`Processing topic: ${topicId}, html length: ${htmlText.length}`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const container = doc.querySelector(".content-container") || doc.body;

      // Make the h1 section header a standard h2 using safe replaceChild
      const h1 = container.querySelector("h1");
      if (h1) {
        const h2 = doc.createElement("h2");
        const originalText = h1.innerText || h1.textContent || "";
        const cleanText = originalText.replace(/^实验背景：|^实验目的：|^前置知识：|^数据分析：|^数据探索与分析：|^模型构建：|^学习准则：|^参数优化：|^评价指标：|^预期成果：|^思考拓展：/g, "").trim();
        h2.innerHTML = `${topicLabels[topicId]}：${cleanText}`;
        if (h1.parentNode) {
          h1.parentNode.replaceChild(h2, h1);
        }
      }

      // Sift sub-headers down to maintain correct textbook outline structure safely
      const h2Elements = Array.from(container.querySelectorAll("h2"));
      h2Elements.forEach(h2 => {
        // Skip if it is our newly created section title h2
        if (h2.innerText && h2.innerText.includes(topicLabels[topicId])) {
          return;
        }
        const h3 = doc.createElement("h3");
        h3.innerHTML = h2.innerHTML;
        if (h2.parentNode) {
          h2.parentNode.replaceChild(h3, h2);
        }
      });

      // Convert all canvas charts to Base64 PNG img elements
      const canvases = container.querySelectorAll("canvas");
      canvases.forEach(canvas => {
        const imgData = allChartImages[canvas.id];
        if (imgData) {
          // 创建一个专门清零缩进、居中对齐的段落容器
          const wrapper = doc.createElement("p");
          wrapper.className = "image-container";
          wrapper.style.textAlign = "center";
          wrapper.style.textIndent = "0";
          wrapper.style.marginTop = "14pt";
          wrapper.style.marginBottom = "14pt";
          
          const img = doc.createElement("img");
          img.src = imgData.src;
          // 彻底去除 HTML 硬编码的物理 width 和 height 属性，避免被 Word 强行解析导致逸出
          // 只在 inline style 中控制宽度和自适应高度
          img.style.width = "100%";
          img.style.maxWidth = "460pt"; // A4纸标准可打印宽度限制
          img.style.height = "auto";     // 自适应保持最佳高度比
          img.style.display = "inline-block";
          
          wrapper.appendChild(img);
          if (canvas.parentNode) {
            canvas.parentNode.replaceChild(wrapper, canvas);
          }
        } else {
          const placeholder = doc.createElement("div");
          placeholder.className = "image-container";
          placeholder.style.border = "1px dashed #cbd5e1";
          placeholder.style.padding = "20px";
          placeholder.style.margin = "14pt auto";
          placeholder.style.textAlign = "center";
          placeholder.style.color = "#64748b";
          placeholder.style.fontSize = "11pt";
          placeholder.style.backgroundColor = "#f8fafc";
          placeholder.style.textIndent = "0";
          placeholder.innerHTML = `[ 数据图表：${canvas.id || "未命名图表"} ]<br><span style="font-size: 9pt; color: #94a3b8;">（提示：若图表显示为空白，请检查网络连接以确保 Chart.js 正常加载渲染）</span>`;
          if (canvas.parentNode) {
            canvas.parentNode.replaceChild(placeholder, canvas);
          }
        }
      });

      // Convert LaTeX formulas to native Word MathML
      const mathDisplays = container.querySelectorAll(".math-display");
      mathDisplays.forEach(el => {
        let rawText = el.textContent || el.innerText || "";
        rawText = rawText.replace(/^\$\$|\$\$/g, "").trim();
        try {
          if (mathjaxObj && typeof mathjaxObj.tex2mml === "function") {
            const mml = mathjaxObj.tex2mml(rawText, { display: true });
            el.innerHTML = mml;
          } else {
            el.innerHTML = `$$ ${rawText} $$`;
          }
        } catch (e) {
          el.innerHTML = `$$ ${rawText} $$`;
        }
      });

      // Clear dynamic code-level scripts and MathJax elements
      const MathJaxJunk = container.querySelectorAll(".MathJax, .mjx-container, script");
      MathJaxJunk.forEach(el => el.remove());

      combinedHtml += `<div class="handout-section" id="section-${topicId}">\n${container.innerHTML}\n</div>\n`;
    });

    console.log("Combined HTML generation finished. Total length:", combinedHtml.length);

    if (!combinedHtml || combinedHtml.length < 500) {
      alert("生成讲义失败，未能加载任何详情页或详情内容缺失。");
      return;
    }

    const docTitle = "简单线性回归：波士顿房价预测教学讲义";
    const fileContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${docTitle}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 21cm 29.7cm; /* A4 */
            margin: 2.54cm 2.54cm 2.54cm 2.54cm; /* Standard margins */
          }
          body {
            font-family: 'Times New Roman', 'SimSun', 'Songti SC', serif;
            line-height: 1.5;
            color: #000000;
            font-size: 11pt; /* Five-size standard character */
          }
          .handout-title {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            font-size: 22pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20pt;
            color: #000000;
          }
          .handout-subtitle {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            font-size: 13pt;
            text-align: center;
            margin-top: -10pt;
            margin-bottom: 36pt;
            color: #555555;
            font-style: italic;
          }
          .handout-section {
            margin-bottom: 15pt;
          }
          h2 {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            font-size: 15pt; /* Section titles */
            font-weight: bold;
            color: #000000;
            margin-top: 28pt; /* Section spacing */
            margin-bottom: 12pt;
            border-bottom: 1.5pt solid #000000;
            padding-bottom: 4px;
          }
          h3 {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
            font-size: 12.5pt; /* Subsection titles */
            font-weight: bold;
            color: #000000;
            margin-top: 14pt;
            margin-bottom: 8pt;
          }
          p {
            font-family: 'Times New Roman', 'SimSun', serif;
            font-size: 11pt;
            line-height: 1.6;
            margin-bottom: 10pt;
            text-indent: 22pt; /* Traditional indenting */
            text-align: justify;
          }
          /* Remove indentation for special cards, math and codes */
          p.no-indent, .academic-quote p, .math-display p, pre p, .chart-wrapper, .image-container {
            text-indent: 0 !important;
          }
          .chart-wrapper, .image-container {
            text-align: center !important;
            max-width: 100% !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          strong {
            font-weight: bold;
          }
          ul, ol {
            margin-top: 6pt;
            margin-bottom: 12pt;
            padding-left: 24pt;
          }
          li {
            font-family: 'Times New Roman', 'SimSun', serif;
            font-size: 11pt;
            line-height: 1.5;
            margin-bottom: 4pt;
          }
          .math-display {
            margin: 12pt 0;
            text-align: center;
          }
          .academic-quote {
            background-color: #f8fafc;
            border-left: 3.5pt solid #64748b;
            padding: 8pt 12pt;
            margin: 14pt 0;
          }
          .academic-quote strong {
            display: block;
            margin-bottom: 6pt;
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          }
          pre {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 8pt;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 9.5pt;
            margin-bottom: 12pt;
            white-space: pre-wrap;
          }
          code {
            font-family: 'Consolas', 'Courier New', monospace;
            background-color: #f1f5f9;
            padding: 2px 4px;
            font-size: 10pt;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <div class="handout-title">${docTitle}</div>
        <div class="handout-subtitle">—— 简单线性回归机器学习全套教学实验讲义</div>
        <div class="content-container">
          ${combinedHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + fileContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docTitle}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("生成讲义失败: " + err.message);
  } finally {
    if (downloadWordBtn) {
      downloadWordBtn.disabled = false;
      downloadWordBtn.textContent = "下载 Word 讲义";
    }
  }
}

function renderTheoryDetail(pageId) {
  $("main").innerHTML = `
    <div class="theory-detail-toolbar" data-html2canvas-ignore="true">
      <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-deck="${escapeHtml(pageId)}">返回课件</button>
      <button class="theory-export-btn theory-edit-btn" id="theoryDetailEditBtn" type="button">编辑详情</button>
      <button class="theory-export-btn" id="theoryDetailDownloadWordBtn" type="button">下载 Word 讲义</button>
      <button class="theory-export-btn theory-cancel-btn" id="theoryDetailCancelBtn" type="button" hidden>取消编辑</button>
      <button class="theory-export-btn theory-save-btn" id="theoryDetailSaveBtn" type="button" hidden>保存修改</button>
    </div>
    <div class="theory-detail-split-container" id="theoryDetailSplitContainer">
      <div class="theory-detail-editor-pane" hidden>
        <div class="theory-detail-editor-toolbar">
          <button type="button" data-detail-insert="h2" title="插入二级标题">H2标题</button>
          <button type="button" data-detail-insert="p" title="插入段落">段落</button>
          <button type="button" data-detail-insert="quote" title="插入引用卡片">引用卡片</button>
          <button type="button" data-detail-insert="math-display" title="插入块级公式">公式块</button>
          <button type="button" data-detail-insert="math-inline" title="插入行内公式">行内公式</button>
          <button type="button" data-detail-insert="bold" title="加粗选中文本">加粗</button>
          <button type="button" data-detail-insert="list" title="插入无序列表">无序列表</button>
        </div>
        <textarea class="theory-detail-textarea" id="theoryDetailTextarea" spellcheck="false" placeholder="在此输入 Markdown 详情内容..."></textarea>
      </div>
      <div class="theory-detail-preview-pane">
        ${renderTheoryHtmlSlot(pageId)}
      </div>
    </div>
  `;

  const deckBtn = document.querySelector("[data-theory-deck]");
  if (deckBtn) deckBtn.addEventListener("click", () => renderTheoryDeckDetail(pageId));

  const editBtn = $("theoryDetailEditBtn");
  const downloadWordBtn = $("theoryDetailDownloadWordBtn");
  const cancelBtn = $("theoryDetailCancelBtn");
  const saveBtn = $("theoryDetailSaveBtn");
  const splitContainer = $("theoryDetailSplitContainer");
  const editorPane = splitContainer.querySelector(".theory-detail-editor-pane");
  const textarea = $("theoryDetailTextarea");

  if (downloadWordBtn) {
    downloadWordBtn.addEventListener("click", () => downloadTheoryDetailWord(pageId));
  }

  editBtn.addEventListener("click", () => {
    editBtn.hidden = true;
    deckBtn.hidden = true;
    if (downloadWordBtn) downloadWordBtn.hidden = true;
    cancelBtn.hidden = false;
    saveBtn.hidden = false;
    splitContainer.classList.add("editing");
    editorPane.removeAttribute("hidden");

    // Parse server HTML and convert to Markdown
    const parser = new DOMParser();
    const doc = parser.parseFromString(THEORY_PAGE_STATE.rawDetailHtml || "", "text/html");
    const container = doc.querySelector(".content-container");
    
    // Clean converting using our HTML-to-Markdown parser!
    const markdown = htmlToMarkdown(container || doc.body);
    textarea.value = cleanHtmlFormatting(markdown);
  });

  cancelBtn.addEventListener("click", () => {
    if (confirm("确定要放弃所有未保存的修改吗？")) {
      editBtn.hidden = false;
      deckBtn.hidden = false;
      if (downloadWordBtn) downloadWordBtn.hidden = false;
      cancelBtn.hidden = true;
      saveBtn.hidden = true;
      splitContainer.classList.remove("editing");
      editorPane.setAttribute("hidden", "true");

      const iframe = splitContainer.querySelector("iframe");
      if (iframe) {
        iframe.srcdoc = THEORY_PAGE_STATE.rawDetailHtml;
      }
    }
  });

  saveBtn.addEventListener("click", async () => {
    const markdown = textarea.value;
    const newContentHtml = markdownToHtml(markdown);

    const parser = new DOMParser();
    const doc = parser.parseFromString(THEORY_PAGE_STATE.rawDetailHtml || "", "text/html");
    const container = doc.querySelector(".content-container");
    if (container) {
      container.innerHTML = newContentHtml;
    } else {
      doc.body.innerHTML = newContentHtml;
    }
    const fullHtml = doc.documentElement.outerHTML;

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      const resp = await fetch(apiUrl("/api/save_theory_html"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          html: fullHtml
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || "保存失败");
      }

      const data = await resp.json();
      if (data.saved) {
        THEORY_PAGE_STATE.rawDetailHtml = fullHtml;
        alert("详情页内容保存成功！");

        editBtn.hidden = false;
        deckBtn.hidden = false;
        if (downloadWordBtn) downloadWordBtn.hidden = false;
        cancelBtn.hidden = true;
        saveBtn.hidden = true;
        splitContainer.classList.remove("editing");
        editorPane.setAttribute("hidden", "true");
      } else {
        throw new Error("保存失败");
      }
    } catch (err) {
      alert("错误: " + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "保存修改";
    }
  });

  let previewTimeout;
  textarea.addEventListener("input", () => {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
      const markdown = textarea.value;
      const newContentHtml = markdownToHtml(markdown);

      const parser = new DOMParser();
      const doc = parser.parseFromString(THEORY_PAGE_STATE.rawDetailHtml || "", "text/html");
      const container = doc.querySelector(".content-container");
      if (container) {
        container.innerHTML = newContentHtml;
      } else {
        doc.body.innerHTML = newContentHtml;
      }
      const iframe = splitContainer.querySelector("iframe");
      if (iframe) {
        iframe.srcdoc = doc.documentElement.outerHTML;
      }
    }, 400);
  });

  const insertButtons = editorPane.querySelectorAll("[data-detail-insert]");
  insertButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.detailInsert;
      insertHelperContent(textarea, action);
    });
  });

  // 1. 定义左侧 Textarea 滚动同步至右侧 Iframe 的函数 (方案四：基于内容指纹虚拟桥接与段落内外双重插值映射系统)
  const syncScrollFromTextarea = () => {
    const iframe = splitContainer.querySelector("iframe");
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const scrollable = doc.documentElement || doc.body;
      if (!scrollable) return;

      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5 || 24;
      const visibleLineIndex = textarea.scrollTop / lineHeight;
      const lines = textarea.value.split('\n');

      // 1.1 动态解析左侧的 Markdown 虚拟 Block
      const blocks = [];
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // 搜集所有的实质性文本行（过滤掉公式标记与纯代码块标记，保证匹配纯净）
        if (trimmed && trimmed.length > 2 && !trimmed.startsWith('$$') && !trimmed.startsWith('```')) {
          blocks.push({
            line: index,
            text: trimmed
          });
        }
      });

      // 1.2 搜集右侧所有能承载这些块内容的块级 DOM 元素
      const domElements = Array.from(doc.querySelectorAll(
        ".content-container > p, .content-container > li, .content-container > h1, .content-container > h2, .content-container > h3, .content-container > h4, .content-container > pre, .content-container > blockquote, .content-container > table, .content-container > .academic-quote, .content-container > .academic-note, .content-container > .chart-wrapper"
      )).filter(el => {
        // 排除 MathJax 产生的隐藏元素
        return el.offsetHeight > 0 && !el.classList.contains("MathJax");
      });

      // 1.3 利用 Map 搜集右侧每个 DOM 元素所成功匹配映射到的左侧行号集合
      const domLineMap = new Map();
      blocks.forEach(block => {
        let cleanText = block.text
          .replace(/^[#>\-*+\s\d.]+\s*/, "") // 去除前缀
          .replace(/[*_`]/g, "")           // 去除修饰符
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .trim();

        if (cleanText.length > 8) {
          cleanText = cleanText.slice(0, 8);
        }

        if (cleanText && cleanText.length >= 2) {
          const matchedEl = domElements.find(el => {
            const elText = (el.innerText || el.textContent || "").trim();
            return elText.includes(cleanText);
          });
          if (matchedEl) {
            if (!domLineMap.has(matchedEl)) {
              domLineMap.set(matchedEl, []);
            }
            domLineMap.get(matchedEl).push(block.line);
          }
        }
      });

      // 1.4 构建并排序有序的“段落锚点链”
      const paragraphAnchors = [];
      domLineMap.forEach((linesList, element) => {
        const lineStart = Math.min(...linesList);
        let lineEnd = Math.max(...linesList);
        // 如果段落只映射到了一行，将其合理展宽 1.2 行以触发精细段落内平滑插值
        if (lineStart === lineEnd) {
          lineEnd = lineStart + 1.2;
        }
        paragraphAnchors.push({
          element,
          lineStart,
          lineEnd
        });
      });

      paragraphAnchors.sort((a, b) => a.lineStart - b.lineStart);

      // 1.5 兜底：若无有效匹配锚点，回退到高度百分比对齐
      if (paragraphAnchors.length === 0) {
        const textareaScrollHeight = textarea.scrollHeight - textarea.clientHeight;
        if (textareaScrollHeight > 0) {
          const percentage = textarea.scrollTop / textareaScrollHeight;
          const iframeScrollHeight = scrollable.scrollHeight - iframe.clientHeight;
          if (iframeScrollHeight > 0) {
            iframe.contentWindow.scrollTo(0, percentage * iframeScrollHeight);
          }
        }
        return;
      }

      // 获取元素相对于 iframe 顶端的 offsetTop 绝对物理高度
      const getElementTop = (el) => {
        let top = 0;
        let current = el;
        while (current && current !== doc.body && current !== doc.documentElement) {
          top += current.offsetTop || 0;
          current = current.offsetParent;
        }
        return top;
      };

      // 补全段落的 top 偏移量和实际高度
      paragraphAnchors.forEach(anchor => {
        anchor.top = getElementTop(anchor.element);
        anchor.height = anchor.element.offsetHeight || 32;
      });

      // 1.6 边界检查：当前滚动位置小于第一个锚点的 lineStart
      if (visibleLineIndex <= paragraphAnchors[0].lineStart) {
        iframe.contentWindow.scrollTo(0, 0);
        return;
      }

      // 1.7 边界检查：当前滚动位置大于最后一个锚点的 lineEnd
      if (visibleLineIndex >= paragraphAnchors[paragraphAnchors.length - 1].lineEnd) {
        const iframeScrollHeight = scrollable.scrollHeight - iframe.clientHeight;
        iframe.contentWindow.scrollTo(0, iframeScrollHeight);
        return;
      }

      // 1.8 情况 A：检查是否处于某个段落内部 (实现段落内部的逐行、逐单词高灵敏物理等比例平滑插值)
      for (let i = 0; i < paragraphAnchors.length; i++) {
        const anchor = paragraphAnchors[i];
        if (visibleLineIndex >= anchor.lineStart && visibleLineIndex <= anchor.lineEnd) {
          const range = anchor.lineEnd - anchor.lineStart;
          const localRatio = range > 0 ? (visibleLineIndex - anchor.lineStart) / range : 0;
          const targetScrollTop = anchor.top + localRatio * anchor.height;
          iframe.contentWindow.scrollTo(0, targetScrollTop);
          return;
        }
      }

      // 1.9 情况 B：检查是否处于两个相邻大段落之间的缝隙中 (实现跨段落过渡区域平滑平移)
      for (let i = 0; i < paragraphAnchors.length - 1; i++) {
        const current = paragraphAnchors[i];
        const next = paragraphAnchors[i + 1];
        if (visibleLineIndex > current.lineEnd && visibleLineIndex < next.lineStart) {
          const range = next.lineStart - current.lineEnd;
          const localRatio = range > 0 ? (visibleLineIndex - current.lineEnd) / range : 0;
          const currentBottom = current.top + current.height;
          const targetScrollTop = currentBottom + localRatio * (next.top - currentBottom);
          iframe.contentWindow.scrollTo(0, targetScrollTop);
          return;
        }
      }
    } catch (e) {}
  };

  // 2. 监听左侧 Textarea 的 scroll 事件
  textarea.addEventListener("scroll", syncScrollFromTextarea);

  // 3. 监听右侧 Iframe 的 load 事件以在重新加载完成后重施滚动比例
  const iframe = splitContainer.querySelector("iframe");
  if (iframe) {
    iframe.addEventListener("load", () => {
      // 重新对齐滚动百分比，保持预览与编辑行同步且不发生重新加载的回弹闪烁
      syncScrollFromTextarea();
    });
  }

  loadTheoryHtml(pageId);
}

function htmlToMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();

  // Custom components
  if (node.classList.contains("math-display")) {
    const text = node.textContent.trim();
    const formula = text.replace(/^\$\$|\$\$/g, "").trim();
    return `\n$$\n${formula}\n$$\n`;
  }

  if (node.classList.contains("academic-quote") || 
      node.classList.contains("academic-warning") || 
      node.classList.contains("academic-note") ||
      node.classList.contains("academic-theory")) {
    const kind = node.classList.contains("academic-warning") ? "warning" : 
                 node.classList.contains("academic-note") ? "note" : 
                 node.classList.contains("academic-theory") ? "theory" : "quote";
    let innerMarkdown = "";
    for (const child of node.childNodes) {
      innerMarkdown += htmlToMarkdown(child);
    }
    const lines = innerMarkdown.trim().split("\n");
    const quoted = lines.map(line => `> ${line}`).join("\n");
    return `\n[quote:${kind}]\n${quoted}\n[/quote]\n`;
  }

  if (node.classList.contains("chart-wrapper")) {
    const canvas = node.querySelector("canvas");
    const canvasId = canvas ? canvas.id : "barChart";
    const p = node.querySelector("p");
    const caption = p ? p.textContent.trim() : "";
    return `\n[chart:${canvasId} caption="${caption}"]\n`;
  }

  let childrenMarkdown = "";
  for (const child of node.childNodes) {
    childrenMarkdown += htmlToMarkdown(child);
  }

  if (tagName === "h1") {
    return `\n# ${childrenMarkdown.trim()}\n`;
  }
  if (tagName === "h2") {
    return `\n## ${childrenMarkdown.trim()}\n`;
  }
  if (tagName === "h3") {
    return `\n### ${childrenMarkdown.trim()}\n`;
  }
  if (tagName === "p") {
    return `\n${childrenMarkdown.trim()}\n`;
  }
  if (tagName === "strong" || tagName === "b") {
    return `**${childrenMarkdown.trim()}**`;
  }
  if (tagName === "em" || tagName === "i") {
    return `*${childrenMarkdown.trim()}*`;
  }
  if (tagName === "ul" || tagName === "ol") {
    return `\n${childrenMarkdown}\n`;
  }
  if (tagName === "li") {
    return `- ${childrenMarkdown.trim()}\n`;
  }
  if (tagName === "pre") {
    const codeEl = node.querySelector("code");
    const lang = codeEl ? (codeEl.className.match(/language-(\w+)/)?.[1] || "python") : "python";
    const codeText = codeEl ? codeEl.textContent : node.textContent;
    return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
  }
  if (tagName === "code") {
    return `\`${childrenMarkdown.trim()}\``;
  }

  if (tagName === "div" || tagName === "section" || tagName === "body" || tagName === "html") {
    return childrenMarkdown;
  }

  return childrenMarkdown;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  let codeLang = "python";
  let codeBlock = [];
  let inMath = false;
  let mathBlock = [];
  let inQuote = false;
  let quoteKind = "quote";
  let quoteBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Math Display Block
    if (trimmed === "$$") {
      if (inMath) {
        html += `<div class="math-display">\n    $$\n    ${mathBlock.join("\n")}\n    $$\n</div>\n`;
        mathBlock = [];
        inMath = false;
      } else {
        inMath = true;
      }
      continue;
    }
    if (inMath) {
      mathBlock.push(line);
      continue;
    }

    // 2. Code Block
    if (trimmed.startsWith("```")) {
      if (inCode) {
        html += `<pre><code class="language-${codeLang}">${escapeHtmlForCode(codeBlock.join("\n"))}</code></pre>\n`;
        codeBlock = [];
        inCode = false;
      } else {
        codeLang = trimmed.substring(3).trim() || "python";
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBlock.push(line);
      continue;
    }

    // 3. Custom Quote Block
    if (trimmed.startsWith("[quote:") && trimmed.endsWith("]")) {
      quoteKind = trimmed.substring(7, trimmed.length - 1) || "quote";
      inQuote = true;
      quoteBlock = [];
      continue;
    }
    if (trimmed === "[/quote]") {
      if (inQuote) {
        const quoteClass = quoteKind === "warning" ? "academic-warning" : 
                           quoteKind === "note" ? "academic-note" : 
                           quoteKind === "theory" ? "academic-theory" : "academic-quote";
        const innerHtml = markdownToHtml(quoteBlock.join("\n"));
        html += `<div class="${quoteClass}">\n${innerHtml}</div>\n`;
        inQuote = false;
      }
      continue;
    }
    if (inQuote) {
      let content = line;
      if (trimmed.startsWith(">")) {
        content = line.substring(line.indexOf(">") + 1);
      }
      quoteBlock.push(content);
      continue;
    }

    // 4. Custom Chart Tag
    if (trimmed.startsWith("[chart:") && trimmed.endsWith("]")) {
      const match = trimmed.match(/\[chart:(\w+)\s+caption="([^"]*)"\]/);
      if (match) {
        const canvasId = match[1];
        const caption = match[2];
        html += `
        <div class="chart-wrapper">
            <canvas id="${canvasId}" height="110"></canvas>
            <p style="text-align: center; font-size: 13px; color: #64748b; margin-top: 15px; margin-bottom: 0;">${caption}</p>
        </div>\n`;
      }
      continue;
    }

    // 5. Lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      const itemContent = parseInlineStyles(line.substring(2));
      html += `    <li>${itemContent}</li>\n`;
      continue;
    } else {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      html += `<h1>${parseInlineStyles(trimmed.substring(2))}</h1>\n`;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      html += `<h2>${parseInlineStyles(trimmed.substring(3))}</h2>\n`;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      html += `<h3>${parseInlineStyles(trimmed.substring(4))}</h3>\n`;
      continue;
    }

    // Empty line
    if (trimmed === "") {
      continue;
    }

    // Paragraph
    html += `<p>${parseInlineStyles(line)}</p>\n`;
  }

  if (inList) {
    html += "</ul>\n";
  }

  return html;
}

function parseInlineStyles(text) {
  let parsed = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  parsed = parsed.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  parsed = parsed.replace(/`([^`]+)`/g, "<code>$1</code>");
  return parsed;
}

function escapeHtmlForCode(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertHelperContent(textarea, action) {
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(startPos, endPos);

  let replacement = "";

  if (action === "h2") {
    replacement = `\n## ${selectedText || "标题文字"}\n`;
  } else if (action === "p") {
    replacement = `\n${selectedText || "段落文字内容。"}\n`;
  } else if (action === "quote") {
    replacement = `\n[quote:quote]\n> **${selectedText || "学术引用标题"}**\n> - 要点条目一\n> - 要点条目二\n[/quote]\n`;
  } else if (action === "math-display") {
    replacement = `\n$$\n${selectedText || "\\\\mathbf{y} = \\\\mathbf{X}\\\\mathbf{w} + b"}\n$$\n`;
  } else if (action === "math-inline") {
    replacement = `$${selectedText || "x"}$`;
  } else if (action === "bold") {
    replacement = `**${selectedText || "加粗文字"}**`;
  } else if (action === "list") {
    replacement = `\n- ${selectedText || "列表条目一"}\n- 列表条目二\n`;
  }

  textarea.value = text.substring(0, startPos) + replacement + text.substring(endPos);
  textarea.focus();
  
  const newCursorPos = startPos + replacement.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  
  textarea.dispatchEvent(new Event("input"));
}

function cleanHtmlFormatting(html) {
  return html.trim();
}

function renderTheoryHtmlSlot(pageId) {
  const src = assetUrl(`/static/theory-html/${pageId}.html`);
  return `<div class="html-lesson hidden" data-theory-html="${escapeHtml(src)}"><iframe title="理论讲义"></iframe></div>`;
}
async function loadTheoryHtml(pageId) {
  const wrap = document.querySelector("[data-theory-html]");
  if (!wrap) return;
  try {
    const resp = await fetch(wrap.dataset.theoryHtml, { cache: "no-store" });
    if (!resp.ok) {
      renderError("未找到该理论详情页。");
      return;
    }
    const iframe = wrap.querySelector("iframe");
    // Enable native scrolling by removing scrolling=no and setting height to 100%
    iframe.removeAttribute("scrolling");
    iframe.style.height = "100%";
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          doc.documentElement.style.overflow = "auto";
          doc.body.style.overflow = "auto";
        }
      } catch (err) {}
    };
    const htmlText = await resp.text();
    THEORY_PAGE_STATE.rawDetailHtml = htmlText;
    iframe.srcdoc = htmlText;
    wrap.classList.remove("hidden");
  } catch (err) {
    renderError("理论详情页加载失败。");
  }
}

function fitTheoryIframe(iframe) {
  iframe.style.height = "100%";
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc) {
      doc.documentElement.style.overflow = "auto";
      doc.body.style.overflow = "auto";
    }
  } catch (err) {}
}

function renderTheoryDeckDetail(pageId) {
  THEORY_PAGE_STATE.pageId = pageId;
  THEORY_PAGE_STATE.editing = false;
  THEORY_PAGE_STATE.dirty = false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  THEORY_PAGE_STATE.historyPast = [];
  THEORY_PAGE_STATE.historyFuture = [];
  THEORY_PAGE_STATE.editVersion = 0;
  if (!THEORY_PAGE_STATE.deck || THEORY_PAGE_STATE.deck.id !== pageId) {
    THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
  }
  $("main").innerHTML = renderTheoryDeck(pageId);
  bindTheoryDeck(pageId);
  setTheoryEditing(false);
  observeTheorySlideViewport();
  refreshTheoryRightPanel();
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
}

function observeTheorySlideViewport() {
  const viewport = $("theorySlideViewport");
  if (!viewport) return;
  if (THEORY_PAGE_STATE.slideScaleObserver) {
    THEORY_PAGE_STATE.slideScaleObserver.disconnect();
    THEORY_PAGE_STATE.slideScaleObserver = null;
  }
  updateTheorySlideScale();
  if ("ResizeObserver" in window) {
    THEORY_PAGE_STATE.slideScaleObserver = new ResizeObserver(updateTheorySlideScale);
    THEORY_PAGE_STATE.slideScaleObserver.observe(viewport);
  }
}

function updateTheorySlideScale() {
  const viewport = $("theorySlideViewport");
  if (!viewport) return;
  const width = viewport.getBoundingClientRect().width || viewport.clientWidth;
  if (!width) return;
  viewport.style.setProperty("--slide-scale", String(width / THEORY_SLIDE_WIDTH));
}

function renderTheoryDeck(pageId) {
  const deck = THEORY_PAGE_STATE.deck || theoryPages[pageId];
  return `
    <section class="theory-deck-shell" id="theoryDeck" data-theory-page="${escapeHtml(pageId)}">
      <nav class="theory-deck-toolbar" data-html2canvas-ignore="true" aria-label="理论幻灯片控制栏">
        <div class="theory-toolbar-group">
          <button class="theory-deck-btn" id="theoryPrevBtn" type="button" aria-label="上一页" title="上一页">‹</button>
          <span class="theory-page-indicator" id="theoryPageIndicator">1 / ${deck.slides.length}</span>
          <button class="theory-deck-btn" id="theoryNextBtn" type="button" aria-label="下一页" title="下一页">›</button>
        </div>
        <div class="theory-toolbar-group">
          <span class="theory-deck-title">${escapeHtml(deck.title)}</span>
          <span class="theory-deck-status" id="theoryDeckStatus">只读模式</span>
        </div>
        <div class="theory-toolbar-group">
          <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-detail="${escapeHtml(pageId)}">详情</button>
          <button class="theory-export-btn theory-edit-btn" id="theoryEditBtn" type="button">编辑课件</button>
          <button class="theory-export-btn theory-cancel-btn" id="theoryCancelBtn" type="button" hidden>不保存</button>
          <button class="theory-export-btn theory-save-btn" id="theorySaveBtn" type="button" hidden>保存修改</button>
          <button class="theory-export-btn" id="theoryExportBtn" type="button">下载全套 PPT</button>
        </div>
      </nav>
      <div class="theory-editor-tools" id="theoryEditorTools" data-html2canvas-ignore="true" hidden>
        <div class="theory-tool-group">
          <button type="button" id="theoryUndoBtn" disabled>撤销</button>
          <button type="button" id="theoryRedoBtn" disabled>重做</button>
          <button type="button" id="theoryDuplicateBtn" disabled>复制</button>
        </div>
        <div class="theory-tool-group">
          <button type="button" id="theoryAddSlideBtn">新增页</button>
          <button type="button" id="theoryDeleteSlideBtn">删除页</button>
          <button type="button" id="theoryDeleteComponentBtn" disabled>删除组件</button>
        </div>
        <div class="theory-tool-group">
          <button type="button" data-insert-component="title">插入标题</button>
          <button type="button" data-insert-component="text">插入文本</button>
          <button type="button" data-insert-component="card">插入卡片</button>
          <button type="button" data-insert-component="bullets">插入要点</button>
          <button type="button" data-insert-component="callout">插入提示</button>
          <button type="button" data-insert-component="formula">插入公式</button>
          <button type="button" data-insert-component="table">插入表格</button>
          <button type="button" id="theoryImageBtn">插入图片</button>
          <input id="theoryImageInput" type="file" accept="image/*" hidden>
        </div>
        <div class="theory-tool-group">
          <button type="button" id="theorySnapBtn" aria-pressed="false">网格吸附</button>
        </div>
        <div class="theory-tool-group theory-font-tools">
          <select id="theoryFontFamily" aria-label="字体">${SAFE_FONTS.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}</select>
          <select id="theoryFontSize" aria-label="字号">${[12, 14, 16, 18, 20, 24, 28, 32, 40, 52, 64].map(size => `<option value="${size}px">${size}</option>`).join("")}</select>
          <button type="button" id="theoryBoldBtn">B</button>
          <button type="button" id="theoryItalicBtn"><i>I</i></button>
          <input id="theoryColorInput" type="color" value="#172033" aria-label="文字颜色">
          <select id="theoryAlignSelect" aria-label="对齐">
            <option value="">默认对齐</option>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
          <span class="theory-tool-hint" id="theoryToolHint">请选择组件</span>
        </div>
      </div>
      <div class="theory-slide-viewport" id="theorySlideViewport">
        ${deck.slides.map((slide, index) => renderTheorySlideMarkup(slide, index)).join("")}
      </div>
    </section>
  `;
}
function renderTheorySlideMarkup(slide, index) {
  const components = [...(slide.components || [])].sort((a, b) => parseLayerZIndex(a, 1) - parseLayerZIndex(b, 1));
  return `
    <article class="theory-slide ${slide.layout ? `theory-slide-${escapeHtml(slide.layout)}` : ""}" data-slide-id="${escapeHtml(slide.id)}" data-theory-slide="${index}" aria-label="第 ${index + 1} 页">
      ${components.map(component => renderComponent(component)).join("")}
    </article>
  `;
}
function renderComponent(component) {
  const type = component.type || "text";
  const zIndex = parseLayerZIndex(component, 1);
  const isVisible = component.visible !== false;
  const isLocked = Boolean(component.locked);
  const style = component.position ? `left:${component.position.left || "0px"};top:${component.position.top || "0px"};width:${component.position.width || "240px"};height:${component.position.height || "auto"};z-index:${component.position.zIndex || component.zIndex || 1};` : `z-index:${zIndex};`;
  const freeClass = component.position ? " is-free-positioned" : "";
  const visibilityClass = isVisible ? "" : " is-hidden";
  const lockedClass = isLocked ? " is-locked" : "";
  let content = "";
  if (type === "card") {
    const parts = cardParts(component);
    const titleStyle = component.style?.titleStyle || component.style || {};
    const bodyStyle = component.style?.bodyStyle || component.style || {};
    content = `
      <div class="card-component" style="${cardContainerStyle(component.style || {})}">
        <div class="card-header">
          ${editableTag("div", `${component.id}:title`, parts.title, titleStyle, "theory-card-title-editable")}
        </div>
        <div class="card-body">
          ${editableTag("div", `${component.id}:body`, parts.body, bodyStyle, "theory-card-body-editable")}
        </div>
      </div>`;
  } else if (type === "cards") {
    if (component.items.length === 1) {
      const item = component.items[0];
      content = `
        <div class="theory-info-card theory-info-card-standalone${item.position ? " is-free-positioned" : ""}" data-edit-unit-id="${escapeHtml(component.id)}:${escapeHtml(item.id)}" data-edit-unit-type="card" style="${positionToCss(item.position)}">
          <div class="card-component" style="${cardContainerStyle(item.style || {})}">
            <div class="card-header">
              ${editableTag("div", `${component.id}:${item.id}:title`, item.title || "卡片标题", item.titleStyle || item.style, "theory-card-title-editable")}
            </div>
            <div class="card-body">
              ${editableTag("div", `${component.id}:${item.id}:body`, item.body || "卡片正文", item.bodyStyle || item.style, "theory-card-body-editable")}
            </div>
          </div>
        </div>`;
    } else {
      content = `<div class="theory-card-grid">${component.items.map(item => `
      <div class="theory-info-card${item.position ? " is-free-positioned" : ""}" data-edit-unit-id="${escapeHtml(component.id)}:${escapeHtml(item.id)}" data-edit-unit-type="card" style="${positionToCss(item.position)}">
        <div class="card-component" style="${cardContainerStyle(item.style || {})}">
          <div class="card-header">
            ${editableTag("div", `${component.id}:${item.id}:title`, item.title || "卡片标题", item.titleStyle || item.style, "theory-card-title-editable")}
          </div>
          <div class="card-body">
            ${editableTag("div", `${component.id}:${item.id}:body`, item.body || "卡片正文", item.bodyStyle || item.style, "theory-card-body-editable")}
          </div>
        </div>
      </div>`).join("")}</div>`;
    }
  } else if (type === "bullets") {
    if (component.items.length === 1) {
      const item = component.items[0];
      content = `
        <div class="theory-list-item theory-list-item-standalone${item.position ? " is-free-positioned" : ""}" data-edit-unit-id="${escapeHtml(component.id)}:${escapeHtml(item.id)}" data-edit-unit-type="bullet" style="${positionToCss(item.position)}">
          ${editableTag("span", `${component.id}:${item.id}:text`, item.text || "要点内容", item.style)}
        </div>`;
    } else {
      content = `<ul class="theory-bullet-grid">${component.items.map(item => `<li class="theory-list-item${item.position ? " is-free-positioned" : ""}" data-edit-unit-id="${escapeHtml(component.id)}:${escapeHtml(item.id)}" data-edit-unit-type="bullet" style="${positionToCss(item.position)}">${editableTag("span", `${component.id}:${item.id}:text`, item.text || "要点内容", item.style)}</li>`).join("")}</ul>`;
    }
  } else if (type === "image") {
    const src = component.src || "";
    const alt = component.alt || "课件图片";
    const imageStyle = normalizeImageStyle(component.imageStyle);
    const objectFit = normalizeImageObjectFit(component.objectFit);
    const caption = String(component.caption || "");
    const captionClass = caption.trim() ? "" : " is-empty";
    content = `
      <figure class="theory-image-frame image-component ${escapeHtml(imageStyle)}" data-image-style="${escapeHtml(imageStyle)}" data-object-fit="${escapeHtml(objectFit)}">
        ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="object-fit:${escapeHtml(objectFit)};">` : `<div class="theory-image-placeholder">图片</div>`}
        ${editableTag("figcaption", `${component.id}:caption`, caption, component.style, `theory-image-caption${captionClass}`)}
        ${renderImageQuickToolbar(component)}
      </figure>`;
  } else if (type === "table") {
    content = renderTableComponent(component);
  } else if (type === "chart") {
    content = `
      <figure class="theory-chart-frame">
        <div class="theory-chart-canvas" data-chart-id="${escapeHtml(component.id)}"></div>
        ${editableTag("figcaption", `${component.id}:text`, component.text || component.label || "图表示意", component.style, "theory-chart-caption")}
      </figure>`;
  } else if (type === "formula") {
    content = renderFormulaComponent(component);
  } else if (type === "callout") {
    content = editableTag("div", `${component.id}:text`, component.text || "提示内容", component.style, "theory-callout");
  } else if (type === "visual") {
    content = editableTag("div", `${component.id}:text`, component.text || "内容示意区", component.style, "theory-visual-panel");
  } else {
    const tag = type === "h1" ? "h1" : type === "h2" ? "h2" : "p";
    const extra = type === "eyebrow" ? "theory-eyebrow" : "";
    content = editableTag(tag === "p" && type === "eyebrow" ? "div" : tag, `${component.id}:text`, component.text || "文本内容", component.style, extra);
  }
  const visualAttrs = type === "visual"
    ? ` data-visual-kind="${escapeHtml(component.kind || "")}" data-visual-label="${escapeHtml(component.label || "")}"`
    : "";
  return `
    <div class="theory-component theory-component-${escapeHtml(type)}${freeClass}${visibilityClass}${lockedClass}" data-component-id="${escapeHtml(component.id)}" data-component-type="${escapeHtml(type)}" data-layer-name="${escapeHtml(component.layerName || layerLabelForType(type))}" data-layer-visible="${String(isVisible)}" data-layer-locked="${String(isLocked)}"${visualAttrs} style="${style}">
      ${renderEditHandles()}
      ${isLocked ? `<span class="theory-lock-badge" aria-hidden="true">已锁定</span>` : ""}
      ${content}
    </div>
  `;
}

function renderTableComponent(component) {
  const tableData = normalizeTableData(component.tableData);
  const tableStyle = normalizeTableStyle(component.tableStyle);
  const cssVars = [
    `--table-font-size:${tableStyle.fontSize}px`,
    `--table-header-bg:${tableStyle.headerBackground}`,
    `--table-border-color:${tableStyle.borderColor}`,
    `--table-text-color:${tableStyle.textColor}`,
    `--table-header-color:${tableStyle.headerTextColor}`,
  ].join(";");
  const rows = tableData.cells.map((row, rowIndex) => {
    const tag = tableData.header && rowIndex === 0 ? "th" : "td";
    const cells = row.map((cell, colIndex) => `<${tag} class="theory-table-cell" contenteditable="false" spellcheck="false" data-table-cell="true" data-row="${rowIndex}" data-col="${colIndex}" data-raw-text="${escapeHtml(cell)}">${escapeHtml(cell)}</${tag}>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `
    <div class="table-component table-component-${escapeHtml(tableStyle.preset)}" data-table-preset="${escapeHtml(tableStyle.preset)}" data-table-header="${String(tableData.header)}" style="${cssVars}">
      <div class="theory-table-scroll">
        <table><tbody>${rows}</tbody></table>
      </div>
      ${renderTableQuickToolbar(component, tableData, tableStyle)}
    </div>`;
}

function renderTableQuickToolbar(component, tableData, tableStyle) {
  const presets = [
    ["clean", "简洁"],
  ];
  return `
    <div class="theory-table-toolbar" data-html2canvas-ignore="true" aria-label="表格工具栏">
      <span class="theory-table-toolbar-label">行操作</span>
      <button type="button" data-table-action="insert-row-above" title="在当前单元格所在行上方插入一行">上方插入</button>
      <button type="button" data-table-action="insert-row-below" title="在当前单元格所在行下方插入一行">下方插入</button>
      <button type="button" data-table-action="delete-row" title="删除当前单元格所在行">删除行</button>
      <span class="theory-table-toolbar-label">列操作</span>
      <button type="button" data-table-action="insert-col-left" title="在当前单元格所在列左侧插入一列">左侧插入</button>
      <button type="button" data-table-action="insert-col-right" title="在当前单元格所在列右侧插入一列">右侧插入</button>
      <button type="button" data-table-action="delete-col" title="删除当前单元格所在列">删除列</button>
      <span class="theory-table-toolbar-sep"></span>
      <span class="theory-table-toolbar-label">表格</span>
      <button type="button" class="${tableData.header ? "is-active" : ""}" data-table-action="toggle-header">表头</button>
      ${presets.map(([value, label]) => `<button type="button" class="${tableStyle.preset === value ? "is-active" : ""}" data-table-preset-option="${value}">${label}</button>`).join("")}
      <button type="button" class="theory-table-toolbar-danger" data-table-action="delete-table">删除表格</button>
    </div>`;
}

function renderEditHandles() {
  return `
    <button class="theory-drag-handle" type="button" data-drag-handle data-html2canvas-ignore="true" aria-label="拖动组件"></button>
    ${["n", "ne", "e", "se", "s", "sw", "w", "nw"].map(handle => `<button class="theory-resize-handle theory-resize-${handle}" type="button" data-resize-handle="${handle}" data-html2canvas-ignore="true" aria-label="${resizeHandleLabel(handle)}"></button>`).join("")}
  `;
}

function renderImageQuickToolbar(component) {
  const imageStyle = normalizeImageStyle(component.imageStyle);
  const styleOptions = [
    ["clean", "无边框"],
    ["card", "卡片"],
    ["figure", "图注"],
  ];
  return `
    <div class="theory-image-toolbar" data-html2canvas-ignore="true" aria-label="图片工具条">
      <span class="theory-image-toolbar-label">样式</span>
      ${styleOptions.map(([value, label]) => `<button type="button" class="${imageStyle === value ? "is-active" : ""}" data-image-style-option="${value}">${label}</button>`).join("")}
      <button type="button" data-image-action="replace">替换</button>
      <button type="button" data-image-action="delete">删除</button>
    </div>`;
}
function positionToCss(position) {
  if (!position) return "";
  return `left:${position.left || "0px"};top:${position.top || "0px"};width:${position.width || "240px"};height:${position.height || "auto"};z-index:${position.zIndex || 1};`;
}

function resizeHandleLabel(handle) {
  const labels = {
    n: "向上缩放",
    ne: "向右上缩放",
    e: "向右缩放",
    se: "向右下缩放",
    s: "向下缩放",
    sw: "向左下缩放",
    w: "向左缩放",
    nw: "向左上缩放",
  };
  return labels[handle] || "缩放组件";
}

function editableTag(tag, editId, text, style = {}, extraClass = "") {
  const rawText = String(text ?? "");
  return `<${tag} class="theory-editable ${extraClass}" contenteditable="false" spellcheck="false" data-edit-id="${escapeHtml(editId)}" data-raw-text="${escapeHtml(rawText)}" style="${styleToCss(style)}">${renderTextWithInlineMath(rawText)}</${tag}>`;
}

function cardParts(component) {
  const title = String(component?.title || "").trim();
  const body = String(component?.body || "").trim();
  if (title || body) {
    return {
      title: title || "卡片标题",
      body: body || "卡片正文"
    };
  }
  const rawText = String(component?.text || "");
  const lines = rawText.split(/\r?\n/);
  const first = String(lines.shift() || "").trim();
  const rest = lines.join("\n").trim();
  return {
    title: first || "卡片标题",
    body: rest || "卡片正文"
  };
}

function cardContainerStyle(style = {}) {
  const next = {};
  const background = style.backgroundColor || style.background;
  if (background) next.background = background;
  if (style.borderColor) next.borderColor = style.borderColor;
  if (style.borderRadius !== undefined && style.borderRadius !== null) next.borderRadius = style.borderRadius;
  if (style.boxShadow) next.boxShadow = style.boxShadow;
  return styleToCss(next);
}

function normalizeCardColorValue(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function resolveCardBackground(style = {}) {
  return style.backgroundColor || style.background || "";
}

function selectedCardItem(component) {
  if (!component || component.type !== "cards") return null;
  const selectedId = String(THEORY_PAGE_STATE.selectedId || "");
  if (selectedId.startsWith(component.id + ":")) {
    const parts = selectedId.split(":");
    if (parts.length >= 3) {
      const item = component.items.find(entry => entry.id === parts[1]);
      if (item) return item;
    }
  }
  return component.items?.[0] || null;
}

function updateCardComponentBackground(componentEl, component, itemId, color) {
  if (!componentEl) return;
  if (component.type === "card") {
    const card = componentEl.querySelector(".card-component");
    if (card) card.style.background = color;
    return;
  }
  if (component.type === "cards") {
    const item = component.items.find(entry => entry.id === itemId) || component.items?.[0];
    if (!item) return;
    const unitId = `${component.id}:${item.id}`;
    const card = componentEl.querySelector(`[data-edit-unit-id="${cssEscape(unitId)}"] .card-component`);
    if (card) card.style.background = color;
  }
}

function applyCardBackgroundColor(componentId, itemId, color) {
  if (!THEORY_PAGE_STATE.editing || !componentId) return;
  const component = findComponentById(componentId);
  if (!component) return;
  const componentEl = document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(componentId)}"]`);
  if (componentEl?.classList.contains("is-locked") || component.locked) return;
  pushDeckHistory("card-background");
  if (component.type === "card") {
    component.style = { ...(component.style || {}), backgroundColor: color };
  } else if (component.type === "cards") {
    const item = component.items.find(entry => entry.id === itemId) || component.items?.[0];
    if (!item) return;
    item.style = { ...(item.style || {}), backgroundColor: color };
  }
  updateCardComponentBackground(componentEl, component, itemId, color);
  commitDomToState();
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function renderCardStylePanel(component, componentEl) {
  if (!component || (component.type !== "card" && component.type !== "cards")) return "";
  const locked = componentEl?.classList.contains("is-locked") || component.locked;
  const item = component.type === "cards" ? selectedCardItem(component) : null;
  const style = component.type === "cards" ? (item?.style || {}) : (component.style || {});
  const current = normalizeCardColorValue(resolveCardBackground(style) || THEORY_CARD_DEFAULT_BACKGROUND);
  const itemId = item?.id || "";
  return `
    <section class="content-card theory-card-style-panel" data-card-style-panel data-card-component-id="${escapeHtml(component.id)}" data-card-item-id="${escapeHtml(itemId)}">
      <div class="theory-layer-panel-head">
        <div>
          <div class="eyebrow">样式</div>
          <h3>卡片底色</h3>
        </div>
        <div class="theory-layer-panel-subtitle">选择当前卡片的背景色</div>
      </div>
      <div class="card-color-row">
        ${THEORY_CARD_COLOR_SWATCHES.map(({ label, value }) => {
          const normalized = normalizeCardColorValue(value);
          const active = normalized === current;
          return `<button type="button" class="card-color-swatch${active ? " active" : ""}" data-card-color="${escapeHtml(value)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${locked ? "disabled" : ""} style="background:${escapeHtml(value)}"></button>`;
        }).join("")}
      </div>
    </section>`;
}

function renderTextWithInlineMath(text) {
  const source = String(text ?? "");
  if (!source.includes("$")) return escapeTextSegment(source);
  ensureTheoryFormulaSupport();
  const pattern = /\$([^$]+?)\$/g;
  let html = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    html += escapeTextSegment(source.slice(lastIndex, match.index));
    html += renderInlineLatexToHtml(match[1]);
    lastIndex = pattern.lastIndex;
  }
  html += escapeTextSegment(source.slice(lastIndex));
  return html;
}

function renderBoldAndItalicText(text) {
  const escaped = escapeHtml(text);
  const bolded = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  const italicized = bolded.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
  return italicized;
}

function escapeTextSegment(value) {
  return renderBoldAndItalicText(value).replace(/\n/g, "<br>");
}

function renderFormulaComponent(component) {
  ensureTheoryFormulaSupport();
  const latex = normalizeFormulaLatex(component.text || THEORY_DEFAULT_FORMULA);
  const style = {
    fontSize: "24px",
    lineHeight: "1.15",
    color: "#0f172a",
    textAlign: "center",
    ...component.style,
  };
  const editId = `${component.id}:text`;
  return `
    <div class="theory-formula-box" data-formula-box="${escapeHtml(editId)}" data-edit-id="${escapeHtml(editId)}" data-formula-latex="${escapeHtml(latex)}" style="${styleToCss(style)}">
      <div class="theory-formula-preview" data-formula-preview="${escapeHtml(editId)}" aria-label="公式预览">${renderLatexToHtml(latex)}</div>
      <div class="theory-formula-source-data" data-edit-id="${escapeHtml(editId)}" data-formula-source="true" data-formula-latex="${escapeHtml(latex)}" aria-hidden="true">${escapeHtml(latex)}</div>
    </div>
    <span class="formula-edit-hint" aria-hidden="true" data-selected-text="双击编辑公式" data-hover-text="双击编辑"></span>`;
}

function normalizeFormulaLatex(value) {
  const text = String(value || "").trim();
  if (!text) return THEORY_DEFAULT_FORMULA;
  if (/\by_hat\b/.test(text)) return text.replace(/\by_hat\b/g, "\\hat{y}").replace(/\s*\*\s*/g, "");
  return text;
}

function ensureTheoryFormulaSupport() {
  ensureTheoryFormulaStyles();
  if (typeof document === "undefined") return;
  if (!document.getElementById(THEORY_KATEX_STYLE_ID)) {
    const link = document.createElement("link");
    link.id = THEORY_KATEX_STYLE_ID;
    link.rel = "stylesheet";
    link.href = THEORY_KATEX_CSS_URL;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
  if (window.katex?.renderToString || document.getElementById(THEORY_KATEX_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = THEORY_KATEX_SCRIPT_ID;
  script.src = THEORY_KATEX_SCRIPT_URL;
  script.defer = true;
  script.crossOrigin = "anonymous";
  script.onload = () => queueTheoryFormulaRender();
  script.onerror = () => queueTheoryFormulaRender();
  document.head.appendChild(script);
}

function ensureTheoryFormulaStyles() {
  if (typeof document === "undefined" || document.getElementById(THEORY_FORMULA_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = THEORY_FORMULA_STYLE_ID;
  style.textContent = `
    .theory-component-formula .theory-formula-box {
      width: 100%;
      height: 100%;
      min-height: 0;
      padding: 6px 10px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94));
      box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
    }
    .theory-component-formula .theory-formula-preview {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: inherit;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .theory-component-formula .theory-formula-source-data {
      display: none;
    }
    .theory-component-formula .katex-display {
      margin: 0;
      width: 100%;
    }
    .theory-component-formula .katex {
      font-size: inherit;
      line-height: 1.1;
    }
    .theory-component-formula .formula-edit-hint {
      position: absolute;
      right: 8px;
      top: -28px;
      z-index: 10;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(147, 197, 253, 0.8);
      background: rgba(239, 246, 255, 0.95);
      color: #2563eb;
      font-size: 12px;
      line-height: 1.1;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(2px);
      transition: opacity .14s ease, transform .14s ease;
    }
    .theory-component-formula .formula-edit-hint::before {
      content: attr(data-selected-text);
    }
    .theory-deck-shell.is-editing .theory-component-formula:hover .formula-edit-hint,
    .theory-deck-shell.is-editing .theory-component-formula.is-selected .formula-edit-hint,
    .theory-deck-shell.is-editing .theory-component-formula.is-editing-formula .formula-edit-hint {
      opacity: 1;
      transform: translateY(0);
    }
    .theory-deck-shell.is-editing .theory-component-formula:hover .formula-edit-hint::before {
      content: attr(data-hover-text);
    }
    .theory-component-formula.is-editing-formula .formula-edit-hint {
      opacity: 0 !important;
    }
    .theory-formula-source-editor {
      position: fixed;
      z-index: 10020;
      width: min(${THEORY_FORMULA_EDITOR_WIDTH}px, calc(100vw - 24px));
      min-width: 240px;
      max-width: calc(100vw - 24px);
      min-height: ${THEORY_FORMULA_EDITOR_HEIGHT}px;
      max-height: min(260px, calc(100vh - 24px));
      padding: 10px 12px;
      border: 1px solid rgba(37, 99, 235, 0.42);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
      color: #0f172a;
      font-family: Consolas, "SFMono-Regular", "Courier New", monospace;
      font-size: 15px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow: auto;
      resize: none;
      outline: none;
      box-sizing: border-box;
    }
    .theory-formula-fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.12em;
      font-family: "Times New Roman", "Cambria Math", serif;
      font-size: 1.08em;
      line-height: 1.8;
      color: inherit;
      white-space: normal;
    }
    .theory-inline-formula {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 0.12em;
      vertical-align: -0.08em;
      line-height: 1;
    }
    .theory-editable .katex {
      font-size: 1.04em;
    }
    .theory-editable[data-inline-math-editing="true"] {
      white-space: pre-wrap;
    }
    .theory-math-frac {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      margin: 0 0.12em;
      line-height: 1.12;
    }
    .theory-math-frac > span:first-child {
      border-bottom: 1.5px solid currentColor;
      padding: 0 0.18em 0.06em;
    }
    .theory-math-frac > span:last-child {
      padding: 0.06em 0.18em 0;
      font-size: 0.88em;
    }
    .theory-math-large {
      font-size: 1.45em;
      line-height: 1;
      vertical-align: middle;
    }
    .theory-math-hat {
      text-decoration: overline;
      text-decoration-thickness: 0.06em;
      text-decoration-skip-ink: none;
    }
  `;
  document.head.appendChild(style);
}

function renderLatexToHtml(latex) {
  const source = normalizeFormulaLatex(latex);
  if (window.katex?.renderToString) {
    try {
      return window.katex.renderToString(source, {
        throwOnError: false,
        displayMode: true,
        strict: "ignore",
      });
    } catch (err) {}
  }
  return `<span class="theory-formula-fallback">${renderLatexFallback(source)}</span>`;
}

function renderInlineLatexToHtml(latex) {
  const source = normalizeFormulaLatex(latex);
  if (window.katex?.renderToString) {
    try {
      return window.katex.renderToString(source, {
        throwOnError: false,
        displayMode: false,
        strict: "ignore",
      });
    } catch (err) {}
  }
  return `<span class="theory-inline-formula theory-formula-fallback">${renderLatexFallback(source)}</span>`;
}

function renderLatexFallback(latex) {
  let html = escapeHtml(normalizeFormulaLatex(latex));
  html = html
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\pm/g, "±")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\hat\{([^{}]+)\}/g, `<span class="theory-math-hat">$1</span>`)
    .replace(/\\bar\{([^{}]+)\}/g, `<span class="theory-math-hat">$1</span>`)
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, `<span class="theory-math-frac"><span>$1</span><span>$2</span></span>`)
    .replace(/\\sum_\{([^{}]+)\}\^\{([^{}]+)\}/g, `<span class="theory-math-large">∑</span><sub>$1</sub><sup>$2</sup>`)
    .replace(/\^\{([^{}]+)\}/g, `<sup>$1</sup>`)
    .replace(/_\{([^{}]+)\}/g, `<sub>$1</sub>`)
    .replace(/\^([A-Za-z0-9])/g, `<sup>$1</sup>`)
    .replace(/_([A-Za-z0-9])/g, `<sub>$1</sub>`)
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\theta/g, "θ")
    .replace(/\\lambda/g, "λ")
    .replace(/\\mu/g, "μ")
    .replace(/\\sigma/g, "σ")
    .replace(/\\varepsilon|\\epsilon/g, "ε");
  return html;
}

function queueTheoryFormulaRender() {
  window.requestAnimationFrame(() => renderTheoryFormulaPreviews());
}

function renderTheoryFormulaPreviews() {
  const sourceNodes = Array.from(document.querySelectorAll(".theory-formula-source-data[data-edit-id]"));
  const inlineNodes = Array.from(document.querySelectorAll(".theory-editable[data-raw-text]"))
    .filter(node => node.dataset.inlineMathEditing !== "true");
  if (!sourceNodes.length && !inlineNodes.length) return;
  ensureTheoryFormulaSupport();
  sourceNodes.forEach(sourceNode => {
    updateTheoryFormulaPreview(sourceNode);
  });
  inlineNodes.forEach(node => {
    node.innerHTML = renderTextWithInlineMath(node.dataset.rawText || node.innerText || node.textContent || "");
  });
}

function updateTheoryFormulaPreview(sourceNode) {
  const box = sourceNode?.classList?.contains("theory-formula-box") ? sourceNode : sourceNode?.closest(".theory-formula-box");
  const dataNode = box?.querySelector(".theory-formula-source-data[data-formula-source='true']") || sourceNode;
  const latex = normalizeFormulaLatex(dataNode?.dataset.formulaLatex || dataNode?.innerText || dataNode?.textContent || box?.dataset.formulaLatex || THEORY_DEFAULT_FORMULA);
  if (box) box.dataset.formulaLatex = latex;
  if (dataNode) {
    dataNode.dataset.formulaLatex = latex;
    dataNode.textContent = latex;
  }
  const preview = box?.querySelector(".theory-formula-preview");
  if (!preview) return;
  preview.innerHTML = renderLatexToHtml(latex);
}

function styleToCss(style = {}) {
  return Object.entries(style).filter(([, value]) => value).map(([key, value]) => `${camelToKebab(key)}:${String(value).replace(/"/g, "&quot;")}`).join(";");
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function loadDeckForPage(pageId) {
  const saved = readSavedState(pageId);
  const templateDeck = theoryPages[pageId] || theoryPages.dataset;
  if (saved?.deckOverride?.slides?.length) {
    return normalizeTheoryDeckForRuntime(pageId, mergeTheoryDeckWithTemplate(saved.deckOverride, templateDeck));
  }
  return normalizeTheoryDeckForRuntime(pageId, templateDeck);
}

function mergeTheoryDeckWithTemplate(deckOverride, templateDeck) {
  if (!templateDeck?.slides?.length) return deckOverride;
  const merged = clone(deckOverride);
  merged.slides = (merged.slides || []).map((slide, index) => {
    if (!isSparseTheorySlide(slide)) return slide;
    return clone(templateDeck.slides[index] || slide);
  });
  return merged;
}

function isSparseTheorySlide(slide) {
  const components = slide?.components || [];
  if (!components.length) return true;
  if (components.length > 1) return false;
  const component = components[0];
  const text = String(component.text || component.title || component.body || "").trim();
  const hasItems = Array.isArray(component.items) && component.items.some(item => String(item.title || item.body || item.text || "").trim());
  const mediaTypes = ["image", "chart", "visual"];
  if (hasItems || mediaTypes.includes(component.type)) return false;
  return ["h1", "h2", "h3", "p", "text"].includes(component.type || "text") && Boolean(text);
}

function readSavedState(pageId) {
  const override = THEORY_PAGE_STATE.serverOverrides?.[pageId];
  if (!override?.slides?.length) return null;
  return { deckOverride: clone(override) };
}

function bindTheoryDeck(pageId) {
  $("theoryPrevBtn")?.addEventListener("click", () => renderTheorySlide(THEORY_PAGE_STATE.currentSlide - 1));
  $("theoryNextBtn")?.addEventListener("click", () => renderTheorySlide(THEORY_PAGE_STATE.currentSlide + 1));
  $("theoryEditBtn")?.addEventListener("click", () => {
    playTheoryModeTransition("editing");
    setTheoryEditing(true);
  });
  $("theoryCancelBtn")?.addEventListener("click", () => {
    clearTheoryAutosave();
    THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
    THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
    renderTheoryDeckDetail(pageId);
  });
  $("theorySaveBtn")?.addEventListener("click", async () => {
    finishTextEditing();
    commitDomToState();
    await saveTheoryEdits(pageId, { source: "manual" });
    playTheoryModeTransition("readonly");
    setTheoryEditing(false);
  });
  $("theoryExportBtn")?.addEventListener("click", () => exportTheoryPptx(pageId));
  document.querySelector("[data-theory-detail]")?.addEventListener("click", () => renderTheoryDetail(pageId));
  $("theoryAddSlideBtn")?.addEventListener("click", () => {
    finishTextEditing();
    addTheorySlide();
  });
  $("theoryDeleteSlideBtn")?.addEventListener("click", () => {
    finishTextEditing();
    deleteTheorySlide();
  });
  $("theoryDeleteComponentBtn")?.addEventListener("click", () => {
    finishTextEditing();
    deleteSelectedComponents();
  });
  $("theoryUndoBtn")?.addEventListener("click", undoDeckChange);
  $("theoryRedoBtn")?.addEventListener("click", redoDeckChange);
  $("theoryDuplicateBtn")?.addEventListener("click", () => {
    finishTextEditing();
    duplicateSelectedComponents();
  });
  $("theorySnapBtn")?.addEventListener("click", toggleSnapToGrid);
  $("theoryImageBtn")?.addEventListener("click", () => {
    finishTextEditing();
    THEORY_PAGE_STATE.pendingReplaceImageId = null;
    $("theoryImageInput")?.click();
  });
  $("theoryImageInput")?.addEventListener("change", event => {
    finishTextEditing();
    const file = event.target.files?.[0];
    if (file && THEORY_PAGE_STATE.pendingReplaceImageId) replaceImageComponent(THEORY_PAGE_STATE.pendingReplaceImageId, file);
    else if (file) insertImageComponent(file);
    THEORY_PAGE_STATE.pendingReplaceImageId = null;
    event.target.value = "";
  });
  document.querySelectorAll("[data-insert-component]").forEach(button => {
    button.addEventListener("pointerdown", event => {
      if (button.dataset.insertComponent === "formula") event.preventDefault();
    });
    button.addEventListener("click", () => {
      const insertType = button.dataset.insertComponent;
      if (THEORY_PAGE_STATE.activeTableCell) {
        finishTableCellEditing();
        insertTheoryComponent(insertType);
        return;
      }
      if (insertType === "formula" && insertInlineFormulaAtSelection()) return;
      finishTextEditing();
      insertTheoryComponent(insertType);
    });
  });
  bindFontTools();
  bindEditableEvents(pageId);
  bindTheoryDragAndDrop(pageId);
  applyLegacyEdits(pageId);
}

function bindEditableEvents(pageId) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.addEventListener("pointerdown", event => {
    if (!THEORY_PAGE_STATE.editing) return;
    if (event.target.closest(".theory-component, .theory-deck-toolbar, .theory-editor-tools, input, textarea, select, button")) return;
    finishTableCellEditing();
    finishTextEditing({ preserveComponentSelection: true });
  });
  deck.querySelectorAll(".theory-component").forEach(component => {
    component.addEventListener("pointerdown", event => {
      if (!THEORY_PAGE_STATE.editing || event.target.closest("[data-edit-unit-id], [data-drag-handle], [data-resize-handle]")) return;
      if (event.target.closest(".card-header .theory-editable, .card-body .theory-editable")) {
        return;
      }
      if (event.target.closest(".theory-editable")) return;
      selectTheoryComponent(component, event.target.closest(".theory-editable"), event.shiftKey);
    });
    component.addEventListener("contextmenu", event => {
      if (!THEORY_PAGE_STATE.editing) return;
      event.preventDefault();
      event.stopPropagation();
      selectTheoryComponent(component);
      openTheoryLayerContextMenu(component, event.clientX, event.clientY);
    });
  });
  deck.querySelectorAll(".theory-component-formula").forEach(component => {
    component.addEventListener("dblclick", event => {
      if (!THEORY_PAGE_STATE.editing || component.classList.contains("is-locked")) return;
      if (event.target.closest("[data-drag-handle], [data-resize-handle]")) return;
      event.preventDefault();
      event.stopPropagation();
      openTheoryFormulaEditor(component);
    });
  });
  deck.querySelectorAll("[data-image-style-option]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const component = button.closest(".theory-component-image");
      updateImageComponentOptions(component, { imageStyle: button.dataset.imageStyleOption });
      if (button.dataset.imageStyleOption === "figure") focusImageCaption(component);
    });
  });
  deck.querySelectorAll("[data-image-action]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      handleImageToolbarAction(button.closest(".theory-component-image"), button.dataset.imageAction);
    });
  });
  deck.querySelectorAll(".theory-component-table").forEach(bindTableComponentEvents);
  deck.querySelectorAll("[data-edit-unit-id]").forEach(unit => {
    unit.addEventListener("pointerdown", event => {
      if (!THEORY_PAGE_STATE.editing || event.target.closest("[data-drag-handle], [data-resize-handle]")) return;
      event.stopPropagation();
    });
  });
  deck.querySelectorAll(".theory-editable").forEach(node => {
    node.addEventListener("pointerdown", event => {
      const component = node.closest(".theory-component");
      const isCardComponent = component?.dataset.componentType === "card" || component?.dataset.componentType === "cards";
      if (!THEORY_PAGE_STATE.editing || !isCardComponent || component?.classList.contains("is-locked")) return;
      event.stopPropagation();
      node.setAttribute("contenteditable", "true");
      selectTheoryComponent(component, node);
      focusEditableText(node);
    });
    node.addEventListener("focus", () => {
      const component = node.closest(".theory-component");
      if (component?.dataset.componentType === "card" || component?.dataset.componentType === "cards") {
        selectTheoryComponent(component, node);
      } else if (component && THEORY_PAGE_STATE.selectedIds.includes(component.dataset.componentId)) {
        document.querySelectorAll(".theory-editable.is-selected").forEach(item => item.classList.remove("is-selected"));
        node.classList.add("is-selected");
        THEORY_PAGE_STATE.selectedId = node.dataset.editId || component.dataset.componentId;
        updateFontTools();
        updateEditorToolState();
      } else {
        selectTheoryComponent(component, node);
      }
      enterInlineMathEdit(node);
      node.dataset.historyPending = "true";
    });
    node.addEventListener("beforeinput", () => {
      if (node.dataset.historyPending === "true") {
        pushDeckHistory("text");
        node.dataset.historyPending = "false";
      }
    });
    node.addEventListener("input", () => {
      if (node.classList.contains("theory-formula-source-data")) updateTheoryFormulaPreview(node);
      else syncInlineMathRawText(node);
      markTheoryDirty();
    });
    node.addEventListener("blur", () => {
      if (node.classList.contains("theory-formula-source-data")) updateTheoryFormulaPreview(node);
      else exitInlineMathEdit(node);
      delete node.dataset.historyPending;
      const component = node.closest(".theory-component");
      if (component?.dataset.componentType === "card" || component?.dataset.componentType === "cards") {
        node.setAttribute("contenteditable", "false");
      }
      commitDomToState();
    });
    node.addEventListener("dblclick", event => {
      const component = node.closest(".theory-component");
      if (!THEORY_PAGE_STATE.editing || component?.classList.contains("is-locked")) return;
      if (component?.dataset.componentType === "card" || component?.dataset.componentType === "cards") {
        return;
      }
      event.stopPropagation();
      focusEditableText(node);
    });
  });
}

function updateImageComponentOptions(componentEl, updates = {}) {
  if (!THEORY_PAGE_STATE.editing || !componentEl || componentEl.classList.contains("is-locked")) return;
  const frame = componentEl.querySelector(".theory-image-frame");
  if (!frame) return;
  pushDeckHistory("image-options");
  const nextStyle = normalizeImageStyle(updates.imageStyle || frame.dataset.imageStyle);
  const nextFit = normalizeImageObjectFit(updates.objectFit || frame.dataset.objectFit);
  frame.dataset.imageStyle = nextStyle;
  frame.dataset.objectFit = nextFit;
  frame.classList.remove("clean", "card", "figure");
  frame.classList.add(nextStyle);
  const image = frame.querySelector("img");
  if (image) image.style.objectFit = nextFit;
  const caption = frame.querySelector(".theory-image-caption");
  if (caption) caption.classList.toggle("is-empty", !captionText(caption).trim());
  frame.querySelectorAll("[data-image-style-option]").forEach(button => button.classList.toggle("is-active", button.dataset.imageStyleOption === nextStyle));
  selectTheoryComponent(componentEl);
  commitDomToState();
  markTheoryDirty();
}

function handleImageToolbarAction(componentEl, action) {
  if (!THEORY_PAGE_STATE.editing || !componentEl || componentEl.classList.contains("is-locked")) return;
  const componentId = componentEl.dataset.componentId;
  selectTheoryComponent(componentEl);
  if (action === "replace") {
    THEORY_PAGE_STATE.pendingReplaceImageId = componentId;
    $("theoryImageInput")?.click();
  } else if (action === "delete") {
    deleteSelectedComponentsById([componentId]);
  }
}

function focusImageCaption(componentEl) {
  const caption = componentEl?.querySelector(".theory-image-caption");
  if (!caption) return;
  if (!captionText(caption).trim()) {
    caption.dataset.rawText = "图：";
    caption.textContent = "图：";
    caption.classList.remove("is-empty");
    commitDomToState();
    markTheoryDirty();
  }
  focusEditableText(caption);
}

function captionText(node) {
  return node?.dataset?.rawText ?? node?.innerText ?? node?.textContent ?? "";
}

function bindTableComponentEvents(componentEl) {
  if (!componentEl || componentEl.dataset.tableEventsBound === "true") return;
  componentEl.dataset.tableEventsBound = "true";
  componentEl.addEventListener("pointerdown", event => {
    if (!THEORY_PAGE_STATE.editing) return;
    const toolbarButton = event.target.closest("[data-table-action], [data-table-preset-option]");
    if (toolbarButton) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const cell = event.target.closest(".theory-table-cell");
    if (!cell || !componentEl.contains(cell)) return;
    if (cell.getAttribute("contenteditable") === "true") {
      event.stopPropagation();
      return;
    }
    if (componentEl.classList.contains("is-locked")) return;
    event.preventDefault();
    event.stopPropagation();
    beginTableCellEditing(cell);
  });
  componentEl.addEventListener("dblclick", event => {
    const cell = event.target.closest(".theory-table-cell");
    if (!THEORY_PAGE_STATE.editing || !cell || componentEl.classList.contains("is-locked")) return;
    if (cell.getAttribute("contenteditable") !== "true") {
      event.preventDefault();
      event.stopPropagation();
      beginTableCellEditing(cell);
    }
  });
  componentEl.addEventListener("input", event => {
    const cell = event.target.closest(".theory-table-cell");
    if (cell?.getAttribute("contenteditable") === "true") {
      cell.dataset.rawText = cell.innerText || cell.textContent || "";
      markTheoryDirty();
    }
  });
  componentEl.addEventListener("keydown", event => {
    const cell = event.target.closest(".theory-table-cell");
    if (!cell || cell.getAttribute("contenteditable") !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishTableCellEditing({ cancel: true });
    } else if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const tableData = normalizeTableData(findComponentById(componentEl.dataset.componentId)?.tableData);
      const nextCol = col + 1;
      if (nextCol < tableData.cols) {
        moveTableCellEditing(cell, 0, 1);
      } else if (row + 1 < tableData.rows) {
        moveTableCellEditing(cell, 1, -col);
      }
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      const componentId = componentEl.dataset.componentId;
      const tableData = normalizeTableData(findComponentById(componentId)?.tableData);
      if (Number(cell.dataset.row) + 1 < tableData.rows) {
        moveTableCellEditing(cell, 1, 0);
      } else {
        const col = Number(cell.dataset.col);
        const newRow = tableData.rows;
        handleTableToolbarAction(componentEl, "insert-row-below");
        requestAnimationFrame(() => {
          const nextComponent = document.querySelector(`.theory-component-table[data-component-id="${cssEscape(componentId)}"]`);
          const next = nextComponent?.querySelector(`.theory-table-cell[data-row="${newRow}"][data-col="${col}"]`);
          if (next) beginTableCellEditing(next);
        });
      }
    }
  });
  componentEl.addEventListener("focusout", event => {
    const cell = event.target.closest(".theory-table-cell");
    if (THEORY_PAGE_STATE.activeTableCell?.cell === cell) finishTableCellEditing();
  });
  componentEl.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-table-action]");
    if (actionButton && componentEl.contains(actionButton)) {
      event.preventDefault();
      event.stopPropagation();
      handleTableToolbarAction(componentEl, actionButton.dataset.tableAction);
      return;
    }
    const presetButton = event.target.closest("[data-table-preset-option]");
    if (presetButton && componentEl.contains(presetButton)) {
      event.preventDefault();
      event.stopPropagation();
      updateTableComponent(componentEl, tableData => tableData, tableStyle => ({ ...tableStyle, preset: presetButton.dataset.tablePresetOption }));
    }
  });
}

function beginTableCellEditing(cell) {
  if (!cell) return;
  finishTextEditing();
  finishTableCellEditing();
  const component = cell.closest(".theory-component-table");
  if (!component || component.classList.contains("is-locked")) return;
  selectTheoryComponent(component);
  component.querySelectorAll(".theory-table-cell.is-active-cell, .theory-table-cell.is-editing").forEach(item => {
    item.classList.remove("is-active-cell", "is-editing");
    item.setAttribute("contenteditable", "false");
  });
  THEORY_PAGE_STATE.activeTableCell = {
    componentId: component.dataset.componentId,
    rowIndex: Number(cell.dataset.row),
    colIndex: Number(cell.dataset.col),
    cell,
    originalText: cell.dataset.rawText ?? cell.innerText ?? cell.textContent ?? "",
  };
  cell.setAttribute("contenteditable", "true");
  cell.classList.add("is-editing", "is-active-cell");
  cell.focus();
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(false);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function finishTableCellEditing(options = {}) {
  const active = THEORY_PAGE_STATE.activeTableCell;
  if (!active?.cell) {
    if (!options.preserveCellSelection) THEORY_PAGE_STATE.activeTableCell = null;
    return;
  }
  const cell = active.cell;
  const wasEditing = cell.getAttribute("contenteditable") === "true" || cell.classList.contains("is-editing");
  if (options.cancel && wasEditing) {
    cell.textContent = active.originalText;
    cell.dataset.rawText = active.originalText;
  } else if (wasEditing) {
    const text = cell.innerText || cell.textContent || "";
    cell.dataset.rawText = text;
    cell.textContent = text;
  }
  cell.setAttribute("contenteditable", "false");
  cell.classList.remove("is-editing");
  if (options.preserveCellSelection) {
    cell.classList.add("is-active-cell");
    active.originalText = cell.dataset.rawText ?? cell.innerText ?? cell.textContent ?? "";
  } else {
    cell.classList.remove("is-active-cell");
    THEORY_PAGE_STATE.activeTableCell = null;
    cell.blur?.();
    document.getSelection?.()?.removeAllRanges();
  }
  if (wasEditing) {
    commitDomToState();
    markTheoryDirty();
  }
}

function moveTableCellEditing(cell, rowStep, colStep) {
  const row = Number(cell.dataset.row) + rowStep;
  const col = Number(cell.dataset.col) + colStep;
  const component = cell.closest(".theory-component-table");
  finishTableCellEditing();
  const next = component?.querySelector(`.theory-table-cell[data-row="${row}"][data-col="${col}"]`);
  if (next) beginTableCellEditing(next);
}

function selectedTableCell(componentEl) {
  const active = THEORY_PAGE_STATE.activeTableCell?.cell;
  if (active && (!componentEl || active.closest(".theory-component-table") === componentEl)) return active;
  return componentEl?.querySelector(".theory-table-cell.is-editing, .theory-table-cell.is-active-cell") || null;
}

function setActiveTableCell(componentEl, rowIndex, colIndex) {
  if (!componentEl) return null;
  const tableData = normalizeTableData(findComponentById(componentEl.dataset.componentId)?.tableData);
  const row = Math.max(0, Math.min(Number(rowIndex) || 0, tableData.rows - 1));
  const col = Math.max(0, Math.min(Number(colIndex) || 0, tableData.cols - 1));
  componentEl.querySelectorAll(".theory-table-cell.is-active-cell, .theory-table-cell.is-editing").forEach(item => {
    item.classList.remove("is-active-cell", "is-editing");
    item.setAttribute("contenteditable", "false");
  });
  const cell = componentEl.querySelector(`.theory-table-cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return null;
  cell.classList.add("is-active-cell");
  THEORY_PAGE_STATE.activeTableCell = {
    componentId: componentEl.dataset.componentId,
    rowIndex: row,
    colIndex: col,
    cell,
    originalText: cell.dataset.rawText ?? cell.innerText ?? cell.textContent ?? "",
  };
  return cell;
}

function tableCellForAction(componentEl, tableData) {
  const active = THEORY_PAGE_STATE.activeTableCell;
  if (active?.componentId === componentEl?.dataset.componentId && Number.isFinite(active.rowIndex) && Number.isFinite(active.colIndex)) {
    return {
      rowIndex: Math.max(0, Math.min(active.rowIndex, tableData.rows - 1)),
      colIndex: Math.max(0, Math.min(active.colIndex, tableData.cols - 1)),
    };
  }
  const selected = selectedTableCell(componentEl);
  if (selected) {
    return {
      rowIndex: Math.max(0, Math.min(Number(selected.dataset.row) || 0, tableData.rows - 1)),
      colIndex: Math.max(0, Math.min(Number(selected.dataset.col) || 0, tableData.cols - 1)),
    };
  }
  return {
    rowIndex: tableData.rows - 1,
    colIndex: tableData.cols - 1,
  };
}

function tableDataFromComponentEl(componentEl) {
  const rows = Array.from(componentEl.querySelectorAll(".table-component table tr")).map(row => (
    Array.from(row.querySelectorAll(".theory-table-cell")).map(cell => cell.dataset.rawText ?? cell.innerText ?? cell.textContent ?? "")
  ));
  const fallback = normalizeTableData(findComponentById(componentEl.dataset.componentId)?.tableData);
  return normalizeTableData({
    rows: rows.length || fallback.rows,
    cols: rows[0]?.length || fallback.cols,
    header: componentEl.querySelector(".table-component")?.dataset.tableHeader !== "false",
    cells: rows.length ? rows : fallback.cells,
  });
}

function tableStyleFromComponentEl(componentEl) {
  const table = componentEl.querySelector(".table-component");
  const current = normalizeTableStyle(findComponentById(componentEl.dataset.componentId)?.tableStyle);
  return normalizeTableStyle({
    ...current,
    preset: table?.dataset.tablePreset || current.preset,
  });
}

function updateTableComponent(componentEl, dataUpdater, styleUpdater = null, options = {}) {
  if (!THEORY_PAGE_STATE.editing || !componentEl || componentEl.classList.contains("is-locked")) return;
  const activeCell = options.activeCell || (
    THEORY_PAGE_STATE.activeTableCell?.componentId === componentEl.dataset.componentId
      ? {
          rowIndex: THEORY_PAGE_STATE.activeTableCell.rowIndex,
          colIndex: THEORY_PAGE_STATE.activeTableCell.colIndex,
        }
      : null
  );
  finishTableCellEditing({ preserveCellSelection: Boolean(activeCell) });
  pushDeckHistory("table-edit");
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  const component = slide?.components?.find(item => item.id === componentEl.dataset.componentId);
  if (!component) return;
  const nextData = normalizeTableData(dataUpdater(normalizeTableData(component.tableData)));
  const nextStyle = normalizeTableStyle(styleUpdater ? styleUpdater(normalizeTableStyle(component.tableStyle)) : component.tableStyle);
  component.tableData = nextData;
  component.tableStyle = nextStyle;
  THEORY_PAGE_STATE.selectedIds = [component.id];
  THEORY_PAGE_STATE.selectedId = component.id;
  componentEl.classList.add("is-selected");
  const tableNode = componentEl.querySelector(".table-component");
  if (tableNode) {
    tableNode.outerHTML = renderTableComponent(component);
  }
  bindTableComponentEvents(componentEl);
  if (activeCell) {
    setActiveTableCell(componentEl, activeCell.rowIndex, activeCell.colIndex);
  }
  updateEditorToolState();
  refreshTheoryRightPanel();
  markTheoryDirty();
}

function handleTableToolbarAction(componentEl, action) {
  if (!componentEl) return;
  if (action === "delete-table") {
    deleteSelectedComponentsById([componentEl.dataset.componentId]);
    return;
  }
  const current = normalizeTableData(findComponentById(componentEl.dataset.componentId)?.tableData);
  const { rowIndex: activeRow, colIndex: activeCol } = tableCellForAction(componentEl, current);
  if (action === "delete-row" && current.rows <= 1) return;
  if (action === "delete-col" && current.cols <= 1) return;
  if (action === "delete-row" && current.header && activeRow === 0) {
    const confirmed = window.confirm?.("删除第一行会移除当前表头内容，确认删除？") ?? false;
    if (!confirmed) return;
  }
  let nextActiveCell = { rowIndex: activeRow, colIndex: activeCol };
  if (action === "insert-row-above") nextActiveCell = { rowIndex: current.header && activeRow === 0 ? 1 : activeRow, colIndex: activeCol };
  if (action === "insert-row-below") nextActiveCell = { rowIndex: activeRow + 1, colIndex: activeCol };
  if (action === "delete-row") nextActiveCell = { rowIndex: Math.min(activeRow, current.rows - 2), colIndex: activeCol };
  if (action === "insert-col-left") nextActiveCell = { rowIndex: activeRow, colIndex: activeCol };
  if (action === "insert-col-right") nextActiveCell = { rowIndex: activeRow, colIndex: activeCol + 1 };
  if (action === "delete-col") nextActiveCell = { rowIndex: activeRow, colIndex: Math.min(activeCol, current.cols - 2) };
  updateTableComponent(componentEl, tableData => {
    const next = normalizeTableData(tableData);
    if (action === "insert-row-above") {
      const newRow = Array.from({ length: next.cols }, () => "");
      const insertIndex = next.header && activeRow === 0 ? 1 : activeRow;
      next.cells.splice(insertIndex, 0, newRow);
    } else if (action === "insert-row-below") {
      const newRow = Array.from({ length: next.cols }, () => "");
      next.cells.splice(activeRow + 1, 0, newRow);
    } else if (action === "delete-row" && next.cells.length > 1) {
      next.cells.splice(activeRow, 1);
    } else if (action === "insert-col-left") {
      next.cells.forEach(row => row.splice(activeCol, 0, ""));
    } else if (action === "insert-col-right") {
      next.cells.forEach(row => row.splice(activeCol + 1, 0, ""));
    } else if (action === "delete-col" && next.cols > 1) {
      next.cells.forEach(row => row.splice(activeCol, 1));
    } else if (action === "toggle-header") {
      next.header = !next.header;
    }
    next.rows = next.cells.length;
    next.cols = Math.max(1, ...next.cells.map(row => row.length));
    next.cells = next.cells.map(row => Array.from({ length: next.cols }, (_, index) => String(row[index] ?? "")));
    return next;
  }, null, { activeCell: nextActiveCell });
}

function enterInlineMathEdit(node) {
  if (!node || node.classList.contains("theory-formula-source-data")) return;
  if (node.dataset.inlineMathEditing === "true") return;
  const rawText = node.dataset.rawText ?? node.innerText ?? node.textContent ?? "";
  node.dataset.rawText = rawText;
  node.textContent = rawText;
  node.dataset.inlineMathEditing = "true";
}

function syncInlineMathRawText(node) {
  if (!node || node.classList.contains("theory-formula-source-data")) return;
  node.dataset.rawText = node.innerText || node.textContent || "";
}

function exitInlineMathEdit(node) {
  if (!node || node.classList.contains("theory-formula-source-data")) return;
  const rawText = node.innerText || node.textContent || node.dataset.rawText || "";
  node.dataset.rawText = rawText;
  delete node.dataset.inlineMathEditing;
  node.innerHTML = renderTextWithInlineMath(rawText);
}

function finishTextEditing(options = {}) {
  finishTableCellEditing();
  const { preserveComponentSelection = true } = options;
  const activeEditable = document.activeElement?.closest?.(".theory-slide.active .theory-editable");
  const editables = new Set(document.querySelectorAll(".theory-slide.active .theory-editable[data-inline-math-editing='true']"));
  if (activeEditable?.classList?.contains("theory-editable")) editables.add(activeEditable);

  editables.forEach(node => {
    if (node.classList.contains("theory-formula-source-data")) updateTheoryFormulaPreview(node);
    else exitInlineMathEdit(node);
    delete node.dataset.historyPending;
    node.setAttribute("contenteditable", "false");
    node.blur?.();
  });

  if (THEORY_PAGE_STATE.formulaEditor) closeTheoryFormulaEditor({ save: true });
  document.getSelection?.()?.removeAllRanges();
  if (!preserveComponentSelection) clearSelection();
  commitDomToState();
  updateFontTools();
  updateEditorToolState();
}

function insertInlineFormulaAtSelection() {
  if (!THEORY_PAGE_STATE.editing) return false;
  const target = inlineFormulaInsertionTarget();
  if (!target) return false;
  pushDeckHistory("insert-inline-formula");
  enterInlineMathEdit(target);
  insertTextIntoEditable(target, ` ${THEORY_DEFAULT_INLINE_FORMULA} `);
  syncInlineMathRawText(target);
  selectTheoryComponent(target.closest(".theory-component"), target);
  markTheoryDirty();
  commitDomToState();
  setTheoryStatus("已在文本中插入公式");
  return true;
}

function inlineFormulaInsertionTarget() {
  const active = document.activeElement?.closest?.(".theory-slide.active .theory-editable");
  if (isInlineFormulaEditable(active) && active.getAttribute("contenteditable") === "true") return active;
  return null;
}

function isInlineFormulaEditable(node) {
  return Boolean(node
    && node.classList?.contains("theory-editable")
    && !node.classList.contains("theory-formula-source-data")
    && !node.closest(".theory-component-formula"));
}

function insertTextIntoEditable(node, text) {
  node.focus();
  const selection = window.getSelection();
  let range = null;
  if (selection?.rangeCount) {
    const candidate = selection.getRangeAt(0);
    if (node.contains(candidate.commonAncestorContainer)) range = candidate;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
  }
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function focusEditableText(node) {
  node.setAttribute("contenteditable", "true");
  node.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function formulaDataNode(editId) {
  return document.querySelector(".theory-formula-source-data[data-edit-id=\"" + cssEscape(editId) + "\"]");
}

function formulaBoxByEditId(editId) {
  return document.querySelector(".theory-formula-box[data-edit-id=\"" + cssEscape(editId) + "\"]");
}

function currentFormulaLatexForComponent(component) {
  const componentId = component?.dataset?.componentId || component?.id || "";
  const editId = componentId ? `${componentId}:text` : null;
  const dataNode = editId ? formulaDataNode(editId) : null;
  const box = editId ? formulaBoxByEditId(editId) : null;
  return normalizeFormulaLatex(dataNode?.dataset.formulaLatex || box?.dataset.formulaLatex || dataNode?.textContent || box?.textContent || THEORY_DEFAULT_FORMULA);
}

function positionTheoryFormulaEditor(editor, box) {
  const rect = box.getBoundingClientRect();
  const editorWidth = Math.min(THEORY_FORMULA_EDITOR_WIDTH, Math.max(240, Math.min(window.innerWidth - 24, rect.width)));
  const editorHeight = THEORY_FORMULA_EDITOR_HEIGHT;
  let left = rect.left;
  let top = rect.bottom + 8;
  if (window.innerWidth - rect.right - 12 >= editorWidth) {
    left = rect.right + 8;
    top = rect.top;
  } else if (top + editorHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - editorHeight - 8);
  }
  if (left + editorWidth > window.innerWidth - 12) left = window.innerWidth - editorWidth - 12;
  if (left < 12) left = 12;
  if (top + editorHeight > window.innerHeight - 12) top = window.innerHeight - editorHeight - 12;
  if (top < 12) top = 12;
  editor.style.left = Math.round(left) + "px";
  editor.style.top = Math.round(top) + "px";
  editor.style.width = Math.round(editorWidth) + "px";
}

function openTheoryFormulaEditor(component) {
  if (!component || !THEORY_PAGE_STATE.editing) return;
  const existing = THEORY_PAGE_STATE.formulaEditor;
  if (existing?.componentId === component.dataset.componentId) {
    existing.editor?.focus?.();
    return;
  }
  closeTheoryFormulaEditor({ save: true });
  selectTheoryComponent(component);
  const box = component.querySelector(".theory-formula-box");
  if (!box) return;
  const editId = box.dataset.editId || `${component.dataset.componentId}:text`;
  const latex = currentFormulaLatexForComponent(component);
  component.classList.add("is-editing-formula");
  const editor = document.createElement("textarea");
  editor.className = "theory-formula-source-editor";
  editor.value = latex;
  editor.spellcheck = false;
  editor.setAttribute("aria-label", "LaTeX 公式源码编辑框");
  editor.dataset.componentId = component.dataset.componentId || "";
  editor.dataset.editId = editId;
  editor.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeTheoryFormulaEditor({ save: false });
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      closeTheoryFormulaEditor({ save: true });
    }
  });
  editor.addEventListener("blur", () => {
    closeTheoryFormulaEditor({ save: true });
  });
  document.body.appendChild(editor);
  positionTheoryFormulaEditor(editor, box);
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
  THEORY_PAGE_STATE.formulaEditor = {
    componentId: component.dataset.componentId,
    editId,
    editor,
    component,
    box,
    initialLatex: latex,
  };
}

function closeTheoryFormulaEditor(options = {}) {
  const session = THEORY_PAGE_STATE.formulaEditor;
  if (!session) return;
  const { save = true } = options;
  const { editor, component, box, initialLatex, editId } = session;
  if (save && editor && component && box) {
    const nextLatex = normalizeFormulaLatex(editor.value || THEORY_DEFAULT_FORMULA);
    const currentLatex = normalizeFormulaLatex(initialLatex || THEORY_DEFAULT_FORMULA);
    if (nextLatex !== currentLatex) {
      pushDeckHistory("formula-edit");
      const dataNode = formulaDataNode(editId);
      if (dataNode) {
        dataNode.dataset.formulaLatex = nextLatex;
        dataNode.textContent = nextLatex;
      }
      box.dataset.formulaLatex = nextLatex;
      updateTheoryFormulaPreview(box);
      markTheoryDirty();
      commitDomToState();
    }
  }
  if (editor?.isConnected) editor.remove();
  component?.classList?.remove("is-editing-formula");
  THEORY_PAGE_STATE.formulaEditor = null;
}

function renderTheorySlide(index) {
  const slides = Array.from(document.querySelectorAll(".theory-slide"));
  if (!slides.length) return;
  updateTheorySlideScale();
  THEORY_PAGE_STATE.currentSlide = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === THEORY_PAGE_STATE.currentSlide;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  $("theoryPageIndicator").textContent = `${THEORY_PAGE_STATE.currentSlide + 1} / ${slides.length}`;
  $("theoryPrevBtn").disabled = THEORY_PAGE_STATE.currentSlide === 0;
  $("theoryNextBtn").disabled = THEORY_PAGE_STATE.currentSlide === slides.length - 1;
  const deleteBtn = $("theoryDeleteSlideBtn");
  if (deleteBtn) deleteBtn.disabled = slides.length <= 1;
  updateEditorToolState();
  queueTheoryChartRender();
  queueTheoryFormulaRender();
}

document.addEventListener("keydown", event => {
  const deck = $("theoryDeck");
  if (!deck || !document.querySelector(".shell.theory")) return;
  if (THEORY_PAGE_STATE.editing && event.key === "Escape" && !event.target.closest?.(".theory-formula-source-editor")) {
    event.preventDefault();
    finishTextEditing({ preserveComponentSelection: true });
    return;
  }
  if (event.target.closest?.("input, textarea, select, [contenteditable='true'], .theory-editable, .theory-formula-source-editor")) return;
  const isLayerShortcut = THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && !event.altKey;
  if (isLayerShortcut && event.key.toLowerCase() === "l") {
    event.preventDefault();
    applyTheoryLayerAction("lock-toggle");
    return;
  }
  if (isLayerShortcut && event.key === "]") {
    event.preventDefault();
    applyTheoryLayerAction(event.shiftKey ? "front" : "forward");
    return;
  }
  if (isLayerShortcut && event.key === "[") {
    event.preventDefault();
    applyTheoryLayerAction(event.shiftKey ? "back" : "backward");
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redoDeckChange();
    else undoDeckChange();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redoDeckChange();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelectedComponents();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.key === "Delete" || event.key === "Backspace")) {
    if (deleteSelectedComponents()) event.preventDefault();
    return;
  }
  if (event.key === "ArrowLeft") renderTheorySlide(THEORY_PAGE_STATE.currentSlide - 1);
  if (event.key === "ArrowRight") renderTheorySlide(THEORY_PAGE_STATE.currentSlide + 1);
});

window.addEventListener("resize", updateTheorySlideScale);

function setTheoryEditing(enabled) {
  const wasEditing = THEORY_PAGE_STATE.editing;
  if (!enabled && wasEditing) finishTextEditing({ preserveComponentSelection: false });
  THEORY_PAGE_STATE.editing = Boolean(enabled);
  const deck = $("theoryDeck");
  const shell = document.querySelector(".shell");
  if (shell) shell.classList.toggle("theory-with-panel", THEORY_PAGE_STATE.editing);
  if (typeof applyShellLayout === "function") applyShellLayout();
  if (!deck) return;
  if (THEORY_PAGE_STATE.editing && !wasEditing) {
    THEORY_PAGE_STATE.historyPast = [];
    THEORY_PAGE_STATE.historyFuture = [];
    THEORY_PAGE_STATE.selectedIds = [];
    THEORY_PAGE_STATE.selectedId = null;
  }
  deck.classList.toggle("is-editing", THEORY_PAGE_STATE.editing);
  $("theoryEditorTools").hidden = !THEORY_PAGE_STATE.editing;
  updateTheorySlideScale();
  $("theoryEditBtn").hidden = THEORY_PAGE_STATE.editing;
  $("theoryCancelBtn").hidden = !THEORY_PAGE_STATE.editing;
  $("theorySaveBtn").hidden = !THEORY_PAGE_STATE.editing;
  deck.querySelectorAll(".theory-editable").forEach(node => {
    const component = node.closest(".theory-component");
    const locked = Boolean(component?.classList.contains("is-locked"));
    const isCardComponent = component?.dataset.componentType === "card" || component?.dataset.componentType === "cards";
    node.setAttribute("contenteditable", String(THEORY_PAGE_STATE.editing && !locked && !isCardComponent));
  });
  renderTheoryFormulaPreviews();
  if (!THEORY_PAGE_STATE.editing) clearSelection();
  setTheoryStatus(THEORY_PAGE_STATE.editing ? "编辑模式" : "只读模式");
  updateFontTools();
  updateEditorToolState();
  refreshTheoryRightPanel();
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
}

function markTheoryDirty() {
  if (!THEORY_PAGE_STATE.editing) return;
  THEORY_PAGE_STATE.dirty = true;
  THEORY_PAGE_STATE.editVersion += 1;
  setTheoryStatus("有未同步修改");
  scheduleTheoryAutosave();
}

function clearTheoryAutosave() {
  if (THEORY_PAGE_STATE.saveTimer) {
    window.clearTimeout(THEORY_PAGE_STATE.saveTimer);
    THEORY_PAGE_STATE.saveTimer = null;
  }
}

function scheduleTheoryAutosave() {
  clearTheoryAutosave();
  THEORY_PAGE_STATE.saveTimer = window.setTimeout(() => {
    THEORY_PAGE_STATE.saveTimer = null;
    void flushTheoryAutosave(THEORY_PAGE_STATE.pageId);
  }, THEORY_AUTOSAVE_DELAY_MS);
}

async function flushTheoryAutosave(pageId) {
  if (!THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.dirty || THEORY_PAGE_STATE.saving) return;
  commitDomToState();
  await saveTheoryEdits(pageId, { source: "autosave" });
}

function setTheoryStatus(text) {
  const status = $("theoryDeckStatus");
  if (status) status.textContent = text;
}

function updateEditorToolState() {
  const selectedCount = selectedComponents().length;
  const setDisabled = (selector, disabled) => {
    document.querySelectorAll(selector).forEach(node => {
      node.disabled = disabled;
    });
  };
  setDisabled("#theoryUndoBtn", !THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyPast.length);
  setDisabled("#theoryRedoBtn", !THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyFuture.length);
  setDisabled("#theoryDuplicateBtn, #theoryDeleteComponentBtn", !THEORY_PAGE_STATE.editing);
  const snapBtn = $("theorySnapBtn");
  if (snapBtn) {
    snapBtn.classList.toggle("is-active", THEORY_PAGE_STATE.snapToGrid);
    snapBtn.setAttribute("aria-pressed", String(THEORY_PAGE_STATE.snapToGrid));
  }
  const hint = $("theoryToolHint");
  if (hint && THEORY_PAGE_STATE.editing) {
    hint.textContent = selectedCount ? ("已选择 " + selectedCount + " 个组件") : "请选择组件";
  }
}

function refreshTheoryRightPanel() {
  const panel = $("rightPanel");
  if (!panel) return;
  if (!THEORY_PAGE_STATE.editing) {
    panel.innerHTML = "";
    hideTheoryLayerContextMenu();
    return;
  }
  const slide = THEORY_PAGE_STATE.deck?.slides?.[THEORY_PAGE_STATE.currentSlide];
  const layers = deckComponentLayers(slide);
  if (!layers.length) {
    panel.innerHTML = `
      <section class="content-card theory-layer-panel">
        <div class="theory-layer-panel-head">
          <div>
            <div class="eyebrow">图层</div>
            <h3>当前没有可显示的图层</h3>
          </div>
        </div>
      </section>`;
    return;
  }
  const selectedIds = new Set(THEORY_PAGE_STATE.selectedIds);
  const selectedComponentEl = selectedComponents()[selectedComponents().length - 1] || null;
  const selectedComponent = selectedComponentEl ? findComponentById(selectedComponentEl.dataset.componentId) : null;
  const cardPanel = renderCardStylePanel(selectedComponent, selectedComponentEl);
  panel.innerHTML = `${cardPanel}
    <section class="content-card theory-layer-panel" data-theory-layer-panel>
      <div class="theory-layer-panel-head">
        <div>
          <div class="eyebrow">图层</div>
          <h3>当前页图层</h3>
        </div>
        <div class="theory-layer-panel-subtitle">从上到下对应画布中的层级</div>
      </div>
      <div class="theory-layer-panel-actions">
        <button type="button" data-layer-action="front">置顶</button>
        <button type="button" data-layer-action="forward">上移</button>
        <button type="button" data-layer-action="backward">下移</button>
        <button type="button" data-layer-action="back">置底</button>
        <button type="button" data-layer-action="lock-toggle">锁定/解锁</button>
        <button type="button" data-layer-action="visible-toggle">显示/隐藏</button>
      </div>
      <div class="theory-layer-list" data-layer-list>
        ${layers.map(component => {
          const isSelected = selectedIds.has(component.id);
          const isLocked = Boolean(component.locked);
          const isVisible = component.visible !== false;
          return `
            <div class="theory-layer-row${isSelected ? " is-selected" : ""}${isLocked ? " is-locked" : ""}${isVisible ? "" : " is-hidden"}" data-layer-component-id="${escapeHtml(component.id)}" draggable="true" role="button" tabindex="0" aria-pressed="${String(isSelected)}">
              <button type="button" class="theory-layer-main" data-layer-select>
                <span class="theory-layer-icon" aria-hidden="true">${escapeHtml(layerIconForType(component.type))}</span>
                <span class="theory-layer-name">${escapeHtml(component.layerName || layerLabelForType(component.type || "p"))}</span>
                <span class="theory-layer-meta">${escapeHtml(layerLabelForType(component.type || "p"))}</span>
              </button>
              <div class="theory-layer-row-actions">
                <button type="button" data-layer-visible title="${isVisible ? "隐藏组件" : "显示组件"}">${isVisible ? "👁" : "◻"}</button>
                <button type="button" data-layer-locked title="${isLocked ? "解锁组件" : "锁定组件"}">${isLocked ? "🔒" : "🔓"}</button>
                <button type="button" data-layer-more title="更多操作">⋯</button>
              </div>
            </div>`;
        }).join("")}
      </div>
    </section>`;
  bindCardStylePanel(panel);
  bindTheoryLayerPanel(panel);
}

function layerIconForType(type) {
  const icons = {
    p: "T",
    h1: "H",
    h2: "H2",
    eyebrow: "T",
    formula: "∑",
    image: "▣",
    chart: "⟡",
    table: "▦",
    cards: "▤",
    bullets: "•",
    callout: "!",
    visual: "◧",
  };
  return icons[type] || "•";
}

function bindTheoryLayerPanel(panel) {
  panel.querySelectorAll("[data-layer-select]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const row = button.closest("[data-layer-component-id]");
      if (row) selectTheoryComponentById(row.dataset.layerComponentId);
    });
  });
  panel.querySelectorAll("[data-layer-visible]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      toggleTheoryComponentVisible(button.closest("[data-layer-component-id]")?.dataset.layerComponentId);
    });
  });
  panel.querySelectorAll("[data-layer-locked]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      toggleTheoryComponentLocked(button.closest("[data-layer-component-id]")?.dataset.layerComponentId);
    });
  });
  panel.querySelectorAll("[data-layer-more]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const componentId = button.closest("[data-layer-component-id]")?.dataset.layerComponentId;
      const component = componentId ? findComponentById(componentId) : null;
      if (!component) return;
      const rect = button.getBoundingClientRect();
      openTheoryLayerContextMenu(component, rect.right, rect.bottom + 6);
    });
  });
  panel.querySelectorAll("[data-layer-component-id]").forEach(row => {
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      selectTheoryComponentById(row.dataset.layerComponentId);
    });
    row.addEventListener("dblclick", event => {
      if (event.target.closest("[data-layer-visible], [data-layer-locked], [data-layer-more]")) return;
      renameTheoryLayer(row.dataset.layerComponentId);
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTheoryComponentById(row.dataset.layerComponentId);
      }
    });
    row.addEventListener("dragstart", event => {
      THEORY_PAGE_STATE.layerPanelDragId = row.dataset.layerComponentId;
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      try { event.dataTransfer.setData("text/plain", row.dataset.layerComponentId); } catch (err) {}
    });
    row.addEventListener("dragover", event => {
      if (!THEORY_PAGE_STATE.layerPanelDragId) return;
      event.preventDefault();
      row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
    row.addEventListener("drop", event => {
      event.preventDefault();
      const draggedId = THEORY_PAGE_STATE.layerPanelDragId || event.dataTransfer.getData("text/plain");
      row.classList.remove("is-drop-target");
      if (!draggedId || draggedId === row.dataset.layerComponentId) return;
      reorderTheoryLayerByDrop(draggedId, row.dataset.layerComponentId, event.offsetY < row.clientHeight / 2 ? "before" : "after");
    });
    row.addEventListener("dragend", () => {
      THEORY_PAGE_STATE.layerPanelDragId = null;
      panel.querySelectorAll(".is-dragging, .is-drop-target").forEach(node => node.classList.remove("is-dragging", "is-drop-target"));
    });
  });
  panel.querySelectorAll("[data-layer-action]").forEach(button => {
    button.addEventListener("click", () => applyTheoryLayerAction(button.dataset.layerAction));
  });
}

function bindCardStylePanel(panel) {
  const cardPanel = panel.querySelector("[data-card-style-panel]");
  if (!cardPanel) return;
  cardPanel.querySelectorAll("[data-card-color]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      if (button.disabled) return;
      const componentId = cardPanel.dataset.cardComponentId || "";
      const itemId = cardPanel.dataset.cardItemId || "";
      const color = button.dataset.cardColor || "";
      applyCardBackgroundColor(componentId, itemId, color);
    });
  });
}

function selectTheoryComponentById(componentId) {
  if (!componentId) return;
  const component = document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(componentId)}"]`)
    || document.querySelector(`[data-component-id="${cssEscape(componentId)}"]`);
  if (component) selectTheoryComponent(component);
}

function applyTheoryLayerAction(action, componentIds = selectedComponents().map(component => component.dataset.componentId)) {
  if (!THEORY_PAGE_STATE.editing) return;
  const slide = THEORY_PAGE_STATE.deck?.slides?.[THEORY_PAGE_STATE.currentSlide];
  if (!slide || !componentIds.length) {
    setTheoryStatus("请先选择图层");
    return;
  }
  pushDeckHistory("layer-" + action);
  const components = componentIds
    .map(id => document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(id)}"]`))
    .filter(Boolean);
  const sorted = [...components].sort((a, b) => parseLayerZIndex(a, 1) - parseLayerZIndex(b, 1));
  const layerNodes = Array.from(slide.components || [])
    .map(component => document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(component.id)}"]`))
    .filter(Boolean)
    .sort((a, b) => parseLayerZIndex(a, 1) - parseLayerZIndex(b, 1));
  const currentLayers = layerNodes.map(node => ({ node, z: parseLayerZIndex(node, 1) }));
  const layerValues = currentLayers.map(item => item.z);
  const maxZ = layerValues.length ? Math.max(...layerValues) : 1;
  const minZ = layerValues.length ? Math.min(...layerValues) : 1;
  if (action === "front") {
    let nextZ = maxZ + 1;
    sorted.forEach(node => {
      node.style.zIndex = String(nextZ);
      nextZ += 1;
    });
  } else if (action === "back") {
    let nextZ = minZ - sorted.length;
    sorted.forEach(node => {
      node.style.zIndex = String(nextZ);
      nextZ += 1;
    });
  } else if (action === "forward" || action === "backward") {
    sorted.forEach(node => moveTheoryLayerOneStep(node, action === "forward" ? 1 : -1, currentLayers.map(item => item.node)));
  } else if (action === "lock-toggle") {
    sorted.forEach(node => toggleTheoryComponentLocked(node.dataset.componentId));
    return;
  } else if (action === "visible-toggle") {
    sorted.forEach(node => toggleTheoryComponentVisible(node.dataset.componentId));
    return;
  }
  commitDomToState();
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function moveTheoryLayerOneStep(node, step, allLayerNodes = []) {
  const current = parseLayerZIndex(node, 1);
  const others = allLayerNodes.filter(item => item !== node).map(item => ({ item, z: parseLayerZIndex(item, 1) })).sort((a, b) => a.z - b.z);
  const neighbor = step > 0
    ? others.find(item => item.z > current)
    : [...others].reverse().find(item => item.z < current);
  if (!neighbor) {
    node.style.zIndex = String(current + step);
    return;
  }
  const neighborZ = neighbor.z;
  neighbor.item.style.zIndex = String(current);
  node.style.zIndex = String(neighborZ);
}

function toggleTheoryComponentLocked(componentId) {
  const component = componentId ? document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(componentId)}"]`) : null;
  if (!component) return;
  const locked = !component.classList.contains("is-locked");
  component.classList.toggle("is-locked", locked);
  component.dataset.layerLocked = String(locked);
  syncTheoryComponentEditableState(component);
  commitDomToState();
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function toggleTheoryComponentVisible(componentId) {
  const component = componentId ? document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(componentId)}"]`) : null;
  if (!component) return;
  const nextVisible = component.classList.contains("is-hidden");
  component.classList.toggle("is-hidden", !nextVisible);
  component.dataset.layerVisible = String(nextVisible);
  commitDomToState();
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function renameTheoryLayer(componentId) {
  const component = componentId ? findComponentById(componentId) : null;
  if (!component) return;
  const nextName = window.prompt("输入图层名称", component.layerName || layerLabelForType(component.type || "p"));
  if (nextName === null) return;
  const name = String(nextName).trim();
  if (!name) return;
  const node = document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(componentId)}"]`);
  if (node) node.dataset.layerName = name;
  component.layerName = name;
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function reorderTheoryLayerByDrop(draggedId, targetId, position = "before") {
  const panel = $("rightPanel");
  if (!panel) return;
  const list = panel.querySelector("[data-layer-list]");
  const dragged = panel.querySelector(`[data-layer-component-id="${cssEscape(draggedId)}"]`);
  const target = panel.querySelector(`[data-layer-component-id="${cssEscape(targetId)}"]`);
  if (!list || !dragged || !target) return;
  if (position === "before") list.insertBefore(dragged, target);
  else list.insertBefore(dragged, target.nextSibling);
  applyLayerOrderFromPanel();
}

function applyLayerOrderFromPanel() {
  const panel = $("rightPanel");
  const slide = THEORY_PAGE_STATE.deck?.slides?.[THEORY_PAGE_STATE.currentSlide];
  if (!panel || !slide) return;
  const rows = Array.from(panel.querySelectorAll("[data-layer-component-id]"));
  const maxZ = rows.length + 10;
  rows.forEach((row, index) => {
    const component = document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(row.dataset.layerComponentId)}"]`);
    if (!component) return;
    component.style.zIndex = String(maxZ - index);
  });
  commitDomToState();
  markTheoryDirty();
  refreshTheoryRightPanel();
}

function syncTheoryComponentEditableState(component) {
  const locked = component.classList.contains("is-locked");
  component.querySelectorAll(".theory-editable").forEach(node => {
    const isCardComponent = component.dataset.componentType === "card" || component.dataset.componentType === "cards";
    node.setAttribute("contenteditable", String(THEORY_PAGE_STATE.editing && !locked && !isCardComponent));
  });
  component.querySelectorAll(".theory-table-cell").forEach(node => {
    node.setAttribute("contenteditable", "false");
    node.classList.remove("is-editing");
  });
  const formulaEditor = THEORY_PAGE_STATE.formulaEditor;
  if (formulaEditor?.componentId === component.dataset.componentId && locked) {
    closeTheoryFormulaEditor({ save: true });
  }
}

function openTheoryLayerContextMenu(component, x, y) {
  if (!THEORY_PAGE_STATE.editing || !component) return;
  hideTheoryLayerContextMenu();
  const menu = document.createElement("div");
  menu.className = "theory-layer-context-menu";
  menu.innerHTML = `
    <button type="button" data-layer-menu-action="front">置于顶层</button>
    <button type="button" data-layer-menu-action="forward">上移一层</button>
    <button type="button" data-layer-menu-action="backward">下移一层</button>
    <button type="button" data-layer-menu-action="back">置于底层</button>
    <button type="button" data-layer-menu-action="lock-toggle">锁定/解锁</button>
    <button type="button" data-layer-menu-action="rename">重命名</button>
    <button type="button" data-layer-menu-action="delete">删除</button>
  `;
  menu.style.left = Math.max(12, Math.min(window.innerWidth - 220, x)) + "px";
  menu.style.top = Math.max(12, Math.min(window.innerHeight - 280, y)) + "px";
  menu.dataset.componentId = component.dataset.componentId;
  document.body.appendChild(menu);
  THEORY_PAGE_STATE.componentContextMenu = menu;
  menu.querySelectorAll("[data-layer-menu-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.layerMenuAction;
      hideTheoryLayerContextMenu();
      if (action === "rename") renameTheoryLayer(component.dataset.componentId);
      else if (action === "delete") deleteSelectedComponentsById([component.dataset.componentId]);
      else if (action === "visible-toggle") return;
      else applyTheoryLayerAction(action, [component.dataset.componentId]);
    });
  });
  window.addEventListener("pointerdown", onTheoryLayerMenuOutsideClick, { once: true, capture: true });
  window.addEventListener("keydown", onTheoryLayerMenuEscape, { once: true });
}

function hideTheoryLayerContextMenu() {
  const menu = THEORY_PAGE_STATE.componentContextMenu;
  if (menu?.isConnected) menu.remove();
  THEORY_PAGE_STATE.componentContextMenu = null;
}

function onTheoryLayerMenuOutsideClick(event) {
  if (event.target.closest?.(".theory-layer-context-menu")) return;
  hideTheoryLayerContextMenu();
}

function onTheoryLayerMenuEscape(event) {
  if (event.key === "Escape") hideTheoryLayerContextMenu();
}

function pushDeckHistory(reason = "edit") {
  if (!THEORY_PAGE_STATE.editing || THEORY_PAGE_STATE.historyLocked) return;
  commitDomToState();
  THEORY_PAGE_STATE.historyPast.push(clone(THEORY_PAGE_STATE.deck));
  if (THEORY_PAGE_STATE.historyPast.length > THEORY_HISTORY_LIMIT) THEORY_PAGE_STATE.historyPast.shift();
  THEORY_PAGE_STATE.historyFuture = [];
  updateEditorToolState();
}

function undoDeckChange() {
  if (!THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyPast.length) return;
  commitDomToState();
  const previous = THEORY_PAGE_STATE.historyPast.pop();
  THEORY_PAGE_STATE.historyFuture.push(clone(THEORY_PAGE_STATE.deck));
  THEORY_PAGE_STATE.historyLocked = true;
  THEORY_PAGE_STATE.deck = previous;
  THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  THEORY_PAGE_STATE.historyLocked = false;
  markTheoryDirty();
  updateEditorToolState();
}

function redoDeckChange() {
  if (!THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyFuture.length) return;
  commitDomToState();
  const next = THEORY_PAGE_STATE.historyFuture.pop();
  THEORY_PAGE_STATE.historyPast.push(clone(THEORY_PAGE_STATE.deck));
  THEORY_PAGE_STATE.historyLocked = true;
  THEORY_PAGE_STATE.deck = next;
  THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  THEORY_PAGE_STATE.historyLocked = false;
  markTheoryDirty();
  updateEditorToolState();
}

function playTheoryModeTransition(mode) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.classList.remove("mode-shift-editing", "mode-shift-readonly");
  void deck.offsetWidth;
  deck.classList.add(mode === "editing" ? "mode-shift-editing" : "mode-shift-readonly");
  window.setTimeout(() => deck.classList.remove("mode-shift-editing", "mode-shift-readonly"), 360);
}

function addTheorySlide() {
  finishTextEditing();
  pushDeckHistory("add-slide");
  commitDomToState();
  const newSlide = {
    id: uid("slide"),
    layout: "default",
    components: [
      makeDeckSection("新增页面"),
      makeDeckText("点击编辑文字，也可以插入更多组件并拖动排版。")
    ]
  };
  THEORY_PAGE_STATE.deck.slides.splice(THEORY_PAGE_STATE.currentSlide + 1, 0, newSlide);
  THEORY_PAGE_STATE.currentSlide += 1;
  refreshDeckDom(true);
  markTheoryDirty();
}

function deleteTheorySlide() {
  finishTextEditing();
  commitDomToState();
  if (THEORY_PAGE_STATE.deck.slides.length <= 1) return;
  pushDeckHistory("delete-slide");
  THEORY_PAGE_STATE.deck.slides.splice(THEORY_PAGE_STATE.currentSlide, 1);
  THEORY_PAGE_STATE.currentSlide = Math.max(0, THEORY_PAGE_STATE.currentSlide - 1);
  refreshDeckDom(true);
  markTheoryDirty();
}

function deleteSelectedComponents() {
  if (!THEORY_PAGE_STATE.editing) return false;
  const componentIds = selectedComponents().map(component => component.dataset.componentId);
  if (!componentIds.length) {
    setTheoryStatus("请先选择要删除的组件");
    return false;
  }
  return deleteSelectedComponentsById(componentIds);
}

function deleteSelectedComponentsById(componentIds) {
  if (!THEORY_PAGE_STATE.editing || !componentIds?.length) return false;
  finishTextEditing();
  pushDeckHistory("delete-components");
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return false;
  const before = slide.components.length;
  slide.components = slide.components.filter(item => !componentIds.includes(item.id));
  if (slide.components.length === before) return false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  markTheoryDirty();
  setTheoryStatus("已删除组件，记得保存修改");
  return true;
}

function insertTheoryComponent(type) {
  finishTextEditing();
  pushDeckHistory("insert-component");
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return;
  const position = defaultInsertPosition();
  const component = newInsertedComponent(type, position);
  applyTheoryLayerDefaultsForSlide(slide, component);
  slide.components.push(component);
  refreshDeckDom(true);
  selectTheoryComponent(document.querySelector("[data-component-id=\"" + cssEscape(component.id) + "\"]"));
  markTheoryDirty();
}

function duplicateSelectedComponents() {
  const ids = THEORY_PAGE_STATE.selectedIds.filter(Boolean);
  if (!THEORY_PAGE_STATE.editing) return;
  if (!ids.length) {
    setTheoryStatus("请先选择要复制的组件");
    return;
  }
  finishTextEditing();
  pushDeckHistory("duplicate");
  selectedComponents().forEach(component => ensureFreePositioned(component, component.closest(".theory-slide")));
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return;
  const newIds = [];
  ids.forEach(id => {
    const source = slide.components.find(component => component.id === id);
    if (!source) return;
    const copy = cloneComponentWithNewIds(source);
    copy.position = offsetPosition(copy.position || defaultInsertPosition(), 72, 48);
    applyTheoryLayerDefaultsForSlide(slide, copy);
    slide.components.push(copy);
    newIds.push(copy.id);
  });
  THEORY_PAGE_STATE.selectedIds = newIds;
  refreshDeckDom(true);
  markTheoryDirty();
}

function cloneComponentWithNewIds(component) {
  const copy = clone(component);
  copy.id = uid(copy.type || "component");
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map(item => ({ ...item, id: uid("item") }));
  }
  return copy;
}

function offsetPosition(position, dx, dy) {
  return {
    ...position,
    left: (parsePx(position.left) + dx) + "px",
    top: (parsePx(position.top) + dy) + "px",
  };
}

function changeLayerSelected(action) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (!components.length) {
    setTheoryStatus("请先选择要调整图层的组件");
    return;
  }
  pushDeckHistory("layer-" + action);
  const all = Array.from(document.querySelectorAll(".theory-slide.active > .theory-component"));
  const zValues = all.map(node => parseInt(node.style.zIndex || "1", 10)).filter(Number.isFinite);
  const maxZ = Math.max(1, ...zValues);
  const minZ = Math.min(1, ...zValues);
  components.forEach(component => {
    ensureFreePositioned(component, component.closest(".theory-slide"));
    const current = parseInt(component.style.zIndex || "1", 10) || 1;
    if (action === "front") component.style.zIndex = String(maxZ + 10);
    if (action === "back") component.style.zIndex = String(Math.max(1, minZ - 1));
    if (action === "forward") component.style.zIndex = String(current + 1);
    if (action === "backward") component.style.zIndex = String(Math.max(1, current - 1));
  });
  commitDomToState();
  markTheoryDirty();
}

function alignSelectedComponents(mode) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (components.length < 2) {
    setTheoryStatus("请选择至少 2 个组件再对齐");
    return;
  }
  pushDeckHistory("align-" + mode);
  const slide = document.querySelector(".theory-slide.active");
  components.forEach(component => ensureFreePositioned(component, slide));
  const rects = components.map(component => componentBox(component));
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.left + rect.width));
  const top = Math.min(...rects.map(rect => rect.top));
  const bottom = Math.max(...rects.map(rect => rect.top + rect.height));
  const hCenter = left + (right - left) / 2;
  const vCenter = top + (bottom - top) / 2;
  components.forEach(component => {
    const box = componentBox(component);
    if (mode === "left") component.style.left = snapValue(left) + "px";
    if (mode === "hcenter") component.style.left = snapValue(hCenter - box.width / 2) + "px";
    if (mode === "right") component.style.left = snapValue(right - box.width) + "px";
    if (mode === "top") component.style.top = snapValue(top) + "px";
    if (mode === "vcenter") component.style.top = snapValue(vCenter - box.height / 2) + "px";
    if (mode === "bottom") component.style.top = snapValue(bottom - box.height) + "px";
  });
  commitDomToState();
  markTheoryDirty();
}

function distributeSelectedComponents(axis) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (components.length < 3) {
    setTheoryStatus("请选择至少 3 个组件再分布");
    return;
  }
  pushDeckHistory("distribute-" + axis);
  const slide = document.querySelector(".theory-slide.active");
  components.forEach(component => ensureFreePositioned(component, slide));
  const sorted = components
    .map(component => ({ component, box: componentBox(component) }))
    .sort((a, b) => axis === "x" ? a.box.left - b.box.left : a.box.top - b.box.top);
  const first = sorted[0].box;
  const last = sorted[sorted.length - 1].box;
  if (axis === "x") {
    const start = first.left + first.width / 2;
    const end = last.left + last.width / 2;
    const step = (end - start) / (sorted.length - 1);
    sorted.forEach((entry, index) => {
      entry.component.style.left = snapValue(start + step * index - entry.box.width / 2) + "px";
    });
  } else {
    const start = first.top + first.height / 2;
    const end = last.top + last.height / 2;
    const step = (end - start) / (sorted.length - 1);
    sorted.forEach((entry, index) => {
      entry.component.style.top = snapValue(start + step * index - entry.box.height / 2) + "px";
    });
  }
  commitDomToState();
  markTheoryDirty();
}

function componentBox(component) {
  return {
    left: parsePx(component.style.left),
    top: parsePx(component.style.top),
    width: component.offsetWidth,
    height: component.offsetHeight,
  };
}

function parsePx(value) {
  const parsed = parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toggleSnapToGrid() {
  if (!THEORY_PAGE_STATE.editing) return;
  THEORY_PAGE_STATE.snapToGrid = !THEORY_PAGE_STATE.snapToGrid;
  updateEditorToolState();
  setTheoryStatus(THEORY_PAGE_STATE.snapToGrid ? "网格吸附已开启" : "网格吸附已关闭");
}

function insertImageComponent(file) {
  if (!THEORY_PAGE_STATE.editing || !file?.type?.startsWith("image/")) return;
  finishTextEditing();
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result || "");
    loadImageNaturalSize(src).then(size => {
      pushDeckHistory("insert-image");
      commitDomToState();
      const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
      if (!slide) return;
      const position = defaultImageInsertPosition(size.width, size.height);
      const component = makeComponent("image", {
        src,
        alt: "课件图片",
        caption: "",
        imageStyle: "clean",
        objectFit: "contain",
        position,
      });
      applyTheoryLayerDefaultsForSlide(slide, component);
      slide.components.push(component);
      THEORY_PAGE_STATE.selectedIds = [component.id];
      refreshDeckDom(true);
      markTheoryDirty();
    });
  };
  reader.onerror = () => setTheoryStatus("图片读取失败");
  reader.readAsDataURL(file);
}

function replaceImageComponent(componentId, file) {
  if (!THEORY_PAGE_STATE.editing || !componentId || !file?.type?.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    pushDeckHistory("replace-image");
    commitDomToState();
    const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
    const component = slide?.components?.find(item => item.id === componentId && item.type === "image");
    if (!component) return;
    component.src = String(reader.result || "");
    component.alt = "课件图片";
    component.imageStyle = normalizeImageStyle(component.imageStyle);
    component.objectFit = normalizeImageObjectFit(component.objectFit);
    component.caption = String(component.caption || "");
    THEORY_PAGE_STATE.selectedIds = [component.id];
    refreshDeckDom(true);
    markTheoryDirty();
  };
  reader.onerror = () => setTheoryStatus("图片读取失败");
  reader.readAsDataURL(file);
}

function loadImageNaturalSize(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 360, height: image.naturalHeight || 220 });
    image.onerror = () => resolve({ width: 360, height: 220 });
    image.src = src;
  });
}

function defaultImageInsertPosition(naturalWidth = 360, naturalHeight = 220) {
  const slideEl = document.querySelector(".theory-slide.active");
  const slideWidth = slideEl?.clientWidth || THEORY_SLIDE_WIDTH;
  const slideHeight = slideEl?.clientHeight || Math.round(THEORY_SLIDE_WIDTH * 9 / 16);
  const maxWidth = Math.round(slideWidth * 0.35);
  const maxHeight = Math.round(slideHeight * 0.45);
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1.6;
  let width;
  let height;
  if (ratio >= 1) {
    width = Math.min(360, maxWidth);
    height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
  } else {
    height = Math.min(260, maxHeight);
    width = height * ratio;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }
  }
  width = Math.max(120, Math.round(width));
  height = Math.max(80, Math.round(height));
  const preferredLeft = Math.round(slideWidth * 0.58);
  const left = Math.min(Math.max(32, preferredLeft), Math.max(32, slideWidth - width - 40));
  const top = Math.min(Math.max(126, Math.round((slideHeight - height) / 2)), Math.max(126, slideHeight - height - 36));
  return {
    left: left + "px",
    top: top + "px",
    width: width + "px",
    height: height + "px",
    zIndex: nextZIndex()
  };
}

function newInsertedComponent(type, position) {
  if (type === "title") {
    const slide = document.querySelector(".theory-slide.active");
    const titlePosition = {
      ...position,
      left: slide ? Math.max(24, (slide.clientWidth - 460) / 2) + "px" : position.left,
      top: position.top || "72px",
      width: "460px",
      height: "92px",
    };
    const component = makeDeckTitle("新标题");
    component.position = titlePosition;
    return component;
  }
  if (type === "card") {
    return makeComponent("cards", { position, items: [{ id: uid("card"), title: "新卡片", body: "填写卡片说明。", style: {} }] });
  }
  if (type === "bullets") {
    return makeComponent("bullets", { position, items: [{ id: uid("item"), text: "新要点", style: {} }, { id: uid("item"), text: "补充说明", style: {} }] });
  }
  if (type === "callout") return makeComponent("callout", { text: "新的补充说明。", position });
  if (type === "formula") {
    const formulaPosition = {
      ...position,
      width: position?.width || "320px",
      height: position?.height || "96px",
    };
    return makeComponent("formula", {
      text: THEORY_DEFAULT_FORMULA,
      position: formulaPosition,
      style: {
        fontSize: "24px",
        lineHeight: "1.15",
        color: "#0f172a",
        textAlign: "center",
      }
    });
  }
  if (type === "table") {
    const slide = document.querySelector(".theory-slide.active");
    const width = 520;
    const height = 220;
    const tablePosition = {
      ...position,
      left: slide ? Math.max(24, (slide.clientWidth - width) / 2) + "px" : position.left,
      top: slide ? Math.max(110, (slide.clientHeight - height) / 2) + "px" : position.top,
      width: width + "px",
      height: height + "px",
    };
    return makeComponent("table", {
      position: tablePosition,
      tableData: defaultTableData(),
      tableStyle: defaultTableStyle(),
    });
  }
  return makeComponent("p", { text: "新的文本框", position });
}

function defaultInsertPosition() {
  const slide = document.querySelector(".theory-slide.active");
  const width = 320;
  if (!slide) return { left: "120px", top: "120px", width: width + "px", zIndex: nextZIndex() };
  return {
    left: Math.max(24, (slide.clientWidth - width) / 2) + "px",
    top: Math.max(24, slide.clientHeight * 0.22) + "px",
    width: width + "px",
    zIndex: nextZIndex()
  };
}

function nextLayerZIndex(slide = document.querySelector(".theory-slide.active")) {
  const components = typeof slide?.querySelectorAll === "function"
    ? Array.from(slide.querySelectorAll(":scope > .theory-component"))
    : Array.isArray(slide?.components)
      ? slide.components
      : [];
  const values = components
    .map(item => parseLayerZIndex(item, 1))
    .filter(Number.isFinite);
  return (values.length ? Math.max(...values) : 0) + 1;
}

function nextLayerNameForType(slide, type) {
  const count = (slide?.components || []).filter(component => (component.type || "p") === type).length + 1;
  return `${layerLabelForType(type)} ${count}`;
}

function applyTheoryLayerDefaultsForSlide(slide, component) {
  component.zIndex = nextLayerZIndex(slide);
  if (component.position) component.position.zIndex = String(component.zIndex);
  component.layerName = nextLayerNameForType(slide, component.type || "p");
  component.locked = Boolean(component.locked);
  component.visible = component.visible !== false;
  return component;
}

function nextZIndex() {
  return String(nextLayerZIndex());
}

function snapValue(value) {
  if (!THEORY_PAGE_STATE.snapToGrid) return Math.round(value);
  return Math.round(value / THEORY_GRID_SIZE) * THEORY_GRID_SIZE;
}

function refreshDeckDom(keepEditing) {
  const viewport = $("theorySlideViewport");
  if (!viewport) return;
  closeTheoryFormulaEditor({ save: true });
  disposeTheoryCharts();
  viewport.innerHTML = THEORY_PAGE_STATE.deck.slides.map((slide, index) => renderTheorySlideMarkup(slide, index)).join("");
  updateTheorySlideScale();
  bindEditableEvents(THEORY_PAGE_STATE.pageId);
  bindTheoryDragAndDrop(THEORY_PAGE_STATE.pageId);
  setTheoryEditing(keepEditing);
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
  restoreSelection();
  refreshTheoryRightPanel();
  queueTheoryChartRender();
}

function disposeTheoryCharts() {
  const runtimes = THEORY_PAGE_STATE.chartRuntime || {};
  Object.values(runtimes).forEach(runtime => {
    try {
      runtime?.instance?.dispose?.();
    } catch (err) {}
  });
  THEORY_PAGE_STATE.chartRuntime = {};
}

function queueTheoryChartRender(options = {}) {
  window.requestAnimationFrame(() => {
    renderTheoryCharts(options);
  });
}

function renderTheoryCharts(options = {}) {
  if (typeof echarts === "undefined") return;
  const runtimes = THEORY_PAGE_STATE.chartRuntime || {};
  document.querySelectorAll(".theory-chart-canvas").forEach(node => {
    const componentId = node.dataset.chartId;
    const component = findComponentById(componentId);
    if (!component) return;
    const existing = runtimes[componentId];
    let instance = existing?.instance || null;
    if (!instance) {
      instance = echarts.init(node, null, { renderer: "canvas" });
    } else if (instance.getDom() !== node) {
      try {
        instance.dispose();
      } catch (err) {}
      instance = echarts.init(node, null, { renderer: "canvas" });
    }
    const option = resolveTheoryChartOption(component, options);
    instance.setOption(option, true);
    instance.resize();
    runtimes[componentId] = { instance };
  });
  THEORY_PAGE_STATE.chartRuntime = runtimes;
}

function waitForTheoryCharts() {
  return new Promise(resolve => {
    window.setTimeout(resolve, 120);
  });
}

function restoreSelection() {
  const ids = [...THEORY_PAGE_STATE.selectedIds];
  THEORY_PAGE_STATE.selectedIds = [];
  ids.forEach(id => {
    const component = document.querySelector(".theory-slide.active [data-component-id=\"" + cssEscape(id) + "\"]");
    if (!component) return;
    component.classList.add("is-selected");
    if (!THEORY_PAGE_STATE.selectedIds.includes(id)) THEORY_PAGE_STATE.selectedIds.push(id);
  });
  updateFontTools();
  updateEditorToolState();
}

function selectTheoryComponent(component, editable = null, append = false) {
  if (!THEORY_PAGE_STATE.editing || !component) return;
  const componentId = component.dataset.componentId;
  if (!append) clearSelection();
  if (append && THEORY_PAGE_STATE.selectedIds.includes(componentId)) {
    component.classList.remove("is-selected");
    component.querySelectorAll(".theory-editable.is-selected").forEach(node => node.classList.remove("is-selected"));
    THEORY_PAGE_STATE.selectedIds = THEORY_PAGE_STATE.selectedIds.filter(id => id !== componentId);
    THEORY_PAGE_STATE.selectedId = THEORY_PAGE_STATE.selectedIds[THEORY_PAGE_STATE.selectedIds.length - 1] || null;
    updateFontTools();
    updateEditorToolState();
    return;
  }
  component.classList.add("is-selected");
  const isCardComponent = component.dataset.componentType === "card" || component.dataset.componentType === "cards";
  const target = editable || (!isCardComponent ? component.querySelector(".theory-editable") : null);
  if (target) target.classList.add("is-selected");
  if (!THEORY_PAGE_STATE.selectedIds.includes(componentId)) THEORY_PAGE_STATE.selectedIds.push(componentId);
  THEORY_PAGE_STATE.selectedId = target?.dataset.editId || componentId;
  updateFontTools();
  updateEditorToolState();
  refreshTheoryRightPanel();
}

function clearSelection() {
  finishTableCellEditing();
  document.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  updateEditorToolState();
  refreshTheoryRightPanel();
}

function selectedComponents() {
  if (!THEORY_PAGE_STATE.editing) return [];
  return THEORY_PAGE_STATE.selectedIds
    .map(id => document.querySelector(".theory-slide.active [data-component-id=\"" + cssEscape(id) + "\"]"))
    .filter(Boolean);
}

function selectedEditables() {
  const components = selectedComponents();
  if (components.length > 1) return components.flatMap(component => Array.from(component.querySelectorAll(".theory-editable")));
  const selectedEditable = document.querySelector(".theory-slide.active .theory-editable.is-selected");
  if (selectedEditable) return [selectedEditable];
  return components.flatMap(component => Array.from(component.querySelectorAll(".theory-editable")));
}

function bindFontTools() {
  $("theoryFontFamily")?.addEventListener("change", event => applyTextStyle("fontFamily", event.target.value));
  $("theoryFontSize")?.addEventListener("change", event => applyTextStyle("fontSize", event.target.value));
  
  const boldBtn = $("theoryBoldBtn");
  if (boldBtn) {
    boldBtn.addEventListener("mousedown", event => {
      event.preventDefault(); // Keep focus and selection on the editing contenteditable
    });
    boldBtn.addEventListener("click", () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
    if (isCardComponent) component.querySelectorAll(".theory-editable.is-selected").forEach(node => node.classList.remove("is-selected"));
        const range = selection.getRangeAt(0);
        const activeEl = document.querySelector(".theory-slide.active .theory-editable[data-inline-math-editing='true']") || document.activeElement;
        if (activeEl && activeEl.classList.contains("theory-editable") && activeEl.getAttribute("contenteditable") === "true") {
          if (activeEl.contains(range.startContainer) && activeEl.contains(range.endContainer) && range.toString().trim() !== "") {
            pushDeckHistory("text-bold-part");
            toggleSelectedTextBold(selection, range, activeEl);
            return;
          }
        }
      }
      toggleTextStyle("fontWeight", "700", "");
    });
  }

  const italicBtn = $("theoryItalicBtn");
  if (italicBtn) {
    italicBtn.addEventListener("mousedown", event => {
      event.preventDefault(); // Keep focus and selection on the editing contenteditable
    });
    italicBtn.addEventListener("click", () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const activeEl = document.querySelector(".theory-slide.active .theory-editable[data-inline-math-editing='true']") || document.activeElement;
        if (activeEl && activeEl.classList.contains("theory-editable") && activeEl.getAttribute("contenteditable") === "true") {
          if (activeEl.contains(range.startContainer) && activeEl.contains(range.endContainer) && range.toString().trim() !== "") {
            pushDeckHistory("text-italic-part");
            toggleSelectedTextItalic(selection, range, activeEl);
            return;
          }
        }
      }
      toggleTextStyle("fontStyle", "italic", "");
    });
  }

  $("theoryColorInput")?.addEventListener("input", event => applyTextStyle("color", event.target.value));
  $("theoryAlignSelect")?.addEventListener("change", event => applyTextStyle("textAlign", event.target.value));
  updateFontTools();
}

function toggleSelectedTextBold(selection, range, activeEl) {
  const selectedText = range.toString();
  let replacement = "";
  if (selectedText.startsWith("**") && selectedText.endsWith("**")) {
    replacement = selectedText.slice(2, -2);
  } else {
    replacement = `**${selectedText}**`;
  }
  range.deleteContents();
  const textNode = document.createTextNode(replacement);
  range.insertNode(textNode);
  
  const newRange = document.createRange();
  newRange.setStart(textNode, 0);
  newRange.setEnd(textNode, textNode.length);
  selection.removeAllRanges();
  selection.addRange(newRange);

  syncInlineMathRawText(activeEl);
  markTheoryDirty();
  commitDomToState();
}

function toggleSelectedTextItalic(selection, range, activeEl) {
  const selectedText = range.toString();
  let replacement = "";
  if (selectedText.startsWith("*") && selectedText.endsWith("*") && !selectedText.startsWith("**")) {
    replacement = selectedText.slice(1, -1);
  } else {
    replacement = `*${selectedText}*`;
  }
  range.deleteContents();
  const textNode = document.createTextNode(replacement);
  range.insertNode(textNode);
  
  const newRange = document.createRange();
  newRange.setStart(textNode, 0);
  newRange.setEnd(textNode, textNode.length);
  selection.removeAllRanges();
  selection.addRange(newRange);

  syncInlineMathRawText(activeEl);
  markTheoryDirty();
  commitDomToState();
}

function applyTextStyle(prop, value) {
  const targets = selectedEditables();
  if (!targets.length) return;
  pushDeckHistory("text-style");
  targets.forEach(node => {
    node.style[prop] = value;
    if (node.classList.contains("theory-formula-source-data")) {
      const box = node.closest(".theory-formula-box");
      if (box) box.style[prop] = value;
    }
  });
  markTheoryDirty();
  updateFontTools();
}

function toggleTextStyle(prop, onValue, offValue) {
  const targets = selectedEditables();
  if (!targets.length) return;
  pushDeckHistory("text-style");
  const shouldTurnOff = targets.every(node => node.style[prop] === onValue);
  targets.forEach(node => {
    node.style[prop] = shouldTurnOff ? offValue : onValue;
    if (node.classList.contains("theory-formula-source-data")) {
      const box = node.closest(".theory-formula-box");
      if (box) box.style[prop] = shouldTurnOff ? offValue : onValue;
    }
  });
  markTheoryDirty();
  updateFontTools();
}

function updateFontTools() {
  const targets = selectedEditables();
  const disabled = !THEORY_PAGE_STATE.editing || !targets.length;
  ["theoryFontFamily", "theoryFontSize", "theoryBoldBtn", "theoryItalicBtn", "theoryColorInput", "theoryAlignSelect"].forEach(id => {
    const control = $(id);
    if (control) control.disabled = disabled;
  });
  $("theoryToolHint").textContent = disabled ? "请选择组件" : "正在编辑所选组件";
  const deleteComponentBtn = $("theoryDeleteComponentBtn");
  if (deleteComponentBtn) deleteComponentBtn.disabled = disabled;
  if (disabled) return;
  const style = targets[0].style;
  $("theoryFontFamily").value = style.fontFamily || "";
  $("theoryFontSize").value = style.fontSize || "";
  $("theoryColorInput").value = rgbToHex(style.color || "#172033");
  $("theoryAlignSelect").value = style.textAlign || "";
}

function rgbToHex(value) {
  if (!value || value.startsWith("#")) return value || "#172033";
  const match = value.match(/\d+/g);
  if (!match) return "#172033";
  return "#" + match.slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("");
}

function bindTheoryDragAndDrop(pageId) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.querySelectorAll("[data-drag-handle]").forEach(handle => {
    const component = handle.closest("[data-component-id]");
    if (!component) return;
    handle.addEventListener("pointerdown", event => startFreeDrag(event, component, pageId));
  });
  deck.querySelectorAll("[data-resize-handle]").forEach(handle => {
    const component = handle.closest("[data-component-id]");
    if (!component) return;
    handle.addEventListener("pointerdown", event => startResizeComponent(event, component, pageId, handle.dataset.resizeHandle || "se"));
  });
}

function startFreeDrag(event, component, pageId) {
  if (!THEORY_PAGE_STATE.editing || event.button !== 0 || component.classList.contains("is-locked")) return;
  event.preventDefault();
  event.stopPropagation();
  queueDragSession(event, () => startFreeDragSession(component, pageId, event.clientX, event.clientY, event));
}

function startFreeDragSession(component, pageId, startX, startY, sourceEvent) {
  const slide = component.closest(".theory-slide");
  if (!slide || !THEORY_PAGE_STATE.editing) return;
  const componentId = component.dataset.componentId;
  const keepMultiSelection = sourceEvent?.shiftKey || sourceEvent?.ctrlKey || sourceEvent?.metaKey;
  if (componentId && (!THEORY_PAGE_STATE.selectedIds.includes(componentId) || !keepMultiSelection)) {
    selectTheoryComponent(component, null, false);
  }
  pushDeckHistory("drag");

  const boundary = dragBoundaryFor(component, slide);
  freezeEditableSiblings(boundary, slide);
  ensureFreePositioned(component, boundary);
  const movingComponents = componentId && selectedComponents().length ? selectedComponents() : [component];
  movingComponents.forEach(item => ensureFreePositioned(item, dragBoundaryFor(item, slide)));
  const startPositions = movingComponents.map(item => ({
    item,
    left: parseFloat(item.style.left || "0"),
    top: parseFloat(item.style.top || "0"),
  }));
  movingComponents.forEach(item => {
  const isCardComponent = item.dataset.componentType === "card" || item.dataset.componentType === "cards";
  const target = isCardComponent ? null : item.querySelector(".theory-editable");
  if (target) target.classList.add("is-selected");
  });
  handlePointerCapture(sourceEvent);

  const onMove = moveEvent => {
    startPositions.forEach(({ item, left, top }) => {
      const itemBoundary = dragBoundaryFor(item, slide);
      const bounds = freeDragBounds(item, itemBoundary);
      item.style.left = snapValue(clampNumber(left + moveEvent.clientX - startX, bounds.minLeft, bounds.maxLeft)) + "px";
      item.style.top = snapValue(clampNumber(top + moveEvent.clientY - startY, bounds.minTop, bounds.maxTop)) + "px";
    });
  };
  const onEnd = () => {
    movingComponents.forEach(item => item.classList.remove("is-dragging"));
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    markTheoryDirty();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, { once: true });
  window.addEventListener("pointercancel", onEnd, { once: true });
}

function queueDragSession(event, startSession) {
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;
  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
  };
  const onMove = moveEvent => {
    if (started) return;
    const moved = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
    if (moved < 4) return;
    started = true;
    cleanup();
    startSession();
  };
  const onEnd = () => {
    cleanup();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, { once: true });
  window.addEventListener("pointercancel", onEnd, { once: true });
}

function startResizeComponent(event, component, pageId, direction = "se") {
  if (!THEORY_PAGE_STATE.editing || event.button !== 0 || component.classList.contains("is-locked")) return;
  event.preventDefault();
  event.stopPropagation();
  queueDragSession(event, () => startResizeSession(component, pageId, direction, event.clientX, event.clientY, event));
}

function startResizeSession(component, pageId, direction, startX, startY, sourceEvent) {
  const slide = component.closest(".theory-slide");
  if (!slide || !THEORY_PAGE_STATE.editing) return;
  if (component.dataset.componentId) selectTheoryComponent(component);
  pushDeckHistory("resize");
  const boundary = dragBoundaryFor(component, slide);
  freezeEditableSiblings(boundary, slide);
  ensureFreePositioned(component, boundary);

  const startWidth = component.offsetWidth;
  const startHeight = component.offsetHeight;
  const left = parseFloat(component.style.left || "0");
  const top = parseFloat(component.style.top || "0");
  const isFormula = component.classList.contains("theory-component-formula");
  const isCardComponent = component.dataset.componentType === "card" || component.dataset.componentType === "cards";
  const minWidth = isFormula ? 120 : isCardComponent ? 136 : Math.min(120, Math.max(72, slide.clientWidth * 0.18));
  const minHeight = isFormula ? 48 : isCardComponent ? 72 : Math.min(72, Math.max(48, slide.clientHeight * 0.12));
  component.classList.add("is-resizing");
  component.style.zIndex = nextZIndex();
  handlePointerCapture(sourceEvent);

  const onMove = moveEvent => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    const next = resizeBoxByDirection({
      direction,
      left,
      top,
      width: startWidth,
      height: startHeight,
      dx,
      dy,
      minWidth,
      minHeight,
      maxRight: boundary.clientWidth,
      maxBottom: boundary.clientHeight,
    });
    component.style.left = snapValue(next.left) + "px";
    component.style.top = snapValue(next.top) + "px";
    component.style.width = snapValue(next.width) + "px";
    component.style.height = snapValue(next.height) + "px";
  };
  const onEnd = () => {
    component.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    markTheoryDirty();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, { once: true });
  window.addEventListener("pointercancel", onEnd, { once: true });
}

function resizeBoxByDirection(box) {
  const horizontal = box.direction.includes("e") || box.direction.includes("w");
  const vertical = box.direction.includes("n") || box.direction.includes("s");
  let left = box.left;
  let top = box.top;
  let width = box.width;
  let height = box.height;

  if (horizontal && box.direction.includes("e")) {
    width = clampNumber(box.width + box.dx, box.minWidth, box.maxRight - box.left);
  }
  if (horizontal && box.direction.includes("w")) {
    const maxLeft = box.left + box.width - box.minWidth;
    left = clampNumber(box.left + box.dx, 0, maxLeft);
    width = box.width + box.left - left;
  }
  if (vertical && box.direction.includes("s")) {
    height = clampNumber(box.height + box.dy, box.minHeight, box.maxBottom - box.top);
  }
  if (vertical && box.direction.includes("n")) {
    const maxTop = box.top + box.height - box.minHeight;
    top = clampNumber(box.top + box.dy, 0, maxTop);
    height = box.height + box.top - top;
  }

  return { left, top, width, height };
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function freeDragBounds(item, boundary) {
  const visibleGrip = 32;
  const width = Math.max(visibleGrip, item.offsetWidth || 0);
  const height = Math.max(visibleGrip, item.offsetHeight || 0);
  return {
    minLeft: Math.min(0, visibleGrip - width),
    maxLeft: Math.max(0, boundary.clientWidth - visibleGrip),
    minTop: Math.min(0, visibleGrip - height),
    maxTop: Math.max(0, boundary.clientHeight - visibleGrip),
  };
}

function dragBoundaryFor(component, slide) {
  return slide;
}

function freezeEditableSiblings(boundary, slide) {
  const siblings = draggableSiblingsForBoundary(boundary, slide);
  if (!siblings.length) return;
  const boundaryRect = boundary.getBoundingClientRect();
  const snapshots = siblings
    .filter(item => !item.classList.contains("is-free-positioned"))
    .map(item => freePositionSnapshot(item, boundary, boundaryRect));
  if (boundary !== slide) {
    boundary.style.minHeight = Math.ceil(boundaryRect.height) + "px";
  }
  snapshots.forEach(snapshot => applyFreePositionSnapshot(snapshot));
}

function draggableSiblingsForBoundary(boundary, slide) {
  if (boundary === slide) {
    return Array.from(slide.querySelectorAll(":scope > .theory-component"));
  }
  if (boundary.classList.contains("theory-card-grid")) {
    return Array.from(boundary.querySelectorAll(":scope > .theory-info-card"));
  }
  if (boundary.classList.contains("theory-bullet-grid")) {
    return Array.from(boundary.querySelectorAll(":scope > .theory-list-item"));
  }
  return [];
}

function ensureFreePositioned(component, boundary) {
  if (component.classList.contains("is-free-positioned")) return;
  applyFreePositionSnapshot(freePositionSnapshot(component, boundary));
}

function freePositionSnapshot(component, boundary, boundaryRect = boundary.getBoundingClientRect()) {
  const componentRect = component.getBoundingClientRect();
  const computed = window.getComputedStyle(boundary);
  const innerLeft = boundary.clientLeft + (parseFloat(computed.paddingLeft) || 0);
  const innerTop = boundary.clientTop + (parseFloat(computed.paddingTop) || 0);
  return {
    item: component,
    left: componentRect.left - boundaryRect.left - innerLeft,
    top: componentRect.top - boundaryRect.top - innerTop,
    width: componentRect.width,
    height: componentRect.height,
  };
}

function applyFreePositionSnapshot(snapshot) {
  const component = snapshot.item;
  component.classList.add("is-free-positioned");
  component.style.left = snapshot.left + "px";
  component.style.top = snapshot.top + "px";
  component.style.width = snapshot.width + "px";
  component.style.height = snapshot.height + "px";
}

function handlePointerCapture(event) {
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch (err) {}
}

function commitDomToState() {
  const deck = THEORY_PAGE_STATE.deck;
  const viewport = $("theorySlideViewport");
  if (!deck || !viewport) return;
  deck.slides = Array.from(viewport.querySelectorAll(".theory-slide")).map(slideEl => {
    const existing = deck.slides.find(slide => slide.id === slideEl.dataset.slideId) || { id: slideEl.dataset.slideId, layout: "default", components: [] };
    return {
      id: existing.id,
      layout: existing.layout || "default",
      components: Array.from(slideEl.querySelectorAll(":scope > .theory-component")).map(componentEl => collectComponent(componentEl))
    };
  });
}

function collectComponent(componentEl) {
  const existing = findComponentById(componentEl.dataset.componentId);
  const component = existing ? clone(existing) : makeComponent(componentEl.dataset.componentType || "p", { id: componentEl.dataset.componentId });
  component.position = componentEl.classList.contains("is-free-positioned")
    ? { left: componentEl.style.left, top: componentEl.style.top, width: componentEl.style.width, height: componentEl.style.height, zIndex: componentEl.style.zIndex }
    : null;
  component.zIndex = parseLayerZIndex({ zIndex: componentEl.style.zIndex || component.position?.zIndex || component.zIndex || 1 }, 1);
  component.layerName = componentEl.dataset.layerName || component.layerName || layerLabelForType(component.type || componentEl.dataset.componentType || "p");
  component.locked = componentEl.classList.contains("is-locked") || componentEl.dataset.layerLocked === "true";
  component.visible = !(componentEl.classList.contains("is-hidden") || componentEl.dataset.layerVisible === "false");
  if (component.type === "cards") {
    component.items = component.items.map(item => ({
      ...item,
      title: textFor(component.id + ":" + item.id + ":title"),
      body: textFor(component.id + ":" + item.id + ":body"),
      titleStyle: styleFor(component.id + ":" + item.id + ":title"),
      bodyStyle: styleFor(component.id + ":" + item.id + ":body"),
      position: positionForEditUnit(component.id + ":" + item.id)
    }));
  } else if (component.type === "card") {
    component.title = textFor(component.id + ":title");
    component.body = textFor(component.id + ":body");
    component.text = [component.title, component.body].filter(Boolean).join("\n");
    component.style = {
      ...(component.style || {}),
      titleStyle: styleFor(component.id + ":title"),
      bodyStyle: styleFor(component.id + ":body")
    };
  } else if (component.type === "bullets") {
    component.items = component.items.map(item => ({
      ...item,
      text: textFor(component.id + ":" + item.id + ":text"),
      style: styleFor(component.id + ":" + item.id + ":text"),
      position: positionForEditUnit(component.id + ":" + item.id)
    }));
  } else if (component.type === "image") {
    const frame = componentEl.querySelector(".theory-image-frame");
    component.alt = component.alt || "课件图片";
    component.caption = textFor(component.id + ":caption") || "";
    component.style = styleFor(component.id + ":caption");
    component.imageStyle = normalizeImageStyle(frame?.dataset.imageStyle || component.imageStyle);
    component.objectFit = normalizeImageObjectFit(frame?.dataset.objectFit || component.objectFit);
  } else if (component.type === "table") {
    component.tableData = tableDataFromComponentEl(componentEl);
    component.tableStyle = tableStyleFromComponentEl(componentEl);
  } else {
    component.text = textFor(component.id + ":text");
    component.style = component.type === "formula"
      ? formulaStyleFor(component.id + ":text")
      : styleFor(component.id + ":text");
  }
  return component;
}

function positionForEditUnit(unitId) {
  const node = document.querySelector("[data-edit-unit-id=\"" + cssEscape(unitId) + "\"]");
  if (!node || !node.classList.contains("is-free-positioned")) return null;
  return {
    left: node.style.left,
    top: node.style.top,
    width: node.style.width,
    height: node.style.height,
    zIndex: node.style.zIndex
  };
}

function findComponentById(componentId) {
  return THEORY_PAGE_STATE.deck?.slides.flatMap(slide => slide.components).find(component => component.id === componentId);
}

function textFor(editId) {
  const node = document.querySelector(".theory-formula-source-data[data-edit-id=\"" + cssEscape(editId) + "\"]")
    || document.querySelector(".theory-formula-box[data-edit-id=\"" + cssEscape(editId) + "\"]")
    || document.querySelector("[data-edit-id=\"" + cssEscape(editId) + "\"]");
  if (!node) return "";
  if (node.classList.contains("theory-formula-source-data") || node.classList.contains("theory-formula-box")) {
    const latex = normalizeFormulaLatex(node.dataset.formulaLatex || node.innerText || node.textContent || THEORY_DEFAULT_FORMULA);
    node.dataset.formulaLatex = latex;
    if (node.classList.contains("theory-formula-source-data")) node.textContent = latex;
    return latex;
  }
  if (node.dataset.inlineMathEditing === "true") syncInlineMathRawText(node);
  return node.dataset.rawText ?? node.innerText ?? node.textContent ?? "";
}

function formulaStyleFor(editId) {
  const box = document.querySelector(".theory-formula-box[data-edit-id=\"" + cssEscape(editId) + "\"]");
  const sourceNode = box?.querySelector(".theory-formula-source-data[data-formula-source='true']")
    || document.querySelector(".theory-formula-source-data[data-edit-id=\"" + cssEscape(editId) + "\"]");
  const node = box || sourceNode;
  if (!node) return {};
  return {
    fontFamily: node.style.fontFamily || "",
    fontSize: node.style.fontSize || "",
    fontWeight: node.style.fontWeight || "",
    fontStyle: node.style.fontStyle || "",
    color: node.style.color || "",
    textAlign: node.style.textAlign || "",
    lineHeight: node.style.lineHeight || "",
  };
}

function styleFor(editId) {
  const node = document.querySelector("[data-edit-id=\"" + cssEscape(editId) + "\"]");
  if (!node) return {};
  return {
    fontFamily: node.style.fontFamily || "",
    fontSize: node.style.fontSize || "",
    fontWeight: node.style.fontWeight || "",
    fontStyle: node.style.fontStyle || "",
    color: node.style.color || "",
    textAlign: node.style.textAlign || "",
  };
}

async function saveTheoryEdits(pageId, options = {}) {
  const saveVersion = THEORY_PAGE_STATE.editVersion;
  THEORY_PAGE_STATE.saving = true;
  try {
    const resp = await fetch(THEORY_DECK_OVERRIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: pageId,
        deck: THEORY_PAGE_STATE.deck,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "save failed");
    THEORY_PAGE_STATE.serverOverrides[pageId] = clone(data.deck);
    if (THEORY_PAGE_STATE.editVersion === saveVersion) {
      THEORY_PAGE_STATE.dirty = false;
      setTheoryStatus(options.source === "manual" ? "已同步到项目文件" : "已自动同步到项目文件");
    } else {
      setTheoryStatus("继续同步最新修改");
      scheduleTheoryAutosave();
    }
  } catch (err) {
    setTheoryStatus("项目文件同步失败");
  } finally {
    THEORY_PAGE_STATE.saving = false;
  }
}

function applyLegacyEdits(pageId) {
  return;
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function pptColor(c, fallback = "FFFFFF") {
  if (!c) return fallback;
  const str = c.trim().toLowerCase();
  if (str === "transparent") return "FFFFFF";
  if (str.startsWith("rgb")) {
    const parts = str.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0], 10).toString(16).padStart(2, "0").toUpperCase();
      const g = parseInt(parts[1], 10).toString(16).padStart(2, "0").toUpperCase();
      const b = parseInt(parts[2], 10).toString(16).padStart(2, "0").toUpperCase();
      return r + g + b;
    }
  }
  if (str.startsWith("#")) {
    return str.slice(1).toUpperCase();
  }
  // Check if it's already a 6-character hex string
  if (/^[0-9a-fA-F]{6}$/.test(str)) {
    return str.toUpperCase();
  }
  return fallback;
}

function cleanMathFormula(text) {
  if (!text) return "";
  let s = text.trim();
  // Remove outer LaTeX delimiters
  if (s.startsWith("$$") && s.endsWith("$$")) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith("$") && s.endsWith("$")) {
    s = s.slice(1, -1).trim();
  }
  
  // Replace symbols with high-quality Unicode math representations
  s = s.replace(/\\hat\{y\}/g, "ŷ");
  s = s.replace(/\\hat\{y\}_i/g, "ŷᵢ");
  s = s.replace(/y_i/g, "yᵢ");
  s = s.replace(/\\hat\{w\}/g, "ŵ");
  s = s.replace(/\\hat\{b\}/g, "b̂");
  s = s.replace(/\\alpha/g, "α");
  s = s.replace(/\\beta/g, "β");
  s = s.replace(/\\partial/g, "∂");
  s = s.replace(/\\sum/g, "∑");
  s = s.replace(/\\sum_\{i=1\}^\{m\}/g, "∑(i=1..m)");
  s = s.replace(/\\sum_\{i=1\}\^m/g, "∑(i=1..m)");
  s = s.replace(/\\cdots/g, "⋯");
  s = s.replace(/\\cdot/g, "·");
  s = s.replace(/\\times/g, "×");
  s = s.replace(/\\sqrt/g, "√");
  s = s.replace(/\\infty/g, "∞");
  s = s.replace(/\\to/g, "→");
  s = s.replace(/\\approx/g, "≈");
  s = s.replace(/\\neq/g, "≠");
  s = s.replace(/\\ge/g, "≥");
  s = s.replace(/\\le/g, "≤");
  s = s.replace(/\\div/g, "÷");
  s = s.replace(/\\pm/g, "±");
  
  // Convert standard \frac{A}{B} to (A) / (B)
  let prev;
  do {
    prev = s;
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1) / ($2)");
  } while (s !== prev);

  // Clean indices
  s = s.replace(/_([0-9a-zA-Z])/g, "$1");
  s = s.replace(/\^([0-9a-zA-Z])/g, "^$1");
  s = s.replace(/_\{([^}]+)\}/g, "$1");
  s = s.replace(/\^\{([^}]+)\}/g, "^$1");

  s = s.replace(/\\/g, "");
  s = s.replace(/\s+/g, " ");
  
  return s.trim();
}

function captureChartCanvasInMemory(component) {
  let canvas = null;
  let chart = null;
  try {
    if (!window.echarts) return null;
    let w = parseFloat(component.position?.width);
    let h = parseFloat(component.position?.height);
    if (isNaN(w) || w <= 0) w = 620;
    if (isNaN(h) || h <= 0) h = 440;

    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    
    // Append to DOM to prevent parent computed style or offset errors
    canvas.style.position = "absolute";
    canvas.style.left = "-9999px";
    canvas.style.top = "-9999px";
    document.body.appendChild(canvas);

    chart = echarts.init(canvas, null, { width: w, height: h, devicePixelRatio: 2 });
    const option = resolveTheoryChartOption(component, { staticMode: true });
    chart.setOption(option);
    
    const base64Data = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    return base64Data;
  } catch (err) {
    console.error("captureChartCanvasInMemory error:", err);
    return null;
  } finally {
    if (chart) {
      try {
        chart.dispose();
      } catch (e) {}
    }
    if (canvas && canvas.parentNode) {
      try {
        canvas.parentNode.removeChild(canvas);
      } catch (e) {}
    }
  }
}

let mathjaxSvgLoadPromise = null;

function loadMathJaxSvg() {
  if (window.MathJax && typeof window.MathJax.tex2svg === "function") {
    return Promise.resolve();
  }
  if (mathjaxSvgLoadPromise) {
    return mathjaxSvgLoadPromise;
  }
  mathjaxSvgLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = (err) => {
      mathjaxSvgLoadPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return mathjaxSvgLoadPromise;
}

async function renderFormulaToPng(latex) {
  let formula = normalizeFormulaLatex(latex);
  if (formula.startsWith("$$") && formula.endsWith("$$")) {
    formula = formula.slice(2, -2).trim();
  } else if (formula.startsWith("$") && formula.endsWith("$")) {
    formula = formula.slice(1, -1).trim();
  }

  // 1. Try local MathJax SVG rendering first
  try {
    await loadMathJaxSvg();
    if (window.MathJax && typeof window.MathJax.tex2svg === "function") {
      const svgNode = window.MathJax.tex2svg(formula).querySelector("svg");
      if (svgNode) {
        let valWidth = svgNode.getAttribute("width");
        let valHeight = svgNode.getAttribute("height");
        let w = 400; 
        let h = 100;
        if (valWidth && valWidth.endsWith("ex")) {
          w = parseFloat(valWidth) * 9; 
        }
        if (valHeight && valHeight.endsWith("ex")) {
          h = parseFloat(valHeight) * 9;
        }
        
        const padding = 15;
        w += padding * 2;
        h += padding * 2;

        svgNode.setAttribute("fill", "#0F172A");
        svgNode.style.color = "#0F172A";

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgNode);
        
        const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
        const svgDataUrl = "data:image/svg+xml;base64," + svgBase64;
        
        const pngDataUrl = await new Promise((resolvePng, rejectPng) => {
          const img = new Image();
          img.src = svgDataUrl;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = 3; 
            canvas.width = w * scale;
            canvas.height = h * scale;
            const ctx = canvas.getContext("2d");
            ctx.scale(scale, scale);
            
            ctx.fillStyle = "#F8FAFC";
            ctx.fillRect(0, 0, w, h);
            
            ctx.drawImage(img, padding, padding, w - padding * 2, h - padding * 2);
            resolvePng(canvas.toDataURL("image/png"));
          };
          img.onerror = (err) => {
            rejectPng(err);
          };
        });
        return { data: pngDataUrl, width: w, height: h };
      }
    }
  } catch (err) {
    console.warn("MathJax SVG render failed, falling back to online API:", err);
  }

  // 2. Fallback to online CodeCogs API
  try {
    const encodedFormula = encodeURIComponent(`\\dpi{300}\\bg{F8FAFC}\\fg{0F172A} ${formula}`);
    const url = `https://latex.codecogs.com/png.image?${encodedFormula}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("CodeCogs request failed");
    const blob = await resp.blob();
    const base64 = await new Promise((resolveBlob) => {
      const reader = new FileReader();
      reader.onloadend = () => resolveBlob(reader.result);
      reader.readAsDataURL(blob);
    });
    
    const dimensions = await new Promise((resolveDim) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        resolveDim({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolveDim({ width: 400, height: 100 });
      };
    });
    
    return { data: base64, width: dimensions.width, height: dimensions.height };
  } catch (err) {
    console.error("Formula rendering fallback failed:", err);
    return null;
  }
}

async function exportTheoryPptx(pageId) {
  const exportBtn = $("theoryExportBtn");
  if (!exportBtn) return;
  if (typeof PptxGenJS === "undefined") {
    setTheoryStatus("导出库未加载，请联网后重试");
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = "生成中...";
  setTheoryStatus("正在生成全套 PPT...");

  try {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";

    const topics = [
      "basic", "purpose", "knowledge", "dataset", "model", 
      "criterion", "optimization", "evaluation", "result", "thinking"
    ];

    const topicLabels = {
      basic: "实验背景",
      purpose: "实验目的",
      knowledge: "前置知识",
      dataset: "数据分析",
      model: "模型构建",
      criterion: "学习准则",
      optimization: "参数优化",
      evaluation: "评价指标",
      result: "预期成果",
      thinking: "思考拓展"
    };

    let totalSlidesCounter = 0;

    for (let topicIdx = 0; topicIdx < topics.length; topicIdx++) {
      const currentTopicId = topics[topicIdx];
      const pageDeck = loadDeckForPage(currentTopicId);
      const slides = pageDeck.slides || [];

      for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
        const slideSpec = slides[slideIdx];
        const slide = pptx.addSlide();

        // 1. SET BG COLOR (F5F8FC grey-blue representing premium web app interface background!)
        slide.background = { color: "F5F8FC" };

        // 2. TOP ACCENT BRANDING LINE (2563EB solid line)
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: 0, y: 0, w: 10, h: 0.08,
          fill: { color: "2563EB" },
          line: { color: "2563EB", width: 0 }
        });

        // 3. TOP RIGHT GLOW DESIGN CIRCLE (neon hover aura effect) - UNIFORMLY REMOVED AS REQUESTED BY USER

        // 4. TOP LEFT ACCENT CHAPTER BADGE (e.g. "04 数据分析")
        const badgeLabel = `${String(topicIdx + 1).padStart(2, "0")} ${topicLabels[currentTopicId]}`;
        slide.addText(badgeLabel, {
          x: 0.5, y: 0.22, w: 1.6, h: 0.28,
          fill: { color: "EFF6FF" },
          line: { color: "DBEAFE", width: 1 },
          color: "2563EB",
          bold: true,
          fontSize: 9,
          align: "center",
          fontFace: "Microsoft YaHei",
          valign: "middle",
          rectRadius: 0.1
        });

        // 5. FOOTER page index - REMOVED AS REQUESTED BY USER

        totalSlidesCounter++;

        const components = [...(slideSpec.components || [])].sort((a, b) => parseLayerZIndex(a, 1) - parseLayerZIndex(b, 1));

        for (const comp of components) {
          if (comp.visible === false) continue;

          const leftPx = comp.position ? parseFloat(comp.position.left) : 50;
          const topPx = comp.position ? parseFloat(comp.position.top) : 50;
          const widthPx = comp.position ? parseFloat(comp.position.width) : 300;
          const heightPx = comp.position ? parseFloat(comp.position.height) : 100;

          const x = leftPx / 96;
          const y = topPx / 96;
          const w = widthPx / 96;
          const h = isNaN(heightPx) || heightPx === 0 ? 1.5 : heightPx / 96;

          const type = comp.type || "text";

          if (type === "eyebrow") {
            if (comp.text && comp.text !== "理论部分") {
              slide.addText(comp.text, {
                x, y, w, h: 0.35,
                fill: { color: "EFF6FF" },
                color: "2563EB",
                bold: true,
                fontSize: 10,
                align: "center",
                fontFace: "Microsoft YaHei",
                valign: "middle",
                rectRadius: 0.1
              });
            }
          } 
          else if (type === "h1" || type === "h2" || type === "h3" || type === "title") {
            slide.addText(comp.text || comp.title || "标题", {
              x, y, w, h,
              color: "0F172A",
              bold: true,
              fontSize: type === "h1" || type === "title" ? 22 : 18,
              fontFace: "Microsoft YaHei",
              align: "left",
              valign: "top"
            });
          } 
          else if (type === "p" || type === "text") {
            slide.addText(comp.text || "", {
              x, y, w, h,
              color: "334155",
              fontSize: 12,
              fontFace: "Microsoft YaHei",
              align: "left",
              valign: "top",
              lineSpacing: 18
            });
          } 
          else if (type === "card") {
            const background = comp.style?.backgroundColor || comp.style?.background || "F8FAFC";
            const finalBg = pptColor(background, "F8FAFC");

            slide.addText("", {
              x, y, w, h,
              fill: { color: finalBg },
              line: { color: "E2E8F0", width: 1 },
              rectRadius: 0.08
            });

            const parts = cardParts(comp);
            slide.addText(parts.title, {
              x: x + 0.15, y: y + 0.15, w: w - 0.3, h: 0.3,
              color: "0F172A",
              bold: true,
              fontSize: 13,
              fontFace: "Microsoft YaHei",
              valign: "middle"
            });
            slide.addText(parts.body, {
              x: x + 0.15, y: y + 0.45, w: w - 0.3, h: h - 0.6,
              color: "475569",
              fontSize: 10,
              fontFace: "Microsoft YaHei",
              valign: "top",
              lineSpacing: 14
            });
          } 
          else if (type === "cards") {
            const items = comp.items || [];
            if (items.length > 0) {
              const cardGap = 0.15;
              const singleCardW = (w - (items.length - 1) * cardGap) / items.length;

              items.forEach((item, itemIdx) => {
                const itemX = x + itemIdx * (singleCardW + cardGap);
                const itemY = y;
                const itemW = singleCardW;
                const itemH = h;

                const background = item.style?.backgroundColor || item.style?.background || "F8FAFC";
                const finalBg = pptColor(background, "F8FAFC");

                slide.addText("", {
                  x: itemX, y: itemY, w: itemW, h: itemH,
                  fill: { color: finalBg },
                  line: { color: "E2E8F0", width: 1 },
                  rectRadius: 0.08
                });

                slide.addText(item.title || "卡片标题", {
                  x: itemX + 0.12, y: itemY + 0.12, w: itemW - 0.24, h: 0.3,
                  color: "0F172A",
                  bold: true,
                  fontSize: 12,
                  fontFace: "Microsoft YaHei",
                  valign: "middle"
                });
                slide.addText(item.body || "卡片正文", {
                  x: itemX + 0.12, y: itemY + 0.42, w: itemW - 0.24, h: itemH - 0.54,
                  color: "475569",
                  fontSize: 9.5,
                  fontFace: "Microsoft YaHei",
                  valign: "top",
                  lineSpacing: 13
                });
              });
            }
          } 
          else if (type === "bullets") {
            const items = comp.items || [];
            if (items.length > 0) {
              const bulletData = items.map(item => ({
                text: item.text || "要点内容",
                options: { bullet: true, fontSize: 12, color: "334155", fontFace: "Microsoft YaHei" }
              }));
              slide.addText(bulletData, { x, y, w, h, valign: "top" });
            }
          } 
          else if (type === "callout") {
            slide.addText(comp.text || "提示内容", {
              x, y, w, h,
              fill: { color: "FFF6D6" },
              line: { color: "F3D370", width: 1 },
              color: "7C5C00",
              fontSize: 11,
              fontFace: "Microsoft YaHei",
              valign: "middle",
              rectRadius: 0.08,
              align: "center"
            });
          } 
          else if (type === "formula") {
            slide.addText("", {
              x, y, w, h,
              fill: { color: "F8FAFC" },
              line: { color: "E2E8F0", width: 1 },
              rectRadius: 0.08
            });
            const formulaResult = await renderFormulaToPng(comp.text || "");
            if (formulaResult && formulaResult.data) {
              const formulaRatio = formulaResult.width / formulaResult.height;
              const targetW = w - 0.2;
              const targetH = h - 0.2;
              let finalW = targetW;
              let finalH = targetH;
              if (formulaRatio > targetW / targetH) {
                finalW = targetW;
                finalH = targetW / formulaRatio;
              } else {
                finalH = targetH;
                finalW = targetH * formulaRatio;
              }
              const finalX = x + 0.1 + (targetW - finalW) / 2;
              const finalY = y + 0.1 + (targetH - finalH) / 2;

              slide.addImage({
                data: formulaResult.data,
                x: finalX,
                y: finalY,
                w: finalW,
                h: finalH
              });
            } else {
              const cleanedFormulaText = cleanMathFormula(comp.text || "");
              slide.addText(cleanedFormulaText, {
                x, y, w, h,
                color: "0F172A",
                fontSize: 13,
                fontFace: "Microsoft YaHei",
                bold: true,
                valign: "middle",
                align: "center"
              });
            }
          } 
          else if (type === "table") {
            const tableData = normalizeTableData(comp.tableData);
            if (tableData?.cells?.length > 0) {
              const tableRows = tableData.cells.map((row, rowIdx) => 
                row.map(cell => ({
                  text: cell || "",
                  options: {
                    fill: rowIdx === 0 && tableData.header ? "EFF6FF" : "FFFFFF",
                    color: rowIdx === 0 && tableData.header ? "1E3A8A" : "334155",
                    bold: rowIdx === 0 && tableData.header,
                    fontFace: "Microsoft YaHei",
                    fontSize: 10,
                    align: "center",
                    valign: "middle"
                  }
                }))
              );
              slide.addTable(tableRows, {
                x, y, w, h,
                border: { type: "solid", color: "CBD5E1", size: 1 }
              });
            }
          } 
          else if (type === "chart" || type === "visual") {
            let base64Data = null;
            if (currentTopicId === pageId) {
              const chartCanvas = document.querySelector(`[data-theory-slide="${slideIdx}"] [data-chart-id="${cssEscape(comp.id)}"] canvas`);
              if (chartCanvas) {
                try {
                  base64Data = chartCanvas.toDataURL("image/png");
                } catch (e) {}
              }
            }

            if (!base64Data) {
              base64Data = captureChartCanvasInMemory(comp);
            }

            if (base64Data) {
              slide.addImage({ data: base64Data, x, y, w, h, sizing: { type: "contain", w, h } });
            } else {
              slide.addText(`[图表: ${comp.text || comp.label || "数据可视化"}]`, {
                x, y, w, h,
                fill: { color: "F1F5F9" },
                color: "64748B",
                align: "center",
                valign: "middle"
              });
            }
          } 
          else if (type === "image") {
            const src = comp.src || "";
            if (src) {
              const fullPath = src.startsWith("data:") ? src : (window.location.origin + src);
              slide.addImage({ path: fullPath, x, y, w, h, sizing: { type: "contain", w, h } });
            } else {
              slide.addText("[无图片数据]", {
                x, y, w, h,
                fill: { color: "F1F5F9" },
                color: "64748B",
                align: "center",
                valign: "middle"
              });
            }
          }
        }
      }
    }

    const finalFilename = "简单线性回归波士顿房价预测-全套完整课件.pptx";
    await pptx.writeFile({ fileName: finalFilename });
    setTheoryStatus("全套 PPT 下载成功");
  } catch (err) {
    setTheoryStatus("PPT 导出失败: " + err.message);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = "下载全套 PPT";
  }
}





























function markTheoryDirty() {
  if (!THEORY_PAGE_STATE.editing) return;
  THEORY_PAGE_STATE.dirty = true;
  THEORY_PAGE_STATE.editVersion += 1;
  setTheoryStatus("有未保存修改");
}

function scheduleTheoryAutosave() {}

async function flushTheoryAutosave() {}

async function saveTheoryEdits(pageId) {
  const saveVersion = THEORY_PAGE_STATE.editVersion;
  THEORY_PAGE_STATE.saving = true;
  try {
    const resp = await fetch(THEORY_DECK_OVERRIDE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_id: pageId,
        deck: THEORY_PAGE_STATE.deck,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || "save failed");
    THEORY_PAGE_STATE.serverOverrides[pageId] = clone(data.deck);
    if (THEORY_PAGE_STATE.editVersion === saveVersion) {
      THEORY_PAGE_STATE.dirty = false;
      setTheoryStatus("已保存到项目文件");
    } else {
      setTheoryStatus("仍有未保存修改");
    }
  } catch (err) {
    setTheoryStatus("保存到项目文件失败");
  } finally {
    THEORY_PAGE_STATE.saving = false;
  }
}



