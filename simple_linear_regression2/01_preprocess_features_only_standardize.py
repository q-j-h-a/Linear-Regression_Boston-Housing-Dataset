from pathlib import Path
import pandas as pd


# =====================================================
# 1. 文件路径
# =====================================================

# 原始波士顿房价数据集
input_path = Path("boston_housing.csv")

# 输出：只标准化 13 个特征，不标准化 MEDV
output_path = Path("boston_housing_features_standardized.csv")


# =====================================================
# 2. 定义 13 个输入特征和目标列
# =====================================================

FEATURE_COLUMNS = [
    "CRIM",
    "ZN",
    "INDUS",
    "CHAS",
    "NOX",
    "RM",
    "AGE",
    "DIS",
    "RAD",
    "TAX",
    "PTRATIO",
    "B",
    "LSTAT"
]

TARGET_COLUMN = "MEDV"


# =====================================================
# 3. 读取原始 CSV
# =====================================================

if not input_path.exists():
    raise FileNotFoundError(
        f"没有找到 {input_path.name}，请把它放在当前 py 文件同一目录下"
    )

df = pd.read_csv(input_path)

print("原始数据列名：")
print(df.columns.tolist())
print()


# =====================================================
# 4. 检查字段是否完整
# =====================================================

required_columns = FEATURE_COLUMNS + [TARGET_COLUMN]

missing_columns = [col for col in required_columns if col not in df.columns]

if missing_columns:
    raise ValueError(f"原始数据缺少这些字段：{missing_columns}")


# =====================================================
# 5. 标准化 13 个输入特征
#    注意：这里只标准化 X，不标准化 y
# =====================================================

new_df = df.copy()

standardize_info = []

for col in FEATURE_COLUMNS:
    mean_value = df[col].mean()
    std_value = df[col].std(ddof=0)

    if std_value == 0:
        raise ValueError(f"{col} 的标准差为 0，无法标准化")

    standardized_col = f"{col}_standardized"

    new_df[standardized_col] = (df[col] - mean_value) / std_value

    standardize_info.append({
        "feature": col,
        "standardized_feature": standardized_col,
        "mean": mean_value,
        "std": std_value,
        "min_before": df[col].min(),
        "max_before": df[col].max(),
        "min_after": new_df[standardized_col].min(),
        "max_after": new_df[standardized_col].max(),
    })


# =====================================================
# 6. 调整列顺序
# =====================================================

original_feature_columns = FEATURE_COLUMNS
standardized_feature_columns = [f"{col}_standardized" for col in FEATURE_COLUMNS]

ordered_columns = (
    original_feature_columns
    + standardized_feature_columns
    + [TARGET_COLUMN]
)

new_df = new_df[ordered_columns]


# =====================================================
# 7. 保存新的 CSV
# =====================================================

new_df.to_csv(output_path, index=False, encoding="utf-8-sig")


# =====================================================
# 8. 输出结果
# =====================================================

print("13 个特征标准化完成")
print(f"输入文件：{input_path}")
print(f"输出文件：{output_path}")
print()
print("注意：MEDV 没有被标准化，仍然保留原始房价。")
print()

print("标准化公式：")
print("x_standardized = (x - mean) / std")
print()

print("各特征标准化参数：")
for item in standardize_info:
    print(
        f"{item['feature']:>8s} -> {item['standardized_feature']:<25s} "
        f"mean={item['mean']:.6f}, std={item['std']:.6f}, "
        f"before=[{item['min_before']:.4f}, {item['max_before']:.4f}], "
        f"after=[{item['min_after']:.4f}, {item['max_after']:.4f}]"
    )

print()
print("新数据前 5 行：")
print(new_df.head())