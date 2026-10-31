# AKNA Transport

Nakliye operasyonlarını yönetmek için React Native (Expo) mobil uygulaması. Uygulama iki modda çalışır:

- **API modu:** `EXPO_PUBLIC_API_BASE_URL` tanımlıysa tüm veriler [AknaTransportApi](https://github.com/imertak/AknaTransportApi) (.NET 9) üzerinden gelir.
- **Demo modu:** Değişken boşsa veriler cihazda saklanan demo verilerdir; API gerekmez.

## Çalıştırma

```bash
npm install
npx expo start        # Expo Go veya development build ile açın
npx tsc --noEmit      # tip kontrolü
```

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

API modunda bilinmesi gerekenler:
- Erişim token'ı süresi dolunca sessizce yenilenir; yenilenemezse giriş ekranına dönülür.
- Faturalar "Taslak" olarak oluşturulur ve tutar işin fiyatından hesaplanır. "e-Arşiv'e gönder" sağlayıcı yapılandırılana kadar hata verir ve fatura taslak kalır.
- Şoför hesapları müşteri ve fatura listelerini görmez (API yetkisi). İş detayında firma adı görünür, müşteri iletişim bilgisi görünmez.
- Araç/plaka kaydı API'de henüz yoktur; plaka alanları boş kalır.

### Demo hesaplar (demo modu)

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

**Servis katmanı.** Ekranlar mock veriye doğrudan erişmez. `services/contracts.ts` içindeki arayüzler (`AuthService`, `JobService`, `CustomerService`, `InvoiceService`, `LocationRepository`, `EArchiveGateway`, `InvoiceMailer`) hem mock hem gelecekteki API implementasyonlarının sözleşmesidir. API implementasyonları `services/api/` altındadır ve `services/registry.ts` moda göre hangisinin kullanılacağını seçer; `services/http.ts` Bearer token ve hata eşlemesi olan hazır bir istemci sunar (`EXPO_PUBLIC_API_BASE_URL`).

**Rol yönetimi.** Yetkiler `constants/permissions.ts` içinde merkezi tanımlıdır; ekranlar rol yerine yetki sorgular (`can(user, 'jobs.assign')`). Hangi rota grubunun erişilebilir olduğu `app/_layout.tsx` içinde oturum durumu ve görünüm moduna göre belirlenir. Yönetici, Profil'den şoför görünümüne geçebilir; işi kendine atayabilir veya "İşi üstlen" ile doğrudan alabilir.

**İş akışı.** Bekliyor → Atandı → Kabul Edildi → Yolda → Yükleme Yapılıyor → Teslimat Yapılıyor → Tamamlandı (veya İptal Edildi). Şoför aksiyonları `constants/jobStatus.ts` içindeki `DRIVER_FLOW` ile tanımlıdır ve servis tarafında da doğrulanır.

**Konum takibi.** `services/locationService.ts` cihaz GPS'ine erişen tek noktadır; `contexts/LocationContext.tsx` takibi yönetir:
- Yalnızca kullanıcının Yolda / Yükleme / Teslimat aşamasında bir işi varken çalışır, iş bitince kendiliğinden durur.
- İşletim sistemi seviyesinde 40 m / 15 sn eşikleri ile gereksiz GPS uyanmaları azaltılır.
- `shouldPublish` 30 m'den az hareketi ve 20 sn'den sık güncellemeyi eler; araç duruyorsa 2 dakikada bir canlılık güncellemesi gönderilir.
- "Yola çık" aksiyonunda paylaşım otomatik başlar; şoför istediğinde durdurabilir.
- Bu aşamada uygulama arka plana geçince izleme duraklatılır (ekranda açıkça gösterilir). Arka plan takibi için API aşamasında `expo-task-manager` + `Location.startLocationUpdatesAsync` ve arka plan izinleri eklenecek; konumlar toplu olarak API'ye gönderilip yöneticiye SignalR ile iletilecek.

**Fatura.** Demo modunda yalnızca demo fatura oluşturulur. Demo faturalar `DEMO-` önekiyle numaralanır, her yerde "resmi fatura değildir" olarak işaretlenir ve e-posta gönderilmez. e-Arşiv ve e-posta için sözleşmeler hazırdır; çağrıldıklarında açıkça "API aşamasında etkinleşecek" hatası verirler.

**PDF iş dökümü.** `services/reportService.ts` A4 yatay, siyah-beyaz, sayfa numaralı ve oluşturulma tarihli HTML üretir; `expo-print` ile PDF'e çevrilip `expo-sharing` ile paylaşılır veya doğrudan yazdırılır. Örnek: 19.10.2026–22.10.2026 aralığı 7 iş ve 36.500 TL toplam verir.

## Bilinen notlar

- `react-native-maps` Expo Go'da çalışır. Android için mağaza/development build alınırken Google Maps API anahtarı gerekir (`app.json` > `android.config.googleMaps.apiKey`).
- Web önizlemesinde harita yerine konum listesi gösterilir; uygulamanın hedefi iOS ve Android'dir.
- Repoda ESLint yapılandırması bulunmuyor; `npx expo lint` ilk çalıştırmada yapılandırmayı otomatik ekler.
