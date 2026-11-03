"use client";

/**
 * Small celebration drawn behind the daily-saving card.
 * "happy" bursts cyan coins when money was saved, "sad" drifts a cloud with
 * slow drops when the whole budget was used or overspent. Purely decorative:
 * the card's text carries the same information for screen readers.
 */

const COINS = [
  { tx: -46, ty: -54, rot: -40, delay: 0 },
  { tx: 44, ty: -62, rot: 34, delay: 0.06 },
  { tx: -70, ty: -18, rot: -70, delay: 0.12 },
  { tx: 68, ty: -22, rot: 62, delay: 0.1 },
  { tx: -30, ty: -84, rot: -20, delay: 0.18 },
  { tx: 26, ty: -90, rot: 22, delay: 0.22 },
  { tx: -58, ty: -76, rot: -54, delay: 0.26 },
  { tx: 58, ty: -78, rot: 48, delay: 0.3 },
];

const DROPS = [
  { left: 22, delay: 0.1 },
  { left: 38, delay: 0.45 },
  { left: 54, delay: 0.25 },
  { left: 70, delay: 0.6 },
];

function Coin() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#00A6D6" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#D9E8F5" strokeWidth="1.6" />
      <circle cx="9.4" cy="10.8" r="1" fill="#FFFFFF" />
      <circle cx="14.6" cy="10.8" r="1" fill="#FFFFFF" />
      <path d="M9 14.3c1.6 1.7 4.4 1.7 6 0" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Cloud() {
  return (
    <svg viewBox="0 0 96 56" width="96" height="56" focusable="false">
      <g fill="#AFC8DF">
        <ellipse cx="28" cy="34" rx="20" ry="15" />
        <ellipse cx="50" cy="27" rx="24" ry="19" />
        <ellipse cx="72" cy="35" rx="18" ry="14" />
        <rect x="10" y="33" width="76" height="16" rx="8" />
      </g>
      <circle cx="43" cy="30" r="2" fill="#24364B" />
      <circle cx="59" cy="30" r="2" fill="#24364B" />
      <path d="M44 42c3-4 9-4 12 0" fill="none" stroke="#24364B" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 22c2-2 4-2 6 0M54 22c2-2 4-2 6 0" fill="none" stroke="#24364B" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function SavingsAnimation({ mood, playKey = 0 }) {
  if (mood !== "happy" && mood !== "sad") return null;
  return (
    <div key={`${mood}-${playKey}`} className="savings-layer" aria-hidden="true">
      {mood === "happy" ? (
        <>
          <span className="savings-ring" />
          <span className="savings-ring savings-ring-late" />
          <span className="savings-burst">
            {COINS.map((coin, index) => (
              <span
                key={index}
                className="savings-coin"
                style={{
                  "--tx": `${coin.tx}px`,
                  "--ty": `${coin.ty}px`,
                  "--rot": `${coin.rot}deg`,
                  animationDelay: `${coin.delay}s`,
                }}
              >
                <Coin />
              </span>
            ))}
          </span>
        </>
      ) : (
        <span className="savings-cloud">
          <Cloud />
          {DROPS.map((drop, index) => (
            <span
              key={index}
              className="savings-drop"
              style={{ left: `${drop.left}px`, animationDelay: `${drop.delay}s` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
