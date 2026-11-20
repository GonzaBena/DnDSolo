/** Expands slash commands typed into the free-text input into full narrative intentions. */
export function expandSlashCommands(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "/descanso" || trimmed.startsWith("/descanso ")) {
    return trimmed.replace(
      "/descanso",
      "Me tomo un descanso para recuperar energías y curar heridas.",
    );
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
