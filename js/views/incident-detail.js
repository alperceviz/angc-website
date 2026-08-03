/** Olay kaydı ayrıntısı ve durum yönetimi. */
import * as db from "../core/db.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { badge, kv, sectionTitle, banner, fieldTextarea } from "../ui/components.js";
import { canView } from "./incidents.js";
import {
  esc,
  fmtDateTime,
  timeAgo,
  unitLabel,
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  PRIORITY,
} from "../util/format.js";

export default {
  title: "Olay kaydı",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");
    const id = ctx.params.id;

    function draw() {
      const i = db.find("incidents", id);
      if (!i) {
        root.innerHTML = `<div class="empty">${icon("search", { size: 42 })}
          <div class="empty__title">Kayıt bulunamadı</div></div>`;
        return;
      }
      // Doğrudan bağlantıyla açılan kayıtlar da liste ekranıyla aynı
      // görünürlük kuralına tabidir.
      if (!canView(ctx.user, i)) {
        root.innerHTML = `<div class="empty">${icon("lock", { size: 42 })}
          <div class="empty__title">Bu kayda erişiminiz yok</div>
          <div class="empty__desc">Yalnızca kendi talepleriniz ile site genelini
          ilgilendiren açık kayıtları görüntüleyebilirsiniz.</div></div>`;
        return;
      }
      const staff = ctx.user.role !== "resident";
      const mine = i.reporterId === ctx.user.id;
      const st = INCIDENT_STATUS[i.status];
      const ty = INCIDENT_TYPES[i.type] || INCIDENT_TYPES.other;
      const pr = PRIORITY[i.priority];
      const reporter = db.find("users", i.reporterId);

      root.innerHTML = `
        <div class="card ${i.priority === "critical" ? "card--danger" : ""}">
          <div class="card__head">
            <span class="tile__icon">${icon(ty.icon)}</span>
            <div class="card__title">${esc(i.title)}
              <div class="faint">${esc(ty.label)} · ${esc(timeAgo(i.at))}</div>
            </div>
          </div>
          <div class="row row--wrap" style="gap:6px;margin-bottom:10px">
            ${badge(st.label, st.tone)}
            ${badge("Öncelik: " + pr.label, pr.tone)}
          </div>
          ${i.body ? `<p class="muted">${esc(i.body)}</p>` : ""}
          ${
            i.photo
              ? `<img class="thumb" src="${i.photo}" alt="Olay fotoğrafı" style="margin-top:12px" />`
              : ""
          }
        </div>

        <div class="card">
          ${kv("Konum", esc(i.block === "-" ? "Ortak alan" : unitLabel(i.block, i.unit)))}
          ${kv("Bildiren", esc(staff || mine ? reporter?.name || "—" : "Site sakini"))}
          ${kv("Kayıt zamanı", esc(fmtDateTime(i.at)))}
          ${i.resolvedAt ? kv("Çözüm", esc(fmtDateTime(i.resolvedAt))) : ""}
        </div>

        ${
          staff
            ? `${sectionTitle("Durum")}
              <div class="optionrow" data-statusrow>
                ${Object.entries(INCIDENT_STATUS)
                  .map(
                    ([k, v]) =>
                      `<button class="option" type="button" data-status="${k}"
                        aria-pressed="${i.status === k}">${esc(v.label)}</button>`
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${sectionTitle("İşlem geçmişi")}
        <div class="card card--flat">
          <div class="timeline">
            <div class="tl tl--accent">
              <div class="tl__time">${esc(fmtDateTime(i.at))}</div>
              <div class="tl__text">Kayıt açıldı — ${esc(
                staff || mine ? reporter?.name || "—" : "site sakini"
              )}</div>
            </div>
            ${(i.updates || [])
              .map(
                (u) => `<div class="tl">
                  <div class="tl__time">${esc(fmtDateTime(u.at))} · ${esc(u.by)}</div>
                  <div class="tl__text">${esc(u.text)}</div>
                </div>`
              )
              .join("")}
            ${
              i.status === "resolved"
                ? `<div class="tl tl--ok"><div class="tl__time">${esc(
                    fmtDateTime(i.resolvedAt || i.updatedAt || i.at)
                  )}</div><div class="tl__text">Kayıt çözüldü olarak kapatıldı.</div></div>`
                : ""
            }
          </div>
        </div>

        ${
          staff || mine
            ? `<button class="btn btn--block" type="button" data-act="note" style="margin-top:14px">
                ${icon("message")} Not ekle
              </button>`
            : ""
        }
        ${
          staff && i.status !== "resolved"
            ? `<button class="btn btn--block btn--primary" type="button" data-act="resolve" style="margin-top:8px">
                ${icon("check")} Çözüldü olarak kapat
              </button>`
            : ""
        }
        ${
          !staff && mine && i.status !== "resolved"
            ? banner(
                "Talebiniz güvenlik ve yönetime iletildi. Durum değiştikçe bildirim alacaksınız.",
                "info",
                "info"
              )
            : ""
        }`;

      // Durum düğmeleri
      qs("[data-statusrow]", root)?.addEventListener("click", (e) => {
        const b = e.target.closest("[data-status]");
        if (!b || b.dataset.status === i.status) return;
        setStatus(ctx, i, b.dataset.status);
        draw();
      });
    }

    actions(root, {
      note: () => addNote(ctx, id, draw),
      resolve: () => {
        setStatus(ctx, db.find("incidents", id), "resolved");
        draw();
      },
    });

    draw();
    return root;
  },
};

function setStatus(ctx, i, status) {
  if (!i) return;
  const patch = { status };
  if (status === "resolved") patch.resolvedAt = db.nowIso();
  db.update("incidents", i.id, patch);
  db.log({
    kind: "incident",
    by: ctx.user.name,
    text: `Durum güncellendi: ${i.title} → ${INCIDENT_STATUS[status].label}`,
  });
  if (i.reporterId && i.reporterId !== ctx.user.id)
    ctx.pushNotification({
      to: i.reporterId,
      kind: "incident",
      title: "Talebiniz güncellendi",
      body: `${i.title} → ${INCIDENT_STATUS[status].label}`,
      link: `/incidents/${i.id}`,
    });
  ctx.toast.ok("Durum güncellendi.");
}

async function addNote(ctx, id, redraw) {
  const text = await ctx.sheet({
    title: "Not ekle",
    desc: "Bu not kaydın işlem geçmişine eklenir ve ilgili taraflara görünür.",
    body: fieldTextarea({ name: "note", label: "Not", rows: 4, placeholder: "Ne yapıldı?" }),
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Ekle", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      box.querySelector('[data-keep="1"]').addEventListener("click", () => {
        close(box.querySelector('[name="note"]').value.trim());
      });
    },
  });
  if (!text) return;
  const i = db.find("incidents", id);
  db.update("incidents", id, {
    updates: [...(i.updates || []), { at: db.nowIso(), by: ctx.user.name, text }],
  });
  if (i.reporterId && i.reporterId !== ctx.user.id)
    ctx.pushNotification({
      to: i.reporterId,
      kind: "incident",
      title: "Talebinize not eklendi",
      body: text.slice(0, 90),
      link: `/incidents/${id}`,
    });
  ctx.toast.ok("Not eklendi.");
  redraw();
}
