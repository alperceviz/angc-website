/** Raporlar — son 7 günün özeti. */
import * as db from "../core/db.js";
import * as lic from "../core/license.js";
import { el } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, stat, kv, banner, empty } from "../ui/components.js";
import { esc, duration, INCIDENT_TYPES, INCIDENT_STATUS } from "../util/format.js";

const DAY = 24 * 3600 * 1000;

/** Lisans süresi dolduğunda gösterilen ekran. */
export function lockedNotice(what) {
  return el(`<div>
    <div class="empty">${icon("lock", { size: 42 })}
      <div class="empty__title">${what} kilitli</div>
      <div class="empty__desc">Site yönetiminin lisans süresi doldu.</div>
    </div>
    ${banner(
      `Kapı kayıtları, kargo, olay bildirimi, devriye ve acil çağrı çalışmaya
       devam ediyor — güvenlik işlevleri lisansa bağlı değildir.`,
      "",
      "shield"
    )}
    <a class="btn btn--block btn--primary" href="#/admin/license" style="margin-top:12px">
      ${icon("key")} Lisans bilgilerine git
    </a>
  </div>`);
}

export default {
  title: "Raporlar",
  subtitle: "Son 7 gün",
  live: true,

  async render(ctx) {
    // Yönetim raporu lisansa bağlıdır; kapı ve sakin işlevleri değildir.
    if (lic.isLocked("reports")) return lockedNotice("Yönetim raporları");

    const since = Date.now() - 7 * DAY;
    const inWindow = (iso) => iso && new Date(iso).getTime() >= since;

    const visitors = db.list("visitors", (v) => inWindow(v.createdAt));
    const entered = visitors.filter((v) => v.enteredAt);
    const packages = db.list("packages", (p) => inWindow(p.receivedAt));
    const delivered = packages.filter((p) => p.status === "delivered");
    const incidents = db.list("incidents", (i) => inWindow(i.at));
    const resolved = incidents.filter((i) => i.status === "resolved");
    const patrols = db.list("patrols", (p) => inWindow(p.startedAt) && p.endedAt);
    const cpCount = db.list("checkpoints").length;
    const fullPatrols = patrols.filter((p) => p.scans.length >= cpCount).length;
    const shifts = db.list("shifts", (s) => inWindow(s.startedAt));

    // Günlük ziyaretçi grafiği
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY);
      const key = d.toDateString();
      return {
        label: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        visitors: entered.filter((v) => new Date(v.enteredAt).toDateString() === key).length,
        incidents: incidents.filter((x) => new Date(x.at).toDateString() === key).length,
      };
    });
    const maxDay = Math.max(1, ...days.map((d) => d.visitors + d.incidents));

    // Olay türü dağılımı
    const byType = {};
    incidents.forEach((i) => (byType[i.type] = (byType[i.type] || 0) + 1));
    const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const maxType = Math.max(1, ...typeRows.map(([, n]) => n));

    // Ortalama çözüm süresi
    const solved = resolved.filter((i) => i.resolvedAt);
    const avgMs = solved.length
      ? solved.reduce((s, i) => s + (new Date(i.resolvedAt) - new Date(i.at)), 0) / solved.length
      : 0;

    const root = el("<div></div>");
    root.innerHTML = `
      <div class="grid grid-2">
        ${stat(entered.length, "Ziyaretçi girişi")}
        ${stat(packages.length, "Kargo kaydı")}
        ${stat(incidents.length, "Olay kaydı", incidents.length ? "danger" : "")}
        ${stat(patrols.length, "Devriye turu", "ok")}
      </div>

      ${sectionTitle("Günlük hareket")}
      <div class="card">
        <div class="row" style="align-items:flex-end;gap:8px;height:140px">
          ${days
            .map(
              (d) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;height:100%">
                <div style="height:${(d.incidents / maxDay) * 100}%;background:var(--danger);border-radius:4px 4px 0 0;min-height:${
                d.incidents ? "4px" : "0"
              }"></div>
                <div style="height:${(d.visitors / maxDay) * 100}%;background:var(--accent);border-radius:${
                d.incidents ? "0" : "4px 4px"
              } 0 0;min-height:${d.visitors ? "4px" : "0"}"></div>
                <div class="tiny faint center">${esc(d.label)}</div>
              </div>`
            )
            .join("")}
        </div>
        <div class="row" style="gap:14px;margin-top:10px">
          <span class="tiny"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--accent)"></span> Ziyaretçi</span>
          <span class="tiny"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--danger)"></span> Olay</span>
        </div>
      </div>

      ${sectionTitle("Devriye uyumu")}
      <div class="card">
        <div class="row">
          <div class="stat__value">${
            patrols.length ? Math.round((fullPatrols / patrols.length) * 100) : 0
          }%</div>
          <div class="faint">tam tamamlanan tur<br>(${fullPatrols}/${patrols.length})</div>
        </div>
        <div class="progress" style="margin-top:10px">
          <div class="progress__bar" style="width:${
            patrols.length ? (fullPatrols / patrols.length) * 100 : 0
          }%"></div>
        </div>
        ${
          patrols.length && fullPatrols < patrols.length
            ? banner(
                `${patrols.length - fullPatrols} tur eksik noktayla kapatıldı. Devriye planını gözden geçirin.`,
                "warn",
                "alert"
              )
            : ""
        }
      </div>

      ${sectionTitle("Olay türleri")}
      ${
        typeRows.length
          ? `<div class="card">
              ${typeRows
                .map(
                  ([t, n]) => `<div style="margin-bottom:10px">
                    <div class="row tiny" style="margin-bottom:4px">
                      <span class="strong">${esc(INCIDENT_TYPES[t]?.label || t)}</span>
                      <span class="spacer"></span><span class="faint">${n}</span>
                    </div>
                    <div class="progress"><div class="progress__bar" style="width:${
                      (n / maxType) * 100
                    }%"></div></div>
                  </div>`
                )
                .join("")}
            </div>`
          : empty("Olay kaydı yok", "Son 7 günde kayıt açılmamış.", "check-circle")
      }

      ${sectionTitle("Özet")}
      <div class="card">
        ${kv("Çözülen olay", `${resolved.length} / ${incidents.length}`)}
        ${kv(
          "Ortalama çözüm süresi",
          solved.length ? esc(duration(new Date(Date.now() - avgMs).toISOString())) : "—"
        )}
        ${kv("Teslim edilen kargo", `${delivered.length} / ${packages.length}`)}
        ${kv("Açılan vardiya", String(shifts.length))}
        ${kv(
          "Hâlâ içeride görünen ziyaretçi",
          String(db.list("visitors", (v) => v.status === "inside").length)
        )}
      </div>

      ${banner(
        "Rapor, cihazdaki kayıtlardan anlık hesaplanır. Çok cihazlı kurulumda bu ekran sunucudaki birleşik veriyi gösterir.",
        "",
        "info"
      )}`;
    return root;
  },
};
