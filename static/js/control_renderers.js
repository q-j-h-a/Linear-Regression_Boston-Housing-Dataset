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

function trainSourceOptions(source, schema) {
  if (source === "feature_columns") return (schema.sources?.feature_columns || FEATURE_NAMES).map(item => ({ label: item, value: item }));
  return [];
}

function trainControlDefault(control, schema) {
  if (control.name === "feature") return currentFeature();
  if (control.name === "feature_count") return schema.sources?.feature_count || FEATURE_NAMES.length;
  if (control.name && schema.defaults && Object.prototype.hasOwnProperty.call(schema.defaults, control.name)) return schema.defaults[control.name];
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

function renderPreprocessPanel(schema) {
  const dataset = schema.panel.sections.find(section => section.id === "dataset") || { controls: [] };
  const display = schema.panel.sections.find(section => section.id === "display") || { controls: [] };
  const stats = dataset.controls.filter(control => control.type === "stat");
  const feature = dataset.controls.find(control => control.name === "feature");
  const selector = display.controls.find(control => control.type === "chart_selector");
  const selectorOptions = schema.charts?.length
    ? schema.charts.map(chart => ({ label: chart.title, value: chart.id, default: Boolean(chart.default) }))
    : selector.options;
  const featureOptionsHtml = trainSourceOptions(feature?.source, schema)
    .map(opt => optionHtml(opt.value, currentFeature(), opt.label))
    .join("");
  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card">
      <div class="mini-stats">
        ${stats.map(control => `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">${escapeHtml(control.default ?? "--")}</strong></div>`).join("")}
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

function renderPredictPanel(schema) {
  const result = schema.panel.sections.find(section => section.id === "result") || { controls: [] };
  const input = schema.panel.sections.find(section => section.id === "input") || { controls: [] };
  const display = schema.panel.sections.find(section => section.id === "display") || { controls: [] };
  const actions = schema.panel.sections.find(section => section.id === "actions") || { controls: [] };
  const stats = result.controls.filter(control => control.type === "stat");
  const controls = input.controls || [];
  const feature = controls.find(control => control.name === "feature");
  const std = controls.find(control => control.name === "use_standardized");
  const inputValue = controls.find(control => control.name === "input_value");
  const selector = display.controls.find(control => control.type === "chart_selector");
  const selectorOptions = schema.charts?.length
    ? schema.charts.map(chart => ({ label: chart.title, value: chart.id, default: Boolean(chart.default) }))
    : selector.options;
  const run = actions.controls.find(control => control.type === "button");
  const featureOptionsHtml = trainSourceOptions(feature?.source, schema)
    .map(opt => optionHtml(opt.value, currentFeature(), opt.label))
    .join("");
  return `
    <div class="right-title">${escapeHtml(schema.panel.title || "控制面板")}</div>
    <div class="control-card">
      <div class="mini-stats">
        ${stats.map(control => `<div class="mini-stat"><span>${escapeHtml(control.label)}</span><strong id="${escapeHtml(control.value_id)}">--</strong></div>`).join("")}
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
        <label class="control-label" for="${escapeHtml(inputValue.element_id)}">${escapeHtml(inputValue.label)}</label>
        <input id="${escapeHtml(inputValue.element_id)}" type="number" value="${escapeHtml(inputValue.default)}" step="${escapeHtml(inputValue.step || 1)}">
      </div>
      <div class="control-group" aria-label="${escapeHtml(selector.label)}">
        <label class="control-label">${escapeHtml(selector.label)}</label>
        <details class="mode-menu">
          <summary id="${escapeHtml(selector.summary_id)}">已选择 4 项</summary>
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
  const statControls = (datasetSection?.controls || []).filter(control => control.type === "stat");
  const datasetControls = (datasetSection?.controls || []).filter(control => control.type !== "stat");
  const renderControl = control => trainControlRenderers[control.type]?.(control, schema) || "";
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

function studentPanelSection(id) {
  return studentPageSchema?.panel?.sections?.find(section => section.id === id) || null;
}

function studentSelectorOptions(id) {
  return studentPanelSection(id)?.controls?.find(control => control.type === "chart_selector")?.options || [];
}

function studentViewChoicesHtml(sectionId, name, standardizedReady = true) {
  return checkboxOptionsHtml(name, studentSelectorOptions(sectionId), standardizedReady);
}

function studentPanelTitle() {
  return studentPageSchema?.panel?.title || "自主实验";
}

function applyStudentSchemaPanelParts(standardizedReady) {
  const title = document.querySelector("#rightPanel .right-title");
  if (title) title.textContent = studentPanelTitle();

  const replaceChoices = (name, sectionId, ready = true) => {
    const first = document.querySelector(`input[name="${name}"]`);
    const list = first?.closest(".check-list");
    const html = studentViewChoicesHtml(sectionId, name, ready);
    if (list && html) list.innerHTML = html;
  };

  replaceChoices("studentDataViews", "data_views", standardizedReady);
  replaceChoices("studentTrainViews", "train_views", true);
  replaceChoices("studentPredictViews", "predict_views", true);
}

function studentPanelHtml() {
  const columns = studentMeta?.numeric_columns || [];
  const target = studentTargetValue(columns);
  const features = columns.filter(col => col !== target);
  const selectedFeatureSet = studentFeatureSet(features, target);
  const selectedFeatureCount = selectedFeatureSet.size;
  const standardizedReady = studentStandardizedReady();
  const stdValue = studentStdSelectValue();
  const stdOptionLabel = standardizedReady ? "标准化特征" : "标准化特征（先完成预处理）";
  const datasetStatus = studentMeta ? "已加载" : "未加载";
  const preprocessStatus = standardizedReady ? (studentData ? "已预处理" : "标准化可用") : (studentData ? "已查看原始" : (studentMeta ? "待执行" : "未就绪"));
  const trainStatus = studentTrainData ? (studentTrainDirty ? "需重新准备" : `epoch ${studentCurrentFrame}`) : "未训练";
  const predictStatus = studentPredictData ? "已预测" : "待预测";
  return `
    <div class="right-title">${escapeHtml(studentPanelTitle())}</div>
    <details class="control-card student-stage-card" open>
      <summary><h3>01 数据集</h3><span class="section-status ${studentMeta ? "ready" : ""}">${datasetStatus}</span></summary>
      <div class="control-group" aria-label="上传 CSV 数据集">
        <label class="control-label" for="studentFile">上传 CSV 数据集</label>
        <input id="studentFile" type="file" accept=".csv,text/csv">
      </div>
      <div class="control-group" aria-label="数据类型">
        <label class="control-label" for="studentSourceType">数据类型</label>
        <select id="studentSourceType">
          <option value="raw">原始数据集</option>
          <option value="standardized">已预处理数据集</option>
        </select>
        <div class="btn-row">
          <button class="primary-btn" id="studentUploadBtn" type="button">加载数据集</button>
        </div>
      </div>
      <div class="runtime">
        <div><span>数据状态</span><strong id="studentStatus">${studentMeta ? "已加载" : "未加载"}</strong></div>
        <div><span>样本数量</span><strong>${escapeHtml(studentMeta?.row_count ?? "--")}</strong></div>
      </div>
      <div class="status-line hidden" id="studentUploadMessage"></div>
    </details>
    ${studentMeta ? `
    <details class="control-card student-stage-card">
      <summary><h3>02 字段设置</h3><span class="section-status ready">${selectedFeatureCount} 个特征</span></summary>
      <div class="control-group" aria-label="目标列 y">
        <label class="control-label" for="studentTarget">目标列 y</label>
        <select id="studentTarget">${columns.map(col => optionHtml(col, target)).join("")}</select>
      </div>
      <div class="control-group" aria-label="特征列 x">
        <label class="control-label">特征列 x</label>
        <div class="check-list" id="studentFeatureChecks" style="max-height:230px;overflow:auto">
          ${features.map(col => checkboxRowHtml("studentFeatures", col, col, selectedFeatureSet.has(col))).join("")}
        </div>
        <label class="control-label" for="studentFeature">当前观察/训练特征</label>
        <select id="studentFeature"></select>
      </div>
    </details>
    <details class="control-card student-stage-card" open>
      <summary><h3>03 数据预处理</h3><span class="section-status ${studentData ? "ready" : ""}">${preprocessStatus}</span></summary>
      <div class="button-grid">
        <button class="btn dark" id="studentPrepareDataBtn" type="button">准备预处理</button>
        <button class="btn green" id="studentPreprocessBtn" type="button">预处理</button>
        <button class="btn primary" id="studentDataBtn" type="button">看数据</button>
      </div>
      <div class="control-group" aria-label="显示图表">
        <label class="control-label">显示图表</label>
        <details class="mode-menu">
          <summary id="studentDataModeSummary">${standardizedReady ? "已选择 3 项" : "已选择 2 项"}</summary>
          <div class="check-list">
            ${studentViewChoicesHtml("data_views", "studentDataViews", standardizedReady)}
          </div>
        </details>
      </div>
    </details>
    <details class="control-card student-stage-card" open>
      <summary><h3>04 模型训练与评估</h3><span class="section-status ${studentTrainData && !studentTrainDirty ? "ready" : studentTrainDirty ? "warn" : ""}">${trainStatus}</span></summary>
      <div class="control-group" aria-label="训练数据版本">
        <label class="control-label" for="studentStd">训练数据版本</label>
        <select id="studentStd">
          ${optionHtml("0", stdValue, "原始特征")}
          ${optionHtml("1", stdValue, stdOptionLabel, !standardizedReady)}
        </select>
      </div>
      <div class="control-group" aria-label="训练图表">
        <label class="control-label">训练图表</label>
        <details class="mode-menu">
          <summary id="studentTrainModeSummary">已选择 2 项</summary>
          <div class="check-list">
            ${studentViewChoicesHtml("train_views", "studentTrainViews")}
          </div>
        </details>
      </div>
      <div class="control-group" aria-label="初始参数">
        <div class="field-grid">
          <label class="control-label">初始 w<input id="studentW0" type="number" value="0" step="0.1"></label>
          <label class="control-label">初始 b<input id="studentB0" type="number" value="0" step="0.1"></label>
        </div>
      </div>
      <div class="control-group" aria-label="训练控制">
        <label class="control-label" for="studentLr">学习率</label>
        <div class="range-control">
          <input id="studentLr" type="range" min="0.001" max="0.2" step="0.001" value="0.03">
          <div class="range-stepper" aria-label="学习率微调">
            <button class="range-step-btn" type="button" data-step-target="studentLr" data-step-dir="1" aria-label="增加学习率">▲</button>
            <button class="range-step-btn" type="button" data-step-target="studentLr" data-step-dir="-1" aria-label="减少学习率">▼</button>
          </div>
        </div>
        <div class="range-line"><span>0.001</span><strong id="studentLrText">0.030</strong><span>0.200</span></div>
        <label class="control-label" for="studentEpochs">训练轮数</label>
        <div class="range-control">
          <input id="studentEpochs" type="range" min="1" max="500" step="1" value="120">
          <div class="range-stepper" aria-label="训练轮数微调">
            <button class="range-step-btn" type="button" data-step-target="studentEpochs" data-step-dir="1" aria-label="增加训练轮数">▲</button>
            <button class="range-step-btn" type="button" data-step-target="studentEpochs" data-step-dir="-1" aria-label="减少训练轮数">▼</button>
          </div>
        </div>
        <div class="range-line"><span>1</span><strong id="studentEpochsText">120</strong><span>500</span></div>
        <label class="control-label" for="studentSpeed">动画速度</label>
        <div class="range-control">
          <input id="studentSpeed" type="range" min="30" max="600" step="10" value="90">
          <div class="range-stepper" aria-label="动画速度微调">
            <button class="range-step-btn" type="button" data-step-target="studentSpeed" data-step-dir="1" aria-label="增加动画速度">▲</button>
            <button class="range-step-btn" type="button" data-step-target="studentSpeed" data-step-dir="-1" aria-label="减少动画速度">▼</button>
          </div>
        </div>
        <div class="range-line"><span>快</span><strong id="studentSpeedText">90ms</strong><span>慢</span></div>
      </div>
      <div class="button-grid">
        <button class="btn primary" id="studentTrainBtn" type="button">准备训练</button>
        <button class="btn rose" id="studentResetBtn" type="button">重置</button>
        <button class="btn green" id="studentStepBtn" type="button">训练一轮</button>
        <button class="btn dark" id="studentAutoBtn" type="button">自动训练</button>
        <button class="btn dark" id="studentPauseBtn" type="button">暂停</button>
      </div>
      <div class="runtime">
        <div><span>当前 epoch</span><strong id="studentEpochNow">--</strong></div>
        <div><span>当前 Loss</span><strong id="studentLossNow">--</strong></div>
      </div>
    </details>
    <details class="control-card student-stage-card">
      <summary><h3>05 模型预测</h3><span class="section-status ${studentPredictData ? "ready" : ""}">${predictStatus}</span></summary>
      <div class="control-group" aria-label="预测输入值">
        <label class="control-label" for="studentPredictInput">预测输入值</label>
        <input id="studentPredictInput" type="number" value="0" step="0.1">
      </div>
      <div class="control-group" aria-label="显示图表">
        <label class="control-label">显示图表</label>
        <details class="mode-menu">
          <summary id="studentPredictModeSummary">已选择 2 项</summary>
          <div class="check-list">
            ${studentViewChoicesHtml("predict_views", "studentPredictViews")}
          </div>
        </details>
      </div>
      <div class="btn-row">
        <button class="btn dark" id="studentPreparePredictBtn" type="button">准备预测</button>
        <button class="primary-btn" id="studentPredictBtn" type="button">开始预测</button>
      </div>
    </details>` : ""}
  `;
}
