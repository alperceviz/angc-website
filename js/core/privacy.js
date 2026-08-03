/**
 * KVKK / veri koruma katmanı.
 *
 * Üç işi var:
 *  1. Aydınlatma metni ve kullanıcı başına açık rıza kaydı,
 *  2. Saklama süresi dolan kayıtların otomatik temizliği,
 *  3. Sakinin kendi verisine erişimi (indirme / silme talebi).
 *
 * Metin bir TASLAKTIR; yayına almadan önce sitenin veri sorumlusu ve hukuk
 * danışmanı tarafından gözden geçirilmelidir.
 */
import * as db from "./db.js";

/** Aydınlatma metninin sürümü; metin değişince rızalar yenilenir. */
export const CONSENT_VERSION_KEY = "privacyVersion";

const DEFAULT_RETENTION = {
  visitors: 90,
  packages: 180,
  incidents: 365,
  logs: 365,
  photos: 90,
};

export function retention() {
  return { ...DEFAULT_RETENTION, ...(db.raw()?.site?.retention || {}) };
}

export function retentionEnabled() {
  return db.raw()?.site?.retentionEnabled !== false;
}

/* ------------------------------------------------------------------ */
/* Aydınlatma metni                                                     */
/* ------------------------------------------------------------------ */

/** Site adına göre doldurulmuş varsayılan taslak metin. */
export function defaultNotice(siteName = "Site") {
  return `${siteName} Site Yönetimi olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla hareket etmekteyiz.

1) İŞLENEN KİŞİSEL VERİLER
• Kimlik ve iletişim: ad soyad, telefon numarası, blok ve daire bilgisi
• Araç bilgisi: plaka, marka/model
• Ziyaretçi kayıtları: ziyaretçinin adı, telefonu, aracının plakası, giriş–çıkış saati
• Kargo ve teslimat kayıtları
• Olay/talep kayıtları ve bu kayıtlara eklenen fotoğraflar
• Devriye kayıtları ve görevli tarafından isteğe bağlı eklenen konum damgası

2) İŞLEME AMAÇLARI
• Site giriş–çıkış güvenliğinin sağlanması ve yetkisiz girişlerin önlenmesi
• Ziyaretçi ve kargo teslimatlarının takibi
• Arıza ve talep kayıtlarının yönetilmesi
• Acil durumlarda ilgili kişiye ve yetkili birimlere hızlı ulaşılması
• Güvenlik hizmetinin denetlenmesi (devriye ve nöbet kayıtları)

3) HUKUKİ SEBEP
Veriler, KVKK m.5/2-(f) uyarınca veri sorumlusunun meşru menfaati ve
m.5/2-(c) uyarınca sözleşmenin ifası kapsamında; açık rıza gerektiren hâllerde
ise m.5/1 uyarınca açık rızanıza dayanılarak işlenir.

4) SAKLAMA SÜRESİ
Kayıtlar, yönetim tarafından belirlenen saklama süreleri dolduğunda otomatik
olarak silinir. Güncel süreler uygulamanın "Gizlilik ve Veri Koruma" bölümünde
görüntülenebilir.

5) AKTARIM
Kişisel verileriniz, yalnızca hukuken yetkili kamu kurum ve kuruluşlarına
talep hâlinde ve mevzuatın öngördüğü sınırlar içinde aktarılır. [Site yönetimi
tarafından hizmet alınan üçüncü taraflar varsa burada belirtilmelidir.]

6) HAKLARINIZ (KVKK m.11)
Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin
bilgi talep etme, işlenme amacını öğrenme, eksik veya yanlış işlenmişse
düzeltilmesini isteme, silinmesini veya yok edilmesini isteme ve işlenen
verilerin analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına
itiraz etme haklarına sahipsiniz.

Bu haklarınızı uygulama içindeki "Verilerim" ekranından veya site yönetimine
yazılı başvuru yaparak kullanabilirsiniz.

7) VERİ SORUMLUSU VE BAŞVURU
${siteName} Site Yönetimi
[Adres, e-posta ve KEP adresi yönetim tarafından doldurulmalıdır.]

Bu metin bir taslaktır; yayına alınmadan önce veri sorumlusu ve hukuk
danışmanı tarafından gözden geçirilmelidir.`;
}

export function notice() {
  const s = db.raw()?.site || {};
  return {
    text: s.privacyText || defaultNotice(s.name || "Site"),
    version: s.privacyVersion || 1,
    isDefault: !s.privacyText,
  };
}

/** Metni günceller ve sürümü artırarak tüm rızaları yeniler. */
export function updateNotice(text) {
  const s = db.raw().site;
  return db.patchDoc("site", {
    privacyText: text,
    privacyVersion: (s.privacyVersion || 1) + 1,
  });
}

/* ------------------------------------------------------------------ */
/* Rıza                                                                 */
/* ------------------------------------------------------------------ */

/** Kullanıcı güncel metni onaylamış mı? */
export function hasConsent(user) {
  if (!user) return true;
  return user.consent?.version === notice().version;
}

export function giveConsent(user) {
  const rec = { version: notice().version, at: db.nowIso() };
  db.update("users", user.id, { consent: rec });
  db.log({
    kind: "info",
    by: user.name,
    text: `Aydınlatma metni onaylandı (sürüm ${rec.version}).`,
  });
  return rec;
}

/** Kaç kullanıcı güncel metni onaylamış? */
export function consentStats() {
  const users = db.list("users");
  const v = notice().version;
  const done = users.filter((u) => u.consent?.version === v);
  return { total: users.length, done: done.length, pending: users.length - done.length };
}

/* ------------------------------------------------------------------ */
/* Saklama süresi temizliği                                             */
/* ------------------------------------------------------------------ */

const DAY = 24 * 3600 * 1000;
const olderThan = (iso, days) => iso && Date.now() - new Date(iso).getTime() > days * DAY;

/** Silinecek/temizlenecek kayıtları sayar (silmeden). */
export function purgePreview() {
  const r = retention();
  return {
    visitors: db.list("visitors", (x) => olderThan(x.createdAt, r.visitors)).length,
    packages: db.list("packages", (x) => olderThan(x.receivedAt, r.packages)).length,
    incidents: db.list("incidents", (x) => olderThan(x.at, r.incidents)).length,
    logs: db.list("logs", (x) => olderThan(x.at, r.logs)).length,
    photos: db.list("incidents", (x) => x.photo && olderThan(x.at, r.photos)).length,
  };
}

/**
 * Süresi dolan kayıtları siler. Fotoğraflar, kayıt hâlâ saklanıyor olsa bile
 * kendi süresi dolduğunda ayrıca temizlenir.
 * @returns {object} silinen kayıt sayıları
 */
export function purgeExpired() {
  if (!retentionEnabled()) return null;
  const r = retention();
  const counts = { visitors: 0, packages: 0, incidents: 0, logs: 0, photos: 0 };

  db.list("visitors", (x) => olderThan(x.createdAt, r.visitors)).forEach((x) => {
    db.remove("visitors", x.id);
    counts.visitors++;
  });
  db.list("packages", (x) => olderThan(x.receivedAt, r.packages)).forEach((x) => {
    db.remove("packages", x.id);
    counts.packages++;
  });
  db.list("incidents", (x) => olderThan(x.at, r.incidents)).forEach((x) => {
    db.remove("incidents", x.id);
    counts.incidents++;
  });
  // Kalan kayıtlarda fotoğrafın kendi süresi
  db.list("incidents", (x) => x.photo && olderThan(x.at, r.photos)).forEach((x) => {
    db.update("incidents", x.id, { photo: "", photoPurgedAt: db.nowIso() });
    counts.photos++;
  });
  db.list("logs", (x) => olderThan(x.at, r.logs)).forEach((x) => {
    db.remove("logs", x.id);
    counts.logs++;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  db.patchDoc("site", { lastPurgeAt: db.nowIso() });
  if (total)
    db.log({
      kind: "info",
      by: "Sistem",
      text:
        `Saklama süresi dolan kayıtlar temizlendi: ` +
        Object.entries(counts)
          .filter(([, n]) => n)
          .map(([k, n]) => `${k} ${n}`)
          .join(", "),
    });
  return counts;
}

/** Günde en fazla bir kez çalışır; açılışta çağrılır. */
export function purgeIfDue() {
  const last = db.raw()?.site?.lastPurgeAt;
  if (last && Date.now() - new Date(last).getTime() < DAY) return null;
  return purgeExpired();
}

/* ------------------------------------------------------------------ */
/* İlgili kişi hakları                                                  */
/* ------------------------------------------------------------------ */

/** Bir kullanıcı hakkında tutulan kayıtların özeti. */
export function personalSummary(userId) {
  return {
    visitors: db.list("visitors", (x) => x.hostId === userId).length,
    packages: db.list("packages", (x) => x.hostId === userId).length,
    incidents: db.list("incidents", (x) => x.reporterId === userId).length,
    vehicles: db.list("vehicles", (x) => x.ownerId === userId).length,
    bookings: db.list("bookings", (x) => x.userId === userId).length,
  };
}

/** KVKK m.11 kapsamında verilecek kişisel veri dökümü. */
export function personalExport(userId) {
  const u = db.find("users", userId);
  return JSON.stringify(
    {
      _type: "kisisel-veri-dokumu",
      olusturma: db.nowIso(),
      site: db.raw().site.name,
      kisi: u && {
        ad: u.name,
        rol: u.role,
        telefon: u.phone,
        blok: u.block,
        daire: u.unit,
        onay: u.consent || null,
      },
      ziyaretciler: db.list("visitors", (x) => x.hostId === userId),
      kargolar: db.list("packages", (x) => x.hostId === userId),
      talepler: db.list("incidents", (x) => x.reporterId === userId).map(stripPhoto),
      araclar: db.list("vehicles", (x) => x.ownerId === userId),
      rezervasyonlar: db.list("bookings", (x) => x.userId === userId),
    },
    null,
    2
  );
}

// Fotoğraf verisi dökümü gereksiz yere şişirmesin.
const stripPhoto = (i) => ({ ...i, photo: i.photo ? "[fotoğraf mevcut]" : "" });

/** Silme/erişim talebi oluşturur. */
export function createRequest(user, type, note = "") {
  const rec = db.insert("dataRequests", {
    userId: user.id,
    userName: user.name,
    type, // 'delete' | 'access'
    status: "open",
    note,
    at: db.nowIso(),
  });
  db.log({
    kind: "info",
    by: user.name,
    text: `KVKK talebi oluşturuldu: ${type === "delete" ? "silme" : "erişim"}.`,
  });
  return rec;
}

/**
 * Silme talebini uygular: kişiye ait kayıtları siler, kullanıcıyı anonimleştirir.
 * Nöbet defteri satırları denetim amacıyla korunur.
 */
export function applyDeletion(userId, byName) {
  const u = db.find("users", userId);
  if (!u) return false;
  db.list("visitors", (x) => x.hostId === userId).forEach((x) => db.remove("visitors", x.id));
  db.list("packages", (x) => x.hostId === userId).forEach((x) => db.remove("packages", x.id));
  db.list("vehicles", (x) => x.ownerId === userId).forEach((x) => db.remove("vehicles", x.id));
  db.list("bookings", (x) => x.userId === userId).forEach((x) => db.remove("bookings", x.id));
  db.list("incidents", (x) => x.reporterId === userId).forEach((x) =>
    db.update("incidents", x.id, { reporterId: "", reporterAnonymized: true, photo: "" })
  );
  db.remove("users", userId);
  db.log({ kind: "info", by: byName, text: `KVKK silme talebi uygulandı: ${u.name}.` });
  return true;
}
