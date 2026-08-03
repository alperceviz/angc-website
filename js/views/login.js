/** Giriş ekranı: rol seç → kişi seç → PIN. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { el, qs, haptic } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { esc, initials, unitLabel } from "../util/format.js";

const ROLES = [
  {
    key: "guard",
    icon: "shield-check",
    tone: "",
    title: "Güvenlik Görevlisi",
    desc: "Nöbet, devriye, ziyaretçi ve olay kayıtları",
  },
  {
    key: "resident",
    icon: "home",
    tone: "info",
    title: "Site Sakini",
    desc: "Misafir bildir, talep aç, duyuruları gör",
  },
  {
    key: "admin",
    icon: "building",
    tone: "ok",
    title: "Site Yönetimi",
    desc: "Duyuru yayınla, olayları ve raporları izle",
  },
];

export default {
  async render(ctx) {
    const root = el('<div class="login"></div>');
    const site = db.raw().site;
    let step = "role";
    let role = null;
    let userId = null;
    let pin = "";
    let wrong = false;

    function draw() {
      root.innerHTML = `
        <div class="login__brand">
          <img src="assets/icon-192.png" alt="" width="78" height="78" />
          <div class="login__name">Nöbetçi</div>
          <div class="login__tag">${esc(site.name)} · Site Güvenlik ve Yaşam Uygulaması</div>
        </div>
        <div id="step"></div>`;
      const host = qs("#step", root);

      if (step === "role") host.appendChild(stepRole());
      else if (step === "user") host.appendChild(stepUser());
      else host.appendChild(stepPin());
    }

    function stepRole() {
      const box = el(`<div>
        <div class="section-title">Nasıl giriş yapacaksınız?</div>
        <div class="rolecards">
          ${ROLES.map(
            (r) => `<button class="rolecard ${r.tone ? "rolecard--" + r.tone : ""}" type="button" data-role="${r.key}">
              <span class="rolecard__icon">${icon(r.icon)}</span>
              <span>
                <span class="rolecard__title">${esc(r.title)}</span>
                <span class="rolecard__desc">${esc(r.desc)}</span>
              </span>
            </button>`
          ).join("")}
        </div>
        <div class="banner banner--info" style="margin-top:20px">
          ${icon("info")}
          <div><strong>Demo kurulumu.</strong> Tüm hesapların PIN'i <strong>1234</strong>.
          Aynı tarayıcıda ikinci bir sekme açıp farklı rolle girerek görevli–sakin akışını
          canlı izleyebilirsiniz.</div>
        </div>
      </div>`);
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-role]");
        if (!b) return;
        role = b.dataset.role;
        step = "user";
        draw();
      });
      return box;
    }

    function stepUser() {
      const users = db.list("users", (u) => u.role === role);
      const box = el(`<div>
        <button class="btn btn--sm btn--ghost" type="button" data-back style="margin-bottom:12px">
          ${icon("back")} Rol değiştir
        </button>
        <div class="section-title">${esc(auth.roleLabel(role))} — kim giriş yapıyor?</div>
        <div class="list">
          ${users
            .map(
              (u) => `<button class="item" type="button" data-user="${esc(u.id)}">
                <span class="item__avatar">${esc(initials(u.name))}</span>
                <span class="item__body">
                  <span class="item__title">${esc(u.name)}</span>
                  <span class="item__sub">${esc(u.title || "")}${
                u.block ? " · " + esc(unitLabel(u.block, u.unit)) : ""
              }${u.badge ? " · " + esc(u.badge) : ""}</span>
                </span>
                <span class="item__chev">${icon("chevron")}</span>
              </button>`
            )
            .join("")}
        </div>
      </div>`);
      box.addEventListener("click", (e) => {
        if (e.target.closest("[data-back]")) {
          step = "role";
          return draw();
        }
        const b = e.target.closest("[data-user]");
        if (!b) return;
        userId = b.dataset.user;
        pin = "";
        step = "pin";
        draw();
      });
      return box;
    }

    function stepPin() {
      const user = db.find("users", userId);
      const dots = [0, 1, 2, 3]
        .map(
          (i) =>
            `<span class="pindot ${wrong ? "pindot--err" : pin.length > i ? "pindot--on" : ""}"></span>`
        )
        .join("");
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "sil"];
      const box = el(`<div class="${wrong ? "shake" : ""}">
        <button class="btn btn--sm btn--ghost" type="button" data-back style="margin-bottom:12px">
          ${icon("back")} Kişi değiştir
        </button>
        <div class="center">
          <div class="item__avatar" style="width:60px;height:60px;margin:0 auto 10px;font-size:20px;border-radius:18px">
            ${esc(initials(user.name))}
          </div>
          <div class="strong" style="font-size:18px">${esc(user.name)}</div>
          <div class="faint">${esc(auth.roleLabel(user.role))}</div>
        </div>
        <div class="pindots">${dots}</div>
        <div class="keypad">
          ${keys
            .map((k) =>
              k === ""
                ? '<button class="key key--blank" type="button" disabled></button>'
                : k === "sil"
                ? `<button class="key key--fn" type="button" data-key="del">Sil</button>`
                : `<button class="key" type="button" data-key="${k}">${k}</button>`
            )
            .join("")}
        </div>
        <div class="center faint" style="margin-top:18px">Demo PIN: 1234</div>
      </div>`);

      box.addEventListener("click", (e) => {
        if (e.target.closest("[data-back]")) {
          step = "user";
          wrong = false;
          return draw();
        }
        const k = e.target.closest("[data-key]");
        if (!k) return;
        haptic(8);
        wrong = false;
        if (k.dataset.key === "del") pin = pin.slice(0, -1);
        else if (pin.length < 4) pin += k.dataset.key;
        if (pin.length === 4) {
          const res = auth.login(userId, pin);
          if (res.ok) return ctx.done();
          wrong = true;
          pin = "";
          haptic([40, 60, 40]);
          draw();
          setTimeout(() => {
            wrong = false;
            draw();
          }, 600);
          return;
        }
        draw();
      });
      return box;
    }

    draw();
    return root;
  },
};
