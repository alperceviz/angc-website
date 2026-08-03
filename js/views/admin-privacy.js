/** Yönetim: aydınlatma metni, saklama süreleri, rıza durumu, KVKK talepleri. */
import * as db from "../core/db.js";
import * as privacy from "../core/privacy.js";
import { siteName } from "../core/brand.js";
import { el, actions, qs, formData } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  sectionTitle,
  banner,
  kv,
  stat,
  empty,
  fieldText,
  fieldTextarea,
  switchRow,
  wireFields,
} from "../ui/components.js";
import { esc, timeAgo, fmtDateTime } from "../util/format.js";

const FIELDS = [
  ["visitors", "Ziyaretçi kayıtları"],
  ["packages", "Kargo kayıtları"],
  ["incidents", "Olay ve talep kayıtları"],
  ["photos", "Olay fotoğrafları"],
  ["logs", "Nöbet defteri"],
];

export default {
  title: "Gizlilik ve Veri Koruma",
  subtitle: "Yönetim paneli",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const n = privacy.notice();
      const r = privacy.retention();
      const stats = privacy.consentStats();
      const preview = privacy.purgePreview();
      const previewTotal = Object.values(preview).reduce((a, b) => a + b, 0);
      const requests = db
        .list("dataRequests")
        .sort((a, b) => Number(a.status !== "open") - Number(b.status !== "open") ||
          new Date(b.at) - new Date(a.at));
      const open = requests.filter((q) => q.status === "open");

      root.innerHTML = `
        ${
          open.length
            ? banner(
                `<strong>${open.length} bekleyen KVKK talebi</strong> var. İlgili kişiye
                 en geç 30 gün içinde dönüş yapılmalıdır.`,
                "warn",
                "alert"
              ) + '<div style="height:12px"></div>'
            : ""
        }

        ${sectionTitle("Açık rıza durumu")}
        <div class="grid grid-2">
          ${stat(stats.done, "Onaylayan", stats.done ? "ok" : "")}
          ${stat(stats.pending, "Bekleyen", stats.pending ? "warn" : "")}
        </div>
        <div class="card" style="margin-top:10px">
          ${kv("Metin sürümü", String(n.version))}
          ${kv("Metin", n.isDefault ? '<span style="color:var(--warn)">Varsayılan taslak</span>' : "Yönetim tarafından düzenlendi")}
          <div class="field__hint" style="margin-top:8px">
            Metni her düzenlediğinizde sürüm artar ve tüm kullanıcılardan yeniden
            onay istenir.
          </div>
          <button class="btn btn--block btn--primary" type="button" data-act="editNotice" style="margin-top:10px">
            ${icon("edit")} Aydınlatma metnini düzenle
          </button>
          <button class="btn btn--block btn--ghost" type="button" data-act="resetNotice" style="margin-top:8px">
            ${icon("refresh")} Varsayılan taslağa dön
          </button>
        </div>

        ${sectionTitle("Saklama süreleri")}
        <form class="card" id="retform">
          ${switchRow({
            name: "retentionEnabled",
            label: "Otomatik temizlik",
            desc: "Süresi dolan kayıtlar günlük olarak silinir",
            checked: privacy.retentionEnabled(),
          })}
          <hr class="divider" />
          ${FIELDS.map(([k, label]) =>
            fieldText({
              name: k,
              label: `${label} (gün)`,
              value: String(r[k]),
              type: "number",
              inputmode: "numeric",
            })
          ).join("")}
          <button class="btn btn--block btn--primary" type="button" data-act="saveRetention">
            ${icon("check")} Süreleri kaydet
          </button>
        </form>

        <div class="card" style="margin-top:10px">
          ${kv("Son temizlik", db.raw().site.lastPurgeAt ? esc(fmtDateTime(db.raw().site.lastPurgeAt)) : "Henüz çalışmadı")}
          ${kv("Şu an silinecek kayıt", String(previewTotal))}
          ${
            previewTotal
              ? `<div class="field__hint" style="margin-top:6px">${FIELDS.filter(
                  ([k]) => preview[k]
                )
                  .map(([k, l]) => `${esc(l)}: ${preview[k]}`)
                  .join(" · ")}</div>`
              : ""
          }
          <button class="btn btn--block" type="button" data-act="purgeNow" style="margin-top:10px"
            ${previewTotal ? "" : "disabled"}>
            ${icon("trash")} Temizliği şimdi çalıştır
          </button>
        </div>

        ${sectionTitle("KVKK talepleri")}
        ${
          requests.length
            ? `<div class="list">${requests
                .map(
                  (q) => `<div class="item ${q.status === "open" ? "item--accent" : ""}">
                    <span class="item__avatar">${icon(q.type === "delete" ? "trash" : "eye")}</span>
                    <span class="item__body">
                      <span class="item__title">${esc(q.userName)}
                        <span class="badge badge--${q.status === "open" ? "warn" : "ok"}">
                          ${q.status === "open" ? "Beklemede" : "Tamamlandı"}</span></span>
                      <span class="item__sub">${
                        q.type === "delete" ? "Silme talebi" : "Erişim talebi"
                      } · ${esc(timeAgo(q.at))}${q.note ? " · " + esc(q.note) : ""}</span>
                    </span>
                    ${
                      q.status === "open"
                        ? `<button class="btn btn--sm btn--primary" type="button"
                            data-act="handle" data-id="${esc(q.id)}">İşle</button>`
                        : ""
                    }
                  </div>`
                )
                .join("")}</div>`
            : empty("Talep yok", "İlgili kişi başvuruları burada listelenir.", "inbox")
        }

        ${banner(
          `Veri sorumlusu ${esc(siteName())} Site Yönetimi'dir. Metin ve süreler
           yayına alınmadan önce hukuk danışmanınıza gözden geçirtilmelidir.`,
          "",
          "info"
        )}`;

      wireFields(root);
      qs("[data-switch]", root).addEventListener("switchchange", (e) => {
        db.patchDoc("site", { retentionEnabled: e.detail });
      });
    }

    actions(root, {
      editNotice: async () => {
        const n = privacy.notice();
        const text = await ctx.sheet({
          title: "Aydınlatma metni",
          desc: "Kaydettiğinizde sürüm artar ve tüm kullanıcılardan yeniden onay istenir.",
          body: fieldTextarea({ name: "text", label: "Metin", value: n.text, rows: 14 }),
          actions: [
            { label: "Vazgeç", value: null },
            { label: "Kaydet ve yayımla", variant: "primary", keep: true },
          ],
          onMount(box, close) {
            box
              .querySelector('[data-keep="1"]')
              .addEventListener("click", () =>
                close(box.querySelector('[name="text"]').value.trim())
              );
          },
        });
        if (!text) return;
        privacy.updateNotice(text);
        db.log({ kind: "info", by: ctx.user.name, text: "Aydınlatma metni güncellendi." });
        ctx.pushNotification({
          to: "all",
          kind: "info",
          title: "Aydınlatma metni güncellendi",
          body: "Uygulamaya girişte yeniden onayınız istenecek.",
          link: "/privacy",
        });
        ctx.toast.ok("Metin yayımlandı, onaylar yenilendi.");
        draw();
      },

      resetNotice: async () => {
        const ok = await ctx.confirm({
          title: "Varsayılan taslağa dön",
          desc: "Düzenlediğiniz metin silinir ve site adına göre üretilen taslak geri gelir.",
          confirmLabel: "Geri dön",
          variant: "danger",
        });
        if (!ok) return;
        privacy.updateNotice(privacy.defaultNotice(siteName()));
        db.patchDoc("site", { privacyText: "" });
        ctx.toast.ok("Varsayılan taslak yüklendi.");
        draw();
      },

      saveRetention: () => {
        const f = formData(qs("#retform", root));
        const next = {};
        for (const [k] of FIELDS) {
          const v = Number(f[k]);
          if (!Number.isFinite(v) || v < 1) return ctx.toast.err("Süreler en az 1 gün olmalı.");
          next[k] = Math.round(v);
        }
        db.patchDoc("site", { retention: next });
        db.log({ kind: "info", by: ctx.user.name, text: "Veri saklama süreleri güncellendi." });
        ctx.toast.ok("Saklama süreleri kaydedildi.");
        draw();
      },

      purgeNow: async () => {
        const p = privacy.purgePreview();
        const total = Object.values(p).reduce((a, b) => a + b, 0);
        const ok = await ctx.confirm({
          title: "Temizliği çalıştır",
          desc: `${total} kayıt kalıcı olarak silinecek veya fotoğrafı temizlenecek.`,
          confirmLabel: "Çalıştır",
          variant: "danger",
        });
        if (!ok) return;
        privacy.purgeExpired();
        ctx.toast.ok("Temizlik tamamlandı.");
        draw();
      },

      handle: async (node) => {
        const q = db.find("dataRequests", node.dataset.id);
        if (!q) return;
        const choice = await ctx.sheet({
          title: `${q.userName} — ${q.type === "delete" ? "silme" : "erişim"} talebi`,
          desc: q.note || "",
          body: banner(
            q.type === "delete"
              ? `Silme uygulandığında bu kişiye ait ziyaretçi, kargo, araç ve rezervasyon
                 kayıtları silinir; açtığı talepler bildiren bilgisi kaldırılarak korunur.
                 Nöbet defteri denetim amacıyla saklanır.`
              : `Kişiye ait verilerin dökümünü indirip kendisine iletebilirsiniz.`,
            "warn",
            "info"
          ),
          actions: [
            { label: "Kapat", value: null },
            { label: "Dökümü indir", value: "export" },
            ...(q.type === "delete"
              ? [{ label: "Silmeyi uygula", variant: "danger", value: "apply" }]
              : []),
            { label: "Tamamlandı işaretle", variant: "primary", value: "done" },
          ],
        });
        if (!choice) return;

        if (choice === "export") {
          const { downloadText } = await import("../util/media.js");
          downloadText(
            `kvkk-dokum-${q.userId}.json`,
            privacy.personalExport(q.userId),
            "application/json"
          );
          return ctx.toast.ok("Döküm indiriliyor.");
        }

        if (choice === "apply") {
          const sure = await ctx.confirm({
            title: "Silmeyi uygula",
            desc: `${q.userName} ve kişisel kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
            confirmLabel: "Sil",
            variant: "danger",
          });
          if (!sure) return;
          privacy.applyDeletion(q.userId, ctx.user.name);
        }

        db.update("dataRequests", q.id, {
          status: "done",
          handledBy: ctx.user.name,
          handledAt: db.nowIso(),
        });
        if (choice !== "apply")
          ctx.pushNotification({
            to: q.userId,
            kind: "info",
            title: "KVKK talebiniz sonuçlandı",
            body: "Site yönetimi talebinizi işleme aldı.",
            link: "/privacy",
          });
        ctx.toast.ok("Talep kapatıldı.");
        draw();
      },
    });

    draw();
    return root;
  },
};
