const DEFAULT_EXPERIMENT_ID = "simple_linear_regression";

function currentExperimentId() {
  return window.currentExperiment || DEFAULT_EXPERIMENT_ID;
}

function experimentQueryParam() {
  return `experiment=${encodeURIComponent(currentExperimentId())}`;
}

function withCurrentExperiment(url, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (!["/api/run_action", "/api/chart_data"].includes(url)) return payload;
  return {
    experiment: currentExperimentId(),
    ...payload,
  };
}

async function postJson(url, payload) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withCurrentExperiment(url, payload))
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function runAction(action, payload = {}) {
  return await postJson("/api/run_action", { action, payload });
}
