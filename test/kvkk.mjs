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
  deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "tr-TR",
});
function watch(p, tag) {
  p.on("console", (m) => m.type() === "error" && errors.push(`[${tag}] ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
}

async function login(page, roleIdx, userIdx, { consent = true } = {}) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("[data-role]").nth(roleIdx).click();
  await page.locator("[data-user]").nth(userIdx).click();
  for (const d of "1234") await page.locator(`[data-key="${d}"]`).click();
  await page.waitForTimeout(350);
  if (consent && (await page.locator("[data-consent]").count())) {
    await page.locator("[data-consent]").click();
    await page.locator("[data-go]").click();
    await page.waitForSelector(".tabbar");
  }
}

const p = await ctx.newPage();
watch(p, "main");
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

/* ---------- Codex bulguları ---------- */

console.log("A) Rıza kapısı onaysız geçilemiyor mu?");
await login(p, 1, 0, { consent: false });
if (!(await p.locator("[data-consent]").count())) throw new Error("rıza kapısı çıkmadı");
if (await p.locator(".tabbar").count()) throw new Error("onaysız uygulamaya girildi");
const goDisabled = await p.locator("[data-go]").isDisabled();
if (!goDisabled) throw new Error("onay kutusu işaretlenmeden devam edilebiliyor");
log("onay verilmeden uygulama açılmıyor, düğme kilitli");
await p.screenshot({ path: `${OUT}/k-consent.png` });
// Adres çubuğundan zorlamayı da denemeli
await p.goto(BASE + "#/incidents", { waitUntil: "load" });
await p.waitForTimeout(400);
if (await p.locator(".tabbar").count()) throw new Error("adres çubuğundan rıza kapısı atlandı");
log("adres çubuğundan da atlanamıyor");
await p.locator("[data-consent]").click();
await p.locator("[data-go]").click();
await p.waitForSelector(".tabbar");
log("onay verildi, uygulama açıldı");

console.log("B) [Codex P1] Sakin /settings üzerinden tam veri dökümü alabiliyor mu?");
await p.goto(BASE + "#/settings", { waitUntil: "load" });
await p.waitForTimeout(400);
if (await p.locator('[data-act="export"]').count())
  throw new Error("sakinde hâlâ tam veri dökümü düğmesi var");
if (await p.locator('[data-act="reset"]').count())
  throw new Error("sakinde hâlâ veri sıfırlama düğmesi var");
if (!(await p.locator('[data-act="myData"]').count()))
  throw new Error("sakine kendi verisi bağlantısı gösterilmiyor");
log("sakin ayarlarında tam döküm/sıfırlama yok, yerine 'Verilerim' var");

console.log("C) [Codex P1] Sakin başkasının özel kaydını doğrudan açabiliyor mu?");
const privateId = await p.evaluate(async () => {
  const db = await import("/js/core/db.js");
  // Başka bir sakinin gürültü şikâyeti (site geneline kapalı tür)
  const rec = db.list("incidents").find((i) => i.type === "noise");
  return rec ? { id: rec.id, reporter: rec.reporterId } : null;
});
if (!privateId) throw new Error("test için özel kayıt bulunamadı");
const me = await p.evaluate(() => JSON.parse(sessionStorage.getItem("siteapp.session")).userId);
if (privateId.reporter === me) throw new Error("kayıt zaten bu kullanıcıya ait, test geçersiz");
await p.goto(BASE + `#/incidents/${privateId.id}`, { waitUntil: "load" });
await p.waitForTimeout(400);
const blocked = await p.locator("text=Bu kayda erişiminiz yok").count();
if (!blocked) throw new Error("başkasının özel kaydı doğrudan bağlantıyla okunabiliyor");
log("başkasının gürültü şikâyeti doğrudan bağlantıyla açılamıyor");
await p.screenshot({ path: `${OUT}/k-idor.png` });

// Kendi kaydı ve site geneli açık arıza görünmeye devam etmeli
const own = await p.evaluate(async () => {
  const db = await import("/js/core/db.js");
  const uid = JSON.parse(sessionStorage.getItem("siteapp.session")).userId;
  return {
    mine: db.list("incidents").find((i) => i.reporterId === uid)?.id,
    site: db.list("incidents").find((i) => i.type === "technical" && i.status !== "resolved")?.id,
  };
});
for (const [label, id] of Object.entries(own)) {
  if (!id) continue;
  await p.goto(BASE + `#/incidents/${id}`, { waitUntil: "load" });
  await p.waitForTimeout(350);
  if (await p.locator("text=Bu kayda erişiminiz yok").count())
    throw new Error(`görülebilmesi gereken kayıt engellendi: ${label}`);
}
log("kendi kaydı ve site geneli açık arıza hâlâ görünüyor");

console.log("D) Sakin kendi verisini indirebiliyor / silme talebi açabiliyor mu?");
await p.goto(BASE + "#/privacy", { waitUntil: "load" });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/k-privacy.png` });
const dump = await p.evaluate(async () => {
  const pv = await import("/js/core/privacy.js");
  const uid = JSON.parse(sessionStorage.getItem("siteapp.session")).userId;
  return JSON.parse(pv.personalExport(uid));
});
if (!dump.kisi || dump.kisi.ad !== "Elif Arslan") throw new Error("döküm yanlış kişiye ait");
if (dump.ziyaretciler.some((v) => v.hostId !== "u_r1"))
  throw new Error("dökümde başkasının ziyaretçi kaydı var");
log("kişisel döküm yalnızca kendi kayıtlarını içeriyor");

await p.locator('[data-act="delete"]').click();
await p.waitForSelector(".sheet");
await p.locator('.sheet textarea[name="note"]').fill("Siteden taşınıyorum.");
await p.locator('.sheet [data-keep="1"]').click();
await p.waitForTimeout(600);
if (!(await p.locator("text=Silme talebi").count())) throw new Error("silme talebi listelenmedi");
log("silme talebi oluşturuldu");

console.log("E) [Codex P1] Son yönetici rolünü düşürebiliyor mu?");
const adm = await ctx.newPage();
watch(adm, "admin");
await login(adm, 2, 0);
await adm.goto(BASE + "#/admin/c/users", { waitUntil: "load" });
await adm.waitForTimeout(400);
await adm.locator('.item:has-text("Ayşe Toprak")').first().click();
await adm.waitForSelector(".sheet");
await adm.locator('.sheet select[name="role"]').selectOption("resident");
await adm.locator('.sheet input[name="unit"]').fill("5");
await adm.locator('.sheet [data-keep="1"]').click();
await adm.waitForTimeout(400);
if (!(await adm.locator(".sheet .banner--danger").count()))
  throw new Error("son yönetici rolü değiştirilebiliyor");
log("son yöneticinin rolü düşürülemiyor");
await adm.screenshot({ path: `${OUT}/k-lastadmin.png` });
await adm.locator(".sheet__actions .btn").first().click();
await adm.waitForTimeout(300);
const stillAdmin = await adm.evaluate(() =>
  JSON.parse(localStorage.getItem("siteapp.db.v1")).users.find((u) => u.id === "u_admin").role
);
if (stillAdmin !== "admin") throw new Error("rol yine de değişmiş: " + stillAdmin);
log("kayıt değişmeden kaldı");

console.log("F) Yönetici KVKK talebini görüyor ve işleyebiliyor mu?");
await adm.goto(BASE + "#/admin/privacy", { waitUntil: "load" });
await adm.waitForTimeout(500);
if (!(await adm.locator("text=bekleyen KVKK talebi").count()))
  throw new Error("bekleyen talep uyarısı yok");
await adm.screenshot({ path: `${OUT}/k-admin-privacy.png` });
const consentStats = await adm.evaluate(async () => {
  const pv = await import("/js/core/privacy.js");
  return pv.consentStats();
});
log("rıza durumu:", JSON.stringify(consentStats));
if (consentStats.done < 2) throw new Error("onaylar kaydedilmemiş");

console.log("G) Saklama süresi temizliği eskiyi siliyor, yeniyi bırakıyor mu?");
const purge = await adm.evaluate(async () => {
  const db = await import("/js/core/db.js");
  const pv = await import("/js/core/privacy.js");
  const old = new Date(Date.now() - 400 * 864e5).toISOString();
  db.insert("visitors", { name: "Eski Kayıt", createdAt: old, status: "left", block: "A", unit: "1" });
  db.insert("incidents", { title: "Eski olay", at: old, status: "resolved", type: "other",
    priority: "low", photo: "data:image/jpeg;base64,AAAA", updates: [] });
  db.insert("incidents", { title: "Fotoğraflı yeni-orta", at: new Date(Date.now() - 120 * 864e5).toISOString(),
    status: "open", type: "technical", priority: "normal", photo: "data:image/jpeg;base64,AAAA", updates: [] });
  const before = { v: db.list("visitors").length, i: db.list("incidents").length };
  const counts = pv.purgeExpired();
  const after = { v: db.list("visitors").length, i: db.list("incidents").length };
  const midPhoto = db.list("incidents").find((x) => x.title === "Fotoğraflı yeni-orta");
  return { before, after, counts, midPhoto: midPhoto ? midPhoto.photo : null, midKept: !!midPhoto };
});
log("temizlik:", JSON.stringify(purge.counts));
if (purge.after.v !== purge.before.v - 1) throw new Error("eski ziyaretçi kaydı silinmedi");
if (purge.after.i !== purge.before.i - 1) throw new Error("eski olay kaydı silinmedi");
if (!purge.midKept) throw new Error("120 günlük kayıt yanlışlıkla silindi");
if (purge.midPhoto !== "") throw new Error("süresi dolan fotoğraf temizlenmedi: " + purge.midPhoto);
log("eski kayıtlar silindi, 120 günlük kayıt kaldı ama fotoğrafı temizlendi");

console.log("H) Metin güncellenince rıza yeniden isteniyor mu?");
await adm.evaluate(async () => {
  const pv = await import("/js/core/privacy.js");
  pv.updateNotice("Güncellenmiş aydınlatma metni.");
});
await p.goto(BASE + "#/", { waitUntil: "load" });
await p.waitForTimeout(700);
if (!(await p.locator("[data-consent]").count()))
  throw new Error("metin güncellendiği hâlde yeniden onay istenmedi");
log("sürüm artınca rıza kapısı yeniden çıktı");

console.log(errors.length ? "\nHATALAR:\n" + errors.join("\n") : "\nKONSOL HATASI YOK");
await browser.close();
