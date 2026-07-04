// FishAudio — the synthesized Web Audio engine, ported 1:1 from the single-file
// app (unlock/tone/noise/FishAudio.play + haptic). Every sound is generated on
// the fly from oscillators and filtered noise; there are no audio files.
//
// The original read sound settings off the global `data.sound` object. In the
// React build that state lives in the DataContext, so instead of importing data
// here (which would couple the engine to a component tree and risk stale reads),
// the engine holds a tiny settings snapshot that the app keeps in sync via
// setAudioSettings(). Everything else is the original logic verbatim:
//   - master/effects gain multipliers and the enabled flag gate all output
//   - tone(): a single oscillator with an exponential attack/decay envelope,
//     optionally sweeping its frequency (used for sonar pings and chirps)
//   - noise(): a decaying lowpass-filtered noise burst (splashes, chapters)
//   - FishAudio.play(name): the same six-voice sound bank keyed by name
//   - haptic(): navigator.vibrate gated on the haptics preference
//
// Sounds are only audible after a user gesture unlocks the AudioContext (browser
// autoplay policy) — the original relied on the same thing; the app calls
// unlock() from the sound-enable toggle and on the first click.

// --- Settings snapshot (kept current by the app; mirrors data.sound) ----------
let settings = { enabled: false, master: 0.65, effects: 0.75, haptics: true };

// Update the engine's copy of the sound preferences. Call whenever data.sound
// changes so mute/master/effects/haptics take effect immediately.
export function setAudioSettings(sound) {
  settings = {
    enabled: !!(sound && sound.enabled),
    master: sound && sound.master != null ? sound.master : 0.65,
    effects: sound && sound.effects != null ? sound.effects : 0.75,
    haptics: sound ? sound.haptics !== false : true,
  };
}

function soundOn() { return settings.enabled; }
function gain(v = 0.1) { return v * (settings.master ?? 0.65) * (settings.effects ?? 0.75); }

// --- AudioContext (lazy, resumed on demand) -----------------------------------
let audioCtx = null;

// Create/resume the shared AudioContext. Safe to call repeatedly; returns null
// where Web Audio isn't available. Must be triggered by a user gesture the first
// time (browser autoplay policy) — the app calls this from the sound toggle and
// the global first-click handler.
export function unlock() {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// A single oscillator note with an exponential attack/decay. `to` sweeps the
// frequency across the note for pings/chirps. Ported verbatim from tone().
function tone(f = 440, d = 0.18, type = 'sine', g = 0.12, when = 0, to = null) {
  if (!soundOn()) return;
  const ctx = unlock();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, ctx.currentTime + when);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + when + d);
  gn.gain.setValueAtTime(0.0001, ctx.currentTime + when);
  gn.gain.exponentialRampToValueAtTime(gain(g), ctx.currentTime + when + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + d);
  o.connect(gn); gn.connect(ctx.destination);
  o.start(ctx.currentTime + when);
  o.stop(ctx.currentTime + when + d + 0.05);
}

// A decaying, lowpass-filtered noise burst — splashes and chapter washes.
// Ported verbatim from noise().
function noise(d = 0.18, g = 0.08, f = 900, when = 0) {
  if (!soundOn()) return;
  const ctx = unlock();
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * d);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buf.getChannelData(0);
  for (let i = 0; i < len; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gn = ctx.createGain();
  src.buffer = buf;
  filter.type = 'lowpass';
  filter.frequency.value = f;
  gn.gain.setValueAtTime(gain(g), ctx.currentTime + when);
  gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + d);
  src.connect(filter); filter.connect(gn); gn.connect(ctx.destination);
  src.start(ctx.currentTime + when);
  src.stop(ctx.currentTime + when + d + 0.04);
}

// The six-voice sound bank, keyed by name — ported verbatim from FishAudio.
export const FishAudio = {
  play(name) {
    if (!soundOn()) return;
    ({
      button: () => tone(620, 0.08, 'sine', 0.05),
      sonar: () => { tone(260, 0.45, 'sine', 0.08, 0, 880); tone(520, 0.3, 'sine', 0.035, 0.1, 1040); },
      splash: () => { noise(0.34, 0.11, 900); tone(120, 0.18, 'triangle', 0.05, 0, 70); noise(0.13, 0.04, 2400, 0.12); },
      pb: () => { noise(0.32, 0.12, 1100); tone(520, 0.18, 'sine', 0.08); tone(780, 0.18, 'sine', 0.06, 0.08); tone(1040, 0.28, 'sine', 0.045, 0.17); },
      chapter: () => { tone(190, 0.55, 'sine', 0.06); tone(380, 0.65, 'triangle', 0.035, 0.08); noise(0.6, 0.035, 700, 0.18); },
      error: () => tone(110, 0.18, 'sawtooth', 0.05),
    }[name] || (() => tone()))();
  },
};

// Haptic buzz, gated on the haptics preference — ported verbatim from haptic().
export function haptic(p = 12) {
  if (settings.haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(p); } catch (e) { /* ignore */ }
  }
}
