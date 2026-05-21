# 简单线性回归教学实验

这是一个面向初学者的简单线性回归 Web 教学实验。项目用 Flask 提供后端接口，用原生 JavaScript、ECharts 和 GridStack 构建前端交互，让学生在同一个页面里完成数据预处理、模型训练、模型评估和模型预测，并能按步骤查看对应的核心机器学习代码。

项目定位不是“展示一整份工程源码”，而是“先看实验现象，再展开当前步骤代码”。因此每个关键操作旁边都提供“查看代码”入口，代码以 Python / NumPy 风格呈现，重点解释线性回归逻辑，而不是前端实现细节。

## 当前能力

- 理论部分：展示实验基本信息、实验目的、前置知识、模型介绍、数据集、训练模型、学习准则、参数优化、评价指标、预测结果和思考拓展。
- 数据预处理：加载 Boston Housing 数据集，查看数据详情，观察原始数据可视化，执行 z-score 标准化，观察标准化后的数据。
- 模型训练：支持回归过程、预处理影响、损失函数、优化准则和自定义参数训练等教学步骤。
- 模型评估：展示当前训练模型的拟合效果，并提供 RMSE、MAE、R² 指标解释。
- 模型预测：基于当前训练帧的 w、b 和特征列输入新样本，展示预测可视化、原始散点图和预测计算过程。
- 代码解释层：预处理、训练、评估、预测页面均提供“查看代码”按钮，右侧抽屉显示当前步骤的核心代码、操作说明、逐行解释和复制按钮。
- 交互状态：训练参数、预测输入、评估指标模式、图表布局等状态在前端内存中维护，页面切换时尽量保持教学上下文。

## 运行方式

```bash
python -m pip install -r requirements.txt
python app.py
```

启动后访问：

```text
http://127.0.0.1:5000/
```

前端依赖通过 CDN 引入，主要包括：

```text
echarts
echarts-gl
gridstack
```

## 项目结构

```text
simple_linear_regression/
├── app.py
├── requirements.txt
├── README.md
├── web_ui_structure_cn.md
├── core/
│   ├── chart_registry.py
│   ├── context_store.py
│   ├── control_registry.py
│   ├── data_utils.py
│   ├── dataset_profile.py
│   ├── experiment_registry.py
│   ├── registry.py
│   └── schemas.py
├── datasets/
│   ├── raw/
│   │   └── boston_housing.csv
│   └── preprocessed/
│       └── boston_housing_preprocessed.csv
├── models/
│   └── simple_linear_regression/
│       ├── dataset.py
│       ├── model.py
│       ├── controls/
│       │   ├── evaluate.py
│       │   ├── predict.py
│       │   ├── preprocess.py
│       │   └── train_eval.py
│       └── charts/
│           ├── evaluate/
│           ├── predict/
│           ├── preprocess/
│           └── train_eval/
├── static/
│   ├── assets/
│   ├── theory-html/
│   └── js/
│       ├── api.js
│       ├── app_shell.js
│       ├── chart_renderers.js
│       ├── control_renderers.js
│       ├── evaluate_page.js
│       ├── experiment_runtime.js
│       ├── predict_page.js
│       ├── preprocess_page.js
│       ├── schema_registry.js
│       ├── state_runtime.js
│       ├── theory_page.js
│       ├── train_page.js
│       └── view_renderers.js
└── templates/
    └── index.html
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

当前实验默认将 `MEDV` 作为目标值 y，其余数值列作为输入特征 X。标准化实验中，特征列和目标列都会进入 z-score 标准化流程：

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

### 数据预处理

数据预处理页按 5 个步骤组织：

```text
01 加载原始数据
02 数据详情
03 原始数据可视化
04 数据标准化
05 标准数据可视化
```

适合展示的核心代码包括：

- 加载数据：读取 CSV，拆分 X/y。
- 数据统计：样本数量、特征数量、缺失值、重复值、describe 统计。
- 原始可视化：选择当前特征和目标列绘制散点图。
- 数据标准化：计算 mean/std 并进行 z-score 转换。
- 标准化可视化：使用标准化后的特征和目标值绘制图表。

### 模型训练

模型训练页按教学目标分为：

```text
01 熟悉回归过程
02 熟悉预处理影响
03 熟悉损失函数
04 熟悉优化准则
05 自定义参数训练
```

核心概念包括：

- 预测函数：`y_pred = w * x + b`
- 损失函数：`MSE = mean((y - y_pred) ** 2)`
- 梯度下降：沿负梯度方向更新 `w` 和 `b`
- 参数轨迹：观察 w、b、loss 随 epoch 的变化
- 预处理影响：对比原始特征训练和标准化特征训练

自定义参数训练会把当前特征、初始 w、初始 b、学习率、训练轮数等配置联动到代码面板中，让学生看到“当前操作对应的代码”。

### 模型评估

模型评估页复用当前训练得到的模型参数，展示：

- 拟合效果图
- RMSE
- MAE
- R²

指标代码示例：

```python
mse = np.mean((y - y_pred) ** 2)
rmse = np.sqrt(mse)
mae = np.mean(np.abs(y - y_pred))
ss_res = np.sum((y - y_pred) ** 2)
ss_tot = np.sum((y - np.mean(y)) ** 2)
r2 = 1 - ss_res / ss_tot
```

### 模型预测

模型预测页使用当前训练页的模型状态。右侧控制面板包含：

- 当前模型：来源、特征、w、b。
- 特征选择：跟随训练页当前特征，只读展示。
- 输入类型：原始特征值或标准特征值。
- 输入特征值：普通文本输入框，不使用数字步进箭头。
- 开始预测：只有点击按钮或在输入框按 Enter 时才更新预测结果。
- 查看预测代码：打开预测代码抽屉。

预测页有一个重要交互规则：修改输入框内容时，中间图表和计算过程保持不变，不自动恢复默认，也不自动展示新结果。只有触发“开始预测”后，才更新预测点、预测值和计算过程。

## 代码解释层设计

代码展示使用右侧抽屉，而不是占用主图表区域。抽屉结构固定为：

```text
当前步骤代码
├── 当前操作
├── 核心代码
├── 代码解释
└── 复制代码
```

交互规则：

- 点击“查看代码”打开抽屉。
- 代码抽屉只通过右上角 `x` 关闭。
- 点击页面其他区域不会关闭抽屉，避免学生阅读代码时误触导致面板消失。
- 代码片段控制在教学友好的长度，优先展示机器学习逻辑。
- 默认展示 Python / NumPy 风格代码，不展示 React、ECharts 或 GridStack 配置。

## API

```text
GET  /
GET  /api/experiments
GET  /api/dataset_profile?experiment=<experiment>
GET  /api/page_schema?experiment=<experiment>&page=<page>
GET  /api/chart_registry?experiment=<experiment>&page=<page>
POST /api/run_action
POST /api/chart_data
```

当前实验 ID：

```text
simple_linear_regression
```

主要 action：

```text
load_dataset
data_view
standardize_dataset
prepare_train
predict
```

## 前后端职责

- `app.py`：Flask 路由入口，提供页面、实验配置、图表数据和动作执行接口。
- `core/`：实验注册、页面 schema、图表注册、控制面板注册、上下文存储等通用能力。
- `models/simple_linear_regression/model.py`：数据加载、标准化、训练、预测等核心实验逻辑。
- `models/simple_linear_regression/charts/`：各页面图表数据构造器。
- `models/simple_linear_regression/controls/`：各页面右侧控制面板 schema。
- `static/js/preprocess_page.js`：数据预处理页流程、图表和代码面板。
- `static/js/train_page.js`：训练页步骤、动画、对比、损失、优化和代码面板。
- `static/js/evaluate_page.js`：评估页图表、指标切换和代码面板。
- `static/js/predict_page.js`：预测页基础图表、预测状态、输入交互和代码面板。
- `templates/index.html`：整体布局、样式、侧边栏、右侧面板和脚本引入。

## 验证命令

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

## 维护建议

- 新增教学步骤时，优先补齐“现象展示、参数控制、代码解释、逐行解释”四件事。
- 新增代码片段时，保持短小、聚焦、动态联动当前参数。
- 预测相关交互要避免“输入即预测”，因为教学上应让学生明确区分“修改输入”和“执行预测”。
- 如果调整右侧控制面板按钮布局，尽量让同组按钮处于同一个父容器中，用统一 `gap` 管理间距，避免按钮宽度和间距不一致。
- 如果未来需要展示前端实现代码，可以单独增加“实现代码”模式，不要混入默认机器学习教学代码。
