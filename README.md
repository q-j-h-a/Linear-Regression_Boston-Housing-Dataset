# 简单线性回归教学实验

这是一个面向初学者的简单线性回归 Web 教学实验。项目使用 Flask 提供后端接口，前端使用原生 JavaScript、ECharts、ECharts GL、GridStack 和可编辑课件式理论页，帮助学生完成从理论理解到实验操作、再到测试反馈的完整学习流程。

项目定位不是展示完整工程源码，而是让学生先观察实验现象，再在当前步骤查看对应的 Python / NumPy 风格核心代码。

## 当前能力

- 理论部分：提供实验基本信息、实验目的、前置知识、数据集、训练模型、学习准则、参数优化、评价指标、预期成果和思考拓展等课件式页面。
- 理论课件编辑与导出：理论页支持只读查看、编辑课件、导出 PDF。同时，详情页支持**一键下载 Word 讲义**（完美整合 10 大章节为 A4 格式、公式原生可编辑、图表高清内嵌），且在编辑状态下支持双栏**物理段落高度插值映射同步滚动**，并通过 `/api/theory_deck_overrides` 保存页面覆盖数据。
- 数据预处理：加载 Boston Housing 数据集，查看数据详情、原始数据可视化、z-score 标准化和标准数据可视化。
- 模型训练：支持回归过程、预处理影响、损失函数、优化准则和自定义参数训练。
- 模型评估：展示当前训练模型的拟合效果，并解释 RMSE、MAE、R²。
- 模型预测：基于当前模型参数 `w`、`b` 和输入特征值 `x` 计算预测 MEDV，并展示预测可视化和计算过程。
- 代码解释层：预处理、训练、评估、预测页面均提供“查看代码”入口，展示当前步骤的核心代码、操作说明和解释。
- 实验测试：左侧新增“实验测试”入口，按完整实验流程引导学生完成测试题，并生成成绩和答题详情。

## 运行方式

```bash
python -m pip install -r requirements.txt
python app.py
```

启动后访问：

```text
http://127.0.0.1:5000/
```

## 项目结构

```text
simple_linear_regression/
├─ app.py
├─ requirements.txt
├─ README.md
├─ web_ui_structure_cn.md
├─ core/
├─ datasets/
├─ models/simple_linear_regression/
│  ├─ model.py
│  ├─ dataset.py
│  ├─ controls/
│  └─ charts/
├─ static/
│  ├─ aiLogo-Cusx885-.png
│  ├─ theory_deck_overrides.json
│  ├─ theory-html/
│  └─ js/
│     ├─ app_shell.js
│     ├─ experiment_test.js
│     ├─ theory_page.js
│     ├─ theory_page_registry.js
│     ├─ theory-pages/
│     ├─ preprocess_page.js
│     ├─ train_page.js
│     ├─ evaluate_page.js
│     └─ predict_page.js
└─ templates/
   └─ index.html
```

## 数据集约定

默认数据集为 Boston Housing：

```text
datasets/raw/boston_housing.csv
datasets/preprocessed/boston_housing_preprocessed.csv
```

字段包含：

```text
CRIM, ZN, INDUS, CHAS, NOX, RM, AGE, DIS, RAD, TAX, PTRATIO, B, LSTAT, MEDV
```

当前实验默认将 `MEDV` 作为目标值 `y`，其余数值列作为输入特征 `X`。标准化使用 z-score：

```python
z = (x - mean) / std
```

预测页会根据训练时的标准化信息处理新输入：

```python
x_std = (x_raw - feature_mean) / feature_std
y_std_pred = w * x_std + b
y_raw_pred = y_std_pred * target_std + target_mean
```

## 主要页面

### 理论部分

理论部分由以下文件组成：

```text
static/js/theory_page_registry.js
static/js/theory-pages/*.js
static/js/theory_page.js
static/theory_deck_overrides.json
```

理论页使用课件式渲染，支持：

- 只读浏览
- 编辑课件内容，且在详情页编辑下支持双栏 **物理段落高度插值映射同步滚动**（方案四：基于内容指纹虚拟桥接，实现正文、标题、列表及代码块“每一行”绝对水平对齐，打字防闪烁锚定）
- 插入文本、卡片、公式、图表和图片
- 保存覆盖数据
- 导出 PDF 与 **下载 Word 讲义**（后台自动等比自适应重绘，整合 10 大模块为一份排版精美、公式转换为 native MathML、图表高清内嵌的 A4 学术讲义）

如果 `theory_deck_overrides.json` 中某个页面覆盖数据不完整，运行时会回退到 `static/js/theory-pages/` 中的默认页面配置，避免出现只有标题、正文空白的情况。

### 数据预处理

步骤：

```text
01 加载原始数据
02 数据详情
03 原始数据可视化
04 数据标准化
05 标准数据可视化
```

核心代码内容包括读取 CSV、拆分特征和目标列、统计缺失值和重复值、绘制散点图、计算 mean/std、执行 z-score 标准化。

### 模型训练

步骤：

```text
01 熟悉回归过程
02 熟悉预处理影响
03 熟悉损失函数
04 熟悉优化准则
05 自定义参数训练
```

核心概念包括：

```python
y_pred = w * x + b
loss = np.mean((y - y_pred) ** 2)
w = w - learning_rate * dw
b = b - learning_rate * db
```

### 模型评估

评估页展示当前模型的拟合效果，并支持 RMSE、MAE、R² 指标解释：

```python
mse = np.mean((y - y_pred) ** 2)
rmse = np.sqrt(mse)
mae = np.mean(np.abs(y - y_pred))
r2 = 1 - ss_res / ss_tot
```

### 模型预测

预测页使用当前训练得到的 `w`、`b` 和输入特征值 `x`：

```python
y_pred = w * x + b
```

页面规则：

- 修改输入框不会自动刷新预测结果。
- 只有点击“开始预测”或在输入框按 Enter，才更新预测点、预测 MEDV 和计算过程。
- “开始预测”和“查看预测代码”在同一个按钮容器内，保持等宽和统一间距。

## 实验测试模块

左侧实验部分新增“实验测试”入口。流程为：

```text
实验测试
-> 查看测试说明
-> 开始实验测试
-> 自动进入第一个测试节点
-> 学生在原实验页操作
-> 点击右侧“查看测试内容”
-> 弹窗答题
-> 提交并查看反馈
-> 进入下一题
-> 最后一题提交后显示测试结果
```

测试模式特点：

- 普通实验模式下不显示测试按钮。
- 测试模式下，右侧控制面板主卡片标题下方显示“查看测试内容”。
- 右侧原有控制面板功能保持不变。
- 左侧实验导航和顶部步骤条在测试模式下锁定。
- 同一页面同一步骤的多道题会合并到同一个弹窗中。
- 提交后关闭弹窗再打开，会保持已提交反馈状态。
- 最后一题提交后直接显示结果弹窗和结果页。

测试状态保存在前端：

```js
experimentTestStateV1 = {
  active: false,
  started: false,
  finished: false,
  currentIndex: 0,
  score: 0,
  pendingFeedbackId: null,
  answers: {},
  records: [],
  locked: true
}
```

## API

```text
GET  /
GET  /api/experiments
GET  /api/dataset_profile?experiment=<experiment>
GET  /api/page_schema?experiment=<experiment>&page=<page>
GET  /api/chart_registry?experiment=<experiment>&page=<page>
GET  /api/theory_deck_overrides
POST /api/theory_deck_overrides
POST /api/run_action
POST /api/chart_data
```

当前实验 ID：

```text
simple_linear_regression
```

## 验证命令

```bash
python -m compileall app.py core models
node --check static/js/api.js
node --check static/js/app_shell.js
node --check static/js/chart_renderers.js
node --check static/js/control_renderers.js
node --check static/js/evaluate_page.js
node --check static/js/experiment_runtime.js
node --check static/js/experiment_test.js
node --check static/js/predict_page.js
node --check static/js/preprocess_page.js
node --check static/js/schema_registry.js
node --check static/js/state_runtime.js
node --check static/js/theory_page.js
node --check static/js/theory_page_registry.js
node --check static/js/train_page.js
node --check static/js/view_renderers.js
```

理论拆分页也应检查：

```bash
node --check static/js/theory-pages/basic.js
node --check static/js/theory-pages/purpose.js
node --check static/js/theory-pages/knowledge.js
node --check static/js/theory-pages/dataset.js
node --check static/js/theory-pages/model.js
node --check static/js/theory-pages/criterion.js
node --check static/js/theory-pages/optimization.js
node --check static/js/theory-pages/evaluation.js
node --check static/js/theory-pages/result.js
node --check static/js/theory-pages/thinking.js
```

## 维护建议

- 理论部分以 `static/js/theory-pages/*.js` 和 `static/theory_deck_overrides.json` 为主，不要只同步其中一个。
- 修改理论页样式时，要同步检查 `templates/index.html` 中 `.theory-*` 相关 CSS。
- 新增测试题优先修改 `static/js/experiment_test.js` 中的 `EXPERIMENT_TEST_FLOW`。
- 测试模式只添加测试入口和弹窗，不应替换原实验右侧控制面板。
- 开始实验测试时应重置四个实验模块状态，避免沿用自由实验中的旧结果。
