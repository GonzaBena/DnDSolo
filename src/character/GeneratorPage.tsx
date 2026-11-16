import { useState } from "react";
import type { GeneratedOption } from "../rules/generateOptions";
import { CharacterGenerator } from "./CharacterGenerator";
import { formValuesFromOption } from "./formValues";
import { stashCharacter } from "./handoff";
import "./character.css";

export default function GeneratorPage() {
  const [blocked, setBlocked] = useState(false);

  function use(option: GeneratedOption) {
    if (!stashCharacter(sessionStorage, formValuesFromOption(option))) {
      setBlocked(true);
      return;
    }
    location.href = "/character";
  }

  return (
    <>
      <h1>Generador de personajes</h1>
      <CharacterGenerator onUse={use} />
      {blocked && (
        <p className="status" data-tone="error" role="alert">
          Este navegador bloquea el almacenamiento, así que no puedo pasar el personaje al formulario. Copiá la
          ficha y cargalo a mano en <a href="/character">Crear personaje</a>.
        </p>
      )}
      <div className="actions">
        <a className="button" href="/character">
          Crear personaje a mano
        </a>
      </div>
    </>
  );
}
