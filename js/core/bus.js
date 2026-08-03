/**
 * Basit olay veri yolu + sekmeler arası köprü.
 *
 * Aynı cihazda iki sekme açıp birinde "Görevli", diğerinde "Sakin" olarak
 * giriş yapıldığında olayların canlı aktığı yer burası. Gerçek çok cihazlı
 * senkron için bu köprünün yerine bir WebSocket/push kanalı takılır
 * (bkz. README > Sunucuya bağlama).
 */

const handlers = new Map();

/** Sekmeler arası kanal (destekleyen tarayıcılarda). */
let channel = null;
try {
  if ("BroadcastChannel" in globalThis) {
    channel = new BroadcastChannel("guvendeyim");
    channel.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type) dispatch(type, payload, false);
    };
  }
} catch {
  channel = null;
}

function dispatch(type, payload, alsoRemote) {
  const set = handlers.get(type);
  if (set) for (const fn of [...set]) fn(payload);
  const anySet = handlers.get("*");
  if (anySet) for (const fn of [...anySet]) fn({ type, payload });
  if (alsoRemote && channel) {
    try {
      channel.postMessage({ type, payload });
    } catch {
      /* payload klonlanamadıysa sessizce geç */
    }
  }
}

/** Olayı dinle. Geriye aboneliği iptal eden fonksiyon döner. */
export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  handlers.get(type)?.delete(fn);
}

/** Olayı bu sekmede ve diğer sekmelerde tetikle. */
export function emit(type, payload) {
  dispatch(type, payload, true);
}

/** Sadece bu sekmede tetikle (sekmeye özel UI olayları için). */
export function emitLocal(type, payload) {
  dispatch(type, payload, false);
}
