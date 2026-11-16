export default function ({ el, reduced }) {
  const q = (root, base) => {
    if (!root) return null;
    const re = new RegExp(`__${base}(-\\d+)?$`);
    for (const n of root.querySelectorAll(`[class*="__${base}"]`)) for (const c of n.classList) if (re.test(c)) return n;
    return null;
  };
  const byText = (root, text, up) => {
    if (!root) return null;
    for (const n of root.querySelectorAll("p,span,a,h1,h2,h3,button")) {
      if (n.children.length === 0 && n.textContent.trim() === text) return up ? n.closest(up) || n : n;
    }
    return null;
  };

  const reqRoot = el.querySelector(".requests") || el.querySelector('[data-instance-of="requests"]');
  const stage = reqRoot ? reqRoot.parentElement : el;
  const pick = (cls) => [...stage.children].find((c) => c.classList.contains(cls));
  const V = {
    req: pick("requests"),
    forms: pick("scheme-definition-forms"),
    details: pick("scheme-definition-details"),
    builder: pick("create-form"),
    preview: pick("form-preview-change-in-scope"),
    dpb: pick("create-detail-page"),
  };

  const missing = Object.entries(V).filter(([k, v]) => !v).map(([k]) => k);
  if (missing.length) console.warn("scheme-flow: views not found: " + missing.join(", "));
  const ease = "cubic-bezier(0.33, 0, 0.67, 1)";
  let cur = "req", z = 10, lastList = "forms";
  const hide = (v) => { if (!v) return; v.style.display = "none"; v.style.opacity = "0"; v.style.pointerEvents = "none"; };
  Object.entries(V).forEach(([k, v]) => { if (!v) return; if (k === cur) { v.style.display = ""; v.style.opacity = "1"; v.style.pointerEvents = "auto"; } else hide(v); });

  function go(name) {
    if (name === cur || !V[name]) return;
    const from = cur, a = V[from], b = V[name];
    if (from === "forms" || from === "details") lastList = from;
    b.style.display = ""; b.style.zIndex = String(++z); b.style.pointerEvents = "auto";
    const ms = name === "preview" || from === "preview" ? 220 : 180;
    if (reduced) { b.style.opacity = "1"; hide(a); }
    else {
      b.style.transition = "none"; b.style.opacity = "0";
      const dlg = name === "preview" ? q(b, "form-dialog") : null;
      if (dlg) { dlg.style.transition = "none"; dlg.style.transform = "translateY(8px) scale(0.985)"; }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        b.style.transition = `opacity ${ms}ms ${ease}`; b.style.opacity = "1";
        if (dlg) { dlg.style.transition = `transform ${ms}ms ${ease}`; dlg.style.transform = "none"; }
      }));
      setTimeout(() => { if (cur !== from) hide(a); }, ms + 40);
    }
    cur = name;
  }

  const on = (node, fn) => {
    if (!node) return;
    node.style.cursor = "pointer";
    node.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
  };
  const navItem = (view, label) => byText(q(view, "nav-items"), label, '[class*="nav-item"]');
  const tab = (view, label) => byText(q(view, "scheme-tabs"), label, '[data-instance-of="tab"], .tab');

  on(navItem(V.req, "Scheme definition"), () => go("forms"));
  for (const k of ["forms", "details"]) on(navItem(V[k], "Requests"), () => go("req"));
  on(navItem(V.details, "Scheme definition"), () => go("forms"));

  on(tab(V.forms, "Details"), () => go("details"));
  on(tab(V.details, "Forms"), () => go("forms"));

  V.forms && V.forms.querySelectorAll('[class*="__create-detail-page-link"]').forEach((a) => on(a, () => go("dpb")));

  on(byText(V.details, "Create new detail page", "button"), () => go("dpb"));
  on(byText(V.details, "Create detail page", "button"), () => go("dpb"));

  on(q(V.dpb, "back-button"), () => go(lastList));

  // Secondary sidebar: the collapse icon hides the subnav on every list view; an "Expand sidebar" link above the breadcrumb brings it back.
  const sideViews = ["req", "forms", "details"].map((k) => V[k]).filter(Boolean);
  const expandLinks = [];
  const setSide = (open) => sideViews.forEach((v, i) => {
    const tr = q(v, "subnav-title-row"), nav = tr ? tr.parentElement : q(v, "engagement-subnav"), main = nav ? nav.nextElementSibling : q(v, "main"), head = q(v, "page-heading");
    if (nav) nav.style.display = open ? "" : "none";
    if (main) { main.style.flex = open ? "" : "1 1 0"; main.style.width = open ? "" : "auto"; main.style.minWidth = "0"; }
    if (head) head.style.height = "auto";
    if (expandLinks[i]) expandLinks[i].style.display = open ? "none" : "inline-flex";
  });
  sideViews.forEach((v) => {
    const crumb = q(v, "breadcrumb");
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", "Expand sidebar");
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4ZM3 6a1 1 0 0 1 1-1h3v10H4a1 1 0 0 1-1-1V6Zm5 9V5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8Zm2.65-7.35a.5.5 0 0 0 0 .7L12.29 10l-1.64 1.65a.5.5 0 0 0 .7.7l2-2a.5.5 0 0 0 0-.7l-2-2a.5.5 0 0 0-.7 0Z"/></svg><span>Expand sidebar</span>';
    Object.assign(b.style, { display: "none", alignItems: "center", gap: "4px", height: "24px", padding: "0 6px", margin: "0 0 4px -6px", border: "none", borderRadius: "4px", background: "transparent", color: "#0F6CBD", font: "600 12px/16px 'Segoe UI', system-ui, sans-serif", cursor: "pointer", alignSelf: "flex-start" });
    b.addEventListener("mouseenter", () => (b.style.background = "#F5F5F5"));
    b.addEventListener("mouseleave", () => (b.style.background = "transparent"));
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); setSide(true); });
    if (crumb) crumb.parentElement.insertBefore(b, crumb);
    expandLinks.push(b);
    on(q(v, "collapse-icon"), () => setSide(false));
  });

  on(byText(V.builder, "Preview", "button"), () => go("preview"));
  on(q(V.preview, "dialog-header") && q(V.preview, "dialog-header").querySelector("button"), () => go("builder"));
  on(q(V.preview, "scrim"), () => go("builder"));

  on(byText(V.dpb, "Publish detail page", "button"), () => { publishDetail(); go("details"); });

  // ---------- Form builder: a form is built one piece at a time ----------
  // Create new form opens it empty; a form in the list opens with what it holds. Steps come from the steps panel,
  // groups and flat fields from the toolbar, fields from each card's Add field (pick a type, then name it).
  // Every name edits in place. Hover a field for its toolbar (drag, Half / Full, Required, rename, remove);
  // the ellipsis on a step or a group opens Rename, Duplicate, Move up, Move down and Delete.
  let fbDrawer = null; // the detail page's Add dynamic field drawer, shared with the form builder
  const FB = (() => {
    const B = V.builder;
    const tl = [...stage.children].find((c) => [...c.classList].some((k) => /builder-templates$/.test(k)));
    if (!B || !tl) { if (tl) tl.remove(); console.warn("scheme-flow: form builder or its templates not found"); return null; }
    const HOV = "var(--colorSubtleBackgroundHover, #f5f5f5)";
    const FOCUS = "var(--colorCompoundBrandStroke, #0f6cbd)";
    const BRAND = "var(--colorBrandStroke1, #0f6cbd)";
    const SEL = { bg: "var(--colorBrandBackground2, #ebf3fc)", fg: "var(--colorBrandForeground1, #0f6cbd)", w: "600" };
    const UNSEL = { bg: "transparent", fg: "var(--colorNeutralForeground2, #424242)", w: "400" };
    const pad = (n) => String(n).padStart(2, "0");
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

    // Templates, kept under the views
    const take = (base) => { const n = q(tl, base); return n ? n.cloneNode(true) : null; };
    const takeBtn = (t) => { const n = byText(tl, t, "button"); return n ? n.cloneNode(true) : null; };
    const TYPES = ["Text", "Long text", "Number", "Date", "Choice", "Yes or no", "Person", "File"];
    const fieldTpl = {};
    TYPES.forEach((t) => (fieldTpl[t] = take("field-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-"))));
    const reqTpl = take("required-mark");
    const typeMenu = take("field-type-menu"), itemMenu = take("item-menu");
    const emptyEl = take("empty-step-message"), emptySteps = take("empty-steps");
    const flatTag = take("flat-tag"), tb = take("form-field-toolbar");
    const groupOff = takeBtn("New group"), flatOn = takeBtn("New flat field"), pubOff = takeBtn("Publish form");
    tl.remove();

    // The builder's own parts
    const titleEl = q(B, "page-title");
    const metaEl = byText(B, "13 fields in 3 steps"), savedEl = byText(B, "Saved 16-11-2026, 10:42");
    const panel = q(B, "steps-panel"), stepper = q(B, "stepper");
    const countEl = q(panel, "step-count"), addStepBtn = q(panel, "add-step-button");
    const editor = q(B, "step-editor"), header = q(editor, "step-header"), content = q(editor, "step-content");
    const posEl = q(editor, "step-position"), stepTitle = q(editor, "step-title"), tagEl = q(editor, "step-type-tag");
    const stepMenuBtn = header && (header.querySelector('[data-instance-of="button-subtle-icon"]') || header.lastElementChild);
    const newGroupBtn = byText(B, "New group", "button"), flatOffBtn = byText(B, "New flat field", "button");
    const publishBtn = byText(B, "Publish form", "button"), previewBtn = byText(B, "Preview", "button");
    const ruleNote = q(B, "rule-note"), ruleText = q(B, "rule-note-text");
    const rowSel = q(stepper, "step-risk-impact"), rowPlain = q(stepper, "step-request-details");
    if (!titleEl || !stepper || !content || !rowSel || !rowPlain) { console.warn("scheme-flow: form builder parts not found"); return null; }
    const rowTpl = rowPlain.cloneNode(true);
    const renTpl = q(rowSel, "rename-step").cloneNode(true), menTpl = q(rowSel, "step-menu").cloneNode(true);
    const layersIco = q(rowSel, "content-type-icon").cloneNode(true), listIco = q(rowPlain, "content-type-icon").cloneNode(true);

    // Each toolbar action gets its disabled twin; the hint shows while there's nothing to publish
    if (groupOff && newGroupBtn) newGroupBtn.after(groupOff);
    if (flatOn && flatOffBtn) flatOffBtn.before(flatOn);
    if (pubOff && publishBtn) publishBtn.after(pubOff);
    [groupOff, flatOffBtn, pubOff].forEach((b) => { if (b) { b.style.cursor = "default"; b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }); } });
    let pubHint = null;
    if (ruleText && previewBtn) { pubHint = ruleText.cloneNode(true); pubHint.textContent = "Add a field to publish"; Object.assign(pubHint.style, { flex: "none", width: "auto" }); previewBtn.before(pubHint); }
    if (emptySteps && addStepBtn) addStepBtn.before(emptySteps);
    if (flatTag && tagEl) tagEl.after(flatTag);
    if (emptyEl) Object.assign(emptyEl.style, { height: "auto", flex: "1 1 auto", minHeight: "240px", alignSelf: "stretch", width: "auto" });
    content.style.paddingTop = "8px";

    // Helpers
    const scale = () => (B.getBoundingClientRect().width / B.offsetWidth) || 1;
    const rel = (r) => { const v = B.getBoundingClientRect(), s = scale(); return { l: (r.left - v.left) / s, t: (r.top - v.top) / s, r: (r.right - v.left) / s, b: (r.bottom - v.top) / s, w: r.width / s, h: r.height / s }; };
    const reveal = (n) => { const r = n.getBoundingClientRect(), c = content.getBoundingClientRect(), s = scale(); if (r.bottom > c.bottom) content.scrollTop += (r.bottom - c.bottom) / s + 12; else if (r.top < c.top) content.scrollTop -= (c.top - r.top) / s + 12; };
    const touch = () => { if (!savedEl) return; const d = new Date(); savedEl.textContent = `Saved 16-11-2026, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const changed = () => { touch(); refresh(); };
    const leaves = (root) => root ? [...root.querySelectorAll("p,span,h1,h2,h3")].filter((n) => n.children.length === 0 && n.textContent.trim() && n.textContent.trim() !== "*") : [];
    const focusAll = (n) => { if (!n) return; n.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(n); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
    // Always-editable text: hover shows a light box, click edits, Enter keeps, Escape puts it back
    const editable = (n, onInput) => {
      if (!n || n.__ed) return; n.__ed = true;
      n.contentEditable = "true"; n.spellcheck = false;
      Object.assign(n.style, { outline: "none", cursor: "text", borderRadius: "2px", whiteSpace: "nowrap", overflow: "visible", minWidth: "8px", width: "auto", maxWidth: "none", background: "transparent", boxShadow: "none" });
      if (!reduced) n.style.transition = `background-color 120ms ${ease}, box-shadow 120ms ${ease}`;
      let before = "";
      const idle = () => { n.style.background = "transparent"; n.style.boxShadow = "none"; };
      n.addEventListener("mouseenter", () => { if (document.activeElement !== n) n.style.background = HOV; });
      n.addEventListener("mouseleave", () => { if (document.activeElement !== n) idle(); });
      n.addEventListener("pointerdown", (e) => e.stopPropagation());
      n.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); });
      n.addEventListener("focus", () => { before = n.textContent; n.style.background = "transparent"; n.style.boxShadow = `inset 0 -2px 0 ${FOCUS}`; });
      n.addEventListener("input", () => onInput && onInput(n.textContent.trim()));
      n.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); n.blur(); }
        if (e.key === "Escape") { e.preventDefault(); n.textContent = before; onInput && onInput(before.trim()); n.blur(); }
        e.stopPropagation();
      });
      n.addEventListener("blur", () => {
        if (!n.textContent.trim()) { n.textContent = before; onInput && onInput(before.trim()); }
        idle(); if (n.textContent !== before) changed();
        window.getSelection().removeAllRanges();
      });
    };
    // Text that edits only when asked (a step's name in the list, so a click still selects the step)
    const inlineEdit = (n, onInput) => {
      if (!n) return;
      const before = n.textContent;
      n.contentEditable = "true"; n.spellcheck = false;
      Object.assign(n.style, { outline: "none", cursor: "text", borderRadius: "2px", boxShadow: `inset 0 -2px 0 ${FOCUS}` });
      const inp = () => onInput && onInput(n.textContent.trim());
      const key = (e) => { if (e.key === "Enter") { e.preventDefault(); n.blur(); } if (e.key === "Escape") { e.preventDefault(); n.textContent = before; inp(); n.blur(); } e.stopPropagation(); };
      const stop = (e) => e.stopPropagation();
      const done = () => {
        n.removeEventListener("input", inp); n.removeEventListener("keydown", key); n.removeEventListener("click", stop); n.removeEventListener("blur", done);
        n.contentEditable = "false"; n.style.boxShadow = "none"; n.style.cursor = "";
        if (!n.textContent.trim()) { n.textContent = before; inp(); }
        window.getSelection().removeAllRanges();
        changed();
      };
      n.addEventListener("input", inp); n.addEventListener("keydown", key); n.addEventListener("click", stop); n.addEventListener("blur", done);
      focusAll(n);
    };
    const pencil = (icon, target) => { if (!icon || !target) return; icon.style.cursor = "pointer"; icon.addEventListener("pointerdown", (e) => e.preventDefault()); icon.addEventListener("click", (e) => { e.stopPropagation(); focusAll(target); }); };
    const hoverBtn = (b) => { if (!b || b.__hb) return; b.__hb = true; b.addEventListener("mouseenter", () => (b.style.background = HOV)); b.addEventListener("mouseleave", () => (b.style.background = "transparent")); };

    // Fields sit in a two-column grid per card: each spans one column (Half) or both (Full)
    const isClass = (n, base) => [...n.classList].some((c) => new RegExp(`__${base}(-\\d+)?$`).test(c));
    const setSpan = (f, s) => { f.dataset.span = String(s); f.style.gridColumn = `span ${s}`; };
    const gridify = (fl) => { fl.dataset.fb = "fields"; Object.assign(fl.style, { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: "8px", rowGap: "0", alignItems: "start", alignSelf: "stretch", width: "auto" }); };
    const flatten = (fl) => {
      [...fl.children].forEach((k) => {
        if (isClass(k, "field-row")) { [...k.children].forEach((f) => { fl.insertBefore(f, k); f.dataset.fb = "field"; setSpan(f, 1); }); k.remove(); }
        else { k.dataset.fb = "field"; setSpan(k, 2); }
      });
      gridify(fl);
    };
    const isReq = (f) => !!q(f, "required-mark");
    const setReq = (f, on) => { const l = q(f, "label-text"), m = q(f, "required-mark"); if (on && !m && l && reqTpl) l.after(reqTpl.cloneNode(true)); if (!on && m) m.remove(); };
    const makeField = (type, label, o = {}) => {
      const f = fieldTpl[type] ? fieldTpl[type].cloneNode(true) : null; if (!f) return null;
      f.dataset.fb = "field"; setSpan(f, o.full || type === "Long text" ? 2 : 1);
      const l = q(f, "label-text"); if (l) l.textContent = label;
      const v = f.querySelector(".input__value"); if (v && o.ph) v.textContent = o.ph;
      if (o.req) setReq(f, true);
      return f;
    };

    // The form as it opens from the list: Risk impact's groups come from the board, the flat steps are made here
    const newPage = () => { const p = document.createElement("div"); p.style.display = "contents"; return p; };
    const groupsNow = [...content.children].filter((c) => q(c, "group-header"));
    groupsNow.forEach((g) => { g.dataset.fb = "group"; const fl = q(g, "fields"); if (fl) flatten(fl); });
    const groupTpl = groupsNow[0].cloneNode(true);
    q(groupTpl, "fields").innerHTML = "";
    q(groupTpl, "group-heading").textContent = "New group";
    const flatTpl = groupTpl.cloneNode(true);
    q(flatTpl, "group-header").remove();
    flatTpl.dataset.fb = "flat"; flatTpl.style.paddingTop = "12px";
    const flatCard = (list) => { const c = flatTpl.cloneNode(true); const fl = q(c, "fields"); list.forEach((f) => f && fl.appendChild(f)); return c; };
    const page = (...kids) => { const p = newPage(); kids.forEach((k) => p.appendChild(k)); return p; };
    const seed = {
      title: titleEl.textContent.trim(), implicit: false, sel: 1, saved: savedEl ? savedEl.textContent : "",
      steps: [
        { name: "Request details", page: page(flatCard([
          makeField("Choice", "Engagement", { ph: "Select an engagement", req: true }),
          makeField("Choice", "Change type", { ph: "Select a change type", req: true }),
          makeField("Date", "Effective from", { req: true }),
          makeField("Number", "Revised annual spend (USD)", { ph: "0.00" }),
          makeField("Date", "Contract end date"),
          makeField("Long text", "Description", { ph: "What changes and why" }),
        ])) },
        { name: "Risk impact", page: page(...groupsNow) },
        { name: "Documents", page: page(flatCard([
          makeField("File", "Revised statement of work", { req: true }),
          makeField("File", "Other documents"),
        ])) },
      ],
    };
    const blank = () => ({ title: "Untitled form", implicit: true, sel: 0, saved: "Not saved yet", steps: [{ name: "", page: newPage() }] });

    // State: the steps, each a row in the list and a page of cards; with no steps the form is one unnamed page
    let steps = [], cur = null, implicit = true, hot = null, drag = null;
    const nameOf = (s) => (s && s.row ? q(s.row, "step-name").textContent.trim() : "");
    const kindOf = (p) => (p.querySelector('[data-fb="group"]') ? "groups" : p.querySelector('[data-fb="field"]') ? "flat" : "empty");

    // Field toolbar: drag, Half / Full, Required, rename, remove
    const half = tb && q(tb, "half-option"), full = tb && q(tb, "full-option"), reqO = tb && q(tb, "required-option");
    const editO = tb && q(tb, "edit-field-button"), remO = tb && q(tb, "remove-field-button"), grip = tb && q(tb, "drag-handle-button");
    if (tb) Object.assign(tb.style, { position: "absolute", top: "-15px", right: "8px", left: "auto", bottom: "auto", zIndex: "5", cursor: "default" });
    const paint = (o, sel) => { if (!o) return; const st = sel ? SEL : UNSEL; o.style.background = st.bg; const l = q(o, "option-label") || o; l.style.color = st.fg; l.style.fontWeight = st.w; };
    const paintTb = () => { if (!hot) return; paint(half, hot.dataset.span === "1"); paint(full, hot.dataset.span === "2"); paint(reqO, isReq(hot)); };
    function hideTb() {
      if (hot) { hot.style.background = "transparent"; hot.style.boxShadow = "none"; }
      if (tb && tb.parentElement) tb.remove();
      hot = null;
    }
    const showTb = (f) => {
      if (hot && hot !== f) hideTb();
      hot = f; f.style.background = "var(--colorNeutralBackground2, #fafafa)"; f.style.boxShadow = "inset 0 0 0 1px var(--colorNeutralStroke1, #d1d1d1)";
      if (tb) { f.appendChild(tb); paintTb(); }
    };
    on(half, () => { if (hot) { setSpan(hot, 1); paintTb(); changed(); } });
    on(full, () => { if (hot) { setSpan(hot, 2); paintTb(); changed(); } });
    on(reqO, () => { if (hot) { setReq(hot, !isReq(hot)); paintTb(); changed(); } });
    if (editO) editO.addEventListener("pointerdown", (e) => e.preventDefault());
    on(editO, () => { if (hot) focusAll(q(hot, "label-text")); });
    on(remO, () => {
      if (!hot) return;
      const f = hot, card = f.closest('[data-fb="flat"]');
      hideTb(); f.remove();
      if (card && !card.querySelector('[data-fb="field"]')) card.remove();
      changed();
    });

    const wireField = (f) => {
      if (f.__fw) return; f.__fw = true;
      Object.assign(f.style, { position: "relative", minWidth: "0", width: "auto", flex: "none", boxSizing: "border-box", borderRadius: "4px", background: "transparent", boxShadow: "none", opacity: "" });
      if (!reduced) f.style.transition = `background-color 120ms ${ease}, box-shadow 120ms ${ease}`;
      setSpan(f, +f.dataset.span || 1);
      leaves(f).forEach((n) => editable(n));
      f.querySelectorAll('[data-instance-of="input"]').forEach((b) => {
        const v = b.querySelector(".input__value");
        if (v) { b.style.cursor = "text"; b.addEventListener("click", (e) => { if (e.target !== v) { e.stopPropagation(); focusAll(v); } }); }
      });
      f.addEventListener("mouseenter", () => { if (!drag) showTb(f); });
      f.addEventListener("mouseleave", () => { if (!drag && hot === f) hideTb(); });
    };

    // Groups: heading edits in place, chevron collapses, ellipsis opens the menu, the grip drags
    const setCollapsed = (g, on) => {
      g.dataset.collapsed = on ? "1" : "";
      [q(g, "fields"), q(g, "add-field-button")].forEach((n) => n && (n.style.display = on ? "none" : ""));
      const c = q(g, "collapse-group");
      if (c) { c.style.transition = reduced ? "" : `transform 180ms ${ease}`; c.style.transform = on ? "rotate(180deg)" : ""; }
    };
    const wireGroup = (g) => {
      if (g.__gw) return; g.__gw = true;
      g.style.opacity = "";
      editable(q(g, "group-heading"));
      const menu = q(g, "group-menu"); on(menu, () => openItemMenu(menu, groupActions(g)));
      on(q(g, "collapse-group"), () => setCollapsed(g, g.dataset.collapsed !== "1"));
      const add = q(g, "add-field-button"); hoverBtn(add); on(add, () => openTypeMenu(add, (t, l) => addField(q(g, "fields"), t, l)));
      const h = q(g, "drag-handle"); if (h) { h.style.cursor = "grab"; h.addEventListener("pointerdown", (e) => startDrag("group", g, e)); }
    };
    const wireCard = (c) => { if (c.__cw) return; c.__cw = true; const add = q(c, "add-field-button"); hoverBtn(add); on(add, () => openTypeMenu(add, (t, l) => addField(q(c, "fields"), t, l))); };
    const wirePage = (p) => { p.querySelectorAll('[data-fb="group"]').forEach(wireGroup); p.querySelectorAll('[data-fb="flat"]').forEach(wireCard); p.querySelectorAll('[data-fb="field"]').forEach(wireField); };

    // Adding
    const addField = (fl, type, label) => {
      if (!fl) return;
      const f = makeField(type, label || `${type} field`); if (!f) return;
      fl.appendChild(f); wireField(f);
      const g = fl.closest('[data-fb="group"]'); if (g && g.dataset.collapsed === "1") setCollapsed(g, false);
      changed();
      requestAnimationFrame(() => { reveal(f); if (!label) focusAll(q(f, "label-text")); });
    };
    const addGroup = () => {
      if (!cur || kindOf(cur.page) === "flat") return;
      closeMenu(); hideTb();
      const g = groupTpl.cloneNode(true); cur.page.appendChild(g); wireGroup(g); changed();
      requestAnimationFrame(() => { reveal(g); focusAll(q(g, "group-heading")); });
    };
    const addFlatField = (t, l) => {
      if (!cur || kindOf(cur.page) === "groups") return;
      let c = cur.page.querySelector('[data-fb="flat"]');
      if (!c) { c = flatTpl.cloneNode(true); cur.page.appendChild(c); wireCard(c); }
      addField(q(c, "fields"), t, l);
    };

    // Steps list
    const paintRows = () => steps.forEach((s) => {
      if (!s.row) return;
      const r = s.row, sel = s === cur;
      r.style.background = sel ? SEL.bg : r.__hover ? HOV : "transparent";
      const mk = q(r, "step-marker"), num = q(r, "step-number"), nm = q(r, "step-name");
      if (mk) { mk.style.background = sel ? "var(--colorBrandBackground, #0f6cbd)" : "var(--colorNeutralBackground1, #ffffff)"; mk.style.boxShadow = sel ? "none" : "inset 0 0 0 1px var(--colorNeutralStroke1, #d1d1d1)"; }
      if (num) num.style.color = sel ? "var(--colorNeutralForegroundOnBrand, #ffffff)" : "var(--colorNeutralForeground2, #424242)";
      if (nm) { nm.style.fontWeight = sel ? "600" : "400"; [...nm.parentElement.children].forEach((k) => { if (k !== nm) k.style.visibility = sel || r.__hover ? "visible" : "hidden"; }); }
    });
    const makeRow = (name, st) => {
      const r = rowTpl.cloneNode(true);
      const nm = q(r, "step-name"); nm.textContent = name;
      const ren = renTpl.cloneNode(true), men = menTpl.cloneNode(true);
      nm.parentElement.append(ren, men);
      [ren, men].forEach((i) => (i.style.flex = "none"));
      r.style.cursor = "pointer";
      if (!reduced) r.style.transition = `background-color 120ms ${ease}`;
      r.addEventListener("mouseenter", () => { r.__hover = true; paintRows(); });
      r.addEventListener("mouseleave", () => { r.__hover = false; paintRows(); });
      r.addEventListener("click", () => { if (nm.isContentEditable) return; const i = steps.indexOf(st); if (i >= 0 && st !== cur) select(i); });
      nm.addEventListener("dblclick", (e) => { e.stopPropagation(); renameRow(st); });
      ren.addEventListener("pointerdown", (e) => e.preventDefault());
      on(ren, () => renameRow(st));
      on(men, () => openItemMenu(men, stepActions(st)));
      return r;
    };
    const renameRow = (st) => { if (st && st.row) inlineEdit(q(st.row, "step-name"), (t) => { if (st === cur && stepTitle) stepTitle.textContent = t || "Untitled step"; }); };
    function select(i) {
      closeMenu(); hideTb();
      cur = steps[i];
      content.replaceChildren(cur.page, emptyEl || document.createElement("div"));
      content.scrollTop = 0;
      paintRows(); refresh();
    }
    function addStep() {
      closeMenu();
      if (implicit) {
        implicit = false;
        const first = steps[0];
        first.row = makeRow("Step 1", first); stepper.appendChild(first.row);
        if (!first.page.children.length) { select(0); changed(); renameRow(first); return; }
      }
      const s = { page: newPage(), row: null };
      s.row = makeRow(`Step ${steps.length + 1}`, s); stepper.appendChild(s.row); steps.push(s);
      select(steps.length - 1); changed(); renameRow(s);
    }
    const stepActions = (st) => {
      const i = steps.indexOf(st), n = steps.length;
      return [
        ["Rename", true, () => renameRow(st)],
        ["Duplicate", true, () => {
          hideTb();
          const c = { page: st.page.cloneNode(true), row: null };
          wirePage(c.page); c.row = makeRow(`${nameOf(st)} copy`, c);
          st.row.after(c.row); steps.splice(i + 1, 0, c); select(i + 1); changed();
        }],
        ["Move up", i > 0, () => { const p = steps[i - 1]; p.row.before(st.row); steps[i - 1] = st; steps[i] = p; changed(); }],
        ["Move down", i < n - 1, () => { const x = steps[i + 1]; x.row.after(st.row); steps[i + 1] = st; steps[i] = x; changed(); }],
        ["Delete", true, () => {
          const keep = st !== cur ? cur : null;
          st.row.remove(); steps.splice(i, 1);
          if (!steps.length) { implicit = true; steps.push({ page: newPage(), row: null }); }
          select(keep ? steps.indexOf(keep) : Math.min(i, steps.length - 1)); changed();
        }],
      ];
    };
    const groupActions = (g) => {
      const gs = [...g.parentElement.children].filter((c) => c.dataset.fb === "group"), i = gs.indexOf(g);
      return [
        ["Rename", true, () => focusAll(q(g, "group-heading"))],
        ["Duplicate", true, () => {
          hideTb();
          const c = g.cloneNode(true), h = q(c, "group-heading");
          if (h) h.textContent = `${h.textContent.trim()} copy`;
          g.after(c); wireGroup(c); c.querySelectorAll('[data-fb="field"]').forEach(wireField); changed();
        }],
        ["Move up", i > 0, () => { gs[i - 1].before(g); changed(); }],
        ["Move down", i < gs.length - 1, () => { gs[i + 1].after(g); changed(); }],
        ["Delete", true, () => { hideTb(); g.remove(); changed(); }],
      ];
    };

    // Menus: field types, and Rename / Duplicate / Move / Delete
    let openM = null, openFor = null;
    const menuItems = (m) => [...m.querySelectorAll('[class*="__menu-item-"]')];
    const itemLabel = (it) => ((q(it, "label") || {}).textContent || "").trim();
    [typeMenu, itemMenu].forEach((m) => {
      if (!m) return;
      Object.assign(m.style, { position: "absolute", display: "none", zIndex: "60", margin: "0" });
      B.appendChild(m);
      if (m === typeMenu) return;
      menuItems(m).forEach((it) => {
        it.style.cursor = "pointer";
        it.addEventListener("mouseenter", () => { if (!it.__off) it.style.background = HOV; });
        it.addEventListener("mouseleave", () => (it.style.background = "transparent"));
      });
      m.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const it = e.target.closest('[class*="__menu-item-"]'); if (!it || it.__off) return;
        const fn = m.__act && m.__act.get(itemLabel(it)); closeMenu(); if (fn) fn();
      });
    });
    function closeMenu() { if (!openM) return; openM.style.display = "none"; openM = null; openFor = null; }
    const openAt = (m, anchor, alignRight) => {
      openM = m; openFor = anchor;
      menuItems(m).forEach((it) => (it.style.background = "transparent"));
      m.style.display = "";
      const a = rel(anchor.getBoundingClientRect()), mw = m.offsetWidth, mh = m.offsetHeight, W = B.offsetWidth, H = B.offsetHeight;
      let left = alignRight ? a.r - mw : a.l, top = a.b + 4;
      const up = top + mh > H - 8; if (up) top = Math.max(8, a.t - 4 - mh);
      left = Math.max(8, Math.min(left, W - mw - 8));
      Object.assign(m.style, { left: left + "px", top: top + "px", right: "auto", bottom: "auto" });
      if (!reduced) {
        m.style.transition = "none"; m.style.opacity = "0"; m.style.transform = `translateY(${up ? 4 : -4}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { m.style.transition = `opacity 180ms ${ease}, transform 180ms ${ease}`; m.style.opacity = "1"; m.style.transform = "none"; }));
      }
    };
    const openItemMenu = (anchor, actions) => {
      if (!itemMenu || !anchor) return;
      if (openM === itemMenu && openFor === anchor) return closeMenu();
      closeMenu(); hideTb();
      const map = new Map(actions.map(([l, ok, fn]) => [l, ok ? fn : null]));
      menuItems(itemMenu).forEach((it) => { const ok = !!map.get(itemLabel(it)); it.__off = !ok; it.style.opacity = ok ? "" : "0.4"; it.style.cursor = ok ? "pointer" : "default"; });
      itemMenu.__act = map;
      openAt(itemMenu, anchor, true);
    };
    // Add field: the same System and Dynamic fields picker as the detail page; tick several, then add them
    const TMAP = { ID: "Text", Text: "Text", "Long text": "Long text", Number: "Number", Amount: "Number", Date: "Date", "Date and time": "Date", Choice: "Choice", "Multi-choice": "Choice", Status: "Choice", Lookup: "Choice", "Yes or no": "Yes or no", Person: "Person", File: "File" };
    const TM = (() => {
      if (!typeMenu) return null;
      const items = menuItems(typeMenu);
      const offI = q(typeMenu, "menu-item-request-id"), onI = q(typeMenu, "menu-item-requested-by"), adI = q(typeMenu, "menu-item-request-name");
      if (!offI || !onI || !adI || !q(adI, "added")) { console.warn("scheme-flow: add field menu parts not found"); return null; }
      const itemTpl = offI.cloneNode(true);
      const cb = { off: offI.firstElementChild.cloneNode(true), on: onI.firstElementChild.cloneNode(true), added: adI.firstElementChild.cloneNode(true) };
      const addedTxt = q(adI, "added").cloneNode(true), typeTxt = q(offI, "type").cloneNode(true);
      const labelColor = getComputedStyle(q(offI, "label")).color, addedColor = getComputedStyle(q(adI, "label")).color;
      const types = { "Request name": "Text", "Assessor": "Person", "Change type": "Choice", "Criticality after change": "Choice", "Description": "Long text", "Effective from": "Date", "Engagement": "Lookup", "Revised annual spend": "Amount", "Revised statement of work": "File", "Other documents": "File" };
      items.forEach((it) => { const t = q(it, "type"); if (t) types[itemLabel(it)] = t.textContent.trim(); });
      const st = new Map();
      const setSt = (it, s) => {
        st.set(it, s);
        it.firstElementChild.replaceWith(cb[s].cloneNode(true));
        const lab = q(it, "label"); if (lab) lab.style.color = s === "added" ? addedColor : labelColor;
        if (s === "added" && !q(it, "added")) it.lastElementChild.replaceWith(addedTxt.cloneNode(true));
        if (s !== "added" && q(it, "added")) { const t = typeTxt.cloneNode(true); t.textContent = types[itemLabel(it)] || ""; q(it, "added").replaceWith(t); }
        it.style.cursor = s === "added" ? "default" : "pointer";
      };
      const list = q(typeMenu, "input-list");
      if (list) { list.style.overflowY = "auto"; [...list.children].forEach((c) => (c.style.flexShrink = "0")); }
      typeMenu.querySelectorAll('[class*="__group-header"]').forEach((h) => { h.style.position = "sticky"; h.style.top = "0"; h.style.zIndex = "1"; });
      const footer = q(typeMenu, "menu-footer");
      const addLabel = byText(typeMenu, "Add 3 fields");
      const addBtn = (addLabel && addLabel.closest("button")) || (footer && footer.lastElementChild);
      const upd = () => {
        const n = items.filter((it) => st.get(it) === "on").length;
        if (addLabel) addLabel.textContent = n ? `Add ${plural(n, "field")}` : "Add fields";
        if (addBtn) { addBtn.style.opacity = n ? "" : "0.4"; addBtn.style.pointerEvents = n ? "" : "none"; }
      };
      const T = { items, st, setSt, upd, list, pick: null, anchor: null };
      const wireItem = (it) => {
        it.addEventListener("mouseenter", () => { if (st.get(it) !== "added") it.style.background = HOV; });
        it.addEventListener("mouseleave", () => (it.style.background = "transparent"));
        on(it, () => { const s = st.get(it); if (s === "added") return; setSt(it, s === "on" ? "off" : "on"); upd(); });
      };
      items.forEach(wireItem);
      on(addBtn, () => {
        const pick = T.pick, chosen = items.filter((it) => st.get(it) === "on");
        closeMenu();
        if (pick) chosen.forEach((it) => pick(TMAP[types[itemLabel(it)]] || "Text", itemLabel(it)));
      });
      let made = 0;
      const create = q(typeMenu, "add-custom-field-button");
      if (create) {
        create.addEventListener("mouseenter", () => (create.style.background = HOV));
        create.addEventListener("mouseleave", () => (create.style.background = "transparent"));
        on(create, () => {
          const a = T.anchor, p = T.pick; closeMenu();
          if (!fbDrawer) return;
          fbDrawer((name) => {
            const it = itemTpl.cloneNode(true);
            [...it.classList].forEach((k) => { if (/menu-item-request-id/.test(k)) { it.classList.remove(k); it.classList.add(k.replace("menu-item-request-id", "menu-item-fb-custom-" + (++made))); } });
            it.style.background = "transparent";
            const l = q(it, "label"); if (l) l.textContent = name;
            const ty = q(it, "type"); if (ty) ty.textContent = "Text";
            types[name] = "Text";
            (list || typeMenu).appendChild(it); it.style.flexShrink = "0"; items.push(it); wireItem(it);
            openTypeMenu(a, p);
            setSt(it, "on"); upd();
            if (list) list.scrollTop = list.scrollHeight;
          });
        });
      }
      return T;
    })();
    const openTypeMenu = (anchor, pick) => {
      if (!typeMenu || !TM || !anchor) return;
      if (openM === typeMenu && openFor === anchor) return closeMenu();
      closeMenu(); hideTb();
      const have = new Set();
      steps.forEach((s) => s.page && s.page.querySelectorAll('[data-fb="field"]').forEach((f) => { const l = q(f, "label-text"); if (l) have.add(l.textContent.trim()); }));
      TM.items.forEach((it) => TM.setSt(it, have.has(itemLabel(it)) ? "added" : "off"));
      TM.pick = pick; TM.anchor = anchor; TM.upd();
      if (TM.list) TM.list.scrollTop = 0;
      openAt(typeMenu, anchor, false);
    };
    document.addEventListener("pointerdown", (e) => { if (openM && !openM.contains(e.target) && !(openFor && openFor.contains(e.target))) closeMenu(); }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
    content.addEventListener("scroll", closeMenu);

    // Dragging: a field by its toolbar grip (onto another field, or into an empty group), a group by its handle
    const marker = document.createElement("div");
    Object.assign(marker.style, { position: "absolute", background: BRAND, borderRadius: "2px", pointerEvents: "none", zIndex: "70", display: "none" });
    B.appendChild(marker);
    const line = (x, y, w, h) => Object.assign(marker.style, { display: "", left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    function startDrag(kind, el, e) {
      e.preventDefault(); e.stopPropagation(); closeMenu(); hideTb();
      drag = { kind, el, target: null, after: false, box: null, folded: [] };
      if (kind === "group") [...el.parentElement.children].forEach((c) => { if (c.dataset.fb === "group" && c !== el && c.dataset.collapsed !== "1") { setCollapsed(c, true); drag.folded.push(c); } });
      el.style.opacity = "0.45"; document.body.style.cursor = "grabbing";
    }
    if (grip) { grip.style.cursor = "grab"; grip.addEventListener("pointerdown", (e) => { const f = hot; if (f) startDrag("field", f, e); }); }
    document.addEventListener("pointermove", (e) => {
      if (!drag) return;
      drag.target = null; drag.box = null; marker.style.display = "none";
      if (drag.kind === "field") {
        let n = document.elementFromPoint(e.clientX, e.clientY), t = null, box = null;
        while (n && n !== B) {
          if (!t && n.dataset && n.dataset.fb === "field") t = n;
          if (n.dataset && (n.dataset.fb === "group" || n.dataset.fb === "flat")) { box = n; break; }
          n = n.parentElement;
        }
        if (t && t !== drag.el) {
          const R = t.getBoundingClientRect(), r = rel(R), side = t.dataset.span === "1";
          drag.after = side ? e.clientX > R.left + R.width / 2 : e.clientY > R.top + R.height / 2; drag.target = t;
          if (side) line(drag.after ? r.r + 1 : r.l - 4, r.t, 3, r.h); else line(r.l, drag.after ? r.b - 1 : r.t - 2, r.w, 3);
        } else if (!t && box && box.dataset.fb === "group" && box.dataset.collapsed !== "1") {
          const fl = q(box, "fields");
          if (fl && ![...fl.children].some((c) => c !== drag.el && c.dataset.fb === "field")) { const r = rel(fl.getBoundingClientRect()); drag.box = fl; line(r.l + 8, r.t, r.w - 16, 3); }
        }
      } else {
        const list = [...drag.el.parentElement.children].filter((c) => c.dataset.fb === "group" && c !== drag.el);
        let best = null, bd = Infinity;
        list.forEach((c) => { const R = c.getBoundingClientRect(), d = Math.abs(e.clientY - (R.top + R.height / 2)); if (d < bd) { bd = d; best = c; } });
        if (best) { const R = best.getBoundingClientRect(), r = rel(R); drag.after = e.clientY > R.top + R.height / 2; drag.target = best; line(r.l, drag.after ? r.b + 4 : r.t - 7, r.w, 3); }
      }
    });
    document.addEventListener("pointerup", () => {
      if (!drag) return;
      const d = drag; drag = null;
      marker.style.display = "none"; document.body.style.cursor = ""; d.el.style.opacity = "";
      d.folded.forEach((c) => setCollapsed(c, false));
      if (d.target) (d.after ? d.target.after(d.el) : d.target.before(d.el));
      else if (d.box) d.box.appendChild(d.el);
      else return;
      changed();
    });

    // Everything that counts or depends on what's there
    const pair = (onEl, offEl, ok) => { if (onEl) onEl.style.display = ok ? "" : "none"; if (offEl) offEl.style.display = ok ? "none" : ""; };
    function refresh() {
      if (!cur) return;
      const n = steps.length;
      let total = 0;
      steps.forEach((s, i) => {
        const gs = s.page.querySelectorAll('[data-fb="group"]').length, fs = s.page.querySelectorAll('[data-fb="field"]').length;
        total += fs;
        if (!s.row) return;
        const num = q(s.row, "step-number"); if (num) num.textContent = String(i + 1);
        const sum = q(s.row, "content-summary"); if (sum) sum.textContent = gs ? `${plural(gs, "group")} · ${plural(fs, "field")}` : fs ? `Flat fields · ${fs}` : "Empty";
        const ic = q(s.row, "content-type-icon");
        if (ic) { const c = (gs ? layersIco : listIco).cloneNode(true); c.style.display = gs || fs ? "" : "none"; ic.replaceWith(c); }
        const con = q(s.row, "connector"); if (con) con.style.visibility = i < n - 1 ? "visible" : "hidden";
      });
      cur.page.querySelectorAll('[data-fb="group"]').forEach((g) => { const c = q(g, "field-count"); if (c) c.textContent = plural(g.querySelectorAll('[data-fb="field"]').length, "field"); });
      const kind = kindOf(cur.page), where = implicit ? "This form" : "This step";
      if (header) header.style.display = implicit ? "none" : "";
      if (!implicit) {
        if (posEl) posEl.textContent = `Step ${steps.indexOf(cur) + 1} of ${n}`;
        if (stepTitle && document.activeElement !== stepTitle) stepTitle.textContent = nameOf(cur);
      }
      if (tagEl) tagEl.style.display = kind === "groups" ? "" : "none";
      if (flatTag) flatTag.style.display = kind === "flat" ? "" : "none";
      if (countEl) { countEl.textContent = String(n); countEl.style.display = implicit ? "none" : ""; }
      if (emptySteps) emptySteps.style.display = implicit ? "" : "none";
      if (addStepBtn) addStepBtn.style.paddingLeft = implicit ? "8px" : "12px";
      pair(newGroupBtn, groupOff, kind !== "flat");
      pair(flatOn, flatOffBtn, kind !== "groups");
      if (ruleNote) ruleNote.style.display = kind === "empty" ? "none" : "";
      if (ruleText) ruleText.textContent = kind === "groups" ? `${where} has groups, so new fields go inside a group.` : `${where} has flat fields, so it can't hold groups.`;
      pair(publishBtn, pubOff, total > 0);
      if (pubHint) pubHint.style.display = total ? "none" : "";
      if (metaEl) metaEl.textContent = !total ? "No fields yet" : implicit ? plural(total, "field") : `${plural(total, "field")} in ${plural(n, "step")}`;
      if (emptyEl) {
        emptyEl.style.display = kind === "empty" ? "" : "none";
        const h = q(emptyEl, "empty-canvas-hint") || emptyEl.firstElementChild;
        if (h) h.textContent = implicit ? "Use New group or New flat field in the toolbar\nto add the first field." : `${nameOf(cur) || "This step"} has no fields yet. Use New group or\nNew flat field in the toolbar to add its first field.`;
      }
    }

    function load(doc) {
      closeMenu(); hideTb();
      stepper.innerHTML = ""; steps = []; implicit = !!doc.implicit;
      titleEl.textContent = doc.title;
      if (savedEl) savedEl.textContent = doc.saved || "Not saved yet";
      doc.steps.forEach((s) => {
        const st = { page: s.page.cloneNode(true), row: null };
        wirePage(st.page);
        if (!implicit) { st.row = makeRow(s.name, st); stepper.appendChild(st.row); }
        steps.push(st);
      });
      if (!steps.length) { implicit = true; steps.push({ page: newPage(), row: null }); }
      select(Math.max(0, Math.min(doc.sel || 0, steps.length - 1)));
    }
    const snapshot = () => {
      closeMenu(); hideTb();
      return { title: titleEl.textContent.trim(), implicit, sel: Math.max(0, steps.indexOf(cur)), saved: savedEl ? savedEl.textContent : "", steps: steps.map((s) => ({ name: nameOf(s), page: s.page.cloneNode(true) })) };
    };
    const total = () => steps.reduce((k, s) => k + s.page.querySelectorAll('[data-fb="field"]').length, 0);

    // Wiring
    editable(titleEl); pencil(q(B, "rename-icon"), titleEl);
    editable(stepTitle, (t) => { if (cur && cur.row) q(cur.row, "step-name").textContent = t || "Untitled step"; });
    pencil(q(header, "rename-step"), stepTitle);
    on(stepMenuBtn, () => { if (cur && cur.row) openItemMenu(stepMenuBtn, stepActions(cur)); });
    on(newGroupBtn, addGroup);
    on(flatOn, () => openTypeMenu(flatOn, addFlatField));
    hoverBtn(addStepBtn); on(addStepBtn, addStep);
    load(seed);

    return { seed, blank, load, snapshot, total, publishBtn, backBtn: q(B, "back-button"), focusTitle: () => focusAll(titleEl) };
  })();

  // Forms open in the builder: a row with what it holds, Create new form empty. Back keeps a draft, Publish publishes.
  const docs = new Map();
  let editing = null, madeForms = 0;
  const formRow0 = q(V.forms, "row-change-in-scope");
  const formRowTpl = formRow0 ? formRow0.cloneNode(true) : null;
  const openForm = (row) => { if (!FB || !docs.get(row)) return; editing = row; FB.load(docs.get(row)); go("builder"); };
  const wireFormRow = (row) => on(q(row, "form-name"), () => openForm(row));
  if (FB && formRow0) { docs.set(formRow0, FB.seed); wireFormRow(formRow0); }
  on(byText(V.forms, "Create new form", "button"), () => { if (!FB) return; editing = null; FB.load(FB.blank()); go("builder"); setTimeout(FB.focusTitle, reduced ? 0 : 240); });
  const bumpForms = () => {
    for (const k of ["forms", "details"]) {
      const t = tab(V[k], "Forms"), c = t && t.querySelector(".counter-badge__count, [class*='counter-badge__count']");
      if (c) { const n = parseInt(c.textContent, 10); if (!isNaN(n)) c.textContent = String(n + 1); }
    }
  };
  function keepForm(publish) {
    if (!FB) return;
    const snap = FB.snapshot();
    if (!editing) {
      if (!publish && !FB.total() && snap.title === "Untitled form") return;
      const hr = q(V.forms, "header-row");
      if (!formRowTpl || !hr) return;
      const r = formRowTpl.cloneNode(true);
      r.dataset.newForm = String(++madeForms);
      hr.after(r); wireFormRow(r); editing = r; bumpForms();
    }
    docs.set(editing, snap);
    const nm = q(editing, "form-name"); if (nm) nm.textContent = snap.title;
    if (publish) publishForm(editing);
  }
  if (FB) {
    on(FB.backBtn, () => { keepForm(false); go("forms"); });
    on(FB.publishBtn, () => { keepForm(true); go("forms"); });
  }

  let detailPublished = false;
  function publishForm(row) {
    if (!row || !V.forms) return;
    const draft = row.querySelector('.badge-draft, [data-instance-of="badge-draft"]');
    const pub = V.forms.querySelector('.badge-published, [data-instance-of="badge-published"]');
    if (draft && pub) draft.replaceWith(pub.cloneNode(true));
  }
  function publishDetail() {
    if (detailPublished) return;
    detailPublished = true;
    const row = formRow0;
    const link = q(row, "create-detail-page-link");
    const src = q(V.forms, "detail-page-link");
    if (link && src) {
      const cell = link.parentElement;
      cell.innerHTML = src.parentElement.innerHTML;
      const a = cell.querySelector("a") || q(cell, "detail-page-link");
      if (a) { a.textContent = "4 sections"; a.style.cursor = "pointer"; a.addEventListener("click", (e) => { e.preventDefault(); go("dpb"); }); }
    }
    for (const k of ["forms", "details"]) {
      const t = tab(V[k], "Details");
      const c = t && t.querySelector(".counter-badge__count, [class*='counter-badge__count']");
      if (c) c.textContent = "4";
    }
    const tpl = q(V.details, "row-onboard-a-new-engagement"), hr = q(V.details, "header-row");
    if (tpl && hr) {
      const r = tpl.cloneNode(true);
      const set = (base, txt) => { const n = q(r, base); if (n) n.textContent = txt; };
      set("form-name", "Change in scope");
      set("sections", "Request details, Risk impact, Documents");
      set("more-sections", "+1");
      set("last-modified", "16-11-2026");
      set("person-name", "Dinesh K");
      const ini = r.querySelector(".avatar-initials__initials, [class*='avatar-initials__initials']"); if (ini) ini.textContent = "DK";
      hr.after(r);
    }
  }

  // ---------- Detail page builder: card titles rename in place (pencil or click) ----------
  if (V.dpb) {
    V.dpb.querySelectorAll('[class*="__card-title"]').forEach((n) => {
      if (n.__ren) return; n.__ren = true;
      const HOV = "var(--colorSubtleBackgroundHover, #f5f5f5)", FOCUS = "var(--colorCompoundBrandStroke, #0f6cbd)";
      n.contentEditable = "true"; n.spellcheck = false;
      Object.assign(n.style, { outline: "none", cursor: "text", borderRadius: "2px", whiteSpace: "nowrap", width: "auto", maxWidth: "none", minWidth: "8px" });
      let before = "";
      const idle = () => { n.style.background = "transparent"; n.style.boxShadow = "none"; };
      n.addEventListener("mouseenter", () => { if (document.activeElement !== n) n.style.background = HOV; });
      n.addEventListener("mouseleave", () => { if (document.activeElement !== n) idle(); });
      n.addEventListener("pointerdown", (e) => e.stopPropagation());
      n.addEventListener("click", (e) => e.stopPropagation());
      n.addEventListener("focus", () => { before = n.textContent; n.style.background = "transparent"; n.style.boxShadow = `inset 0 -2px 0 ${FOCUS}`; });
      n.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); n.blur(); } if (e.key === "Escape") { e.preventDefault(); n.textContent = before; n.blur(); } e.stopPropagation(); });
      n.addEventListener("blur", () => { if (!n.textContent.trim()) n.textContent = before; idle(); window.getSelection().removeAllRanges(); });
      const pen = n.parentElement && n.parentElement.querySelector('[class*="__rename-card"]');
      if (pen) {
        pen.style.cursor = "pointer";
        pen.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); });
        pen.addEventListener("click", (e) => { e.stopPropagation(); n.focus(); const r = document.createRange(); r.selectNodeContents(n); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); });
      }
    });
  }

  // ---------- Detail page builder ----------
  // Fields sit in a two-column grid per card: each spans one column (Half) or both (Full).
  // Hover shows the field toolbar (drag, Half / Full, remove); drag a field to drop it before or after another.
  // Add field opens a multi-select menu: tick inputs, then Add N fields.
  if (V.dpb) {
    const D = V.dpb;
    const css = (n) => getComputedStyle(n);

    // Values and the request heading show as Fluent's skeleton shimmer (stencil 1 -> 2 -> 1, 3 s, linear).
    if (!document.getElementById("dpb-shimmer-style")) {
      const st = document.createElement("style"); st.id = "dpb-shimmer-style";
      st.textContent = "@keyframes dpbShimmer { from { background-position-x: 300%; } to { background-position-x: 0%; } }";
      document.head.appendChild(st);
    }
    const S1 = "var(--colorNeutralStencil1, #e6e6e6)", S2 = "var(--colorNeutralStencil2, #fafafa)";
    const shimmers = () => D.querySelectorAll('[class*="__shimmer"]');
    const shimmerOn = () => {
      const all = shimmers();
      all.forEach((n) => Object.assign(n.style, { backgroundImage: `linear-gradient(to right, ${S1} 0%, ${S2} 50%, ${S1} 100%)`, backgroundSize: "300% 100%", animation: "none" }));
      void D.offsetWidth;
      if (!reduced) all.forEach((n) => (n.style.animation = "dpbShimmer 3s linear infinite"));
    };
    shimmerOn();
    const HOVER_BG = "var(--colorNeutralBackground2, #fafafa)";
    const HOVER_LINE = "var(--colorNeutralStroke1, #d1d1d1)";
    const ITEM_HOVER = "var(--colorNeutralBackground3, #f5f5f5)";
    const BRAND = "var(--colorBrandStroke1, #0f6cbd)";

    // Toolbar template, taken from the hovered field on the board
    const hov = q(D, "value-change-type");
    const tb = hov ? q(hov, "field-toolbar") : null;
    const half = tb && q(tb, "half-option"), full = tb && q(tb, "full-option");
    const grip = tb && q(tb, "drag-handle-button"), rem = tb && q(tb, "remove-field-button");
    const optStyle = (o) => { const l = q(o, "option-label") || o; return { bg: css(o).backgroundColor, color: css(l).color, weight: css(l).fontWeight }; };
    const SEL = half ? optStyle(half) : null, UNSEL = full ? optStyle(full) : null;
    if (hov) { hov.style.background = "transparent"; hov.style.boxShadow = "none"; hov.style.outline = "none"; }
    if (tb) { tb.remove(); Object.assign(tb.style, { position: "absolute", top: "-15px", right: "8px", left: "auto", bottom: "auto", zIndex: "5", display: "none", cursor: "default" }); }
    if (grip) grip.style.cursor = "grab";

    const isFieldEl = (n) => [...n.classList].some((c) => /__value-(?!row)[a-z][a-z0-9-]*$/.test(c));
    const isRow = (n) => [...n.classList].some((c) => /__value-row(-\d+)?$/.test(c));
    const fieldTpl = q(D, "value-request-name") ? q(D, "value-request-name").cloneNode(true) : null;
    const setSpan = (f, s) => { f.dataset.span = String(s); f.style.gridColumn = `span ${s}`; };
    const prep = (f, s) => {
      Object.assign(f.style, { width: "auto", minWidth: "0", flex: "none", position: "relative", boxSizing: "border-box", cursor: "grab", userSelect: "none", background: "transparent", boxShadow: `inset 0 0 0 1px transparent`, borderRadius: "4px" });
      if (!reduced) f.style.transition = `background-color 120ms ${ease}, box-shadow 120ms ${ease}, opacity 120ms ${ease}`;
      setSpan(f, s);
      f.__field = true;
    };
    const valuesEls = [...D.querySelectorAll('[class*="__values"]')].filter((v) => [...v.classList].some((c) => /__values(-\d+)?$/.test(c)));
    valuesEls.forEach((v) => {
      [...v.children].forEach((k) => {
        if (isRow(k)) { [...k.children].forEach((f) => { if (isFieldEl(f)) { v.insertBefore(f, k); prep(f, 1); } }); k.remove(); }
        else if (isFieldEl(k)) prep(k, 2);
      });
      Object.assign(v.style, { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: "8px", rowGap: "4px", alignItems: "start" });
    });

    let hot = null, dragging = null, target = null, after = false;
    const paintOpt = (o, sel) => {
      const st = sel ? SEL : UNSEL; if (!st) return;
      o.style.background = st.bg; const l = q(o, "option-label") || o; l.style.color = st.color; l.style.fontWeight = st.weight;
    };
    const paintToolbar = () => { if (!hot || !half) return; paintOpt(half, hot.dataset.span === "1"); paintOpt(full, hot.dataset.span === "2"); };
    const clearHover = (f) => {
      f.style.background = "transparent"; f.style.boxShadow = "inset 0 0 0 1px transparent";
      if (tb && tb.parentElement === f) tb.style.display = "none";
      if (hot === f) hot = null;
    };
    const showHover = (f) => {
      if (hot && hot !== f) clearHover(hot);
      hot = f; f.style.background = HOVER_BG; f.style.boxShadow = `inset 0 0 0 1px ${HOVER_LINE}`;
      if (tb) { f.appendChild(tb); tb.style.display = ""; paintToolbar(); }
    };

    const marker = document.createElement("div");
    Object.assign(marker.style, { position: "absolute", background: BRAND, borderRadius: "2px", pointerEvents: "none", zIndex: "60", display: "none" });
    D.appendChild(marker);
    const scale = () => (D.getBoundingClientRect().width / D.offsetWidth) || 1;
    const fieldAt = (x, y) => { let n = document.elementFromPoint(x, y); while (n && n !== D) { if (n.__field) return n; n = n.parentElement; } return null; };

    const wire = (f) => {
      if (f.__wired) return; f.__wired = true;
      f.addEventListener("mouseenter", () => { if (!dragging) showHover(f); });
      f.addEventListener("mouseleave", () => { if (!dragging) clearHover(f); });
      f.addEventListener("pointerdown", (e) => {
        if (tb && tb.contains(e.target) && !(grip && grip.contains(e.target))) return;
        e.preventDefault();
        dragging = f; f.style.opacity = "0.45"; if (tb) tb.style.display = "none";
        document.body.style.cursor = "grabbing";
      });
    };
    D.querySelectorAll("*").forEach((n) => { if (n.__field) wire(n); });

    document.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const t = fieldAt(e.clientX, e.clientY);
      if (!t || t === dragging) { target = null; marker.style.display = "none"; return; }
      const r = t.getBoundingClientRect(), d = D.getBoundingClientRect(), s = scale();
      const side = t.dataset.span === "1";
      after = side ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      target = t;
      if (side) Object.assign(marker.style, { display: "", width: "3px", height: r.height / s + "px", left: ((after ? r.right + 2 : r.left - 5) - d.left) / s + "px", top: (r.top - d.top) / s + "px" });
      else Object.assign(marker.style, { display: "", height: "3px", width: r.width / s + "px", left: (r.left - d.left) / s + "px", top: ((after ? r.bottom + 1 : r.top - 4) - d.top) / s + "px" });
    });
    document.addEventListener("pointerup", () => {
      if (!dragging) return;
      const f = dragging; dragging = null;
      marker.style.display = "none"; document.body.style.cursor = ""; f.style.opacity = "";
      if (target) (after ? target.after(f) : target.before(f));
      target = null; clearHover(f);
    });

    // Cards (groups) drag by their header: every card collapses to its header while dragging, and all expand again on release.
    const cards = () => [...D.querySelectorAll('[class*="__detail-card-"]')].filter((c) => [...c.classList].some((k) => /__detail-card-[a-z0-9-]+$/.test(k)) && q(c, "card-header") && q(c, "card-header").parentElement === c);
    let cardDrag = null, cardTarget = null, cardAfter = false;
    const setCollapsed = (on) => cards().forEach((c) => {
      [...c.children].forEach((k) => { if (!/__card-header/.test(k.className)) if (on) { if (k.__disp === undefined) k.__disp = k.style.display; k.style.display = "none"; } else if (k.__disp !== undefined) { k.style.display = k.__disp; delete k.__disp; } });
    });
    cards().forEach((c) => {
      const h = q(c, "card-header"); if (!h) return;
      h.style.cursor = "grab"; h.style.userSelect = "none";
      h.addEventListener("pointerdown", (e) => {
        if (e.target.closest && e.target.closest('[class*="__edit-icon"]')) return;
        e.preventDefault();
        if (fieldMenu) fieldMenu.style.display = "none";
        cardDrag = c; setCollapsed(true);
        c.style.opacity = "0.45"; document.body.style.cursor = "grabbing";
      });
    });
    document.addEventListener("pointermove", (e) => {
      if (!cardDrag) return;
      const list = cards().filter((c) => c !== cardDrag);
      let best = null, bd = Infinity;
      list.forEach((c) => { const r = c.getBoundingClientRect(), m = r.top + r.height / 2, dd = Math.abs(e.clientY - m); if (dd < bd) { bd = dd; best = c; } });
      if (!best) { cardTarget = null; marker.style.display = "none"; return; }
      const r = best.getBoundingClientRect(), d = D.getBoundingClientRect(), s = scale();
      cardAfter = e.clientY > r.top + r.height / 2; cardTarget = best;
      Object.assign(marker.style, { display: "", height: "3px", width: r.width / s + "px", left: (r.left - d.left) / s + "px", top: ((cardAfter ? r.bottom + 4 : r.top - 7) - d.top) / s + "px" });
    });
    document.addEventListener("pointerup", () => {
      if (!cardDrag) return;
      const c = cardDrag; cardDrag = null;
      marker.style.display = "none"; document.body.style.cursor = ""; c.style.opacity = "";
      if (cardTarget) (cardAfter ? cardTarget.after(c) : cardTarget.before(c));
      cardTarget = null; setCollapsed(false);
    });

    let total = 11;
    const slugOf = (card) => { if (!card) return null; for (const c of card.classList) { const m = c.match(/__detail-card-([a-z0-9-]+?)(-\d+)?$/); if (m) return m[1]; } return null; };
    const bump = (card, d) => {
      const slug = slugOf(card), row = slug && q(D, "section-row-" + slug), c = row && q(row, "field-count");
      if (c) { const n = parseInt(c.textContent, 10); if (!isNaN(n)) c.textContent = `${n + d} field${n + d === 1 ? "" : "s"}`; }
      total += d;
      const s = q(D, "field-summary"); if (s) s.textContent = `${total} fields in 4 sections`;
    };
    let onRemoved = () => {};
    if (tb) {
      on(half, () => { if (hot) { setSpan(hot, 1); paintToolbar(); } });
      on(full, () => { if (hot) { setSpan(hot, 2); paintToolbar(); } });
      on(rem, () => {
        if (!hot) return;
        const f = hot, card = f.closest('[class*="__detail-card-"]'), label = (q(f, "label") || {}).textContent || "";
        clearHover(f); f.remove(); bump(card, -1); onRemoved(label.trim());
      });
      on(grip, () => {});
    }

    // Add field menu
    const fieldMenu = q(D, "add-field-menu");
    if (fieldMenu) {
      const addBtns = [...D.querySelectorAll('[class*="__add-field-button"]')].filter((n) => !fieldMenu.contains(n));
      const list = q(fieldMenu, "input-list");
      const items = [...fieldMenu.querySelectorAll('[class*="__menu-item-"]')];
      const openBg = addBtns[0] ? css(addBtns[0]).backgroundColor : ITEM_HOVER;
      addBtns.forEach((b) => (b.style.background = "transparent"));
      const offItem = q(fieldMenu, "menu-item-request-id"), selItem = q(fieldMenu, "menu-item-requested-by"), addedItem = q(fieldMenu, "menu-item-request-name");
      const cbOff = offItem.firstElementChild.cloneNode(true), cbOn = selItem.firstElementChild.cloneNode(true), cbAdded = addedItem.firstElementChild.cloneNode(true);
      const addedTxt = q(addedItem, "added").cloneNode(true), typeTxt = q(offItem, "type").cloneNode(true);
      const labelColor = css(q(offItem, "label")).color, addedColor = css(q(addedItem, "label")).color;
      const types = { "Request name": "Text", "Assessor": "Person", "Change type": "Choice", "Criticality after change": "Choice", "Description": "Long text", "Effective from": "Date", "Engagement": "Lookup", "Revised annual spend": "Amount", "Revised statement of work": "File", "Other documents": "File" };
      const state = new Map();
      const labelOf = (it) => ((q(it, "label") || {}).textContent || "").trim();
      items.forEach((it) => { const t = q(it, "type"); if (t) types[labelOf(it)] = t.textContent.trim(); });
      const setState = (it, st) => {
        state.set(it, st);
        const onPage = st === "added" || st === "remove";
        it.firstElementChild.replaceWith((st === "on" ? cbOn : st === "added" ? cbAdded : cbOff).cloneNode(true));
        const lab = q(it, "label"); if (lab) lab.style.color = st === "added" ? addedColor : labelColor;
        const tail = it.lastElementChild;
        if (onPage && !q(it, "added")) tail.replaceWith(addedTxt.cloneNode(true));
        if (!onPage && q(it, "added")) { const t = typeTxt.cloneNode(true); t.textContent = types[labelOf(it)] || ""; q(it, "added").replaceWith(t); }
        const at = q(it, "added"); if (at) at.textContent = st === "remove" ? "Will be removed" : "Added";
        it.style.cursor = "pointer";
      };
      items.forEach((it) => setState(it, q(it, "added") ? "added" : "off"));

      const footer = q(fieldMenu, "menu-footer");
      const addLabel = byText(fieldMenu, "Add 3 fields");
      const addBtn = addLabel ? (addLabel.closest("button") || footer.lastElementChild) : footer && footer.lastElementChild;
      const updateFooter = () => {
        const a = items.filter((it) => state.get(it) === "on").length, r = items.filter((it) => state.get(it) === "remove").length, n = a + r;
        const pl = (k) => `${k} field${k === 1 ? "" : "s"}`;
        if (addLabel) addLabel.textContent = a && r ? `Update ${pl(n)}` : r ? `Remove ${pl(r)}` : a ? `Add ${pl(a)}` : "Add fields";
        if (addBtn) { addBtn.style.opacity = n ? "" : "0.4"; addBtn.style.pointerEvents = n ? "" : "none"; }
      };
      updateFooter();

      if (list) { list.style.overflowY = "auto"; [...list.children].forEach((c) => (c.style.flexShrink = "0")); }
      fieldMenu.querySelectorAll('[class*="__group-header"]').forEach((h) => { h.style.position = "sticky"; h.style.top = "0"; h.style.zIndex = "1"; });
      fieldMenu.style.display = "none"; fieldMenu.style.zIndex = "50";

      // A new field's shimmer is as long as a typical value of its type.
      const widths = { ID: 112, Text: 200, Person: 120, Date: 80, "Date and time": 128, Status: 64, "Multi-choice": 180, "Long text": 280, Choice: 96, Lookup: 200, Amount: 96, File: 180 };
      let openFor = null;
      const closeMenu = () => {
        fieldMenu.style.display = "none";
        if (openFor) openFor.style.background = "transparent";
        openFor = null;
        items.forEach((it) => { const s = state.get(it); if (s === "on") setState(it, "off"); if (s === "remove") setState(it, "added"); });
        updateFooter();
      };
      const openMenu = (btn) => {
        closeMenu(); openFor = btn; btn.style.background = openBg;
        fieldMenu.style.display = "";
        if (list) list.scrollTop = 0;
        const v = D.getBoundingClientRect(), r = btn.getBoundingClientRect(), s = scale();
        const top = (r.top - v.top) / s, left = (r.left - v.left) / s, bh = r.height / s;
        const mh = fieldMenu.offsetHeight, vh = D.offsetHeight;
        const below = top + bh + 4, fitsBelow = below + mh <= vh - 8;
        Object.assign(fieldMenu.style, { left: left + "px", right: "auto", bottom: "auto", top: (fitsBelow ? below : Math.max(8, top - 4 - mh)) + "px" });
        if (!reduced) {
          fieldMenu.style.transition = "none"; fieldMenu.style.opacity = "0";
          fieldMenu.style.transform = `translateY(${fitsBelow ? -4 : 4}px)`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            fieldMenu.style.transition = `opacity 180ms ${ease}, transform 180ms ${ease}`;
            fieldMenu.style.opacity = "1"; fieldMenu.style.transform = "none";
          }));
        }
      };
      addBtns.forEach((b) => on(b, () => (openFor === b ? closeMenu() : openMenu(b))));

      const wireItem = (it) => {
        it.addEventListener("mouseenter", () => { it.style.background = ITEM_HOVER; });
        it.addEventListener("mouseleave", () => { it.style.background = "transparent"; });
        on(it, () => {
          const st = state.get(it);
          setState(it, st === "on" ? "off" : st === "off" ? "on" : st === "added" ? "remove" : "added");
          updateFooter();
        });
      };
      items.forEach(wireItem);

      on(addBtn, () => {
        if (!openFor) return;
        const card = openFor.closest('[class*="__detail-card-"]') || openFor.parentElement;
        const values = q(card, "values");
        const chosen = items.filter((it) => state.get(it) === "on");
        chosen.forEach((it) => {
          const label = labelOf(it);
          if (fieldTpl && values) {
            const v = fieldTpl.cloneNode(true);
            const l = q(v, "label"), val = q(v, "value");
            if (l) l.textContent = label;
            const sh = val && val.querySelector('[class*="__shimmer"]');
            if (sh) sh.style.width = (widths[types[label]] || 160) + "px";
            values.appendChild(v); prep(v, 1); wire(v);
          }
          setState(it, "added");
        });
        bump(card, chosen.length);
        if (chosen.length) shimmerOn();
        items.filter((it) => state.get(it) === "remove").forEach((it) => {
          const label = labelOf(it);
          [...D.querySelectorAll('[class*="__detail-card-"]')].forEach((c) => {
            const vals = q(c, "values"); if (!vals) return;
            [...vals.querySelectorAll('[class*="__label"]')].filter((l) => !it.contains(l) && l.textContent.trim() === label).forEach((l) => {
              let f = l; while (f.parentElement && f.parentElement !== vals && !isRow(f.parentElement)) f = f.parentElement;
              if (f !== vals && vals.contains(f)) { f.remove(); bump(c, -1); }
            });
          });
          setState(it, "off");
        });
        closeMenu();
      });
      onRemoved = (label) => { const it = items.find((i) => labelOf(i) === label); if (it) { setState(it, "off"); updateFooter(); } };

      // Add custom field drawer
      const layer = [...stage.children].find((c) => [...c.classList].some((k) => /custom-field-drawer-layer$/.test(k)));
      let openDrawer = () => {};
      if (layer) {
        const scrim = layer.firstElementChild;
        const drawer = q(layer, "add-custom-field-drawer") || layer.lastElementChild;
        const scrimOp = css(scrim).opacity;
        const body = q(drawer, "drawer-body");
        if (body) body.style.overflowY = "auto";
        Object.assign(layer.style, { display: "none", opacity: "1", zIndex: "1000", pointerEvents: "auto" });
        const submit = byText(drawer, "Submit", "button");
        const submitLabel = submit && byText(submit, "Submit");
        const pub = byText(D, "Publish detail page", "button"), pubLabel = byText(D, "Publish detail page");
        const onCss = pub ? { bg: css(pub).backgroundColor, bc: css(pub).borderColor, fg: css(pubLabel).color } : null;
        const offCss = submit ? { bg: css(submit).backgroundColor, bc: css(submit).borderColor, fg: submitLabel ? css(submitLabel).color : "" } : null;
        const fg = css(q(drawer, "drawer-title")).color;
        const boxOf = (v) => v.closest('[data-instance-of="input"]');
        const labelFor = (b) => ((b.parentElement && b.parentElement.querySelector("p")) || {}).textContent || "";
        const edits = [...drawer.querySelectorAll(".input__value")].filter((v) => { const b = boxOf(v); return b && !b.querySelector("svg"); });
        const nameV = drawer.querySelector(".input__value");
        const filled = (v) => v && v.dataset.empty === "0";
        const setSubmit = (ok) => {
          if (!submit || !onCss) return;
          const c = ok ? onCss : offCss;
          submit.style.background = c.bg; submit.style.borderColor = c.bc; if (submitLabel) submitLabel.style.color = c.fg;
          submit.style.cursor = ok ? "pointer" : "default";
        };
        edits.forEach((v) => {
          const ph = v.textContent, phColor = css(v).color, b = boxOf(v), multi = /^(Description|Payload)$/.test(labelFor(b).trim());
          v.dataset.ph = ph; v.dataset.phColor = phColor; v.dataset.empty = "1";
          v.contentEditable = "true"; v.spellcheck = false;
          Object.assign(v.style, { outline: "none", cursor: "text", minHeight: "20px", alignSelf: "stretch", whiteSpace: multi ? "pre-wrap" : "nowrap", overflow: "hidden" });
          b.style.cursor = "text"; b.addEventListener("click", () => v.focus());
          v.addEventListener("focus", () => { if (v.dataset.empty === "1") v.textContent = ""; v.style.color = fg; });
          v.addEventListener("input", () => { v.dataset.empty = v.textContent.trim() ? "0" : "1"; if (v === nameV) setSubmit(filled(nameV)); });
          v.addEventListener("blur", () => { if (!v.textContent.trim()) { v.textContent = ph; v.style.color = phColor; v.dataset.empty = "1"; } });
          if (!multi) v.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); v.blur(); } });
        });
        const swOnEl = drawer.querySelector('[data-instance-of="switch-on"]'), swOffEl = drawer.querySelector('[data-instance-of="switch-off"]');
        const swOnT = swOnEl && swOnEl.cloneNode(true), swOffT = swOffEl && swOffEl.cloneNode(true);
        if (!swOnT || !swOffT) console.warn("scheme-flow: drawer switches not found");
        const switches0 = [...drawer.querySelectorAll('[class*="__switch-row"]')].map((r) => r.innerHTML);
        const wireSwitch = (s) => {
          if (!s || !swOnT || !swOffT) return;
          s.style.cursor = "pointer";
          s.addEventListener("click", (e) => { e.stopPropagation(); const isOn = s.getAttribute("data-instance-of") === "switch-on"; const n = (isOn ? swOffT : swOnT).cloneNode(true); s.replaceWith(n); wireSwitch(n); });
        };
        const wireSwitches = () => drawer.querySelectorAll('[class*="__switch-row"]').forEach((r) => wireSwitch(r.firstElementChild));
        wireSwitches();
        const reset = () => {
          edits.forEach((v) => { v.textContent = v.dataset.ph; v.style.color = v.dataset.phColor; v.dataset.empty = "1"; });
          drawer.querySelectorAll('[class*="__switch-row"]').forEach((r, i) => { if (switches0[i] != null) r.innerHTML = switches0[i]; });
          wireSwitches(); setSubmit(false);
        };
        let back = null, hook = null;
        fbDrawer = (cb) => { openDrawer(null); hook = cb; };
        openDrawer = (btn) => {
          hook = null; back = btn; reset();
          layer.style.display = "";
          if (body) body.scrollTop = 0;
          if (!reduced) {
            scrim.style.transition = "none"; scrim.style.opacity = "0";
            drawer.style.transition = "none"; drawer.style.transform = "translateX(100%)";
            requestAnimationFrame(() => requestAnimationFrame(() => {
              scrim.style.transition = `opacity 220ms ${ease}`; scrim.style.opacity = scrimOp;
              drawer.style.transition = `transform 220ms ${ease}`; drawer.style.transform = "none";
            }));
          }
          setTimeout(() => nameV && nameV.focus(), reduced ? 0 : 240);
        };
        const closeDrawer = (after) => {
          if (layer.style.display === "none") return;
          const done = () => { layer.style.display = "none"; if (after) after(); };
          if (reduced) return done();
          scrim.style.transition = `opacity 180ms ${ease}`; scrim.style.opacity = "0";
          drawer.style.transition = `transform 180ms ${ease}`; drawer.style.transform = "translateX(100%)";
          setTimeout(done, 200);
        };
        const head = q(drawer, "drawer-header");
        on(head && (head.querySelector("button") || head.lastElementChild), () => closeDrawer());
        on(byText(drawer, "Cancel", "button"), () => closeDrawer());
        on(scrim, () => closeDrawer());
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && layer.style.display !== "none") closeDrawer(); });
        let made = 0;
        on(submit, () => {
          if (!filled(nameV)) return;
          const name = nameV.textContent.trim();
          if (hook) { const h = hook; hook = null; closeDrawer(() => h(name)); return; }
          const it = offItem.cloneNode(true);
          [...it.classList].forEach((k) => { if (/menu-item-request-id/.test(k)) { it.classList.remove(k); it.classList.add(k.replace("menu-item-request-id", "menu-item-custom-" + (++made))); } });
          it.style.background = "transparent";
          const l = q(it, "label"); if (l) l.textContent = name;
          const ty = q(it, "type"); if (ty) ty.textContent = "Text";
          types[name] = "Text";
          (list || fieldMenu).appendChild(it); items.push(it); wireItem(it);
          closeDrawer(() => {
            if (back) openMenu(back);
            setState(it, "on"); updateFooter();
            if (list) list.scrollTop = list.scrollHeight;
          });
        });
      }

      const create = q(fieldMenu, "add-custom-field-button");
      if (create) {
        create.addEventListener("mouseenter", () => (create.style.background = ITEM_HOVER));
        create.addEventListener("mouseleave", () => (create.style.background = "transparent"));
        on(create, () => { const b = openFor; closeMenu(); openDrawer(b); });
      }
      D.addEventListener("click", (e) => { if (openFor && !fieldMenu.contains(e.target)) closeMenu(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openFor) closeMenu(); });
      const canvas = q(D, "page-canvas"); if (canvas) canvas.addEventListener("scroll", () => openFor && closeMenu());
      [q(D, "back-button"), byText(D, "Publish detail page", "button")].forEach((n) => n && n.addEventListener("click", () => openFor && closeMenu()));
    }
  }
}
