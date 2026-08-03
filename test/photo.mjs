import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "ekran-goruntuleri");
const BASE = "http://127.0.0.1:8099/";
const errors = [];
const log = (...a) => console.log("  ·", ...a);

const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:"tr-TR" });
const p = await c.newPage();
p.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
p.on("console", (m) => m.type()==="error" && errors.push("CONSOLE " + m.text()));

await p.goto(BASE, { waitUntil:"networkidle" });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await p.goto(BASE, { waitUntil:"networkidle" });
await p.locator("[data-role]").nth(1).click();
await p.locator("[data-user]").first().click();
for (const d of "1234") await p.locator(`[data-key="${d}"]`).click();
await p.waitForTimeout(300);
if (await p.locator("[data-consent]").count()) {
  await p.locator("[data-consent]").click();
  await p.locator("[data-go]").click();
}
await p.waitForSelector(".tabbar");

console.log("[Codex P2] Fotoğraf seç → sil → yeniden seç");
await p.goto(BASE + "#/incidents/new", { waitUntil:"load" });
await p.waitForTimeout(400);
await p.locator('input[name="title"]').fill("Fotoğraf testi");

const hidden = () => p.locator('input[name="photo"]').inputValue();

await p.locator("[data-photoinput]").setInputFiles(resolve(HERE, "a.png"));
await p.waitForTimeout(600);
const first = await hidden();
if (!first.startsWith("data:image/jpeg")) throw new Error("ilk seçim kaydedilmedi");
log("ilk fotoğraf kaydedildi (" + first.length + " karakter)");

await p.locator("[data-photoclear]").click();
await p.waitForTimeout(300);
if ((await hidden()) !== "") throw new Error("silme sonrası değer temizlenmedi");
log("silindi, gizli alan boşaldı");

await p.locator("[data-photoinput]").setInputFiles(resolve(HERE, "b.png"));
await p.waitForTimeout(600);
const second = await hidden();
if (!second.startsWith("data:image/jpeg"))
  throw new Error("YENİDEN SEÇİM KAYDEDİLMEDİ — Codex bulgusu hâlâ açık");
if (second === first) throw new Error("eski fotoğraf kalmış");
log("yeniden seçim kaydedildi ve farklı (" + second.length + " karakter)");

await p.locator('[data-act="save"]').click();
await p.waitForTimeout(700);
const saved = await p.evaluate(() =>
  JSON.parse(localStorage.getItem("siteapp.db.v1")).incidents.find(i => i.title === "Fotoğraf testi"));
if (!saved) throw new Error("kayıt oluşmadı");
if (!saved.photo || !saved.photo.startsWith("data:image/jpeg"))
  throw new Error("kayda fotoğraf yazılmadı");
log("kayıt fotoğrafla birlikte oluştu");

console.log(errors.length ? "\nHATALAR:\n"+errors.join("\n") : "\nKONSOL HATASI YOK");
await b.close();
