import { FishAudio, unlock } from '../lib/audio.js';

// FishAudio Lab — the hidden easter egg from the single-file app (#audioLab).
// Five taps on the FishSlayR logo (or the Rig Box "Audio Lab" button) unlock it.
// It's a soundboard for the six synthesized voices, so you can hear the whole
// FishAudio bank on demand. Markup + copy ported verbatim from the original.
export default function AudioLab({ onClose }) {
  const play = (name) => { unlock(); FishAudio.play(name); };

  return (
    <div className="audio-lab active" onClick={onClose}>
      <div className="lab-card" onClick={(e) => e.stopPropagation()}>
        <div className="lab-head">
          <div>
            <span className="eyebrow">Hidden Easter Egg</span>
            <h2>FishAudio Lab</h2>
            <p className="muted">The river has controls.</p>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="lab-body">
          <div className="sound-bank">
            <button className="btn" onClick={() => play('button')}>Button</button>
            <button className="btn" onClick={() => play('splash')}>Splash</button>
            <button className="btn" onClick={() => play('pb')}>PB</button>
            <button className="btn" onClick={() => play('chapter')}>Season</button>
            <button className="btn" onClick={() => play('sonar')}>Sonar</button>
            <button className="btn" onClick={() => play('error')}>Error</button>
          </div>
          <p className="muted">
            Five logo taps unlock this lab. Sound is synthesized in the browser
            with Web Audio.
          </p>
        </div>
      </div>
    </div>
  );
}
