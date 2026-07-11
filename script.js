const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const parts = {
  cpu: [
    { name: "Core i3 / Ryzen 3", price: 18000, score: 48, power: 65, tags: ["daily", "study"] },
    { name: "Core i5 / Ryzen 5", price: 34000, score: 70, power: 95, tags: ["daily", "game", "study"] },
    { name: "Core i7 / Ryzen 7", price: 56000, score: 86, power: 125, tags: ["game", "creative"] },
    { name: "Core i9 / Ryzen 9", price: 84000, score: 98, power: 170, tags: ["creative"] },
  ],
  gpu: [
    { name: "内蔵GPU", price: 0, score: 25, power: 0, tags: ["daily", "study"] },
    { name: "Entry GPU", price: 32000, score: 55, power: 115, tags: ["study", "game"] },
    { name: "Mid GPU", price: 68000, score: 78, power: 190, tags: ["game", "creative"] },
    { name: "High GPU", price: 118000, score: 96, power: 285, tags: ["game", "creative"] },
  ],
  ram: [
    { name: "16GB", price: 9000, score: 55, power: 8, tags: ["daily", "study"] },
    { name: "32GB", price: 18000, score: 80, power: 12, tags: ["game", "study", "creative"] },
    { name: "64GB", price: 36000, score: 96, power: 18, tags: ["creative"] },
  ],
  storage: [
    { name: "512GB SSD", price: 7000, score: 52, power: 4, tags: ["daily"] },
    { name: "1TB SSD", price: 13000, score: 76, power: 5, tags: ["game", "study"] },
    { name: "2TB SSD", price: 25000, score: 92, power: 7, tags: ["creative", "game"] },
  ],
  caseType: [
    { name: "Mini", price: 11000, score: 62, power: 0, tags: ["compact"] },
    { name: "Airflow", price: 15000, score: 82, power: 0, tags: ["game", "creative"] },
    { name: "Silent", price: 19000, score: 78, power: 0, tags: ["daily", "study"] },
  ],
};

const presets = {
  balanced: { purpose: "study", budget: 160000, cpu: 1, gpu: 1, ram: 1, storage: 1, caseType: 1 },
  gaming: { purpose: "game", budget: 240000, cpu: 2, gpu: 2, ram: 1, storage: 2, caseType: 1 },
  creator: { purpose: "creative", budget: 300000, cpu: 3, gpu: 2, ram: 2, storage: 2, caseType: 1 },
  compact: { purpose: "daily", budget: 110000, cpu: 1, gpu: 0, ram: 0, storage: 1, caseType: 0 },
};

const state = { ...presets.balanced };
const selects = ["cpu", "gpu", "ram", "storage", "caseType"];

const form = document.querySelector("#build-form");
const budget = document.querySelector("#budget");
const budgetValue = document.querySelector("#budget-value");
const purpose = document.querySelector("#purpose");
const score = document.querySelector("#score");
const scoreGrade = document.querySelector("#score-grade");
const scoreRing = document.querySelector("#score-ring");
const totalPrice = document.querySelector("#total-price");
const power = document.querySelector("#power");
const comfort = document.querySelector("#comfort");
const bars = document.querySelector("#bars");
const advice = document.querySelector("#advice");
const savedList = document.querySelector("#saved-list");

function fillSelects() {
  selects.forEach((key) => {
    const select = document.querySelector(`#${key}`);
    select.innerHTML = parts[key]
      .map((part, index) => `<option value="${index}">${part.name} - ${yen.format(part.price)}</option>`)
      .join("");
  });
}

function selectedParts() {
  return selects.map((key) => ({ key, ...parts[key][Number(state[key])] }));
}

function calculate() {
  const chosen = selectedParts();
  const partTotal = chosen.reduce((sum, part) => sum + part.price, 0);
  const baseCost = 42000;
  const total = partTotal + baseCost;
  const rawScore = Math.round(chosen.reduce((sum, part) => sum + part.score, 0) / chosen.length);
  const matchBonus = chosen.reduce((sum, part) => sum + (part.tags.includes(state.purpose) ? 4 : 0), 0);
  const overBudget = Math.max(0, total - state.budget);
  const budgetPenalty = Math.min(18, Math.round(overBudget / 10000) * 2);
  const finalScore = Math.max(25, Math.min(99, rawScore + matchBonus - budgetPenalty));
  const watts = chosen.reduce((sum, part) => sum + part.power, 85);
  return { chosen, total, finalScore, watts, overBudget };
}

function gradeFor(value) {
  if (value >= 90) return "S";
  if (value >= 78) return "A";
  if (value >= 64) return "B";
  if (value >= 50) return "C";
  return "D";
}

function comfortText(value) {
  if (value >= 90) return "かなり余裕";
  if (value >= 78) return "快適";
  if (value >= 64) return "いい感じ";
  if (value >= 50) return "用途しぼりめ";
  return "要見直し";
}

function barRows(result) {
  const cpu = parts.cpu[state.cpu].score;
  const gpu = parts.gpu[state.gpu].score;
  const memory = Math.round((parts.ram[state.ram].score + parts.storage[state.storage].score) / 2);
  const cooling = Math.round((parts.caseType[state.caseType].score + Math.max(25, 100 - result.watts / 5)) / 2);
  const rows = [
    ["CPU", cpu],
    ["GPU", gpu],
    ["メモリ/保存", memory],
    ["冷却余裕", cooling],
  ];
  return rows
    .map(([label, value]) => `
      <div class="bar-row">
        <div class="bar-label"><span>${label}</span><span>${Math.round(value)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width: ${Math.min(100, value)}%"></div></div>
      </div>
    `)
    .join("");
}

function adviceFor(result) {
  const notes = [];
  if (result.overBudget > 0) {
    notes.push(`予算を${yen.format(result.overBudget)}超えています。GPUかCPUを1段下げると整いやすいです。`);
  } else {
    notes.push(`予算内に収まっています。残り${yen.format(state.budget - result.total)}はモニターやキーボードに回せます。`);
  }
  if (state.purpose === "game" && parts.gpu[state.gpu].score < 70) {
    notes.push("ゲーム用途ならGPUを優先すると体感が伸びます。");
  }
  if (state.purpose === "creative" && parts.ram[state.ram].score < 80) {
    notes.push("制作用途なら32GB以上のメモリが安心です。");
  }
  if (result.watts > 430) {
    notes.push("消費電力が高めなので、電源容量とケースの通気を強めに見てください。");
  }
  return notes.join(" ");
}

function render() {
  const result = calculate();
  budgetValue.textContent = yen.format(state.budget);
  score.textContent = result.finalScore;
  scoreGrade.textContent = gradeFor(result.finalScore);
  scoreRing.style.setProperty("--score-progress", `${result.finalScore}%`);
  totalPrice.textContent = yen.format(result.total);
  power.textContent = `${result.watts}W`;
  comfort.textContent = comfortText(result.finalScore);
  bars.innerHTML = barRows(result);
  advice.textContent = adviceFor(result);

  purpose.value = state.purpose;
  budget.value = state.budget;
  selects.forEach((key) => {
    document.querySelector(`#${key}`).value = state[key];
  });
}

function applyPreset(name) {
  Object.assign(state, presets[name]);
  document.querySelectorAll(".preset-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === name);
  });
  render();
}

function summary() {
  const result = calculate();
  const chosen = result.chosen.map((part) => `${part.key}: ${part.name}`).join("\n");
  return `PC Codee Lab\nScore: ${result.finalScore} ${gradeFor(result.finalScore)}\nTotal: ${yen.format(result.total)}\nPower: ${result.watts}W\n${chosen}`;
}

function savedBuilds() {
  return JSON.parse(localStorage.getItem("pc-codee-builds") || "[]");
}

function storeBuilds(builds) {
  localStorage.setItem("pc-codee-builds", JSON.stringify(builds.slice(0, 6)));
}

function renderSaved() {
  const builds = savedBuilds();
  if (!builds.length) {
    savedList.innerHTML = '<div class="empty-state">まだ保存した構成はありません。</div>';
    return;
  }
  savedList.innerHTML = builds
    .map((build, index) => `
      <article class="saved-card">
        <span>${build.date}</span>
        <strong>${build.grade} / ${build.score}点</strong>
        <p>${build.total} - ${build.purpose}</p>
        <button type="button" data-load="${index}">呼び出す</button>
      </article>
    `)
    .join("");
}

fillSelects();
render();
renderSaved();

form.addEventListener("input", (event) => {
  const { id, value } = event.target;
  if (id === "budget") state.budget = Number(value);
  if (id === "purpose") state.purpose = value;
  if (selects.includes(id)) state[id] = Number(value);
  document.querySelectorAll(".preset-button").forEach((button) => button.classList.remove("is-active"));
  render();
});

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

document.querySelector("#save-build").addEventListener("click", () => {
  const result = calculate();
  const builds = savedBuilds();
  builds.unshift({
    ...state,
    date: new Date().toLocaleDateString("ja-JP"),
    grade: gradeFor(result.finalScore),
    score: result.finalScore,
    total: yen.format(result.total),
    purpose: purpose.options[purpose.selectedIndex].text,
  });
  storeBuilds(builds);
  renderSaved();
});

document.querySelector("#copy-build").addEventListener("click", async () => {
  await navigator.clipboard.writeText(summary());
  advice.textContent = "構成をクリップボードにコピーしました。";
});

savedList.addEventListener("click", (event) => {
  const index = event.target.dataset.load;
  if (index === undefined) return;
  const build = savedBuilds()[Number(index)];
  Object.assign(state, {
    purpose: build.purpose === "ゲーム" ? "game" : build.purpose === "動画・制作" ? "creative" : build.purpose === "学習・開発" ? "study" : "daily",
    budget: build.budget,
    cpu: build.cpu,
    gpu: build.gpu,
    ram: build.ram,
    storage: build.storage,
    caseType: build.caseType,
  });
  render();
});
