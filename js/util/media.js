/** Fotoğraf küçültme — kayıtlar depoyu şişirmesin diye. */

const MAX_EDGE = 1000;
const QUALITY = 0.62;

/**
 * Seçilen dosyayı ölçekleyip JPEG data URL'e çevirir.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı"));
    };
    img.src = url;
  });
}

/** Konum damgası (devriye taramaları için, isteğe bağlı). */
export function getPosition(timeout = 6000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: +p.coords.latitude.toFixed(5),
          lng: +p.coords.longitude.toFixed(5),
          acc: Math.round(p.coords.accuracy),
        }),
      () => resolve(null),
      { timeout, maximumAge: 30000, enableHighAccuracy: false }
    );
  });
}

/** Metni dosya olarak indirir (nöbet defteri dışa aktarımı). */
export function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
