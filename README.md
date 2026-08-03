# Güvendeyim — Site Güvenlik ve Yaşam Uygulaması

Sitelerdeki (konut kompleksleri) güvenlik kulübesi ile site sakinlerini **tek bir
mobil uygulamada** buluşturan, kurulum gerektirmeyen bir PWA.

Görevli tarafında nöbet, devriye, ziyaretçi, kargo ve olay kaydı; sakin tarafında
misafir bildirimi, talep açma, kargo takibi, tesis rezervasyonu ve acil çağrı var.
İkisi aynı veriyi paylaştığı için kapıda "bir dakika, arayıp soralım" adımı ortadan
kalkıyor.

İlk kurulum **Dünya Şehir Kartal** içindir. Uygulama tek bir siteye gömülü değil:
site adı, adresi, blokları, telefonları, devriye noktaları, tesisleri, rehberi ve
marka rengi yönetim panelinden düzenlenir; başka bir siteye kurmak için tek
yapılacak şey yapılandırmayı dışa aktarıp yeni cihazda içe aktarmaktır.

> **Önerilen depo adı:** `guvendeyim`
> (GitHub → Settings → Repository name üzerinden değiştirebilirsiniz.)

---

## Sadece çalışanlar için mi olmalı, sakinler de yüklemeli mi?

Kısa cevap: **tek uygulama, iki rol.** Sakinler de yüklemeli.

Nedeni şu: bu işin değerinin büyük kısmı iki tarafın *aynı kaydı* paylaşmasından
çıkıyor. Sakin misafirini önceden bildirdiğinde güvenlik kimseyi aramıyor; güvenlik
kargoyu teslim aldığında sakin anında biliyor; sakin arıza bildirdiğinde kayıt zaten
nöbet defterine düşüyor. İki ayrı uygulama yazmak bu paylaşımı bir entegrasyon
problemine dönüştürürdü — ve aynı ekranların çoğunu iki kez yazmak gerekirdi.

Yalnızca çalışan uygulaması yapılırsa elinizde dijitalleştirilmiş bir nöbet defteri
kalır; faydalı ama sakinin hayatında hiçbir şey değişmez. Asıl fark, kapıdaki
sürtünmenin kaybolmasında.

Buna karşılık **görünürlük rol bazında ayrılmalı** — bu uygulamada ayrıldı:

| | Görevli | Sakin | Yönetim |
|---|---|---|---|
| Ziyaretçi kayıtları | Tümü | Yalnızca kendi misafirleri | Tümü |
| Sakin/daire rehberi | Var (uyarı bandıyla) | Yok | Var |
| Olay kayıtları | Tümü | Kendi talepleri + site geneli açık arızalar (isimsiz) | Tümü |
| Devriye ve nöbet defteri | Var | Yok | Var |
| Duyuru yayınlama | Var | Yok | Var |
| Acil çağrı | Destek çağırır | Görevliye alarm gönderir | Bildirim alır |

Sakinin gürültü şikâyeti site geneline düşmez, daire rehberi sakine açılmaz,
görevlinin rehber ekranı da "bu bilgiler görev gereği kullanılır" uyarısıyla gelir.

---

## Ekranlar

**Güvenlik görevlisi**

- **Vardiya** — devral / devret, süre takibi, sonraki görevliye devir notu
- **Devriye** — 8 kontrol noktası, noktadaki koda göre doğrulama, isteğe bağlı GPS
  damgası, eksik nokta uyarısı, tur geçmişi
- **Ziyaretçi** — giriş/çıkış kaydı, plaka, 6 haneli misafir kodu doğrulama, daire
  ve ev sahibi otomatik eşleşmesi
- **Kargo** — teslim alma, teslim kodu, 24 saati geçen kargo uyarısı, teslim etme
- **Olay** — kategori, aciliyet, fotoğraflı kayıt, durum yönetimi, işlem geçmişi
- **Nöbet defteri** — tüm hareketlerin kronolojik dökümü, `.txt` dışa aktarım
- **Sakin rehberi** — isim, daire veya plakadan hızlı arama

**Site sakini**

- **Misafir bildir** — kapı kodu üretir, paylaş düğmesiyle iletir
- **Talep / arıza aç** — fotoğraflı, durumu bildirimle takip edilir
- **Kargolarım** — kulübede bekleyen kargolar ve teslim kodu
- **Hizmetler** — havuz, fitness, tenis kortu, etkinlik salonu rezervasyonu
- **Acil çağrı** — 1,5 saniye basılı tutunca görevlilerde tam ekran sesli alarm
- **Duyurular, telefon rehberi, araç kaydı**

**Site yönetimi**

- Duyuru yayınlama (sabitleme dahil), olay takibi, sakin ve daire kayıtları
- **Raporlar** — 7 günlük hareket grafiği, devriye uyum oranı, olay türü dağılımı,
  ortalama çözüm süresi
- **Yönetim paneli** — aşağıya bakın

---

## Yönetim paneli ve yerel özelleştirme

Yönetici rolüyle girildiğinde alt sekmelerde **Yönetim** görünür. Panel, kurulumun
eksik kalan maddelerini (girilmemiş telefon, tanımsız blok, duruyor olan demo
kayıtları…) sayar ve doğrudan ilgili ekrana götürür.

| Bölüm | Ne düzenlenir |
|---|---|
| **Site bilgileri** | Ad, kısa ad, adres, güvenlik ve yönetim telefonu, acil toplanma alanı, blok listesi |
| **Marka** | Uygulama adı (beyaz etiket) ve vurgu rengi — canlı önizlemeli |
| **Kullanıcılar** | Görevli / sakin / yönetici hesapları, blok-daire, sicil, PIN sıfırlama |
| **Devriye noktaları** | Kontrol noktaları, bölge ve 4 haneli nokta kodları, tur sırası |
| **Sosyal tesisler** | Rezervasyona açık alanlar, çalışma saatleri, kapasite, dilim süresi |
| **Telefon rehberi** | Site, acil ve arıza numaraları |
| **Veri ve kurulum** | Yapılandırmayı dışa/içe aktarma, demo kayıtlarını temizleme, yedek |

Vurgu rengi değiştiğinde düğmeler, sekmeler ve tüm vurgular anında yeni renge
geçer. Açık temada parlak renkler yazı olarak okunmaz hâle geleceği için renk
otomatik koyulaştırılır; koyu temada seçilen renk aynen kullanılır.

### Başka bir siteye kurmak

1. Yönetim paneli → **Veri ve kurulum → Yapılandırmayı dışa aktar**.
   Dosyaya yalnızca site ayarları, devriye noktaları, tesisler ve rehber girer —
   **kullanıcılar ve tüm kişisel kayıtlar dışarıda kalır**.
2. Yeni kurulumda aynı ekrandan dosyayı yükleyin.
3. Kullanıcıları tanımlayın, ardından **Demo hareketlerini temizle** ile
   ziyaretçi/kargo/olay/defter kayıtlarını sıfırlayın. Site yapılandırması korunur.

---

## Denemek için

Statik dosyalar; derleme adımı yok.

```bash
python3 -m http.server 8099
# http://127.0.0.1:8099
```

**Demo hesapları:** giriş ekranında rol → kişi seçilir, **PIN her hesap için `1234`**.

> **İki rolü aynı anda görmek için:** aynı tarayıcıda ikinci bir sekme açın ve
> orada farklı bir rolle giriş yapın. Oturum sekmeye özel (`sessionStorage`),
> veri ortak (`localStorage`) tutulduğu için sakin tarafında yapılan bildirim
> görevli sekmesinde anında görünür — acil çağrıda alarm ekranı da dahil.

**Telefona kurmak için:** Ayarlar → "Ana ekrana ekle". iOS'ta Safari → Paylaş →
Ana Ekrana Ekle; Android'de Chrome menüsü → Uygulamayı yükle.

---

## Teknik yapı

Bağımlılık yok, paket yöneticisi yok, derleme yok — sade ES modülleri.

```
index.html              uygulama kabuğu
manifest.webmanifest    PWA tanımı (kısayollar dahil)
sw.js                   service worker — çevrimdışı önbellek
css/app.css             tasarım sistemi (koyu + açık tema, tek elle kullanım)
js/
  app.js                kabuk: üst çubuk, sekmeler, bildirimler, alarm
  core/
    db.js               koleksiyon API'li yerel veri katmanı
    seed.js             demo verisi
    auth.js             oturum, roller, vardiya
    router.js           hash yönlendirme + rol bazlı erişim
    bus.js              olay veri yolu + sekmeler arası köprü
    brand.js            marka adı/rengi, tema uyumu, kurulum eksikleri
  ui/                   dom, ikonlar, bileşenler, sheet, toast
  util/                 biçimlendirme, fotoğraf sıkıştırma, indirme
  views/                22 ekran (4'ü yönetim paneli)
```

Öne çıkan birkaç karar:

- **Çevrimdışı öncelikli.** Kulübede ve otoparkta bağlantı kopar; tüm modüller
  kurulumda önbelleğe alınır, veri cihazda tutulur.
- **Fotoğraflar sıkıştırılır.** `capture="environment"` ile doğrudan kamera açılır,
  görsel 1000 px kenara ölçeklenip JPEG'e çevrilir.
- **Büyük dokunma hedefleri.** Tüm birincil düğmeler en az 48 px; eldivenli ve
  karanlıkta kullanım varsayılmıştır.
- **Erişilebilirlik.** `aria-pressed` / `role="switch"` / `aria-current`, klavye
  ile panik butonu, `prefers-reduced-motion` desteği.
- **Tek şema, dört ekran.** Kullanıcı, devriye noktası, tesis ve rehber
  düzenleyicileri aynı şema güdümlü bileşeni paylaşır
  (`js/views/admin-collection.js`); yeni bir koleksiyon eklemek bir şema tanımı
  yazmaktan ibarettir.

### Gerçek kuruluma geçiş

Bu sürüm **tek cihazda çalışan bir tanıtım kurulumudur**: veriler yalnızca o
tarayıcıda tutulur ve PIN doğrulaması istemcide yapılır. Gerçek bir sitede
kullanılacaksa üç şey gerekir:

1. **Sunucu.** `js/core/db.js` içindeki `list / find / insert / update / remove`
   fonksiyonlarının gövdesi bir API çağrısıyla değiştirilir. View'lar depolamayı
   hiç bilmediği için başka hiçbir dosyaya dokunmak gerekmez.
2. **Gerçek kimlik doğrulama.** PIN kontrolü sunucuya taşınır (`js/core/auth.js`),
   oturum belirteçle yürütülür.
3. **Gerçek anlık iletim.** `js/core/bus.js` içindeki `BroadcastChannel` köprüsünün
   yerine WebSocket veya Web Push konur; acil çağrı böylece uygulama kapalıyken de
   görevlinin telefonunu çaldırır.

Yol haritasında ayrıca: kontrol noktalarında QR/NFC etiketi okuma, tek panelden
çoklu site yönetimi, aidat/ödeme, kamera görüntüsü entegrasyonu ve KVKK aydınlatma
metni akışı var.

---

## Not: alan adı

Bu depo daha önce farklı bir projeyi barındırıyordu ve kökteki `CNAME` dosyası hâlâ
eski alan adına işaret ediyor. Birleştirme yapılırsa o adres bu uygulamayı sunmaya
başlar. Yeni bir alan adı kullanacaksanız `CNAME` içeriğini değiştirin; alan adı
istemiyorsanız dosyayı silin (site `kullanıcıadı.github.io/depo-adı` üzerinden
yayınlanır).
