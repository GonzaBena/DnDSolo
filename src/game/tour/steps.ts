import type { DriveStep } from "driver.js";

export const TOUR_STORAGE_KEY = "dnsolo.tour.play.v1";
export const START_TOUR_EVENT = "dnsolo:start-tour";

export interface TourCandidate {
  selector: string;
  step: Omit<DriveStep, "element">;
}

export const PLAY_TOUR_CANDIDATES: TourCandidate[] = [
  {
    selector: '[data-tour="log"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "La historia y los turnos",
        description:
          "Acá aparece la narración del DM. Si está escribiendo y querés leer todo de una, tocá el texto para completarlo al instante. Debajo del último turno también aparecen «Deshacer» y «Regenerar».",
        side: "bottom",
        align: "start",
      },
    },
  },
  {
    selector: '[data-tour="composer"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Contá qué hacés",
        description:
          "Escribí la acción de tu personaje (Enter envía, Shift+Enter agrega una línea). También podés usar comandos rápidos: /descanso, /mirar o /resumen.",
        side: "top",
        align: "start",
      },
    },
  },
  {
    selector: '[data-tour="suggestions"].suggestions-slot--open',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Ideas del DM",
        description:
          "Tocar una sugerencia solo rellena el campo para que puedas editarla antes de enviarla. Con mouse podés deslizarlas con la rueda.",
        side: "top",
        align: "center",
      },
    },
  },
  {
    selector: '[data-tour="roll"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Tirar el d20",
        description:
          "Se ilumina cuando el DM te pide una tirada, pero podés tocarlo en cualquier momento para cargar o lanzar tus dados.",
        side: "top",
        align: "end",
      },
    },
  },
  {
    selector: '[data-tour="hp"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Vida rápida",
        description:
          "Usá − y + para ajustar tus puntos de golpe de a uno, o tocá «PG» para corregir un daño o curación grande de golpe.",
        side: "bottom",
        align: "start",
      },
    },
  },
  {
    selector: '[data-tour="scene-panel"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Escena y combate",
        description:
          "Muestra quién está en escena, su estado aproximado de salud y el orden de iniciativa en combate. Tocá un PNJ para editar su nombre.",
        side: "left",
        align: "start",
      },
    },
  },
  {
    selector: '[data-tour="scene-button"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Escena y combate",
        description:
          "Abrí la escena actual para ver quién está presente, el orden de iniciativa en combate y editar o renombrar PNJs.",
        side: "bottom",
        align: "end",
      },
    },
  },
  {
    selector: '[data-tour="info"]',
    step: {
      scrollIntoView: { block: "nearest", inline: "nearest" },
      popover: {
        title: "Ficha, historia y mundo",
        description:
          "Acá tenés tres pestañas: Héroe (hoja completa, inventario y hechizos), Historia (resumen de la campaña) y Mundo (misiones, lugares y PNJs).",
        side: "bottom",
        align: "end",
      },
    },
  },
];

/** Default visibility check in the browser: ignores `display: none` or
 *  zero-sized responsive alternates (e.g. mobile vs desktop scene UI). */
export function isElementVisible(element: Element): boolean {
  if (typeof window === "undefined") return true;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Filters tour candidates to the elements currently present and visible in the DOM. */
export function resolvePlayTourSteps(
  root: ParentNode = document,
  isVisible: (element: Element) => boolean = isElementVisible,
): DriveStep[] {
  const steps: DriveStep[] = [];
  for (const candidate of PLAY_TOUR_CANDIDATES) {
    const element = root.querySelector(candidate.selector);
    if (!element || !isVisible(element)) continue;
    steps.push({
      ...candidate.step,
      element: candidate.selector,
    });
  }
  return steps;
}
