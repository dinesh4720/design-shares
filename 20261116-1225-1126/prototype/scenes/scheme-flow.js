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
    newform: pick("create-form-no-steps"),
    first: pick("create-form-new-step"),
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

  on(byText(V.forms, "Create new form", "button"), () => { resetFirst(); go("newform"); });
  V.forms && V.forms.querySelectorAll('[class*="__create-detail-page-link"]').forEach((a) => on(a, () => go("dpb")));
  on(q(q(V.forms, "row-change-in-scope"), "form-name"), () => go("builder"));

  on(byText(V.details, "Create new detail page", "button"), () => go("dpb"));
  on(byText(V.details, "Create detail page", "button"), () => go("dpb"));

  for (const k of ["newform", "first", "builder"]) on(q(V[k], "back-button"), () => go("forms"));
  on(q(V.dpb, "back-button"), () => go(lastList));

  on(q(V.newform, "add-step-placeholder") || byText(V.newform, "Add step", "button"), () => { resetFirst(); go("first"); });
  for (const k of ["newform", "first"]) {
    on(byText(V[k], "Add flat field", "button"), () => go("builder"));
    on(byText(V[k], "Add group", "button"), () => go("builder"));
  }

  on(byText(V.builder, "Preview", "button"), () => go("preview"));
  on(byText(V.builder, "Publish form", "button"), () => { publishForm(); go("forms"); });
  on(q(V.preview, "dialog-header") && q(V.preview, "dialog-header").querySelector("button"), () => go("builder"));
  on(q(V.preview, "scrim"), () => go("builder"));

  on(byText(V.dpb, "Publish detail page", "button"), () => { publishDetail(); go("details"); });

  const stepper = q(V.first, "stepper");
  const pristine = stepper ? stepper.innerHTML : "";
  const editTpl = q(V.first, "step-request-details") ? q(V.first, "step-request-details").cloneNode(true) : null;
  const compactTpl = q(V.builder, "step-documents") ? q(V.builder, "step-documents").cloneNode(true) : null;
  const emptyIcon = editTpl ? q(editTpl, "content-type-icon") : null;
  const countEl = q(V.first, "step-count"), posEl = q(V.first, "step-position"), titleEl = q(V.first, "step-title");
  const metaEl = byText(V.first, "1 step, no fields yet");
  const head0 = [countEl && countEl.textContent, posEl && posEl.textContent, titleEl && titleEl.textContent, metaEl && metaEl.textContent];

  const rows = () => stepper ? [...stepper.children].filter((c) => !/__add-step-placeholder/.test(c.className)) : [];
  const editingRow = () => rows().find((r) => r.querySelector(".input__value"));
  const setHead = (i, n, name) => {
    if (countEl) countEl.textContent = String(n);
    if (metaEl) metaEl.textContent = `${n} step${n === 1 ? "" : "s"}, no fields yet`;
    if (posEl) posEl.textContent = `Step ${i} of ${n}`;
    if (titleEl) titleEl.textContent = name;
  };
  const wireEdit = (row) => {
    const v = row.querySelector(".input__value");
    if (!v) return;
    v.contentEditable = "true"; v.spellcheck = false; v.style.outline = "none"; v.style.cursor = "text";
    v.addEventListener("input", () => { if (titleEl) titleEl.textContent = v.textContent.trim() || "Untitled step"; });
    v.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); v.blur(); } });
  };
  const focusEdit = (row) => {
    const v = row.querySelector(".input__value");
    if (!v) return;
    v.focus();
    const r = document.createRange(); r.selectNodeContents(v);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  const toCompact = (row, i) => {
    if (!compactTpl) return;
    const name = (row.querySelector(".input__value")?.textContent || "").trim() || `Step ${i}`;
    const c = compactTpl.cloneNode(true);
    const num = q(c, "step-number"); if (num) num.textContent = String(i);
    const nm = q(c, "step-name"); if (nm) nm.textContent = name;
    const sum = q(c, "content-summary"); if (sum) sum.textContent = "Empty";
    const ic = q(c, "content-type-icon"); if (ic && emptyIcon) ic.replaceWith(emptyIcon.cloneNode(true));
    c.dataset.step = "1"; c.style.cursor = "pointer";
    row.replaceWith(c);
  };
  const toEditing = (row, i, name) => {
    const r = editTpl.cloneNode(true);
    const num = q(r, "step-number"); if (num) num.textContent = String(i);
    r.querySelector(".input__value").textContent = name;
    row ? row.replaceWith(r) : stepper.insertBefore(r, q(stepper, "add-step-placeholder"));
    wireEdit(r);
    return r;
  };
  function resetFirst() {
    if (!stepper) return;
    stepper.innerHTML = pristine;
    if (countEl) countEl.textContent = head0[0];
    if (posEl) posEl.textContent = head0[1];
    if (titleEl) titleEl.textContent = head0[2];
    if (metaEl) metaEl.textContent = head0[3];
    const r = editingRow(); if (r) wireEdit(r);
    wireAdd();
  }
  function wireAdd() {
    const add = q(stepper, "add-step-placeholder");
    if (add) add.style.cursor = "pointer";
  }
  if (stepper && editTpl) {
    stepper.addEventListener("click", (e) => {
      if (e.target.closest(".input__value")) return;
      const add = e.target.closest('[class*="__add-step-placeholder"]');
      if (add) {
        const list = rows(), n = list.length;
        const ed = editingRow(); if (ed) toCompact(ed, list.indexOf(ed) + 1);
        const r = toEditing(null, n + 1, `Step ${n + 1}`);
        setHead(n + 1, n + 1, `Step ${n + 1}`);
        focusEdit(r);
        return;
      }
      const row = e.target.closest("[data-step]");
      if (row) {
        const list = rows(), i = list.indexOf(row) + 1, name = q(row, "step-name")?.textContent.trim() || `Step ${i}`;
        const ed = editingRow(); if (ed) toCompact(ed, list.indexOf(ed) + 1);
        toEditing(row, i, name);
        setHead(i, rows().length, name);
      }
    });
    resetFirst();
  }

  let formPublished = false, detailPublished = false;
  function publishForm() {
    if (formPublished || !V.forms) return;
    const row = q(V.forms, "row-change-in-scope");
    const draft = row && row.querySelector('.badge-draft, [data-instance-of="badge-draft"]');
    const pub = V.forms.querySelector('.badge-published, [data-instance-of="badge-published"]');
    if (draft && pub) { draft.replaceWith(pub.cloneNode(true)); formPublished = true; }
  }
  function publishDetail() {
    if (detailPublished) return;
    detailPublished = true;
    const row = q(V.forms, "row-change-in-scope");
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
    const mt = q(V.details, "message-title"), mb = q(V.details, "message-body");
    if (mt) mt.textContent = "1 form has no detail page yet:";
    if (mb) mb.textContent = "Annual due diligence.";
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

  // ---------- Detail page builder ----------
  // Fields sit in a two-column grid per card: each spans one column (Half) or both (Full).
  // Hover shows the field toolbar (drag, Half / Full, remove); drag a field to drop it before or after another.
  // Add field opens a multi-select menu: tick inputs, then Add N fields.
  if (V.dpb) {
    const D = V.dpb;
    const css = (n) => getComputedStyle(n);
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

      const samples = {
        "Request ID": "RET/RM_0000007", "Requested by": "Dinesh K", "Requested on": "16-11-2026", "Status": "Draft",
        "Current approver": "Jay Shrivastava", "Last updated": "16-11-2026, 10:42", "Vendor contact": "Priya Menon",
        "Contract end date": "31-03-2028", "Data categories affected": "Payroll, Employee bank details",
        "Reason for the new criticality": "Payroll adds employee bank details to what Connect Reach can see.",
      };
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
            if (val) val.textContent = samples[label] || "—";
            values.appendChild(v); prep(v, 1); wire(v);
          }
          setState(it, "added");
        });
        bump(card, chosen.length);
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
        let back = null;
        openDrawer = (btn) => {
          back = btn; reset();
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
