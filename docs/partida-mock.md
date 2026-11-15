# Partida Mock: Las Brumas de Puerto Ceniza

Partida de ejemplo compatible con el modelo `GameState` (`version: 3`) definido en [`src/domain/types.ts`](../src/domain/types.ts).  
El archivo estructurado equivalente se encuentra en [`docs/partida-mock.json`](./partida-mock.json).

- **Cantidad de turnos:** 24 turnos (**48 mensajes** en total: 24 entradas del jugador/sistema + 24 narraciones del DM).
- **Tiradas:** las del jugador son mensajes de chat (él tira sus dados y escribe el total); la app solo tira por los enemigos, y en esta partida lo hace dos veces, durante el combate con el Vigía Ahogado (turnos 18 y 21).
- **Personaje:** Mateo Valen (Semielfo, Explorador, Nivel 2).
- **Memoria en tres capas:** incluye `summary` acumulado hasta el turno 10 (`summarizedThroughTurn: 10`), estado estructurado (`players`, `location`, `npcs`, `scene`, `quests`) y log completo de turnos.

---

## Registro de mensajes

### Turno 1
- **Sistema (`start`) — Mensaje 1:** Inicio de la aventura.
- **DM — Mensaje 2:** La lluvia fina golpea los postigos de El Ancla Oxidada mientras el viento trae olor a sal y madera podrida. Llevás dos horas en Puerto Ceniza y ya notaste lo mismo que murmuran los marineros: el faro lleva dos noches apagado y la niebla empieza a tragarse la bahía. Detrás del mostrador, una mujer de pelo canoso y delantal manchado de brea seca un jarro con gesto cansado. En el rincón, dos estibadores discuten en voz baja sobre un cargamento que no llegó. ¿Qué hacés?
  - *Eventos:* `scene_change`, `new_npc`

### Turno 2
- **Jugador — Mensaje 3:** Me acerco a la barra, pido un caldo caliente y le pregunto a la tabernera qué pasó con el farero.
- **DM — Mensaje 4:** La mujer te sirve un cuenco humeante de caldo de pescado y se apoya en la madera gastada. —Soy Mora —dice en voz baja, echando un vistazo rápido hacia los estibadores—. Don Anselmo no faltó ni una noche en treinta años. Hace dos días bajó al muelle viejo a discutir con unos tipos que descargaban cajones sin marca, y no volvió a subir al faro. Si pensás meterte, andá con cuidado: Braulio el Rengo anda rondando los galpones del sur. ¿Le pedís más detalles a Mora o salís directo para el muelle?
  - *Eventos:* `new_quest`

### Turno 3
- **Jugador — Mensaje 5:** Le agradezco, dejo una moneda sobre la barra y salgo hacia el muelle viejo tratando de seguir cualquier rastro reciente en el barro.
- **DM — Mensaje 6:** Salís a la calle empedrada, donde los charcos reflejan las pocas antorchas que resisten la llovizna. Al llegar al borde del muelle viejo, el barro oscuro está removido por pisadas pesadas y marcas de carros. La niebla no te deja ver más allá de diez metros, pero entre los tablones flojos distinguís un farol cubierto con tela oscura que parpadea cerca de un galpón. Necesitás leer bien las huellas sin delatar tu posición.
  - *Eventos:* `scene_change`

### Turno 4
- **Jugador — Mensaje 7:** Tiré d20 por "Supervivencia para rastrear las huellas en el barro": me dio 16 en total.
- **DM — Mensaje 8:** Te agachás junto a una bita oxidada y seguís sin dificultad el rastro de dos pares de botas claveteadas que arrastraron algo pesado hacia el galpón del fondo. Además, notás un detalle clave: hay gotas de cera roja junto a la puerta lateral, la misma que usa el faro para sus sellos. Desde adentro llega el crujido de madera y una voz ronca que maldice por lo bajo. ¿Espiás por la rendija o entrás de frente?

### Turno 5
- **Jugador — Mensaje 9:** Rodeo el galpón en silencio y miro por una rendija de los tablones para ver quién está adentro.
- **DM — Mensaje 10:** Te deslizás pegado a la pared húmeda hasta encontrar un tablón vencido. Adentro, un hombre bajo, de hombro caído y capa encerada, ata una soga alrededor de un cajón largo. Lleva un farol sordo en el cinto y una cachiporra al alcance de la mano: tiene que ser Braulio el Rengo. No parece haber nadie más con él, aunque la puerta trasera da directo al agua. ¿Lo sorprendés adentro o esperás a que salga?
  - *Eventos:* `new_npc`

### Turno 6
- **Jugador — Mensaje 11:** Empujo la puerta de golpe con el arco preparado y le exijo que levante las manos y me diga dónde está Don Anselmo.
- **DM — Mensaje 12:** La puerta cede con un estruendo seco. Braulio pega un respingo, suelta la soga y lleva la mano hacia la cachiporra del cinto mientras te mide con ojos nerviosos. —¡Pará, pará! —escupe, retrocediendo un paso contra el cajón—. Yo no maté a nadie, ¿eh? Solo hago mandados. Tenés la flecha tensa, así que todo depende de qué tan convincente suene tu advertencia.

### Turno 7
- **Jugador — Mensaje 13:** Tiré d20 por "Intimidación para que Braulio suelte el arma y hable": me dio 15 en total.
- **DM — Mensaje 14:** El silbido leve de la cuerda al tensarse basta para que Braulio levante las palmas y deje caer la cachiporra al suelo. —¡Está bien, bajá eso! —dice rápido—. Unos tipos de la Cofradía Salada me pagaron por mantener el faro apagado esta semana. Al viejo Anselmo lo encerraron en el sótano del faro, pero se llevaron la lente principal arriba. —Saca una llave pesada de su bolsillo y la tira a tus pies—. Tomá, es la copia del portón. Yo me borro de acá. ¿Lo dejás ir o lo atás antes de partir hacia el faro?
  - *Eventos:* `item_gained`, `new_quest`

### Turno 8
- **Jugador — Mensaje 15:** Agarro la llave de bronce y dejo que Braulio salga corriendo; prefiero no perder tiempo y voy directo al sendero del faro.
- **DM — Mensaje 16:** Guardás la llave de bronce en tu morral mientras Braulio desaparece entre la bruma del muelle como una sombra rengueante. Salís del puerto por el camino de piedra que trepa hacia el promontorio. El viento del mar acá arriba pega de costado y la lluvia se vuelve más fría. A mitad del ascenso, un derrumbe reciente cortó parte del sendero: queda apenas una cornisa estrecha de piedra mojada sobre las olas que rompen diez metros más abajo. ¿Cómo cruzás?
  - *Eventos:* `scene_change`

### Turno 9
- **Jugador — Mensaje 17:** Me ato la cuerda de cáñamo a la cintura por si acaso y trato de cruzar despacio pegado a la pared de roca.
- **DM — Mensaje 18:** Asegurás un extremo de la cuerda alrededor de un saliente firme y das el primer paso sobre la laja resbaladiza. Las ráfagas sacuden tu capa y el agua corre por la piedra como aceite. A mitad del tramo, una piedra suelta cede bajo tu bota derecha.

### Turno 10
- **Jugador — Mensaje 19:** Tiré d20 por "Atletismo para mantener el equilibrio en la cornisa mojada": me dio 8 en total.
- **DM — Mensaje 20:** Tu pie resbala de golpe y caés de costado contra la pared de roca antes de que la cuerda te frene el tirón. Te raspás el hombro y el brazo contra el granito filoso, perdiendo el aliento por un segundo, aunque la soga resiste y lográs trepar de vuelta al tramo firme del camino. Con el hombro dolorido, recuperás la cuerda y divisás por fin la silueta oscura del faro al final de la cuesta. ¿Seguís hasta el portón?
  - *Eventos:* `damage`

### Turno 11
- **Jugador — Mensaje 21:** Sí, me limpio la sangre del brazo, como una ración para recuperar fuerzas y uso la llave de bronce en el portón del faro.
- **DM — Mensaje 22:** Comés algo rápido mientras recuperás el aliento y encajás la llave de bronce en la cerradura oxidada. Con un chirrido pesado, el portón cede hacia adentro. El vestíbulo del faro huele a humedad y ozono; en el centro nace una escalera de caracol que sube hacia la oscuridad, y a un costado hay una trampilla cerrada con una tranca de madera desde afuera. Desde abajo llegan golpes débiles y una voz apagada pidiendo ayuda. ¿Abrís la trampilla primero?
  - *Eventos:* `scene_change`, `healing`

### Turno 12
- **Jugador — Mensaje 23:** Saco la tranca de madera y abro la trampilla llamando a Don Anselmo.
- **DM — Mensaje 24:** Al levantar la trampilla, un anciano de barba blanca y ropa empapada parpadea frente a la poca luz que entra por la puerta. Es Don Anselmo; tiene una pierna entablillada de forma precaria, pero está consciente. —¡Por fin alguien! —suspira aliviado mientras lo ayudás a sentarse en el primer escalón—. Esos malditos se llevaron el Corazón de Ámbar al piso de arriba, pero algo más despertó con la tormenta... algo frío que camina por la cámara de la lámpara. Tené cuidado ahí arriba. ¿Le dejás una antorcha o subís de inmediato?
  - *Eventos:* `new_npc`

### Turno 13
- **Jugador — Mensaje 25:** Lo dejo a resguardo en el vestíbulo con la puerta entornada y subo la escalera de caracol en silencio con el arco en mano.
- **DM — Mensaje 26:** Subís los escalones de piedra de dos en dos, evitando los tramos más flojos. A medida que te acercás a la cámara superior, la temperatura baja de golpe y un resplandor verdoso se filtra por el hueco de la escalera. Al asomar la cabeza, ves el pedestal de la gran lámpara vacío, y frente a los ventanales rotos flota una figura translúcida envuelta en algas y restos de un uniforme marino. Sostiene contra el pecho una esfera tallada de ámbar brillante. Todavía no te vio. ¿Disparás desde las escaleras?
  - *Eventos:* `scene_change`, `new_npc`

### Turno 14
- **Jugador — Mensaje 27:** Sí, apunto con calma al espectro y le suelto una flecha antes de que se dé vuelta.
- **DM — Mensaje 28:** Contenés la respiración, alineás la punta de la flecha con el centro de esa silueta verdosa y soltás la cuerda en medio de un trueno lejano.
  - *Eventos:* `combat_start`

### Turno 15
- **Jugador — Mensaje 29:** Tiré d20 por "Ataque con arco corto contra el Vigía Ahogado": me dio 18 en total.
- **DM — Mensaje 30:** La flecha cruza la sala como un rayo y atraviesa el pecho brumoso del Vigía Ahogado, haciéndolo girar con un alarido que suena a agua hirviendo. Aunque el hierro no lo destruye del todo, la sacudida lo obliga a retroceder un paso y casi se le resbala la esfera de ámbar. Furioso, extiende una garra helada hacia vos y se lanza por el aire entre los escombros. ¿Intentás esquivar su embestida o lo recibís con la daga?

### Turno 16
- **Jugador — Mensaje 31:** Me tiro a un costado rodando detrás del pedestal de piedra para esquivar su garra.
- **DM — Mensaje 32:** El espectro se abalanza sobre vos dejando una estela de escarcha en el aire; intentás arrojarte detrás de la base de la lámpara justo cuando su brazo espectral barre el espacio donde estabas.

### Turno 17
- **Jugador — Mensaje 33:** Tiré d20 por "Destreza para esquivar la garra helada del espectro": me dio 9 en total.
- **DM — Mensaje 34:** No llegás a cubrirte del todo: la garra del Vigía Ahogado te alcanza de lleno en el costado izquierdo antes de que termines de rodar.

### Turno 18
- **Sistema (`enemy_rolls`) — Mensaje 35:** Tirada del enemigo por "Daño de la garra helada del Vigía Ahogado": 1d6+1 → dados 4, total 5.
- **DM — Mensaje 36:** Un frío punzante te entumece las costillas y te deja sin aire por un instante. Caés contra el pedestal, pero notás que el espectro quedó muy cerca del ventanal roto, con el Corazón de Ámbar apenas sostenido entre sus dedos translúcidos. ¿Aprovechás la distancia corta para atacar o arrebatás la esfera?
  - *Eventos:* `damage`

### Turno 19
- **Jugador — Mensaje 37:** Desenvaino la daga de hierro y le tiro un tajo directo a la mano que sostiene el Corazón de Ámbar para arrebatárselo.
- **DM — Mensaje 38:** Te incorporás de un salto apretando los dientes por el frío en el costado y lanzás un tajo ascendente con tu daga hacia las manos del Vigía Ahogado.

### Turno 20
- **Jugador — Mensaje 39:** Tiré d20 por "Ataque cuerpo a cuerpo para cortar el agarre del espectro": me dio 17 en total.
- **DM — Mensaje 40:** El filo de hierro frío corta la niebla de su brazo con un chispazo azulado. El Vigía Ahogado suelta un gemido ahogado y su agarre sobre la esfera de ámbar vacila.

### Turno 21
- **Sistema (`enemy_rolls`) — Mensaje 41:** Tirada del enemigo por "Resistencia del Vigía Ahogado para no soltar el Corazón de Ámbar": 1d20+2 → dados 6, total 8.
- **DM — Mensaje 42:** Los dedos translúcidos se abren sin fuerza y la esfera de ámbar rueda por el suelo de piedra hasta chocar contra tu bota. Sin su foco, el espectro se deshilacha en jirones de bruma salada que el viento arrastra afuera por el ventanal roto. El silencio vuelve a la torre, roto solo por la lluvia. ¿Recogés el Corazón de Ámbar?
  - *Eventos:* `combat_end`

### Turno 22
- **Jugador — Mensaje 43:** Agarro el Corazón de Ámbar y lo coloco en el pedestal de la gran lámpara para ver si vuelve a encenderse.
- **DM — Mensaje 44:** Al apoyar la esfera en los encastres de bronce del pedestal, el ámbar responde de inmediato al calor de tus manos y emite un pulso dorado que enciende la mecha de aceite del faro. Un haz cálido atraviesa la niebla hacia la bahía, ahuyentando la oscuridad de la costa. Desde abajo se escucha el grito de júbilo de Don Anselmo, aunque al mirar el pedestal notás una inscripción grabada hace poco en el metal: una ola partida, el símbolo de la Cofradía Salada, apuntando hacia los astilleros del sur. ¿Bajás a asistir a Don Anselmo o examinás mejor la marca?
  - *Eventos:* `item_gained`, `quest_completed`

### Turno 23
- **Jugador — Mensaje 45:** Memorizo el símbolo de la ola partida y bajo a ayudar a Don Anselmo antes de volver al pueblo.
- **DM — Mensaje 46:** Grabás en tu memoria el trazo de la ola partida y bajás con cuidado la escalera de caracol. Don Anselmo te recibe con lágrimas en los ojos y te estrecha la mano con fuerza, prometiendo que todo Puerto Ceniza sabrá lo que hiciste esta noche. Mientras lo ayudás a acomodarse junto al fogón del vestíbulo para esperar el alba, afuera suena la campana de un barco que al fin encontró el canal seguro gracias a la luz del faro. ¿Pasás la noche en el faro o regresás a El Ancla Oxidada a hablar con Mora?

### Turno 24
- **Jugador — Mensaje 47:** Me quedo un rato más junto al fuego revisando mis flechas y decido que apenas aclare voy a buscar los astilleros del sur.
- **DM — Mensaje 48:** Acomodas tus quince flechas restantes en el carcaj y te sentás cerca del fogón mientras la tormenta empieza a amainar sobre el acantilado. Don Anselmo cabecea tranquilo por primera vez en dos días, y la luz del faro gira constante sobre el mar oscuro. Mañana tocará seguir el rastro de la Cofradía Salada en los astilleros del sur, donde alguien pagó demasiado caro por hundir un barco en la niebla. Cuando estés listo para encarar el amanecer, decime qué hacés.
