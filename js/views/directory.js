/** Telefon rehberi — site, acil ve arıza numaraları. */
import * as db from "../core/db.js";
import { el, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, banner } from "../ui/components.js";
import { esc } from "../util/format.js";

const GROUPS = [
  ["Acil", "Acil numaralar", "siren"],
  ["Site", "Site içi", "building"],
  ["Arıza", "Arıza hatları", "tool"],
];

export default {
  title: "Telefon Rehberi",
  live: true,

  async render(ctx) {
    const root = el("<div></div>");
    let search = "";

    function draw() {
      const q = search.trim().toLocaleLowerCase("tr");
      const all = db.list("contacts");
      root.innerHTML = `
        <label class="field">
          <span class="sr-only">Ara</span>
          <input class="input" name="q" placeholder="İsim veya numara ara" value="${esc(search)}" />
        </label>
        ${banner(
          "Numaraya dokunduğunuzda telefon uygulaması açılır. Acil durumda önce 112, sonra güvenlik kulübesi.",
          "",
          "phone"
        )}
        ${GROUPS.map(([key, label, ic]) => {
          const rows = all.filter(
            (c) =>
              c.group === key &&
              (!q || `${c.name} ${c.phone} ${c.note || ""}`.toLocaleLowerCase("tr").includes(q))
          );
          if (!rows.length) return "";
          return `${sectionTitle(label)}
            <div class="list">
              ${rows
                .map(
                  (c) => `<a class="item ${key === "Acil" ? "item--danger" : ""}" href="tel:${esc(
                    c.phone
                  )}">
                    <span class="item__avatar">${icon(c.icon || ic)}</span>
                    <span class="item__body">
                      <span class="item__title">${esc(c.name)}</span>
                      <span class="item__sub">${esc(c.note || "")}</span>
                    </span>
                    <span class="item__side"><span class="strong mono">${esc(c.phone)}</span></span>
                    <span class="item__chev">${icon("phone")}</span>
                  </a>`
                )
                .join("")}
            </div>`;
        }).join("")}`;

      qs('[name="q"]', root).addEventListener("input", (e) => {
        search = e.target.value;
        const pos = e.target.selectionStart;
        draw();
        const input = qs('[name="q"]', root);
        input.focus();
        input.setSelectionRange(pos, pos);
      });
    }

    draw();
    return root;
  },
};
