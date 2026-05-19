from .model import FEATURE_COLUMNS, FEATURE_DESCRIPTIONS, RAW_DATA_PATH, STD_DATA_PATH, TARGET_COLUMN


def get_dataset_profile() -> dict:
    return {
        "id": "boston_housing",
        "name": "Boston Housing",
        "default_variant": "raw",
        "variants": [
            {
                "id": "raw",
                "label": "Raw data",
                "kind": "raw_csv",
                "path": str(RAW_DATA_PATH),
                "preprocessed": False,
            },
            {
                "id": "standardized",
                "label": "Preprocessed data",
                "kind": "processed_csv",
                "path": str(STD_DATA_PATH),
                "preprocessed": True,
                "derived_from": "raw",
                "transform": "z_score_all_columns",
            },
        ],
        "columns": [
            {
                "name": feature,
                "type": "number",
                "role": "feature",
                "description": FEATURE_DESCRIPTIONS.get(feature, ""),
            }
            for feature in FEATURE_COLUMNS
        ] + [
            {
                "name": TARGET_COLUMN,
                "type": "number",
                "role": "target",
                "description": "Target value",
            }
        ],
        "default_features": ["RM"],
        "default_target": TARGET_COLUMN,
        "preview_policy": {
            "mode": "full",
            "preview_rows": 100,
            "chart_sample_rows": 1000,
            "full_data_to_frontend": True,
        },
    }
