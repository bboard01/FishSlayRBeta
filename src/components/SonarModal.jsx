import { useData } from '../lib/DataContext.jsx';
import { esc } from '../lib/fishDisplay.js';
import { FishAudio } from '../lib/audio.js';

// SonarModal — the FishSlayR v1.2 "Sonar Fix" GPS location readout, ported 1:1
// from the single-file app's openLocationModal(). Self-contained and offline: a
// stylized sonar/radar sweep, the catch coordinates in DMS + decimal, water /
// structure / heading / catch context tiles, and a one-tap hand-off to the
// phone's native Maps app (which only needs signal when you actually open it).
// No tiles, no API key, no network dependency. Opens from a catch's Catch Card
// when that catch carries a photo location.

// Decimal degrees → D°M'S" with hemisphere — ported verbatim from ddToDMS().
function ddToDMS(dd, isLat) {
  const dir = dd >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
  const abs = Math.abs(dd);
  const d = Math.floor(abs);
  const mf = (abs - d) * 60;
  const m = Math.floor(mf);
  const s = (mf - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1)}"${dir}`;
}

// A deterministic "bearing" for flavor when we only have a single point (no
// track) — ported verbatim from flavorBearing().
function flavorBearing(lat, lon) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.abs(Math.round((lat + lon) * 10)) % 16;
  return { label: dirs[idx], deg: idx * 22.5 };
}

// Open the fix in the phone's native maps app — geo/Apple/Google as in the
// original openNativeMaps(). Only touches the network when tapped.
function openNativeMaps(lat, lon, label) {
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const q = encodeURIComponent(label || 'Catch location');
  const url = isApple
    ? `https://maps.apple.com/?ll=${lat},${lon}&q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  window.open(url, '_blank');
}

export default function SonarModal({ catchId, onClose, onToast }) {
  const { data, sessionFor } = useData();

  const c = data.catches.find((x) => x.id === catchId);
  if (!c || c.photoLat == null) return null;

  const s = sessionFor(c.sessionId) || {};
  const lat = +c.photoLat;
  const lon = +c.photoLon;
  const bearing = flavorBearing(lat, lon);
  const src = c.photoGeoSource === 'live' ? 'Live GPS fix' : 'Read from photo';

  // Copy the decimal coordinates to the clipboard — ported from copyCoords().
  const copyCoords = () => {
    const t = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t)
        .then(() => onToast && onToast('📋 Coordinates copied'))
        .catch(() => onToast && onToast(t));
    } else if (onToast) onToast(t);
  };

  return (
    <div className="location-backdrop active" onClick={onClose}>
      <div className="location-card" onClick={(e) => e.stopPropagation()}>
        <div className="sonar-head">
          <span className="eyebrow">Sonar Fix • {esc(src)}</span>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div className="sonar-stage">
          <svg viewBox="0 0 240 240" className="sonar-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="sonarGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(125,231,255,.35)" />
                <stop offset="70%" stopColor="rgba(125,231,255,.05)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
              <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(120,243,189,.0)" />
                <stop offset="100%" stopColor="rgba(120,243,189,.55)" />
              </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="112" fill="url(#sonarGlow)" />
            <circle cx="120" cy="120" r="112" fill="none" stroke="rgba(125,231,255,.25)" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="80" fill="none" stroke="rgba(125,231,255,.18)" strokeWidth="1" />
            <circle cx="120" cy="120" r="48" fill="none" stroke="rgba(125,231,255,.18)" strokeWidth="1" />
            <circle cx="120" cy="120" r="16" fill="none" stroke="rgba(125,231,255,.18)" strokeWidth="1" />
            <line x1="120" y1="8" x2="120" y2="232" stroke="rgba(125,231,255,.12)" strokeWidth="1" />
            <line x1="8" y1="120" x2="232" y2="120" stroke="rgba(125,231,255,.12)" strokeWidth="1" />
            <g className="sonar-sweep" style={{ transformOrigin: '120px 120px' }}>
              <path d="M120 120 L120 8 A112 112 0 0 1 214 66 Z" fill="url(#sweepGrad)" />
            </g>
            <g className="sonar-ping">
              <circle cx="120" cy="120" r="7" fill="#78f3bd" stroke="#fff" strokeWidth="2" />
              <circle cx="120" cy="120" r="7" fill="none" stroke="#78f3bd" strokeWidth="2" className="ping-ring" />
            </g>
            <text x="120" y="20" textAnchor="middle" fill="rgba(223,248,255,.7)" fontSize="11" fontWeight="800">N</text>
            <text x="120" y="228" textAnchor="middle" fill="rgba(223,248,255,.5)" fontSize="11" fontWeight="800">S</text>
            <text x="228" y="124" textAnchor="middle" fill="rgba(223,248,255,.5)" fontSize="11" fontWeight="800">E</text>
            <text x="12" y="124" textAnchor="middle" fill="rgba(223,248,255,.5)" fontSize="11" fontWeight="800">W</text>
          </svg>
        </div>

        <div className="sonar-readout">
          <div className="sonar-coord-big">{esc(ddToDMS(lat, true))}</div>
          <div className="sonar-coord-big">{esc(ddToDMS(lon, false))}</div>
          <div className="sonar-decimal">{lat.toFixed(5)}, {lon.toFixed(5)}</div>
        </div>

        <div className="sonar-context">
          <div className="sonar-tile"><span>Water</span><strong>{esc(s.water || 'Unknown')}</strong></div>
          <div className="sonar-tile"><span>Structure</span><strong>{esc(c.structure || '—')}</strong></div>
          <div className="sonar-tile"><span>Heading</span><strong>{bearing.label} {Math.round(bearing.deg)}°</strong></div>
          <div className="sonar-tile"><span>Caught</span><strong>{esc(c.species)} {esc(c.length)}"</strong></div>
        </div>

        <div className="sonar-actions">
          <button
            className="btn primary"
            onClick={() => openNativeMaps(lat, lon, (s.water || 'Catch') + ' — ' + c.species)}
          >
            🗺 Open in Maps
          </button>
          <button className="btn" onClick={copyCoords}>Copy Coordinates</button>
        </div>

        <p className="sonar-foot muted">
          Map opens in your phone's app when you have signal. The fix itself is
          stored on your device.
        </p>
      </div>
    </div>
  );
}

// Fire the sonar sound when the modal mounts — exported so App can play it at
// the same moment the modal opens (matches openLocationModal's FishAudio.play).
export function playSonar() { FishAudio.play('sonar'); }
