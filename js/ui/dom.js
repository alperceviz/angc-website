/** Küçük DOM yardımcıları — çerçeve yok, sadece ihtiyaç duyulanlar. */

/** HTML metnini tek bir elemana çevirir. */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = String(html).trim();
  return t.content.firstElementChild;
}

/** HTML metnini DocumentFragment'a çevirir (çoklu kök için). */
export function frag(html) {
  const t = document.createElement("template");
  t.innerHTML = String(html).trim();
  return t.content;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Olay delegasyonu: kök elemana tek dinleyici bağlar.
 *   on(view, 'click', '[data-act="save"]', (e, node) => ...)
 */
export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const node = e.target.closest(selector);
    if (node && root.contains(node)) handler(e, node);
  });
}

/** data-act özniteliğine göre tıklama eylemlerini bağlar. */
export function actions(root, map) {
  root.addEventListener("click", (e) => {
    const node = e.target.closest("[data-act]");
    if (!node || !root.contains(node)) return;
    const fn = map[node.dataset.act];
    if (fn) {
      e.preventDefault();
      fn(node, e);
    }
  });
}

/** Formdaki alanları düz bir nesne olarak toplar. */
export function formData(root) {
  const out = {};
  qsa("[name]", root).forEach((f) => {
    if (f.type === "checkbox") out[f.name] = f.checked;
    else out[f.name] = f.value;
  });
  return out;
}

/** Kısa dokunsal geri bildirim (destekleyen cihazlarda). */
export function haptic(pattern = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* yok sayılır */
  }
}

/** Sayfayı yumuşak şekilde en üste alır. */
export function scrollTop() {
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
