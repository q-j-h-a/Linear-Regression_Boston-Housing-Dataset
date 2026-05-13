# Web 界面结构图

本文说明当前 Web 界面的层级结构、三栏布局、右侧控制面板、图表 Grid 和主要数据流。

## 1. 总体布局

页面骨架定义在 `templates/index.html`。

```text
body
└─ .app
   ├─ header.topbar
   │  ├─ .brand
   │  │  ├─ .logo
   │  │  └─ 标题 + 副标题
   │  └─ .top-actions.hidden-top
   │     ├─ #topFeature
   │     └─ #jumpExperiment
   │
   └─ .shell
      ├─ aside.sidebar
      ├─ .splitter.splitter-left
      ├─ main.main#main
      ├─ .splitter.splitter-right
      └─ aside.assistant
         └─ #rightPanel
```

三栏默认使用 CSS 变量：

```text
--sidebar-width: 16%;
--main-width: 64%;
--assistant-width: 20%;
```

`.splitter-left` 和 `.splitter-right` 由 `static/js/app_shell.js` 绑定拖拽，用于调整左右栏和中间栏宽度。宽度比例保存在 `localStorage`。

理论页会给 `.shell` 加 `.theory`，隐藏右栏和右侧 splitter。

## 2. 左侧导航

左侧导航由 `templates/index.html` 静态写入：

```text
aside.sidebar
├─ details.nav-section 理论部分
│  ├─ 实验基本信息
│  ├─ 实验目的
│  ├─ 前置知识
│  ├─ details.nested-section 模型介绍
│  │  ├─ 数据集
│  │  ├─ 训练模型
│  │  ├─ 学习准则
│  │  ├─ 参数优化
│  │  └─ 评价指标
│  ├─ 预期成果
│  └─ 思考拓展
│
└─ details.nav-section 实验部分
   ├─ 数据预处理
   ├─ 模型训练与评估
   ├─ 模型预测
   └─ 自主实验
```

导航点击绑定在 `static/js/app_shell.js`：

```text
button.nav-btn click -> setPage(btn.dataset.page)
```

`setPage(page)` 是异步流程，会先等待页面 shell 和右侧面板渲染完成，再应用三栏宽度和图表 resize，避免首次进入实验页时右侧面板宽度为 0。

## 3. 中间内容区

中间区域是：

```text
main.main#main
```

它本身为空，具体内容由页面 JS 动态写入。

### 3.1 理论页

文件：`static/js/theory_page.js`

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .html-lesson[data-theory-html]
      └─ iframe
```

理论 HTML 片段从 `static/theory-html/<page>.html` 加载。

### 3.2 数据预处理页

文件：`static/js/preprocess_page.js`

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .chart-grid#chartGrid
      └─ GridStack items / chart-card
```

主要流程：

```text
renderDataShell()
└─ loadDataView()
   ├─ runAction("data_view")
   ├─ loadDataChartData(views)
   └─ renderDataDashboard(grid, views)
```

### 3.3 模型训练与评估页

文件：`static/js/train_page.js`

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .chart-grid#chartGrid
      ├─ 模型训练
      ├─ 学习准则
      ├─ Loss 等高线图
      ├─ Loss 三维曲面图
      ├─ 梯度下降图
      ├─ 参数轨迹
      ├─ 指标图
      ├─ 本轮计算过程
      └─ 参数表
```

默认显示前两个图：`模型训练`、`学习准则`。

### 3.4 模型预测页

文件：`static/js/predict_page.js`

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ .chart-grid#chartGrid
      ├─ 预测输入与结果
      ├─ 本轮计算过程
      ├─ 预测可视化
      └─ 相近样本对比
```

### 3.5 自主实验页

文件：`static/js/student_page.js`

```text
#main
└─ section.hero-card
   ├─ .hero-line
   └─ #studentWorkspace
      ├─ .stage-strip#studentStageStrip
      └─ .chart-grid#studentChartGrid
```

自主实验右侧面板按 4 个阶段组织：

```text
01 数据集
02 数据预处理
03 模型训练与评估
04 模型预测
```

## 4. 右侧控制面板

右侧容器：

```text
aside.assistant
└─ #rightPanel
```

控制面板渲染器在 `static/js/control_renderers.js`。

### 4.1 数据预处理

```text
#rightPanel
└─ .control-card
   ├─ .mini-stats
   ├─ .control-group 特征选择
   │  └─ select#dataFeature
   └─ .control-group 显示模式
      └─ details.mode-menu
```

### 4.2 模型训练与评估

```text
#rightPanel
└─ .control-card
   ├─ .mini-stats
   ├─ .control-group 数据设置
   │  ├─ select#trainStd
   │  └─ select#trainFeature
   ├─ .control-group 显示内容
   │  └─ details.mode-menu input[name=trainViews]
   ├─ .control-group 初始参数
   │  ├─ input#w0
   │  └─ input#b0
   ├─ .control-group 训练控制
   │  ├─ input#lr[type=range] + 微调按钮
   │  ├─ input#epochs[type=range] + 微调按钮
   │  └─ input#speed[type=range] + 微调按钮
   ├─ .button-grid
   └─ .runtime
```

### 4.3 模型预测

```text
#rightPanel
└─ .control-card
   ├─ .mini-stats
   ├─ .control-group 数据设置
   │  ├─ select#predictStd
   │  └─ select#predictFeature
   ├─ .control-group 输入特征值
   │  └─ input#predictInput
   ├─ .control-group 显示模式
   │  └─ details.mode-menu input[name=predictViews]
   └─ #predictRun
```

### 4.4 自主实验

自主实验使用定制面板 `studentPanelHtml()`，阶段外层使用 `.control-card.student-stage-card`，阶段内使用 `.control-group` 分区。

当前版本约束与交互：

- `02 字段设置` 已删除，不再单独配置目标列与特征列。
- CSV 最后一列固定作为目标列 `y`，且不参与标准化。
- 其余数值列作为特征列，预处理后生成 `特征名_standardized`。
- `02 数据预处理` 支持原始散点图、预处理散点图、单特征线性相关系数、全特征线性相关系数。
- `03 模型训练与评估` 中，训练数据版本默认选 `标准化特征`。
- `03 模型训练与评估` 的状态徽标在初始和重置后为 `未训练`，训练一轮和自动训练后为 `已训练`。
- `参数表` 为训练区表格图表的新标题，默认布局为 `1 行 x 4 列`。
- `评估标准图` 当前为 3 个同一行仪表盘，同时显示 RMSE、MAE、R2。

```text
01 数据集
├─ 上传 CSV 数据集
└─ 数据类型 + 加载数据集

02 数据预处理
├─ 特征选择
├─ 显示模式
└─ 预处理 / 看图

03 模型训练与评估
├─ 训练数据版本（默认：标准化特征）
├─ 训练状态徽标（未训练 / 已训练）
├─ 训练图表
├─ 初始参数
└─ 训练控制

04 模型预测
├─ 预测输入值
└─ 显示图表
```

## 5. 图表卡片与交互

图表卡片统一由 `static/js/view_renderers.js` 的 `chartCardHtml()` 生成：

```text
section.chart-card.chart-interaction-prototype
├─ .chart-head
│  ├─ .chart-title
│  └─ .chart-sub
└─ .chart#chart_<key>
```

GridStack 包装层：

```text
.chart-grid.grid-stack
└─ .grid-stack-item[data-view=<view>]
   └─ .grid-stack-item-content
      └─ section.chart-card
```

GridStack 使用：

```text
GridStack.init({
  column: 4,
  cellHeight: 260,
  margin: 8,
  float: true,
  animate: true,
  draggable: { handle: ".chart-head" },
  resizable: { handles: "e, s, se" }
})
```

图表交互规则在 `static/js/state_runtime.js`：

- 默认未激活：滚轮、悬停 tooltip、图内拖动不影响图表。
- 点击图表卡片：激活并高亮。
- 激活后：允许滚轮缩放、hover tooltip、图内拖动。
- 点击同一图表：取消激活。
- 点击页面其它位置：取消激活。
- 图表卡片右下角保留自定义视觉角标，原生 `resize` 已关闭。

布局保存 key：

```text
preprocess -> preprocessGridLayoutV4
train      -> trainGridLayoutV2
predict    -> predictGridLayoutV1
student    -> studentGridLayoutV1
```

## 6. 数据流

```text
用户操作右侧面板
        ↓
页面 JS 收集控件值
        ↓
runAction(action, payload)
        ↓
POST /api/run_action
        ↓
models/simple_linear_regression/model.py
        ↓
返回 context_id / history / prediction / preview
        ↓
页面 JS 根据 views 请求图表数据
        ↓
POST /api/chart_data
        ↓
models/simple_linear_regression/charts/*
        ↓
chart_renderers.js 生成 ECharts option
        ↓
ECharts 渲染到 .chart#chart_xxx
```

## 7. 文件职责速查

```text
templates/index.html
  页面骨架、CSS、左侧导航、三栏容器、右侧面板基础样式、脚本引用

static/js/app_shell.js
  页面切换、导航点击、三栏拖拽宽度、窗口 resize

static/js/state_runtime.js
  全局状态、图表实例、GridStack 状态、选择项保存恢复、图表点击激活

static/js/control_renderers.js
  右侧控制面板控件生成

static/js/view_renderers.js
  中间内容区卡片、表格、计算过程 HTML 生成

static/js/chart_renderers.js
  ECharts option 生成

static/js/preprocess_page.js
  数据预处理页

static/js/train_page.js
  模型训练与评估页

static/js/predict_page.js
  模型预测页

static/js/student_page.js
  自主实验页

models/simple_linear_regression/controls/*.py
  右侧控制面板 schema

models/simple_linear_regression/charts/*
  图表 metadata 和 chart data
```
