// Makes the played dashboard fit the window: denser on smaller screens,
// two-column rows wrap, and every chart stretches to the width of its card at any
// window size or browser zoom. The plot widens or narrows; labels, dots, bars and
// the axis gutters keep their size, the way the chart scripts draw them.
export default function ({ el }) {
  const q = (n) => [...el.querySelectorAll(`[class*="__${n}"]`)].filter((x) => [...x.classList].some((c) => c.endsWith("__" + n)));
  const qn = (n) => { const re = new RegExp("__" + n + "(-\\d+)?$"); return [...el.querySelectorAll(`[class*="__${n}"]`)].filter((x) => [...x.classList].some((c) => re.test(c))); };
  const body = q("app-body")[0];
  if (!body) return;

  // Rows wrap instead of squeezing
  const style = document.createElement("style");
  style.textContent = `
    [class$="__kpi-row"], [class*="__kpi-row "] { flex-wrap: wrap; }
    [class$="__kpi-row"] > *, [class*="__kpi-row "] > * { min-width: 220px; }
    /* Played (prototype.js makes the app the window), the zoomed body still fills
       the window's height: 100vh at a zoom of 0.8 would end at 80% of it. A rule,
       so it holds whichever of the two scripts runs first. */
    .proto-app [class$="__app-body"], .proto-app [class*="__app-body "] { height: calc(100vh / var(--density, 1)) !important; }
  `;
  document.head.appendChild(style);
  const rows = ["chart-row", "monitoring-and-work-row", "power-and-scorecard-row", "tests-and-calibration-row", "backtest-and-exposure-row"].flatMap(q);
  rows.forEach((r) => { r.style.flexWrap = "wrap"; r.style.rowGap = getComputedStyle(r).columnGap || "16px"; [...r.children].forEach((c) => { c.style.minWidth = "440px"; c.style.flexBasis = "0"; c.style.flexGrow = "1"; }); });
  q("kpi-row").forEach((r) => { r.style.rowGap = getComputedStyle(r).columnGap || "16px"; });

  // Density: smaller screens get a tighter scale, browser zoom still works
  const density = () => {
    const w = window.innerWidth;
    const z = w >= 1520 ? 1 : w >= 1360 ? 0.92 : w >= 1200 ? 0.86 : 0.8;
    body.style.zoom = String(z);
    body.style.setProperty("--density", String(z));
    body.style.height = "";
    const p = body.parentElement.getBoundingClientRect().height;
    const h = body.getBoundingClientRect().height;
    if (z < 1 && h < p - 2) body.style.height = (p / z) + "px";
  };

  // ---- Fluid charts ----
  // Per chart: the gutters (px from its left and right edge) its script keeps fixed;
  // everything between them stretches. mid: fixed spans inside (the sankey's middle node).
  // keepW: marks that keep their width and stay centred (bars, boxes). keep: parts that
  // stay put (a legend). round: never stretched, only scaled down when the card is narrower.
  const CFG = {
    "inventory-chart": { l: 28, r: 4, keepW: /^(approved|in-validation|draft|attention)-/ },
    "publish-flow-sankey": { l: 162, r: 162, mid: (W) => { const a = Math.round(W / 2 - 6); return [[a, a + 12]]; } },
    "monitoring-exceptions-chart": { l: 32, r: 20 },
    "psi-line-chart": { l: 40, r: 84 },
    "validation-test-heatmap": { l: 132, r: 0, keep: /^legend-/ },
    "calibration-scatter": { l: 46, r: 12 },
    "backtest-error-boxplot": { l: 36, r: 4, keepW: /-(box|median|lower-cap|upper-cap)(-\d+)?$/ },
    "exposure-treemap": { l: 0, r: 0 },
    "discriminatory-power-gauge": { round: true },
    "model-risk-radar": { round: true }
  };
  const num = (v) => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const keyOf = (n) => { const c = ((n.getAttribute && n.getAttribute("class")) || "").split(/\s+/).find((t) => t.includes("__")); return c ? c.split("__").pop() : null; };
  const isText = (n) => /^(P|SPAN|LABEL|H[1-6])$/.test(n.tagName);
  const css = (a) => `calc(${r3(a[0])}% + ${r3(a[1])}px)`;
  const add = (a, px) => [a[0], a[1] + px];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const innerW = (n) => { const cs = getComputedStyle(n); let w = num(cs.width) || 0; if (cs.boxSizing === "border-box") w -= (num(cs.paddingLeft) || 0) + (num(cs.paddingRight) || 0); return w; };

  // Where an svg's drawing sits, in design px across the chart
  const centreOf = (svg, x, w) => {
    let a = Infinity, b = -Infinity;
    svg.querySelectorAll("path, line, polyline, polygon, rect, circle, ellipse").forEach((p) => { try { const bb = p.getBBox(); if (bb.width || bb.height) { a = Math.min(a, bb.x); b = Math.max(b, bb.x + bb.width); } } catch (e) {} });
    if (!(b >= a)) svg.querySelectorAll("path").forEach((p) => { const v = (p.getAttribute("d") || "").match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []; for (let i = 0; i + 1 < v.length; i += 2) { a = Math.min(a, +v[i]); b = Math.max(b, +v[i]); } });
    if (!(b >= a)) return x + w / 2;
    const vb = svg.viewBox && svg.viewBox.baseVal; const vx = vb && vb.width ? vb.x : 0, vw = vb && vb.width ? vb.width : w;
    return x + ((a + b) / 2 - vx) * w / vw;
  };

  // Inside a stretched cell or tile: texts keep their insets, everything else keeps its share
  const nest = (box, pw) => [...box.children].forEach((c) => {
    if (!keyOf(c) || !pw) return;
    const cs = getComputedStyle(c); if (cs.position !== "absolute") return;
    const x = num(cs.left), w = num(cs.width); if (x === null || w === null) return;
    if (isText(c)) c.style.width = `calc(100% + ${r3(w - pw)}px)`;
    else { c.style.left = r3(x / pw * 100) + "%"; c.style.width = r3(w / pw * 100) + "%"; if (c.children.length) nest(c, w); }
  });

  const fluids = [], rounds = [];
  const setup = (root, cfg) => {
    if (root.dataset.fluid) return;
    const rcs = getComputedStyle(root);
    const W = num(rcs.width), H = num(rcs.height);
    if (!W || !H) return;
    root.dataset.fluid = "1";
    const host = root.parentElement;
    host.style.overflow = "visible";
    const kids = [...root.children].filter((k) => keyOf(k));
    const arcs = [...root.querySelectorAll("path")].some((p) => /[Aa]\s*-?[\d.]/.test(p.getAttribute("d") || ""));
    if (cfg.round || (cfg.l === undefined && arcs)) { rounds.push({ root, host, W, H }); return; }

    let l = cfg.l, r = cfg.r;
    if (l === undefined) { // a chart not listed: gutters from its horizontal grid lines
      let a = Infinity, b = -Infinity;
      kids.forEach((k) => { if (k.tagName !== "DIV" || k.children.length) return; const cs = getComputedStyle(k); const x = num(cs.left), w = num(cs.width), h = num(cs.height); if (x !== null && w && h !== null && h <= 1.5 && w >= 0.4 * W) { a = Math.min(a, x); b = Math.max(b, x + w); } });
      l = a < b ? a : 0; r = a < b ? W - b : 0;
    }
    let spans = [];
    if (l > 0) spans.push([0, l]);
    if (cfg.mid) spans.push(...cfg.mid(W));
    if (r > 0) spans.push([W - r, W]);
    spans = spans.map(([a, b]) => [Math.max(0, a), Math.min(W, b)]).filter(([a, b]) => b > a).sort((s1, s2) => s1[0] - s2[0]);
    const F = spans.reduce((s, [a, b]) => s + b - a, 0), S = W - F;
    if (S < 1) return;
    const fb = (x) => spans.reduce((s, [a, b]) => s + Math.max(0, Math.min(x, b) - a), 0);
    // A design x lands at fb(x) + u·k, k = (width − F) / S: in CSS, u/S of 100% plus px
    const at = (x) => { const f = fb(x), u = x - f; return [u / S * 100, f - u * F / S]; };
    const segOf = (x) => { let s0 = 0; for (const [a, b] of spans) { if (x >= a && x <= b) return [a, b]; if (x > b) s0 = b; else return [s0, a]; } return [s0, W]; };

    kids.forEach((n) => {
      const key = keyOf(n);
      if (cfg.keep && cfg.keep.test(key)) return;
      const cs = getComputedStyle(n);
      if (cs.position !== "absolute") return;
      const x = num(cs.left), w = num(cs.width), h = num(cs.height);
      if (x === null || w === null) return;
      if (n.tagName.toLowerCase() === "svg") {
        // the svg covers just its stretch of the chart, and its viewBox that stretch
        const [s0, s1] = segOf(centreOf(n, x, w));
        const vb = n.viewBox && n.viewBox.baseVal;
        const vx = vb && vb.width ? vb.x : 0, vw = vb && vb.width ? vb.width : w, vy = vb && vb.height ? vb.y : 0, vh = vb && vb.height ? vb.height : (h || 1);
        n.setAttribute("viewBox", `${r3(vx + (s0 - x) * vw / w)} ${r3(vy)} ${r3((s1 - s0) * vw / w)} ${r3(vh)}`);
        n.setAttribute("preserveAspectRatio", "none");
        n.setAttribute("overflow", "visible");
        n.style.left = css(at(s0));
        n.style.width = css(sub(at(s1), at(s0)));
        return;
      }
      if (isText(n)) {
        const al = cs.textAlign;
        const right = al === "right" || al === "end", centre = al === "center";
        const p = right ? x + w : centre ? x + w / 2 : x;
        n.style.left = css(add(at(p), right ? -w : centre ? -w / 2 : 0));
        return;
      }
      const rad = num(cs.borderTopLeftRadius) || 0;
      const dot = w <= 14 && h !== null && Math.abs(w - h) <= 1.5 && rad >= w / 2 - 1;
      const thin = w <= 2.5 && h !== null && h > w;
      if ((cfg.keepW && cfg.keepW.test(key)) || dot || thin) { n.style.left = css(add(at(x + w / 2), -w / 2)); return; }
      n.style.left = css(at(x));
      n.style.width = css(sub(at(x + w), at(x)));
      if (n.children.length) nest(n, w);
    });

    root.style.width = "100%";
    root.style.maxWidth = "none";
    const pts = [0, ...spans.flat(), W].filter((v, i, a) => i === 0 || v > a[i - 1]);
    const m = (x, W2) => { const f = fb(x); return f + (x - f) * (W2 - F) / S; };
    // For the hover guide: design x ↔ px at the chart's current width
    root.__fluid = {
      width: () => num(getComputedStyle(root).width) || W,
      map: m,
      unmap: (p, W2) => { for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], A = m(a, W2), B = m(b, W2); if (p <= B || i + 2 === pts.length) return B > A ? a + (p - A) * (b - a) / (B - A) : a; } return 0; }
    };
    fluids.push({ root, host, H, minW: F + S * 0.55 });
  };

  const charts = new Map();
  Object.entries(CFG).forEach(([k, cfg]) => qn(k).forEach((n) => charts.set(n, cfg)));
  qn("chart-body").forEach((b) => [...b.children].forEach((n) => { // any other chart drawn at a fixed size
    if (charts.has(n) || n.children.length < 3 || getComputedStyle(n).position === "static") return;
    if ([...n.children].every((k) => getComputedStyle(k).position === "absolute")) charts.set(n, {});
  }));
  charts.forEach((cfg, n) => setup(n, cfg));

  const fit = () => {
    // Very narrow cards: the chart keeps a sensible minimum and scales down to fit
    fluids.forEach((c) => {
      const avail = innerW(c.host);
      const narrow = avail > 0 && avail < c.minW;
      const s = narrow ? avail / c.minW : 1;
      c.root.style.width = narrow ? c.minW + "px" : "100%";
      c.root.style.transformOrigin = "0 0";
      c.root.style.transform = narrow ? `scale(${s})` : "";
      c.root.style.marginBottom = narrow ? `${-(1 - s) * c.H}px` : "";
    });
    rounds.forEach((c) => {
      const avail = innerW(c.host);
      const s = avail > 0 ? Math.min(1, avail / c.W) : 1;
      c.root.style.transformOrigin = getComputedStyle(c.host).alignItems === "center" ? "50% 0" : "0 0";
      c.root.style.transform = s < 1 ? `scale(${s})` : "";
      c.root.style.marginBottom = s < 1 ? `${-(1 - s) * c.H}px` : "";
    });
  };
  const ro = new ResizeObserver(() => fit());
  new Set([...fluids, ...rounds].map((c) => c.host)).forEach((h) => ro.observe(h));
  const onResize = () => { density(); fit(); };
  window.addEventListener("resize", onResize);
  density(); fit();
}
