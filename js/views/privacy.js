/** Gizlilik: aydınlatma metni ve kişinin kendi verisi üzerindeki hakları. */
import * as db from "../core/db.js";
import * as privacy from "../core/privacy.js";
import { el, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, banner, kv, stat, empty, fieldTextarea } from "../ui/components.js";
import { downloadText } from "../util/media.js";
import { esc, fmtDateTime, timeAgo } from "../util/format.js";

export default {
  title: "Gizlilik ve Verilerim",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const n = privacy.notice();
      const r = privacy.retention();
      const mine = privacy.personalSummary(ctx.user.id);
      const requests = db
        .list("dataRequests", (x) => x.userId === ctx.user.id)
        .sort((a, b) => new Date(b.at) - new Date(a.at));
      const total = Object.values(mine).reduce((a, b) => a + b, 0);

      root.innerHTML = `
        ${sectionTitle("Hakkımda tutulan kayıtlar")}
        <div class="grid grid-2">
          ${stat(mine.visitors, "Ziyaretçi kaydı")}
          ${stat(mine.packages, "Kargo kaydı")}
          ${stat(mine.incidents, "Talep / olay")}
          ${stat(mine.vehicles + mine.bookings, "Araç ve rezervasyon")}
        </div>

        <div class="card" style="margin-top:10px">
          ${kv("Toplam kayıt", String(total))}
          ${kv(
            "Onay durumu",
            ctx.user.consent
              ? `Sürüm ${ctx.user.consent.version} · ${esc(fmtDateTime(ctx.user.consent.at))}`
              : '<span style="color:var(--warn)">Onay kaydı yok</span>'
          )}
        </div>

        ${sectionTitle("Haklarım (KVKK m.11)")}
        <div class="card">
          <p class="muted" style="margin-bottom:12px">
            Hakkınızda tutulan verilerin tam dökümünü indirebilir veya
            silinmesini talep edebilirsiniz. Silme talepleri site yönetimine
            iletilir ve sonuçlandırıldığında bildirim alırsınız.
          </p>
          <button class="btn btn--block" type="button" data-act="download">
            ${icon("download")} Verilerimin dökümünü indir
          </button>
          <button class="btn btn--block btn--ghost" type="button" data-act="delete"
            style="margin-top:8px;color:var(--danger)">
            ${icon("trash")} Verilerimin silinmesini talep et
          </button>
        </div>

        ${
          requests.length
            ? `${sectionTitle("Taleplerim")}
              <div class="list">
                ${requests
                  .map(
                    (q) => `<div class="item item--static">
                      <span class="item__avatar">${icon(q.type === "delete" ? "trash" : "eye")}</span>
                      <span class="item__body">
                        <span class="item__title">${
                          q.type === "delete" ? "Silme talebi" : "Erişim talebi"
                        }</span>
                        <span class="item__sub">${esc(q.note || "")}</span>
                      </span>
                      <span class="item__side">
                        <span class="badge badge--${q.status === "open" ? "warn" : "ok"}">
                          ${q.status === "open" ? "Beklemede" : "Tamamlandı"}</span>
                        ${esc(timeAgo(q.at))}
                      </span>
                    </div>`
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${sectionTitle("Saklama süreleri")}
        <div class="card">
          ${kv("Ziyaretçi kayıtları", `${r.visitors} gün`)}
          ${kv("Kargo kayıtları", `${r.packages} gün`)}
          ${kv("Olay ve talep kayıtları", `${r.incidents} gün`)}
          ${kv("Olay fotoğrafları", `${r.photos} gün`)}
          ${kv("Nöbet defteri", `${r.logs} gün`)}
          ${kv(
            "Otomatik temizlik",
            privacy.retentionEnabled()
              ? '<span style="color:var(--ok)">Açık</span>'
              : '<span style="color:var(--warn)">Kapalı</span>'
          )}
        </div>

        ${sectionTitle("Aydınlatma metni")}
        ${
          n.isDefault
            ? banner(
                "Bu metin varsayılan taslaktır; site yönetimi tarafından gözden geçirilip yayımlanmalıdır.",
                "warn",
                "alert"
              ) + '<div style="height:10px"></div>'
            : ""
        }
        <div class="card card--flat">
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:13.5px;
            line-height:1.65;margin:0;color:var(--text-dim)">${esc(n.text)}</pre>
        </div>`;
    }

    actions(root, {
      download: () => {
        downloadText(
          `kisisel-veri-dokumu-${new Date().toISOString().slice(0, 10)}.json`,
          privacy.personalExport(ctx.user.id),
          "application/json"
        );
        ctx.toast.ok("Döküm indiriliyor.");
      },

      delete: async () => {
        const note = await ctx.sheet({
          title: "Silme talebi",
          desc:
            "Talebiniz site yönetimine iletilir. Güvenlik mevzuatı gereği saklanması " +
            "zorunlu kayıtlar için yönetim size gerekçesiyle dönüş yapabilir.",
          body: fieldTextarea({
            name: "note",
            label: "Açıklama (isteğe bağlı)",
            rows: 3,
            placeholder: "Örn. siteden taşınıyorum.",
          }),
          actions: [
            { label: "Vazgeç", value: null },
            { label: "Talebi gönder", variant: "danger", keep: true },
          ],
          onMount(box, close) {
            box
              .querySelector('[data-keep="1"]')
              .addEventListener("click", () =>
                close(box.querySelector('[name="note"]').value.trim() || " ")
              );
          },
        });
        if (!note) return;
        privacy.createRequest(ctx.user, "delete", note.trim());
        ctx.pushNotification({
          to: "admin",
          kind: "info",
          title: "KVKK silme talebi",
          body: `${ctx.user.name} verilerinin silinmesini talep etti.`,
          link: "/admin/privacy",
        });
        ctx.toast.ok("Talebiniz yönetime iletildi.");
        draw();
      },
    });

    draw();
    return root;
  },
};
