import { useEffect, useRef, useState } from 'react';
import { esc } from '../lib/fishDisplay.js';
import {
  filterLivewellCatches, livewellFishColors, livewellSize, livewellPosition,
} from '../lib/livewell.js';

// LivingLivewell — the animated tank, ported from the single-file app's
// livingLivewellHTML() + livingFishHTML(). Water-top header, count bubble,
// rising bubbles, dock actions, empty state, and the just-landed drop-in.
//
// Swimming model (v3): each fish free-roams like a real fish in a livewell.
// It picks a random point in the tank, glides there, holds a beat, then picks
// a new point — never a rigid edge-to-edge lap. Every fish is born with a bit
// of personality it keeps for the whole session:
//   - a personal speed range (min/max seconds-per-leg) so some cruise and some
//     mosey, and each leg varies within that range: cruise, then a quicker
//     dart, then cruise again;
//   - a "mood": most fish roam; some are "bobbers" that mostly hold station and
//     drift gently in place, like a fish parked in the current.
// Facing follows travel direction. The art faces LEFT by default; data-dir
// ="left" applies scaleX(-1) and faces it RIGHT — so data-dir is the opposite
// of the horizontal heading.
//
// Heavy when the tank is full — the Memory Wall toggle is the escape valve.

const MIN_X = 12;   // % — inside the pond, a little margin off the glass
const MAX_X = 88;
const MIN_Y = 16;
const MAX_Y = 84;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// The data-dir a fish should carry to FACE the way it's heading horizontally.
// Art faces left by default; data-dir="left" => scaleX(-1) => faces right.
const facingFor = (fromX, toX, current) => {
  if (Math.abs(toX - fromX) < 3) return current;   // barely moving: keep facing
  return toX > fromX ? 'left' : 'right';           // right-bound flips; left-bound stays
};

// A single free-roaming fish. Owns its wander loop + spawned personality.
function LiveFish({ c, i, total, big, isNew, onOpen }) {
  const [c1, c2] = livewellFishColors(c.species);
  const w = livewellSize(c);
  const mw = Math.max(58, Math.min(w, 120));
  const scale = (c.id === big?.id ? 1.12 : 1).toFixed(2);
  const released = String(c.disposition || '').toLowerCase().includes('released') ? 'released' : '';
  const isPB = c.id === big?.id ? 'pb' : '';
  const label = `${c.length || 0}" ${c.species || 'Fish'}`;

  // Personality — fixed once per spawn (ref so it never re-rolls on render).
  const persona = useRef(null);
  if (!persona.current) {
    const mood = Math.random() < 0.25 ? 'bob' : 'roam';   // ~1 in 4 is a bobber
    const sizeFactor = w > 110 ? 1.35 : w < 75 ? 0.85 : 1; // bigger => slower
    const a = rand(11, 15) * sizeFactor;                   // easy cruise (sec/leg)
    const b = rand(6, 9) * sizeFactor;                     // quicker dart (sec/leg)
    persona.current = { mood, minDur: Math.min(a, b), maxDur: Math.max(a, b) };
  }
  const { mood, minDur, maxDur } = persona.current;

  const seed = livewellPosition(i, total, c);
  const [pos, setPos] = useState({ x: seed[0], y: seed[1] });
  const [dir, setDir] = useState(i % 2 ? 'left' : 'right');
  const [dur, setDur] = useState(1.4 + (i % 5) * 0.25);

  const timer = useRef(null);
  const alive = useRef(true);
  const cur = useRef({ x: seed[0], y: seed[1] }); // last committed position

  // Choose the next spot to swim to and glide there. Bobbers stay near where
  // they are (small drift); roamers pick anywhere in the tank.
  const swim = (first = false) => {
    if (!alive.current) return;
    const from = cur.current;

    let toX, toY;
    if (mood === 'bob') {
      // hold station: drift a little around the current spot
      toX = Math.max(MIN_X, Math.min(MAX_X, from.x + rand(-10, 10)));
      toY = Math.max(MIN_Y, Math.min(MAX_Y, from.y + rand(-8, 8)));
    } else {
      toX = rand(MIN_X, MAX_X);
      toY = rand(MIN_Y, MAX_Y);
    }

    // A leg's pace is random within this fish's personal range. Longer hops
    // take a little longer so speed stays believable rather than teleporty.
    const dist = Math.hypot(toX - from.x, toY - from.y);       // 0..~100
    const base = rand(minDur, maxDur);
    const legDur = first
      ? rand(3, 5)
      : Math.max(minDur * 0.6, base * (0.55 + dist / 150));

    setDir((d) => facingFor(from.x, toX, d));
    setDur(legDur);
    setPos({ x: toX, y: toY });
    cur.current = { x: toX, y: toY };

    // Hold a short, random beat at the destination, then move again.
    const pause = (mood === 'bob' ? rand(600, 1600) : rand(200, 1400));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => swim(false), legDur * 1000 + pause);
  };

  useEffect(() => {
    alive.current = true;
    const start = setTimeout(() => swim(true), 350 + (i % 7) * 130);
    return () => { alive.current = false; clearTimeout(start); clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      className={`live-fish swimming ${mood === 'bob' ? 'bobber' : ''} ${released} ${isNew ? 'new-fish' : ''} ${isPB}`}
      data-dir={dir}
      style={{
        '--x': `${pos.x}%`,
        '--y': `${pos.y}%`,
        '--w': `${w}px`,
        '--mw': `${mw}px`,
        '--fish1': c1,
        '--fish2': c2,
        '--dur': `${dur}s`,
        '--scale': scale,
      }}
      onClick={() => onOpen && onOpen(c.id)}
      aria-label={`Open ${esc(label)} catch card`}
    >
      <span className="fish-tail" />
      <span className="fish-body" />
      <span className="fish-fin" />
      <span className="fish-label">{label}</span>
    </button>
  );
}

export default function LivingLivewell({
  catches, session, biggest, topLure, newFishId, onOpenCatch, onLandFish, onTripStory,
}) {
  const filtered = filterLivewellCatches(catches, 'all', 'time');
  const big = biggest(catches) || {};
  const water = session?.water || "Today's water";
  const bait = topLure || 'pattern pending';
  const splashing = newFishId ? 'splashing' : '';

  // Rising bubbles behind the fish — ported from the tank's bubble array.
  const bubbles = Array.from({ length: 10 }, (_, i) => (
    <span
      key={i}
      className={`tank-bubble ${i % 3 === 0 ? 'b2' : i % 4 === 0 ? 'b3' : ''}`}
      style={{ left: `${8 + ((i * 17) % 86)}%`, animationDelay: `${-(i * 0.9)}s` }}
    />
  ));

  return (
    <div className={`living-livewell-wrap ${splashing}`}>
      <div className="livewell-water-top">
        <div>
          <span className="eyebrow">{session?.active ? "Today's Livewell" : 'Past Livewell'}</span>
          <h3>{session?.title || session?.name || 'Trip Livewell'}</h3>
          <p>{water} • {filtered.length} fish swimming • {bait}</p>
        </div>
        <div className="livewell-count-bubble">
          <div>
            <strong>{filtered.length}</strong>
            <span>Fish</span>
          </div>
        </div>
      </div>

      <div className="livewell-pond">
        {bubbles}
        {filtered.length ? (
          filtered.map((c, i) => (
            <LiveFish
              key={c.id}
              c={c}
              i={i}
              total={filtered.length}
              big={big}
              isNew={c.id === newFishId}
              onOpen={onOpenCatch}
            />
          ))
        ) : (
          <div className="livewell-empty-water">
            <div>
              <strong>The livewell is quiet.</strong>
              <span>Land the first fish and watch it drop in.</span>
            </div>
          </div>
        )}
      </div>

      <div className="livewell-dock-actions">
        <button className="btn primary" onClick={() => onLandFish && onLandFish()}>Land Fish</button>
        <button className="btn" onClick={() => onTripStory && onTripStory(session?.id)}>Trip Story</button>
      </div>
    </div>
  );
}
