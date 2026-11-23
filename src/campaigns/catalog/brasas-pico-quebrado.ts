import type { OfficialCampaign } from "../types";

export const brasasPicoQuebrado: OfficialCampaign = {
  id: "brasas-pico-quebrado",
  title: "Las Brasas de Pico Quebrado",
  tag: "Frontera y ruinas · Niveles 1 a 3",
  startingLevel: 1,
  maxLevel: 3,
  synopsis:
    "Las caravanas de hierro dejaron de bajar de Pico Quebrado. Entre la nieve y el humo de las fraguas apagadas, bandas de goblins y kobolds saquean los caminos mientras algo antiguo despierta en la forja enana sepultada.",
  generatorPromptHook:
    "La aventura empieza en la Posada El Yunque Partido, en la aldea minera de Pico Quebrado: las caravanas de hierro fueron cortadas en el paso de montaña y el herrero enano Thrain Yunquegris busca a alguien capaz de internarse en el camino nevado y la Mina Vieja.",
  startPrompt:
    "INICIO DE LA CAMPAÑA (Las Brasas de Pico Quebrado): El personaje está en la Posada El Yunque Partido mientras afuera cae aguanieve. Thrain Yunquegris y Marta Brasas discuten por la última caravana emboscada. Integrá el trasfondo del personaje para explicar por qué está ahí, hacé que Thrain o Marta se dirijan a él con urgencia y dejale la decisión de cómo actuar.",
  dmCompass:
    "El ex capataz Varek traicionó al pueblo: vendió las llaves de la exclusa de escoria a los kobolds de la Garra Roja, quienes usan carbón alquímico y tributos saqueados por goblins para alimentar a Ignis-Vhar (una cría de dragón rojo) en la Forja Hundida bajo la Mina Vieja.",
  initialState: {
    location: {
      name: "Posada El Yunque Partido",
      description:
        "El único refugio tibio de Pico Quebrado, con olor a pino húmedo, grasa de carnero y hierro viejo.",
    },
    npcs: [
      {
        name: "Thrain Yunquegris",
        description: "Maestro herrero enano con el brazo izquierdo vendado por una quemadura reciente.",
        attitude: "friendly",
        present: true,
        voice: "Grave y cascada, golpea la mesa con los nudillos al enfatizar y llama 'hierro dulce' a los novatos.",
        portrait: "dwarf-male",
        hp: 18,
        maxHp: 18,
      },
      {
        name: "Marta Brasas",
        description: "Posadera de mirada afilada que raciona la leña y conoce cada rumor del paso.",
        attitude: "friendly",
        present: true,
        voice: "Directa y apurada, repite 'escuchame bien' y habla mientras seca jarros con un trapo.",
        portrait: "innkeeper-female",
        hp: null,
        maxHp: null,
      },
    ],
    quests: [
      {
        title: "El silencio de la Mina Vieja",
        description:
          "Inspeccionar la caravana emboscada en el Camino de las Caravanas y descubrir qué está saliendo de la Mina Vieja.",
        status: "active",
      },
    ],
    threads: [
      {
        title: "Reabrir el paso de Pico Quebrado",
        kind: "goal",
        description: "Restablecer el camino minero y salvar a la aldea del aislamiento antes de que cierre el invierno.",
        status: "open",
        secret: false,
      },
      {
        title: "El culto escamoso de Ignis-Vhar",
        kind: "threat",
        description:
          "Los kobolds de la Garra Roja alimentan a Ignis-Vhar, una cría de dragón rojo despertada en la Forja Hundida.",
        status: "open",
        secret: true,
      },
      {
        title: "La traición del capataz Varek",
        kind: "mystery",
        description:
          "El capataz Varek entregó la llave de la exclusa de escoria a los kobolds y quedó atrapado en la Mina Vieja.",
        status: "open",
        secret: true,
      },
    ],
    storyItems: [
      {
        name: "Mapa de vetas de Thrain",
        description: "Pergamino chamuscado que marca un conducto de ventilación lateral hacia la Mina Vieja.",
        location: "Posada El Yunque Partido",
        status: "available",
      },
    ],
  },
  acts: [
    {
      number: 1,
      title: "Emboscada en la nieve",
      closesWhenCompleted: "El silencio de la Mina Vieja",
      dmGuidance:
        "El objetivo es que el jugador investigue la Posada o parta al Camino de las Caravanas, enfrente o esquive a los saqueadores goblins y descubra el rastro de carbón alquímico y escamas hacia la Mina Vieja. Al hallar el Cajón de sellos de Thrain o confirmar que el ataque vino de la Mina Vieja, marcá la misión 'El silencio de la Mina Vieja' como 'completed', otorgá 1 'milestone' y creá la misión activa 'La llave de la Forja Hundida' (penetrar en la Mina Vieja y abrir la exclusa hacia el nivel inferior).",
    },
    {
      number: 2,
      title: "Los túneles de escoria",
      closesWhenCompleted: "La llave de la Forja Hundida",
      dmGuidance:
        "En la Mina Vieja de Pico Quebrado el jugador puede hallar al capataz Varek (acobardado o herido, revela el hilo 'La traición del capataz Varek' con secret: false) y enfrentar o engañar al chamán kobold Skarn que custodia la exclusa. Al obtener la Llave de la Exclusa y abrir el descenso a la Forja Hundida, marcá 'La llave de la Forja Hundida' como 'completed', otorgá 1 'milestone' (con 2 hitos subilo a nivel 2 con un cambio 'level'), revelá 'El culto escamoso de Ignis-Vhar' (secret: false) y creá la misión activa 'Apagar el corazón de la fragua'.",
    },
    {
      number: 3,
      title: "El despertar de la forja",
      closesWhenCompleted: "Apagar el corazón de la fragua",
      closesWhenThreadResolved: "El culto escamoso de Ignis-Vhar",
      dmGuidance:
        "Clímax en La Forja Hundida frente a Ignis-Vhar (cría de dragón rojo debilitada por el letargo) y sus fanáticos kobolds. El jugador puede vencerla en combate directo o accionar las cadenas de los fuelles gigantes para inundar el foso con nieve y escoria fría. Al derrotar o sellar a Ignis-Vhar, marcá 'Apagar el corazón de la fragua' como 'completed', resolvé los hilos ('status': 'resolved'), otorgá 1 'milestone' y narrá un epílogo heroico dejando la partida abierta.",
    },
  ],
  locations: [
    {
      name: "Posada El Yunque Partido",
      keywords: ["posada", "yunque partido"],
      indexLine: "En la aldea de Pico Quebrado; refugio de Thrain Yunquegris y Marta Brasas.",
      dmDetails:
        "Refugio seguro para descansos. Thrain ofrece el 'Mapa de vetas de Thrain' si el jugador acepta investigar. Si el jugador interroga a Marta, ella sospecha que el capataz Varek pagó sus deudas con oro antiguo antes de desaparecer.",
    },
    {
      name: "Camino de las Caravanas",
      keywords: ["camino", "caravanas", "paso"],
      indexLine: "Desfiladero nevado a media hora de la posada, donde quedó volcado el último carro de hierro.",
      dmDetails:
        "Un carro volcado entre pinos helados. Encuentro: 2 saqueadores goblins ('Goblin 1' y 'Goblin 2', portrait: 'goblin', attitude: 'hostile', maxHp: 7, ataque +4 con 1d6+2) revolviendo los restos. Objetos que se pueden registrar como 'item' available: 'Cajón de sellos de Thrain' y 'Frasco de aceite ígneo' (lleva marcas kobold de la Mina Vieja).",
    },
    {
      name: "Mina Vieja de Pico Quebrado",
      keywords: ["mina vieja", "mina", "tuneles"],
      indexLine: "Galerías superiores en la ladera norte, tomadas por kobolds de la Garra Roja.",
      dmDetails:
        "Galerías con olor a azufre y trampas de cuerda (Percepción o Investigación CD 12). NPCs para introducir acá: 'Capataz Varek' (portrait: 'bandit-male', attitude: 'neutral', maxHp: 11, voice: 'Tembloroso y culpable, jura que no sabía qué había abajo') encerrado en una jaula; y 'Skarn el Chamán' (portrait: 'kobold', attitude: 'hostile', maxHp: 14, ataque +4 con 1d6+2 de fuego, escoltado por 'Kobold 1' de maxHp: 5, portrait: 'kobold'). Objeto clave: 'Llave de la Exclusa de Escoria'.",
    },
    {
      name: "La Forja Hundida",
      keywords: ["forja hundida", "forja", "fragua"],
      indexLine: "Cámara ancestral enana bajo la Mina Vieja, detrás de la exclusa de escoria.",
      dmDetails:
        "Salón colosal con yunques rúnicos y un foso ardiente. Jefe final: 'Ignis-Vhar' (portrait: 'dragon', attitude: 'hostile', maxHp: 28, mordisco +5 por 1d10+3 o aliento de brasas 2d6 con Salvación de Destreza CD 12). Táctica ambiental: las cadenas de las compuertas de nieve (Atletismo o Herramientas CD 14) apagan el foso, infligiendo 10 de daño a Ignis-Vhar y dándole desventaja. Recompensa: 'Martillo Rúnico de Yunquegris'.",
    },
  ],
};
