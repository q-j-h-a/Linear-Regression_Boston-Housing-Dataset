// Shared state and runtime helpers. FEATURE_NAMES and DEFAULT_FEATURE are defined by the template.

const $ = (id) => document.getElementById(id);

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
}

const charts = new Map();

const chartResizeObservers = new Map();

const viewStateStore = {};

let dataGrid = null;

let dataGridMode = null;

let currentPage = "basic";

let dataCache = null;

let dataChartDataCache = {};

let trainData = null;

let predictData = null;

let predictChartDataCache = {};

let studentMeta = null;

let studentData = null;

let studentTrainData = null;

let studentPredictData = null;

let studentChartDataCache = {};

let studentRenderViewsKey = "";

let studentStage = "数据集";

let studentStageKind = "dataset";

let studentTrainDirty = false;

let studentCurrentFrame = 0;

let studentHasTrained = false;

let currentFrame = 0;

let timer = null;

let trainRenderViewsKey = "";

let predictRenderViewsKey = "";

let trainChartDataCache = {};

let trainChartRegistry = [];

let trainChartRegistryLoaded = false;

let trainPageSchema = null;

let preprocessPageSchema = null;

let predictPageSchema = null;

let studentPageSchema = null;

let activePrototypeChartId = null;

function setActive(page) {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  const modelPages = ["dataset", "model", "criterion", "optimization", "evaluation"];
  document.querySelectorAll(".nested-section").forEach(section => {
    section.classList.toggle("active", modelPages.includes(page));
  });
}

function disposeCharts() {
  chartResizeObservers.forEach(observer => observer.disconnect());
  chartResizeObservers.clear();
  charts.forEach(ch => ch.dispose());
  charts.clear();
  activePrototypeChartId = null;
}

function saveDataGridLayout() {
  if (!dataGrid) return;
  const layout = {};
  dataGrid.getGridItems().forEach(item => {
    const node = item.gridstackNode;
    const view = item.dataset.view;
    if (!node || !view) return;
    layout[view] = { x: node.x, y: node.y, w: node.w, h: node.h };
  });
  viewStateStore[gridLayoutStorageKey(dataGridMode)] = layout;
}

function gridLayoutStorageKey(mode) {
  if (mode === "train") return "trainGridLayoutV2";
  if (mode === "predict") return "predictGridLayoutV3";
  if (mode === "student") return "studentGridLayoutV2";
  return "preprocessGridLayoutV4";
}

function destroyDataGrid() {
  if (!dataGrid) return;
  saveDataGridLayout();
  dataGrid.destroy(false);
  dataGrid = null;
  dataGridMode = null;
  trainRenderViewsKey = "";
  predictRenderViewsKey = "";
  studentRenderViewsKey = "";
}

function initChart(id) {
  const el = $(id);
  const ch = echarts.init(el);
  charts.set(id, ch);
  const resize = () => ch.resize();
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    chartResizeObservers.set(id, observer);
  }
  requestAnimationFrame(resize);
  bindPrototypeChartInteraction(id, el);
  return ch;
}

function bindPrototypeChartInteraction(id, el) {
  if (!el) return;
  const card = el.closest(".chart-card");
  if (!card || !card.classList.contains("chart-interaction-prototype") || card.dataset.prototypeBound === "1") return;
  card.dataset.prototypeBound = "1";
  let pointerDownPoint = null;
  let suppressNextClick = false;

  const setActivePrototype = (active) => {
    document.querySelectorAll(".chart-card.chart-interaction-prototype.chart-active").forEach(activeCard => {
      if (activeCard !== card) activeCard.classList.remove("chart-active");
    });
    if (!active) {
      charts.get(id)?.dispatchAction?.({ type: "hideTip" });
    }
    activePrototypeChartId = active ? id : null;
    card.classList.toggle("chart-active", active);
  };

  card.addEventListener("pointerdown", event => {
    pointerDownPoint = { x: event.clientX, y: event.clientY };
    suppressNextClick = false;
  }, true);

  card.addEventListener("pointermove", event => {
    if (!pointerDownPoint) return;
    const dx = event.clientX - pointerDownPoint.x;
    const dy = event.clientY - pointerDownPoint.y;
    if (Math.hypot(dx, dy) > 6) suppressNextClick = true;
  }, true);

  card.addEventListener("pointerup", () => {
    pointerDownPoint = null;
  }, true);

  card.addEventListener("click", event => {
    if (event.target.closest(".ui-resizable-handle")) return;
    event.stopPropagation();
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    setActivePrototype(activePrototypeChartId !== id);
  });

  card.addEventListener("wheel", event => {
    if (activePrototypeChartId === id) return;
    charts.get(id)?.dispatchAction?.({ type: "hideTip" });
    event.stopImmediatePropagation();
  }, true);

  [
    "mousemove", "mouseover", "mouseout",
    "pointermove", "pointerover", "pointerout",
    "mousedown", "pointerdown", "dblclick",
  ].forEach(eventName => {
    el.addEventListener(eventName, event => {
      if (activePrototypeChartId === id) return;
      charts.get(id)?.dispatchAction?.({ type: "hideTip" });
      event.stopImmediatePropagation();
    }, true);
  });
}

document.addEventListener("click", () => {
  if (!activePrototypeChartId) return;
  charts.get(activePrototypeChartId)?.dispatchAction?.({ type: "hideTip" });
  document.querySelectorAll(".chart-card.chart-interaction-prototype.chart-active").forEach(card => {
    card.classList.remove("chart-active");
  });
  activePrototypeChartId = null;
});

function setChartOptionWhenReady(ch, option, replace = true) {
  if (!option) return;
  requestAnimationFrame(() => {
    ch.resize();
    ch.setOption(option, replace);
    requestAnimationFrame(() => ch.resize());
  });
}

function persistActiveViewSelection() {
  if (currentPage === "preprocess" && document.querySelector('input[name="dataViews"]')) {
    persistDataFormState();
    saveCheckedValues("dataViews", "preprocessSelectedViewsV1");
  }
  if (currentPage === "train_eval" && document.querySelector('input[name="trainViews"]')) {
    persistTrainFormState();
    saveCheckedValues("trainViews", "trainSelectedViewsV1");
  }
  if (currentPage === "predict" && document.querySelector('input[name="predictViews"]')) {
    persistPredictFormState();
    saveCheckedValues("predictViews", "predictSelectedViewsV2");
  }
  if (currentPage === "student") {
    persistStudentFormState();
    if (document.querySelector('input[name="studentDataViews"]')) saveCheckedValues("studentDataViews", "studentDataSelectedViewsV1");
    if (document.querySelector('input[name="studentTrainViews"]')) saveCheckedValues("studentTrainViews", "studentTrainSelectedViewsV1");
    if (document.querySelector('input[name="studentPredictViews"]')) saveCheckedValues("studentPredictViews", "studentPredictSelectedViewsV1");
  }
}

const studentFormStateIds = [
  "studentSourceType", "studentTarget", "studentFeature",
  "studentW0", "studentB0", "studentLr", "studentEpochs", "studentSpeed",
  "studentPredictInput"
];

function persistStudentFormState() {
  const state = {};
  studentFormStateIds.forEach(id => {
    const el = $(id);
    if (el) state[id] = el.value;
  });
  if (document.querySelector('input[name="studentFeatures"]')) {
    state.studentFeatures = selectedValues("studentFeatures");
  }
  viewStateStore.studentFormStateV1 = state;
}

function restoreStudentFormState() {
  const state = viewStateStore.studentFormStateV1 || {};
  if (Array.isArray(state.studentFeatures)) {
    let matched = 0;
    document.querySelectorAll('input[name="studentFeatures"]').forEach(el => {
      const checked = state.studentFeatures.includes(el.value);
      if (checked) matched += 1;
      el.checked = checked;
    });
    if (!matched) {
      document.querySelectorAll('input[name="studentFeatures"]').forEach(el => el.checked = true);
    }
  }
  studentFormStateIds.forEach(id => {
    const el = $(id);
    if (!el || state[id] == null) return;
    if (el.tagName === "SELECT" && ![...el.options].some(opt => opt.value === state[id])) return;
    el.value = state[id];
  });
  updateStudentFeatureSelect();
  if ($("studentFeature") && state.studentFeature && [...$("studentFeature").options].some(opt => opt.value === state.studentFeature)) {
    $("studentFeature").value = state.studentFeature;
  }
  if ($("studentSpeed") && $("studentSpeedText")) $("studentSpeedText").textContent = `${$("studentSpeed").value}ms`;
}

function currentFeature() {
  const dataFeature = $("dataFeature");
  const trainFeature = $("trainFeature");
  const predictFeature = $("predictFeature");
  return dataFeature?.value || trainFeature?.value || predictFeature?.value || DEFAULT_FEATURE;
}

function selectedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
}

function restoreCheckedValues(name, storageKey) {
  let values = null;
  try {
    values = viewStateStore[storageKey] || null;
  } catch (err) {}
  if (!Array.isArray(values)) return;
  const inputs = [...document.querySelectorAll(`input[name="${name}"]`)];
  const validValues = new Set(inputs.map(el => el.value));
  const allowed = new Set(values.filter(value => validValues.has(value)));
  if (values.length && !allowed.size) return;
  inputs.forEach(el => {
    el.checked = allowed.has(el.value);
  });
}

function saveCheckedValues(name, storageKey) {
  viewStateStore[storageKey] = selectedValues(name);
}

function updateDataGridCellHeight() {
  if (!dataGrid) return;
  const grid = dataGrid.el || $("chartGrid") || $("studentChartGrid");
  if (!grid) return;
  const columnWidth = grid.clientWidth / 4;
  dataGrid.cellHeight(Math.max(220, Math.round(columnWidth)));
}

function syncDataGridAttributes() {
  if (!dataGrid) return;
  dataGrid.getGridItems().forEach(item => {
    const node = item.gridstackNode;
    if (!node) return;
    item.setAttribute("gs-x", node.x);
    item.setAttribute("gs-y", node.y);
    item.setAttribute("gs-w", node.w);
    item.setAttribute("gs-h", node.h);
  });
}

function loadDataGridLayout() {
  try {
    return viewStateStore.preprocessGridLayoutV4 || {};
  } catch (err) {
    return {};
  }
}

function loadTrainGridLayout() {
  try {
    return viewStateStore.trainGridLayoutV2 || {};
  } catch (err) {
    return {};
  }
}

function loadPredictGridLayout() {
  try {
    return viewStateStore.predictGridLayoutV3 || {};
  } catch (err) {
    return {};
  }
}

function loadStudentGridLayout() {
  try {
    return viewStateStore.studentGridLayoutV2 || {};
  } catch (err) {
    return {};
  }
}
