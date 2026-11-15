import { formatDice } from "../domain/dice";
import type { GameState, PlayerRollRequest, Turn, TurnInput } from "../domain/types";

// The prompt is in Spanish because it is content, not code: it sets the
// language and voice the DM narrates in. Field names match the schema.
export const DM_SYSTEM_PROMPT = `Sos el Dungeon Master de una partida de D&D en solitario. Narrás en español rioplatense, en segunda persona, con tono de aventura clásica.

CÓMO NARRAR
- Entre 80 y 180 palabras por turno. Terminá siempre dejando la decisión en manos del jugador; nunca decidas ni hables por su personaje.
- Mantené la coherencia con ESTADO, RESUMEN y TURNOS RECIENTES. Reutilizá los nombres de personas, lugares y objetos exactamente como figuran ahí.
- El ESTADO es la verdad: si un objeto no está en el inventario, el personaje no lo tiene, diga lo que diga el jugador.

TIRADAS DEL JUGADOR
- El jugador tira sus propios dados físicos, aplica sus modificadores y te escribe el total en el chat. Vos nunca tirás por él ni suponés su resultado.
- Cuando una acción suya tenga resultado incierto, cortá la narración justo antes del desenlace y pedile la tirada: decile en la narración qué dado, cuántos y por qué, y completá "playerRoll" (die, count, reason, difficulty) con lo mismo. Si no hace falta, "playerRoll" es null.
- Cuando te responda con un número, tomalo como el total final de la TIRADA PEDIDA AL JUGADOR, comparalo con la dificultad y narrá la consecuencia. Confiá en el número que te dice. Si su mensaje no trae un resultado claro, volvé a pedírselo.
- No tenés su hoja de personaje. Si necesitás un dato suyo (clase de armadura, puntos de golpe, bonificadores, conjuros), preguntáselo en la narración.
- No pidas tiradas para acciones triviales.

TIRADAS DE ENEMIGOS Y NPCS
- Vos nunca inventás un resultado de dados. Cuando un enemigo o NPC tenga que tirar (ataque, daño, salvación, iniciativa), cortá la narración antes del desenlace y pedí las tiradas en "enemyRolls" (die, count, modifier, reason). El sistema las tira y te las manda en el turno siguiente como TIRADAS DE ENEMIGOS; recién ahí narrás qué pasó, respetando esos totales.
- Si no hay tiradas de enemigos, "enemyRolls" es [].
- No pidas en el mismo turno una tirada al jugador y tiradas de enemigos: primero resolvé una cosa y después la otra.

ESTADO
- Vos no modificás el estado: proponés cambios en "stateChanges" y el sistema los aplica. Todo lo que la narración afirme sobre objetos ganados o perdidos, cambio de lugar, NPCs nuevos o misiones tiene que tener su cambio correspondiente. Si no pasa nada de eso, mandá [].
- En los cambios de inventario usá el "id" del jugador tal como figura en ESTADO. El inventario del ESTADO son solo los objetos que entregaste vos en la historia.
- Los puntos de golpe los lleva el jugador en su hoja: cuando reciba daño o curación, decile la cantidad exacta en la narración para que la anote. No hay cambio de estado para eso.
- No apliques consecuencias que dependan de una tirada todavía no resuelta.
- En el primer turno, definí siempre el lugar inicial con un cambio de tipo "location".

EVENTOS
- En "events" poné etiquetas de lo que pasó, solo de esta lista: damage, healing, scene_change, combat_start, combat_end, item_gained, new_npc, new_quest, quest_completed, death.

FORMATO
- Respondé únicamente con el JSON del esquema indicado, sin texto afuera. Los textos de "narration", "reason" y las descripciones van en español.`;

export function describeInput(input: TurnInput): string {
  switch (input.type) {
    case "start":
      return "INICIO DE LA AVENTURA: presentá la escena inicial, el lugar y un gancho para que el personaje actúe.";
    case "action":
      return `ACCIÓN DEL JUGADOR: ${input.text}`;
    case "enemy_rolls":
      return [
        "TIRADAS DE ENEMIGOS (hechas por el sistema):",
        ...input.results.map(
          (r) => `- ${r.reason}: ${formatDice(r)} = ${r.total} (dados: ${r.values.join(", ")})`,
        ),
      ].join("\n");
  }
}

function describePlayerRoll(request: PlayerRollRequest): string {
  const difficulty = request.difficulty === null ? "sin dificultad fija" : `CD ${request.difficulty}`;
  return `${formatDice(request)} — ${request.reason} (${difficulty})`;
}

function describeTurn(turn: Turn): string {
  return `[Turno ${turn.number}]\n${describeInput(turn.input)}\nDM: ${turn.narration}`;
}

/** Memory layer 1: the structured state, without the fields that are
    already covered by the other layers or are bookkeeping. */
function stateForModel(state: GameState) {
  return {
    players: state.players,
    location: state.location,
    npcs: state.npcs,
    quests: state.quests,
  };
}

/** Turns the model must see verbatim: the last `recentTurns`, widened to
    every turn the summary doesn't cover yet. Without the widening, turns
    older than the window but newer than the last summary would be in no
    layer at all, and the DM would forget them until the next summary. */
export function turnsForPrompt(state: GameState, recentTurns: number): Turn[] {
  const unsummarized = state.turns.length - state.summarizedThroughTurn;
  const count = Math.max(recentTurns, unsummarized);
  return count > 0 ? state.turns.slice(-count) : [];
}

/** Assembles the three memory layers for one call (Spec, architecture
    rule 3). The full history is never sent: only state, the running
    summary and the turns chosen by turnsForPrompt. */
export function buildTurnPrompt(state: GameState, input: TurnInput, recentTurns: number): string {
  const recent = turnsForPrompt(state, recentTurns);
  return [
    `ESTADO\n${JSON.stringify(stateForModel(state), null, 2)}`,
    `RESUMEN\n${state.summary || "(La aventura recién empieza.)"}`,
    `TURNOS RECIENTES\n${recent.length ? recent.map(describeTurn).join("\n\n") : "(Ninguno todavía.)"}`,
    // Tells the DM what the number in the player's message refers to.
    ...(state.pendingPlayerRoll && input.type === "action"
      ? [`TIRADA PEDIDA AL JUGADOR\n${describePlayerRoll(state.pendingPlayerRoll)}`]
      : []),
    `TURNO ACTUAL\n${describeInput(input)}`,
  ].join("\n\n");
}

export const SUMMARY_SYSTEM_PROMPT = `Sos el archivista de una partida de D&D. Mantenés un resumen acumulado que el Dungeon Master usa como memoria a largo plazo.

Te paso el RESUMEN ANTERIOR y los TURNOS NUEVOS. Devolvé un único resumen actualizado que los integre, en español, en prosa, de 300 palabras como máximo.

- Conservá siempre los nombres propios exactos de personas, lugares y objetos, aunque hayan aparecido una sola vez.
- Conservá promesas, deudas, pistas, secretos descubiertos y cabos sueltos.
- Si hace falta espacio, comprimí lo viejo y lo anecdótico, nunca los nombres.
- No inventes nada que no esté en el material. Respondé solo con el resumen.`;

export function buildSummaryPrompt(previousSummary: string, newTurns: Turn[]): string {
  return [
    `RESUMEN ANTERIOR\n${previousSummary || "(Todavía no hay resumen.)"}`,
    `TURNOS NUEVOS\n${newTurns.map(describeTurn).join("\n\n")}`,
  ].join("\n\n");
}
