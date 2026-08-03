import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "ekran-goruntuleri");
const BASE = "http://127.0.0.1:8099/";
const errors = [];
const log = (...a) => console.log("  ·", ...a);

const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:"tr-TR" });
function watch(p,t){ p.on("pageerror",e=>errors.push(`[${t}] ${e.message}`));
  p.on("console",m=>m.type()==="error"&&errors.push(`[${t}] ${m.text()}`)); }

async function login(page, roleIdx, userIdx) {
  await page.goto(BASE, { waitUntil:"networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE, { waitUntil:"networkidle" });
  await page.locator("[data-role]").nth(roleIdx).click();
  await page.locator("[data-user]").nth(userIdx).click();
  for (const d of "1234") await page.locator(`[data-key="${d}"]`).click();
  await page.waitForTimeout(300);
  if (await page.locator("[data-consent]").count()) {
    await page.locator("[data-consent]").click();
    await page.locator("[data-go]").click();
  }
  await page.waitForSelector(".tabbar");
}

const adm = await c.newPage(); watch(adm,"admin");
await adm.goto(BASE, { waitUntil:"networkidle" });
await adm.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await login(adm, 2, 0);

const setLic = (patch) => adm.evaluate(async (p) => {
  const l = await import("/js/core/license.js");
  l.setLicense(p, "test");
}, patch);

console.log("1) Lisans ekranı ve etkin lisans");
await adm.goto(BASE + "#/admin/license", { waitUntil:"load" });
await adm.waitForTimeout(400);
await setLic({ plan:"standart", licensedTo:"Dünya Şehir Kartal Site Yönetimi", units:250,
  validUntil: new Date(Date.now()+200*864e5).toISOString() });
await adm.reload({ waitUntil:"networkidle" });
await adm.waitForTimeout(500);
if (!(await adm.locator('.badge:has-text("Etkin")').count())) throw new Error("etkin lisans gösterilmedi");
log("etkin lisans görünüyor");
await adm.screenshot({ path: `${OUT}/l-active.png` });

console.log("2) Raporlar etkin lisansta açık mı?");
await adm.goto(BASE + "#/reports", { waitUntil:"load" });
await adm.waitForTimeout(400);
if (await adm.locator("text=kilitli").count()) throw new Error("etkin lisansta rapor kilitli");
log("raporlar açık");

console.log("3) Süre dolunca (ek süre içinde) hâlâ açık mı?");
await setLic({ validUntil: new Date(Date.now()-5*864e5).toISOString() });
await adm.goto(BASE + "#/reports", { waitUntil:"load" });
await adm.waitForTimeout(400);
if (await adm.locator("text=kilitli").count()) throw new Error("ek süre içinde kilitlendi");
const st = await adm.evaluate(async()=> (await import("/js/core/license.js")).status());
if (st !== "grace") throw new Error("durum grace değil: " + st);
log("ek süre (grace) içinde raporlar hâlâ açık");

console.log("4) Ek süre de bitince yönetim özellikleri kilitleniyor mu?");
await setLic({ validUntil: new Date(Date.now()-60*864e5).toISOString() });
await adm.goto(BASE + "#/reports", { waitUntil:"load" });
await adm.waitForTimeout(500);
if (!(await adm.locator("text=Yönetim raporları kilitli").count())) throw new Error("raporlar kilitlenmedi");
log("raporlar kilitlendi");
await adm.screenshot({ path: `${OUT}/l-locked.png` });

await adm.goto(BASE + "#/admin/c/users", { waitUntil:"load" });
await adm.waitForTimeout(400);
const usersBefore = await adm.locator(".list .item").count();
await adm.locator('[data-act="new"]').click();
await adm.waitForTimeout(400);
if (await adm.locator(".sheet").count()) throw new Error("kilitliyken yeni kullanıcı formu açıldı");
log("yeni kullanıcı tanımlama kapalı");
// Mevcut kullanıcı düzenlemesi ÇALIŞMALI
await adm.locator(".list .item").first().click();
await adm.waitForTimeout(400);
if (!(await adm.locator(".sheet").count())) throw new Error("mevcut kullanıcı düzenlenemiyor");
log("mevcut kullanıcılar hâlâ düzenlenebiliyor");
await adm.locator(".sheet__actions .btn").first().click();
await adm.waitForTimeout(300);

console.log("5) Kritik işlevler kilitli lisansta ÇALIŞMAYA DEVAM ediyor mu?");
const guard = await c.newPage(); watch(guard,"guard");
await login(guard, 0, 0);
for (const [label, path, sel] of [
  ["ziyaretçi girişi", "/visitors/new", 'input[name="name"]'],
  ["olay bildirimi", "/incidents/new", 'input[name="title"]'],
  ["devriye", "/patrol", '[data-act="start"], [data-act="finish"]'],
  ["kargo", "/packages", '[data-act="receive"]'],
  ["nöbet defteri", "/logbook", '[data-act="export"]'],
  ["acil durum", "/emergency", "[data-panic]"],
]) {
  await guard.goto(BASE + "#" + path, { waitUntil:"load" });
  await guard.waitForTimeout(350);
  if (await guard.locator("text=kilitli").count()) throw new Error(`${label} kilitlenmiş!`);
  if (!(await guard.locator(sel).count())) throw new Error(`${label} ekranı çalışmıyor`);
}
log("görevli tarafı tamamen açık: ziyaretçi, olay, devriye, kargo, defter, acil");

const res = await c.newPage(); watch(res,"resident");
await login(res, 1, 0);
for (const [label, path, sel] of [
  ["misafir bildir", "/visitors/new", 'input[name="name"]'],
  ["talep aç", "/incidents/new", 'input[name="title"]'],
  ["hizmetler", "/services", '[data-act="book"]'],
  ["acil çağrı", "/emergency", "[data-panic]"],
  ["kargolarım", "/packages", ".chiprow"],
]) {
  await res.goto(BASE + "#" + path, { waitUntil:"load" });
  await res.waitForTimeout(350);
  if (await res.locator("text=kilitli").count()) throw new Error(`sakin: ${label} kilitlenmiş!`);
  if (!(await res.locator(sel).count())) throw new Error(`sakin: ${label} çalışmıyor`);
}
log("sakin tarafı tamamen açık: misafir, talep, hizmet, acil, kargo");

// Acil çağrıyı gerçekten gönderebiliyor mu?
await res.goto(BASE + "#/emergency", { waitUntil:"load" });
await res.waitForTimeout(400);
const box = await res.locator("[data-panic]").boundingBox();
await res.mouse.move(box.x + box.width/2, box.y + box.height/2);
await res.mouse.down(); await res.waitForTimeout(1800); await res.mouse.up();
await res.waitForTimeout(700);
if (!(await res.locator("text=Çağrınız iletildi").count()))
  throw new Error("LİSANS BİTİNCE ACİL ÇAĞRI GÖNDERİLEMİYOR");
log("lisans bitmiş olmasına rağmen acil çağrı gönderildi");
await guard.waitForTimeout(600);
if (!(await guard.locator(".alarm").count())) throw new Error("görevliye alarm düşmedi");
log("görevliye alarm düştü");

console.log("6) Sakine 'ücretsiz' bilgisi gösteriliyor mu?");
await guard.locator("[data-ack]").click();
await res.goto(BASE + "#/settings", { waitUntil:"load" });
await res.waitForTimeout(400);
if (!(await res.locator("text=Sizin için ücretsiz").count()))
  throw new Error("sakine ücretsizlik bilgisi gösterilmiyor");
log("sakin ayarlarında 'Sizin için ücretsiz' yazıyor");
await res.screenshot({ path: `${OUT}/l-free.png` });

console.log(errors.length ? "\nHATALAR:\n"+errors.join("\n") : "\nKONSOL HATASI YOK");
await b.close();
