/** Veri ve kurulum — yapılandırma taşıma, demodan gerçek kullanıma geçiş. */
import * as db from "../core/db.js";
import { siteName } from "../core/brand.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, banner, kv } from "../ui/components.js";
import { downloadText } from "../util/media.js";
import { esc } from "../util/format.js";

export default {
  title: "Veri ve Kurulum",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const s = db.raw().site;
      const counts = {
        users: db.list("users").length,
        visitors: db.list("visitors").length,
        packages: db.list("packages").length,
        incidents: db.list("incidents").length,
        logs: db.list("logs").length,
      };

      root.innerHTML = `
        ${sectionTitle("Yeni bir siteye kurulum")}
        <div class="card">
          <p class="muted" style="margin-bottom:12px">
            Site bilgileri, devriye noktaları, tesisler ve rehber tek dosyada dışa
            aktarılır. Kişisel veri (kullanıcılar, ziyaretçi ve olay kayıtları) bu
            dosyaya <strong>dâhil edilmez</strong>.
          </p>
          <button class="btn btn--block btn--primary" type="button" data-act="exportConfig">
            ${icon("download")} Yapılandırmayı dışa aktar
          </button>
          <button class="btn btn--block" type="button" data-act="importConfig" style="margin-top:8px">
            ${icon("share")} Yapılandırma dosyası yükle
          </button>
          <input type="file" accept="application/json,.json" id="cfgfile" hidden />
        </div>

        ${sectionTitle("Gerçek kullanıma geçiş")}
        <div class="card ${s.demo ? "card--accent" : ""}">
          ${kv("Veri durumu", s.demo
            ? '<span style="color:var(--warn)">Demo kayıtları duruyor</span>'
            : '<span style="color:var(--ok)">Gerçek kullanım</span>')}
          ${kv("Kullanıcı", String(counts.users))}
          ${kv("Ziyaretçi kaydı", String(counts.visitors))}
          ${kv("Kargo kaydı", String(counts.packages))}
          ${kv("Olay kaydı", String(counts.incidents))}
          ${kv("Defter satırı", String(counts.logs))}
          <p class="muted" style="margin:12px 0">
            Siteye gerçekten kurulmadan önce demo hareketlerini temizleyin. Site
            bilgileri, devriye noktaları, tesisler ve rehber korunur.
          </p>
          <button class="btn btn--block" type="button" data-act="clearOps">
            ${icon("refresh")} Demo hareketlerini temizle
          </button>
          <button class="btn btn--block btn--ghost" type="button" data-act="clearAll"
            style="margin-top:8px;color:var(--danger)">
            ${icon("trash")} Hareketleri ve demo kullanıcılarını sil
          </button>
          <div class="field__hint" style="margin-top:8px">
            İkinci seçenek yalnızca sizin yönetici hesabınızı bırakır; görevli ve
            sakin hesaplarını yeniden tanımlamanız gerekir.
          </div>
        </div>

        ${sectionTitle("Yedek")}
        <div class="card">
          <button class="btn btn--block" type="button" data-act="exportAll">
            ${icon("download")} Tüm veriyi JSON olarak indir
          </button>
          <button class="btn btn--block btn--ghost" type="button" data-act="resetDemo"
            style="margin-top:8px;color:var(--danger)">
            ${icon("refresh")} Her şeyi sıfırla ve demo verisini geri yükle
          </button>
        </div>

        ${banner(
          "Veriler şu an yalnızca bu cihazda tutuluyor. Birden fazla telefonun aynı kayıtları görmesi için sunucu bağlantısı gerekir — README'deki “Gerçek kuruluma geçiş” bölümüne bakın.",
          "warn",
          "info"
        )}`;

      qs("#cfgfile", root).addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const ok = await ctx.confirm({
          title: "Yapılandırmayı yükle",
          desc: "Mevcut site bilgileri, devriye noktaları, tesisler ve rehber bu dosyadakilerle değiştirilecek.",
          confirmLabel: "Yükle",
          variant: "danger",
        });
        if (!ok) return;
        const r = db.importConfig(text);
        if (!r.ok) return ctx.toast.err(r.error);
        const { applyBrand } = await import("../core/brand.js");
        applyBrand();
        db.log({ kind: "info", by: ctx.user.name, text: "Site yapılandırması içe aktarıldı." });
        ctx.toast.ok("Yapılandırma yüklendi.");
        draw();
      });
    }

    actions(root, {
      exportConfig: () => {
        downloadText(
          `guvendeyim-yapilandirma-${slug(siteName())}.json`,
          db.exportConfig(),
          "application/json"
        );
        ctx.toast.ok("Yapılandırma indiriliyor.");
      },
      importConfig: () => qs("#cfgfile", root).click(),
      exportAll: () => {
        downloadText(
          `guvendeyim-veri-${new Date().toISOString().slice(0, 10)}.json`,
          db.exportJson(),
          "application/json"
        );
        ctx.toast.ok("Yedek indiriliyor.");
      },
      clearOps: async () => {
        const ok = await ctx.confirm({
          title: "Demo hareketlerini temizle",
          desc: "Ziyaretçi, kargo, olay, devriye, vardiya, rezervasyon, duyuru ve defter kayıtları silinir. Kullanıcılar ve site yapılandırması kalır.",
          confirmLabel: "Temizle",
          variant: "danger",
        });
        if (!ok) return;
        db.clearOperationalData({ users: false });
        ctx.toast.ok("Hareket kayıtları temizlendi.");
        draw();
      },
      clearAll: async () => {
        const ok = await ctx.confirm({
          title: "Hareketleri ve kullanıcıları sil",
          desc: "Sizin yönetici hesabınız dışındaki tüm kullanıcılar ve tüm hareket kayıtları silinir. Bu işlem geri alınamaz.",
          confirmLabel: "Hepsini sil",
          variant: "danger",
        });
        if (!ok) return;
        db.clearOperationalData({ users: true, keepUserId: ctx.user.id });
        ctx.toast.ok("Temizlendi. Görevli ve sakin hesaplarını yeniden tanımlayın.");
        draw();
      },
      resetDemo: async () => {
        const ok = await ctx.confirm({
          title: "Her şeyi sıfırla",
          desc: "Site yapılandırması dâhil tüm veriler silinip demo kurulumu geri yüklenir.",
          confirmLabel: "Sıfırla",
          variant: "danger",
        });
        if (!ok) return;
        await db.reset();
        const { applyBrand } = await import("../core/brand.js");
        applyBrand();
        ctx.toast.ok("Demo verisi geri yüklendi.");
        ctx.navigate("/");
      },
    });

    draw();
    return root;
  },
};

function slug(s) {
  return String(s)
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
