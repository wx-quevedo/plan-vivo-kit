# Pendientes del kit

Fallos y mejoras del kit encontrados desde cualquier proyecto (decisión K4). Un agente de otro proyecto no arregla el kit ahí: agrega una entrada al final de este archivo y sigue con su trabajo. La sesión dueña del kit las revisa, las resuelve aquí y mueve la entrada a «Resueltos» con el commit.

Formato fijo de cada entrada:

```markdown
### AAAA-MM-DD · <título corto>

- **Proyecto de origen:** <nombre y ruta del repositorio donde apareció>
- **Qué pasa:** <comportamiento actual y por qué está mal>
- **Cómo reproducirlo:** <comando, plan.json o pasos mínimos>
- **Prioridad:** alta | media | baja
```

Prioridad: **alta** si da datos falsos o impide usar el kit; **media** si molesta pero tiene un rodeo; **baja** si es una mejora.

## Abiertos

### 2026-10-12 · Marcas del eje corridas una hora con cambio de horario de verano

- **Proyecto de origen:** plan-vivo (`<kit path>`), revisión del propio kit.
- **Qué pasa:** en la línea de tiempo, si un cambio de horario de verano cae dentro del rango que se muestra, las marcas del eje posteriores al cambio quedan corridas una hora: en lugar de caer en horas redondas (00:00, 06:00, 12:00) caen en 01:00, 07:00, 13:00, o una hora antes según el sentido del cambio. Causa: `timeTicks` (`visor/src/lib/format.ts`) calcula el desfase de la zona una sola vez, en el inicio del rango, y avanza con un paso fijo. Los tramos y las horas de la consola están bien, porque se convierten instante por instante (`visor/src/lib/zona.ts`). Con America/Guayaquil (la zona por defecto) no pasa, porque no tiene horario de verano.
- **Cómo reproducirlo:** un plan con `zonaHoraria` `America/New_York` (o `--zona America/New_York`) y tramos entre el 2026-10-31 y el 2026-11-02, que cruzan el cambio del 1 de noviembre. Abrir el visor y comparar las marcas del eje posteriores al cambio con las horas de los tramos en la consola.
- **Prioridad:** media.

### 2026-10-12 · Al abrir una fase con su primer item, se pierde el estimado del resto de la fase

- **Proyecto de origen:** otro-proyecto (`<project path>`), F3 · P9.
- **Qué pasa:** F3 tenía `estimate_min: [180, 240]`, el de las alertas, que todavía no tienen prompts. Al agregar P9 (`[30, 50]`), `phaseEstimate` usa solo la suma de los items y descarta el estimado propio de la fase. La tarjeta muestra «Estimado 30 min – 50 min» y la proyección deja de contar las 3 a 4 h de alertas, así que el cierre aproximado se adelanta. AGENTES.md lo documenta («el estimate_min de la fase deja de usarse»), pero el resultado subestima cualquier fase que se abre con un solo prompt. Mejora posible: si la fase tiene `estimate_min` e items, tomar el mayor de los dos, o tratar el de la fase como el total y proyectar la diferencia como «sin items todavía».
- **Cómo reproducirlo:** una fase con `"estimate_min": [180, 240]` y un solo item pendiente con `"estimate_min": [30, 50]`; correr `pnpm visor -- --plan <plan>`: la tarjeta dice «Estimado 30 min – 50 min».
- **Prioridad:** media.

### 2026-10-12 · Cada item cerrado cambia en la corrida siguiente de tiempos

- **Proyecto de origen:** otro-proyecto (`<project path>`), F3 · P9 y P10.
- **Qué pasa:** el cierre de un prompt corre `tiempos --aplicar` antes del commit final y del mensaje de cierre. En la corrida siguiente, ese trabajo posterior alarga el último tramo del item ya cerrado y le suma el commit final, que según las reglas de los proyectos no debería contarse como evidencia. Pasó con G2 (+31 s, commit bdc768a) y con P9 (+92 s, commit 156552f). Cada prompt nuevo encuentra entonces un item cerrado «distinto», y la regla «los cerrados no deben cambiar» deja de servir como control. Mejoras posibles: que `--aplicar` registre en el plan hasta dónde se cargó cada item y no lo extienda después, o que la tabla marque aparte el cambio que es solo la cola del cierre.
- **Cómo reproducirlo:** cerrar un item con `tiempos --aplicar`, hacer el commit final y escribir el mensaje de cierre. En el prompt siguiente, `tiempos` sin `--aplicar` muestra ese item como «distinto», con el fin más tarde y el commit final.
- **Prioridad:** baja.
### 2026-10-12 · Leer la carpeta de sesiones de otro proyecto mezcla sus identificadores

- **Proyecto de origen:** plan-vivo (`<kit path>`), F1 · P2 y P3.
- **Qué pasa:** con `--sesiones` repetido se puede sumar la carpeta de otro proyecto (el kit lo necesitó porque F0 quedó en la de otro proyecto). Pero todos los mensajes de esa carpeta entran: los que traen un id que también existe en este plan («F1 · P2:», «F1 · P3:» del otro proyecto) abren ese item, y los que siguen sin identificador caen en él. Hoy se rodea con `null` en `asignaciones.mensajes`, mensaje por mensaje, o dejando de leer esa carpeta.
- **Cómo reproducirlo:** en el kit, `pnpm tiempos --plan plan.json --sesiones <carpeta del otro proyecto> --sesiones <carpeta del kit>`: el P3 del kit recibe decenas de tramos del 11 oct.
- **Prioridad:** baja. Mejora posible: acotar cada carpeta por fechas (por ejemplo `--sesiones <carpeta>@<desde>..<hasta>`), o leer de una carpeta ajena solo los mensajes que asigna `asignaciones.json`.
### 2026-10-12 · tiempos no busca las sesiones en otra configuración de Claude Code (CLAUDE_CONFIG_DIR)

- **Proyecto de origen:** plan-vivo (`<kit path>`), revisión de un prompt para orquestadores.
- **Qué pasa:** sin `--sesiones`, tiempos busca la carpeta del proyecto solo en `~/.claude/projects/`. Algunos proyectos se trabajan con otra cuenta (una cuenta corporativa), con otra configuración de Claude Code (`CLAUDE_CONFIG_DIR`), y sus sesiones quedan en `<CLAUDE_CONFIG_DIR>\projects\`. Ahí tiempos no las encuentra, y hay que pasarlas a mano con `--sesiones`.
- **Cómo reproducirlo:** en un proyecto trabajado con `CLAUDE_CONFIG_DIR` apuntando a otra carpeta, correr `pnpm tiempos -- --plan <plan>` sin `--sesiones`: falla con «No encontré la carpeta de sesiones».
- **Prioridad:** media. Mejora posible: si `CLAUDE_CONFIG_DIR` está definida, buscar primero en `<CLAUDE_CONFIG_DIR>\projects\`, y si no aparece ahí, en `~/.claude/projects/`; o buscar en ambas y avisar qué carpeta usó.

### 2026-10-12 · Un subagente lanzado después de un mensaje en null cae en el item anterior

- **Proyecto de origen:** visualizador-agentes (`<project path>`), F4 · U3.
- **Qué pasa:** `asignaciones.mensajes` con `null` cierra el item abierto, pero los subagentes no lo respetan: en `tiempos/src/tramos.ts` (línea 150) el item de un subagente se busca con `[...turnos].reverse().find((t) => t.at <= run.start && t.item !== null)`, que salta los turnos en null y toma el último item no nulo. Dos subagentes de una tarea ajena (excluida con null) quedaron como tramos de P39, hechos 11 h antes. Da datos falsos. Rodeo: `"subagentes": { "<id>": [] }` en `asignaciones.json`, que los deja sin asignar. Arreglo posible: tomar el último turno anterior al lanzamiento sin filtrar los null (si es null, el subagente no tiene item).
- **Cómo reproducirlo:** una sesión con un mensaje de P1, después un mensaje con `null` en `asignaciones.mensajes` y, tras ese mensaje, un subagente. `pnpm tiempos -- --plan <plan>` muestra el subagente como tramo de P1.
- **Prioridad:** alta.

### 2026-10-12 · El $schema relativo no sirve si el proyecto está en otra unidad

- **Proyecto de origen:** visualizador-agentes (`<project path>`), F4 · U3.
- **Qué pasa:** AGENTES.md pide `$schema` relativo a `plan.json` (`../plan-vivo/schema/plan.schema.json`), pero con el proyecto y el kit en unidades distintas no hay ruta relativa posible. Se usó una URL `file:///` absoluta al esquema del kit (por ejemplo `file:///C:/path/to/plan-vivo/schema/plan.schema.json`), que el esquema acepta (es un texto libre). AGENTES.md podría decirlo.
- **Cómo reproducirlo:** crear `plan.json` en un proyecto que esté en una unidad distinta de la del kit.
- **Prioridad:** baja.

### 2026-10-12 · Los commits de otra máquina que trabaja en paralelo se toman como evidencia del item abierto

- **Proyecto de origen:** visualizador-agentes (`<project path>`), F4 · U3.
- **Qué pasa:** la evidencia de commits va por hora: un commit hecho en la Mac (P40) mientras la Alienware trabajaba en P41 aparece en el tramo de P41 (`76f10f8`, `e8c8f59`). En un proyecto con dos máquinas o dos agentes en paralelo, la columna de commits mezcla trabajos. Mejora posible: una excepción `commits` en `asignaciones.json` (hash → item, o null para no contarlo), o leer el identificador del item en el mensaje del commit.
- **Cómo reproducirlo:** dos sesiones en máquinas distintas con commits intercalados al mismo repositorio; correr tiempos solo con las sesiones de una.
- **Prioridad:** baja.

### 2026-10-13 · El identificador ignora la fase y los ids de item chocan entre fases

- **Proyecto de origen:** SkyNest (`<project path>`), F7B · U2.
- **Qué pasa:** el plan de SkyNest numera los items por fase (F6C · P1, F6D · P1, CONT · G1…), pero el esquema exige ids únicos en todo el plan y `tiempos` toma solo el grupo del item ("P1") de "F6C · P1:". Además, la expresión por defecto exige un número en la fase, así que ART, TRIO o CONT no se reconocen. Rodeo en SkyNest: el id de cada item es el identificador completo ("F7B · U2") y `tiempos` se corre con `--identificador '\b([A-Z][A-Z0-9]* \u00b7 [A-Za-z]+\d+[a-z]?)\s*:'`. Mejora posible: resolver el identificador por fase más item (buscar el item dentro de la fase indicada) y aceptar fases sin número.
- **Cómo reproducirlo:** un plan con dos fases que tengan un item P1 cada una; `pnpm validar` da `duplicate_id`. Con ids distintos, un prompt "TRIO · P2:" queda sin asignar con la expresión por defecto.
- **Prioridad:** alta.

### 2026-10-13 · El punto medio del --identificador llega corrupto desde Git Bash en Windows

- **Proyecto de origen:** SkyNest (`<project path>`), F7B · U2.
- **Qué pasa:** `pnpm --dir <kit> tiempos -- --identificador '...· ...'` desde Git Bash en Windows no reconoce ningún identificador: el carácter "·" llega cambiado al proceso de Node (página de códigos). Con `\u00b7` en su lugar funciona. AGENTES.md podría recomendar escribirlo así, o el kit podría normalizar la opción.
- **Cómo reproducirlo:** en Git Bash, correr tiempos con `--identificador '\b[A-Z]+\d+ · ([A-Za-z]+\d+)\s*:'` sobre una sesión con "F1 · P1:": el mensaje sale "sin identificador".
- **Prioridad:** media.

### 2026-10-13 · Un subagente reanudado se cuenta como un solo tramo y se copia entero a cada item

- **Proyecto de origen:** SkyNest (`<project path>`), F7B · U2.
- **Qué pasa:** un subagente que se reanuda con SendMessage en varios prompts (`agent-ad881dedc45fa9392.jsonl`, de 13:21 a 21:17 con largas pausas) sale como un tramo continuo de 8 h. Con `"subagentes": { "<id>": ["P1", "P3", "P4", "P5"] }` el tramo completo se copia en los cuatro items, en vez de repartir cada tramo de actividad al item abierto en ese momento. Rodeo en SkyNest: `"<id>": []` (sin item). Mejora posible: partir los subagentes por huecos de inactividad (o por cada reanudación) y asignar cada parte al item abierto.
- **Cómo reproducirlo:** reanudar un mismo subagente en dos prompts separados por horas y correr tiempos.
- **Prioridad:** media.

## Resueltos

### 2026-10-12 · El identificador del prompt no se reconoce si el entorno antepone un bloque al mensaje

- **Proyecto de origen:** lanzamiento-remitex (`<project path>`), F1 · P1.
- **Qué pasa:** la extensión de VS Code con Claude in Chrome guarda el mensaje de la persona con un bloque `<browser_instruction>...</browser_instruction>` delante del texto. `tiempos` toma la primera línea, que es ese bloque, y no ve "F1 · P1:", así que el mensaje queda "sin asignar (sin identificador y sin item abierto)". Se resolvió en el proyecto con una entrada en `asignaciones.json`. Mejora posible: antes de buscar el identificador, saltar bloques de etiquetas del entorno (`<browser_instruction>`, `<system-reminder>`, `<ide_selection>` y similares) y líneas vacías.
- **Cómo reproducirlo:** en una sesión de la extensión de VS Code con Claude in Chrome activo, enviar un prompt que empiece con "F1 · P1: ..." y correr `pnpm tiempos -- --plan <plan>`: aparece en "Sin asignar" con el texto `"<browser_instruction># Claude in Chrome browser au"`.
- **Prioridad:** media.
- **Resuelto:** 2026-10-12 en el kit, F1 · P4 (commit 124c4df). tiempos salta los bloques del entorno y quita la etiqueta de `<pasted_content>`. La entrada de `asignaciones.json` de lanzamiento-remitex ya no hace falta, pero no estorba.

