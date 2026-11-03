# AKNA Transport

Nakliye operasyonlarını yönetmek için React Native (Expo) mobil uygulaması. Tüm veriler [AknaTransportApi](https://github.com/imertak/AknaTransportApi) (.NET 9) üzerinden gelir; uygulamada demo veya örnek veri yoktur. `EXPO_PUBLIC_API_BASE_URL` tanımlı değilse giriş ekranı bunu açıkça söyler.

## Çalıştırma

```bash
npm install
npx expo start        # development build ile açın (MapLibre yerel modül içerir, Expo Go'da harita çalışmaz)
npx tsc --noEmit      # tip kontrolü
npm run lint          # ESLint (eslint-config-expo)
```

### Ortam değişkenleri

| Değişken | Ne için | Zorunlu mu |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | API adresi, örn. `http://192.168.1.34:5080`. Telefonda `localhost` telefonun kendisidir; bilgisayarın veya sunucunun IP'sini yazın. | Evet |
| `EXPO_PUBLIC_MAP_TILES_URL` | Vektör karo TileJSON adresi (OpenMapTiles şeması). Varsayılan: OpenFreeMap (`https://tiles.openfreemap.org/planet`, anahtarsız, ücretsiz). | Hayır |
| `EXPO_PUBLIC_MAP_GLYPHS_URL` | Harita yazı glifleri (`{fontstack}/{range}`). Varsayılan: OpenFreeMap. | Hayır |
| `EXPO_PUBLIC_ROUTING_URL` | OSRM uyumlu rota servisi. Varsayılan genel OSRM demo sunucusu (düşük hacim); üretimde kendi OSRM'iniz önerilir. `off` verilirse duraklar düz kesikli çizgiyle birleştirilir. | Hayır |
| `EXPO_PUBLIC_MAP_STALE_AFTER_MS` | Bu süreden eski konum haritada "güncel değil" olarak gösterilir (varsayılan 300000 = 5 dk). | Hayır |
| `EXPO_PUBLIC_TRACKING_DISTANCE_M`, `EXPO_PUBLIC_TRACKING_INTERVAL_MS`, `EXPO_PUBLIC_TRACKING_PUBLISH_MS` | Şoför konum takibi: minimum hareket (30 m), minimum aralık (15 sn), toplu gönderim aralığı (30 sn). | Hayır |
| `EAS_PROJECT_ID` | expo.dev'deki proje kimliği. Expo push token'ı almak için gerekir (`eas init` app.json'a yazdıysa gerekmez). | Telefon bildirimi için evet |
| `GOOGLE_SERVICES_JSON` | Android push (FCM) için `google-services.json` dosyasının yolu. EAS'te "file" tipinde ortam değişkeni olarak verilebilir. FCM anahtarı Expo panelinde (Credentials) tanımlanmalıdır. | Android bildirimi için evet |

Değerleri `.env.local` dosyasına veya EAS ortam değişkenlerine koyun. Harita için API anahtarı gerekmez (Google Maps kullanılmıyor). Web önizlemede harita ve adres arama yoktur.

### API'ye bağlı çalıştırma (yerel)

1. API'yi başlatın (AknaTransportApi README > Hızlı başlangıç). Telefon veya emülatörden erişilecekse tüm arayüzlerde dinletin:
   `dotnet run --project src/AknaTransport.Api --urls http://0.0.0.0:5080`
2. Bu repoda `.env.local` dosyası oluşturun (git'e eklenmez):

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://localhost:5080
   ```

   | Nerede çalışıyor | Adres |
   |---|---|
   | Web (`npx expo start --web`), iOS simülatörü | `http://localhost:5080` |
   | Android emülatörü | `http://10.0.2.2:5080` |
   | Gerçek cihaz (Expo Go) | `http://<bilgisayarın yerel IP'si>:5080` |

3. `npx expo start` (değişkeni değiştirdikten sonra `npx expo start -c` ile önbelleği temizleyin).

Giriş bilgileri API'nin hesaplarıdır: ilk yönetici API'deki `Seed:AdminEmail` / `Seed:AdminPassword` ile oluşur. Yöneticinin eklediği kullanıcılar geçici şifreyle ilk girişte yeni şifre belirleme ekranına yönlendirilir.

bilinmesi gerekenler:
- Erişim token'ı süresi dolunca sessizce yenilenir; yenilenemezse giriş ekranına dönülür.
- Faturalar "Taslak" olarak oluşturulur ve tutar işin fiyatından hesaplanır. Fatura formunda KDV tevkifatı (ör. 624 Yük taşımacılığı 2/10) ve IBAN seçilir; önizlemede ödenecek tutar ve "YALNIZ: ..." satırı görünür.
- "e-Arşiv'e gönder" API'de sağlayıcı yapılandırılmamışsa hata verir ve fatura taslak kalır. API GİB e-Arşiv portalına bağlıysa (`EArchive__Provider=GibPortal`) fatura portalda taslak olur; detay ekranında "SMS ile imzala ve kes" ile portalda kayıtlı telefona gelen kod girilir. Fatura yalnızca GİB imzayı onaylarsa kesilmiş olur. İmzalanmamış taslak "Portal taslağını sil" ile geri alınabilir.
- Şoför hesapları müşteri ve fatura listelerini görmez (API yetkisi). İş detayında firma adı görünür, müşteri iletişim bilgisi görünmez.
- Araçları yalnızca yönetici ekler, düzenler ve şoföre atar (Panel > Araçlar). İş atarken önce şoför, sonra o şoförün aracı seçilir.
- Şoförleri yönetici ekler (Panel > Şoförler). Şoför eklerken boştaki araçlar seçilebilir veya yeni araç açılabilir; kaydedince şoföre atanır. Geçici şifre SMS ile gider; SMS sağlayıcısı yoksa yalnızca bir kez ekranda gösterilir. Şoför düzenleme ekranında pasife alma ve şifre sıfırlama vardır.

### İlk giriş

Hazır hesap yoktur. İlk yönetici, API ilk açıldığında `Seed:AdminEmail` ve `Seed:AdminPassword` ile oluşturulur (AknaTransportApi README). Şoförleri yönetici uygulamadan ekler.

## Teknoloji

- Expo SDK 58, React Native 0.88, React 19, TypeScript (strict)
- Expo Router (dosya tabanlı navigasyon, `Stack.Protected` ile rol koruması)
- Eklenen paketler (hepsi `npx expo install` ile SDK uyumlu sürümde): `lucide-react-native`, `react-native-svg`, `expo-location`, `react-native-maps`, `expo-task-manager`, `expo-print`, `expo-sharing`, `expo-file-system`, `@react-native-async-storage/async-storage`, `expo-secure-store`

## Klasör yapısı

```
src/
  app/            Expo Router rotaları (ince dosyalar; ekranları screens/ altından export eder)
    admin/        Yönetici sekmeleri ve detay ekranları
    driver/       Şoför sekmeleri ve iş detayı
  screens/        auth/, admin/, driver/, shared/ ekranları
  components/     ui/ (tasarım sistemi), jobs/, invoices/, map/
  contexts/       AuthContext, LocationContext, ToastContext
  services/       Servis sözleşmeleri (contracts.ts), API implementasyonları (api/), registry.ts
  store/          İstemci önbelleği (useSyncExternalStore) ve aksiyonlar
  hooks/          Veri seçicileri ve yardımcı hook'lar
  constants/      İş durumları, araç tipleri, yetkiler, yapılandırma
  navigation/     Rota yardımcıları, sekme ayarları
  types/          Merkezi veri modelleri (User, Customer, TransportJob, Invoice, Vehicle, Location...)
  theme/          Renk, tipografi, boşluk ve köşe değerleri
  utils/          TL / tarih biçimlendirme, doğrulama, geo hesapları
```

## Mimari notlar

**Servis katmanı.** Ekranlar yalnızca `services/contracts.ts` içindeki arayüzleri (`AuthService`, `UserService`, `JobService`, `CustomerService`, `InvoiceService`, `LocationRepository`, `EArchiveGateway`, `InvoiceMailer`) bilir. Implementasyonlar `services/api/` altındadır ve `services/registry.ts` üzerinden verilir; `services/http.ts` Bearer token ve hata eşlemesi olan hazır bir istemci sunar (`EXPO_PUBLIC_API_BASE_URL`).

**Rol yönetimi.** Yetkiler `constants/permissions.ts` içinde merkezi tanımlıdır; ekranlar rol yerine yetki sorgular (`can(user, 'jobs.assign')`). Hangi rota grubunun erişilebilir olduğu `app/_layout.tsx` içinde oturum durumu ve görünüm moduna göre belirlenir. Yönetici, Profil'den şoför görünümüne geçebilir; işi kendine atayabilir veya "İşi üstlen" ile doğrudan alabilir.

**İş akışı.** Bekliyor → Atandı → Kabul Edildi → Yolda → Yükleme Yapılıyor → Teslimat Yapılıyor → Tamamlandı (veya İptal Edildi). Şoför aksiyonları `constants/jobStatus.ts` içindeki `DRIVER_FLOW` ile tanımlıdır ve servis tarafında da doğrulanır.

**Konum takibi (zorunlu).** `services/tracking/` cihaz GPS'ine erişen tek noktadır; `contexts/LocationContext.tsx` durumu yönetir:
- Şoför "İşi kabul et" dediğinde önce konum servisi, ön plan ve arka plan izni kontrol edilir; izin yoksa iş kabul edilmez. Kabulden sonra takip hemen başlar.
- Native'de `expo-task-manager` + `Location.startLocationUpdatesAsync` ile gerçek arka plan takibi yapılır (Android'de kalıcı bildirimli ön plan servisi, iOS'ta "Her Zaman" izni ve mavi gösterge). Görev `_layout.tsx` en başta import edildiği için uygulama arka planda başlatıldığında da tanımlıdır.
- Noktalar önce cihazdaki kuyruğa (AsyncStorage, en fazla 1000 nokta) yazılır, 100'lük gruplarla `POST /api/locations/me` ile gönderilir. Ağ yoksa kuyrukta bekler, bağlantı gelince gönderilir.
- İş tamamlanınca veya iptal edilince (ya da sunucu aktif iş olmadığını bildirince) takip durur ve kuyruk temizlenir.
- 30 m / 15 sn eşikleri ve toplu teslim ile pil ve veri kullanımı azaltılır.
- Web önizlemede yalnızca sayfa açıkken çalışır ve kartta bu açıkça yazar.

**Gerçek cihazda test.** Arka plan konumu Expo Go'da çalışmaz; Expo Go'da iş kabul edilmeye çalışılınca uygulama bunu açıkça söyler. Development build gerekir (`npx expo run:android` / `npx expo run:ios` veya EAS development build). Android'de konum iznini "Her zaman izin ver", iOS'ta "Her Zaman" olarak verin. Android'de takip sırasında "AKNA Transport · iş takibi açık" bildirimi görünür.

**Fatura.** Fatura önce taslak oluşturulur ve her yerde "resmi fatura değildir" olarak işaretlenir. e-Arşiv sağlayıcısından başarılı sonuç gelmeden kesilmiş sayılmaz.

**PDF iş dökümü.** `services/reportService.ts` A4 yatay, siyah-beyaz, sayfa numaralı ve oluşturulma tarihli HTML üretir; `expo-print` ile PDF'e çevrilip `expo-sharing` ile paylaşılır veya doğrudan yazdırılır. Örnek: 19.10.2026–22.10.2026 aralığı 7 iş ve 36.500 TL toplam verir.

## Bildirimler

- Girişten sonra uygulama bildirim izni ister, Expo push token'ını alır ve `POST /api/notifications/devices` ile sunucuya kaydeder. Çıkışta kayıt silinir.
- Şoför: iş atandı, iş sizden alındı, iş bilgileri güncellendi, iş iptal edildi. Yönetici: şoför işi kabul etti, yola çıktı, yüklemeye başladı, teslimata çıktı, tamamladı.
- Bildirime dokununca ilgili işin detayı açılır. Ana ekrandaki zil okunmamış sayısını gösterir ve bildirim listesini açar.
- Telefon bildirimleri Expo Go'da çalışmaz (Android); development veya production build gerekir. İzin verilmezse uygulama içi liste yine çalışır.

## Canlı konum paylaşımı

Yönetici iş detayındaki **Canlı konumu paylaş** butonuyla müşteriye takip bağlantısı gönderir (WhatsApp, SMS vb.). Bağlantı API'nin `/takip/#<token>` sayfasını açar; araç konumu haritada 15 saniyede bir güncellenir. Bağlantı sunucunun adresiyle üretildiği için müşterinin erişebildiği bir adres (alan adı) kullanılmalıdır; yerel ağ IP'si yalnızca aynı ağda çalışır. Farklı bir adres için API'de `App__TrackingUrl` verilebilir.

## Harita ve canlı araç takibi

**Altyapı.** Harita `@maplibre/maplibre-react-native` (MapLibre Native) ile çizilir, veri OpenStreetMap'tir. Varsayılan karo sağlayıcısı OpenFreeMap'tir (anahtarsız). Karo sağlayıcısı veya rota servisi değişse de tema aynı kalır.

**Tema.** Harita görünümü tek yerden yönetilir: `src/theme/map/tokens.ts` (renk ve yazı belirteçleri) ve `src/theme/map/buildMapStyle.ts` (bu belirteçlerden MapLibre Style JSON üretir). Yeni tema için yeni bir `MapThemeTokens` nesnesi yazıp `src/theme/map/index.ts` içindeki `activeMapTheme`'i değiştirmek yeterlidir. AKNA teması: açık gri zemin, beyaz/gri yollar (otoyol > ana yol > tali > ara sokak), yakın zoom'da çok açık gri binalar, siyah yazılar, POI simgesi yok, kırmızı yalnızca seçim ve uyarıda.

**Bileşenler** (`src/components/map`): `MapCanvas` (harita + kamera; araçlar, sıralı duraklar, rota), `VehicleMarker` (yöne göre dönen ok, plaka etiketi, eski konumda gri + kırmızı nokta, yeni konuma yumuşak kayma), `StopMarker` (yükleme: siyah daire, teslimat: beyaz kare, güzergâh sıra numarası), `RouteLayer` (OSRM yol geometrisi; yoksa kesikli düz çizgi). Kamera konum güncellemelerinde oynamaz; yalnızca seçim değişince sığdırır veya canlı takipte aracı ortalar. Harita kuzey yukarı sabittir.

**Filo ekranı** (yönetici › Harita): tüm aktif araçlar; araca dokununca plaka, şoför (arama), iş, son konum zamanı, hız ve durum kartı açılır ve canlı takip başlar (harita aracı izler, elle kaydırınca takip bırakılır). "Tüm filo" ile genel görünüme dönülür. Seçili aracın işinin durakları sıralı ve rotasıyla gösterilir. `/admin/map?jobId=<id>` ile belirli bir işin aracı seçili açılır.

**Gerçek zamanlı akış.**
1. Şoför cihazı GPS konumunu alır (arka plan görevi, Android'de kalıcı bildirimli servis, iOS'ta "Her Zaman" izni).
2. Konumlar AsyncStorage kuyruğuna yazılır ve `POST /api/locations/me` ile sırayla gönderilir; ağ yoksa kuyrukta bekler (en fazla ~1000 nokta), bağlantı gelince eskiden yeniye gönderilir. Sunucu son konumdan eski noktayı son konum yapmaz.
3. API konumu doğrular (işe atanmış kişi, aktif iş, doğruluk/zaman sınırları) ve SignalR `/hubs/tracking` üzerinden yalnızca yöneticilere ve yetkili izleyicilere `locationUpdated` yayınlar.
4. Uygulama ön plandayken `RealtimeProvider` hub'a JWT ile bağlanır, gelen konumu depoda yalnızca ilgili iş için günceller; işaretçi yeni noktaya kayar. Kopunca artan aralıklarla yeniden bağlanır ve kaçan konumları tek REST isteğiyle tamamlar. Arka planda bağlantı kapatılır (pil).
5. İş durumu, ataması değiştiğinde, iş iptal edildiğinde veya silindiğinde sunucu `jobChanged` gönderir; uygulama işi yeniden okur. Şoförün aktif işi kalmazsa konum takibi durur.

## Bilinen notlar

- Harita MapLibre yerel modülü kullanır: Expo Go'da çalışmaz; `npx expo run:android|ios` veya EAS development/preview build gerekir. `react-native-maps` kaldırıldığı için mevcut kurulumlar yeniden derlenmelidir.
- Web önizlemesinde harita yerine konum listesi gösterilir; uygulamanın hedefi iOS ve Android'dir.
- Adres geçmişi müşterinin önceki işlerinden gelir; "Geçmiş adresler" ile seçilir.
- Fatura ve iş dökümü PDF'leri sunucudan indirilir; tarih aralığı dökümü cihazda üretilir.
