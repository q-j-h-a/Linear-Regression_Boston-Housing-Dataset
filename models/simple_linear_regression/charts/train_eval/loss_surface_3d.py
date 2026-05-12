CHART = {
    "id": "loss_surface_3d",
    "page": "train_eval",
    "title": "Loss 三维曲面图",
    "subtitle": "J(w,b) 曲面、下降轨迹与偏导切线",
    "renderer": "loss_surface_3d",
    "size": "wide",
    "default": False,
    "order": 40,
}


from models.simple_linear_regression.charts.train_eval._helpers import frame_at, rows_until


def build_data(context, state):
    return {
        "contour": context["contour"],
        "path": [[row["w"], row["b"], row["mse"]] for row in rows_until(context, state)],
        "frame": frame_at(context, state),
        "best": context["best"],
    }
