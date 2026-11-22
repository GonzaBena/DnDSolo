// Spanish because it is prompt content. Compact on purpose: it is sent on
// every turn while state.scene.inCombat is true.
/** SRD 5.2 (2024 rules) combat rules the DM needs to run a fight. */
export const COMBAT_RULES = `Reglas de combate del SRD 5.2 (reglas 2024). Usalas mientras dure el combate.

INICIATIVA Y TURNOS
- Al empezar el combate, cada participante tira iniciativa: 1d20 + modificador de Destreza (el jugador la tira él mismo; los enemigos, en "enemyRolls"). Se actúa de mayor a menor y el orden se mantiene toda la pelea.
- En su turno cada criatura tiene: movimiento hasta su velocidad (se puede repartir antes y después de la acción), una acción, como mucho una acción adicional si algún rasgo o conjuro se la da, y una reacción por ronda (se recupera al empezar su turno).
- Acciones comunes: Atacar, Lanzar un conjuro, Correr (Dash: movimiento extra igual a su velocidad), Destrabarse (Disengage: no provoca ataques de oportunidad), Esquivar (Dodge: los ataques contra ella tienen desventaja y tiene ventaja en salvaciones de Destreza), Ayudar, Esconderse, Preparar (Ready), Buscar, Usar un objeto.
- Ataque de oportunidad: cuando una criatura hostil sale del alcance de otra, esta puede usar su reacción para hacerle un ataque cuerpo a cuerpo.

ATAQUES DEL JUGADOR (en dos pasos, siempre en este orden)
1. Tirada de ataque: pedile 1d20 con "difficulty" igual a la Clase de Armadura (CA) del objetivo, no a la escala de CD. Él suma su bonificador de ataque. En la narración no le digas la CA: pedile la tirada "para impactar".
2. Si el total iguala o supera la CA, impacta: en ese mismo turno no narres el golpe todavía; pedile la tirada de daño en "playerRoll" con el dado de su arma o conjuro (por ejemplo 1d8 para una espada larga), "difficulty": null, y aclarale en la narración que sume el modificador que corresponda. Recién con ese total narrás el daño y restale los puntos de golpe al enemigo.
- Si falla, narrá el fallo y seguí con el turno siguiente. No pidas daño.
- 20 natural en el d20 de ataque: impacta siempre y es crítico; pedile el doble de dados de daño (count × 2), el modificador se suma una sola vez. 1 natural: falla siempre.
- Conjuros con tirada de ataque funcionan igual. Conjuros con salvación: el objetivo enemigo tira la salvación en "enemyRolls" contra la CD de conjuros del jugador ("spellSaveDc" de "stats"; preguntásela solo si "stats" es null); si falla, pedile al jugador el daño.

ATAQUES DE ENEMIGOS
- Pedí en "enemyRolls" el 1d20 + bonificador de ataque del enemigo y, en el mismo pedido, su daño. Compará el ataque con la CA de "stats" del jugador (preguntásela si "stats" es null) y solo aplicá el daño si impacta, con un cambio "hp". Con 20 natural, crítico: en el turno siguiente pedí los dados de daño extra.
- Decí el daño exacto en la narración; si "stats" es null, el jugador lo anota en su hoja.

CA DE LOS ENEMIGOS
- Elegí la CA según lo que es la criatura y su equipo, no un valor fijo: sin armadura 10 a 12, cuero o pelaje grueso 12 a 13, cota de malla o escudo 14 a 16, armadura pesada 17 a 18, criaturas excepcionales 19 o más. Por ejemplo, goblin 15, lobo 12, esqueleto 13, orco 13, ogro 11, bandido 12.
- Una vez elegida, la CA de un enemigo no cambia en todo el combate salvo que algo la modifique (perder el escudo, un conjuro).
- Llevá la cuenta de los puntos de golpe de cada enemigo con lo que vayan recibiendo: goblin unos 10, lobo 11, bandido 11, orco 15, ogro 59.

VENTAJA Y DESVENTAJA
- Con ventaja se tiran 2d20 y se usa el mayor; con desventaja, el menor. Si hay de las dos, se cancelan. Para el jugador, pedile la tirada con "mode": "advantage" (o "disadvantage") y "count": 1: el sistema le hace tirar dos d20 y elige el dado.
- Dan ventaja: atacar a una criatura que no te ve, derribada (cuerpo a cuerpo y a 1,5 m), aturdida, paralizada, inconsciente o apresada. Dan desventaja: atacar a distancia con un enemigo a 1,5 m, atacar a una criatura derribada desde más de 1,5 m, atacar estando envenenado, asustado o derribado, o a un objetivo que no ves.

COBERTURA
- Media cobertura: +2 a la CA y a las salvaciones de Destreza. Tres cuartos: +5. Total: no se lo puede apuntar directamente.

PUNTOS DE GOLPE A 0
- Un enemigo a 0 puntos de golpe muere o queda fuera de combate, como tenga sentido en la historia.
- El jugador a 0 cae inconsciente y, al empezar cada uno de sus turnos, tira una salvación contra la muerte: 1d20 con CD 10 sin modificadores. Tres éxitos: se estabiliza. Tres fallos: muere. 1 natural cuenta como dos fallos; 20 natural lo despierta con 1 punto de golpe. Recibir daño estando a 0 es un fallo (un crítico, dos). Cualquier curación lo levanta.

TERMINAR EL COMBATE
- Cuando no quedan enemigos en pie o la pelea termina (huyen, se rinden), mandá el cambio "scene" con "inCombat": false.`;
