// Theme flyout: "Charts follow theme" switch.
// On: the board switches to the file's Charts = Theme mode, where every chart colour
// token takes a step of the theme's tonal ramp (see the chart/* variables). Status
// colours (warning, danger, neutral) keep their meaning and don't change.
// SVG marks are exported with literal colours, so each one is pointed back at its token here.
const MARKS = {
  "validation-donut": { "segment-validated-in-date": ["chart/fixed/seq-5"], "segment-validation-in-progress": ["chart/fixed/seq-3"] },
  "publish-flow-sankey": { "flow-behavioural-models": ["chart/default/1"], "flow-pd-lgd-ead": ["chart/default/8"], "flow-external-imports": ["chart/default/9"], "flow-to-ecl": ["chart/default/5"], "flow-to-irrbb": ["chart/default/6"], "flow-to-ftp": ["chart/default/3"], "flow-to-liquidity": ["chart/default/2"] },
  "psi-line-chart": { "retail-pit-pd-v2-3": ["chart/default/1"], "home-loan-cpr-v3-4": ["chart/default/2"], "msme-ead-ccf-v1-3": ["chart/default/3"], "series-line-1": [null, "chart/default/1"], "series-line-2": [null, "chart/default/2"], "series-line-3": [null, "chart/default/3"] },
  "discriminatory-power-gauge": { "below-floor-band": [null, "chart/fixed/seq-1"], "acceptable-band": [null, "chart/fixed/seq-2"], "good-band": [null, "chart/fixed/seq-3"], "gauge-progress-to-0-62": [null, "chart/fixed/seq-5"] },
  "model-risk-radar": { "retail-pit-pd-v2-3-area": ["chart/fixed/1"], "retail-pit-pd-v2-3-line": [null, "chart/fixed/1"], "challenger-gbm-area": ["chart/fixed/2"], "challenger-gbm-line": [null, "chart/fixed/2"] }
};
// KPI progress bars are drawn with a fixed gradient: in theme mode they take the ramp too
const KPI = ["registered-models-progress-fill", "awaiting-approval-progress-fill", "live-contracts-progress-fill"];

export default function ({ el }) {
  const keyOf = (n) => { const c = ((n.getAttribute && n.getAttribute("class")) || "").split(/\s+/).find((t) => t.includes("__")); return c ? c.split("__").pop() : null; };
  const boxes = (k) => [...document.querySelectorAll(`[class*="__${k}"]`)].filter((x) => keyOf(x) === k || new RegExp("^" + k + "-\\d+$").test(keyOf(x) || ""));
  const cssVar = (t) => "--" + t.replace(/\//g, "-");

  // 1. Point every SVG mark at its token
  Object.entries(MARKS).forEach(([box, marks]) => boxes(box).forEach((b) => {
    b.querySelectorAll("svg").forEach((svg) => {
      const k = keyOf(svg); if (!k) return;
      const base = k.replace(/-(fade|ring|area-ring)-\d+$/, (m) => (m.startsWith("-area-ring") ? "-area" : "")).replace(/-\d+$/, "");
      const m = marks[k] || marks[base]; if (!m) return;
      svg.querySelectorAll("path, rect, circle, polygon, polyline, line, ellipse").forEach((p) => {
        const f = p.getAttribute("fill"), s = p.getAttribute("stroke");
        if (m[0] && f && f !== "none" && !f.startsWith("url")) p.style.fill = `var(${cssVar(m[0])}, ${f})`;
        if (m[1] && s && s !== "none") p.style.stroke = `var(${cssVar(m[1])}, ${s})`;
      });
    });
  }));

  // 2. KPI bars
  const css = document.createElement("style");
  const sel = KPI.map((k) => `html.charts-themed [class*="__${k}"]`).join(", ");
  const selSolid = KPI.map((k) => `html.charts-themed.chart-fill-solid [class*="__${k}"]`).join(", ");
  css.textContent = `${sel} { background-image: linear-gradient(90deg, var(--chart-fixed-seq-3), var(--chart-fixed-seq-5)) !important; }
    ${selSolid} { background-image: none !important; background-color: var(--chart-fixed-seq-5) !important; }`;
  document.head.appendChild(css);

  // 3. The switch
  const qa = (n) => [...document.querySelectorAll(`[class*="__${n}"]`)].filter((x) => keyOf(x) === n);
  const sw = qa("charts-follow-theme-switch")[0];
  const row = qa("charts-follow-theme-row")[0];
  if (!sw) return;
  const thumb = sw.firstElementChild;
  const notes = qa("chart-colour-note");
  let on = false;
  const paint = () => {
    sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", String(on)); sw.setAttribute("aria-label", "Charts follow theme");
    sw.style.transition = "background-color 150ms ease-out, border-color 150ms ease-out";
    sw.style.backgroundColor = on ? "var(--colorBrandBackground)" : "var(--colorNeutralBackground1)";
    sw.style.borderColor = on ? "var(--colorBrandBackground)" : "var(--colorNeutralStrokeAccessible)";
    if (thumb) {
      thumb.style.transition = "transform 150ms ease-out, background-color 150ms ease-out";
      thumb.style.transform = on ? "translateX(20px)" : "translateX(0)";
      thumb.style.backgroundColor = on ? "var(--colorNeutralForegroundOnBrand, #fff)" : "var(--colorNeutralForeground3)";
    }
    [document.documentElement, el, ...document.querySelectorAll("[data-charts]")].forEach((n) => n.setAttribute("data-charts", on ? "theme" : "per-chart"));
    document.documentElement.classList.toggle("charts-themed", on);
    notes.forEach((n) => { const t = n.querySelector("p, span") || n; t.textContent = on ? "Charts: theme colours" : "Charts: per chart"; });
    try { localStorage.setItem("surya-charts-follow-theme", on ? "1" : "0"); } catch (e) {}
  };
  const toggle = (e) => { e.stopPropagation(); on = !on; paint(); };
  (row || sw).style.cursor = "pointer";
  (row || sw).addEventListener("click", toggle);
  sw.tabIndex = 0;
  sw.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(e); } });
  try { on = localStorage.getItem("surya-charts-follow-theme") === "1"; } catch (e) {}
  paint();
}
