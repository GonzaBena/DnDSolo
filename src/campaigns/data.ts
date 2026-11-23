import type { OfficialCampaign } from "./types";

export const OFFICIAL_CAMPAIGNS: readonly OfficialCampaign[] = [
  {
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
  },
  {
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
  },
  {
    id: "mascaras-casa-ceniza",
    title: "Máscaras de la Casa Ceniza",
    tag: "Intriga urbana y conspiración arcana · Niveles 3 a 4",
    startingLevel: 3,
    maxLevel: 4,
    synopsis:
      "Durante el baile de máscaras de la Casa Ceniza, un relicario sellado fue robado de la bóveda magistral y tres testigos amanecieron convertidos en vidrio gris. Las familias nobles, el gremio de contrabandistas y la torre arcana se acusan en voz baja.",
    generatorPromptHook:
      "La aventura empieza en el Salón de los Espejos Ahumados de la mansión noble Casa Ceniza, minutos después del robo del Relicario del Eclipse durante un baile de máscaras. Tu personaje ya es nivel 3 (con su subclase) y fue convocado por la Magistrada Valeria Ceniza y el Inspector Darío Kael para rastrear al culpable antes del alba.",
    startPrompt:
      "INICIO DE LA CAMPAÑA (Máscaras de la Casa Ceniza): El personaje está en el Salón de los Espejos Ahumados junto a la vitrina destrozada y una estatua de vidrio gris que hace una hora era un guardia. La Magistrada Valeria Ceniza y el Inspector Darío Kael esperan su dictamen inicial. Integrá la clase, subclase y trasfondo del personaje y dejale tomar la iniciativa.",
    dmCompass:
      "El Archivero Vaelen de la Torre Áurea planeó el robo: Lord Casio Ceniza (hermano de la Magistrada Valeria) le entregó la clave del sello para incriminar a Valeria, y la ladrona 'Sombra de Humo' (Lyra) llevó el Relicario del Eclipse al Mercado de los Canales para entregarlo en las Cisternas de Obsidiana.",
    initialState: {
      location: {
        name: "Salón de los Espejos Ahumados",
        description:
          "Terciopelo carmesí, copas de vino frío a medio tomar y una vitrina rota rodeada de polvo de vidrio gris.",
      },
      npcs: [
        {
          name: "Magistrada Valeria Ceniza",
          description: "Matriarca de la Casa Ceniza, vestida de gala negra con máscara de plata a medio quitar.",
          attitude: "neutral",
          present: true,
          voice: "Helada y cortante, mide cada sílaba, jamás levanta la voz y gira su anillo de sello.",
          portrait: "noble-female",
          hp: 24,
          maxHp: 24,
        },
        {
          name: "Inspector Darío Kael",
          description: "Investigador de la guardia citadina con el gabán manchado de hollín y lluvia.",
          attitude: "friendly",
          present: true,
          voice: "Cansado e irónico, habla en murmullos mirando hacia las puertas y anota todo en una libreta.",
          portrait: "guard-male",
          hp: 28,
          maxHp: 28,
        },
      ],
      quests: [
        {
          title: "El rastro de vidrio gris",
          description:
            "Examinar las pistas en el Salón de los Espejos Ahumados y rastrear a la ladrona hasta el Mercado de los Canales.",
          status: "active",
        },
      ],
      threads: [
        {
          title: "Recuperar el Relicario del Eclipse antes del alba",
          kind: "goal",
          description: "Impedir que el relicario robado sea abierto bajo la ciudad y limpiar o exponer a la Casa Ceniza.",
          status: "open",
          secret: false,
        },
        {
          title: "El ritual del Archivero Vaelen",
          kind: "threat",
          description:
            "El Archivero Vaelen prepara un ritual en las Cisternas de Obsidiana con el Relicario del Eclipse para petrificar al consejo noble.",
          status: "open",
          secret: true,
        },
        {
          title: "La traición de Lord Casio Ceniza",
          kind: "mystery",
          description:
            "Lord Casio Ceniza entregó el sello de sangre de su familia a Vaelen para derrocar a su hermana Valeria.",
          status: "open",
          secret: true,
        },
      ],
      storyItems: [
        {
          name: "Máscara de zorro agrietada",
          description:
            "Máscara de porcelana abandonada en la huida; por dentro tiene lacre del Mercado de los Canales y polen alquímico.",
          location: "Salón de los Espejos Ahumados",
          status: "available",
        },
      ],
    },
    acts: [
      {
        number: 1,
        title: "Espejos y sospechosos",
        closesWhenCompleted: "El rastro de vidrio gris",
        dmGuidance:
          "El jugador investiga el Salón de los Espejos Ahumados, interroga a Valeria, a Darío o a Lord Casio, y sigue la pista de la 'Máscara de zorro agrietada' hasta el Mercado de los Canales. Cuando localice o confronte a la ladrona Lyra ('Sombra de Humo') en el Mercado de los Canales y descubra que el comprador es de la Torre del Archivo Áureo, marcá 'El rastro de vidrio gris' como 'completed', otorgá 1 'milestone' y creá la misión activa 'Las llaves de la Cisterna'.",
      },
      {
        number: 2,
        title: "Conspiración en la torre",
        closesWhenCompleted: "Las llaves de la Cisterna",
        dmGuidance:
          "El jugador investiga la Torre del Archivo Áureo o negocia con Lyra/Casio para conseguir el sello que abre las Cisternas de Obsidiana. Acá se descubre la complicidad de Lord Casio (revelá 'La traición de Lord Casio Ceniza' y 'El ritual del Archivero Vaelen' con secret: false). Al obtener el 'Sello de Obsidiana' y abrir la entrada a las Cisternas, marcá 'Las llaves de la Cisterna' como 'completed', otorgá 1 'milestone' (con 2 hitos subilo a nivel 4 con un cambio 'level') y creá la misión activa 'El ritual bajo la Casa Ceniza'.",
      },
      {
        number: 3,
        title: "El eclipse de obsidiana",
        closesWhenCompleted: "El ritual bajo la Casa Ceniza",
        closesWhenThreadResolved: "El ritual del Archivero Vaelen",
        dmGuidance:
          "Clímax en las Cisternas de Obsidiana frente al Archivero Vaelen y sus centinelas mientras el Relicario del Eclipse empieza a cristalizar el agua. El jugador puede derrotar a Vaelen, invertir los espejos canalizadores (Arcanos o Religión CD 14) o convencer a Lyra/Darío de flanquearlo. Al detener el ritual y recuperar el relicario, marcá 'El ritual bajo la Casa Ceniza' como 'completed', resolvé los hilos ('status': 'resolved'), otorgá 1 'milestone' y narrá el desenlace político dejando la partida abierta.",
      },
    ],
    locations: [
      {
        name: "Salón de los Espejos Ahumados",
        keywords: ["salon", "espejos ahumados", "mansion", "casa ceniza"],
        indexLine: "Salón principal de la Casa Ceniza donde ocurrió el robo durante el baile.",
        dmDetails:
          "Escena del crimen. El guardia petrificado apunta hacia el balcón lateral. NPC adicional que puede entrar en escena si el jugador indaga en la mansión: 'Lord Casio Ceniza' (portrait: 'noble-male', attitude: 'neutral', maxHp: 20, voice: 'Finge indignación exagerada, bebe demasiado rápido y culpa a la guardia'). Investigar la vitrina (CD 13) revela que el sello no fue forzado sino abierto con una llave de sangre familiar.",
      },
      {
        name: "Mercado de los Canales",
        keywords: ["mercado", "canales", "muelles bajos"],
        indexLine: "Pasarelas flotantes y almacenes de contrabandistas bajo los puentes de la ciudad.",
        dmDetails:
          "Góndolas oscuras, faroles de aceite rojo y puestos cerrados. Acá se esconde 'Lyra Sombra de Humo' (portrait: 'thief-female', attitude: 'neutral', maxHp: 27, ataque furtivo +6 por 2d6+3, voice: 'Susurro burlón, juega con una moneda de plata entre los dedos y nunca da la espalda a una puerta') emboscada por 2 matones que Vaelen mandó para silenciarla ('Matón del Archivo 1' y 'Matón del Archivo 2', portrait: 'bandit-male', attitude: 'hostile', maxHp: 19, ataque +5 por 1d8+2). Si el jugador la ayuda o la vence, Lyra confiesa que entregó el relicario al Archivero Vaelen y da el item available 'Recibo cifrado de Vaelen'.",
      },
      {
        name: "Torre del Archivo Áureo",
        keywords: ["torre", "archivo aureo", "archivo", "biblioteca"],
        indexLine: "Sede de los eruditos y alquimistas reales que domina el canal mayor.",
        dmDetails:
          "Estanterías circulares de bronce y olor a ozono. El despacho de Vaelen está custodiado por su discípula 'Aurelia la Aprendiz' (portrait: 'wizard-female', attitude: 'hostile', maxHp: 24, proyectil arcano +5 por 2d6+3, voice: 'Pedante y fanática, recita teoremas mientras lanza conjuros'). En el escritorio está el item available 'Sello de Obsidiana' (abre las Cisternas) y las cartas firmadas por Lord Casio Ceniza.",
      },
      {
        name: "Cisternas de Obsidiana",
        keywords: ["cisternas", "obsidiana", "bovedas", "subterraneo"],
        indexLine: "Antiguas cámaras hidráulicas bajo la Casa Ceniza donde convergen las líneas arcanas.",
        dmDetails:
          "Columnas de basalto negro reflejadas en agua inmóvil y tres espejos de bronce canalizando luz gris desde el 'Relicario del Eclipse' (item available al detener el ritual). Jefe final: 'Archivero Vaelen' (portrait: 'wizard-male', attitude: 'hostile', maxHp: 42, rayo de vidrio gris +6 por 2d8+3 o onda petrificante con Salvación de Constitución CD 14, voice: 'Solemne y despiadado, habla de la ciudad como un experimento fallido') escoltado por un 'Centinela de Hueso y Vidrio' (portrait: 'skeleton', attitude: 'hostile', maxHp: 22, ataque +5 por 1d8+3).",
      },
    ],
  },
];
