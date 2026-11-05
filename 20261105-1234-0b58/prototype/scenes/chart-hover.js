// Hover tooltips and highlight for every chart on the dashboard.
const M = (pairs) => pairs.map(([k, t]) => [k.split(","), t]);
const CFG = [
  { box: "inventory-chart", marks: M([["approved-pd", "PD · Approved: 3 models"], ["approved-lgd", "LGD · Approved: 1 model"], ["approved-behavioural", "Behavioural · Approved: 4 models"], ["approved-off-balance", "Off balance · Approved: 1 model"], ["in-validation-lgd", "LGD · In validation: 1 model"], ["in-validation-behavioural", "Behavioural · In validation: 1 model"], ["draft-behavioural", "Behavioural · Draft / sandbox: 1 model"], ["draft-ead-ccf", "EAD / CCF · Draft / sandbox: 1 model"], ["attention-pd", "PD · Attention: 1 model"], ["attention-ead-ccf", "EAD / CCF · Attention: 1 model"]]) },
  { box: "validation-donut", marks: M([["segment-validated-in-date", "Validated · in date: 8 of 14 models (57%)"], ["segment-validation-in-progress", "Validation in progress: 3 of 14 models (21%)"], ["segment-overdue-review", "Overdue review: 2 of 14 models (14%)"], ["segment-never-validated", "Never validated: 1 of 14 models (7%)"]]) },
  { box: "publish-flow-sankey", marks: M([["flow-behavioural-models,node-behavioural-models", "Behavioural models → Assumption sets: 46% of flow"], ["flow-pd-lgd-ead,node-pd-lgd-ead", "PD / LGD / EAD → Assumption sets: 38% of flow"], ["flow-external-imports,node-external-imports", "External imports → Assumption sets: 15% of flow"], ["flow-to-ecl,node-ecl", "Assumption sets → ECL: 38% of flow"], ["flow-to-irrbb,node-irrbb", "Assumption sets → IRRBB: 31% of flow"], ["flow-to-ftp,node-ftp", "Assumption sets → FTP: 15% of flow"], ["flow-to-liquidity,node-liquidity", "Assumption sets → Liquidity: 16% of flow"], ["node-assumption-sets", "Assumption sets: 9 sets feeding 4 engines"]]) },
  { box: "exposure-treemap", marks: M([["tile-home-loans-pd", "Home loans PD: ₹41,820 crore · 42% of EAD"], ["tile-msme-pd-and-ead", "MSME PD and EAD: ₹15,360 crore · 15% of EAD"], ["tile-retail-lgd", "Retail LGD: ₹14,240 crore · 14% of EAD"], ["tile-credit-cards-pd", "Credit cards PD: ₹11,980 crore · 12% of EAD"], ["tile-behavioural-nmd-and-cpr", "Behavioural NMD and CPR: ₹10,750 crore · 11% of EAD"], ["tile-off-balance-ccf", "Off-balance CCF: ₹6,430 crore · 6% of EAD"]]) },
  { box: "validation-test-heatmap", heat: { rows: [["Retail PIT PD v2.3", "retail-pit-pd-v2-3", [100, 92, 88, 100, 95, 97]], ["Home-loan CPR v3.4", "home-loan-cpr-v3-4", [90, 85, 62, 80, 88, 93]], ["MSME EAD / CCF v1.3", "msme-ead-ccf-v1-3", [75, 70, 81, 66, 72, 58]], ["Retail LGD v1.8", "retail-lgd-v1-8", [96, 89, 91, 94, 85, 99]], ["Behavioural NMD v2.1", "behavioural-nmd-v2-1", [88, 94, 79, 90, 100, 96]], ["Off-balance CCF v1.0", "off-balance-ccf-v1-0", [100, 100, 95, 92, 90, 94]]], cols: [["Gini / AUC", "gini-auc"], ["Calibration", "calibration"], ["Stability", "stability"], ["Sensitivity", "sensitivity"], ["Benchmark", "benchmark"], ["Data quality", "data-quality"]] } },
  { box: "backtest-error-boxplot", box5: [["Prime", -12, -4, 1, 5, 14], ["Affordable", -18, -6, 3, 11, 26], ["Cards", -40, -15, 6, 22, 48], ["Personal", -30, -10, 4, 15, 38], ["Auto", -20, -8, -1, 7, 19], ["MSME", -35, -5, 18, 34, 62]], extra: M([["outlier-85,outlier-value-85", "MSME outlier: 85 bps"]]) },
  { box: "model-risk-radar", radar: { axes: ["Data quality", "Methodology", "Performance", "Stability", "Implementation", "Governance"], series: [["Retail PIT PD v2.3", "retail-pit-pd-v2-3", [4.2, 4, 3.8, 4.1, 4.5, 4.4]], ["Challenger GBM", "challenger-gbm", [4, 3.2, 4.3, 3.1, 3, 3.4]]] } },
  { box: "calibration-scatter", scatter: { pred: [0.05, 0.12, 0.25, 0.45, 0.8, 1.4, 2.5, 4.2, 7.5, 14], series: [["Development observed", "development-observed", [0.04, 0.11, 0.27, 0.43, 0.85, 1.3, 2.6, 4.0, 7.9, 13.2]], ["Out-of-time observed", "out-of-time-observed", [0.06, 0.15, 0.31, 0.52, 0.95, 1.6, 2.9, 4.9, 8.6, 16.1]]] } },
  { box: "discriminatory-power-gauge", marks: M([["discriminatory-power-gauge", "Gini 0.62: AUC 0.81 · at development 0.66 · floor 0.50"]]) },
  { box: "monitoring-exceptions-chart", columns: { W: 519, top: 8, bot: 242, xs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => 32 + i * 467 / 11), months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"], series: [["Threshold breach", [1, 0, 1, 0, 2, 1, 0, 1, 1, 2, 2, 2]], ["Warning", [2, 3, 2, 4, 3, 2, 3, 4, 3, 3, 4, 3]], ["Stale model", [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1]]] } },
  { box: "psi-line-chart", columns: { W: 1094, top: 8, bot: 207, xs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => 40 + (i + 0.5) * 970 / 12), months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"], digits: 2, series: [["Retail PIT PD v2.3", [0.04, 0.05, 0.05, 0.06, 0.05, 0.07, 0.06, 0.08, 0.07, 0.08, 0.09, 0.08]], ["Home-loan CPR v3.4", [0.09, 0.11, 0.12, 0.14, 0.15, 0.17, 0.19, 0.21, 0.23, 0.24, 0.27, 0.28]], ["MSME EAD / CCF v1.3", [0.06, 0.07, 0.09, 0.08, 0.10, 0.11, 0.10, 0.12, 0.13, 0.12, 0.14, 0.15]]] } }
];

// Turn the compact specs into mark lists
CFG.forEach((c) => {
  if (c.heat) c.marks = c.heat.rows.flatMap(([r, rk, vs]) => c.heat.cols.map(([cn, ck], j) => [["cell-" + rk + "-" + ck], r + " · " + cn + ": " + vs[j] + "% passed" + (vs[j] < 70 ? " · below 70" : "")]));
  if (c.box5) c.marks = c.box5.map(([n, mn, q1, md, q3, mx]) => { const k = n.toLowerCase(); return [[k + "-box", k + "-median", k + "-lower-whisker", k + "-upper-whisker"], n + ": median " + md + " bps · middle half " + q1 + " to " + q3 + " · range " + mn + " to " + mx]; }).concat(c.extra);
  if (c.radar) c.marks = c.radar.series.flatMap(([n, k, vs]) => [[[k + "-area"], n + ": average " + (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) + " / 5"]].concat(vs.map((v, i) => [[k + "-symbol-" + (i + 1)], n + " · " + c.radar.axes[i] + ": " + v + " / 5"])));
  if (c.scatter) c.marks = c.scatter.series.flatMap(([n, k, os]) => os.map((o, i) => [[k + "-grade-" + (i + 1)], "Grade " + (i + 1) + " · " + n + ": " + o + "% vs predicted " + c.scatter.pred[i] + "%"]));
});

export default function ({ el }) {
  // Fill style: Solid or Gradient, from the Chart colours card
  (() => {
    const root = el.closest("[class]") && el.parentElement ? (el.parentElement.closest('[class*="__bsm-modelling"]') || el.parentElement) : el;
    const qa = (n) => [...document.querySelectorAll(`[class*="__${n}"]`)].filter((x) => [...x.classList].some((c) => c.endsWith("__" + n)));
    const solidBtns = qa("solid-segment"), gradBtns = qa("gradient-segment");
    const layers = [...el.querySelectorAll("[class]")].filter((n) => [...n.classList].some((c) => /-(sheen|fade-\d+|area-ring-\d+)$/.test(c)));
    const bars = [...el.querySelectorAll("[class]")].filter((n) => /gradient\(/.test(n.style.background || n.style.backgroundImage || "") || /gradient\(/.test(getComputedStyle(n).backgroundImage));
    bars.forEach((n) => { n.dataset.grad = getComputedStyle(n).backgroundImage; const m = n.dataset.grad.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))[^,]*\)?\s*$/) || n.dataset.grad.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))(?!.*(#[0-9a-fA-F]{3,8}|rgba?\())/); n.dataset.solid = m ? m[1] : ""; });
    const paint = (btn, on) => { if (!btn) return; btn.style.background = on ? "var(--colorNeutralBackground1, #fff)" : "transparent"; btn.style.boxShadow = on ? "inset 0 0 0 1px var(--colorNeutralStroke1, #d1d1d1)" : "none"; btn.style.border = "none"; btn.style.cursor = "pointer"; const t = btn.firstElementChild; if (t) { t.style.fontWeight = on ? "600" : "400"; t.style.color = on ? "var(--colorNeutralForeground1, #242424)" : "var(--colorNeutralForeground2, #424242)"; } };
    const apply = (mode) => {
      const solid = mode === "solid";
      layers.forEach((n) => { n.style.transition = "opacity 200ms ease-out"; n.style.opacity = solid ? "0" : ""; });
      bars.forEach((n) => { n.style.backgroundImage = solid ? "none" : n.dataset.grad; if (solid && n.dataset.solid) n.style.backgroundColor = n.dataset.solid; });
      solidBtns.forEach((b) => paint(b, solid)); gradBtns.forEach((b) => paint(b, !solid));
      try { localStorage.setItem("surya-chart-fill", mode); } catch (e) {}
    };
    solidBtns.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); apply("solid"); }));
    gradBtns.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); apply("gradient"); }));
    let saved = "gradient"; try { saved = localStorage.getItem("surya-chart-fill") || "gradient"; } catch (e) {}
    apply(saved);
  })();
  const base = (s) => s.replace(/-(sheen|fade-\d+|ring-\d+)$/, "").replace(/-area-ring$/, "-area");
  const keys = (n) => (n.classList ? [...n.classList].map((c) => c.split("__")[1] || c) : []);
  const all = [el, ...el.querySelectorAll("[class]")];
  const findBox = (s) => all.find((n) => keys(n).includes(s));
  const tip = document.createElement("div");
  Object.assign(tip.style, { position: "fixed", zIndex: 9999, pointerEvents: "none", opacity: "0", transition: "opacity 120ms ease-out",
    background: "var(--colorNeutralBackground1, #fff)", color: "var(--colorNeutralForeground1, #242424)", border: "1px solid var(--colorNeutralStroke1, #d1d1d1)",
    borderRadius: "6px", boxShadow: "var(--shadow16, 0 8px 16px rgba(0,0,0,0.14))", padding: "8px 10px", font: "12px/1.4 'Segoe UI', system-ui, sans-serif", maxWidth: "300px" });
  document.body.appendChild(tip);
  const muted = "color:var(--colorNeutralForeground3,#616161)";
  const show = (html, e) => { tip.innerHTML = html; tip.style.opacity = "1"; const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14; tip.style.left = x + "px"; tip.style.top = y + "px"; };
  const hide = () => { tip.style.opacity = "0"; };
  const fmt = (t) => { const i = t.indexOf(": "); return i < 0 ? t : "<div style='" + muted + "'>" + t.slice(0, i) + "</div><div style='font-weight:600'>" + t.slice(i + 2) + "</div>"; };

  CFG.forEach((c) => {
    const box = findBox(c.box); if (!box) return;
    box.querySelectorAll("svg").forEach((s) => { s.style.pointerEvents = "none"; s.querySelectorAll("path, rect, circle, polygon").forEach((p) => { p.style.pointerEvents = "visiblePainted"; }); });
    if (c.marks) {
      const lookup = new Map(); c.marks.forEach(([ks], i) => ks.forEach((k) => lookup.set(k, i)));
      const groups = c.marks.map(() => []);
      const inside = [box, ...box.querySelectorAll("[class]")];
      inside.forEach((n) => { for (const k of keys(n)) { const i = lookup.has(k) ? lookup.get(k) : lookup.get(base(k)); if (i !== undefined) { groups[i].push(n); n.style.transition = "filter 150ms ease-out"; n.style.cursor = "pointer"; break; } } });
      const owner = new Map(); groups.forEach((g, i) => g.forEach((n) => owner.set(n, i)));
      let cur = -1;
      const set = (i) => { if (i === cur) return; cur = i; if (groups.length < 2) return; groups.forEach((g, k) => g.forEach((n) => { n.style.filter = i < 0 ? "" : k === i ? "brightness(1.05) saturate(1.15)" : "opacity(0.35) saturate(0.6)"; })); };
      box.addEventListener("mousemove", (e) => { let n = e.target, i = -1; while (n && n !== el) { if (owner.has(n)) { i = owner.get(n); break; } if (n === box) break; n = n.parentNode; } set(i); if (i < 0) hide(); else show(fmt(c.marks[i][1]), e); });
      box.addEventListener("mouseleave", () => { set(-1); hide(); });
    } else if (c.columns) {
      const col = c.columns; if (getComputedStyle(box).position === "static") box.style.position = "relative";
      const guide = document.createElement("div");
      Object.assign(guide.style, { position: "absolute", width: "1px", background: "var(--colorNeutralStroke1, #d1d1d1)", pointerEvents: "none", opacity: "0", transition: "opacity 120ms", top: col.top + "px", height: (col.bot - col.top) + "px" });
      box.appendChild(guide);
      box.addEventListener("mousemove", (e) => {
        const r = box.getBoundingClientRect(); const x = (e.clientX - r.left) * col.W / r.width;
        let b = 0; col.xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(col.xs[b] - x)) b = i; });
        guide.style.left = col.xs[b] + "px"; guide.style.opacity = "1";
        show("<div style='" + muted + "'>" + col.months[b] + "</div>" + col.series.map(([n, d]) => "<div style='display:flex;gap:16px;justify-content:space-between'><span>" + n + "</span><b>" + (col.digits ? d[b].toFixed(col.digits) : d[b]) + "</b></div>").join(""), e);
      });
      box.addEventListener("mouseleave", () => { guide.style.opacity = "0"; hide(); });
    }
  });
}
