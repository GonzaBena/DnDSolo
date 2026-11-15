import { useEffect, useRef, useState } from "react";
import { GeminiClient } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { LLMError } from "../llm/LLMClient";
import { isConfigured, loadSettings } from "../persistence/settings";
import { LOADED_MAX_LEVEL } from "../rules";
import { generateOptions } from "../rules/generateOptions";
import type { GeneratedOption } from "../rules/generateOptions";
import { SheetView } from "./SheetView";

interface Props {
  onUse: (option: GeneratedOption) => void;
}

type Phase =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "error"; message: string }
  | { status: "done"; options: GeneratedOption[]; failures: string[] };

export function CharacterGenerator({ onUse }: Props) {
  // null until localStorage has been read in the browser.
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [story, setStory] = useState("");
  const [level, setLevel] = useState("1");
  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const [selected, setSelected] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setConfigured(isConfigured(loadSettings()));
    return () => abortRef.current?.abort();
  }, []);

  async function generate(event: { preventDefault(): void }) {
    event.preventDefault();
    const settings = loadSettings();
    if (!isConfigured(settings)) {
      setConfigured(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSelected(null);
    setPhase({ status: "generating" });
    try {
      const result = await generateOptions(
        new GeminiClient(settings.apiKey, settings.model),
        story,
        Number(level),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setPhase({ status: "done", options: result.options, failures: result.failures });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof LLMError
          ? describeLLMError(error)
          : error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.";
      setPhase({ status: "error", message });
    }
  }

  const generating = phase.status === "generating";
  const options = phase.status === "done" ? phase.options : [];
  const current = selected !== null ? options[selected] : undefined;

  return (
    <section className="generator" aria-labelledby="generator-title">
      <h2 id="generator-title">Generá opciones a partir de tu historia</h2>
      {configured === false ? (
        <p className="notice">
          Para generar personajes necesitás cargar tu API key de Gemini en <a href="/settings">Configuración</a>. El
          formulario de abajo funciona igual.
        </p>
      ) : (
        <form className="form" onSubmit={generate}>
          <label className="field">
            <span>Tu historia</span>
            <textarea
              rows={5}
              maxLength={2000}
              required
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Ej: una ex soldado que busca a su hermana desaparecida."
            />
          </label>
          <label className="field">
            <span>Nivel (1 a {LOADED_MAX_LEVEL})</span>
            <input
              type="number"
              min={1}
              max={LOADED_MAX_LEVEL}
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </label>
          <div className="actions">
            <button type="submit" className="button button--primary" disabled={generating || configured === null}>
              Generar opciones
            </button>
          </div>
        </form>
      )}

      <p className="status" role="status" aria-live="polite" data-tone={phase.status === "error" ? "error" : undefined}>
        {generating ? "Generando…" : phase.status === "error" ? phase.message : ""}
      </p>

      {phase.status === "done" && phase.failures.length > 0 && (
        <div className="notice">
          {phase.failures.map((failure) => (
            <p key={failure}>{failure}</p>
          ))}
        </div>
      )}

      {options.length > 0 && (
        <ul className="options">
          {options.map((option, index) => (
            <li key={index} className="option" data-selected={selected === index || undefined}>
              <h3>{option.name}</h3>
              <p className="option__tags">
                {option.sheet.species} · {option.sheet.className} · Nivel {option.sheet.level}
              </p>
              <p>{option.pitch}</p>
              {option.outsideSrdNote && <p className="option__note">{option.outsideSrdNote}</p>}
              <button
                type="button"
                className="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                Ver ficha
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && <SheetView key={selected} option={current} onUse={onUse} />}
    </section>
  );
}
