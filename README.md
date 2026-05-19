# 简单线性回归教学实验

这是一个面向教学演示的 Web 实验项目，用 Flask 提供后端接口，用原生前端、ECharts 和 GridStack 构建可交互的实验页面。当前重点是让学生按流程理解简单线性回归中的数据加载、数据预处理、模型训练、模型评估和模型预测。

## 当前功能

- 理论学习：展示实验基本信息、实验目的、前置知识、模型介绍、预期效果和思考拓展。
- 数据预处理：通过顶部流程条组织 `01 加载原始数据集 -> 02 数据详情 -> 03 原始数据可视化 -> 04 数据标准化 -> 05 标准数据可视化`。
- 数据详情：加载数据集后，中间区域显示数据规模、字段中文含义、数据质量和统计摘要。
- 数据标准化：后端直接提供预处理后的 CSV，列名和列顺序与原始数据保持一致，目标列也参与标准化。
- 模型训练与预测：基于当前数据版本和特征完成训练、评估与预测展示。

## 启动

```bash
python -m pip install -r requirements.txt
python app.py
```

浏览器访问：

```text
http://127.0.0.1:5000/
```

前端依赖通过 CDN 在 `templates/index.html` 中加载：

```text
echarts
echarts-gl
gridstack
```

## 目录结构

```text
simple_linear_regression/
├─ app.py
├─ core/
├─ datasets/
│  ├─ raw/
│  │  └─ boston_housing.csv
│  └─ preprocessed/
│     └─ boston_housing_preprocessed.csv
├─ models/
│  └─ simple_linear_regression/
│     ├─ dataset.py
│     ├─ model.py
│     ├─ controls/
│     └─ charts/
├─ static/
│  ├─ assets/
│  └─ js/
│     ├─ api.js
│     ├─ app_shell.js
│     ├─ chart_renderers.js
│     ├─ control_renderers.js
│     ├─ experiment_runtime.js
│     ├─ predict_page.js
│     ├─ preprocess_page.js
│     ├─ schema_registry.js
│     ├─ state_runtime.js
│     ├─ theory_page.js
│     ├─ train_page.js
│     └─ view_renderers.js
├─ templates/
│  └─ index.html
├─ tools/
├─ requirements.txt
└─ web_ui_structure_cn.md
```

## 数据集约定

数据集统一放在 `datasets/` 下，不再把 CSV 放在项目根目录。

```text
datasets/raw/           原始数据集
datasets/preprocessed/  预处理后的数据集
```

当前 Boston Housing 数据集约定：

```text
原始数据集：
datasets/raw/boston_housing.csv

预处理后数据集：
datasets/preprocessed/boston_housing_preprocessed.csv
```

CSV 格式规则：

- 第一行是列名。
- 最后一列是目标列，当前为 `MEDV`。
- 其他数值列作为候选特征。
- 预处理后的 CSV 与原始 CSV 保持相同列名和相同列顺序。
- 预处理后的 CSV 通过文件名区分，不再给列名追加 `_standardized`。
- 当前标准化会处理所有数值列，包括目标列 `MEDV`。

## 数据预处理页面

顶部流程条是数据预处理阶段的主线，节点可点击切换：

```text
01 加载原始数据集
02 数据详情
03 原始数据可视化
04 数据标准化
05 标准数据可视化
```

当前交互约定：

- `01 加载原始数据集`：中间区域只提示“请先在右侧加载数据集”，右侧提供数据集选择框和加载按钮。
- `02 数据详情`：加载后在中间区域显示数据规模、字段说明、数据质量和统计摘要，右侧不需要对应卡片。
- `04 数据标准化`：中间区域展示标准化后的前 5 行，右侧不需要单独编号卡片。
- 中间区域的数据卡片使用 GridStack，支持拖动和拉伸。
- 右侧“加载数据集”卡片不显示编号、未加载状态、折叠箭头、数据状态或样本数量。

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

常用动作：

```text
load_dataset
data_view
standardize_dataset
prepare_train
predict
```

## 关键文件

- `models/simple_linear_regression/model.py`：实验后端动作、数据加载、标准化数据读取、字段说明和训练预测逻辑。
- `models/simple_linear_regression/dataset.py`：数据集描述协议和预处理转换约定。
- `static/js/preprocess_page.js`：数据预处理页面流程、加载数据集、数据详情、标准化展示和 GridStack 布局。
- `static/js/control_renderers.js`：右侧控制面板渲染。
- `static/js/state_runtime.js`：GridStack 初始化和布局保存。
- `templates/index.html`：整体布局、样式、顶部流程条样式和 CDN 依赖。

## 验证命令

```bash
python -m compileall app.py core models
node --check static/js/api.js
node --check static/js/chart_renderers.js
node --check static/js/control_renderers.js
node --check static/js/view_renderers.js
node --check static/js/state_runtime.js
node --check static/js/schema_registry.js
node --check static/js/experiment_runtime.js
node --check static/js/theory_page.js
node --check static/js/preprocess_page.js
node --check static/js/predict_page.js
node --check static/js/train_page.js
node --check static/js/app_shell.js
```

## 当前数据预处理流程补充

数据预处理页采用顶部 5 步流程条，深蓝色表示当前点击位置，浅蓝色表示已到达的进度位置。流程为：

```text
01 加载原始数据 -> 02 数据详情 -> 03 原始数据可视化 -> 04 数据标准化 -> 05 标准数据可视化
```

右侧控制面板按当前步骤显示对应卡片：

- `01 加载原始数据`：显示 `加载数据集` 卡片，加载数据后不自动跳到第二步。
- `02 数据详情`：右侧不显示操作卡片；中间展示 `数据规模` 和 `统计详情`。
- `03 原始数据可视化`：显示 `原始数据可视化` 卡片，包含 `特征选择` 和 `显示模块`。显示模块包括 `原始散点图`、`全特征线性相关系数`。
- `04 数据标准化`：显示 `数据标准化` 卡片，学生可切换不同特征，观察该特征的均值、标准差、标准化公式和前 5 行标准化结果。
- `05 标准数据可视化`：显示 `标准数据可视化` 卡片，包含 `特征选择` 和 `显示模块`。显示模块包括 `标准化散点图`、`全特征线性相关系数`。

原始数据可视化和标准数据可视化进入时默认显示提示：

```text
请在右侧选择特征和显示模块
```

只有选择显示模块后才渲染图表；再次进入对应步骤时会恢复已选择的模块和图表状态。
