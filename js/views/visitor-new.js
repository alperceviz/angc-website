/** Ziyaretçi kaydı / misafir bildirimi formu. */
import * as db from "../core/db.js";
import { el, qs, formData, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  fieldText,
  fieldSelect,
  fieldOptions,
  fieldTextarea,
  wireFields,
  banner,
  kv,
} from "../ui/components.js";
import { esc, normalizePlate, randomCode, unitLabel } from "../util/format.js";

const PURPOSES = [
  ["Misafir", "Misafir"],
  ["Kurye", "Kurye"],
  ["Usta", "Usta / servis"],
  ["Emlak", "Emlak / gösterim"],
  ["Diğer", "Diğer"],
];

export default {
  title: (ctx) => (ctx.user.role === "resident" ? "Misafir bildir" : "Ziyaretçi girişi"),
  live: false,

  async render(ctx) {
    const resident = ctx.user.role === "resident";
    const site = db.raw().site;
    const root = el('<form novalidate></form>');

    root.innerHTML = `
      ${
        resident
          ? banner(
              "Bildirdiğiniz misafire 6 haneli bir kapı kodu üretilir. Kodu misafirinize iletin; güvenlik kapıda sizi aramadan girişi kaydeder.",
              "info",
              "info"
            )
          : banner(
              "Kayıt anında ev sahibine bildirim gider. Kimlik ve plaka bilgisi nöbet defterine işlenir.",
              "",
              "shield"
            )
      }

      <div style="height:14px"></div>
      ${fieldText({
        name: "name",
        label: "Ziyaretçi adı soyadı",
        placeholder: "Örn. Kerem Aydın",
        required: true,
        autocomplete: "name",
      })}
      ${fieldOptions({ name: "purpose", label: "Geliş nedeni", options: PURPOSES, value: "Misafir" })}
      ${fieldText({
        name: "phone",
        label: "Telefon (isteğe bağlı)",
        type: "tel",
        placeholder: "05xx xxx xx xx",
        inputmode: "tel",
      })}
      ${fieldText({
        name: "plate",
        label: "Araç plakası (varsa)",
        placeholder: "34 ABC 123",
        cls: "input--plate",
        hint: "Araçla gelmiyorsa boş bırakın.",
      })}

      ${
        resident
          ? fieldText({
              name: "expected",
              label: "Beklenen saat (isteğe bağlı)",
              type: "datetime-local",
            })
          : `<div class="row" style="gap:10px;align-items:flex-start">
              <div style="flex:1">${fieldSelect({
                name: "block",
                label: "Blok",
                options: site.blocks.map((b) => [b, b + " Blok"]),
              })}</div>
              <div style="flex:1">${fieldText({
                name: "unit",
                label: "Daire no",
                placeholder: "12",
                inputmode: "numeric",
              })}</div>
            </div>
            <div id="hostinfo"></div>`
      }

      ${fieldTextarea({
        name: "note",
        label: "Not (isteğe bağlı)",
        placeholder: resident
          ? "Örn. Otoparka alabilirsiniz."
          : "Örn. Kimlik görüldü, misafir otoparkına yönlendirildi.",
        rows: 3,
      })}

      <button class="btn btn--block btn--primary" type="button" data-act="save" style="margin-top:6px">
        ${icon(resident ? "user-plus" : "door")}
        ${resident ? "Misafiri bildir ve kod üret" : "Girişi kaydet"}
      </button>
      <button class="btn btn--block btn--ghost" type="button" data-act="cancel" style="margin-top:8px">
        Vazgeç
      </button>`;

    wireFields(root);

    // Görevli daire yazdıkça ev sahibini gösterelim.
    if (!resident) {
      const update = () => {
        const f = formData(root);
        const host = findHost(f.block, f.unit);
        qs("#hostinfo", root).innerHTML = host
          ? `<div class="card card--flat" style="margin:-4px 0 13px">${kv(
              "Ev sahibi",
              esc(host.name)
            )}${kv("Telefon", `<a href="tel:${esc(host.phone)}">${esc(host.phone)}</a>`)}</div>`
          : f.unit
          ? banner("Bu daire için kayıtlı sakin bulunamadı.", "warn", "alert")
          : "";
      };
      qs('[name="unit"]', root).addEventListener("input", update);
      qs('[name="block"]', root).addEventListener("change", update);
    }

    actions(root, {
      cancel: () => history.back(),
      save: () => save(ctx, root, resident),
    });

    return root;
  },
};

function findHost(block, unit) {
  if (!unit) return null;
  return (
    db
      .list("users", (u) => u.role === "resident")
      .find(
        (u) =>
          String(u.block).toLocaleUpperCase("tr") === String(block).toLocaleUpperCase("tr") &&
          String(u.unit) === String(unit).trim()
      ) || null
  );
}

async function save(ctx, root, resident) {
  const f = formData(root);
  if (!f.name.trim()) return ctx.toast.err("Ziyaretçi adı gerekli.");

  const code = randomCode();
  const base = {
    name: f.name.trim(),
    phone: f.phone.trim(),
    plate: normalizePlate(f.plate),
    purpose: f.purpose || "Misafir",
    note: f.note.trim(),
    code,
  };

  let rec;
  if (resident) {
    rec = db.insert("visitors", {
      ...base,
      block: ctx.user.block,
      unit: ctx.user.unit,
      hostId: ctx.user.id,
      status: "expected",
      expectedAt: f.expected ? new Date(f.expected).toISOString() : "",
    });
    db.log({
      kind: "visitor",
      by: ctx.user.name,
      text: `Misafir bildirildi: ${rec.name} → ${unitLabel(rec.block, rec.unit)} (kod ${code})`,
    });
    ctx.pushNotification({
      to: "guard",
      kind: "visitor",
      title: "Yeni misafir bildirimi",
      body: `${unitLabel(rec.block, rec.unit)} — ${rec.name}${
        rec.plate ? " · " + rec.plate : ""
      } · Kod ${code}`,
      link: "/visitors",
    });
    await showCode(ctx, rec);
  } else {
    if (!f.unit?.trim()) return ctx.toast.err("Daire numarası gerekli.");
    const host = findHost(f.block, f.unit);
    rec = db.insert("visitors", {
      ...base,
      block: f.block,
      unit: f.unit.trim(),
      hostId: host?.id || "",
      status: "inside",
      enteredAt: db.nowIso(),
      byGuard: ctx.user.id,
    });
    db.log({
      kind: "visitor",
      by: ctx.user.name,
      text: `Ziyaretçi girişi: ${rec.name} → ${unitLabel(rec.block, rec.unit)}${
        rec.plate ? ` (${rec.plate})` : ""
      }`,
    });
    if (host)
      ctx.pushNotification({
        to: host.id,
        kind: "visitor",
        title: "Ziyaretçiniz geldi",
        body: `${rec.name} kapıdan giriş yaptı.`,
        link: "/visitors",
      });
    ctx.toast.ok("Giriş kaydedildi.");
  }
  ctx.navigate("/visitors");
}

async function showCode(ctx, rec) {
  await ctx.sheet({
    title: "Misafir kodu hazır",
    desc: "Bu kodu misafirinize iletin. Kapıda kodu söylemesi yeterli olacak.",
    body: `
      <div class="codebox">
        <div class="codebox__label">${esc(rec.name)} · ${esc(unitLabel(rec.block, rec.unit))}</div>
        <div class="codebox__code">${esc(rec.code)}</div>
      </div>
      <button class="btn btn--block" type="button" data-share style="margin-top:12px">
        ${icon("share")} Kodu paylaş
      </button>`,
    actions: [{ label: "Tamam", variant: "primary", value: 1 }],
    onMount(box) {
      box.querySelector("[data-share]").addEventListener("click", async () => {
        const text = `${db.raw().site.name} kapı kodunuz: ${rec.code} (${unitLabel(
          rec.block,
          rec.unit
        )} — ${ctx.user.name})`;
        try {
          if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            ctx.toast.ok("Kod panoya kopyalandı.");
          }
        } catch {
          /* kullanıcı vazgeçti */
        }
      });
    },
  });
}
