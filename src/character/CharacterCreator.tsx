import { useEffect, useState } from "react";
import type { CharacterInput } from "../domain/character";
import { CharacterForm } from "./CharacterForm";
import { takeCharacter } from "./handoff";
import "./character.css";

const EMPTY: CharacterInput = {
  name: "",
  speciesId: "human",
  classId: "fighter",
  subclassId: null,
  srdBackgroundId: null,
  level: 1,
  background: "",
};

export default function CharacterCreator() {
  const [values, setValues] = useState<CharacterInput>(EMPTY);

  // A character picked on /generator arrives through sessionStorage.
  useEffect(() => {
    const generated = takeCharacter(sessionStorage);
    if (generated) setValues(generated);
  }, []);

  return (
    <>
      <h1>Creá tu personaje</h1>
      <div className="actions">
        <a className="button button--primary" href="/generator">
          Generar con IA a partir de una historia
        </a>
      </div>
      <section className="creator-form" aria-labelledby="form-title">
        <h2 id="form-title">Tu personaje</h2>
        <CharacterForm values={values} onChange={setValues} />
      </section>
    </>
  );
}
