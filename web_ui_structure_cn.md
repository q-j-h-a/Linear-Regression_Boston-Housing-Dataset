# Web UI 结构说明

本文档记录当前简单线性回归教学实验的前端页面结构、主要交互、状态规则、理论课件页和实验测试模块，方便后续维护和扩展。

## 1. 总体布局

页面采用三栏结构：

```text
body
└─ .app
   ├─ header.topbar
   └─ .shell
      ├─ aside.sidebar
      ├─ .splitter.splitter-left
      ├─ main.main#main
      ├─ .splitter.splitter-right
      └─ aside.assistant
         └─ #rightPanel
```

默认宽度变量：

```text
--sidebar-width: 16%;
--main-width: 64%;
--assistant-width: 20%;
```

左侧为导航，中间为主要教学内容，右侧为当前页面控制面板。理论页进入 `.shell.theory` 模式后会隐藏右侧控制面板，只保留左侧导航和中间课件区域。

## 2. 左侧导航

左侧导航分为理论部分和实验部分。

理论部分：

```text
实验基本信息
实验目的
前置知识
模型介绍
  数据集
  训练模型
  学习准则
  参数优化
  评价指标
预期成果
思考拓展
```

实验部分：

```text
数据预处理
模型训练
模型评估
模型预测
实验测试
```

导航按钮通过 `data-page` 切换页面：

```text
button.nav-btn click -> setPage(btn.dataset.page)
```

页面分发主要在 `static/js/app_shell.js`：

```text
preprocess       -> renderPreprocessShell()
train_eval       -> renderTrainShell()
evaluate         -> renderEvaluateShell()
predict          -> renderPredictShell()
experiment_test  -> renderExperimentTestPage()
理论页           -> renderTheory(page)
```

## 3. 理论课件页

理论部分由以下文件组成：

```text
static/js/theory_page_registry.js
static/js/theory-pages/basic.js
static/js/theory-pages/purpose.js
static/js/theory-pages/knowledge.js
static/js/theory-pages/dataset.js
static/js/theory-pages/model.js
static/js/theory-pages/criterion.js
static/js/theory-pages/optimization.js
static/js/theory-pages/evaluation.js
static/js/theory-pages/result.js
static/js/theory-pages/thinking.js
static/js/theory_page.js
static/theory_deck_overrides.json
```

理论页结构：

```text
.theory-deck-shell
├─ .theory-deck-toolbar
├─ .theory-editor-tools
└─ .theory-slide-viewport
   └─ .theory-slide
      └─ .theory-component
```

主要能力：

- 只读模式浏览理论课件。
- 编辑课件内容，且在详情页编辑下支持双栏 **物理段落高度插值映射同步滚动**（方案四：基于内容指纹虚拟桥接与段落内外双重插值映射系统，实现每一行文字、列表及代码块绝对对齐且打字防闪烁）。
- 插入文本、卡片、项目符号、公式、图表、图片。
- 拖拽、缩放和删除组件。
- 保存课件覆盖数据。
- 导出 PDF 与 **下载 Word 讲义**（自动等比例重绘，合并 10 个理论部分，公式映射为 Word 原生可编辑的 MathML，图表高清嵌入，排版完美符合 A4 学术规格且无多余白页）。

理论页样式集中在 `templates/index.html` 中 `.theory-*` 相关 CSS。同步理论功能时，不要只同步 JS，也要同步理论样式和 `theory_deck_overrides.json`。

## 4. 中间主内容区

中间内容容器固定为：

```text
main.main#main
```

实验页通常使用：

```text
.dashboard-grid.grid-stack
└─ .grid-stack-item
   └─ .grid-stack-item-content
      └─ section.chart-card
```

GridStack 用于图表卡片布局和拖拽调整。页面切换时需要销毁旧 grid 和旧 ECharts 实例，避免残留。

## 5. 右侧控制面板

右侧控制面板渲染位置：

```text
aside.assistant
└─ #rightPanel
```

视觉约定：

- 页面标题使用 `.right-title`。
- 控制面板主体使用 `.control-card`。
- 主要按钮使用 `.primary-btn`。
- 次要按钮使用 `.secondary-btn`。
- 查看代码按钮通常附加 `.code-toggle-btn`。
- 同组按钮放在同一个父容器中，用 `gap` 控制间距。

测试模式下，原右侧控制面板保持功能不变，只在主卡片标题下方插入“查看测试内容”按钮。

## 6. 数据预处理页

入口文件：

```text
static/js/preprocess_page.js
```

步骤：

```text
01 加载原始数据
02 数据详情
03 原始数据可视化
04 数据标准化
05 标准数据可视化
```

顶部步骤条：

```text
.preprocess-flow#preprocessFlow
├─ button[data-preprocess-step="load"]
├─ button[data-preprocess-step="detail"]
├─ button[data-preprocess-step="raw_viz"]
├─ button[data-preprocess-step="standardize"]
└─ button[data-preprocess-step="standard_viz"]
```

代码重点：

```python
data = pd.read_csv("boston_housing.csv")
X = data.drop(columns=["MEDV"])
y = data["MEDV"]

mean = X.mean()
std = X.std(ddof=0)
X_scaled = (X - mean) / std
```

## 7. 模型训练页

入口文件：

```text
static/js/train_page.js
```

步骤：

```text
01 熟悉回归过程
02 熟悉预处理影响
03 熟悉损失函数
04 熟悉优化准则
05 自定义参数训练
```

核心代码：

```python
w = 0
b = 0
learning_rate = 0.03

for epoch in range(epochs):
    y_pred = w * x + b
    loss = np.mean((y - y_pred) ** 2)

    dw = -2 * np.mean(x * (y - y_pred))
    db = -2 * np.mean(y - y_pred)

    w = w - learning_rate * dw
    b = b - learning_rate * db
```

训练页需要让学生观察拟合线、Loss、参数路径和梯度下降过程。

## 8. 模型评估页

入口文件：

```text
static/js/evaluate_page.js
```

评估页依赖当前训练结果。若没有训练结果，应显示空状态并提示先完成训练。

支持指标：

```text
RMSE
MAE
R²
```

代码示例：

```python
y_pred = w * x + b
mse = np.mean((y - y_pred) ** 2)
rmse = np.sqrt(mse)

mae = np.mean(np.abs(y - y_pred))

ss_res = np.sum((y - y_pred) ** 2)
ss_tot = np.sum((y - np.mean(y)) ** 2)
r2 = 1 - ss_res / ss_tot
```

评估页重点是解释指标含义，而不是重新训练模型。

## 9. 模型预测页

入口文件：

```text
static/js/predict_page.js
```

预测页依赖当前训练结果。没有训练结果时显示空状态。

预测页右侧结构：

```text
#rightPanel
└─ .control-card.predict-control-card
   ├─ h3 模型预测
   ├─ .mini-stats
   ├─ 当前模型
   ├─ 特征选择
   ├─ 输入类型
   ├─ 输入特征值
   └─ .predict-actions
      ├─ 开始预测
      └─ 查看预测代码
```

预测输入使用：

```html
<input id="predictInput" type="text" inputmode="decimal" autocomplete="off">
```

交互规则：

- 修改输入值只保存表单状态，不刷新预测图表。
- 修改输入类型只保存选择状态，不刷新预测图表。
- 点击“开始预测”或在输入框按 Enter 后，才执行预测。
- 切换训练模型或重新训练后，预测结果应回到待预测状态。

## 10. 代码解释层

代码抽屉结构：

```text
.code-drawer-backdrop
└─ aside.code-drawer
   ├─ .code-drawer-head
   ├─ .code-operation
   ├─ .code-block-head
   ├─ pre.teaching-code
   └─ .code-explain
```

关闭规则：

- 只能通过右上角关闭按钮关闭。
- 点击遮罩或页面其他位置不关闭。
- 这是为了避免学生阅读代码时误触导致面板消失。

代码展示原则：

- 以 Python / NumPy 风格为主。
- 不展示 ECharts、GridStack、DOM 等前端工程代码。
- 代码与当前页面状态联动，例如特征、学习率、w、b、输入类型和指标模式。

## 11. 实验测试模块

入口文件：

```text
static/js/experiment_test.js
```

左侧新增：

```text
实验测试
```

整体流程：

```text
点击实验测试
-> 进入测试说明页
-> 点击开始实验测试
-> 重置四个实验模块状态
-> 自动进入第一个测试节点
-> 学生在原实验页操作
-> 点击右侧查看测试内容
-> 弹窗答题
-> 提交并查看反馈
-> 进入下一题
-> 最后一题提交后显示测试结果
```

测试模式下右侧按钮插入位置：

```text
.control-card
├─ h3 当前模块标题
├─ [查看测试内容]
├─ 实验测试进行中：第 n / total 题
├─ 原有控件
└─ 原有操作按钮 / 查看代码按钮
```

测试弹窗结构：

```text
.test-modal-backdrop
└─ .test-modal
   ├─ .test-modal-head
   ├─ .test-meta
   ├─ .test-section 操作要求
   ├─ .test-section 测试问题
   └─ .test-modal-actions
```

弹窗不再显示“观察提示”。如果同一个 `page + step` 有多道题，会合并在同一个弹窗里一次展示、一次提交。

测试状态：

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

重要规则：

- 普通实验模式下不显示“查看测试内容”。
- 测试模式下左侧实验导航和顶部步骤条锁定。
- 已提交但未进入下一题时，重新打开弹窗应恢复反馈状态。
- 最后一题提交后不显示“下一题”，直接显示测试结果。
- 结果页中间区域展示总成绩、分模块成绩和答题详情。
- 重新开始测试和返回自由实验按钮统一放在右侧控制面板。

## 12. 状态存储

前端状态主要保存在 `viewStateStore` 中。常见 key：

```text
activePreprocessStepV1
preprocessProgressStepV1
activeTrainStepV1
trainProgressStepV1
trainFormStateV1
evaluateMetricModeV1
predictFormStateV1
currentDatasetMetaV1
experimentTestStateV1
```

维护原则：

- 表单输入变化可以保存状态。
- 保存状态不等于执行计算。
- 图表刷新应由明确动作触发，例如加载数据、开始训练、开始预测、提交测试答案。

## 13. 后端接口

主要接口：

```text
GET  /
GET  /api/experiments
GET  /api/dataset_profile
GET  /api/page_schema
GET  /api/chart_registry
GET  /api/theory_deck_overrides
POST /api/theory_deck_overrides
POST /api/run_action
POST /api/chart_data
```

理论课件保存接口：

```text
GET  /api/theory_deck_overrides
POST /api/theory_deck_overrides
```

`POST` 请求体：

```json
{
  "page_id": "dataset",
  "deck": {}
}
```

## 14. 样式维护要点

- 不要把卡片嵌套在卡片里。
- 右侧控制面板按钮应放在统一父容器中，通过 `gap` 管理间距。
- 预测页的“开始预测”和“查看预测代码”必须同宽、同容器。
- 测试页的右侧按钮使用 `.test-side-actions` 管理间距。
- 理论页样式集中在 `.theory-*`，同步理论功能时要同时检查模板样式。
- 左侧“模型介绍”的下拉符号使用 `&rsaquo;`，避免编码问题变成问号。

## 15. 验证命令

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

理论拆分页：

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
