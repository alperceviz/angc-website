/** Devriye turu: kontrol noktalarını sırayla okutma. */
import * as db from "../core/db.js";
import * as auth from "../core/auth.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, listItem, badge, empty, banner, kv } from "../ui/components.js";
import { getPosition } from "../util/media.js";
import { esc, fmtTime, timeAgo, duration } from "../util/format.js";

export default {
  title: "Devriye",
  subtitle: "Kontrol noktaları",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");

    function draw() {
      const checkpoints = db.list("checkpoints").sort((a, b) => a.order - b.order);
      const active = db.list("patrols").find((p) => !p.endedAt && p.guardId === ctx.user.id);
      const others = db.list("patrols").find((p) => !p.endedAt && p.guardId !== ctx.user.id);
      const done = new Set((active?.scans || []).map((s) => s.checkpointId));
      const past = db
        .list("patrols", (p) => p.endedAt)
        .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
        .slice(0, 5);

      root.innerHTML = `
        ${
          active
            ? `<div class="card card--accent">
                <div class="card__head">
                  <span class="tile__icon">${icon("route")}</span>
                  <div class="card__title">Tur sürüyor
                    <div class="faint">${fmtTime(active.startedAt)} başladı · ${duration(
                active.startedAt
              )}</div>
                  </div>
                  <span class="pill-live">CANLI</span>
                </div>
                <div class="progress"><div class="progress__bar" style="width:${Math.round(
                  (done.size / checkpoints.length) * 100
                )}%"></div></div>
                <div class="row" style="margin-top:8px">
                  <span class="faint">${done.size} / ${checkpoints.length} nokta okutuldu</span>
                  <span class="spacer"></span>
                  <button class="btn btn--sm ${
                    done.size === checkpoints.length ? "btn--primary" : ""
                  }" type="button" data-act="finish">
                    ${icon("stop")} Turu bitir
                  </button>
                </div>
              </div>`
            : `<div class="card">
                <div class="card__head">
                  <span class="tile__icon">${icon("route")}</span>
                  <div class="card__title">Devriye turu
                    <div class="faint">${checkpoints.length} kontrol noktası</div>
                  </div>
                </div>
                ${
                  others
                    ? banner(
                        `${esc(
                          db.find("users", others.guardId)?.name || "Bir görevli"
                        )} şu anda turda. Yine de kendi turunuzu başlatabilirsiniz.`,
                        "warn",
                        "info"
                      )
                    : ""
                }
                <button class="btn btn--block btn--primary" type="button" data-act="start" style="margin-top:10px">
                  ${icon("play")} Turu başlat
                </button>
              </div>`
        }

        ${sectionTitle("Kontrol noktaları")}
        <div class="list">
          ${checkpoints
            .map((c) => {
              const scan = (active?.scans || []).find((s) => s.checkpointId === c.id);
              return listItem({
                icon: scan ? "check-circle" : "pin",
                title: c.name,
                sub: scan
                  ? `${fmtTime(scan.at)} okutuldu${scan.note ? " · " + scan.note : ""}${
                      scan.manual ? " · elle onay" : ""
                    }`
                  : `${c.zone} · Nokta kodu: ${"•".repeat(4)}`,
                badges: scan ? badge("Tamam", "ok") : active ? badge("Bekliyor", "warn") : "",
                tone: scan ? "ok" : "",
                act: active && !scan ? "scan" : "info",
                data: { id: c.id },
                chevron: Boolean(active && !scan),
              });
            })
            .join("")}
        </div>

        ${sectionTitle("Geçmiş turlar")}
        ${
          past.length
            ? `<div class="list">${past
                .map((p) =>
                  listItem({
                    icon: "route",
                    title: `${db.find("users", p.guardId)?.name || "—"}`,
                    sub: `${p.scans.length}/${checkpoints.length} nokta · ${duration(
                      p.startedAt,
                      p.endedAt
                    )} sürdü`,
                    side: timeAgo(p.endedAt),
                    act: "past",
                    data: { id: p.id },
                  })
                )
                .join("")}</div>`
            : empty("Geçmiş tur yok", "Tamamlanan turlar burada listelenir.", "route")
        }`;
    }

    actions(root, {
      start: () => {
        db.insert("patrols", { guardId: ctx.user.id, startedAt: db.nowIso(), scans: [] });
        db.log({ kind: "patrol", by: ctx.user.name, text: "Devriye turu başlatıldı." });
        ctx.toast.ok("Tur başladı.");
        draw();
      },
      scan: (n) => scanFlow(ctx, n.dataset.id, draw),
      finish: () => finishFlow(ctx, draw),
      info: (n) => {
        const c = db.find("checkpoints", n.dataset.id);
        ctx.sheet({
          title: c.name,
          body: `${kv("Bölge", esc(c.zone))}${kv("Sıra", c.order)}${kv(
            "Nokta kodu",
            `<span class="mono">${esc(c.code)}</span>`
          )}
          ${banner(
            "Gerçek kurulumda bu noktaya QR/NFC etiketi yapıştırılır ve görevli telefonu okutur. Demo için kod elle giriliyor.",
            "",
            "info"
          )}`,
          actions: [{ label: "Kapat", value: 1 }],
        });
      },
      past: (n) => {
        const p = db.find("patrols", n.dataset.id);
        ctx.sheet({
          title: "Tur özeti",
          desc: `${db.find("users", p.guardId)?.name} · ${fmtTime(p.startedAt)} – ${fmtTime(
            p.endedAt
          )}`,
          body: `<div class="timeline">${p.scans
            .map(
              (s) => `<div class="tl tl--ok">
                <div class="tl__time">${esc(fmtTime(s.at))}</div>
                <div class="tl__text">${esc(
                  db.find("checkpoints", s.checkpointId)?.name || s.checkpointId
                )}${s.note ? ` — ${esc(s.note)}` : ""}</div>
              </div>`
            )
            .join("")}</div>`,
          actions: [{ label: "Kapat", value: 1 }],
        });
      },
    });

    draw();
    return root;
  },
};

async function scanFlow(ctx, checkpointId, redraw) {
  const cp = db.find("checkpoints", checkpointId);
  const res = await ctx.sheet({
    title: cp.name,
    desc: "Noktadaki etikette yazan 4 haneli kodu girin.",
    body: `
      <input class="input input--code" name="code" inputmode="numeric" maxlength="4" placeholder="0000" />
      <div id="scanmsg" style="margin-top:10px"></div>
      <label class="field" style="margin-top:12px">
        <span class="field__label">Not (isteğe bağlı)</span>
        <input class="input" name="note" placeholder="Örn. kapı açık bulundu, kapatıldı" />
      </label>
      <button class="btn btn--block btn--ghost" type="button" data-manual style="margin-top:4px">
        ${icon("alert")} Kodu okuyamıyorum, elle onayla
      </button>`,
    actions: [
      { label: "Vazgeç", value: null },
      { label: "Onayla", variant: "primary", keep: true },
    ],
    onMount(box, close) {
      const input = qs('[name="code"]', box);
      const msg = qs("#scanmsg", box);
      const submit = (manual) => {
        const note = qs('[name="note"]', box).value.trim();
        if (manual) return close({ note, manual: true });
        if (input.value.trim() !== cp.code) {
          msg.innerHTML = banner("Kod bu noktayla eşleşmiyor.", "danger", "alert");
          return;
        }
        close({ note, manual: false });
      };
      input.addEventListener("input", () => {
        msg.innerHTML = "";
        if (input.value.length === 4) submit(false);
      });
      box.querySelector('[data-keep="1"]').addEventListener("click", () => submit(false));
      box.querySelector("[data-manual]").addEventListener("click", () => submit(true));
    },
  });
  if (!res) return;

  const patrol = db.list("patrols").find((p) => !p.endedAt && p.guardId === ctx.user.id);
  if (!patrol) return;
  const pos = await getPosition(4000);
  db.update("patrols", patrol.id, {
    scans: [
      ...patrol.scans,
      { checkpointId, at: db.nowIso(), note: res.note, manual: res.manual, pos },
    ],
  });
  db.log({
    kind: "patrol",
    by: ctx.user.name,
    text: `Nokta okutuldu: ${cp.name}${res.manual ? " (elle onay)" : ""}${
      res.note ? " — " + res.note : ""
    }`,
  });
  ctx.toast.ok(`${cp.name} okutuldu.`);
  redraw();
}

async function finishFlow(ctx, redraw) {
  const patrol = db.list("patrols").find((p) => !p.endedAt && p.guardId === ctx.user.id);
  if (!patrol) return;
  const total = db.list("checkpoints").length;
  const missing = total - patrol.scans.length;
  const ok = await ctx.confirm({
    title: "Turu bitir",
    desc: missing
      ? `${missing} nokta okutulmadı. Yine de turu kapatmak istiyor musunuz? Eksik noktalar rapora yansır.`
      : "Tüm noktalar okutuldu. Tur kapatılsın mı?",
    confirmLabel: "Turu bitir",
    variant: missing ? "danger" : "primary",
  });
  if (!ok) return;
  db.update("patrols", patrol.id, { endedAt: db.nowIso() });
  db.log({
    kind: "patrol",
    by: ctx.user.name,
    text: `Devriye turu tamamlandı (${patrol.scans.length}/${total} nokta).`,
  });
  if (missing)
    ctx.pushNotification({
      to: "admin",
      kind: "patrol",
      title: "Eksik devriye turu",
      body: `${ctx.user.name} turu ${patrol.scans.length}/${total} nokta ile kapattı.`,
      link: "/reports",
    });
  ctx.toast.ok("Tur kapatıldı.");
  redraw();
}
