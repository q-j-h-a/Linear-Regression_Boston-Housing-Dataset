// App Shell.

window.currentExperiment = window.currentExperiment || DEFAULT_EXPERIMENT_ID;

const SHELL_LAYOUT_KEY = "linearRegressionShellLayoutV1";
const SHELL_SPLITTER_WIDTH = 8;
const SHELL_DEFAULT_LAYOUT = { leftRatio: 0.16, rightRatio: 0.20 };
const SHELL_LIMITS = {
  leftMin: 180,
  leftMax: 460,
  mainMin: 520,
  rightMin: 260,
  rightMax: 520,
};

let shellResizeDrag = null;

let pageRenderToken = 0;

function clearPageTopSlot() {
  const slot = $("pageTopSlot");
  if (!slot) return;
  slot.innerHTML = "";
  slot.classList.remove("has-content");
}

async function setPage(page) {
  const renderToken = ++pageRenderToken;
  persistActiveViewSelection();
  stopAuto();
  currentPage = page;
  setActive(page);
  destroyDataGrid();
  disposeCharts();
  if (page !== "preprocess") clearPageTopSlot();
  $("topFeature").textContent = `当前特征 ${currentFeature()}`;
  try {
    if (page === "experiment_test") {
      renderExperimentTestPage();
    } else if (page === "preprocess") {
      await renderDataShell();
      if (renderToken !== pageRenderToken) return;
      if (dataCache) {
        restoreDataView();
      } else if (!currentDatasetMeta) {
        await renderPreprocessCurrentStep();
      } else {
        await loadDataView();
      }
    } else if (page === "train_eval") {
      await renderTrainShell();
    } else if (page === "evaluate") {
      await renderEvaluateShell();
    } else if (page === "predict") {
      await renderPredictShell();
    } else {
      await renderTheory(page);
    }
  } finally {
    if (renderToken === pageRenderToken) {
      requestAnimationFrame(() => {
        applyShellLayout();
        resizeActiveCharts();
      });
    }
  }
}

function renderError(message) {
  $("main").innerHTML = `<section class="content-card"><h2>加载失败</h2><p>${escapeHtml(message)}</p></section>`;
}

function resizeActiveCharts() {
  updateDataGridCellHeight();
  charts.forEach(ch => ch.resize());
}

function shellLayoutFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHELL_LAYOUT_KEY) || "null");
    if (saved && Number.isFinite(saved.leftRatio) && Number.isFinite(saved.rightRatio)) return saved;
  } catch (err) {}
  return SHELL_DEFAULT_LAYOUT;
}

function saveShellLayout(left, right) {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const total = shellAvailableWidth(shell);
  if (total <= 0) return;
  try {
    localStorage.setItem(SHELL_LAYOUT_KEY, JSON.stringify({
      leftRatio: left / total,
      rightRatio: right / total,
    }));
  } catch (err) {}
}

function shellAvailableWidth(shell) {
  const splitterCount = shell.classList.contains("theory") && !shell.classList.contains("theory-with-panel") ? 1 : 2;
  return Math.max(0, shell.clientWidth - splitterCount * SHELL_SPLITTER_WIDTH);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedShellWidths(left, right, shell = document.querySelector(".shell")) {
  if (!shell) return null;
  const isTheory = shell.classList.contains("theory") && !shell.classList.contains("theory-with-panel");
  const total = shellAvailableWidth(shell);
  if (total <= 0) return null;

  const compact = total < 1080;
  const leftMin = compact ? 160 : SHELL_LIMITS.leftMin;
  const rightMin = compact ? 230 : SHELL_LIMITS.rightMin;
  const mainMin = compact ? 360 : SHELL_LIMITS.mainMin;
  const leftMax = Math.min(SHELL_LIMITS.leftMax, Math.max(leftMin, total - mainMin));
  const rightMax = isTheory ? 0 : Math.min(SHELL_LIMITS.rightMax, Math.max(rightMin, total - leftMin - mainMin));

  let nextLeft = clamp(left, leftMin, leftMax);
  let nextRight = isTheory ? 0 : clamp(right, rightMin, rightMax);

  if (!isTheory && total - nextLeft - nextRight < mainMin) {
    const overflow = mainMin - (total - nextLeft - nextRight);
    if (shellResizeDrag?.edge === "left") {
      nextLeft = Math.max(leftMin, nextLeft - overflow);
    } else {
      nextRight = Math.max(rightMin, nextRight - overflow);
    }
  }

  if (isTheory && total - nextLeft < mainMin) {
    nextLeft = Math.max(leftMin, total - mainMin);
  }

  return {
    left: Math.round(nextLeft),
    main: Math.round(Math.max(0, total - nextLeft - nextRight)),
    right: Math.round(nextRight),
  };
}

function applyShellLayoutPixels(left, right, persist = false) {
  const shell = document.querySelector(".shell");
  const widths = normalizedShellWidths(left, right, shell);
  if (!shell || !widths) return;
  const app = document.querySelector(".app");
  shell.style.setProperty("--sidebar-width", `${widths.left}px`);
  shell.style.setProperty("--main-width", `${widths.main}px`);
  shell.style.setProperty("--assistant-width", `${widths.right}px`);
  if (app) {
    app.style.setProperty("--sidebar-width", `${widths.left}px`);
    app.style.setProperty("--main-width", `${widths.main}px`);
    app.style.setProperty("--assistant-width", `${widths.right}px`);
  }
  if (persist) saveShellLayout(widths.left, widths.right);
  resizeActiveCharts();
}

function applyShellLayout() {
  const shell = document.querySelector(".shell");
  if (!shell || window.matchMedia("(max-width: 860px)").matches) return;
  const total = shellAvailableWidth(shell);
  const saved = shellLayoutFromStorage();
  applyShellLayoutPixels(total * saved.leftRatio, total * saved.rightRatio, false);
}

function bindShellResizers() {
  document.querySelectorAll(".splitter").forEach(splitter => {
    splitter.addEventListener("pointerdown", event => {
      if (window.matchMedia("(max-width: 860px)").matches) return;
      const shell = document.querySelector(".shell");
      const sidebar = document.querySelector(".sidebar");
      const assistant = document.querySelector(".assistant");
      if (!shell || !sidebar) return;
      const isTheory = shell.classList.contains("theory") && !shell.classList.contains("theory-with-panel");
      const edge = splitter.dataset.resizeEdge;
      if (isTheory && edge === "right") return;
      shellResizeDrag = {
        edge,
        left: sidebar.getBoundingClientRect().width,
        right: isTheory ? 0 : assistant.getBoundingClientRect().width,
      };
      splitter.setPointerCapture(event.pointerId);
      splitter.classList.add("dragging");
      document.body.classList.add("resizing-shell");
      event.preventDefault();
    });
  });

  window.addEventListener("pointermove", event => {
    if (!shellResizeDrag) return;
    const shell = document.querySelector(".shell");
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    if (shellResizeDrag.edge === "left") {
      applyShellLayoutPixels(event.clientX - rect.left, shellResizeDrag.right, false);
    } else {
      applyShellLayoutPixels(shellResizeDrag.left, rect.right - event.clientX, false);
    }
  });

  window.addEventListener("pointerup", event => {
    if (!shellResizeDrag) return;
    document.querySelectorAll(".splitter.dragging").forEach(splitter => {
      try {
        if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
      } catch (err) {}
      splitter.classList.remove("dragging");
    });
    const shell = document.querySelector(".shell");
    const sidebar = document.querySelector(".sidebar");
    const assistant = document.querySelector(".assistant");
    if (shell && sidebar) {
      const isTheory = shell.classList.contains("theory") && !shell.classList.contains("theory-with-panel");
      saveShellLayout(
        sidebar.getBoundingClientRect().width,
        isTheory ? shellAvailableWidth(shell) * shellLayoutFromStorage().rightRatio : assistant.getBoundingClientRect().width
      );
    }
    shellResizeDrag = null;
    document.body.classList.remove("resizing-shell");
    resizeActiveCharts();
  });
}

document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  const page = btn.dataset.page;
  if (window.handleExperimentTestNavigation?.(page)) return;
  setPage(page);
}));
const jumpExperiment = $("jumpExperiment");
if (jumpExperiment) jumpExperiment.addEventListener("click", () => setPage("preprocess"));
window.addEventListener("resize", () => {
  applyShellLayout();
  resizeActiveCharts();
});
bindShellResizers();
applyShellLayout();
setPage("basic");
