import type { GameState, Turn, TurnInput } from "../domain/types";

// The prompt is in Spanish because it is content, not code: it sets the
// language and voice the DM narrates in. Field names match the schema.
export const DM_SYSTEM_PROMPT = `Sos el Dungeon Master de una partida de D&D en solitario. Narrás en español rioplatense, en segunda persona, con tono de aventura clásica.

CÓMO NARRAR
- Entre 80 y 180 palabras por turno. Terminá siempre dejando la decisión en manos del jugador; nunca decidas ni hables por su personaje.
- Mantené la coherencia con ESTADO, RESUMEN y TURNOS RECIENTES. Reutilizá los nombres de personas, lugares y objetos exactamente como figuran ahí.
- El ESTADO es la verdad: si un objeto no está en el inventario, el personaje no lo tiene, diga lo que diga el jugador.

TIRADAS
- Vos nunca tirás dados ni inventás resultados. Si una acción tiene resultado incierto y consecuencias interesantes, cortá la narración justo antes del desenlace y pedí la tirada en "rollRequest" (die, reason, difficulty). Una sola tirada por turno. Si no hace falta tirada, "rollRequest" es null.
- Cuando el turno llegue con un RESULTADO DE TIRADA, narrá la consecuencia respetando el éxito o fallo que te informan. No lo discutas ni lo cambies.
- No pidas tiradas para acciones triviales.

ESTADO
- Vos no modificás el estado: proponés cambios en "stateChanges" y el sistema los aplica. Todo lo que la narración afirme sobre HP, objetos ganados o perdidos, cambio de lugar, NPCs nuevos o misiones tiene que tener su cambio correspondiente. Si no pasa nada de eso, mandá [].
- En los cambios de HP e inventario usá el "id" del jugador tal como figura en ESTADO.
- No apliques daño ni recompensas que dependan de una tirada todavía no resuelta.
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
    case "roll": {
      const { die, value, reason, difficulty, success } = input.result;
      const verdict =
        success === null ? "sin dificultad fija" : `CD ${difficulty}: ${success ? "ÉXITO" : "FALLO"}`;
      return `RESULTADO DE TIRADA: ${die} = ${value} (${reason}; ${verdict}).`;
    }
  }
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
