# 简单线性回归教学实验

这是一个基于 Flask、ECharts、ECharts GL 和 GridStack 的简单线性回归教学实验项目。项目使用 Boston Housing 数据集作为教师示范案例，同时提供“自主实验”模块，支持学生上传自己的 CSV 数据集，完成数据预处理、模型训练与评估、模型预测的完整流程。

页面的核心目标不是只给出一个训练结果，而是把简单线性回归的训练过程拆开展示：特征如何标准化，参数 `w` 和 `b` 如何更新，Loss 如何下降，评价指标如何变化，以及输入一个新样本时模型如何完成预测。

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

主要文件：

- `app.py`：Flask 后端，负责读取数据、标准化、生成训练历史、计算指标、生成图表数据和提供预测接口。
- `templates/index.html`：前端主页面，包含页面布局、右侧控制面板、图表渲染、训练动画和 GridStack 拖拽缩放逻辑。
- `boston_housing.csv`：教师示范用原始 Boston Housing 数据。
- `boston_housing_features_standardized.csv`：教师示范用标准化特征数据。
- `01_preprocess_features_only_standardize.py`：生成标准化特征数据的脚本。
- `static/theory-html/`：理论部分可加载的静态 HTML 内容。
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

说明：

- 修改 `templates/index.html` 后，通常刷新浏览器即可看到变化。
- 修改 `app.py` 后，需要重启 Flask 服务，新增或修改的后端接口才会生效。
- 前端图表库通过 CDN 加载，离线环境下 ECharts、ECharts GL、GridStack 可能无法加载。

## 页面模块

左侧导航分为理论部分和实验部分。

理论部分包括：

- 实验基本信息
- 实验目的
- 前置知识
- 模型介绍
- 预期成果
- 思考拓展

实验部分包括：

- 数据预处理
- 模型训练与评估
- 模型预测
- 自主实验

前三个实验模块使用内置 Boston Housing 数据集，适合教师演示标准流程。自主实验模块用于学生上传自己的数据集，独立完成一次完整实验。

## 内置数据说明

内置目标变量：

```python
TARGET_COLUMN = "MEDV"
```

内置特征：

```python
FEATURE_COLUMNS = [
    "CRIM", "ZN", "INDUS", "CHAS", "NOX", "RM", "AGE", "DIS",
    "RAD", "TAX", "PTRATIO", "B", "LSTAT"
]
```

内置实验支持两种数据版本：

- 原始特征：使用 `boston_housing.csv` 中的原始特征列。
- 标准化特征：使用 `boston_housing_features_standardized.csv` 中的 `{feature}_standardized` 列。

教学上建议优先观察标准化特征，因为它能让梯度下降更稳定，也更容易观察 Loss 和参数更新过程。

## 自主实验

自主实验是学生数据集的完整工作台。它不是跳转复用内置 Boston Housing 的三个模块，而是在同一个模块内部完成：

1. 数据集加载
2. 字段设置
3. 数据预处理
4. 模型训练与评估
5. 模型预测

右侧控制区采用折叠式任务面板，中间展示区使用 GridStack 布局，图表可以拖拽和缩放。

### CSV 数据格式

当前只支持 CSV 文件。CSV 第一行必须是列名，至少包含：

- 1 个数值特征列
- 1 个数值目标列

原始数据集示例：

```csv
area,rooms,price
80,2,120
100,3,160
120,3,180
```

预处理后数据集示例：

```csv
area,rooms,price,area_standardized,rooms_standardized
80,2,120,-1.1355,-1.2247
100,3,160,-0.1622,0
120,3,180,0.8111,0
```

规则：

- 原始数据集只需要原始特征列和目标列。
- 已预处理数据集建议保留原始特征列、目标列和 `{feature}_standardized` 标准化列。
- 目标列不参与标准化。
- 参与训练和预测的列必须是数值型。
- 如果上传的是原始数据集，可以在页面中点击“预处理”生成标准化特征。

### 自主实验控制区

右侧控制区包括：

- `01 数据集`：上传 CSV，选择原始数据集或已预处理数据集。
- `02 字段设置`：选择目标列、特征列和当前观察/训练特征。特征列较多时可以滚动查看。
- `03 数据预处理`：准备预处理、执行预处理、查看数据；默认显示原始数据、预处理数据和相关系数图。
- `04 模型训练与评估`：选择原始/标准化特征，设置 `w0`、`b0`、学习率、训练轮数和动画速度。
- `05 模型预测`：输入预测值，使用当前训练模型进行预测并展示结果。

### 自主实验训练图表

训练模块默认显示：

- 模型训练图
- 学习准则图

可选显示：

- 参数轨迹图
- 评估标准图
- 本轮计算过程
- 每轮参数表

评估标准图会展开成 3 个独立仪表盘：

- RMSE
- MAE
- R²

这三个仪表盘作为独立图卡放入 GridStack 布局中，避免在同一张图里互相挤压。

### 训练参数变更说明

点击“准备训练”后，后端会根据当前参数生成完整训练历史。

如果之后修改以下参数：

- 当前训练特征
- 数据版本
- 初始 `w`
- 初始 `b`
- 学习率
- 训练轮数

页面会提示需要重新点击“准备训练”。这是因为训练历史已经按旧参数生成，必须重新请求后端才能得到新的训练过程。

## 后端接口

内置数据接口：

```text
GET  /
POST /api/data_view
POST /api/train_prepare
POST /api/predict
```

学生数据接口：

```text
POST /api/student/upload
POST /api/student/preprocess
POST /api/student/data_view
POST /api/student/train_prepare
POST /api/student/predict
```

### `/api/student/upload`

上传学生 CSV 数据集。

表单字段：

```text
file: CSV 文件
source_type: raw 或 standardized
```

返回内容包括：

- `dataset_id`
- 数据列名
- 数值列名
- 样本数量
- 前几行预览数据

当前学生数据集保存在 Flask 进程内存中，重启服务后需要重新上传。

### `/api/student/preprocess`

对学生选择的特征列做标准化。

请求示例：

```json
{
  "dataset_id": "xxx",
  "target": "price",
  "features": ["area", "rooms"],
  "feature": "area"
}
```

返回标准化表和预览数据。

### `/api/student/data_view`

返回自主实验的数据预处理图表数据，包括：

- 原始散点图
- 标准化散点图
- 相关系数
- 标准化表

### `/api/student/train_prepare`

根据学生数据生成训练历史。

请求示例：

```json
{
  "dataset_id": "xxx",
  "target": "price",
  "features": ["area", "rooms"],
  "feature": "area",
  "use_standardized": true,
  "learning_rate": 0.03,
  "epochs": 120,
  "w0": 0,
  "b0": 0
}
```

返回内容包括：

- 散点数据
- 每轮训练历史
- 当前特征和目标列
- 最优线性拟合参数
- Loss 等高线数据

### `/api/student/predict`

使用学生数据进行预测。

请求示例：

```json
{
  "dataset_id": "xxx",
  "target": "price",
  "features": ["area", "rooms"],
  "feature": "area",
  "use_standardized": true,
  "value": 110
}
```

如果前端已有当前训练过程，预测展示会优先使用当前训练到的 `w` 和 `b`，使预测和学生当前训练状态保持一致。

## 前端依赖

前端通过 CDN 加载：

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-gl@2/dist/echarts-gl.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack.min.css">
<script src="https://cdn.jsdelivr.net/npm/gridstack@10.3.1/dist/gridstack-all.js"></script>
```

用途：

- ECharts：二维散点图、折线图、仪表盘、等高线图等。
- ECharts GL：Loss 三维曲面图。
- GridStack：图表卡片拖拽、缩放和布局保存。

这些前端库不需要写入 `requirements.txt`。

## localStorage 缓存

当前使用的浏览器缓存 key：

```text
preprocessGridLayoutV4      数据预处理图表布局
preprocessSelectedViewsV1   数据预处理勾选项
trainGridLayoutV1           训练页图表布局
trainSelectedViewsV1        训练页勾选项
predictGridLayoutV1         预测页图表布局
predictSelectedViewsV1      预测页勾选项
studentGridLayoutV1         自主实验图表布局
```

如果默认布局修改后页面仍显示旧布局，可以在浏览器控制台执行：

```js
localStorage.removeItem("studentGridLayoutV1");
location.reload();
```

重置全部实验布局：

```js
localStorage.removeItem("preprocessGridLayoutV4");
localStorage.removeItem("preprocessSelectedViewsV1");
localStorage.removeItem("trainGridLayoutV1");
localStorage.removeItem("trainSelectedViewsV1");
localStorage.removeItem("predictGridLayoutV1");
localStorage.removeItem("predictSelectedViewsV1");
localStorage.removeItem("studentGridLayoutV1");
location.reload();
```

## 常见维护位置

后端：

- 内置数据接口：`api_data_view`、`api_train_prepare`、`api_predict`
- 学生数据接口：`api_student_upload`、`api_student_preprocess`、`api_student_data_view`、`api_student_train_prepare`、`api_student_predict`
- 通用训练逻辑：`compute_metrics`、`build_training_history`、`build_contour`

前端：

- 自主实验入口：`renderStudentShell`
- 自主实验右侧面板：`renderStudentPanel`
- 自主实验中间展示：`renderStudentWorkspace`
- 自主实验数据图表：`renderStudentDataDashboard`
- 自主实验训练动画：`prepareStudentTraining`、`renderStudentTrainFrame`、`startStudentAuto`
- 自主实验预测：`prepareStudentPredictionView`、`loadStudentPrediction`
- 自主实验布局：`renderStudentGrid`、`defaultStudentGridLayout`

## 维护注意

1. `templates/index.html` 是当前主要前端文件，代码量较大，修改时建议按函数定位，避免大范围无关替换。
2. 修改 `app.py` 后需要重启 Flask，否则新增接口不会生效。
3. GridStack 布局会被浏览器缓存。布局修改后如果页面没变化，优先清理对应 localStorage key。
4. 原始特征训练时，如果学习率过大，可能出现参数发散或 Loss 极大，这是未标准化数据的正常风险。
5. 学生上传的数据当前保存在内存中，适合本地单机课堂演示；如果要多人同时使用，需要增加 session 或持久化存储。

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
