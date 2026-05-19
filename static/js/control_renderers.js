function optionHtml(value, selected, label = value, disabled = false) {
  return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}${disabled ? " disabled" : ""}>${escapeHtml(label)}</option>`;
}

function checkboxRowHtml(name, value, label, checked = false, disabled = false) {
  return `<label class="check-row"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}> ${escapeHtml(label)}</label>`;
}

function checkboxOptionsHtml(name, options, standardizedReady = true) {
  return (options || []).map(opt => {
    const disabled = opt.requires_standardized && !standardizedReady;
    const label = disabled ? `${opt.label}（先完成预处理）` : opt.label;
    return checkboxRowHtml(name, opt.value, label, Boolean(opt.default) && !disabled, disabled);
  }).join("");
}

function trainViewChoicesHtml() {
  return trainChartRegistry.map(chart => checkboxRowHtml("trainViews", chart.id, chart.title, Boolean(chart.default))).join("");
}

function controlType(control) {
  if (!control) return "";
  if (control.type === "feature_picker") return "select";
  if (control.type === "target_picker") return "select";
  if (control.type === "dataset_variant") return "select";
  if (control.type === "view_picker") return "chart_selector";
  if (control.type === "action_button") return "button";
  return control.type;
}

function isControlType(control, type) {
  return controlType(control) === type;
}

function trainSourceOptions(source, schema) {
  if (source === "feature_columns") return (schema.sources?.feature_columns || FEATURE_NAMES).map(item => ({ label: item, value: item }));
  if (source === "target_columns") return (schema.sources?.target_columns || []).map(item => ({ label: item, value: item }));
  if (source === "numeric_columns") return (schema.sources?.numeric_columns || []).map(item => ({ label: item, value: item }));
  if (source === "dataset_variants") return (schema.sources?.dataset_variants || []).map(item => ({ label: item.label || item.id, value: item.id }));
  return [];
}

function trainControlDefault(control, schema) {
  if (control.name === "feature") return currentFeature();
  if (control.name === "feature_count") return schema.sources?.feature_count || FEATURE_NAMES.length;
  if (control.default_source && schema.sources && Object.prototype.hasOwnProperty.call(schema.sources, control.default_source)) return schema.sources[control.default_source];
  if (control.name && schema.defaults && Object.prototype.hasOwnProperty.call(schema.defaults, control.name)) {
    const value = schema.defaults[control.name];
    if (value && typeof value === "object" && value.source && schema.sources) return schema.sources[value.source];
    return value;
  }
  return control.default;
}

function trainControlValueAttr(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  return value ?? "";
}

function formatTrainControlValue(control, value) {
  if (control.format === "fixed3") return Number(value).toFixed(3);
  return `${value}${control.suffix || ""}`;
}

const trainControlRenderers = {
  stat(control, schema) {
    const value = trainControlDefault(control, schema) ?? "--";
    return `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">${escapeHtml(value)}</strong></div>`;
  },
  runtime_stat(control) {
    return `<div><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">--</strong></div>`;
  },
  select(control, schema) {
    const value = trainControlDefault(control, schema);
    const options = control.options || trainSourceOptions(control.source, schema);
    return `
      <label class="control-label" for="${escapeHtml(control.element_id)}">${escapeHtml(control.label)}</label>
      <select id="${escapeHtml(control.element_id)}" data-control="${escapeHtml(control.name)}" ${control.auto_prepare ? "data-auto-prepare=\"1\"" : ""}>
        ${options.map(opt => {
          const label = opt.label ?? opt;
          const rawValue = opt.value ?? opt;
          const optionValue = trainControlValueAttr(rawValue);
          return `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(trainControlValueAttr(value)) ? "selected" : ""}>${escapeHtml(label)}</option>`;
        }).join("")}
      </select>`;
  },
  chart_selector(control) {
    return `
      <label class="control-label">${escapeHtml(control.label)}</label>
      <details class="mode-menu">
        <summary id="${escapeHtml(control.summary_id)}">已选择 1 项</summary>
        <div class="check-list">${trainViewChoicesHtml()}</div>
      </details>`;
  },
  number(control, schema) {
    const value = trainControlDefault(control, schema) ?? 0;
    return `
      <label class="control-label">${escapeHtml(control.label)}
        <input id="${escapeHtml(control.element_id)}" data-control="${escapeHtml(control.name)}" ${control.auto_prepare ? "data-auto-prepare=\"1\"" : ""} type="number" value="${escapeHtml(value)}" step="${escapeHtml(control.step || 1)}">
      </label>`;
  },
  range(control, schema) {
    const value = trainControlDefault(control, schema);
    return `
      <label class="control-label" for="${escapeHtml(control.element_id)}">${escapeHtml(control.label)}</label>
      <div class="range-control">
        <input id="${escapeHtml(control.element_id)}" data-control="${escapeHtml(control.name)}" ${control.auto_prepare ? "data-auto-prepare=\"1\"" : ""} type="range" min="${escapeHtml(control.min)}" max="${escapeHtml(control.max)}" step="${escapeHtml(control.step || 1)}" value="${escapeHtml(value)}">
        <div class="range-stepper" aria-label="${escapeHtml(control.label)}微调">
          <button class="range-step-btn" type="button" data-step-target="${escapeHtml(control.element_id)}" data-step-dir="1" aria-label="增加${escapeHtml(control.label)}">▲</button>
          <button class="range-step-btn" type="button" data-step-target="${escapeHtml(control.element_id)}" data-step-dir="-1" aria-label="减少${escapeHtml(control.label)}">▼</button>
        </div>
      </div>
      <div class="range-line"><span>${escapeHtml(control.min_label ?? control.min)}</span><strong id="${escapeHtml(control.value_id)}">${escapeHtml(formatTrainControlValue(control, value))}</strong><span>${escapeHtml(control.max_label ?? control.max)}</span></div>`;
  },
  button(control) {
    return `<button class="btn ${escapeHtml(control.style || "primary")}" type="button" id="${escapeHtml(control.element_id)}">${escapeHtml(control.label)}</button>`;
  },
};

function findTrainControl(name) {
  const sections = trainPageSchema?.panel?.sections || [];
  for (const section of sections) {
    const found = (section.controls || []).find(control => control.name === name);
    if (found) return found;
  }
  return null;
}

function renderPreprocessPanelLegacy(schema) {
  const dataset = schema.panel.sections.find(section => section.id === "dataset") || { controls: [] };
  const display = schema.panel.sections.find(section => section.id === "display") || { controls: [] };
  const stats = dataset.controls.filter(control => isControlType(control, "stat"));
  const feature = dataset.controls.find(control => control.name === "feature");
  const selector = display.controls.find(control => isControlType(control, "chart_selector"));
  const datasetLoaded = Boolean(currentDatasetMeta);
  const selectorOptions = schema.charts?.length
    ? schema.charts.map(chart => ({ label: chart.title, value: chart.id, default: Boolean(chart.default) }))
    : selector.options;
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const datasetStatus = datasetLoaded ? "已加载" : "未加载";
  const sampleCount = datasetLoaded ? (currentDatasetMeta?.row_count ?? "--") : "--";
  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card">
      <div class="control-group" aria-label="Dataset source">
        <label class="control-label" for="datasetSource">数据集来源</label>
        <select id="datasetSource">
          <option value="boston_housing">Boston Housing</option>
          <option value="upload_csv">上传 CSV</option>
        </select>
        <input id="datasetFile" type="file" accept=".csv,text/csv" style="display:none">
        <div class="btn-row">
          <button class="primary-btn" id="loadDatasetBtn" type="button">加载数据集</button>
        </div>
        <div class="status-line hidden" id="datasetLoadMessage"></div>
      </div>
      <div class="mini-stats">
        ${stats.map(control => `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">${escapeHtml(statValue(control))}</strong></div>`).join("")}
      </div>
      <div class="control-group" aria-label="${escapeHtml(feature.label)}">
        <label class="control-label" for="${escapeHtml(feature.element_id)}">${escapeHtml(feature.label)}</label>
        <select id="${escapeHtml(feature.element_id)}">${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="${escapeHtml(selector.label)}">
        <label class="control-label">${escapeHtml(selector.label)}</label>
        <details class="mode-menu">
          <summary id="${escapeHtml(selector.summary_id)}">已选择 1 项</summary>
          <div class="check-list">${checkboxOptionsHtml(selector.name, selectorOptions)}</div>
        </details>
      </div>
    </div>`;
}

function renderPreprocessPanel(schema) {
  const dataset = schema.panel.sections.find(section => section.id === "dataset") || { controls: [] };
  const display = schema.panel.sections.find(section => section.id === "display") || { controls: [] };
  const stats = dataset.controls.filter(control => isControlType(control, "stat"));
  const feature = dataset.controls.find(control => control.name === "feature");
  const selector = display.controls.find(control => isControlType(control, "chart_selector"));
  const datasetLoaded = Boolean(currentDatasetMeta);
  const selectorOptions = schema.charts?.length
    ? schema.charts.map(chart => ({ label: chart.title, value: chart.id, default: Boolean(chart.default) }))
    : selector.options;
  const featureOptions = datasetLoaded ? (currentDatasetMeta?.features || []) : [];
  const selectedFeature = dataCache?.feature || featureOptions[0] || "";
  const featureOptionsHtml = featureOptions
    .map(opt => optionHtml(opt, selectedFeature, opt))
    .join("");
  const datasetStatus = datasetLoaded ? "已加载" : "未加载";
  const sampleCount = datasetLoaded ? (currentDatasetMeta?.row_count ?? "--") : "--";
  const featureLabel = feature?.label || "特征选择";
  const featureId = feature?.element_id || "dataFeature";
  const selectorLabel = selector?.label || "显示模式";
  const selectorName = selector?.name || "dataViews";
  const selectorSummary = selector?.summary_id || "dataModeSummary";
  const statValue = control => {
    if (!datasetLoaded) return "--";
    if (control.value_id === "sampleCount") return currentDatasetMeta?.row_count ?? "--";
    if (control.value_id === "featureCount") return currentDatasetMeta?.features?.length ?? "--";
    return control.default ?? "--";
  };
  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card dataset-load-card">
      <h3>加载数据集</h3>
      <select id="datasetSource" aria-label="选择数据集">
        <option value="boston_housing">Boston 原始数据集</option>
      </select>
      <div class="btn-row">
        <button class="primary-btn" id="loadDatasetBtn" type="button">加载数据集</button>
      </div>
      <div class="status-line hidden" id="datasetLoadMessage"></div>
    </div>
    <details class="control-card stage-card" ${datasetLoaded ? "open" : ""}>
      <summary><strong>预处理设置</strong><span class="stage-badge">${datasetLoaded ? "可用" : "待加载"}</span></summary>
      <div class="mini-stats">
        ${stats.map(control => `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">${escapeHtml(control.default ?? "--")}</strong></div>`).join("")}
      </div>
      <div class="control-group" aria-label="${escapeHtml(featureLabel)}">
        <label class="control-label" for="${escapeHtml(featureId)}">${escapeHtml(featureLabel)}</label>
        <select id="${escapeHtml(featureId)}" ${datasetLoaded ? "" : "disabled"}>${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="${escapeHtml(selectorLabel)}">
        <label class="control-label">${escapeHtml(selectorLabel)}</label>
        <details class="mode-menu">
          <summary id="${escapeHtml(selectorSummary)}">已选择 1 项</summary>
          <div class="check-list">${checkboxOptionsHtml(selectorName, selectorOptions)}</div>
        </details>
      </div>
    </details>`;
}

function renderPredictPanel(schema) {
  const result = schema.panel.sections.find(section => section.id === "result") || { controls: [] };
  const input = schema.panel.sections.find(section => section.id === "input") || { controls: [] };
  const display = schema.panel.sections.find(section => section.id === "display") || { controls: [] };
  const actions = schema.panel.sections.find(section => section.id === "actions") || { controls: [] };
  const stats = result.controls.filter(control => isControlType(control, "stat"));
  const controls = input.controls || [];
  const feature = controls.find(control => control.name === "feature");
  const std = controls.find(control => control.name === "use_standardized");
  const inputValue = controls.find(control => control.name === "input_value");
  const selector = display.controls.find(control => isControlType(control, "chart_selector"));
  const selectorOptions = schema.charts?.length
    ? schema.charts.map(chart => ({ label: chart.title, value: chart.id, default: Boolean(chart.default) }))
    : selector.options;
  const run = actions.controls.find(control => isControlType(control, "button"));
  const featureOptionsHtml = trainSourceOptions(feature?.source, schema)
    .map(opt => optionHtml(opt.value, currentFeature(), opt.label))
    .join("");
  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card">
      <div class="mini-stats">
        ${stats.map(control => `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">--</strong></div>`).join("")}
      </div>
      <div class="control-group" aria-label="当前模型">
        <label class="control-label">当前模型</label>
        <div class="formula-box" id="predictModelStatus">请先在“模型训练与评估”页完成一次训练。</div>
      </div>
      <div class="control-group" aria-label="预测数据设置">
        <label class="control-label" for="${escapeHtml(std.element_id)}">${escapeHtml(std.label)}</label>
        <select id="${escapeHtml(std.element_id)}">
          ${(std.options || []).map(opt => `<option value="${escapeHtml(trainControlValueAttr(opt.value))}" ${opt.value === std.default ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}
        </select>
        <label class="control-label" for="${escapeHtml(feature.element_id)}">${escapeHtml(feature.label)}</label>
        <select id="${escapeHtml(feature.element_id)}">${featureOptionsHtml}</select>
      </div>
      <div class="control-group" aria-label="${escapeHtml(inputValue.label)}">
        <div class="field-grid">
          <label class="control-label" for="predictInputMode">输入类型
            <select id="predictInputMode">
              <option value="raw">原始特征</option>
              <option value="standardized">标准化特征</option>
            </select>
          </label>
          <label class="control-label" for="${escapeHtml(inputValue.element_id)}">${escapeHtml(inputValue.label)}
            <input id="${escapeHtml(inputValue.element_id)}" type="number" value="${escapeHtml(inputValue.default)}" step="${escapeHtml(inputValue.step || 1)}">
          </label>
        </div>
      </div>
      <div class="control-group" aria-label="${escapeHtml(selector.label)}">
        <label class="control-label">${escapeHtml(selector.label)}</label>
        <details class="mode-menu">
          <summary id="${escapeHtml(selector.summary_id)}">已选择 ${selectorOptions.filter(opt => opt.default).length || selectorOptions.length} 项</summary>
          <div class="check-list">${checkboxOptionsHtml(selector.name, selectorOptions)}</div>
        </details>
      </div>
      <div class="btn-row">
        <button class="${escapeHtml(run.style || "primary-btn")}" id="${escapeHtml(run.element_id)}" type="button">${escapeHtml(run.label)}</button>
      </div>
    </div>`;
}

function renderTrainControlPanel(schema) {
  const sections = schema.panel.sections || [];
  const datasetSection = sections.find(section => section.id === "dataset");
  const displaySection = sections.find(section => section.id === "display");
  const paramsSection = sections.find(section => section.id === "params");
  const actionSection = sections.find(section => section.id === "actions");
  const runtimeSection = sections.find(section => section.id === "runtime");
  const statControls = (datasetSection?.controls || []).filter(control => isControlType(control, "stat"));
  const datasetControls = (datasetSection?.controls || []).filter(control => !isControlType(control, "stat"));
  const renderControl = control => trainControlRenderers[controlType(control)]?.(control, schema) || "";
  const renderControlGroup = controls => {
    const html = [];
    for (let i = 0; i < controls.length; i += 1) {
      const control = controls[i];
      if (control.group === "init_params") {
        const groupControls = controls.filter(item => item.group === control.group);
        html.push(`<div class="field-grid">${groupControls.map(renderControl).join("")}</div>`);
        i += groupControls.length - 1;
        continue;
      }
      html.push(renderControl(control));
    }
    return html.join("");
  };
  const renderBox = (title, controls) => {
    if (!controls?.length) return "";
    return `<div class="control-group" aria-label="${escapeHtml(title)}">${renderControlGroup(controls)}</div>`;
  };
  const initParamControls = (paramsSection?.controls || []).filter(control => control.group === "init_params");
  const trainParamControls = (paramsSection?.controls || []).filter(control => control.group !== "init_params");

  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card">
      ${statControls.length ? `<div class="mini-stats">${statControls.map(renderControl).join("")}</div>` : ""}
      ${renderBox("数据设置", datasetControls)}
      ${renderBox("显示内容", displaySection?.controls || [])}
      ${renderBox("初始参数", initParamControls)}
      ${renderBox("训练控制", trainParamControls)}
      <div class="button-grid">${(actionSection?.controls || []).map(renderControl).join("")}</div>
      <div class="runtime">${(runtimeSection?.controls || []).map(renderControl).join("")}</div>
    </div>`;
}

function bindTrainControlPanel() {
  document.querySelectorAll('input[type="range"][data-control]').forEach(el => {
    el.addEventListener("input", () => {
      const control = findTrainControl(el.dataset.control);
      const valueEl = control?.value_id ? $(control.value_id) : null;
      if (valueEl) valueEl.textContent = formatTrainControlValue(control, el.value);
    });
  });
  bindRangeStepperButtons();
}

function bindRangeStepperButtons() {
  document.querySelectorAll(".range-step-btn[data-step-target]").forEach(btn => {
    if (btn.dataset.stepBound === "1") return;
    btn.dataset.stepBound = "1";
    btn.addEventListener("click", () => {
      const el = $(btn.dataset.stepTarget);
      if (!el) return;
      const step = Number(el.step || 1);
      const dir = Number(btn.dataset.stepDir || 1);
      const min = Number(el.min);
      const max = Number(el.max);
      const current = Number(el.value || 0);
      const next = Math.min(max, Math.max(min, current + step * dir));
      el.value = Number.isInteger(step) ? String(Math.round(next)) : next.toFixed(String(el.step).split(".")[1]?.length || 0);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

