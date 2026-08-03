/** Site bilgileri ve marka ayarları. */
import * as db from "../core/db.js";
import { applyBrand, DEFAULT_ACCENT, DEFAULT_BRAND_NAME } from "../core/brand.js";
import { el, qs, formData, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { fieldText, fieldTextarea, sectionTitle, banner } from "../ui/components.js";
import { esc } from "../util/format.js";

/** Hazır marka renkleri — özel renk de girilebilir. */
const SWATCHES = [
  ["#ffc800", "Sarı"],
  ["#ffb020", "Amber"],
  ["#56a8ff", "Mavi"],
  ["#35d08a", "Yeşil"],
  ["#ff6b6b", "Kırmızı"],
  ["#b388ff", "Mor"],
];

export default {
  title: "Site Bilgileri",
  live: false,

  async render(ctx) {
    const root = el("<form novalidate></form>");
    const s = db.raw().site || {};
    let blocks = [...(s.blocks || [])];
    let color = s.brandColor || DEFAULT_ACCENT;

    function draw() {
      root.innerHTML = `
        ${sectionTitle("Site")}
        ${fieldText({
          name: "name",
          label: "Site adı",
          value: s.name || "",
          placeholder: "Dünya Şehir Kartal",
          required: true,
        })}
        ${fieldText({
          name: "shortName",
          label: "Kısa ad",
          value: s.shortName || "",
          placeholder: "Dünya Şehir",
          hint: "Üst çubukta ve dar ekranlarda bu ad görünür.",
        })}
        ${fieldText({
          name: "address",
          label: "Adres",
          value: s.address || "",
          placeholder: "Kartal / İstanbul",
        })}

        ${sectionTitle("Telefonlar")}
        ${fieldText({
          name: "guardPhone",
          label: "Güvenlik kulübesi",
          value: s.guardPhone || "",
          type: "tel",
          inputmode: "tel",
          hint: "Sakinlerin “Güvenliği ara” düğmesi bu numarayı arar.",
        })}
        ${fieldText({
          name: "managerPhone",
          label: "Site yönetimi",
          value: s.managerPhone || "",
          type: "tel",
          inputmode: "tel",
        })}

        ${sectionTitle("Acil durum")}
        ${fieldTextarea({
          name: "assemblyPoint",
          label: "Toplanma alanı",
          value: s.assemblyPoint || "",
          rows: 2,
          placeholder: "Örn. Ana kapı karşısı — açık otopark alanı",
          hint: "Acil durum ekranında ve yangın/deprem protokollerinde gösterilir.",
        })}

        ${sectionTitle("Bloklar")}
        <div class="card">
          <div class="row row--wrap" style="gap:7px" id="blocklist">
            ${
              blocks.length
                ? blocks
                    .map(
                      (b) => `<span class="chip chip--on">${esc(b)}
                        <button type="button" data-act="delBlock" data-b="${esc(b)}"
                          style="background:none;border:0;color:inherit;cursor:pointer;padding:0;display:flex">
                          ${icon("x", { size: 14 })}
                        </button></span>`
                    )
                    .join("")
                : '<span class="faint">Henüz blok eklenmedi.</span>'
            }
          </div>
          <div class="row" style="gap:8px;margin-top:12px">
            <input class="input" id="newblock" placeholder="Blok adı (örn. A1)" style="flex:1" />
            <button class="btn btn--sm btn--primary" type="button" data-act="addBlock">
              ${icon("plus")} Ekle
            </button>
          </div>
          <div class="field__hint" style="margin-top:8px">
            Bloklar; ziyaretçi, kargo ve olay kayıtlarındaki konum listelerini besler.
          </div>
        </div>

        ${sectionTitle("Marka")}
        ${fieldText({
          name: "brandName",
          label: "Uygulama adı",
          value: s.brandName || DEFAULT_BRAND_NAME,
          placeholder: DEFAULT_BRAND_NAME,
          hint: "Giriş ekranında ve uygulama içinde görünen ürün adı (beyaz etiket kurulumları için).",
        })}
        <div class="card">
          <div class="field__label">Vurgu rengi</div>
          <div class="row row--wrap" style="gap:9px;margin-bottom:12px" id="swatches">
            ${SWATCHES.map(
              ([hex, label]) => `<button type="button" class="chip" data-act="swatch" data-hex="${hex}"
                aria-pressed="${color.toLowerCase() === hex}" title="${esc(label)}">
                <span style="width:14px;height:14px;border-radius:4px;background:${hex};
                  border:1px solid rgba(0,0,0,.25)"></span>${esc(label)}
              </button>`
            ).join("")}
          </div>
          <div class="row" style="gap:10px">
            <input type="color" name="brandColor" value="${esc(color)}"
              style="width:56px;height:44px;border-radius:12px;border:1px solid var(--line-strong);background:var(--surface-2);padding:4px" />
            <div class="spacer">
              <div class="strong mono" id="hexlabel">${esc(color)}</div>
              <div class="faint tiny">Düğmeler, sekmeler ve vurgular bu rengi kullanır.</div>
            </div>
          </div>
        </div>

        ${banner(
          "Uygulama simgesi ve ana ekran adı işletim sistemi tarafından kurulum anında alınır; bunları değiştirmek için <code>manifest.webmanifest</code> ve <code>assets/</code> altındaki ikonlar güncellenmelidir.",
          "",
          "info"
        )}

        <button class="btn btn--block btn--primary" type="button" data-act="save" style="margin-top:16px">
          ${icon("check")} Kaydet
        </button>`;

      // Renk seçici canlı önizleme
      const picker = qs('[name="brandColor"]', root);
      picker.addEventListener("input", () => {
        color = picker.value;
        qs("#hexlabel", root).textContent = color;
        root.querySelectorAll("[data-hex]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.hex === color.toLowerCase()))
        );
        preview(color);
      });

      qs("#newblock", root).addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addBlock();
        }
      });
    }

    /** Kaydetmeden önce rengi geçici olarak uygular. */
    function preview(hex) {
      db.raw().site.brandColor = hex;
      applyBrand();
    }

    function addBlock() {
      const input = qs("#newblock", root);
      const v = input.value.trim().toLocaleUpperCase("tr");
      if (!v) return;
      if (blocks.includes(v)) return ctx.toast.err("Bu blok zaten var.");
      blocks.push(v);
      draw();
    }

    actions(root, {
      addBlock,
      delBlock: (n) => {
        blocks = blocks.filter((b) => b !== n.dataset.b);
        draw();
      },
      swatch: (n) => {
        color = n.dataset.hex;
        draw();
        preview(color);
      },
      save: () => {
        const f = formData(root);
        if (!f.name.trim()) return ctx.toast.err("Site adı gerekli.");
        db.patchDoc("site", {
          name: f.name.trim(),
          shortName: f.shortName.trim() || f.name.trim(),
          address: f.address.trim(),
          guardPhone: f.guardPhone.trim(),
          managerPhone: f.managerPhone.trim(),
          assemblyPoint: f.assemblyPoint.trim(),
          brandName: f.brandName.trim() || DEFAULT_BRAND_NAME,
          brandColor: color,
          blocks,
        });
        applyBrand();
        db.log({ kind: "info", by: ctx.user.name, text: "Site bilgileri güncellendi." });
        ctx.toast.ok("Site bilgileri kaydedildi.");
        ctx.navigate("/admin");
      },
    });

    draw();
    return root;
  },
};
