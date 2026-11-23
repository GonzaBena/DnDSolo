import type { OfficialCampaign } from "../types";

export const mascarasCasaCeniza: OfficialCampaign = {
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
};
