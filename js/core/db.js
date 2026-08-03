/**
 * Yerel veri katmanı.
 *
 * Tüm veri localStorage'da tek bir JSON belgesinde tutulur; koleksiyon API'si
 * (list/insert/update/remove) bunun üzerine kuruludur. Amaç, view'ların
 * depolamanın nasıl yapıldığını hiç bilmemesi: ileride bu dosyanın içi bir
 * REST/Supabase istemcisiyle değiştirildiğinde uygulamanın geri kalanı aynı
 * kalır.
 */
import * as bus from "./bus.js";

const KEY = "siteapp.db.v1";

/** @type {object|null} */
let state = null;
let writing = false;

function blank() {
  return {
    meta: { version: 2, createdAt: new Date().toISOString() },
    site: {},
    users: [],
    announcements: [],
    visitors: [],
    packages: [],
    incidents: [],
    checkpoints: [],
    patrols: [],
    shifts: [],
    amenities: [],
    bookings: [],
    vehicles: [],
    contacts: [],
    logs: [],
    notifications: [],
    dataRequests: [],
    settings: { theme: "dark", notify: true, sound: true },
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...blank(), ...parsed };
  } catch (err) {
    console.warn("[db] okunamadı, sıfırlanıyor", err);
    return null;
  }
}

function write() {
  writing = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error("[db] yazılamadı", err);
  } finally {
    writing = false;
  }
}

/** Depoyu hazırla; boşsa seed verisini yükle. */
export async function init() {
  state = read();
  if (!state) {
    const { buildSeed } = await import("./seed.js");
    state = { ...blank(), ...buildSeed() };
    write();
  }
  // Başka bir sekme yazdıysa buradan haber alıp belleği tazeliyoruz.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || writing) return;
    const fresh = read();
    if (fresh) {
      state = fresh;
      bus.emitLocal("db:change", { collection: "*", remote: true });
    }
  });
  bus.on("db:remote", () => {
    const fresh = read();
    if (fresh) {
      state = fresh;
      bus.emitLocal("db:change", { collection: "*", remote: true });
    }
  });
  return state;
}

function touched(collection) {
  write();
  bus.emitLocal("db:change", { collection });
  bus.emit("db:remote", { collection });
}

export function raw() {
  return state;
}

/** Koleksiyonu (isteğe bağlı filtre ile) döndürür. */
export function list(collection, filter) {
  const arr = state[collection] || [];
  return filter ? arr.filter(filter) : arr.slice();
}

export function find(collection, id) {
  return (state[collection] || []).find((x) => x.id === id) || null;
}

export function insert(collection, doc) {
  if (!state[collection]) state[collection] = [];
  const rec = { id: doc.id || uid(collection), createdAt: nowIso(), ...doc };
  state[collection].unshift(rec);
  touched(collection);
  return rec;
}

export function update(collection, id, patch) {
  const arr = state[collection] || [];
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...patch, updatedAt: nowIso() };
  touched(collection);
  return arr[i];
}

export function remove(collection, id) {
  const arr = state[collection] || [];
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return false;
  arr.splice(i, 1);
  touched(collection);
  return true;
}

/** Site ayarları / tek kayıtlık nesneler için. */
export function patchDoc(key, patch) {
  state[key] = { ...(state[key] || {}), ...patch };
  touched(key);
  return state[key];
}

/** Denetim kaydı — nöbet defterinin kaynağı. */
export function log(entry) {
  return insert("logs", {
    at: nowIso(),
    kind: "info",
    ...entry,
  });
}

/** Rol hedefli bildirim üretir (uygulama içi bildirim merkezi). */
export function notify({ to, title, body, kind = "info", link = "" }) {
  return insert("notifications", {
    to, // 'guard' | 'resident' | 'admin' | 'all' | userId
    title,
    body,
    kind,
    link,
    read: [],
    at: nowIso(),
  });
}

export function uid(prefix = "id") {
  const rnd =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ||
    Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Demo verisini baştan kurar. */
export async function reset() {
  const { buildSeed } = await import("./seed.js");
  state = { ...blank(), ...buildSeed() };
  write();
  bus.emitLocal("db:change", { collection: "*" });
  bus.emit("db:remote", { collection: "*" });
}

/** Yedek/dışa aktarım. */
export function exportJson() {
  return JSON.stringify(state, null, 2);
}

/** Koleksiyonun tamamını değiştirir (yapılandırma içe aktarımında kullanılır). */
export function setCollection(name, arr) {
  state[name] = Array.isArray(arr) ? arr : [];
  touched(name);
  return state[name];
}

/** Kurulum sırasında başka bir siteye taşınabilecek yapılandırma. */
const CONFIG_KEYS = ["site", "checkpoints", "amenities", "contacts"];

/** Kişisel veri içermeyen site yapılandırmasını dışa aktarır. */
export function exportConfig() {
  const out = { _type: "siteapp.config", _version: 1, exportedAt: nowIso() };
  CONFIG_KEYS.forEach((k) => (out[k] = state[k]));
  // Demo işareti yeni kuruluma taşınmasın.
  out.site = { ...out.site, demo: false };
  return JSON.stringify(out, null, 2);
}

/**
 * Dışa aktarılmış yapılandırmayı yükler.
 * @returns {{ok:boolean, error?:string}}
 */
export function importConfig(json) {
  let doc;
  try {
    doc = JSON.parse(json);
  } catch {
    return { ok: false, error: "Dosya okunamadı — geçerli bir JSON değil." };
  }
  if (doc._type !== "siteapp.config")
    return { ok: false, error: "Bu dosya bir site yapılandırma dosyası değil." };
  CONFIG_KEYS.forEach((k) => {
    if (doc[k] === undefined) return;
    state[k] = doc[k];
  });
  write();
  bus.emitLocal("db:change", { collection: "*" });
  bus.emit("db:remote", { collection: "*" });
  return { ok: true };
}

/**
 * İşlem kayıtlarını siler, site yapılandırmasını korur.
 * Demodan gerçek kuruluma geçerken kullanılır.
 * @param {{users?:boolean}} opt - users:true ise demo kullanıcıları da silinir
 *   (giriş yapmış yönetici hesabı hariç).
 */
export function clearOperationalData({ users = false, keepUserId = "" } = {}) {
  [
    "visitors",
    "packages",
    "incidents",
    "patrols",
    "shifts",
    "bookings",
    "logs",
    "notifications",
    "dataRequests",
    "announcements",
    "vehicles",
  ].forEach((k) => (state[k] = []));
  if (users) state.users = state.users.filter((u) => u.id === keepUserId);
  state.site = { ...state.site, demo: false };
  write();
  bus.emitLocal("db:change", { collection: "*" });
  bus.emit("db:remote", { collection: "*" });
}
