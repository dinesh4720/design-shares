// Comments on a shared snapshot's canvas (written into each snapshot as
// comments.js, loaded by canvas.html; share.js). Press C (or the Comment
// button), click a spot and write: the comment goes to the link service
// (link-service/share-comments.js) and from there into the designer's
// canvas in Knot. Pins show everyone's comments; a pin opens its thread,
// with a reply box. Self-contained, no libraries, old-browser-safe syntax.
(function () {
  var cfg;
  try { cfg = JSON.parse(document.getElementById("share").textContent); } catch (e) { return; }
  var canvas = window.knotCanvas;
  if (!cfg || !cfg.service || !cfg.share || !canvas) return;
  var base = cfg.service.replace(/\/?$/, "/") + "shares/" + encodeURIComponent(cfg.share) + "/comments";
  var NAME_KEY = "knot-share-name";
  var comments = [];
  var mode = false;
  var open = null; // {kind: "new", x, y, page, board, dx, dy} | {kind: "thread", id}
  var layer = document.createElement("div");
  layer.id = "pins";
  document.getElementById("world").parentNode.appendChild(layer);
  var card = document.createElement("div");
  card.className = "c-card";
  card.hidden = true;
  document.body.appendChild(card);
  var hint = document.createElement("div");
  hint.className = "c-hint";
  hint.hidden = true;
  hint.textContent = "Click anywhere to comment · Esc to stop";
  document.body.appendChild(hint);

  function savedName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function ago(iso) {
    var s = (Date.now() - Date.parse(iso)) / 1000;
    if (!(s >= 0)) return "";
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function tell(parent) { try { window.parent && window.parent !== window && window.parent.postMessage({ knot: "comments", count: visible().length, mode: mode }, "*"); } catch (e) {} }

  // Where a comment is on the canvas now: on its board (which may have
  // moved since an update), else where it was put.
  function spot(c) {
    var page = canvas.pages[canvas.current()];
    if (c.board && page) {
      for (var i = 0; i < page.boards.length; i++) {
        var b = page.boards[i];
        if (b.id === c.board) return { x: b.x + c.dx, y: b.y + c.dy };
      }
    }
    return { x: c.x, y: c.y };
  }
  function onThisPage(c) {
    var page = canvas.pages[canvas.current()];
    return !c.page || !page || !page.id || c.page === page.id || (c.board && page.boards.some(function (b) { return b.id === c.board; }));
  }
  function visible() { return comments.filter(function (c) { return !c.resolved && onThisPage(c) && (!canvas.only || c.board === canvas.only); }); }
  function toScreen(p) { var v = canvas.view; return { x: p.x * v.s + v.x, y: p.y * v.s + v.y }; }

  function paint() {
    layer.textContent = "";
    visible().forEach(function (c, i) {
      var p = toScreen(spot(c));
      var pin = el("button", "c-pin" + (open && open.kind === "thread" && open.id === c.id ? " open" : ""));
      pin.type = "button";
      var first = c.messages[0];
      pin.textContent = (first.name || "G").trim().charAt(0).toUpperCase();
      pin.title = (first.name || "Guest") + ": " + first.text;
      pin.style.left = p.x + "px";
      pin.style.top = p.y + "px";
      pin.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      pin.addEventListener("click", function (e) { e.stopPropagation(); showThread(c.id); });
      layer.appendChild(pin);
    });
    if (open && open.kind === "new") {
      var p = toScreen(open);
      var draft = el("div", "c-pin draft");
      draft.style.left = p.x + "px";
      draft.style.top = p.y + "px";
      layer.appendChild(draft);
    }
    place();
    tell();
  }

  function place() {
    if (card.hidden || !open) return;
    var at;
    if (open.kind === "new") at = toScreen(open);
    else {
      var c = find(open.id);
      if (!c) return close();
      at = toScreen(spot(c));
    }
    var w = card.offsetWidth, h = card.offsetHeight;
    var x = at.x + 22, y = at.y - 30;
    if (x + w > innerWidth - 8) x = Math.max(8, at.x - w - 14);
    y = Math.max(8, Math.min(y, innerHeight - h - 8));
    card.style.left = x + "px";
    card.style.top = y + "px";
  }

  function find(id) { for (var i = 0; i < comments.length; i++) if (comments[i].id === id) return comments[i]; }

  function close() {
    open = null;
    card.hidden = true;
    paint();
  }

  function setMode(on) {
    mode = on;
    canvas.mode = on ? "comment" : "";
    document.body.classList.toggle("commenting", on);
    hint.hidden = !on;
    if (!on && open && open.kind === "new") close();
    tell();
  }

  // The words box with a name field when we don't know the name yet.
  function composer(placeholder, submitLabel, onSend) {
    var form = el("form", "c-form");
    var name = null;
    if (!savedName()) {
      name = el("input", "c-name");
      name.placeholder = "Your name";
      name.maxLength = 40;
      name.autocomplete = "name";
      form.appendChild(name);
    }
    var text = el("textarea", "c-text");
    text.placeholder = placeholder;
    text.rows = 2;
    text.maxLength = 2000;
    var row = el("div", "c-row");
    var err = el("span", "c-err");
    var send = el("button", "c-send", submitLabel);
    send.type = "submit";
    send.disabled = true;
    row.appendChild(err);
    row.appendChild(send);
    form.appendChild(text);
    form.appendChild(row);
    text.addEventListener("input", function () {
      send.disabled = !text.value.trim();
      text.style.height = "auto";
      text.style.height = Math.min(160, text.scrollHeight) + "px";
      place();
    });
    text.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var who = name ? name.value.trim() : savedName();
      if (!who) { err.textContent = "Add your name"; if (name) name.focus(); return; }
      if (name) saveName(who);
      send.disabled = true;
      err.textContent = "";
      onSend(who, text.value.trim()).then(function () {}, function (error) {
        send.disabled = false;
        err.textContent = (error && error.message) || "Couldn't post. Try again.";
      });
    });
    setTimeout(function () { (name && !name.value ? name : text).focus(); }, 0);
    return form;
  }

  function newComment(at) {
    open = at;
    open.kind = "new";
    card.hidden = false;
    card.textContent = "";
    card.appendChild(composer("Add a comment", "Post", function (who, words) {
      return request("POST", base, { name: who, text: words, page: at.page, board: at.board, x: at.x, y: at.y, dx: at.dx, dy: at.dy }).then(function (data) {
        comments.push(data.comment);
        setMode(false);
        showThread(data.comment.id);
      });
    }));
    paint();
  }

  function showThread(id) {
    var c = find(id);
    if (!c) return;
    open = { kind: "thread", id: id };
    card.hidden = false;
    card.textContent = "";
    var head = el("div", "c-head");
    head.appendChild(el("strong", "", "Comment"));
    var x = el("button", "c-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.onclick = close;
    head.appendChild(x);
    card.appendChild(head);
    var list = el("ol", "c-list");
    c.messages.forEach(function (m) {
      var li = el("li", "c-msg" + (m.by === "owner" ? " owner" : ""));
      var meta = el("div", "c-meta");
      meta.appendChild(el("span", "c-who", m.by === "owner" ? (m.name && m.name !== "Guest" ? m.name : "Designer") : m.name || "Guest"));
      meta.appendChild(el("span", "c-when", ago(m.at)));
      li.appendChild(meta);
      li.appendChild(el("p", "c-words", m.text));
      list.appendChild(li);
    });
    card.appendChild(list);
    card.appendChild(composer("Reply", "Reply", function (who, words) {
      return request("POST", base + "/" + encodeURIComponent(c.id) + "/replies", { name: who, text: words }).then(function (data) {
        var i = comments.indexOf(c);
        comments[i] = data.comment;
        showThread(c.id);
      });
    }));
    list.scrollTop = list.scrollHeight;
    paint();
  }

  function request(method, url, body) {
    return fetch(url, { method: method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || "Couldn't reach the comments (" + res.status + ").");
        return data;
      });
    });
  }

  function load() {
    return request("GET", base).then(function (data) {
      comments = data.comments || [];
      if (open && open.kind === "thread" && !card.contains(document.activeElement)) showThread(open.id);
      else paint();
    }, function () {});
  }

  // Placing: a click on the canvas in comment mode (canvas.html calls this
  // for a press that didn't move).
  canvas.onPlace = function (e) {
    var v = canvas.view;
    var x = (e.clientX - v.x) / v.s, y = (e.clientY - v.y) / v.s;
    var page = canvas.pages[canvas.current()];
    var at = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, page: page && page.id };
    if (page) for (var i = page.boards.length - 1; i >= 0; i--) {
      var b = page.boards[i];
      if (canvas.only && b.id !== canvas.only) continue;
      if (b.id && x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) { at.board = b.id; at.dx = Math.round((x - b.x) * 100) / 100; at.dy = Math.round((y - b.y) * 100) / 100; break; }
    }
    newComment(at);
  };
  canvas.onView = paint;
  canvas.onClick = function () { if (open) close(); };
  window.knotComment = function (on) { setMode(on === undefined ? !mode : Boolean(on)); };

  addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) {
      if (e.key === "Escape") { t.blur(); close(); }
      return;
    }
    if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setMode(!mode); }
    else if (e.key === "Escape") { if (open) close(); else setMode(false); }
  });
  card.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  card.addEventListener("wheel", function (e) { e.stopPropagation(); });
  addEventListener("resize", place);
  load();
  setInterval(function () { if (!document.hidden) load(); }, 15000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
})();
