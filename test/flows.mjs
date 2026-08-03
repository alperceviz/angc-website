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
  permissions: [],
});
function watch(p, tag) {
  p.on("console", (m) => m.type() === "error" && errors.push(`[${tag}] ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`[${tag}] PAGEERROR ${e.message}`));
}

async function login(page, roleIdx, userIdx) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("[data-role]").nth(roleIdx).click();
  await page.locator("[data-user]").nth(userIdx).click();
  for (const d of "1234") await page.locator(`[data-key="${d}"]`).click();
  await page.waitForTimeout(300);
  // Açık rıza kapısı (aydınlatma metni)
  if (await page.locator("[data-consent]").count()) {
    await page.locator("[data-consent]").click();
    await page.locator("[data-go]").click();
  }
  await page.waitForSelector(".tabbar");
}

const guard = await ctx.newPage();
watch(guard, "guard");
const res = await ctx.newPage();
watch(res, "resident");

// Sıfır noktası: demo verisini tazele
await guard.goto(BASE, { waitUntil: "networkidle" });
await guard.evaluate(() => localStorage.clear());

console.log("1) Görevli girişi + vardiya");
await login(guard, 0, 0);
await guard.locator('[data-act="startShift"]').click();
await guard.waitForTimeout(300);
if (!(await guard.locator("text=Vardiyanız açık").count())) throw new Error("vardiya açılmadı");
log("vardiya açıldı");
await guard.screenshot({ path: `${OUT}/f-guard-shift.png` });

console.log("2) Devriye turu + nokta okutma");
await guard.goto(BASE + "#/patrol", { waitUntil: "load" });
await guard.waitForTimeout(300);
await guard.locator('[data-act="start"]').click();
await guard.waitForTimeout(300);
await guard.locator('[data-act="scan"]').first().click();
await guard.waitForSelector(".sheet");
await guard.locator('input[name="code"]').fill("1001");
await guard.waitForTimeout(500);
if (!(await guard.locator("text=1 / 8 nokta okutuldu").count())) throw new Error("tarama işlenmedi");
log("1/8 nokta okutuldu");
await guard.screenshot({ path: `${OUT}/f-patrol.png` });

console.log("3) Sakin misafir bildiriyor");
await login(res, 1, 0);
await res.goto(BASE + "#/visitors/new", { waitUntil: "load" });
await res.waitForTimeout(300);
await res.locator('input[name="name"]').fill("Test Misafir");
await res.locator('input[name="plate"]').fill("34 test 99");
await res.locator('[data-act="save"]').click();
await res.waitForSelector(".codebox__code");
const code = (await res.locator(".codebox__code").innerText()).trim();
log("üretilen kapı kodu:", code);
await res.screenshot({ path: `${OUT}/f-res-code.png` });
await res.locator(".sheet__actions .btn").click();

console.log("4) Görevli kodu doğruluyor (canlı senkron)");
await guard.goto(BASE + "#/visitors", { waitUntil: "load" });
await guard.waitForTimeout(400);
await guard.locator('[data-act="verify"]').click();
await guard.waitForSelector(".sheet");
await guard.locator('input[name="code"]').fill(code);
await guard.waitForTimeout(400);
await guard.screenshot({ path: `${OUT}/f-verify.png` });
if (!(await guard.locator("text=Kod doğrulandı").count())) throw new Error("kod doğrulanmadı");
await guard.locator("[data-ok]").click();
await guard.waitForTimeout(500);
if (!(await guard.locator('.item:has-text("Test Misafir") .badge:has-text("İçeride")').count()))
  throw new Error("giriş kaydedilmedi");
log("giriş kaydedildi, ziyaretçi içeride");

console.log("5) Sakin tarafında bildirim düştü mü?");
await res.waitForTimeout(600);
const dot = await res.locator(".iconbtn__dot").count();
if (!dot) throw new Error("sakine bildirim düşmedi");
log("sakinin çanında bildirim rozeti var");

console.log("6) Kargo teslim al → teslim et");
await guard.goto(BASE + "#/packages", { waitUntil: "load" });
await guard.waitForTimeout(300);
await guard.locator('[data-act="receive"]').click();
await guard.waitForSelector(".sheet");
await guard.locator('input[name="unit"]').fill("12");
await guard.waitForTimeout(200);
await guard.locator('.sheet [data-keep="1"]').click();
await guard.waitForTimeout(500);
const waiting = await guard.locator('.item:has-text("Elif Arslan")').count();
if (waiting < 1) throw new Error("kargo kaydedilmedi");
log("kargo kaydedildi:", waiting, "kayıt");
await guard.screenshot({ path: `${OUT}/f-packages.png` });

console.log("7) ACİL çağrı — sakinden görevliye alarm");
await res.goto(BASE + "#/emergency", { waitUntil: "load" });
await res.waitForTimeout(400);
const panic = res.locator("[data-panic]");
const box = await panic.boundingBox();
await res.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await res.mouse.down();
await res.waitForTimeout(1800);
await res.mouse.up();
await res.waitForTimeout(800);
if (!(await res.locator("text=Çağrınız iletildi").count())) throw new Error("panik gönderilmedi");
log("sakin: çağrı gönderildi");
await res.screenshot({ path: `${OUT}/f-panic-res.png` });

await guard.waitForTimeout(600);
if (!(await guard.locator(".alarm").count())) throw new Error("görevliye alarm düşmedi");
log("görevli: tam ekran alarm göründü");
await guard.screenshot({ path: `${OUT}/f-panic-guard.png` });
await guard.locator("[data-ack]").click();
await guard.waitForTimeout(400);
if (await guard.locator(".alarm").count()) throw new Error("alarm kapanmadı");
log("görevli alarmı onayladı");

console.log("8) Tesis rezervasyonu");
await res.goto(BASE + "#/services", { waitUntil: "load" });
await res.waitForTimeout(300);
await res.locator('[data-act="book"]').first().click();
await res.waitForSelector(".sheet");
await res.locator("[data-slot]").nth(3).click();
await res.waitForTimeout(500);
if (!(await res.locator("text=Rezervasyonlarım").count())) throw new Error("rezervasyon ekranı yok");
await res.screenshot({ path: `${OUT}/f-booking.png` });
log("rezervasyon yapıldı");

console.log("9) Yönetim duyuru yayınlıyor");
const adm = await ctx.newPage();
watch(adm, "admin");
await login(adm, 2, 0);
await adm.goto(BASE + "#/announcements", { waitUntil: "load" });
await adm.waitForTimeout(300);
await adm.locator('[data-act="new"]').click();
await adm.waitForSelector(".sheet");
await adm.locator('input[name="title"]').fill("Test duyurusu");
await adm.locator('textarea[name="body"]').fill("Otomatik testten yayınlandı.");
await adm.locator('.sheet [data-keep="1"]').click();
await adm.waitForTimeout(500);
if (!(await adm.locator("text=Test duyurusu").count())) throw new Error("duyuru yayınlanmadı");
log("duyuru yayınlandı");

console.log("10) Açık tema");
await adm.goto(BASE + "#/settings", { waitUntil: "load" });
await adm.waitForTimeout(300);
await adm.locator('[data-t="light"]').click();
await adm.waitForTimeout(400);
await adm.goto(BASE + "#/", { waitUntil: "load" });
await adm.waitForTimeout(500);
await adm.screenshot({ path: `${OUT}/f-light-admin.png` });
await adm.goto(BASE + "#/reports", { waitUntil: "load" });
await adm.waitForTimeout(400);
await adm.screenshot({ path: `${OUT}/f-light-reports.png` });
log("açık tema uygulandı");

console.log("11) Nöbet defteri");
await guard.goto(BASE + "#/logbook", { waitUntil: "load" });
await guard.waitForTimeout(400);
const logCount = await guard.locator(".tl").count();
log("defterde", logCount, "kayıt satırı");
if (logCount < 8) throw new Error("defter kayıtları eksik");
await guard.screenshot({ path: `${OUT}/f-logbook.png` });

console.log(errors.length ? "\nHATALAR:\n" + errors.join("\n") : "\nKONSOL HATASI YOK");
await browser.close();
