/** Alttan açılan sayfa (bottom sheet) ve onay diyaloğu. */
import { el, qs } from "./dom.js";
import { esc } from "../util/format.js";

let openCount = 0;

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.desc]
 * @param {string|Node} [o.body]
 * @param {Array<{label:string, variant?:string, value?:any, keep?:boolean}>} [o.actions]
 * @param {(root:HTMLElement, close:(v?:any)=>void)=>void} [o.onMount]
 * @returns {Promise<any>} kapanışta seçilen değer
 */
export function sheet(o) {
  return new Promise((resolve) => {
    const scrim = el('<div class="scrim" role="dialog" aria-modal="true"></div>');
    const box = el(`
      <div class="sheet">
        <div class="sheet__grab"></div>
        <div class="sheet__title">${esc(o.title || "")}</div>
        ${o.desc ? `<div class="sheet__desc">${esc(o.desc)}</div>` : ""}
        <div class="sheet__body"></div>
      </div>`);

    const bodySlot = qs(".sheet__body", box);
    if (typeof o.body === "string") bodySlot.innerHTML = o.body;
    else if (o.body instanceof Node) bodySlot.appendChild(o.body);

    if (o.actions?.length) {
      const row = el('<div class="sheet__actions"></div>');
      o.actions.forEach((a, i) => {
        const b = el(
          `<button class="btn ${a.variant ? "btn--" + a.variant : ""}" type="button">${esc(
            a.label
          )}</button>`
        );
        b.addEventListener("click", () => {
          if (a.keep) return;
          close(a.value !== undefined ? a.value : i);
        });
        if (a.keep) b.dataset.keep = "1";
        row.appendChild(b);
      });
      box.appendChild(row);
    }

    scrim.appendChild(box);
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) close(undefined);
    });

    const onKey = (e) => {
      if (e.key === "Escape") close(undefined);
    };

    let closed = false;
    function close(v) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      scrim.remove();
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = "";
      resolve(v);
    }

    document.body.appendChild(scrim);
    document.addEventListener("keydown", onKey);
    openCount += 1;
    document.body.style.overflow = "hidden";

    o.onMount?.(box, close);
    // İlk metin alanına odaklan (mobil klavye için gecikmeli).
    setTimeout(() => qs("input:not([type=file]), textarea", box)?.focus(), 90);
  });
}

/** Evet/hayır onayı. */
export async function confirm({
  title,
  desc = "",
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  variant = "primary",
}) {
  const v = await sheet({
    title,
    desc,
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, variant, value: true },
    ],
  });
  return v === true;
}
