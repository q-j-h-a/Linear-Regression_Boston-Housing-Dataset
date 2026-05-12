# 简单线性回归教学演示

这是一个 Flask + ECharts + GridStack 的简单线性回归教学项目。页面把数据预处理、线性拟合、梯度下降、指标变化和预测过程拆开展示，便于观察 `w`、`b`、Loss、RMSE、MAE、R2 如何随训练变化。

## 当前状态

- 后端入口 `app.py` 是路由层。
- 业务动作统一走 `/api/run_action`。
- 图表数据统一走 `/api/chart_data`。
- 控制面板和图表注册位于 `models/simple_linear_regression/`。
- 前端脚本已拆分到 `static/js/`。
- 页面主体是可拖拽宽度的左/中/右三栏布局。
- 实验页图表使用 GridStack，可拖拽和缩放。
- 图表交互采用“点击激活”模式：未激活时滚轮、悬停提示和图内拖动不会影响图表；点击图表高亮后才启用交互。
- `project_structure_status_and_next_steps_cn.docx` 和对应生成脚本已删除，项目说明以 Markdown 文档为准。

## 运行方式

```bash
python -m pip install -r requirements.txt
python app.py
```

浏览器打开：

```text
http://127.0.0.1:5000/
```

## 目录结构

```text
simple_linear_regression/
├─ app.py
├─ core/
│  ├─ chart_registry.py
│  ├─ context_store.py
│  ├─ control_registry.py
│  ├─ data_utils.py
│  ├─ registry.py
│  └─ schemas.py
├─ models/
│  └─ simple_linear_regression/
│     ├─ __init__.py
│     ├─ model.py
│     ├─ charts/
│     │  ├─ predict/
│     │  ├─ preprocess/
│     │  ├─ student/
│     │  └─ train_eval/
│     └─ controls/
├─ static/
│  ├─ js/
│  │  ├─ api.js
│  │  ├─ app_shell.js
│  │  ├─ chart_renderers.js
│  │  ├─ control_renderers.js
│  │  ├─ predict_page.js
│  │  ├─ preprocess_page.js
│  │  ├─ schema_registry.js
│  │  ├─ state_runtime.js
│  │  ├─ student_page.js
│  │  ├─ theory_page.js
│  │  ├─ train_page.js
│  │  └─ view_renderers.js
│  └─ theory-html/
├─ templates/
│  └─ index.html
├─ boston_housing.csv
├─ boston_housing_features_standardized.csv
├─ student_score_regression_100.csv
├─ requirements.txt
└─ web_ui_structure_cn.md
```

## 后端接口

```text
GET  /
GET  /api/page_schema?page=<page>
GET  /api/chart_registry?page=<page>
POST /api/run_action
POST /api/chart_data
```

`/api/run_action` 的 JSON 请求格式：

```json
{
  "action": "prepare_train",
  "payload": {
    "feature": "RM",
    "use_standardized": true,
    "learning_rate": 0.03,
    "epochs": 120,
    "w0": 0,
    "b0": 0
  }
}
```

当前主要动作：

```text
data_view
prepare_train
predict
student_upload
student_preprocess
student_data_view
student_prepare_train
student_predict
```

## 前端模块

- `api.js`：通用 POST 和 action 调用。
- `state_runtime.js`：全局状态、DOM 工具、图表生命周期、GridStack 布局状态、图表点击激活交互。
- `schema_registry.js`：页面 schema、图表 metadata、标题和说明兜底。
- `control_renderers.js`：右侧控制面板 HTML 生成。
- `chart_renderers.js`：ECharts option 生成。
- `view_renderers.js`：信息卡片、表格、计算过程等 HTML 生成。
- `preprocess_page.js`：数据预处理页面流程。
- `train_page.js`：训练评估页面流程。
- `predict_page.js`：预测页面流程。
- `student_page.js`：学生自定义 CSV 实验流程。
- `theory_page.js`：理论页面和可选 HTML 课程片段加载。
- `app_shell.js`：导航、页面切换、三栏拖拽宽度和窗口 resize 绑定。

## 后端模块

- `models/simple_linear_regression/model.py`：核心业务动作，包括预处理、训练、预测、学生 CSV 数据流程。
- `models/simple_linear_regression/controls/`：各页面右侧控制面板 schema。
- `models/simple_linear_regression/charts/`：各页面图表数据提供模块。
- `core/registry.py`：按模型包发现 controls/charts。

新增控制项或图表时，优先放到对应模型包内。

## 验证命令

```bash
python -m compileall app.py core models
node --check static/js/api.js
node --check static/js/chart_renderers.js
node --check static/js/control_renderers.js
node --check static/js/view_renderers.js
node --check static/js/state_runtime.js
node --check static/js/schema_registry.js
node --check static/js/theory_page.js
node --check static/js/preprocess_page.js
node --check static/js/student_page.js
node --check static/js/predict_page.js
node --check static/js/train_page.js
node --check static/js/app_shell.js
```

本机 PowerShell 会话如果没有刷新 PATH，可以直接使用：

```text
C:\python\nodejs\node.exe
C:\python\Git\cmd\git.exe
```

## 后续可选

- 浏览器手动点测四个主要页面：预处理、训练评估、预测、自主实验。
- 可选：把 `templates/index.html` 中的大段 CSS 拆到 `static/css/app.css`。
- 可选：给 `/api/run_action` 和 `/api/chart_data` 补轻量自动化测试。
