/**
 * Lisans / abonelik.
 *
 * Ticari model: bedelini **site yönetimi** öder. Sakinler ve güvenlik
 * görevlileri hiçbir koşulda ücret ödemez ve hiçbir koşulda kilitlenmez.
 *
 * Bu ayrımın teknik karşılığı aşağıdaki iki listedir. Lisans süresi dolduğunda
 * yalnızca yönetimin kendi işine yarayan özellikler kapanır; kapıdaki ve
 * dairedeki hayat aynen devam eder. Acil çağrının faturaya bağlı olması
 * düşünülemez — bu yüzden NEVER_LOCKED listesi kodda açıkça duruyor.
 */
import * as db from "./db.js";

/** Lisans dolsa bile asla kapanmayan işlevler. */
export const NEVER_LOCKED = [
  "Acil çağrı ve alarm",
  "Ziyaretçi giriş / çıkış kaydı",
  "Misafir bildirimi ve kapı kodu",
  "Kargo teslim alma ve teslim etme",
  "Olay ve arıza bildirimi",
  "Devriye turları ve nöbet defteri",
  "Duyuruları okuma ve yayınlama",
  "Telefon rehberi ve acil numaralar",
  "Sakinlerin tüm ekranları",
];

/** Süre dolduğunda kapanan, yalnızca yönetimi ilgilendiren işlevler. */
export const LOCKABLE = {
  reports: "Yönetim raporları",
  export: "Veri ve yapılandırma dışa aktarma",
  newUser: "Yeni kullanıcı tanımlama",
};

/** Süre dolduktan sonra tanınan ek süre. */
const GRACE_DAYS = 30;
const DAY = 24 * 3600 * 1000;

export function license() {
  return {
    plan: "demo",
    licensedTo: "",
    units: 0,
    validUntil: "",
    key: "",
    ...(db.raw()?.site?.license || {}),
  };
}

/**
 * @returns {'demo'|'active'|'grace'|'expired'}
 */
export function status() {
  const l = license();
  if (l.plan === "demo") return "demo";
  if (!l.validUntil) return "demo";
  const diff = new Date(l.validUntil).getTime() - Date.now();
  if (diff >= 0) return "active";
  if (diff > -GRACE_DAYS * DAY) return "grace";
  return "expired";
}

/** Kalan gün (negatifse geçen gün). */
export function daysLeft() {
  const l = license();
  if (!l.validUntil) return null;
  return Math.ceil((new Date(l.validUntil).getTime() - Date.now()) / DAY);
}

/** Ek süre bittiğinde kalan gün sayısı. */
export function graceLeft() {
  const d = daysLeft();
  return d === null ? null : GRACE_DAYS + d;
}

/**
 * Bir yönetim özelliği kilitli mi?
 * Sakin ve görevli ekranları bu fonksiyonu hiç çağırmaz — çağırmamalıdır.
 */
export function isLocked(feature) {
  if (!(feature in LOCKABLE)) return false;
  return status() === "expired";
}

/** Lisanslı daire sayısına göre kullanım. */
export function usage() {
  const l = license();
  const residents = db.list("users", (u) => u.role === "resident").length;
  return {
    residents,
    units: l.units || 0,
    over: l.units ? Math.max(0, residents - l.units) : 0,
  };
}

/** Yönetici ekranlarında gösterilecek uyarı (yoksa null). */
export function warning() {
  const s = status();
  if (s === "active") {
    const d = daysLeft();
    if (d !== null && d <= 30)
      return { tone: "warn", text: `Lisans ${d} gün sonra doluyor. Yenilemek için yönetim paneline bakın.` };
    return null;
  }
  if (s === "grace")
    return {
      tone: "warn",
      text: `Lisans süresi doldu. ${graceLeft()} gün ek süre içindesiniz; sonrasında yönetim raporları ve dışa aktarma kapanacak. Güvenlik ve sakin işlevleri etkilenmez.`,
    };
  if (s === "expired")
    return {
      tone: "danger",
      text: "Lisans süresi doldu. Yönetim raporları, dışa aktarma ve yeni kullanıcı tanımlama kapalı. Kapı, kargo, olay ve acil çağrı işlevleri çalışmaya devam ediyor.",
    };
  return null;
}

export function planLabel(plan = license().plan) {
  return { demo: "Demo / deneme", standart: "Standart", kurumsal: "Kurumsal" }[plan] || plan;
}

/** Lisansı günceller. */
export function setLicense(patch, byName) {
  const next = { ...license(), ...patch };
  db.patchDoc("site", { license: next });
  db.log({
    kind: "info",
    by: byName,
    text: `Lisans güncellendi: ${planLabel(next.plan)}${
      next.validUntil ? ` · ${new Date(next.validUntil).toLocaleDateString("tr-TR")}` : ""
    }`,
  });
  return next;
}
