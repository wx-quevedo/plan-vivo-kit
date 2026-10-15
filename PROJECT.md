# PROJECT.md: kit plan vivo

## 1. Contexto

El kit plan vivo es un formato de plan de proyecto en un solo archivo, `plan.json`, más las herramientas para mantenerlo y verlo:

- **esquema:** `schema/plan.schema.json` (JSON Schema) y su gemelo en zod, `visor/src/plan/schema.ts`;
- **visor:** app React + Vite, solo `localhost`, tema claro, ES y EN, se recarga al guardar el plan (`pnpm visor`, puerto 5190);
- **tiempos:** arma el `work_log` de cada item a partir de las sesiones de Claude Code y de git (`pnpm tiempos`);
- **validar** y **migrar:** `pnpm validar` y `pnpm migrar`.

Nació dentro de otro proyecto (decisiones D20, D22 y D37 de su PROJECT.md), que en este archivo se llama «el proyecto de origen». El agente de ese proyecto lo separó como kit en este repositorio (commits f398153, b9aef66 y 5b486ce). Desde el 2026-10-12, la sesión de este repositorio es la dueña del kit: lo mantiene y lo mejora. Reglas de trabajo en `CLAUDE.md`; instrucciones para los agentes que usan el kit en `AGENTES.md`.

## 2. Decisiones

Aprobadas por Washington el 2026-10-12.

- **K1** Una sola instalación. El kit vive solo en `<kit path>`. Cada proyecto guarda únicamente su `plan.json` (y, si hace falta, su `asignaciones.json`). Visor, tiempos, validar y migrar se corren desde el kit apuntando al plan del proyecto con `--plan`. Nunca se copia el kit a otro repositorio.
  - **Por qué:** con una copia por proyecto, cada arreglo había que repetirlo en todas las copias, y las copias se separaban (el proyecto de origen ya tenía un visor y un script de tiempos distintos de los del kit). Con una sola instalación, una mejora llega a todos los proyectos a la vez.
  - **Consecuencias:** los comandos aceptan `--plan`, `--sesiones` (repetible) y `--asignaciones`, y funcionan desde otra carpeta con `pnpm --dir <kit path> <comando> -- <argumentos>`. Prioridad: argumento, luego variable de entorno, luego `plan-vivo.config.json`, luego valor por defecto.
- **K2** La skill «plan vivo» será corta: cuándo usarla, dónde está el kit y los comandos. Para el detalle remite a `AGENTES.md`, que es la fuente de verdad. La escribe y la guarda Washington desde claude.ai; no va en este repositorio.
  - **Por qué:** si el detalle estuviera en la skill y en `AGENTES.md`, habría dos textos que mantener iguales. Con la skill corta, un cambio del kit solo toca `AGENTES.md`.
- **K3** Cada `plan.json` lleva la versión del esquema (`schema_version`, entero; la actual es 1). Si una mejora cambia el formato, el kit trae una migración (`pnpm migrar`).
  - **Por qué:** con una sola instalación (K1), un cambio de formato afecta a los planes de todos los proyectos a la vez. La versión dice qué formato tiene cada plan, y la migración lo pone al día sin editarlo a mano.
  - **Cómo:** las migraciones están en `visor/src/plan/migraciones.ts`, una por versión. `pnpm migrar` solo muestra los cambios; con `--aplicar` valida, escribe y deja una copia `.bak`. Correrla dos veces no cambia nada.
- **K4** Si un agente de otro proyecto encuentra un fallo o una mejora del kit, no lo arregla ahí: lo anota en `<kit path>\PENDIENTES.md`.
  - **Por qué:** un arreglo hecho en otro repositorio se pierde o rompe la instalación única (K1). Anotado en un solo lugar, con un formato fijo, la sesión dueña lo resuelve y lo prueba aquí.
  - **Cómo:** la regla está en `AGENTES.md` (sección 9) y en el bloque de `snippet-claude.md`, que va en el `CLAUDE.md` de cada proyecto.
- **K5** El kit está en un repositorio privado en GitHub, https://github.com/wx-quevedo/plan-vivo, para usarlo también en la Mac. Adelantada por Washington el 2026-10-13, cuando el proyecto rayneo-power, que vive en la MacBook, necesitó el kit.
  - **Por qué:** el agente de un proyecto en la Mac no ve esta PC: no puede leer `AGENTES.md` ni correr validar, tiempos o el visor, y sus sesiones de Claude Code están en la Mac. Con el repositorio, cada máquina tiene su copia del kit y corre tiempos con sus propias sesiones.
  - **Consecuencias:** K1 pasa a ser «una sola instalación por máquina»: en Windows, `<kit path>` (por ejemplo `C:\path\to\plan-vivo`); en la Mac, `~/plan-vivo`, clonado del repositorio. La copia de la Mac solo se actualiza con `git pull`; el kit se cambia solo desde la sesión dueña, en Windows. `git push` solo a ese repositorio y cuando Washington lo pida (ver `CLAUDE.md`).
- **K6** `schema_version` reemplaza al campo `schema` que tenían los planes de F0 (`"schema": 1`). La migración a la versión 1 agrega `schema_version` después de `$schema` y quita `schema`. Propuesta por esta sesión en F1 · P2, al aplicar K3, y aprobada por Washington el 2026-10-12.
  - **Por qué:** el encargo pedía un campo `schema_version`, y dos campos con la misma versión podían contradecirse. El esquema sigue aceptando `schema` y la falta de `schema_version`, para que un plan sin migrar (por ejemplo el del proyecto de origen) se siga viendo en el visor; `pnpm validar` avisa.
- **K7** En `asignaciones.json`, `null` como valor de un mensaje lo excluye: no abre ningún item y cierra el que estaba abierto. Propuesta por esta sesión en F1 · P2 y aprobada por Washington el 2026-10-12.
  - **Por qué:** con `--sesiones` repetido se puede leer la carpeta de sesiones de otro proyecto (las de F0 quedaron en la del proyecto de origen). Sus mensajes traen identificadores propios que pueden existir también en este plan, como su «F1 · P2:», y sin forma de excluirlos el script les asignaba tramos falsos.

- **K8** Un solo visor, en 5190, sirve los planes de todos los proyectos. Cada plan tiene su dirección (`?plan=<carpeta del proyecto>`) y se recarga por separado. Si el visor ya está abierto, `pnpm visor --plan <ruta>` le suma el plan y termina, sin levantar otro servidor. Al levantarlo, `--plan` se puede repetir y `plan-vivo.config.json` acepta una lista `planes`. Propuesta por esta sesión y aprobada por Washington el 2026-10-12 (F1 · P3).
  - **Por qué:** con un visor por plan, cada proyecto necesitaba su propio puerto, y solo 5190 queda libre para uso diario (5191 y 5192 son de las pruebas). Así los agentes solo suman su plan y Washington deja un único visor abierto.
  - **Skill:** no cambia. El comando que da la skill (`pnpm --dir … visor -- --plan <proyecto>`, en 5190) sigue valiendo: ahora, con el visor abierto, suma el plan en lugar de fallar.
  - **Seguridad:** sigue solo en localhost. Para sumar un plan se exige la cabecera `X-Plan-Vivo: 1` (una página de otro origen no puede mandarla sin una consulta previa de CORS que el servidor no aprueba) y una ruta absoluta a un `.json` que exista.
  - **Límite:** la lista vive en memoria; al cerrar el visor se pierden los planes sumados después. Para abrir siempre los mismos, la lista `planes` del archivo.

## 3. Bitácora

- 2026-10-12 — **F0 · P1, kit inicial** (commits f398153, b9aef66 y 5b486ce). El agente del proyecto de origen exportó el plan vivo como kit en un repositorio nuevo:
  - visor independiente (copia del visor del proyecto de origen como app React + Vite): plan por ruta configurable, recarga al guardar, ES y EN;
  - script de tiempos generalizado: configuración, zona horaria, identificador configurable, `asignaciones.json` opcional y tramos del orquestador conservados al aplicar;
  - `schema/plan.schema.json`, probado en paralelo con zod; `ejemplos/plan.json` y `plan-inicial.json`;
  - README.md, AGENTES.md, snippet-claude.md y capturas;
  - pruebas: 70 del visor, 30 de tiempos y 8 e2e, con 23 mutaciones verificadas en rojo;
  - plan propio del kit (`plan.json` y `asignaciones.json`, fuera del zip) con sus tramos cargados por `pnpm tiempos`. Las sesiones de ese trabajo quedaron en la carpeta de sesiones del proyecto de origen.
- 2026-10-12 — **Incidente: otro agente borró la carpeta del kit por error** (datos de Washington).
  - **Qué pasó:** el prompt del kit se pegó por error en la sesión del proyecto visualizador-agentes. Ese agente empezó a crear la carpeta del kit y, al detenerse, borró la carpeta completa y sus copias temporales, alrededor de las 08:37 del 12 de octubre.
  - **Alcance:** no creó el zip ni tocó el proyecto de origen. Su repositorio quedó limpio en 3591666.
  - **Recuperación:** no hizo falta. El agente correcto, la sesión del proyecto de origen, construyó el kit después de ese borrado (commit inicial f398153) y verificó todo, así que no se perdió nada. Al empezar F1 · P2, el historial git estaba completo, el árbol coincidía con el último commit y las pruebas estaban en verde.
  - **Lección:** antes de mandar un prompt, revisar en qué sesión se pega: el identificador («F0 · P1:») no impide que otro agente lo tome. Cada avance del kit se cierra con commit, y el zip `plan-vivo-kit.zip`, junto a la carpeta del kit, sirve de respaldo fuera de la carpeta.
- 2026-10-12 — **F1 · P2, uso desde otros proyectos.** Esta sesión toma el kit. Decisiones K1 a K7.
  - `CLAUDE.md`, este `PROJECT.md` y `PENDIENTES.md` (con su primera entrada: marcas del eje corridas una hora con horario de verano).
  - Rutas por línea de comandos: `--` ignorado (pnpm lo pasa tal cual), `--sesiones` repetible y como lista en el archivo, origen de cada valor y `exigirRuta` con mensaje claro (qué falta, de dónde salió, cómo indicarlo).
  - `schema_version` y `pnpm migrar`; migración 0 a 1 aplicada al plan del kit y a las dos plantillas de `ejemplos/`.
  - README.md, AGENTES.md (secciones 8 y 9 nuevas) y snippet-claude.md al modelo de una sola instalación.
  - La prueba e2e que copiaba el kit a una carpeta vacía se reemplazó por una que abre el visor desde la carpeta de otro proyecto con `pnpm --dir`, con un plan fuera del kit (K1 prohíbe copiarlo).
  - `null` en `asignaciones.mensajes`: excluye un mensaje que no es de este plan y cierra el item abierto (imprevisto, ver «Problemas»).
  - Pruebas: 55 de tiempos, 85 del visor y 9 e2e, todas en verde (antes: 30, 70 y 8). 38 mutaciones de las funciones nuevas en rojo por aserción y en verde al restaurar. Las 5 que sobrevivieron en la primera ronda (rutas inexistentes de tiempos y migrar, origen de variable, lista de sesiones con texto vacío) tienen ahora su prueba.
  - Verificación con el proyecto de origen, en solo lectura: visor con `--plan <project path>\plan.json` desde otra carpeta (con captura, que no se publica) y `pnpm tiempos` sin `--aplicar`, con sus asignaciones de `scripts/tiempos/`: tabla idéntica a la de antes de P2, 95 tramos «igual». El sha256 del plan de ese proyecto es el mismo antes y después (29713a88…8dad).
  - `npx autoskills --dry-run`: detectó TypeScript, Node.js, React, Zod, Playwright, Vite y Vitest, y propuso 12 skills. No se instaló nada.
- 2026-10-12 — Washington aprobó K6 y K7 y completó los datos del incidente. Skills instaladas con `npx autoskills -a claude-code`: las 12 del dry-run (accessibility, seo, vite, vitest, frontend-design, playwright-best-practices, zod, nodejs-best-practices, react-best-practices, composition-patterns, typescript-advanced-types y nodejs-backend-patterns).
  - Quedan en `.agents/skills/`, con enlaces en `.claude/skills/` y su `skills-lock.json`. Por indicación de Washington, ningún archivo de skill va al repositorio: las tres rutas están en `.gitignore` y no viajan en el zip.
- 2026-10-12 — **F1 · P3, un solo visor para varios planes** (K8).
  - `visor/servidor/planes.ts` (ids y registro de planes) y `visor/servidor/plugin.ts` (`/plan.json?plan=<id>`, `GET` y `POST /__plan-vivo/planes`, un vigilante por plan). `vite.config.ts` queda solo con lo fijo: el puerto, la zona y el plugin los pone `bin/visor.ts`.
  - `bin/visor.ts` detecta un visor abierto en el puerto y le suma los planes. `--plan` repetible solo en el visor; lista `planes` en `plan-vivo.config.json`.
  - Selector de planes en el visor (ES y EN), una dirección por plan y aviso de plan desconocido.
  - CLAUDE.md: regla de avisar con el texto exacto cuando un cambio toque algo de lo que dice la skill.
  - README, AGENTES (sección 8) y snippet: un solo visor; no levantar otro en otro puerto.
  - Pruebas: 59 de tiempos, 94 del visor y 11 e2e, en verde dos veces seguidas. 20 mutaciones de las funciones nuevas en rojo por aserción y en verde al restaurar.
  - Verificación real en 5190: visor con el plan del kit y, con un segundo comando desde la carpeta del proyecto de origen, su plan sumado (`?plan=mi-proyecto`), solo lectura.
- 2026-10-12 — **F1 · P4, identificador detrás de los bloques del entorno** (pendiente de lanzamiento-remitex).
  - La extensión de VS Code con Claude in Chrome guarda el mensaje con un bloque de texto `<browser_instruction>…</browser_instruction>` y, en otro bloque, el prompt dentro de `<pasted_content …>`. tiempos leía solo la primera línea del primer bloque y no veía «F1 · P1:».
  - Ahora toma la primera línea con contenido de todos los bloques de texto, después de saltar completos los bloques del entorno (`browser_instruction`, `system-reminder`, `ide_selection`, `ide_opened_file`, `ide_diagnostics`) y de quitar la etiqueta de `pasted_content`. Una etiqueta que no es del entorno (por ejemplo `<div>`) queda como antes. La privacidad no cambia: solo se guarda esa línea.
  - Pruebas: 64 de tiempos y 94 del visor en verde; 8 mutaciones, 7 en rojo por aserción y una equivalente (no cambia la conducta).
  - Efecto real, en solo lectura: las tablas del proyecto de origen (119 «igual»), lanzamiento-remitex (15) y el kit (5) salen idénticas con el código anterior y el nuevo, porque sus `asignaciones.json` ya cubrían esos mensajes. Sin la entrada manual, el mensaje del kit del 12 oct queda «sin asignar» con el código anterior y se asigna a P2 con el nuevo; la entrada se quitó del kit. Los planes del proyecto de origen y de lanzamiento-remitex no cambiaron (sha256).

## 4. Problemas y resoluciones

- 2026-10-12 (F0) — En Windows, el vigilante de Vite perdía el segundo de dos guardados seguidos del plan. Resolución: `fs.watchFile` con sondeo de 250 ms.
- 2026-10-12 (F0) — `tiempos --aplicar` borraba los tramos del orquestador, que el script no puede ver. Resolución: se conservan tal cual.
- 2026-10-12 — `pnpm <comando> -- <argumentos>` pasa el `--` literal al script, y validar lo rechazaba como argumento desconocido. Resolución: la lectura de argumentos lo ignora. En PowerShell el `--` ni siquiera llega: PowerShell se lo come, y pnpm igual pasa los argumentos al script.
- 2026-10-12 — En Windows, pnpm 11 pasa los argumentos con las barras invertidas duplicadas (`C:\a\plan.json` llega como `C:\\a\\plan.json`). Los mensajes mostraban la ruta así. Resolución: toda ruta pasa por `path.resolve`, que la normaliza.
- 2026-10-12 — `pnpm tiempos` fallaba en un repositorio git recién creado, sin commits, porque `git log` da error. Un proyecto nuevo que empieza su plan antes del primer commit caía ahí. Resolución: sin `HEAD`, no hay commits que asignar.
- 2026-10-12 — `pnpm migrar --aplicar` escribe con el mismo formato que `tiempos --aplicar`. Sobre `ejemplos/plan.json`, escrito a mano con otro formato, cambiaba 150 líneas. Resolución: en la plantilla se hizo el cambio de una línea a mano; en los planes de los proyectos no importa, porque `tiempos --aplicar` ya los escribe con ese formato.

- 2026-10-12 — Al cargar los tramos de P2 leyendo las dos carpetas de sesiones (la del proyecto de origen, donde quedó F0, y la del kit), el mensaje «F1 · P2:» de ese proyecto del 11 oct abría el P2 del kit, y decenas de mensajes de ese proyecto sin identificador caían en él. Resolución: `null` en `asignaciones.mensajes` excluye el mensaje y cierra el item abierto; el kit lo usa para ese mensaje.
- 2026-10-12 — El primer mensaje de esta sesión empieza con un bloque pegado, no con «F1 · P2:», y tiempos lo asignaba a P1. Resolución provisional: entrada en `asignaciones.json`. Resuelto en F1 · P4: tiempos salta los bloques del entorno, y la entrada se quitó.
- 2026-10-12 — Al probar desde bash, un `--plan C:\...` sin comillas perdió las barras antes de llegar a pnpm. No es del kit (el mensaje de ruta inexistente lo mostró bien); desde PowerShell funciona tal cual.
- 2026-10-12 — Al cargar los tramos de P3 leyendo también la carpeta de sesiones del proyecto de origen, su mensaje «F1 · P3:» del 11 oct abría el P3 del kit, igual que antes con P2. Cada id nuevo del kit (P4 a P8) volvería a chocar. Resolución: los tramos del kit se cargan solo con la carpeta de sesiones del kit (`c--xampp-htdocs-plan-vivo`). P1, el único item con sesiones en la carpeta del proyecto de origen, queda sin propuesta y `--aplicar` no lo toca. Anotado en PENDIENTES.md: acotar por fechas la lectura de una carpeta de sesiones.
- 2026-10-12 — Una prueba e2e del visor esperaba los mensajes de la consola en cuanto el servidor respondía, pero el visor los imprime un instante después; pasaba por suerte. La mutación V1 lo dejó ver. Resolución: `expect.poll` sobre la salida. Además, en Windows `rmSync` de la carpeta temporal daba EPERM en el `finally` y tapaba el error real de la prueba; la limpieza ahora ignora ese fallo.

## 5. Próximos pasos

- Washington guarda la skill corta «plan vivo» (K2) desde claude.ai. Esta sesión no la escribe ni agrega archivos de skill al repositorio.
- En otra PC, o si se borran, las skills de autoskills se reinstalan con `npx autoskills -a claude-code` en la raíz del kit.
- El proyecto de origen, al aplicar D37 en F3: borrar su copia del visor y de `scripts/tiempos`, pegar el bloque nuevo de `snippet-claude.md` en su `CLAUDE.md` y correr los comandos del kit con `--plan <project path>\plan.json --asignaciones <project path>\scripts\tiempos\asignaciones.json` (o mover sus asignaciones junto al plan). Su plan no tiene `schema_version`: migrarlo desde allá con `pnpm migrar`.
- Resolver la entrada abierta de `PENDIENTES.md` (marcas del eje con horario de verano).
- K5 hecha. Falta: que la skill de cada cuenta diga la ruta del kit en la Mac, y que los pendientes encontrados en la Mac lleguen a este PENDIENTES.md (hoy, el agente de la Mac se los pasa a Washington).
