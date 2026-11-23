// The brand d20 (same drawing as public/favicon.svg) spinning in the middle
// of the screen while something loads. Pure markup + CSS, so Astro can also
// render it statically as a client:only fallback.
const FACES: Array<[points: string, fill: string]> = [
  ["64,6 116,35 64,32", "#f08a68"],
  ["64,6 64,32 12,35", "#f08a68"],
  ["12,35 64,32 30,86", "#e8684b"],
  ["116,35 98,86 64,32", "#d1492e"],
  ["12,35 30,86 12,93", "#b23d26"],
  ["116,35 116,93 98,86", "#9a321f"],
  ["30,86 98,86 64,122", "#9a321f"],
  ["12,93 30,86 64,122", "#7e2a1a"],
  ["98,86 116,93 64,122", "#6e2416"],
  ["64,32 98,86 30,86", "#f2b134"],
];

export default function DiceLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="dice-loader" role="status">
      <svg className="dice-loader__die" viewBox="0 0 128 128" width="72" height="72" aria-hidden="true">
        <g stroke="#2a1f1a" strokeWidth="5" strokeLinejoin="round">
          {FACES.map(([points, fill]) => (
            <polygon key={points} points={points} fill={fill} />
          ))}
        </g>
      </svg>
      <span className="dice-loader__label">{label}</span>
    </div>
  );
}
