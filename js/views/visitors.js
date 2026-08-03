/** Ziyaretçi kayıtları. Görevli için giriş/çıkış, sakin için kendi misafirleri. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { el, actions, qs, qsa } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { listItem, badge, empty, sectionTitle, banner, kv } from "../ui/components.js";
import {
  esc,
  initials,
  timeAgo,
  fmtDateTime,
  fmtTime,
  unitLabel,
  duration,
  VISITOR_STATUS,
} from "../util/format.js";

const FILTERS_STAFF = [
  ["inside", "İçeride"],
  ["expected", "Bekleniyor"],
  ["today", "Bugün"],
  ["all", "Tümü"],
];
const FILTERS_RES = [
  ["active", "Aktif"],
  ["all", "Geçmiş dahil"],
];

export default {
  title: "Ziyaretçiler",
  subtitle: (ctx) => (ctx.user.role === "resident" ? "Misafirlerim" : "Giriş / çıkış kayıtları"),
  live: true,
  action: { icon: "plus", href: "/visitors/new", label: "Yeni ziyaretçi" },

  async render(ctx) {
    const staff = ctx.user.role !== "resident";
    let filter = ctx.query.filter || (staff ? "inside" : "active");
    let search = "";

    const root = el("<div></div>");

    function data() {
      let all = db.list("visitors");
      if (!staff) all = all.filter((v) => v.hostId === ctx.user.id);
      const today = new Date().toDateString();
      const byFilter = {
        inside: (v) => v.status === "inside",
        expected: (v) => v.status === "expected",
        today: (v) => new Date(v.createdAt).toDateString() === today,
        active: (v) => ["inside", "expected"].includes(v.status),
        all: () => true,
      };
      let rows = all.filter(byFilter[filter] || (() => true));
      if (search.trim()) {
        const q = search.trim().toLocaleLowerCase("tr");
        rows = rows.filter((v) =>
          [v.name, v.plate, v.unit, v.block, v.code, v.purpose]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("tr")
            .includes(q)
        );
      }
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function draw() {
      const rows = data();
      const filters = staff ? FILTERS_STAFF : FILTERS_RES;
      root.innerHTML = `
        ${
          staff
            ? `<button class="btn btn--block btn--primary" type="button" data-act="verify" style="margin-bottom:12px">
                 ${icon("qr")} Misafir kodu ile doğrula
               </button>`
            : banner(
                "Misafiriniz kapıya gelmeden önce bildirirseniz güvenlik kimseyi aramak zorunda kalmaz; kapıda 6 haneli kodu söylemesi yeterlidir.",
                "info",
                "info"
              )
        }
        <label class="field" style="margin:12px 0 4px">
          <span class="sr-only">Ara</span>
          <input class="input" name="q" placeholder="İsim, plaka veya daire ara" value="${esc(
            search
          )}" />
        </label>
        <div class="chiprow">
          ${filters
            .map(
              ([k, l]) =>
                `<button class="chip" type="button" data-filter="${k}" aria-pressed="${
                  filter === k
                }">${esc(l)}</button>`
            )
            .join("")}
        </div>
        ${
          rows.length
            ? `<div class="list">${rows.map((v) => row(v, staff)).join("")}</div>`
            : empty(
                "Kayıt yok",
                staff
                  ? "Bu filtrede ziyaretçi bulunmuyor."
                  : "Henüz misafir bildirmediniz.",
                "users"
              )
        }`;

      qs('[name="q"]', root).addEventListener("input", (e) => {
        search = e.target.value;
        const rowsHost = qs(".list", root);
        const fresh = data();
        if (rowsHost)
          rowsHost.innerHTML = fresh.map((v) => row(v, staff)).join("") || "";
        if (!fresh.length && rowsHost) rowsHost.innerHTML = "";
      });
    }

    actions(root, {
      filter: () => {},
      open: (n) => openDetail(ctx, n.dataset.id, draw),
      verify: () => verifyFlow(ctx, draw),
      enter: (n) => {
        allowEntry(ctx, n.dataset.id);
        draw();
      },
      exit: (n) => {
        markExit(ctx, n.dataset.id);
        draw();
      },
    });

    root.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      filter = chip.dataset.filter;
      draw();
    });

    draw();
    return root;
  },
};

function row(v, staff) {
  const st = VISITOR_STATUS[v.status];
  const host = db.find("users", v.hostId);
  const sub = [
    unitLabel(v.block, v.unit),
    v.plate || (v.purpose === "Kurye" ? "Kurye" : "Yaya"),
    v.status === "inside"
      ? `${fmtTime(v.enteredAt)} girdi · ${duration(v.enteredAt)}`
      : v.status === "expected"
      ? `Kod: ${v.code}`
      : v.leftAt
      ? `${fmtTime(v.leftAt)} çıktı`
      : timeAgo(v.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  const quick =
    staff && v.status === "expected"
      ? `<button class="btn btn--sm btn--primary" type="button" data-act="enter" data-id="${esc(
          v.id
        )}">Giriş ver</button>`
      : staff && v.status === "inside"
      ? `<button class="btn btn--sm" type="button" data-act="exit" data-id="${esc(
          v.id
        )}">Çıkış</button>`
      : "";

  return `<div class="item ${v.status === "inside" ? "item--ok" : v.status === "expected" ? "item--info" : ""}">
    <span class="item__avatar">${esc(initials(v.name))}</span>
    <button class="item__body" type="button" data-act="open" data-id="${esc(v.id)}"
      style="background:none;border:0;text-align:left;padding:0;color:inherit;cursor:pointer">
      <span class="item__title">${esc(v.name)} ${badge(st.label, st.tone)}</span>
      <span class="item__sub">${esc(sub)}${
    staff && host ? " · " + esc(host.name) : ""
  }</span>
    </button>
    ${quick}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* İşlemler                                                            */
/* ------------------------------------------------------------------ */

export function allowEntry(ctx, id) {
  const v = db.find("visitors", id);
  if (!v) return;
  const u = auth.currentUser();
  db.update("visitors", id, { status: "inside", enteredAt: db.nowIso(), byGuard: u.id });
  db.log({
    kind: "visitor",
    by: u.name,
    text: `Ziyaretçi girişi: ${v.name} → ${unitLabel(v.block, v.unit)}${
      v.plate ? ` (${v.plate})` : ""
    }`,
  });
  if (v.hostId)
    ctx.pushNotification({
      to: v.hostId,
      kind: "visitor",
      title: "Misafiriniz geldi",
      body: `${v.name} kapıdan giriş yaptı.`,
      link: "/visitors",
    });
  ctx.toast.ok(`${v.name} için giriş kaydedildi.`);
}

export function markExit(ctx, id) {
  const v = db.find("visitors", id);
  if (!v) return;
  const u = auth.currentUser();
  db.update("visitors", id, { status: "left", leftAt: db.nowIso() });
  db.log({
    kind: "visitor",
    by: u.name,
    text: `Ziyaretçi çıkışı: ${v.name} (${unitLabel(v.block, v.unit)})`,
  });
  ctx.toast.ok(`${v.name} çıkış yaptı.`);
}

async function openDetail(ctx, id, redraw) {
  const v = db.find("visitors", id);
  if (!v) return;
  const staff = ctx.user.role !== "resident";
  const host = db.find("users", v.hostId);
  const st = VISITOR_STATUS[v.status];

  const body = `
    <div class="row" style="margin-bottom:10px">
      <span class="item__avatar">${esc(initials(v.name))}</span>
      <div><div class="strong" style="font-size:17px">${esc(v.name)}</div>
      <div class="faint">${esc(v.purpose || "Misafir")} ${badge(st.label, st.tone)}</div></div>
    </div>
    ${v.status === "expected" ? `<div class="codebox" style="margin:12px 0">
        <div class="codebox__label">Kapıda söylenecek kod</div>
        <div class="codebox__code">${esc(v.code)}</div>
      </div>` : ""}
    ${kv("Gidilecek daire", esc(unitLabel(v.block, v.unit)))}
    ${kv("Ev sahibi", esc(host?.name || "—"))}
    ${v.phone ? kv("Telefon", `<a href="tel:${esc(v.phone)}">${esc(v.phone)}</a>`) : ""}
    ${kv("Araç plakası", esc(v.plate || "Yaya geldi"))}
    ${kv("Kayıt", esc(fmtDateTime(v.createdAt)))}
    ${v.expectedAt ? kv("Beklenen saat", esc(fmtDateTime(v.expectedAt))) : ""}
    ${v.enteredAt ? kv("Giriş", esc(fmtDateTime(v.enteredAt))) : ""}
    ${v.leftAt ? kv("Çıkış", esc(fmtDateTime(v.leftAt))) : ""}
    ${v.byGuard ? kv("Kaydeden görevli", esc(db.find("users", v.byGuard)?.name || "—")) : ""}
    ${v.note ? kv("Not", esc(v.note)) : ""}`;

  const acts = [];
  if (staff && v.status === "expected") acts.push({ label: "Giriş ver", variant: "primary", value: "enter" });
  if (staff && v.status === "inside") acts.push({ label: "Çıkış kaydet", variant: "primary", value: "exit" });
  if (staff && v.status === "expected") acts.push({ label: "Giriş verme", variant: "danger", value: "deny" });
  if (!staff && v.status === "expected") acts.push({ label: "İptal et", variant: "danger", value: "cancel" });
  acts.unshift({ label: "Kapat", value: "close" });

  const res = await ctx.sheet({ title: "Ziyaretçi kaydı", body, actions: acts });
  if (res === "enter") allowEntry(ctx, id);
  if (res === "exit") markExit(ctx, id);
  if (res === "deny") {
    db.update("visitors", id, { status: "denied" });
    db.log({ kind: "visitor", by: ctx.user.name, text: `Giriş verilmedi: ${v.name}` });
    ctx.toast.toast("Kayıt 'giriş verilmedi' olarak işaretlendi.");
  }
  if (res === "cancel") {
    db.remove("visitors", id);
    ctx.toast.ok("Misafir bildirimi iptal edildi.");
  }
  redraw?.();
}

/** Görevli, misafirin söylediği 6 haneli kodu girer. */
async function verifyFlow(ctx, redraw) {
  const res = await ctx.sheet({
    title: "Misafir kodu doğrulama",
    desc: "Ziyaretçinin size söylediği 6 haneli kodu girin.",
    body: `<input class="input input--code" name="code" inputmode="numeric" maxlength="6" placeholder="000000" />
           <div id="vresult" style="margin-top:12px"></div>`,
    actions: [
      { label: "Kapat", value: null },
      { label: "Doğrula", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      const input = qs('[name="code"]', box);
      const out = qs("#vresult", box);
      const check = () => {
        const code = input.value.trim();
        if (code.length < 6) {
          out.innerHTML = "";
          return;
        }
        const v = db
          .list("visitors")
          .find((x) => x.code === code && ["expected", "inside"].includes(x.status));
        if (!v) {
          out.innerHTML = banner(
            "Bu koda ait bekleyen bir misafir kaydı yok. Sakini arayarak teyit edin.",
            "danger",
            "alert"
          );
          return;
        }
        const host = db.find("users", v.hostId);
        out.innerHTML = `
          ${banner("Kod doğrulandı.", "info", "check-circle")}
          <div class="card card--flat" style="margin-top:10px">
            ${kv("Misafir", esc(v.name))}
            ${kv("Daire", esc(unitLabel(v.block, v.unit)))}
            ${kv("Ev sahibi", esc(host?.name || "—"))}
            ${kv("Plaka", esc(v.plate || "Yaya"))}
          </div>
          ${
            v.status === "expected"
              ? `<button class="btn btn--block btn--primary" type="button" data-ok style="margin-top:10px">
                  ${icon("check")} Giriş ver</button>`
              : banner("Bu misafir zaten içeride görünüyor.", "warn", "info")
          }`;
        out.querySelector("[data-ok]")?.addEventListener("click", () => close(v.id));
      };
      input.addEventListener("input", check);
      box.querySelector('[data-keep="1"]').addEventListener("click", check);
    },
  });
  if (res) {
    allowEntry(ctx, res);
    redraw?.();
  }
}
