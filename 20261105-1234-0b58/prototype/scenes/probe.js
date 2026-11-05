const PAGE = 0;
export default function ({ url }) {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;inset:0;z-index:2147483647;margin:0;padding:8px;background:#fff;color:#000;font:11px/1.25 monospace;white-space:pre-wrap;word-break:break-all;overflow:hidden";
  box.textContent = "loading";
  document.body.appendChild(box);
  fetch(url("scenes/prototype.js")).then(r => r.text()).then(t => {
    const c = t.replace(/"[0-9A-Fa-f#,]{40,}"/g, '"…"').replace(/\n\s*/g, "\n");
    const size = 14000;
    box.textContent = "CLEN " + c.length + " page " + PAGE + "\n" + c.slice(c.indexOf('function railActive'), c.indexOf('function railActive') + 9000);
  }).catch(e => { box.textContent = "ERR " + e.message; });
  return { frame() {} };
}