export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A modifier with its sign, and a real minus sign: +3, −1. */
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** A speed as the rules give it, in feet: "30 pies". */
export const speedInFeet = (feet: number): string => `${feet} pies`;
