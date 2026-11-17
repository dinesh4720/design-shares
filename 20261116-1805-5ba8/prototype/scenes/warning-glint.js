// Warning tile: a soft amber halo that breathes out, and a glint that sweeps across the tile.
export default function ({ el, reduced, input = {} }) {
  const color = input.color || "237,148,1";
  const id = "warning-glint-style";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes wg-halo { 0% { box-shadow: 0 0 0 0 rgba(var(--wg), .45); } 70%, 100% { box-shadow: 0 0 0 7px rgba(var(--wg), 0); } }
      @keyframes wg-glint { 0%, 55% { transform: translateX(-140%) skewX(-20deg); } 85%, 100% { transform: translateX(240%) skewX(-20deg); } }
      .wg-tile { position: relative; overflow: hidden; }
      .wg-tile::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 45%; pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent);
        animation: wg-glint 3.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .wg-tile, .wg-tile::after { animation: none; } .wg-tile::after { display: none; } }
    `;
    document.head.appendChild(s);
  }
  el.style.setProperty("--wg", color);
  if (!reduced) el.classList.add("wg-tile");
  return { frame() {} };
}
