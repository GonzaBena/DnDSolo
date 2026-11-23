import { describe, expect, it } from "vitest";
import {
  OFFICIAL_CAMPAIGNS,
  activeAct,
  buildCampaignPromptBlock,
  describeCampaignStart,
  findCampaign,
  matchCampaignLocation,
} from "../src/campaigns";
import { createGame } from "../src/domain/character";
import { PORTRAIT_IDS } from "../src/domain/portraits";
import { buildConceptPrompt } from "../src/rules/generatorPrompt";

describe("OFFICIAL_CAMPAIGNS catalog", () => {
  it("provides 3 official campaigns with tiered starting levels 1, 2 and 3", () => {
    expect(OFFICIAL_CAMPAIGNS.map((c) => c.id)).toEqual([
      "brasas-pico-quebrado",
      "campana-faro-hundido",
      "mascaras-casa-ceniza",
    ]);
    expect(OFFICIAL_CAMPAIGNS.map((c) => c.startingLevel)).toEqual([1, 2, 3]);
  });

  it("uses valid portrait archetypes and consistent initial state in every campaign", () => {
    const validPortraits = new Set<string>(PORTRAIT_IDS);
    for (const campaign of OFFICIAL_CAMPAIGNS) {
      expect(campaign.initialState.location.name.length).toBeGreaterThan(0);
      expect(campaign.initialState.quests.length).toBeGreaterThan(0);
      expect(campaign.initialState.threads.some((t) => !t.secret && t.kind === "goal")).toBe(true);
      expect(campaign.initialState.threads.some((t) => t.secret && t.kind === "threat")).toBe(true);
      expect(campaign.acts).toHaveLength(3);
      expect(campaign.locations.length).toBeGreaterThanOrEqual(4);
      // The initial location matches the first canonical location of the module.
      expect(matchCampaignLocation(campaign, campaign.initialState.location.name)?.name).toBe(
        campaign.initialState.location.name,
      );
      for (const npc of campaign.initialState.npcs) {
        expect(npc.present).toBe(true);
        if (npc.portrait !== null) expect(validPortraits.has(npc.portrait)).toBe(true);
        expect(npc.hp).toBe(npc.maxHp);
      }
    }
  });
});

describe("createGame with an official campaign", () => {
  it("seeds initial location, NPCs, quests, threads, storyItems and locks the starting level", () => {
    const game = createGame({
      name: "Kael",
      speciesId: "human",
      classId: "fighter",
      subclassId: null,
      srdBackgroundId: "soldier",
      level: 1, // should be overridden to 2 by campana-faro-hundido
      background: "Ex marinero",
      startingInventory: [{ name: "Espada larga", quantity: 1 }],
      campaignId: "campana-faro-hundido",
    });

    expect(game.campaignId).toBe("campana-faro-hundido");
    expect(game.players[0]!.level).toBe(2);
    expect(game.location.name).toBe("Muelle de las Áncoras");
    expect(game.npcs.map((n) => n.name)).toEqual(["Capitana Sera Valen"]);
    expect(game.quests[0]!.title).toBe("Los que vuelven con la marea");
    expect(game.threads).toHaveLength(3);
    expect(game.storyItems.map((i) => ({ name: i.name, status: i.status }))).toEqual([
      { name: "Espada larga", status: "taken" },
      { name: "Bitácora empapada del Bergantín", status: "available" },
    ]);
  });

  it("throws when given an unknown campaign id", () => {
    expect(() =>
      createGame({
        name: "Kael",
        speciesId: "human",
        classId: "fighter",
        subclassId: null,
        srdBackgroundId: null,
        level: 1,
        background: "",
        campaignId: "no-existe",
      }),
    ).toThrow(/Unknown campaign/);
  });
});

describe("chunked campaign prompt (Act + Location slicing)", () => {
  it("sends only Act 1 and the current location's deep details on start, plus a 1-line index of other places", () => {
    const game = createGame({
      name: "Thora",
      speciesId: "dwarf",
      classId: "cleric",
      subclassId: null,
      srdBackgroundId: null,
      level: 1,
      background: "",
      campaignId: "brasas-pico-quebrado",
    });
    const campaign = findCampaign("brasas-pico-quebrado")!;
    const block = buildCampaignPromptBlock(game)!;

    expect(block).toContain("GUÍA DE LA CAMPAÑA — Las Brasas de Pico Quebrado");
    expect(block).toContain("ACTO ACTUAL (Acto 1: Emboscada en la nieve)");
    expect(block).not.toContain("Acto 2:");
    expect(block).not.toContain("Acto 3:");

    // Current location (Posada El Yunque Partido) has full dmDetails
    expect(block).toContain(`LUGAR ACTUAL (Posada El Yunque Partido): ${campaign.locations[0]!.dmDetails}`);
    // Other locations only appear as 1-line index entries, without their secret dmDetails
    expect(block).toContain(`- La Forja Hundida: ${campaign.locations[3]!.indexLine}`);
    expect(block).not.toContain(campaign.locations[3]!.dmDetails);
  });

  it("advances to Act 2 and swaps location details when the player completes Act 1 and moves", () => {
    const base = createGame({
      name: "Thora",
      speciesId: "dwarf",
      classId: "cleric",
      subclassId: null,
      srdBackgroundId: null,
      level: 1,
      background: "",
      campaignId: "brasas-pico-quebrado",
    });
    const campaign = findCampaign("brasas-pico-quebrado")!;
    const inAct2 = {
      ...base,
      location: { name: "Mina Vieja", description: "Túneles oscuros" },
      quests: [
        { title: "El silencio de la Mina Vieja", description: "", status: "completed" as const },
        { title: "La llave de la Forja Hundida", description: "Abrir la exclusa", status: "active" as const },
      ],
    };

    expect(activeAct(campaign, inAct2)?.number).toBe(2);
    const block = buildCampaignPromptBlock(inAct2)!;
    expect(block).toContain("ACTO ACTUAL (Acto 2: Los túneles de escoria)");
    expect(block).not.toContain("Acto 1:");
    expect(block).toContain("LUGAR ACTUAL (Mina Vieja de Pico Quebrado):");
    expect(block).toContain("Skarn el Chamán");
    expect(block).not.toContain(campaign.locations[0]!.dmDetails);
  });

  it("shrinks to a 2-line open-world note once Act 3 or the main threat is resolved", () => {
    const base = createGame({
      name: "Thora",
      speciesId: "dwarf",
      classId: "cleric",
      subclassId: null,
      srdBackgroundId: null,
      level: 1,
      background: "",
      campaignId: "brasas-pico-quebrado",
    });
    const completed = {
      ...base,
      threads: base.threads.map((t) =>
        t.title === "El culto escamoso de Ignis-Vhar" ? { ...t, status: "resolved" as const, secret: false } : t,
      ),
    };

    const block = buildCampaignPromptBlock(completed)!;
    expect(block).toContain("La trama principal de la campaña ya fue resuelta.");
    expect(block).not.toContain("ACTO ACTUAL");
    expect(block).not.toContain("OTROS LUGARES");
  });

  it("provides the campaign start prompt on Turn 1 and injects the hook into the character generator prompt", () => {
    const game = createGame({
      name: "Vael",
      speciesId: "elf",
      classId: "rogue",
      subclassId: "thief",
      srdBackgroundId: null,
      level: 3,
      background: "",
      campaignId: "mascaras-casa-ceniza",
    });
    expect(describeCampaignStart(game)).toContain("INICIO DE LA CAMPAÑA (Máscaras de la Casa Ceniza)");

    const campaign = findCampaign("mascaras-casa-ceniza")!;
    const conceptPrompt = buildConceptPrompt("Un espía que busca redención", 3, [], campaign);
    expect(conceptPrompt).toContain("CAMPAÑA ELEGIDA: Máscaras de la Casa Ceniza");
    expect(conceptPrompt).toContain(campaign.generatorPromptHook);
  });
});
