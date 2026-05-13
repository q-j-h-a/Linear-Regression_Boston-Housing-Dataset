CHART = {
    "id": "single_corr",
    "page": "student",
    "title": "单特征线性相关系数",
    "subtitle": "当前特征与目标列的 Pearson 相关系数",
    "renderer": "single_corr",
    "size": "wide",
    "default": False,
    "order": 30,
}


def build_data(context, state):
    return {
        "feature": context["feature"],
        "target": context["target"],
        "corr": context["raw"]["summary"]["corr"],
    }
