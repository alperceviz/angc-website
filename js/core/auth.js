/**
 * Oturum yönetimi.
 *
 * Oturum bilgisi bilerek sessionStorage'da tutuluyor: aynı tarayıcıda iki
 * sekme açıp birinde görevli, diğerinde sakin olarak giriş yapabiliyorsunuz.
 * Demoyu tek cihazda uçtan uca göstermenin en kolay yolu bu.
 *
 * NOT: PIN doğrulaması burada, istemcide yapılıyor — bu bir demo kurulumudur.
 * Gerçek kullanımda kimlik doğrulama sunucu tarafında yapılmalı (bkz. README).
 */
import * as db from "./db.js";
import * as bus from "./bus.js";

const SKEY = "nobetci.session";

let cache = null;

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SKEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(s) {
  cache = s;
  if (s) sessionStorage.setItem(SKEY, JSON.stringify(s));
  else sessionStorage.removeItem(SKEY);
  bus.emitLocal("auth:change", s);
}

export function session() {
  if (cache === null) cache = readSession();
  return cache;
}

/** @returns {object|null} Giriş yapmış kullanıcı kaydı. */
export function currentUser() {
  const s = session();
  if (!s) return null;
  return db.find("users", s.userId);
}

export function login(userId, pin) {
  const user = db.find("users", userId);
  if (!user) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (String(user.pin) !== String(pin))
    return { ok: false, error: "PIN hatalı." };
  writeSession({ userId, at: db.nowIso() });
  db.log({ kind: "auth", by: user.name, text: `${user.name} uygulamaya giriş yaptı.` });
  return { ok: true, user };
}

export function logout() {
  const u = currentUser();
  if (u && isGuard()) endShift();
  writeSession(null);
}

export const isGuard = () => currentUser()?.role === "guard";
export const isResident = () => currentUser()?.role === "resident";
export const isAdmin = () => currentUser()?.role === "admin";
/** Görevli ve yönetici ekranlarının ortak yetki eşiği. */
export const isStaff = () => ["guard", "admin"].includes(currentUser()?.role);

export function roleLabel(role) {
  return { guard: "Güvenlik Görevlisi", resident: "Site Sakini", admin: "Site Yönetimi" }[role] || "";
}

/* ------------------------------------------------------------------ */
/* Vardiya                                                             */
/* ------------------------------------------------------------------ */

/** Açık (bitmemiş) vardiya kaydı. */
export function activeShift(guardId = currentUser()?.id) {
  if (!guardId) return null;
  return db.list("shifts").find((s) => s.guardId === guardId && !s.endedAt) || null;
}

export function anyActiveShift() {
  return db.list("shifts").find((s) => !s.endedAt) || null;
}

export function startShift() {
  const u = currentUser();
  if (!u) return null;
  if (activeShift()) return activeShift();
  const s = db.insert("shifts", { guardId: u.id, startedAt: db.nowIso(), handover: "" });
  db.log({ kind: "shift", by: u.name, text: `${u.name} vardiyayı devraldı.` });
  return s;
}

export function endShift(handover = "") {
  const u = currentUser();
  const s = activeShift();
  if (!s || !u) return null;
  const done = db.update("shifts", s.id, { endedAt: db.nowIso(), handover });
  db.log({
    kind: "shift",
    by: u.name,
    text: `${u.name} vardiyayı teslim etti.${handover ? " Not: " + handover : ""}`,
  });
  return done;
}
