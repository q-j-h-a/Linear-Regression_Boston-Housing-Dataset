PANEL = {
    "schema_version": 1,
    "page": "evaluate",
    "title": "模型评估",
    "sections": [
        {
            "id": "summary",
            "title": "当前模型",
            "controls": [
                {"type": "stat", "name": "dataset", "label": "数据集", "value_id": "evaluateDataset"},
                {"type": "stat", "name": "feature", "label": "特征", "value_id": "evaluateFeature"},
                {"type": "stat", "name": "epoch", "label": "评估轮次", "value_id": "evaluateEpoch"},
            ],
        },
        {
            "id": "display",
            "title": "显示内容",
            "controls": [
                {
                    "type": "view_picker",
                    "name": "evaluateViews",
                    "label": "评估视图",
                    "summary_id": "evaluateModeSummary",
                    "storage_key": "evaluateSelectedViewsV1",
                    "options": [
                        {"label": "拟合效果", "value": "model_fit", "default": True},
                        {"label": "RMSE", "value": "rmse", "default": True},
                        {"label": "MAE", "value": "mae", "default": True},
                        {"label": "R²", "value": "r2", "default": True},
                        {"label": "评估解释", "value": "explanation", "default": True},
                    ],
                }
            ],
        },
    ],
}
