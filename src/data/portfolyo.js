// Mevcut portföy verilerin buraya yüklendi
export const BASLANGIC_PORTFOY = [
  { id: "ADEL",  ad: "Adel Kalemcilik",       adet: 1680,  alis: 34.68, guncel: 45.92, hedef: 55,   stop: 30,   kategori: "TRADE", aksiyon: "TUT",  tez: "Mevsimsel tüketici ürünleri. Trade olarak kârli. CORE değil.", not: "" },
  { id: "BIOEN", ad: "Biyoenerji",             adet: 10000, alis: 17.66, guncel: 18.15, hedef: 28,   stop: 14,   kategori: "CORE",  aksiyon: "TUT",  tez: "YEKDEM 2026 güncelleme potansiyeli. Yenilenebilir enerji yapisal büyüme.", not: "" },
  { id: "EUREN", ad: "Euronet",                adet: 10000, alis: 5.12,  guncel: 4.97,  hedef: 6,    stop: 4.50, kategori: "TRADE", aksiyon: "SAT",  tez: "Tez yok. Zarar var. Başabaşta cik.", not: "" },
  { id: "FONET", ad: "Fonet Bilgi Tek.",       adet: 18000, alis: 6.17,  guncel: 4.57,  hedef: 7,    stop: 3.80, kategori: "TRADE", aksiyon: "TUT",  tez: "Sağlik BT dijitalleşmesi. %40 kâr realizasyonu yapilacak.", not: "" },
  { id: "FORTE", ad: "Forte BT/Savunma",       adet: 1500,  alis: 82.24, guncel: 97,    hedef: 130,  stop: 72,   kategori: "CORE",  aksiyon: "EKLE", tez: "MilSOFT satin alimi (390M TL). CMMI-5. Savunma yazilimi lideri. 1.8B TL 9A25 kâr.", not: "" },
  { id: "ASTOR", ad: "Astor Enerji",           adet: 689,   alis: 151.27,guncel: 207,   hedef: 183,  stop: 120,  kategori: "CORE",  aksiyon: "EKLE", tez: "794M USD sipariş bakiyesi. Faz1-2 2026 devreye. ABD pazari. İhracat %9.8.", not: "" },
  { id: "TRALT", ad: "Türkiye Altin",          adet: 2000,  alis: 43.09, guncel: 44.64, hedef: 60,   stop: 38,   kategori: "CORE",  aksiyon: "EKLE", tez: "Altin rekor seviyelerde. Enflasyon hedge. USD bağlantili.", not: "" },
  { id: "KAPLM", ad: "Kaplamin Ambalaj",       adet: 300,   alis: 345.45,guncel: 604.5, hedef: 650,  stop: 300,  kategori: "CORE",  aksiyon: "TUT",  tez: "Portföyün en yüksek kâri. Borçsuz yapi. Fiyatlama gücü. %25 kâr al.", not: "" },
  { id: "MOPAS", ad: "Mopas Mağazacilik",      adet: 4000,  alis: 44.27, guncel: 41.52, hedef: 50,   stop: 40,   kategori: "TRADE", aksiyon: "SAT",  tez: "Stop-loss geçti. Başabaşa gelince çik.", not: "" },
  { id: "TAVHL", ad: "TAV Havalimanlari",      adet: 360,   alis: 278.37,guncel: 345.75,hedef: 440,  stop: 240,  kategori: "CORE",  aksiyon: "TUT",  tez: "113M yolcu 2025. 2026 FAVÖK 590-650M EUR hedefi. Ankara 2050 imtiyaz.", not: "" },
  { id: "KCHOL", ad: "Koç Holding",            adet: 600,   alis: 170.54,guncel: 204.0, hedef: 299,  stop: 150,  kategori: "CORE",  aksiyon: "TUT",  tez: "22B TL 2025 kâr. K9+FROTO güçlü. 13 model portföyde.", not: "" },
  { id: "KRDMD", ad: "Kardemir D",             adet: 3000,  alis: 27.35, guncel: 36.10, hedef: 42,   stop: 24,   kategori: "CORE",  aksiyon: "TUT",  tez: "Tek entegre D/Ç üretici. Rayli altyapi 2026-2030. HF 39.12 TL.", not: "" },
  { id: "NUGYO", ad: "Nurol GYO",              adet: 10000, alis: 10.92, guncel: 9.35,  hedef: 12,   stop: 8,    kategori: "TRADE", aksiyon: "SAT",  tez: "En büyük zarar. GYO faiz baskisi. %50 sat.", not: "" },
  { id: "BINHO", ad: "Binhold Holding",        adet: 10000, alis: 9.38,  guncel: 9.21,  hedef: 12,   stop: 8,    kategori: "TRADE", aksiyon: "TUT",  tez: "Nötr. 60 günlük izleme.", not: "" },
  { id: "IMASM", ad: "İmaş Makine",            adet: 10000, alis: 4.92,  guncel: 3.93,  hedef: 6,    stop: 3.50, kategori: "TRADE", aksiyon: "SAT",  tez: "-%20 zarar. İlk +%5 harekette çik.", not: "" },
  { id: "ENTRA", ad: "IC Enterra (HES/GES)",   adet: 12500, alis: 11.02, guncel: 11.18, hedef: 15.9, stop: 9,    kategori: "CORE",  aksiyon: "EKLE", tez: "DÜZELTME: GYO değil! IC Enterra yenilenebilir enerji. 488MW→1142MW (2030). İş Yat. AL/15.9 TL.", not: "" },
  { id: "ADGYO", ad: "Adana GYO",              adet: 1000,  alis: 50.17, guncel: 60.50, hedef: 70,   stop: 45,   kategori: "TRADE", aksiyon: "TUT",  tez: "Kârli ama GYO. Trade olarak izle.", not: "" },
  { id: "DIRIT", ad: "Dirit Yazilim",          adet: 2000,  alis: 25.11, guncel: 27.06, hedef: 35,   stop: 22,   kategori: "TRADE", aksiyon: "TUT",  tez: "Küçük, kârli. Trade devam.", not: "" },
  { id: "LMKDC", ad: "Limak D.Anadolu Çim.",  adet: 4300,  alis: 31.38, guncel: 32.34, hedef: 42,   stop: 27,   kategori: "SAT",   aksiyon: "TUT",  tez: "Altyapi korelasyonu. Faiz indirim döngüsünde.", not: "" },
  { id: "CGCAM", ad: "Çağdaş Cam (Solar)",     adet: 3380,  alis: 40.35, guncel: 37.95, hedef: 55,   stop: 32,   kategori: "SAT",   aksiyon: "TUT",  tez: "4Ç25 kâr 287M TL (4.4x beklenti). Solar cam öncü. 2026 Q1-Q2 izle.", not: "" },
  { id: "MZHLD", ad: "MZ Holding",             adet: 8100,  alis: 6.17,  guncel: 6.14,  hedef: 9,    stop: 5.20, kategori: "TRADE", aksiyon: "TUT",  tez: "Nötr. 60 günlük izleme.", not: "" },
  { id: "AKSA",  ad: "Aksa Akrilik",           adet: 5000,  alis: 10.32, guncel: 10.30, hedef: 14,   stop: 9,    kategori: "SAT",   aksiyon: "TUT",  tez: "Başabaş. Faiz döngüsünde sanayi toparlanmasi.", not: "" },
  { id: "PETKM", ad: "Petkim (Hürmüz Temali)",adet: 8100,  alis: 19.04, guncel: 21.33, hedef: 27,   stop: 18,   kategori: "TRADE", aksiyon: "TUT",  tez: "Hürmüz ablukasi: petrol 102$+. Makas 362$/ton. Çikiş: 25-27 TL hedefi.", not: "" },
];

export const BASLANGIC_NAKIT = {
  tlNakit: 863000,
  usdFon: 285000,
  aylikEkleme: 90000
};