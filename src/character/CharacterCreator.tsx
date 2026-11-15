import { useRef, useState } from "react";
import type { CharacterInput } from "../domain/character";
import type { GeneratedOption } from "../rules/generateOptions";
import { CharacterForm } from "./CharacterForm";
import { CharacterGenerator } from "./CharacterGenerator";
import { formValuesFromOption } from "./formValues";
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
  const formRef = useRef<HTMLElement>(null);

  function use(option: GeneratedOption) {
    setValues(formValuesFromOption(option));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <h1>Creá tu personaje</h1>
      <CharacterGenerator onUse={use} />
      <section ref={formRef} className="creator-form" aria-labelledby="form-title">
        <h2 id="form-title">Tu personaje</h2>
        <CharacterForm values={values} onChange={setValues} />
      </section>
    </>
  );
}
