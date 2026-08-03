/** Ana ekran — role göre tamamen farklı içerik gösterir. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { setupGaps, brandName } from "../core/brand.js";
import { el, actions } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  sectionTitle,
  tile,
  listItem,
  stat,
  empty,
  badge,
  banner,
} from "../ui/components.js";
import { fieldTextarea } from "../ui/components.js";
import {
  esc,
  greeting,
  timeAgo,
  duration,
  unitLabel,
  fmtTime,
  initials,
  INCIDENT_STATUS,
  PRIORITY,
  VISITOR_STATUS,
  LOG_KINDS,
} from "../util/format.js";

export default {
  title: () => db.raw().site.shortName || db.raw().site.name || brandName(),
  subtitle: (ctx) => auth.roleLabel(ctx.user.role),
  live: true,

  async render(ctx) {
    const u = ctx.user;
    const root = el('<div></div>');
    if (u.role === "guard") root.innerHTML = guardHome(u);
    else if (u.role === "admin") root.innerHTML = adminHome(u);
    else root.innerHTML = residentHome(u);

    actions(root, {
      go: (n) => ctx.navigate(n.dataset.to),
      startShift: () => {
        auth.startShift();
        ctx.toast.ok("Vardiya başladı. İyi nöbetler.");
      },
      endShift: () => endShiftFlow(ctx),
      openIncident: (n) => ctx.navigate(`/incidents/${n.dataset.id}`),
      panic: () => ctx.navigate("/emergency"),
    });
    return root;
  },
};

/* ------------------------------------------------------------------ */
/* Görevli                                                             */
/* ------------------------------------------------------------------ */

function guardHome(u) {
  const shift = auth.activeShift();
  const inside = db.list("visitors", (v) => v.status === "inside");
  const expected = db.list("visitors", (v) => v.status === "expected");
  const waitingPkgs = db.list("packages", (p) => p.status === "waiting");
  const openInc = db.list("incidents", (i) => i.status !== "resolved");
  const critical = openInc.filter((i) => i.priority === "critical");
  const activePatrol = db.list("patrols").find((p) => !p.endedAt);
  const lastShift = db
    .list("shifts", (s) => s.endedAt && s.handover)
    .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0];
  const logs = db
    .list("logs")
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);

  return `
    ${critical.length ? criticalBanner(critical) : ""}

    <div class="card ${shift ? "card--accent" : ""}">
      <div class="card__head">
        <span class="tile__icon">${icon(shift ? "shield-check" : "shield")}</span>
        <div class="card__title">
          ${esc(greeting(u.role))}, ${esc(u.name.split(" ")[0])}
          <div class="faint">${shift ? "Vardiyanız açık" : "Vardiya başlatılmadı"}</div>
        </div>
        ${shift ? '<span class="pill-live">CANLI</span>' : ""}
      </div>
      ${
        shift
          ? `<div class="row" style="gap:16px;margin-bottom:12px">
              <div><div class="tiny faint">BAŞLANGIÇ</div><div class="strong">${fmtTime(
                shift.startedAt
              )}</div></div>
              <div><div class="tiny faint">SÜRE</div><div class="strong">${duration(
                shift.startedAt
              )}</div></div>
              <div><div class="tiny faint">GÖREV</div><div class="strong">${esc(
                u.badge || "—"
              )}</div></div>
            </div>
            <button class="btn btn--block btn--ghost" type="button" data-act="endShift">
              ${icon("logout")} Vardiyayı devret
            </button>`
          : `<button class="btn btn--block btn--primary" type="button" data-act="startShift">
              ${icon("play")} Vardiyayı devral
            </button>`
      }
    </div>

    <div class="grid grid-2" style="margin-top:10px">
      ${stat(inside.length, "İçerideki ziyaretçi", inside.length ? "ok" : "")}
      ${stat(waitingPkgs.length, "Kulübedeki kargo", waitingPkgs.length ? "warn" : "")}
      ${stat(openInc.length, "Açık olay", openInc.length ? "danger" : "")}
      ${stat(expected.length, "Bekleyen misafir", "")}
    </div>

    ${sectionTitle("Hızlı işlem")}
    <div class="grid grid-2">
      ${tile({
        icon: "user-plus",
        label: "Ziyaretçi girişi",
        meta: "Kayıt aç, kod doğrula",
        act: "go",
        data: { to: "/visitors/new" },
      })}
      ${tile({
        icon: "package",
        label: "Kargo teslim al",
        meta: waitingPkgs.length ? `${waitingPkgs.length} kargo bekliyor` : "Kulübe boş",
        tone: "info",
        act: "go",
        data: { to: "/packages" },
      })}
      ${tile({
        icon: "alert",
        label: "Olay bildir",
        meta: "Fotoğraflı kayıt",
        tone: "danger",
        act: "go",
        data: { to: "/incidents/new" },
      })}
      ${tile({
        icon: "route",
        label: activePatrol ? "Devriye sürüyor" : "Devriye başlat",
        meta: activePatrol
          ? `${activePatrol.scans.length}/${db.list("checkpoints").length} nokta`
          : "8 kontrol noktası",
        tone: activePatrol ? "ok" : "",
        act: "go",
        data: { to: "/patrol" },
      })}
    </div>

    ${
      lastShift
        ? `${sectionTitle("Önceki vardiyadan devir notu")}
           <div class="card card--flat">
             <div class="faint tiny">${esc(nameOf(lastShift.guardId))} · ${esc(
            timeAgo(lastShift.endedAt)
          )}</div>
             <p style="margin-top:6px">${esc(lastShift.handover)}</p>
           </div>`
        : ""
    }

    ${sectionTitle(
      "İçerideki ziyaretçiler",
      '<button class="link" data-act="go" data-to="/visitors">Tümü</button>'
    )}
    ${
      inside.length
        ? `<div class="list">${inside
            .slice(0, 3)
            .map((v) =>
              listItem({
                initials: initials(v.name),
                title: v.name,
                sub: `${unitLabel(v.block, v.unit)} · ${v.plate || "Yaya"} · ${timeAgo(
                  v.enteredAt
                )} girdi`,
                badges: badge(VISITOR_STATUS.inside.label, "ok"),
                act: "go",
                data: { to: "/visitors" },
              })
            )
            .join("")}</div>`
        : `<div class="card card--flat center faint">Şu anda içeride kayıtlı ziyaretçi yok.</div>`
    }

    ${sectionTitle(
      "Açık olaylar",
      '<button class="link" data-act="go" data-to="/incidents">Tümü</button>'
    )}
    ${
      openInc.length
        ? `<div class="list">${openInc
            .slice(0, 3)
            .map(incidentRow)
            .join("")}</div>`
        : `<div class="card card--flat center faint">Açık olay yok. Sakin bir nöbet.</div>`
    }

    ${sectionTitle(
      "Son hareketler",
      '<button class="link" data-act="go" data-to="/logbook">Nöbet defteri</button>'
    )}
    <div class="card card--flat">
      <div class="timeline">
        ${logs
          .map(
            (l) => `<div class="tl ${l.kind === "panic" ? "tl--danger" : "tl--accent"}">
              <div class="tl__time">${esc(fmtTime(l.at))} · ${esc(
              LOG_KINDS[l.kind]?.label || "Kayıt"
            )}</div>
              <div class="tl__text">${esc(l.text)}</div>
            </div>`
          )
          .join("")}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Sakin                                                               */
/* ------------------------------------------------------------------ */

function residentHome(u) {
  const myVisitors = db.list(
    "visitors",
    (v) => v.hostId === u.id && ["expected", "inside"].includes(v.status)
  );
  const myPkgs = db.list("packages", (p) => p.hostId === u.id && p.status === "waiting");
  const myIncidents = db.list(
    "incidents",
    (i) => i.reporterId === u.id && i.status !== "resolved"
  );
  const pinned = db.list("announcements").filter((a) => a.pinned)[0];
  const latest = db
    .list("announcements")
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 2);
  const myBookings = db
    .list("bookings", (b) => b.userId === u.id)
    .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot))
    .slice(0, 2);

  return `
    <div class="card card--accent">
      <div class="card__head">
        <span class="tile__icon">${icon("home")}</span>
        <div class="card__title">
          ${esc(greeting(u.role))}, ${esc(u.name.split(" ")[0])}
          <div class="faint">${esc(db.raw().site.name)} · ${esc(
    unitLabel(u.block, u.unit)
  )}</div>
        </div>
      </div>
      <div class="row" style="gap:8px">
        <a class="btn btn--sm" href="tel:${esc(db.raw().site.guardPhone)}">
          ${icon("phone")} Güvenliği ara
        </a>
        <button class="btn btn--sm btn--danger" type="button" data-act="panic">
          ${icon("siren")} Acil
        </button>
      </div>
    </div>

    ${
      myPkgs.length
        ? banner(
            `<strong>${myPkgs.length} kargonuz</strong> güvenlik kulübesinde sizi bekliyor.`,
            "warn",
            "package"
          )
        : ""
    }

    ${sectionTitle("Ne yapmak istersiniz?")}
    <div class="grid grid-2">
      ${tile({
        icon: "user-plus",
        label: "Misafir bildir",
        meta: "Kapıda beklemesin",
        act: "go",
        data: { to: "/visitors/new" },
      })}
      ${tile({
        icon: "clipboard",
        label: "Talep / arıza aç",
        meta: "Fotoğraf ekleyebilirsiniz",
        tone: "danger",
        act: "go",
        data: { to: "/incidents/new" },
      })}
      ${tile({
        icon: "package",
        label: "Kargolarım",
        meta: myPkgs.length ? `${myPkgs.length} kargo bekliyor` : "Bekleyen yok",
        tone: "info",
        act: "go",
        data: { to: "/packages" },
        count: myPkgs.length,
      })}
      ${tile({
        icon: "waves",
        label: "Tesis rezervasyonu",
        meta: "Havuz, spor, salon",
        tone: "ok",
        act: "go",
        data: { to: "/services" },
      })}
    </div>

    ${
      pinned
        ? `${sectionTitle("Önemli duyuru")}
          <div class="card card--accent">
            <div class="card__head">
              <span class="tile__icon">${icon("megaphone")}</span>
              <div class="card__title">${esc(pinned.title)}</div>
            </div>
            <p class="muted">${esc(pinned.body)}</p>
            <div class="faint tiny" style="margin-top:8px">${esc(pinned.author)} · ${esc(
            timeAgo(pinned.at)
          )}</div>
          </div>`
        : ""
    }

    ${
      myVisitors.length
        ? `${sectionTitle(
            "Misafirlerim",
            '<button class="link" data-act="go" data-to="/visitors">Tümü</button>'
          )}
          <div class="list">${myVisitors
            .map((v) =>
              listItem({
                initials: initials(v.name),
                title: v.name,
                sub:
                  v.status === "inside"
                    ? `${timeAgo(v.enteredAt)} giriş yaptı`
                    : `Kapı kodu: ${v.code}`,
                badges: badge(
                  VISITOR_STATUS[v.status].label,
                  VISITOR_STATUS[v.status].tone
                ),
                act: "go",
                data: { to: "/visitors" },
              })
            )
            .join("")}</div>`
        : ""
    }

    ${
      myIncidents.length
        ? `${sectionTitle(
            "Açık taleplerim",
            '<button class="link" data-act="go" data-to="/incidents">Tümü</button>'
          )}
          <div class="list">${myIncidents.map(incidentRow).join("")}</div>`
        : ""
    }

    ${
      myBookings.length
        ? `${sectionTitle("Rezervasyonlarım")}
          <div class="list">${myBookings
            .map((b) => {
              const am = db.find("amenities", b.amenityId);
              return listItem({
                icon: am?.icon || "calendar",
                title: am?.name || "Tesis",
                sub: `${b.date} · ${b.slot}`,
                act: "go",
                data: { to: "/services" },
              });
            })
            .join("")}</div>`
        : ""
    }

    ${sectionTitle(
      "Duyurular",
      '<button class="link" data-act="go" data-to="/announcements">Tümü</button>'
    )}
    <div class="list">
      ${latest
        .map((a) =>
          listItem({
            icon: "megaphone",
            title: a.title,
            sub: a.body,
            side: timeAgo(a.at),
            tone: a.level === "warn" ? "accent" : "",
            act: "go",
            data: { to: "/announcements" },
          })
        )
        .join("")}
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Yönetim                                                             */
/* ------------------------------------------------------------------ */

function adminHome(u) {
  const openInc = db.list("incidents", (i) => i.status !== "resolved");
  const today = new Date().toDateString();
  const todayVisitors = db.list(
    "visitors",
    (v) => v.enteredAt && new Date(v.enteredAt).toDateString() === today
  );
  const onDuty = auth.anyActiveShift();
  const waitingPkgs = db.list("packages", (p) => p.status === "waiting");
  const residents = db.list("users", (x) => x.role === "resident");
  const gaps = setupGaps();

  return `
    <div class="card card--accent">
      <div class="card__head">
        <span class="tile__icon">${icon("building")}</span>
        <div class="card__title">
          ${esc(greeting(u.role))}, ${esc(u.name.split(" ")[0])}
          <div class="faint">${esc(db.raw().site.name)}</div>
        </div>
      </div>
      <div class="kv"><span class="kv__k">Görevdeki personel</span>
        <span class="kv__v">${
          onDuty
            ? esc(nameOf(onDuty.guardId)) + " · " + duration(onDuty.startedAt)
            : '<span style="color:var(--danger)">Açık vardiya yok</span>'
        }</span></div>
      <div class="kv"><span class="kv__k">Kayıtlı sakin</span>
        <span class="kv__v">${residents.length} kişi</span></div>
    </div>

    <div class="grid grid-2" style="margin-top:10px">
      ${stat(openInc.length, "Açık olay", openInc.length ? "danger" : "")}
      ${stat(todayVisitors.length, "Bugün ziyaretçi")}
      ${stat(waitingPkgs.length, "Bekleyen kargo", waitingPkgs.length ? "warn" : "")}
      ${stat(db.list("bookings").length, "Rezervasyon")}
    </div>

    ${
      gaps.length
        ? `<button class="card card--accent" type="button" data-act="go" data-to="/admin"
            style="width:100%;text-align:left;cursor:pointer;margin-top:10px">
            <div class="card__head" style="margin:0">
              <span class="tile__icon">${icon("settings")}</span>
              <div class="card__title">Kurulumu tamamlayın
                <div class="faint">${gaps.length} madde bekliyor — yönetim paneli</div>
              </div>
              ${icon("chevron")}
            </div>
          </button>`
        : ""
    }

    ${sectionTitle("Hızlı işlem")}
    <div class="grid grid-2">
      ${tile({
        icon: "megaphone",
        label: "Duyuru yayınla",
        meta: "Tüm sakinlere",
        act: "go",
        data: { to: "/announcements" },
      })}
      ${tile({
        icon: "settings",
        label: "Yönetim paneli",
        meta: "Site ayarları, kullanıcılar",
        tone: "info",
        act: "go",
        data: { to: "/admin" },
        count: gaps.length,
      })}
      ${tile({
        icon: "chart",
        label: "Raporlar",
        meta: "Haftalık özet",
        tone: "ok",
        act: "go",
        data: { to: "/reports" },
      })}
      ${tile({
        icon: "building",
        label: "Sakinler",
        meta: `${residents.length} daire kaydı`,
        act: "go",
        data: { to: "/residents" },
      })}
    </div>

    ${sectionTitle(
      "Açık olaylar",
      '<button class="link" data-act="go" data-to="/incidents">Tümü</button>'
    )}
    ${
      openInc.length
        ? `<div class="list">${openInc.slice(0, 4).map(incidentRow).join("")}</div>`
        : empty("Açık olay yok", "Tüm kayıtlar çözüldü olarak işaretli.", "check-circle")
    }`;
}

/* ------------------------------------------------------------------ */
/* Ortak parçalar                                                      */
/* ------------------------------------------------------------------ */

function criticalBanner(list) {
  const i = list[0];
  return `<button class="card card--danger" type="button" data-act="openIncident" data-id="${esc(
    i.id
  )}" style="width:100%;text-align:left;cursor:pointer">
    <div class="card__head">
      <span class="tile__icon" style="background:var(--danger-soft);color:var(--danger)">${icon(
        "siren"
      )}</span>
      <div class="card__title">ACİL — müdahale bekliyor
        <div class="faint">${esc(i.title)}</div>
      </div>
      ${icon("chevron")}
    </div>
  </button>`;
}

function incidentRow(i) {
  const st = INCIDENT_STATUS[i.status];
  const pr = PRIORITY[i.priority];
  return listItem({
    icon: "alert",
    title: i.title,
    sub: `${i.block && i.block !== "-" ? unitLabel(i.block, i.unit) + " · " : ""}${timeAgo(i.at)}`,
    badges: badge(st.label, st.tone) + (i.priority === "critical" ? badge(pr.label, "danger") : ""),
    tone: i.priority === "critical" ? "danger" : i.status === "open" ? "accent" : "",
    act: "openIncident",
    data: { id: i.id },
  });
}

function nameOf(userId) {
  return db.find("users", userId)?.name || "—";
}

/* ------------------------------------------------------------------ */

async function endShiftFlow(ctx) {
  const note = await ctx.sheet({
    title: "Vardiyayı devret",
    desc: "Sonraki görevlinin bilmesi gerekenleri yazın. Bu not nöbet defterine işlenir.",
    body: fieldTextarea({
      name: "handover",
      label: "Devir notu",
      placeholder:
        "Örn: Otopark F2 aydınlatması arızalı, teknik servis yarın gelecek. A-12 misafiri hâlâ içeride.",
      rows: 5,
    }),
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Devret", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      box.querySelector('[data-keep="1"]').addEventListener("click", () => {
        close(box.querySelector('[name="handover"]').value.trim() || " ");
      });
    },
  });
  if (note === null || note === undefined) return;
  auth.endShift(note.trim());
  ctx.toast.ok("Vardiya devredildi.");
}
