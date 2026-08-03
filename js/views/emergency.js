/** Acil durum: panik butonu, acil numaralar ve kısa protokoller. */
import * as db from "../core/db.js";
import * as bus from "../core/bus.js";
import { el, actions, qs, haptic } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sectionTitle, banner, kv } from "../ui/components.js";
import { esc, unitLabel, timeAgo } from "../util/format.js";

const PROTOCOLS = [
  {
    icon: "flame",
    title: "Yangın",
    steps: [
      "110 İtfaiye'yi arayın, sonra güvenlik kulübesini bilgilendirin.",
      "Asansörü kesinlikle kullanmayın; yangın merdivenini kullanın.",
      "Duman varsa eğilerek ilerleyin, kapı kollarını elinizin tersiyle kontrol edin.",
      "Toplanma alanında bekleyin, görevli sayım yapacaktır.",
    ],
  },
  {
    icon: "activity",
    title: "Deprem",
    steps: [
      "Çök – kapan – tutun. Sarsıntı bitmeden dışarı çıkmaya çalışmayın.",
      "Sarsıntı sonrası gaz ve elektriği kapatın.",
      "Merdivenle sakin şekilde inin, asansör kullanmayın.",
      "Toplanma alanına gidin; binaya görevli izin vermeden dönmeyin.",
    ],
  },
  {
    icon: "phone",
    title: "Sağlık acili",
    steps: [
      "112'yi arayın; adresi ve blok/daire bilgisini net söyleyin.",
      "Uygulamadan ACİL çağrı gönderin — görevli ambulansa kapıyı açar ve yönlendirir.",
      "Hastayı gereksiz yere hareket ettirmeyin.",
    ],
  },
  {
    icon: "eye",
    title: "Şüpheli kişi / paket",
    steps: [
      "Müdahale etmeyin, uzaklaşın.",
      "Güvenlik kulübesini arayın; eşkâl, yön ve saati bildirin.",
      "Mümkünse uzaktan fotoğraf alıp olay kaydına ekleyin.",
    ],
  },
  {
    icon: "droplet",
    title: "Su baskını / patlak",
    steps: [
      "Daire ana vanasını kapatın.",
      "Elektrik panosuna su temas ettiyse sigortayı indirin.",
      "Güvenliğe haber verin; teknik servis yönlendirilecektir.",
    ],
  },
];

export default {
  title: "Acil Durum",
  live: false,

  async render(ctx) {
    const site = db.raw().site;
    const resident = ctx.user.role === "resident";
    const root = el("<div></div>");
    let sent = null;

    function draw() {
      root.innerHTML = `
        ${
          sent
            ? `<div class="card card--danger">
                <div class="card__head">
                  <span class="tile__icon" style="background:var(--danger-soft);color:var(--danger)">
                    ${icon("check-circle")}</span>
                  <div class="card__title">Çağrınız iletildi
                    <div class="faint">Görevliler bilgilendirildi · ${esc(timeAgo(sent.at))}</div>
                  </div>
                </div>
                <p class="muted">Güvenli bir yerde kalın. Görevli size ulaşana kadar telefonunuzu açık tutun.</p>
                <button class="btn btn--block btn--ghost" type="button" data-act="falsealarm" style="margin-top:10px">
                  Yanlış alarm — iptal et
                </button>
              </div>`
            : `<button class="panic" type="button" data-panic>
                <span class="panic__fill"></span>
                ${icon("siren")}
                <span>ACİL ÇAĞRI</span>
                <span class="panic__hint">Göndermek için 1,5 saniye basılı tutun</span>
              </button>`
        }

        <div class="grid grid-2" style="margin-top:12px">
          <a class="btn btn--danger" href="tel:112">${icon("phone")} 112</a>
          <a class="btn" href="tel:${esc(site.guardPhone)}">${icon("shield")} Güvenlik</a>
        </div>

        <div style="height:12px"></div>
        ${
          resident
            ? banner(
                "ACİL çağrı, konumunuzu (blok/daire) görevlilerin ekranına sesli alarmla düşürür. Şaka amaçlı kullanım kayıt altına alınır.",
                "warn",
                "alert"
              )
            : banner(
                "Bu düğme diğer görevlileri ve yönetimi destek için çağırır. Ayrıca olay kaydı otomatik açılır.",
                "warn",
                "alert"
              )
        }

        <div class="card" style="margin-top:12px">
          ${kv("Toplanma alanı", esc(site.assemblyPoint))}
          ${kv("Site adresi", esc(site.address))}
          ${kv("Güvenlik kulübesi", `<a href="tel:${esc(site.guardPhone)}">${esc(site.guardPhone)}</a>`)}
          ${
            resident
              ? kv("Konumunuz", esc(unitLabel(ctx.user.block, ctx.user.unit)))
              : kv("Yönetim", `<a href="tel:${esc(site.managerPhone)}">${esc(site.managerPhone)}</a>`)
          }
        </div>

        ${sectionTitle("Ne yapmalı?")}
        <div class="list">
          ${PROTOCOLS.map(
            (p, idx) => `<div class="card" style="padding:0;overflow:hidden">
              <button class="item item--static" type="button" data-act="toggle" data-idx="${idx}"
                style="width:100%;border:0;background:none;cursor:pointer">
                <span class="item__avatar">${icon(p.icon)}</span>
                <span class="item__body"><span class="item__title">${esc(p.title)}</span></span>
                <span class="item__chev">${icon("chevron")}</span>
              </button>
              <div class="hidden" data-body="${idx}" style="padding:0 14px 14px">
                <ol class="muted" style="margin:0;padding-left:18px;line-height:1.7">
                  ${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}
                </ol>
              </div>
            </div>`
          ).join("")}
        </div>`;

      wirePanic();
    }

    function wirePanic() {
      const btn = qs("[data-panic]", root);
      if (!btn) return;
      let timer = null;
      const start = (e) => {
        e.preventDefault();
        btn.classList.add("panic--arming");
        haptic(20);
        timer = setTimeout(fire, 1500);
      };
      const cancel = () => {
        clearTimeout(timer);
        btn.classList.remove("panic--arming");
      };
      btn.addEventListener("pointerdown", start);
      btn.addEventListener("pointerup", cancel);
      btn.addEventListener("pointerleave", cancel);
      btn.addEventListener("pointercancel", cancel);
      // Klavye erişilebilirliği: Enter/Space anında gönderir.
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fire();
        }
      });
    }

    function fire() {
      haptic([60, 40, 60]);
      const where = resident
        ? `${unitLabel(ctx.user.block, ctx.user.unit)} · ${db.raw().site.name}`
        : `Güvenlik kulübesi · ${db.raw().site.name}`;

      const inc = db.insert("incidents", {
        type: resident ? "medical" : "security",
        title: resident ? "ACİL ÇAĞRI — sakin" : "DESTEK ÇAĞRISI — görevli",
        body: `${ctx.user.name} uygulamadan acil çağrı gönderdi.`,
        priority: "critical",
        status: "open",
        block: ctx.user.block || "-",
        unit: ctx.user.unit || "",
        reporterId: ctx.user.id,
        at: db.nowIso(),
        updates: [],
      });

      db.log({ kind: "panic", by: ctx.user.name, text: `ACİL ÇAĞRI gönderildi (${where}).` });
      ctx.pushNotification({
        to: resident ? "guard" : "admin",
        kind: "panic",
        title: "ACİL ÇAĞRI",
        body: `${ctx.user.name} — ${where}`,
        link: `/incidents/${inc.id}`,
      });
      bus.emit("panic", {
        from: ctx.user.name,
        userId: ctx.user.id,
        where,
        phone: ctx.user.phone,
        incidentId: inc.id,
      });

      sent = { at: db.nowIso(), incidentId: inc.id };
      draw();
    }

    actions(root, {
      toggle: (n) => {
        const body = qs(`[data-body="${n.dataset.idx}"]`, root);
        body.classList.toggle("hidden");
      },
      falsealarm: async () => {
        const ok = await ctx.confirm({
          title: "Yanlış alarm",
          desc: "Çağrı iptal edilecek ve kayda 'yanlış alarm' notu düşülecek.",
          confirmLabel: "İptal et",
          variant: "danger",
        });
        if (!ok) return;
        const i = db.find("incidents", sent.incidentId);
        if (i)
          db.update("incidents", i.id, {
            status: "resolved",
            resolvedAt: db.nowIso(),
            updates: [
              ...(i.updates || []),
              { at: db.nowIso(), by: ctx.user.name, text: "Yanlış alarm — çağrı iptal edildi." },
            ],
          });
        db.log({ kind: "panic", by: ctx.user.name, text: "Acil çağrı iptal edildi (yanlış alarm)." });
        ctx.pushNotification({
          to: "guard",
          kind: "panic",
          title: "Acil çağrı iptal edildi",
          body: `${ctx.user.name} yanlış alarm bildirdi.`,
        });
        sent = null;
        draw();
        ctx.toast.ok("Çağrı iptal edildi.");
      },
    });

    draw();
    return root;
  },
};
