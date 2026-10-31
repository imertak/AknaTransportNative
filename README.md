# AKNA Transport

Nakliye operasyonlarını yönetmek için React Native (Expo) mobil uygulaması. Bu aşamada yalnızca frontend geliştirildi. Tüm veriler cihazda saklanan demo verilerle, servis katmanı üzerinden çalışır. Mimari, ileride .NET Web API'ye bağlanacak şekilde kuruldu.

## Çalıştırma

```bash
npm install
npx expo start        # Expo Go veya development build ile açın
npx tsc --noEmit      # tip kontrolü
```

### Demo hesaplar

| Rol | E-posta | Şifre |
|---|---|---|
| Yönetici | admin@akna.com | 123456 |
| Şoför | driver@akna.com | 123456 |

Ek demo şoförler: `murat@akna.com`, `emre@akna.com` (şifre aynı). Demo veriler Profil > "Demo verilerini sıfırla" ile başlangıç durumuna döndürülebilir.

## Teknoloji

- Expo SDK 58, React Native 0.88, React 19, TypeScript (strict)
- Expo Router (dosya tabanlı navigasyon, `Stack.Protected` ile rol koruması)
- Eklenen paketler (hepsi `npx expo install` ile SDK uyumlu sürümde): `lucide-react-native`, `react-native-svg`, `expo-location`, `react-native-maps`, `expo-print`, `expo-sharing`, `expo-file-system`, `@react-native-async-storage/async-storage`, `expo-secure-store`

## Klasör yapısı

```
src/
  app/            Expo Router rotaları (ince dosyalar; ekranları screens/ altından export eder)
    admin/        Yönetici sekmeleri ve detay ekranları
    driver/       Şoför sekmeleri ve iş detayı
  screens/        auth/, admin/, driver/, shared/ ekranları
  components/     ui/ (tasarım sistemi), jobs/, invoices/, map/
  contexts/       AuthContext, LocationContext, ToastContext
  services/       Servis sözleşmeleri (contracts.ts), mock implementasyonlar, registry.ts
  store/          İstemci önbelleği (useSyncExternalStore) ve aksiyonlar
  hooks/          Veri seçicileri ve yardımcı hook'lar
  constants/      İş durumları, araç tipleri, yetkiler, yapılandırma
  navigation/     Rota yardımcıları, sekme ayarları
  types/          Merkezi veri modelleri (User, Customer, TransportJob, Invoice, Vehicle, Location...)
  theme/          Renk, tipografi, boşluk ve köşe değerleri
  data/           Demo başlangıç verisi (Excel iş dökümündeki kayıtlar dahil)
  utils/          TL / tarih biçimlendirme, doğrulama, geo hesapları
```

## Mimari notlar

**Servis katmanı.** Ekranlar mock veriye doğrudan erişmez. `services/contracts.ts` içindeki arayüzler (`AuthService`, `JobService`, `CustomerService`, `InvoiceService`, `LocationRepository`, `EArchiveGateway`, `InvoiceMailer`) hem mock hem gelecekteki API implementasyonlarının sözleşmesidir. API'ye geçişte yalnızca `services/registry.ts` içindeki atamalar değişir; `services/http.ts` Bearer token ve hata eşlemesi olan hazır bir istemci sunar (`EXPO_PUBLIC_API_BASE_URL`).

**Rol yönetimi.** Yetkiler `constants/permissions.ts` içinde merkezi tanımlıdır; ekranlar rol yerine yetki sorgular (`can(user, 'jobs.assign')`). Hangi rota grubunun erişilebilir olduğu `app/_layout.tsx` içinde oturum durumu ve görünüm moduna göre belirlenir. Yönetici, Profil'den şoför görünümüne geçebilir; işi kendine atayabilir veya "İşi üstlen" ile doğrudan alabilir.

**İş akışı.** Bekliyor → Atandı → Kabul Edildi → Yolda → Yükleme Yapılıyor → Teslimat Yapılıyor → Tamamlandı (veya İptal Edildi). Şoför aksiyonları `constants/jobStatus.ts` içindeki `DRIVER_FLOW` ile tanımlıdır ve servis tarafında da doğrulanır.

**Konum takibi.** `services/locationService.ts` cihaz GPS'ine erişen tek noktadır; `contexts/LocationContext.tsx` takibi yönetir:
- Yalnızca kullanıcının Yolda / Yükleme / Teslimat aşamasında bir işi varken çalışır, iş bitince kendiliğinden durur.
- İşletim sistemi seviyesinde 40 m / 15 sn eşikleri ile gereksiz GPS uyanmaları azaltılır.
- `shouldPublish` 30 m'den az hareketi ve 20 sn'den sık güncellemeyi eler; araç duruyorsa 2 dakikada bir canlılık güncellemesi gönderilir.
- "Yola çık" aksiyonunda paylaşım otomatik başlar; şoför istediğinde durdurabilir.
- Bu aşamada uygulama arka plana geçince izleme duraklatılır (ekranda açıkça gösterilir). Arka plan takibi için API aşamasında `expo-task-manager` + `Location.startLocationUpdatesAsync` ve arka plan izinleri eklenecek; konumlar toplu olarak API'ye gönderilip yöneticiye SignalR ile iletilecek.

**Fatura.** Bu aşamada yalnızca demo fatura oluşturulur. Demo faturalar `DEMO-` önekiyle numaralanır, her yerde "resmi fatura değildir" olarak işaretlenir ve e-posta gönderilmez. e-Arşiv ve e-posta için sözleşmeler hazırdır; çağrıldıklarında açıkça "API aşamasında etkinleşecek" hatası verirler.

**PDF iş dökümü.** `services/reportService.ts` A4 yatay, siyah-beyaz, sayfa numaralı ve oluşturulma tarihli HTML üretir; `expo-print` ile PDF'e çevrilip `expo-sharing` ile paylaşılır veya doğrudan yazdırılır. Örnek: 19.10.2026–22.10.2026 aralığı 7 iş ve 36.500 TL toplam verir.

## Bilinen notlar

- `react-native-maps` Expo Go'da çalışır. Android için mağaza/development build alınırken Google Maps API anahtarı gerekir (`app.json` > `android.config.googleMaps.apiKey`).
- Web önizlemesinde harita yerine konum listesi gösterilir; uygulamanın hedefi iOS ve Android'dir.
- Repoda ESLint yapılandırması bulunmuyor; `npx expo lint` ilk çalıştırmada yapılandırmayı otomatik ekler.
