/** Duyurular — yönetim ve güvenlik yayınlar, herkes okur. */
import * as db from "../core/db.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  empty,
  badge,
  fieldText,
  fieldTextarea,
  fieldOptions,
  switchRow,
  wireFields,
} from "../ui/components.js";
import { esc, timeAgo, fmtDateTime } from "../util/format.js";

const LEVELS = {
  info: { label: "Bilgi", tone: "info", icon: "info" },
  warn: { label: "Önemli", tone: "warn", icon: "alert" },
  urgent: { label: "Acil", tone: "danger", icon: "siren" },
};

export default {
  title: "Duyurular",
  live: true,
  action: (ctx) =>
    ctx.user.role === "resident"
      ? null
      : { icon: "plus", label: "Duyuru yayınla", onClick: (c) => publishFlow(c) },

  async render(ctx) {
    const staff = ctx.user.role !== "resident";
    const root = el("<div></div>");

    function draw() {
      const list = db
        .list("announcements")
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.at) - new Date(a.at));
      root.innerHTML = `
        ${
          staff
            ? `<button class="btn btn--block btn--primary" type="button" data-act="new">
                ${icon("megaphone")} Yeni duyuru yayınla
              </button><div style="height:14px"></div>`
            : ""
        }
        ${
          list.length
            ? list.map((a) => card(a, staff)).join("")
            : empty("Duyuru yok", "Yayınlanan duyurular burada görünür.", "megaphone")
        }`;
    }

    actions(root, {
      new: () => publishFlow(ctx).then(draw),
      pin: (n) => {
        const a = db.find("announcements", n.dataset.id);
        db.update("announcements", a.id, { pinned: !a.pinned });
        draw();
      },
      del: async (n) => {
        const ok = await ctx.confirm({
          title: "Duyuruyu sil",
          desc: "Bu işlem geri alınamaz.",
          confirmLabel: "Sil",
          variant: "danger",
        });
        if (!ok) return;
        db.remove("announcements", n.dataset.id);
        ctx.toast.ok("Duyuru silindi.");
        draw();
      },
    });

    draw();
    return root;
  },
};

function card(a, staff) {
  const lv = LEVELS[a.level] || LEVELS.info;
  return `<div class="card ${a.pinned ? "card--accent" : ""}" style="margin-bottom:10px">
    <div class="card__head">
      <span class="tile__icon">${icon(lv.icon)}</span>
      <div class="card__title">${esc(a.title)}
        <div class="faint">${esc(a.author)} · ${esc(timeAgo(a.at))}</div>
      </div>
      ${a.pinned ? badge("Sabit", "warn") : ""}
    </div>
    <p class="muted">${esc(a.body)}</p>
    <div class="row" style="margin-top:10px;gap:6px">
      ${badge(lv.label, lv.tone)}
      <span class="faint tiny">${esc(fmtDateTime(a.at))}</span>
      <span class="spacer"></span>
      ${
        staff
          ? `<button class="btn btn--sm btn--ghost" type="button" data-act="pin" data-id="${esc(
              a.id
            )}">${a.pinned ? "Sabiti kaldır" : "Sabitle"}</button>
             <button class="btn btn--sm btn--ghost" type="button" data-act="del" data-id="${esc(
               a.id
             )}" style="color:var(--danger)">${icon("trash")}</button>`
          : ""
      }
    </div>
  </div>`;
}

async function publishFlow(ctx) {
  const res = await ctx.sheet({
    title: "Duyuru yayınla",
    desc: "Duyuru tüm sakinlere ve görevlilere anında iletilir.",
    body: `
      ${fieldText({ name: "title", label: "Başlık", placeholder: "Örn. Salı günü su kesintisi" })}
      ${fieldTextarea({
        name: "body",
        label: "Metin",
        rows: 5,
        placeholder: "Ne, ne zaman, kimleri etkiliyor?",
      })}
      ${fieldOptions({
        name: "level",
        label: "Önem",
        value: "info",
        options: [
          ["info", "Bilgi"],
          ["warn", "Önemli"],
          ["urgent", "Acil", "danger"],
        ],
      })}
      ${switchRow({ name: "pinned", label: "Ana ekranda sabitle", desc: "Sakinlerin ana ekranında öne çıkar." })}`,
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Yayınla", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      wireFields(box);
      box.querySelector('[data-keep="1"]').addEventListener("click", () => {
        close({
          title: qs('[name="title"]', box).value.trim(),
          body: qs('[name="body"]', box).value.trim(),
          level: qs('[name="level"]', box).value,
          pinned: qs("[data-switch]", box).getAttribute("aria-checked") === "true",
        });
      });
    },
  });
  if (!res) return;
  if (!res.title) return ctx.toast.err("Başlık gerekli.");

  const rec = db.insert("announcements", {
    ...res,
    author: ctx.user.name,
    at: db.nowIso(),
  });
  db.log({ kind: "announcement", by: ctx.user.name, text: `Duyuru yayınlandı: ${rec.title}` });
  ctx.pushNotification({
    to: "all",
    kind: "announcement",
    title: rec.level === "urgent" ? "ACİL DUYURU" : "Yeni duyuru",
    body: rec.title,
    link: "/announcements",
  });
  ctx.toast.ok("Duyuru yayınlandı.");
}
