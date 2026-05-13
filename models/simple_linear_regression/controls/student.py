PANEL = {
    "page": "student",
    "title": "自主实验",
    "sections": [
        {
            "id": "dataset",
            "title": "01 数据集",
            "controls": [
                {"type": "file", "name": "file", "label": "上传 CSV 数据集", "element_id": "studentFile"},
                {
                    "type": "select",
                    "name": "source_type",
                    "label": "数据类型",
                    "element_id": "studentSourceType",
                    "options": [
                        {"label": "原始数据集", "value": "raw"},
                        {"label": "已预处理数据集", "value": "standardized"},
                    ],
                },
                {"type": "button", "name": "upload", "label": "加载数据集", "element_id": "studentUploadBtn"},
            ],
        },
        {
            "id": "data_views",
            "title": "数据预处理图表",
            "controls": [
                {
                    "type": "chart_selector",
                    "name": "studentDataViews",
                    "summary_id": "studentDataModeSummary",
                    "options": [
                        {"label": "原始散点图", "value": "raw", "default": True},
                        {"label": "预处理散点图", "value": "standardized", "default": False, "requires_standardized": True},
                        {"label": "单特征线性相关系数", "value": "single_corr", "default": False},
                        {"label": "全特征线性相关系数", "value": "all_corr", "default": False},
                    ],
                }
            ],
        },
        {
            "id": "train_views",
            "title": "训练图表",
            "controls": [
                {
                    "type": "chart_selector",
                    "name": "studentTrainViews",
                    "summary_id": "studentTrainModeSummary",
                    "options": [
                        {"label": "模型训练图", "value": "model_train", "default": True},
                        {"label": "学习准则图", "value": "learning", "default": True},
                        {"label": "参数轨迹图", "value": "param_path", "default": False},
                        {"label": "评估标准图", "value": "metrics", "default": False},
                        {"label": "本轮计算过程", "value": "calc", "default": False},
                        {"label": "每轮参数表", "value": "table", "default": False},
                    ],
                }
            ],
        },
        {
            "id": "predict_views",
            "title": "预测图表",
            "controls": [
                {
                    "type": "chart_selector",
                    "name": "studentPredictViews",
                    "summary_id": "studentPredictModeSummary",
                    "options": [
                        {"label": "预测输入与结果", "value": "result", "default": True},
                        {"label": "预测可视化", "value": "chart", "default": True},
                        {"label": "预测计算过程", "value": "calc", "default": False},
                        {"label": "相近样本对比", "value": "nearby", "default": False},
                    ],
                }
            ],
        },
    ],
}
