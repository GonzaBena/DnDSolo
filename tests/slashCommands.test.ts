import { describe, expect, it } from "vitest";
import { expandSlashCommands } from "../src/game/slashCommands";

describe("expandSlashCommands", () => {
  it("expands /descanso to narrative rest action", () => {
    expect(expandSlashCommands("/descanso")).toBe(
      "Me tomo un descanso para recuperar energías y curar heridas.",
    );
  });

  it("expands /resumen to situation assessment", () => {
    expect(expandSlashCommands("/resumen")).toBe(
      "Hago una pausa para evaluar mi situación, observar el entorno y recordar mis objetivos.",
    );
  });

  it("expands /mirar and /inspeccionar to perception action", () => {
    expect(expandSlashCommands("/mirar")).toBe(
      "Miro con detenimiento a mi alrededor para buscar detalles, pistas o peligros ocultos.",
    );
    expect(expandSlashCommands("/inspeccionar")).toBe(
      "Miro con detenimiento a mi alrededor para buscar detalles, pistas o peligros ocultos.",
    );
  });

  it("leaves regular text untouched", () => {
    expect(expandSlashCommands("Ataco al goblin con mi espada corta.")).toBe(
      "Ataco al goblin con mi espada corta.",
    );
  });
});
