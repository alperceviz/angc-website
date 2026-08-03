import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "ekran-goruntuleri");

const BASE = "http://127.0.0.1:8099/";
const errors = [];
const log = (...a) => console.log("  ·", ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "tr-TR",
});
const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && errors.push("CONSOLE: " + m.text()));
p.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await p.goto(BASE, { waitUntil: "networkidle" });

// Yönetici girişi
await p.locator("[data-role]").nth(2).click();
await p.locator("[data-user]").first().click();
for (const d of "1234") await p.locator(`[data-key="${d}"]`).click();
await p.waitForTimeout(300);
// Açık rıza kapısı
if (await p.locator("[data-consent]").count()) {
  await p.locator("[data-consent]").click();
  await p.locator("[data-go]").click();
}
await p.waitForSelector(".tabbar");
await p.waitForTimeout(400);
const siteTitle = await p.locator("#appbar-title").innerText();
if (!siteTitle.includes("Dünya Şehir")) throw new Error("site adı gelmedi: " + siteTitle);
log("giriş ok, site:", siteTitle.split("\n")[0]);
await p.screenshot({ path: `${OUT}/a-home.png` });

console.log("1) Yönetim paneli + kurulum eksikleri");
await p.goto(BASE + "#/admin", { waitUntil: "load" });
await p.waitForTimeout(400);
const gapCount = await p.locator('.card--accent .item').count();
log("kurulum eksiği:", gapCount);
if (gapCount < 1) throw new Error("kurulum eksikleri listelenmedi");
await p.screenshot({ path: `${OUT}/a-admin.png` });

console.log("2) Site bilgileri + marka rengi + blok ekleme");
await p.goto(BASE + "#/admin/site", { waitUntil: "load" });
await p.waitForTimeout(400);
await p.locator('input[name="guardPhone"]').fill("0216 517 00 00");
await p.locator('input[name="managerPhone"]').fill("0216 517 00 01");
await p.locator("#newblock").fill("F");
await p.locator('[data-act="addBlock"]').click();
await p.waitForTimeout(250);
if (!(await p.locator('.chip:has-text("F")').count())) throw new Error("blok eklenmedi");
await p.locator('[data-act="swatch"][data-hex="#56a8ff"]').click();
await p.waitForTimeout(250);
await p.screenshot({ path: `${OUT}/a-site.png` });
await p.locator('[data-act="save"]').click();
await p.waitForTimeout(600);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("siteapp.db.v1")).site);
if (saved.brandColor !== "#56a8ff") throw new Error("marka rengi kaydedilmedi");
if (!saved.blocks.includes("F")) throw new Error("blok kaydedilmedi");
log("site kaydedildi, renk:", saved.brandColor, "bloklar:", saved.blocks.join(","));

console.log("3) Marka rengi arayüze uygulandı mı?");
const accentNow = await p.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
);
log("--accent =", accentNow);
if (accentNow !== "#56a8ff") throw new Error("vurgu rengi uygulanmadı: " + accentNow);
await p.screenshot({ path: `${OUT}/a-blue.png` });

// sarıya geri dön
await p.goto(BASE + "#/admin/site", { waitUntil: "load" });
await p.waitForTimeout(300);
await p.locator('[data-act="swatch"][data-hex="#ffc800"]').click();
await p.locator('[data-act="save"]').click();
await p.waitForTimeout(400);

console.log("4) Kullanıcı ekleme (koşullu alanlar)");
await p.goto(BASE + "#/admin/c/users", { waitUntil: "load" });
await p.waitForTimeout(400);
const before = await p.locator(".list .item").count();
await p.locator('[data-act="new"]').click();
await p.waitForSelector(".sheet");
// varsayılan rol: sakin → blok/daire görünür, sicil gizli
const unitVisible = await p.locator('[data-fieldwrap="unit"]:not(.hidden)').count();
const badgeHidden = await p.locator('[data-fieldwrap="badge"].hidden').count();
if (!unitVisible || !badgeHidden) throw new Error("koşullu alanlar yanlış");
log("sakin rolünde daire görünür, sicil gizli");
await p.locator('.sheet input[name="name"]').fill("Test Sakin");
await p.locator('.sheet input[name="unit"]').fill("77");
await p.locator('.sheet input[name="phone"]').fill("0532 111 11 11");
await p.screenshot({ path: `${OUT}/a-userform.png` });
await p.locator('.sheet [data-keep="1"]').click();
await p.waitForTimeout(600);
const after = await p.locator(".list .item").count();
if (after !== before + 1) throw new Error(`kullanıcı eklenmedi (${before}→${after})`);
log("kullanıcı eklendi:", before, "→", after);

console.log("5) Rol değişince alanlar güncelleniyor mu?");
await p.locator('[data-act="new"]').click();
await p.waitForSelector(".sheet");
await p.locator('.sheet select[name="role"]').selectOption("guard");
await p.waitForTimeout(250);
if (!(await p.locator('[data-fieldwrap="badge"]:not(.hidden)').count()))
  throw new Error("görevli seçilince sicil alanı açılmadı");
if (!(await p.locator('[data-fieldwrap="unit"].hidden').count()))
  throw new Error("görevli seçilince daire alanı gizlenmedi");
log("rol değişimi alanları doğru güncelliyor");
await p.locator(".sheet__actions .btn").first().click();
await p.waitForTimeout(300);

console.log("6) Doğrulama hatası gösteriliyor mu?");
await p.locator('[data-act="new"]').click();
await p.waitForSelector(".sheet");
await p.locator('.sheet [data-keep="1"]').click();
await p.waitForTimeout(300);
if (!(await p.locator(".sheet .banner--danger").count())) throw new Error("doğrulama uyarısı yok");
log("boş form reddedildi");
await p.locator(".sheet__actions .btn").first().click();
await p.waitForTimeout(300);

console.log("7) Devriye noktası ekleme");
await p.goto(BASE + "#/admin/c/checkpoints", { waitUntil: "load" });
await p.waitForTimeout(400);
const cpBefore = await p.locator(".list .item").count();
await p.locator('[data-act="new"]').click();
await p.waitForSelector(".sheet");
await p.locator('.sheet input[name="name"]').fill("F Blok Girişi");
await p.locator('.sheet input[name="zone"]').fill("F Blok");
await p.locator('.sheet [data-keep="1"]').click();
await p.waitForTimeout(600);
if ((await p.locator(".list .item").count()) !== cpBefore + 1) throw new Error("nokta eklenmedi");
log("kontrol noktası eklendi:", cpBefore, "→", cpBefore + 1);
await p.screenshot({ path: `${OUT}/a-checkpoints.png` });

console.log("8) Tesis ve rehber ekranları");
for (const c of ["amenities", "contacts"]) {
  await p.goto(BASE + `#/admin/c/${c}`, { waitUntil: "load" });
  await p.waitForTimeout(350);
  const n = await p.locator(".list .item").count();
  if (n < 1) throw new Error(c + " listelenmedi");
  log(c, "->", n, "kayıt");
}
await p.screenshot({ path: `${OUT}/a-amenities.png` });

console.log("9) Yapılandırma dışa aktarımı (kişisel veri sızmıyor mu?)");
const cfg = await p.evaluate(async () => {
  const db = await import("/js/core/db.js");
  return db.exportConfig();
});
const parsed = JSON.parse(cfg);
if (parsed.users || parsed.visitors || parsed.incidents)
  throw new Error("yapılandırmaya kişisel veri sızmış");
if (!parsed.site || !parsed.checkpoints?.length) throw new Error("yapılandırma eksik");
if (parsed.site.demo !== false) throw new Error("demo bayrağı taşınmış");
log("config dışa aktarımı temiz:", Object.keys(parsed).join(", "));

console.log("10) Demo hareketlerini temizleme");
await p.goto(BASE + "#/admin/data", { waitUntil: "load" });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/a-data.png` });
await p.locator('[data-act="clearOps"]').click();
await p.waitForSelector(".sheet");
await p.locator(".sheet__actions .btn").nth(1).click();
await p.waitForTimeout(700);
const st = await p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("siteapp.db.v1"));
  return { v: d.visitors.length, i: d.incidents.length, u: d.users.length, cp: d.checkpoints.length, demo: d.site.demo };
});
if (st.v || st.i) throw new Error("hareket kayıtları temizlenmedi");
if (!st.u || !st.cp) throw new Error("yapılandırma da silinmiş!");
if (st.demo !== false) throw new Error("demo bayrağı kapanmadı");
log("hareketler silindi, kullanıcı ve noktalar korundu:", JSON.stringify(st));

console.log("11) Temizlik sonrası uygulama ayakta mı?");
for (const r of ["/", "/incidents", "/visitors", "/logbook", "/reports", "/services", "/directory", "/admin"]) {
  await p.goto(BASE + "#" + r, { waitUntil: "load" });
  await p.waitForTimeout(280);
}
log("tüm ekranlar boş veriyle sorunsuz açıldı");
await p.goto(BASE + "#/reports", { waitUntil: "load" });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/a-empty-reports.png` });


console.log("12) Uygulama adı özelleştirmesi (sekme + iOS ana ekran adı)");
await p.goto(BASE + "#/admin/site", { waitUntil: "load" });
await p.waitForTimeout(400);
await p.locator('input[name="brandName"]').fill("Kartal Güvenlik");
await p.locator('input[name="name"]').fill("Dünya Şehir Kartal");
await p.locator('[data-act="save"]').click();
await p.waitForTimeout(600);
const titles = await p.evaluate(() => ({
  doc: document.title,
  ios: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
}));
log("sekme başlığı:", titles.doc, "| iOS adı:", titles.ios);
if (!titles.doc.includes("Kartal Güvenlik")) throw new Error("sekme başlığı güncellenmedi");
if (titles.ios !== "Dünya Şehir Kartal") throw new Error("iOS ana ekran adı güncellenmedi");

await p.evaluate(() => sessionStorage.clear());
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const loginName = await p.locator(".login__name").innerText();
if (loginName.trim() !== "Kartal Güvenlik") throw new Error("giriş ekranı adı: " + loginName);
log("giriş ekranı özelleştirilmiş adı gösteriyor:", loginName.trim());
await p.screenshot({ path: `${OUT}/a-custom-name.png` });

console.log(errors.length ? "\nHATALAR:\n" + errors.join("\n") : "\nKONSOL HATASI YOK");
await browser.close();
