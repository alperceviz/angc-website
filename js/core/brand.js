/**
 * Marka ve yerel özelleştirme.
 *
 * Uygulama birden fazla siteye kurulabilsin diye site adı, telefonlar, bloklar
 * ve vurgu rengi koda gömülü değil; hepsi `site` yapılandırmasında tutulur ve
 * yönetim panelinden düzenlenir. Burası o yapılandırmayı okuyup arayüze
 * uygulayan yer.
 */
import * as db from "./db.js";

export const DEFAULT_BRAND_NAME = "Site Asistanı";
export const DEFAULT_ACCENT = "#ffc800";

/** Uygulamanın (ürünün) adı — beyaz etiket kurulumlarında değiştirilebilir. */
export function brandName() {
  return db.raw()?.site?.brandName?.trim() || DEFAULT_BRAND_NAME;
}

/** Kurulu sitenin adı. */
export function siteName() {
  return db.raw()?.site?.name?.trim() || "Site";
}

export function accent() {
  return db.raw()?.site?.brandColor || DEFAULT_ACCENT;
}

/* ---------- Renk yardımcıları ---------- */

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** WCAG bağıl parlaklık — yazının koyu mu açık mı olacağına karar vermek için. */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const toHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/**
 * Açık temada vurgu rengi aynı zamanda yazı rengi olarak kullanılıyor; parlak
 * sarı gibi renkler beyaz zeminde okunmaz. Gerekirse rengi koyulaştırıyoruz.
 */
function forTheme(hex, theme) {
  if (theme !== "light") return hex;
  let rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let guard = 0;
  while (luminance(toHex(rgb)) > 0.3 && guard++ < 24) {
    rgb = rgb.map((v) => v * 0.88);
  }
  return toHex(rgb);
}

/** Vurgu rengini ve türevlerini kök değişkenlere yazar. */
export function applyBrand() {
  const root = document.documentElement;
  const base = accent();
  if (!hexToRgb(base)) {
    ["--accent", "--accent-soft", "--accent-ink"].forEach((p) => root.style.removeProperty(p));
    return;
  }
  const theme = db.raw()?.settings?.theme || "dark";
  const color = forTheme(base, theme);
  const [r, g, b] = hexToRgb(color);
  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, ${theme === "light" ? 0.12 : 0.15})`);
  // Vurgu üzerindeki yazı okunabilir kalsın.
  root.style.setProperty("--accent-ink", luminance(color) > 0.45 ? "#171200" : "#fff8e6");
  applyNames();
}

/**
 * Sekme başlığını ve iOS ana ekran adını yapılandırmadan besler.
 *
 * iOS, "Ana Ekrana Ekle" anında `apple-mobile-web-app-title` etiketini canlı
 * DOM'dan okur; dolayısıyla panelden girilen ad dosyalara dokunmadan doğrudan
 * ana ekrana yansır. Android tarafında Chrome manifest'teki adı kullanır.
 */
export function applyNames() {
  const site = siteName();
  const brand = brandName();
  document.title = site && site !== "Site" ? `${site} · ${brand}` : brand;
  const tag = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (tag) tag.setAttribute("content", site && site !== "Site" ? site : brand);
}

/**
 * Kurulumun eksik parçalarını döndürür.
 * Yönetim panelindeki "kurulumu tamamla" listesi bunu kullanır.
 */
export function setupGaps() {
  const s = db.raw().site || {};
  const gaps = [];
  const placeholder = (v) => !v || /^0\D*2\d{2}\D*0{3}/.test(v) || v.includes("000 00 00");

  if (!s.name || s.name === "Site") gaps.push(["Site adı girilmedi", "/admin/site"]);
  if (!s.address) gaps.push(["Site adresi girilmedi", "/admin/site"]);
  if (placeholder(s.guardPhone)) gaps.push(["Güvenlik kulübesi telefonu örnek değerde", "/admin/site"]);
  if (placeholder(s.managerPhone)) gaps.push(["Yönetim telefonu örnek değerde", "/admin/site"]);
  if (!s.assemblyPoint) gaps.push(["Acil durum toplanma alanı tanımlanmadı", "/admin/site"]);
  if (!(s.blocks || []).length) gaps.push(["Blok listesi boş", "/admin/site"]);
  if (!db.list("users", (u) => u.role === "guard").length)
    gaps.push(["Kayıtlı güvenlik görevlisi yok", "/admin/c/users"]);
  if (!db.list("checkpoints").length)
    gaps.push(["Devriye kontrol noktası tanımlanmadı", "/admin/c/checkpoints"]);
  if (s.demo) gaps.push(["Demo kayıtları hâlâ duruyor", "/admin/data"]);
  return gaps;
}
