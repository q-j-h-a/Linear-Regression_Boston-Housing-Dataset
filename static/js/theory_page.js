// Theory Page: editable teacher-facing slide decks.

const THEORY_EDIT_KEY_PREFIX = "linearRegressionTheoryDeckEdits:v4:";
const THEORY_LEGACY_EDIT_KEY_PREFIX = "linearRegressionTheoryDeckEdits:v1:";

const THEORY_PAGE_STATE = {
  pageId: "basic",
  currentSlide: 0,
  dirty: false,
  editing: false,
  deck: null,
  selectedId: null,
  selectedIds: [],
  historyPast: [],
  historyFuture: [],
  snapToGrid: false,
  historyLocked: false,
};

const THEORY_HISTORY_LIMIT = 50;
const THEORY_GRID_SIZE = 8;

const SAFE_FONTS = [
  ["", "默认字体"],
  ['"Microsoft YaHei", sans-serif', "微软雅黑"],
  ['SimSun, serif', "宋体"],
  ['SimHei, sans-serif', "黑体"],
  ["Arial, sans-serif", "Arial"],
  ['"Times New Roman", serif', "Times New Roman"],
  ["Consolas, monospace", "Consolas"],
];

const THEORY_TOPICS = {
  basic: {
    title: "实验基本信息",
    subtitle: "用 Boston Housing 数据集讲清一条线如何完成房价预测。",
    bullets: ["任务：根据输入特征预测房价 MEDV。", "模型：从单特征线性回归开始，理解 y = wx + b。", "过程：数据、模型、损失、优化、评价、预测。", "目标：形成可解释的 AI 建模流程。"],
    formula: "y_hat = w * x + b",
    prompt: "可选问题：如果房间数增加，房价通常会怎样变化？"
  },
  purpose: {
    title: "实验目的",
    subtitle: "明确学生完成本实验后应掌握的核心能力。",
    bullets: ["理解特征、标签、预测值和误差的关系。", "解释 w 和 b 的作用。", "知道 MSE 为什么能衡量整体误差。", "用 RMSE、MAE、R² 判断模型效果。"],
    formula: "学习目标 = 看懂图表 + 解释参数 + 判断结果",
    prompt: "如果训练集表现很好但测试集表现差，学生应该优先怀疑什么？"
  },
  knowledge: {
    title: "前置知识",
    subtitle: "统一线性回归实验所需的数学和机器学习语言。",
    bullets: ["特征 x：模型用于判断的信息。", "标签 y：希望模型预测的真实结果。", "预测值 y_hat：当前模型给出的答案。", "误差：预测值与真实值之间的差。"],
    formula: "y = wx + b\nw：斜率\nb：截距",
    prompt: "为什么只看一个样本的误差不够，还要看整体误差？"
  },
  dataset: {
    title: "数据集",
    subtitle: "认识 Boston Housing 的特征、标签与标准化数据。",
    bullets: ["特征描述区域或房屋环境。", "标签 MEDV 表示房价中位数。", "默认演示常用 RM 作为单特征输入。", "标准化让不同量纲更容易被模型处理。"],
    formula: "x_norm = (x - mean) / std",
    prompt: "讲标准化前，先展示不同特征的量纲差异。"
  },
  model: {
    title: "训练模型",
    subtitle: "用一条直线建立输入特征与预测目标的关系。",
    bullets: ["w 控制直线斜率。", "b 控制直线截距。", "预测就是把 x 代入当前直线。", "训练就是根据误差更新 w 和 b。"],
    formula: "y_hat = w * x + b",
    prompt: "如果拟合线整体偏低，应该优先调整 w、b，还是两者都可能需要调整？"
  },
  criterion: {
    title: "学习准则",
    subtitle: "用损失函数衡量模型当前表现。",
    bullets: ["把很多样本的误差汇总成一个数。", "让不同参数组合可以被比较。", "为梯度下降提供优化方向。", "让训练过程可以被图表追踪。"],
    formula: "MSE = mean((y_hat - y)^2)",
    prompt: "可选问题：Loss 曲线出现下降、震荡、停滞时，分别说明什么？"
  },
  optimization: {
    title: "参数优化",
    subtitle: "用梯度下降根据误差方向更新参数。",
    bullets: ["梯度告诉参数应该增大还是减小。", "学习率控制每次更新幅度。", "Loss 趋于稳定说明接近较优区域。", "震荡通常意味着学习率过大。"],
    formula: "w_new = w - learning_rate * dw\nb_new = b - learning_rate * db",
    prompt: "如果 Loss 上下跳动不收敛，第一步应该调大还是调小学习率？"
  },
  evaluation: {
    title: "评价指标",
    subtitle: "从不同角度判断模型预测效果。",
    bullets: ["RMSE 对大误差更敏感。", "MAE 更直观，表示平均绝对误差。", "R² 表示解释目标变量变化的能力。", "训练指标好不代表泛化一定好。"],
    formula: "RMSE ↓   MAE ↓   R² → 1",
    prompt: "为什么同一组预测中 RMSE 往往更容易被大误差拉高？"
  },
  result: {
    title: "预期成果",
    subtitle: "定义学生完成实验后的可观察表现。",
    bullets: ["能说明标准化前后数据分布的区别。", "能解释 w、b 和 Loss 的变化。", "能使用 RMSE、MAE、R² 判断模型效果。", "能描述一次预测的计算过程。"],
    formula: "掌握 = 能操作 + 能解释 + 能迁移",
    prompt: "如果学生只会点击按钮但说不出 Loss 下降含义，应该回到哪一页复习？"
  },
  thinking: {
    title: "思考拓展",
    subtitle: "从单特征线性回归扩展到更复杂的建模问题。",
    bullets: ["多个特征可以共同参与预测。", "特征之间可能存在重复信息。", "线性关系不明显时需要换模型或做特征工程。", "模型需要避免只记住训练数据。"],
    formula: "y_hat = w1*x1 + w2*x2 + ... + b",
    prompt: "比较 RM、LSTAT、PTRATIO：哪个单特征更有解释力？为什么？"
  }
};

const THEORY_TEACHING_SCENARIOS = {
  basic: {
    leadIn: "情境问题：房间数更多的房子，房价一定更高吗？",
    explain: ["本节聚焦一条 AI 建模主线：问题、数据、模型、训练、评价、预测。", "输入特征是模型使用的信息，目标变量是希望预测的结果。", "线性回归可以理解为“用一条线概括数据中的变化趋势”。", "模型输出的是基于数据规律的估计值，不是对每套房的绝对判断。"],
    demo: ["数据页素材：RM 是房间数特征，MEDV 是房价中位数目标。", "散点图观察点：点云是否呈现大致上升趋势。", "训练页观察点：拟合线是否逐步靠近数据点集。", "回顾句式：本实验从数据出发，用模型学习趋势，再用指标判断效果。"],
    activity: "可选问题：如果只能选一个变量预测房价，你会选哪个？理由是什么？",
    summary: "本页结论：AI 建模是从问题到数据、从模型到评价的完整闭环。"
  },
  purpose: {
    leadIn: "情境问题：模型给出了一个预测房价，怎样判断这个结果是否可信？",
    explain: ["本实验目标不是得到单个答案，而是理解模型如何从数据中学习规律。", "核心能力包括看懂图表、解释参数、判断指标和完成预测。", "w、b、Loss、RMSE、MAE、R² 是理解训练过程的关键线索。", "理论页和实验页可以配合使用：理论给语言，实验给证据。"],
    demo: ["拟合线素材：训练前后直线位置的变化。", "Loss 素材：曲线下降代表整体误差变小。", "指标素材：RMSE、MAE、R² 用于描述预测效果。", "预测素材：一次输入预测可以串起数据、模型和指标。"],
    activity: "可选练习：用一句话区分“训练模型”和“使用模型预测”。",
    summary: "本页结论：会操作只是第一步，能解释模型表现才是实验目标。"
  },
  knowledge: {
    leadIn: "连接旧知识：一次函数 y = kx + b 与机器学习里的 y_hat = wx + b 很相似。",
    explain: ["x 是输入信息，y 是真实答案，y_hat 是模型预测答案。", "w 决定线的倾斜方向和变化幅度，b 决定整体上下移动。", "误差来自 y_hat 与 y 的差距，训练就是持续减小整体误差。", "梯度可以先理解为“参数下一步该往哪里调”。"],
    demo: ["图像观察点：w 变大时直线倾斜程度变化。", "图像观察点：b 变大时直线整体上移。", "误差观察点：单个点到预测线的垂直距离。", "整体误差素材：多个样本误差汇总后形成损失。"],
    activity: "可选快问：如果预测线整体偏低，b 更可能需要增大还是减小？",
    summary: "本页结论：线性回归的核心语言是特征、标签、预测、误差和参数。"
  },
  dataset: {
    leadIn: "情境问题：房价可能和哪些因素有关？这些因素在数据表中会变成特征列。",
    explain: ["Boston Housing 数据集包含多个区域与房屋相关特征。", "MEDV 是要预测的目标变量，RM 等列是模型可使用的特征。", "不同特征量纲不同，直接训练会影响梯度下降的稳定性。", "标准化让特征处在更可比较的数值范围内。"],
    demo: ["原始散点图素材：RM 与 MEDV 的关系。", "标准化散点图素材：数值尺度变化后的分布。", "观察点：标准化改变数值范围，不改变大致相关方向。", "拓展素材：不同特征与房价的相关程度并不相同。"],
    activity: "可选讨论：为什么 RM 通常与房价正相关，但不能完全决定房价？",
    summary: "本页结论：数据质量和特征选择会直接影响模型能学到什么。"
  },
  model: {
    leadIn: "类比素材：模型像一把可调节的尺子，w 调倾斜，b 调位置。",
    explain: ["模型形式是 y_hat = w * x + b。", "w 表示 x 每增加一个单位时，预测值平均变化多少。", "b 表示直线的基础位置，用来修正整体偏高或偏低。", "训练开始时参数不一定合理，需要通过误差不断调整。"],
    demo: ["训练页素材：初始化直线的位置。", "训练过程素材：拟合线逐步贴近点云。", "观察点：当前线整体偏高、偏低或斜率不合适。", "参数连接：w、b 的变化会影响下一轮预测。"],
    activity: "可选练习：给定 w、b 和 x，计算一次 y_hat。",
    summary: "本页结论：模型不是神秘黑箱，它就是带参数的预测函数。"
  },
  criterion: {
    leadIn: "情境问题：判断一条预测线好不好，只看一个样本够不够？",
    explain: ["单个误差只能说明一个点，MSE 汇总了所有样本的整体误差。", "平方会放大大误差，让模型更重视偏差大的样本。", "损失越小，说明当前参数整体更合适。", "训练目标就是寻找让损失更小的 w 和 b。"],
    demo: ["图像素材：拟合线与散点之间的垂直距离。", "概念连接：这些距离对应预测误差。", "Loss 曲线素材：损失随训练轮次变化。", "观察词汇：下降、震荡、停滞。"],
    activity: "可选问题：为什么不能简单把误差直接相加来判断模型好坏？",
    summary: "本页结论：损失函数把“线好不好”变成了一个可优化的数字。"
  },
  optimization: {
    leadIn: "类比素材：梯度下降像下山找低点，方向由梯度给出，步长由学习率控制。",
    explain: ["梯度告诉参数应该往哪个方向改。", "学习率决定每次改多少。", "学习率太小，下降慢；学习率太大，可能越过最优区域并震荡。", "训练轮次让参数有机会逐步接近较优值。"],
    demo: ["小学习率素材：Loss 下降较慢但通常更稳定。", "大学习率素材：Loss 可能下降快，也可能震荡。", "参数轨迹素材：w、b 随训练轮次变化。", "对比素材：同一模型在不同学习率下表现不同。"],
    activity: "可选操作：比较两个学习率，记录哪个更稳定、哪个下降更快。",
    summary: "本页结论：优化不是一次到位，而是用合适步长反复修正参数。"
  },
  evaluation: {
    leadIn: "类比素材：评价指标像不同评分维度，用来从多个角度看模型表现。",
    explain: ["RMSE 对大误差敏感，适合发现严重预测偏差。", "MAE 更直观，表示平均每次大约错多少。", "R² 描述模型解释目标变化的能力。", "训练集指标好不代表测试集一定好，要关注泛化。"],
    demo: ["指标素材：RMSE、MAE、R² 的训练结果。", "比较素材：两组训练结果的指标差异。", "判断线索：RMSE 和 MAE 都小通常表示误差较小。", "扩展线索：R² 不理想可能来自特征不足或关系非线性。"],
    activity: "可选判断：如果 RMSE 很大但 MAE 不算大，可能说明什么？",
    summary: "本页结论：评价模型要多指标综合判断，不能只看一个数字。"
  },
  result: {
    leadIn: "成果定义：本实验关注可解释的建模过程，而不只是完成一次运行。",
    explain: ["数据处理：知道数据经过了哪些转换。", "训练过程：能说明参数和 Loss 的变化含义。", "效果判断：能用指标描述模型是否可用。", "迁移应用：能把方法迁移到新特征或新数据。"],
    demo: ["流程素材：从数据页到训练页再到预测页的完整链路。", "图像素材：拟合线与散点关系。", "指标素材：RMSE、MAE、R² 的解释。", "预测素材：一次输入如何得到输出。"],
    activity: "可选出口票：我使用了什么数据、什么模型、什么指标来判断结果？",
    summary: "本页结论：本实验的最终产出是可解释的建模过程和可验证的预测结果。"
  },
  thinking: {
    leadIn: "拓展问题：一个特征是否足够描述真实房价问题？",
    explain: ["单特征线性回归便于理解，但信息有限。", "多特征模型可以同时利用多个影响因素。", "如果关系不是线性的，简单直线可能拟合不足。", "模型越复杂，越需要关注过拟合和泛化。"],
    demo: ["比较素材：RM、LSTAT、PTRATIO 等不同单特征效果。", "讨论素材：不同特征预测能力不同的原因。", "公式素材：多特征线性回归形式。", "拓展素材：特征工程、模型选择与泛化。"],
    activity: "可选拓展：如果加入多个特征后测试效果变差，可能发生了什么？",
    summary: "本页结论：线性回归是理解 AI 建模的起点，不是所有问题的终点。"
  }
};

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeComponent(type, data = {}) {
  return {
    id: data.id || uid(type),
    type,
    text: data.text || "",
    title: data.title || "",
    body: data.body || "",
    items: data.items ? clone(data.items) : [],
    style: data.style ? { ...data.style } : {},
    position: data.position ? { ...data.position } : null,
    src: data.src || "",
    alt: data.alt || "",
  };
}

function makeTemplateDeck(pageId) {
  const topic = THEORY_TOPICS[pageId] || THEORY_TOPICS.dataset;
  const scenario = THEORY_TEACHING_SCENARIOS[pageId] || THEORY_TEACHING_SCENARIOS.dataset;
  const slides = [
    {
      id: uid("slide"),
      layout: "title",
      components: [
        makeComponent("eyebrow", { text: "理论部分" }),
        makeComponent("h1", { text: topic.title }),
        makeComponent("p", { text: topic.subtitle }),
        makeComponent("visual", { text: `课堂素材：${scenario.leadIn}\n\n本页提供情境素材、讲解要点、演示观察点和反馈句式，内容可直接使用，也可按班级情况删改。` })
      ]
    },
    {
      id: uid("slide"),
      layout: "default",
      components: [
        makeComponent("h2", { text: "情境素材与讲解要点" }),
        makeComponent("cards", {
          items: [
            { id: uid("card"), title: "情境素材", body: scenario.leadIn, style: {} },
            { id: uid("card"), title: "讲解要点", body: scenario.explain[0], style: {} },
            { id: uid("card"), title: "可能回应", body: "可以从生活经验出发，再回到数据和图表证据。", style: {} },
            { id: uid("card"), title: "衔接语", body: "接下来不只看结论，还可以看模型怎样一步步学到这个结论。", style: {} }
          ]
        }),
        makeComponent("callout", { text: topic.prompt })
      ]
    },
    {
      id: uid("slide"),
      layout: "default",
      components: [
        makeComponent("h2", { text: "核心概念与板书" }),
        makeComponent("bullets", { items: scenario.explain.map(text => ({ id: uid("item"), text, style: {} })) }),
        makeComponent("formula", { text: `${topic.formula}\n\n板书参考：符号含义、图表对应关系、关键结论可按课堂进度取用。` })
      ]
    },
    {
      id: uid("slide"),
      layout: "default",
      components: [
        makeComponent("h2", { text: "平台演示观察点" }),
        makeComponent("bullets", { items: scenario.demo.map(text => ({ id: uid("item"), text, style: {} })) }),
        makeComponent("cards", {
          items: [
            { id: uid("card"), title: "观察点", body: "图表形态、参数变化、误差变化和指标变化。", style: {} },
            { id: uid("card"), title: "可选提问", body: "这个变化说明了什么？为什么会这样？还有其他解释吗？", style: {} },
            { id: uid("card"), title: "概念连接", body: "观察结果可连接回本页公式、概念或评价指标。", style: {} },
            { id: uid("card"), title: "记录句式", body: "我观察到……所以我认为……", style: {} }
          ]
        })
      ]
    },
    {
      id: uid("slide"),
      layout: "default",
      components: [
        makeComponent("h2", { text: "练习与反馈素材" }),
        makeComponent("cards", {
          items: [
            { id: uid("card"), title: "练习题", body: scenario.activity, style: {} },
            { id: uid("card"), title: "反馈句式", body: "我观察到……所以我认为……", style: {} },
            { id: uid("card"), title: "易错提醒", body: "只看操作结果、忽略图表证据，或只背概念、不联系实验现象。", style: {} },
            { id: uid("card"), title: "小结素材", body: scenario.summary, style: {} }
          ]
        }),
        makeComponent("callout", { text: "本页可作为课堂反馈、随堂练习或课后作业素材；老师可以直接复制卡片并按班级情况调整。" })
      ]
    }
  ];
  return { id: pageId, title: topic.title, subtitle: topic.subtitle, slides };
}

const theoryPages = Object.fromEntries(Object.keys(THEORY_TOPICS).map(pageId => [pageId, makeTemplateDeck(pageId)]));

async function renderTheory(page) {
  document.querySelector(".shell").classList.add("theory");
  const pageId = theoryPages[page] ? page : "dataset";
  THEORY_PAGE_STATE.pageId = pageId;
  THEORY_PAGE_STATE.currentSlide = 0;
  THEORY_PAGE_STATE.dirty = false;
  THEORY_PAGE_STATE.editing = false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  THEORY_PAGE_STATE.historyPast = [];
  THEORY_PAGE_STATE.historyFuture = [];
  THEORY_PAGE_STATE.snapToGrid = false;
  THEORY_PAGE_STATE.historyLocked = false;
  THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
  if (window.TheoryAssistant) window.TheoryAssistant.hide();
  $("rightPanel").innerHTML = "";
  renderTheoryDeckDetail(pageId);
}

function renderTheoryEntry(pageId) {
  const deck = theoryPages[pageId] || theoryPages.dataset;
  return `
    <section class="content-card theory-entry-card">
      <div class="theory-entry-head">
        <div>
          <div class="eyebrow">理论部分</div>
          <h2>${escapeHtml(deck.title || "当前理论页")}</h2>
        </div>
        <div class="theory-entry-actions">
          <button class="theory-entry-detail" type="button" data-theory-detail="${escapeHtml(pageId)}">详情</button>
          <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-deck="${escapeHtml(pageId)}">课件</button>
        </div>
      </div>
      <p>${escapeHtml(deck.subtitle || "点击课件进入可编辑教学课件。")}</p>
    </section>
  `;
}

function renderTheoryDetail(pageId) {
  if (window.TheoryAssistant) {
    window.TheoryAssistant.show(pageId, theoryPages[pageId]?.title || "当前理论页");
  }
  $("main").innerHTML = `
    <div class="theory-detail-toolbar" data-html2canvas-ignore="true">
      <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-deck="${escapeHtml(pageId)}">返回课件</button>
    </div>
    ${renderTheoryHtmlSlot(pageId)}
  `;
  const deckBtn = document.querySelector("[data-theory-deck]");
  if (deckBtn) deckBtn.addEventListener("click", () => renderTheoryDeckDetail(pageId));
  loadTheoryHtml(pageId);
}

function renderTheoryHtmlSlot(pageId) {
  const src = `/static/theory-html/${pageId}.html`;
  return `<div class="html-lesson hidden" data-theory-html="${escapeHtml(src)}"><iframe title="理论讲义"></iframe></div>`;
}

async function loadTheoryHtml(pageId) {
  const wrap = document.querySelector("[data-theory-html]");
  if (!wrap) return;
  try {
    const resp = await fetch(wrap.dataset.theoryHtml, { cache: "no-store" });
    if (!resp.ok) {
      renderError("未找到该理论详情页。");
      return;
    }
    const iframe = wrap.querySelector("iframe");
    iframe.setAttribute("scrolling", "no");
    iframe.onload = () => {
      fitTheoryIframe(iframe);
      syncTheoryAssistantFromIframe(pageId, iframe);
    };
    iframe.srcdoc = await resp.text();
    wrap.classList.remove("hidden");
  } catch (err) {
    renderError("理论详情页加载失败。");
  }
}

function fitTheoryIframe(iframe) {
  const resize = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc?.body) return;
      doc.documentElement.style.overflow = "hidden";
      doc.body.style.overflow = "hidden";
      const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, doc.body.offsetHeight, doc.documentElement.offsetHeight);
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
    if (doc && "ResizeObserver" in window) new ResizeObserver(resize).observe(doc.body);
  } catch (err) {}
}

function syncTheoryAssistantFromIframe(pageId, iframe) {
  if (!window.TheoryAssistant?.setPage) return;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const title = theoryPages[pageId]?.title || doc.querySelector("h1, h2")?.textContent?.trim() || "当前理论页";
    const text = doc.body?.innerText?.replace(/\s+/g, " ").trim() || "";
    window.TheoryAssistant.setPage({ id: pageId, title, text });
    window.TheoryAssistant.attachSelectionTarget?.(iframe);
  } catch (err) {
    window.TheoryAssistant.setPage({ id: pageId, title: theoryPages[pageId]?.title || "当前理论页", text: "" });
  }
}

function renderTheoryDeckDetail(pageId) {
  THEORY_PAGE_STATE.pageId = pageId;
  THEORY_PAGE_STATE.editing = false;
  THEORY_PAGE_STATE.dirty = false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  THEORY_PAGE_STATE.historyPast = [];
  THEORY_PAGE_STATE.historyFuture = [];
  if (!THEORY_PAGE_STATE.deck || THEORY_PAGE_STATE.deck.id !== pageId) {
    THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
  }
  if (window.TheoryAssistant) window.TheoryAssistant.show(pageId, THEORY_PAGE_STATE.deck.title);
  $("main").innerHTML = renderTheoryDeck(pageId);
  bindTheoryDeck(pageId);
  setTheoryEditing(false);
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
  syncTheoryAssistantFromDeck(pageId);
}

function renderTheoryDeck(pageId) {
  const deck = THEORY_PAGE_STATE.deck || theoryPages[pageId];
  return `
    <section class="theory-deck-shell" id="theoryDeck" data-theory-page="${escapeHtml(pageId)}">
      <nav class="theory-deck-toolbar" data-html2canvas-ignore="true" aria-label="理论幻灯片控制栏">
        <div class="theory-toolbar-group">
          <button class="theory-deck-btn" id="theoryPrevBtn" type="button" aria-label="上一页" title="上一页">‹</button>
          <span class="theory-page-indicator" id="theoryPageIndicator">1 / ${deck.slides.length}</span>
          <button class="theory-deck-btn" id="theoryNextBtn" type="button" aria-label="下一页" title="下一页">›</button>
        </div>
        <div class="theory-toolbar-group">
          <span class="theory-deck-title">${escapeHtml(deck.title)}</span>
          <span class="theory-deck-status" id="theoryDeckStatus">只读模式</span>
        </div>
        <div class="theory-toolbar-group">
          <button class="theory-entry-detail theory-entry-deck" type="button" data-theory-detail="${escapeHtml(pageId)}">详情</button>
          <button class="theory-export-btn theory-edit-btn" id="theoryEditBtn" type="button">编辑课件</button>
          <button class="theory-export-btn theory-cancel-btn" id="theoryCancelBtn" type="button" hidden>不保存</button>
          <button class="theory-export-btn theory-save-btn" id="theorySaveBtn" type="button" hidden>保存修改</button>
          <button class="theory-export-btn" id="theoryExportBtn" type="button">导出 PDF</button>
        </div>
      </nav>
      <div class="theory-editor-tools" id="theoryEditorTools" data-html2canvas-ignore="true" hidden>
        <div class="theory-tool-group">
          <button type="button" id="theoryUndoBtn" disabled>撤销</button>
          <button type="button" id="theoryRedoBtn" disabled>重做</button>
          <button type="button" id="theoryDuplicateBtn" disabled>复制</button>
        </div>
        <div class="theory-tool-group">
          <button type="button" id="theoryAddSlideBtn">新增页</button>
          <button type="button" id="theoryDeleteSlideBtn">删除页</button>
          <button type="button" id="theoryDeleteComponentBtn" disabled>删除组件</button>
        </div>
        <div class="theory-tool-group">
          <button type="button" data-insert-component="text">插入文本</button>
          <button type="button" data-insert-component="card">插入卡片</button>
          <button type="button" data-insert-component="bullets">插入要点</button>
          <button type="button" data-insert-component="callout">插入提示</button>
          <button type="button" data-insert-component="formula">插入公式</button>
          <button type="button" id="theoryImageBtn">插入图片</button>
          <input id="theoryImageInput" type="file" accept="image/*" hidden>
        </div>
        <div class="theory-tool-group">
          <button type="button" id="theorySnapBtn" aria-pressed="false">网格吸附</button>
        </div>
        <div class="theory-tool-group theory-font-tools">
          <select id="theoryFontFamily" aria-label="字体">${SAFE_FONTS.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}</select>
          <select id="theoryFontSize" aria-label="字号">${[12, 14, 16, 18, 20, 24, 28, 32, 40, 52, 64].map(size => `<option value="${size}px">${size}</option>`).join("")}</select>
          <button type="button" id="theoryBoldBtn">B</button>
          <button type="button" id="theoryItalicBtn"><i>I</i></button>
          <input id="theoryColorInput" type="color" value="#172033" aria-label="文字颜色">
          <select id="theoryAlignSelect" aria-label="对齐">
            <option value="">默认对齐</option>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
          <span class="theory-tool-hint" id="theoryToolHint">请选择组件</span>
        </div>
      </div>
      <div class="theory-slide-viewport" id="theorySlideViewport">
        ${deck.slides.map((slide, index) => renderTheorySlideMarkup(slide, index)).join("")}
      </div>
    </section>
  `;
}

function renderTheorySlideMarkup(slide, index) {
  return `
    <article class="theory-slide ${slide.layout === "title" ? "theory-slide-title" : ""}" data-slide-id="${escapeHtml(slide.id)}" data-theory-slide="${index}" aria-label="第 ${index + 1} 页">
      ${slide.components.map(component => renderComponent(component)).join("")}
    </article>
  `;
}

function renderComponent(component) {
  const type = component.type || "text";
  const style = component.position ? `left:${component.position.left || "0px"};top:${component.position.top || "0px"};width:${component.position.width || "240px"};height:${component.position.height || "auto"};z-index:${component.position.zIndex || 1};` : "";
  const freeClass = component.position ? " is-free-positioned" : "";
  let content = "";
  if (type === "cards") {
    content = `<div class="theory-card-grid">${component.items.map(item => `
      <div class="theory-info-card">
        ${editableTag("strong", `${component.id}:${item.id}:title`, item.title || "卡片标题", item.titleStyle || item.style)}
        ${editableTag("span", `${component.id}:${item.id}:body`, item.body || "卡片正文", item.bodyStyle || item.style)}
      </div>`).join("")}</div>`;
  } else if (type === "bullets") {
    content = `<ul class="theory-bullet-grid">${component.items.map(item => `<li>${editableTag("span", `${component.id}:${item.id}:text`, item.text || "要点内容", item.style)}</li>`).join("")}</ul>`;
  } else if (type === "image") {
    const src = component.src || "";
    const alt = component.alt || "课件图片";
    content = `<figure class="theory-image-frame">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : `<div class="theory-image-placeholder">图片</div>`}${editableTag("figcaption", `${component.id}:alt`, alt, component.style, "theory-image-caption")}</figure>`;
  } else if (type === "formula") {
    content = editableTag("div", `${component.id}:text`, component.text || "公式内容", component.style, "theory-formula");
  } else if (type === "callout") {
    content = editableTag("div", `${component.id}:text`, component.text || "提示内容", component.style, "theory-callout");
  } else if (type === "visual") {
    content = editableTag("div", `${component.id}:text`, component.text || "课堂示意区", component.style, "theory-visual-panel");
  } else {
    const tag = type === "h1" ? "h1" : type === "h2" ? "h2" : "p";
    const extra = type === "eyebrow" ? "theory-eyebrow" : "";
    content = editableTag(tag === "p" && type === "eyebrow" ? "div" : tag, `${component.id}:text`, component.text || "文本内容", component.style, extra);
  }
  return `
    <div class="theory-component theory-component-${escapeHtml(type)}${freeClass}" data-component-id="${escapeHtml(component.id)}" data-component-type="${escapeHtml(type)}" style="${style}">
      <button class="theory-drag-handle" type="button" data-drag-handle data-html2canvas-ignore="true" aria-label="拖动组件">↕</button>
      <button class="theory-resize-handle" type="button" data-resize-handle data-html2canvas-ignore="true" aria-label="拉伸组件"></button>
      ${content}
    </div>
  `;
}

function editableTag(tag, editId, text, style = {}, extraClass = "") {
  return `<${tag} class="theory-editable ${extraClass}" contenteditable="false" spellcheck="false" data-edit-id="${escapeHtml(editId)}" style="${styleToCss(style)}">${escapeHtml(text)}</${tag}>`;
}

function styleToCss(style = {}) {
  return Object.entries(style).filter(([, value]) => value).map(([key, value]) => `${camelToKebab(key)}:${String(value).replace(/"/g, "&quot;")}`).join(";");
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function loadDeckForPage(pageId) {
  const saved = readSavedState(pageId);
  if (saved?.deckOverride?.slides?.length) return clone(saved.deckOverride);
  return clone(theoryPages[pageId] || theoryPages.dataset);
}

function readSavedState(pageId) {
  try {
    return JSON.parse(localStorage.getItem(`${THEORY_EDIT_KEY_PREFIX}${pageId}`) || "null");
  } catch (err) {
    return null;
  }
}

function bindTheoryDeck(pageId) {
  $("theoryPrevBtn")?.addEventListener("click", () => renderTheorySlide(THEORY_PAGE_STATE.currentSlide - 1));
  $("theoryNextBtn")?.addEventListener("click", () => renderTheorySlide(THEORY_PAGE_STATE.currentSlide + 1));
  $("theoryEditBtn")?.addEventListener("click", () => {
    playTheoryModeTransition("editing");
    setTheoryEditing(true);
  });
  $("theoryCancelBtn")?.addEventListener("click", () => {
    THEORY_PAGE_STATE.deck = loadDeckForPage(pageId);
    THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
    renderTheoryDeckDetail(pageId);
  });
  $("theorySaveBtn")?.addEventListener("click", () => {
    commitDomToState();
    saveTheoryEdits(pageId);
    playTheoryModeTransition("readonly");
    setTheoryEditing(false);
  });
  $("theoryExportBtn")?.addEventListener("click", () => exportTheoryPdf(pageId));
  document.querySelector("[data-theory-detail]")?.addEventListener("click", () => renderTheoryDetail(pageId));
  $("theoryAddSlideBtn")?.addEventListener("click", addTheorySlide);
  $("theoryDeleteSlideBtn")?.addEventListener("click", deleteTheorySlide);
  $("theoryDeleteComponentBtn")?.addEventListener("click", deleteSelectedComponents);
  $("theoryUndoBtn")?.addEventListener("click", undoDeckChange);
  $("theoryRedoBtn")?.addEventListener("click", redoDeckChange);
  $("theoryDuplicateBtn")?.addEventListener("click", duplicateSelectedComponents);
  $("theorySnapBtn")?.addEventListener("click", toggleSnapToGrid);
  $("theoryImageBtn")?.addEventListener("click", () => $("theoryImageInput")?.click());
  $("theoryImageInput")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) insertImageComponent(file);
    event.target.value = "";
  });
  document.querySelectorAll("[data-insert-component]").forEach(button => {
    button.addEventListener("click", () => insertTheoryComponent(button.dataset.insertComponent));
  });
  bindFontTools();
  bindEditableEvents(pageId);
  bindTheoryDragAndDrop(pageId);
  applyLegacyEdits(pageId);
}

function bindEditableEvents(pageId) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.querySelectorAll(".theory-component").forEach(component => {
    component.addEventListener("pointerdown", event => {
      if (!THEORY_PAGE_STATE.editing || event.target.closest("[data-drag-handle], [data-resize-handle]")) return;
      selectTheoryComponent(component, event.target.closest(".theory-editable"), event.shiftKey);
    });
  });
  deck.querySelectorAll(".theory-editable").forEach(node => {
    node.addEventListener("focus", () => {
      const component = node.closest(".theory-component");
      if (component && THEORY_PAGE_STATE.selectedIds.includes(component.dataset.componentId)) {
        document.querySelectorAll(".theory-editable.is-selected").forEach(item => item.classList.remove("is-selected"));
        node.classList.add("is-selected");
        THEORY_PAGE_STATE.selectedId = node.dataset.editId || component.dataset.componentId;
        updateFontTools();
        updateEditorToolState();
      } else {
        selectTheoryComponent(component, node);
      }
      node.dataset.historyPending = "true";
    });
    node.addEventListener("beforeinput", () => {
      if (node.dataset.historyPending === "true") {
        pushDeckHistory("text");
        node.dataset.historyPending = "false";
      }
    });
    node.addEventListener("input", () => {
      markTheoryDirty();
      syncTheoryAssistantFromDeck(pageId);
    });
    node.addEventListener("blur", () => {
      delete node.dataset.historyPending;
      commitDomToState();
    });
  });
}

function renderTheorySlide(index) {
  const slides = Array.from(document.querySelectorAll(".theory-slide"));
  if (!slides.length) return;
  THEORY_PAGE_STATE.currentSlide = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === THEORY_PAGE_STATE.currentSlide;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  $("theoryPageIndicator").textContent = `${THEORY_PAGE_STATE.currentSlide + 1} / ${slides.length}`;
  $("theoryPrevBtn").disabled = THEORY_PAGE_STATE.currentSlide === 0;
  $("theoryNextBtn").disabled = THEORY_PAGE_STATE.currentSlide === slides.length - 1;
  const deleteBtn = $("theoryDeleteSlideBtn");
  if (deleteBtn) deleteBtn.disabled = slides.length <= 1;
  updateEditorToolState();
}

document.addEventListener("keydown", event => {
  const deck = $("theoryDeck");
  if (!deck || !document.querySelector(".shell.theory")) return;
  if (event.target.closest?.(".theory-editable")) return;
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redoDeckChange();
    else undoDeckChange();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redoDeckChange();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelectedComponents();
    return;
  }
  if (THEORY_PAGE_STATE.editing && (event.key === "Delete" || event.key === "Backspace")) {
    if (deleteSelectedComponents()) event.preventDefault();
    return;
  }
  if (event.key === "ArrowLeft") renderTheorySlide(THEORY_PAGE_STATE.currentSlide - 1);
  if (event.key === "ArrowRight") renderTheorySlide(THEORY_PAGE_STATE.currentSlide + 1);
});

function setTheoryEditing(enabled) {
  const wasEditing = THEORY_PAGE_STATE.editing;
  THEORY_PAGE_STATE.editing = Boolean(enabled);
  const deck = $("theoryDeck");
  if (!deck) return;
  if (THEORY_PAGE_STATE.editing && !wasEditing) {
    THEORY_PAGE_STATE.historyPast = [];
    THEORY_PAGE_STATE.historyFuture = [];
    THEORY_PAGE_STATE.selectedIds = [];
    THEORY_PAGE_STATE.selectedId = null;
  }
  deck.classList.toggle("is-editing", THEORY_PAGE_STATE.editing);
  $("theoryEditorTools").hidden = !THEORY_PAGE_STATE.editing;
  $("theoryEditBtn").hidden = THEORY_PAGE_STATE.editing;
  $("theoryCancelBtn").hidden = !THEORY_PAGE_STATE.editing;
  $("theorySaveBtn").hidden = !THEORY_PAGE_STATE.editing;
  deck.querySelectorAll(".theory-editable").forEach(node => {
    node.setAttribute("contenteditable", String(THEORY_PAGE_STATE.editing));
  });
  if (!THEORY_PAGE_STATE.editing) clearSelection();
  setTheoryStatus(THEORY_PAGE_STATE.editing ? "编辑模式" : "只读模式");
  updateFontTools();
  updateEditorToolState();
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
}

function markTheoryDirty() {
  if (!THEORY_PAGE_STATE.editing) return;
  THEORY_PAGE_STATE.dirty = true;
  setTheoryStatus("有未保存修改");
}

function setTheoryStatus(text) {
  const status = $("theoryDeckStatus");
  if (status) status.textContent = text;
}

function updateEditorToolState() {
  const selectedCount = selectedComponents().length;
  const setDisabled = (selector, disabled) => {
    document.querySelectorAll(selector).forEach(node => {
      node.disabled = disabled;
    });
  };
  setDisabled("#theoryUndoBtn", !THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyPast.length);
  setDisabled("#theoryRedoBtn", !THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyFuture.length);
  setDisabled("#theoryDuplicateBtn, #theoryDeleteComponentBtn", !THEORY_PAGE_STATE.editing);
  const snapBtn = $("theorySnapBtn");
  if (snapBtn) {
    snapBtn.classList.toggle("is-active", THEORY_PAGE_STATE.snapToGrid);
    snapBtn.setAttribute("aria-pressed", String(THEORY_PAGE_STATE.snapToGrid));
  }
  const hint = $("theoryToolHint");
  if (hint && THEORY_PAGE_STATE.editing) {
    hint.textContent = selectedCount ? `已选择 ${selectedCount} 个组件` : "请选择组件";
  }
}

function pushDeckHistory(reason = "edit") {
  if (!THEORY_PAGE_STATE.editing || THEORY_PAGE_STATE.historyLocked) return;
  commitDomToState();
  THEORY_PAGE_STATE.historyPast.push(clone(THEORY_PAGE_STATE.deck));
  if (THEORY_PAGE_STATE.historyPast.length > THEORY_HISTORY_LIMIT) THEORY_PAGE_STATE.historyPast.shift();
  THEORY_PAGE_STATE.historyFuture = [];
  updateEditorToolState();
}

function undoDeckChange() {
  if (!THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyPast.length) return;
  commitDomToState();
  const previous = THEORY_PAGE_STATE.historyPast.pop();
  THEORY_PAGE_STATE.historyFuture.push(clone(THEORY_PAGE_STATE.deck));
  THEORY_PAGE_STATE.historyLocked = true;
  THEORY_PAGE_STATE.deck = previous;
  THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  THEORY_PAGE_STATE.historyLocked = false;
  markTheoryDirty();
  updateEditorToolState();
}

function redoDeckChange() {
  if (!THEORY_PAGE_STATE.editing || !THEORY_PAGE_STATE.historyFuture.length) return;
  commitDomToState();
  const next = THEORY_PAGE_STATE.historyFuture.pop();
  THEORY_PAGE_STATE.historyPast.push(clone(THEORY_PAGE_STATE.deck));
  THEORY_PAGE_STATE.historyLocked = true;
  THEORY_PAGE_STATE.deck = next;
  THEORY_PAGE_STATE.currentSlide = Math.min(THEORY_PAGE_STATE.currentSlide, THEORY_PAGE_STATE.deck.slides.length - 1);
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  THEORY_PAGE_STATE.historyLocked = false;
  markTheoryDirty();
  updateEditorToolState();
}

function playTheoryModeTransition(mode) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.classList.remove("mode-shift-editing", "mode-shift-readonly");
  void deck.offsetWidth;
  deck.classList.add(mode === "editing" ? "mode-shift-editing" : "mode-shift-readonly");
  window.setTimeout(() => deck.classList.remove("mode-shift-editing", "mode-shift-readonly"), 360);
}

function addTheorySlide() {
  pushDeckHistory("add-slide");
  commitDomToState();
  const newSlide = {
    id: uid("slide"),
    layout: "default",
    components: [
      makeComponent("h2", { text: "新增页面" }),
      makeComponent("p", { text: "点击编辑文字，也可以插入更多组件并拖动排版。" })
    ]
  };
  THEORY_PAGE_STATE.deck.slides.splice(THEORY_PAGE_STATE.currentSlide + 1, 0, newSlide);
  THEORY_PAGE_STATE.currentSlide += 1;
  refreshDeckDom(true);
  markTheoryDirty();
}

function deleteTheorySlide() {
  commitDomToState();
  if (THEORY_PAGE_STATE.deck.slides.length <= 1) return;
  pushDeckHistory("delete-slide");
  THEORY_PAGE_STATE.deck.slides.splice(THEORY_PAGE_STATE.currentSlide, 1);
  THEORY_PAGE_STATE.currentSlide = Math.max(0, THEORY_PAGE_STATE.currentSlide - 1);
  refreshDeckDom(true);
  markTheoryDirty();
}

function deleteSelectedComponents() {
  if (!THEORY_PAGE_STATE.editing) return false;
  const componentIds = selectedComponents().map(component => component.dataset.componentId);
  if (!componentIds.length) {
    setTheoryStatus("请先选择要删除的组件");
    return false;
  }
  pushDeckHistory("delete-components");
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return false;
  const before = slide.components.length;
  slide.components = slide.components.filter(item => !componentIds.includes(item.id));
  if (slide.components.length === before) return false;
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  refreshDeckDom(true);
  markTheoryDirty();
  setTheoryStatus("已删除组件，记得保存修改");
  return true;
}

function insertTheoryComponent(type) {
  pushDeckHistory("insert-component");
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return;
  const position = defaultInsertPosition();
  const component = newInsertedComponent(type, position);
  slide.components.push(component);
  refreshDeckDom(true);
  selectTheoryComponent(document.querySelector(`[data-component-id="${cssEscape(component.id)}"]`));
  markTheoryDirty();
}

function duplicateSelectedComponents() {
  const ids = THEORY_PAGE_STATE.selectedIds.filter(Boolean);
  if (!THEORY_PAGE_STATE.editing) return;
  if (!ids.length) {
    setTheoryStatus("请先选择要复制的组件");
    return;
  }
  pushDeckHistory("duplicate");
  selectedComponents().forEach(component => ensureFreePositioned(component, component.closest(".theory-slide")));
  commitDomToState();
  const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
  if (!slide) return;
  const newIds = [];
  ids.forEach(id => {
    const source = slide.components.find(component => component.id === id);
    if (!source) return;
    const copy = cloneComponentWithNewIds(source);
    copy.position = offsetPosition(copy.position || defaultInsertPosition(), 72, 48);
    copy.position.zIndex = nextZIndex();
    slide.components.push(copy);
    newIds.push(copy.id);
  });
  THEORY_PAGE_STATE.selectedIds = newIds;
  refreshDeckDom(true);
  markTheoryDirty();
}

function cloneComponentWithNewIds(component) {
  const copy = clone(component);
  copy.id = uid(copy.type || "component");
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map(item => ({ ...item, id: uid("item") }));
  }
  return copy;
}

function offsetPosition(position, dx, dy) {
  return {
    ...position,
    left: `${parsePx(position.left) + dx}px`,
    top: `${parsePx(position.top) + dy}px`,
  };
}

function changeLayerSelected(action) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (!components.length) {
    setTheoryStatus("请先选择要调整图层的组件");
    return;
  }
  pushDeckHistory(`layer-${action}`);
  const all = Array.from(document.querySelectorAll(".theory-slide.active > .theory-component"));
  const zValues = all.map(node => parseInt(node.style.zIndex || "1", 10)).filter(Number.isFinite);
  const maxZ = Math.max(1, ...zValues);
  const minZ = Math.min(1, ...zValues);
  components.forEach(component => {
    ensureFreePositioned(component, component.closest(".theory-slide"));
    const current = parseInt(component.style.zIndex || "1", 10) || 1;
    if (action === "front") component.style.zIndex = String(maxZ + 10);
    if (action === "back") component.style.zIndex = String(Math.max(1, minZ - 1));
    if (action === "forward") component.style.zIndex = String(current + 1);
    if (action === "backward") component.style.zIndex = String(Math.max(1, current - 1));
  });
  commitDomToState();
  markTheoryDirty();
}

function alignSelectedComponents(mode) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (components.length < 2) {
    setTheoryStatus("请选择至少 2 个组件再对齐");
    return;
  }
  pushDeckHistory(`align-${mode}`);
  const slide = document.querySelector(".theory-slide.active");
  components.forEach(component => ensureFreePositioned(component, slide));
  const rects = components.map(component => componentBox(component));
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.left + rect.width));
  const top = Math.min(...rects.map(rect => rect.top));
  const bottom = Math.max(...rects.map(rect => rect.top + rect.height));
  const hCenter = left + (right - left) / 2;
  const vCenter = top + (bottom - top) / 2;
  components.forEach(component => {
    const box = componentBox(component);
    if (mode === "left") component.style.left = `${snapValue(left)}px`;
    if (mode === "hcenter") component.style.left = `${snapValue(hCenter - box.width / 2)}px`;
    if (mode === "right") component.style.left = `${snapValue(right - box.width)}px`;
    if (mode === "top") component.style.top = `${snapValue(top)}px`;
    if (mode === "vcenter") component.style.top = `${snapValue(vCenter - box.height / 2)}px`;
    if (mode === "bottom") component.style.top = `${snapValue(bottom - box.height)}px`;
  });
  commitDomToState();
  markTheoryDirty();
}

function distributeSelectedComponents(axis) {
  const components = selectedComponents();
  if (!THEORY_PAGE_STATE.editing) return;
  if (components.length < 3) {
    setTheoryStatus("请选择至少 3 个组件再分布");
    return;
  }
  pushDeckHistory(`distribute-${axis}`);
  const slide = document.querySelector(".theory-slide.active");
  components.forEach(component => ensureFreePositioned(component, slide));
  const sorted = components
    .map(component => ({ component, box: componentBox(component) }))
    .sort((a, b) => axis === "x" ? a.box.left - b.box.left : a.box.top - b.box.top);
  const first = sorted[0].box;
  const last = sorted[sorted.length - 1].box;
  if (axis === "x") {
    const start = first.left + first.width / 2;
    const end = last.left + last.width / 2;
    const step = (end - start) / (sorted.length - 1);
    sorted.forEach((entry, index) => {
      entry.component.style.left = `${snapValue(start + step * index - entry.box.width / 2)}px`;
    });
  } else {
    const start = first.top + first.height / 2;
    const end = last.top + last.height / 2;
    const step = (end - start) / (sorted.length - 1);
    sorted.forEach((entry, index) => {
      entry.component.style.top = `${snapValue(start + step * index - entry.box.height / 2)}px`;
    });
  }
  commitDomToState();
  markTheoryDirty();
}

function componentBox(component) {
  return {
    left: parsePx(component.style.left),
    top: parsePx(component.style.top),
    width: component.offsetWidth,
    height: component.offsetHeight,
  };
}

function parsePx(value) {
  const parsed = parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toggleSnapToGrid() {
  if (!THEORY_PAGE_STATE.editing) return;
  THEORY_PAGE_STATE.snapToGrid = !THEORY_PAGE_STATE.snapToGrid;
  updateEditorToolState();
  setTheoryStatus(THEORY_PAGE_STATE.snapToGrid ? "网格吸附已开启" : "网格吸附已关闭");
}

function insertImageComponent(file) {
  if (!THEORY_PAGE_STATE.editing || !file?.type?.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    pushDeckHistory("insert-image");
    commitDomToState();
    const slide = THEORY_PAGE_STATE.deck.slides[THEORY_PAGE_STATE.currentSlide];
    if (!slide) return;
    const position = { ...defaultInsertPosition(), width: "360px", height: "220px" };
    const component = makeComponent("image", {
      src: String(reader.result || ""),
      alt: file.name || "课件图片",
      position,
    });
    slide.components.push(component);
    THEORY_PAGE_STATE.selectedIds = [component.id];
    refreshDeckDom(true);
    markTheoryDirty();
  };
  reader.onerror = () => setTheoryStatus("图片读取失败");
  reader.readAsDataURL(file);
}

function newInsertedComponent(type, position) {
  if (type === "card") {
    return makeComponent("cards", { position, items: [{ id: uid("card"), title: "新卡片", body: "填写卡片说明。", style: {} }] });
  }
  if (type === "bullets") {
    return makeComponent("bullets", { position, items: [{ id: uid("item"), text: "新要点", style: {} }, { id: uid("item"), text: "补充说明", style: {} }] });
  }
  if (type === "callout") return makeComponent("callout", { text: "新的课堂提示。", position });
  if (type === "formula") return makeComponent("formula", { text: "y_hat = w * x + b", position });
  return makeComponent("p", { text: "新的文本框", position });
}

function defaultInsertPosition() {
  const slide = document.querySelector(".theory-slide.active");
  const width = 320;
  if (!slide) return { left: "120px", top: "120px", width: `${width}px`, zIndex: nextZIndex() };
  return {
    left: `${Math.max(24, (slide.clientWidth - width) / 2)}px`,
    top: `${Math.max(24, slide.clientHeight * 0.22)}px`,
    width: `${width}px`,
    zIndex: nextZIndex()
  };
}

function nextZIndex() {
  return String(Date.now() % 100000);
}

function snapValue(value) {
  if (!THEORY_PAGE_STATE.snapToGrid) return Math.round(value);
  return Math.round(value / THEORY_GRID_SIZE) * THEORY_GRID_SIZE;
}

function refreshDeckDom(keepEditing) {
  const viewport = $("theorySlideViewport");
  if (!viewport) return;
  viewport.innerHTML = THEORY_PAGE_STATE.deck.slides.map((slide, index) => renderTheorySlideMarkup(slide, index)).join("");
  bindEditableEvents(THEORY_PAGE_STATE.pageId);
  bindTheoryDragAndDrop(THEORY_PAGE_STATE.pageId);
  setTheoryEditing(keepEditing);
  renderTheorySlide(THEORY_PAGE_STATE.currentSlide);
  restoreSelection();
}

function restoreSelection() {
  const ids = [...THEORY_PAGE_STATE.selectedIds];
  THEORY_PAGE_STATE.selectedIds = [];
  ids.forEach(id => {
    const component = document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(id)}"]`);
    if (!component) return;
    component.classList.add("is-selected");
    if (!THEORY_PAGE_STATE.selectedIds.includes(id)) THEORY_PAGE_STATE.selectedIds.push(id);
  });
  updateFontTools();
  updateEditorToolState();
}

function selectTheoryComponent(component, editable = null, append = false) {
  if (!THEORY_PAGE_STATE.editing || !component) return;
  const componentId = component.dataset.componentId;
  if (!append) clearSelection();
  if (append && THEORY_PAGE_STATE.selectedIds.includes(componentId)) {
    component.classList.remove("is-selected");
    component.querySelectorAll(".theory-editable.is-selected").forEach(node => node.classList.remove("is-selected"));
    THEORY_PAGE_STATE.selectedIds = THEORY_PAGE_STATE.selectedIds.filter(id => id !== componentId);
    THEORY_PAGE_STATE.selectedId = THEORY_PAGE_STATE.selectedIds[THEORY_PAGE_STATE.selectedIds.length - 1] || null;
    updateFontTools();
    updateEditorToolState();
    return;
  }
  component.classList.add("is-selected");
  const target = editable || component.querySelector(".theory-editable");
  if (target) target.classList.add("is-selected");
  if (!THEORY_PAGE_STATE.selectedIds.includes(componentId)) THEORY_PAGE_STATE.selectedIds.push(componentId);
  THEORY_PAGE_STATE.selectedId = target?.dataset.editId || componentId;
  updateFontTools();
  updateEditorToolState();
}

function clearSelection() {
  document.querySelectorAll(".is-selected").forEach(node => node.classList.remove("is-selected"));
  THEORY_PAGE_STATE.selectedId = null;
  THEORY_PAGE_STATE.selectedIds = [];
  updateEditorToolState();
}

function selectedComponents() {
  if (!THEORY_PAGE_STATE.editing) return [];
  return THEORY_PAGE_STATE.selectedIds
    .map(id => document.querySelector(`.theory-slide.active [data-component-id="${cssEscape(id)}"]`))
    .filter(Boolean);
}

function selectedEditables() {
  const components = selectedComponents();
  if (components.length > 1) return components.flatMap(component => Array.from(component.querySelectorAll(".theory-editable")));
  const selectedEditable = document.querySelector(".theory-slide.active .theory-editable.is-selected");
  if (selectedEditable) return [selectedEditable];
  return components.flatMap(component => Array.from(component.querySelectorAll(".theory-editable")));
}

function bindFontTools() {
  $("theoryFontFamily")?.addEventListener("change", event => applyTextStyle("fontFamily", event.target.value));
  $("theoryFontSize")?.addEventListener("change", event => applyTextStyle("fontSize", event.target.value));
  $("theoryBoldBtn")?.addEventListener("click", () => toggleTextStyle("fontWeight", "700", ""));
  $("theoryItalicBtn")?.addEventListener("click", () => toggleTextStyle("fontStyle", "italic", ""));
  $("theoryColorInput")?.addEventListener("input", event => applyTextStyle("color", event.target.value));
  $("theoryAlignSelect")?.addEventListener("change", event => applyTextStyle("textAlign", event.target.value));
  updateFontTools();
}

function applyTextStyle(prop, value) {
  const targets = selectedEditables();
  if (!targets.length) return;
  pushDeckHistory("text-style");
  targets.forEach(node => {
    node.style[prop] = value;
  });
  markTheoryDirty();
  updateFontTools();
}

function toggleTextStyle(prop, onValue, offValue) {
  const targets = selectedEditables();
  if (!targets.length) return;
  pushDeckHistory("text-style");
  const shouldTurnOff = targets.every(node => node.style[prop] === onValue);
  targets.forEach(node => {
    node.style[prop] = shouldTurnOff ? offValue : onValue;
  });
  markTheoryDirty();
  updateFontTools();
}

function updateFontTools() {
  const targets = selectedEditables();
  const disabled = !THEORY_PAGE_STATE.editing || !targets.length;
  ["theoryFontFamily", "theoryFontSize", "theoryBoldBtn", "theoryItalicBtn", "theoryColorInput", "theoryAlignSelect"].forEach(id => {
    const control = $(id);
    if (control) control.disabled = disabled;
  });
  $("theoryToolHint").textContent = disabled ? "请选择组件" : "正在编辑所选组件";
  const deleteComponentBtn = $("theoryDeleteComponentBtn");
  if (deleteComponentBtn) deleteComponentBtn.disabled = disabled;
  if (disabled) return;
  const style = targets[0].style;
  $("theoryFontFamily").value = style.fontFamily || "";
  $("theoryFontSize").value = style.fontSize || "";
  $("theoryColorInput").value = rgbToHex(style.color || "#172033");
  $("theoryAlignSelect").value = style.textAlign || "";
}

function rgbToHex(value) {
  if (!value || value.startsWith("#")) return value || "#172033";
  const match = value.match(/\d+/g);
  if (!match) return "#172033";
  return `#${match.slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("")}`;
}

function bindTheoryDragAndDrop(pageId) {
  const deck = $("theoryDeck");
  if (!deck) return;
  deck.querySelectorAll("[data-drag-handle]").forEach(handle => {
    const component = handle.closest("[data-component-id]");
    if (!component) return;
    handle.addEventListener("pointerdown", event => startFreeDrag(event, component, pageId));
  });
  deck.querySelectorAll("[data-resize-handle]").forEach(handle => {
    const component = handle.closest("[data-component-id]");
    if (!component) return;
    handle.addEventListener("pointerdown", event => startResizeComponent(event, component, pageId));
  });
}

function startFreeDrag(event, component, pageId) {
  if (!THEORY_PAGE_STATE.editing || event.button !== 0) return;
  const slide = component.closest(".theory-slide");
  if (!slide) return;
  event.preventDefault();
  event.stopPropagation();
  if (!THEORY_PAGE_STATE.selectedIds.includes(component.dataset.componentId)) selectTheoryComponent(component);
  pushDeckHistory("drag");

  ensureFreePositioned(component, slide);
  const movingComponents = selectedComponents().length ? selectedComponents() : [component];
  movingComponents.forEach(item => ensureFreePositioned(item, slide));
  const startX = event.clientX;
  const startY = event.clientY;
  const startPositions = movingComponents.map(item => ({
    item,
    left: parseFloat(item.style.left || "0"),
    top: parseFloat(item.style.top || "0"),
  }));
  movingComponents.forEach(item => {
    item.classList.add("is-dragging");
    item.style.zIndex = nextZIndex();
  });
  handlePointerCapture(event);

  const onMove = moveEvent => {
    startPositions.forEach(({ item, left, top }) => {
      const maxLeft = Math.max(0, slide.clientWidth - item.offsetWidth);
      const maxTop = Math.max(0, slide.clientHeight - item.offsetHeight);
      item.style.left = `${snapValue(Math.min(maxLeft, Math.max(0, left + moveEvent.clientX - startX)))}px`;
      item.style.top = `${snapValue(Math.min(maxTop, Math.max(0, top + moveEvent.clientY - startY)))}px`;
    });
  };
  const onEnd = () => {
    movingComponents.forEach(item => item.classList.remove("is-dragging"));
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    markTheoryDirty();
    syncTheoryAssistantFromDeck(pageId);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, { once: true });
  window.addEventListener("pointercancel", onEnd, { once: true });
}

function startResizeComponent(event, component, pageId) {
  if (!THEORY_PAGE_STATE.editing || event.button !== 0) return;
  const slide = component.closest(".theory-slide");
  if (!slide) return;
  event.preventDefault();
  event.stopPropagation();
  selectTheoryComponent(component);
  pushDeckHistory("resize");
  ensureFreePositioned(component, slide);

  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = component.offsetWidth;
  const startHeight = component.offsetHeight;
  const left = parseFloat(component.style.left || "0");
  const top = parseFloat(component.style.top || "0");
  component.classList.add("is-resizing");
  component.style.zIndex = nextZIndex();
  handlePointerCapture(event);

  const onMove = moveEvent => {
    const maxWidth = Math.max(120, slide.clientWidth - left);
    const maxHeight = Math.max(72, slide.clientHeight - top);
    component.style.width = `${snapValue(Math.min(maxWidth, Math.max(120, startWidth + moveEvent.clientX - startX)))}px`;
    component.style.height = `${snapValue(Math.min(maxHeight, Math.max(64, startHeight + moveEvent.clientY - startY)))}px`;
  };
  const onEnd = () => {
    component.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    markTheoryDirty();
    syncTheoryAssistantFromDeck(pageId);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd, { once: true });
  window.addEventListener("pointercancel", onEnd, { once: true });
}

function ensureFreePositioned(component, slide) {
  if (component.classList.contains("is-free-positioned")) return;
  const slideRect = slide.getBoundingClientRect();
  const componentRect = component.getBoundingClientRect();
  component.classList.add("is-free-positioned");
  component.style.left = `${componentRect.left - slideRect.left}px`;
  component.style.top = `${componentRect.top - slideRect.top}px`;
  component.style.width = `${componentRect.width}px`;
  component.style.height = `${componentRect.height}px`;
}

function handlePointerCapture(event) {
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  } catch (err) {}
}

function commitDomToState() {
  const deck = THEORY_PAGE_STATE.deck;
  const viewport = $("theorySlideViewport");
  if (!deck || !viewport) return;
  deck.slides = Array.from(viewport.querySelectorAll(".theory-slide")).map(slideEl => {
    const existing = deck.slides.find(slide => slide.id === slideEl.dataset.slideId) || { id: slideEl.dataset.slideId, layout: "default", components: [] };
    return {
      id: existing.id,
      layout: existing.layout || "default",
      components: Array.from(slideEl.querySelectorAll(":scope > .theory-component")).map(componentEl => collectComponent(componentEl))
    };
  });
}

function collectComponent(componentEl) {
  const existing = findComponentById(componentEl.dataset.componentId);
  const component = existing ? clone(existing) : makeComponent(componentEl.dataset.componentType || "p", { id: componentEl.dataset.componentId });
  component.position = componentEl.classList.contains("is-free-positioned")
    ? { left: componentEl.style.left, top: componentEl.style.top, width: componentEl.style.width, height: componentEl.style.height, zIndex: componentEl.style.zIndex }
    : null;
  if (component.type === "cards") {
    component.items = component.items.map(item => ({
      ...item,
      title: textFor(`${component.id}:${item.id}:title`),
      body: textFor(`${component.id}:${item.id}:body`),
      titleStyle: styleFor(`${component.id}:${item.id}:title`),
      bodyStyle: styleFor(`${component.id}:${item.id}:body`)
    }));
  } else if (component.type === "bullets") {
    component.items = component.items.map(item => ({ ...item, text: textFor(`${component.id}:${item.id}:text`), style: styleFor(`${component.id}:${item.id}:text`) }));
  } else if (component.type === "image") {
    component.alt = textFor(`${component.id}:alt`) || component.alt || "课件图片";
    component.style = styleFor(`${component.id}:alt`);
  } else {
    component.text = textFor(`${component.id}:text`);
    component.style = styleFor(`${component.id}:text`);
  }
  return component;
}

function findComponentById(componentId) {
  return THEORY_PAGE_STATE.deck?.slides.flatMap(slide => slide.components).find(component => component.id === componentId);
}

function textFor(editId) {
  return document.querySelector(`[data-edit-id="${cssEscape(editId)}"]`)?.innerText || "";
}

function styleFor(editId) {
  const node = document.querySelector(`[data-edit-id="${cssEscape(editId)}"]`);
  if (!node) return {};
  return {
    fontFamily: node.style.fontFamily || "",
    fontSize: node.style.fontSize || "",
    fontWeight: node.style.fontWeight || "",
    fontStyle: node.style.fontStyle || "",
    color: node.style.color || "",
    textAlign: node.style.textAlign || "",
  };
}

function saveTheoryEdits(pageId) {
  try {
    localStorage.setItem(`${THEORY_EDIT_KEY_PREFIX}${pageId}`, JSON.stringify({ deckOverride: THEORY_PAGE_STATE.deck }));
    localStorage.removeItem(`${THEORY_LEGACY_EDIT_KEY_PREFIX}${pageId}`);
    THEORY_PAGE_STATE.dirty = false;
    setTheoryStatus("已保存到本机");
  } catch (err) {
    setTheoryStatus("本机保存失败");
  }
}

function applyLegacyEdits(pageId) {
  const saved = readSavedState(pageId);
  if (saved?.deckOverride) return;
  let legacy = null;
  try {
    legacy = JSON.parse(localStorage.getItem(`${THEORY_LEGACY_EDIT_KEY_PREFIX}${pageId}`) || "null");
  } catch (err) {}
  if (!legacy) return;
  const texts = legacy.texts || legacy;
  const positions = legacy.positions || {};
  Object.entries(texts || {}).forEach(([editId, value]) => {
    const node = document.querySelector(`[data-edit-id="${cssEscape(editId)}"]`);
    if (node) node.innerText = value;
  });
  Object.entries(positions || {}).forEach(([componentId, position]) => {
    const node = document.querySelector(`[data-component-id="${cssEscape(componentId)}"]`);
    if (!node || !position) return;
    node.classList.add("is-free-positioned");
    node.style.left = position.left || "0px";
    node.style.top = position.top || "0px";
    node.style.width = position.width || "";
    node.style.height = position.height || "";
    node.style.zIndex = position.zIndex || "";
  });
  commitDomToState();
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

async function exportTheoryPdf(pageId) {
  const deck = $("theoryDeck");
  const viewport = $("theorySlideViewport");
  const exportBtn = $("theoryExportBtn");
  if (!deck || !viewport || !exportBtn) return;
  if (typeof html2pdf === "undefined") {
    setTheoryStatus("导出库未加载，请联网后重试");
    return;
  }
  const activeBeforeExport = THEORY_PAGE_STATE.currentSlide;
  exportBtn.disabled = true;
  exportBtn.textContent = "生成中...";
  setTheoryStatus("正在生成 PDF");
  deck.classList.add("theory-exporting");
  document.querySelectorAll(".theory-slide").forEach(slide => {
    slide.classList.add("active");
    slide.setAttribute("aria-hidden", "false");
  });
  try {
    await html2pdf().set({
      margin: 0,
      filename: `${THEORY_PAGE_STATE.deck.title}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: null },
      jsPDF: { unit: "in", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"], after: ".theory-slide" }
    }).from(viewport).save();
    setTheoryStatus("PDF 已导出");
  } catch (err) {
    setTheoryStatus("PDF 导出失败");
  } finally {
    deck.classList.remove("theory-exporting");
    exportBtn.disabled = false;
    exportBtn.textContent = "导出 PDF";
    renderTheorySlide(activeBeforeExport);
  }
}

function syncTheoryAssistantFromDeck(pageId) {
  if (!window.TheoryAssistant?.setPage) return;
  const deck = $("theoryDeck");
  const text = deck?.innerText?.replace(/\s+/g, " ").trim() || "";
  window.TheoryAssistant.setPage({ id: pageId, title: THEORY_PAGE_STATE.deck?.title || "当前理论页", text });
  if (deck && window.TheoryAssistant.attachSelectionTarget) window.TheoryAssistant.attachSelectionTarget(deck);
}
