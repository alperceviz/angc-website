/** Yeni olay / talep kaydı. */
import * as db from "../core/db.js";
import * as bus from "../core/bus.js";
import { el, qs, formData, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  fieldText,
  fieldTextarea,
  fieldSelect,
  fieldOptions,
  fieldPhoto,
  wireFields,
  banner,
} from "../ui/components.js";
import { esc, unitLabel, INCIDENT_TYPES } from "../util/format.js";

/** Sakinlerin açtığı kayıtlarda anlamlı olan türler. */
const RESIDENT_TYPES = ["technical", "cleaning", "noise", "parking", "security", "other"];

export default {
  title: (ctx) => (ctx.user.role === "resident" ? "Talep aç" : "Olay bildir"),
  live: false,

  async render(ctx) {
    const resident = ctx.user.role === "resident";
    const site = db.raw().site;
    const types = Object.entries(INCIDENT_TYPES).filter(([k]) =>
      resident ? RESIDENT_TYPES.includes(k) : true
    );
    const root = el("<form novalidate></form>");

    root.innerHTML = `
      <div class="field">
        <span class="field__label">Konu türü</span>
        <div class="grid grid-3" data-typegrid>
          ${types
            .map(
              ([k, v]) => `<button class="tile" type="button" data-type="${k}"
                style="min-height:78px;align-items:center;text-align:center" aria-pressed="false">
                <span class="tile__icon">${icon(v.icon)}</span>
                <span class="tile__label" style="font-size:12px">${esc(v.label)}</span>
              </button>`
            )
            .join("")}
        </div>
        <input type="hidden" name="type" value="technical" />
      </div>

      ${fieldText({
        name: "title",
        label: "Kısa başlık",
        placeholder: resident ? "Örn. Mutfak lavabosu tıkalı" : "Örn. Otopark aydınlatması arızalı",
        required: true,
      })}

      ${fieldOptions({
        name: "priority",
        label: "Aciliyet",
        value: "normal",
        options: [
          ["low", "Düşük"],
          ["normal", "Normal"],
          ["high", "Yüksek"],
          ["critical", "ACİL", "danger"],
        ],
      })}
      <div id="criticalnote"></div>

      ${
        resident
          ? `<div class="card card--flat" style="margin-bottom:13px">
              <div class="faint tiny">KONUM</div>
              <div class="strong">${esc(unitLabel(ctx.user.block, ctx.user.unit))} · ${esc(
              site.name
            )}</div>
            </div>`
          : `<div class="row" style="gap:10px;align-items:flex-start">
              <div style="flex:1">${fieldSelect({
                name: "block",
                label: "Konum",
                options: [["-", "Ortak alan"], ...site.blocks.map((b) => [b, b + " Blok"])],
              })}</div>
              <div style="flex:1">${fieldText({
                name: "unit",
                label: "Daire (varsa)",
                placeholder: "12",
                inputmode: "numeric",
              })}</div>
            </div>`
      }

      ${fieldTextarea({
        name: "body",
        label: "Açıklama",
        placeholder: "Ne oldu, ne zaman fark edildi, nerede? Mümkün olduğunca somut yazın.",
        rows: 5,
      })}

      ${fieldPhoto({})}

      <button class="btn btn--block btn--primary" type="button" data-act="save">
        ${icon("check")} Kaydı gönder
      </button>
      <button class="btn btn--block btn--ghost" type="button" data-act="cancel" style="margin-top:8px">
        Vazgeç
      </button>`;

    wireFields(root);

    // Tür seçimi
    const grid = qs("[data-typegrid]", root);
    const hidden = qs('[name="type"]', root);
    const selectType = (key) => {
      hidden.value = key;
      grid.querySelectorAll("[data-type]").forEach((b) => {
        const on = b.dataset.type === key;
        b.setAttribute("aria-pressed", String(on));
        b.style.borderColor = on ? "var(--accent)" : "";
        b.style.background = on ? "var(--accent-soft)" : "";
      });
    };
    grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) selectType(b.dataset.type);
    });
    selectType("technical");

    // ACİL seçilirse uyarı
    root.addEventListener("optionchange", () => {
      const v = qs('[name="priority"]', root).value;
      qs("#criticalnote", root).innerHTML =
        v === "critical"
          ? banner(
              "ACİL seçtiğinizde görevlilerin telefonunda sesli alarm çalar. Lütfen yalnızca gerçek acil durumlarda kullanın.",
              "danger",
              "siren"
            ) + '<div style="height:12px"></div>'
          : "";
    });

    actions(root, {
      cancel: () => history.back(),
      save: () => save(ctx, root, resident),
    });

    return root;
  },
};

function save(ctx, root, resident) {
  const f = formData(root);
  if (!f.title.trim()) return ctx.toast.err("Başlık gerekli.");

  const rec = db.insert("incidents", {
    type: f.type,
    title: f.title.trim(),
    body: f.body.trim(),
    priority: f.priority,
    status: "open",
    block: resident ? ctx.user.block : f.block,
    unit: resident ? ctx.user.unit : (f.unit || "").trim(),
    reporterId: ctx.user.id,
    photo: f.photo || "",
    at: db.nowIso(),
    updates: [],
  });

  db.log({
    kind: "incident",
    by: ctx.user.name,
    text: `Yeni kayıt: ${rec.title} (${INCIDENT_TYPES[rec.type]?.label || rec.type}, ${
      rec.priority
    })`,
  });

  ctx.pushNotification({
    to: resident ? "guard" : "admin",
    kind: "incident",
    title: rec.priority === "critical" ? "ACİL kayıt açıldı" : "Yeni olay kaydı",
    body: `${rec.title} — ${unitLabel(rec.block, rec.unit)}`,
    link: `/incidents/${rec.id}`,
  });

  if (rec.priority === "critical") {
    bus.emit("panic", {
      from: ctx.user.name,
      userId: ctx.user.id,
      where: `${unitLabel(rec.block, rec.unit)} · ${db.raw().site.name}`,
      note: rec.title,
      phone: ctx.user.phone,
      incidentId: rec.id,
    });
  }

  ctx.toast.ok("Kaydınız iletildi.");
  ctx.navigate(`/incidents/${rec.id}`, { replace: true });
}
