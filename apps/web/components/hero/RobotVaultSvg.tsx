import { LOOP_SECONDS, T } from "./timeline";

/**
 * Lightweight hero animation (phones, tablets, reduced-motion, and the
 * placeholder shown on desktop while the 3D scene loads).
 * A little yellow robot walks in with a stack of files, drops them into a
 * vault, spins the dial, hops for joy and walks off. Pure SVG + CSS.
 */

const pct = (f: number) => `${+(f * 100).toFixed(2)}%`;

// Robot x position in the 1200-wide viewBox
const START_X = -120;
const VAULT_X = 770;

/** Alternating leg swing while walking. */
function legFrames(sign: 1 | -1) {
  const frames: string[] = [];
  const walk = (from: number, to: number) => {
    const steps = Math.round((to - from) / 0.028);
    for (let i = 0; i <= steps; i++) {
      const f = from + ((to - from) * i) / steps;
      const angle = i === 0 || i === steps ? 0 : (i % 2 ? 18 : -18) * sign;
      frames.push(`${pct(f)}{transform:rotate(${angle}deg)}`);
    }
  };
  walk(0, T.walkInEnd);
  walk(T.walkOut[0], 1);
  return frames.join("");
}

const css = `
/* Never narrower than the scene's 3:1 shape; on phones the left (walk-in) part
   is cropped so the robot and vault stay big. Needs a size container parent. */
.vr-svg { position: absolute; right: 0; bottom: 0; height: 100%; width: max(100%, 300cqh); display: block; }
.vr-svg * { animation-duration: ${LOOP_SECONDS}s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }

.vr-robot { animation-name: vr-robot; }
@keyframes vr-robot {
  0% { transform: translateX(${START_X}px); opacity: 0; }
  3% { opacity: 1; }
  ${pct(T.walkInEnd)} { transform: translateX(${VAULT_X}px); }
  ${pct(T.walkOut[0])} { transform: translateX(${VAULT_X}px); }
  96% { opacity: 1; }
  100% { transform: translateX(${START_X}px); opacity: 0; }
}
.vr-robot, .vr-files { animation-timing-function: linear; }

.vr-flip { animation-name: vr-flip; animation-timing-function: step-end; }
@keyframes vr-flip {
  0% { transform: scaleX(1); }
  ${pct(T.walkOut[0])} { transform: scaleX(-1); }
  100% { transform: scaleX(-1); }
}

.vr-hop { animation-name: vr-hop; }
@keyframes vr-hop {
  0%, ${pct(T.celebrate[0])}, 79%, ${pct(T.celebrate[1])}, 100% { transform: translateY(0); }
  76.5%, 81.5% { transform: translateY(-28px); }
}

.vr-leg-l { transform-origin: -12px -30px; animation-name: vr-leg-l; animation-timing-function: linear; }
.vr-leg-r { transform-origin: 12px -30px; animation-name: vr-leg-r; animation-timing-function: linear; }
@keyframes vr-leg-l { ${legFrames(1)} }
@keyframes vr-leg-r { ${legFrames(-1)} }

.vr-arm-l { transform-origin: -38px -95px; animation-name: vr-arm-l; }
.vr-arm-r { transform-origin: 38px -95px; animation-name: vr-arm-r; }
@keyframes vr-arm-l {
  0%, ${pct(T.throwFiles[0])} { transform: rotate(0deg); }
  51% { transform: rotate(55deg); }
  ${pct(T.doorClose[0] + 0.02)}, ${pct(T.celebrate[0] - 0.01)} { transform: rotate(-165deg); }
  ${pct(T.celebrate[0] + 0.01)}, 79% { transform: rotate(-15deg); }
  76.5%, 81.5% { transform: rotate(5deg); }
  ${pct(T.celebrate[1])}, 97% { transform: rotate(-165deg); }
  100% { transform: rotate(0deg); }
}
@keyframes vr-arm-r {
  0%, ${pct(T.throwFiles[0])} { transform: rotate(0deg); }
  51% { transform: rotate(55deg); }
  ${pct(T.doorClose[0] + 0.02)}, ${pct(T.celebrate[0] - 0.01)} { transform: rotate(165deg); }
  ${pct(T.celebrate[0] + 0.01)}, 79% { transform: rotate(15deg); }
  76.5%, 81.5% { transform: rotate(-5deg); }
  ${pct(T.celebrate[1])}, 97% { transform: rotate(165deg); }
  100% { transform: rotate(0deg); }
}

/* Files ride with the robot, then arc into the vault */
.vr-files { transform-origin: 0px -200px; animation-name: vr-files; }
@keyframes vr-files {
  0% { transform: translate(${START_X}px, 0) scale(1); opacity: 0; }
  3% { opacity: 1; }
  ${pct(T.walkInEnd)}, ${pct(T.throwFiles[0])} { transform: translate(${VAULT_X}px, 0) scale(1); opacity: 1; }
  51% { transform: translate(905px, -50px) scale(0.75); opacity: 1; }
  ${pct(T.throwFiles[1])} { transform: translate(980px, 70px) scale(0.3); opacity: 0; }
  99.9% { transform: translate(${START_X}px, 0) scale(1); opacity: 0; }
}

.vr-door { transform-origin: 900px 255px; animation-name: vr-door; }
@keyframes vr-door {
  0%, ${pct(T.doorOpen[0])} { transform: scaleX(1); }
  ${pct(T.doorOpen[1])}, ${pct(T.doorClose[0])} { transform: scaleX(0.08); }
  ${pct(T.doorClose[1])}, 100% { transform: scaleX(1); }
}

.vr-dial { transform-origin: 980px 255px; animation-name: vr-dial; }
@keyframes vr-dial {
  0%, ${pct(T.dialSpin[0])} { transform: rotate(0deg); }
  ${pct(T.dialSpin[1])}, 100% { transform: rotate(360deg); }
}

.vr-light { animation-name: vr-light; }
@keyframes vr-light {
  0%, ${pct(T.dialSpin[1] - 0.01)} { fill: #f59e0b; }
  ${pct(T.dialSpin[1])}, 92% { fill: #22c55e; }
  100% { fill: #f59e0b; }
}

.vr-antenna { animation-name: vr-antenna; }
@keyframes vr-antenna {
  0%, ${pct(T.celebrate[0])}, ${pct(T.celebrate[1])}, 100% { opacity: 1; }
  76%, 80%, 83% { opacity: 0.25; }
  78%, 82% { opacity: 1; }
}

/* Reduced motion: a still scene, robot standing at the vault holding the files */
@media (prefers-reduced-motion: reduce) {
  .vr-svg * { animation: none !important; }
  .vr-robot { transform: translateX(${VAULT_X}px); }
  .vr-files { transform: translate(${VAULT_X}px, 0); }
}
`;

export default function RobotVaultSvg() {
  return (
    <svg
      className="vr-svg"
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      focusable="false"
    >
      <style>{css}</style>

      <defs>
        <clipPath id="vr-body-clip">
          <rect x="-40" y="-150" width="80" height="125" rx="40" />
        </clipPath>
      </defs>

      {/* Vault */}
      <g>
        <ellipse cx="980" cy="362" rx="115" ry="8" fill="#000" opacity="0.18" />
        <rect x="895" y="352" width="22" height="10" rx="2" fill="#2a303c" />
        <rect x="1043" y="352" width="22" height="10" rx="2" fill="#2a303c" />
        <rect x="880" y="150" width="200" height="206" rx="16" fill="#3b4252" stroke="#262b35" strokeWidth="3" />
        <rect x="900" y="172" width="160" height="166" rx="10" fill="#10141b" />
        <rect x="914" y="300" width="132" height="24" rx="4" fill="#1b2130" />
        <circle className="vr-light" cx="1062" cy="166" r="6" fill="#f59e0b" />

        <g className="vr-door">
          <rect x="900" y="172" width="160" height="166" rx="10" fill="#4c566a" stroke="var(--primary)" strokeWidth="3" />
          <rect x="908" y="180" width="144" height="150" rx="7" fill="none" stroke="#5e687d" strokeWidth="2" />
          <rect x="1036" y="236" width="10" height="38" rx="4" fill="#d8dee9" />
          <g className="vr-dial">
            <circle cx="980" cy="255" r="34" fill="#2e3440" stroke="#d8dee9" strokeWidth="4" />
            <path d="M980 225 V285 M950 255 H1010 M959 234 L1001 276 M1001 234 L959 276" stroke="#d8dee9" strokeWidth="5" strokeLinecap="round" />
            <circle cx="980" cy="255" r="9" fill="var(--primary)" />
          </g>
        </g>
      </g>

      {/* Files (moves on its own so it can fly into the vault) */}
      <g transform="translate(0 360)">
        <g className="vr-files">
          <rect x="-26" y="-240" width="58" height="74" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" transform="rotate(8 0 -200)" />
          <rect x="-30" y="-238" width="58" height="74" rx="4" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" transform="rotate(-6 0 -200)" />
          <rect x="-29" y="-236" width="58" height="74" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M-20 -222 H18 M-20 -212 H18 M-20 -202 H10 M-20 -192 H16" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <path d="M-34 -190 h22 l6 -7 h40 v40 h-68 z" fill="var(--primary)" stroke="#00000033" strokeWidth="1.5" />
        </g>
      </g>

      {/* Robot */}
      <g transform="translate(0 360)">
        <g className="vr-robot">
          <ellipse cx="0" cy="2" rx="44" ry="6" fill="#000" opacity="0.18" />
          <g className="vr-flip">
            <g className="vr-hop">
              {/* Legs */}
              <g className="vr-leg-l">
                <rect x="-19" y="-32" width="14" height="28" rx="4" fill="#1e3a8a" />
                <ellipse cx="-14" cy="-3" rx="13" ry="6" fill="#111827" />
              </g>
              <g className="vr-leg-r">
                <rect x="5" y="-32" width="14" height="28" rx="4" fill="#1e3a8a" />
                <ellipse cx="14" cy="-3" rx="13" ry="6" fill="#111827" />
              </g>

              {/* Antenna */}
              <line x1="0" y1="-150" x2="0" y2="-168" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <circle className="vr-antenna" cx="0" cy="-172" r="6" fill="var(--primary)" />

              {/* Body + overalls */}
              <rect x="-40" y="-150" width="80" height="125" rx="40" fill="#fcd34d" />
              <g clipPath="url(#vr-body-clip)">
                <rect x="-40" y="-68" width="80" height="50" fill="#2563eb" />
                <rect x="-22" y="-82" width="44" height="20" rx="3" fill="#2563eb" />
                <rect x="-9" y="-62" width="18" height="12" rx="2" fill="#1d4ed8" />
              </g>
              <circle cx="-17" cy="-76" r="3" fill="#111827" />
              <circle cx="17" cy="-76" r="3" fill="#111827" />

              {/* Goggle */}
              <rect x="-42" y="-122" width="84" height="12" rx="2" fill="#1f2937" />
              <circle cx="0" cy="-116" r="21" fill="#cbd5e1" stroke="#64748b" strokeWidth="4" />
              <circle cx="0" cy="-116" r="14" fill="#ffffff" />
              <circle cx="3" cy="-115" r="7" fill="#7c4a1e" />
              <circle cx="3" cy="-115" r="3.5" fill="#111827" />
              <circle cx="7" cy="-119" r="2" fill="#ffffff" />

              {/* Smile */}
              <path d="M-12 -92 Q0 -82 12 -92" stroke="#111827" strokeWidth="3" fill="none" strokeLinecap="round" />

              {/* Arms */}
              <g className="vr-arm-l">
                <line x1="-38" y1="-95" x2="-31" y2="-166" stroke="#fcd34d" strokeWidth="11" strokeLinecap="round" />
                <circle cx="-31" cy="-168" r="8" fill="#111827" />
              </g>
              <g className="vr-arm-r">
                <line x1="38" y1="-95" x2="31" y2="-166" stroke="#fcd34d" strokeWidth="11" strokeLinecap="round" />
                <circle cx="31" cy="-168" r="8" fill="#111827" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
