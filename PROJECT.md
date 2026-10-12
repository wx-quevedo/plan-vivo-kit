# PROJECT.md: kit plan vivo

## 1. Contexto

El kit plan vivo es un formato de plan de proyecto en un solo archivo, `plan.json`, más las herramientas para mantenerlo y verlo:

- **esquema:** `schema/plan.schema.json` (JSON Schema) y su gemelo en zod, `visor/src/plan/schema.ts`;
- **visor:** app React + Vite, solo `localhost`, tema claro, ES y EN, se recarga al guardar el plan (`pnpm visor`, puerto 5190);
- **tiempos:** arma el `work_log` de cada item a partir de las sesiones de Claude Code y de git (`pnpm tiempos`);
- **validar** y **migrar:** `pnpm validar` y `pnpm migrar`.

Nació dentro de server-monitor (`C:\xampp\htdocs\server-monitor`, decisiones D20, D22 y D37 de su PROJECT.md). El agente de Monitor lo separó como kit en este repositorio (commits f398153, b9aef66 y 5b486ce). Desde el 2026-10-12, la sesión de este repositorio es la dueña del kit: lo mantiene y lo mejora. Reglas de trabajo en `CLAUDE.md`; instrucciones para los agentes que usan el kit en `AGENTES.md`.

## 2. Decisiones

Aprobadas por Washington el 2026-10-12.

- **K1** Una sola instalación. El kit vive solo en `C:\xampp\htdocs\plan-vivo`. Cada proyecto guarda únicamente su `plan.json` (y, si hace falta, su `asignaciones.json`). Visor, tiempos, validar y migrar se corren desde el kit apuntando al plan del proyecto con `--plan`. Nunca se copia el kit a otro repositorio.
  - **Por qué:** con una copia por proyecto, cada arreglo había que repetirlo en todas las copias, y las copias se separaban (Monitor ya tenía un visor y un script de tiempos distintos de los del kit). Con una sola instalación, una mejora llega a todos los proyectos a la vez.
  - **Consecuencias:** los comandos aceptan `--plan`, `--sesiones` (repetible) y `--asignaciones`, y funcionan desde otra carpeta con `pnpm --dir C:\xampp\htdocs\plan-vivo <comando> -- <argumentos>`. Prioridad: argumento, luego variable de entorno, luego `plan-vivo.config.json`, luego valor por defecto.
- **K2** La skill «plan vivo» será corta: cuándo usarla, dónde está el kit y los comandos. Para el detalle remite a `AGENTES.md`, que es la fuente de verdad.
  - **Por qué:** si el detalle estuviera en la skill y en `AGENTES.md`, habría dos textos que mantener iguales. Con la skill corta, un cambio del kit solo toca `AGENTES.md`.
- **K3** Cada `plan.json` lleva la versión del esquema (`schema_version`, entero; la actual es 1). Si una mejora cambia el formato, el kit trae una migración (`pnpm migrar`).
  - **Por qué:** con una sola instalación (K1), un cambio de formato afecta a los planes de todos los proyectos a la vez. La versión dice qué formato tiene cada plan, y la migración lo pone al día sin editarlo a mano.
  - **Cómo:** las migraciones están en `visor/src/plan/migraciones.ts`, una por versión. `pnpm migrar` solo muestra los cambios; con `--aplicar` valida, escribe y deja una copia `.bak`. Correrla dos veces no cambia nada.
- **K4** Si un agente de otro proyecto encuentra un fallo o una mejora del kit, no lo arregla ahí: lo anota en `C:\xampp\htdocs\plan-vivo\PENDIENTES.md`.
  - **Por qué:** un arreglo hecho en otro repositorio se pierde o rompe la instalación única (K1). Anotado en un solo lugar, con un formato fijo, la sesión dueña lo resuelve y lo prueba aquí.
  - **Cómo:** la regla está en `AGENTES.md` (sección 9) y en el bloque de `snippet-claude.md`, que va en el `CLAUDE.md` de cada proyecto.
- **K5** Más adelante, el kit irá a un repositorio privado en GitHub para usarlo también en la Mac. No ahora.
  - **Por qué:** por ahora todo el trabajo es en esta PC, y el kit todavía cambia rápido. Mientras tanto no se hace push (ver `CLAUDE.md`).
- **K6** `schema_version` reemplaza al campo `schema` que tenían los planes de F0 (`"schema": 1`). La migración a la versión 1 agrega `schema_version` después de `$schema` y quita `schema`. Decidida por esta sesión en F1 · P2, al aplicar K3.
  - **Por qué:** el encargo pedía un campo `schema_version`, y dos campos con la misma versión podían contradecirse. El esquema sigue aceptando `schema` y la falta de `schema_version`, para que un plan sin migrar (por ejemplo el de Monitor) se siga viendo en el visor; `pnpm validar` avisa.

## 3. Bitácora

- 2026-10-12 — **F0 · P1, kit inicial** (commits f398153, b9aef66 y 5b486ce). El agente de server-monitor exportó el plan vivo como kit en un repositorio nuevo:
  - visor independiente (copia del de Monitor como app React + Vite): plan por ruta configurable, recarga al guardar, ES y EN;
  - script de tiempos generalizado: configuración, zona horaria, identificador configurable, `asignaciones.json` opcional y tramos del orquestador conservados al aplicar;
  - `schema/plan.schema.json`, probado en paralelo con zod; `ejemplos/plan.json` y `plan-inicial.json`;
  - README.md, AGENTES.md, snippet-claude.md y capturas;
  - pruebas: 70 del visor, 30 de tiempos y 8 e2e, con 23 mutaciones verificadas en rojo;
  - plan propio del kit (`plan.json` y `asignaciones.json`, fuera del zip) con sus tramos cargados por `pnpm tiempos`. Las sesiones de ese trabajo quedaron en la carpeta de sesiones de Monitor.
- 2026-10-12 — **Incidente: otro agente borró la carpeta del kit por error.** Lo informó Washington al encargar F1 · P2. El historial git está completo (f398153, b9aef66 y 5b486ce, el primero como commit inicial), el árbol de trabajo coincidía con el último commit y las pruebas estaban en verde al empezar P2, así que no hubo pérdida que se notara. Falta registrar qué agente fue, cuándo pasó y cómo se recuperó la carpeta (ver «Próximos pasos»). Lección: cada avance del kit se cierra con commit, y el zip `C:\xampp\htdocs\plan-vivo-kit.zip` sirve de respaldo fuera de la carpeta.
- 2026-10-12 — **F1 · P2, uso desde otros proyectos.** Esta sesión toma el kit. Decisiones K1 a K6.
  - `CLAUDE.md`, este `PROJECT.md` y `PENDIENTES.md` (con su primera entrada: marcas del eje corridas una hora con horario de verano).
  - Rutas por línea de comandos: `--` ignorado (pnpm lo pasa tal cual), `--sesiones` repetible y como lista en el archivo, origen de cada valor y `exigirRuta` con mensaje claro (qué falta, de dónde salió, cómo indicarlo).
  - `schema_version` y `pnpm migrar`; migración 0 a 1 aplicada al plan del kit y a las dos plantillas de `ejemplos/`.
  - README.md, AGENTES.md (secciones 8 y 9 nuevas) y snippet-claude.md al modelo de una sola instalación.
  - La prueba e2e que copiaba el kit a una carpeta vacía se reemplazó por una que abre el visor desde la carpeta de otro proyecto con `pnpm --dir`, con un plan fuera del kit (K1 prohíbe copiarlo).

## 4. Problemas y resoluciones

- 2026-10-12 (F0) — En Windows, el vigilante de Vite perdía el segundo de dos guardados seguidos del plan. Resolución: `fs.watchFile` con sondeo de 250 ms.
- 2026-10-12 (F0) — `tiempos --aplicar` borraba los tramos del orquestador, que el script no puede ver. Resolución: se conservan tal cual.
- 2026-10-12 — `pnpm <comando> -- <argumentos>` pasa el `--` literal al script, y validar lo rechazaba como argumento desconocido. Resolución: la lectura de argumentos lo ignora. En PowerShell el `--` ni siquiera llega: PowerShell se lo come, y pnpm igual pasa los argumentos al script.
- 2026-10-12 — En Windows, pnpm 11 pasa los argumentos con las barras invertidas duplicadas (`C:\a\plan.json` llega como `C:\\a\\plan.json`). Los mensajes mostraban la ruta así. Resolución: toda ruta pasa por `path.resolve`, que la normaliza.
- 2026-10-12 — `pnpm tiempos` fallaba en un repositorio git recién creado, sin commits, porque `git log` da error. Un proyecto nuevo que empieza su plan antes del primer commit caía ahí. Resolución: sin `HEAD`, no hay commits que asignar.
- 2026-10-12 — `pnpm migrar --aplicar` escribe con el mismo formato que `tiempos --aplicar`. Sobre `ejemplos/plan.json`, escrito a mano con otro formato, cambiaba 150 líneas. Resolución: en la plantilla se hizo el cambio de una línea a mano; en los planes de los proyectos no importa, porque `tiempos --aplicar` ya los escribe con ese formato.

## 5. Próximos pasos

- Washington: confirmar los detalles del incidente de la carpeta borrada (qué agente, cuándo, cómo se recuperó) para completar la bitácora.
- Escribir la skill corta «plan vivo» (K2): cuándo usarla, dónde está el kit y los comandos con `--plan`; el detalle, en `AGENTES.md`.
- server-monitor, al aplicar D37 en F3: borrar su copia del visor y de `scripts/tiempos`, pegar el bloque nuevo de `snippet-claude.md` en su `CLAUDE.md` y correr los comandos del kit con `--plan C:\xampp\htdocs\server-monitor\plan.json --asignaciones C:\xampp\htdocs\server-monitor\scripts\tiempos\asignaciones.json` (o mover sus asignaciones junto al plan). Su plan no tiene `schema_version`: migrarlo desde allá con `pnpm migrar`.
- Resolver la entrada abierta de `PENDIENTES.md` (marcas del eje con horario de verano).
- K5: repositorio privado en GitHub para la Mac, cuando Washington lo pida.
