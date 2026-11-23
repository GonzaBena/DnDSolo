import type { OfficialCampaign } from "../types";

export const campanaFaroHundido: OfficialCampaign = {
  id: "campana-faro-hundido",
  title: "La Campana del Faro Hundido",
  tag: "Misterio costero y no-muertos · Niveles 2 a 4",
  startingLevel: 2,
  maxLevel: 4,
  synopsis:
    "Una niebla salitrosa lleva nueve noches sin levantarse de Puerto Bruma. Con cada campanada que suena bajo el mar, los marineros ahogados caminan por el muelle y los vivos empiezan a olvidar sus propios nombres.",
  generatorPromptHook:
    "La aventura empieza en el Muelle de las Áncoras de Puerto Bruma, un pueblo pesquero atrapado por una niebla sobrenatural donde suenan campanadas desde el mar y la Capitana Sera Valen recluta ayuda frente a una barca que regresó sin tripulación viva.",
  startPrompt:
    "INICIO DE LA CAMPAÑA (La Campana del Faro Hundido): El personaje está en el Muelle de las Áncoras de Puerto Bruma junto a la Capitana Sera Valen cuando una barca encalla sola entre la niebla y se oye una campanada sorda desde el mar. Conectá la escena con el trasfondo del personaje y dejale decidir su primera acción.",
  dmCompass:
    "La Hermana Odrina y la Cofradía de la Pleamar tocan la Campana de Bronce Negro en la Cripta del Faro Hundido durante la marea baja para atar las almas de Puerto Bruma y levantar una tripulación de ahogados. Solo el Arpón de Plata Consagrada oculto en la Capilla de la Sal puede rajar el badajo maldito.",
  initialState: {
    location: {
      name: "Muelle de las Áncoras",
      description:
        "Tablones negros de humedad que crujen sobre el agua espesa; la niebla huele a salmuera podrida y cera de vela.",
    },
    npcs: [
      {
        name: "Capitana Sera Valen",
        description: "Veterana guardacostas con capote encerado y un catalejo de bronce abollado.",
        attitude: "friendly",
        present: true,
        voice: "Voz ronca de tormenta, escupe al suelo antes de hablar y llama 'grumete' a desconocidos.",
        portrait: "sailor-female",
        hp: 22,
        maxHp: 22,
      },
    ],
    quests: [
      {
        title: "Los que vuelven con la marea",
        description:
          "Inspeccionar la barca encallada en el Muelle de las Áncoras y seguir las pistas hacia la Capilla de la Sal.",
        status: "active",
      },
    ],
    threads: [
      {
        title: "Romper el cerco de niebla sobre Puerto Bruma",
        kind: "goal",
        description: "Silenciar la campana sumergida antes de que la novena pleamar arrastre al pueblo entero.",
        status: "open",
        secret: false,
      },
      {
        title: "La Cofradía de la Pleamar",
        kind: "threat",
        description:
          "La Hermana Odrina dirige un culto en la Cripta del Faro Hundido que despierta a los marineros ahogados.",
        status: "open",
        secret: true,
      },
      {
        title: "El secreto del farero Lázaro",
        kind: "mystery",
        description:
          "El viejo farero Lázaro escondió el Arpón de Plata Consagrada bajo el altar de la Capilla de la Sal para quebrar la campana.",
        status: "open",
        secret: true,
      },
    ],
    storyItems: [
      {
        name: "Bitácora empapada del Bergantín",
        description: "Cuaderno hinchado por el agua salada que menciona cánticos y luces verdes en la Capilla de la Sal.",
        location: "Muelle de las Áncoras",
        status: "available",
      },
    ],
  },
  acts: [
    {
      number: 1,
      title: "Marea de ceniza y sal",
      closesWhenCompleted: "Los que vuelven con la marea",
      dmGuidance:
        "En el Muelle de las Áncoras la barca trae la 'Bitácora empapada del Bergantín' y del agua emergen los primeros ahogados. Cuando el jugador derrote o contenga la incursión inicial en el muelle y descubra que la pista apunta a la Capilla de la Sal, marcá 'Los que vuelven con la marea' como 'completed', otorgá 1 'milestone' y creá la misión activa 'El secreto de la Capilla de la Sal'.",
    },
    {
      number: 2,
      title: "La vigilia de la capilla",
      closesWhenCompleted: "El secreto de la Capilla de la Sal",
      dmGuidance:
        "En la Capilla de la Sal o el Arrecife de los Cascos Rotos el jugador conoce al viejo farero Lázaro o enfrenta a los acólitos de la pleamar, descubre la verdad sobre el culto (revelá 'La Cofradía de la Pleamar' y 'El secreto del farero Lázaro' con secret: false) y recupera el 'Arpón de Plata Consagrada' o la ruta por el arrecife hacia el faro. Al lograrlo, marcá 'El secreto de la Capilla de la Sal' como 'completed', otorgá 1 'milestone' (con 2 hitos subilo a nivel 3 con un cambio 'level') y creá la misión activa 'Quebrar la Campana de Bronce Negro'.",
    },
    {
      number: 3,
      title: "La novena campanada",
      closesWhenCompleted: "Quebrar la Campana de Bronce Negro",
      closesWhenThreadResolved: "La Cofradía de la Pleamar",
      dmGuidance:
        "Clímax en la Cripta del Faro Hundido contra la Hermana Odrina y sus guardianes no-muertos mientras el agua sube. El jugador puede vencer a Odrina o usar el Arpón de Plata Consagrada para partir el badajo de la campana (Atletismo o ataque CD 14). Al quebrar la campana o derrotar a Odrina, marcá 'Quebrar la Campana de Bronce Negro' como 'completed', resolvé los hilos ('status': 'resolved'), otorgá 1 'milestone' y narrá cómo se disipa la niebla dejando la partida abierta.",
    },
  ],
  locations: [
    {
      name: "Muelle de las Áncoras",
      keywords: ["muelle", "ancoras", "puerto bruma"],
      indexLine: "Embarcadero principal de Puerto Bruma, custodiado por la Capitana Sera Valen.",
      dmDetails:
        "Escena inicial junto a la barca a la deriva. Encuentro: 'Marinero Ahogado 1' y 'Marinero Ahogado 2' (portrait: 'drowned', attitude: 'hostile', maxHp: 13, golpe helado +4 por 1d6+2) trepando por las cadenas del muelle. La bitácora y una medalla de plomo oxidada llevan el emblema de la Capilla de la Sal.",
    },
    {
      name: "Capilla de la Sal",
      keywords: ["capilla", "sal", "templo"],
      indexLine: "Capilla costera semiderruida sobre el barranco del pueblo.",
      dmDetails:
        "Huele a incienso húmedo y algas. NPCs acá: 'Farero Lázaro' (portrait: 'elder-male', attitude: 'friendly', maxHp: 9, voice: 'Susurra tapándose los oídos, repite los nombres de barcos hundidos para no olvidar el suyo'), escondido tras el confesionario; y 'Acólito de la Pleamar' (portrait: 'cultist-male', attitude: 'hostile', maxHp: 16, ataque +4 por 1d8+2) junto a un 'Esqueleto de Coral' (portrait: 'skeleton', attitude: 'hostile', maxHp: 13). Bajo el altar está el item available 'Arpón de Plata Consagrada'.",
    },
    {
      name: "Arrecife de los Cascos Rotos",
      keywords: ["arrecife", "cascos rotos", "escollera"],
      indexLine: "Paso de rocas y naufragios que solo queda al descubierto en marea baja hacia el faro.",
      dmDetails:
        "Lengua de roca resbaladiza entre esqueletos de navíos. Peligro ambiental: olas traicioneras y campanas que aturden (Salvación de Sabiduría CD 12 o desventaja en el primer turno). Entre los restos del navío insignia hay una 'Linterna de Aceite Astral' (item available, ilumina a través de la niebla mágica) y 2 'Esqueleto de Coral' (portrait: 'skeleton', attitude: 'hostile', maxHp: 13).",
    },
    {
      name: "Cripta del Faro Hundido",
      keywords: ["cripta", "faro hundido", "faro"],
      indexLine: "Bóveda inundada bajo las ruinas del viejo faro en el extremo del arrecife.",
      dmDetails:
        "Cámara circular con agua hasta las rodillas y la Campana de Bronce Negro colgando sobre un pozo marino. Jefa final: 'Hermana Odrina' (portrait: 'cultist-female', attitude: 'hostile', maxHp: 32, conjuro de marea negra +5 por 2d6+2 necrótico o campanada psíquica con Salvación de Sabiduría CD 13) acompañada por 'Capitán Ahogado' (portrait: 'drowned', attitude: 'hostile', maxHp: 18, ataque +5 por 1d8+2). Golpear la campana con el Arpón de Plata Consagrada destruye al Capitán Ahogado al instante y debilita a Odrina.",
    },
  ],
};
