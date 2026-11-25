import type { Die } from "../domain/types";

// Flat silhouettes of each die, drawn the way the brand die is: a solid
// outline plus the edges you would see from the front. All share a 32x32 box.
const SHAPES: Record<Exclude<Die, "d100">, { outline: string; edges: string }> = {
  // Tetrahedron seen from above a corner.
  d4: {
    outline: "16,3 30,28 2,28",
    edges: "M16 19.7L16 3M16 19.7L30 28M16 19.7L2 28",
  },
  // Cube seen from a corner.
  d6: {
    outline: "16,2 29,9.5 29,22.5 16,30 3,22.5 3,9.5",
    edges: "M3 9.5L16 14L29 9.5M16 14L16 30",
  },
  // Octahedron: two pyramids meeting at the belt.
  d8: {
    outline: "16,2 30,16 16,30 2,16",
    edges: "M2 16L16 20L30 16M16 2L16 30",
  },
  // Ten-sided: one kite face in front.
  d10: {
    outline: "16,2 30,14 30,19 16,30 2,19 2,14",
    edges: "M16 2L9 17L16 22L23 17ZM9 17L2 19M23 17L30 19M16 22L16 30",
  },
  // Dodecahedron: a pentagon face with its five neighbours.
  d12: {
    outline: "16,2 24.2,4.7 29.3,11.7 29.3,20.3 24.2,27.3 16,30 7.8,27.3 2.7,20.3 2.7,11.7 7.8,4.7",
    edges:
      "M16 8.5L23.1 13.7L20.4 22.1L11.6 22.1L8.9 13.7Z" +
      "M16 8.5L16 2M23.1 13.7L29.3 11.7M20.4 22.1L24.2 27.3M11.6 22.1L7.8 27.3M8.9 13.7L2.7 11.7",
  },
  // Icosahedron: a triangle face in front.
  d20: {
    outline: "16,2 29,9.5 29,22.5 16,30 3,22.5 3,9.5",
    edges:
      "M16 8.5L23.8 21.5L8.2 21.5Z" +
      "M16 2L16 8.5M3 9.5L16 8.5L29 9.5M3 9.5L8.2 21.5L3 22.5" +
      "M29 9.5L23.8 21.5L29 22.5M8.2 21.5L16 30L23.8 21.5",
  },
};

function Shape({ die, className }: { die: Exclude<Die, "d100">; className: string }) {
  const { outline, edges } = SHAPES[die];
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <polygon points={outline} />
      <path d={edges} />
    </svg>
  );
}

/** The figure for a die. A d100 is rolled with two d10s (tens and units),
    so it is the only one drawn as a pair. */
export function DieShape({ die, className }: { die: Die; className: string }) {
  if (die === "d100") {
    return (
      <>
        <Shape die="d10" className={className} />
        <Shape die="d10" className={className} />
      </>
    );
  }
  return <Shape die={die} className={className} />;
}

// The d20 as a cut gem: the faces of SHAPES.d20 painted in three tones (lit
// top, mid sides, shaded bottom) with the front face left as paper so a
// number reads on it.
const GEM_FACES: { points: string; tone: "top" | "side" | "low" | "front" }[] = [
  { points: "3,9.5 16,2 16,8.5", tone: "top" },
  { points: "16,2 29,9.5 16,8.5", tone: "top" },
  { points: "3,9.5 16,8.5 8.2,21.5", tone: "side" },
  { points: "29,9.5 16,8.5 23.8,21.5", tone: "side" },
  { points: "3,9.5 8.2,21.5 3,22.5", tone: "low" },
  { points: "29,9.5 23.8,21.5 29,22.5", tone: "low" },
  { points: "3,22.5 8.2,21.5 16,30", tone: "low" },
  { points: "29,22.5 23.8,21.5 16,30", tone: "low" },
  { points: "8.2,21.5 23.8,21.5 16,30", tone: "side" },
  { points: "16,8.5 23.8,21.5 8.2,21.5", tone: "front" },
];

/** A four-point star, for the sparks around the gem. */
export const SPARK = "M5 0L6.2 3.8L10 5L6.2 6.2L5 10L3.8 6.2L0 5L3.8 3.8Z";

/** The painted d20, with `value` written on its front face. A new value
    remounts the number so its CSS entrance plays again. */
export function GemD20({ className, value }: { className: string; value: string }) {
  const { outline, edges } = SHAPES.d20;
  return (
    <svg className={`gem ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      {GEM_FACES.map((face) => (
        <polygon key={face.points} className={`gem__face gem__face--${face.tone}`} points={face.points} />
      ))}
      <g className="gem__edges">
        <polygon points={outline} />
        <path d={edges} />
      </g>
      <g className="gem__number" key={value}>
        <text x="16" y="19.4">
          {value}
        </text>
      </g>
    </svg>
  );
}
