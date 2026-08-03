/** Tarih, metin ve etiket biçimlendirme yardımcıları (tümü Türkçe). */

const TR = "tr-TR";

export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(TR, { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(TR, { day: "2-digit", month: "short" });
}

export function fmtDateLong(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(TR, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(TR, { day: "2-digit", month: "2-digit" })} ${fmtTime(iso)}`;
}

/** "3 dk önce", "2 sa önce", "dün", "5 Mar" */
export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  if (d === 1) return "dün";
  if (d < 7) return `${d} gün önce`;
  return fmtDate(iso);
}

/** Süreyi "4 sa 12 dk" biçiminde verir. */
export function duration(fromIso, toIso = new Date().toISOString()) {
  const ms = Math.max(0, new Date(toIso) - new Date(fromIso));
  const total = Math.floor(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  return `${h} sa ${m} dk`;
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toLocaleUpperCase(TR);
}

/** "A" + "12" -> "A-12"; blok yoksa sadece daire. */
export function unitLabel(block, unit) {
  if (block && unit) return `${block}-${unit}`;
  return unit || block || "—";
}

export function normalizePlate(v = "") {
  return v.toLocaleUpperCase(TR).replace(/\s+/g, " ").trim();
}

/** 6 haneli rastgele giriş kodu. */
export function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Saate (ve görevlilerde nöbete) göre selamlama. */
export function greeting(role = "resident") {
  const h = new Date().getHours();
  if (h < 6) return role === "guard" ? "İyi nöbetler" : "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/* ---------- Etiket sözlükleri ---------- */

export const VISITOR_STATUS = {
  expected: { label: "Bekleniyor", tone: "info" },
  inside: { label: "İçeride", tone: "ok" },
  left: { label: "Çıkış yaptı", tone: "" },
  denied: { label: "Giriş verilmedi", tone: "danger" },
};

export const INCIDENT_STATUS = {
  open: { label: "Açık", tone: "danger" },
  in_progress: { label: "İşlemde", tone: "warn" },
  resolved: { label: "Çözüldü", tone: "ok" },
};

export const PRIORITY = {
  low: { label: "Düşük", tone: "" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "Yüksek", tone: "warn" },
  critical: { label: "ACİL", tone: "danger" },
};

export const INCIDENT_TYPES = {
  security: { label: "Güvenlik", icon: "shield" },
  technical: { label: "Teknik arıza", icon: "tool" },
  noise: { label: "Gürültü", icon: "megaphone" },
  parking: { label: "Otopark / araç", icon: "car" },
  cleaning: { label: "Temizlik", icon: "droplet" },
  fire: { label: "Yangın / duman", icon: "flame" },
  medical: { label: "Sağlık", icon: "activity" },
  other: { label: "Diğer", icon: "info" },
};

export const PACKAGE_STATUS = {
  waiting: { label: "Kulübede", tone: "warn" },
  delivered: { label: "Teslim edildi", tone: "ok" },
};

export const LOG_KINDS = {
  visitor: { label: "Ziyaretçi", icon: "users" },
  package: { label: "Kargo", icon: "package" },
  incident: { label: "Olay", icon: "alert" },
  patrol: { label: "Devriye", icon: "route" },
  shift: { label: "Vardiya", icon: "clock" },
  panic: { label: "Acil çağrı", icon: "siren" },
  auth: { label: "Oturum", icon: "key" },
  booking: { label: "Rezervasyon", icon: "calendar" },
  announcement: { label: "Duyuru", icon: "megaphone" },
  info: { label: "Kayıt", icon: "info" },
};
