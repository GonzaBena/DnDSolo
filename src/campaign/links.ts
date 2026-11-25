/** The game screen of one saved campaign. */
export const playHref = (id: string) => `/play?id=${encodeURIComponent(id)}`;

/** The "Tu campaña" page of one saved campaign. */
export const campaignHref = (id: string) => `/campaign?id=${encodeURIComponent(id)}`;
