/** Kargo / teslimat takibi. */
import * as db from "../core/db.js";
import { el, actions, qs, formData } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  listItem,
  badge,
  empty,
  banner,
  kv,
  fieldText,
  fieldSelect,
  wireFields,
} from "../ui/components.js";
import { esc, timeAgo, fmtDateTime, unitLabel, duration, PACKAGE_STATUS } from "../util/format.js";

export default {
  title: (ctx) => (ctx.user.role === "resident" ? "Kargolarım" : "Kargo & Teslimat"),
  live: true,
  action: (ctx) =>
    ctx.user.role === "resident"
      ? null
      : { icon: "plus", label: "Kargo teslim al", onClick: (c) => receiveFlow(c) },

  async render(ctx) {
    const staff = ctx.user.role !== "resident";
    let tab = "waiting";
    const root = el("<div></div>");

    function rows() {
      let all = db.list("packages");
      if (!staff) all = all.filter((p) => p.hostId === ctx.user.id);
      if (tab !== "all") all = all.filter((p) => p.status === tab);
      return all.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    }

    function draw() {
      const list = rows();
      const waitingCount = db.list(
        "packages",
        (p) => p.status === "waiting" && (staff || p.hostId === ctx.user.id)
      ).length;

      root.innerHTML = `
        ${
          staff
            ? `<button class="btn btn--block btn--primary" type="button" data-act="receive">
                ${icon("package")} Yeni kargo teslim al
              </button><div style="height:12px"></div>`
            : waitingCount
            ? banner(
                `Güvenlik kulübesinde <strong>${waitingCount} kargonuz</strong> var. Teslim alırken kodu göstermeniz yeterli.`,
                "warn",
                "package"
              ) + '<div style="height:12px"></div>'
            : ""
        }
        <div class="chiprow">
          ${[
            ["waiting", "Kulübede"],
            ["delivered", "Teslim edildi"],
            ["all", "Tümü"],
          ]
            .map(
              ([k, l]) =>
                `<button class="chip" type="button" data-tab="${k}" aria-pressed="${
                  tab === k
                }">${esc(l)}</button>`
            )
            .join("")}
        </div>
        ${
          list.length
            ? `<div class="list">${list.map((p) => row(p, staff)).join("")}</div>`
            : empty(
                "Kargo yok",
                staff ? "Bu filtrede kayıt bulunmuyor." : "Adınıza bekleyen kargo yok.",
                "package"
              )
        }`;
    }

    actions(root, {
      receive: () => receiveFlow(ctx).then(draw),
      open: (n) => detail(ctx, n.dataset.id, draw),
      deliver: (n) => deliverFlow(ctx, n.dataset.id, draw),
    });
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-tab]");
      if (!c) return;
      tab = c.dataset.tab;
      draw();
    });

    draw();
    return root;
  },
};

function row(p, staff) {
  const st = PACKAGE_STATUS[p.status];
  const waited = p.status === "waiting" ? duration(p.receivedAt) : "";
  const sub = [
    unitLabel(p.block, p.unit),
    p.courier,
    p.status === "waiting" ? `${waited} bekliyor` : `${timeAgo(p.deliveredAt)} teslim edildi`,
  ]
    .filter(Boolean)
    .join(" · ");
  const stale = p.status === "waiting" && Date.now() - new Date(p.receivedAt) > 24 * 3600 * 1000;

  return `<div class="item ${stale ? "item--danger" : p.status === "waiting" ? "item--accent" : ""}">
    <span class="item__avatar">${icon("package")}</span>
    <button class="item__body" type="button" data-act="open" data-id="${esc(p.id)}"
      style="background:none;border:0;text-align:left;padding:0;color:inherit;cursor:pointer">
      <span class="item__title">${esc(p.recipientName)} ${badge(st.label, st.tone)}${
    stale ? badge("24 sa+", "danger") : ""
  }</span>
      <span class="item__sub">${esc(sub)}</span>
    </button>
    ${
      staff && p.status === "waiting"
        ? `<button class="btn btn--sm btn--primary" type="button" data-act="deliver" data-id="${esc(
            p.id
          )}">Teslim et</button>`
        : ""
    }
  </div>`;
}

async function receiveFlow(ctx) {
  const site = db.raw().site;
  const res = await ctx.sheet({
    title: "Kargo teslim al",
    desc: "Kulübeye bırakılan kargoyu kaydedin; ilgili daireye anında bildirim gider.",
    body: `
      ${fieldSelect({
        name: "courier",
        label: "Kargo firması",
        options: [
          ["Kargo — Yurtiçi", "Yurtiçi Kargo"],
          ["Kargo — Aras", "Aras Kargo"],
          ["Kargo — MNG", "MNG Kargo"],
          ["Kargo — PTT", "PTT Kargo"],
          ["Kurye", "Kurye / motokurye"],
          ["Diğer", "Diğer"],
        ],
      })}
      <div class="row" style="gap:10px;align-items:flex-start">
        <div style="flex:1">${fieldSelect({
          name: "block",
          label: "Blok",
          options: site.blocks.map((b) => [b, b + " Blok"]),
        })}</div>
        <div style="flex:1">${fieldText({
          name: "unit",
          label: "Daire",
          placeholder: "12",
          inputmode: "numeric",
        })}</div>
      </div>
      <div id="pkghost"></div>
      ${fieldText({ name: "note", label: "Not (isteğe bağlı)", placeholder: "Örn. 2 koli" })}`,
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Kaydet", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      const refresh = () => {
        const f = formData(box);
        const host = findHost(f.block, f.unit);
        qs("#pkghost", box).innerHTML = host
          ? `<div class="card card--flat" style="margin:-4px 0 13px">${kv(
              "Alıcı",
              esc(host.name)
            )}</div>`
          : f.unit
          ? banner("Bu daireye kayıtlı sakin yok; kayıt yine de alınabilir.", "warn", "alert")
          : "";
      };
      qs('[name="unit"]', box).addEventListener("input", refresh);
      qs('[name="block"]', box).addEventListener("change", refresh);
      box.querySelector('[data-keep="1"]').addEventListener("click", () => close(formData(box)));
    },
  });
  if (!res) return;
  if (!res.unit?.trim()) return ctx.toast.err("Daire numarası gerekli.");

  const host = findHost(res.block, res.unit);
  const code = `${res.block}${String(res.unit).padStart(2, "0")}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const rec = db.insert("packages", {
    courier: res.courier,
    block: res.block,
    unit: res.unit.trim(),
    hostId: host?.id || "",
    recipientName: host?.name || `${unitLabel(res.block, res.unit)} sakini`,
    note: res.note?.trim() || "",
    code,
    status: "waiting",
    receivedAt: db.nowIso(),
    byGuard: ctx.user.id,
  });
  db.log({
    kind: "package",
    by: ctx.user.name,
    text: `Kargo teslim alındı: ${unitLabel(rec.block, rec.unit)} ${rec.recipientName} (${rec.courier})`,
  });
  if (host)
    ctx.pushNotification({
      to: host.id,
      kind: "package",
      title: "Kargonuz kulübede",
      body: `${rec.courier} · Teslim kodu ${code}`,
      link: "/packages",
    });
  ctx.toast.ok("Kargo kaydedildi.");
}

async function deliverFlow(ctx, id, redraw) {
  const p = db.find("packages", id);
  if (!p) return;
  const res = await ctx.sheet({
    title: "Kargoyu teslim et",
    desc: `${p.recipientName} · ${unitLabel(p.block, p.unit)}`,
    body: `
      <div class="codebox" style="margin-bottom:14px">
        <div class="codebox__label">Teslim kodu</div>
        <div class="codebox__code">${esc(p.code)}</div>
      </div>
      ${fieldText({
        name: "takenBy",
        label: "Teslim alan kişi",
        value: p.recipientName,
        hint: "Daire sakini değilse adını yazın.",
      })}`,
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Teslim edildi", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      box.querySelector('[data-keep="1"]').addEventListener("click", () =>
        close(box.querySelector('[name="takenBy"]').value.trim() || p.recipientName)
      );
    },
  });
  if (!res) return;
  db.update("packages", id, { status: "delivered", deliveredAt: db.nowIso(), takenBy: res });
  db.log({
    kind: "package",
    by: ctx.user.name,
    text: `Kargo teslim edildi: ${unitLabel(p.block, p.unit)} → ${res}`,
  });
  if (p.hostId)
    ctx.pushNotification({
      to: p.hostId,
      kind: "package",
      title: "Kargonuz teslim edildi",
      body: `${res} tarafından alındı.`,
      link: "/packages",
    });
  ctx.toast.ok("Teslim kaydedildi.");
  redraw?.();
}

async function detail(ctx, id, redraw) {
  const p = db.find("packages", id);
  if (!p) return;
  const staff = ctx.user.role !== "resident";
  const body = `
    ${
      p.status === "waiting"
        ? `<div class="codebox" style="margin-bottom:14px">
            <div class="codebox__label">Teslim kodu</div>
            <div class="codebox__code">${esc(p.code)}</div>
          </div>`
        : ""
    }
    ${kv("Alıcı", esc(p.recipientName))}
    ${kv("Daire", esc(unitLabel(p.block, p.unit)))}
    ${kv("Firma", esc(p.courier))}
    ${kv("Teslim alındı", esc(fmtDateTime(p.receivedAt)))}
    ${p.deliveredAt ? kv("Teslim edildi", esc(fmtDateTime(p.deliveredAt))) : ""}
    ${p.takenBy ? kv("Teslim alan", esc(p.takenBy)) : ""}
    ${p.note ? kv("Not", esc(p.note)) : ""}
    ${p.byGuard ? kv("Kaydeden", esc(db.find("users", p.byGuard)?.name || "—")) : ""}`;

  const acts = [{ label: "Kapat", value: null }];
  if (staff && p.status === "waiting")
    acts.push({ label: "Teslim et", variant: "primary", value: "deliver" });

  const r = await ctx.sheet({ title: "Kargo kaydı", body, actions: acts });
  if (r === "deliver") await deliverFlow(ctx, id, redraw);
  redraw?.();
}

function findHost(block, unit) {
  if (!unit) return null;
  return (
    db
      .list("users", (u) => u.role === "resident")
      .find(
        (u) =>
          String(u.block).toLocaleUpperCase("tr") === String(block).toLocaleUpperCase("tr") &&
          String(u.unit) === String(unit).trim()
      ) || null
  );
}
