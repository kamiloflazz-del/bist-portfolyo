import { db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const KULLANICI_ID = "kamil";

// undefined değerleri temizle
function temizle(veri) {
  return JSON.parse(JSON.stringify(veri, (key, val) =>
    val === undefined ? null : val
  ));
}

// ─── OKUMA ───────────────────────────────────────────────────────────────
export async function portfoyOku() {
  const ref = doc(db, "portfoy", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().hisseler : null;
}

export async function nakitOku() {
  const ref = doc(db, "nakit", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function notlarOku() {
  const ref = doc(db, "notlar", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function islemlerOku() {
  const ref = doc(db, "islemler", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function halkaArzOku() {
  const ref = doc(db, "halkaarzi", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function takipOku() {
  const ref = doc(db, "takip", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

// ─── YAZMA ───────────────────────────────────────────────────────────────
export async function portfoyYaz(hisseler) {
  const ref = doc(db, "portfoy", KULLANICI_ID);
  await setDoc(ref, { hisseler: temizle(hisseler) });
}

export async function nakitYaz(nakit) {
  const ref = doc(db, "nakit", KULLANICI_ID);
  await setDoc(ref, temizle(nakit));
}

export async function notlarYaz(liste) {
  const ref = doc(db, "notlar", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

export async function islemlerYaz(liste) {
  const ref = doc(db, "islemler", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

export async function halkaArzYaz(liste) {
  const ref = doc(db, "halkaarzi", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

export async function takipYaz(liste) {
  const ref = doc(db, "takip", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

// ─── GERÇEK ZAMANLI DİNLEYİCİLER ─────────────────────────────────────────
export function portfoyDinle(callback) {
  const ref = doc(db, "portfoy", KULLANICI_ID);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const hisseler = snap.data().hisseler;
      if (hisseler && hisseler.length > 0) callback(hisseler);
    }
  });
}

export function nakitDinle(callback) {
  const ref = doc(db, "nakit", KULLANICI_ID);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ───  Bilanço Takvimi Firebase'e Bağla ──────────────────────────────
export async function bilancOku() {
  const ref = doc(db, "bilanc", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().tarihler : {};
}

export async function bilancYaz(tarihler) {
  const ref = doc(db, "bilanc", KULLANICI_ID);
  await setDoc(ref, { tarihler: temizle(tarihler) });
}

export async function alarmGecmisiOku() {
  const ref = doc(db, "alarmGecmisi", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function alarmGecmisiYaz(liste) {
  const ref = doc(db, "alarmGecmisi", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

export async function snapshotOku() {
  const ref = doc(db, "snapshot", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function snapshotYaz(liste) {
  const ref = doc(db, "snapshot", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}

export async function arsivOku() {
  const ref = doc(db, "arsiv", KULLANICI_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().liste : [];
}

export async function arsivYaz(liste) {
  const ref = doc(db, "arsiv", KULLANICI_ID);
  await setDoc(ref, { liste: temizle(liste) });
}