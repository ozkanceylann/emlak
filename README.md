# Aras Emlak Yönetimi

Portföy ve müşteri takibi için mobil uyumlu web uygulaması. İlk ofis Aras Emlak olarak başlar; yapı birden çok ofisi ve danışman hesaplarını destekleyecek şekilde Supabase üzerinde tenant bazlı tasarlanmıştır.

## Çalıştırma

1. Node.js 20.19+ veya 22.12+ kurulu olmalı.
2. `npm install`
3. `.env.example` dosyasını `.env.local` adıyla kopyalayın ve Supabase proje URL'si ile publishable key değerlerini ekleyin.
4. `npm run dev`

`VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` yalnızca tarayıcıda kullanılabilen public bilgiler olmalıdır. `service_role`/secret key'i hiçbir zaman ön yüze veya repoya koymayın.

## Veritabanı

`supabase/migrations/202611260001_initial_schema.sql` ilk kurulum şemasıdır. Supabase CLI ile migration uygulamak için:

```sh
supabase link --project-ref grdbtngkuthdckjtxzai
supabase db push
```

İlk Aras ofis yöneticisi, Auth kaydı açtıktan sonra `supabase.rpc('claim_aras_office')` ile Aras ofisini sahiplenir. Diğer ofisler için `supabase.rpc('create_company', { company_name: 'Ofis adı' })` kullanılır. Danışmanlar `company_members` kaydına sadece ofis yöneticisi tarafından eklenir.

## Güvenlik ve veri modeli

- Ofis verilerinde `company_id`, danışman kayıtlarında `created_by` ile ayrıştırılır.
- Her uygulama tablosunda RLS açıktır. Yönetici kendi ofisindeki tüm kayıtları görür; danışman varsayılan olarak kendi kayıtlarını görür. `can_view_all` ofis yöneticisi tarafından açılabilir.
- İl/ilçe aramaları `provinces` ve `districts` tablolarını kullanır. İlçe referans verisi 973 ilçe içerir.
- Portföy, müşteri, mal sahibi, randevu, görev, favori, paylaşım, görüntüleme ve görüşme notları tabloları hazırdır.
- Paylaşım bağlantıları `property_shares` token'ı ile açılır. Public RPC sadece yayındaki aktif ilan alanlarını döndürür ve görüntülenmeyi kaydeder.
- Abonelik planı alanları ofis üzerinde tanımlıdır. Ödeme sağlayıcısı, otomatik fatura ve bildirim dağıtımı ayrıca entegre edilmelidir.

## Şimdiki uygulama kapsamı

Portföy listeleme, Satılık/Kiralık sekmeleri, arama, ilçe/fiyat filtreleri, portföy oluşturma, Supabase Auth, müşteri ve mal sahibi kaydı, randevu ve görev oluşturma/listeleme başlangıç sürümünde çalışır. Genel Bakış ekranındaki portföy, müşteri, randevu ve görüntüleme sayaçları oturum açıldığında veritabanından alınır.

Düzenleme/silme akışları, portföy fotoğrafı ve evrak yükleme, anlık müşteri eşleştirme arayüzü, telefon bildirimi, WhatsApp gönderimi, PDF ilan sunumu, danışman davet/izin ekranı ve ödeme/abonelik tahsilatı henüz bağlı değildir. Paylaşım bağlantısı için public ilan RPC'si ve görüntüleme kaydı hazırdır; gerçek fotoğraflar ve ofis iletişim bilgisi için Storage ve ofis ayarları ekranı ayrıca eklenmelidir.
