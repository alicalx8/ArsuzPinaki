# 🃏 Pinaki - Samandağ İskambil Oyunu (Full Stack)

## 📖 Proje Hakkında
**Pinaki**, Türkiye'de özellikle Samandağ bölgesinde oynanan geleneksel bir 4 oyunculu iskambil oyunudur. Bu proje, modern web teknolojileri kullanılarak geliştirilmiş full-stack bir uygulamadır.

## 🏗️ Teknik Mimari

### **Frontend (React)**
- **React 18** - Modern React hooks ve functional components
- **Context API** - Oyun durumu yönetimi
- **CSS3** - Responsive tasarım ve modern UI
- **Component-based architecture** - Modüler ve yeniden kullanılabilir bileşenler

### **Backend (Node.js/Express)**
- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web framework
- **Single Port Architecture** - Frontend ve backend tek port üzerinden
- **RESTful API** - Modern API tasarımı

## 🚀 Kurulum ve Çalıştırma

### **Gereksinimler**
- Node.js (v16 veya üzeri)
- npm veya yarn

### **Kurulum**
```bash
# Ana proje klasörüne git
cd pinaki

# Tüm bağımlılıkları kur
npm run install-all

# Geliştirme modunda çalıştır
npm run dev
```

### **Scripts**
```bash
# Frontend ve backend'i aynı anda çalıştır
npm run dev

# Sadece backend'i çalıştır
npm run server

# Sadece frontend'i çalıştır
npm run client

# Production build
npm run build

# Production'da çalıştır
npm start
```

## 🌐 Erişim
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health

## 🎮 Oyun Kuralları

### **Kart Sistemi**
- **48 kartlık deste** (her karttan 2 tane)
- **4 renk**: ♥ (Kupa), ♠ (Maça), ♦ (Karo), ♣ (Sinek)
- **6 değer**: 9, 10, J, Q, K, A
- **Kart sıralaması**: A > 10 > K > Q > J > 9

### **Oyun Akışı**
1. **Kart Dağıtma**: 4 oyuncuya 12'şer kart (3 turda 4'erli)
2. **İhale Sistemi**: 150'den başlayarak artan teklifler
3. **Koz Seçimi**: İhaleyi kazanan oyuncu koz rengini seçer
4. **Kart Oynama**: 12 el boyunca kart atma
5. **Puanlama**: Başlangıç + oyun sonu puanları

## 🏆 Puanlama Sistemi

### **Başlangıç Puanları**
- **Koz Srit**: A+10+K+Q+J = 150 puan
- **Koz Evli**: K+Q = 40 puan
- **Diğer Evli**: K+Q = 20 puan
- **Dörtlü Kombinasyonlar**: 4J(40), 4Q(60), 4K(80), 4A(100)
- **Pinaki**: Q♠+J♦ = 40 puan
- **Koz 9'lar**: Her 9 = 10 puan

### **Oyun Sonu Puanları**
- A ve 10: 10 puan, K ve Q: 5 puan
- Son eli alan takım: 10 bonus puan

## 🎯 Samandağ Pinaki Özel Kuralları

### **Sordum/Konuş Sistemi**
- 3. oyuncu "Sordum" diyebilir
- 4. oyuncu "Konuş" diyebilir
- 4. oyuncu "Boz" diyerek ihale iptal edebilir

### **Boz Kuralı**
- 3 kez ard arda boz olursa dağıtıcı değişir
- Boz sonrası kartlar yeniden dağıtılır

## 🚀 Deployment

### **Render.com**
```bash
# Build komutu
npm run build

# Start komutu
npm start
```

### **Environment Variables**
```env
PORT=3000
NODE_ENV=production
```

## 📁 Proje Yapısı
```
pinaki/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React bileşenleri
│   │   ├── context/       # Game context
│   │   └── App.js         # Ana uygulama
│   ├── public/            # Statik dosyalar
│   └── package.json       # Frontend dependencies
├── server.js              # Express server
├── package.json           # Backend dependencies
└── README.md              # Proje dokümantasyonu
```

## 🔧 Geliştirme

### **Frontend Geliştirme**
```bash
cd client
npm start
```

### **Backend Geliştirme**
```bash
npm run server
```

### **Full Stack Geliştirme**
```bash
npm run dev
```

## 🌟 Özellikler

### **Kullanıcı Deneyimi**
- ✅ Responsive tasarım
- ✅ Modern UI/UX
- ✅ Gerçek zamanlı oyun durumu
- ✅ Sesli geri bildirim desteği
- ✅ Pota chat sistemi

### **Teknik Özellikler**
- ✅ Single Page Application (SPA)
- ✅ State management (Context API)
- ✅ Component-based architecture
- ✅ RESTful API
- ✅ Error handling
- ✅ Security (Helmet, CORS)
- ✅ Compression

## 📱 Responsive Tasarım
- **Desktop**: Tam özellikli oyun deneyimi
- **Tablet**: Optimize edilmiş arayüz
- **Mobile**: Touch-friendly tasarım

## 🔒 Güvenlik
- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Input validation** - Kullanıcı girdisi doğrulama
- **XSS protection** - Cross-site scripting koruması

## 🧪 Test
```bash
# Frontend testleri
cd client
npm test

# Backend testleri (gelecekte eklenecek)
npm test
```

## 📈 Performans
- **Code splitting** - Lazy loading
- **Compression** - Gzip compression
- **Static file serving** - Optimized delivery
- **Responsive images** - Adaptive loading

## 🤝 Katkıda Bulunma
1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans
Bu proje MIT lisansı altında lisanslanmıştır.

## 👥 Geliştirici Ekibi
- **Pinaki Game Team** - Oyun geliştirme ve tasarım

---

*Bu dokümantasyon, Pinaki oyun kodunu analiz ederek oluşturulmuştur.*
