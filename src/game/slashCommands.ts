/** Expands slash commands typed into the free-text input into full narrative intentions. */
export function expandSlashCommands(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "/descanso" || trimmed.startsWith("/descanso ")) {
    // "/descanso [corto|largo] [lo que sigue]"; a bare one is a short rest.
    const [, kind = "", rest = ""] = /^\/descanso(?:\s+(corto|largo)\b)?\s*(.*)$/s.exec(trimmed) ?? [];
    const intent =
      kind === "largo"
        ? "Armo campamento para un descanso largo de ocho horas."
        : "Me tomo un descanso corto (una hora) para recuperar el aliento y vendar heridas.";
    return rest === "" ? intent : `${intent} ${rest}`;
  }
  if (trimmed === "/resumen" || trimmed.startsWith("/resumen ")) {
    return trimmed.replace(
      "/resumen",
      "Hago una pausa para evaluar mi situación, observar el entorno y recordar mis objetivos.",
    );
  }
  if (trimmed === "/mirar" || trimmed === "/inspeccionar") {
    return "Miro con detenimiento a mi alrededor para buscar detalles, pistas o peligros ocultos.";
  }
  return trimmed;
}
