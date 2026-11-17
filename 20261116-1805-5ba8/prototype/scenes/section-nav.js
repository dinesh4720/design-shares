// Section panel: hover and active states for every nav item, and click to select.
// Rest: no fill, Foreground4, regular. Hover: Background4, Foreground2.
// Active: Background6, Foreground1, semibold. Group headers get the hover fill only.
export default function ({ el }) {
  const ends = (n, re) => [...n.classList].some((c) => re.test(c));
  const panels = [...el.querySelectorAll('[class*="__section-panel"]')].filter((n) => ends(n, /__section-panel$/));
  const REST = { bg: "transparent", fg: "var(--colorNeutralForeground4, #707070)", fw: "400" };
  const HOVER = { bg: "var(--colorNeutralBackground4, #F0F0F0)", fg: "var(--colorNeutralForeground2, #424242)", fw: "400" };
  const ACTIVE = { bg: "var(--colorNeutralBackground6, #E6E6E6)", fg: "var(--colorNeutralForeground1, #242424)", fw: "600" };

  panels.forEach((panel) => {
    const items = [...panel.querySelectorAll("[class]")].filter((n) => ends(n, /-nav-item$/));
    const headers = [...panel.querySelectorAll("[class]")].filter((n) => ends(n, /-group-header$/));
    const label = (n) => n.querySelector("p, span");
    // groups of items that share one active item (each nav list)
    const listOf = (n) => n.closest('[class*="section-nav"]') || panel;
    let active = new Map();
    items.forEach((n) => { const bg = getComputedStyle(n).backgroundColor; if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") active.set(listOf(n), n); });

    const paint = (n, s) => { n.style.backgroundColor = s.bg; const t = label(n); if (t) { t.style.color = s.fg; t.style.fontWeight = s.fw; } };
    const state = (n, hover) => active.get(listOf(n)) === n ? ACTIVE : hover ? HOVER : REST;

    // the prototype's CSS hover (!important) would beat these states: this script owns them
    const strip = () => [...items, ...headers].forEach((n) => n.classList.remove("proto-hover"));
    strip(); requestAnimationFrame(strip); setTimeout(strip, 300); setTimeout(strip, 1200);

    items.forEach((n) => {
      n.style.cursor = "pointer";
      n.style.transition = "background-color 120ms ease-out";
      const t = label(n); if (t) t.style.transition = "color 120ms ease-out";
      paint(n, state(n, false));
      n.addEventListener("mouseenter", () => paint(n, state(n, true)));
      n.addEventListener("mouseleave", () => paint(n, state(n, false)));
      n.addEventListener("mousedown", () => { if (active.get(listOf(n)) !== n) n.style.backgroundColor = "var(--colorNeutralBackground5, #EBEBEB)"; });
      n.addEventListener("click", () => {
        const list = listOf(n), prev = active.get(list);
        active.set(list, n);
        if (prev && prev !== n) paint(prev, REST);
        paint(n, ACTIVE);
      });
    });

    headers.forEach((h) => {
      h.style.cursor = "pointer";
      h.style.transition = "background-color 120ms ease-out";
      h.addEventListener("mouseenter", () => { h.style.backgroundColor = HOVER.bg; });
      h.addEventListener("mouseleave", () => { h.style.backgroundColor = "transparent"; });
    });
  });
}
