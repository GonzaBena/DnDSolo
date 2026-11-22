export type HpTone = "healthy" | "hurt" | "critical";

/** Colour band of the HP bar: above half is healthy, above a quarter hurt,
    anything lower (or no max to compare with) critical. */
export function hpTone(current: number, max: number): HpTone {
  if (max <= 0) return "critical";
  const ratio = current / max;
  if (ratio > 0.5) return "healthy";
  if (ratio > 0.25) return "hurt";
  return "critical";
}
