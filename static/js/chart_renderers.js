function num(value, digits = 4) {
  return Number(value).toFixed(digits);
}

const BLUE_POINT = "rgba(37,99,235,.72)";
const BLUE_POINT_SOFT = "rgba(37,99,235,.42)";
const BLUE_POINT_MEDIUM = "rgba(37,99,235,.7)";

function scatterOption(scatter, line, xName, title, yName = "MEDV") {
  const safeXName = escapeHtml(xName);
  const safeYName = escapeHtml(yName);
  const points = scatter.x.map((x, i) => [x, scatter.y[i]]);
  const lineData = line.x.map((x, i) => [x, line.y[i]]);
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: safeXName, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: safeYName, nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    media: [
      {
        query: { maxWidth: 360 },
        option: {
          legend: { show: false },
          grid: { left: 42, right: 10, top: 18, bottom: 34 },
          xAxis: { nameGap: 20, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
          yAxis: { nameGap: 26, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
          series: [
            { symbolSize: 5 },
            { lineStyle: { width: 2.4 } }
          ]
        }
      },
      {
        query: { maxHeight: 260 },
        option: {
          legend: { show: false },
          grid: { left: 38, right: 8, top: 12, bottom: 28 },
          xAxis: { name: "", axisLabel: { fontSize: 9 } },
          yAxis: { name: "", axisLabel: { fontSize: 9 } },
          series: [
            { symbolSize: 4 },
            { lineStyle: { width: 2 } }
          ]
        }
      }
    ],
    series: [
      { name: "样本点", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: BLUE_POINT } },
      { name: "线性趋势", type: "line", data: lineData, showSymbol: false, lineStyle: { color: "#0f9f78", width: 3 } }
    ]
  };
}

function singleCorrOption(data) {
  const corr = data.raw.summary.corr;
  return singleCorrOptionFromData({ feature: data.feature, corr });
}

function singleCorrOptionFromData(data) {
  const corr = data.corr;
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 58, right: 28, top: 42, bottom: 46 },
    xAxis: { type: "category", data: [escapeHtml(data.feature)] },
    yAxis: { type: "value", min: -1, max: 1, name: "Pearson r" },
    media: [
      {
        query: { maxWidth: 360 },
        option: {
          grid: { left: 38, right: 8, top: 28, bottom: 36 },
          xAxis: { axisLabel: { fontSize: 10 } },
          yAxis: { nameGap: 20, nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
          series: [{ barWidth: 34, label: { fontSize: 10 } }]
        }
      },
      {
        query: { maxHeight: 260 },
        option: {
          grid: { left: 34, right: 8, top: 12, bottom: 26 },
          xAxis: { axisLabel: { fontSize: 9 } },
          yAxis: { name: "", axisLabel: { fontSize: 9 } },
          series: [{ barWidth: 28, label: { fontSize: 9 } }]
        }
      }
    ],
    series: [{ type: "bar", barWidth: 56, data: [{ value: corr, itemStyle: { color: corr >= 0 ? "#5b35f5" : "#d9354f" } }], label: { show: true, position: corr >= 0 ? "top" : "bottom", formatter: corr.toFixed(4), fontWeight: 900 } }]
  };
}

function allCorrOption(rows, currentFeature) {
  const ordered = [...rows].reverse();
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 84, right: 28, top: 42, bottom: 42 },
    xAxis: { type: "value", min: -1, max: 1, name: "Pearson r" },
    yAxis: { type: "category", data: ordered.map(r => escapeHtml(r.feature)) },
    media: [
      {
        query: { maxWidth: 360 },
        option: {
          grid: { left: 54, right: 8, top: 18, bottom: 26 },
          xAxis: { name: "", axisLabel: { fontSize: 10 } },
          yAxis: { axisLabel: { fontSize: 10 } },
          series: [{ barWidth: 10 }]
        }
      },
      {
        query: { maxHeight: 260 },
        option: {
          grid: { left: 48, right: 8, top: 12, bottom: 20 },
          xAxis: { name: "", axisLabel: { fontSize: 9 } },
          yAxis: { axisLabel: { fontSize: 9 } },
          series: [{ barWidth: 8 }]
        }
      }
    ],
    series: [{ type: "bar", barWidth: 14, data: ordered.map(r => ({ value: r.corr, itemStyle: { color: r.feature === currentFeature ? "#c47a11" : (r.corr >= 0 ? "#5b35f5" : "#d9354f") } })) }]
  };
}

function predictChartOption(data = null) {
  const d = data || predictData;
  const xColumn = escapeHtml(d.x_name || d.x_column);
  const target = escapeHtml(d.y_name || d.target || "MEDV");
  const points = Array.isArray(d.scatter) ? d.scatter : d.scatter.x.map((x, i) => [x, d.scatter.y[i]]);
  const lineData = Array.isArray(d.line) ? d.line : d.line.x.map((x, i) => [x, d.line.y[i]]);
  const predictPoint = d.predict_point || { x: d.model_x, y: d.prediction };
  const inputPoint = [predictPoint.x, predictPoint.y];
  const guideLine = [[d.model_x, 0], inputPoint];
  return {
    tooltip: {
      trigger: "item",
      formatter: p => {
        if (p.seriesName === "预测点") return `预测点<br>${xColumn}=${num(d.model_x, 4)}<br>${target}=${num(d.prediction, 2)}`;
        return `${escapeHtml(p.seriesName)}<br>x=${num(p.value[0], 4)}<br>${target}=${num(p.value[1], 2)}`;
      }
    },
    legend: { top: 12 },
    grid: { left: 58, right: 28, top: 56, bottom: 50 },
    xAxis: { type: "value", name: xColumn, nameLocation: "middle", nameGap: 30 },
    yAxis: { type: "value", name: target, nameLocation: "middle", nameGap: 40 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "样本点", type: "scatter", data: points, symbolSize: 7, itemStyle: { color: BLUE_POINT_SOFT } },
      { name: "回归线", type: "line", data: lineData, showSymbol: false, lineStyle: { color: "#0f9f78", width: 3 } },
      { name: "预测辅助线", type: "line", data: guideLine, showSymbol: false, lineStyle: { color: "#f59e0b", width: 2, type: "dashed" } },
      { name: "预测点", type: "scatter", data: [inputPoint], symbolSize: 16, itemStyle: { color: "#e23b5a", borderColor: "#fff", borderWidth: 3 } }
    ]
  };
}

function trainScatterOption(frameIndex, chartData = null) {
  const frame = chartData?.frame || trainData.history[frameIndex];
  const points = chartData?.scatter || trainData.scatter.x.map((x, i) => [x, trainData.scatter.y[i]]);
  const xColumn = escapeHtml(chartData?.x_name || trainData.x_column);
  const target = escapeHtml(chartData?.y_name || trainData.target || "MEDV");
  const currentLine = chartData?.current_line || lineForParams(frame.w, frame.b);
  const bestLine = chartData?.best_line || lineForParams(trainData.best.w, trainData.best.b);
  return {
    tooltip: { trigger: "item" },
    legend: { top: 12 },
    grid: { left: 58, right: 24, top: 56, bottom: 48 },
    xAxis: { type: "value", name: xColumn, nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: target, nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      { name: "样本点", type: "scatter", data: points, symbolSize: 6, itemStyle: { color: BLUE_POINT_MEDIUM } },
      { name: "当前回归线", type: "line", data: currentLine, showSymbol: false, lineStyle: { color: "#d9354f", width: 3 } },
      { name: "最优参考线", type: "line", data: bestLine, showSymbol: false, lineStyle: { color: "#0f9f78", width: 2.6, type: "dashed" } }
    ]
  };
}

function lossOption(frameIndex, chartData = null) {
  if (chartData?.data) return lineOption("学习准则：MSE Loss", chartData.y_name || "MSE", chartData.data, chartData.color || "#5b35f5");
  const rows = trainData.history.slice(0, frameIndex + 1);
  return lineOption("学习准则：MSE Loss", "MSE", rows.map(r => [r.epoch, r.loss]), "#5b35f5");
}

function paramPathOption(key, frameIndex, chartData = null) {
  if (chartData?.data) return lineOption(key === "w" ? "w 参数轨迹" : "b 参数轨迹", key, chartData.data, key === "w" ? "#0f9f78" : "#c47a11");
  const rows = trainData.history.slice(0, frameIndex + 1);
  return lineOption(key === "w" ? "w 参数轨迹" : "b 参数轨迹", key, rows.map(r => [r.epoch, r[key]]), key === "w" ? "#0f9f78" : "#c47a11");
}

function metricOption(key, frameIndex, chartData = null) {
  const rows = chartData?.data
    ? chartData.data.map(([epoch, value]) => ({ epoch, [key]: value }))
    : trainData.history.slice(0, frameIndex + 1);
  const current = chartData?.value ?? rows[rows.length - 1]?.[key] ?? 0;
  const config = metricGaugeConfig(key, rows);
  const trend = rows.map(r => [r.epoch, r[key]]);
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 42, right: 16, top: "62%", bottom: 28 },
    xAxis: { type: "value", name: "epoch", nameGap: 18, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: config.yMin, max: config.yMax, axisLabel: { fontSize: 10 } },
    series: [
      {
        name: config.label,
        type: "gauge",
        center: ["50%", "32%"],
        radius: "72%",
        startAngle: 205,
        endAngle: -25,
        min: config.min,
        max: config.max,
        splitNumber: 5,
        progress: {
          show: true,
          width: 12,
          itemStyle: { color: config.color }
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, "#e8ecf4"]]
          }
        },
        axisTick: { distance: -18, length: 4, lineStyle: { color: "#8b95a5", width: 1 } },
        splitLine: { distance: -20, length: 8, lineStyle: { color: "#8b95a5", width: 1.2 } },
        axisLabel: { distance: -7, color: "#6b7280", fontSize: 9 },
        pointer: { length: "58%", width: 4, itemStyle: { color: "#172033" } },
        anchor: { show: true, size: 7, itemStyle: { color: "#172033" } },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "34%"],
          fontSize: 22,
          fontWeight: 900,
          color: "#172033",
          formatter: () => Number(current).toFixed(2)
        },
        title: {
          offsetCenter: [0, "56%"],
          fontSize: 11,
          fontWeight: 800,
          color: "#6b7280"
        },
        data: [{ value: config.gaugeValue(current), name: config.label }]
      },
      {
        name: `${config.label}趋势`,
        type: "line",
        smooth: true,
        symbolSize: 4,
        data: trend,
        lineStyle: { color: config.color, width: 2.5 },
        itemStyle: { color: config.color },
        areaStyle: { color: config.color + "18" }
      }
    ]
  };
}

function metricGaugeConfig(key, rows) {
  const values = rows.map(r => Number(r[key])).filter(Number.isFinite);
  const maxValue = values.length ? Math.max(...values) : 1;
  const minValue = values.length ? Math.min(...values) : 0;
  if (key === "r2") {
    return {
      label: "R²",
      color: "#d9354f",
      min: -1,
      max: 1,
      yMin: Math.min(-1, Math.floor(minValue)),
      yMax: 1,
      gaugeValue: value => Math.max(-1, Math.min(1, value))
    };
  }
  const upper = Math.max(10, Math.ceil(maxValue / 10) * 10);
  return {
    label: key.toUpperCase(),
    color: key === "rmse" ? "#5b35f5" : "#0f9f78",
    min: 0,
    max: upper,
    yMin: 0,
    yMax: upper,
    gaugeValue: value => Math.max(0, Math.min(upper, value))
  };
}

function gradientDescentOption(frameIndex, chartData = null) {
  const rows = trainData.history.slice(0, frameIndex + 1);
  const dwData = chartData?.series?.dw || rows.map(r => [r.epoch, r.dw]);
  const dbData = chartData?.series?.db || rows.map(r => [r.epoch, r.db]);
  return {
    tooltip: { trigger: "axis" },
    grid: [
      { left: 48, right: 18, top: 42, height: "31%" },
      { left: 48, right: 18, top: "61%", height: "28%" }
    ],
    xAxis: [
      { type: "value", gridIndex: 0, axisLabel: { fontSize: 10 }, name: "epoch", nameGap: 18 },
      { type: "value", gridIndex: 1, axisLabel: { fontSize: 10 }, name: "epoch", nameGap: 18 }
    ],
    yAxis: [
      { type: "value", gridIndex: 0, name: "dw", nameGap: 8, nameTextStyle: { fontSize: 11, color: "#6b7280", align: "right", padding: [0, 4, 0, 0] }, axisLabel: { fontSize: 10, margin: 6 } },
      { type: "value", gridIndex: 1, name: "db", nameGap: 8, nameTextStyle: { fontSize: 11, color: "#6b7280", align: "right", padding: [0, 4, 0, 0] }, axisLabel: { fontSize: 10, margin: 6 } }
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], filterMode: "none" }
    ],
    series: [
      {
        name: "dw",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        smooth: true,
        symbolSize: 4,
        data: dwData,
        lineStyle: { color: "#5b35f5", width: 2.6 },
        itemStyle: { color: "#5b35f5" },
        areaStyle: { color: "#5b35f518" }
      },
      {
        name: "db",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 4,
        data: dbData,
        lineStyle: { color: "#0f9f78", width: 2.6 },
        itemStyle: { color: "#0f9f78" },
        areaStyle: { color: "#0f9f7818" }
      }
    ]
  };
}

function lossSurface3DOption(frameIndex, chartData = null) {
  const c = chartData?.contour || trainData.contour;
  const frame = chartData?.frame || trainData.history[frameIndex];
  const best = chartData?.best || trainData.best;
  const surfaceData = c.values.map(v => [c.w_axis[v[0]], c.b_axis[v[1]], v[2]]);
  const pathData = chartData?.path || trainData.history.slice(0, frameIndex + 1).map(r => [r.w, r.b, r.mse]);
  const bestZ = mseAtParams(best.w, best.b);
  const currentPoint = [frame.w, frame.b, frame.mse];
  const wTangent = tangentLine3D(frame, "w", c);
  const bTangent = tangentLine3D(frame, "b", c);
  const existingChart = charts.get("chart_loss_surface_3d");
  const hasExistingChart = Boolean(existingChart?.getOption?.()?.series?.length);

  const option = {
    tooltip: {
      formatter: p => {
        const v = Array.isArray(p.value) ? p.value : [];
        if (v.length >= 3) return `${p.seriesName}<br>w=${Number(v[0]).toFixed(3)}<br>b=${Number(v[1]).toFixed(3)}<br>MSE=${Number(v[2]).toFixed(3)}`;
        return p.seriesName;
      }
    },
    xAxis3D: { type: "value", name: "w" },
    yAxis3D: { type: "value", name: "b" },
    zAxis3D: { type: "value", name: "MSE" },
    grid3D: {
      left: "center",
      top: "middle",
      boxWidth: 105,
      boxDepth: 82,
      boxHeight: 62,
      axisLine: { lineStyle: { color: "#9aa3b2" } },
      axisPointer: { lineStyle: { color: "#5b35f5" } },
      light: {
        main: { intensity: 1.25, shadow: true },
        ambient: { intensity: 0.35 }
      }
    },
    series: [
      {
        name: "Loss surface",
        type: "surface",
        data: surfaceData,
        silent: true,
        wireframe: { show: true, lineStyle: { color: "rgba(91,53,245,.10)", width: 1 } },
        itemStyle: { color: "rgba(219,234,254,.58)", opacity: 0.58 },
        shading: "lambert"
      },
      {
        name: "parameter path",
        type: "line3D",
        data: pathData,
        lineStyle: { color: "#111827", width: 4 },
        zlevel: 2
      },
      {
        name: "current params",
        type: "scatter3D",
        data: [currentPoint],
        symbolSize: 15,
        itemStyle: { color: "#5b35f5", borderColor: "#fff", borderWidth: 2 }
      },
      {
        name: "best params",
        type: "scatter3D",
        data: [[best.w, best.b, bestZ]],
        symbolSize: 10,
        itemStyle: { color: "#0f9f78", borderColor: "#fff", borderWidth: 2 }
      },
      {
        name: "dJ/dw tangent",
        type: "line3D",
        data: wTangent,
        lineStyle: { color: "#7c3aed", width: 5, type: "dashed" }
      },
      {
        name: "dJ/db tangent",
        type: "line3D",
        data: bTangent,
        lineStyle: { color: "#00b894", width: 5, type: "dashed" }
      }
    ]
  };
  if (!hasExistingChart) {
    option.grid3D.viewControl = {
      projection: "perspective",
      alpha: 30,
      beta: 32,
      distance: 185,
      rotateSensitivity: 1,
      zoomSensitivity: 1.25,
      panSensitivity: 1.6
    };
  }
  return option;
}

function mseAtParams(w, b) {
  const xs = trainData?.scatter?.x || [];
  const ys = trainData?.scatter?.y || [];
  if (!xs.length || xs.length !== ys.length) return 0;
  let total = 0;
  for (let i = 0; i < xs.length; i++) {
    const err = w * xs[i] + b - ys[i];
    total += err * err;
  }
  return total / xs.length;
}

function tangentLine3D(frame, axis, c) {
  const wSpan = Math.max(...c.w_axis) - Math.min(...c.w_axis);
  const bSpan = Math.max(...c.b_axis) - Math.min(...c.b_axis);
  const delta = axis === "w" ? Math.max(wSpan * 0.12, 0.35) : Math.max(bSpan * 0.12, 1.2);
  const slope = axis === "w" ? frame.dw : frame.db;
  if (axis === "w") {
    return [
      [frame.w - delta, frame.b, frame.mse - slope * delta],
      [frame.w + delta, frame.b, frame.mse + slope * delta]
    ];
  }
  return [
    [frame.w, frame.b - delta, frame.mse - slope * delta],
    [frame.w, frame.b + delta, frame.mse + slope * delta]
  ];
}

function lineOption(title, yName, data, color) {
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 58, right: 24, top: 42, bottom: 42 },
    xAxis: { type: "value", name: "epoch" },
    yAxis: { type: "value", name: yName },
    dataZoom: [{ type: "inside", xAxisIndex: 0, filterMode: "none" }],
    series: [{ type: "line", smooth: true, symbolSize: 5, data, lineStyle: { color, width: 3 }, areaStyle: { color: color + "22" } }]
  };
}

function contourOption(frameIndex, chartData = null) {
  const c = chartData?.contour || trainData.contour;
  const frame = chartData?.frame || trainData.history[frameIndex];
  const best = chartData?.best || trainData.best;
  const path = chartData?.path || trainData.history.slice(0, frameIndex + 1).map(r => [r.w, r.b]);
  return {
    tooltip: {
      trigger: "item",
      formatter: p => {
        if (p.seriesName === "best_params") return `best params<br>w=${best.w.toFixed(3)}<br>b=${best.b.toFixed(3)}`;
        if (p.seriesName === "update_path") return `path<br>w=${p.value[0].toFixed(3)}<br>b=${p.value[1].toFixed(3)}`;
        return `current params<br>w=${frame.w.toFixed(3)}<br>b=${frame.b.toFixed(3)}<br>MSE=${frame.mse.toFixed(3)}`;
      }
    },
    grid: { left: 58, right: 28, top: 42, bottom: 48 },
    xAxis: { type: "value", name: "w", nameLocation: "middle", nameGap: 28 },
    yAxis: { type: "value", name: "b", nameLocation: "middle", nameGap: 38 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "inside", yAxisIndex: 0, filterMode: "none" }
    ],
    series: [
      ...lossContourSeries(c),
      {
        name: "update_path",
        type: "line",
        data: path,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#111827", width: 3 },
        itemStyle: { color: "#fff", borderColor: "#111827", borderWidth: 1.5 },
        z: 8
      },
      {
        name: "current_params",
        type: "scatter",
        data: [[frame.w, frame.b]],
        symbolSize: 18,
        itemStyle: { color: "#5b35f5", borderColor: "#fff", borderWidth: 3 },
        z: 10
      },
      {
        name: "best_params",
        type: "scatter",
        data: [[best.w, best.b]],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: "#0f9f78", borderColor: "#fff", borderWidth: 2 },
        z: 9
      }
    ]
  };
}

function lossContourSeries(c) {
  const levels = contourLevels(c.values, 11);
  const colors = ["#c7d2fe", "#93c5fd", "#60a5fa", "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#fb7185", "#f43f5e", "#be123c", "#881337"];
  return levels.map((level, index) => ({
    name: `loss_level_${index + 1}`,
    type: "lines",
    coordinateSystem: "cartesian2d",
    polyline: false,
    silent: true,
    data: contourSegments(c, level),
    lineStyle: {
      color: colors[index % colors.length],
      width: index === 0 ? 1.5 : 1.8,
      opacity: 0.9
    },
    z: 2
  })).filter(series => series.data.length);
}

function contourLevels(values, count) {
  const sorted = values.map(v => Number(v[2])).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const levels = [];
  for (let i = 0; i < count; i++) {
    const p = 0.06 + (0.88 * i) / Math.max(1, count - 1);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    const level = sorted[idx];
    if (!levels.some(v => Math.abs(v - level) <= Math.max(1e-9, Math.abs(level) * 1e-8))) levels.push(level);
  }
  return levels;
}

function contourSegments(c, level) {
  const cols = c.w_axis.length;
  const rows = c.b_axis.length;
  const z = Array.from({ length: rows }, () => Array(cols).fill(NaN));
  c.values.forEach(([j, i, value]) => {
    if (i >= 0 && i < rows && j >= 0 && j < cols) z[i][j] = value;
  });

  const segments = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const p00 = [c.w_axis[j], c.b_axis[i], z[i][j]];
      const p10 = [c.w_axis[j + 1], c.b_axis[i], z[i][j + 1]];
      const p11 = [c.w_axis[j + 1], c.b_axis[i + 1], z[i + 1][j + 1]];
      const p01 = [c.w_axis[j], c.b_axis[i + 1], z[i + 1][j]];
      const points = [
        contourEdgePoint(p00, p10, level),
        contourEdgePoint(p10, p11, level),
        contourEdgePoint(p11, p01, level),
        contourEdgePoint(p01, p00, level)
      ].filter(Boolean);

      if (points.length === 2) {
        segments.push({ coords: points });
      } else if (points.length === 4) {
        segments.push({ coords: [points[0], points[1]] }, { coords: [points[2], points[3]] });
      }
    }
  }
  return segments;
}

function contourEdgePoint(a, b, level) {
  const z1 = a[2];
  const z2 = b[2];
  if (!Number.isFinite(z1) || !Number.isFinite(z2) || z1 === z2) return null;
  const crosses = (level >= Math.min(z1, z2)) && (level <= Math.max(z1, z2));
  if (!crosses) return null;
  const t = (level - z1) / (z2 - z1);
  return [
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1])
  ];
}
