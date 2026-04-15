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
  bilancOku, bilancYaz
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
function Navbar({ aktif, setAktif, onIndir, onYukle }) {
  const menuler = [
    { id: "dashboard", label: "📊 Dashboard"     },
    { id: "liste",     label: "📋 Hisseler"       },
    { id: "takip",     label: "🔭 Takip"          },
    { id: "guncelle",  label: "💱 Fiyat Güncelle" },
    { id: "gunce",     label: "📝 Günce"           },
    { id: "yeni",      label: "+ Hisse Ekle"       },
    { id: "grafikler", label: "📈 Grafikler"       },
    { id: "halkaarzi", label: "🏦 Halka Arz"       },
    { id: "takvim",    label: "📅 Takvim"          },
    { id: "nakit",     label: "💰 Nakit"           },
  ];

  return (
    <nav className="navbar">
      <span className="navbar-logo">📈 BIST Portföy</span>
      <div className="navbar-menu">
        {menuler.map(m => (
          <button
            key={m.id}
            className={`nav-btn ${aktif === m.id ? "aktif" : ""}`}
            onClick={() => setAktif(m.id)}
          >
            {m.label}
          </button>
        ))}
        <button className="nav-btn" onClick={onIndir}>⬇ Yedek</button>
        <button
          className="nav-btn"
          onClick={() => document.getElementById("dosyaInput").click()}
        >
          ⬆ Yükle
        </button>
        <input
          id="dosyaInput"
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={onYukle}
        />
      </div>
    </nav>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────
function Dashboard({ hisseler, nakit, onHisseClick, sonGuncelleme, takipListe }) {
  const toplamHisse   = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const toplamMaliyet = hisseler.reduce((t, h) => t + h.alis * h.adet, 0);
  const toplamKZ      = toplamHisse - toplamMaliyet;
  const toplamKZYuzde = ((toplamKZ / toplamMaliyet) * 100).toFixed(1);
  const toplamVarlik  = toplamHisse + nakit.tlNakit + nakit.usdFon;

  const coreHisseler = hisseler.filter(h => h.kategori === "CORE");
  const coreDeger    = coreHisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const coreYuzde    = ((coreDeger / toplamVarlik) * 100).toFixed(0);

  const tumUyarilar = hisseler.flatMap(h => uyariKontrol(h, toplamVarlik));
  const takipAlarmlari = (takipListe || []).filter(h =>
    h.alimSeviyesi && h.guncel &&
    parseFloat(h.guncel) <= parseFloat(h.alimSeviyesi)
  );
  const acilSatlar   = hisseler.filter(h => h.aksiyon === "SAT");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f1f5f9" }}>Dashboard</h2>
        {sonGuncelleme && (
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            🕐 Son güncelleme: {sonGuncelleme}
          </span>
        )}
      </div>

      <div className="kart-grid">
        <div className="kart">
          <div className="kart-label">Toplam Varlık</div>
          <div className="kart-deger">
            {toplamVarlik.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Hisse K/Z</div>
          <div className={`kart-deger ${toplamKZ >= 0 ? "yesil" : "kirmizi"}`}>
            {toplamKZ >= 0 ? "+" : ""}
            {toplamKZ.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
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
          <div className="kart-deger">
            {nakit.usdFon.toLocaleString("tr-TR")} TL
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>CORE Ağırlığı</span>
          <span><b>{coreYuzde}%</b> / Hedef: 52%</span>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${Math.min(coreYuzde, 100)}%` }} />
        </div>
      </div>

      {/* Takip Alarmları */}
      {takipAlarmlari.length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem", borderColor:"#22c55e", borderWidth:"2px" }}>
          <h3 className="panel-baslik" style={{ color:"#22c55e" }}>
            🟢 TAKİP — ALIM SEVİYESİNE ULAŞTI ({takipAlarmlari.length} hisse)
          </h3>
          {takipAlarmlari.map((h, i) => (
            <div key={i} className="acil-satir">
              <div>
                <b style={{ color:"#f1f5f9" }}>{h.id}</b>
                <span style={{ color:"#94a3b8", marginLeft:"8px", fontSize:"0.82rem" }}>{h.ad}</span>
              </div>
              <div style={{ display:"flex", gap:"12px", fontSize:"0.82rem" }}>
                <span>Güncel: <b className="yesil">{h.guncel} TL</b></span>
                <span>Alım Seviyesi: <b style={{ color:"#22c55e" }}>{h.alimSeviyesi} TL</b></span>
                {h.hedef && <span>Hedef: <b style={{ color:"#38bdf8" }}>{h.hedef} TL</b></span>}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {tumUyarilar.length > 0 && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik">⚠️ Aktif Uyarılar ({tumUyarilar.length})</h3>
          {tumUyarilar.map((u, i) => (
            <div key={i} className={`uyari uyari-${u.tip}`}>{u.mesaj}</div>
          ))}
        </div>
      )}

      {acilSatlar.length > 0 && (
        <div className="panel">
          <h3 className="panel-baslik">🔴 Çıkış Bekleniyor ({acilSatlar.length})</h3>
          {acilSatlar.map(h => {
            const { kzYuzde } = karZararHesapla(h);
            return (
              <div key={h.id} className="acil-satir" onClick={() => onHisseClick(h)}>
                <b>{h.id}</b> — {h.ad}
                <span className="kz-badge kirmizi">{kzYuzde}%</span>
              </div>
            );
          })}
        </div>
      )}
      {/* Kategori Dağılımı */}
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-baslik">📊 Kategori Dağılımı</h3>
        <div className="dagilim-grid">
          {["CORE", "SAT", "TRADE"].map(kat => {
            const katHisseler = hisseler.filter(h => h.kategori === kat);
            const katDeger = katHisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
            const katYuzde = toplamVarlik > 0
              ? ((katDeger / toplamVarlik) * 100).toFixed(1)
              : 0;
            return (
              <div key={kat} className="dagilim-kart">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span className="kat-badge" style={{ background: kategoriRenk(kat) }}>{kat}</span>
                  <span style={{ fontWeight: 700, color: "#f1f5f9" }}>%{katYuzde}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar"
                    style={{ width: `${katYuzde}%`, background: kategoriRenk(kat) }} />
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                  {katHisseler.length} hisse · {katDeger.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
                </div>
              </div>
            );
          })}
          {/* Nakit */}
          <div className="dagilim-kart">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span className="kat-badge" style={{ background: "#0ea5e9" }}>NAKİT</span>
              <span style={{ fontWeight: 700, color: "#f1f5f9" }}>
                %{((( nakit.tlNakit + nakit.usdFon) / toplamVarlik) * 100).toFixed(1)}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-bar"
                style={{ width: `${((nakit.tlNakit + nakit.usdFon) / toplamVarlik) * 100}%`, background: "#0ea5e9" }} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
              TL + USD Fon
            </div>
          </div>
        </div>
      </div>
      {/* Nakit Özeti */}
      <div className="panel" style={{ marginTop: "1rem" }}>
        <h3 className="panel-baslik">💰 Nakit Durumu</h3>
        <div className="kart-grid">
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
            <div className="kart-label">Aylık Hedef</div>
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
        <SonIslemler />
      </div>
    </div>
  );
}

// ─── HİSSE LİSTESİ ───────────────────────────────────────────────────────
function HisseListe({ hisseler, nakit, onHisseClick }) {
  const [filtre, setFiltre]       = useState("TUMU");
  const [siralama, setSiralama]   = useState({ kolon: null, yon: "azalan" });

  const toplamVarlik = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0)
    + nakit.tlNakit + nakit.usdFon;

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
    let av, bv;
    const { kz: akz, kzYuzde: akzY } = karZararHesapla(a);
    const { kz: bkz, kzYuzde: bkzY } = karZararHesapla(b);

    switch (siralama.kolon) {
      case "gunluk":
        av = parseFloat(a.gunlukDegisim) || 0;
        bv = parseFloat(b.gunlukDegisim) || 0;
        break;
      case "kzYuzde":
        av = parseFloat(akzY) || 0;
        bv = parseFloat(bkzY) || 0;
        break;
      case "kzTutar":
        av = akz; bv = bkz;
        break;
      case "tutar":
        av = a.guncel * a.adet;
        bv = b.guncel * b.adet;
        break;
      case "potansiyel":
        av = a.hedef ? ((a.hedef - a.guncel) / a.guncel * 100) : -999;
        bv = b.hedef ? ((b.hedef - b.guncel) / b.guncel * 100) : -999;
        break;
      
      case "id":
        av = a.id; bv = b.id;
        return siralama.yon === "azalan"
          ? bv.localeCompare(av, "tr")
          : av.localeCompare(bv, "tr");
      case "aksiyon":
        av = a.aksiyon; bv = b.aksiyon;
        return siralama.yon === "azalan"
          ? bv.localeCompare(av, "tr")
          : av.localeCompare(bv, "tr");
      
      case "hedefOran":
        av = parseFloat(a.hedefOran) || 0;
        bv = parseFloat(b.hedefOran) || 0;
        break;
      
      case "mevcutOran":
        av = toplamVarlik > 0 ? (a.guncel * a.adet / toplamVarlik * 100) : 0;
        bv = toplamVarlik > 0 ? (b.guncel * b.adet / toplamVarlik * 100) : 0;
        break;
      default: return 0;
    }
    return siralama.yon === "azalan" ? bv - av : av - bv;
  });

  return (
    <div>
      <h2 className="sayfa-baslik">Hisse Listesi</h2>
      <div className="filtre-bar">
        {["TUMU","CORE","SATELLITE","SAT","TRADE","PATATES","KUMBARA"].map(f => (
          <button
            key={f}
            className={`filtre-btn ${filtre === f ? "aktif" : ""}`}
            onClick={() => setFiltre(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="tablo-kap">
        <table className="tablo">
          <thead>
            <tr>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("id")}>
                Hisse{siralaIkon("id")}
              </th>
              <th>Kat.</th>
              <th>Adet</th>
              <th>Alış</th>
              <th>Güncel</th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("gunluk")}>
                Günlük{siralaIkon("gunluk")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("kzYuzde")}>
                K/Z%{siralaIkon("kzYuzde")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("kzTutar")}>
                K/Z TL{siralaIkon("kzTutar")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("tutar")}>
                Tutar{siralaIkon("tutar")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("potansiyel")}>
                Potansiyel{siralaIkon("potansiyel")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("mevcutOran")}>
                Mev.%{siralaIkon("mevcutOran")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("hedefOran")}>
                Hdf.%{siralaIkon("hedefOran")}
              </th>
              <th style={{ cursor:"pointer" }} onClick={() => sirala("aksiyon")}>
                Aksiyon{siralaIkon("aksiyon")}
              </th>
            </tr>
          </thead>
          <tbody>
            {siraliHisseler.map(h => {
              const { kz, kzYuzde } = karZararHesapla(h);
              const kzPos      = parseFloat(kzYuzde) >= 0;
              const gunluk     = parseFloat(h.gunlukDegisim);
              const tutar      = h.guncel * h.adet;
              const mevcutOran = toplamVarlik > 0
                ? ((tutar / toplamVarlik) * 100).toFixed(1)
                : 0;
              const potansiyel = h.hedef && h.guncel
                ? (((h.hedef - h.guncel) / h.guncel) * 100).toFixed(1)
                : null;

              return (
                <tr key={h.id} className="tablo-satir" onClick={() => onHisseClick(h)}>
                  <td>
                    <b>{h.id}</b>
                    <br />
                    <span className="kucuk">{h.ad}</span>
                  </td>
                  <td>
                    <span className="kat-badge"
                      style={{ background: kategoriRenk(h.kategori) }}>
                      {h.kategori}
                    </span>
                  </td>
                  <td>{h.adet.toLocaleString("tr-TR")}</td>
                  <td>{h.alis.toFixed(2)}</td>
                  <td>{h.guncel.toFixed(2)}</td>
                  <td>
                    {h.gunlukDegisim != null ? (
                      <span className={gunluk >= 0 ? "yesil" : "kirmizi"}>
                        {gunluk >= 0 ? "▲" : "▼"} {Math.abs(gunluk).toFixed(2)}%
                      </span>
                    ) : <span style={{ color:"#475569" }}>—</span>}
                  </td>
                  <td className={kzPos ? "yesil" : "kirmizi"}>
                    {kzPos ? "+" : ""}{kzYuzde}%
                  </td>
                  <td className={kz >= 0 ? "yesil" : "kirmizi"}>
                    {kz >= 0 ? "+" : ""}
                    {kz.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                  </td>
                  <td>
                    {tutar.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                  </td>
                  <td>
                    {potansiyel ? (
                      <span className={parseFloat(potansiyel) >= 0 ? "yesil" : "kirmizi"}>
                        {parseFloat(potansiyel) >= 0 ? "+" : ""}{potansiyel}%
                      </span>
                    ) : <span style={{ color:"#475569" }}>—</span>}
                  </td>
                  <td>
                    <span className={
                      parseFloat(mevcutOran) > (h.hedefOran || 8) ? "kirmizi" : "k0"
                    }>
                      %{mevcutOran}
                    </span>
                  </td>
                  <td style={{ color:"#64748b" }}>
                    %{h.hedefOran || "—"}
                  </td>
                  <td>
                    <span className="ak-badge"
                      style={{ color: aksiyonRenk(h.aksiyon) }}>
                      {h.aksiyon}
                    </span>
                  </td>
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
    hedef: "", stop: "", kategori: "CORE", aksiyon: "TUT", tez: "", not: ""
  });

  function guncelle(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

function hisseSil(id) {
    if (!window.confirm(`${id} hissesini silmek istediğine emin misin?`)) return;
    setHisseler(prev => prev.filter(h => h.id !== id));
  }

  function ekle() {
    if (!form.id.trim() || !form.ad.trim() || !form.adet || !form.alis || !form.guncel) {
      alert("Sembol, Şirket Adı, Adet, Alış ve Güncel fiyat zorunlu.");
      return;
    }
    onEkle({
      id:       form.id.toUpperCase().trim(),
      ad:       form.ad.trim(),
      adet:     parseInt(form.adet),
      alis:     parseFloat(form.alis),
      guncel:   parseFloat(form.guncel),
      hedef:    parseFloat(form.hedef) || 0,
      stop:     parseFloat(form.stop)  || 0,
      kategori: form.kategori,
      aksiyon:  form.aksiyon,
      tez:      form.tez,
      not:      form.not,
    });
  }

  return (
    <div>
      <h2 className="sayfa-baslik">+ Yeni Hisse Ekle</h2>
      <div className="panel">
        <div className="form-grid" style={{ marginBottom: "1rem" }}>

          <label className="form-label">
            Sembol *
            <input className="input" type="text" placeholder="örn: THYAO"
              value={form.id} onChange={e => guncelle("id", e.target.value)} />
          </label>

          <label className="form-label">
            Şirket Adı *
            <input className="input" type="text" placeholder="örn: Türk Hava Yolları"
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
              <option value="BEKLE">BEKLE</option>
              <option value="DUZELTME BEKLE">DUZELTMEBEKLE</option>
              <option value="YENI ALIM YOK">YENIALIMYOK</option>
            </select>
          </label>

        </div>

        <label className="form-label" style={{ display: "block", marginBottom: "0.75rem" }}>
          Yatırım Tezi
          <textarea className="input-alan" rows={3}
            placeholder="Neden bu hisseyi aldın?"
            value={form.tez} onChange={e => guncelle("tez", e.target.value)} />
        </label>

        <label className="form-label" style={{ display: "block", marginBottom: "1.25rem" }}>
          Not
          <textarea className="input-alan" rows={2}
            placeholder="Ek not..."
            value={form.not} onChange={e => guncelle("not", e.target.value)} />
        </label>

        <div className="btn-grup">
          <button className="btn btn-yesil" onClick={ekle}>✓ Hisse Ekle</button>
          <button className="btn btn-gri" onClick={onIptal}>← İptal</button>
        </div>
      </div>
    </div>
  );
}

// ─── GÜNCE ───────────────────────────────────────────────────────────────
function Gunce({ hisseler }) {
  const [notlar, setNotlar] = useState([]);
  const [yuklendi, setYuklendi] = useState(false);

  useEffect(() => {
    notlarOku().then(liste => {
      setNotlar(liste);
      setYuklendi(true);
    });
  }, []);

  useEffect(() => {
    if (yuklendi) notlarYaz(notlar);
  }, [notlar, yuklendi]);
  const [yeniNot, setYeniNot] = useState("");
  const [arama, setArama]     = useState("");

  function notEkle() {
    if (!yeniNot.trim()) return;
    const not = {
      id:       Date.now(),
      tarih:    new Date().toLocaleDateString("tr-TR"),
      icerik:   yeniNot,
      etiketler: (yeniNot.match(/#\w+/g) || []),
    };
    const guncellenmis = [not, ...notlar];
    setNotlar(guncellenmis);
    
    setYeniNot("");
  }

  const filtrelenmis = notlar.filter(n =>
    n.icerik.toLowerCase().includes(arama.toLowerCase())
  );

  return (
    <div>
      <h2 className="sayfa-baslik">📝 Günce</h2>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <textarea className="input-alan" rows={4}
          placeholder={"Bugünkü yorumun...\n#PETKM #KRİZ gibi etiket ekleyebilirsin"}
          value={yeniNot}
          onChange={e => setYeniNot(e.target.value)} />
        <button className="btn btn-mavi" style={{ marginTop: "0.5rem" }} onClick={notEkle}>
          + Not Ekle
        </button>
      </div>

      <input className="input" placeholder="🔍 Ara..."
        value={arama} onChange={e => setArama(e.target.value)}
        style={{ marginBottom: "1rem", width: "100%" }} />

      {filtrelenmis.map(n => (
        <div key={n.id} className="panel" style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>
            {n.tarih}
          </div>
          <p style={{ lineHeight: "1.6", color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
            {n.icerik}
          </p>
          {n.etiketler.length > 0 && (
            <div style={{ marginTop: "6px" }}>
              {n.etiketler.map(e => (
                <span key={e} className="etiket">{e}</span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <button
              onClick={() => {
                if (!window.confirm("Bu notu silmek istediğine emin misin?")) return;
                const yeni = notlar.filter(x => x.id !== n.id);
                setNotlar(yeni);
              }}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.8rem" }}
            >
              🗑 Sil
            </button>
          </div>
        </div>
      ))}

      {filtrelenmis.length === 0 && (
        <p style={{ color: "#64748b" }}>Henüz not yok.</p>
      )}
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
  const [girisYapildi, setGirisYapildi] = useState(girisKontrol);
  const [hisseler,    setHisseler]    = useState([]);
  const [nakit,       setNakit]       = useState(BASLANGIC_NAKIT);
  const [aktifSayfa,  setAktifSayfa]  = useState("dashboard");
  const [seciliHisse, setSeciliHisse] = useState(null);
  const [fiyatYukleniyor, setFiyatYukleniyor] = useState(false);
  const [sonGuncelleme,   setSonGuncelleme]   = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [takipListe, setTakipListe] = useState([]);

  useEffect(() => {
    takipOku().then(setTakipListe);
  }, []);

  // Firebase'den veri yükle
  useEffect(() => {
    let ilkYukleme = true;
    const timeout = setTimeout(() => setYukleniyor(false), 5000);

    async function baslat() {
      try {
        const mevcutVeri = await portfoyOku();
        if (!mevcutVeri || mevcutVeri.length === 0) {
          await portfoyYaz(BASLANGIC_PORTFOY);
        }
      } catch(e) {
        console.error("Başlangıç yazma hatası:", e);
      }

      const portfoyDur = portfoyDinle((gelenHisseler) => {
        if (gelenHisseler && gelenHisseler.length > 0) {
          setHisseler(gelenHisseler);
        }
        if (ilkYukleme) {
          setYukleniyor(false);
          ilkYukleme = false;
        }
      });

      const nakitDur = nakitDinle((gelenNakit) => {
        if (gelenNakit) setNakit(gelenNakit);
      });

      return () => {
        portfoyDur();
        nakitDur();
      };
    }

    baslat();
    return () => clearTimeout(timeout);
  }, []);

  async function fiyatlariCek(onBitti) {
    setFiyatYukleniyor(true);
    try {
      const portfoyIds = hisseler.map(h => h.id);
      const takipIds = takipListe.map(h => h.id);
      const tumIds = [...new Set([...portfoyIds, ...takipIds])];
      const semboller = tumIds.join(",");

      const yanit = await fetch(`${PROXY_URL}/api/fiyat?semboller=${semboller}`);
      const veri = await yanit.json();

      const yeniFiyatlar = {};
      let guncellenenSayisi = 0;

      const yeniHisseler = hisseler.map(h => {
        const d = veri[h.id];
        if (d?.fiyat) {
          guncellenenSayisi++;
          yeniFiyatlar[h.id] = d.fiyat;
          return {
            ...h,
            guncel:        d.fiyat,
            oncekiKapanis: d.oncekiKapanis  ?? h.oncekiKapanis  ?? null,
            gunlukDegisim: d.gunlukDegisim  ?? h.gunlukDegisim  ?? null,
          };
        }
        yeniFiyatlar[h.id] = h.guncel;
        return h;
      });

      console.log("Takip liste:", takipListe);
      console.log("Veri:", veri);

      // Takip listesini de güncelle
      setTakipListe(prev => {
        if (!prev || prev.length === 0) return prev;
        const yeniTakip = prev.map(h => {
          if (veri[h.id]?.fiyat) {
            return {
              ...h,
              guncel: veri[h.id].fiyat.toString(),
              gunlukDegisim: veri[h.id].gunlukDegisim,
            };
          }
          return h;
        });
        takipYaz(yeniTakip);
        return yeniTakip;
      });

      setHisseler(yeniHisseler);
      localStorage.setItem("bist_portfoy", JSON.stringify(yeniHisseler));
      setSonGuncelleme(new Date().toLocaleTimeString("tr-TR"));
      if (onBitti) onBitti(yeniFiyatlar);
      alert(`✅ ${guncellenenSayisi} hissenin fiyatı güncellendi!`);

    } catch (hata) {
      alert("❌ Fiyatlar çekilemedi: " + hata.message);
    } finally {
      setFiyatYukleniyor(false);
    }
  }

  // Giriş kontrolü — tüm hook'lardan SONRA
  if (yukleniyor) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#0f1117", flexDirection: "column", gap: "1rem"
      }}>
        <div style={{ fontSize: "2rem" }}>📈</div>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Veriler yükleniyor...</div>
      </div>
    );
  }
  if (!girisYapildi) {
    return <GirisEkrani onGiris={() => setGirisYapildi(true)} />;
  }

  function hisseGuncelle(id, yeniVeri) {
    setHisseler(prev => {
      const yeni = prev.map(h => h.id === id ? { ...h, ...yeniVeri } : h);
      portfoyYaz(yeni).catch(e => console.error("Yazma hatası:", e));
      return yeni;
    });
  }

  function veriIndir() {
    const veri = { hisseler, nakit, tarih: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(veri, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `bist-portfoy-${new Date().toLocaleDateString("tr-TR").replace(/\./g, "-")}.json`;
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
        if (veri.hisseler) {
          setHisseler(veri.hisseler);
          await portfoyYaz(veri.hisseler);
        }
        if (veri.nakit) {
          setNakit(veri.nakit);
          await nakitYaz(veri.nakit);
        }
        alert("Veri başarıyla yüklendi ve Firebase'e kaydedildi!");
      } catch { alert("Dosya okunamadı."); }
    };
    reader.readAsText(file);
  }

  return (
    <div className="app">
      <Navbar
        aktif={aktifSayfa}
        setAktif={setAktifSayfa}
        onIndir={veriIndir}
        onYukle={veriYukleFile}
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
            toplamVarlik={
              hisseler.reduce((t, h) => t + h.guncel * h.adet, 0) +
              nakit.tlNakit + nakit.usdFon
            }
          />
        )}

        {aktifSayfa === "takip" && (
          <TakipListesi
            liste={takipListe}
            setListe={(yeni) => { setTakipListe(yeni); takipYaz(yeni); }}
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

        {aktifSayfa === "gunce" && (
          <Gunce hisseler={hisseler} />
        )}

        {aktifSayfa === "halkaarzi" && (
          <HalkaArz />
        )}

        {aktifSayfa === "grafikler" && (
          <Grafikler hisseler={hisseler} nakit={nakit} />
        )}

        {aktifSayfa === "takvim" && (
          <BilancTakvim hisseler={hisseler} onGuncelle={hisseGuncelle} />
        )}

        {aktifSayfa === "yeni" && (
          <HisseEkle
            onEkle={(yeniHisse) => {
              setHisseler(prev => [...prev, yeniHisse]);
              setAktifSayfa("liste");
            }}
            onIptal={() => setAktifSayfa("liste")}
          />
        )}

        {aktifSayfa === "nakit" && (
          <NakitYonetim
            nakit={nakit}
            onNakitGuncelle={setNakit}
          />
        )}

      </main>
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
    
    setForm({ ...bos });
    setFormAcik(false);
  }

  function sil(id) {
    if (!window.confirm("Bu kaydı silmek istediğine emin misin?")) return;
    const guncellenmis = arzlar.filter(a => a.id !== id);
    setArzlar(guncellenmis);
    
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
function TakipListesi({ liste, setListe }) {
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState(null);

  const bosForm = {
    id: "", ad: "", guncel: "", alimSeviyesi: "",
    hedef: "", stop: "", kategori: "CORE",
    tez: "", not: "", sektör: ""
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
    setForm({ ...liste[idx] });
    setDuzenlenen(idx);
    setFormAcik(true);
  }

  function alarmVar(h) {
    if (!h.alimSeviyesi || !h.guncel) return false;
    return parseFloat(h.guncel) <= parseFloat(h.alimSeviyesi);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <h2 className="sayfa-baslik" style={{ margin:0 }}>🔭 Takip Listesi</h2>
        <button className="btn btn-mavi" onClick={() => { setFormAcik(!formAcik); setDuzenlenen(null); setForm({ ...bosForm }); }}>
          {formAcik ? "İptal" : "+ Hisse Ekle"}
        </button>
      </div>

      {/* Alarm Özeti */}
      {liste.filter(alarmVar).length > 0 && (
        <div className="panel" style={{ marginBottom:"1rem", borderColor:"#22c55e" }}>
          <h3 className="panel-baslik" style={{ color:"#22c55e" }}>
            🟢 Alım Seviyesine Ulaşan Hisseler ({liste.filter(alarmVar).length})
          </h3>
          {liste.filter(alarmVar).map((h, i) => (
            <div key={i} className="acil-satir">
              <span><b>{h.id}</b> — {h.ad}</span>
              <span className="yesil">
                Güncel: {h.guncel} TL ≤ Alım: {h.alimSeviyesi} TL
              </span>
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
              Alım Seviyesi (Alarm)
              <input className="input" type="number" step="0.01"
                placeholder="Bu fiyata gelince alarm"
                value={form.alimSeviyesi}
                onChange={e => setForm({ ...form, alimSeviyesi: e.target.value })} />
            </label>
            <label className="form-label">
              Hedef Fiyat
              <input className="input" type="number" step="0.01"
                value={form.hedef}
                onChange={e => setForm({ ...form, hedef: e.target.value })} />
            </label>
            <label className="form-label">
              Stop-Loss
              <input className="input" type="number" step="0.01"
                value={form.stop}
                onChange={e => setForm({ ...form, stop: e.target.value })} />
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

      {/* Liste */}
      {liste.length === 0 && !formAcik && (
        <div className="panel" style={{ textAlign:"center", color:"#64748b", padding:"2rem" }}>
          Henüz takip listesi yok. "+ Hisse Ekle" ile başla.
        </div>
      )}

      {liste.map((h, idx) => {
        const alarm = alarmVar(h);
        const potansiyel = h.hedef && h.guncel
          ? (((parseFloat(h.hedef) - parseFloat(h.guncel)) / parseFloat(h.guncel)) * 100).toFixed(1)
          : null;
        return (
          <div key={idx} className="panel" style={{ marginBottom:"0.75rem", borderColor: alarm ? "#22c55e" : undefined }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"4px", flexWrap:"wrap" }}>
                  <b style={{ fontSize:"1rem" }}>{h.id}</b>
                  <span style={{ color:"#94a3b8", fontSize:"0.85rem" }}>{h.ad}</span>
                  <span className="kat-badge" style={{ background: kategoriRenk(h.kategori) }}>
                    {h.kategori}
                  </span>
                  {alarm && (
                    <span className="kat-badge" style={{ background:"#15803d" }}>
                      🟢 ALIM SEVİYESİ
                    </span>
                  )}
                </div>
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", fontSize:"0.82rem", color:"#64748b" }}>
                  {h.guncel && <span>Güncel: <b style={{ color:"#f1f5f9" }}>{h.guncel} TL</b></span>}
                  {h.alimSeviyesi && <span>Alım: <b style={{ color:"#22c55e" }}>{h.alimSeviyesi} TL</b></span>}
                  {h.hedef && <span>Hedef: <b style={{ color:"#38bdf8" }}>{h.hedef} TL</b></span>}
                  {h.stop && <span>Stop: <b style={{ color:"#ef4444" }}>{h.stop} TL</b></span>}
                  {potansiyel && (
                    <span>Potansiyel: <b className={parseFloat(potansiyel) >= 0 ? "yesil" : "kirmizi"}>
                      {parseFloat(potansiyel) >= 0 ? "+" : ""}{potansiyel}%
                    </b></span>
                  )}
                  {h.sektör && <span>Sektör: {h.sektör}</span>}
                </div>
                {h.tez && (
                  <p style={{ marginTop:"6px", fontSize:"0.82rem", color:"#94a3b8", lineHeight:"1.5" }}>
                    {h.tez}
                  </p>
                )}
              </div>
              <div style={{ display:"flex", gap:"6px", marginLeft:"1rem" }}>
                <button onClick={() => duzenle(idx)}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.9rem" }}>
                  ✏️
                </button>
                <button onClick={() => sil(idx)}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:"0.9rem" }}>
                  🗑
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}