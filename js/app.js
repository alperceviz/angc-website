/**
 * Uygulama kabuğu: üst çubuk, alt sekmeler, yönlendirme, bildirimler ve
 * acil durum alarmı burada birleşiyor.
 */
import * as db from "./core/db.js";
import * as auth from "./core/auth.js";
import * as bus from "./core/bus.js";
import { currentPath, match, navigate, query } from "./core/router.js";
import { applyBrand, setupGaps, brandName } from "./core/brand.js";
import * as privacy from "./core/privacy.js";
import { el, qs, qsa } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { sheet, confirm } from "./ui/sheet.js";
import * as toast from "./ui/toast.js";
import { esc, timeAgo, initials, unitLabel } from "./util/format.js";

const rootEl = document.getElementById("app");

/* ------------------------------------------------------------------ */
/* Sekmeler ve menü                                                     */
/* ------------------------------------------------------------------ */

const TABS = {
  guard: [
    { path: "/", icon: "home", label: "Ana Sayfa" },
    { path: "/visitors", icon: "users", label: "Ziyaretçi" },
    { path: "/patrol", icon: "route", label: "Devriye" },
    { path: "/incidents", icon: "alert", label: "Olaylar", badge: "openIncidents" },
    { menu: true, icon: "grid", label: "Menü" },
  ],
  resident: [
    { path: "/", icon: "home", label: "Ana Sayfa" },
    { path: "/visitors", icon: "user-plus", label: "Misafirim" },
    { path: "/incidents", icon: "clipboard", label: "Taleplerim" },
    { path: "/services", icon: "waves", label: "Hizmetler" },
    { menu: true, icon: "grid", label: "Menü" },
  ],
  admin: [
    { path: "/", icon: "home", label: "Ana Sayfa" },
    { path: "/incidents", icon: "alert", label: "Olaylar", badge: "openIncidents" },
    { path: "/announcements", icon: "megaphone", label: "Duyurular" },
    { path: "/admin", icon: "settings", label: "Yönetim", badge: "setupGaps" },
    { menu: true, icon: "grid", label: "Menü" },
  ],
};

const MENU = {
  guard: [
    ["/packages", "package", "Kargo & Teslimat"],
    ["/residents", "building", "Sakin ve Daire Rehberi"],
    ["/logbook", "book", "Nöbet Defteri"],
    ["/announcements", "megaphone", "Duyurular"],
    ["/services", "waves", "Sosyal Tesisler"],
    ["/directory", "phone", "Telefon Rehberi"],
    ["/emergency", "siren", "Acil Durum"],
    ["/reports", "chart", "Raporlar"],
    ["/profile", "user", "Profilim"],
    ["/privacy", "lock", "Gizlilik ve Verilerim"],
    ["/settings", "settings", "Ayarlar"],
  ],
  resident: [
    ["/packages", "package", "Kargolarım"],
    ["/announcements", "megaphone", "Duyurular"],
    ["/directory", "phone", "Telefon Rehberi"],
    ["/emergency", "siren", "Acil Durum"],
    ["/profile", "user", "Profilim ve Aracım"],
    ["/privacy", "lock", "Gizlilik ve Verilerim"],
    ["/settings", "settings", "Ayarlar"],
  ],
  admin: [
    ["/admin", "settings", "Yönetim Paneli"],
    ["/privacy", "lock", "Gizlilik ve Verilerim"],
    ["/reports", "chart", "Raporlar"],
    ["/visitors", "users", "Ziyaretçi Kayıtları"],
    ["/packages", "package", "Kargo & Teslimat"],
    ["/patrol", "route", "Devriye Turları"],
    ["/residents", "building", "Sakin ve Daire Rehberi"],
    ["/logbook", "book", "Nöbet Defteri"],
    ["/services", "waves", "Sosyal Tesisler"],
    ["/directory", "phone", "Telefon Rehberi"],
    ["/emergency", "siren", "Acil Durum"],
    ["/profile", "user", "Profilim"],
    ["/settings", "settings", "Ayarlar"],
  ],
};

/** Alt sekmelerde gösterilecek rozet sayıları. */
function badgeCounts() {
  return {
    openIncidents: db.list("incidents", (i) => i.status !== "resolved").length,
    setupGaps: auth.isAdmin() ? setupGaps().length : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Bildirimler                                                          */
/* ------------------------------------------------------------------ */

export function myNotifications() {
  const u = auth.currentUser();
  if (!u) return [];
  return db
    .list("notifications")
    .filter((n) => n.to === "all" || n.to === u.role || n.to === u.id)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

function unreadCount() {
  const u = auth.currentUser();
  if (!u) return 0;
  return myNotifications().filter((n) => !(n.read || []).includes(u.id)).length;
}

/** Rol hedefli bildirim gönderir; diğer sekmelere de anında düşer. */
export function pushNotification(payload) {
  const rec = db.notify(payload);
  bus.emit("notify:new", { id: rec.id });
  return rec;
}

function markAllRead() {
  const u = auth.currentUser();
  if (!u) return;
  myNotifications().forEach((n) => {
    if (!(n.read || []).includes(u.id))
      db.update("notifications", n.id, { read: [...(n.read || []), u.id] });
  });
}

async function openNotifications() {
  const list = myNotifications().slice(0, 40);
  const body = list.length
    ? `<div class="list">${list
        .map(
          (n) => `<div class="item item--static ${n.kind ? "item--" + toneOf(n.kind) : ""}">
        <span class="item__avatar">${icon(iconOf(n.kind))}</span>
        <span class="item__body">
          <span class="item__title">${esc(n.title)}</span>
          <span class="item__sub">${esc(n.body || "")}</span>
        </span>
        <span class="item__side">${esc(timeAgo(n.at))}</span>
      </div>`
        )
        .join("")}</div>`
    : `<div class="empty">${icon("bell", { size: 40 })}<div class="empty__title">Bildirim yok</div>
       <div class="empty__desc">Yeni bir gelişme olduğunda burada görünecek.</div></div>`;
  markAllRead();
  renderChrome();
  await sheet({ title: "Bildirimler", body, actions: [{ label: "Kapat", value: 1 }] });
}

const toneOf = (k) =>
  ({ panic: "danger", incident: "danger", visitor: "info", package: "accent" }[k] || "info");
const iconOf = (k) =>
  ({
    panic: "siren",
    incident: "alert",
    visitor: "users",
    package: "package",
    announcement: "megaphone",
    booking: "calendar",
    patrol: "route",
  }[k] || "info");

/* ------------------------------------------------------------------ */
/* Kabuk                                                                */
/* ------------------------------------------------------------------ */

let chromeUserId = null;

function shellSkeleton() {
  return el(`
    <div class="shell">
      <header class="appbar">
        <div class="appbar__row">
          <button class="iconbtn" data-app="back" aria-label="Geri">${icon("back")}</button>
          <div class="appbar__title" id="appbar-title"></div>
          <button class="iconbtn" data-app="bell" aria-label="Bildirimler">${icon("bell")}</button>
          <button class="iconbtn" data-app="action" aria-label="Ekle" hidden>${icon("plus")}</button>
        </div>
      </header>
      <main id="view" class="view"></main>
      <nav class="tabbar" id="tabbar"></nav>
    </div>`);
}

function renderChrome() {
  const user = auth.currentUser();
  if (!user) return;
  let shell = qs(".shell", rootEl);
  if (!shell || chromeUserId !== user.id) {
    rootEl.innerHTML = "";
    shell = shellSkeleton();
    rootEl.appendChild(shell);
    chromeUserId = user.id;
    wireChrome(shell);
  }

  // Bildirim rozeti
  const bell = qs('[data-app="bell"]', shell);
  qs(".iconbtn__dot", bell)?.remove();
  const n = unreadCount();
  if (n > 0) bell.appendChild(el(`<span class="iconbtn__dot">${n > 9 ? "9+" : n}</span>`));

  // Sekmeler
  const counts = badgeCounts();
  const path = currentPath().split("?")[0];
  const tabs = TABS[user.role] || TABS.resident;
  qs("#tabbar", shell).innerHTML = tabs
    .map((t) => {
      const active = t.path && (t.path === "/" ? path === "/" : path.startsWith(t.path));
      const c = t.badge ? counts[t.badge] : 0;
      return `<button class="tab" type="button" ${
        t.menu ? 'data-app="menu"' : `data-tab="${esc(t.path)}"`
      } ${active ? 'aria-current="page"' : ""}>
        ${icon(t.icon)}<span>${esc(t.label)}</span>
        ${c ? `<span class="tab__badge">${c > 9 ? "9+" : c}</span>` : ""}
      </button>`;
    })
    .join("");
}

function wireChrome(shell) {
  shell.addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) return navigate(tab.dataset.tab);
    const btn = e.target.closest("[data-app]");
    if (!btn) return;
    if (btn.dataset.app === "back") history.back();
    if (btn.dataset.app === "bell") openNotifications();
    if (btn.dataset.app === "menu") openMenu();
  });
}

async function openMenu() {
  const user = auth.currentUser();
  const items = MENU[user.role] || MENU.resident;
  const body = `
    <div class="item item--static" style="margin-bottom:12px">
      <span class="item__avatar">${esc(initials(user.name))}</span>
      <span class="item__body">
        <span class="item__title">${esc(user.name)}</span>
        <span class="item__sub">${esc(auth.roleLabel(user.role))}${
    user.block ? " · " + esc(unitLabel(user.block, user.unit)) : ""
  }</span>
      </span>
    </div>
    <div class="list">
      ${items
        .map(
          ([path, ic, label]) =>
            `<button class="item" type="button" data-go="${esc(path)}">
              <span class="item__avatar">${icon(ic)}</span>
              <span class="item__body"><span class="item__title">${esc(label)}</span></span>
              <span class="item__chev">${icon("chevron")}</span>
            </button>`
        )
        .join("")}
    </div>
    <button class="btn btn--block btn--ghost" type="button" data-go="logout" style="margin-top:14px;color:var(--danger)">
      ${icon("logout")} Oturumu kapat
    </button>`;

  await sheet({
    title: "Menü",
    body,
    onMount(box, close) {
      box.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-go]");
        if (!b) return;
        const to = b.dataset.go;
        close();
        if (to === "logout") {
          if (await confirm({
            title: "Oturumu kapat",
            desc: "Görevliyseniz açık vardiyanız da kapatılır.",
            confirmLabel: "Çıkış yap",
            variant: "danger",
          })) {
            auth.logout();
            navigate("/", { replace: true });
            render();
          }
        } else navigate(to);
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Görünüm yükleme                                                      */
/* ------------------------------------------------------------------ */

let currentModule = null;
let renderToken = 0;

async function renderView() {
  const user = auth.currentUser();
  const path = currentPath();
  const m = match(path.split("?")[0]);
  const host = qs("#view", rootEl);
  if (!host) return;

  if (!m) {
    host.innerHTML = `<div class="empty">${icon("search", { size: 42 })}
      <div class="empty__title">Sayfa bulunamadı</div>
      <div class="empty__desc">${esc(path)}</div></div>`;
    return;
  }
  if (m.route.roles && !m.route.roles.includes(user.role)) {
    host.innerHTML = `<div class="empty">${icon("lock", { size: 42 })}
      <div class="empty__title">Bu bölüm size kapalı</div>
      <div class="empty__desc">Bu ekran yalnızca ${esc(
        m.route.roles.map(auth.roleLabel).join(" / ")
      )} içindir.</div></div>`;
    return;
  }

  const token = ++renderToken;
  const mod = await m.route.load();
  if (token !== renderToken) return; // daha yeni bir gezinme başladı

  currentModule = mod.default || mod;
  const ctx = {
    params: m.params,
    query: query(path),
    user,
    navigate,
    refresh: () => renderView(),
    toast,
    sheet,
    confirm,
    pushNotification,
  };

  const node = await currentModule.render(ctx);
  host.innerHTML = "";
  host.appendChild(node);

  // Üst çubuk
  const title =
    typeof currentModule.title === "function" ? currentModule.title(ctx) : currentModule.title;
  const sub =
    typeof currentModule.subtitle === "function"
      ? currentModule.subtitle(ctx)
      : currentModule.subtitle;
  qs("#appbar-title", rootEl).innerHTML =
    esc(title || brandName()) + (sub ? `<span class="appbar__sub">${esc(sub)}</span>` : "");

  const isRoot = path === "/" || path === "";
  qs('[data-app="back"]', rootEl).hidden = isRoot;

  // Üst çubuk kısayolu (ör. listelerde "+" düğmesi)
  const actionBtn = qs('[data-app="action"]', rootEl);
  const act = typeof currentModule.action === "function" ? currentModule.action(ctx) : currentModule.action;
  if (act) {
    actionBtn.hidden = false;
    actionBtn.innerHTML = icon(act.icon || "plus");
    actionBtn.setAttribute("aria-label", act.label || "Ekle");
    actionBtn.onclick = () => (act.href ? navigate(act.href) : act.onClick?.(ctx));
  } else {
    actionBtn.hidden = true;
    actionBtn.onclick = null;
  }

  window.scrollTo(0, 0);
}

export function render() {
  const user = auth.currentUser();
  if (!user) {
    chromeUserId = null;
    return renderLogin();
  }
  // Aydınlatma metni onaylanmadan uygulamaya geçilmez.
  if (!privacy.hasConsent(user)) {
    chromeUserId = null;
    return renderConsent(user);
  }
  renderChrome();
  renderView();
}

async function renderConsent(user) {
  const mod = await import("./views/consent.js");
  rootEl.innerHTML = "";
  rootEl.appendChild(
    await mod.default.render({
      user,
      done: () => render(),
      cancel: () => {
        auth.logout();
        navigate("/", { replace: true });
        render();
      },
    })
  );
}

async function renderLogin() {
  const mod = await import("./views/login.js");
  rootEl.innerHTML = "";
  rootEl.appendChild(
    await mod.default.render({
      navigate,
      toast,
      sheet,
      confirm,
      done: () => {
        navigate("/", { replace: true });
        render();
      },
    })
  );
}

/* ------------------------------------------------------------------ */
/* Acil durum alarmı                                                    */
/* ------------------------------------------------------------------ */

let alarmNode = null;

function beep() {
  if (!db.raw()?.settings?.sound) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.value = i % 2 ? 660 : 990;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.36);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.36 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.36 + 0.3);
      o.connect(g).connect(ac.destination);
      o.start(t0 + i * 0.36);
      o.stop(t0 + i * 0.36 + 0.32);
    }
    setTimeout(() => ac.close(), 1600);
  } catch {
    /* ses yoksa sorun değil */
  }
}

function systemNotify(title, body) {
  try {
    if (!db.raw()?.settings?.notify) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "assets/icon-192.png", tag: "nobetci" });
  } catch {
    /* yok sayılır */
  }
}

/** Görevli/yönetici ekranında tam ekran alarm. */
function showAlarm(p) {
  if (!auth.isStaff()) return;
  if (alarmNode) alarmNode.remove();
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  beep();
  systemNotify("ACİL ÇAĞRI", `${p.from} — ${p.where}`);
  alarmNode = el(`
    <div class="alarm" role="alertdialog" aria-live="assertive">
      ${icon("siren", { size: 62 })}
      <div class="alarm__title">ACİL ÇAĞRI</div>
      <div class="alarm__meta"><strong>${esc(p.from)}</strong></div>
      <div class="alarm__meta">${esc(p.where)}</div>
      ${p.note ? `<div class="alarm__meta">“${esc(p.note)}”</div>` : ""}
      <button class="btn btn--block" type="button" data-ack style="max-width:320px;margin-top:10px">
        ${icon("check")} Gördüm, müdahale ediyorum
      </button>
      ${
        p.phone
          ? `<a class="btn btn--block btn--ghost" style="max-width:320px;color:#fff;border-color:rgba(255,255,255,.4)"
              href="tel:${esc(p.phone)}">${icon("phone")} ${esc(p.from)} — Ara</a>`
          : ""
      }
    </div>`);
  alarmNode.querySelector("[data-ack]").addEventListener("click", () => {
    const u = auth.currentUser();
    if (p.incidentId) {
      db.update("incidents", p.incidentId, {
        status: "in_progress",
        updates: [
          ...(db.find("incidents", p.incidentId)?.updates || []),
          { at: db.nowIso(), by: u.name, text: "Acil çağrı görevli tarafından alındı." },
        ],
      });
    }
    db.log({ kind: "panic", by: u.name, text: `Acil çağrı alındı: ${p.from} (${p.where})` });
    pushNotification({
      to: p.userId || "all",
      kind: "panic",
      title: "Çağrınız alındı",
      body: `${u.name} çağrınızı gördü ve yönlendiriliyor.`,
    });
    alarmNode.remove();
    alarmNode = null;
    toast.ok("Çağrı alındı olarak işaretlendi.");
  });
  document.body.appendChild(alarmNode);
}

/* ------------------------------------------------------------------ */
/* Açılış                                                               */
/* ------------------------------------------------------------------ */

function applyTheme() {
  const t = db.raw()?.settings?.theme || "dark";
  document.documentElement.setAttribute("data-theme", t);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", t === "light" ? "#f2f1ec" : "#0c0c0b");
  applyBrand();
}

let dbChangeTimer = null;
function onDbChange() {
  applyTheme();
  clearTimeout(dbChangeTimer);
  dbChangeTimer = setTimeout(() => {
    const user = auth.currentUser();
    // Metin güncellendiyse rıza kapısı yeniden devreye girmeli.
    if (!user || !privacy.hasConsent(user)) return render();
    renderChrome();
    if (currentModule?.live !== false) renderView();
  }, 60);
}

async function boot() {
  await db.init();
  applyTheme();

  bus.on("auth:change", () => render());
  bus.on("db:change", onDbChange);
  bus.on("panic", (p) => showAlarm(p));
  bus.on("notify:new", () => {
    renderChrome();
    const n = myNotifications()[0];
    if (n && document.visibilityState !== "visible") systemNotify(n.title, n.body || "");
  });
  // render() üzerinden geçiyoruz: oturum ve açık rıza kontrolleri
  // gezinmede de uygulansın.
  window.addEventListener("hashchange", () => render());
  window.addEventListener("online", () => toast.ok("Bağlantı geri geldi."));
  window.addEventListener("offline", () => toast.toast("Çevrimdışısınız — kayıtlar cihazda tutuluyor."));

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__installPrompt = e;
    bus.emitLocal("install:available");
  });

  // Saklama süresi dolan kayıtları günde bir kez temizle.
  try {
    privacy.purgeIfDue();
  } catch (err) {
    console.warn("[privacy] temizlik çalışmadı", err);
  }

  render();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch (err) {
      console.warn("[sw] kayıt başarısız", err);
    }
  }
}

boot();

export { navigate, toast, sheet, confirm };
