import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "ekran-goruntuleri");

const BASE = "http://127.0.0.1:8099/";
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "tr-TR",
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE: " + m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function loginAs(roleIdx, userIdx) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(`[data-role]`).nth(roleIdx).click();
  await page.locator(`[data-user]`).nth(userIdx).click();
  for (const d of "1234") await page.locator(`[data-key="${d}"]`).click();
  await page.waitForTimeout(300);
  // Açık rıza kapısı (aydınlatma metni)
  if (await page.locator("[data-consent]").count()) {
    await page.locator("[data-consent]").click();
    await page.locator("[data-go]").click();
  }
  await page.waitForSelector(".tabbar", { timeout: 5000 });
}

const routes = [
  "/", "/visitors", "/visitors/new", "/patrol", "/incidents", "/incidents/new",
  "/packages", "/announcements", "/services", "/directory", "/emergency",
  "/logbook", "/residents", "/reports", "/profile", "/settings", "/admin", "/admin/site", "/admin/data", "/admin/c/users",
];

// --- GUARD ---
await loginAs(0, 0);
await shot("guard-home");
for (const r of routes) {
  await page.goto(BASE + "#" + r, { waitUntil: "load" });
  await page.waitForTimeout(320);
  await shot("guard" + r.replace(/\//g, "_"));
}

// incident detail
await page.goto(BASE + "#/incidents", { waitUntil: "load" });
await page.waitForTimeout(300);
await page.locator('[data-act="open"]').first().click();
await page.waitForTimeout(400);
await shot("guard-incident-detail");

// --- RESIDENT ---
await loginAs(1, 0);
await shot("res-home");
for (const r of ["/visitors", "/visitors/new", "/incidents", "/incidents/new", "/packages", "/services", "/emergency", "/profile"]) {
  await page.goto(BASE + "#" + r, { waitUntil: "load" });
  await page.waitForTimeout(320);
  await shot("res" + r.replace(/\//g, "_"));
}

// --- ADMIN ---
await loginAs(2, 0);
await shot("admin-home");
for (const r of ["/reports", "/announcements", "/logbook", "/residents"]) {
  await page.goto(BASE + "#" + r, { waitUntil: "load" });
  await page.waitForTimeout(320);
  await shot("admin" + r.replace(/\//g, "_"));
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "NO ERRORS");
await browser.close();
