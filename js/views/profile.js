/** Profil — kişisel bilgiler, araçlar ve kişisel özet. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  sectionTitle,
  kv,
  stat,
  listItem,
  empty,
  fieldText,
  banner,
} from "../ui/components.js";
import { esc, initials, unitLabel, timeAgo, duration, normalizePlate } from "../util/format.js";

export default {
  title: "Profilim",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const u = db.find("users", ctx.user.id);
      const resident = u.role === "resident";
      const vehicles = db.list("vehicles", (v) => v.ownerId === u.id);

      const mineVisitors = db.list("visitors", (v) =>
        resident ? v.hostId === u.id : v.byGuard === u.id
      );
      const myIncidents = db.list("incidents", (i) => i.reporterId === u.id);
      const myShifts = db.list("shifts", (s) => s.guardId === u.id && s.endedAt);
      const myPatrols = db.list("patrols", (p) => p.guardId === u.id && p.endedAt);

      root.innerHTML = `
        <div class="card">
          <div class="row" style="gap:14px">
            <span class="item__avatar" style="width:58px;height:58px;font-size:19px;border-radius:18px">
              ${esc(initials(u.name))}
            </span>
            <div>
              <div class="strong" style="font-size:19px">${esc(u.name)}</div>
              <div class="faint">${esc(auth.roleLabel(u.role))}${
        u.badge ? " · " + esc(u.badge) : ""
      }</div>
            </div>
          </div>
          <div style="height:12px"></div>
          ${resident ? kv("Daire", esc(unitLabel(u.block, u.unit))) : ""}
          ${kv("Telefon", `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>`)}
          ${kv("Site", esc(db.raw().site.name))}
          <button class="btn btn--block btn--ghost" type="button" data-act="editPhone" style="margin-top:12px">
            ${icon("edit")} Telefonu güncelle
          </button>
        </div>

        ${sectionTitle(resident ? "Özetim" : "Görev özetim")}
        <div class="grid grid-2">
          ${
            resident
              ? `${stat(mineVisitors.length, "Bildirdiğim misafir")}
                 ${stat(myIncidents.length, "Açtığım talep")}
                 ${stat(
                   db.list("packages", (p) => p.hostId === u.id).length,
                   "Kargo kaydım"
                 )}
                 ${stat(db.list("bookings", (b) => b.userId === u.id).length, "Rezervasyon")}`
              : `${stat(myShifts.length, "Tamamlanan vardiya")}
                 ${stat(myPatrols.length, "Devriye turu")}
                 ${stat(mineVisitors.length, "Kaydettiğim giriş")}
                 ${stat(myIncidents.length, "Bildirdiğim olay")}`
          }
        </div>

        ${
          resident
            ? `${sectionTitle(
                "Araçlarım",
                '<button class="link" data-act="addVehicle">+ Araç ekle</button>'
              )}
              ${
                vehicles.length
                  ? `<div class="list">${vehicles
                      .map(
                        (v) => `<div class="item item--static">
                          <span class="item__avatar">${icon("car")}</span>
                          <span class="item__body">
                            <span class="item__title mono">${esc(v.plate)}</span>
                            <span class="item__sub">${esc(
                              [v.model, v.color].filter(Boolean).join(" · ")
                            )}</span>
                          </span>
                          <button class="btn btn--sm btn--ghost" type="button" data-act="delVehicle"
                            data-id="${esc(v.id)}" style="color:var(--danger)">${icon("trash")}</button>
                        </div>`
                      )
                      .join("")}</div>`
                  : empty(
                      "Araç kaydı yok",
                      "Plakanızı eklerseniz güvenlik otoparkta aracınızı tanır.",
                      "car"
                    )
              }`
            : `${sectionTitle("Son vardiyalarım")}
              ${
                myShifts.length
                  ? `<div class="list">${myShifts
                      .slice(0, 5)
                      .map((s) =>
                        listItem({
                          icon: "clock",
                          title: duration(s.startedAt, s.endedAt) + " vardiya",
                          sub: s.handover || "Devir notu yok",
                          side: timeAgo(s.endedAt),
                          static: true,
                        })
                      )
                      .join("")}</div>`
                  : empty("Kayıt yok", "Tamamlanan vardiyalarınız burada listelenir.", "clock")
              }`
        }

        ${banner(
          "Kimlik ve yetki bilgileri site yönetimi tarafından tanımlanır. Değişiklik için yönetime başvurun.",
          "",
          "lock"
        )}`;
    }

    actions(root, {
      editPhone: async () => {
        const u = db.find("users", ctx.user.id);
        const val = await ctx.sheet({
          title: "Telefon güncelle",
          body: fieldText({ name: "phone", label: "Telefon", value: u.phone, type: "tel" }),
          actions: [
            { label: "Vazgeç", value: null },
            { label: "Kaydet", variant: "primary", keep: true },
          ],
          onMount(box, close) {
            box
              .querySelector('[data-keep="1"]')
              .addEventListener("click", () => close(qs('[name="phone"]', box).value.trim()));
          },
        });
        if (!val) return;
        db.update("users", u.id, { phone: val });
        ctx.toast.ok("Telefon güncellendi.");
        draw();
      },

      addVehicle: async () => {
        const res = await ctx.sheet({
          title: "Araç ekle",
          desc: "Plakanız güvenlik kayıtlarında aracınızı tanımak için kullanılır.",
          body: `
            ${fieldText({
              name: "plate",
              label: "Plaka",
              placeholder: "34 ABC 123",
              cls: "input--plate",
            })}
            ${fieldText({ name: "model", label: "Marka / model", placeholder: "Renault Clio" })}
            ${fieldText({ name: "color", label: "Renk", placeholder: "Beyaz" })}`,
          actions: [
            { label: "Vazgeç", value: null },
            { label: "Ekle", variant: "primary", keep: true },
          ],
          onMount(box, close) {
            box.querySelector('[data-keep="1"]').addEventListener("click", () =>
              close({
                plate: qs('[name="plate"]', box).value,
                model: qs('[name="model"]', box).value.trim(),
                color: qs('[name="color"]', box).value.trim(),
              })
            );
          },
        });
        if (!res || !res.plate.trim()) return;
        db.insert("vehicles", {
          ownerId: ctx.user.id,
          plate: normalizePlate(res.plate),
          model: res.model,
          color: res.color,
        });
        ctx.toast.ok("Araç eklendi.");
        draw();
      },

      delVehicle: async (n) => {
        const ok = await ctx.confirm({
          title: "Aracı sil",
          confirmLabel: "Sil",
          variant: "danger",
        });
        if (!ok) return;
        db.remove("vehicles", n.dataset.id);
        draw();
      },
    });

    draw();
    return root;
  },
};
