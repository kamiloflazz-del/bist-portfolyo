import { useState, useEffect } from "react";
import { BASLANGIC_PORTFOY, BASLANGIC_NAKIT } from "./data/portfolyo";
import "./index.css";

// ─── VERİ YÖNETİMİ ───────────────────────────────────────────────────────
function veriYukle() {
  try {
    const k = localStorage.getItem("bist_portfoy");
    return k ? JSON.parse(k) : BASLANGIC_PORTFOY;
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

function uyariKontrol(h) {
  const uyarilar = [];
  const { kzYuzde } = karZararHesapla(h);
  if (h.hedef && h.guncel >= h.hedef)
    uyarilar.push({ tip: "hedef", mesaj: `${h.id} hedef fiyata ulaştı (${h.hedef} TL)` });
  if (h.stop && h.guncel <= h.stop)
    uyarilar.push({ tip: "stop", mesaj: `${h.id} stop-loss seviyesinde! (${h.stop} TL)` });
  if (parseFloat(kzYuzde) >= 20)
    uyarilar.push({ tip: "kar", mesaj: `${h.id} %${kzYuzde} kârda — kâr al düşün` });
  if (parseFloat(kzYuzde) <= -10)
    uyarilar.push({ tip: "risk", mesaj: `${h.id} %${kzYuzde} zararda — risk yönet` });
  return uyarilar;
}

function kategoriRenk(kat) {
  if (kat === "CORE") return "#22c55e";
  if (kat === "SAT")  return "#f59e0b";
  return "#64748b";
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
    { id: "guncelle",  label: "💱 Fiyat Güncelle" },
    { id: "gunce",     label: "📝 Günce"           },
    { id: "yeni",      label: "+ Hisse Ekle"       },
    { id: "grafikler", label: "📈 Grafikler" },
    { id: "senaryo", label: "📐 Senaryo" },
    { id: "halkaarzi", label: "🏦 Halka Arz" },
    { id: "takvim", label: "📅 Takvim" },


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
        <label className="nav-btn" style={{ cursor: "pointer" }}>
          ⬆ Yükle
          <input type="file" accept=".json" style={{ display: "none" }} onChange={onYukle} />
        </label>
      </div>
    </nav>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────
function Dashboard({ hisseler, nakit, onHisseClick }) {
  const toplamHisse   = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const toplamMaliyet = hisseler.reduce((t, h) => t + h.alis * h.adet, 0);
  const toplamKZ      = toplamHisse - toplamMaliyet;
  const toplamKZYuzde = ((toplamKZ / toplamMaliyet) * 100).toFixed(1);
  const toplamVarlik  = toplamHisse + nakit.tlNakit + nakit.usdFon;

  const coreHisseler = hisseler.filter(h => h.kategori === "CORE");
  const coreDeger    = coreHisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const coreYuzde    = ((coreDeger / toplamVarlik) * 100).toFixed(0);

  const tumUyarilar  = hisseler.flatMap(h => uyariKontrol(h));
  const acilSatlar   = hisseler.filter(h => h.aksiyon === "SAT");

  return (
    <div>
      <h2 className="sayfa-baslik">Dashboard</h2>

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
    </div>
  );
}

// ─── HİSSE LİSTESİ ───────────────────────────────────────────────────────
function HisseListe({ hisseler, onHisseClick }) {
  const [filtre, setFiltre] = useState("TUMU");
  const filtrelenmis = filtre === "TUMU"
    ? hisseler
    : hisseler.filter(h => h.kategori === filtre);

  return (
    <div>
      <h2 className="sayfa-baslik">Hisse Listesi</h2>
      <div className="filtre-bar">
        {["TUMU", "CORE", "SAT", "TRADE"].map(f => (
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
              <th>Hisse</th>
              <th>Kat.</th>
              <th>Adet</th>
              <th>Alış</th>
              <th>Güncel</th>
              <th>K/Z%</th>
              <th>Hedef</th>
              <th>Stop</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(h => {
              const { kzYuzde } = karZararHesapla(h);
              const kzPos = parseFloat(kzYuzde) >= 0;
              return (
                <tr key={h.id} className="tablo-satir" onClick={() => onHisseClick(h)}>
                  <td>
                    <b>{h.id}</b>
                    <br />
                    <span className="kucuk">{h.ad}</span>
                  </td>
                  <td>
                    <span className="kat-badge" style={{ background: kategoriRenk(h.kategori) }}>
                      {h.kategori}
                    </span>
                  </td>
                  <td>{h.adet.toLocaleString("tr-TR")}</td>
                  <td>{h.alis.toFixed(2)}</td>
                  <td>{h.guncel.toFixed(2)}</td>
                  <td className={kzPos ? "yesil" : "kirmizi"}>
                    {kzPos ? "+" : ""}{kzYuzde}%
                  </td>
                  <td>{h.hedef || "—"}</td>
                  <td>{h.stop  || "—"}</td>
                  <td>
                    <span className="ak-badge" style={{ color: aksiyonRenk(h.aksiyon) }}>
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
function HisseDetay({ hisse, onGuncelle, onGeri, onSil }) {
  const [duzenleme, setDuzenleme] = useState(false);
  const [form, setForm] = useState({ ...hisse });
  const { kz, kzYuzde, maliyet, guncelDeger } = karZararHesapla(hisse);

  function kaydet() {
    onGuncelle(hisse.id, {
      ...form,
      alis:   parseFloat(form.alis),
      adet:   parseInt(form.adet),
      guncel: parseFloat(form.guncel),
      hedef:  parseFloat(form.hedef),
      stop:   parseFloat(form.stop),
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
      </div>

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

      {duzenleme && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h3 className="panel-baslik">✏️ Düzenle</h3>
          <div className="form-grid">
            {[
              { label: "Güncel Fiyat", key: "guncel" },
              { label: "Hedef Fiyat",  key: "hedef"  },
              { label: "Stop-Loss",    key: "stop"   },
              { label: "Adet",         key: "adet"   },
              { label: "Alış Fiyatı",  key: "alis"   },
            ].map(({ label, key }) => (
              <label key={key} className="form-label">
                {label}
                <input className="input" type="number" step="0.01"
                  value={form[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </label>
            ))}
            <label className="form-label">
              Kategori
              <select className="input" value={form.kategori}
                onChange={e => setForm({ ...form, kategori: e.target.value })}>
                <option value="CORE">CORE</option>
                <option value="SAT">SAT</option>
                <option value="TRADE">TRADE</option>
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

      <div className="btn-grup">
        {duzenleme ? (
          <>
            <button className="btn btn-yesil" onClick={kaydet}>✓ Kaydet</button>
            <button className="btn btn-gri" onClick={() => { setDuzenleme(false); setForm({ ...hisse }); }}>
              İptal
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-mavi" onClick={() => setDuzenleme(true)}>✏️ Düzenle</button>
            <button className="btn btn-kirmizi" onClick={() => onSil(hisse.id)}>🗑 Sil</button>
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
              <option value="SAT">SAT</option>
              <option value="TRADE">TRADE</option>
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
  const [notlar, setNotlar] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bist_notlar")) || []; }
    catch { return []; }
  });
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
    localStorage.setItem("bist_notlar", JSON.stringify(guncellenmis));
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
        </div>
      ))}

      {filtrelenmis.length === 0 && (
        <p style={{ color: "#64748b" }}>Henüz not yok.</p>
      )}
    </div>
  );
}

// ─── FİYAT GÜNCELLE ──────────────────────────────────────────────────────
function FiyatGuncelle({ hisseler, onKaydet, onIptal }) {
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
        Her hissenin güncel fiyatını gir, sonra Kaydet'e bas.
      </p>
      <div className="panel">
        <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
          {hisseler.map(h => {
            const { kzYuzde } = karZararHesapla({ ...h, guncel: parseFloat(fiyatlar[h.id]) || h.guncel });
            const kzPos = parseFloat(kzYuzde) >= 0;
            return (
              <label key={h.id} className="form-label">
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{h.id}</b>
                  <span className={kzPos ? "yesil" : "kirmizi"} style={{ fontSize: "0.75rem" }}>
                    {kzPos ? "+" : ""}{kzYuzde}%
                  </span>
                </span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={fiyatlar[h.id]}
                  onChange={e => setFiyatlar(prev => ({ ...prev, [h.id]: e.target.value }))}
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
  const [hisseler,    setHisseler]    = useState(veriYukle);
  const [nakit,       setNakit]       = useState(nakitYukle);
  const [aktifSayfa,  setAktifSayfa]  = useState("dashboard");
  const [seciliHisse, setSeciliHisse] = useState(null);

  useEffect(() => {
    localStorage.setItem("bist_portfoy", JSON.stringify(hisseler));
  }, [hisseler]);

  useEffect(() => {
    localStorage.setItem("bist_nakit", JSON.stringify(nakit));
  }, [nakit]);

  function hisseGuncelle(id, yeniVeri) {
    setHisseler(prev => prev.map(h => h.id === id ? { ...h, ...yeniVeri } : h));
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
    reader.onload = (ev) => {
      try {
        const veri = JSON.parse(ev.target.result);
        if (veri.hisseler) setHisseler(veri.hisseler);
        if (veri.nakit)    setNakit(veri.nakit);
        alert("Veri başarıyla yüklendi!");
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
          />
        )}

        {aktifSayfa === "liste" && (
          <HisseListe
            hisseler={hisseler}
            onHisseClick={(h) => { setSeciliHisse(h); setAktifSayfa("detay"); }}
          />
        )}

        {aktifSayfa === "detay" && seciliHisse && (
          <HisseDetay
            hisse={hisseler.find(h => h.id === seciliHisse.id)}
            onGuncelle={hisseGuncelle}
            onGeri={() => setAktifSayfa("liste")}
            onSil={(id) => { hisseSil(id); setAktifSayfa("liste"); }}
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
          />
        )}

        {aktifSayfa === "gunce" && (
          <Gunce hisseler={hisseler} />
        )}

        {aktifSayfa === "halkaarzi" && (
          <HalkaArz />
        )}

        {aktifSayfa === "senaryo" && (
          <SenaryoSimulator hisseler={hisseler} nakit={nakit} />
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

  const [arzlar, setArzlar] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bist_halkaarzi")) || []; }
    catch { return []; }
  });
  const [form, setForm]         = useState({ ...bos });
  const [formAcik, setFormAcik] = useState(false);

  function kaydet() {
    if (!form.sirket.trim()) { alert("Şirket adı zorunlu."); return; }
    const yeni = { ...form, id: Date.now() };
    const guncellenmis = [yeni, ...arzlar];
    setArzlar(guncellenmis);
    localStorage.setItem("bist_halkaarzi", JSON.stringify(guncellenmis));
    setForm({ ...bos });
    setFormAcik(false);
  }

  function sil(id) {
    if (!window.confirm("Bu kaydı silmek istediğine emin misin?")) return;
    const guncellenmis = arzlar.filter(a => a.id !== id);
    setArzlar(guncellenmis);
    localStorage.setItem("bist_halkaarzi", JSON.stringify(guncellenmis));
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

// ─── SENARYO SİMÜLATÖRÜ ──────────────────────────────────────────────────
function SenaryoSimulator({ hisseler, nakit }) {
  const [degisimler, setDegisimler] = useState(
    Object.fromEntries(hisseler.map(h => [h.id, 0]))
  );
  const [topluDegisim, setTopluDegisim] = useState("");

  function topluUygula() {
    const yuzde = parseFloat(topluDegisim);
    if (isNaN(yuzde)) return;
    setDegisimler(Object.fromEntries(hisseler.map(h => [h.id, yuzde])));
  }

  function sifirla() {
    setDegisimler(Object.fromEntries(hisseler.map(h => [h.id, 0])));
    setTopluDegisim("");
  }

  const senaryoPortfoy = hisseler.map(h => {
    const degisim = parseFloat(degisimler[h.id]) || 0;
    const yeniFiyat = h.guncel * (1 + degisim / 100);
    const yeniDeger = yeniFiyat * h.adet;
    const eskiDeger = h.guncel * h.adet;
    return { ...h, yeniFiyat, yeniDeger, fark: yeniDeger - eskiDeger };
  });

  const toplamEski  = hisseler.reduce((t, h) => t + h.guncel * h.adet, 0);
  const toplamYeni  = senaryoPortfoy.reduce((t, h) => t + h.yeniDeger, 0);
  const toplamFark  = toplamYeni - toplamEski;
  const toplamYuzde = ((toplamFark / toplamEski) * 100).toFixed(2);

  return (
    <div>
      <h2 className="sayfa-baslik">📐 Senaryo Simülatörü</h2>
      <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.85rem" }}>
        Fiyatların değişeceği senaryoyu simüle et. Gerçek verilerin değişmez.
      </p>

      {/* Toplu Değişim */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h3 className="panel-baslik">Tüm Portföye Uygula</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input className="input" type="number" step="1" placeholder="örn: -10 veya +15"
            value={topluDegisim}
            onChange={e => setTopluDegisim(e.target.value)}
            style={{ width: "160px" }} />
          <span style={{ color: "#64748b" }}>%</span>
          <button className="btn btn-mavi" onClick={topluUygula}>Uygula</button>
          <button className="btn btn-gri"  onClick={sifirla}>Sıfırla</button>

          {/* Hızlı senaryolar */}
          {[
            { label: "Piyasa -%10", val: -10 },
            { label: "Piyasa -%20", val: -20 },
            { label: "Piyasa +%15", val: 15  },
          ].map(s => (
            <button key={s.label} className="btn btn-gri"
              style={{ fontSize: "0.75rem" }}
              onClick={() => {
                setTopluDegisim(s.val.toString());
                setDegisimler(Object.fromEntries(hisseler.map(h => [h.id, s.val])));
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Özet */}
      <div className="kart-grid" style={{ marginBottom: "1rem" }}>
        <div className="kart">
          <div className="kart-label">Mevcut Hisse Değeri</div>
          <div className="kart-deger">
            {toplamEski.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Senaryo Sonrası</div>
          <div className="kart-deger">
            {toplamYeni.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
          </div>
        </div>
        <div className="kart">
          <div className="kart-label">Fark</div>
          <div className={`kart-deger ${toplamFark >= 0 ? "yesil" : "kirmizi"}`}>
            {toplamFark >= 0 ? "+" : ""}
            {toplamFark.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
            <span className="kart-alt"> ({toplamYuzde}%)</span>
          </div>
        </div>
      </div>

      {/* Hisse Bazlı */}
      <div className="panel">
        <h3 className="panel-baslik">Hisse Bazlı Değişim</h3>
        <div className="tablo-kap">
          <table className="tablo">
            <thead>
              <tr>
                <th>Hisse</th>
                <th>Kat.</th>
                <th>Mevcut Fiyat</th>
                <th>% Değişim</th>
                <th>Senaryo Fiyat</th>
                <th>Fark (TL)</th>
              </tr>
            </thead>
            <tbody>
              {senaryoPortfoy.map(h => (
                <tr key={h.id}>
                  <td><b>{h.id}</b></td>
                  <td>
                    <span className="kat-badge" style={{ background: kategoriRenk(h.kategori) }}>
                      {h.kategori}
                    </span>
                  </td>
                  <td>{h.guncel.toFixed(2)}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      step="1"
                      value={degisimler[h.id]}
                      onChange={e => setDegisimler(prev => ({ ...prev, [h.id]: e.target.value }))}
                      style={{ width: "80px", padding: "3px 6px", textAlign: "center" }}
                    />
                    <span style={{ marginLeft: "4px", color: "#64748b", fontSize: "0.8rem" }}>%</span>
                  </td>
                  <td>{h.yeniFiyat.toFixed(2)}</td>
                  <td className={h.fark >= 0 ? "yesil" : "kirmizi"}>
                    {h.fark >= 0 ? "+" : ""}
                    {h.fark.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
    onGuncelle(secili, { bilancTarih: tarihForm });
    setSecili(null);
    setTarihForm("");
  }

  function tarihSil(id) {
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