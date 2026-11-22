import type { Cast } from "../domain/dialogue";
import type { GameState } from "../domain/types";
import { downloadGame } from "../persistence/exportGame";
import { TurnLog } from "./TurnLog";

/** The end of a campaign whose character died: the story stays readable
    and nothing can be sent anymore. */
export function GameOver({ state, cast }: { state: GameState; cast: Cast }) {
  return (
    <section className="game-over">
      <header className="game-over__header">
        <h1 className="game-over__title">Tu historia terminó acá</h1>
        <p className="game-over__subtitle">
          {state.players[0]?.name ?? "Tu personaje"} cayó para no volver a levantarse.
        </p>
        <div className="actions">
          <button type="button" className="button" onClick={() => downloadGame(state)}>
            Exportar partida
          </button>
          <a className="button button--primary" href="/character">
            Nueva campaña
          </a>
        </div>
      </header>
      <div className="log">
        <TurnLog turns={state.turns} players={state.players} cast={cast} enterCount={state.turns.length} />
      </div>
    </section>
  );
}
