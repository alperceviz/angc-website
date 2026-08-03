/**
 * Demo verisi.
 *
 * Uygulama ilk açılışta boş bir ekranla karşılamasın diye gerçekçi bir site
 * kurgusu üretir. Gerçek kuruluma geçerken tek yapılacak şey bu dosyayı
 * devre dışı bırakıp verinin sunucudan gelmesini sağlamaktır.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();

export function buildSeed() {
  const users = [
    {
      id: "u_admin",
      name: "Ayşe Toprak",
      role: "admin",
      title: "Site Yöneticisi",
      phone: "0216 000 00 01",
      pin: "1234",
      block: "",
      unit: "",
    },
    {
      id: "u_g1",
      name: "Murat Kaya",
      role: "guard",
      title: "Vardiya Amiri",
      phone: "0532 000 00 11",
      pin: "1234",
      badge: "GRV-01",
    },
    {
      id: "u_g2",
      name: "Serkan Demir",
      role: "guard",
      title: "Güvenlik Görevlisi",
      phone: "0532 000 00 12",
      pin: "1234",
      badge: "GRV-02",
    },
    {
      id: "u_g3",
      name: "Hasan Yıldız",
      role: "guard",
      title: "Güvenlik Görevlisi",
      phone: "0532 000 00 13",
      pin: "1234",
      badge: "GRV-03",
    },
    {
      id: "u_r1",
      name: "Elif Arslan",
      role: "resident",
      title: "Sakin",
      phone: "0532 000 00 21",
      pin: "1234",
      block: "A",
      unit: "12",
    },
    {
      id: "u_r2",
      name: "Mehmet Şahin",
      role: "resident",
      title: "Sakin",
      phone: "0532 000 00 22",
      pin: "1234",
      block: "B",
      unit: "4",
    },
    {
      id: "u_r3",
      name: "Zeynep Koç",
      role: "resident",
      title: "Sakin",
      phone: "0532 000 00 23",
      pin: "1234",
      block: "C",
      unit: "21",
    },
    {
      id: "u_r4",
      name: "Ahmet Doğan",
      role: "resident",
      title: "Sakin",
      phone: "0532 000 00 24",
      pin: "1234",
      block: "A",
      unit: "3",
    },
  ];

  const checkpoints = [
    { id: "cp1", order: 1, name: "Ana Giriş Kapısı", code: "1001", zone: "Giriş" },
    { id: "cp2", order: 2, name: "A Blok Girişi", code: "1002", zone: "A Blok" },
    { id: "cp3", order: 3, name: "B Blok Girişi", code: "1003", zone: "B Blok" },
    { id: "cp4", order: 4, name: "C Blok Girişi", code: "1004", zone: "C Blok" },
    { id: "cp5", order: 5, name: "Kapalı Otopark -1", code: "1005", zone: "Otopark" },
    { id: "cp6", order: 6, name: "Havuz ve Sosyal Tesis", code: "1006", zone: "Sosyal" },
    { id: "cp7", order: 7, name: "Jeneratör / Pano Odası", code: "1007", zone: "Teknik" },
    { id: "cp8", order: 8, name: "Arka Bahçe Yangın Çıkışı", code: "1008", zone: "Bahçe" },
  ];

  const amenities = [
    {
      id: "am1",
      name: "Yüzme Havuzu",
      icon: "waves",
      hours: "08:00 – 21:00",
      capacity: 25,
      slotMinutes: 60,
      note: "Bone zorunludur. 12 yaş altı refakatçisiz giremez.",
    },
    {
      id: "am2",
      name: "Fitness Salonu",
      icon: "dumbbell",
      hours: "06:00 – 23:00",
      capacity: 8,
      slotMinutes: 60,
      note: "Havlu ve iç mekân ayakkabısı zorunlu.",
    },
    {
      id: "am3",
      name: "Tenis Kortu",
      icon: "activity",
      hours: "07:00 – 22:00",
      capacity: 4,
      slotMinutes: 60,
      note: "Aydınlatma 20:00 sonrası güvenlikten açtırılır.",
    },
    {
      id: "am4",
      name: "Toplantı / Etkinlik Salonu",
      icon: "users",
      hours: "09:00 – 22:00",
      capacity: 30,
      slotMinutes: 120,
      note: "Yönetim onayı gerekir.",
    },
  ];

  const contacts = [
    { id: "c1", group: "Site", name: "Güvenlik Kulübesi", phone: "0216 000 00 00", note: "7/24", icon: "shield" },
    { id: "c2", group: "Site", name: "Site Yönetimi", phone: "0216 000 00 01", note: "Hafta içi 09:00–18:00", icon: "building" },
    { id: "c3", group: "Site", name: "Teknik Servis", phone: "0216 000 00 02", note: "Asansör, su, elektrik", icon: "tool" },
    { id: "c4", group: "Site", name: "Kapıcı (Bina Görevlisi)", phone: "0216 000 00 03", note: "08:00–18:00", icon: "user" },
    { id: "c5", group: "Acil", name: "Acil Çağrı Merkezi", phone: "112", note: "Ambulans / Genel acil", icon: "siren" },
    { id: "c6", group: "Acil", name: "İtfaiye", phone: "110", note: "Yangın", icon: "flame" },
    { id: "c7", group: "Acil", name: "Polis İmdat", phone: "155", note: "Asayiş", icon: "shield" },
    { id: "c8", group: "Acil", name: "AFAD", phone: "122", note: "Afet ve acil durum", icon: "alert" },
    { id: "c9", group: "Arıza", name: "Elektrik Arıza", phone: "186", note: "", icon: "zap" },
    { id: "c10", group: "Arıza", name: "Su Arıza", phone: "185", note: "", icon: "droplet" },
    { id: "c11", group: "Arıza", name: "Doğalgaz Acil", phone: "187", note: "", icon: "flame" },
  ];

  const announcements = [
    {
      id: "an1",
      title: "Ana su deposu bakımı — Salı 10:00–14:00",
      body:
        "Salı günü 10:00 – 14:00 arasında ana su deposu temizliği yapılacaktır. Bu saatlerde tüm bloklarda su kesintisi olacaktır. Lütfen ihtiyacınız kadar su bulundurunuz.",
      level: "warn",
      author: "Ayşe Toprak",
      pinned: true,
      at: ago(3 * HOUR),
    },
    {
      id: "an2",
      title: "Havuz sezonu açıldı",
      body:
        "Yüzme havuzumuz 08:00 – 21:00 saatleri arasında hizmete girmiştir. Rezervasyon uygulama üzerinden yapılabilir. Bone kullanımı zorunludur.",
      level: "info",
      author: "Ayşe Toprak",
      pinned: false,
      at: ago(1 * DAY),
    },
    {
      id: "an3",
      title: "Otoparkta yabancı araç uyarısı",
      body:
        "Misafir otoparkına plakası bildirilmemiş araç bırakılmaması rica olunur. Bildirilmemiş araçlar güvenlik tarafından kayda alınmakta ve 24 saat sonra çekiciye bildirilmektedir.",
      level: "info",
      author: "Murat Kaya",
      pinned: false,
      at: ago(2 * DAY),
    },
  ];

  const visitors = [
    {
      id: "v1",
      name: "Kerem Aydın",
      phone: "0533 111 22 33",
      plate: "34 ABC 123",
      block: "A",
      unit: "12",
      hostId: "u_r1",
      purpose: "Misafir",
      status: "inside",
      code: "482913",
      createdAt: ago(80 * MIN),
      enteredAt: ago(74 * MIN),
      byGuard: "u_g1",
    },
    {
      id: "v2",
      name: "Yemek Kuryesi",
      phone: "",
      plate: "34 KRY 09",
      block: "B",
      unit: "4",
      hostId: "u_r2",
      purpose: "Kurye",
      status: "left",
      code: "771204",
      createdAt: ago(5 * HOUR),
      enteredAt: ago(5 * HOUR),
      leftAt: ago(4.6 * HOUR),
      byGuard: "u_g2",
    },
    {
      id: "v3",
      name: "Selin Yavuz",
      phone: "0533 444 55 66",
      plate: "",
      block: "C",
      unit: "21",
      hostId: "u_r3",
      purpose: "Misafir",
      status: "expected",
      code: "305517",
      expectedAt: ahead(2 * HOUR),
      createdAt: ago(30 * MIN),
    },
  ];

  const packages = [
    {
      id: "p1",
      courier: "Kargo — Yurtiçi",
      recipientName: "Elif Arslan",
      block: "A",
      unit: "12",
      hostId: "u_r1",
      code: "A12-441",
      status: "waiting",
      receivedAt: ago(2 * HOUR),
      byGuard: "u_g1",
    },
    {
      id: "p2",
      courier: "Kargo — Aras",
      recipientName: "Ahmet Doğan",
      block: "A",
      unit: "3",
      hostId: "u_r4",
      code: "A03-118",
      status: "waiting",
      receivedAt: ago(26 * HOUR),
      byGuard: "u_g3",
    },
    {
      id: "p3",
      courier: "Kargo — MNG",
      recipientName: "Mehmet Şahin",
      block: "B",
      unit: "4",
      hostId: "u_r2",
      code: "B04-902",
      status: "delivered",
      receivedAt: ago(2 * DAY),
      deliveredAt: ago(1.6 * DAY),
      byGuard: "u_g2",
    },
  ];

  const incidents = [
    {
      id: "i1",
      type: "technical",
      title: "B Blok asansörü katlar arasında takılıyor",
      body:
        "Asansör 3. kat ile 4. kat arasında zaman zaman duruyor. Bugün içinde iki kez yaşandı, içeride kimse kalmadı.",
      priority: "high",
      status: "in_progress",
      block: "B",
      unit: "4",
      reporterId: "u_r2",
      at: ago(6 * HOUR),
      updates: [
        { at: ago(5 * HOUR), by: "Murat Kaya", text: "Teknik servise bildirildi, asansör geçici olarak servis dışı." },
        { at: ago(2 * HOUR), by: "Ayşe Toprak", text: "Firma yarın 10:00'da geliyor." },
      ],
    },
    {
      id: "i2",
      type: "security",
      title: "Otopark F2 aydınlatması yanmıyor",
      body: "Kapalı otopark -1 kat, F2 bölgesindeki 3 armatür sönük. Görüş çok kısıtlı.",
      priority: "normal",
      status: "open",
      block: "-",
      reporterId: "u_g2",
      at: ago(14 * HOUR),
      updates: [],
    },
    {
      id: "i3",
      type: "noise",
      title: "Gece 01:00'de yüksek sesle müzik",
      body: "C Blok üst katlardan gelen ses nedeniyle şikâyet bildirildi. Görevli uyarı yaptı, ses kesildi.",
      priority: "low",
      status: "resolved",
      block: "C",
      reporterId: "u_r3",
      at: ago(2 * DAY),
      resolvedAt: ago(1.9 * DAY),
      updates: [{ at: ago(1.9 * DAY), by: "Hasan Yıldız", text: "Daireye çıkıldı, uyarı yapıldı. Sorun kapandı." }],
    },
  ];

  const vehicles = [
    { id: "veh1", ownerId: "u_r1", plate: "34 EA 120", model: "Renault Clio", color: "Beyaz" },
    { id: "veh2", ownerId: "u_r2", plate: "34 MS 044", model: "VW Passat", color: "Gri" },
    { id: "veh3", ownerId: "u_r3", plate: "06 ZK 210", model: "Fiat Egea", color: "Kırmızı" },
  ];

  const shifts = [
    {
      id: "sh0",
      guardId: "u_g3",
      startedAt: ago(16 * HOUR),
      endedAt: ago(8 * HOUR),
      handover:
        "Gece sakin geçti. Otopark F2 aydınlatması hâlâ arızalı, sabah teknik servise hatırlatılacak. A-12'ye gelen misafir 23:40'ta çıkış yaptı.",
    },
  ];

  const patrols = [
    {
      id: "pt0",
      guardId: "u_g3",
      startedAt: ago(11 * HOUR),
      endedAt: ago(10.4 * HOUR),
      scans: checkpoints.map((c, i) => ({
        checkpointId: c.id,
        at: ago((11 - i * 0.08) * HOUR),
        note: "",
      })),
    },
  ];

  const bookings = [
    { id: "bk1", amenityId: "am2", userId: "u_r1", date: todayStr(), slot: "18:00", people: 1, at: ago(3 * HOUR) },
  ];

  const logs = [
    { id: "lg1", at: ago(74 * MIN), kind: "visitor", by: "Murat Kaya", text: "Ziyaretçi girişi: Kerem Aydın → A-12 (34 ABC 123)" },
    { id: "lg2", at: ago(2 * HOUR), kind: "package", by: "Murat Kaya", text: "Kargo teslim alındı: A-12 Elif Arslan (Yurtiçi)" },
    { id: "lg3", at: ago(8 * HOUR), kind: "shift", by: "Hasan Yıldız", text: "Vardiya devri yapıldı → Murat Kaya" },
    { id: "lg4", at: ago(10.4 * HOUR), kind: "patrol", by: "Hasan Yıldız", text: "Devriye turu tamamlandı (8/8 nokta)" },
  ];

  return {
    site: {
      // Ürün adı — beyaz etiket kurulumlarında yönetim panelinden değiştirilir.
      brandName: "Site Asistanı",
      brandColor: "#ffc800",

      name: "Dünya Şehir Kartal",
      shortName: "Dünya Şehir",
      address: "Kartal / İstanbul",
      blocks: ["A", "B", "C", "D", "E"],
      assemblyPoint: "Ana kapı karşısı — açık otopark alanı",
      // Aşağıdaki numaralar örnek değerdir; kurulumda yönetim panelinden girilir.
      guardPhone: "0216 000 00 00",
      managerPhone: "0216 000 00 01",

      // Kurulum durumu: demo kayıtları temizlenene kadar açık kalır.
      demo: true,

      // KVKK: aydınlatma metni sürümü ve saklama süreleri (gün).
      privacyVersion: 1,
      retentionEnabled: true,
      retention: { visitors: 90, packages: 180, incidents: 365, logs: 365, photos: 90 },
    },
    users,
    checkpoints,
    amenities,
    contacts,
    announcements,
    visitors,
    packages,
    incidents,
    vehicles,
    shifts,
    patrols,
    bookings,
    logs,
    notifications: [],
    dataRequests: [],
    settings: { theme: "dark", notify: true, sound: true },
  };
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
