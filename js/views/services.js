/** Sosyal tesisler, rezervasyon ve site hizmetleri. */
import * as db from "../core/db.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, listItem, badge, empty, banner, tile, kv } from "../ui/components.js";
import { esc, fmtDateLong, timeAgo } from "../util/format.js";

export default {
  title: "Hizmetler",
  subtitle: "Tesisler ve rezervasyon",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const amenities = db.list("amenities");
      const mine = db
        .list("bookings", (b) => b.userId === ctx.user.id)
        .filter((b) => b.date >= dayStr(0))
        .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));

      root.innerHTML = `
        ${sectionTitle("Sosyal tesisler")}
        <div class="list">
          ${amenities
            .map((a) => {
              const todayCount = db.list(
                "bookings",
                (b) => b.amenityId === a.id && b.date === dayStr(0)
              ).length;
              return listItem({
                icon: a.icon,
                title: a.name,
                sub: `${a.hours} · Bugün ${todayCount} rezervasyon`,
                badges: badge("Rezervasyon", "info"),
                act: "book",
                data: { id: a.id },
              });
            })
            .join("")}
        </div>

        ${sectionTitle("Rezervasyonlarım")}
        ${
          mine.length
            ? `<div class="list">${mine
                .map((b) => {
                  const a = db.find("amenities", b.amenityId);
                  return `<div class="item item--info">
                    <span class="item__avatar">${icon(a?.icon || "calendar")}</span>
                    <span class="item__body">
                      <span class="item__title">${esc(a?.name || "Tesis")}</span>
                      <span class="item__sub">${esc(fmtDateLong(b.date))} · ${esc(b.slot)}${
                    b.people > 1 ? ` · ${b.people} kişi` : ""
                  }</span>
                    </span>
                    <button class="btn btn--sm btn--ghost" type="button" data-act="cancel"
                      data-id="${esc(b.id)}" style="color:var(--danger)">İptal</button>
                  </div>`;
                })
                .join("")}</div>`
            : `<div class="card card--flat center faint">Yaklaşan rezervasyonunuz yok.</div>`
        }

        ${sectionTitle("Site hizmetleri")}
        <div class="grid grid-2">
          ${tile({
            icon: "tool",
            label: "Teknik servis",
            meta: "Arıza kaydı aç",
            act: "go",
            data: { to: "/incidents/new" },
          })}
          ${tile({
            icon: "droplet",
            label: "Temizlik talebi",
            meta: "Ortak alanlar",
            tone: "info",
            act: "go",
            data: { to: "/incidents/new" },
          })}
          ${tile({
            icon: "phone",
            label: "Telefon rehberi",
            meta: "Yönetim, teknik, acil",
            tone: "ok",
            act: "go",
            data: { to: "/directory" },
          })}
          ${tile({
            icon: "megaphone",
            label: "Duyurular",
            meta: `${db.list("announcements").length} kayıt`,
            act: "go",
            data: { to: "/announcements" },
          })}
        </div>

        ${banner(
          "Tesis kuralları ve doluluk bilgisi yönetim tarafından güncellenir. Rezervasyonunuzu kullanmayacaksanız iptal ederek sıradakine yer açın.",
          "",
          "info"
        )}`;
    }

    actions(root, {
      go: (n) => ctx.navigate(n.dataset.to),
      book: (n) => bookFlow(ctx, n.dataset.id, draw),
      cancel: async (n) => {
        const ok = await ctx.confirm({
          title: "Rezervasyonu iptal et",
          confirmLabel: "İptal et",
          variant: "danger",
        });
        if (!ok) return;
        db.remove("bookings", n.dataset.id);
        ctx.toast.ok("Rezervasyon iptal edildi.");
        draw();
      },
    });

    draw();
    return root;
  },
};

function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "08:00 – 21:00" ve slot süresinden saat listesi üretir. */
function slotsOf(amenity) {
  const m = amenity.hours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return [];
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];
  const step = amenity.slotMinutes || 60;
  const out = [];
  for (let t = start; t + step <= end; t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

async function bookFlow(ctx, amenityId, redraw) {
  const a = db.find("amenities", amenityId);
  if (!a) return;
  let date = dayStr(0);

  const res = await ctx.sheet({
    title: a.name,
    desc: `${a.hours} · En fazla ${a.capacity} kişi${a.note ? " · " + a.note : ""}`,
    body: `
      <div class="chiprow" data-days>
        ${[0, 1, 2, 3]
          .map(
            (i) =>
              `<button class="chip" type="button" data-day="${dayStr(i)}" aria-pressed="${
                i === 0
              }">${i === 0 ? "Bugün" : i === 1 ? "Yarın" : esc(fmtDateLong(dayStr(i)))}</button>`
          )
          .join("")}
      </div>
      <div class="field__label">Saat seçin</div>
      <div class="grid grid-3" data-slots style="margin-top:8px"></div>`,
    actions: [{ label: "Kapat", value: null }],
    onMount(box, close) {
      const slotHost = qs("[data-slots]", box);
      const paint = () => {
        slotHost.innerHTML = slotsOf(a)
          .map((s) => {
            const taken = db.list(
              "bookings",
              (b) => b.amenityId === a.id && b.date === date && b.slot === s
            ).length;
            const full = taken >= a.capacity;
            const mineHere = db.list(
              "bookings",
              (b) =>
                b.amenityId === a.id &&
                b.date === date &&
                b.slot === s &&
                b.userId === ctx.user.id
            ).length;
            return `<button class="option" type="button" data-slot="${s}"
              ${full && !mineHere ? "disabled style=opacity:.4" : ""}
              aria-pressed="${mineHere ? "true" : "false"}">
              ${s}<div class="tiny faint">${full ? "Dolu" : `${a.capacity - taken} yer`}</div>
            </button>`;
          })
          .join("");
      };
      qs("[data-days]", box).addEventListener("click", (e) => {
        const b = e.target.closest("[data-day]");
        if (!b) return;
        date = b.dataset.day;
        box
          .querySelectorAll("[data-day]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        paint();
      });
      slotHost.addEventListener("click", (e) => {
        const b = e.target.closest("[data-slot]");
        if (!b || b.disabled) return;
        close({ date, slot: b.dataset.slot });
      });
      paint();
      // Slot ızgarası dikey olsun diye optionrow yerine grid kullanıyoruz.
      slotHost.style.gridTemplateColumns = "repeat(3, 1fr)";
    },
  });

  if (!res) return;
  const already = db
    .list("bookings")
    .find(
      (b) =>
        b.amenityId === a.id &&
        b.date === res.date &&
        b.slot === res.slot &&
        b.userId === ctx.user.id
    );
  if (already) {
    db.remove("bookings", already.id);
    ctx.toast.toast("Rezervasyon kaldırıldı.");
    return redraw();
  }
  db.insert("bookings", {
    amenityId: a.id,
    userId: ctx.user.id,
    date: res.date,
    slot: res.slot,
    people: 1,
    at: db.nowIso(),
  });
  db.log({
    kind: "booking",
    by: ctx.user.name,
    text: `${a.name} rezervasyonu: ${res.date} ${res.slot}`,
  });
  ctx.toast.ok(`${a.name} · ${res.slot} rezerve edildi.`);
  redraw();
}
