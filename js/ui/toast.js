/** Kısa bildirim balonları. */
import { el } from "./dom.js";
import { icon } from "./icons.js";
import { esc } from "../util/format.js";

let layer = null;

function ensure() {
  if (!layer) {
    layer = el('<div class="toasts" role="status" aria-live="polite"></div>');
    document.body.appendChild(layer);
  }
  return layer;
}

/**
 * @param {string} message
 * @param {'ok'|'err'|''} [tone]
 */
export function toast(message, tone = "") {
  const l = ensure();
  const ic = tone === "ok" ? "check-circle" : tone === "err" ? "alert" : "info";
  const node = el(
    `<div class="toast ${tone ? "toast--" + tone : ""}">${icon(ic)}<span>${esc(
      message
    )}</span></div>`
  );
  l.appendChild(node);
  setTimeout(() => {
    node.classList.add("toast--out");
    setTimeout(() => node.remove(), 220);
  }, 2600);
}

export const ok = (m) => toast(m, "ok");
export const err = (m) => toast(m, "err");
