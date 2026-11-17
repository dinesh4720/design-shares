export default function ({ canvas }) {
  if (canvas) canvas.style.pointerEvents = "none";
  const root = document;
  const q = (name) => root.querySelector(`[class*="__${name}"]`);
  let tries = 0;
  const init = () => {
    const chip = q("context-chip");
    const panel = q("data-context-panel");
    if (!chip || !panel) { if (tries++ < 20) { setTimeout(init, 100); return; } throw new Error('dc: chip=' + !!chip + ' panel=' + !!panel + ' cls=' + [...root.querySelectorAll('[class*="context"]')].slice(0,6).map(e=>e.className).join('|')); }
    let open = false;
    panel.style.transition = "opacity 120ms ease-out, transform 120ms ease-out";
    panel.style.zIndex = "50";
    const place = () => {
      const host = panel.offsetParent || panel.parentElement;
      const h = host.getBoundingClientRect(), c = chip.getBoundingClientRect();
      const sx = h.width / host.offsetWidth || 1;
      panel.style.left = ((c.left + c.width / 2 - h.left) / sx - panel.offsetWidth / 2) + 'px';
      panel.style.top = ((c.bottom - h.top) / sx + 6) + 'px';
    };
    const set = (v) => {
      open = v;
      if (v) place();
      panel.style.opacity = v ? "1" : "0";
      panel.style.transform = v ? "translateY(0)" : "translateY(-4px)";
      panel.style.pointerEvents = v ? "auto" : "none";
      panel.style.visibility = v ? "visible" : "hidden";
      chip.style.background = v ? "rgba(0,0,0,0.04)" : "";
    };
    set(false);
    chip.style.cursor = "pointer";
    chip.addEventListener("click", (e) => { e.stopPropagation(); set(!open); });
    panel.addEventListener("click", (e) => e.stopPropagation());
    ["close-button", "cancel-button", "apply-button"].forEach((n) => {
      const b = panel.querySelector(`[class*="__${n}"]`);
      if (b) { b.style.cursor = "pointer"; b.addEventListener("click", () => set(false)); }
    });
    root.addEventListener("click", () => open && set(false));
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  };
  init();
  return { frame() {}, resize() {} };
}
