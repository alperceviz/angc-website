/** Olay / talep listesi. */
import * as db from "../core/db.js";
import { el, actions, qs } from "../ui/dom.js";
import { listItem, badge, empty, banner } from "../ui/components.js";
import {
  esc,
  timeAgo,
  unitLabel,
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  PRIORITY,
} from "../util/format.js";

/** Sakinlerin site genelinde görebileceği türler (mahremiyet için sınırlı). */
const PUBLIC_TYPES = ["technical", "security", "cleaning", "parking", "fire"];

export default {
  title: (ctx) => (ctx.user.role === "resident" ? "Taleplerim" : "Olay kayıtları"),
  live: true,
  action: { icon: "plus", href: "/incidents/new", label: "Yeni kayıt" },

  async render(ctx) {
    const resident = ctx.user.role === "resident";
    let scope = resident ? "mine" : "open";
    const root = el("<div></div>");

    function rows() {
      const all = db.list("incidents");
      const byScope = {
        mine: (i) => i.reporterId === ctx.user.id,
        site: (i) => PUBLIC_TYPES.includes(i.type) && i.status !== "resolved",
        open: (i) => i.status === "open",
        progress: (i) => i.status === "in_progress",
        resolved: (i) => i.status === "resolved",
        all: () => true,
      };
      return all
        .filter(byScope[scope] || (() => true))
        .sort((a, b) => {
          const rank = { critical: 0, high: 1, normal: 2, low: 3 };
          const s = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
          return s !== 0 ? s : new Date(b.at) - new Date(a.at);
        });
    }

    const CHIPS = resident
      ? [
          ["mine", "Taleplerim"],
          ["site", "Sitede açık olanlar"],
        ]
      : [
          ["open", "Açık"],
          ["progress", "İşlemde"],
          ["resolved", "Çözüldü"],
          ["all", "Tümü"],
        ];

    function draw() {
      const list = rows();
      root.innerHTML = `
        <div class="chiprow">
          ${CHIPS.map(
            ([k, l]) =>
              `<button class="chip" type="button" data-scope="${k}" aria-pressed="${
                scope === k
              }">${esc(l)}</button>`
          ).join("")}
        </div>
        ${
          scope === "site"
            ? banner(
                "Site genelini ilgilendiren açık kayıtlar. Bildirimi yapan kişinin adı gösterilmez.",
                "",
                "info"
              ) + '<div style="height:10px"></div>'
            : ""
        }
        ${
          list.length
            ? `<div class="list">${list.map((i) => row(i, scope === "site")).join("")}</div>`
            : empty(
                "Kayıt yok",
                resident
                  ? "Bir arıza veya güvenlik konusu için sağ üstteki + ile talep açabilirsiniz."
                  : "Bu filtrede kayıt bulunmuyor.",
                "clipboard"
              )
        }`;
    }

    actions(root, { open: (n) => ctx.navigate(`/incidents/${n.dataset.id}`) });
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-scope]");
      if (!c) return;
      scope = c.dataset.scope;
      draw();
    });

    draw();
    return root;
  },
};

function row(i, anonymous) {
  const st = INCIDENT_STATUS[i.status];
  const ty = INCIDENT_TYPES[i.type] || INCIDENT_TYPES.other;
  const reporter = anonymous ? "" : db.find("users", i.reporterId)?.name || "";
  const sub = [
    ty.label,
    i.block && i.block !== "-" ? unitLabel(i.block, i.unit) : null,
    reporter,
    timeAgo(i.at),
  ]
    .filter(Boolean)
    .join(" · ");
  return listItem({
    icon: ty.icon,
    title: i.title,
    sub,
    badges:
      badge(st.label, st.tone) +
      (["critical", "high"].includes(i.priority) ? badge(PRIORITY[i.priority].label, i.priority === "critical" ? "danger" : "warn") : ""),
    tone: i.priority === "critical" ? "danger" : i.status === "open" ? "accent" : "",
    act: "open",
    data: { id: i.id },
  });
}
