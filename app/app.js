/* 钱途 App · 记账理财（离线优先） */
(function () {
  "use strict";

  const STORAGE_KEY = "qiantu_data_v1";
  const DEFAULT_CATEGORIES = {
    expense: [
      { icon: "🍜", name: "餐饮" }, { icon: "🚇", name: "交通" },
      { icon: "🛒", name: "购物" }, { icon: "🎮", name: "娱乐" },
      { icon: "🏠", name: "居住" }, { icon: "🏥", name: "医疗" },
      { icon: "📚", name: "教育" }, { icon: "📦", name: "其他" }
    ],
    income: [
      { icon: "💰", name: "工资" }, { icon: "💼", name: "兼职" },
      { icon: "📈", name: "理财" }, { icon: "🎁", name: "其他" }
    ]
  };
  const FRAUD_TIPS = [
    "陌生转账先核实，别轻信「刷单返利」「高息理财」。",
    "验证码、密码、银行卡号绝不告诉任何人。",
    "警惕冒充客服/公检法的电话，要求转账的都是诈骗。",
    "不明链接不点、不明二维码不扫，谨防钓鱼。"
  ];

  // ---------- 数据 ----------
  function defaultData() {
    return { transactions: [], budget: null, onboarded: false };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(defaultData(), JSON.parse(raw));
    } catch (e) {}
    return defaultData();
  }
  let data = load();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  // ---------- 工具 ----------
  const pad = n => String(n).padStart(2, "0");
  const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const monthKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const isThisMonth = ts => monthKey(ts) === monthKey(Date.now());
  const fmtMoney = n => "¥" + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fmtDate = ts => { const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日`; };

  // ---------- 状态 ----------
  let currentType = "expense";
  let amountStr = "";
  let currentCat = null;

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const els = {
    onboarding: $("onboarding"), obStart: $("obStart"),
    appTitle: $("appTitle"), appSub: $("appSub"),
    views: { home: $("view-home"), chart: $("view-chart"), add: $("view-add"), analysis: $("view-analysis"), me: $("view-me") },
    homeBalance: $("homeBalance"), homeIncome: $("homeIncome"), homeExpense: $("homeExpense"),
    homeList: $("homeList"), homeEmpty: $("homeEmpty"), quickAddBtn: $("quickAddBtn"),
    trendChart: $("trendChart"), pieChart: $("pieChart"), pieLegend: $("pieLegend"),
    chartTrendBox: $("chartTrendBox"), chartPieBox: $("chartPieBox"),
    amountText: $("amountText"), catGrid: $("catGrid"), noteInput: $("noteInput"),
    ahSentence: $("ahSentence"), adviceList: $("adviceList"), antiFraudText: $("antiFraudText"),
    budgetVal: $("budgetVal"),
    budgetModal: $("budgetModal"), budgetInput: $("budgetInput")
  };

  // ---------- 导航 ----------
  const TAB_TITLES = { home: ["首页", "本月收支总览"], chart: ["图表", "趋势与分类占比"], add: ["记账", "记一笔，3 秒完成"], analysis: ["分析", "开源节流建议"], me: ["我的", "设置与数据管理"] };
  function switchTab(tab) {
    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".tabbar .tab").forEach(t => t.classList.remove("active"));
    els.views[tab].classList.add("active");
    const activeTabBtn = document.querySelector(`.tabbar .tab[data-tab="${tab}"]`);
    if (activeTabBtn) activeTabBtn.classList.add("active");
    els.appTitle.textContent = TAB_TITLES[tab][0];
    els.appSub.textContent = TAB_TITLES[tab][1];
    render(tab);
  }
  document.querySelectorAll(".tabbar .tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  els.quickAddBtn.addEventListener("click", () => switchTab("add"));

  // ---------- 记账 ----------
  document.querySelectorAll(".type-btn").forEach(b => b.addEventListener("click", () => {
    currentType = b.dataset.type;
    document.querySelectorAll(".type-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentCat = null;
    renderCategories();
  }));

  document.querySelectorAll(".keypad .key").forEach(k => k.addEventListener("click", () => {
    const v = k.textContent.trim();
    if (v === "⌫") { amountStr = amountStr.slice(0, -1); }
    else if (v === ".") { if (!amountStr.includes(".")) amountStr = amountStr === "" ? "0." : amountStr + "."; }
    else {
      if (amountStr.includes(".")) {
        const dec = amountStr.split(".")[1];
        if (dec && dec.length >= 2) return; // 最多两位小数
      }
      if (amountStr === "0") amountStr = v; else amountStr += v;
    }
    els.amountText.textContent = amountStr === "" ? "0" : amountStr;
  }));

  function renderCategories() {
    const cats = DEFAULT_CATEGORIES[currentType];
    els.catGrid.innerHTML = cats.map((c, i) =>
      `<button class="cat-item ${currentCat === i ? "active" : ""}" data-i="${i}">${c.icon}<br>${c.name}</button>`
    ).join("");
    els.catGrid.querySelectorAll(".cat-item").forEach(b => b.addEventListener("click", () => {
      currentCat = parseInt(b.dataset.i, 10);
      els.catGrid.querySelectorAll(".cat-item").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    }));
  }

  $("saveTx").addEventListener("click", () => {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { alert("请输入金额"); return; }
    if (currentCat === null) { alert("请选择分类"); return; }
    const cat = DEFAULT_CATEGORIES[currentType][currentCat];
    data.transactions.push({
      id: Date.now() + Math.random(),
      type: currentType, amount, category: cat, note: els.noteInput.value.trim(), ts: Date.now()
    });
    save();
    amountStr = ""; currentCat = null; els.noteInput.value = ""; els.amountText.textContent = "0";
    renderCategories();
    alert("已记账 ✓");
    switchTab("home");
  });

  // ---------- 渲染 ----------
  function monthTx() { return data.transactions.filter(t => isThisMonth(t.ts)); }
  function render(tab) {
    if (tab === "home") renderHome();
    else if (tab === "chart") renderChart();
    else if (tab === "add") renderCategories();
    else if (tab === "analysis") renderAnalysis();
    else if (tab === "me") renderMe();
  }

  function renderHome() {
    const tx = monthTx();
    const income = tx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    els.homeBalance.textContent = fmtMoney(income - expense);
    els.homeIncome.textContent = fmtMoney(income);
    els.homeExpense.textContent = fmtMoney(expense);
    const recent = [...data.transactions].sort((a, b) => b.ts - a.ts).slice(0, 10);
    els.homeEmpty.style.display = recent.length ? "none" : "block";
    els.homeList.innerHTML = recent.map(t => `
      <div class="tx-item">
        <div class="tx-icon">${t.category.icon}</div>
        <div class="tx-info">
          <div class="tx-cat">${t.category.name}${t.note ? " · " + t.note : ""}</div>
          <div class="tx-meta">${fmtDate(t.ts)}</div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}</div>
        <button class="tx-del" data-id="${t.id}">✕</button>
      </div>`).join("");
    els.homeList.querySelectorAll(".tx-del").forEach(b => b.addEventListener("click", () => {
      data.transactions = data.transactions.filter(t => String(t.id) !== b.dataset.id);
      save(); renderHome();
    }));
  }

  // ---------- 图表 ----------
  document.querySelectorAll(".chart-tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".chart-tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    const c = b.dataset.chart;
    els.chartTrendBox.classList.toggle("hidden", c !== "trend");
    els.chartPieBox.classList.toggle("hidden", c !== "pie");
  }));

  function renderChart() {
    // 趋势：近 14 天
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dayKey(d.getTime());
      const txs = data.transactions.filter(t => dayKey(t.ts) === key);
      days.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        income: txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      });
    }
    els.trendChart.innerHTML = trendSVG(days);

    // 分类占比：本月支出
    const exp = monthTx().filter(t => t.type === "expense");
    const byCat = {};
    exp.forEach(t => { const k = t.category.name; byCat[k] = (byCat[k] || 0) + t.amount; });
    const pieData = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    els.pieChart.innerHTML = pieSVG(pieData);
    els.pieLegend.innerHTML = pieData.map((d, i) =>
      `<div class="legend-item"><span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>${d[0]} ${d[1].toFixed(0)}</div>`
    ).join("") || `<div style="font-size:12px;color:#94a3b8">本月还没有支出</div>`;
  }

  const COLORS = ["#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  function trendSVG(days) {
    const W = 320, H = 170, P = 28, B = 20;
    const max = Math.max(1, ...days.map(d => Math.max(d.income, d.expense)));
    const step = (W - 2 * P) / (days.length - 1);
    const y = v => H - B - (v / max) * (H - P - B);
    const line = (key) => days.map((d, i) => `${P + i * step},${y(d[key])}`).join(" ");
    const grid = [0, 0.5, 1].map(f => `<line x1="${P}" y1="${y(max * f)}" x2="${W - P}" y2="${y(max * f)}" stroke="#eef2f7" stroke-width="1"/>`).join("");
    const labels = [0, 6, 13].map(i => `<text x="${P + i * step}" y="${H - 6}" font-size="9" fill="#94a3b8" text-anchor="middle">${days[i].label}</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="170">
      ${grid}${labels}
      <polyline points="${line("income")}" fill="none" stroke="#16a34a" stroke-width="2" stroke-linejoin="round"/>
      <polyline points="${line("expense")}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  function pieSVG(pieData) {
    const total = pieData.reduce((s, d) => s + d[1], 0);
    if (!total) return `<div style="font-size:12px;color:#94a3b8;text-align:center;padding:20px">暂无支出数据</div>`;
    const cx = 80, cy = 80, r = 62, W = 160, H = 160;
    let acc = 0;
    const arcs = pieData.map((d, i) => {
      const f = d[1] / total;
      const a0 = acc * Math.PI * 2 - Math.PI / 2;
      const a1 = (acc + f) * Math.PI * 2 - Math.PI / 2;
      acc += f;
      const large = f > 0.5 ? 1 : 0;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${COLORS[i % COLORS.length]}" stroke="#fff" stroke-width="1.5"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="160" height="160" style="display:block;margin:0 auto">${arcs}<text x="${cx}" y="${cy}" font-size="14" fill="#334155" text-anchor="middle" dy="4">本月支出</text></svg>`;
  }

  // ---------- 分析 ----------
  function renderAnalysis() {
    const tx = monthTx();
    const income = tx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const byCat = {};
    tx.filter(t => t.type === "expense").forEach(t => { byCat[t.category.name] = (byCat[t.category.name] || 0) + t.amount; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const advice = [];
    const balance = income - expense;

    if (tx.length === 0) {
      els.ahSentence.textContent = "还没有账目，先去记几笔吧";
      advice.push({ icon: "✏️", text: "从「记账」页记下第一笔，我才能帮你分析开源节流。" });
    } else {
      els.ahSentence.textContent = balance >= 0
        ? `本月结余 ${fmtMoney(balance)}，收支健康，继续保持。`
        : `本月超支 ${fmtMoney(-balance)}，建议控制支出。`;
      if (balance < 0) advice.push({ icon: "⚠️", text: `本月支出大于收入，超支 ${fmtMoney(-balance)}。优先压缩非必要开销。` });
      if (top) advice.push({ icon: "🎯", text: `最大开销是「${top[0]}」共 ${fmtMoney(top[1])}，占比 ${(top[1] / expense * 100).toFixed(0)}%，节流先从这类下手。` });
      if (expense > 0) {
        const days = Math.max(1, new Date().getDate());
        advice.push({ icon: "📉", text: `本月日均支出 ${fmtMoney(expense / days)}，${days} 天共花 ${fmtMoney(expense)}。` });
      }
      if (income > 0) advice.push({ icon: "📈", text: `开源侧：本月入账 ${fmtMoney(income)}。可考虑把结余放入稳健理财，让钱生钱。` });
      if (data.budget && expense > data.budget) advice.push({ icon: "🔔", text: `已超预算 ${fmtMoney(expense - data.budget)}，本月预算 ${fmtMoney(data.budget)}。` });
      else if (data.budget) advice.push({ icon: "✅", text: `预算 ${fmtMoney(data.budget)}，已用 ${fmtMoney(expense)}，还剩 ${fmtMoney(data.budget - expense)}。` });
      else advice.push({ icon: "🎯", text: "还没设月度预算，去「我的」页设一个，帮你控制总支出。" });
    }
    els.adviceList.innerHTML = advice.slice(0, 4).map(a =>
      `<div class="advice-item"><div class="advice-icon">${a.icon}</div><div class="advice-text">${a.text}</div></div>`
    ).join("");
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    els.antiFraudText.textContent = FRAUD_TIPS[dayOfYear % FRAUD_TIPS.length];
  }

  // ---------- 我的 ----------
  function renderMe() {
    els.budgetVal.textContent = data.budget ? fmtMoney(data.budget) : "未设置";
  }
  $("budgetItem").addEventListener("click", () => { els.budgetModal.classList.remove("hidden"); els.budgetInput.value = data.budget || ""; });
  $("budgetCancel").addEventListener("click", () => els.budgetModal.classList.add("hidden"));
  $("budgetSave").addEventListener("click", () => {
    const v = parseFloat(els.budgetInput.value);
    data.budget = v > 0 ? v : null;
    save(); els.budgetModal.classList.add("hidden"); renderMe();
  });
  $("exportItem").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qiantu_backup.json";
    a.click();
  });
  $("clearItem").addEventListener("click", () => {
    if (confirm("确定清空所有账目？此操作不可恢复。")) {
      data.transactions = []; save(); renderHome(); renderMe();
    }
  });

  // ---------- 新手引导 ----------
  if (!data.onboarded) els.onboarding.classList.remove("hidden");
  els.obStart.addEventListener("click", () => {
    data.onboarded = true; save();
    els.onboarding.classList.add("hidden");
  });

  // ---------- 启动 ----------
  renderCategories();
  switchTab("home");
})();
