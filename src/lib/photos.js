// FishSlayR Photo Engine — ported from the single-file app's photo layer.
// Hybrid storage: the full-res display Blob lives in IndexedDB; a small base64
// thumbnail rides on the catch object for instant rendering. Reads the EXIF
// timestamp + best-effort GPS, with a live-geolocation fallback. Self-contained,
// no external libraries. Works on iOS Safari + Android Chrome.

const PHOTO_DB = 'fishslayr_photos';
const PHOTO_STORE = 'catchPhotos';
const PHOTO_DB_VER = 1;

let _photoDbPromise = null;
function photoDB() {
  if (_photoDbPromise) return _photoDbPromise;
  _photoDbPromise = new Promise((res, rej) => {
    if (!('indexedDB' in window)) { rej(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(PHOTO_DB, PHOTO_DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(e.target.error || new Error('idb-open-failed'));
  });
  return _photoDbPromise;
}

export async function photoPut(catchId, blob) {
  try {
    const db = await photoDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).put(blob, catchId);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('photoPut failed', e); return false; }
}

export async function photoGet(catchId) {
  try {
    const db = await photoDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const r = tx.objectStore(PHOTO_STORE).get(catchId);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { console.warn('photoGet failed', e); return null; }
}

export async function photoClearAll() {
  try {
    const db = await photoDB();
    return await new Promise((res) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).clear();
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch (e) { return false; }
}

export async function photoDelete(catchId) {
  try {
    const db = await photoDB();
    return await new Promise((res) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).delete(catchId);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch (e) { return false; }
}

// ---- image downscale to thumbnail (base64) + display-res blob ----
function loadImageFromFile(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image-decode-failed')); };
    img.src = url;
  });
}
function drawScaled(img, maxDim) {
  let { naturalWidth: w, naturalHeight: h } = img;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  cvs.getContext('2d').drawImage(img, 0, 0, w, h);
  return cvs;
}
function dataURLtoBlob(dataURL) {
  const [head, body] = dataURL.split(',');
  const mime = (head.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function canvasToBlob(cvs, type, quality) {
  return new Promise((res) => {
    if (cvs.toBlob) cvs.toBlob((b) => res(b), type, quality);
    else res(dataURLtoBlob(cvs.toDataURL(type, quality)));
  });
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

// ---- minimal EXIF reader: DateTimeOriginal (0x9003) + GPS ----
function readExif(file) {
  return new Promise((resolve) => {
    const slice = file.slice(0, 256 * 1024); // EXIF lives in the first bytes
    const r = new FileReader();
    r.onload = () => { try { resolve(parseExif(new DataView(r.result))); } catch { resolve({}); } };
    r.onerror = () => resolve({});
    r.readAsArrayBuffer(slice);
  });
}
function parseExif(view) {
  const out = {};
  if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return out; // not JPEG
  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint16(offset) === 0xFFE1) return parseApp1(view, offset + 4) || out; // APP1
    if ((view.getUint16(offset) & 0xFF00) !== 0xFF00) break;
    offset += 2 + view.getUint16(offset + 2);
  }
  return out;
}
function parseApp1(view, start) {
  const out = {};
  if (view.getUint32(start) !== 0x45786966) return out; // "Exif"
  const tiff = start + 6;
  const little = view.getUint16(tiff) === 0x4949;
  const g16 = (o) => view.getUint16(o, little);
  const g32 = (o) => view.getUint32(o, little);
  if (view.getUint16(tiff + 2, little) !== 0x002A) return out;
  const ifd0 = tiff + g32(tiff + 4);
  let exifIFD = null, gpsIFD = null;
  const readDir = (dirStart) => {
    const n = g16(dirStart); const entries = [];
    for (let i = 0; i < n; i++) {
      const e = dirStart + 2 + i * 12;
      entries.push({ tag: g16(e), type: g16(e + 2), count: g32(e + 4), valOff: e + 8 });
    }
    return entries;
  };
  const strVal = (e) => {
    const o = e.count > 4 ? tiff + g32(e.valOff) : e.valOff;
    let s = '';
    for (let i = 0; i < e.count - 1; i++) s += String.fromCharCode(view.getUint8(o + i));
    return s;
  };
  const ratVal = (o) => { const num = g32(o), den = g32(o + 4); return den ? num / den : 0; };
  try {
    readDir(ifd0).forEach((e) => {
      if (e.tag === 0x8769) exifIFD = tiff + g32(e.valOff);
      if (e.tag === 0x8825) gpsIFD = tiff + g32(e.valOff);
    });
    if (exifIFD) {
      readDir(exifIFD).forEach((e) => {
        if (e.tag === 0x9003 || e.tag === 0x9004) { const s = strVal(e); if (s && !out.dateTime) out.dateTime = s; }
      });
    }
    if (gpsIFD) {
      let latRef = 'N', lonRef = 'E', lat = null, lon = null;
      readDir(gpsIFD).forEach((e) => {
        if (e.tag === 0x0001) latRef = String.fromCharCode(view.getUint8(e.valOff));
        if (e.tag === 0x0003) lonRef = String.fromCharCode(view.getUint8(e.valOff));
        if (e.tag === 0x0002) { const o = tiff + g32(e.valOff); lat = ratVal(o) + ratVal(o + 8) / 60 + ratVal(o + 16) / 3600; }
        if (e.tag === 0x0004) { const o = tiff + g32(e.valOff); lon = ratVal(o) + ratVal(o + 8) / 60 + ratVal(o + 16) / 3600; }
      });
      if (lat != null && lon != null) {
        out.lat = (latRef === 'S' ? -1 : 1) * lat;
        out.lon = (lonRef === 'W' ? -1 : 1) * lon;
      }
    }
  } catch { /* best-effort */ }
  return out;
}
// EXIF datetime "YYYY:MM:DD HH:MM:SS" -> { date:'YYYY-MM-DD', time:'HH:MM' }
export function exifDateTimeParts(dt) {
  const m = String(dt || '').match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

// ---- live geolocation (reliable fallback when EXIF GPS is stripped) ----
export function getLiveLocation(timeoutMs = 8000) {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) { res(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => res(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

// ---- capture: turn a chosen file into thumb + display blob + autofill info ----
// Returns a patch to merge into the catch draft (thumbnail, display blob for
// IndexedDB, meta, autofilled time, GPS) plus a human-readable status. Ported
// from handleCatchPhoto(); the React caller handles the state update + render.
export async function processCatchPhoto(file, session = {}) {
  const [exif, loaded] = await Promise.all([readExif(file), loadImageFromFile(file)]);
  const { img, url } = loaded;

  const dispBlob = await canvasToBlob(drawScaled(img, 1600), 'image/jpeg', 0.82);
  const thumbBlob = await canvasToBlob(drawScaled(img, 640), 'image/jpeg', 0.72);
  const thumbDataURL = await blobToDataURL(thumbBlob);
  URL.revokeObjectURL(url);

  const patch = {
    _photoDispBlob: dispBlob,
    photoThumb: thumbDataURL,
    photoMeta: { w: img.naturalWidth, h: img.naturalHeight, ts: Date.now() },
  };
  const filled = [];

  const parts = exifDateTimeParts(exif.dateTime);
  if (parts) {
    patch.time = parts.time;
    filled.push('time ' + parts.time);
    if (session && session.date && parts.date && session.date !== parts.date) {
      patch._photoDateNote = `Photo dated ${parts.date} (trip is ${session.date})`;
    }
  }
  if (exif.lat != null && exif.lon != null) {
    patch.photoLat = exif.lat;
    patch.photoLon = exif.lon;
    patch.photoGeoSource = 'photo';
    filled.push('GPS from photo');
  }

  const status = `✓ Photo attached${filled.length ? ' — autofilled ' + filled.join(', ') : ''}`;
  return { patch, status };
}
