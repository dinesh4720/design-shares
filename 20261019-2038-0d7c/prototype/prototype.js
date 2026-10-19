// Runs the prototype's interactions on these pages (data-click, data-hover, data-delay).
(function prototype() {
  "use strict";
  const KEY = "prototype:transition";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openedWith = new WeakMap();
  const closing = new WeakMap();
  const timers = new Map();

  // "push-left 250ms ease-out" -> {animation, duration, easing}
  function parse(text) {
    const [animation = "instant", duration = "300ms", easing = "ease-out"] = String(text || "instant").trim().split(/\s+/);
    return { animation, duration: parseFloat(duration) || 0, easing };
  }

  // Only for a moment: a navigation that didn't happen mustn't animate a
  // later one.
  function remember(text) {
    try {
      if (text) sessionStorage.setItem(KEY, JSON.stringify({ text, at: Date.now() }));
      else sessionStorage.removeItem(KEY);
    } catch {}
  }

  function recall() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
      sessionStorage.removeItem(KEY);
      return saved && Date.now() - saved.at < 5000 ? parse(saved.text) : undefined;
    } catch {
      return undefined;
    }
  }

  addEventListener("pagereveal", (event) => {
    const transition = recall();
    const view = event.viewTransition;
    if (!view) return;
    if (!transition || transition.animation === "instant" || reduced()) return view.skipTransition();
    const style = document.documentElement.style;
    style.setProperty("--transition-duration", `${transition.duration}ms`);
    style.setProperty("--transition-easing", transition.easing);
    view.types?.add(transition.animation);
  });

  function run(spec, text, source, trigger) {
    const [action, target = ""] = String(spec).trim().split(/\s+/);
    if (action === "navigate" && !/^[a-z][\w+.-]*:/i.test(target)) {
      remember(text);
      location.href = target;
    } else if (action === "back") {
      const shown = document.querySelector("dialog[open]");
      if (shown) return close(shown, text);
      remember(text);
      history.back();
    } else if (action === "overlay") overlay(target, text);
    else if (action === "close") close(source.closest("dialog[open]") || document.querySelector("dialog[open]"), text);
    else if (action === "scroll") scrollToId(target);
    else if (action === "url" && /^https?:\/\//i.test(target)) {
      // A click can open a tab; a mouse enter or a delay can't, so they go there.
      if (trigger === "click") window.open(target, "_blank", "noopener,noreferrer");
      else location.href = target;
    }
  }

  function overlay(id, text) {
    const dialog = document.getElementById(id);
    if (!dialog || typeof dialog.showModal !== "function") return;
    for (const other of document.querySelectorAll("dialog[open]")) if (other !== dialog) other.close();
    closing.get(dialog)?.cancel();
    closing.delete(dialog);
    if (!dialog.open) dialog.showModal();
    openedWith.set(dialog, text);
    const { animation, duration, easing } = parse(text);
    if (animation !== "instant" && !reduced()) {
      const [, dir] = animation.split("-");
      const axis = dir === "left" || dir === "right" ? "X" : "Y";
      const sign = dir === "left" || dir === "up" ? 1 : -1;
      const from = animation === "dissolve" ? "none" : `translate${axis}(${sign * 40}%)`;
      dialog.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration, easing });
    }
    startDelay(dialog);
  }

  function close(dialog, text) {
    if (!dialog || !dialog.open) return;
    if (parse(text).animation === "instant" || reduced()) return dialog.close();
    const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    closing.set(dialog, fade);
    const done = () => {
      // Once, and not if it was opened again meanwhile.
      if (closing.get(dialog) !== fade) return;
      closing.delete(dialog);
      dialog.close();
      fade.cancel();
    };
    fade.finished.then(done, done);
    // On time even where nothing is drawn (a background tab pauses animations).
    setTimeout(done, 350);
  }

  function scrollToId(id) {
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  }

  // A board's after-delay interaction: the page's once it shows, an
  // overlay's once it opens.
  function startDelay(scope) {
    stopDelay(scope);
    const board = scope.querySelector(":scope > [data-delay]");
    if (!board) return;
    const ms = Number(board.dataset.delayMs) || 0;
    timers.set(scope, setTimeout(() => run(board.dataset.delay, board.dataset.delayTransition, board, "delay"), ms));
  }

  function stopDelay(scope) {
    clearTimeout(timers.get(scope));
    timers.delete(scope);
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
    // A click outside an overlay lands on its <dialog>.
    if (event.target instanceof HTMLDialogElement && event.target.open) return close(event.target, openedWith.get(event.target));
    // The innermost link or clickable layer does its thing, as in the player.
    const hit = event.target.closest("a[href], [data-click]");
    if (!hit) return;
    if (hit.hasAttribute("data-click")) {
      event.preventDefault();
      return run(hit.dataset.click, hit.dataset.clickTransition, hit, "click");
    }
    const href = hit.getAttribute("href");
    if (href.startsWith("#")) {
      // Scrolling adds no history entry, so back still leaves the page.
      event.preventDefault();
      return scrollToId(decodeURIComponent(href.slice(1)));
    }
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !hit.getAttribute("target")) remember(hit.dataset.clickTransition);
  });

  // Clickable layers that aren't links or buttons have a role and a
  // tabindex; Enter (and Space for a button) clicks them.
  document.addEventListener("keydown", (event) => {
    const el = event.target;
    if (!(el instanceof Element) || !el.matches("[data-click][tabindex]")) return;
    if (event.key === "Enter" || (event.key === " " && el.getAttribute("role") === "button")) {
      event.preventDefault();
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    for (const el of document.querySelectorAll("[data-hover]")) {
      el.addEventListener("mouseenter", () => run(el.dataset.hover, el.dataset.hoverTransition, el, "hover"));
    }
    for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("close", () => stopDelay(dialog));
    startDelay(document.body);
  });
  // Back to a page kept in memory: its delay runs again, as in the player.
  addEventListener("pageshow", (event) => event.persisted && startDelay(document.body));
  addEventListener("pagehide", () => stopDelay(document.body));
})();
