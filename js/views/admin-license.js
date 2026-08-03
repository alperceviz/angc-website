/** Lisans ve abonelik — yalnızca site yönetimini ilgilendirir. */
import * as db from "../core/db.js";
import * as lic from "../core/license.js";
import { siteName } from "../core/brand.js";
import { el, actions, qs, formData } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  sectionTitle,
  banner,
  kv,
  stat,
  fieldText,
  fieldSelect,
} from "../ui/components.js";
import { esc, fmtDateLong } from "../util/format.js";

const TONE = { demo: "info", active: "ok", grace: "warn", expired: "danger" };
const LABEL = {
  demo: "Demo / deneme",
  active: "Etkin",
  grace: "Ek süre",
  expired: "Süresi doldu",
};

export default {
  title: "Lisans ve Abonelik",
  subtitle: "Yönetim paneli",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const l = lic.license();
      const s = lic.status();
      const u = lic.usage();
      const d = lic.daysLeft();
      const w = lic.warning();

      root.innerHTML = `
        <div class="card ${s === "expired" ? "card--danger" : s === "active" ? "" : "card--accent"}">
          <div class="card__head">
            <span class="tile__icon">${icon("key")}</span>
            <div class="card__title">${esc(lic.planLabel(l.plan))}
              <div class="faint">${esc(l.licensedTo || siteName())}</div>
            </div>
            <span class="badge badge--${TONE[s]}">${LABEL[s]}</span>
          </div>
          ${kv("Lisanslı daire", l.units ? String(l.units) : "Sınırsız / tanımsız")}
          ${kv(
            "Kayıtlı sakin",
            u.over
              ? `<span style="color:var(--warn)">${u.residents} (${u.over} fazla)</span>`
              : String(u.residents)
          )}
          ${kv(
            "Geçerlilik",
            l.validUntil
              ? `${esc(fmtDateLong(l.validUntil))}${
                  d !== null ? ` · ${d >= 0 ? `${d} gün kaldı` : `${-d} gün geçti`}` : ""
                }`
              : "Süresiz"
          )}
          ${l.key ? kv("Lisans anahtarı", `<span class="mono">${esc(l.key)}</span>`) : ""}
        </div>

        ${w ? `<div style="height:10px"></div>${banner(esc(w.text), w.tone, "alert")}` : ""}

        ${
          u.over
            ? `<div style="height:10px"></div>${banner(
                `Lisanslı daire sayısı aşıldı (${u.residents}/${u.units}). Sakin kayıtları
                 <strong>engellenmez</strong> — kimsenin kapıda kalmaması için sınır sadece
                 uyarı üretir. Planı yükseltmek için tedarikçinizle görüşün.`,
                "warn",
                "info"
              )}`
            : ""
        }

        ${sectionTitle("Ücretlendirme ilkesi")}
        <div class="card">
          <div class="row" style="gap:12px;align-items:flex-start;margin-bottom:12px">
            <span class="tile__icon" style="background:var(--ok-soft);color:var(--ok)">${icon("home")}</span>
            <div>
              <div class="strong">Sakinler ve görevliler için ücretsiz</div>
              <div class="faint">Uygulamayı indirmek ve kullanmak hiçbir zaman
              sakinlerden ya da güvenlik personelinden ücret istemez.</div>
            </div>
          </div>
          <div class="row" style="gap:12px;align-items:flex-start">
            <span class="tile__icon">${icon("building")}</span>
            <div>
              <div class="strong">Bedeli site yönetimi öder</div>
              <div class="faint">Lisans, siteye kurulum başına verilir ve daire
              sayısına göre ölçeklenir.</div>
            </div>
          </div>
        </div>

        ${sectionTitle("Süre dolarsa ne olur?")}
        <div class="card">
          <div class="strong" style="margin-bottom:8px;color:var(--ok)">
            ${icon("check", { size: 16 })} Çalışmaya devam eder
          </div>
          <ul class="muted" style="margin:0 0 14px;padding-left:18px;line-height:1.8;font-size:14px">
            ${lic.NEVER_LOCKED.map((x) => `<li>${esc(x)}</li>`).join("")}
          </ul>
          <div class="strong" style="margin-bottom:8px;color:var(--danger)">
            ${icon("lock", { size: 16 })} Kapanır
          </div>
          <ul class="muted" style="margin:0;padding-left:18px;line-height:1.8;font-size:14px">
            ${Object.values(lic.LOCKABLE)
              .map((x) => `<li>${esc(x)}</li>`)
              .join("")}
          </ul>
          <div class="field__hint" style="margin-top:12px">
            Süre dolduktan sonra 30 gün ek süre tanınır. Güvenlik işlevlerinin
            faturaya bağlanmaması bilinçli bir üründür kararıdır.
          </div>
        </div>

        ${sectionTitle("Lisansı güncelle")}
        <form class="card" id="licform">
          ${fieldSelect({
            name: "plan",
            label: "Plan",
            value: l.plan,
            options: [
              ["demo", "Demo / deneme"],
              ["standart", "Standart"],
              ["kurumsal", "Kurumsal"],
            ],
          })}
          ${fieldText({
            name: "licensedTo",
            label: "Lisans sahibi",
            value: l.licensedTo || "",
            placeholder: `${siteName()} Site Yönetimi`,
          })}
          ${fieldText({
            name: "units",
            label: "Lisanslı daire sayısı",
            value: String(l.units || ""),
            type: "number",
            inputmode: "numeric",
            hint: "Boş bırakılırsa sınır uygulanmaz.",
          })}
          ${fieldText({
            name: "validUntil",
            label: "Geçerlilik bitişi",
            value: l.validUntil ? l.validUntil.slice(0, 10) : "",
            type: "date",
          })}
          ${fieldText({
            name: "key",
            label: "Lisans anahtarı",
            value: l.key || "",
            placeholder: "Tedarikçinizden aldığınız anahtar",
          })}
          <button class="btn btn--block btn--primary" type="button" data-act="save">
            ${icon("check")} Lisansı kaydet
          </button>
        </form>

        ${banner(
          `Lisans denetimi şu an istemcide yapılıyor; teknik bir engel değil, ticari
           bir kayıttır. Gerçek denetim, sunucu bağlantısıyla birlikte sunucu
           tarafına taşınmalıdır (bkz. README).`,
          "",
          "info"
        )}`;
    }

    actions(root, {
      save: () => {
        const f = formData(qs("#licform", root));
        const units = f.units === "" ? 0 : Number(f.units);
        if (!Number.isFinite(units) || units < 0)
          return ctx.toast.err("Daire sayısı geçerli bir sayı olmalı.");
        lic.setLicense(
          {
            plan: f.plan,
            licensedTo: f.licensedTo.trim(),
            units: Math.round(units),
            validUntil: f.validUntil ? new Date(f.validUntil + "T23:59:59").toISOString() : "",
            key: f.key.trim(),
          },
          ctx.user.name
        );
        ctx.toast.ok("Lisans kaydedildi.");
        draw();
      },
    });

    draw();
    return root;
  },
};
