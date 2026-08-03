/** Hash tabanlı yönlendirme. */

/**
 * @typedef {{path:string, load:()=>Promise<any>, roles?:string[]}} Route
 */

/** @type {Route[]} */
export const routes = [
  { path: "/", load: () => import("../views/home.js") },

  { path: "/visitors", load: () => import("../views/visitors.js") },
  { path: "/visitors/new", load: () => import("../views/visitor-new.js") },

  { path: "/patrol", load: () => import("../views/patrol.js"), roles: ["guard", "admin"] },

  { path: "/incidents", load: () => import("../views/incidents.js") },
  { path: "/incidents/new", load: () => import("../views/incident-new.js") },
  { path: "/incidents/:id", load: () => import("../views/incident-detail.js") },

  { path: "/packages", load: () => import("../views/packages.js") },
  { path: "/announcements", load: () => import("../views/announcements.js") },
  { path: "/services", load: () => import("../views/services.js") },
  { path: "/directory", load: () => import("../views/directory.js") },
  { path: "/emergency", load: () => import("../views/emergency.js") },

  { path: "/logbook", load: () => import("../views/logbook.js"), roles: ["guard", "admin"] },
  { path: "/residents", load: () => import("../views/residents.js"), roles: ["guard", "admin"] },
  { path: "/reports", load: () => import("../views/reports.js"), roles: ["admin", "guard"] },

  { path: "/privacy", load: () => import("../views/privacy.js") },
  { path: "/profile", load: () => import("../views/profile.js") },
  { path: "/settings", load: () => import("../views/settings.js") },

  // Yönetim paneli — yalnızca site yönetimi
  { path: "/admin", load: () => import("../views/admin.js"), roles: ["admin"] },
  { path: "/admin/site", load: () => import("../views/admin-site.js"), roles: ["admin"] },
  { path: "/admin/data", load: () => import("../views/admin-data.js"), roles: ["admin"] },
  { path: "/admin/privacy", load: () => import("../views/admin-privacy.js"), roles: ["admin"] },
  { path: "/admin/c/:name", load: () => import("../views/admin-collection.js"), roles: ["admin"] },
];

/** Adres çubuğundaki yolu döndürür. */
export function currentPath() {
  const h = location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

/**
 * Yolu rota tablosuyla eşleştirir.
 * @returns {{route:Route, params:object}|null}
 */
export function match(path) {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  for (const route of routes) {
    const rp = route.path.split("/").filter(Boolean);
    if (rp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rp.length; i++) {
      if (rp[i].startsWith(":")) params[rp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (rp[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  const target = "#" + path;
  if (location.hash === target) return;
  if (replace) location.replace(target);
  else location.hash = target;
}

/** Sorgu dizesini nesneye çevirir (#/visitors?filter=inside). */
export function query(path = currentPath()) {
  const i = path.indexOf("?");
  if (i < 0) return {};
  return Object.fromEntries(new URLSearchParams(path.slice(i + 1)));
}
