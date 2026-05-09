# 简单线性回归可视化教学实验

这是一个基于 Flask、ECharts、ECharts GL 和 GridStack 的简单线性回归教学项目。项目围绕 Boston Housing 数据集展开，用单特征线性回归帮助学生理解数据预处理、特征标准化、梯度下降、损失函数、参数更新、模型评估和预测过程。

当前页面的核心目标不是只给出一个训练结果，而是把训练过程拆开给学生看清楚：参数怎么变、梯度怎么来、Loss 如何下降、当前参数距离最优参数还有多远，以及这些内容在二维和三维图中分别是什么样子。

## 项目结构

```text
simple_linear_regression1/
├── app.py
├── 01_preprocess_features_only_standardize.py
├── boston_housing.csv
├── boston_housing_features_standardized.csv
├── requirements.txt
├── README.md
├── static/
│   └── theory-html/
│       ├── README.md
│       └── basic.html
└── templates/
    └── index.html
```

主要文件说明：

- `app.py`：Flask 后端，负责读取数据、生成训练历史、计算指标、生成 Loss 网格数据，并提供预测接口。
- `templates/index.html`：前端主页面，包含页面布局、控制面板、图表渲染、训练动画和 GridStack 拖拽缩放逻辑。
- `boston_housing.csv`：原始 Boston Housing 数据。
- `boston_housing_features_standardized.csv`：特征标准化后的数据。
- `01_preprocess_features_only_standardize.py`：生成标准化特征数据的脚本。
- `static/theory-html/`：理论页面可加载的静态 HTML 内容。
- `requirements.txt`：Python 运行依赖。

## 运行方式

推荐使用 Python 3.10 或更高版本。

安装依赖：

```bash
python -m pip install -r requirements.txt
```

启动项目：

```bash
python app.py
```

浏览器访问：

```text
http://127.0.0.1:5000/
```

`app.py` 已开启模板自动重载：

```python
app.config["TEMPLATES_AUTO_RELOAD"] = True
```

修改 `templates/index.html` 后，通常刷新浏览器即可看到变化。修改 `app.py` 这类 Python 后端逻辑后，一般需要重启 Flask 服务。

## 数据与特征

目标变量固定为：

```python
TARGET_COLUMN = "MEDV"
```

可选特征：

```python
FEATURE_COLUMNS = [
    "CRIM", "ZN", "INDUS", "CHAS", "NOX", "RM", "AGE", "DIS",
    "RAD", "TAX", "PTRATIO", "B", "LSTAT"
]
```

训练模块支持两种数据版本：

- 原始特征：直接使用 `boston_housing.csv` 中的特征列。
- 标准化特征：使用 `boston_housing_features_standardized.csv` 中的 `特征名_standardized` 列。

教学上建议优先观察标准化特征，因为它能让梯度下降更稳定，Loss 等高线和三维曲面也更容易看清。原始特征因为数值尺度差异较大，学习率稍大时可能出现参数发散、Loss 尺度过大、图形被极端值拉伸等现象。

## 后端接口

`app.py` 当前提供 4 个主要路由：

```text
GET  /
POST /api/data_view
POST /api/train_prepare
POST /api/predict
```

### `GET /`

渲染主页面，并把特征列表和默认特征传给前端：

```python
return render_template(
    "index.html",
    feature_names=FEATURE_COLUMNS,
    default_feature="RM",
)
```

### `POST /api/data_view`

用于“数据预处理”模块。前端传入：

```js
{ feature }
```

后端返回：

- 原始特征散点数据。
- 标准化特征散点数据。
- 原始趋势线。
- 标准化趋势线。
- 当前特征的统计信息。
- 全部特征与 `MEDV` 的相关系数。
- 标准化前后的对比表。

### `POST /api/train_prepare`

用于“模型训练与评估”模块。前端传入：

```js
{
  feature,
  use_standardized,
  learning_rate,
  epochs,
  w0,
  b0
}
```

后端返回：

- 当前特征的训练数据。
- 每轮 epoch 的参数历史。
- `MSE`、`RMSE`、`MAE`、`R2`。
- 当前梯度 `dw`、`db`。
- 下一轮参数 `new_w`、`new_b`。
- 前 5 个样本的 `x`、`y`、`y_hat`、预测误差。
- 最优线性拟合参数 `best.w`、`best.b`。
- `w-b` 参数空间中的 Loss 网格数据。

相关核心函数：

- `compute_metrics(...)`：计算预测值、预测误差、MSE、RMSE、MAE、R2、dw、db。
- `build_training_history(...)`：从初始 `w0/b0` 开始，按梯度下降生成训练历史。
- `build_contour(...)`：生成 `w-b` 参数空间中的 MSE 网格。

### `POST /api/predict`

用于模型预测扩展。当前会根据特征、输入值和数据版本拟合一元线性模型，并返回预测值、标准化换算信息和模型参数。

## 前端结构

`templates/index.html` 是项目当前的主要工作文件。它包含 HTML、CSS 和 JavaScript。

使用的前端库：

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-gl@2/dist/echarts-gl.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css">
<script src="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-all.js"></script>
```

用途：

- ECharts：二维散点图、折线图、仪表盘、Loss 等高线图等。
- ECharts GL：Loss 三维曲面图。
- GridStack：图表卡片拖拽、缩放、布局保存。

页面整体分为三栏：

- 左侧：理论部分、实验部分、学生训练导航。
- 中间：当前模块的图表和内容区。
- 右侧：控制面板，包括特征选择、数据版本、显示模式、学习率、训练轮数、动画速度等。

## 模型训练与评估模块

训练模块的主要函数：

```js
renderTrainShell()
prepareTraining()
renderTrainFrame(index)
renderTrainDashboard(grid, views, frame)
```

右侧控制面板支持：

- 特征选择。
- 原始特征和标准化特征切换。
- 显示模式多选。
- 初始 `w` 和初始 `b`。
- 学习率。
- 训练轮数。
- 动画速度。
- 训练一轮、自动训练、暂停、重置。

## 当前训练视图

| view key | 显示名称 | 说明 |
| --- | --- | --- |
| `model_train` | 模型训练 | 样本点、当前回归线、最优参考线 |
| `learning` | 学习准则 | MSE Loss 随 epoch 的变化 |
| `gradient` | Loss 等高线图 | `w-b` 参数空间中的 Loss 等高线和参数路径 |
| `loss_surface_3d` | Loss 三维曲面图 | `J(w,b)` 三维曲面、下降轨迹、偏导切线 |
| `gradient_descent` | 梯度下降图 | `dw` 和 `db` 随 epoch 的变化 |
| `w_path` | w 参数轨迹 | `w` 随 epoch 的变化 |
| `b_path` | b 参数轨迹 | `b` 随 epoch 的变化 |
| `rmse` | RMSE | 上方仪表盘，下方趋势线 |
| `mae` | MAE | 上方仪表盘，下方趋势线 |
| `r2` | R2 | 上方仪表盘，下方趋势线 |
| `calc` | 本轮计算过程 | 当前 epoch 的详细计算过程 |
| `table` | 每轮参数表 | 最近 50 条训练记录 |

## 默认训练布局

默认布局在 `defaultTrainGridLayout(view)` 中维护：

```js
model_train:      { x: 0, y: 0,  w: 2, h: 2 }
learning:         { x: 2, y: 0,  w: 2, h: 2 }
gradient:         { x: 0, y: 2,  w: 2, h: 2 }
loss_surface_3d:  { x: 0, y: 4,  w: 2, h: 2 }
w_path:           { x: 2, y: 2,  w: 1, h: 1 }
b_path:           { x: 2, y: 3,  w: 1, h: 1 }
rmse:             { x: 3, y: 2,  w: 1, h: 2 }
mae:              { x: 2, y: 4,  w: 1, h: 2 }
r2:               { x: 3, y: 4,  w: 1, h: 2 }
gradient_descent: { x: 0, y: 6,  w: 1, h: 2 }
calc:             { x: 0, y: 8,  w: 4, h: 6 }
table:            { x: 0, y: 14, w: 4, h: 1 }
```

注意：GridStack 会把用户拖拽和缩放后的布局保存到浏览器 localStorage。修改默认布局后，如果页面仍显示旧布局，需要清除浏览器里对应的布局缓存。

只重置训练页布局：

```js
localStorage.removeItem("trainGridLayoutV1");
location.reload();
```

重置训练页布局和显示模式：

```js
localStorage.removeItem("trainGridLayoutV1");
localStorage.removeItem("trainSelectedViewsV1");
location.reload();
```

## 关键图表说明

### 模型训练图

函数：

```js
trainScatterOption(frameIndex)
```

展示样本散点、当前回归线和最优参考线。学生可以直观看到当前参数对应的模型线，以及它距离最优拟合线还有多远。

### 学习准则图

函数：

```js
lossOption(frameIndex)
```

展示 MSE Loss 随训练轮数变化的曲线。它回答的是“训练是否真的让损失下降”。

### Loss 等高线图

函数：

```js
contourOption(frameIndex)
lossContourSeries(c)
contourSegments(c, level)
contourEdgePoint(a, b, level)
```

含义：

- 横轴是 `w`。
- 纵轴是 `b`。
- 每一圈线表示相同的 MSE。
- 当前点表示当前 epoch 的参数位置。
- 路径表示参数更新轨迹。
- 最优点表示最小二乘意义下的参考最优参数。

这个图应该表现为标准的 Loss 等高线图，而不是热力图。对于标准化特征，等高线通常更接近一圈圈椭圆；对于原始特征，尺度差异可能让图形被拉得很极端。

### Loss 三维曲面图

函数：

```js
lossSurface3DOption(frameIndex)
mseAtParams(w, b)
tangentLine3D(frame, axis, c)
```

含义：

```text
x 轴：w
y 轴：b
z 轴：J(w,b) = MSE
```

展示内容：

- MSE 三维曲面。
- 参数下降轨迹。
- 当前参数点。
- 最优参数点。
- 当前点处的 `dJ/dw` 偏导切线。
- 当前点处的 `dJ/db` 偏导切线。

交互说明：

- 左键拖拽用于旋转。
- 鼠标滚轮用于缩放。
- ECharts GL 的平移能力受浏览器和图表容器影响，右键平移不一定稳定。
- 为了尽量避免每次训练后视角重置，前端会复用图表实例，而不是每一帧都销毁重建。

### 梯度下降图

函数：

```js
gradientDescentOption(frameIndex)
```

这个图由上下两部分组成：

- 上方：`dw` 随 epoch 的变化。
- 下方：`db` 随 epoch 的变化。

“梯度下降”指的是算法目标是让 Loss 下降，并不表示 `dw` 或 `db` 的数值本身一定单调变小。如果 `dw/db` 是负数，它们可能从较大的负值逐渐接近 0，图上看起来是在上升，但梯度绝对值在变小，模型仍然可能在向 Loss 更小的位置移动。

### w 和 b 参数轨迹图

函数：

```js
singleLineOption(key, title, frameIndex)
```

分别展示 `w` 和 `b` 随训练轮数变化的过程，适合和 Loss 图、等高线图一起观察参数更新行为。

### RMSE、MAE、R2 仪表盘

函数：

```js
metricOption(key, frameIndex)
metricGaugeConfig(key, rows)
```

每个指标卡片由两部分组成：

- 上方：仪表盘，显示当前指标值。
- 下方：折线图，显示该指标随 epoch 的变化。

默认布局是 `w: 1, h: 2`，让一个指标卡片内部上下展示仪表盘和趋势线。

### 本轮计算过程

函数：

```js
calcHtml(frame)
calcHtmlDetailed(frame)
```

展示当前 epoch 的详细计算过程，包括：

- 当前 `epoch`。
- 当前参数 `w` 和 `b`。
- 前 5 个样本的预测值和预测误差。
- `MSE`、`RMSE`、`MAE`、`R2`。
- 梯度公式：

```text
dw = (2 / m) * sum(预测误差 * x)
db = (2 / m) * sum(预测误差)
```

- 参数更新公式：

```text
new_w = w - learning_rate * dw
new_b = b - learning_rate * db
```

- 最优 `w/b`。
- 当前参数到最优参数的距离。

该区域默认高度为 6 行，便于展示完整过程；如果用户手动缩小卡片，内容会自动出现滚动条。

### 每轮参数表

函数：

```js
tableHtml(frameIndex)
```

表格只展示最近 50 条训练记录，避免训练 500 或 1000 轮时页面生成大量表格行。后端的完整训练历史仍然保留，图表和动画可以继续使用完整数据。

## localStorage 缓存

当前使用的浏览器缓存 key：

```text
preprocessGridLayoutV4     数据预处理图表布局
preprocessSelectedViewsV1  数据预处理勾选项
trainGridLayoutV1          训练页图表布局
trainSelectedViewsV1       训练页勾选项
```

重置全部布局和勾选项：

```js
localStorage.removeItem("preprocessGridLayoutV4");
localStorage.removeItem("preprocessSelectedViewsV1");
localStorage.removeItem("trainGridLayoutV1");
localStorage.removeItem("trainSelectedViewsV1");
location.reload();
```

## 常见修改位置

新增训练图表时，通常需要改：

```js
defaultTrainGridLayout(view)
chartTitle(view)
chartSub(view, data)
renderTrainFrame(index)
```

如果右侧显示模式需要增加选项，还要修改对应 checkbox。

修改本轮计算过程：

```js
calcHtml(frame)
calcHtmlDetailed(frame)
```

修改每轮参数表：

```js
tableHtml(frameIndex)
```

修改评估指标仪表盘：

```js
metricOption(key, frameIndex)
metricGaugeConfig(key, rows)
```

修改 Loss 等高线图：

```js
contourOption(frameIndex)
lossContourSeries(c)
contourLevels(values, count)
contourSegments(c, level)
contourEdgePoint(a, b, level)
```

修改 Loss 三维曲面图：

```js
lossSurface3DOption(frameIndex)
tangentLine3D(frame, axis, c)
```

## requirements.txt 检查

当前 Python 依赖是：

```text
Flask>=3.0,<4.0
numpy>=1.24,<3.0
pandas>=2.0,<3.0
```

最近新增的图表能力使用的是前端 CDN：

- `echarts`
- `echarts-gl`
- `gridstack`

这些不需要写进 `requirements.txt`，所以当前 `requirements.txt` 暂时不需要修改。

## 维护注意事项

1. `templates/index.html` 是当前主要修改文件，代码量较大，修改时建议小范围定位函数，不要整段无关替换。
2. 图表布局会被 localStorage 缓存。默认布局改了但页面没变化时，优先检查是否用了旧缓存。
3. 原始特征下 Loss 曲面和等高线可能尺度极大，这是数据未标准化导致的正常现象，不一定是画图错误。
4. `Loss 三维曲面图` 依赖 `echarts-gl`。如果 CDN 加载失败，该图无法渲染。
5. 如果训练时 3D 视角仍然被重置，优先检查 `renderTrainFrame` 是否销毁并重建了图表实例。
6. 项目说明只保留 `README.md`，后续维护文档时集中修改这一处。

## 建议上传到 Git 的文件

建议上传：

```text
app.py
01_preprocess_features_only_standardize.py
boston_housing.csv
boston_housing_features_standardized.csv
requirements.txt
README.md
templates/index.html
static/theory-html/README.md
static/theory-html/basic.html
```

不建议上传：

```text
__pycache__/
.vscode/
flask.server.log
```
