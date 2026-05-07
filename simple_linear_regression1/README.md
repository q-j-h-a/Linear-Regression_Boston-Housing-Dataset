# 线性回归可视化教学系统

这是一个基于 Flask + ECharts 的线性回归可视化教学项目，用于帮助学生理解单特征线性回归中的数据预处理、梯度下降、损失函数、模型评估和预测过程。

项目围绕 Boston Housing 数据集展开，左侧保留三个教学模块：

- 数据理解与预处理
- 模型训练与评估
- 预测应用与交互实验

## 功能概览

### 1. 数据理解与预处理

该模块用于观察不同特征与房价 `MEDV` 的关系。

支持的图表包括：

- 原始散点图
- 标准化后的散点图
- 单个特征的线性相关图
- 所有特征的线性相关图

右侧“显示模式”支持多选，选择一个图就显示一个图，选择多个图就同时显示多个图。

### 2. 模型训练与评估

该模块用于展示一元线性回归训练过程。

支持选择：

- 原始特征数据
- 标准化后的特征数据

支持调节：

- 初始 `w`
- 初始 `b`
- 学习率
- 训练轮数
- 动画速度

支持的训练视图包括：

- 散点图 + 回归线
- Loss 曲线图
- MSE 损失函数等高线图
- 梯度下降动画图
- RMSE 指标仪表盘
- MAE 指标仪表盘
- R² 指标仪表盘
- 本轮计算过程
- 每轮参数表
- 物理模拟式交互画板（预留）

其中“梯度下降动画图”会展示：

- MSE 等高线背景
- 当前参数点
- 最优参数点
- 已走过的参数路径
- 本轮更新方向
- 下一步参数位置
- 当前梯度、学习率和 MSE 变化

### 3. 预测应用与交互实验

该模块用于输入某个特征值并进行房价预测。

支持：

- 选择特征
- 选择原始模型或标准化模型
- 输入特征值
- 查看预测值
- 查看标准化换算过程

交互画板功能目前保留入口，后续可扩展为拖拽散点、实时回归线和残差可视化。

## 项目结构

```text
simple_linear_regression1/
├── app.py
├── 01_preprocess_features_only_standardize.py
├── boston_housing.csv
├── boston_housing_features_standardized.csv
├── requirements.txt
├── README.md
└── templates/
    └── index.html
```

## 文件说明

### `app.py`

Flask 主程序，负责：

- 加载原始数据
- 加载标准化数据
- 提供数据理解接口
- 提供训练历史接口
- 提供预测接口
- 渲染前端页面

主要接口：

```text
GET  /
POST /api/data_view
POST /api/train_prepare
POST /api/predict
```

### `templates/index.html`

前端主页面，包含：

- 页面布局
- 控制面板
- ECharts 图表渲染逻辑
- 训练动画逻辑
- 梯度下降路径展示
- 指标仪表盘展示

ECharts 通过 CDN 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
```

### `01_preprocess_features_only_standardize.py`

用于生成标准化特征数据。

该脚本会读取：

```text
boston_housing.csv
```

并生成：

```text
boston_housing_features_standardized.csv
```

### `boston_housing.csv`

原始 Boston Housing 数据。

### `boston_housing_features_standardized.csv`

包含原始特征、标准化特征和 `MEDV` 的预处理数据。

## 环境要求

推荐使用 Python 3.10 或更高版本。

项目依赖见：

```text
requirements.txt
```

依赖包括：

- Flask
- numpy
- pandas

## 安装依赖

进入项目目录：

```bash
cd simple_linear_regression1
```

安装依赖：

```bash
pip install -r requirements.txt
```

如果使用 Conda 环境，可以先激活环境：

```bash
conda activate my_pytorch
pip install -r requirements.txt
```

也可以直接使用指定环境中的 Python 运行项目。

## 启动项目

在项目根目录执行：

```bash
python app.py
```

启动后访问：

```text
http://127.0.0.1:5000/
```

如果需要局域网访问，可使用终端输出中的局域网地址，例如：

```text
http://192.168.xx.xx:5000/
```

## 注意事项

### 1. Flask 调试模式

当前 `app.py` 使用：

```python
app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
```

这样可以保留调试信息，同时关闭 Flask 自动重载器，避免出现两个 Flask 进程同时占用端口的问题。

### 2. 标准化后最优截距相同的原因

当选择“预处理后：标准化特征 → MEDV”时，不同特征的最优截距 `b` 可能非常接近。

原因是标准化后：

```text
mean(x) ≈ 0
```

一元线性回归最小二乘解中：

```text
b* = mean(y) - w* × mean(x)
```

因此：

```text
b* ≈ mean(y)
```

而 `MEDV` 的均值对所有特征都相同，所以标准化特征下最优 `b` 通常接近一致。

### 3. 标准化后梯度下降路径接近直线的原因

标准化后，`w` 和 `b` 的更新近似解耦，路径通常会更稳定、更接近从起点到最优点的直线。

这不是错误，而是标准化提升训练稳定性的可视化表现。

如果想观察更明显的弯曲或震荡路径，可以尝试：

- 切换到原始特征数据
- 调大学习率
- 设置更偏离最优点的初始 `w` 和 `b`

## 上传 GitHub 建议

建议上传以下文件：

```text
app.py
01_preprocess_features_only_standardize.py
boston_housing.csv
boston_housing_features_standardized.csv
requirements.txt
README.md
templates/index.html
```

不建议上传：

```text
__pycache__/
.vscode/
```

可以创建 `.gitignore` 忽略这些本地文件。

## 后续可扩展方向

- 实现物理模拟式交互画板
- 支持拖拽散点并实时更新回归线
- 显示每个点到回归线的残差线段
- 根据残差大小设置线段颜色
- 增加原始特征与标准化特征的损失地形对比
- 增加模型训练过程导出功能

