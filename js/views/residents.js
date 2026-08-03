/** Sakin ve daire rehberi — görevli kapıda hızlı daire sorgular. */
import * as db from "../core/db.js";
import { el, qs, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, empty, kv, badge, banner } from "../ui/components.js";
import { esc, initials, unitLabel } from "../util/format.js";

export default {
  title: "Sakinler",
  subtitle: "Daire ve iletişim",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");
    let search = "";
    let block = "all";

    function rows() {
      const q = search.trim().toLocaleLowerCase("tr");
      return db
        .list("users", (u) => u.role === "resident")
        .filter((u) => block === "all" || u.block === block)
        .filter((u) => {
          if (!q) return true;
          const plates = db
            .list("vehicles", (v) => v.ownerId === u.id)
            .map((v) => v.plate)
            .join(" ");
          return `${u.name} ${u.block}${u.unit} ${u.block}-${u.unit} ${u.phone} ${plates}`
            .toLocaleLowerCase("tr")
            .includes(q);
        })
        .sort((a, b) => (a.block + a.unit.padStart(4, "0")).localeCompare(b.block + b.unit.padStart(4, "0")));
    }

    function draw() {
      const blocks = db.raw().site.blocks;
      const list = rows();
      root.innerHTML = `
        <label class="field">
          <span class="sr-only">Ara</span>
          <input class="input" name="q" placeholder="İsim, daire veya plaka ara" value="${esc(
            search
          )}" />
        </label>
        <div class="chiprow">
          <button class="chip" type="button" data-block="all" aria-pressed="${
            block === "all"
          }">Tüm bloklar</button>
          ${blocks
            .map(
              (b) =>
                `<button class="chip" type="button" data-block="${esc(b)}" aria-pressed="${
                  block === b
                }">${esc(b)} Blok</button>`
            )
            .join("")}
        </div>
        ${banner(
          "Bu bilgiler yalnızca görev gereği kullanılır. Ekran görüntüsü almayın, üçüncü kişilerle paylaşmayın.",
          "warn",
          "lock"
        )}
        <div style="height:12px"></div>
        ${
          list.length
            ? `<div class="list">${list
                .map((u) => {
                  const veh = db.list("vehicles", (v) => v.ownerId === u.id);
                  const pkgs = db.list(
                    "packages",
                    (p) => p.hostId === u.id && p.status === "waiting"
                  ).length;
                  return `<div class="item">
                    <span class="item__avatar">${esc(initials(u.name))}</span>
                    <button class="item__body" type="button" data-act="open" data-id="${esc(u.id)}"
                      style="background:none;border:0;text-align:left;padding:0;color:inherit;cursor:pointer">
                      <span class="item__title">${esc(u.name)} ${badge(
                    unitLabel(u.block, u.unit),
                    "info"
                  )}${pkgs ? badge(`${pkgs} kargo`, "warn") : ""}</span>
                      <span class="item__sub">${esc(
                        veh.map((v) => v.plate).join(", ") || "Kayıtlı araç yok"
                      )}</span>
                    </button>
                    <a class="btn btn--sm" href="tel:${esc(u.phone)}">${icon("phone")}</a>
                  </div>`;
                })
                .join("")}</div>`
            : empty("Sonuç yok", "Aramanızla eşleşen sakin bulunamadı.", "search")
        }`;

      const input = qs('[name="q"]', root);
      input.addEventListener("input", (e) => {
        search = e.target.value;
        const pos = e.target.selectionStart;
        draw();
        const fresh = qs('[name="q"]', root);
        fresh.focus();
        fresh.setSelectionRange(pos, pos);
      });
    }

    actions(root, {
      open: (n) => openResident(ctx, n.dataset.id),
    });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-block]");
      if (!b) return;
      block = b.dataset.block;
      draw();
    });

    draw();
    return root;
  },
};

async function openResident(ctx, id) {
  const u = db.find("users", id);
  if (!u) return;
  const veh = db.list("vehicles", (v) => v.ownerId === u.id);
  const pkgs = db.list("packages", (p) => p.hostId === u.id && p.status === "waiting");
  const visitors = db.list(
    "visitors",
    (v) => v.hostId === u.id && ["expected", "inside"].includes(v.status)
  );

  await ctx.sheet({
    title: u.name,
    desc: `${unitLabel(u.block, u.unit)} · ${db.raw().site.name}`,
    body: `
      ${kv("Telefon", `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>`)}
      ${kv("Daire", esc(unitLabel(u.block, u.unit)))}
      ${kv(
        "Araçlar",
        veh.length
          ? veh.map((v) => `<span class="mono">${esc(v.plate)}</span> ${esc(v.model)}`).join("<br>")
          : "—"
      )}
      ${kv("Bekleyen kargo", pkgs.length ? `${pkgs.length} adet` : "Yok")}
      ${kv(
        "Aktif misafir",
        visitors.length
          ? visitors.map((v) => `${esc(v.name)} (${esc(v.status === "inside" ? "içeride" : "bekleniyor")})`).join("<br>")
          : "Yok"
      )}`,
    actions: [
      { label: "Kapat", value: null },
      { label: "Ara", variant: "primary", value: "call" },
    ],
  }).then((r) => {
    if (r === "call") location.href = `tel:${u.phone}`;
  });
}
