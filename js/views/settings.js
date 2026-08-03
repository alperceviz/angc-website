/** Ayarlar — görünüm, bildirim izni, kurulum ve demo yönetimi. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, switchRow, wireFields, banner, kv } from "../ui/components.js";
import { esc } from "../util/format.js";
import { brandName } from "../core/brand.js";

export default {
  title: "Ayarlar",
  live: false,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const s = db.raw().settings || {};
      const notifState =
        typeof Notification === "undefined"
          ? "Bu tarayıcı desteklemiyor"
          : Notification.permission === "granted"
          ? "İzin verildi"
          : Notification.permission === "denied"
          ? "Reddedildi — tarayıcı ayarlarından açabilirsiniz"
          : "Henüz istenmedi";

      root.innerHTML = `
        ${sectionTitle("Görünüm")}
        <div class="card">
          <div class="optionrow" data-theme>
            <button class="option" type="button" data-t="dark" aria-pressed="${
              s.theme !== "light"
            }">${icon("moon", { size: 16 })} Koyu</button>
            <button class="option" type="button" data-t="light" aria-pressed="${
              s.theme === "light"
            }">${icon("sun", { size: 16 })} Açık</button>
          </div>
          <div class="field__hint" style="margin-top:8px">
            Gece vardiyasında koyu tema göz yormaz; gündüz kullanımda açık tema daha okunaklıdır.
          </div>
        </div>

        ${sectionTitle("Bildirimler")}
        <div class="card">
          ${switchRow({
            name: "notify",
            label: "Bildirimler açık",
            desc: "Acil çağrı, kargo ve talep güncellemeleri",
            checked: s.notify !== false,
          })}
          <hr class="divider" />
          ${switchRow({
            name: "sound",
            label: "Acil çağrıda sesli alarm",
            desc: "Görevli ekranında sesle uyarır",
            checked: s.sound !== false,
          })}
          <hr class="divider" />
          ${kv("Sistem bildirim izni", esc(notifState))}
          <button class="btn btn--block" type="button" data-act="askNotify" style="margin-top:10px">
            ${icon("bell")} Sistem bildirimlerine izin ver
          </button>
        </div>

        ${sectionTitle("Uygulamayı yükle")}
        <div class="card">
          ${banner(
            `${brandName()} bir web uygulamasıdır (PWA). Telefonun ana ekranına eklediğinizde uygulama gibi tam ekran açılır ve çevrimdışı çalışır.`,
            "",
            "install"
          )}
          <button class="btn btn--block btn--primary" type="button" data-act="install" style="margin-top:10px">
            ${icon("install")} Ana ekrana ekle
          </button>
          <div class="field__hint" style="margin-top:8px">
            iPhone'da: Safari &rarr; Paylaş &rarr; “Ana Ekrana Ekle”.
            Android'de: Chrome menüsü &rarr; “Uygulamayı yükle”.
          </div>
        </div>

        ${sectionTitle("Veri")}
        <div class="card">
          ${kv("Depolama", "Bu cihaz (localStorage)")}
          ${
            auth.isAdmin()
              ? `${kv("Kayıt sayısı", String(countAll()))}
                <button class="btn btn--block" type="button" data-act="adminData" style="margin-top:10px">
                  ${icon("settings")} Veri ve kurulum bölümüne git
                </button>
                <div class="field__hint" style="margin-top:8px">
                  Tam yedek alma, yapılandırma taşıma ve sıfırlama işlemleri
                  yönetim panelindedir.
                </div>`
              : `<button class="btn btn--block" type="button" data-act="myData" style="margin-top:10px">
                  ${icon("user")} Verilerim ve haklarım
                </button>
                <div class="field__hint" style="margin-top:8px">
                  Hakkınızda tutulan kayıtları görebilir, dökümünü indirebilir
                  veya silme talebi oluşturabilirsiniz.
                </div>`
          }
        </div>

        ${sectionTitle("Hakkında")}
        <div class="card">
          ${kv("Uygulama", esc(brandName()))}
          ${kv("Sürüm", "1.0.0")}
          ${kv("Site", esc(db.raw().site.name))}
          ${kv("Oturum", esc(ctx.user.name + " · " + auth.roleLabel(ctx.user.role)))}
          ${
            auth.isAdmin()
              ? ""
              : kv("Ücret", '<span style="color:var(--ok)">Sizin için ücretsiz</span>')
          }
          <button class="btn btn--block btn--ghost" type="button" data-act="logout" style="margin-top:12px;color:var(--danger)">
            ${icon("logout")} Oturumu kapat
          </button>
        </div>

        ${banner(
          "Bu kurulum tek cihazda çalışan bir tanıtım sürümüdür: veriler yalnızca bu tarayıcıda tutulur. Gerçek sitede kullanım için sunucu bağlantısı gerekir.",
          "warn",
          "info"
        )}`;

      wireFields(root);

      qs("[data-theme]", root).addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]");
        if (!b) return;
        db.patchDoc("settings", { theme: b.dataset.t });
        draw();
      });

      root.querySelectorAll("[data-switch]").forEach((sw) => {
        sw.addEventListener("switchchange", (e) => {
          db.patchDoc("settings", { [sw.dataset.switch]: e.detail });
        });
      });
    }

    actions(root, {
      askNotify: async () => {
        if (typeof Notification === "undefined")
          return ctx.toast.err("Bu tarayıcı sistem bildirimlerini desteklemiyor.");
        const p = await Notification.requestPermission();
        if (p === "granted") ctx.toast.ok("Bildirim izni verildi.");
        else ctx.toast.err("İzin verilmedi.");
        draw();
      },

      install: async () => {
        const p = window.__installPrompt;
        if (!p) {
          return ctx.sheet({
            title: "Ana ekrana ekleme",
            body: `<p class="muted">Tarayıcınız otomatik kurulum penceresi sunmuyor. Elle ekleyebilirsiniz:</p>
              <div class="card card--flat" style="margin-top:12px">
                <div class="strong">iPhone / iPad (Safari)</div>
                <div class="faint">Paylaş düğmesi → “Ana Ekrana Ekle”</div>
              </div>
              <div class="card card--flat" style="margin-top:8px">
                <div class="strong">Android (Chrome)</div>
                <div class="faint">Sağ üst menü → “Uygulamayı yükle”</div>
              </div>
              <div class="card card--flat" style="margin-top:8px">
                <div class="strong">Masaüstü</div>
                <div class="faint">Adres çubuğundaki yükleme simgesi</div>
              </div>`,
            actions: [{ label: "Tamam", value: 1 }],
          });
        }
        p.prompt();
        const res = await p.userChoice;
        window.__installPrompt = null;
        if (res.outcome === "accepted") ctx.toast.ok("Uygulama yüklendi.");
      },

      // Tam veri dökümü ve sıfırlama yalnızca yönetim panelinde; buradan
      // yönlendiriyoruz ki her rolün ayarlar ekranında görünmesin.
      adminData: () => ctx.navigate("/admin/data"),
      myData: () => ctx.navigate("/privacy"),

      logout: async () => {
        const ok = await ctx.confirm({
          title: "Oturumu kapat",
          desc: "Görevliyseniz açık vardiyanız da kapatılır.",
          confirmLabel: "Çıkış yap",
          variant: "danger",
        });
        if (!ok) return;
        auth.logout();
        location.hash = "#/";
        location.reload();
      },
    });

    draw();
    return root;
  },
};

function countAll() {
  const d = db.raw();
  return [
    "users",
    "visitors",
    "packages",
    "incidents",
    "announcements",
    "patrols",
    "shifts",
    "bookings",
    "logs",
  ].reduce((n, k) => n + (d[k]?.length || 0), 0);
}
