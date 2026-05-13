CHART = {
    "id": "all_corr",
    "page": "student",
    "title": "全特征线性相关系数",
    "subtitle": "所有特征与目标列的 Pearson 相关系数",
    "renderer": "all_corr",
    "size": "wide",
    "default": False,
    "order": 40,
}


def build_data(context, state):
    return {
        "target": context["target"],
        "current_feature": context["feature"],
        "rows": context["correlations"],
    }
