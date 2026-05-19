PANEL = {
    "schema_version": 1,
    "page": "predict",
    "title": "控制面板",
    "sections": [
        {
            "id": "result",
            "title": "预测结果",
            "controls": [
                {"type": "stat", "name": "prediction", "label": "预测 MEDV", "value_id": "predictValue"},
                {"type": "stat", "name": "model_x", "label": "模型输入 x", "value_id": "predictModelX"},
            ],
        },
        {
            "id": "input",
            "title": "预测输入",
            "controls": [
                {
                    "type": "feature_picker",
                    "name": "feature",
                    "label": "特征选择",
                    "mode": "single",
                    "element_id": "predictFeature",
                    "source": "feature_columns",
                    "default_source": "default_feature",
                    "auto_run": True,
                },
                {
                    "type": "select",
                    "semantic_type": "dataset_variant",
                    "name": "use_standardized",
                    "label": "数据版本",
                    "element_id": "predictStd",
                    "default": True,
                    "auto_run": True,
                    "options": [
                        {"label": "标准化特征", "value": True},
                        {"label": "原始特征", "value": False},
                    ],
                },
                {"type": "number", "name": "input_value", "label": "输入特征值", "element_id": "predictInput", "default": 6.5, "step": 0.1},
            ],
        },
        {
            "id": "display",
            "title": "显示内容",
            "controls": [
                {
                    "type": "view_picker",
                    "name": "predictViews",
                    "label": "显示模式",
                    "summary_id": "predictModeSummary",
                    "storage_key": "predictSelectedViewsV2",
                    "options": [
                        {"label": "预测可视化", "value": "chart", "default": True},
                        {"label": "预测计算过程", "value": "calc", "default": True},
                    ],
                }
            ],
        },
        {
            "id": "actions",
            "title": "操作",
            "controls": [
                {"type": "action_button", "name": "run", "label": "开始预测", "element_id": "predictRun", "style": "primary-btn"}
            ],
        },
    ],
}
