// Spanish because it is prompt content. Compact on purpose: it is sent on
// every turn while state.scene.inCombat is true.
/** SRD 5.2 (2024 rules) combat rules the DM needs to run a fight. */
export const COMBAT_RULES = `Reglas de combate del SRD 5.2 (reglas 2024). Usalas mientras dure el combate.

INICIATIVA Y TURNOS
- Al empezar el combate, cada participante tira iniciativa: 1d20 + modificador de Destreza (el jugador la tira él mismo; los enemigos, en "enemyRolls"). Se actúa de mayor a menor y el orden se mantiene toda la pelea.
- En su turno cada criatura tiene: movimiento hasta su velocidad (se puede repartir antes y después de la acción), una acción, como mucho una acción adicional si algún rasgo o conjuro se la da, y una reacción por ronda (se recupera al empezar su turno).
- Acciones comunes: Atacar, Lanzar un conjuro, Correr (Dash: movimiento extra igual a su velocidad), Destrabarse (Disengage: no provoca ataques de oportunidad), Esquivar (Dodge: los ataques contra ella tienen desventaja y tiene ventaja en salvaciones de Destreza), Ayudar, Esconderse, Preparar (Ready), Buscar, Usar un objeto.
- Ataque de oportunidad: cuando una criatura hostil sale del alcance de otra, esta puede usar su reacción para hacerle un ataque cuerpo a cuerpo.

ATAQUES DEL JUGADOR (en un paso si sabés el daño, o en dos si no)
1. Tirada de ataque: pedile 1d20 con "difficulty" igual a la Clase de Armadura (CA) del objetivo, no a la escala de CD. Él suma su bonificador de ataque. En la narración no le digas la CA: pedile la tirada "para impactar".
   - MODO ÁGIL (preferido cuando conocés el arma o conjuro por "stats.attacks" o equipo): completá también "playerRoll.damage" (die, count, reason) para que el jugador pueda tirar ataque y daño juntos en el mismo turno. Si en el turno siguiente llegan ataque y daño juntos: si iguala o supera la CA, narrá el golpe y aplicá ese daño al enemigo con "hp"; si falla, ignorá el daño y narrá el fallo.
2. Si el jugador mandó solo el ataque (o no completaste "damage"): si impacta, en ese mismo turno no narres el golpe todavía; pedile la tirada de daño en "playerRoll" con el dado de su arma o conjuro (por ejemplo 1d8 para una espada larga), "difficulty": null, y aclarale en la narración que sume el modificador que corresponda. Recién con ese total narrás el daño y se lo restás al enemigo con un cambio "hp".
- Si falla, narrá el fallo y seguí con el turno siguiente. No pidas daño.
- 20 natural en el d20 de ataque: impacta siempre y es crítico (el doble de dados de daño, el modificador se suma una sola vez). Si ya vino un daño base junto al 20 natural, pedile los dados de daño extra del crítico en "playerRoll" antes de cerrar el daño; si no había daño todavía, pedile directamente el doble de dados (count × 2). 1 natural: falla siempre.
- Conjuros con tirada de ataque funcionan igual. Conjuros con salvación: el objetivo enemigo tira la salvación en "enemyRolls" contra la CD de conjuros del jugador ("spellSaveDc" de "stats"; si es null, no la tenés: preguntásela); si falla, pedile al jugador el daño.

ATAQUES DE ENEMIGOS
- Pedí en "enemyRolls" el 1d20 + bonificador de ataque del enemigo y, en el mismo pedido, su daño. Compará el ataque con la CA de "stats" del jugador (preguntásela si "stats" es null) y solo aplicá el daño si impacta, con un cambio "hp". Con 20 natural, crítico: en el turno siguiente pedí los dados de daño extra.
- Decí el daño exacto en la narración; si "stats" es null, el jugador lo anota en su hoja.

CA DE LOS ENEMIGOS
- Elegí la CA según lo que es la criatura y su equipo, no un valor fijo: sin armadura 10 a 12, cuero o pelaje grueso 12 a 13, cota de malla o escudo 14 a 16, armadura pesada 17 a 18, criaturas excepcionales 19 o más. Por ejemplo, goblin 15, lobo 12, esqueleto 13, orco 13, ogro 11, bandido 12.
- Una vez elegida, la CA de un enemigo no cambia en todo el combate salvo que algo la modifique (perder el escudo, un conjuro).
- Al aparecer un enemigo, fijá su "maxHp" en el cambio "npc" (goblin unos 10, lobo 11, bandido 11, orco 15, ogro 59). El daño que recibe va con "hp" y su nombre en "target"; ya no hace falta que lleves la cuenta: su "hp" está en ESTADO. A 0 cae: decidí si muere, queda inconsciente o huye.

VENTAJA Y DESVENTAJA
- Con ventaja se tiran 2d20 y se usa el mayor; con desventaja, el menor. Si hay de las dos, se cancelan. Para el jugador, pedile la tirada con "mode": "advantage" (o "disadvantage") y "count": 1: el sistema le hace tirar dos d20 y elige el dado.
- Dan ventaja: atacar a una criatura que no te ve, derribada (cuerpo a cuerpo y a 1,5 m), aturdida, paralizada, inconsciente o apresada. Dan desventaja: atacar a distancia con un enemigo a 1,5 m, atacar a una criatura derribada desde más de 1,5 m, atacar estando envenenado, asustado o derribado, o a un objetivo que no ves.

COBERTURA
- Media cobertura: +2 a la CA y a las salvaciones de Destreza. Tres cuartos: +5. Total: no se lo puede apuntar directamente.

PUNTOS DE GOLPE A 0
- Un enemigo a 0 puntos de golpe muere o queda fuera de combate, como tenga sentido en la historia.
- El jugador a 0 cae inconsciente. Cuando el jugador está "dying", el sistema le pide la salvación en su turno y te manda el resultado; no la pidas vos en "playerRoll" ni cambies sus contadores. Recibir daño estando a 0 ya cuenta como un fallo, y un crítico, dos (lo aplica el sistema con el cambio "hp"; marcá el crítico con "critical": true). Cualquier curación lo levanta.

TERMINAR EL COMBATE
- Cuando no quedan enemigos en pie o la pelea termina (huyen, se rinden), mandá el cambio "scene" con "inCombat": false.`;
