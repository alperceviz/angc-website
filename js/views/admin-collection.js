/**
 * Şema güdümlü kayıt düzenleyici.
 *
 * Kullanıcılar, devriye noktaları, tesisler ve rehber aynı ekranı paylaşır;
 * aralarındaki tek fark aşağıdaki şema tanımlarıdır.
 */
import * as db from "../core/db.js";
import { el, qs, qsa, formData, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  listItem,
  badge,
  empty,
  banner,
  fieldText,
  fieldTextarea,
  fieldSelect,
} from "../ui/components.js";
import { esc, normalizePlate } from "../util/format.js";

const ICON_CHOICES = [
  ["waves", "Havuz / su"],
  ["dumbbell", "Spor salonu"],
  ["activity", "Kort / aktivite"],
  ["users", "Salon / toplantı"],
  ["car", "Otopark"],
  ["building", "Bina"],
  ["shield", "Güvenlik"],
  ["tool", "Teknik"],
  ["phone", "Telefon"],
  ["siren", "Acil"],
  ["flame", "Yangın"],
  ["droplet", "Su"],
  ["zap", "Elektrik"],
  ["user", "Kişi"],
  ["info", "Diğer"],
];

const blockOptions = () =>
  (db.raw().site.blocks || []).map((b) => [b, `${b} Blok`]);

/** @type {Record<string, object>} */
const SCHEMAS = {
  users: {
    title: "Kullanıcılar",
    singular: "Kullanıcı",
    note:
      "PIN'ler bu tanıtım kurulumunda cihazda saklanır. Gerçek kullanımda kimlik doğrulama sunucuya taşınmalıdır.",
    sort: (a, b) =>
      ["admin", "guard", "resident"].indexOf(a.role) -
        ["admin", "guard", "resident"].indexOf(b.role) || a.name.localeCompare(b.name, "tr"),
    itemIcon: (r) => ({ guard: "shield", admin: "building", resident: "home" }[r.role] || "user"),
    itemTitle: (r) => r.name,
    itemSub: (r) =>
      [
        { guard: "Güvenlik görevlisi", admin: "Yönetim", resident: "Sakin" }[r.role],
        r.role === "resident" && r.unit ? `${r.block}-${r.unit}` : "",
        r.badge,
        r.phone,
      ]
        .filter(Boolean)
        .join(" · "),
    fields: [
      { name: "name", label: "Ad soyad", type: "text", required: true },
      {
        name: "role",
        label: "Rol",
        type: "select",
        options: [
          ["resident", "Site sakini"],
          ["guard", "Güvenlik görevlisi"],
          ["admin", "Site yönetimi"],
        ],
        reactive: true,
      },
      { name: "phone", label: "Telefon", type: "tel" },
      {
        name: "block",
        label: "Blok",
        type: "select",
        options: blockOptions,
        when: (v) => v.role === "resident",
      },
      {
        name: "unit",
        label: "Daire no",
        type: "text",
        inputmode: "numeric",
        when: (v) => v.role === "resident",
      },
      {
        name: "badge",
        label: "Sicil / görev kodu",
        type: "text",
        placeholder: "GRV-04",
        when: (v) => v.role === "guard",
      },
      { name: "title", label: "Ünvan", type: "text", placeholder: "Vardiya Amiri" },
      {
        name: "pin",
        label: "PIN (4 hane)",
        type: "text",
        inputmode: "numeric",
        maxlength: 4,
        hint: "Kullanıcının giriş ekranında gireceği kod.",
      },
    ],
    defaults: () => ({ role: "resident", pin: "1234", title: "" }),
    validate: (v) => {
      if (!v.name.trim()) return "Ad soyad gerekli.";
      if (!/^\d{4}$/.test(String(v.pin || ""))) return "PIN 4 haneli olmalı.";
      if (v.role === "resident" && !String(v.unit || "").trim())
        return "Sakin için daire numarası gerekli.";
      return null;
    },
    normalize: (v) => ({
      ...v,
      title:
        v.title?.trim() ||
        { guard: "Güvenlik Görevlisi", admin: "Site Yöneticisi", resident: "Sakin" }[v.role],
      block: v.role === "resident" ? v.block : "",
      unit: v.role === "resident" ? String(v.unit || "").trim() : "",
      badge: v.role === "guard" ? v.badge : "",
    }),
    canDelete: (rec, currentUserId) => {
      if (rec.id === currentUserId) return "Kendi hesabınızı silemezsiniz.";
      if (rec.role === "admin" && db.list("users", (u) => u.role === "admin").length <= 1)
        return "Son yönetici hesabı silinemez.";
      return null;
    },
  },

  checkpoints: {
    title: "Devriye Noktaları",
    singular: "Kontrol noktası",
    note:
      "Her noktaya bir kod verin ve o kodu noktadaki etikete yazın. Görevli turda kodu girerek noktayı doğrular.",
    sort: (a, b) => (a.order || 0) - (b.order || 0),
    itemIcon: () => "pin",
    itemTitle: (r) => r.name,
    itemSub: (r) => `${r.zone || "—"} · Kod ${r.code}`,
    itemBadge: (r) => badge(`#${r.order}`, ""),
    fields: [
      { name: "name", label: "Nokta adı", type: "text", required: true, placeholder: "A Blok Girişi" },
      { name: "zone", label: "Bölge", type: "text", placeholder: "A Blok" },
      {
        name: "code",
        label: "Nokta kodu (4 hane)",
        type: "text",
        inputmode: "numeric",
        maxlength: 4,
      },
      { name: "order", label: "Tur sırası", type: "number" },
    ],
    defaults: () => ({
      order: db.list("checkpoints").reduce((m, c) => Math.max(m, c.order || 0), 0) + 1,
      code: String(1000 + db.list("checkpoints").length + 1),
    }),
    validate: (v) => {
      if (!v.name.trim()) return "Nokta adı gerekli.";
      if (!/^\d{4}$/.test(String(v.code || ""))) return "Nokta kodu 4 haneli olmalı.";
      return null;
    },
    normalize: (v) => ({ ...v, order: Number(v.order) || 1 }),
  },

  amenities: {
    title: "Sosyal Tesisler",
    singular: "Tesis",
    note: "Çalışma saatleri “08:00 – 21:00” biçiminde yazılmalı; rezervasyon saatleri buradan üretilir.",
    sort: (a, b) => a.name.localeCompare(b.name, "tr"),
    itemIcon: (r) => r.icon || "waves",
    itemTitle: (r) => r.name,
    itemSub: (r) => `${r.hours} · ${r.capacity} kişi · ${r.slotMinutes} dk dilim`,
    fields: [
      { name: "name", label: "Tesis adı", type: "text", required: true, placeholder: "Yüzme Havuzu" },
      { name: "icon", label: "Simge", type: "select", options: ICON_CHOICES },
      {
        name: "hours",
        label: "Çalışma saatleri",
        type: "text",
        placeholder: "08:00 – 21:00",
      },
      { name: "capacity", label: "Aynı anda kaç kişi", type: "number" },
      {
        name: "slotMinutes",
        label: "Rezervasyon dilimi",
        type: "select",
        options: [
          ["30", "30 dakika"],
          ["60", "1 saat"],
          ["90", "1,5 saat"],
          ["120", "2 saat"],
        ],
      },
      { name: "note", label: "Kural notu", type: "textarea", placeholder: "Bone zorunludur." },
    ],
    defaults: () => ({ icon: "waves", hours: "08:00 – 21:00", capacity: 10, slotMinutes: "60" }),
    validate: (v) => {
      if (!v.name.trim()) return "Tesis adı gerekli.";
      if (!/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(v.hours || ""))
        return "Saatleri “08:00 – 21:00” biçiminde yazın.";
      return null;
    },
    normalize: (v) => ({
      ...v,
      capacity: Number(v.capacity) || 1,
      slotMinutes: Number(v.slotMinutes) || 60,
    }),
  },

  contacts: {
    title: "Telefon Rehberi",
    singular: "Numara",
    note: "Acil grubundaki numaralar rehberde kırmızı şeritle en üstte gösterilir.",
    sort: (a, b) =>
      ["Acil", "Site", "Arıza"].indexOf(a.group) - ["Acil", "Site", "Arıza"].indexOf(b.group) ||
      a.name.localeCompare(b.name, "tr"),
    itemIcon: (r) => r.icon || "phone",
    itemTitle: (r) => r.name,
    itemSub: (r) => `${r.group} · ${r.phone}${r.note ? " · " + r.note : ""}`,
    fields: [
      { name: "name", label: "Ad", type: "text", required: true, placeholder: "Teknik Servis" },
      { name: "phone", label: "Telefon", type: "tel", required: true },
      {
        name: "group",
        label: "Grup",
        type: "select",
        options: [
          ["Site", "Site içi"],
          ["Acil", "Acil numaralar"],
          ["Arıza", "Arıza hatları"],
        ],
      },
      { name: "icon", label: "Simge", type: "select", options: ICON_CHOICES },
      { name: "note", label: "Açıklama", type: "text", placeholder: "Hafta içi 09:00–18:00" },
    ],
    defaults: () => ({ group: "Site", icon: "phone" }),
    validate: (v) => {
      if (!v.name.trim()) return "Ad gerekli.";
      if (!String(v.phone || "").trim()) return "Telefon gerekli.";
      return null;
    },
  },
};

export default {
  title: (ctx) => SCHEMAS[ctx.params.name]?.title || "Kayıtlar",
  subtitle: "Yönetim paneli",
  live: true,
  action: (ctx) =>
    SCHEMAS[ctx.params.name]
      ? { icon: "plus", label: "Yeni kayıt", onClick: (c) => openForm(c, ctx.params.name, null) }
      : null,

  async render(ctx) {
    const name = ctx.params.name;
    const schema = SCHEMAS[name];
    const root = el("<div></div>");

    if (!schema) {
      root.innerHTML = empty("Bilinmeyen bölüm", esc(name), "search");
      return root;
    }

    function draw() {
      const rows = db.list(name).sort(schema.sort || (() => 0));
      root.innerHTML = `
        <button class="btn btn--block btn--primary" type="button" data-act="new">
          ${icon("plus")} ${esc(schema.singular)} ekle
        </button>
        ${schema.note ? `<div style="height:12px"></div>${banner(schema.note, "", "info")}` : ""}
        <div style="height:12px"></div>
        ${
          rows.length
            ? `<div class="list">${rows
                .map((r) =>
                  listItem({
                    icon: schema.itemIcon(r),
                    title: schema.itemTitle(r),
                    sub: schema.itemSub(r),
                    badges: schema.itemBadge ? schema.itemBadge(r) : "",
                    act: "edit",
                    data: { id: r.id },
                  })
                )
                .join("")}</div>`
            : empty("Kayıt yok", `İlk ${schema.singular.toLocaleLowerCase("tr")} kaydını ekleyin.`, "list")
        }`;
    }

    actions(root, {
      new: () => openForm(ctx, name, null).then(draw),
      edit: (n) => openForm(ctx, name, n.dataset.id).then(draw),
    });

    draw();
    return root;
  },
};

/* ------------------------------------------------------------------ */

function renderField(f, values) {
  const v = values[f.name] ?? "";
  let inner;
  if (f.type === "textarea") {
    inner = fieldTextarea({ name: f.name, label: f.label, value: v, placeholder: f.placeholder });
  } else if (f.type === "select") {
    const opts = typeof f.options === "function" ? f.options() : f.options;
    inner = fieldSelect({
      name: f.name,
      label: f.label,
      options: opts.length ? opts : [["", "—"]],
      value: v,
      hint: f.hint,
    });
  } else {
    inner = fieldText({
      name: f.name,
      label: f.label,
      value: v,
      type: f.type === "tel" ? "tel" : f.type === "number" ? "number" : "text",
      placeholder: f.placeholder || "",
      inputmode: f.inputmode || "",
      maxlength: f.maxlength || "",
      hint: f.hint || "",
      required: f.required,
    });
  }
  return `<div data-fieldwrap="${f.name}">${inner}</div>`;
}

async function openForm(ctx, name, id) {
  const schema = SCHEMAS[name];
  const existing = id ? db.find(name, id) : null;
  let values = existing ? { ...existing } : { ...schema.defaults?.() };
  schema.fields.forEach((f) => {
    if (values[f.name] === undefined) values[f.name] = "";
  });

  const res = await ctx.sheet({
    title: existing ? `${schema.singular} düzenle` : `${schema.singular} ekle`,
    body: `
      <div id="fields">${schema.fields.map((f) => renderField(f, values)).join("")}</div>
      <div id="formerr"></div>
      ${
        existing
          ? `<button class="btn btn--block btn--ghost" type="button" data-del
              style="margin-top:6px;color:var(--danger)">${icon("trash")} Bu kaydı sil</button>`
          : ""
      }`,
    actions: [
      { label: "Vazgeç", value: null },
      { label: existing ? "Kaydet" : "Ekle", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      const sync = () => {
        const v = formData(box);
        schema.fields.forEach((f) => {
          if (!f.when) return;
          const wrap = qs(`[data-fieldwrap="${f.name}"]`, box);
          if (wrap) wrap.classList.toggle("hidden", !f.when(v));
        });
      };
      qsa("select, input", box).forEach((elm) => {
        elm.addEventListener("change", sync);
        elm.addEventListener("input", sync);
      });
      sync();

      box.querySelector('[data-keep="1"]').addEventListener("click", () => {
        const v = formData(box);
        const err = schema.validate?.(v);
        if (err) {
          qs("#formerr", box).innerHTML = banner(err, "danger", "alert");
          return;
        }
        close({ action: "save", values: v });
      });

      box.querySelector("[data-del]")?.addEventListener("click", () =>
        close({ action: "delete" })
      );
    },
  });

  if (!res) return;

  if (res.action === "delete") {
    const blocked = schema.canDelete?.(existing, ctx.user.id);
    if (blocked) return ctx.toast.err(blocked);
    const ok = await ctx.confirm({
      title: `${schema.singular} silinsin mi?`,
      desc: schema.itemTitle(existing),
      confirmLabel: "Sil",
      variant: "danger",
    });
    if (!ok) return;
    db.remove(name, id);
    db.log({ kind: "info", by: ctx.user.name, text: `${schema.singular} silindi: ${schema.itemTitle(existing)}` });
    ctx.toast.ok("Kayıt silindi.");
    return;
  }

  const clean = schema.normalize ? schema.normalize(res.values) : res.values;
  if (clean.plate) clean.plate = normalizePlate(clean.plate);

  if (existing) {
    db.update(name, id, clean);
    db.log({ kind: "info", by: ctx.user.name, text: `${schema.singular} güncellendi: ${clean.name}` });
    ctx.toast.ok("Kaydedildi.");
  } else {
    db.insert(name, clean);
    db.log({ kind: "info", by: ctx.user.name, text: `${schema.singular} eklendi: ${clean.name}` });
    ctx.toast.ok("Eklendi.");
  }
}
