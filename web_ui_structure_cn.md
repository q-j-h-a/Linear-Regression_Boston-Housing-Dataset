# Web UI 结构说明

本文档记录当前简单线性回归教学实验的前端结构和数据预处理页面约定。

## 1. 页面整体结构

```text
body
└─ .app
   ├─ header.topbar
   │  └─ .brand
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

## 2. 左侧导航

左侧分为理论部分和实验部分。

```text
理论部分
├─ 实验基本信息
├─ 实验目的
├─ 前置知识
├─ 模型介绍
├─ 预期效果
└─ 思考拓展

实验部分
├─ 数据预处理
├─ 模型训练
├─ 模型评估
└─ 模型预测
```

导航点击入口：

```text
button.nav-btn click -> setPage(btn.dataset.page)
```

## 3. 主内容区

主内容容器：

```text
main.main#main
```

### 3.1 理论页面

主要由 `static/js/theory_page.js` 渲染。

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .html-lesson[data-theory-html]
      └─ iframe
```

### 3.2 数据预处理页面

主要由 `static/js/preprocess_page.js` 渲染。

```text
#main
├─ .preprocess-flow
│  ├─ 01 加载原始数据集
│  ├─ 02 数据详情
│  ├─ 03 原始数据可视化
│  ├─ 04 数据标准化
│  └─ 05 标准数据可视化
└─ .chart-grid#chartGrid
   └─ GridStack items / chart-card
```

流程条说明：

- 每个节点都保留编号。
- 每个节点都可以点击切换中间区域内容。
- 节点之间用管道线连接，用来表达实验流程。
- 流程条高度保持紧凑，贴近主内容区顶部。

当前五个流程节点：

```text
01 加载原始数据集
02 数据详情
03 原始数据可视化
04 数据标准化
05 标准数据可视化
```

节点内容约定：

- `01 加载原始数据集`：中间显示提示卡片“请先在右侧加载数据集”，提示卡片支持拖动和拉伸。
- `02 数据详情`：中间显示三个独立卡片：数据规模、数据质量、统计摘要。
- `03 原始数据可视化`：中间显示原始数据相关图表。
- `04 数据标准化`：中间显示标准化后的前 5 行，不需要右侧独立卡片。
- `05 标准数据可视化`：中间显示标准化数据相关图表。

数据详情卡片约定：

```text
数据规模
├─ 样本数量
├─ 特征数量
├─ 目标列
└─ 字段说明表

数据质量
├─ 缺失值数量
├─ 重复样本数量
├─ 数值型列数量
└─ 非数值型列数量

统计摘要
└─ 每个字段的最小值、最大值、平均值、标准差
```

`数据规模`、`数据质量`、`统计摘要` 都是独立 GridStack 卡片，可以拖动和拉伸。

### 3.3 模型训练页面

主要由 `static/js/train_page.js` 渲染。

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .chart-grid#chartGrid
      ├─ 训练散点图
      ├─ 拟合直线
      ├─ Loss 曲线
      ├─ 参数变化
      ├─ RMSE
      ├─ MAE
      └─ R2
```

### 3.4 模型预测页面

主要由 `static/js/predict_page.js` 渲染。

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .chart-grid#chartGrid
      ├─ 预测输入
      ├─ 预测可视化
      └─ 预测计算过程
```

## 4. 右侧控制面板

右侧控制面板容器：

```text
aside.assistant
└─ #rightPanel
```

### 4.1 数据预处理右侧面板

数据预处理阶段当前保留两个控制卡片。

```text
#rightPanel
├─ 加载数据集
│  ├─ select#datasetSource
│  │  └─ Boston 原始数据集
│  └─ button 加载数据集
└─ 预处理设置
```

加载数据集卡片约定：

- 标题为 `加载数据集`。
- 不显示 `01` 编号。
- 不显示 `未加载` 字符。
- 不显示折叠箭头。
- 不显示“数据来源”内层标题。
- 不显示数据状态和样本数量。
- 选择框直接放在卡片内，选项为 `Boston 原始数据集`。

不是每个顶部流程节点都需要右侧卡片。例如 `数据详情` 和 `数据标准化` 主要在中间区域展示结果。

### 4.2 模型训练右侧面板

```text
#rightPanel
└─ .control-card
   ├─ 数据版本选择
   ├─ 特征选择
   ├─ 图表选择
   ├─ 初始参数 w0 / b0
   ├─ 学习率
   ├─ 训练轮数
   └─ 开始训练按钮
```

### 4.3 模型预测右侧面板

```text
#rightPanel
└─ .control-card
   ├─ 数据版本选择
   ├─ 特征选择
   ├─ 输入模式
   ├─ 预测输入
   ├─ 图表选择
   └─ 开始预测按钮
```

## 5. 数据集文件约定

所有数据集文件统一放在 `datasets/` 下。

```text
datasets/
├─ raw/
│  └─ boston_housing.csv
└─ preprocessed/
   └─ boston_housing_preprocessed.csv
```

CSV 规则：

- 第一行必须是列名。
- 最后一列作为目标列，当前为 `MEDV`。
- 原始数据集和预处理后数据集保持相同列名、相同列顺序。
- 预处理后的文件通过文件名区分，例如 `*_preprocessed.csv`。
- 不再生成 `特征名_standardized` 这类列名。
- 标准化处理包含特征列和目标列。

当前 Boston Housing 字段：

```text
CRIM, ZN, INDUS, CHAS, NOX, RM, AGE, DIS, RAD, TAX, PTRATIO, B, LSTAT, MEDV
```

其中 `MEDV` 是目标列。

## 6. GridStack 约定

中间区域的实验结果卡片使用 GridStack。

```text
.chart-grid.grid-stack
└─ .grid-stack-item[data-view=<view>]
   └─ .grid-stack-item-content
      └─ section.chart-card
```

当前数据预处理页布局保存键：

```text
preprocessGridLayoutV7
```

布局能力：

- 支持拖动。
- 支持拉伸。
- 不同流程节点可以有不同卡片组合。
- 数据详情页中，数据规模、数据质量、统计摘要各自独立成行。

## 7. 后端交互流程

通用动作流程：

```text
前端按钮 / 流程节点
-> runAction(action, payload)
-> POST /api/run_action
-> models/simple_linear_regression/model.py
-> 返回 context_id / 数据摘要 / 表格数据
-> 中间区域渲染或刷新图表
```

常用动作：

```text
load_dataset
data_view
standardize_dataset
prepare_train
predict
```

图表刷新流程：

```text
experimentRefreshCharts()
-> POST /api/chart_data
-> models/simple_linear_regression/charts/*
-> chart_renderers.js
-> ECharts 渲染
```

## 8. 关键文件索引

```text
templates/index.html
static/js/app_shell.js
static/js/control_renderers.js
static/js/experiment_runtime.js
static/js/preprocess_page.js
static/js/state_runtime.js
static/js/train_page.js
static/js/predict_page.js
models/simple_linear_regression/dataset.py
models/simple_linear_regression/model.py
```

## 9. 验证命令

```bash
node --check static/js/preprocess_page.js
node --check static/js/control_renderers.js
node --check static/js/state_runtime.js
node --check static/js/train_page.js
node --check static/js/predict_page.js
python -m compileall app.py core models
```

## 10. 当前数据预处理页交互结构补充

数据预处理页的流程条被放置在顶部公共区域 `#pageTopSlot` 中，视觉上与主标题区域同一层级。流程节点是可点击按钮，节点之间使用连接线表达连续流程。

```text
#pageTopSlot
└── .preprocess-flow#preprocessFlow
    ├── button[data-preprocess-step="load"]          01 加载原始数据
    ├── button[data-preprocess-step="detail"]        02 数据详情
    ├── button[data-preprocess-step="raw_viz"]       03 原始数据可视化
    ├── button[data-preprocess-step="standardize"]   04 数据标准化
    └── button[data-preprocess-step="standard_viz"]  05 标准数据可视化
```

状态规则：

- `.active`：深蓝色，表示当前点击/查看的位置。
- `.done`：浅蓝色，表示数据预处理已经到达过的进度位置。
- 进度位置与当前查看位置分离；例如已经到达 `数据详情` 后再点击 `加载原始数据`，`加载原始数据` 为深蓝色，`数据详情` 仍保持浅蓝色。

### 10.1 右侧控制面板

右侧 `#rightPanel` 按当前流程步骤切换卡片：

```text
01 加载原始数据
└── .control-card.dataset-load-card
    ├── h3 加载数据集
    ├── select#datasetSource
    └── button#loadDatasetBtn

02 数据详情
└── 仅保留“控制面板”标题，不显示控制卡片

03 原始数据可视化
└── .control-card.dataset-load-card
    ├── h3 原始数据可视化
    ├── select#dataFeature
    └── .check-list[name="dataViews"]
        ├── 原始散点图
        └── 全特征线性相关系数

04 数据标准化
└── .control-card.dataset-load-card
    ├── h3 数据标准化
    └── select#dataFeature

05 标准数据可视化
└── .control-card.dataset-load-card
    ├── h3 标准数据可视化
    ├── select#dataFeature
    └── .check-list[name="dataViews"]
        ├── 标准化散点图
        └── 全特征线性相关系数
```

### 10.2 中间内容区

`#preprocessContent` 是数据预处理页的主内容容器。不同步骤对应的内容如下：

- `加载原始数据`：未加载时显示 `请先从右侧加载数据集`；加载后展示原始数据概览。
- `数据详情`：展示 `数据规模` 与 `统计详情`。其中 `统计详情` 合并了数据质量和统计摘要。
- `原始数据可视化`：默认显示 `请在右侧选择特征和显示模块`；勾选模块后渲染原始散点图和/或全特征线性相关系数。
- `数据标准化`：展示标准化公式、当前特征的 mean/std、标准化前后前 5 行以及特征标准化明细。
- `标准数据可视化`：默认显示 `请在右侧选择特征和显示模块`；勾选模块后渲染标准化散点图和/或全特征线性相关系数。

### 10.3 状态持久化

数据预处理页将以下交互状态保存在 `viewStateStore`：

- `activePreprocessStepV1`：当前点击位置。
- `preprocessProgressStepV1`：已到达的最远进度位置。
- `currentDatasetMetaV1`：当前已加载数据集元信息。
- `preprocessFormStateV1`：当前选择的特征。
- `rawVizSelectedViewsV1`：原始数据可视化已选显示模块。
- `standardVizSelectedViewsV1`：标准数据可视化已选显示模块。
