import { brasasPicoQuebrado } from "./catalog/brasas-pico-quebrado";
import { campanaFaroHundido } from "./catalog/campana-faro-hundido";
import { mascarasCasaCeniza } from "./catalog/mascaras-casa-ceniza";
import type { OfficialCampaign } from "./types";

/** Registry of official campaigns, in the order shown on the selector. To add one,
    create its file in `./catalog/` and append it here. */
export const OFFICIAL_CAMPAIGNS: readonly OfficialCampaign[] = [
  brasasPicoQuebrado,
  campanaFaroHundido,
  mascarasCasaCeniza,
];
