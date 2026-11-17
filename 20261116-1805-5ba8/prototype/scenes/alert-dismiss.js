// Dismiss the monitoring warning for this visit only: no storage, so a reload brings it back.
// Delegated at window capture so other prototype scripts or re-rendered DOM can't block it.
export default function ({ el }) {
  const BTN = '[class*="__dismiss-alert-button"], [class*="__dismiss-button"]';
  const ROW = '[class*="__monitoring-alert-row"]';
  const style = document.createElement("style");
  style.textContent = `${ROW} :is(${BTN}){cursor:pointer;pointer-events:auto;border-radius:6px;transition:background 120ms}
${ROW} :is(${BTN}):hover{background:rgba(0,0,0,0.06)}`;
  document.head.appendChild(style);

  const hideRow = (row) => {
    const h = row.offsetHeight;
    row.style.overflow = "hidden";
    row.style.height = h + "px";
    row.style.transition = "opacity 160ms ease-out, height 200ms ease-out 120ms, margin 200ms ease-out 120ms";
    requestAnimationFrame(() => {
      row.style.opacity = "0";
      row.style.height = "0px";
      row.style.margin = "0px";
    });
    setTimeout(() => { row.style.display = "none"; }, 360);
  };

  const onClick = (e) => {
    const btn = e.target.closest && e.target.closest(BTN);
    if (!btn) return;
    const row = btn.closest(ROW);
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    hideRow(row);
  };
  window.addEventListener("click", onClick, true);
  return {};
}
