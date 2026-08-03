/** Yönetim paneli — kurulum durumu ve özelleştirme bölümleri. */
import * as db from "../core/db.js";
import { setupGaps, brandName, siteName } from "../core/brand.js";
import * as lic from "../core/license.js";
import { el, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, listItem, banner, kv, badge } from "../ui/components.js";
import { esc } from "../util/format.js";

const SECTIONS = [
  {
    to: "/admin/site",
    icon: "building",
    title: "Site bilgileri",
    sub: "Ad, adres, telefonlar, bloklar, toplanma alanı, marka rengi",
  },
  {
    to: "/admin/c/users",
    icon: "users",
    title: "Kullanıcılar",
    sub: "Görevli, sakin ve yönetici hesapları; PIN sıfırlama",
    count: () => db.list("users").length,
  },
  {
    to: "/admin/c/checkpoints",
    icon: "pin",
    title: "Devriye noktaları",
    sub: "Kontrol noktaları, bölgeler ve nokta kodları",
    count: () => db.list("checkpoints").length,
  },
  {
    to: "/admin/c/amenities",
    icon: "waves",
    title: "Sosyal tesisler",
    sub: "Rezervasyona açık alanlar, saatler ve kapasite",
    count: () => db.list("amenities").length,
  },
  {
    to: "/admin/c/contacts",
    icon: "phone",
    title: "Telefon rehberi",
    sub: "Site, acil ve arıza numaraları",
    count: () => db.list("contacts").length,
  },
  {
    to: "/admin/privacy",
    icon: "lock",
    title: "Gizlilik ve veri koruma",
    sub: "Aydınlatma metni, saklama süreleri, KVKK talepleri",
    count: () => db.list("dataRequests", (x) => x.status === "open").length,
  },
  {
    to: "/admin/license",
    icon: "key",
    title: "Lisans ve abonelik",
    sub: "Plan, daire sayısı, geçerlilik — bedelini yönetim öder",
  },
  {
    to: "/admin/data",
    icon: "download",
    title: "Veri ve kurulum",
    sub: "Yapılandırmayı dışa/içe aktar, demo kayıtlarını temizle",
  },
];

export default {
  title: "Yönetim Paneli",
  subtitle: () => siteName(),
  live: true,

  async render(ctx) {
    const root = el("<div></div>");
    const gaps = setupGaps();
    const licWarn = lic.warning();
    const site = db.raw().site;

    root.innerHTML = `
      ${licWarn ? banner(esc(licWarn.text), licWarn.tone, "key") + '<div style="height:12px"></div>' : ""}
      ${
        gaps.length
          ? `<div class="card card--accent">
              <div class="card__head">
                <span class="tile__icon">${icon("settings")}</span>
                <div class="card__title">Kurulumu tamamlayın
                  <div class="faint">${gaps.length} madde bekliyor</div>
                </div>
              </div>
              <div class="list">
                ${gaps
                  .map(
                    ([text, to]) => `<button class="item" type="button" data-act="go" data-to="${esc(
                      to
                    )}">
                      <span class="item__avatar">${icon("alert")}</span>
                      <span class="item__body"><span class="item__title">${esc(text)}</span></span>
                      <span class="item__chev">${icon("chevron")}</span>
                    </button>`
                  )
                  .join("")}
              </div>
            </div>`
          : banner(
              "Kurulum tamam. Site bilgileri, kullanıcılar ve devriye noktaları tanımlı.",
              "info",
              "check-circle"
            )
      }

      ${sectionTitle("Özelleştirme")}
      <div class="list">
        ${SECTIONS.map((s) =>
          listItem({
            icon: s.icon,
            title: s.title,
            sub: s.sub,
            badges: s.count ? badge(String(s.count()), "") : "",
            act: "go",
            data: { to: s.to },
          })
        ).join("")}
      </div>

      ${sectionTitle("Kurulum özeti")}
      <div class="card">
        ${kv("Ürün", esc(brandName()))}
        ${kv("Lisans", esc(lic.planLabel()))}
        ${kv("Site", esc(site.name || "—"))}
        ${kv("Adres", esc(site.address || "—"))}
        ${kv("Blok sayısı", String((site.blocks || []).length))}
        ${kv(
          "Marka rengi",
          `<span style="display:inline-flex;align-items:center;gap:7px">
            <span style="width:15px;height:15px;border-radius:4px;background:${esc(
              site.brandColor || "#ffc800"
            )};border:1px solid var(--line-strong)"></span>
            <span class="mono">${esc(site.brandColor || "#ffc800")}</span></span>`
        )}
        ${kv(
          "Veri durumu",
          site.demo
            ? '<span style="color:var(--warn)">Demo kayıtları duruyor</span>'
            : '<span style="color:var(--ok)">Gerçek kullanım</span>'
        )}
      </div>

      ${banner(
        "Bu paneldeki her ayar yalnızca bu kuruluma aittir. Başka bir siteye kurarken “Veri ve kurulum” bölümünden yapılandırmayı dışa aktarıp yeni cihazda içe aktarabilirsiniz.",
        "",
        "info"
      )}`;

    actions(root, { go: (n) => ctx.navigate(n.dataset.to) });
    return root;
  },
};
