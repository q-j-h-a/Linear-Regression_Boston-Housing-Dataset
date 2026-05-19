// Theory Page.

const theoryPages = {
  basic: {
    title: "实验基本信息",
    sub: "本实验用真实 Boston Housing 数据演示简单线性回归的完整流程。",
    body: [
      "实验围绕一个输入特征 x 和一个目标变量 y 展开，目标是学习一条直线来预测房价。",
      "页面左侧是教学流程，中间是理论内容或实验图表，右侧在理论阶段提供学习提示，在实验阶段显示可操作参数。"
    ],
    helper: ["先理解任务目标，再进入数据预处理。", "本实验当前默认使用 RM 作为输入特征，目标变量为 MEDV。"]
  },
  purpose: {
    title: "实验目的",
    sub: "完成本实验后，学生应能解释线性回归训练过程中的关键概念。",
    body: ["理解数据标准化、相关系数、回归直线、损失函数、梯度下降和评价指标。", "能够观察 w、b 的变化，并用 RMSE、MAE、R 平方判断模型效果。"],
    helper: ["重点不是只看最终答案，而是看参数如何一步步接近更合适的位置。"]
  },
  knowledge: {
    title: "前置知识",
    sub: "进入实验前需要了解的数学与机器学习基础。",
    body: ["线性函数 y = wx + b 描述一条直线。w 控制斜率，b 控制截距。", "误差表示预测值和真实值之间的差距，训练过程会不断减小整体误差。"],
    helper: ["如果对梯度不熟，可以先把它理解为参数应该调整的方向。"]
  },
  dataset: {
    title: "数据集",
    sub: "认识特征、标签和标准化数据。",
    body: ["数据集包含 13 个输入特征，目标变量为 MEDV。实验默认选择 RM 作为输入特征。", "数据预处理模块中可以同时选择多个图表，例如原始散点图、预处理散点图和相关系数图。"],
    helper: ["特征是模型用来做预测的信息。目标变量是我们希望模型预测的结果。", "标准化不会改变线性相关性的方向，但会让梯度下降更容易控制。"]
  },
  model: {
    title: "训练模型",
    sub: "简单线性回归使用一条直线建立 x 和 y 的关系。",
    formula: "预测函数：y_hat = w * x + b\n\nw：斜率，表示 x 每变化 1 个单位时预测值的变化量。\nb：截距，表示 x 为 0 时模型给出的基础预测值。",
    helper: ["在图中，w 改变直线倾斜程度，b 改变直线上下位置。"]
  },
  criterion: {
    title: "学习准则",
    sub: "用 MSE 衡量当前模型的整体误差。",
    formula: "MSE = mean((y_hat - y)^2)\n\n训练目标：找到让 MSE 尽可能小的 w 和 b。",
    helper: ["平方误差会放大较大的预测偏差，因此模型会更关注偏差大的样本。"]
  },
  optimization: {
    title: "参数优化",
    sub: "梯度下降根据损失函数的梯度更新参数。",
    formula: "dw = 2 / n * sum((y_hat - y) * x)\ndb = 2 / n * sum(y_hat - y)\n\nw_new = w - learning_rate * dw\nb_new = b - learning_rate * db",
    helper: ["学习率太大可能震荡，太小会训练很慢。可以在实验里调节学习率观察变化。"]
  },
  evaluation: {
    title: "评价指标",
    sub: "从不同角度观察模型预测效果。",
    body: ["RMSE 越小，说明预测偏差通常越小。MAE 越小，说明平均绝对误差越小。", "R 平方越接近 1，说明模型对目标变量变化的解释能力越强。"],
    helper: ["单个指标不能说明全部问题，教学展示中可以把 Loss、RMSE、MAE、R 平方一起观察。"]
  },
  result: {
    title: "预期成果",
    sub: "学生完成实验后应能独立解释图表与参数。",
    body: ["能够说明标准化前后散点图的区别。", "能够解释训练过程中 w、b、Loss 和评价指标的变化。"],
    helper: ["检查学生是否真的理解，可以让他解释某一轮参数为什么这样更新。"]
  },
  thinking: {
    title: "思考拓展",
    sub: "从简单线性回归延伸到更复杂的模型。",
    body: ["如果同时使用多个特征，模型会从 y = wx + b 扩展为多元线性回归。", "当特征与目标之间不是线性关系时，简单线性回归可能无法充分拟合数据。"],
    helper: ["可以比较 RM、LSTAT、PTRATIO 等特征，看哪个单特征预测效果更好。"]
  },
  predict: {
    title: "模型预测",
    sub: "输入特征值，查看线性模型给出的预测结果。",
    body: ["预测页会按当前选择的数据版本完成输入转换，并展示预测值、计算过程和相近样本。"],
    helper: ["如果已完成训练，预测应使用同一组 w 和 b。"]
  }
};

function renderTheory(page) {
  document.querySelector(".shell").classList.add("theory");
  const pageId = theoryPages[page] ? page : "dataset";
  $("main").innerHTML = `
    ${renderTheoryHtmlSlot(pageId)}
  `;
  $("rightPanel").innerHTML = "";
  loadTheoryHtml(pageId);
}

function renderTheoryHtmlSlot(page) {
  const src = `/static/theory-html/${page}.html`;
  return `<div class="html-lesson hidden" data-theory-html="${src}"><iframe title="理论讲义"></iframe></div>`;
}

async function loadTheoryHtml(page) {
  const wrap = document.querySelector("[data-theory-html]");
  if (!wrap) return;
  const src = wrap.dataset.theoryHtml;
  try {
    const resp = await fetch(src, { cache: "no-store" });
    if (!resp.ok) return;
    const html = await resp.text();
    const iframe = wrap.querySelector("iframe");
    iframe.setAttribute("scrolling", "no");
    iframe.onload = () => {
      fitTheoryIframe(iframe);
    };
    iframe.srcdoc = html;
    wrap.classList.remove("hidden");
  } catch (err) {
    // Converted HTML is optional; missing files should not affect the lesson page.
  }
}

function fitTheoryIframe(iframe) {
  const resize = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || !doc.body) return;
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";
      const height = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement.offsetHeight
      );
      iframe.style.height = `${height + 20}px`;
    } catch (err) {
      iframe.style.height = "680px";
    }
  };
  resize();
  setTimeout(resize, 100);
  setTimeout(resize, 500);
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (doc && "ResizeObserver" in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(doc.body);
    }
  } catch (err) {}
}

