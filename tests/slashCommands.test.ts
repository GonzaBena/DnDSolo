import { describe, expect, it } from "vitest";
import { expandSlashCommands } from "../src/game/slashCommands";

describe("expandSlashCommands", () => {
  it("expands /descanso and /descanso corto to a short rest", () => {
    const short = "Me tomo un descanso corto (una hora) para recuperar el aliento y vendar heridas.";
    expect(expandSlashCommands("/descanso")).toBe(short);
    expect(expandSlashCommands("/descanso corto")).toBe(short);
  });

  it("expands /descanso largo to a long rest", () => {
    expect(expandSlashCommands("/descanso largo")).toBe("Armo campamento para un descanso largo de ocho horas.");
  });

  it("keeps what follows the command", () => {
    expect(expandSlashCommands("/descanso largo junto al fuego")).toBe(
      "Armo campamento para un descanso largo de ocho horas. junto al fuego",
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
