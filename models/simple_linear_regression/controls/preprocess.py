PANEL = {
    "schema_version": 1,
    "page": "preprocess",
    "title": "控制面板",
    "sections": [
        {
            "id": "dataset",
            "title": "数据集",
            "controls": [
                {"type": "stat", "name": "sample_count", "label": "样本总数", "value_id": "sampleCount"},
                {"type": "stat", "name": "feature_count", "label": "特征数量", "value_id": "featureCount", "default": 13},
                {
                    "type": "feature_picker",
                    "name": "feature",
                    "label": "特征选择",
                    "mode": "single",
                    "element_id": "dataFeature",
                    "source": "feature_columns",
                    "default_source": "default_feature",
                },
            ],
        },
        {
            "id": "display",
            "title": "显示内容",
            "controls": [
                {
                    "type": "view_picker",
                    "name": "dataViews",
                    "label": "显示模式",
                    "summary_id": "dataModeSummary",
                    "storage_key": "preprocessSelectedViewsV1",
                    "options": [
                        {"label": "原始散点图", "value": "raw", "default": True},
                        {"label": "预处理散点图", "value": "standardized", "default": False},
                        {"label": "单特征线性相关系数", "value": "single_corr", "default": False},
                        {"label": "全特征线性相关系数", "value": "all_corr", "default": False},
                    ],
                }
            ],
        },
    ],
}
