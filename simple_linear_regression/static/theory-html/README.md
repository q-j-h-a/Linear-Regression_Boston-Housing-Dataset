把 PDF 转换后的 HTML 文件放在这个文件夹中，理论页会自动读取同名文件。

文件名对应关系：

- 实验基本信息：basic.html
- 实验目的：purpose.html
- 前置知识：knowledge.html
- 数据集：dataset.html
- 训练模型：model.html
- 学习准则：criterion.html
- 参数优化：optimization.html
- 评价指标：evaluation.html
- 预期成果：result.html
- 思考拓展：thinking.html
- 模型预测：predict.html
- 学生训练：student.html

例如：打开“数据集”理论页时，页面会尝试加载：

`/static/theory-html/dataset.html`

如果文件存在，就会嵌入显示；如果文件不存在，则只显示页面原来的文字内容。
