# Web UI 结构说明

本文档记录当前简单线性回归教学实验的前端页面结构、主要交互、状态规则和代码解释层设计。它面向后续维护和继续扩展页面的人，重点说明“页面怎么组织、用户怎么操作、哪些状态不能乱刷新”。

## 1. 总体布局

页面采用三栏结构：

```text
body
└── .app
    ├── header.topbar
    │   └── .brand
    └── .shell
        ├── aside.sidebar
        ├── .splitter.splitter-left
        ├── main.main#main
        ├── .splitter.splitter-right
        └── aside.assistant
            └── #rightPanel
```

默认宽度变量：

```text
--sidebar-width: 16%;
--main-width: 64%;
--assistant-width: 20%;
```

左侧是导航，中间是主要教学内容，右侧是当前页面的控制面板。代码抽屉打开时从右侧覆盖显示，不改变主图表布局。

## 2. 左侧导航

侧边栏分为理论部分和实验部分。

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
预测结果
思考拓展
```

实验部分：

```text
数据预处理
模型训练
模型评估
模型预测
```

导航按钮通过 `data-page` 切换页面：

```text
button.nav-btn click -> setPage(btn.dataset.page)
```

页面入口主要在 `static/js/app_shell.js` 中分发：

```text
preprocess  -> renderPreprocessShell()
train_eval  -> renderTrainShell()
evaluate    -> renderEvaluateShell()
predict     -> renderPredictShell()
```

## 3. 中间主内容区

主内容容器固定为：

```text
main.main#main
```

不同页面会完全接管 `#main` 的内容。图表类页面通常使用：

```text
.dashboard-grid.grid-stack
└── .grid-stack-item
    └── .grid-stack-item-content
        └── section.chart-card
```

GridStack 用于图表卡片布局和拖拽调整。需要注意：页面切换时要销毁旧 grid 和旧 ECharts 实例，避免旧实例残留。

## 4. 右侧控制面板

右侧控制面板统一渲染在：

```text
aside.assistant
└── #rightPanel
```

每个页面有自己的控制面板结构。当前更推荐页面自己渲染关键控制区域，而不是完全依赖通用 schema 渲染，这样能保证教学页面的排版精度。

通用视觉约定：

- 页面标题使用 `.right-title`。
- 控制面板主体使用 `.control-card`。
- 同一组按钮必须放在同一个父容器中，用统一 `gap` 管理间距。
- 主要按钮使用 `.primary-btn`。
- 次要按钮使用 `.secondary-btn`。
- 查看代码按钮额外带 `.code-toggle-btn`。

## 5. 数据预处理页

入口文件：

```text
static/js/preprocess_page.js
```

页面步骤：

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
├── button[data-preprocess-step="load"]
├── button[data-preprocess-step="detail"]
├── button[data-preprocess-step="raw_viz"]
├── button[data-preprocess-step="standardize"]
└── button[data-preprocess-step="standard_viz"]
```

主要内容根据步骤切换。预处理页不是一屏堆满所有图表，而是围绕当前步骤展示最重要的表格、公式、统计和图表。

代码入口建议：

- 加载原始数据：加载按钮或当前步骤卡片右上角。
- 数据详情：统计卡片右上角。
- 原始数据可视化：图表卡片右上角。
- 数据标准化：标准化公式旁边，优先级最高。
- 标准数据可视化：图表卡片右上角。

代码片段重点：

```python
data = pd.read_csv("boston_housing.csv")
X = data.drop(columns=["MEDV"])
y = data["MEDV"]

mean = X.mean()
std = X.std(ddof=0)
X_scaled = (X - mean) / std
```

当前实验中，标准化步骤会同时处理输入特征和目标列。

## 6. 模型训练页

入口文件：

```text
static/js/train_page.js
```

训练页按教学目标分成 5 个步骤：

```text
01 熟悉回归过程
02 熟悉预处理影响
03 熟悉损失函数
04 熟悉优化准则
05 自定义参数训练
```

### 6.1 熟悉回归过程

目标是让学生看到一条直线如何逐步拟合散点。

常见视图：

```text
模型训练散点图
训练计算过程
Loss 曲线
w 参数路径
b 参数路径
RMSE
MAE
R²
```

右侧控制：

```text
特征选择
是否使用标准化
初始 w / 初始 b
学习率
训练轮数
开始训练
单步训练
自动播放
暂停
重置
查看训练代码
```

核心代码：

```python
w = 0
b = 0
lr = 0.03
epochs = 200

for epoch in range(epochs):
    y_pred = w * x + b
    loss = np.mean((y - y_pred) ** 2)

    dw = -2 * np.mean(x * (y - y_pred))
    db = -2 * np.mean(y - y_pred)

    w = w - lr * dw
    b = b - lr * db
```

### 6.2 熟悉预处理影响

目标是比较“原始特征训练”和“标准化特征训练”的差异。这个步骤强调只改变预处理方式，其余训练配置保持一致。

代码说明重点：

```python
x_raw = X["RM"]
x_scaled = (x_raw - x_raw.mean()) / x_raw.std()

loss_raw = train(x_raw, y)
loss_scaled = train(x_scaled, y)
```

### 6.3 熟悉损失函数

目标是理解残差、平方误差和 MSE。

视图包括单样本残差、多样本残差、残差直方图、残差散点等。

核心代码：

```python
y_pred = w * x + b
error = y - y_pred
squared_error = error ** 2
mse = np.mean(squared_error)
```

### 6.4 熟悉优化准则

目标是理解梯度下降和参数更新方向。

视图包括 Loss 等高线、w/b 切面、3D Loss 曲面和参数路径。

核心代码：

```python
dw = -2 * np.mean(x * (y - y_pred))
db = -2 * np.mean(y - y_pred)

w_new = w - learning_rate * dw
b_new = b - learning_rate * db
```

### 6.5 自定义参数训练

目标是让学生改动特征、初始参数、学习率和轮数后，看到训练过程与代码同步变化。

代码面板应动态反映：

```python
feature = "RM"
w = 0
b = 0
learning_rate = 0.03
epochs = 200
```

如果用户修改学习率、特征或初始参数，代码面板里的对应值也要更新。

## 7. 模型评估页

入口文件：

```text
static/js/evaluate_page.js
```

评估页依赖当前训练页的 `trainData`。如果还没有训练结果，应显示空状态，提示先完成训练。

主要结构：

```text
#main
└── .dashboard-grid.grid-stack#evaluateWrap
    ├── 当前模型拟合
    └── 指标卡片
```

指标支持切换：

```text
RMSE
MAE
R²
```

右侧控制面板：

```text
控制面板
└── .control-card
    ├── 模型评估
    ├── 当前指标说明
    └── 查看评估代码
```

代码面板根据当前指标动态生成代码：

```python
y_pred = w * x + b
mse = np.mean((y - y_pred) ** 2)
rmse = np.sqrt(mse)

mae = np.mean(np.abs(y - y_pred))

ss_res = np.sum((y - y_pred) ** 2)
ss_tot = np.sum((y - np.mean(y)) ** 2)
r2 = 1 - ss_res / ss_tot
```

评估页的教学重点是解释指标含义，而不是重新训练模型。

## 8. 模型预测页

入口文件：

```text
static/js/predict_page.js
```

预测页也依赖当前训练页的 `trainData`。没有训练结果时，显示空状态。

### 8.1 主内容结构

有可用训练模型但尚未点击预测时，中间区域仍然显示基础图表：

```text
#main
└── .dashboard-grid.grid-stack#predictWrap
    ├── 预测可视化
    ├── 原始散点图
    └── 预测计算过程
```

尚未点击“开始预测”时：

- 图表显示样本点和当前回归线。
- 不显示预测点。
- 不显示预测辅助线。
- 右侧预测 MEDV 和模型输入 x 显示 `--`。
- 计算过程卡片显示提示文案。

点击“开始预测”后：

- 显示预测点。
- 显示预测辅助线。
- 显示原始空间中的预测点。
- 更新预测 MEDV 和模型输入 x。
- 展示完整预测计算过程。

### 8.2 右侧控制面板

预测页右侧控制面板结构：

```text
#rightPanel
├── .right-title 控制面板
└── .control-card.predict-control-card
    ├── h3 模型预测
    ├── .mini-stats
    │   ├── 预测 MEDV
    │   └── 模型输入 x
    ├── 当前模型
    │   ├── 来源：自定义参数训练
    │   ├── 特征：RM
    │   ├── w = ...
    │   └── b = ...
    ├── 特征选择
    ├── 输入类型
    ├── 输入特征值
    └── .predict-actions
        ├── 开始预测
        └── 查看预测代码
```

当前模型区域使用纯信息展示，不再嵌套额外卡片，避免右侧面板显得过重。

按钮规则：

- “开始预测”和“查看预测代码”必须在同一个 `.predict-actions` 父容器中。
- 二者宽度一致。
- 二者间距由 `.predict-actions` 的 `gap` 控制。
- 不要给其中一个按钮额外加 `margin-top`，否则会造成间距不一致。

输入特征值规则：

```html
<input id="predictInput" type="text" inputmode="decimal" autocomplete="off">
```

这里故意不用 `type="number"`，因为这是直接输入预测值，不需要浏览器提供上下微调箭头。

### 8.3 预测状态规则

预测页有三种状态：

```text
无训练模型
有训练模型但未预测
已预测
```

无训练模型：

- 禁用预测按钮。
- 禁用输入类型。
- 中间显示空状态，提示先训练模型。

有训练模型但未预测：

- 显示基础图表。
- 不显示预测点和预测结果。
- 右侧结果为 `--`。
- 计算过程显示提示。

已预测：

- 显示预测点、辅助线和计算过程。
- 右侧显示预测 MEDV 和模型输入 x。

重要交互规则：

- 修改输入特征值时，只保存输入值，不刷新中间图表。
- 修改输入类型时，只保存选择值，不刷新中间图表。
- 只有点击“开始预测”或在输入框按 Enter，才执行 `loadPrediction()` 并更新预测结果。
- 切换训练模型、训练帧或重新训练后，预测结果应重新进入待预测状态。

相关函数：

```text
renderPredictShell()
renderPredictPanel()
persistPredictFormState()
restorePredictFormState()
resetPredictionPendingState()
renderPredictBaseCharts()
loadPrediction()
renderPredictCharts()
```

## 9. 代码解释层

代码解释层是本项目当前最重要的教学增强功能。

### 9.1 设计原则

- 代码不是主内容，而是当前步骤的解释层。
- 学生先看现象，再点击“查看代码”理解实现逻辑。
- 代码以 Python / NumPy 风格为主。
- 每段代码控制在 5 到 20 行左右。
- 代码只解释当前操作，不展示完整工程源码。
- 默认不展示 ECharts、GridStack、DOM 操作等前端工程代码。

### 9.2 抽屉结构

代码抽屉 DOM 结构：

```text
.code-drawer-backdrop
└── aside.code-drawer
    ├── .code-drawer-head
    │   ├── .code-kicker
    │   ├── h2
    │   └── button.code-close-btn
    ├── .code-operation
    ├── .code-block-head
    │   ├── 核心代码
    │   └── button.code-copy-btn
    ├── pre.teaching-code
    └── .code-explain
```

关闭规则：

- 只通过右上角 `x` 关闭。
- 点击遮罩或页面其他位置不关闭。
- 这是为了避免学生正在看代码时误触导致抽屉消失。

### 9.3 各页代码入口

预处理页：

```text
查看加载代码
查看统计代码
查看绘图代码
查看标准化代码
```

训练页：

```text
查看训练流程代码
查看预处理影响代码
查看损失函数代码
查看梯度更新代码
查看自定义训练代码
```

评估页：

```text
查看评估代码
```

预测页：

```text
查看预测代码
```

### 9.4 动态代码联动

代码面板应尽量与当前页面状态联动：

- 当前特征变化，代码里的 `feature = "RM"` 同步变化。
- 学习率变化，代码里的 `learning_rate = ...` 同步变化。
- 初始 w/b 变化，代码里的 `w = ...`、`b = ...` 同步变化。
- 评估指标切换，代码展示 RMSE、MAE 或 R² 对应片段。
- 预测输入类型切换，代码展示原始输入标准化或直接使用标准化输入。
- 预测输入值变化，代码保存输入，但不刷新结果；点击预测后代码展示本次预测值。

## 10. 状态存储

前端状态主要保存在 `viewStateStore` 中。常见 key：

```text
activePreprocessStepV1
preprocessProgressStepV1
preprocessGridLayoutV7
activeTrainStepV1
trainProgressStepV1
trainFormStateV1
trainSelectedViewsV1
trainCompareViewsV1
trainGridLayoutV2
evaluateMetricModeV1
predictFormStateV1
currentDatasetMetaV1
```

维护原则：

- 表单输入变化可以保存状态。
- 保存状态不等于执行计算。
- 图表刷新应由明确动作触发，例如加载数据、开始训练、开始预测。
- 如果只是输入框变化，不要重置主内容区。

## 11. 图表数据流

动作执行：

```text
按钮点击
-> runAction(action, payload)
-> POST /api/run_action
-> models/simple_linear_regression/model.py
-> 返回 context_id 和核心结果
```

图表数据：

```text
页面请求图表
-> POST /api/chart_data
-> models/simple_linear_regression/charts/<page>/*
-> chart_renderers.js / 页面专属 option 函数
-> ECharts 渲染
```

主要 action：

```text
load_dataset
data_view
standardize_dataset
prepare_train
predict
```

## 12. 样式维护要点

### 12.1 右侧面板

- 同类内容保持同一层级，不要卡片套卡片。
- 当前模型这种静态信息适合纯文本行展示。
- 结果数值可以用 `.mini-stats`。
- 操作按钮放在统一父容器内，使用 grid 或 flex 统一宽度。

### 12.2 预测页按钮

正确结构：

```html
<div class="predict-actions">
  <button class="primary-btn" id="predictRun">开始预测</button>
  <button class="secondary-btn code-toggle-btn">查看预测代码</button>
</div>
```

对应规则：

```css
.predict-actions {
  display: grid;
  gap: 12px;
}

.predict-actions .primary-btn,
.predict-actions .secondary-btn {
  width: 100%;
}

.predict-actions .code-toggle-btn {
  margin-top: 0;
}
```

不要让两个按钮分别处在不同父容器，也不要让其中一个继承全局额外 margin。

### 12.3 输入框

预测输入值使用文本输入：

```html
type="text"
inputmode="decimal"
```

这样能隐藏浏览器 number 输入框的上下箭头，同时保留数字键盘提示和后续 `Number(...)` 解析。

### 12.4 图表卡片

- 图表标题、说明、图例和图表区域不要互相覆盖。
- 图表卡片不嵌套卡片。
- 如果卡片内有切换按钮，按钮组应使用固定高度和稳定间距，避免图表区域跳动。

## 13. 验证命令

每次修改 JS 或 Python 后建议执行：

```bash
python -m compileall app.py core models
node --check static/js/api.js
node --check static/js/app_shell.js
node --check static/js/chart_renderers.js
node --check static/js/control_renderers.js
node --check static/js/evaluate_page.js
node --check static/js/experiment_runtime.js
node --check static/js/predict_page.js
node --check static/js/preprocess_page.js
node --check static/js/schema_registry.js
node --check static/js/state_runtime.js
node --check static/js/theory_page.js
node --check static/js/train_page.js
node --check static/js/view_renderers.js
```

## 14. 后续扩展建议

- 增加全局“代码模式”开关：可视化 / 可视化 + 代码。
- 给图表绘制逻辑增加可选“绘图代码”入口，但默认仍以机器学习逻辑代码为主。
- 预测页可增加“上一次预测参数”摘要，帮助学生区分当前输入和已执行预测。
- 评估页可增加指标对比表，让 RMSE、MAE、R² 的差异更直观。
- 如果未来支持上传数据集，需要在文档中补充 CSV 字段规则、目标列选择规则和异常提示规则。
