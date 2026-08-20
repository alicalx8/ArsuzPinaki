# prd.md

## Oyun Adı
İskambil İhale Oyunu

## Amaç
Dört oyunculu, ihale ve pota mekanizmasına sahip bir iskambil oyunu. Oyuncular sırayla teklif vererek veya pas geçerek ihaleye katılır, en yüksek teklifi veren oyuncu koz seçer ve oyun başlar. Oyun sonunda puanlar hesaplanır ve kazanan belirlenir.

## Hedef Kitle
- İskambil oyunu sevenler
- 4 kişilik masa oyunları arayanlar
- Web üzerinden oynanabilen kart oyunları kullanıcıları

## Temel Özellikler

### 1. Oyun Akışı
- 48 kartlık deste (her karttan iki tane)
- 4 oyuncuya 12’şer kart dağıtılır
- İhale süreci başlar: Oyuncular sırayla teklif verir veya pas geçer
- En yüksek teklifi veren oyuncu koz seçer
- Oyun, eller oynanarak devam eder
- Oyun sonunda puanlar hesaplanır ve kazanan takım/oyuncu belirlenir

### 2. İhale Mekanizması
- Oyuncular sırayla teklif verir veya pas geçer
- Teklifler en az 150 ve 10’un katı olmalıdır
- En yüksek teklifi veren oyuncu ihaleyi kazanır
- 1. ve 2. oyuncu isterse pota ekranından da teklif verebilir

### 3. Pota (Chat) Özelliği
- Oyuncular pota kutusuna mesaj yazabilir
- Pota mesajları ekranda ve sesli olarak okunur

### 4. Sesli Okuma
- Teklifler, pas geçmeler ve ihale sonucu sesli olarak okunur
- Pota mesajları sesli olarak okunur

### 5. Skor Tablosu
- Her oyuncunun ve takımın puanları ekranda gösterilir
- Oyun sonunda sonuçlar ekranda ve sesli olarak gösterilir

## Kullanıcı Arayüzü

- Kartlar ve oyuncular için görsel alan
- İhale ve teklif girişi için panel
- Pota (chat) kutusu
- Skor tablosu ve sonuç ekranı

## Teknik Gereksinimler

- HTML, CSS, JavaScript ile geliştirilmiş frontend
- Responsive tasarım (mobil ve masaüstü uyumlu)
- Tarayıcıda çalışır, ek sunucu gerekmez

## Kurallar

- Her oyuncu sırayla teklif verir veya pas geçer
- En yüksek teklifi veren oyuncu koz seçer
- Eller oynanır, puanlar toplanır
- Oyun sonunda takım ve oyuncu puanları hesaplanır

## Gelecek Geliştirmeler (Opsiyonel)

- Online çok oyunculu destek
- Farklı ihale ve oyun modları
- Kişiselleştirilebilir arayüzler 

1. İnternet Üzerinden 4 Oyuncu Oynama
Backend Gereksinimleri:
WebSocket sunucusu (Socket.io veya benzeri)
Oda yönetimi (her oyun için ayrı oda)
Oyuncu kimlik doğrulama (basit token sistemi)
Oyun durumu senkronizasyonu
Frontend Gereksinimleri:
WebSocket client bağlantısı
Oda katılma/ayrılma sistemi
Gerçek zamanlı oyun durumu güncellemeleri
Oyuncu listesi ve durumları
2. Bot Sistemi
Bot Özellikleri:
Otomatik kart oynama (basit strateji)
Otomatik ihale teklifi verme
Koz seçimi yapma
Oyuncu düştüğünde otomatik devreye girme
Önerilen Teknoloji Stack'i:
Backend:
Veritabanı:
Geliştirme Adımları:
1. Aşama - Backend Altyapısı:
WebSocket sunucusu kurulumu
Oda yönetimi sistemi
Oyuncu bağlantı yönetimi
Temel mesajlaşma sistemi
2. Aşama - Frontend Entegrasyonu:
WebSocket client entegrasyonu
Oda katılma arayüzü
Gerçek zamanlı oyun güncellemeleri
Oyuncu durumu göstergeleri
3. Aşama - Bot Sistemi:
Basit bot algoritması
Otomatik kart oynama
Otomatik ihale sistemi
Oyuncu düşme tespiti ve bot devreye girme
4. Aşama - Gelişmiş Özellikler:
Oyuncu profilleri
Oyun geçmişi
İstatistikler
Sohbet sistemi
Başlangıç için Hangi Dosyaları Güncellemeliyiz?
package.json - Yeni bağımlılıklar
server.js - WebSocket sunucusu
script.js - WebSocket client entegrasyonu
index.html - Oda katılma arayüzü
bot.js - Bot algoritması
Hangi aşamadan başlamak istersiniz? Backend altyapısından mı yoksa önce bot sisteminden mi?