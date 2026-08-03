/** Nöbet defteri — tüm kayıtların kronolojik dökümü ve dışa aktarım. */
import * as db from "../core/db.js";
import { el, actions, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, empty, badge } from "../ui/components.js";
import { downloadText } from "../util/media.js";
import { esc, fmtTime, fmtDateLong, timeAgo, duration, LOG_KINDS } from "../util/format.js";

const KINDS = [
  ["all", "Tümü"],
  ["visitor", "Ziyaretçi"],
  ["package", "Kargo"],
  ["incident", "Olay"],
  ["patrol", "Devriye"],
  ["shift", "Vardiya"],
  ["panic", "Acil"],
];

export default {
  title: "Nöbet Defteri",
  subtitle: "Kronolojik kayıt",
  live: true,
  action: { icon: "download", label: "Dışa aktar", onClick: (ctx) => exportLog(ctx) },

  async render(ctx) {
    let kind = "all";
    const root = el("<div></div>");

    function draw() {
      const logs = db
        .list("logs")
        .filter((l) => kind === "all" || l.kind === kind)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 300);

      const groups = new Map();
      logs.forEach((l) => {
        const key = new Date(l.at).toDateString();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
      });

      const shifts = db
        .list("shifts", (s) => s.endedAt && s.handover?.trim())
        .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
        .slice(0, 4);

      root.innerHTML = `
        <div class="chiprow">
          ${KINDS.map(
            ([k, l]) =>
              `<button class="chip" type="button" data-kind="${k}" aria-pressed="${
                kind === k
              }">${esc(l)}</button>`
          ).join("")}
        </div>

        ${
          kind === "all" && shifts.length
            ? `${sectionTitle("Vardiya devir notları")}
              <div class="list">
                ${shifts
                  .map(
                    (s) => `<div class="item item--static">
                      <span class="item__avatar">${icon("clock")}</span>
                      <span class="item__body">
                        <span class="item__title">${esc(
                          db.find("users", s.guardId)?.name || "—"
                        )} ${badge(duration(s.startedAt, s.endedAt), "")}</span>
                        <span class="item__sub">${esc(s.handover)}</span>
                      </span>
                      <span class="item__side">${esc(timeAgo(s.endedAt))}</span>
                    </div>`
                  )
                  .join("")}
              </div>`
            : ""
        }

        ${
          logs.length
            ? [...groups.entries()]
                .map(
                  ([day, rows]) => `${sectionTitle(fmtDateLong(rows[0].at))}
                  <div class="card card--flat">
                    <div class="timeline">
                      ${rows
                        .map(
                          (l) => `<div class="tl ${
                            l.kind === "panic" ? "tl--danger" : l.kind === "patrol" ? "tl--ok" : "tl--accent"
                          }">
                            <div class="tl__time">${esc(fmtTime(l.at))} · ${esc(
                            LOG_KINDS[l.kind]?.label || "Kayıt"
                          )}${l.by ? " · " + esc(l.by) : ""}</div>
                            <div class="tl__text">${esc(l.text)}</div>
                          </div>`
                        )
                        .join("")}
                    </div>
                  </div>`
                )
                .join("")
            : empty("Kayıt yok", "Bu filtrede defter kaydı bulunmuyor.", "book")
        }

        <button class="btn btn--block" type="button" data-act="export" style="margin-top:16px">
          ${icon("download")} Defteri metin olarak indir
        </button>`;
    }

    actions(root, { export: () => exportLog(ctx) });
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-kind]");
      if (!c) return;
      kind = c.dataset.kind;
      draw();
    });

    draw();
    return root;
  },
};

function exportLog(ctx) {
  const site = db.raw().site;
  const logs = db.list("logs").sort((a, b) => new Date(a.at) - new Date(b.at));
  const lines = [
    `${site.name} — Nöbet Defteri`,
    `Dışa aktarma: ${new Date().toLocaleString("tr-TR")}`,
    `Kayıt sayısı: ${logs.length}`,
    "".padEnd(60, "-"),
    ...logs.map(
      (l) =>
        `${new Date(l.at).toLocaleString("tr-TR")} | ${(LOG_KINDS[l.kind]?.label || "Kayıt").padEnd(
          10
        )} | ${(l.by || "-").padEnd(16)} | ${l.text}`
    ),
  ];
  downloadText(
    `nobet-defteri-${new Date().toISOString().slice(0, 10)}.txt`,
    lines.join("\n")
  );
  ctx.toast.ok("Defter indiriliyor.");
}
