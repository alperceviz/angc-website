/**
 * Service worker — uygulamayı çevrimdışı çalışır kılar.
 *
 * Kulübede ve otoparkta bağlantı sık kopar; kabuk ve tüm modüller kurulumda
 * önbelleğe alınır, çalışma verisi zaten cihazda tutulur.
 */
const VERSION = "siteapp-v1.0.0";

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/apple-touch-icon.png",
  "assets/favicon.png",
  "js/app.js",
  "js/core/bus.js",
  "js/core/db.js",
  "js/core/seed.js",
  "js/core/auth.js",
  "js/core/router.js",
  "js/core/brand.js",
  "js/core/privacy.js",
  "js/ui/dom.js",
  "js/ui/icons.js",
  "js/ui/toast.js",
  "js/ui/sheet.js",
  "js/ui/components.js",
  "js/util/format.js",
  "js/util/media.js",
  "js/views/login.js",
  "js/views/home.js",
  "js/views/visitors.js",
  "js/views/visitor-new.js",
  "js/views/patrol.js",
  "js/views/incidents.js",
  "js/views/incident-new.js",
  "js/views/incident-detail.js",
  "js/views/packages.js",
  "js/views/announcements.js",
  "js/views/services.js",
  "js/views/directory.js",
  "js/views/emergency.js",
  "js/views/logbook.js",
  "js/views/residents.js",
  "js/views/reports.js",
  "js/views/profile.js",
  "js/views/settings.js",
  "js/views/admin.js",
  "js/views/admin-site.js",
  "js/views/admin-collection.js",
  "js/views/admin-data.js",
  "js/views/admin-privacy.js",
  "js/views/privacy.js",
  "js/views/consent.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Tek bir dosya düşerse kurulum tamamen başarısız olmasın.
      .then((cache) =>
        Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Gezinme istekleri her zaman kabuğa düşer (hash yönlendirme).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Diğer varlıklar: önce önbellek, arkada tazele.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
