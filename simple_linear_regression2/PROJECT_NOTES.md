# 简单线性回归教学实验项目说明

本文档用于说明当前项目的核心代码结构，重点是 `app.py` 和 `templates/index.html`。以后如果继续改页面、图表布局或接口，可以先看这份文档。

## 一、项目整体结构

这是一个 Flask + ECharts + GridStack 的教学实验页面。

- `app.py`：后端 Flask 服务，负责读取 Boston Housing 数据、计算统计信息、训练过程、预测结果，并提供 API。
- `templates/index.html`：前端主页面，包含页面布局、理论内容、实验控制面板、ECharts 图表渲染、GridStack 拖拽缩放布局。
- `boston_housing.csv`：原始 Boston Housing 数据。
- `boston_housing_features_standardized.csv`：标准化后的特征数据。
- `static/theory-html/`：理论部分可加载的 HTML 内容。

## 二、app.py 说明

`app.py` 是整个项目的数据和计算中心。

### 1. Flask 初始化

```python
app = Flask(__name__)
```

启动后默认监听：

```python
app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
```

因此浏览器可以访问：

- `http://127.0.0.1:5000/`
- `http://本机局域网IP:5000/`

### 2. 数据文件

```python
RAW_DATA_PATH = Path("boston_housing.csv")
STD_DATA_PATH = Path("boston_housing_features_standardized.csv")
TARGET_COLUMN = "MEDV"
```

- 原始数据使用 `boston_housing.csv`
- 标准化数据使用 `boston_housing_features_standardized.csv`
- 预测目标固定为 `MEDV`

### 3. 特征列

```python
FEATURE_COLUMNS = [
    "CRIM", "ZN", "INDUS", "CHAS", "NOX", "RM", "AGE", "DIS",
    "RAD", "TAX", "PTRATIO", "B", "LSTAT"
]
```

前端右侧的“特征选择”下拉框就是由这些字段生成的。

### 4. 首页路由

```python
@app.route("/")
def index():
```

它会渲染 `templates/index.html`，并传入：

```python
feature_names=FEATURE_COLUMNS
default_feature="RM"
```

前端通过 Jinja 拿到这些值：

```js
const FEATURE_NAMES = {{ feature_names | tojson }};
const DEFAULT_FEATURE = {{ default_feature | tojson }};
```

### 5. `/api/data_view`

用途：数据预处理模块使用。

前端切换特征或进入“数据预处理”时，会请求：

```js
postJson("/api/data_view", { feature })
```

后端返回内容包括：

- 原始散点图数据
- 标准化后散点图数据
- 原始回归趋势线
- 标准化回归趋势线
- 单特征相关系数
- 全特征相关系数
- 标准化前后统计表

主要结构：

```python
response = {
    "feature": feature,
    "target": TARGET_COLUMN,
    "raw": {...},
    "standardized": {...},
    "correlations": ...,
    "standardize_table": ...
}
```

前端的数据预处理图表主要依赖这个接口。

### 6. `/api/train_prepare`

用途：模型训练与评估模块使用。

前端进入“模型训练与评估”或修改训练参数时，会请求：

```js
postJson("/api/train_prepare", {
  feature,
  use_standardized,
  learning_rate,
  epochs,
  w0,
  b0
})
```

后端会生成：

- 当前特征的训练数据
- 每一轮 epoch 的参数
- loss、RMSE、MAE、R2
- 梯度 `dw`、`db`
- 当前线性模型参数
- 最优线性拟合参数
- 梯度下降热力图数据

核心计算函数：

```python
build_training_history(...)
```

它会从 `w0`、`b0` 开始，按照学习率进行梯度下降，并记录每一轮结果。

### 7. `/api/predict`

用途：预测功能预留。

它根据输入特征值，计算当前线性模型预测的 `MEDV`。

目前前端主要重点在数据预处理和训练可视化，这个接口可用于后续扩展预测模块。

## 三、index.html 说明

`templates/index.html` 是当前项目最复杂的文件，包含 HTML、CSS 和 JavaScript。

### 1. 主要外部库

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css">
<script src="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-all.js"></script>
```

- ECharts：画散点图、柱状图、折线图、热力图。
- GridStack：实现图表卡片拖拽、缩放、4 列网格布局。

如果 CDN 不能访问，ECharts 或 GridStack 会加载失败。当前代码对 GridStack 有普通布局兜底，但 ECharts 仍然需要正常加载。

## 四、页面区域结构

页面整体为三栏：

```html
<aside class="sidebar">左侧导航</aside>
<main class="main" id="main">中间内容区</main>
<aside class="assistant">右侧控制面板</aside>
```

左侧导航控制当前页面：

- 理论部分
- 数据预处理
- 模型训练与评估
- 模型预测
- 学生训练

切换页面的核心函数：

```js
setPage(page)
```

默认进入：

```js
setPage("basic");
```

也就是默认显示“实验基本信息”。

## 五、理论页面

理论页面由：

```js
renderTheory(page)
```

渲染。

理论内容来自：

```js
const theoryPages = {...}
```

如果 `static/theory-html/` 中存在对应 HTML 文件，还会通过 iframe 加载额外内容：

```js
loadTheoryHtml(page)
```

## 六、数据预处理模块

### 1. 页面渲染

数据预处理页面由：

```js
renderDataShell()
```

负责生成：

- 中间图表容器
- 右侧控制面板
- 特征选择下拉框
- 显示模式复选框

### 2. 加载数据

```js
loadDataView()
```

会请求后端：

```js
"/api/data_view"
```

并保存到：

```js
dataCache
```

### 3. 渲染图表

```js
renderDataCharts()
```

会读取当前勾选的图表：

```js
selectedValues("dataViews")
```

然后根据勾选项渲染：

- `raw`：原始散点图
- `standardized`：预处理散点图
- `single_corr`：单特征线性相关系数
- `all_corr`：全特征线性相关系数

### 4. 数据预处理 GridStack 布局

如果 GridStack 加载成功，会进入：

```js
renderDataDashboard(grid, views)
```

默认布局：

```js
raw: { x: 0, y: 0, w: 2, h: 2 }
standardized: { x: 2, y: 0, w: 2, h: 2 }
single_corr: { x: 0, y: 2, w: 2, h: 2 }
all_corr: { x: 2, y: 2, w: 2, h: 2 }
```

也就是默认四张图都是 `2 列 x 2 行`。

布局会保存到：

```js
preprocessGridLayoutV4
```

保存逻辑在：

```js
saveDataGridLayout()
```

恢复逻辑在：

```js
loadDataGridLayout()
```

### 5. 数据预处理显示模式缓存

你勾选了哪些图，会保存到：

```js
preprocessSelectedViewsV1
```

相关函数：

```js
restoreCheckedValues("dataViews", "preprocessSelectedViewsV1")
saveCheckedValues("dataViews", "preprocessSelectedViewsV1")
```

切换菜单前也会主动保存：

```js
persistActiveViewSelection()
```

这样切到别的菜单再切回来，会保留之前勾选的图表。

## 七、模型训练与评估模块

### 1. 页面渲染

训练页由：

```js
renderTrainShell()
```

负责生成：

- 特征选择
- 是否标准化
- 显示模式
- 初始参数 `w0`、`b0`
- 学习率
- 训练轮数
- 动画速度
- 单步、自动、暂停、重置按钮

### 2. 准备训练数据

```js
prepareTraining()
```

请求：

```js
"/api/train_prepare"
```

返回结果保存到：

```js
trainData
```

### 3. 渲染训练帧

```js
renderTrainFrame(index)
```

根据当前 epoch 渲染图表。

当前轮数保存在：

```js
currentFrame
```

### 4. 训练页图表类型

训练页包含这些显示模式：

- `model_train`：模型训练
- `learning`：学习准则
- `gradient`：梯度下降图
- `w_path`：w 参数轨迹
- `b_path`：b 参数轨迹
- `rmse`：RMSE
- `mae`：MAE
- `r2`：R²
- `calc`：本轮计算过程
- `table`：每轮参数表

### 5. 训练页 GridStack 默认布局

训练页使用：

```js
renderTrainDashboard(grid, views, frame)
```

默认布局：

```js
model_train: { x: 0, y: 0, w: 2, h: 2 }
learning:    { x: 2, y: 0, w: 2, h: 2 }
gradient:    { x: 0, y: 2, w: 1, h: 1 }
w_path:      { x: 1, y: 2, w: 1, h: 1 }
b_path:      { x: 2, y: 2, w: 1, h: 1 }
rmse:        { x: 3, y: 2, w: 1, h: 1 }
mae:         { x: 0, y: 3, w: 1, h: 1 }
r2:          { x: 1, y: 3, w: 1, h: 1 }
calc:        { x: 0, y: 4, w: 4, h: 2 }
table:       { x: 0, y: 6, w: 4, h: 1 }
```

训练页布局保存到：

```js
trainGridLayoutV1
```

训练页显示模式保存到：

```js
trainSelectedViewsV1
```

## 八、GridStack 相关逻辑

### 1. 当前网格模式

```js
let dataGridMode = null;
```

可能值：

- `"preprocess"`：数据预处理
- `"train"`：模型训练与评估

保存布局时会根据这个值决定写入哪个缓存：

```js
localStorage.setItem(
  dataGridMode === "train" ? "trainGridLayoutV1" : "preprocessGridLayoutV4",
  JSON.stringify(layout)
);
```

### 2. 保存布局

```js
saveDataGridLayout()
```

会读取每个 GridStack item 的：

- `x`
- `y`
- `w`
- `h`

然后保存到 localStorage。

### 3. 销毁布局

```js
destroyDataGrid()
```

切换页面或重新渲染图表前会调用。它会先保存布局，再销毁当前 GridStack 实例。

### 4. 同步 DOM 属性

```js
syncDataGridAttributes()
```

GridStack 内部会维护自己的 `x/y/w/h`，但 DOM 上的 `gs-x/gs-y/gs-w/gs-h` 有时不会立刻同步。

项目里有本地兜底 CSS 依赖这些属性，所以拖拽或缩放后要主动同步。

### 5. 自适应行高

```js
updateDataGridCellHeight()
```

它会根据当前网格宽度计算每一列宽度，然后设置行高：

```js
const columnWidth = grid.clientWidth / 4;
dataGrid.cellHeight(Math.max(220, Math.round(columnWidth)));
```

这样 1 格接近正方形，`2x2` 看起来就是比较完整的图表块。

窗口变化时也会调用：

```js
window.addEventListener("resize", () => {
  updateDataGridCellHeight();
  charts.forEach(ch => ch.resize());
});
```

## 九、ECharts 图表函数

主要图表配置函数：

```js
scatterOption(...)
singleCorrOption(...)
allCorrOption(...)
trainScatterOption(...)
lossOption(...)
paramPathOption(...)
metricOption(...)
contourOption(...)
lineOption(...)
```

### 1. 数据预处理图表

- `scatterOption`：原始/标准化散点图和趋势线。
- `singleCorrOption`：单个特征与 MEDV 的相关系数。
- `allCorrOption`：所有特征与 MEDV 的相关系数。

### 2. 训练图表

- `trainScatterOption`：当前训练直线、最优直线、散点图。
- `lossOption`：MSE loss 曲线。
- `contourOption`：梯度下降热力图和路径。
- `paramPathOption`：w、b 参数轨迹。
- `metricOption`：RMSE、MAE、R²。

### 3. 图表 resize

每个图表初始化时：

```js
initChart(id)
```

会绑定 `ResizeObserver`。

当卡片大小变化时，ECharts 会自动：

```js
ch.resize()
```

这就是拖拽缩放后图表能重新适配的原因。

## 十、localStorage 缓存 key 汇总

当前项目使用这些浏览器本地缓存：

```text
preprocessGridLayoutV4     数据预处理图表位置和大小
preprocessSelectedViewsV1  数据预处理勾选了哪些图
trainGridLayoutV1          模型训练图表位置和大小
trainSelectedViewsV1       模型训练勾选了哪些图
```

如果页面布局被拖乱，想恢复默认，可以在浏览器控制台执行：

```js
localStorage.removeItem("preprocessGridLayoutV4");
localStorage.removeItem("preprocessSelectedViewsV1");
localStorage.removeItem("trainGridLayoutV1");
localStorage.removeItem("trainSelectedViewsV1");
location.reload();
```

## 十一、修改建议

### 1. 想改默认图表大小

数据预处理改：

```js
defaultDataGridLayout(view)
```

模型训练改：

```js
defaultTrainGridLayout(view)
```

### 2. 想改默认进入页面

文件底部：

```js
setPage("basic");
```

改成其他页面即可，例如：

```js
setPage("preprocess");
```

### 3. 想新增图表

一般需要改这些地方：

1. 右侧控制面板添加 checkbox。
2. `chartTitle(view)` 添加标题。
3. `chartSub(view, data)` 添加副标题。
4. `renderDataCharts()` 或 `renderTrainFrame()` 里添加渲染逻辑。
5. 新增一个 ECharts option 函数。
6. 如果是 GridStack 页面，添加默认布局。

### 4. 想重置某个模块布局

只删对应 localStorage key 即可。

例如只重置训练页：

```js
localStorage.removeItem("trainGridLayoutV1");
localStorage.removeItem("trainSelectedViewsV1");
location.reload();
```

## 十二、注意事项

1. `index.html` 中有不少中文乱码，这是历史编码问题。当前功能可用，除非整体重新转码，否则不要随便批量替换所有文本。
2. GridStack 和 ECharts 都依赖 CDN，离线环境可能无法正常显示。
3. 切换页面时会销毁旧图表和旧 GridStack，因此布局和显示模式必须依赖 localStorage 保存。
4. 如果修改图表容器大小，一定要确保 ECharts 调用 `resize()`。
5. 修改拖拽布局时，注意 `syncDataGridAttributes()`，否则本地兜底 CSS 可能拿不到最新 `gs-w`、`gs-h`。

