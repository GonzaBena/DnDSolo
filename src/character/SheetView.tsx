import { useEffect, useMemo, useRef, useState } from "react";
import { formatSheetMarkdown, formatSheetText } from "../rules/formatSheet";
import type { GeneratedOption } from "../rules/generateOptions";
import { copyText } from "./clipboard";

interface Props {
  option: GeneratedOption;
  onUse: (option: GeneratedOption) => void;
}

type Copy = { status: "idle" } | { status: "copied"; what: string } | { status: "fallback"; text: string };

/** The sheet as the same text that "Copiar ficha" copies, plus the actions on it. */
export function SheetView({ option, onUse }: Props) {
  const { sheet, name, story } = option;
  const text = useMemo(() => formatSheetText(sheet, name, story), [sheet, name, story]);
  const [copy, setCopy] = useState<Copy>({ status: "idle" });
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  // When copying failed, leave the text selected so Ctrl+C is all that's left.
  useEffect(() => {
    if (copy.status === "fallback") fallbackRef.current?.select();
  }, [copy]);

  async function copyTo(what: string, content: string) {
    const result = await copyText(content, navigator.clipboard);
    setCopy(result === "copied" ? { status: "copied", what } : { status: "fallback", text: content });
  }

  return (
    <section className="sheet-view" aria-label={`Ficha de ${name}`}>
      <h3>{name}</h3>
      <pre className="sheet-view__text">{text}</pre>
      <div className="actions">
        <button type="button" className="button" onClick={() => void copyTo("Ficha", text)}>
          Copiar ficha
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void copyTo("Markdown", formatSheetMarkdown(sheet, name, story))}
        >
          Copiar en Markdown
        </button>
        <button type="button" className="button button--primary" onClick={() => onUse(option)}>
          Usar este personaje
        </button>
      </div>
      <p className="status" role="status" aria-live="polite">
        {copy.status === "copied" ? `${copy.what} copiada.` : ""}
      </p>
      {copy.status === "fallback" && (
        <label className="field">
          <span>No pude copiar; seleccioná y copiá a mano.</span>
          <textarea ref={fallbackRef} readOnly rows={10} value={copy.text} />
        </label>
      )}
    </section>
  );
}
