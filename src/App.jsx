import { useState, useEffect } from "react";
import { BASLANGIC_PORTFOY, BASLANGIC_NAKIT } from "./data/portfolyo";
import "./index.css";
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, collection,
  getDocs, addDoc, deleteDoc
} from "firebase/firestore";
import {
  portfoyOku, portfoyYaz,
  nakitOku,   nakitYaz,
  notlarOku,  notlarYaz,
  islemlerOku, islemlerYaz,
  halkaArzOku, halkaArzYaz,
  takipOku,   takipYaz,
  portfoyDinle, nakitDinle,
  bilancOku, bilancYaz,
  alarmGecmisiOku, alarmGecmisiYaz,
  snapshotOku, snapshotYaz,
  arsivOku, arsivYaz
} from "./veri";


// ─── VERİ ÇEKME ────────────────────────────────────────────────────────────
const PROXY_URL = "https://bist-proxy.vercel.app";

// ─── GÜVENLİK ────────────────────────────────────────────────────────────
const SIFRE_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
// Bu hash "admin" şifresine karşılık geliyor
// Değiştirmek için: https://emn178.github.io/online-tools/sha256.html adresinde
// yeni şifreni yaz, çıkan hash'i buraya yapıştır

async function hashle(metin) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(metin)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function girisKontrol() {
  return sessionStorage.getItem("bist_giris") === "1";
}
// ─── VERİ YÖNETİMİ ───────────────────────────────────────────────────────
function veriYukle() {
  try {
    const k = localStorage.getItem("bist_portfoy");
    const hisseler = k ? JSON.parse(k) : BASLANGIC_PORTFOY;
    // Yeni alanları eksik hisselere ekle
    return hisseler.map(h => ({
      riskler: "",
      hedefOran: 8,
      finansal: {
        gecmisNetKar: "", gelecekNetKar: "",
        gecmisFavok: "", gelecekFavok: "",
        gecmisFavokMarj: "", gelecekFavokMarj: "",
        gecmisFk: "", gelecekFk: "",
      },
      ...h,
    }));
  } catch { return BASLANGIC_PORTFOY; }
}
function nakitYukle() {
  try {
    const k = localStorage.getItem("bist_nakit");
    return k ? JSON.parse(k) : BASLANGIC_NAKIT;
  } catch { return BASLANGIC_NAKIT; }
}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────
function karZararHesapla(h) {
  const maliyet    = h.alis * h.adet;
  const guncelDeger = h.guncel * h.adet;
  const kz         = guncelDeger - maliyet;
  const kzYuzde    = ((kz / maliyet) * 100).toFixed(1);
  return { maliyet, guncelDeger, kz, kzYuzde };
}

function uyariKontrol(h, toplamVarlik) {
  const uyarilar = [];
  const { kzYuzde, guncelDeger } = karZararHesapla(h);
  const mevcutOran = toplamVarlik > 0
    ? (guncelDeger / toplamVarlik) * 100
    : 0;
  const maxOran = h.hedefOran || 8;

  if (h.hedef && h.guncel >= h.hedef)
    uyarilar.push({ tip: "hedef", mesaj: `${h.id} hedef fiyata ulaştı (${h.hedef} TL)` });
  if (h.stop && h.guncel <= h.stop)
    uyarilar.push({ tip: "stop", mesaj: `${h.id} stop-loss seviyesinde! (${h.stop} TL)` });
  if (parseFloat(kzYuzde) >= 35)
    uyarilar.push({ tip: "kar", mesaj: `${h.id} %${kzYuzde} kârda — kâr al düşün` });
  if (parseFloat(kzYuzde) <= -10)
    uyarilar.push({ tip: "risk", mesaj: `${h.id} %${kzYuzde} zararda — risk yönet` });
  if (mevcutOran > maxOran)
    uyarilar.push({ tip: "oran", mesaj: `${h.id} portföy oranı %${mevcutOran.toFixed(1)} — hedef %${maxOran} aşıldı` });

  return uyarilar;
}

function kategoriRenk(kat) {
  if (kat === "CORE")      return "#22c55e";
  if (kat === "SATELLITE") return "#a855f7";
  if (kat === "SAT")       return "#f59e0b";
  if (kat === "TRADE")     return "#64748b";
  if (kat === "PATATES")   return "#ef4444";
  if (kat === "KUMBARA")   return "#0ea5e9";
  return "#475569";
}

function aksiyonRenk(ak) {
  if (ak === "EKLE") return "#22c55e";
  if (ak === "SAT")  return "#ef4444";
  return "#94a3b8";
}

// ─── NAVBAR ──────────────────────────────────────────────────────────────
function Navbar({ aktif, setAktif, onIndir, onYukle, sonGuncelleme }) {
  const [menuAcik, setMenuAcik] = useState(false);
  const [mobilAcik, setMobilAcik] = useState(false);

  const anaMenuler = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "liste",     label: "📋 Hisseler"  },
    { id: "takip",     label: "🔭 Takip"     },
    { id: "guncelle",  label: "💱 Fiyat Güncelle"  },
    { id: "gunce",     label: "📝 Günce"     },
    
  ];

  const digerMenuler = [
    { id: "yeni",      label: "+ Hisse Ekle"        },
    { id: "grafikler", label: "📈 Grafikler"        },
    { id: "performans",label: "📊 Performans"       },
    { id: "rebalance", label: "⚖️ Rebalance"        },
    { id: "nakit",     label: "💰 Nakit"            },
    { id: "halkaarzi", label: "🏦 Halka Arz"        },
    { id: "takvim",    label: "📅 Takvim"           },
    { id: "arsiv",     label: "🗄 Arşiv"            },
  ];

  const tumMenuler = [...anaMenuler, ...digerMenuler];

  return (
    <nav className="navbar">
      <span className="navbar-logo">📈 BIST
        {sonGuncelleme && (
          <span style={{ fontSize:"0.65rem", color:"#64748b", marginLeft:"6px", fontWeight:400 }}>
            🕐 {sonGuncelleme}
          </span>
        )}
      </span>

      {/* Desktop Menü */}
      <div className="navbar-menu navbar-desktop">
        {anaMenuler.map(m => (
          <button key={m.id}
            className={`nav-btn ${aktif === m.id ? "aktif" : ""}`}
            onClick={() => setAktif(m.id)}>
            {m.label}
          </button>
        ))}

        {/* Daha Fazla dropdown */}
        <div style={{ position:"relative" }}>
          <button
            className={`nav-btn ${digerMenuler.some(m => m.id === aktif) ? "aktif" : ""}`}
            onClick={() => setMenuAcik(!menuAcik)}>
            ☰ Daha Fazla {menuAcik ? "▲" : "▼"}
          </button>
          {menuAcik && (
            <div style={{
              position:"absolute", top:"100%", right:0, zIndex:200,
              background:"#1e2330", border:"1px solid #2d3748", borderRadius:"8px",
              padding:"6px", minWidth:"180px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)"
            }}>
              {digerMenuler.map(m => (
                <button key={m.id}
                  className={`nav-btn ${aktif === m.id ? "aktif" : ""}`}
                  style={{ display:"block", width:"100%", textAlign:"left", marginBottom:"2px" }}
                  onClick={() => { setAktif(m.id); setMenuAcik(false); }}>
                  {m.label}
                </button>
              ))}
              <div style={{ borderTop:"1px solid #2d3748", marginTop:"6px", paddingTop:"6px" }}>
                <button className="nav-btn" style={{ display:"block", width:"100%", textAlign:"left" }}
                  onClick={() => { onIndir(); setMenuAcik(false); }}>
                  ⬇ Yedek
                </button>
                <button className="nav-btn"
                  style={{ display:"block", width:"100%", textAlign:"left", cursor:"pointer" }}
                  onClick={() => document.getElementById("dosyaInput").click()}>
                  ⬆ Yükle
                </button>
                <input id="dosyaInput" type="file" accept=".json"
                  style={{ display:"none" }} onChange={onYukle} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobil Hamburger */}
      <button className="mobil-menu-btn" onClick={() => setMobilAcik(!mobilAcik)}>
        {mobilAcik ? "✕" : "☰"}
      </button>

      {/* Mobil Açılır Menü */}
      {mobilAcik && (
        <div className="mobil-menu">
          {tumMenuler.map(m => (
            <button key={m.id}
              className={`mobil-menu-item ${aktif === m.id ? "aktif" : ""}`}
              onClick={() => { setAktif(m.id); setMobilAcik(false); }}>
              {m.label}
            </button>
          ))}
          <div style={{ borderTop:"1px solid #2d3748", padding:"8px 0" }}>
            <button className="mobil-menu-item" onClick={() => { onIndir(); setMobilAcik(false); }}>
              ⬇ Yedek İndir
            </button>
            <label className="mobil-menu-item" style={{ cursor:"pointer" }}>
              ⬆ Yedek Yükle
              <input type="file" accept=".json" style={{ display:"none" }} onChange={onYukle} />
            </label>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────
function Dashboard({ hisseler, nakit, onHisseClick, sonGuncelleme, takipListe, kapaliUyarilar, onUyariKapat, onUyarilariSifirla }) {
  const toplamHisse   = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const toplamMaliyet = hisseler.reduce((t, h) => t + h.alis * h.adet, 0);
  const toplamKZ      = toplamHisse - toplamMaliyet;
  const toplamKZYuzde = ((toplamKZ / toplamMaliyet) * 100).toFixed(1);
  const toplamVarlik  = toplamHisse + nakit.tlNakit + nakit.usdFon;

  const coreHisseler = hisseler.filter(h => h.kategori === "CORE");
  const coreDeger    = coreHisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const coreYuzde    = ((coreDeger / toplamVarlik) * 100).toFixed(0);

  const tumUyarilar  = hisseler.flatMap(h => uyariKontrol(h, toplamVarlik));

  const takipAlarmlari = (takipListe || []).flatMap(h => {
    const guncel = parseFloat(h.guncel);
    if (!guncel || !h.alarmlar) return [];
    const { direncAl, destekAl, destekSat, direncSat } = h.alarmlar;
    const alarml = [];
    if (direncAl?.aktif && direncAl?.fiyat && guncel >= parseFloat(direncAl.fiyat))
      alarml.push({ ...h, alarmTip:"📈 Direnç AL", alarmFiyat:direncAl.fiyat, renk:"#22c55e" });
    if (destekAl?.aktif && destekAl?.fiyat && guncel <= parseFloat(destekAl.fiyat))
      alarml.push({ ...h, alarmTip:"💙 Destek AL", alarmFiyat:destekAl.fiyat, renk:"#38bdf8" });
    if (destekSat?.aktif && destekSat?.fiyat && guncel <= parseFloat(destekSat.fiyat))
      alarml.push({ ...h, alarmTip:"📉 Destek SAT", alarmFiyat:destekSat.fiyat, renk:"#ef4444" });
    if (direncSat?.aktif && direncSat?.fiyat && guncel >= parseFloat(direncSat.fiyat))
      alarml.push({ ...h, alarmTip:"⚠️ Direnç SAT", alarmFiyat:direncSat.fiyat, renk:"#f59e0b" });
    return alarml;
  });

  const acilSatlar = hisseler.filter(h => h.aksiyon === "SAT");

  // En iyi ve en kötü 3 hisse
  const siralanmis = [...hisseler].sort((a, b) => {
    const { kzYuzde: ay } = karZararHesapla(a);
    const { kzYuzde: by } = karZararHesapla(b);
    return parseFloat(by) - parseFloat(ay);
  });
  const enIyi   = siralanmis.slice(0, 3);
  const enKotu  = siralanmis.slice(-3).reverse();

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:"0.5rem" }}>
        <h2 style={{ fontSize:"1.4rem", fontWeight:700, color:"#f1f5f9" }}>Dashboard</h2>
        {sonGuncelleme && (
          <span style={{ fontSize:"0.75rem", color:"#64748b" }}>🕐 Son güncelleme: {sonGuncelleme}</span>
        )}
      </div>

      {/* ── 1. Kritik Uyarılar — EN ÜSTTE ── */}
      {takipAlarmlari.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem", borderColor:"#f59e0b", borderWidth:"2px" }}>
          <h3 className="panel-baslik" style={{ color:"#f59e0b" }}>
            🔔 TAKİP ALARMLARI ({takipAlarmlari.length})
          </h3>
          {takipAlarmlari.map((h, i) => (
            <div key={i} className="acil-satir">
              <div>
                <b style={{ color:"#f1f5f9" }}>{h.id}</b>
                <span style={{ color:"#94a3b8", marginLeft:"8px", fontSize:"0.82rem" }}>{h.ad}</span>
                <span style={{ marginLeft:"8px", fontWeight:600, color:h.renk }}>{h.alarmTip}</span>
              </div>
              <div style={{ display:"flex", gap:"12px", fontSize:"0.82rem" }}>
                <span>Güncel: <b style={{ color:"#f1f5f9" }}>{h.guncel} TL</b></span>
                <span>Alarm: <b style={{ color:h.renk }}>{h.alarmFiyat} TL</b></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tumUyarilar.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem" }}>
          <h3 className="panel-baslik">⚠️ Portföy Uyarıları ({tumUyarilar.length})</h3>
          {tumUyarilar.map((u, i) => (
            <div key={i} className={`uyari uyari-${u.tip}`}>{u.mesaj}</div>
          ))}
        </div>
      )}

      {/* ── 2. Ana Özet Kartlar ── */}
      <div className="kart-grid" style={{ marginBottom:"1rem" }}>
        <div className="kart">
          <div className="kart-label">Toplam Varlık</div>
          <div className="kart-deger">
            {toplamVarlik.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Hisse K/Z</div>
          <div className={`kart-deger ${toplamKZ >= 0 ? "yesil" : "kirmizi"}`}>
            {toplamKZ >= 0 ? "+" : ""}
            {toplamKZ.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            <span className="kart-alt"> ({toplamKZYuzde}%)</span>
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Nakit TL</div>
          <div className="kart-deger">
            {nakit.tlNakit.toLocaleString("tr-TR")} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">USD Fon</div>
          <div className="kart-deger" style={{ color:"#38bdf8" }}>
            {nakit.usdFon.toLocaleString("tr-TR")} TL
          </div>
        </div>
      </div>

      {/* ── 3. CORE Progress ── */}
      <div className="panel" style={{ marginBottom:"1rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
          <span style={{ fontSize:"0.85rem" }}>CORE Ağırlığı</span>
          <span style={{ fontSize:"0.85rem" }}><b>{coreYuzde}%</b> / Hedef: 52%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width:`${Math.min(coreYuzde, 100)}%` }} />
        </div>
      </div>

      {/* ── 4. En İyi / En Kötü ── */}
      <div className="g2" style={{ marginBottom:"1rem" }}>
        <div className="panel">
          <h3 className="panel-baslik" style={{ color:"#22c55e" }}>🏆 En İyi 3</h3>
          {enIyi.map(h => {
            const { kzYuzde } = karZararHesapla(h);
            return (
              <div key={h.id} className="acil-satir" onClick={() => onHisseClick(h)} style={{ cursor:"pointer" }}>
                <span><b>{h.id}</b> <span style={{ color:"#64748b", fontSize:"0.8rem" }}>{h.ad}</span></span>
                <span className="yesil" style={{ fontWeight:700 }}>+{kzYuzde}%</span>
              </div>
            );
          })}
        </div>
        <div className="panel">
          <h3 className="panel-baslik" style={{ color:"#ef4444" }}>📉 En Kötü 3</h3>
          {enKotu.map(h => {
            const { kzYuzde } = karZararHesapla(h);
            return (
              <div key={h.id} className="acil-satir" onClick={() => onHisseClick(h)} style={{ cursor:"pointer" }}>
                <span><b>{h.id}</b> <span style={{ color:"#64748b", fontSize:"0.8rem" }}>{h.ad}</span></span>
                <span className="kirmizi" style={{ fontWeight:700 }}>{kzYuzde}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. Çıkış Beklenenler ── */}
      {acilSatlar.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem" }}>
          <h3 className="panel-baslik">🔴 Çıkış Bekleniyor ({acilSatlar.length})</h3>
          {acilSatlar.map(h => {
            const { kzYuzde } = karZararHesapla(h);
            return (
              <div key={h.id} className="acil-satir" onClick={() => onHisseClick(h)} style={{ cursor:"pointer" }}>
                <b>{h.id}</b> — {h.ad}
                <span className="kz-badge kirmizi">{kzYuzde}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 6. Kategori Dağılımı ── */}
      <div className="panel" style={{ marginBottom:"1rem" }}>
        <h3 className="panel-baslik">📊 Kategori Dağılımı</h3>
        <div className="dagilim-grid">
          {["CORE","SATELLITE","SAT","TRADE","PATATES","KUMBARA"].map(kat => {
            const katH = hisseler.filter(h => h.kategori === kat);
            const katD = katH.reduce((t, h) => t + h.guncel * h.adet, 0);
            const katY = toplamVarlik > 0 ? ((katD / toplamVarlik) * 100).toFixed(1) : 0;
            if (katD === 0) return null;
            return (
              <div key={kat} className="dagilim-kart">
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <span className="kat-badge" style={{ background: kategoriRenk(kat) }}>{kat}</span>
                  <span style={{ fontWeight:700, color:"#f1f5f9" }}>%{katY}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width:`${katY}%`, background: kategoriRenk(kat) }} />
                </div>
                <div style={{ fontSize:"0.75rem", color:"#64748b", marginTop:"4px" }}>
                  {katH.length} hisse · {katD.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
                </div>
              </div>
            );
          })}
          <div className="dagilim-kart">
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
              <span className="kat-badge" style={{ background:"#0ea5e9" }}>NAKİT</span>
              <span style={{ fontWeight:700, color:"#f1f5f9" }}>
                %{(((nakit.tlNakit + nakit.usdFon) / toplamVarlik) * 100).toFixed(1)}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-bar"
                style={{ width:`${((nakit.tlNakit + nakit.usdFon) / toplamVarlik) * 100}%`, background:"#0ea5e9" }} />
            </div>
            <div style={{ fontSize:"0.75rem", color:"#64748b", marginTop:"4px" }}>TL + USD Fon</div>
          </div>
        </div>
      </div>

      {/* ── 7. Nakit Özeti ── */}
      <div className="panel">
        <h3 className="panel-baslik">💰 Nakit Durumu</h3>
        <div className="kart-grid">
          <div className="kart">
            <div className="kart-label">TL Nakit</div>
            <div className="kart-deger yesil">
              {nakit.tlNakit.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            </div>
          </div>
          <div className="kart">
            <div className="kart-label">USD Fon</div>
            <div className="kart-deger" style={{ color:"#38bdf8" }}>
              {nakit.usdFon.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            </div>
          </div>
          <div className="kart">
            <div className="kart-label">Aylık Hedef</div>
            <div className="kart-deger">
              {nakit.aylikEkleme.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            </div>
          </div>
          <div className="kart">
            <div className="kart-label">Toplam Nakit</div>
            <div className="kart-deger">
              {(nakit.tlNakit + nakit.usdFon).toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            </div>
          </div>
        </div>
        <SonIslemler />
      </div>
    </div>
  );
}

// ─── HİSSE LİSTESİ ───────────────────────────────────────────────────────
function HisseListe({ hisseler, nakit, onHisseClick }) {
  const [filtre, setFiltre]     = useState("TUMU");
  const [siralama, setSiralama] = useState({ kolon: null, yon: "azalan" });
  const [kolonSecici, setKolonSecici] = useState(false);
  const [gorunenKolonlar, setGorunenKolonlar] = useState(
    ["id","kategori","adet","alis","guncel","gunluk","kzYuzde","kzTutar","tutar","potansiyel","mevcutOran","hedefOran","aksiyon"]
  );

  const toplamVarlik = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0)
    + nakit.tlNakit + nakit.usdFon;

  const TUM_KOLONLAR = [
    { id:"id",        label:"Hisse"      },
    { id:"kategori",  label:"Kat."       },
    { id:"adet",      label:"Adet"       },
    { id:"alis",      label:"Alış"       },
    { id:"guncel",    label:"Güncel"     },
    { id:"gunluk",    label:"Günlük"     },
    { id:"kzYuzde",   label:"K/Z%"       },
    { id:"kzTutar",   label:"K/Z TL"     },
    { id:"tutar",     label:"Tutar"      },
    { id:"potansiyel",label:"Potansiyel" },
    { id:"mevcutOran",label:"Mev.%"      },
    { id:"hedefOran", label:"Hdf.%"      },
    { id:"aksiyon",   label:"Aksiyon"    },
  ];

  function kolonToggle(id) {
    setGorunenKolonlar(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  }

  function g(id) { return gorunenKolonlar.includes(id); }

  const filtrelenmis = filtre === "TUMU"
    ? hisseler
    : hisseler.filter(h => h.kategori === filtre);

  function sirala(kolon) {
    setSiralama(prev => ({
      kolon,
      yon: prev.kolon === kolon && prev.yon === "azalan" ? "artan" : "azalan"
    }));
  }

  function siralaIkon(kolon) {
    if (siralama.kolon !== kolon) return " ↕";
    return siralama.yon === "azalan" ? " ↓" : " ↑";
  }

  const siraliHisseler = [...filtrelenmis].sort((a, b) => {
    if (!siralama.kolon) return 0;
    const { kz: akz, kzYuzde: akzY } = karZararHesapla(a);
    const { kz: bkz, kzYuzde: bkzY } = karZararHesapla(b);
    let av, bv;
    switch (siralama.kolon) {
      case "id":       return siralama.yon === "azalan" ? b.id.localeCompare(a.id,"tr") : a.id.localeCompare(b.id,"tr");
      case "aksiyon":  return siralama.yon === "azalan" ? b.aksiyon.localeCompare(a.aksiyon,"tr") : a.aksiyon.localeCompare(b.aksiyon,"tr");
      case "gunluk":   av = parseFloat(a.gunlukDegisim)||0; bv = parseFloat(b.gunlukDegisim)||0; break;
      case "kzYuzde":  av = parseFloat(akzY)||0; bv = parseFloat(bkzY)||0; break;
      case "kzTutar":  av = akz; bv = bkz; break;
      case "tutar":    av = a.guncel*a.adet; bv = b.guncel*b.adet; break;
      case "potansiyel": av = a.hedef?((a.hedef-a.guncel)/a.guncel*100):-999; bv = b.hedef?((b.hedef-b.guncel)/b.guncel*100):-999; break;
      case "mevcutOran": av = toplamVarlik>0?(a.guncel*a.adet/toplamVarlik*100):0; bv = toplamVarlik>0?(b.guncel*b.adet/toplamVarlik*100):0; break;
      case "hedefOran":  av = parseFloat(a.hedefOran)||0; bv = parseFloat(b.hedefOran)||0; break;
      default: return 0;
    }
    return siralama.yon === "azalan" ? bv - av : av - bv;
  });

  return (
    <div>
      <h2 className="sayfa-baslik">Hisse Listesi</h2>

      <div className="filtre-bar">
        {["TUMU","CORE","SATELLITE","SAT","TRADE","PATATES","KUMBARA"].map(f => (
          <button key={f} className={`filtre-btn ${filtre === f ? "aktif" : ""}`}
            onClick={() => setFiltre(f)}>{f}</button>
        ))}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
        <span style={{ fontSize:"0.78rem", color:"#64748b" }}>{filtrelenmis.length} hisse</span>
        <button className="btn btn-gri" style={{ fontSize:"0.75rem", padding:"3px 10px" }}
          onClick={() => setKolonSecici(!kolonSecici)}>
          ⚙ Kolonlar
        </button>
      </div>

      {kolonSecici && (
        <div className="panel" style={{ marginBottom:"0.75rem" }}>
          <h3 className="panel-baslik">Gösterilecek Kolonlar</h3>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"8px" }}>
            {TUM_KOLONLAR.map(k => (
              <button key={k.id} onClick={() => kolonToggle(k.id)}
                style={{
                  padding:"3px 10px", borderRadius:"4px", border:"none", cursor:"pointer", fontSize:"0.78rem",
                  background: gorunenKolonlar.includes(k.id) ? "#1d4ed8" : "#2d3748",
                  color: gorunenKolonlar.includes(k.id) ? "#fff" : "#94a3b8",
                }}>
                {k.label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", gap:"6px" }}>
            <button className="btn btn-gri" style={{ fontSize:"0.75rem" }}
              onClick={() => setGorunenKolonlar(TUM_KOLONLAR.map(k => k.id))}>Tümü</button>
            <button className="btn btn-gri" style={{ fontSize:"0.75rem" }}
              onClick={() => setGorunenKolonlar(["id","kategori","guncel","gunluk","kzYuzde","aksiyon"])}>Minimal</button>
            <button className="btn btn-gri" style={{ fontSize:"0.75rem" }}
              onClick={() => setGorunenKolonlar(["id","kategori","adet","alis","guncel","gunluk","kzYuzde","kzTutar","aksiyon"])}>Standart</button>
          </div>
        </div>
      )}

      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr>
              {g("id")         && <th style={{cursor:"pointer"}} onClick={()=>sirala("id")}>Hisse{siralaIkon("id")}</th>}
              {g("kategori")   && <th>Kat.</th>}
              {g("adet")       && <th>Adet</th>}
              {g("alis")       && <th>Alış</th>}
              {g("guncel")     && <th>Güncel</th>}
              {g("gunluk")     && <th style={{cursor:"pointer"}} onClick={()=>sirala("gunluk")}>Günlük{siralaIkon("gunluk")}</th>}
              {g("kzYuzde")    && <th style={{cursor:"pointer"}} onClick={()=>sirala("kzYuzde")}>K/Z%{siralaIkon("kzYuzde")}</th>}
              {g("kzTutar")    && <th style={{cursor:"pointer"}} onClick={()=>sirala("kzTutar")}>K/Z TL{siralaIkon("kzTutar")}</th>}
              {g("tutar")      && <th style={{cursor:"pointer"}} onClick={()=>sirala("tutar")}>Tutar{siralaIkon("tutar")}</th>}
              {g("potansiyel") && <th style={{cursor:"pointer"}} onClick={()=>sirala("potansiyel")}>Potansiyel{siralaIkon("potansiyel")}</th>}
              {g("mevcutOran") && <th style={{cursor:"pointer"}} onClick={()=>sirala("mevcutOran")}>Mev.%{siralaIkon("mevcutOran")}</th>}
              {g("hedefOran")  && <th style={{cursor:"pointer"}} onClick={()=>sirala("hedefOran")}>Hdf.%{siralaIkon("hedefOran")}</th>}
              {g("aksiyon")    && <th style={{cursor:"pointer"}} onClick={()=>sirala("aksiyon")}>Aksiyon{siralaIkon("aksiyon")}</th>}
            </tr>
          </thead>
          <tbody>
            {siraliHisseler.map(h => {
              const { kz, kzYuzde } = karZararHesapla(h);
              const kzPos      = parseFloat(kzYuzde) >= 0;
              const gunluk     = parseFloat(h.gunlukDegisim);
              const tutar      = h.guncel * h.adet;
              const mevcutOran = toplamVarlik > 0 ? ((tutar/toplamVarlik)*100).toFixed(1) : 0;
              const potansiyel = h.hedef && h.guncel
                ? (((h.hedef-h.guncel)/h.guncel)*100).toFixed(1) : null;

              return (
                <tr key={h.id} className="tablo-satir" onClick={() => onHisseClick(h)}>
                  {g("id") && (
                    <td><b>{h.id}</b><br/><span className="kucuk">{h.ad}</span></td>
                  )}
                  {g("kategori") && (
                    <td><span className="kat-badge" style={{background:kategoriRenk(h.kategori)}}>{h.kategori}</span></td>
                  )}
                  {g("adet")    && <td>{h.adet.toLocaleString("tr-TR")}</td>}
                  {g("alis")    && <td>{h.alis.toFixed(2)}</td>}
                  {g("guncel")  && <td>{h.guncel.toFixed(2)}</td>}
                  {g("gunluk")  && (
                    <td>{h.gunlukDegisim != null
                      ? <span className={gunluk>=0?"yesil":"kirmizi"}>{gunluk>=0?"▲":"▼"} {Math.abs(gunluk).toFixed(2)}%</span>
                      : <span style={{color:"#475569"}}>—</span>}
                    </td>
                  )}
                  {g("kzYuzde") && <td className={kzPos?"yesil":"kirmizi"}>{kzPos?"+":""}{kzYuzde}%</td>}
                  {g("kzTutar") && (
                    <td className={kz>=0?"yesil":"kirmizi"}>
                      {kz>=0?"+":""}{kz.toLocaleString("tr-TR",{maximumFractionDigits:0})}
                    </td>
                  )}
                  {g("tutar") && <td>{tutar.toLocaleString("tr-TR",{maximumFractionDigits:0})}</td>}
                  {g("potansiyel") && (
                    <td>{potansiyel
                      ? <span className={parseFloat(potansiyel)>=0?"yesil":"kirmizi"}>{parseFloat(potansiyel)>=0?"+":""}{potansiyel}%</span>
                      : <span style={{color:"#475569"}}>—</span>}
                    </td>
                  )}
                  {g("mevcutOran") && (
                    <td><span className={parseFloat(mevcutOran)>(h.hedefOran||8)?"kirmizi":""}>%{mevcutOran}</span></td>
                  )}
                  {g("hedefOran") && <td style={{color:"#64748b"}}>%{h.hedefOran||"—"}</td>}
                  {g("aksiyon")   && (
                    <td><span className="ak-badge" style={{color:aksiyonRenk(h.aksiyon)}}>{h.aksiyon}</span></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── HİSSE DETAY ─────────────────────────────────────────────────────────
function HisseDetay({ hisse, onGuncelle, onGeri, onSil, toplamVarlik }) {
  const [duzenleme, setDuzenleme] = useState(false);
  const [form, setForm] = useState({ ...hisse });
  const { kz, kzYuzde, maliyet, guncelDeger } = karZararHesapla(hisse);

  const mevcutOran = toplamVarlik > 0
    ? ((guncelDeger / toplamVarlik) * 100).toFixed(1)
    : 0;

  const potansiyelGetiri = hisse.hedef && hisse.guncel
    ? (((hisse.hedef - hisse.guncel) / hisse.guncel) * 100).toFixed(1)
    : null;

  function kaydet() {
    onGuncelle(hisse.id, {
      ...form,
      alis:      parseFloat(form.alis),
      adet:      parseInt(form.adet),
      guncel:    parseFloat(form.guncel),
      hedef:     parseFloat(form.hedef),
      stop:      parseFloat(form.stop),
      hedefOran: parseFloat(form.hedefOran) || 0,
      finansal:  form.finansal || hisse.finansal,
    });
    setDuzenleme(false);
  }

  return (
    <div>
      <button className="geri-btn" onClick={onGeri}>← Geri</button>
      <div className="detay-baslik">
        <span className="kat-badge"
          style={{ background: kategoriRenk(hisse.kategori), fontSize: "0.8rem" }}>
          {hisse.kategori}
        </span>
        <h2>{hisse.id} — {hisse.ad}</h2>
        <span className="ak-badge"
          style={{ color: aksiyonRenk(hisse.aksiyon), fontSize: "1rem" }}>
          ● {hisse.aksiyon}
        </span>
      </div>

      {/* K/Z Özet */}
      <div className="kart-grid" style={{ marginBottom: "1rem" }}>
        <div className="kart">
          <div className="kart-label">Maliyet</div>
          <div className="kart-deger">
            {maliyet.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Güncel Değer</div>
          <div className="kart-deger">
            {guncelDeger.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">K/Z</div>
          <div className={`kart-deger ${kz >= 0 ? "yesil" : "kirmizi"}`}>
            {kz >= 0 ? "+" : ""}
            {kz.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL ({kzYuzde}%)
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Hedef / Stop</div>
          <div className="kart-deger">{hisse.hedef || "—"} / {hisse.stop || "—"}</div>
        </div>
        <div className="kart">
          <div className="kart-label">Potansiyel Getiri</div>
          <div className={`kart-deger ${parseFloat(potansiyelGetiri) >= 0 ? "yesil" : "kirmizi"}`}>
            {potansiyelGetiri ? `${parseFloat(potansiyelGetiri) >= 0 ? "+" : ""}${potansiyelGetiri}%` : "—"}
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Mevcut Oran</div>
          <div className="kart-deger">%{mevcutOran}</div>
        </div>
        <div className="kart">
          <div className="kart-label">Hedef Oran</div>
          <div className="kart-deger">%{hisse.hedefOran || "—"}</div>
        </div>
        <div className="kart">
          <div className="kart-label">Günlük Değişim</div>
          <div className={`kart-deger ${parseFloat(hisse.gunlukDegisim) >= 0 ? "yesil" : "kirmizi"}`}>
            {hisse.gunlukDegisim != null
              ? `${parseFloat(hisse.gunlukDegisim) >= 0 ? "▲" : "▼"} %${Math.abs(parseFloat(hisse.gunlukDegisim))}`
              : "— Fiyat güncelle"}
          </div>
        </div>
      </div>

      {/* Yatırım Tezi */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">💡 Yatırım Tezi</h3>
        {duzenleme ? (
          <textarea className="input-alan" rows={4}
            value={form.tez}
            onChange={e => setForm({ ...form, tez: e.target.value })} />
        ) : (
          <p style={{ lineHeight: "1.6", color: "#cbd5e1" }}>
            {hisse.tez || "Henüz tez girilmedi."}
          </p>
        )}
      </div>

      {/* Riskler */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">⚠️ Riskler</h3>
        {duzenleme ? (
          <textarea className="input-alan" rows={3}
            value={form.riskler || ""}
            onChange={e => setForm({ ...form, riskler: e.target.value })} />
        ) : (
          <p style={{ lineHeight: "1.6", color: "#cbd5e1" }}>
            {hisse.riskler || "Henüz risk girilmedi."}
          </p>
        )}
      </div>

      {/* Not */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">📝 Not</h3>
        {duzenleme ? (
          <textarea className="input-alan" rows={3}
            value={form.not}
            onChange={e => setForm({ ...form, not: e.target.value })} />
        ) : (
          <p style={{ lineHeight: "1.6", color: "#cbd5e1" }}>
            {hisse.not || "Not yok."}
          </p>
        )}
      </div>

      {/* Finansal Veriler */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">📊 Finansal Veriler</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="tablo" style={{ minWidth: "500px" }}>
            <thead>
              <tr>
                <th>Gösterge</th>
                <th>Geçmiş Dönem</th>
                <th>Gelecek Beklenti</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Net Kâr",    gecmis: "gecmisNetKar",    gelecek: "gelecekNetKar"    },
                { label: "FAVÖK",      gecmis: "gecmisFavok",     gelecek: "gelecekFavok"     },
                { label: "FAVÖK Marjı",gecmis: "gecmisFavokMarj", gelecek: "gelecekFavokMarj" },
                { label: "F/K",        gecmis: "gecmisFk",        gelecek: "gelecekFk"        },
              ].map(({ label, gecmis, gelecek }) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600, color: "#94a3b8" }}>{label}</td>
                  <td>
                    {duzenleme ? (
                      <input className="input" type="text"
                        style={{ padding: "4px 8px" }}
                        value={form.finansal?.[gecmis] || ""}
                        onChange={e => setForm({
                          ...form,
                          finansal: { ...form.finansal, [gecmis]: e.target.value }
                        })} />
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>
                        {hisse.finansal?.[gecmis] || "—"}
                      </span>
                    )}
                  </td>
                  <td>
                    {duzenleme ? (
                      <input className="input" type="text"
                        style={{ padding: "4px 8px" }}
                        value={form.finansal?.[gelecek] || ""}
                        onChange={e => setForm({
                          ...form,
                          finansal: { ...form.finansal, [gelecek]: e.target.value }
                        })} />
                    ) : (
                      <span style={{ color: "#22c55e" }}>
                        {hisse.finansal?.[gelecek] || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Düzenleme Formu */}
      {duzenleme && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik">✏️ Temel Bilgiler</h3>
          <div className="form-grid">
            {[
              { label: "Güncel Fiyat", key: "guncel" },
              { label: "Hedef Fiyat",  key: "hedef"  },
              { label: "Stop-Loss",    key: "stop"   },
              { label: "Adet",         key: "adet"   },
              { label: "Alış Fiyatı",  key: "alis"   },
              { label: "Hedef Oran %", key: "hedefOran" },
            ].map(({ label, key }) => (
              <label key={key} className="form-label">
                {label}
                <input className="input" type="number" step="0.01"
                  value={form[key] || ""}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
            <label className="form-label">
              Kategori
              <select className="input" value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}>
                <option value="CORE">CORE</option>
                <option value="SATELLITE">SATELLITE</option>
                <option value="SAT">SAT</option>
                <option value="TRADE">TRADE</option>
                <option value="PATATES">PATATES</option>
                <option value="KUMBARA">KUMBARA</option>
              </select>
            </label>
            <label className="form-label">
              Aksiyon
              <select className="input" value={form.aksiyon}
                onChange={e => setForm({ ...form, aksiyon: e.target.value })}>
                <option value="TUT">TUT</option>
                <option value="EKLE">EKLE</option>
                <option value="SAT">SAT</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* İşlem Geçmişi */}
      <HisseIslemGecmisi hisseId={hisse.id} />
      
      {/* Butonlar */}
      <div className="btn-grup">
        {duzenleme ? (
          <>
            <button className="btn btn-yesil" onClick={kaydet}>✓ Kaydet</button>
            <button className="btn btn-gri"
              onClick={() => { setDuzenleme(false); setForm({ ...hisse }); }}>
              İptal
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-mavi" onClick={() => setDuzenleme(true)}>
              ✏️ Düzenle
            </button>
            <button className="btn btn-kirmizi" onClick={() => onSil(hisse.id)}>
              🗑 Sil
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── HİSSE EKLE ──────────────────────────────────────────────────────────
function HisseEkle({ onEkle, onIptal }) {
  const [form, setForm] = useState({
    id: "", ad: "", adet: "", alis: "", guncel: "",
    hedef: "", stop: "", hedefOran: "", kategori: "CORE",
    aksiyon: "TUT", tez: "", riskler: "", not: "",
    finansal: {
      gecmisNetKar:"", gelecekNetKar:"",
      gecmisFavok:"", gelecekFavok:"",
      gecmisFavokMarj:"", gelecekFavokMarj:"",
      gecmisFk:"", gelecekFk:"",
    }
  });
  const [sekme, setSekme] = useState("temel");

  function guncelle(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function finansalGuncelle(key, val) {
    setForm(prev => ({ ...prev, finansal: { ...prev.finansal, [key]: val } }));
  }

  function ekle() {
    if (!form.id.trim() || !form.ad.trim() || !form.adet || !form.alis || !form.guncel) {
      alert("Temel bilgiler sekmesindeki * alanları doldur.");
      return;
    }
    onEkle({
      id:        form.id.toUpperCase().trim(),
      ad:        form.ad.trim(),
      adet:      parseInt(form.adet),
      alis:      parseFloat(form.alis),
      guncel:    parseFloat(form.guncel),
      hedef:     parseFloat(form.hedef) || 0,
      stop:      parseFloat(form.stop)  || 0,
      hedefOran: parseFloat(form.hedefOran) || 0,
      kategori:  form.kategori,
      aksiyon:   form.aksiyon,
      tez:       form.tez,
      riskler:   form.riskler,
      not:       form.not,
      finansal:  form.finansal,
    });
  }

  const SEKMELER = [
    { id:"temel",   label:"📋 Temel"    },
    { id:"strateji",label:"🎯 Strateji" },
    { id:"finansal",label:"📊 Finansal" },
  ];

  return (
    <div>
      <h2 className="sayfa-baslik">+ Yeni Hisse Ekle</h2>

      {/* Sekme Butonları */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"1rem" }}>
        {SEKMELER.map(s => (
          <button key={s.id}
            className={`filtre-btn ${sekme === s.id ? "aktif" : ""}`}
            onClick={() => setSekme(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel">

        {/* TEMEL BİLGİLER */}
        {sekme === "temel" && (
          <div>
            <div className="form-grid" style={{ marginBottom:"1rem" }}>
              <label className="form-label">
                Sembol *
                <input className="input" type="text" placeholder="örn: THYAO"
                  value={form.id} onChange={e => guncelle("id", e.target.value.toUpperCase())} />
              </label>
              <label className="form-label">
                Şirket Adı *
                <input className="input" type="text"
                  value={form.ad} onChange={e => guncelle("ad", e.target.value)} />
              </label>
              <label className="form-label">
                Adet *
                <input className="input" type="number"
                  value={form.adet} onChange={e => guncelle("adet", e.target.value)} />
              </label>
              <label className="form-label">
                Alış Fiyatı (TL) *
                <input className="input" type="number" step="0.01"
                  value={form.alis} onChange={e => guncelle("alis", e.target.value)} />
              </label>
              <label className="form-label">
                Güncel Fiyat (TL) *
                <input className="input" type="number" step="0.01"
                  value={form.guncel} onChange={e => guncelle("guncel", e.target.value)} />
              </label>
              <label className="form-label">
                Hedef Fiyat (TL)
                <input className="input" type="number" step="0.01"
                  value={form.hedef} onChange={e => guncelle("hedef", e.target.value)} />
              </label>
              <label className="form-label">
                Stop-Loss (TL)
                <input className="input" type="number" step="0.01"
                  value={form.stop} onChange={e => guncelle("stop", e.target.value)} />
              </label>
              <label className="form-label">
                Hedef Oran %
                <input className="input" type="number" step="0.1"
                  value={form.hedefOran} onChange={e => guncelle("hedefOran", e.target.value)} />
              </label>
              <label className="form-label">
                Kategori
                <select className="input" value={form.kategori}
                  onChange={e => guncelle("kategori", e.target.value)}>
                  <option value="CORE">CORE</option>
                  <option value="SATELLITE">SATELLITE</option>
                  <option value="SAT">SAT</option>
                  <option value="TRADE">TRADE</option>
                  <option value="PATATES">PATATES</option>
                  <option value="KUMBARA">KUMBARA</option>
                </select>
              </label>
              <label className="form-label">
                Aksiyon
                <select className="input" value={form.aksiyon}
                  onChange={e => guncelle("aksiyon", e.target.value)}>
                  <option value="TUT">TUT</option>
                  <option value="EKLE">EKLE</option>
                  <option value="SAT">SAT</option>
                </select>
              </label>
            </div>
            {form.adet && form.alis && (
              <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginBottom:"1rem" }}>
                Toplam maliyet: <b style={{ color:"#f1f5f9" }}>
                  {(parseInt(form.adet||0) * parseFloat(form.alis||0)).toLocaleString("tr-TR",{maximumFractionDigits:0})} TL
                </b>
              </div>
            )}
          </div>
        )}

        {/* STRATEJİ */}
        {sekme === "strateji" && (
          <div>
            <label className="form-label" style={{ display:"block", marginBottom:"0.75rem" }}>
              💡 Yatırım Tezi
              <textarea className="input-alan" rows={4}
                placeholder="Neden bu hisseyi aldın? Temel/teknik analiz..."
                value={form.tez} onChange={e => guncelle("tez", e.target.value)} />
            </label>
            <label className="form-label" style={{ display:"block", marginBottom:"0.75rem" }}>
              ⚠️ Riskler
              <textarea className="input-alan" rows={3}
                placeholder="Olası riskler, dikkat edilmesi gerekenler..."
                value={form.riskler} onChange={e => guncelle("riskler", e.target.value)} />
            </label>
            <label className="form-label" style={{ display:"block" }}>
              📝 Not
              <textarea className="input-alan" rows={2}
                placeholder="Ek notlar..."
                value={form.not} onChange={e => guncelle("not", e.target.value)} />
            </label>
          </div>
        )}

        {/* FİNANSAL */}
        {sekme === "finansal" && (
          <div>
            <p style={{ color:"#64748b", fontSize:"0.82rem", marginBottom:"1rem" }}>
              Geçmiş dönem verileri ve gelecek beklentilerini gir.
            </p>
            <table className="tablo">
              <thead>
                <tr>
                  <th>Gösterge</th>
                  <th>Geçmiş Dönem</th>
                  <th>Gelecek Beklenti</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:"Net Kâr",    g:"gecmisNetKar",    gl:"gelecekNetKar"    },
                  { label:"FAVÖK",      g:"gecmisFavok",     gl:"gelecekFavok"     },
                  { label:"FAVÖK Marjı",g:"gecmisFavokMarj", gl:"gelecekFavokMarj" },
                  { label:"F/K",        g:"gecmisFk",        gl:"gelecekFk"        },
                ].map(({ label, g: gk, gl }) => (
                  <tr key={label}>
                    <td style={{ fontWeight:600, color:"#94a3b8" }}>{label}</td>
                    <td>
                      <input className="input" type="text"
                        style={{ padding:"4px 8px" }}
                        value={form.finansal[gk] || ""}
                        onChange={e => finansalGuncelle(gk, e.target.value)} />
                    </td>
                    <td>
                      <input className="input" type="text"
                        style={{ padding:"4px 8px" }}
                        value={form.finansal[gl] || ""}
                        onChange={e => finansalGuncelle(gl, e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="btn-grup" style={{ marginTop:"1.25rem" }}>
          <button className="btn btn-yesil" onClick={ekle}>✓ Hisse Ekle</button>
          <button className="btn btn-gri" onClick={onIptal}>← İptal</button>
        </div>
      </div>
    </div>
  );
}

// ─── GÜNCE ───────────────────────────────────────────────────────────────
function Gunce({ hisseler }) {
  const [notlar, setNotlar]     = useState([]);
  const [yuklendi, setYuklendi] = useState(false);
  const [yeniNot, setYeniNot]   = useState("");
  const [yeniTip, setYeniTip]   = useState("GENEL");
  const [arama, setArama]       = useState("");
  const [tipFiltre, setTipFiltre] = useState("TUMU");
  const [hisseFiltre, setHisseFiltre] = useState("TUMU");

  useEffect(() => {
    notlarOku().then(liste => { setNotlar(liste); setYuklendi(true); });
  }, []);

  useEffect(() => {
    if (yuklendi) notlarYaz(notlar);
  }, [notlar, yuklendi]);

  const TIPLER = [
    { val:"GENEL",   label:"📝 Genel",    renk:"#64748b" },
    { val:"ANALIZ",  label:"🔍 Analiz",   renk:"#3b82f6" },
    { val:"KARAR",   label:"✅ Karar",    renk:"#22c55e" },
    { val:"HABER",   label:"📰 Haber",    renk:"#f59e0b" },
    { val:"STRATEJI",label:"🎯 Strateji", renk:"#a855f7" },
    { val:"RISK",    label:"⚠️ Risk",     renk:"#ef4444" },
  ];

  function tipRenk(tip) {
    return TIPLER.find(t => t.val === tip)?.renk || "#64748b";
  }
  function tipLabel(tip) {
    return TIPLER.find(t => t.val === tip)?.label || tip;
  }

  function notEkle() {
    if (!yeniNot.trim()) return;
    const not = {
      id:        Date.now(),
      tarih:     new Date().toLocaleDateString("tr-TR"),
      tarihISO:  new Date().toISOString(),
      icerik:    yeniNot,
      tip:       yeniTip,
      etiketler: (yeniNot.match(/#\w+/g) || []),
    };
    setNotlar(prev => [not, ...prev]);
    setYeniNot("");
  }

  // Hisse etiketlerini çıkar
  const hisseIds = [...new Set(
    notlar.flatMap(n => n.etiketler?.filter(e => e.startsWith("#")) || [])
  )];

  const filtrelenmis = notlar.filter(n => {
    const aramaUygun = n.icerik.toLowerCase().includes(arama.toLowerCase());
    const tipUygun = tipFiltre === "TUMU" || n.tip === tipFiltre;
    const hisseUygun = hisseFiltre === "TUMU" ||
      (n.etiketler || []).includes(hisseFiltre);
    return aramaUygun && tipUygun && hisseUygun;
  });

  return (
    <div>
      <h2 className="sayfa-baslik">📝 Günce</h2>

      {/* Not Ekleme */}
      <div className="panel" style={{ marginBottom:"1rem" }}>
        <div style={{ display:"flex", gap:"8px", marginBottom:"0.5rem", flexWrap:"wrap" }}>
          {TIPLER.map(t => (
            <button key={t.val}
              onClick={() => setYeniTip(t.val)}
              style={{
                padding:"3px 10px", borderRadius:"4px", border:"none", cursor:"pointer",
                fontSize:"0.78rem", fontWeight:600,
                background: yeniTip === t.val ? t.renk : "#2d3748",
                color: yeniTip === t.val ? "#fff" : "#94a3b8",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea className="input-alan" rows={4}
          placeholder={`${tipLabel(yeniTip)} notu... #ASTOR #KRİZ gibi etiket ekleyebilirsin`}
          value={yeniNot}
          onChange={e => setYeniNot(e.target.value)} />
        <button className="btn btn-mavi" style={{ marginTop:"0.5rem" }} onClick={notEkle}>
          + Not Ekle
        </button>
      </div>

      {/* Filtreler */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"1rem", flexWrap:"wrap" }}>
        <input className="input" placeholder="🔍 Ara..."
          value={arama} onChange={e => setArama(e.target.value)}
          style={{ flex:1, minWidth:"150px" }} />
        <select className="input" style={{ width:"140px" }}
          value={tipFiltre} onChange={e => setTipFiltre(e.target.value)}>
          <option value="TUMU">Tüm Tipler</option>
          {TIPLER.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
        </select>
        <select className="input" style={{ width:"140px" }}
          value={hisseFiltre} onChange={e => setHisseFiltre(e.target.value)}>
          <option value="TUMU">Tüm Hisseler</option>
          {hisseIds.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Not Listesi */}
      {filtrelenmis.length === 0 && (
        <p style={{ color:"#64748b" }}>Not bulunamadı.</p>
      )}
      {filtrelenmis.map(n => (
        <div key={n.id} className="panel" style={{ marginBottom:"0.75rem",
          borderLeft:`3px solid ${tipRenk(n.tip || "GENEL")}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
            <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:"0.72rem", color:"#64748b" }}>{n.tarih}</span>
              <span style={{
                fontSize:"0.72rem", fontWeight:600, padding:"1px 7px",
                borderRadius:"3px", background: tipRenk(n.tip || "GENEL") + "33",
                color: tipRenk(n.tip || "GENEL")
              }}>
                {tipLabel(n.tip || "GENEL")}
              </span>
            </div>
            <button onClick={() => {
              if (!window.confirm("Bu notu silmek istediğine emin misin?")) return;
              setNotlar(prev => prev.filter(x => x.id !== n.id));
            }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.8rem" }}>
              🗑
            </button>
          </div>
          <p style={{ lineHeight:"1.6", color:"#cbd5e1", whiteSpace:"pre-wrap" }}>{n.icerik}</p>
          {(n.etiketler || []).length > 0 && (
            <div style={{ marginTop:"6px" }}>
              {n.etiketler.map(e => (
                <span key={e} className="etiket"
                  style={{ cursor:"pointer" }}
                  onClick={() => setHisseFiltre(e)}>
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
// ─── FİYAT GÜNCELLE ──────────────────────────────────────────────────────
function FiyatGuncelle({ hisseler, onKaydet, onIptal, onFiyatCek, fiyatYukleniyor }) {
  const [fiyatlar, setFiyatlar] = useState(
    Object.fromEntries(hisseler.map(h => [h.id, h.guncel]))
  );

  function kaydet() {
    const guncel = hisseler.map(h => ({
      ...h,
      guncel: parseFloat(fiyatlar[h.id]) || h.guncel,
    }));
    onKaydet(guncel);
  }

  return (
    <div>
      <h2 className="sayfa-baslik">💱 Fiyat Güncelle</h2>
      <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.85rem" }}>
        Fiyatları manuel gir veya Yahoo Finance'den otomatik çek.
      </p>

      <div className="panel">
        {/* Otomatik çek butonu — en üstte */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1.25rem", paddingBottom: "1rem",
          borderBottom: "1px solid #2d3748"
        }}>
          <div>
            <div style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: "2px" }}>
              🔄 Yahoo Finance'den Otomatik Çek
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
              Tüm hisselerin güncel fiyatını otomatik getirir (15 dk gecikmeli)
            </div>
          </div>
          <button
            className="btn"
            onClick={() => onFiyatCek((yeniFiyatlar) => setFiyatlar(yeniFiyatlar))}
            disabled={fiyatYukleniyor}
            style={{
              background: fiyatYukleniyor ? "#1e2330" : "#14532d",
              color: fiyatYukleniyor ? "#64748b" : "#22c55e",
              border: "1px solid #15803d",
              minWidth: "160px"
            }}
          >
            {fiyatYukleniyor ? "⏳ Çekiliyor..." : "🔄 Otomatik Güncelle"}
          </button>
        </div>

        {/* Manuel giriş */}
        <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
          {hisseler.map(h => {
            const { kzYuzde } = karZararHesapla({
              ...h,
              guncel: parseFloat(fiyatlar[h.id]) || h.guncel
            });
            const kzPos = parseFloat(kzYuzde) >= 0;
            return (
              <label key={h.id} className="form-label">
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{h.id}</b>
                  <span
                    className={kzPos ? "yesil" : "kirmizi"}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {kzPos ? "+" : ""}{kzYuzde}%
                  </span>
                </span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={fiyatlar[h.id]}
                  onChange={e =>
                    setFiyatlar(prev => ({ ...prev, [h.id]: e.target.value }))
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="btn-grup">
          <button className="btn btn-yesil" onClick={kaydet}>✓ Kaydet</button>
          <button className="btn btn-gri" onClick={onIptal}>İptal</button>
        </div>
      </div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────
export default function App() {
  const [girisYapildi,    setGirisYapildi]    = useState(girisKontrol);
  const [hisseler,        setHisseler]        = useState([]);
  const [nakit,           setNakit]           = useState(BASLANGIC_NAKIT);
  const [aktifSayfa,      setAktifSayfa]      = useState("dashboard");
  const [seciliHisse,     setSeciliHisse]     = useState(null);
  const [fiyatYukleniyor, setFiyatYukleniyor] = useState(false);
  const [sonGuncelleme,   setSonGuncelleme]   = useState(localStorage.getItem("son_guncelleme") || null);
  const [yukleniyor,      setYukleniyor]      = useState(true);
  const [snapshots,       setSnapshots]       = useState([]);
  const [arsiv,           setArsiv]           = useState([]);
  const [takipListe,      setTakipListe]      = useState([]);
  const [alarmGecmisi,    setAlarmGecmisi]    = useState([]);
  const [bildirimler,     setBildirimler]     = useState([]);

  // ── Firebase yüklemeleri ──────────────────────────────────────────────
  useEffect(() => { snapshotOku().then(setSnapshots);     }, []);
  useEffect(() => { arsivOku().then(setArsiv);            }, []);
  useEffect(() => { takipOku().then(setTakipListe);       }, []);
  useEffect(() => { alarmGecmisiOku().then(setAlarmGecmisi); }, []);

  // ── Otomatik fiyat güncelleme — borsa saatlerinde her 15 dakika ───────
  useEffect(() => {
    function borsaAcikMi() {
      const simdi = new Date();
      const gun = simdi.getDay();
      const toplamDakika = simdi.getHours() * 60 + simdi.getMinutes();
      return gun >= 1 && gun <= 5 && toplamDakika >= 600 && toplamDakika <= 1080;
    }
    const interval = setInterval(() => {
      if (borsaAcikMi()) fiyatlariCek();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Günlük snapshot ───────────────────────────────────────────────────
  useEffect(() => {
    if (yukleniyor || hisseler.length === 0) return;
    const bugun = new Date().toISOString().split("T")[0];
    if (snapshots[0]?.tarih === bugun) return;
    const toplamHisse  = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
    const toplamVarlik = toplamHisse + nakit.tlNakit + nakit.usdFon;
    const yeniSnapshot = {
      tarih: bugun,
      toplamVarlik: parseFloat(toplamVarlik.toFixed(0)),
      toplamHisse:  parseFloat(toplamHisse.toFixed(0)),
      tlNakit:      nakit.tlNakit,
      usdFon:       nakit.usdFon,
    };
    const yeniListe = [yeniSnapshot, ...snapshots].slice(0, 365);
    setSnapshots(yeniListe);
    snapshotYaz(yeniListe);
  }, [yukleniyor, hisseler]);

  // ── Firebase gerçek zamanlı dinleyici ────────────────────────────────
  useEffect(() => {
    let ilkYukleme = true;
    const timeout = setTimeout(() => setYukleniyor(false), 5000);

    async function baslat() {

      const portfoyDur = portfoyDinle((gelenHisseler) => {
        if (gelenHisseler && gelenHisseler.length > 0) setHisseler(gelenHisseler);
        if (ilkYukleme) { setYukleniyor(false); ilkYukleme = false; }
      });

      const nakitDur = nakitDinle((gelenNakit) => {
        if (gelenNakit) setNakit(gelenNakit);
      });

      return () => { portfoyDur(); nakitDur(); };
    }

    baslat();
    return () => clearTimeout(timeout);
  }, []);

  // ── Fiyat Çekme ───────────────────────────────────────────────────────
  async function fiyatlariCek(onBitti) {
    setFiyatYukleniyor(true);
    try {
      const tumIds   = [...new Set([...hisseler.map(h => h.id), ...takipListe.map(h => h.id)])];
      const yanit    = await fetch(`${PROXY_URL}/api/fiyat?semboller=${tumIds.join(",")}`);
      const veri     = await yanit.json();
      const yeniFiyatlar = {};
      let guncellenenSayisi = 0;

      const yeniHisseler = hisseler.map(h => {
        const d = veri[h.id];
        if (d?.fiyat) {
          guncellenenSayisi++;
          yeniFiyatlar[h.id] = d.fiyat;
          return { ...h, guncel: d.fiyat, oncekiKapanis: d.oncekiKapanis ?? h.oncekiKapanis ?? null, gunlukDegisim: d.gunlukDegisim ?? h.gunlukDegisim ?? null };
        }
        yeniFiyatlar[h.id] = h.guncel;
        return h;
      });

      // Takip listesi güncelle + alarm kontrol
      setTakipListe(prev => {
        if (!prev || prev.length === 0) return prev;
        const yeniTakip = prev.map(h => veri[h.id]?.fiyat
          ? { ...h, guncel: veri[h.id].fiyat.toString(), gunlukDegisim: veri[h.id].gunlukDegisim }
          : h
        );
        takipYaz(yeniTakip);

        const guncelZaman = Date.now();
        const yeniAlarmlar = [];

        yeniTakip.forEach(h => {
          const guncel = parseFloat(h.guncel);
          if (!guncel || !h.alarmlar) return;
          const { direncAl, destekAl, destekSat, direncSat } = h.alarmlar;

          const kontrol = (alarm, tip, tetiklendi) => {
            if (!alarm?.aktif || !alarm?.fiyat || !tetiklendi) return;
            const sonBirSaat = guncelZaman - 60 * 60 * 1000;
            const mevcutVar  = alarmGecmisi.some(a =>
              a.hisseId === h.id && a.tip === tip && new Date(a.zaman).getTime() > sonBirSaat
            );
            if (!mevcutVar) yeniAlarmlar.push({
              id: `${h.id}_${tip}_${guncelZaman}`,
              hisseId: h.id, hisseAd: h.ad, tip,
              alarmFiyat: alarm.fiyat, guncelFiyat: h.guncel,
              not: alarm.not || "", zaman: new Date().toISOString(), okundu: false,
            });
          };

          kontrol(direncAl,  "direncAl",  guncel >= parseFloat(direncAl?.fiyat));
          kontrol(destekAl,  "destekAl",  guncel <= parseFloat(destekAl?.fiyat));
          kontrol(destekSat, "destekSat", guncel <= parseFloat(destekSat?.fiyat));
          kontrol(direncSat, "direncSat", guncel >= parseFloat(direncSat?.fiyat));
        });

        if (yeniAlarmlar.length > 0) {
          setAlarmGecmisi(prev => {
            const guncellenmis = [...yeniAlarmlar, ...prev].slice(0, 200);
            alarmGecmisiYaz(guncellenmis);
            return guncellenmis;
          });
          setBildirimler(prev => [
            ...yeniAlarmlar.map(a => ({
              id: a.id,
              mesaj: `${a.hisseId} — ${
                a.tip === "direncAl"  ? "📈 Direnç AL"  :
                a.tip === "destekAl"  ? "💙 Destek AL"  :
                a.tip === "destekSat" ? "📉 Destek SAT" : "⚠️ Direnç SAT"
              } (${a.alarmFiyat} TL)`,
              renk: a.tip === "direncAl" ? "#22c55e" : a.tip === "destekAl" ? "#38bdf8" : a.tip === "destekSat" ? "#ef4444" : "#f59e0b",
              zaman: Date.now(),
            })),
            ...prev,
          ].slice(0, 5));
        }

        return yeniTakip;
      });

      setHisseler(yeniHisseler);
      portfoyYaz(yeniHisseler).catch(e => console.error("Fiyat yazma hatası:", e));
      const zaman = new Date().toLocaleString("tr-TR");
      setSonGuncelleme(zaman);
      localStorage.setItem("son_guncelleme", zaman);
      if (onBitti) onBitti(yeniFiyatlar);
      alert(`✅ ${guncellenenSayisi} hissenin fiyatı güncellendi!`);

    } catch (hata) {
      alert("❌ Fiyatlar çekilemedi: " + hata.message);
    } finally {
      setFiyatYukleniyor(false);
    }
  }

  // ── Yükleniyor / Giriş ekranları ─────────────────────────────────────
  if (yukleniyor) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f1117", flexDirection:"column", gap:"1rem" }}>
        <div style={{ fontSize:"2rem" }}>📈</div>
        <div style={{ color:"#64748b", fontSize:"0.9rem" }}>Veriler yükleniyor...</div>
      </div>
    );
  }
  if (!girisYapildi) {
    return <GirisEkrani onGiris={() => setGirisYapildi(true)} />;
  }

  // ── Yardımcı fonksiyonlar ─────────────────────────────────────────────
  function hisseGuncelle(id, yeniVeri) {
    setHisseler(prev => {
      const yeni = prev.map(h => h.id === id ? { ...h, ...yeniVeri } : h);
      portfoyYaz(yeni).catch(e => console.error("Yazma hatası:", e));
      return yeni;
    });
  }

  function hisseSil(id) {
    if (!window.confirm(`${id} hissesini portföyden çıkarmak istediğine emin misin? Arşive taşınacak.`)) return;
    const hisse = hisseler.find(h => h.id === id);
    if (hisse) {
      const { kz, kzYuzde } = karZararHesapla(hisse);
      const arsivKaydi = {
        ...hisse,
        cikisTarihi:    new Date().toISOString().split("T")[0],
        cikisKZ:        parseFloat(kz.toFixed(0)),
        cikisKZYuzde:   kzYuzde,
        cikisFiyati:    hisse.guncel,
      };
      setArsiv(prev => { const y = [arsivKaydi, ...prev]; arsivYaz(y); return y; });
    }
    setHisseler(prev => { const y = prev.filter(h => h.id !== id); portfoyYaz(y); return y; });
  }

  function veriIndir() {
    const veri = { hisseler, nakit, tarih: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(veri, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `bist-portfoy-${new Date().toLocaleDateString("tr-TR").replace(/\./g,"-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function veriYukleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const veri = JSON.parse(ev.target.result);
        if (veri.hisseler) { setHisseler(veri.hisseler); await portfoyYaz(veri.hisseler); }
        if (veri.nakit)    { setNakit(veri.nakit);       await nakitYaz(veri.nakit);      }
        alert("Veri başarıyla yüklendi ve Firebase'e kaydedildi!");
      } catch { alert("Dosya okunamadı."); }
    };
    reader.readAsText(file);
  }

  const toplamVarlik = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0) + nakit.tlNakit + nakit.usdFon;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Navbar
        aktif={aktifSayfa}
        setAktif={setAktifSayfa}
        onIndir={veriIndir}
        onYukle={veriYukleFile}
        sonGuncelleme={sonGuncelleme}
      />
      <main className="main">

        {aktifSayfa === "dashboard" && (
          <Dashboard
            hisseler={hisseler}
            nakit={nakit}
            onHisseClick={(h) => { setSeciliHisse(h); setAktifSayfa("detay"); }}
            sonGuncelleme={sonGuncelleme}
            takipListe={takipListe}
          />
        )}

        {aktifSayfa === "liste" && (
          <HisseListe
            hisseler={hisseler}
            nakit={nakit}
            onHisseClick={(h) => { setSeciliHisse(h); setAktifSayfa("detay"); }}
          />
        )}

        {aktifSayfa === "detay" && seciliHisse && (
          <HisseDetay
            hisse={hisseler.find(h => h.id === seciliHisse.id)}
            onGuncelle={hisseGuncelle}
            onGeri={() => setAktifSayfa("liste")}
            onSil={(id) => { hisseSil(id); setAktifSayfa("liste"); }}
            toplamVarlik={toplamVarlik}
          />
        )}

        {aktifSayfa === "takip" && (
          <TakipListesi
            liste={takipListe}
            setListe={(yeni) => { setTakipListe(yeni); takipYaz(yeni); }}
            alarmGecmisi={alarmGecmisi}
            onAlarmSil={(id) => {
              const yeni = alarmGecmisi.filter(a => a.id !== id);
              setAlarmGecmisi(yeni);
              alarmGecmisiYaz(yeni);
            }}
            onTumAlarmSil={() => { setAlarmGecmisi([]); alarmGecmisiYaz([]); }}
          />
        )}

        {aktifSayfa === "guncelle" && (
          <FiyatGuncelle
            hisseler={hisseler}
            onKaydet={(guncelHisseler) => {
              setHisseler(guncelHisseler);
              alert("Fiyatlar kaydedildi!");
              setAktifSayfa("liste");
            }}
            onIptal={() => setAktifSayfa("liste")}
            onFiyatCek={fiyatlariCek}
            fiyatYukleniyor={fiyatYukleniyor}
          />
        )}

        {aktifSayfa === "performans" && <PerformansTakibi snapshots={snapshots} />}
        {aktifSayfa === "rebalance"  && <Rebalancing hisseler={hisseler} nakit={nakit} />}
        {aktifSayfa === "gunce"      && <Gunce hisseler={hisseler} />}
        {aktifSayfa === "halkaarzi"  && <HalkaArz />}
        {aktifSayfa === "grafikler"  && <Grafikler hisseler={hisseler} nakit={nakit} />}
        {aktifSayfa === "takvim"     && <BilancTakvim hisseler={hisseler} onGuncelle={hisseGuncelle} />}
        {aktifSayfa === "nakit" && (
          <NakitYonetim
            nakit={nakit}
            onNakitGuncelle={(yeniNakit) => {
              setNakit(yeniNakit);
              nakitYaz(yeniNakit).catch(e => console.error("Nakit yazma hatası:", e));
            }}
          />
        )}

        {aktifSayfa === "arsiv" && (
          <ArsivSayfasi
            arsiv={arsiv}
            onSil={(idx) => {
              const yeni = arsiv.filter((_, j) => j !== idx);
              setArsiv(yeni);
              arsivYaz(yeni);
            }}
          />
        )}

        {aktifSayfa === "yeni" && (
          <HisseEkle
            onEkle={(yeniHisse) => {
              setHisseler(prev => {
                const yeni = [...prev, yeniHisse];
                portfoyYaz(yeni).catch(e => console.error("Yazma hatası:", e));
                return yeni;
              });
              setAktifSayfa("liste");
            }}
            onIptal={() => setAktifSayfa("liste")}
          />
        )}

      </main>

      {/* ── Uygulama içi bildirimler ── */}
      {bildirimler.length > 0 && (
        <div style={{
          position:"fixed", bottom:"1rem", right:"1rem", zIndex:1000,
          display:"flex", flexDirection:"column", gap:"6px", maxWidth:"320px"
        }}>
          {bildirimler.map(b => (
            <div key={b.id} style={{
              background:"#1e2330", border:`1px solid ${b.renk}`,
              borderRadius:"8px", padding:"10px 14px",
              boxShadow:"0 4px 16px rgba(0,0,0,0.4)",
              display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px"
            }}>
              <span style={{ fontSize:"0.82rem", color:"#f1f5f9" }}>{b.mesaj}</span>
              <button
                onClick={() => setBildirimler(prev => prev.filter(x => x.id !== b.id))}
                style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", flexShrink:0 }}>
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => setBildirimler([])}
            style={{ background:"#2d3748", border:"none", borderRadius:"6px", color:"#94a3b8", cursor:"pointer", padding:"4px", fontSize:"0.75rem" }}>
            Tümünü Kapat
          </button>
        </div>
      )}

    </div>
  );
}

// ─── HALKA ARZ ───────────────────────────────────────────────────────────
function HalkaArz() {
  const bos = {
    id: Date.now(), sirket: "", sembol: "", sektorFiyat: "",
    arzFiyati: "", tarih: "", degerleme: "", not: "",
    durum: "BEKLIYOR"
  };

  const [arzlar, setArzlar] = useState([]);
  const [arzYuklendi, setArzYuklendi] = useState(false);

  useEffect(() => {
    halkaArzOku().then(liste => {
      setArzlar(liste);
      setArzYuklendi(true);
    });
  }, []);

  useEffect(() => {
    if (arzYuklendi) halkaArzYaz(arzlar);
  }, [arzlar, arzYuklendi]);

  const [form, setForm]         = useState({ ...bos });
  const [formAcik, setFormAcik] = useState(false);

  function kaydet() {
    if (!form.sirket.trim()) { alert("Şirket adı zorunlu."); return; }
    const yeni = { ...form, id: Date.now() };
    const guncellenmis = [yeni, ...arzlar];
    setArzlar(guncellenmis);
    halkaArzYaz(guncellenmis).catch(e => console.error("Halka arz yazma hatası:", e));
    setForm({ ...bos });
    setFormAcik(false);
  }

  function sil(id) {
    if (!window.confirm("Bu kaydı silmek istediğine emin misin?")) return;
    const guncellenmis = arzlar.filter(a => a.id !== id);
    setArzlar(guncellenmis);
    halkaArzYaz(guncellenmis).catch(e => console.error("Halka arz silme hatası:", e));
  }

  function durumRenk(d) {
    if (d === "AL")       return "#22c55e";
    if (d === "ALMA")     return "#ef4444";
    if (d === "BEKLIYOR") return "#f59e0b";
    return "#64748b";
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 className="sayfa-baslik" style={{ margin: 0 }}>🏦 Halka Arz Takibi</h2>
        <button className="btn btn-mavi" onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? "İptal" : "+ Yeni Arz Ekle"}
        </button>
      </div>

      {formAcik && (
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <h3 className="panel-baslik">Yeni Halka Arz</h3>
          <div className="form-grid" style={{ marginBottom: "1rem" }}>
            <label className="form-label">
              Şirket Adı *
              <input className="input" type="text"
                value={form.sirket}
                onChange={e => setForm({ ...form, sirket: e.target.value })} />
            </label>
            <label className="form-label">
              Sembol
              <input className="input" type="text" placeholder="örn: THYAO"
                value={form.sembol}
                onChange={e => setForm({ ...form, sembol: e.target.value.toUpperCase() })} />
            </label>
            <label className="form-label">
              Arz Fiyatı (TL)
              <input className="input" type="number" step="0.01"
                value={form.arzFiyati}
                onChange={e => setForm({ ...form, arzFiyati: e.target.value })} />
            </label>
            <label className="form-label">
              Tarih
              <input className="input" type="date"
                value={form.tarih}
                onChange={e => setForm({ ...form, tarih: e.target.value })} />
            </label>
            <label className="form-label">
              Sektör / Fiyat Aralığı
              <input className="input" type="text" placeholder="örn: Teknoloji / 10-12 TL"
                value={form.sektorFiyat}
                onChange={e => setForm({ ...form, sektorFiyat: e.target.value })} />
            </label>
            <label className="form-label">
              Karar
              <select className="input" value={form.durum}
                onChange={e => setForm({ ...form, durum: e.target.value })}>
                <option value="BEKLIYOR">BEKLIYOR</option>
                <option value="AL">AL</option>
                <option value="ALMA">ALMA</option>
                <option value="ALINDI">ALINDI</option>
                <option value="CIKIS">ÇIKIŞ YAPILDI</option>
              </select>
            </label>
          </div>
          <label className="form-label" style={{ display: "block", marginBottom: "1rem" }}>
            Değerlendirme Notu
            <textarea className="input-alan" rows={3}
              placeholder="Neden al veya alma? Sektör değerlendirmen..."
              value={form.degerleme}
              onChange={e => setForm({ ...form, degerleme: e.target.value })} />
          </label>
          <button className="btn btn-yesil" onClick={kaydet}>✓ Kaydet</button>
        </div>
      )}

      {arzlar.length === 0 && !formAcik && (
        <div className="panel" style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
          Henüz halka arz kaydı yok. "+ Yeni Arz Ekle" ile başla.
        </div>
      )}

      {arzlar.map(a => (
        <div key={a.id} className="panel" style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                <b style={{ fontSize: "1rem" }}>{a.sirket}</b>
                {a.sembol && (
                  <span className="kat-badge" style={{ background: "#1d4ed8" }}>{a.sembol}</span>
                )}
                <span className="kat-badge" style={{ background: durumRenk(a.durum) }}>{a.durum}</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {a.tarih && `📅 ${a.tarih}`}
                {a.arzFiyati && `  ·  💰 ${a.arzFiyati} TL`}
                {a.sektorFiyat && `  ·  ${a.sektorFiyat}`}
              </div>
              {a.degerleme && (
                <p style={{ marginTop: "6px", fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.5" }}>
                  {a.degerleme}
                </p>
              )}
            </div>
            <button
              onClick={() => sil(a.id)}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1rem", padding: "4px" }}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── GRAFİKLER ───────────────────────────────────────────────────────────
function Grafikler({ hisseler, nakit }) {
  const toplamVarlik = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0)
    + nakit.tlNakit + nakit.usdFon;
  const toplamHisse = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);

  // Kategori verileri
  const katRenkler = { CORE: "#22c55e", SAT: "#f59e0b", TRADE: "#64748b", NAKİT: "#0ea5e9" };
  const katData = [
    ...["CORE", "SAT", "TRADE"].map(kat => ({
      name: kat,
      deger: hisseler.filter(h => h.kategori === kat).reduce((t, h) => t + h.guncel * h.adet, 0),
      sayi: hisseler.filter(h => h.kategori === kat).length,
    })),
    { name: "NAKİT", deger: nakit.tlNakit + nakit.usdFon, sayi: 0 }
  ].map(d => ({ ...d, yuzde: ((d.deger / toplamVarlik) * 100).toFixed(1) }));

  // K/Z verileri — sıralı
  const kzData = [...hisseler]
    .map(h => { const { kz } = karZararHesapla(h); return { id: h.id, kz }; })
    .sort((a, b) => b.kz - a.kz);

  // En büyük 10 pozisyon
  const pozData = [...hisseler]
    .sort((a, b) => (b.guncel * b.adet) - (a.guncel * a.adet))
    .slice(0, 10)
    .map(h => ({ id: h.id, deger: h.guncel * h.adet, kat: h.kategori }));

  const maxPoz = Math.max(...pozData.map(d => d.deger));
  const maxKZ  = Math.max(...kzData.map(d => Math.abs(d.kz)));

  return (
    <div>
      <h2 className="sayfa-baslik">📈 Grafikler</h2>

      {/* ── Pasta: Kategori ── */}
      <div className="g2" style={{ marginBottom: "1.5rem" }}>
        <div className="panel">
          <h3 className="panel-baslik">Kategori Dağılımı</h3>
          <PastaGrafik data={katData} renkler={katRenkler} />
        </div>

        <div className="panel">
          <h3 className="panel-baslik">Aksiyon Dağılımı</h3>
          <PastaGrafik
            data={["TUT","EKLE","SAT"].map(ak => ({
              name: ak,
              deger: hisseler.filter(h => h.aksiyon === ak).length,
              yuzde: ((hisseler.filter(h => h.aksiyon === ak).length / hisseler.length) * 100).toFixed(1)
            })).filter(d => d.deger > 0)}
            renkler={{ TUT: "#94a3b8", EKLE: "#22c55e", SAT: "#ef4444" }}
            birim="adet"
          />
        </div>
      </div>

      {/* ── Bar: En büyük pozisyonlar ── */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3 className="panel-baslik">En Büyük 10 Pozisyon</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          {pozData.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "60px", fontSize: "0.8rem", fontWeight: 700, color: "#f1f5f9", flexShrink: 0 }}>
                {d.id}
              </span>
              <div style={{ flex: 1, background: "#2d3748", borderRadius: "4px", height: "22px", overflow: "hidden" }}>
                <div style={{
                  width: `${(d.deger / maxPoz) * 100}%`,
                  background: katRenkler[d.kat] || "#3b82f6",
                  height: "100%", borderRadius: "4px",
                  transition: "width 0.4s"
                }} />
              </div>
              <span style={{ width: "90px", fontSize: "0.8rem", color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
                {(d.deger / 1000).toFixed(1)}K TL
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bar: K/Z ── */}
      <div className="panel">
        <h3 className="panel-baslik">Hisse Bazlı Kâr / Zarar</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          {kzData.map(d => {
            const pos = d.kz >= 0;
            const genislik = maxKZ > 0 ? (Math.abs(d.kz) / maxKZ) * 100 : 0;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "60px", fontSize: "0.8rem", fontWeight: 700, color: "#f1f5f9", flexShrink: 0 }}>
                  {d.id}
                </span>
                <div style={{ flex: 1, background: "#2d3748", borderRadius: "4px", height: "22px", overflow: "hidden" }}>
                  <div style={{
                    width: `${genislik}%`,
                    background: pos ? "#22c55e" : "#ef4444",
                    height: "100%", borderRadius: "4px",
                    transition: "width 0.4s"
                  }} />
                </div>
                <span style={{
                  width: "90px", fontSize: "0.8rem", textAlign: "right", flexShrink: 0,
                  color: pos ? "#22c55e" : "#ef4444", fontWeight: 600
                }}>
                  {pos ? "+" : ""}{(d.kz / 1000).toFixed(1)}K TL
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PASTA GRAFİK (CSS) ───────────────────────────────────────────────────
function PastaGrafik({ data, renkler, birim = "TL" }) {
  const toplam = data.reduce((t, d) => t + parseFloat(d.deger), 0);
  if (toplam === 0) return <p style={{ color: "#64748b" }}>Veri yok.</p>;

  // SVG pasta
  let baslacAci = -90;
  const dilimler = data.map(d => {
    const yuzde = (d.deger / toplam) * 100;
    const aci   = (yuzde / 100) * 360;
    const baslangic = baslacAci;
    baslacAci += aci;
    return { ...d, yuzde: yuzde.toFixed(1), aci, baslangic };
  });

  function polarToXY(cx, cy, r, derece) {
    const rad = (derece * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function dilimYolu(cx, cy, r, baslangic, bitis) {
    const b = polarToXY(cx, cy, r, baslangic);
    const e = polarToXY(cx, cy, r, bitis);
    const buyukArc = bitis - baslangic > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${b.x} ${b.y} A ${r} ${r} 0 ${buyukArc} 1 ${e.x} ${e.y} Z`;
  }

  return (
    <div>
      <svg viewBox="0 0 200 200" style={{ width: "180px", display: "block", margin: "0 auto 12px" }}>
        {dilimler.map((d, i) => (
          <path
            key={i}
            d={dilimYolu(100, 100, 80, d.baslangic, d.baslangic + d.aci - 0.5)}
            fill={renkler[d.name] || "#64748b"}
            opacity={0.9}
          />
        ))}
        <circle cx="100" cy="100" r="40" fill="#1e2330" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {dilimler.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
            <span style={{
              width: "10px", height: "10px", borderRadius: "2px", flexShrink: 0,
              background: renkler[d.name] || "#64748b"
            }} />
            <span style={{ color: "#94a3b8", flex: 1 }}>{d.name}</span>
            <span style={{ color: "#f1f5f9", fontWeight: 600 }}>%{d.yuzde}</span>
            {d.sayi > 0 && <span style={{ color: "#64748b" }}>({d.sayi} hisse)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BİLANÇO TAKVİMİ ─────────────────────────────────────────────────────
function BilancTakvim({ hisseler, onGuncelle }) {
  const [bilancTarihler, setBilancTarihler] = useState({});
  const [bilancYuklendi, setBilancYuklendi] = useState(false);

  useEffect(() => {
    bilancOku().then(t => {
      setBilancTarihler(t);
      setBilancYuklendi(true);
    });
  }, []);

  useEffect(() => {
    if (bilancYuklendi) bilancYaz(bilancTarihler);
  }, [bilancTarihler, bilancYuklendi]);
  
  const [secili, setSecili] = useState(null);
  const [tarihForm, setTarihForm] = useState("");

  // Tüm bilanço tarihlerini topla
  const etkinlikler = hisseler
    .filter(h => h.bilancTarih)
    .map(h => ({ ...h, tarihObj: new Date(h.bilancTarih) }))
    .sort((a, b) => a.tarihObj - b.tarihObj);

  const bugun = new Date();
  const yaklasan = etkinlikler.filter(h => {
    const fark = (h.tarihObj - bugun) / (1000 * 60 * 60 * 24);
    return fark >= 0 && fark <= 30;
  });
  const gecmis = etkinlikler.filter(h => h.tarihObj < bugun);
  const gelecek = etkinlikler.filter(h => {
    const fark = (h.tarihObj - bugun) / (1000 * 60 * 60 * 24);
    return fark > 30;
  });

  function tarihKaydet() {
    if (!secili || !tarihForm) return;
    const yeni = { ...bilancTarihler, [secili]: tarihForm };
    setBilancTarihler(yeni);
    onGuncelle(secili, { bilancTarih: tarihForm });
    setSecili(null);
    setTarihForm("");
  }

  function tarihSil(id) {
    const yeni = { ...bilancTarihler };
    delete yeni[id];
    setBilancTarihler(yeni);
    onGuncelle(id, { bilancTarih: "" });
  }

  function gunFarki(tarih) {
    const fark = Math.round((new Date(tarih) - bugun) / (1000 * 60 * 60 * 24));
    if (fark < 0) return `${Math.abs(fark)} gün önce`;
    if (fark === 0) return "Bugün!";
    return `${fark} gün sonra`;
  }

  return (
    <div>
      <h2 className="sayfa-baslik">📅 Bilanço Takvimi</h2>

      {/* Tarih Ekleme */}
      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h3 className="panel-baslik">Bilanço Tarihi Ekle / Güncelle</h3>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="form-label" style={{ flex: "1", minWidth: "160px" }}>
            Hisse Seç
            <select className="input" value={secili || ""}
              onChange={e => setSecili(e.target.value)}>
              <option value="">— Seç —</option>
              {hisseler.map(h => (
                <option key={h.id} value={h.id}>
                  {h.id} — {h.ad}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label" style={{ flex: "1", minWidth: "160px" }}>
            Bilanço Tarihi
            <input className="input" type="date"
              value={tarihForm}
              onChange={e => setTarihForm(e.target.value)} />
          </label>
          <button className="btn btn-yesil" onClick={tarihKaydet}
            style={{ marginBottom: "1px" }}>
            ✓ Kaydet
          </button>
        </div>
      </div>

      {/* Yaklaşan — 30 gün içinde */}
      {yaklasan.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "#f59e0b" }}>
          <h3 className="panel-baslik" style={{ color: "#f59e0b" }}>
            ⚡ Yaklaşan Bilanço ({yaklasan.length} hisse — 30 gün içinde)
          </h3>
          {yaklasan.map(h => (
            <TakvimSatir key={h.id} h={h} gunFarki={gunFarki} onSil={tarihSil} renk="#f59e0b" />
          ))}
        </div>
      )}

      {/* Gelecek */}
      {gelecek.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik">📆 Gelecek Bilanço Tarihleri</h3>
          {gelecek.map(h => (
            <TakvimSatir key={h.id} h={h} gunFarki={gunFarki} onSil={tarihSil} renk="#3b82f6" />
          ))}
        </div>
      )}

      {/* Geçmiş */}
      {gecmis.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik" style={{ color: "#64748b" }}>✓ Geçmiş Bilançolar</h3>
          {gecmis.map(h => (
            <TakvimSatir key={h.id} h={h} gunFarki={gunFarki} onSil={tarihSil} renk="#64748b" />
          ))}
        </div>
      )}

      {/* Tarihi olmayan hisseler */}
      <div className="panel">
        <h3 className="panel-baslik">📋 Tarihi Girilmemiş Hisseler</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {hisseler.filter(h => !h.bilancTarih).map(h => (
            <button key={h.id}
              className="filtre-btn"
              onClick={() => setSecili(h.id)}
              title="Tarih eklemek için tıkla"
            >
              {h.id}
            </button>
          ))}
        </div>
        {hisseler.filter(h => !h.bilancTarih).length === 0 && (
          <p style={{ color: "#22c55e", fontSize: "0.85rem" }}>
            ✓ Tüm hisselerin tarihi girilmiş.
          </p>
        )}
      </div>
    </div>
  );
}

function TakvimSatir({ h, gunFarki, onSil, renk }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.5rem 0", borderBottom: "1px solid #1a2035"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span className="kat-badge" style={{ background: renk }}>{h.id}</span>
        <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>{h.ad}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
          {new Date(h.bilancTarih).toLocaleDateString("tr-TR")}
        </span>
        <span style={{ fontSize: "0.8rem", color: renk, fontWeight: 600 }}>
          {gunFarki(h.bilancTarih)}
        </span>
        <button onClick={() => onSil(h.id)}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── GİRİŞ EKRANI ────────────────────────────────────────────────────────
function GirisEkrani({ onGiris }) {
  const [sifre, setSifre]     = useState("");
  const [hata, setHata]       = useState("");
  const [deneme, setDeneme]   = useState(0);
  const [kilitli, setKilitli] = useState(false);

  async function girisYap() {
    if (kilitli) return;

    const hash = await hashle(sifre);
    if (hash === SIFRE_HASH) {
      sessionStorage.setItem("bist_giris", "1");
      setHata("");
      setTimeout(() => {
        onGiris();
      }, 50);
    } else {
      const yeniDeneme = deneme + 1;
      setDeneme(yeniDeneme);
      setSifre("");
      if (yeniDeneme >= 5) {
        setKilitli(true);
        setHata("Çok fazla hatalı giriş. 30 saniye bekle.");
        setTimeout(() => {
          setKilitli(false);
          setDeneme(0);
          setHata("");
        }, 30000);
      } else {
        setHata(`Yanlış şifre. ${5 - yeniDeneme} deneme hakkın kaldı.`);
      }
    }
  }

  function enterKontrol(e) {
    if (e.key === "Enter") girisYap();
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#0f1117"
    }}>
      <div style={{
        background: "#1e2330", border: "1px solid #2d3748",
        borderRadius: "16px", padding: "2.5rem 2rem",
        width: "100%", maxWidth: "360px",
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📈</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f1f5f9" }}>
            BIST Portföy
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "4px" }}>
            Kişisel yatırım yönetim sistemi
          </p>
        </div>

        <label className="form-label" style={{ marginBottom: "1rem", display: "block" }}>
          Şifre
          <input
            className="input"
            type="password"
            placeholder="Şifrenizi girin"
            value={sifre}
            onChange={e => setSifre(e.target.value)}
            onKeyDown={enterKontrol}
            disabled={kilitli}
            autoFocus
            style={{ marginTop: "6px", fontSize: "1rem", letterSpacing: "0.1em" }}
          />
        </label>

        {hata && (
          <div style={{
            background: "#7f1d1d33", border: "1px solid #ef444444",
            borderRadius: "8px", padding: "0.6rem 0.75rem",
            color: "#fca5a5", fontSize: "0.82rem", marginBottom: "1rem"
          }}>
            {hata}
          </div>
        )}

        <button
          className="btn btn-mavi"
          onClick={girisYap}
          disabled={kilitli}
          style={{ width: "100%", padding: "0.65rem", fontSize: "0.95rem" }}
        >
          {kilitli ? "⏳ Bekleniyor..." : "Giriş Yap →"}
        </button>

        <p style={{
          textAlign: "center", marginTop: "1.5rem",
          fontSize: "0.75rem", color: "#475569"
        }}>
          Güvenli · Veriler sadece bu cihazda saklanır
        </p>
      </div>
    </div>
  );
}

// ─── NAKİT YÖNETİM ───────────────────────────────────────────────────────
function NakitYonetim({ nakit, onNakitGuncelle }) {
  const [islemler, setIslemler] = useState([]);
  const [islemYuklendi, setIslemYuklendi] = useState(false);

  useEffect(() => {
    islemlerOku().then(liste => {
      setIslemler(liste);
      setIslemYuklendi(true);
    });
  }, []);

  useEffect(() => {
    if (islemYuklendi) islemlerYaz(islemler);
  }, [islemler, islemYuklendi]);

  const [form, setForm] = useState({
    tip: "NAKIT_GIRIS",
    tutar: "",
    aciklama: "",
    tarih: new Date().toISOString().split("T")[0]
  });

  const [bakiyeForm, setBakiyeForm] = useState({
    tlNakit: nakit.tlNakit,
    usdFon: nakit.usdFon,
    aylikEkleme: nakit.aylikEkleme
  });

  const [bakiyeDuzenle, setBakiyeDuzenle] = useState(false);

  function islemEkle() {
    if (!form.tutar || parseFloat(form.tutar) <= 0) {
      alert("Geçerli bir tutar gir.");
      return;
    }

    const tutar = parseFloat(form.tutar);
    const yeniIslem = {
      id: Date.now(),
      tip: form.tip,
      tutar,
      aciklama: form.aciklama,
      tarih: form.tarih,
    };

    // Bakiyeyi güncelle
    let yeniNakit = { ...nakit };
    if (form.tip === "NAKIT_GIRIS")   yeniNakit.tlNakit += tutar;
    if (form.tip === "NAKIT_CIKIS")   yeniNakit.tlNakit -= tutar;
    if (form.tip === "HISSE_ALIM")    yeniNakit.tlNakit -= tutar;
    if (form.tip === "HISSE_SATIM")   yeniNakit.tlNakit += tutar;
    if (form.tip === "USD_GIRIS")     yeniNakit.usdFon  += tutar;
    if (form.tip === "USD_CIKIS")     yeniNakit.usdFon  -= tutar;
    if (form.tip === "AYLIK_EKLEME")  yeniNakit.tlNakit += tutar;

    const yeniIslemler = [yeniIslem, ...islemler];
    setIslemler(yeniIslemler);
    
    onNakitGuncelle(yeniNakit);
    setForm({ ...form, tutar: "", aciklama: "" });
  }

  function bakiyeKaydet() {
    onNakitGuncelle({
      ...nakit,
      tlNakit:      parseFloat(bakiyeForm.tlNakit)      || 0,
      usdFon:       parseFloat(bakiyeForm.usdFon)       || 0,
      aylikEkleme:  parseFloat(bakiyeForm.aylikEkleme)  || 0,
    });
    setBakiyeDuzenle(false);
  }

  function islemSil(id) {
    if (!window.confirm("Bu işlemi silmek istediğine emin misin?")) return;
    const yeni = islemler.filter(i => i.id !== id);
    setIslemler(yeni);
    islemlerYaz(yeni).catch(e => console.error("İşlem silme hatası:", e));
  }

  function tipRenk(tip) {
    if (["NAKIT_GIRIS","HISSE_SATIM","USD_GIRIS","AYLIK_EKLEME"].includes(tip)) return "#22c55e";
    return "#ef4444";
  }

  function tipEtiket(tip) {
    const etiketler = {
      NAKIT_GIRIS:  "💵 Nakit Giriş",
      NAKIT_CIKIS:  "💸 Nakit Çıkış",
      HISSE_ALIM:   "📈 Hisse Alım",
      HISSE_SATIM:  "📉 Hisse Satım",
      USD_GIRIS:    "💲 USD Giriş",
      USD_CIKIS:    "💲 USD Çıkış",
      AYLIK_EKLEME: "📅 Aylık Ekleme",
    };
    return etiketler[tip] || tip;
  }

  // Özet hesapla
  const toplamGiris = islemler
    .filter(i => ["NAKIT_GIRIS","HISSE_SATIM","AYLIK_EKLEME"].includes(i.tip))
    .reduce((t, i) => t + i.tutar, 0);
  const toplamCikis = islemler
    .filter(i => ["NAKIT_CIKIS","HISSE_ALIM"].includes(i.tip))
    .reduce((t, i) => t + i.tutar, 0);

  return (
    <div>
      <h2 className="sayfa-baslik">💰 Nakit Yönetimi</h2>

      {/* Bakiye Kartları */}
      <div className="kart-grid" style={{ marginBottom: "1rem" }}>
        <div className="kart">
          <div className="kart-label">TL Nakit</div>
          <div className="kart-deger yesil">
            {nakit.tlNakit.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">USD Fon</div>
          <div className="kart-deger" style={{ color: "#38bdf8" }}>
            {nakit.usdFon.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Aylık Ekleme Hedefi</div>
          <div className="kart-deger">
            {nakit.aylikEkleme.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Toplam Nakit</div>
          <div className="kart-deger">
            {(nakit.tlNakit + nakit.usdFon).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
      </div>

      {/* Bakiye Düzenle */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="panel-baslik" style={{ margin: 0 }}>Bakiye Düzenle</h3>
          <button className="btn btn-gri" style={{ fontSize: "0.8rem" }}
            onClick={() => setBakiyeDuzenle(!bakiyeDuzenle)}>
            {bakiyeDuzenle ? "İptal" : "✏️ Düzenle"}
          </button>
        </div>
        {bakiyeDuzenle && (
          <div style={{ marginTop: "1rem" }}>
            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <label className="form-label">
                TL Nakit
                <input className="input" type="number" step="1"
                  value={bakiyeForm.tlNakit}
                  onChange={e => setBakiyeForm({ ...bakiyeForm, tlNakit: e.target.value })} />
              </label>
              <label className="form-label">
                USD Fon (TL karşılığı)
                <input className="input" type="number" step="1"
                  value={bakiyeForm.usdFon}
                  onChange={e => setBakiyeForm({ ...bakiyeForm, usdFon: e.target.value })} />
              </label>
              <label className="form-label">
                Aylık Ekleme Hedefi
                <input className="input" type="number" step="1"
                  value={bakiyeForm.aylikEkleme}
                  onChange={e => setBakiyeForm({ ...bakiyeForm, aylikEkleme: e.target.value })} />
              </label>
            </div>
            <button className="btn btn-yesil" onClick={bakiyeKaydet}>✓ Kaydet</button>
          </div>
        )}
      </div>

      {/* Yeni İşlem */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">+ Yeni İşlem Ekle</h3>
        <div className="form-grid" style={{ marginBottom: "1rem" }}>
          <label className="form-label">
            İşlem Tipi
            <select className="input" value={form.tip}
              onChange={e => setForm({ ...form, tip: e.target.value })}>
              <option value="NAKIT_GIRIS">💵 Nakit Giriş</option>
              <option value="NAKIT_CIKIS">💸 Nakit Çıkış</option>
              <option value="HISSE_ALIM">📈 Hisse Alım</option>
              <option value="HISSE_SATIM">📉 Hisse Satım</option>
              <option value="USD_GIRIS">💲 USD Fon Giriş</option>
              <option value="USD_CIKIS">💲 USD Fon Çıkış</option>
              <option value="AYLIK_EKLEME">📅 Aylık Ekleme</option>
            </select>
          </label>
          <label className="form-label">
            Tutar (TL)
            <input className="input" type="number" step="1" placeholder="0"
              value={form.tutar}
              onChange={e => setForm({ ...form, tutar: e.target.value })} />
          </label>
          <label className="form-label">
            Tarih
            <input className="input" type="date"
              value={form.tarih}
              onChange={e => setForm({ ...form, tarih: e.target.value })} />
          </label>
          <label className="form-label">
            Açıklama
            <input className="input" type="text" placeholder="örn: ASTOR alım 100 lot"
              value={form.aciklama}
              onChange={e => setForm({ ...form, aciklama: e.target.value })} />
          </label>
        </div>
        <button className="btn btn-yesil" onClick={islemEkle}>+ İşlem Ekle</button>
      </div>

      {/* Özet */}
      {islemler.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik">📊 İşlem Özeti</h3>
          <div className="kart-grid">
            <div className="kart">
              <div className="kart-label">Toplam Giriş</div>
              <div className="kart-deger yesil">
                +{toplamGiris.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>
            <div className="kart">
              <div className="kart-label">Toplam Çıkış</div>
              <div className="kart-deger kirmizi">
                -{toplamCikis.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>
            <div className="kart">
              <div className="kart-label">Net Akış</div>
              <div className={`kart-deger ${toplamGiris - toplamCikis >= 0 ? "yesil" : "kirmizi"}`}>
                {(toplamGiris - toplamCikis).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </div>
            </div>
            <div className="kart">
              <div className="kart-label">İşlem Sayısı</div>
              <div className="kart-deger">{islemler.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* İşlem Geçmişi */}
      <div className="panel">
        <h3 className="panel-baslik">📋 İşlem Geçmişi</h3>
        {islemler.length === 0 && (
          <p style={{ color: "#64748b" }}>Henüz işlem yok.</p>
        )}
        {islemler.map(i => (
          <div key={i.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.6rem 0", borderBottom: "1px solid #1a2035"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b", width: "80px" }}>
                {new Date(i.tarih).toLocaleDateString("tr-TR")}
              </span>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                {tipEtiket(i.tip)}
              </span>
              {i.aciklama && (
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>— {i.aciklama}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontWeight: 700, color: tipRenk(i.tip) }}>
                {["NAKIT_GIRIS","HISSE_SATIM","AYLIK_EKLEME","USD_GIRIS"].includes(i.tip) ? "+" : "-"}
                {i.tutar.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
              </span>
              <button onClick={() => islemSil(i.id)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SON İŞLEMLER ────────────────────────────────────────────────────────
function SonIslemler() {
  const [islemler, setIslemler] = useState([]);

  useEffect(() => {
    islemlerOku().then(setIslemler);
  }, []);

  const son3 = islemler.slice(0, 3);

  const tipEtiket = (tip) => {
    const e = {
      NAKIT_GIRIS: "💵 Nakit Giriş", NAKIT_CIKIS: "💸 Nakit Çıkış",
      HISSE_ALIM: "📈 Hisse Alım",   HISSE_SATIM: "📉 Hisse Satım",
      USD_GIRIS: "💲 USD Giriş",     USD_CIKIS: "💲 USD Çıkış",
      AYLIK_EKLEME: "📅 Aylık Ekleme"
    };
    return e[tip] || tip;
  };

  const pozitif = (tip) =>
    ["NAKIT_GIRIS","HISSE_SATIM","AYLIK_EKLEME","USD_GIRIS"].includes(tip);

  if (son3.length === 0) return (
    <p style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "0.75rem" }}>
      Henüz işlem yok — 💰 Nakit sayfasından ekle.
    </p>
  );

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "6px" }}>
        Son İşlemler
      </div>
      {son3.map(i => (
        <div key={i.id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0.4rem 0", borderBottom: "1px solid #1a2035", fontSize: "0.82rem"
        }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ color: "#64748b" }}>
              {new Date(i.tarih).toLocaleDateString("tr-TR")}
            </span>
            <span style={{ color: "#94a3b8" }}>{tipEtiket(i.tip)}</span>
            {i.aciklama && (
              <span style={{ color: "#64748b" }}>— {i.aciklama}</span>
            )}
          </div>
          <span style={{ fontWeight: 700, color: pozitif(i.tip) ? "#22c55e" : "#ef4444" }}>
            {pozitif(i.tip) ? "+" : "-"}
            {i.tutar.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── TAKİP LİSTESİ ───────────────────────────────────────────────────────
function TakipListesi({ liste, setListe, alarmGecmisi = [], onAlarmSil, onTumAlarmSil }) {
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);

  const bosForm = {
    id: "", ad: "", guncel: "", sektör: "", kategori: "CORE",
    tez: "", not: "",
    alarmlar: {
      direncAl:   { fiyat: "", aktif: true, not: "" },
      destekAl:   { fiyat: "", aktif: true, not: "" },
      destekSat:  { fiyat: "", aktif: true, not: "" },
      direncSat:  { fiyat: "", aktif: true, not: "" },
    }
  };
  const [form, setForm] = useState({ ...bosForm });

  function kaydet() {
    if (!form.id.trim() || !form.ad.trim()) {
      alert("Sembol ve şirket adı zorunlu.");
      return;
    }
    let yeniListe;
    if (duzenlenen !== null) {
      yeniListe = liste.map((h, i) => i === duzenlenen ? { ...form } : h);
      setDuzenlenen(null);
    } else {
      yeniListe = [...liste, { ...form, id: form.id.toUpperCase().trim() }];
    }
    setListe(yeniListe);
    setForm({ ...bosForm });
    setFormAcik(false);
  }

  function sil(idx) {
    if (!window.confirm("Bu takip kaydını silmek istediğine emin misin?")) return;
    setListe(prev => prev.filter((_, i) => i !== idx));
  }

  function duzenle(idx) {
    const h = liste[idx];
    setForm({
      ...bosForm,
      ...h,
      alarmlar: {
        direncAl:   { fiyat: "", aktif: true, not: "", ...h.alarmlar?.direncAl },
        destekAl:   { fiyat: "", aktif: true, not: "", ...h.alarmlar?.destekAl },
        destekSat:  { fiyat: "", aktif: true, not: "", ...h.alarmlar?.destekSat },
        direncSat:  { fiyat: "", aktif: true, not: "", ...h.alarmlar?.direncSat },
      }
    });
    setDuzenlenen(idx);
    setFormAcik(true);
  }

  function alarmGuncelle(key, alan, deger) {
    setForm(prev => ({
      ...prev,
      alarmlar: {
        ...prev.alarmlar,
        [key]: { ...prev.alarmlar?.[key], [alan]: deger }
      }
    }));
  }

  function alarmKontrol(h) {
    const alarml = [];
    const guncel = parseFloat(h.guncel);
    if (!guncel || !h.alarmlar) return alarml;
    const { direncAl, destekAl, destekSat, direncSat } = h.alarmlar;
    if (direncAl?.aktif && direncAl?.fiyat && guncel >= parseFloat(direncAl.fiyat))
      alarml.push({ tip: "direncAl", mesaj: `${h.id} direnç kırıldı — AL sinyali (${direncAl.fiyat} TL)`, renk: "#22c55e" });
    if (destekAl?.aktif && destekAl?.fiyat && guncel <= parseFloat(destekAl.fiyat))
      alarml.push({ tip: "destekAl", mesaj: `${h.id} destek seviyesinde — AL fırsatı (${destekAl.fiyat} TL)`, renk: "#38bdf8" });
    if (destekSat?.aktif && destekSat?.fiyat && guncel <= parseFloat(destekSat.fiyat))
      alarml.push({ tip: "destekSat", mesaj: `${h.id} destek kırıldı — SAT sinyali (${destekSat.fiyat} TL)`, renk: "#ef4444" });
    if (direncSat?.aktif && direncSat?.fiyat && guncel >= parseFloat(direncSat.fiyat))
      alarml.push({ tip: "direncSat", mesaj: `${h.id} dirençte zorlanıyor — SAT değerlendir (${direncSat.fiyat} TL)`, renk: "#f59e0b" });
    return alarml;
  }

  const ALARM_TANIMLARI = [
    { key: "direncAl",  label: "📈 Direnç AL",  aciklama: "Fiyat bu seviyeyi yukarı kırarsa AL sinyali",   renk: "#22c55e" },
    { key: "destekAl",  label: "💙 Destek AL",  aciklama: "Fiyat bu seviyeye gelince AL fırsatı",           renk: "#38bdf8" },
    { key: "destekSat", label: "📉 Destek SAT", aciklama: "Fiyat bu seviyeyi aşağı kırarsa SAT sinyali",   renk: "#ef4444" },
    { key: "direncSat", label: "⚠️ Direnç SAT", aciklama: "Fiyat bu seviyeye gelince SAT değerlendir",     renk: "#f59e0b" },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <h2 className="sayfa-baslik" style={{ margin:0 }}>🔭 Takip Listesi</h2>
        <button className="btn btn-mavi" onClick={() => { setFormAcik(!formAcik); setDuzenlenen(null); setForm({ ...bosForm }); }}>
          {formAcik ? "İptal" : "+ Hisse Ekle"}
        </button>
      </div>

      {/* Alarm Özeti */}
      {liste.some(h => alarmKontrol(h).length > 0) && (
        <div className="panel" style={{ marginBottom:"1rem", borderColor:"#f59e0b" }}>
          <h3 className="panel-baslik" style={{ color:"#f59e0b" }}>🔔 Aktif Alarmlar</h3>
          {liste.flatMap(h => alarmKontrol(h)).map((a, i) => (
            <div key={i} className="acil-satir">
              <span style={{ color: a.renk, fontWeight: 600 }}>{a.mesaj}</span>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {formAcik && (
        <div className="panel" style={{ marginBottom:"1.25rem" }}>
          <h3 className="panel-baslik">
            {duzenlenen !== null ? "Kaydı Düzenle" : "Yeni Takip Hissesi"}
          </h3>

          {/* Temel Bilgiler */}
          <div className="form-grid" style={{ marginBottom:"1rem" }}>
            <label className="form-label">
              Sembol *
              <input className="input" type="text" placeholder="örn: THYAO"
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value.toUpperCase() })} />
            </label>
            <label className="form-label">
              Şirket Adı *
              <input className="input" type="text"
                value={form.ad}
                onChange={e => setForm({ ...form, ad: e.target.value })} />
            </label>
            <label className="form-label">
              Güncel Fiyat
              <input className="input" type="number" step="0.01"
                value={form.guncel}
                onChange={e => setForm({ ...form, guncel: e.target.value })} />
            </label>
            <label className="form-label">
              Sektör
              <input className="input" type="text" placeholder="örn: Enerji"
                value={form.sektör}
                onChange={e => setForm({ ...form, sektör: e.target.value })} />
            </label>
            <label className="form-label">
              Hedef Kategori
              <select className="input" value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}>
                <option value="CORE">CORE</option>
                <option value="SATELLITE">SATELLITE</option>
                <option value="SAT">SAT</option>
                <option value="TRADE">TRADE</option>
                <option value="PATATES">PATATES</option>
                <option value="KUMBARA">KUMBARA</option>
              </select>
            </label>
          </div>

          {/* Alarm Seviyeleri */}
          <h3 className="panel-baslik" style={{ marginBottom:"0.75rem" }}>🔔 Alarm Seviyeleri</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", marginBottom:"1rem" }}>
            {ALARM_TANIMLARI.map(({ key, label, aciklama, renk }) => (
              <div key={key} style={{ background:"#0f1117", border:`1px solid #2d3748`, borderRadius:"8px", padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"4px" }}>
                  <span style={{ fontWeight:600, color: renk, fontSize:"0.85rem" }}>{label}</span>
                  <label style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"0.78rem", color:"#94a3b8", cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={form.alarmlar?.[key]?.aktif ?? true}
                      onChange={e => alarmGuncelle(key, "aktif", e.target.checked)} />
                    Aktif
                  </label>
                </div>
                <div style={{ fontSize:"0.73rem", color:"#64748b", marginBottom:"6px" }}>{aciklama}</div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <input className="input" type="number" step="0.01" placeholder="Fiyat (TL)"
                    style={{ width:"140px" }}
                    value={form.alarmlar?.[key]?.fiyat || ""}
                    onChange={e => alarmGuncelle(key, "fiyat", e.target.value)} />
                  <input className="input" type="text" placeholder="Not (opsiyonel)"
                    value={form.alarmlar?.[key]?.not || ""}
                    onChange={e => alarmGuncelle(key, "not", e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          {/* Tez ve Not */}
          <label className="form-label" style={{ display:"block", marginBottom:"0.75rem" }}>
            Yatırım Tezi
            <textarea className="input-alan" rows={3}
              value={form.tez}
              onChange={e => setForm({ ...form, tez: e.target.value })} />
          </label>
          <label className="form-label" style={{ display:"block", marginBottom:"1rem" }}>
            Not
            <textarea className="input-alan" rows={2}
              value={form.not}
              onChange={e => setForm({ ...form, not: e.target.value })} />
          </label>

          <div className="btn-grup">
            <button className="btn btn-yesil" onClick={kaydet}>✓ Kaydet</button>
            <button className="btn btn-gri" onClick={() => { setFormAcik(false); setDuzenlenen(null); }}>İptal</button>
          </div>
        </div>
      )}

      {/* Boş Liste */}
      {liste.length === 0 && !formAcik && (
        <div className="panel" style={{ textAlign:"center", color:"#64748b", padding:"2rem" }}>
          Henüz takip listesi yok. "+ Hisse Ekle" ile başla.
        </div>
      )}

      {/* Hisse Kartları */}
      {liste.map((h, idx) => {
        const alarmlar = alarmKontrol(h);
        const alarm = alarmlar.length > 0;
        const potansiyel = h.hedef && h.guncel
          ? (((parseFloat(h.hedef) - parseFloat(h.guncel)) / parseFloat(h.guncel)) * 100).toFixed(1)
          : null;

        return (
          <div key={idx} className="panel" style={{ marginBottom:"0.75rem", borderColor: alarm ? "#f59e0b" : undefined }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"6px", flexWrap:"wrap" }}>
                  <b style={{ fontSize:"1rem" }}>{h.id}</b>
                  <span style={{ color:"#94a3b8", fontSize:"0.85rem" }}>{h.ad}</span>
                  <span className="kat-badge" style={{ background: kategoriRenk(h.kategori) }}>
                    {h.kategori}
                  </span>
                  {alarmlar.map((a, i) => (
                    <span key={i} className="kat-badge" style={{
                      background: a.renk === "#22c55e" ? "#15803d"
                        : a.renk === "#38bdf8" ? "#0369a1"
                        : a.renk === "#ef4444" ? "#991b1b"
                        : "#92400e"
                    }}>
                      {a.tip === "direncAl"  && "📈 DİRENÇ AL"}
                      {a.tip === "destekAl"  && "💙 DESTEK AL"}
                      {a.tip === "destekSat" && "📉 DESTEK SAT"}
                      {a.tip === "direncSat" && "⚠️ DİRENÇ SAT"}
                    </span>
                  ))}
                </div>

                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", fontSize:"0.82rem", color:"#64748b" }}>
                  {h.guncel && <span>Güncel: <b style={{ color:"#f1f5f9" }}>{h.guncel} TL</b></span>}
                  {h.hedef  && <span>Hedef: <b style={{ color:"#38bdf8" }}>{h.hedef} TL</b></span>}
                  {potansiyel && (
                    <span>Potansiyel: <b className={parseFloat(potansiyel) >= 0 ? "yesil" : "kirmizi"}>
                      {parseFloat(potansiyel) >= 0 ? "+" : ""}{potansiyel}%
                    </b></span>
                  )}
                  {h.sektör && <span>Sektör: {h.sektör}</span>}
                </div>

                {/* Aktif Alarmlar Detay */}
                {h.alarmlar && (
                  <div style={{ marginTop:"6px", display:"flex", flexWrap:"wrap", gap:"6px" }}>
                    {ALARM_TANIMLARI.filter(a => h.alarmlar[a.key]?.fiyat && h.alarmlar[a.key]?.aktif).map(a => (
                      <span key={a.key} style={{ fontSize:"0.75rem", color: a.renk, background:"#0f1117", border:`1px solid ${a.renk}33`, borderRadius:"4px", padding:"2px 7px" }}>
                        {a.label}: {h.alarmlar[a.key].fiyat} TL
                        {h.alarmlar[a.key].not && ` — ${h.alarmlar[a.key].not}`}
                      </span>
                    ))}
                  </div>
                )}

                {h.tez && (
                  <p style={{ marginTop:"6px", fontSize:"0.82rem", color:"#94a3b8", lineHeight:"1.5" }}>
                    {h.tez}
                  </p>
                )}
              </div>

              <div style={{ display:"flex", gap:"6px", marginLeft:"1rem" }}>
                <button onClick={() => duzenle(idx)}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.9rem" }}>✏️</button>
                <button onClick={() => sil(idx)}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.9rem" }}>🗑</button>
              </div>
            </div>
          </div>
        );
      })}
      {/* Alarm Geçmişi */}
      {alarmGecmisi.length > 0 && (
        <div className="panel" style={{ marginTop:"1.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
            <h3 className="panel-baslik" style={{ margin:0 }}>
              📋 Alarm Geçmişi ({alarmGecmisi.length})
            </h3>
            <button onClick={onTumAlarmSil}
              style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.78rem" }}>
              Tümünü Temizle
            </button>
          </div>
          {alarmGecmisi.map(a => {
            const renkler = { direncAl:"#22c55e", destekAl:"#38bdf8", destekSat:"#ef4444", direncSat:"#f59e0b" };
            const etiketler = { direncAl:"📈 Direnç AL", destekAl:"💙 Destek AL", destekSat:"📉 Destek SAT", direncSat:"⚠️ Direnç SAT" };
            const renk = renkler[a.tip] || "#94a3b8";
            return (
              <div key={a.id} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"0.5rem 0", borderBottom:"1px solid #1a2035", fontSize:"0.82rem"
              }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:700, color:"#f1f5f9", marginRight:"8px" }}>{a.hisseId}</span>
                  <span style={{ color: renk, fontWeight:600, marginRight:"8px" }}>{etiketler[a.tip]}</span>
                  <span style={{ color:"#64748b" }}>
                    Alarm: {a.alarmFiyat} TL → Güncel: {a.guncelFiyat} TL
                  </span>
                  {a.not && <span style={{ color:"#64748b", marginLeft:"8px" }}>— {a.not}</span>}
                  <div style={{ color:"#475569", fontSize:"0.75rem", marginTop:"2px" }}>
                    {new Date(a.zaman).toLocaleString("tr-TR")}
                  </div>
                </div>
                <button onClick={() => onAlarmSil(a.id)}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", marginLeft:"8px" }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PERFORMANS TAKİBİ ────────────────────────────────────────────────────
function PerformansTakibi({ snapshots }) {
  const [filtre, setFiltre] = useState("30");

  const gunSayisi = parseInt(filtre);
  const sirali = [...snapshots].reverse();
  const filtrelenmis = sirali.slice(-gunSayisi);

  if (filtrelenmis.length === 0) {
    return (
      <div>
        <h2 className="sayfa-baslik">📊 Performans Takibi</h2>
        <div className="panel" style={{ textAlign:"center", color:"#64748b", padding:"2rem" }}>
          Henüz snapshot yok. Her gün otomatik kayıt alınıyor — yarın tekrar bak.
        </div>
      </div>
    );
  }

  const ilk = filtrelenmis[0]?.toplamVarlik || 0;
  const son = filtrelenmis[filtrelenmis.length - 1]?.toplamVarlik || 0;
  const degisim = son - ilk;
  const degisimYuzde = ilk > 0 ? ((degisim / ilk) * 100).toFixed(2) : 0;

  // Recharts için veri hazırla
  const grafikVeri = filtrelenmis.map(s => ({
    tarih: new Date(s.tarih).toLocaleDateString("tr-TR", { day:"2-digit", month:"2-digit" }),
    "Toplam Varlık": s.toplamVarlik,
    "Hisse Değeri":  s.toplamHisse,
    "TL Nakit":      s.tlNakit,
  }));

  return (
    <div>
      <h2 className="sayfa-baslik">📊 Performans Takibi</h2>

      {/* Filtre */}
      <div className="filtre-bar" style={{ marginBottom:"1rem" }}>
        {[
          { label:"7 Gün",  val:"7"   },
          { label:"30 Gün", val:"30"  },
          { label:"90 Gün", val:"90"  },
          { label:"1 Yıl",  val:"365" },
        ].map(f => (
          <button key={f.val}
            className={`filtre-btn ${filtre === f.val ? "aktif" : ""}`}
            onClick={() => setFiltre(f.val)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Özet Kartlar */}
      <div className="kart-grid" style={{ marginBottom:"1rem" }}>
        <div className="kart">
          <div className="kart-label">Başlangıç</div>
          <div className="kart-deger">
            {ilk.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Güncel</div>
          <div className="kart-deger">
            {son.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Değişim</div>
          <div className={`kart-deger ${degisim >= 0 ? "yesil" : "kirmizi"}`}>
            {degisim >= 0 ? "+" : ""}
            {degisim.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            <span className="kart-alt"> ({degisimYuzde}%)</span>
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Kayıt Sayısı</div>
          <div className="kart-deger">{filtrelenmis.length} gün</div>
        </div>
      </div>

      {/* Ana Grafik — CSS */}
      <div className="panel" style={{ marginBottom:"1rem" }}>
        <h3 className="panel-baslik">Toplam Varlık Değişimi</h3>
        {filtrelenmis.length > 1 ? (() => {
          const maxD = Math.max(...filtrelenmis.map(s => s.toplamVarlik));
          const minD = Math.min(...filtrelenmis.map(s => s.toplamVarlik));
          const aralik = maxD - minD || 1;
          const w = 100;
          const noktalar = filtrelenmis.map((s, i) => {
            const x = (i / (filtrelenmis.length - 1)) * w;
            const y = 100 - ((s.toplamVarlik - minD) / aralik) * 85;
            return { x, y, s };
          });
          const cizgi = noktalar.map((p, i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
          const alan = `${cizgi} L${w},100 L0,100 Z`;
          return (
            <div style={{ position:"relative" }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                style={{ width:"100%", height:"200px", display:"block" }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={alan} fill="url(#grad)" />
                <path d={cizgi} fill="none" stroke="#3b82f6" strokeWidth="0.5" />
                {noktalar.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1" fill="#3b82f6" />
                ))}
              </svg>
              {/* Tarih etiketleri */}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.7rem", color:"#64748b", marginTop:"4px" }}>
                <span>{new Date(filtrelenmis[0].tarih).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit"})}</span>
                {filtrelenmis.length > 2 && (
                  <span>{new Date(filtrelenmis[Math.floor(filtrelenmis.length/2)].tarih).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit"})}</span>
                )}
                <span>{new Date(filtrelenmis[filtrelenmis.length-1].tarih).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit"})}</span>
              </div>
              {/* Min/Max değerler */}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem", color:"#94a3b8", marginTop:"4px" }}>
                <span>Min: {minD.toLocaleString("tr-TR",{maximumFractionDigits:0})} TL</span>
                <span>Max: {maxD.toLocaleString("tr-TR",{maximumFractionDigits:0})} TL</span>
              </div>
            </div>
          );
        })() : (
          <p style={{ color:"#64748b", fontSize:"0.85rem" }}>Grafik için en az 2 günlük veri gerekli.</p>
        )}
      </div>

      {/* Günlük Kayıtlar Tablosu */}
      <div className="panel">
        <h3 className="panel-baslik">Günlük Kayıtlar</h3>
        <div className="tablo-kap">
          <table className="tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Toplam Varlık</th>
                <th>Hisse Değeri</th>
                <th>TL Nakit</th>
                <th>Değişim</th>
              </tr>
            </thead>
            <tbody>
              {[...filtrelenmis].reverse().map((s, i, arr) => {
                const onceki = arr[i + 1];
                const fark = onceki ? s.toplamVarlik - onceki.toplamVarlik : 0;
                return (
                  <tr key={s.tarih}>
                    <td>{new Date(s.tarih).toLocaleDateString("tr-TR")}</td>
                    <td>{s.toplamVarlik.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL</td>
                    <td>{s.toplamHisse.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL</td>
                    <td>{s.tlNakit.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL</td>
                    <td className={fark >= 0 ? "yesil" : "kirmizi"}>
                      {fark !== 0 ? `${fark >= 0 ? "+" : ""}${fark.toLocaleString("tr-TR", { maximumFractionDigits:0 })}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// ─── HİSSE İŞLEM GEÇMİŞİ ─────────────────────────────────────────────────
function HisseIslemGecmisi({ hisseId }) {
  const [islemler, setIslemler] = useState([]);
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState({
    tip: "ALIM", adet: "", fiyat: "", tarih: new Date().toISOString().split("T")[0], not: ""
  });

  useEffect(() => {
    islemlerOku().then(tumIslemler => {
      const hisseIslemleri = tumIslemler.filter(i => i.hisseId === hisseId);
      setIslemler(hisseIslemleri);
    });
  }, [hisseId]);

  function ekle() {
    if (!form.adet || !form.fiyat) { alert("Adet ve fiyat zorunlu."); return; }
    const yeniIslem = {
      id: Date.now(),
      hisseId,
      tip: form.tip,
      adet: parseInt(form.adet),
      fiyat: parseFloat(form.fiyat),
      tutar: parseInt(form.adet) * parseFloat(form.fiyat),
      tarih: form.tarih,
      not: form.not,
    };
    islemlerOku().then(tumIslemler => {
      const yeni = [yeniIslem, ...tumIslemler];
      islemlerYaz(yeni);
      setIslemler(prev => [yeniIslem, ...prev]);
    });
    setForm({ tip:"ALIM", adet:"", fiyat:"", tarih: new Date().toISOString().split("T")[0], not:"" });
    setFormAcik(false);
  }

  function sil(id) {
    if (!window.confirm("Bu işlemi silmek istediğine emin misin?")) return;
    islemlerOku().then(tumIslemler => {
      const yeni = tumIslemler.filter(i => i.id !== id);
      islemlerYaz(yeni);
      setIslemler(prev => prev.filter(i => i.id !== id));
    });
  }

  const toplamAlim  = islemler.filter(i => i.tip === "ALIM").reduce((t, i) => t + i.tutar, 0);
  const toplamSatim = islemler.filter(i => i.tip === "SATIM").reduce((t, i) => t + i.tutar, 0);
  const realizasyon = toplamSatim - toplamAlim;

  return (
    <div className="panel" style={{ marginBottom:"1rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
        <h3 className="panel-baslik" style={{ margin:0 }}>📋 İşlem Geçmişi</h3>
        <button className="btn btn-mavi" style={{ fontSize:"0.78rem", padding:"4px 10px" }}
          onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? "İptal" : "+ İşlem Ekle"}
        </button>
      </div>

      {/* Form */}
      {formAcik && (
        <div style={{ background:"#0f1117", borderRadius:"8px", padding:"12px", marginBottom:"0.75rem" }}>
          <div className="form-grid" style={{ marginBottom:"0.75rem" }}>
            <label className="form-label">
              Tip
              <select className="input" value={form.tip}
                onChange={e => setForm({ ...form, tip: e.target.value })}>
                <option value="ALIM">📈 Alım</option>
                <option value="SATIM">📉 Satım</option>
              </select>
            </label>
            <label className="form-label">
              Adet
              <input className="input" type="number"
                value={form.adet} onChange={e => setForm({ ...form, adet: e.target.value })} />
            </label>
            <label className="form-label">
              Fiyat (TL)
              <input className="input" type="number" step="0.01"
                value={form.fiyat} onChange={e => setForm({ ...form, fiyat: e.target.value })} />
            </label>
            <label className="form-label">
              Tarih
              <input className="input" type="date"
                value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
            </label>
          </div>
          <label className="form-label" style={{ display:"block", marginBottom:"0.75rem" }}>
            Not
            <input className="input" type="text" placeholder="opsiyonel"
              value={form.not} onChange={e => setForm({ ...form, not: e.target.value })} />
          </label>
          <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
            <button className="btn btn-yesil" onClick={ekle}>✓ Ekle</button>
            {form.adet && form.fiyat && (
              <span style={{ fontSize:"0.8rem", color:"#94a3b8" }}>
                Toplam: {(parseInt(form.adet||0) * parseFloat(form.fiyat||0)).toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
              </span>
            )}
          </div>
        </div>
      )}

      {/* Özet */}
      {islemler.length > 0 && (
        <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", marginBottom:"0.75rem", fontSize:"0.82rem" }}>
          <span style={{ color:"#94a3b8" }}>
            Toplam Alım: <b style={{ color:"#ef4444" }}>{toplamAlim.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL</b>
          </span>
          <span style={{ color:"#94a3b8" }}>
            Toplam Satım: <b style={{ color:"#22c55e" }}>{toplamSatim.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL</b>
          </span>
          {toplamSatim > 0 && (
            <span style={{ color:"#94a3b8" }}>
              Realizasyon K/Z: <b className={realizasyon >= 0 ? "yesil" : "kirmizi"}>
                {realizasyon >= 0 ? "+" : ""}{realizasyon.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
              </b>
            </span>
          )}
        </div>
      )}

      {/* Liste */}
      {islemler.length === 0 && !formAcik && (
        <p style={{ color:"#64748b", fontSize:"0.82rem" }}>Henüz işlem kaydı yok.</p>
      )}
      {islemler.map(i => (
        <div key={i.id} style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"0.5rem 0", borderBottom:"1px solid #1a2035", fontSize:"0.82rem"
        }}>
          <div>
            <span style={{ color: i.tip === "ALIM" ? "#ef4444" : "#22c55e", fontWeight:600, marginRight:"8px" }}>
              {i.tip === "ALIM" ? "📈 ALIM" : "📉 SATIM"}
            </span>
            <span style={{ color:"#f1f5f9" }}>{i.adet} adet × {i.fiyat} TL</span>
            <span style={{ color:"#64748b", marginLeft:"8px" }}>
              = {i.tutar.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
            </span>
            {i.not && <span style={{ color:"#64748b", marginLeft:"8px" }}>— {i.not}</span>}
            <div style={{ color:"#475569", fontSize:"0.75rem" }}>
              {new Date(i.tarih).toLocaleDateString("tr-TR")}
            </div>
          </div>
          <button onClick={() => sil(i.id)}
            style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── REBALANCİNG ─────────────────────────────────────────────────────────
function Rebalancing({ hisseler, nakit }) {
  const toplamVarlik = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0)
    + nakit.tlNakit + nakit.usdFon;

  // Kategori bazlı mevcut durum
  const kategoriler = ["CORE", "SATELLITE", "SAT", "TRADE", "PATATES", "KUMBARA"];
  const kategoriOzetleri = kategoriler.map(kat => {
    const katHisseler = hisseler.filter(h => h.kategori === kat);
    const deger = katHisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
    const oran = toplamVarlik > 0 ? (deger / toplamVarlik) * 100 : 0;
    return { kat, deger, oran, hisseSayisi: katHisseler.length };
  }).filter(k => k.deger > 0 || k.kat === "CORE");

  // Hisse bazlı rebalancing
  const hisseRebalance = hisseler.map(h => {
    const mevcutDeger = h.guncel * h.adet;
    const mevcutOran = toplamVarlik > 0 ? (mevcutDeger / toplamVarlik) * 100 : 0;
    const hedefOran = h.hedefOran || 0;
    const hedefDeger = (hedefOran / 100) * toplamVarlik;
    const fark = hedefDeger - mevcutDeger;
    const farkAdet = h.guncel > 0 ? Math.abs(fark / h.guncel) : 0;
    return {
      ...h, mevcutDeger, mevcutOran, hedefDeger, fark, farkAdet
    };
  }).filter(h => h.hedefOran > 0);

  const toplamHedefOran = hisseRebalance.reduce((t, h) => t + (h.hedefOran || 0), 0);
  const alimListesi = hisseRebalance.filter(h => h.fark > 1000).sort((a,b) => b.fark - a.fark);
  const satimListesi = hisseRebalance.filter(h => h.fark < -1000).sort((a,b) => a.fark - b.fark);

  return (
    <div>
      <h2 className="sayfa-baslik">⚖️ Rebalancing Hesaplayıcı</h2>
      <p style={{ color:"#64748b", fontSize:"0.85rem", marginBottom:"1rem" }}>
        Hedef oranlara göre portföyünü dengele. Hisse detay sayfasından her hissenin hedef oranını girebilirsin.
      </p>

      {/* Özet */}
      <div className="kart-grid" style={{ marginBottom:"1rem" }}>
        <div className="kart">
          <div className="kart-label">Toplam Varlık</div>
          <div className="kart-deger">
            {toplamVarlik.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Tanımlı Hedef Oran</div>
          <div className={`kart-deger ${toplamHedefOran > 100 ? "kirmizi" : "yesil"}`}>
            %{toplamHedefOran.toFixed(1)}
            {toplamHedefOran > 100 && <span className="kart-alt"> ⚠️ %100 aşıyor</span>}
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Alım Gerekli</div>
          <div className="kart-deger yesil">{alimListesi.length} hisse</div>
        </div>
        <div className="kart">
          <div className="kart-label">Satım Gerekli</div>
          <div className="kart-deger kirmizi">{satimListesi.length} hisse</div>
        </div>
      </div>

      {/* Alım Listesi */}
      {alimListesi.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem" }}>
          <h3 className="panel-baslik" style={{ color:"#22c55e" }}>
            📈 Alım Gerekli ({alimListesi.length} hisse)
          </h3>
          <div className="tablo-kap">
            <table className="tablo">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Mevcut TL</th>
                  <th>Mevcut %</th>
                  <th>Hedef %</th>
                  <th>Hedef TL</th>
                  <th>Alım TL</th>
                  <th>Tahmini Adet</th>
                </tr>
              </thead>
              <tbody>
                {alimListesi.map(h => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.id}</b>
                      <br />
                      <span className="kucuk">{h.ad}</span>
                    </td>
                    <td>{h.mevcutDeger.toLocaleString("tr-TR", { maximumFractionDigits:0 })}</td>
                    <td className={h.mevcutOran < h.hedefOran ? "kirmizi" : "yesil"}>
                      %{h.mevcutOran.toFixed(1)}
                    </td>
                    <td>%{h.hedefOran}</td>
                    <td>{h.hedefDeger.toLocaleString("tr-TR", { maximumFractionDigits:0 })}</td>
                    <td className="yesil" style={{ fontWeight:700 }}>
                      +{h.fark.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
                    </td>
                    <td className="yesil">
                      ~{Math.ceil(h.farkAdet).toLocaleString("tr-TR")} adet
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Satım Listesi */}
      {satimListesi.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem" }}>
          <h3 className="panel-baslik" style={{ color:"#ef4444" }}>
            📉 Satım Değerlendir ({satimListesi.length} hisse)
          </h3>
          <div className="tablo-kap">
            <table className="tablo">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Mevcut TL</th>
                  <th>Mevcut %</th>
                  <th>Hedef %</th>
                  <th>Hedef TL</th>
                  <th>Azalt TL</th>
                  <th>Tahmini Adet</th>
                </tr>
              </thead>
              <tbody>
                {satimListesi.map(h => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.id}</b>
                      <br />
                      <span className="kucuk">{h.ad}</span>
                    </td>
                    <td>{h.mevcutDeger.toLocaleString("tr-TR", { maximumFractionDigits:0 })}</td>
                    <td className="kirmizi">%{h.mevcutOran.toFixed(1)}</td>
                    <td>%{h.hedefOran}</td>
                    <td>{h.hedefDeger.toLocaleString("tr-TR", { maximumFractionDigits:0 })}</td>
                    <td className="kirmizi" style={{ fontWeight:700 }}>
                      {h.fark.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
                    </td>
                    <td className="kirmizi">
                      ~{Math.ceil(h.farkAdet).toLocaleString("tr-TR")} adet
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kategori Dağılımı */}
      <div className="panel">
        <h3 className="panel-baslik">📊 Kategori Dağılımı</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {kategoriOzetleri.map(k => (
            <div key={k.kat} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span className="kat-badge" style={{ background: kategoriRenk(k.kat), width:"80px", textAlign:"center" }}>
                {k.kat}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px", fontSize:"0.78rem" }}>
                  <span style={{ color:"#94a3b8" }}>{k.hisseSayisi} hisse</span>
                  <span style={{ fontWeight:600, color:"#f1f5f9" }}>%{k.oran.toFixed(1)}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar"
                    style={{ width:`${Math.min(k.oran, 100)}%`, background: kategoriRenk(k.kat) }} />
                </div>
              </div>
              <span style={{ width:"120px", textAlign:"right", fontSize:"0.8rem", color:"#64748b" }}>
                {k.deger.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
              </span>
            </div>
          ))}
        </div>
      </div>

      {hisseRebalance.length === 0 && (
        <div className="panel" style={{ marginTop:"1rem", textAlign:"center", color:"#64748b", padding:"2rem" }}>
          Hiçbir hisseye hedef oran girilmemiş. Hisse detay sayfasından "Hedef Oran %" alanını doldur.
        </div>
      )}
    </div>
  );
}
// ─── ARŞİV SAYFASI ───────────────────────────────────────────────────────
function ArsivSayfasi({ arsiv, onSil }) {
  const [filtre, setFiltre] = useState("TUMU");

  const filtrelenmis = filtre === "TUMU" ? arsiv
    : filtre === "KAR" ? arsiv.filter(h => parseFloat(h.cikisKZYuzde) >= 0)
    : arsiv.filter(h => parseFloat(h.cikisKZYuzde) < 0);

  const toplamKar   = arsiv.filter(h => h.cikisKZ >= 0).reduce((t, h) => t + h.cikisKZ, 0);
  const toplamZarar = arsiv.filter(h => h.cikisKZ < 0).reduce((t, h) => t + h.cikisKZ, 0);
  const netKZ = toplamKar + toplamZarar;

  return (
    <div>
      <h2 className="sayfa-baslik">🗄 Arşiv — Portföyden Çıkan Hisseler</h2>

      <div className="kart-grid" style={{ marginBottom:"1rem" }}>
        <div className="kart">
          <div className="kart-label">Toplam Çıkış</div>
          <div className="kart-deger">{arsiv.length} hisse</div>
        </div>
        <div className="kart">
          <div className="kart-label">Realize Kâr</div>
          <div className="kart-deger yesil">
            +{toplamKar.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Realize Zarar</div>
          <div className="kart-deger kirmizi">
            {toplamZarar.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Net Realizasyon</div>
          <div className={`kart-deger ${netKZ >= 0 ? "yesil" : "kirmizi"}`}>
            {netKZ >= 0 ? "+" : ""}
            {netKZ.toLocaleString("tr-TR", { maximumFractionDigits:0 })} TL
          </div>
        </div>
      </div>

      {arsiv.length === 0 ? (
        <div className="panel" style={{ textAlign:"center", color:"#64748b", padding:"2rem" }}>
          Henüz arşivde hisse yok. Portföyden hisse silince buraya taşınır.
        </div>
      ) : (
        <>
          <div className="filtre-bar" style={{ marginBottom:"1rem" }}>
            {[
              { label:"Tümü",   val:"TUMU"  },
              { label:"Kârlı",  val:"KAR"   },
              { label:"Zararlı",val:"ZARAR" },
            ].map(f => (
              <button key={f.val}
                className={`filtre-btn ${filtre === f.val ? "aktif" : ""}`}
                onClick={() => setFiltre(f.val)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="tablo-kap">
            <table className="tablo">
              <thead>
                <tr>
                  <th>Hisse</th>
                  <th>Kat.</th>
                  <th>Adet</th>
                  <th>Alış</th>
                  <th>Çıkış Fiyatı</th>
                  <th>K/Z TL</th>
                  <th>K/Z %</th>
                  <th>Çıkış Tarihi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrelenmis.map((h, i) => {
                  const kzPos = parseFloat(h.cikisKZYuzde) >= 0;
                  return (
                    <tr key={i}>
                      <td>
                        <b>{h.id}</b><br />
                        <span className="kucuk">{h.ad}</span>
                      </td>
                      <td>
                        <span className="kat-badge" style={{ background: kategoriRenk(h.kategori) }}>
                          {h.kategori}
                        </span>
                      </td>
                      <td>{h.adet?.toLocaleString("tr-TR")}</td>
                      <td>{h.alis?.toFixed(2)}</td>
                      <td>{h.cikisFiyati?.toFixed(2)}</td>
                      <td className={kzPos ? "yesil" : "kirmizi"}>
                        {kzPos ? "+" : ""}
                        {h.cikisKZ?.toLocaleString("tr-TR", { maximumFractionDigits:0 })}
                      </td>
                      <td className={kzPos ? "yesil" : "kirmizi"}>
                        {kzPos ? "+" : ""}{h.cikisKZYuzde}%
                      </td>
                      <td style={{ color:"#64748b" }}>
                        {h.cikisTarihi ? new Date(h.cikisTarihi).toLocaleDateString("tr-TR") : "—"}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            if (!window.confirm("Bu kaydı arşivden silmek istediğine emin misin?")) return;
                            onSil(i);
                          }}
                          style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}