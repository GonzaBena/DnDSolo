import type { GameState } from "../domain/types";
import { OFFICIAL_CAMPAIGNS } from "./data";
import type { CampaignAct, CampaignLocation, OfficialCampaign } from "./types";

export { OFFICIAL_CAMPAIGNS } from "./data";
export type { CampaignAct, CampaignLocation, OfficialCampaign } from "./types";

/** Normalizes text for flexible matching (lowercase, stripped accents and collapsed spaces). */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function findCampaign(id: string | null | undefined): OfficialCampaign | undefined {
  if (!id) return undefined;
  return OFFICIAL_CAMPAIGNS.find((c) => c.id === id);
}

/** Determines which act of the campaign is currently active (1, 2 or 3), or
    null once Act 3's quest or central threat thread has been completed/resolved. */
export function activeAct(campaign: OfficialCampaign, state: GameState): CampaignAct | null {
  const isQuestClosed = (title: string) =>
    state.quests.some((q) => normalize(q.title) === normalize(title) && q.status !== "active");
  const isThreadResolved = (title: string | undefined) =>
    Boolean(title && state.threads.some((t) => normalize(t.title) === normalize(title) && t.status === "resolved"));

  const [act1, act2, act3] = campaign.acts;
  if (isQuestClosed(act3.closesWhenCompleted) || isThreadResolved(act3.closesWhenThreadResolved)) {
    return null;
  }
  if (isQuestClosed(act2.closesWhenCompleted)) {
    return act3;
  }
  if (isQuestClosed(act1.closesWhenCompleted)) {
    return act2;
  }
  return act1;
}

/** Finds the canonical campaign location matching `locationName` by exact name,
    substring or keywords; null when the player is in an improvised spot. */
export function matchCampaignLocation(campaign: OfficialCampaign, locationName: string): CampaignLocation | null {
  const target = normalize(locationName);
  if (!target) return null;
  for (const loc of campaign.locations) {
    const canon = normalize(loc.name);
    if (canon === target || target.includes(canon) || canon.includes(target)) return loc;
  }
  for (const loc of campaign.locations) {
    if (loc.keywords.some((kw) => target.includes(normalize(kw)))) return loc;
  }
  return null;
}

/** Turn 1 opening prompt tailored to the official campaign, or null for a free adventure. */
export function describeCampaignStart(state: GameState | undefined): string | null {
  const campaign = findCampaign(state?.campaignId);
  return campaign ? campaign.startPrompt : null;
}

/** Builds the chunked campaign guide block for `buildTurnPrompt`:
    - Always includes the short 2-3 sentence compass.
    - Includes ONLY the active act's guidance (or a 2-line open-world note once completed).
    - Includes the deep DM details ONLY for the current location, plus a 1-line index of the other locations. */
export function buildCampaignPromptBlock(state: GameState): string | null {
  const campaign = findCampaign(state.campaignId);
  if (!campaign) return null;

  const act = activeAct(campaign, state);
  if (!act) {
    return [
      `GUÍA DE LA CAMPAÑA — ${campaign.title}`,
      `La trama principal de la campaña ya fue resuelta. Continuá narrando en mundo abierto respetando los lugares, aliados y consecuencias de ${campaign.title}.`,
    ].join("\n");
  }

  const currentLocation = matchCampaignLocation(campaign, state.location.name);
  const otherLocations = campaign.locations.filter((loc) => loc !== currentLocation);

  const lines: string[] = [
    `GUÍA DE LA CAMPAÑA — ${campaign.title}`,
    `BRÚJULA: ${campaign.dmCompass}`,
    `ACTO ACTUAL (Acto ${act.number}: ${act.title}): ${act.dmGuidance}`,
  ];

  if (currentLocation) {
    lines.push(`LUGAR ACTUAL (${currentLocation.name}): ${currentLocation.dmDetails}`);
  }

  if (otherLocations.length > 0) {
    lines.push(
      'OTROS LUGARES DEL MÓDULO (cuando el personaje viaje a uno, usá su nombre exacto en el cambio "location"):',
      ...otherLocations.map((loc) => `- ${loc.name}: ${loc.indexLine}`),
    );
  }

  return lines.join("\n");
}
