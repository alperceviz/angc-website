/**
 * Açık rıza kapısı.
 *
 * Aydınlatma metni onaylanmadan uygulamaya geçilmez; metin güncellenince
 * (sürüm artınca) herkese yeniden gösterilir.
 */
import * as privacy from "../core/privacy.js";
import { brandName, siteName } from "../core/brand.js";
import { el, qs } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { banner } from "../ui/components.js";
import { esc } from "../util/format.js";

export default {
  async render(ctx) {
    const n = privacy.notice();
    const root = el(`
      <div class="login" style="max-width:620px">
        <div class="login__brand" style="margin-bottom:18px">
          <img src="assets/icon-192.png" alt="" width="60" height="60" style="border-radius:18px" />
          <div class="login__name" style="font-size:22px">Aydınlatma Metni</div>
          <div class="login__tag">${esc(siteName())} · ${esc(brandName())}</div>
        </div>

        ${banner(
          `Devam etmeden önce kişisel verilerinizin nasıl işlendiğini okuyup
           onaylamanız gerekiyor. Onayınız kaydedilir ve metin güncellenirse
           tekrar sorulur.`,
          "info",
          "lock"
        )}

        <div class="card card--flat" style="margin-top:14px;max-height:46vh;overflow-y:auto">
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:13.5px;
            line-height:1.65;margin:0;color:var(--text-dim)">${esc(n.text)}</pre>
        </div>

        <label class="switchrow" style="margin-top:6px;cursor:pointer">
          <div class="switchrow__text">
            <div class="strong">Okudum, anladım ve onaylıyorum</div>
            <div class="faint">Aydınlatma metni sürüm ${n.version}</div>
          </div>
          <button type="button" class="switch" role="switch" aria-checked="false"
            data-consent aria-label="Onaylıyorum"></button>
        </label>

        <button class="btn btn--block btn--primary" type="button" data-go disabled style="margin-top:10px">
          ${icon("check")} Onayla ve devam et
        </button>
        <button class="btn btn--block btn--ghost" type="button" data-out style="margin-top:8px">
          Onaylamadan çık
        </button>
      </div>`);

    const sw = qs("[data-consent]", root);
    const go = qs("[data-go]", root);
    const toggle = () => {
      const next = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(next));
      go.disabled = !next;
    };
    sw.addEventListener("click", toggle);
    qs(".switchrow", root).addEventListener("click", (e) => {
      if (!e.target.closest("[data-consent]")) toggle();
    });

    go.addEventListener("click", () => {
      privacy.giveConsent(ctx.user);
      ctx.done();
    });
    qs("[data-out]", root).addEventListener("click", () => ctx.cancel());

    return root;
  },
};
