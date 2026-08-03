# Test takımları

Gerçek tarayıcıda (Chromium, 390×844 mobil emülasyon) çalışan uçtan uca testler.
Çerçeve yok — her dosya kendi başına çalışan bir Node betiği; başarısızlıkta
`throw` eder ve çıkış kodu sıfırdan farklı olur.

## Çalıştırmak için

Uygulama bir sunucudan servis edilmeli:

```bash
# 1. terminal — depo kökünde
python3 -m http.server 8099

# 2. terminal
npm install playwright        # bir kez
npx playwright install chromium
node test/test.mjs
```

Tümünü sırayla çalıştırmak için:

```bash
for f in test flows admin kvkk license photo; do
  echo "=== $f ==="; node "test/$f.mjs" || break
done
```

Testler `http://127.0.0.1:8099` adresini bekler; farklı bir portta servis
ediyorsanız dosyaların başındaki `BASE` sabitini değiştirin.

## Dosyalar

| Dosya | Ne doğruluyor |
|---|---|
| `test.mjs` | Üç rolde bütün rotaların hatasız render edilmesi |
| `flows.mjs` | Uçtan uca akışlar: vardiya, devriye, misafir kodu, kargo, **acil çağrı ve karşı sekmede alarm**, rezervasyon, duyuru, tema, nöbet defteri |
| `admin.mjs` | Yönetim paneli: kurulum eksikleri, site/marka kaydı, koşullu alanlar, doğrulama, yapılandırma dışa aktarımında kişisel veri olmaması, demo temizliği, uygulama adı özelleştirmesi |
| `kvkk.mjs` | Rıza kapısı, rol bazlı görünürlük (IDOR), kişisel veri dökümü, silme talebi, saklama süresi temizliği |
| `license.mjs` | Lisans durumları ve **süresi dolmuş lisansla acil çağrının hâlâ çalışması** |
| `photo.mjs` | Fotoğraf seç → sil → yeniden seç regresyonu (`a.png` / `b.png` gerekir) |
| `logo.mjs` | Giriş ekranı ekran görüntüsü alır |

`photo.mjs` iki küçük test görseli bekler; yoksa şununla üretilir:

```bash
python3 - <<'EOF'
import zlib, struct
def png(path, rgb):
    w = h = 8
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    def ch(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(
        b"\x89PNG\r\n\x1a\n"
        + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + ch(b"IDAT", zlib.compress(raw))
        + ch(b"IEND", b"")
    )
png("test/a.png", (220, 40, 40))
png("test/b.png", (40, 90, 220))
EOF
```

Ekran görüntüleri `test/ekran-goruntuleri/` altına yazılır.

## Not

Testler `localStorage`'ı temizleyerek başlar, yani tarayıcıda açık olan demo
verinizi sıfırlarlar. Üzerinde çalıştığınız gerçek bir kurulum varsa önce
yönetim panelinden yedek alın.
