import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { enterPage, motionAllowed } from "../animations/motion";
import { OFFICIAL_CAMPAIGNS, findCampaign } from "../campaigns";
import type { CharacterInput } from "../domain/character";
import { createGame } from "../domain/character";
import { findClass, findSpecies } from "../rules";
import { createGameRepo } from "../sync/runtime";
import { applyBuildChange } from "./buildChange";
import { CharacterForm } from "./CharacterForm";
import { stashCampaignId, takeCharacter } from "./handoff";
import "./character.css";

const CAMPAIGN_STEP_HASH = "#campana";

const EMPTY: CharacterInput = {
  name: "",
  speciesId: "human",
  classId: "fighter",
  subclassId: null,
  srdBackgroundId: null,
  level: 1,
  background: "",
  campaignId: null,
};

type ViewTransitionDoc = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

function transitionStep(apply: () => void) {
  const doc = typeof document !== "undefined" ? (document as ViewTransitionDoc) : null;
  if (doc && typeof doc.startViewTransition === "function" && motionAllowed()) {
    doc.startViewTransition(() => {
      flushSync(apply);
    });
  } else {
    apply();
  }
}

export default function CharacterCreator() {
  const [values, setValues] = useState<CharacterInput>(EMPTY);
  const [step, setStep] = useState<"character" | "campaign">("character");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);

  // A character picked on /generator arrives through sessionStorage.
  useEffect(() => {
    const generated = takeCharacter(sessionStorage);
    if (generated) setValues({ ...EMPTY, ...generated });
  }, []);

  // Browser back/forward between the character form and the campaign step.
  useEffect(() => {
    const onPopState = () => {
      transitionStep(() => {
        setError(null);
        setStep(location.hash === CAMPAIGN_STEP_HASH ? "campaign" : "character");
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Plays the staggered page-enter transition whenever the step changes.
  useLayoutEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    const root = containerRef.current;
    if (!root) return;
    const blocks = [...root.children].flatMap((el) =>
      el.classList.contains("campaign-cards") ? [...el.children] : [el],
    );
    enterPage(blocks.filter((el) => el.getClientRects().length > 0));
  }, [step]);

  function goToCampaignStep(prepared: CharacterInput) {
    history.pushState({ step: "campaign" }, "", CAMPAIGN_STEP_HASH);
    transitionStep(() => {
      setValues(prepared);
      setError(null);
      setStep("campaign");
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function backToCharacter() {
    if ((history.state as { step?: string } | null)?.step === "campaign") {
      history.back();
      return;
    }
    history.replaceState(null, "", location.pathname + location.search);
    transitionStep(() => {
      setError(null);
      setStep("character");
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function selectCampaign(campaignId: string | null) {
    stashCampaignId(sessionStorage, campaignId);
    setValues((prev) => ({ ...prev, campaignId }));
  }

  async function startGame() {
    setSaving(true);
    setError(null);
    try {
      const campaign = findCampaign(values.campaignId);
      const effectiveLevel = campaign ? campaign.startingLevel : values.level;
      const subclass = findClass(values.classId)?.subclass;
      const subclassId = subclass && effectiveLevel >= subclass.level ? values.subclassId : null;
      const adjusted =
        campaign && effectiveLevel !== values.level && values.choices
          ? applyBuildChange(values, { level: effectiveLevel, subclassId }).values
          : { ...values, level: effectiveLevel, subclassId };
      const game = createGame({
        ...adjusted,
        campaignId: campaign?.id ?? null,
      });
      stashCampaignId(sessionStorage, null);
      // The new game becomes the latest save, which is what /play opens.
      await createGameRepo().save(game);
      location.href = "/play";
    } catch {
      setError("No se pudo guardar la partida en este navegador.");
      setSaving(false);
    }
  }

  if (step === "campaign") {
    const selectedId = values.campaignId ?? null;
    const speciesName = findSpecies(values.speciesId)?.name ?? values.speciesId;
    const className = findClass(values.classId)?.name ?? values.classId;

    return (
      <div ref={containerRef} className="campaign-picker" role="region" aria-labelledby="campaign-picker-title">
        <h1 id="campaign-picker-title">Elegí tu campaña</h1>
        <p className="campaign-picker__character">
          Personaje: <strong>{values.name}</strong> ({speciesName} · {className} · Nivel {values.level})
        </p>

        <ul className="options campaign-cards">
          <li className="option" data-selected={selectedId === null || undefined}>
            <h3>Aventura libre</h3>
            <p className="option__tags">Mundo abierto · Nivel {values.level}</p>
            <p>
              El Dungeon Master improvisa el lugar inicial, los personajes y las amenazas a partir de la historia que
              escribiste.
            </p>
            <button
              type="button"
              className="button"
              aria-pressed={selectedId === null}
              onClick={() => selectCampaign(null)}
            >
              {selectedId === null ? "Seleccionada" : "Elegir aventura libre"}
            </button>
          </li>

          {OFFICIAL_CAMPAIGNS.map((campaign) => {
            const active = selectedId === campaign.id;
            const levelDiffers = values.level !== campaign.startingLevel;
            return (
              <li key={campaign.id} className="option" data-selected={active || undefined}>
                <h3>{campaign.title}</h3>
                <p className="option__tags">{campaign.tag}</p>
                <p>{campaign.synopsis}</p>
                {levelDiffers && (
                  <p className="option__note">
                    Esta campaña arranca en nivel {campaign.startingLevel} (tu personaje empezará en ese nivel).
                  </p>
                )}
                <button
                  type="button"
                  className="button"
                  aria-pressed={active}
                  onClick={() => selectCampaign(campaign.id)}
                >
                  {active ? "Seleccionada" : "Elegir campaña"}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="status" role="status" aria-live="polite" data-tone={error ? "error" : undefined}>
          {error ?? ""}
        </p>

        <div className="actions">
          <button type="button" className="button" onClick={backToCharacter} disabled={saving}>
            Volver al personaje
          </button>
          <button type="button" className="button button--primary" onClick={startGame} disabled={saving}>
            Iniciar partida
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <h1>Creá tu personaje</h1>
      <div className="actions">
        <a className="button button--primary" href="/generator">
          Generar con IA a partir de una historia
        </a>
      </div>
      <section className="creator-form" aria-labelledby="form-title">
        <h2 id="form-title">Tu personaje</h2>
        <CharacterForm values={values} onChange={setValues} onNext={goToCampaignStep} />
      </section>
    </div>
  );
}
