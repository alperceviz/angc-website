/** HTML üreten küçük bileşen fonksiyonları. Hepsi metin döndürür. */
import { icon } from "./icons.js";
import { esc } from "../util/format.js";

const attrs = (o = {}) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(" ");

export function sectionTitle(text, right = "") {
  return `<div class="section-title"><span>${esc(text)}</span><span class="spacer"></span>${right}</div>`;
}

export function badge(label, tone = "") {
  return `<span class="badge ${tone ? "badge--" + tone : ""}">${esc(label)}</span>`;
}

export function banner(text, tone = "", ic = "info") {
  return `<div class="banner ${tone ? "banner--" + tone : ""}">${icon(ic)}<div>${text}</div></div>`;
}

export function empty(title, desc = "", ic = "inbox") {
  return `<div class="empty">${icon(ic, { size: 42 })}
    <div class="empty__title">${esc(title)}</div>
    <div class="empty__desc">${esc(desc)}</div></div>`;
}

export function stat(value, label, tone = "") {
  const color = tone ? `style="color:var(--${tone})"` : "";
  return `<div class="stat"><div class="stat__value" ${color}>${esc(value)}</div>
    <div class="stat__label">${esc(label)}</div></div>`;
}

/**
 * Ana ekrandaki büyük eylem kutusu.
 * @param {{icon:string,label:string,meta?:string,tone?:string,act?:string,data?:object,count?:number}} o
 */
export function tile(o) {
  const data = Object.entries(o.data || {})
    .map(([k, v]) => `data-${k}="${esc(v)}"`)
    .join(" ");
  return `<button class="tile ${o.tone ? "tile--" + o.tone : ""}" type="button"
      ${o.act ? `data-act="${esc(o.act)}"` : ""} ${data}>
      <span class="tile__icon">${icon(o.icon)}</span>
      <span>
        <span class="tile__label">${esc(o.label)}</span>
        ${o.meta ? `<span class="tile__meta">${esc(o.meta)}</span>` : ""}
      </span>
      ${o.count ? `<span class="tile__count">${o.count > 99 ? "99+" : o.count}</span>` : ""}
    </button>`;
}

/**
 * Liste satırı.
 * @param {object} o
 * @param {string} [o.icon]     - sol taraftaki ikon adı
 * @param {string} [o.initials] - ikon yerine baş harfler
 * @param {string} o.title
 * @param {string} [o.sub]
 * @param {string} [o.side]     - sağ üstte küçük metin
 * @param {string} [o.badges]   - hazır rozet HTML'i
 * @param {string} [o.tone]     - accent | ok | info | danger (sol şerit)
 * @param {string} [o.act]      - data-act
 * @param {object} [o.data]     - ek data-* öznitelikleri
 * @param {boolean}[o.chevron]
 * @param {boolean}[o.static]   - tıklanamaz satır
 */
export function listItem(o) {
  const data = Object.entries(o.data || {})
    .map(([k, v]) => `data-${k}="${esc(v)}"`)
    .join(" ");
  const avatar = o.initials
    ? `<span class="item__avatar">${esc(o.initials)}</span>`
    : o.icon
    ? `<span class="item__avatar">${icon(o.icon)}</span>`
    : "";
  const tag = o.static ? "div" : "button";
  return `<${tag} class="item ${o.tone ? "item--" + o.tone : ""} ${
    o.static ? "item--static" : ""
  }" ${o.static ? "" : 'type="button"'} ${o.act ? `data-act="${esc(o.act)}"` : ""} ${data}>
    ${avatar}
    <span class="item__body">
      <span class="item__title">${o.titleHtml || esc(o.title)} ${o.badges || ""}</span>
      ${o.sub ? `<span class="item__sub">${o.subHtml ? o.sub : esc(o.sub)}</span>` : ""}
    </span>
    ${o.side ? `<span class="item__side">${o.sideHtml ? o.side : esc(o.side)}</span>` : ""}
    ${o.chevron !== false && !o.static ? `<span class="item__chev">${icon("chevron")}</span>` : ""}
  </${tag}>`;
}

export function kv(k, v) {
  return `<div class="kv"><span class="kv__k">${esc(k)}</span><span class="kv__v">${
    v ?? "—"
  }</span></div>`;
}

/* ---------- Form alanları ---------- */

export function fieldText({
  name,
  label,
  value = "",
  placeholder = "",
  hint = "",
  type = "text",
  required = false,
  cls = "",
  inputmode = "",
  maxlength = "",
  autocomplete = "off",
}) {
  return `<label class="field">
    <span class="field__label">${esc(label)}${required ? " *" : ""}</span>
    <input class="input ${cls}" ${attrs({
      name,
      type,
      value,
      placeholder,
      inputmode,
      maxlength,
      autocomplete,
    })} />
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;
}

export function fieldTextarea({ name, label, value = "", placeholder = "", hint = "", rows = 4 }) {
  return `<label class="field">
    <span class="field__label">${esc(label)}</span>
    <textarea class="textarea" name="${esc(name)}" rows="${rows}" placeholder="${esc(
    placeholder
  )}">${esc(value)}</textarea>
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;
}

/** @param {Array<[string,string]>} options - [değer, etiket] */
export function fieldSelect({ name, label, options, value = "", hint = "" }) {
  const opts = options
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`
    )
    .join("");
  return `<label class="field">
    <span class="field__label">${esc(label)}</span>
    <select class="select" name="${esc(name)}">${opts}</select>
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;
}

/** Yan yana seçenek düğmeleri (öncelik, tür vb.). */
export function fieldOptions({ name, label, options, value }) {
  const btns = options
    .map(
      ([v, l, variant]) =>
        `<button type="button" class="option ${variant ? "option--" + variant : ""}"
          data-optgroup="${esc(name)}" data-value="${esc(v)}"
          aria-pressed="${String(v) === String(value)}">${esc(l)}</button>`
    )
    .join("");
  return `<div class="field">
    <span class="field__label">${esc(label)}</span>
    <div class="optionrow" data-optionrow="${esc(name)}">${btns}</div>
    <input type="hidden" name="${esc(name)}" value="${esc(value)}" />
  </div>`;
}

/** Kamera/galeri fotoğrafı. */
export function fieldPhoto({ name = "photo", label = "Fotoğraf (isteğe bağlı)" } = {}) {
  return `<div class="field">
    <span class="field__label">${esc(label)}</span>
    <label class="photo" data-photo="${esc(name)}">
      ${icon("camera", { size: 26 })}
      <span>Fotoğraf çek veya seç</span>
      <input type="file" accept="image/*" capture="environment" data-photoinput="${esc(name)}" />
    </label>
    <input type="hidden" name="${esc(name)}" value="" />
  </div>`;
}

export function switchRow({ name, label, desc = "", checked = false }) {
  return `<div class="switchrow">
    <div class="switchrow__text">
      <div class="strong">${esc(label)}</div>
      ${desc ? `<div class="faint">${esc(desc)}</div>` : ""}
    </div>
    <button type="button" class="switch" role="switch" data-switch="${esc(name)}"
      aria-checked="${checked ? "true" : "false"}" aria-label="${esc(label)}"></button>
  </div>`;
}

/* ---------- Etkileşimli alanları bağlama ---------- */

/**
 * fieldOptions / fieldPhoto / switchRow bileşenlerini canlandırır.
 * View'lar render sonrası bir kez çağırır.
 */
export function wireFields(root, { onPhoto } = {}) {
  // Seçenek düğmeleri
  root.querySelectorAll("[data-optionrow]").forEach((row) => {
    row.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-value]");
      if (!btn) return;
      row.querySelectorAll("[data-value]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === btn))
      );
      const hidden = root.querySelector(`input[name="${row.dataset.optionrow}"]`);
      if (hidden) hidden.value = btn.dataset.value;
      row.dispatchEvent(
        new CustomEvent("optionchange", { bubbles: true, detail: btn.dataset.value })
      );
    });
  });

  // Anahtarlar
  root.querySelectorAll("[data-switch]").forEach((sw) => {
    sw.addEventListener("click", () => {
      const next = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(next));
      sw.dispatchEvent(new CustomEvent("switchchange", { bubbles: true, detail: next }));
    });
  });

  // Fotoğraf seçimi
  root.querySelectorAll("[data-photoinput]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { compressImage } = await import("../util/media.js");
      const dataUrl = await compressImage(file);
      const wrap = input.closest(".photo");
      const hidden = root.querySelector(`input[name="${input.dataset.photoinput}"]`);
      if (hidden) hidden.value = dataUrl;
      wrap.innerHTML =
        `<img src="${dataUrl}" alt="Seçilen fotoğraf" />` +
        `<button type="button" class="photo__clear" data-photoclear>${icon("x")}</button>`;
      wrap.querySelector("[data-photoclear]").addEventListener("click", (e) => {
        e.preventDefault();
        if (hidden) hidden.value = "";
        wrap.innerHTML =
          icon("camera", { size: 26 }) +
          "<span>Fotoğraf çek veya seç</span>" +
          `<input type="file" accept="image/*" capture="environment" data-photoinput="${input.dataset.photoinput}" />`;
        wireFields(wrap, { onPhoto });
      });
      onPhoto?.(dataUrl);
    });
  });
}
