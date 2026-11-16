// Runs the site's motion: see data-motion, data-section and canvas[data-scene].
(function motionRuntime(makePresets) {
  "use strict";
  const doc = document;
  const root = doc.documentElement;
  root.classList.add("m-js");
  const params = new URLSearchParams(location.search);
  const STILL = params.has("still");
  const config = (() => {
    try {
      return JSON.parse(doc.getElementById("knot-site")?.textContent ?? "{}");
    } catch {
      return {};
    }
  })();
  const presets = makePresets();
  // What the motion editor asks of a page it opens (motion-studio.js): left
  // empty in a published site.
  const hooks = {};
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let choice = params.get("motion");
  if (choice !== "on" && choice !== "off") {
    choice = null;
    try {
      choice = localStorage.getItem("m-motion");
    } catch {}
  }
  const reduced = () => !hooks.on && (STILL || choice === "off" || (choice !== "on" && motionQuery.matches));
  const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
  // Exponential approach, the same at any frame rate.
  const approach = (ms) => 1 - Math.exp(-dt / Math.max(1, ms));
  const warned = new Set();
  const warn = (text, error) => {
    if (warned.has(text)) return;
    warned.add(text);
    console.warn(`motion: ${text}`, error ?? "");
  };

  // ---- units ---------------------------------------------------------------

  // A design px on this screen. 1rem is 10 design px (export.js).
  let unit = 1;
  const measureUnit = () => {
    unit = parseFloat(getComputedStyle(root).fontSize) / 10 || 1;
  };
  const vh = () => innerHeight;
  const vw = () => root.clientWidth || innerWidth;
  const setViewportVars = () => {
    root.style.setProperty("--vw", `${vw() / 100}px`);
    root.style.setProperty("--vh", `${innerHeight / 100}px`);
  };
  setViewportVars();

  // ---- values ---------------------------------------------------------------

  const probe = doc.createElement("canvas").getContext("2d");
  const COLOR = /^(#|rgb|hsl|oklch|oklab|lab|lch|color\()|^[a-z]+$/i;
  const colors = new Map();
  function colorOf(value) {
    if (typeof value !== "string" || !COLOR.test(value)) return null;
    if (colors.has(value)) return colors.get(value);
    probe.fillStyle = "#010203";
    probe.fillStyle = value;
    const text = probe.fillStyle;
    let out = null;
    if (text !== "#010203" || value === "#010203") {
      if (text[0] === "#") out = [parseInt(text.slice(1, 3), 16), parseInt(text.slice(3, 5), 16), parseInt(text.slice(5, 7), 16), 1];
      else {
        const m = text.match(/-?\d*\.?\d+/g);
        if (m) out = [+m[0], +m[1], +m[2], +(m[3] ?? 1)];
      }
    }
    colors.set(value, out);
    return out;
  }
  const NUMBER = /-?\d*\.?\d+/g;
  // Between two values of any kind: numbers, colours, or strings of one
  // shape ("inset(10% 0% 0% 0%)").
  function mix(a, b, t) {
    if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
    const ca = colorOf(a), cb = ca && colorOf(b);
    if (cb) return `rgba(${ca.slice(0, 3).map((v, i) => Math.round(lerp(v, cb[i], t))).join(", ")}, ${round(lerp(ca[3], cb[3], t))})`;
    const sa = String(a), sb = String(b), na = sa.match(NUMBER), nb = sb.match(NUMBER);
    if (na && nb && na.length === nb.length) {
      let i = 0;
      return sb.replace(NUMBER, () => {
        const v = round(lerp(+na[i], +nb[i], t));
        i++;
        return String(v);
      });
    }
    return t < 0.5 ? a : b;
  }
  // A track of evenly spaced values, at p.
  function along(track, p) {
    if (track.length === 2) return mix(track[0], track[1], p);
    const at = clamp(p, 0, 1) * (track.length - 1), i = Math.min(track.length - 2, Math.floor(at));
    return mix(track[i], track[i + 1], at - i);
  }

  // ---- easing -----------------------------------------------------------------

  function bezier(x1, y1, x2, y2) {
    const curve = (a, b, t) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t * t + t ** 3;
    const slope = (a, b, t) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * (1 - t) * t + 3 * (1 - b) * t * t;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = curve(x1, x2, t) - x, d = slope(x1, x2, t);
        if (Math.abs(e) < 1e-4 || !d) break;
        t = clamp(t - e / d, 0, 1);
      }
      return curve(y1, y2, t);
    };
  }
  const EASES = {
    linear: (t) => t,
    ease: bezier(0.25, 0.1, 0.25, 1),
    "ease-in": bezier(0.42, 0, 1, 1),
    "ease-out": bezier(0, 0, 0.58, 1),
    "ease-in-out": bezier(0.42, 0, 0.58, 1),
    "out-quad": (t) => 1 - (1 - t) ** 2,
    "out-cubic": (t) => 1 - (1 - t) ** 3,
    "out-quart": (t) => 1 - (1 - t) ** 4,
    "out-quint": (t) => 1 - (1 - t) ** 5,
    "out-expo": (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
    "out-circ": (t) => Math.sqrt(1 - (t - 1) ** 2),
    "out-back": (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
    "in-quad": (t) => t * t,
    "in-cubic": (t) => t ** 3,
    "in-quart": (t) => t ** 4,
    "in-expo": (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
    "in-out-quad": (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
    "in-out-cubic": (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
    "in-out-quart": (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
    "in-out-expo": (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  };
  const springs = new Map();
  // spring(stiffness, damping, mass): {ease, ms}, its time to settle.
  function spring(spec) {
    if (springs.has(spec)) return springs.get(spec);
    const [k = 170, c = 18, m = 1] = (/\(([^)]*)\)/.exec(spec)?.[1] ?? "").split(",").filter((s) => s.trim()).map(Number);
    const step = 1 / 240, points = [];
    let x = 0, v = 0, t = 0;
    while (t < 4) {
      points.push(x);
      v += ((-k * (x - 1) - c * v) / m) * step;
      x += v * step;
      t += step;
      if (t > 0.1 && Math.abs(x - 1) < 0.0006 && Math.abs(v) < 0.006) break;
    }
    points.push(1);
    const n = points.length - 1;
    const out = { ease: (p) => { const at = clamp(p, 0, 1) * n, i = Math.min(n - 1, Math.floor(at)); return lerp(points[i], points[i + 1], at - i); }, ms: Math.round(t * 1000) };
    springs.set(spec, out);
    return out;
  }
  const curves = new Map();
  function easeOf(spec, fallback = "out-expo") {
    const name = spec ?? fallback;
    if (EASES[name]) return EASES[name];
    if (curves.has(name)) return curves.get(name);
    let fn = EASES[fallback];
    if (typeof name === "string" && name.startsWith("spring")) fn = spring(name).ease;
    else {
      const m = /^cubic-bezier\(([^)]*)\)$/.exec(name ?? "");
      if (m) fn = bezier(...m[1].split(",").map(Number));
    }
    curves.set(name, fn);
    return fn;
  }

  // ---- poses ------------------------------------------------------------------

  // What acts on an element is kept in parts, one per item, and composed once
  // a frame: moves add up, scales and opacities multiply. What the design
  // itself gives the element (a turned layer, a set opacity) is kept as the
  // base it all sits on.
  const NEUTRAL = { opacity: 1, x: 0, y: 0, z: 0, xPercent: 0, yPercent: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0, blur: 0, brightness: 1, saturate: 1 };
  const poses = new WeakMap();
  const knownPoses = new Set();
  const dirty = new Set();
  class Pose {
    parts = new Map();
    written = {};
    constructor(el) {
      this.el = el;
      const cs = getComputedStyle(el);
      this.baseTransform = cs.transform === "none" ? "" : cs.transform;
      this.baseOpacity = +cs.opacity;
      this.baseFilter = cs.filter === "none" ? "" : cs.filter;
    }
    // The design's own filter follows the page's size.
    rebase() {
      if (!this.baseFilter) return;
      this.el.style.filter = "";
      const filter = getComputedStyle(this.el).filter;
      this.baseFilter = filter === "none" ? "" : filter;
      this.written.filter = undefined;
    }
    set(key, values) {
      this.parts.set(key, values);
      dirty.add(this);
    }
    clear(key) {
      if (this.parts.delete(key)) dirty.add(this);
    }
    write() {
      const v = { x: 0, y: 0, z: 0, px: 0, py: 0, xPercent: 0, yPercent: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0, skewX: 0, skewY: 0, opacity: 1, blur: 0, brightness: 1, saturate: 1 };
      const style = {};
      const raw = [];
      for (const part of this.parts.values()) {
        for (const [key, value] of Object.entries(part)) {
          if (key === "raw") raw.push(value);
          else if (key === "scale" || key === "scaleX" || key === "scaleY" || key === "opacity" || key === "brightness" || key === "saturate") v[key] *= value;
          else if (key in v) v[key] += value;
          else style[key] = value;
        }
      }
      const t = [...raw];
      if (v.xPercent || v.yPercent) t.push(`translate(${round(v.xPercent)}%, ${round(v.yPercent)}%)`);
      const x = v.x * unit + v.px, y = v.y * unit + v.py, z = v.z * unit;
      if (x || y || z) t.push(`translate3d(${round(x, 2)}px, ${round(y, 2)}px, ${round(z, 2)}px)`);
      if (v.rotateX) t.push(`rotateX(${round(v.rotateX)}deg)`);
      if (v.rotateY) t.push(`rotateY(${round(v.rotateY)}deg)`);
      if (v.rotate) t.push(`rotate(${round(v.rotate)}deg)`);
      if (v.skewX || v.skewY) t.push(`skew(${round(v.skewX)}deg, ${round(v.skewY)}deg)`);
      if (v.scale !== 1) t.push(`scale(${round(v.scale, 4)})`);
      if (v.scaleX !== 1 || v.scaleY !== 1) t.push(`scale(${round(v.scaleX, 4)}, ${round(v.scaleY, 4)})`);
      if (this.baseTransform) t.push(this.baseTransform);
      const out = this.el.style, was = this.written;
      const transform = t.join(" ");
      if (transform !== was.transform) out.transform = was.transform = transform;
      const opacity = v.opacity === 1 ? "" : String(round(v.opacity * this.baseOpacity));
      if (opacity !== was.opacity) out.opacity = was.opacity = opacity;
      const filter = [this.baseFilter, v.blur ? `blur(${round(v.blur * unit, 2)}px)` : "", v.brightness !== 1 ? `brightness(${round(v.brightness)})` : "", v.saturate !== 1 ? `saturate(${round(v.saturate)})` : ""].filter(Boolean).join(" ");
      if (filter !== (was.filter ?? this.baseFilter)) out.filter = was.filter = filter;
      for (const [key, value] of Object.entries(style)) writeProp(this.el, key, value);
      for (const key of Object.keys(was.style ?? {})) if (!(key in style)) clearProp(this.el, key);
      was.style = style;
    }
  }
  function writeProp(el, key, value) {
    switch (key) {
      case "clip": el.style.clipPath = value; break;
      case "fill": el.style[el.closest?.("svg") ? "fill" : "backgroundColor"] = value; break;
      case "color": el.style.color = value; break;
      case "letterSpacing": el.style.letterSpacing = `${round(value * unit, 2)}px`; break;
      case "wght": el.style.fontVariationSettings = `"wght" ${round(value, 0)}`; break;
      case "width": case "height": case "gap": case "padding": el.style[key] = typeof value === "number" ? `${round(value * unit, 2)}px` : value; break;
      case "radius": el.style.borderRadius = typeof value === "number" ? `${round(value * unit, 2)}px` : value; break;
      case "time": if (el.tagName === "VIDEO" && el.duration) el.currentTime = clamp(value, 0, 1) * el.duration; break;
      case "dash": el.style.strokeDashoffset = value; break;
      default: break;
    }
  }
  function clearProp(el, key) {
    const css = { clip: "clipPath", fill: el.closest?.("svg") ? "fill" : "backgroundColor", letterSpacing: "letterSpacing", wght: "fontVariationSettings", radius: "borderRadius", dash: "strokeDashoffset" }[key] ?? key;
    if (key !== "time") el.style[css] = "";
  }
  function poseOf(el) {
    let pose = poses.get(el);
    if (!pose) {
      poses.set(el, (pose = new Pose(el)));
      knownPoses.add(pose);
    }
    return pose;
  }
  function flush() {
    for (const pose of dirty) pose.write();
    dirty.clear();
  }

  // ---- what plays ---------------------------------------------------------------

  // `run` is every timed thing: {t, ms, delay, fn(progress), done?}. Frame
  // callbacks are for what follows the scroll, the pointer or the time.
  const running = new Set();
  const frames = new Set();
  function run({ ms, delay = 0, ease = EASES.linear, fn, done }) {
    const job = { t: -delay, ms: Math.max(0.001, ms), ease, fn, done, speed: 1 };
    fn(ease(0), job);
    running.add(job);
    hooks.run?.(job);
    return job;
  }
  function stepRunning() {
    for (const job of running) {
      job.t += dt * job.speed;
      if (job.t < 0) {
        if (job.speed < 0) {
          job.t = 0;
          job.fn(job.ease(0), job);
          running.delete(job);
        }
        continue;
      }
      const p = clamp(job.t / job.ms, 0, 1);
      job.fn(job.ease(p), job);
      if (p >= 1 && job.speed > 0) {
        running.delete(job);
        job.done?.();
      }
    }
  }

  // ---- split text ------------------------------------------------------------------

  // Words into spans (and those into letters), with a mask around each word
  // when the item wants one: a word held by its mask rises like a line, and
  // nothing in the text has to be rebuilt. It reads the same to a screen
  // reader, and the text is put back when the entrance ends.
  function splitText(el, mode, mask) {
    if (!el.__split) {
      el.__split = { label: el.getAttribute("aria-label") };
      if (!el.__split.label) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
      const walk = (node) => {
        for (const child of [...node.childNodes]) {
          if (child.nodeType === 3) {
            const frag = doc.createDocumentFragment();
            for (const part of child.nodeValue.split(/(\s+)/)) {
              if (!part) continue;
              if (/^\s+$/.test(part)) {
                frag.append(part);
                continue;
              }
              const word = doc.createElement("span");
              word.className = "m-w";
              word.setAttribute("aria-hidden", "true");
              const inner = doc.createElement("span");
              inner.className = "m-i";
              inner.textContent = part;
              word.append(inner);
              frag.append(word);
            }
            child.replaceWith(frag);
          } else if (child.nodeType === 1 && child.tagName !== "BR" && !child.classList.contains("m-w")) walk(child);
        }
      };
      walk(el);
    }
    const words = [...el.querySelectorAll(".m-i")];
    if (mask !== undefined) for (const word of words) word.parentElement.classList.toggle("m-mask", mask);
    if (mode === "chars") {
      const out = [];
      for (const word of words) {
        if (!word.__chars) {
          word.__chars = [...word.textContent].map((ch) => {
            const c = doc.createElement("span");
            c.className = "m-c";
            c.textContent = ch;
            return c;
          });
          word.replaceChildren(...word.__chars);
        }
        for (const c of word.__chars) out.push([c]);
      }
      return out;
    }
    if (mode === "words") return words.map((w) => [w]);
    // Lines: the words that share a top edge.
    const lines = [];
    let top = null;
    for (const word of words) {
      const y = word.parentElement.offsetTop;
      if (top === null || Math.abs(y - top) > 3) {
        lines.push([]);
        top = y;
      }
      lines.at(-1).push(word);
    }
    return lines;
  }
  // Back to plain text, leaving alone what other items built in the layer.
  function unsplit(el) {
    if (!el.__split || el.__keepSplit) return;
    for (const word of el.querySelectorAll(".m-w")) word.replaceWith(doc.createTextNode(word.textContent));
    el.normalize();
    if (el.__split.label === null) el.removeAttribute("aria-label");
    el.__split = null;
  }

  function staggerOf(item, spec, n) {
    const s = item.stagger ?? spec.stagger;
    if (!s || n <= 1) return () => 0;
    const each = typeof s === "object" ? s.each ?? 50 : s;
    const from = typeof s === "object" ? s.from ?? "start" : "start";
    if (from === "random") {
      // Always the same order, so a film of the page is the same film.
      const order = [...Array(n).keys()].sort((a, b) => ((a * 2654435761) % 977) - ((b * 2654435761) % 977));
      return (i) => order[i] * each;
    }
    if (from === "center") return (i) => Math.abs(i - (n - 1) / 2) * each;
    if (from === "end") return (i) => (n - 1 - i) * each;
    return (i) => i * each;
  }

  // ---- entrances -------------------------------------------------------------------

  function specOf(item) {
    if (item.animate && typeof item.animate === "object") return { from: item.animate.from ?? {}, to: item.animate.to ?? {} };
    return (presets[item.animate ?? "fade"] ?? presets.fade)(item);
  }
  let ids = 0;
  // Between two sets of values, each side filled in from what the other has.
  function blend(el, from, to, e) {
    const out = {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = from[key] ?? NEUTRAL[key] ?? restOf(el, key);
      const b = to[key] ?? NEUTRAL[key] ?? restOf(el, key);
      out[key] = mix(a, b, e);
    }
    return out;
  }
  function restOf(el, key) {
    const cs = getComputedStyle(el);
    if (key === "clip") return "inset(0% 0% 0% 0%)";
    if (key === "fill") return cs.backgroundColor;
    if (key === "color") return cs.color;
    if (key === "letterSpacing") return (parseFloat(cs.letterSpacing) || 0) / unit;
    if (key === "wght") return +cs.fontWeight || 400;
    if (key === "width" || key === "height") return parseFloat(cs[key]) / unit;
    if (key === "radius") return parseFloat(cs.borderRadius) / unit || 0;
    return 0;
  }
  const isRest = (to) => Object.entries(to).every(([key, value]) => value === NEUTRAL[key] || (key === "clip" && /^inset\(0%? 0%? 0%? 0%?\)$/.test(value)));

  function entrance(el, item) {
    const spec = specOf(item);
    const quiet = reduced();
    const fadeOnly = quiet && item.reduced !== "same";
    const from = fadeOnly ? (item.reduced === "none" ? {} : { opacity: 0 }) : spec.from;
    const to = fadeOnly ? (item.reduced === "none" ? {} : { opacity: 1 }) : spec.to;
    const mode = fadeOnly ? undefined : item.split ?? spec.split;
    const mask = item.mask ?? spec.mask;
    const groups = mode === "children" ? [...el.children].map((child) => [child]) : mode ? splitText(el, mode, mask) : [[el]];
    if (!groups.length) groups.push([el]);
    const easingSpec = item.easing ?? spec.easing ?? "out-expo";
    const springy = typeof easingSpec === "string" && easingSpec.startsWith("spring");
    const ms = fadeOnly ? 220 : item.duration ?? (springy ? spring(easingSpec).ms : spec.duration ?? 800);
    const ease = fadeOnly ? EASES["out-cubic"] : easeOf(easingSpec);
    const stagger = fadeOnly ? () => 0 : staggerOf(item, spec, groups.length);
    const key = `in${++ids}`;
    const nodes = groups.flatMap((g, i) => g.map((node) => ({ node, delay: stagger(i) })));
    for (const { node } of nodes) poseOf(node).set(key, blend(node, from, to, 0));
    const needsLayer = mode || nodes.length > 40 ? false : true;
    if (needsLayer) el.style.willChange = "transform, opacity";
    let played = false;
    const handle = {
      play() {
        if (played) return;
        played = true;
        if (STILL) return finish();
        let left = nodes.length;
        const base = fadeOnly ? 0 : item.delay ?? 0;
        for (const { node, delay } of nodes) {
          const pose = poseOf(node);
          hooks.entrance?.(el, item, run({ ms, delay: base + delay, ease, fn: (e) => pose.set(key, blend(node, from, to, e)), done: () => --left === 0 && finish() }));
        }
        if (item.sound) playSound(item, base);
      },
      reset() {
        played = false;
        if (mode && mode !== "children" && !el.__split) groups.splice(0, groups.length, ...splitText(el, mode, mask));
        for (const { node } of nodes) poseOf(node).set(key, blend(node, from, to, 0));
      },
    };
    function finish() {
      el.style.willChange = "";
      if (isRest(to)) {
        for (const { node } of nodes) poseOf(node).clear(key);
        // Once the text is whole again it reflows like any other.
        if (mode && mode !== "children" && item.once !== false && !hooks.on) {
          flush();
          unsplit(el);
        }
      } else for (const { node } of nodes) poseOf(node).set(key, blend(node, from, to, 1));
      el.dispatchEvent(new CustomEvent("motion:entered"));
    }
    return handle;
  }

  const pending = new Set();
  function onAppear(el, item, handle) {
    pending.add({ el, handle, once: item.once !== false, at: item.at ?? 0.2, margin: item.margin ?? 0.08, seen: false });
  }
  function checkAppear() {
    if (holding || !pending.size) return;
    const h = vh(), w = innerWidth;
    for (const e of pending) {
      const r = e.el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const limit = h * (1 - e.margin);
      const shown = Math.max(0, Math.min(r.bottom, limit) - Math.max(r.top, 0));
      const inView = r.top < limit && r.bottom > 0 && r.left < w && r.right > 0 && (shown / Math.max(1, Math.min(r.height, h)) >= e.at || shown >= Math.min(r.height, 120 * unit));
      if (inView) {
        try {
          e.handle.play();
        } catch (error) {
          warn("an entrance failed", error);
        }
        if (e.once) pending.delete(e);
        else e.seen = true;
      } else if (!e.once && e.seen && (r.bottom < 0 || r.top > h)) {
        e.handle.reset();
        e.seen = false;
      }
    }
  }

  // ---- scroll --------------------------------------------------------------------

  const scroll = { y: 0, max: 1, progress: 0, velocity: 0, raw: 0 };
  // Where a thing is on the page, whatever is moving it just now.
  function docBox(el) {
    let top = 0, left = 0;
    let node = el instanceof HTMLElement ? el : el.closest?.("[data-motion]") ?? el.parentElement;
    const height = node?.offsetHeight ?? 0, width = node?.offsetWidth ?? 0;
    for (; node; node = node.offsetParent) {
      top += node.offsetTop;
      left += node.offsetLeft;
    }
    return { top, left, height, width };
  }
  const boxes = new Map();
  const boxOf = (el) => {
    let box = boxes.get(el);
    if (!box) boxes.set(el, (box = docBox(el)));
    return box;
  };
  const measured = new Set();
  function pinOf(el) {
    return el.__pin ? el : el.closest?.(".m-pinned");
  }
  // Where a layer is in its range, 0 to 1.
  function progressOf(el, range) {
    const kind = range ?? (pinOf(el) ? "pin" : "self");
    const y = scroll.y, h = vh();
    if (kind === "page") return scroll.progress;
    if (kind === "intro") return introProgress;
    if (kind === "pin") {
      const pinned = pinOf(el);
      if (pinned) {
        const box = boxOf(pinned.__pin.wrap);
        return clamp((y - box.top) / Math.max(1, box.height - h), 0, 1);
      }
    }
    if (kind === "section") {
      const section = el.closest?.("[data-section]");
      if (section) {
        const box = boxOf(section);
        return box.height > h * 1.05 ? clamp((y - box.top) / Math.max(1, box.height - h), 0, 1) : clamp((y - box.top + h) / (2 * h), 0, 1);
      }
    }
    const box = boxOf(el);
    if (kind === "enter") return clamp((y + h - box.top) / h, 0, 1);
    if (kind === "center") return clamp((y + h / 2 - box.top) / Math.max(1, box.height), 0, 1);
    return clamp((y + h - box.top) / (h + box.height), 0, 1);
  }

  function pin(el, screens) {
    if (el.__pin) return;
    const wrap = doc.createElement("div");
    wrap.className = "m-pin-wrap";
    el.before(wrap);
    wrap.append(el);
    wrap.style.height = `calc(${screens + 1} * 100svh)`;
    el.classList.add("m-pinned");
    el.__pin = { wrap, screens };
  }

  const scrubs = new Set();
  function scrub(el, item) {
    if (reduced() && item.reduced !== "same") return;
    if (hooks.scrub?.(el, item)) return;
    // A path drawn by hand runs through the entrance: it only adds to it.
    const quiet = () => el.__entering && !item.keys;
    const mode = item.split;
    if (mode) el.__keepSplit = true;
    const groups = mode === "children" ? [...el.children].map((child) => [child]) : mode ? splitText(el, mode, item.mask) : [[el]];
    const tracks = Object.entries(item.scrub ?? {});
    const ease = easeOf(item.easing, "linear");
    const key = `sc${++ids}`;
    const share = typeof item.stagger === "number" ? item.stagger / 1000 : 0;
    const n = groups.length;
    let last = -1, shown = -1;
    const nodes = groups.flatMap((g, i) => g.map((node) => ({ node, i, pose: poseOf(node) })));
    if (tracks.length < 6 && nodes.length < 20) el.style.willChange = "transform";
    scrubs.add(() => {
      if (quiet()) return;
      const raw = progressOf(el, item.range), lo = item.from ?? 0, hi = item.to ?? 1;
      const target = clamp((raw - lo) / Math.max(1e-6, hi - lo), 0, 1);
      if (item.smooth) shown = shown < 0 ? target : lerp(shown, target, approach(item.smooth));
      else shown = target;
      if (Math.abs(shown - last) < 0.0002) return;
      last = shown;
      for (const { node, i, pose } of nodes) {
        let p = shown;
        if (share && n > 1) p = clamp((shown - share * i) / Math.max(1e-6, 1 - share * (n - 1)), 0, 1);
        const e = ease(p), values = {};
        for (const [name, track] of tracks) values[name] = along(track, e);
        pose.set(key, values);
      }
    });
  }

  // ---- what goes on all the time ----------------------------------------------------

  // Time-driven loops run only while their layer is on screen.
  const seen = new WeakMap();
  const watcher = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
  }, { rootMargin: "20% 0px" }) : null;
  const visible = (el) => hooks.visible?.(el) ?? seen.get(el) !== false;
  function loop(el, fn) {
    if (reduced()) return;
    watcher?.observe(el);
    const phase = (el.__phase = el.__phase ?? (docBox(el).left * 7.3) % 2000);
    let t = phase;
    frames.add(() => {
      if (!visible(el)) return;
      t = hooks.moment === undefined ? t + dt : phase + hooks.moment;
      fn(t);
    });
  }
  function wave(el, item, name, min, max) {
    const pose = poseOf(el), key = `lp${++ids}`, period = item.period ?? 4000;
    loop(el, (t) => pose.set(key, { [name]: lerp(min, max, 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2)) }));
  }

  function marquee(el, item, vertical) {
    const gap = item.gap ?? 48;
    const set = doc.createElement("span");
    set.className = "m-set";
    set.append(...el.childNodes);
    const track = doc.createElement("span");
    track.className = "m-track";
    track.append(set);
    el.append(track);
    Object.assign(el.style, { overflow: "hidden", display: "block" });
    Object.assign(track.style, { display: "inline-flex", flexDirection: vertical ? "column" : "row", whiteSpace: "nowrap" });
    Object.assign(set.style, { display: "inline-flex", flexDirection: vertical ? "column" : "row", flexShrink: "0" });
    let size = 0;
    const build = () => {
      track.style.gap = set.style.gap = `${gap * unit}px`;
      for (const copy of [...track.children].slice(1)) copy.remove();
      size = (vertical ? set.offsetHeight : set.offsetWidth) + gap * unit;
      if (size <= gap * unit) return;
      const need = Math.ceil((vertical ? el.clientHeight : el.clientWidth) / size) + 1;
      for (let i = 0; i < need; i++) {
        const copy = set.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        track.append(copy);
      }
    };
    build();
    resizers.add(build);
    if (reduced()) return;
    watcher?.observe(el);
    const pose = poseOf(track), sign = item.direction === "right" || item.direction === "down" ? 1 : -1;
    let at = 0, hover = false, boost = 0;
    if (item.pauseOnHover) {
      el.addEventListener("pointerenter", () => (hover = true));
      el.addEventListener("pointerleave", () => (hover = false));
    }
    frames.add(() => {
      if (!visible(el) || !size) return;
      const speed = (item.speed ?? 80) * unit * (hover ? 0 : 1);
      boost = item.velocity ? lerp(boost, clamp(Math.abs(scroll.velocity) / (typeof item.velocity === "number" ? item.velocity : 1400), 0, 4), approach(120)) : 0;
      // At a stopped moment, its plain speed: what a boost adds is lost in the loop.
      at = hooks.moment === undefined ? (at + (speed * (1 + boost) * dt) / 1000) % size : ((speed * hooks.moment) / 1000) % size;
      pose.set("marquee", vertical ? { py: sign > 0 ? at - size : -at } : { px: sign > 0 ? at - size : -at });
    });
  }

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, vx: 0, vy: 0, down: false, moved: false };
  addEventListener("pointermove", (e) => {
    pointer.vx += e.clientX - pointer.x;
    pointer.vy += e.clientY - pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ny = (e.clientY / innerHeight) * 2 - 1;
    pointer.moved = true;
  }, { passive: true });
  addEventListener("pointerdown", () => (pointer.down = true), { passive: true });
  addEventListener("pointerup", () => (pointer.down = false), { passive: true });

  function cursorParallax(el, item) {
    if (reduced() || !fine()) return;
    const reach = (item.reach ?? 120) * (item.depth ?? 0.1), pose = poseOf(el), key = `cp${++ids}`;
    let x = 0, y = 0;
    frames.add(() => {
      x = lerp(x, pointer.nx * reach, approach(item.lag ?? 160));
      y = lerp(y, pointer.ny * reach, approach(item.lag ?? 160));
      pose.set(key, { x, y });
    });
  }
  function magnetic(el, item) {
    if (reduced() || !fine()) return;
    const strength = item.strength ?? 0.35, pose = poseOf(el), key = `mg${++ids}`;
    let x = 0, y = 0;
    frames.add(() => {
      const r = el.getBoundingClientRect();
      const ox = pointer.x - (r.left + r.width / 2), oy = pointer.y - (r.top + r.height / 2);
      const near = Math.hypot(ox, oy) < (item.radius ?? 110) * unit + Math.max(r.width, r.height) / 2;
      x = lerp(x, near ? (ox * strength) / unit : 0, approach(70));
      y = lerp(y, near ? (oy * strength) / unit : 0, approach(70));
      if (Math.abs(x) + Math.abs(y) > 0.02) pose.set(key, { x, y });
      else pose.clear(key);
    });
  }
  function tilt(el, item) {
    if (reduced() || !fine()) return;
    const max = item.max ?? 10, pose = poseOf(el), key = `tl${++ids}`;
    if (el.parentElement && !el.parentElement.style.perspective) el.parentElement.style.perspective = `${(item.perspective ?? 800) * unit}px`;
    let over = false, rx = 0, ry = 0;
    el.addEventListener("pointerenter", () => (over = true));
    el.addEventListener("pointerleave", () => (over = false));
    frames.add(() => {
      let tx = 0, ty = 0;
      if (over) {
        const r = el.getBoundingClientRect();
        tx = -((pointer.y - r.top) / r.height - 0.5) * 2 * max;
        ty = ((pointer.x - r.left) / r.width - 0.5) * 2 * max;
      }
      rx = lerp(rx, tx, approach(90));
      ry = lerp(ry, ty, approach(90));
      if (Math.abs(rx) + Math.abs(ry) > 0.02) pose.set(key, { rotateX: rx, rotateY: ry });
      else pose.clear(key);
    });
  }
  function follow(el, item) {
    if (reduced() || !fine()) return;
    Object.assign(el.style, { position: "fixed", left: "0", top: "0", pointerEvents: "none", zIndex: "9000", opacity: "0" });
    root.classList.add("m-has-cursor");
    const pose = poseOf(el);
    pose.baseOpacity = 1;
    let x = pointer.x, y = pointer.y;
    const plain = el.textContent;
    doc.addEventListener("pointerover", (e) => {
      const label = e.target.closest?.("[data-cursor]")?.dataset.cursor ?? "";
      el.dataset.state = label ? "label" : "";
      if (item.label !== false && plain) el.textContent = label || plain;
    });
    frames.add(() => {
      if (!pointer.moved) return;
      el.style.opacity = "";
      x = lerp(x, pointer.x, approach(item.lag ?? 60));
      y = lerp(y, pointer.y, approach(item.lag ?? 60));
      pose.set("follow", { px: x - el.offsetWidth / 2, py: y - el.offsetHeight / 2 });
    });
  }
  function velocitySkew(el, item) {
    if (reduced()) return;
    const max = item.max ?? 6, scale = item.scale ?? 2500, pose = poseOf(el), key = `vs${++ids}`;
    let at = 0;
    frames.add(() => {
      at = lerp(at, clamp(scroll.velocity / scale, -1, 1) * max, approach(100));
      if (Math.abs(at) > 0.01) pose.set(key, { skewY: at });
      else pose.clear(key);
    });
  }

  function progressBar(el, item) {
    const format = item.format ?? "bar";
    if (format === "bar") el.style.transformOrigin = item.origin ?? "left center";
    const pose = poseOf(el);
    let last = -1;
    scrubs.add(() => {
      const p = progressOf(el, item.range ?? "page");
      if (p === last) return;
      last = p;
      if (format === "bar") pose.set("progress", { scaleX: Math.max(p, 0.0001) });
      else if (format === "percent") el.textContent = `${String(Math.round(p * 100)).padStart(item.pad ?? 3, "0")}${item.suffix ?? "%"}`;
      else el.textContent = String(Math.round(p * (item.max ?? 100))).padStart(item.pad ?? 3, "0");
    });
  }
  function loadProgress(el, item) {
    el.style.fontVariantNumeric = "tabular-nums";
    let last = -1;
    frames.add(() => {
      const shown = Math.round(introProgress * 100);
      if (shown === last) return;
      last = shown;
      el.textContent = `${String(shown).padStart(item.pad ?? 3, "0")}${item.suffix ?? ""}`;
    });
  }
  // Counts a number up when it appears; the text keeps its own format.
  function counter(el, item) {
    const m = /^([^\d-]*)(-?[\d,.\s]*\d)(.*)$/.exec(el.textContent.trim());
    if (!m) return;
    const [, prefix, number, suffix] = m;
    const grouped = number.includes(","), decimals = (number.split(".")[1] ?? "").length;
    const value = parseFloat(number.replace(/[,\s]/g, "")), start = item.start ?? 0;
    const format = (v) => prefix + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped }) + suffix;
    el.style.fontVariantNumeric = "tabular-nums";
    if (reduced()) return;
    el.textContent = format(start);
    let job;
    onAppear(el, { ...item, at: item.at ?? 0.5 }, {
      play() {
        job = run({ ms: item.duration ?? 1600, delay: item.delay ?? 0, ease: easeOf(item.easing, "out-expo"), fn: (e) => (el.textContent = format(start + (value - start) * e)) });
      },
      reset() {
        running.delete(job);
        el.textContent = format(start);
      },
    });
  }
  function clock(el, item) {
    const tick = () => {
      const d = new Date();
      const at = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + (item.offset ?? -d.getTimezoneOffset() / 60) * 3600000);
      const hh = String(at.getHours()).padStart(2, "0"), mm = String(at.getMinutes()).padStart(2, "0"), ss = String(at.getSeconds()).padStart(2, "0");
      el.textContent = `${item.seconds === false ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`}${item.suffix ?? ""}`;
    };
    tick();
    setInterval(tick, item.seconds === false ? 10000 : 1000);
  }
  function readout(el, read) {
    el.style.fontVariantNumeric = "tabular-nums";
    let last = null;
    frames.add(() => {
      const text = read();
      if (text !== last) el.textContent = last = text;
    });
  }
  function draw(el, item) {
    const shapes = el.matches("path, line, polyline, circle, ellipse, rect") ? [el] : [...el.querySelectorAll("path, line, polyline, circle, ellipse, rect")];
    if (reduced() || !shapes.length) return;
    const stagger = staggerOf(item, {}, shapes.length), parts = [];
    shapes.forEach((shape, i) => {
      const length = shape.getTotalLength?.() ?? 0;
      if (!length) return;
      shape.style.strokeDasharray = `${length}`;
      shape.style.strokeDashoffset = `${length}`;
      parts.push({ shape, length, i });
    });
    const play = () => {
      for (const { shape, length, i } of parts) run({ ms: item.duration ?? 1400, delay: (item.delay ?? 0) + stagger(i), ease: easeOf(item.easing, "in-out-cubic"), fn: (e) => (shape.style.strokeDashoffset = String(length * (1 - e))) });
    };
    if (item.on === "scroll") {
      scrubs.add(() => {
        const p = progressOf(el, item.range);
        for (const { shape, length } of parts) shape.style.strokeDashoffset = String(length * (1 - p));
      });
    } else onAppear(el, item, { play, reset() {} });
  }
  // Letters settle out of a shuffle.
  function scramble(el, item) {
    if (reduced()) return;
    const text = el.textContent, glyphs = item.glyphs ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+-*";
    el.setAttribute("aria-label", text);
    const paint = (done, e) => {
      let out = "";
      for (let i = 0; i < text.length; i++) out += i < done || /\s/.test(text[i]) ? text[i] : glyphs[(i * 31 + Math.floor(e * 97)) % glyphs.length];
      el.textContent = out;
    };
    paint(0, 0);
    onAppear(el, item, {
      play: () => run({ ms: item.duration ?? 1100, delay: item.delay ?? 0, ease: EASES.linear, fn: (e) => paint(Math.floor(e * text.length), e), done: () => (el.textContent = text) }),
      reset: () => paint(0, 0),
    });
  }

  // A picture resolves out of coarse blocks.
  function pixelate(el, item) {
    const img = el.tagName === "IMG" ? el : el.querySelector("img");
    if (!img || reduced()) return;
    const host = el === img ? img.parentElement : el;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const canvas = doc.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`, width: `${img.offsetWidth}px`, height: `${img.offsetHeight}px`, pointerEvents: "none", imageRendering: "pixelated" });
    host.append(canvas);
    const ctx = canvas.getContext("2d"), steps = item.steps ?? [64, 40, 28, 18, 12, 8, 5, 3, 2];
    img.style.visibility = "hidden";
    let shown = -1;
    const paint = (i) => {
      if (i === shown) return;
      shown = i;
      const block = steps[i], w = Math.max(1, Math.round(img.offsetWidth / block)), h = Math.max(1, Math.round(img.offsetHeight / block));
      canvas.width = w;
      canvas.height = h;
      try {
        ctx.drawImage(img, 0, 0, w, h);
      } catch {}
    };
    onAppear(el, { ...item, at: item.at ?? 0.3 }, {
      play: () => (img.decode?.() ?? Promise.resolve()).catch(() => {}).then(() => {
        run({ ms: item.duration ?? 1100, delay: item.delay ?? 0, ease: easeOf(item.easing, "in-out-quad"), fn: (e) => paint(Math.min(steps.length - 1, Math.floor(e * steps.length))), done: () => {
          img.style.visibility = "";
          canvas.remove();
        } });
      }),
      reset() {},
    });
  }

  // Sideways through its children while its section holds.
  function horizontal(el, item) {
    const track = el.querySelector(":scope > .m-track-x") ?? (() => {
      const t = doc.createElement("div");
      t.className = "m-track-x";
      Object.assign(t.style, { display: "flex", width: "max-content", height: "100%", gap: getComputedStyle(el).gap, alignItems: getComputedStyle(el).alignItems });
      t.append(...el.childNodes);
      el.append(t);
      return t;
    })();
    if (reduced()) {
      el.style.overflowX = "auto";
      return;
    }
    const distance = () => Math.max(0, track.scrollWidth - el.clientWidth);
    const screens = () => (item.pin ?? distance() / vh());
    el.style.overflow = "clip";
    pin(el, Math.max(0.25, screens()));
    const pose = poseOf(track), ease = easeOf(item.easing, "linear");
    resizers.add(() => (el.__pin.wrap.style.height = `calc(${Math.max(0.25, screens()) + 1} * 100svh)`));
    scrubs.add(() => pose.set("horizontal", { px: -distance() * ease(progressOf(el, "pin")) }));
  }

  // Cards that stack: each holds at the top while the next comes over it,
  // and sinks back a little.
  function stack(el, item) {
    const cards = [...el.children];
    if (reduced() || cards.length < 2) return;
    const top = () => (item.top ?? 80) * unit, step = (item.step ?? 16) * unit;
    const place = () => cards.forEach((card, i) => Object.assign(card.style, { position: "sticky", top: `${top() + i * (item.step ?? 16) * unit}px`, transformOrigin: "50% 0%" }));
    place();
    resizers.add(place);
    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;
      const pose = poseOf(card), key = `st${++ids}`, sink = item.scale ?? 0.06;
      scrubs.add(() => {
        const box = boxOf(next);
        const p = clamp((scroll.y + vh() - box.top) / Math.max(1, vh() - top()), 0, 1);
        pose.set(key, { scale: 1 - sink * p * (cards.length - 1 - i) / (cards.length - 1), brightness: 1 - 0.18 * p });
      });
    });
  }

  // A fixed object the scroll carries from stop to stop. A stop is {at: a
  // section's name, align: 0..1, x, y (design px from the centre, or "30%" of
  // the screen), scale, rotate, opacity}.
  function journey(el, item) {
    const stops = (item.stops ?? []).filter((s) => s && s.at);
    if (!stops.length || reduced()) return;
    Object.assign(el.style, { position: "fixed", left: "50%", top: "50%", pointerEvents: "none" });
    const pose = poseOf(el), ease = easeOf(item.easing, "in-out-cubic");
    const size = (v, full) => (typeof v === "string" && v.trim().endsWith("%") ? (parseFloat(v) / 100) * full : (typeof v === "number" ? v : 0) * unit);
    // A stop's place is a section, by name.
    const target = (stop) => variant().querySelector(`[data-section="${CSS.escape(stop.at)}"]`) ?? (/^[#.[]/.test(stop.at) ? doc.querySelector(stop.at) : null);
    const yOf = (stop) => {
      const node = target(stop);
      if (!node) return null;
      const box = boxOf(node.__pin ? node.__pin.wrap : node);
      return box.top + (stop.align ?? 0) * Math.max(0, box.height - vh());
    };
    scrubs.add(() => {
      const live = stops.map((s) => ({ s, y: yOf(s) })).filter((e) => e.y !== null);
      if (!live.length) return;
      let k = 0;
      while (k < live.length - 1 && scroll.y >= live[k + 1].y) k++;
      const a = live[k], b = live[Math.min(k + 1, live.length - 1)];
      const t = a === b ? 0 : ease(clamp((scroll.y - a.y) / Math.max(1, b.y - a.y), 0, 1));
      const get = (key, fallback) => lerp(a.s[key] ?? fallback, b.s[key] ?? a.s[key] ?? fallback, t);
      pose.set("journey", {
        px: lerp(size(a.s.x, innerWidth), size(b.s.x, innerWidth), t) - el.offsetWidth / 2,
        py: lerp(size(a.s.y, vh()), size(b.s.y, vh()), t) - el.offsetHeight / 2,
        scale: get("scale", 1),
        rotate: get("rotate", 0),
        opacity: get("opacity", 1),
      });
    });
  }

  // Children stood around a tilted disc the scroll turns.
  function wheel(el, item) {
    const cards = [...el.children], n = cards.length;
    if (!n) return;
    const turns = item.turns ?? 1, tiltBy = item.tilt ?? 58, start = item.start ?? 180;
    const lens = () => {
      if (el.parentElement) el.parentElement.style.perspective = `${(item.perspective ?? 1300) * unit}px`;
    };
    lens();
    el.style.transformStyle = "preserve-3d";
    poseOf(el).set("wheel", { raw: `rotateX(${tiltBy}deg)` });
    cards.forEach((c, i) => {
      Object.assign(c.style, { position: "absolute", left: "50%", top: "50%", transformOrigin: "50% 100%" });
      c.__angle = (i / n) * 360;
    });
    const ease = easeOf(item.easing, "linear");
    let last = -1;
    const step = () => {
      const p = reduced() ? 0 : ease(progressOf(el, item.range));
      if (p === last) return;
      last = p;
      const rot = start + p * turns * 360, radius = (item.radius ?? 440) * unit;
      for (const c of cards) {
        const angle = c.__angle + rot, front = -Math.cos((angle * Math.PI) / 180);
        poseOf(c).set("wheel", { raw: `translate(-50%, -100%) rotate(${round(angle)}deg) translateY(${round(-radius, 1)}px) rotate(${round(-angle)}deg) rotateX(${-tiltBy}deg)`, opacity: item.dim === false ? 1 : 0.12 + 0.88 * clamp((front + 1) / 2, 0, 1) ** 1.6 });
        c.style.zIndex = String(Math.round(front * 100) + 200);
      }
    };
    step();
    scrubs.add(step);
    resizers.add(() => {
      lens();
      last = -1;
    });
  }
  // Children stacked in depth, flown through by the scroll.
  function tunnel(el, item) {
    const rings = [...el.children], n = rings.length;
    if (!n) return;
    const lens = () => {
      if (el.parentElement) el.parentElement.style.perspective = `${(item.perspective ?? 900) * unit}px`;
    };
    lens();
    el.style.transformStyle = "preserve-3d";
    rings.forEach((r, i) => {
      Object.assign(r.style, { position: "absolute", left: "50%", top: "50%" });
      r.__at = i + 1;
    });
    const ease = easeOf(item.easing, "linear");
    let last = -1;
    const step = () => {
      const p = reduced() ? 0.3 : ease(progressOf(el, item.range));
      if (p === last) return;
      last = p;
      const gap = (item.gap ?? 900) * unit, past = (item.perspective ?? 900) * unit * 0.8, travel = n * gap + past;
      for (const r of rings) {
        const z = -r.__at * gap + p * travel;
        let o = clamp(1 - (-z - 200 * unit) / (n * gap), 0, 1) ** 1.3;
        if (z > past * 0.55) o *= clamp((past - z) / (past * 0.45), 0, 1);
        poseOf(r).set("tunnel", { raw: `translate(-50%, -50%) translateZ(${round(Math.min(z, past), 1)}px)`, opacity: z > past ? 0 : o });
        r.style.visibility = z > past ? "hidden" : "";
      }
    };
    step();
    scrubs.add(step);
    resizers.add(() => {
      lens();
      last = -1;
    });
  }
  // Frames of a picture sequence, by scroll: {frames: "assets/seq/####.jpg", count}.
  function sequence(el, item) {
    const count = item.count ?? 0;
    if (!count || typeof item.frames !== "string") return;
    const url = (i) => item.frames.replace(/#+/, (m) => String(i + (item.first ?? 1)).padStart(m.length, "0"));
    const canvas = doc.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    canvas.setAttribute("aria-hidden", "true");
    el.append(canvas);
    const ctx = canvas.getContext("2d"), pictures = new Array(count);
    const load = (i) => {
      if (pictures[i]) return pictures[i];
      const img = new Image();
      img.src = url(i);
      return (pictures[i] = img);
    };
    let drawn = -1;
    const paint = (i) => {
      for (let k = -4; k <= 12; k++) if (i + k >= 0 && i + k < count) load(i + k);
      const img = pictures[i];
      if (!img?.complete || !img.naturalWidth || i === drawn) return;
      drawn = i;
      if (canvas.width !== img.naturalWidth) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0);
    };
    jobs.push({ label: "frames", promise: new Promise((done) => { load(0).onload = done; setTimeout(done, 3000); }) });
    scrubs.add(() => paint(Math.round(progressOf(el, item.range) * (count - 1))));
  }

  // ---- hover and press --------------------------------------------------------------

  function reversible(el, item, enter, leave) {
    const spec = specOf({ ...item, animate: item.animate ?? "lift" });
    const pose = poseOf(el), key = `rv${++ids}`;
    const easingSpec = item.easing ?? spec.easing ?? "out-cubic";
    const ease = easeOf(easingSpec, "out-cubic"), ms = reduced() ? 1 : item.duration ?? spec.duration ?? 350;
    const fn = (e) => pose.set(key, blend(el, spec.from, spec.to, e));
    const job = { t: 0, ms, ease, fn, speed: 1 };
    // The pointer can be on the layer's parent: a card's picture zooms when
    // the card is hovered, a caption comes up.
    const host = item.listen === "parent" ? el.parentElement ?? el : el;
    if (Object.keys(spec.from).length) fn(ease(0));
    host.addEventListener(enter, () => {
      job.speed = 1;
      running.add(job);
      if (item.sound) playSound(item, 0);
    });
    const back = () => {
      job.speed = -1;
      job.t = Math.min(job.t, ms);
      running.add(job);
    };
    host.addEventListener(leave, back);
    if (leave === "pointerup") host.addEventListener("pointerleave", back);
  }

  // ---- custom code --------------------------------------------------------------------

  // One object scenes and effects can all write to, to talk to each other.
  const shared = {};
  // What a scene or an effect of its own gets every frame.
  const state = {
    get unit() { return unit; },
    time: 0, dt: 16, frame: 0,
    scroll, pointer,
    section: { index: 0, count: 1, name: "", progress: 0 },
    page: { index: 0, count: 1, from: 0, to: 0, t: 1, flying: false },
    intro: 0,
    reduced: false,
    phone: false,
  };
  function customEffect(el, item) {
    jobs.push({ label: "effects", promise: import(new URL(item.effect.src, location.href).href).then((mod) => {
      const handle = mod.default({ el, input: item.effect.input, state, on, shared, sound: Sound, reduced: reduced(), phone: state.phone, get unit() { return unit; }, pose: poseOf(el) });
      const tick = typeof handle === "function" ? handle : handle?.frame;
      // Under reduced motion too: an effect can be a readout or a control.
      if (tick) frames.add(() => tick(state));
    }).catch((error) => warn(`the effect ${item.effect.src} failed`, error)) });
  }

  // ---- scenes -----------------------------------------------------------------------

  const scenes = [];
  // A scene runs at what the machine can carry: frames that miss their beat
  // lower its resolution, a calm spell raises it slowly again, and a scene
  // that can't hold 15 fps at the lowest gives way to its poster.
  const FLOOR = 0.4;
  function startScene(canvas) {
    let spec;
    try {
      spec = JSON.parse(canvas.dataset.scene);
    } catch {
      return;
    }
    const scene = { canvas, spec, handle: null, share: 1, limit: 1, late: 0, calm: 0, hold: 0, slow: 0, w: 0, h: 0, ready: false, failed: false };
    const poster = spec.poster ? canvas.parentElement?.querySelector(":scope > [data-scene-poster]") : null;
    scene.poster = poster;
    const fail = (error) => {
      scene.failed = true;
      canvas.style.display = "none";
      if (scene.poster) scene.poster.style.opacity = "";
      if (!scene.reported) warn(`the scene ${spec.src} failed`, error);
      scene.reported = true;
      canvas.dataset.sceneError = String(error?.message ?? error).slice(0, 500);
    };
    scene.fail = fail;
    if (reduced() && poster) return;
    watcher?.observe(canvas);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      fail(new Error("the WebGL context was lost"));
    });
    const api = {
      canvas,
      node: spec.node,
      get width() { return scene.w; },
      get height() { return scene.h; },
      get dpr() { return scene.dpr; },
      input: spec.input,
      state,
      on,
      shared,
      sound: Sound,
      reduced: reduced(),
      phone: state.phone,
      url: (path) => new URL(spec.files?.[path] ?? path, location.href).href,
    };
    sizeScene(scene);
    const loading = import(new URL(spec.src, location.href).href).then(async (mod) => {
      if (typeof mod.default !== "function") throw new Error(`${spec.src} has no default export`);
      const handle = await mod.default(api);
      scene.handle = typeof handle === "function" ? { frame: handle } : handle ?? {};
      scene.handle.resize?.(scene.w, scene.h, scene.dpr);
      scene.ready = true;
      canvas.dataset.sceneReady = "";
    }).catch(fail);
    jobs.push({ label: "scene", promise: loading });
    scenes.push(scene);
  }
  function sizeScene(scene) {
    const { canvas, spec } = scene;
    const w0 = canvas.clientWidth, h0 = canvas.clientHeight;
    if (!w0 || !h0) return;
    const dpr = Math.min(hooks.dpr ?? (devicePixelRatio || 1), spec.dpr ?? (state.phone ? 1.5 : 2)) * scene.share;
    const w = Math.max(2, Math.round(w0 * dpr)), h = Math.max(2, Math.round(h0 * dpr));
    if (w === scene.w && h === scene.h) return;
    scene.w = w;
    scene.h = h;
    scene.dpr = dpr;
    canvas.width = w;
    canvas.height = h;
    scene.handle?.resize?.(w, h, dpr);
  }
  let beat = 1000 / 60;
  const calmBeats = [];
  function steerScene(scene) {
    if (dt > beat * 1.26) {
      scene.calm = 0;
      scene.slow++;
      if (++scene.late >= 2) {
        scene.late = 0;
        scene.limit = Math.max(FLOOR, scene.share * 0.92);
        scene.hold = 120;
      }
    } else {
      scene.slow = Math.max(0, scene.slow - 1);
      if (scene.hold > 0) scene.hold--;
      else if (++scene.calm > 40) {
        scene.calm = 0;
        scene.late = 0;
        scene.limit = Math.min(1, scene.limit * 1.04);
      }
    }
    const next = Math.min(1, scene.limit);
    if (Math.abs(next - scene.share) / scene.share > 0.05) {
      scene.share = next;
      sizeScene(scene);
    }
    if (scene.share <= FLOOR + 0.001 && scene.slow > 90 && scene.poster) scene.fail(new Error("too slow here"));
  }
  function frameScenes() {
    for (const scene of scenes) {
      if (scene.failed || !scene.ready || !visible(scene.canvas)) continue;
      // Reduced motion gets one calm frame.
      if (scene.drawn && reduced()) continue;
      try {
        const box = scene.canvas.parentElement;
        state.progress = scene.spec.fixed ? scroll.progress : progressOf(box);
        scene.handle.frame?.(state);
        if (!scene.drawn) {
          scene.drawn = true;
          scene.canvas.dataset.sceneDrawn = "";
          if (scene.poster) scene.poster.style.opacity = "0";
        }
        if (!STILL && !hooks.on && !scene.spec.steady) steerScene(scene);
      } catch (error) {
        scene.fail(error);
      }
    }
  }

  // ---- sound ---------------------------------------------------------------------

  // A small instrument: sines in a long soft room, tuned to one key, so
  // whatever plays and whenever, it's in harmony. Nothing plays before a
  // click, a tap or a key, which is the browser's own rule.
  const Sound = (() => {
    const spec = config.sound;
    const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], "minor-pentatonic": [0, 3, 5, 7, 10], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], whole: [0, 2, 4, 6, 8, 10] };
    const scale = SCALES[spec?.scale ?? "pentatonic"] ?? SCALES.pentatonic;
    const KEYS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const tonic = 60 + (KEYS[spec?.key ?? "D"] ?? 2);
    const midi = (n) => 440 * 2 ** ((n - 69) / 12);
    // Scale step (0 the tonic, 7 an octave up in a 7-note scale) to a note.
    const degree = (d) => tonic + Math.floor(d / scale.length) * 12 + scale[((d % scale.length) + scale.length) % scale.length];
    const level = spec?.level ?? 1;
    let audio = null, dry = null, wet = null, on = !!spec, unlocked = false, chord = null, chordAt = -1;
    try {
      if (localStorage.getItem("m-sound") === "off") on = false;
    } catch {}
    function roomOf(c, secs) {
      const n = Math.ceil(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate), pre = Math.ceil(c.sampleRate * 0.028);
      // The room's own tail, the same every time.
      let seed = 12345;
      const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let lp = 0, lp2 = 0;
        for (let i = pre; i < n; i++) {
          const t = (i - pre) / c.sampleRate, k = 0.32 * Math.exp(-t * 1.3) + 0.012;
          lp += (noise() - lp) * k;
          lp2 += (lp - lp2) * k;
          d[i] = lp2 * Math.exp(-t * 1.75) * Math.min(1, t / 0.045);
        }
      }
      return b;
    }
    function build() {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      const c = new C({ latencyHint: "interactive" });
      const out = c.createGain();
      out.gain.value = 0.8 * level;
      const hold = c.createDynamicsCompressor();
      hold.threshold.value = -15;
      hold.knee.value = 22;
      hold.ratio.value = 2.6;
      const top = c.createBiquadFilter();
      top.type = "lowpass";
      top.frequency.value = 6400;
      const bus = c.createGain();
      dry = c.createGain();
      dry.gain.value = 0.78;
      wet = c.createGain();
      const room = c.createConvolver();
      room.buffer = roomOf(c, 3 + (spec?.room ?? 1) * 1.6);
      const after = c.createGain();
      after.gain.value = 0.86;
      dry.connect(bus);
      wet.connect(room);
      room.connect(after);
      after.connect(bus);
      bus.connect(top);
      top.connect(hold);
      hold.connect(out);
      out.connect(c.destination);
      audio = c;
      return true;
    }
    function sine(t, f, g, attack, decay, dest, f2) {
      const o = audio.createOscillator(), e = audio.createGain();
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + attack + decay * 0.5);
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(g, t + attack);
      e.gain.setTargetAtTime(0, t + attack, decay / 5);
      o.connect(e);
      e.connect(dest);
      o.start(t);
      o.stop(t + attack + decay * 1.7);
    }
    function outlet(p, amount) {
      const pan = audio.createStereoPanner();
      pan.pan.value = clamp(p, -1, 1);
      pan.connect(dry);
      const send = audio.createGain();
      send.gain.value = amount;
      pan.connect(send);
      send.connect(wet);
      return pan;
    }
    const VOICES = {
      // A soft mallet on a warm bar.
      note(t, d, g, p) {
        const f = midi(degree(d)), out = outlet(p, 0.7);
        sine(t, f, g * 0.72, 0.009, 2.2, out);
        sine(t, f * 1.0018, g * 0.36, 0.009, 2, out);
        sine(t, f * 2, g * 0.16, 0.009, 1, out);
        sine(t, f * 3, g * 0.035, 0.009, 0.5, out);
      },
      // A drop on still water.
      drop(t, d, g, p) {
        const f = midi(degree(d) + 12), out = outlet(p, 0.85);
        sine(t, f * 0.94, g * 0.7, 0.007, 0.2, out, f * 1.07);
      },
      // A bowl: two tones so close they beat, swelling, never struck.
      bowl(t, d, g, p) {
        const out = outlet(p, 1);
        for (const [i, n] of [degree(d) - 12, degree(d + 4) - 12].entries()) {
          const f = midi(n), v = g * 0.7 * (i ? 0.68 : 1);
          sine(t, f, v, 0.5, 3.4, out);
          sine(t, f * 1.0032, v * 0.7, 0.55, 3.4, out);
          sine(t, f * 2, v * 0.2, 0.4, 2, out);
        }
      },
      // A low swell, for a page or a big arrival.
      swell(t, d, g, p) {
        const out = outlet(p, 1), f = midi(degree(d) - 24);
        sine(t, f, g * 0.9, 1.1, 3.2, out);
        sine(t, f * 2, g * 0.3, 1.3, 2.6, out);
      },
      chord(t, d, g, p) {
        const out = outlet(p, 0.8);
        for (const step of [0, 2, 4, 7]) sine(t, midi(degree(d + step)), g * 0.3, 0.05, 3, out);
      },
    };
    // Unlocking starts the room; a browser plays nothing before a gesture.
    function unlock() {
      if (unlocked || !spec) return;
      if (!audio && !build()) return;
      audio.resume?.();
      unlocked = true;
      emit("sound", true);
      if (on) setChord(state.section.index);
    }
    // The room's chord for a section: from `chords` (lists of scale steps),
    // or walking the scale.
    function setChord(i) {
      if (!audio || !unlocked || !on || !spec || i === chordAt) return;
      chordAt = i;
      const t = audio.currentTime + 0.02, fade = 1.6;
      if (chord) {
        const old = chord;
        old.gain.gain.cancelScheduledValues(t);
        old.gain.gain.setTargetAtTime(0, t, fade / 3.2);
        for (const o of old.nodes) o.stop(t + fade * 2.4);
      }
      const walk = [0, 3, 4, 1, 5, 2];
      const steps = spec.chords?.[i % spec.chords.length] ?? [0, 2, 4, 7].map((s) => s + walk[i % walk.length]);
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.0072 * 3, t + fade);
      const top = audio.createBiquadFilter();
      top.type = "lowpass";
      top.frequency.value = 760;
      gain.connect(top);
      const send = audio.createGain();
      send.gain.value = 0.7;
      top.connect(send);
      send.connect(wet);
      top.connect(dry);
      const nodes = steps.map((s, n) => {
        const o = audio.createOscillator();
        o.frequency.value = midi(degree(s) - 12) * (1 + (n % 2 ? 0.0006 : -0.0004));
        o.connect(gain);
        o.start(t);
        return o;
      });
      chord = { gain, nodes };
    }
    function play(voice, { note = 0, level: g = 0.08, pan = 0, at = 0 } = {}) {
      if (!audio || !unlocked || !on) return;
      VOICES[voice]?.(audio.currentTime + 0.005 + Math.max(0, +at || 0) / 1000, Math.round(+note || 0), +g || 0.08, clamp(+pan || 0, -1, 1));
    }
    function set(value) {
      on = !!value;
      try {
        localStorage.setItem("m-sound", on ? "on" : "off");
      } catch {}
      if (!on && chord) {
        chord.gain.gain.setTargetAtTime(0, audio.currentTime, 0.2);
        for (const o of chord.nodes) o.stop(audio.currentTime + 1);
        chord = null;
        chordAt = -1;
      }
      if (on) setChord(state.section.index);
      emit("sound", on);
    }
    for (const event of ["pointerdown", "keydown", "touchend"]) addEventListener(event, unlock, { passive: true });
    return { play, set, unlock, chord: setChord, get on() { return on; }, get enabled() { return !!spec; }, get unlocked() { return unlocked; } };
  })();
  function playSound(item, at) {
    Sound.play(item.sound, { note: item.note ?? 0, level: item.level ?? 0.08, pan: item.pan ?? 0, at });
  }
  function soundToggle(el) {
    const paint = () => {
      el.setAttribute("aria-pressed", String(Sound.on));
      el.dataset.on = String(Sound.on);
    };
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.cursor = "pointer";
    const flip = () => {
      Sound.unlock();
      Sound.set(!Sound.on);
      paint();
    };
    el.addEventListener("click", flip);
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      flip();
    });
    paint();
    el.__soundToggle = true;
  }

  // ---- wiring -----------------------------------------------------------------------

  const resizers = new Set();
  const jobs = [];
  let holding = true;
  const held = [];
  function effect(el, item) {
    if (item.effect && typeof item.effect === "object") return customEffect(el, item);
    switch (item.effect) {
      case "marquee": return marquee(el, item, false);
      case "ticker": return marquee(el, item, true);
      case "float": return wave(el, item, "y", -(item.amplitude ?? 8), item.amplitude ?? 8);
      case "drift": return wave(el, item, "x", -(item.amplitude ?? 12), item.amplitude ?? 12);
      case "pulse": return wave(el, item, "opacity", 1, item.peak ?? 0.35);
      case "breathe": return wave(el, item, "scale", 1, item.peak ?? 1.03);
      case "spin": {
        const pose = poseOf(el), key = `lp${++ids}`, period = item.period ?? 12000, sign = item.direction === "ccw" ? -1 : 1;
        return loop(el, (t) => pose.set(key, { rotate: (sign * (t / period) * 360) % 360 }));
      }
      case "shimmer": {
        const period = item.period ?? 3000;
        el.style.backgroundSize = "250% 100%";
        return loop(el, (t) => (el.style.backgroundPosition = `${round(100 - ((t / period) % 1) * 200)}% 0`));
      }
      case "parallax": return item.on === "cursor" ? cursorParallax(el, item) : scrub(el, { ...item, scrub: { y: [(item.depth ?? 0.1) * 300, -(item.depth ?? 0.1) * 300] } });
      case "magnetic": return magnetic(el, item);
      case "tilt": return tilt(el, item);
      case "follow": return follow(el, item);
      case "horizontal": return horizontal(el, item);
      case "stack": return stack(el, item);
      case "velocity-skew": return velocitySkew(el, item);
      case "progress": return progressBar(el, item);
      case "load-progress": return loadProgress(el, item);
      case "counter": return counter(el, item);
      case "clock": return clock(el, item);
      case "cursor-readout": return readout(el, () => `${item.prefix ?? (item.axis ?? "x").toUpperCase()}${String(Math.round((item.axis ?? "x") === "x" ? pointer.x : pointer.y)).padStart(item.pad ?? 4, "0")}`);
      case "velocity-readout": return readout(el, () => `${item.prefix ?? "V"}${scroll.velocity < 0 ? "-" : "+"}${String(Math.min(9999, Math.abs(Math.round(scroll.velocity)))).padStart(item.pad ?? 4, "0")}`);
      case "section-readout": return readout(el, () => state.section.name || item.empty || "");
      case "journey": return journey(el, item);
      case "wheel": return wheel(el, item);
      case "tunnel": return tunnel(el, item);
      case "draw": return draw(el, item);
      case "pixelate": return pixelate(el, item);
      case "scramble": return scramble(el, item);
      case "sequence": return sequence(el, item);
      case "sound-toggle": return soundToggle(el);
      case "timing": return timing(el, item);
      default: return warn(`unknown effect ${item.effect}`);
    }
  }
  // A section's own pace: `map` says how far through it the scroll reads at
  // evenly spaced points of the real scroll, so what follows the scroll
  // (items and scenes alike) hangs, rushes or settles there, and the page
  // underneath moves as it always did. A paged site's flight to it runs the
  // same way, in `ms` when it's given.
  const paces = new Map();
  function timing(el, item) {
    if (reduced() || !Array.isArray(item.map) || item.map.length < 2) return;
    paces.set(el, item);
  }
  function paced(y) {
    for (const [el, item] of paces) {
      const box = boxOf(el.__pin ? el.__pin.wrap : el), span = Math.max(1, el.__pin ? box.height - vh() : box.height);
      if (y > box.top && y < box.top + span) return box.top + along(item.map, (y - box.top) / span) * span;
    }
    return y;
  }
  function wire(el) {
    if (el.__wired) return;
    el.__wired = true;
    let items;
    try {
      items = JSON.parse(el.dataset.motion);
    } catch {
      return warn("a layer's data-motion isn't JSON");
    }
    hooks.wired?.(el, items);
    // Pins first: they change the layout the rest measures.
    for (const item of items) if (item.pin && item.effect !== "horizontal") pin(el, item.pin);
    let entering = 0;
    for (const item of items) {
      try {
        if (item.effect) effect(el, item);
        else if (item.on === "appear" && item.animate !== undefined) {
          entering++;
          onAppear(el, item, entrance(el, item));
        } else if (item.on === "load" && item.animate !== undefined) {
          entering++;
          held.push(entrance(el, item));
        } else if (item.on === "scroll" && item.scrub) scrub(el, item);
        else if (item.on === "hover") reversible(el, item, "pointerenter", "pointerleave");
        else if (item.on === "press") reversible(el, { ...item, animate: item.animate ?? "press" }, "pointerdown", "pointerup");
        else if (item.sound) onAppear(el, item, { play: () => playSound(item, item.delay ?? 0), reset() {} });
      } catch (error) {
        warn("a motion item failed", error);
      }
    }
    // A scrub takes over a layer once its entrance has finished.
    if (entering && items.some((item) => item.scrub)) {
      el.__entering = true;
      el.addEventListener("motion:entered", () => (el.__entering = false), { once: true });
    }
    el.removeAttribute("data-hold");
  }

  // ---- sections -------------------------------------------------------------------------

  let sections = [];
  function collectSections() {
    sections = [...variant().querySelectorAll("[data-section]")];
    state.section.count = Math.max(1, sections.length);
  }
  const page = () => doc.querySelector("[data-page]:not([hidden])") ?? doc.body;
  const variant = () => {
    const p = page();
    return [...p.querySelectorAll(":scope > [data-variant]")].find((v) => v.offsetParent !== null || getComputedStyle(v).display !== "none") ?? p;
  };
  function trackSection() {
    const mid = scroll.y + vh() / 2;
    let index = 0;
    for (let i = 0; i < sections.length; i++) {
      const box = boxOf(sections[i].__pin ? sections[i].__pin.wrap : sections[i]);
      if (box.top <= mid) index = i;
    }
    const section = sections[index], s = state.section;
    if (section) {
      const box = boxOf(section.__pin ? section.__pin.wrap : section);
      s.progress = clamp((scroll.y + vh() - box.top) / (box.height + vh()), 0, 1);
      s.name = section.dataset.section;
    }
    if (index !== s.index) {
      s.index = index;
      Sound.chord(index);
      emit("section", s);
    }
  }

  // ---- scrolling ---------------------------------------------------------------------

  const flight = { active: false, t: 0, ms: 1400, fromY: 0, toY: 0, ease: EASES["in-out-cubic"] };
  let smoothing = null;
  // Wheel into an eased position, the page's own scroll underneath, so
  // sticky, anchors and the scrollbar stay as they are.
  // Whether something inside the page scrolls under this event's target.
  function innerScroller(target) {
    for (let n = target; n instanceof Element && n !== doc.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return true;
    }
    return false;
  }
  function smoothScroll() {
    if (reduced() || !fine()) return;
    const s = (smoothing = { target: scrollY, at: scrollY, on: false, own: false });
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey || innerScroller(e.target)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      s.target = clamp(s.target + dy, 0, scroll.max);
      s.on = true;
    }, { passive: false });
    // A scrollbar or a key moving the page takes it back from the easing.
    addEventListener("scroll", () => {
      if (s.on && Math.abs(scrollY - s.at) < 4) return;
      s.on = false;
      s.target = s.at = scrollY;
    }, { passive: true });
    frames.add(() => {
      if (!s.on) return;
      s.at = lerp(s.at, s.target, approach(110));
      if (Math.abs(s.target - s.at) < 0.4) {
        s.at = s.target;
        s.on = false;
      }
      scrollTo(0, s.at);
    });
  }
  function sectionTop(i) {
    const section = sections[clamp(i, 0, sections.length - 1)];
    return section ? boxOf(section.__pin ? section.__pin.wrap : section).top : 0;
  }
  // One gesture, one flight to the next section.
  function go(i) {
    if (!sections.length) return;
    const to = clamp(i, 0, sections.length - 1), p = state.page;
    if (reduced() || config.scroll !== "paged") return scrollTo(0, sectionTop(to));
    if (flight.active || to === p.to) return;
    const pace = paces.get(sections[to]), ease = easeOf(config.flight?.easing, "in-out-cubic");
    Object.assign(flight, { active: true, t: 0, fromY: scrollY, toY: sectionTop(to), ms: pace?.ms ?? config.flight?.duration ?? 1400, ease: pace ? (p) => ease(along(pace.map, p)) : ease });
    Object.assign(p, { from: p.to, to, t: 0, flying: true });
    emit("flight", p);
  }
  function stepFlight() {
    const p = state.page;
    if (!flight.active) return;
    flight.t += dt;
    p.t = clamp(flight.t / flight.ms, 0, 1);
    scrollTo(0, lerp(flight.fromY, flight.toY, flight.ease(p.t)));
    if (p.t >= 1) {
      flight.active = false;
      p.flying = false;
      p.index = p.to;
      emit("flight", p);
    }
  }
  function pagedScroll() {
    if (reduced()) return;
    root.classList.add("m-paged");
    const step = (sign) => go((flight.active ? state.page.to : state.page.index) + sign);
    let last = 0, lastSize = 0, lastAt = 0;
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey || innerScroller(e.target)) return;
      e.preventDefault();
      const size = Math.abs(e.deltaY), at = performance.now();
      const fresh = at - lastAt > 140 || size > lastSize * 1.6 + 8;
      lastAt = at;
      lastSize = size;
      if (flight.active || size < 4 || !fresh || at - last < 500) return;
      last = at;
      step(Math.sign(e.deltaY));
    }, { passive: false });
    let touchY = null;
    addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true });
    addEventListener("touchmove", (e) => {
      if (!innerScroller(e.target)) e.preventDefault();
    }, { passive: false });
    addEventListener("touchend", (e) => {
      if (touchY === null || innerScroller(e.target)) return;
      const dy = touchY - e.changedTouches[0].clientY;
      touchY = null;
      if (Math.abs(dy) > 36) step(Math.sign(dy));
    }, { passive: true });
    addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest("input, textarea, select"))) return;
      // Space belongs to what has focus.
      if (e.key === " " && e.target instanceof Element && e.target.closest("a, button, [role=button]")) return;
      if (["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        step(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(sections.length - 1);
      }
    });
  }
  // Links to a place on the page go through the same scroll.
  doc.addEventListener("click", (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[href^="#"]:not([href^="#/"]), [data-click^="scroll "]') : null;
    if (!link) return;
    const id = link.dataset.click?.split(/\s+/)[1] ?? decodeURIComponent(link.getAttribute("href").slice(1));
    const target = id && doc.getElementById(id);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const i = config.scroll === "paged" ? sections.findIndex((s) => s === target || s.contains(target)) : -1;
    if (i >= 0) go(i);
    else moveTo(boxOf(target.__pin ? target.__pin.wrap : target).top);
  }, true);
  function moveTo(y) {
    const goal = clamp(typeof y === "number" ? y : boxOf(y).top, 0, scroll.max);
    if (reduced()) return scrollTo(0, goal);
    if (smoothing) {
      smoothing.target = goal;
      smoothing.on = true;
    } else {
      const from = scrollY;
      run({ ms: 900, ease: EASES["in-out-cubic"], fn: (e) => scrollTo(0, lerp(from, goal, e)) });
    }
  }

  // ---- intro ---------------------------------------------------------------------------

  let introProgress = 0;
  const sessionSeen = () => {
    try {
      return sessionStorage.getItem("m-intro") === "1";
    } catch {
      return false;
    }
  };
  function waitingOn(max) {
    const settled = (p) => Promise.resolve(p).then(() => true, () => true);
    const limit = (p) => Promise.race([settled(p), new Promise((r) => setTimeout(r, max))]);
    const list = [limit(doc.fonts?.ready)];
    for (const img of doc.images) {
      if (img.closest("[hidden]") || img.loading === "lazy" || !img.getAttribute("src")) continue;
      list.push(limit(img.complete ? null : new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); })));
    }
    for (const video of doc.querySelectorAll("video")) list.push(limit(video.readyState >= 3 ? null : new Promise((r) => { video.addEventListener("canplay", r, { once: true }); video.addEventListener("error", r, { once: true }); })));
    for (const job of jobs) list.push(limit(job.promise));
    return list;
  }
  function intro(spec) {
    return new Promise((done) => {
      const kind = spec?.kind ?? "none";
      const frame = kind === "frame" ? doc.querySelector("[data-intro]") : null;
      const skip = () => {
        frame?.remove();
        doc.getElementById("m-curtain")?.remove();
        root.classList.remove("m-intro-on");
        introProgress = state.intro = 1;
        done();
      };
      if (kind === "none" || reduced() || (spec.once && !hooks.on && sessionSeen())) return skip();
      try {
        sessionStorage.setItem("m-intro", "1");
      } catch {}
      root.classList.add("m-intro-on");
      const min = spec.min ?? 1200, max = spec.max ?? 4000;
      const body = getComputedStyle(doc.body);
      const ground = spec.background ?? body.backgroundColor, ink = spec.color ?? body.color, accent = spec.accent ?? ink;
      let el = frame, num = null, line = null;
      if (frame) Object.assign(frame.style, { position: "fixed", inset: "0", zIndex: "9999", width: "100%", height: "100%" });
      else {
        el = doc.createElement("div");
        el.className = "m-intro";
        el.setAttribute("aria-hidden", "true");
        Object.assign(el.style, { position: "fixed", inset: "0", zIndex: "9999", background: ground, color: ink, display: "grid", placeItems: "center", overflow: "hidden" });
        if (kind === "counter") {
          num = doc.createElement("div");
          Object.assign(num.style, { font: `500 ${Math.round(Math.min(innerWidth * 0.14, 180))}px/1 ${body.fontFamily}`, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" });
          num.textContent = "000";
          el.append(num);
        }
        if (kind === "counter" || kind === "line") {
          line = doc.createElement("div");
          Object.assign(line.style, { position: "absolute", left: "0", right: "0", bottom: "0", height: "3px", background: accent, transformOrigin: "left center", transform: "scaleX(0)" });
          el.append(line);
        }
        if (spec.label) {
          const label = doc.createElement("div");
          Object.assign(label.style, { position: "absolute", left: "24px", bottom: "24px", font: `500 13px/1.4 ${body.fontFamily}`, opacity: ".7" });
          label.textContent = spec.label;
          el.append(label);
        }
        doc.body.append(el);
      }
      doc.getElementById("m-curtain")?.remove();
      const waits = waitingOn(max);
      let settled = 0, closing = false, began = false, t0 = 0;
      for (const p of waits) p.then(() => settled++);
      const finish = () => {
        if (closing) return;
        closing = true;
        frames.delete(step);
        const exit = spec.exit ?? (frame || kind === "fade" ? "fade" : "up");
        const pose = poseOf(el);
        const ms = spec.exitMs ?? 900;
        const leave = exit === "fade" ? (e) => pose.set("intro", { opacity: 1 - e }) : (e) => pose.set("intro", { yPercent: -100 * e });
        // The page's own entrances start under the leaving intro, so the
        // two hand over without a gap.
        run({ ms, delay: 60, ease: EASES["in-out-quart"], fn: leave, done: () => {
          if (hooks.on) hooks.introEnded?.(el);
          else el.remove();
          root.classList.remove("m-intro-on");
          emit("intro", 1);
        } });
        setTimeout(done, Math.round(ms * 0.45));
      };
      const step = () => {
        if (!began) {
          began = true;
          t0 = elapsed;
        }
        const t = elapsed - t0, real = waits.length ? settled / waits.length : 1;
        const p = Math.min(t / min, Math.max(real, t / max));
        introProgress = state.intro = Math.max(introProgress, clamp(p, 0, 1));
        if (num) num.textContent = String(Math.floor(introProgress * 100)).padStart(3, "0");
        if (line) line.style.transform = `scaleX(${round(introProgress)})`;
        if (introProgress >= 1) finish();
      };
      frames.add(step);
      // Whatever happens to the frames, the page opens.
      setTimeout(finish, max + 2500);
    });
  }

  // ---- pages ------------------------------------------------------------------------

  const transitionColor = () => config.transition?.color ?? (getComputedStyle(root).getPropertyValue("--transition-color").trim() || getComputedStyle(doc.body).color || "#111");
  function cover() {
    const o = doc.createElement("div");
    o.setAttribute("aria-hidden", "true");
    Object.assign(o.style, { position: "fixed", inset: "0", zIndex: "9998", pointerEvents: "none" });
    doc.body.append(o);
    return o;
  }
  const timed = (ms, ease, fn) => new Promise((done) => run({ ms, ease, fn, done }));
  const inOut = () => EASES["in-out-quart"];
  async function wipe(swap, ms, axis, sign, stay) {
    const o = cover();
    o.style.background = transitionColor();
    const pose = poseOf(o), prop = axis === "X" ? "xPercent" : "yPercent";
    await timed(ms / 2, inOut(), (e) => pose.set("t", { [prop]: sign * 100 * (1 - e) }));
    swap();
    await timed(ms / 2, inOut(), (e) => pose.set("t", { [prop]: (stay ? sign : -sign) * 100 * e }));
    o.remove();
  }
  const TRANSITIONS = {
    "wipe-up": (swap, ms) => wipe(swap, ms, "Y", 1),
    "wipe-down": (swap, ms) => wipe(swap, ms, "Y", -1),
    "wipe-left": (swap, ms) => wipe(swap, ms, "X", 1),
    "wipe-right": (swap, ms) => wipe(swap, ms, "X", -1),
    sheet: (swap, ms) => wipe(swap, ms, "Y", 1, true),
    async curtain(swap, ms) {
      const o = cover();
      const sides = ["left", "right"].map((side) => {
        const h = doc.createElement("div");
        Object.assign(h.style, { position: "absolute", top: "0", bottom: "0", width: "50.5%", [side]: "0", background: transitionColor() });
        o.append(h);
        return { pose: poseOf(h), sign: side === "left" ? -1 : 1 };
      });
      await timed(ms / 2, inOut(), (e) => { for (const s of sides) s.pose.set("t", { xPercent: s.sign * 100 * (1 - e) }); });
      swap();
      await timed(ms / 2, inOut(), (e) => { for (const s of sides) s.pose.set("t", { xPercent: s.sign * 100 * e }); });
      o.remove();
    },
    async iris(swap, ms, point) {
      const o = cover();
      o.style.background = transitionColor();
      const x = point?.x ?? innerWidth / 2, y = point?.y ?? innerHeight / 2, R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      await timed(ms / 2, EASES["in-quart"], (e) => (o.style.clipPath = `circle(${round(R * e, 1)}px at ${x}px ${y}px)`));
      swap();
      await timed(ms / 2, EASES["out-quart"], (e) => (o.style.clipPath = `circle(${round(R * (1 - e), 1)}px at ${innerWidth / 2}px ${innerHeight / 2}px)`));
      o.remove();
    },
    async pixel(swap, ms) {
      const o = cover(), cols = 24, rows = Math.max(6, Math.round((cols * innerHeight) / innerWidth));
      Object.assign(o.style, { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` });
      const cells = Array.from({ length: cols * rows }, (_, i) => {
        const c = doc.createElement("div");
        c.style.background = transitionColor();
        c.style.visibility = "hidden";
        o.append(c);
        return { c, at: ((i % cols) + (((i * 2654435761) >>> 0) % 300) / 100) / (cols + 3) };
      });
      await timed(ms / 2, EASES.linear, (e) => { for (const { c, at } of cells) c.style.visibility = e >= at ? "" : "hidden"; });
      swap();
      await timed(ms / 2, EASES.linear, (e) => { for (const { c, at } of cells) c.style.visibility = e >= at ? "hidden" : ""; });
      o.remove();
    },
    async dissolve(swap, ms) {
      const o = cover();
      o.style.background = transitionColor();
      await timed(ms / 2, EASES.linear, (e) => (o.style.opacity = String(e)));
      swap();
      await timed(ms / 2, EASES.linear, (e) => (o.style.opacity = String(1 - e)));
      o.remove();
    },
    // A sheet of colour rises with a melting edge.
    async liquid(swap, ms) {
      const o = cover(), id = `m-liquid-${++ids}`;
      o.insertAdjacentHTML("beforeend", `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`);
      const sheet = doc.createElement("div");
      Object.assign(sheet.style, { position: "absolute", left: "-12%", right: "-12%", top: "-16%", bottom: "-16%", background: transitionColor(), filter: `url(#${id})` });
      o.append(sheet);
      const disp = o.querySelector("feDisplacementMap"), pose = poseOf(sheet);
      await timed(ms / 2, inOut(), (e) => {
        pose.set("t", { yPercent: 118 * (1 - e) });
        disp.setAttribute("scale", String(round(Math.sin(e * Math.PI) * 220, 1)));
      });
      swap();
      await timed(ms / 2, inOut(), (e) => {
        pose.set("t", { yPercent: -118 * e });
        disp.setAttribute("scale", String(round(Math.sin(e * Math.PI) * 220, 1)));
      });
      o.remove();
    },
    async blur(swap, ms) {
      const p = page(), pose = poseOf(p);
      await timed(ms / 2, EASES["in-quad"], (e) => pose.set("t", { blur: 24 * e, opacity: 1 - e }));
      pose.clear("t");
      swap();
      const n = page(), next = poseOf(n);
      await timed(ms / 2, EASES["out-quad"], (e) => next.set("t", { blur: 24 * (1 - e), opacity: e }));
      next.clear("t");
    },
    async zoom(swap, ms) {
      const p = page(), pose = poseOf(p);
      await timed(ms / 2, EASES["in-cubic"], (e) => pose.set("t", { scale: 1 + 0.3 * e, opacity: 1 - e }));
      pose.clear("t");
      swap();
      const n = page(), next = poseOf(n);
      await timed(ms / 2, EASES["out-cubic"], (e) => next.set("t", { scale: 0.8 + 0.2 * e, opacity: e }));
      next.clear("t");
    },
    // Layers of one name morph, through the browser's view transition.
    async shared(swap) {
      if (!doc.startViewTransition) return swap();
      const tag = () => {
        const taken = new Set();
        for (const el of variant().querySelectorAll("[data-shared]")) {
          const name = `m-${el.dataset.shared}`;
          el.style.viewTransitionName = taken.has(name) ? "none" : name;
          taken.add(name);
        }
      };
      tag();
      await doc.startViewTransition(() => {
        swap();
        flushAll();
        tag();
      }).finished;
    },
  };
  let transitioning = false;
  const slugOfHash = () => {
    try {
      return location.hash.startsWith("#/") ? decodeURIComponent(location.hash.slice(2)) : "";
    } catch {
      return "";
    }
  };
  const pageBySlug = (slug) => doc.querySelector(`[data-page="${CSS.escape(slug || (config.pages?.[0]?.slug ?? ""))}"]`);
  let nextTransition = null;
  let queued = null;
  async function show(slug, transition, point) {
    const next = pageBySlug(slug), current = page();
    // Asked for while another is under way: it goes next.
    if (transitioning) {
      queued = { slug, transition, point };
      return;
    }
    if (!next || next === current) return;
    transitioning = true;
    const swap = () => {
      for (const p of doc.querySelectorAll("[data-page]")) p.hidden = p !== next;
      flight.active = false;
      Object.assign(state.page, { index: 0, from: 0, to: 0, t: 1, flying: false });
      scrollTo(0, 0);
      markPhone();
      refresh();
      emit("page", next.dataset.page);
      if (next.dataset.title) doc.title = next.dataset.title;
    };
    try {
      // An app's transitions, in a site: a wipe the same way.
      const [kind, dir] = String(transition?.animation).split("-");
      const fn = TRANSITIONS[transition?.animation] ?? (["move", "push", "slide"].includes(kind) ? TRANSITIONS[`wipe-${dir}`] : undefined);
      if (reduced() || !fn) swap();
      else await fn(swap, transition.ms ?? 900, point);
    } finally {
      transitioning = false;
      if (queued) {
        const then = queued;
        queued = null;
        show(then.slug, then.transition, then.point);
      }
    }
  }
  doc.addEventListener("click", (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[href^="#/"], [data-click^="show "]') : null;
    if (!link) return;
    const [animation = "dissolve", duration = "900ms"] = String(link.dataset.clickTransition ?? "").trim().split(/\s+/);
    nextTransition = { transition: { animation, ms: parseFloat(duration) || 900 }, point: { x: e.clientX, y: e.clientY } };
    if (link.hasAttribute("data-click")) {
      e.preventDefault();
      e.stopPropagation();
      location.hash = `#/${link.dataset.click.split(/\s+/)[1]}`;
    }
  }, true);
  addEventListener("hashchange", () => {
    const pick = nextTransition;
    nextTransition = null;
    if (location.hash === "" || location.hash.startsWith("#/")) show(slugOfHash(), pick?.transition, pick?.point);
  });

  // ---- the frame loop ------------------------------------------------------------------

  let elapsed = 0, dt = 16, last = performance.now(), lastY = scrollY, count = 0;
  const events = new Map();
  function on(name, fn) {
    if (!events.has(name)) events.set(name, new Set());
    events.get(name).add(fn);
    return () => events.get(name).delete(fn);
  }
  function emit(name, value) {
    for (const fn of events.get(name) ?? []) {
      try {
        fn(value);
      } catch (error) {
        warn(`a ${name} listener failed`, error);
      }
    }
  }
  function readScroll() {
    scroll.max = Math.max(1, root.scrollHeight - vh());
    scroll.y = paces.size && config.scroll !== "paged" ? paced(scrollY) : scrollY;
    scroll.progress = clamp(scroll.y / scroll.max, 0, 1);
    const raw = ((scroll.y - lastY) / dt) * 1000;
    scroll.raw = raw;
    scroll.velocity = lerp(scroll.velocity, raw, approach(110));
    lastY = scroll.y;
  }
  function flushAll() {
    for (const s of scrubs) s();
    flush();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (hooks.frame) return hooks.frame(now);
    dt = clamp(now - last, 1, 100);
    last = now;
    elapsed += dt;
    count++;
    // The display's own beat, read while nothing heavy is drawing.
    if (calmBeats.length < 12 && !scenes.some((s) => s.ready)) {
      calmBeats.push(dt);
      if (calmBeats.length >= 6) beat = clamp([...calmBeats].sort((a, b) => a - b)[calmBeats.length >> 1], 1000 / 60, 34);
    }
    state.time = elapsed / 1000;
    state.dt = dt / 1000;
    state.frame = count;
    pointer.vx *= 0.8;
    pointer.vy *= 0.8;
    stepFlight();
    readScroll();
    trackSection();
    checkAppear();
    stepRunning();
    for (const fn of scrubs) {
      try {
        fn();
      } catch (error) {
        warn("a scrub failed", error);
      }
    }
    for (const fn of frames) {
      try {
        fn();
      } catch (error) {
        warn("a frame callback failed", error);
      }
    }
    flush();
    if (!hooks.quiet) frameScenes();
  }

  function remeasure() {
    boxes.clear();
    measured.clear();
    measureUnit();
    setViewportVars();
    for (const scene of scenes) sizeScene(scene);
    for (const fn of resizers) {
      try {
        fn();
      } catch (error) {
        warn("a resize failed", error);
      }
    }
    for (const pose of knownPoses) {
      pose.rebase();
      dirty.add(pose);
    }
    boxes.clear();
    // A paged site stays on its screen.
    if (config.scroll === "paged" && !flight.active && !reduced()) scrollTo(0, sectionTop(state.page.index));
  }
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(remeasure, 120);
  });

  function refresh() {
    measureUnit();
    boxes.clear();
    const here = variant();
    for (const el of here.querySelectorAll("[data-motion]")) wire(el);
    for (const el of doc.querySelectorAll("[data-intro] [data-motion]")) wire(el);
    for (const canvas of here.querySelectorAll("canvas[data-scene]")) if (!canvas.__started) {
      canvas.__started = true;
      startScene(canvas);
    }
    collectSections();
    boxes.clear();
    if (!holding) for (const h of held.splice(0)) h.play();
  }
  // A page with no phone board stays its desktop self on a phone, so the
  // rem has to stay the desktop one there.
  function markPhone() {
    root.toggleAttribute("data-no-phone", !page().querySelector(":scope > [data-variant='phone']"));
    measureUnit();
  }
  // The phone or desktop layout changes which tree is on screen.
  for (const query of config.phoneWidth ? [matchMedia(`(max-width: ${config.breakpoint ?? 820}px)`)] : []) {
    state.phone = query.matches;
    query.addEventListener("change", () => location.reload());
  }

  // A site opens at its start, and its scroll is its own.
  try {
    history.scrollRestoration = "manual";
  } catch {}
  const ready = new Promise((resolve) => {
    const start = async () => {
      state.reduced = reduced();
      if (reduced()) root.classList.add("m-reduced");
      const route = slugOfHash();
      if (route && pageBySlug(route)) for (const p of doc.querySelectorAll("[data-page]")) p.hidden = p !== pageBySlug(route);
      markPhone();
      await Promise.race([doc.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);
      try {
        refresh();
      } catch (error) {
        warn("wiring failed", error);
      }
      window.Motion.wired = true;
      try {
        if (config.scroll === "smooth") smoothScroll();
        if (config.scroll === "snap") root.classList.add("m-snap");
        if (config.scroll === "paged") pagedScroll();
      } catch (error) {
        warn("the scroll failed", error);
      }
      flush();
      addEventListener("load", () => boxes.clear());
      requestAnimationFrame((now) => {
        last = now;
        frame(now);
      });
      try {
        await intro(config.intro);
      } catch (error) {
        warn("the intro failed", error);
      }
      holding = false;
      for (const h of held.splice(0)) h.play();
      root.classList.add("m-ready");
      emit("ready");
      resolve();
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  });

  window.Motion = {
    ready, state, on, go, show, sound: Sound, reduced, refresh, still: STILL,
    get unit() { return unit; },
    // The display's own pace, read before anything heavy draws.
    get beat() { return beat; },
    scrollTo: moveTo,
    navigate(slug, text) {
      const [animation = "dissolve", duration = "900ms"] = String(text ?? "").trim().split(/\s+/);
      nextTransition = { transition: { animation, ms: parseFloat(duration) || 900 } };
      location.hash = `#/${slug}`;
    },
    job: (label, promise) => jobs.push({ label, promise }),
    scenes: () => scenes.map((s) => ({ src: s.spec.src, ready: s.ready, failed: s.failed, drawn: Boolean(s.drawn), error: s.canvas.dataset.sceneError, share: s.share, width: s.w, height: s.h })),
    setMotion(value) {
      try {
        if (value === null) localStorage.removeItem("m-motion");
        else localStorage.setItem("m-motion", value ? "on" : "off");
      } catch {}
      location.reload();
    },
  };
  window.__knotStudio?.({
    hooks, config, state, scroll, flight, scrubs, frames, scenes, flush, frameScenes, readScroll, trackSection, poseOf, boxOf, progressOf, along, unit: () => unit, go, sectionTop, paces, paced, boxes, remeasure,
    sections: () => sections,
    clock(time, step) {
      elapsed = time;
      dt = step;
      state.time = time / 1000;
      state.dt = step / 1000;
    },
    intro(value) {
      introProgress = state.intro = value;
    },
  });
})(function motionPresets() {
  const d = (o, fallback) => (typeof o.distance === "number" ? o.distance : fallback);
  return {
    fade: () => ({ from: { opacity: 0 }, to: { opacity: 1 }, duration: 800 }),
    "fade-up": (o) => ({ from: { opacity: 0, y: d(o, 24) }, to: { opacity: 1, y: 0 }, duration: 800 }),
    "fade-down": (o) => ({ from: { opacity: 0, y: -d(o, 24) }, to: { opacity: 1, y: 0 }, duration: 800 }),
    "fade-left": (o) => ({ from: { opacity: 0, x: d(o, 24) }, to: { opacity: 1, x: 0 }, duration: 800 }),
    "fade-right": (o) => ({ from: { opacity: 0, x: -d(o, 24) }, to: { opacity: 1, x: 0 }, duration: 800 }),
    rise: (o) => ({ from: { opacity: 0, y: d(o, 56) }, to: { opacity: 1, y: 0 }, duration: 1000 }),
    drop: (o) => ({ from: { opacity: 0, y: -d(o, 56) }, to: { opacity: 1, y: 0 }, duration: 1000 }),
    // Lines rising out of their own masks.
    lines: () => ({ from: { yPercent: 110 }, to: { yPercent: 0 }, duration: 1100, easing: "out-expo", split: "lines", mask: true, stagger: 90 }),
    words: () => ({ from: { yPercent: 110 }, to: { yPercent: 0 }, duration: 900, easing: "out-expo", split: "words", mask: true, stagger: 40 }),
    chars: () => ({ from: { yPercent: 110 }, to: { yPercent: 0 }, duration: 800, easing: "out-expo", split: "chars", mask: true, stagger: 18 }),
    "blur-in": (o) => ({ from: { opacity: 0, blur: o.blur ?? 12, y: d(o, 0) }, to: { opacity: 1, blur: 0, y: 0 }, duration: 1400 }),
    "scale-in": (o) => ({ from: { opacity: o.fade === false ? 1 : 0, scale: o.start ?? 0.92 }, to: { opacity: 1, scale: 1 }, duration: 1200 }),
    "scale-out": (o) => ({ from: { opacity: o.fade === false ? 1 : 0, scale: o.start ?? 1.08 }, to: { opacity: 1, scale: 1 }, duration: 1200 }),
    "clip-up": () => ({ from: { clip: "inset(100% 0% 0% 0%)" }, to: { clip: "inset(0% 0% 0% 0%)" }, duration: 1100, easing: "in-out-quart" }),
    "clip-down": () => ({ from: { clip: "inset(0% 0% 100% 0%)" }, to: { clip: "inset(0% 0% 0% 0%)" }, duration: 1100, easing: "in-out-quart" }),
    "clip-left": () => ({ from: { clip: "inset(0% 0% 0% 100%)" }, to: { clip: "inset(0% 0% 0% 0%)" }, duration: 1100, easing: "in-out-quart" }),
    "clip-right": () => ({ from: { clip: "inset(0% 100% 0% 0%)" }, to: { clip: "inset(0% 0% 0% 0%)" }, duration: 1100, easing: "in-out-quart" }),
    // A picture opening and settling inside its frame at once.
    reveal: () => ({ from: { clip: "inset(100% 0% 0% 0%)", scale: 1.18 }, to: { clip: "inset(0% 0% 0% 0%)", scale: 1 }, duration: 1400, easing: "in-out-quart" }),
    iris: () => ({ from: { clip: "circle(0% at 50% 50%)" }, to: { clip: "circle(75% at 50% 50%)" }, duration: 1200, easing: "in-out-quart" }),
    flip: (o) => ({ from: { opacity: 0, rotateX: o.angle ?? -70 }, to: { opacity: 1, rotateX: 0 }, duration: 900 }),
    "slide-up": () => ({ from: { yPercent: 100 }, to: { yPercent: 0 }, duration: 900, easing: "in-out-quart" }),
    "slide-down": () => ({ from: { yPercent: -100 }, to: { yPercent: 0 }, duration: 900, easing: "in-out-quart" }),
    pop: (o) => ({ from: { opacity: 0, scale: o.start ?? 0.6 }, to: { opacity: 1, scale: 1 }, duration: 900, easing: "spring(220, 16)" }),
    typewriter: () => ({ from: { opacity: 0 }, to: { opacity: 1 }, duration: 1, split: "chars", stagger: 42, easing: "linear" }),
    // For hover and press: `from` is the layer as it is.
    lift: (o) => ({ from: {}, to: { y: -d(o, 3), scale: o.scale ?? 1.01 }, duration: 350, easing: "out-cubic" }),
    grow: (o) => ({ from: {}, to: { scale: o.scale ?? 1.04 }, duration: 350, easing: "out-cubic" }),
    press: (o) => ({ from: {}, to: { scale: o.scale ?? 0.97 }, duration: 160, easing: "out-cubic" }),
  };
});
