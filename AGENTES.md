# Plan vivo: instrucciones para agentes de código

Este archivo es para ti, agente. El proyecto lleva su plan en `plan.json`, en su raíz, y tu trabajo es mantenerlo al día. La persona lo mira en el visor, que se recarga solo al guardar.

El kit vive en una sola carpeta por máquina (en adelante, «el kit»): en Windows, `C:\xampp\htdocs\plan-vivo`; en la Mac, `/Users/<user>/plan-vivo`, clonado de https://github.com/wx-quevedo/plan-vivo. Las rutas de este archivo son las de Windows; en la Mac, usa las equivalentes. El kit no se copia al proyecto: en el proyecto solo están `plan.json` y, si hace falta, `asignaciones.json`. Todos los comandos se corren desde el kit apuntando al plan del proyecto con `--plan` (sección 8).

- **Formato exacto:** `C:\xampp\htdocs\plan-vivo\schema\plan.schema.json`.
- **Ejemplo completo:** `C:\xampp\htdocs\plan-vivo\ejemplos\plan.json`.
- **Fallos o mejoras del kit:** no los arregles en el proyecto ni copies el kit; anótalos en `C:\xampp\htdocs\plan-vivo\PENDIENTES.md` (sección 9).

## 1. Crear plan.json al empezar un proyecto

Créalo en la raíz del proyecto en cuanto haya un plan acordado con la persona, antes del primer prompt de trabajo. Parte de `ejemplos/plan-inicial.json` del kit:

```json
{
  "$schema": "../plan-vivo/schema/plan.schema.json",
  "schema_version": 1,
  "project": "mi-proyecto",
  "title": "Mi proyecto",
  "updated_at": "2026-10-12T09:00:00-05:00",
  "phases": [
    {
      "id": "F1",
      "name": "Base",
      "items": [
        {
          "id": "P1",
          "type": "prompt",
          "title": "Estructura inicial del repositorio",
          "status": "pending",
          "estimate_min": [30, 60],
          "difficulty": 3,
          "work_log": [],
          "summary": "",
          "steps": [],
          "files_changed": 0,
          "notes": ""
        }
      ]
    },
    { "id": "F2", "name": "Funciones principales", "estimate_min": [240, 480], "items": [] }
  ]
}
```

Reglas:

- **schema_version:** versión del formato; la actual es 1. Va siempre. Si un plan no lo tiene, o es de una versión anterior, migra con `pnpm migrar` (sección 8).
- **$schema:** ruta al esquema del kit relativa a `plan.json`, para que el editor valide y complete. Con el proyecto en `C:\xampp\htdocs\<proyecto>`, es `../plan-vivo/schema/plan.schema.json`.
- **Ids de fase:** `F1`, `F2`, … en orden.
- **Ids de item:** únicos en todo el plan.
  - `P` + número para los prompts;
  - `G` + número para las puertas;
  - `U` + número para los imprevistos.
  - Un prompt que se parte en dos puede llevar una letra final: `P6b`.
- **estimate_min:** rango en minutos `[mínimo, máximo]` de trabajo efectivo, no de calendario.
  - En un imprevisto que no se estimó, `null`.
  - Una fase cuyos items todavía no se conocen lleva su propio `estimate_min` y `"items": []`: así la línea de tiempo la proyecta igual.
- **difficulty:** de 1 a 10, opcional.
- **Fechas:** ISO 8601 con la zona del proyecto, por ejemplo `2026-10-12T09:00:00-05:00`.
- **Sin status en las fases.** El visor lo deriva de sus items (sección 4), y el esquema rechaza un `status` en una fase.
- Valida con `pnpm validar` (sección 8).

## 2. Agregar fases e items

- **Fase nueva:** agrégala al final de `phases`, con su `estimate_min` si todavía no tiene items.
- **Items de una fase:** cuando se definan los prompts de la fase, agrégalos en orden con `status: "pending"` y su estimado. Si ya tienen items, el `estimate_min` de la fase deja de usarse; puedes quitarlo.
- **Puerta (`type: "gate"`):** un punto donde la persona revisa y aprueba antes de seguir. Suele ir al final de una fase.
- **Imprevisto (`type: "unplanned"`):** si durante un prompt aparece trabajo que no estaba planeado (un fallo, un cambio de enfoque, una tarea extra), agrégalo como item nuevo en la fase donde ocurrió:
  - con `estimate_min: null` si no se estimó;
  - con una nota que explique de dónde salió.

  No escondas ese trabajo dentro de otro item.
- No borres items terminados ni cambies sus ids: el historial es parte del plan.

## 3. Actualizar al cerrar cada prompt

Al terminar cada prompt, antes del commit final, sigue estos pasos.

1. **Actualiza el item del prompt, a mano:**
   - `status`;
   - `summary`: una línea;
   - `steps`: lista corta de lo que se hizo;
   - `files_changed`;
   - `notes`: hallazgos, pendientes, decisiones.

   Actualiza también `updated_at` en la raíz.
2. **Registra lo que no estaba en el plan:** si apareció algo no planeado, agrégalo como item `unplanned` (sección 2).
3. **Revisa y aplica los tramos de trabajo:**
   - corre `pnpm tiempos` con `--plan` (sección 8);
   - revisa la tabla de diferencias, los mensajes sin asignar y los commits fuera de tramo;
   - si todo está bien, aplica con el mismo comando y `--aplicar`.

   No escribas el `work_log` a mano (sección 6).
4. **Valida** con `pnpm validar --plan <ruta>`. Si la persona tiene el visor abierto, revisa que se vea bien.
5. **Haz el commit** de `plan.json` junto con lo demás del cierre.

Estados de un item:

| Estado | Cuándo |
|---|---|
| `pending` | Todavía no empezó. |
| `in_progress` | En curso. |
| `needs_you` | Espera una acción o una decisión de la persona (un comando con sudo, una aprobación, una credencial). |
| `done` | Terminado y verificado. |
| `problem` | Bloqueado por un problema que no se pudo resolver; explícalo en `notes`. |

Una puerta pasa a `done` solo cuando la persona la aprueba. Mientras tanto queda en `pending`, o en `needs_you` si ya le pediste la revisión.

## 4. Campos a mano y campos derivados

| Campo | Quién lo escribe |
|---|---|
| `schema_version`, `$schema`, `project`, `title`, `updated_at` | Tú, a mano (`schema_version` también lo cambia `pnpm migrar`). |
| Fase: `id`, `name`, `estimate_min`, `items` | Tú, a mano. |
| Item: `id`, `type`, `title`, `status`, `estimate_min`, `difficulty`, `summary`, `steps`, `files_changed`, `notes` | Tú, a mano. |
| Item: `work_log` (tramos con `actor`, `start`, `end`, `note`, `commits`) | El script de tiempos (`pnpm tiempos --aplicar`). |
| Estado, avance, estimado y tiempo real de la fase | El visor los deriva. No se guardan. |
| Inicio, fin, tiempo real y commits del item | El visor los deriva del `work_log`. No se guardan, y el esquema rechaza campos como `started_at`, `ended_at`, `real_min` o `commits` en el item. |
| Factor de calibración, proyección y cierre aproximado | El visor los deriva. |

El estado de una fase se deriva en este orden:

1. `problem` si algún item lo está;
2. si no, `needs_you` si algún item lo está;
3. si no, `done` si todos lo están;
4. si no, `in_progress` si alguno está en curso o terminado;
5. si no, `pending`.

## 5. Actores del work_log

| Actor | Quién es | De dónde sale el tramo |
|---|---|---|
| `orchestrator` | Quien planifica, redacta los prompts y verifica los resultados (una persona u otro agente que dirige el trabajo). | Se agrega a mano, porque el script solo ve las sesiones del agente de código. `--aplicar` conserva estos tramos. |
| `coding_agent` | Tú, el agente de código. | Desde cada mensaje de la persona hasta tu último evento antes del mensaje siguiente. |
| `subagent` | Un subagente que lanzaste. | Del primer al último evento de su registro (`subagents/agent-<id>.jsonl`). |
| `human` | La persona dueña del proyecto. | Esperas con evidencia: desde una pregunta con AskUserQuestion hasta su respuesta, o una espera por un pedido de acción registrada en `asignaciones.json`. |

Cuando necesites que la persona haga algo (ejecutar un comando, confirmar, decidir), pídelo con AskUserQuestion: es la señal que el script reconoce como espera de la persona. Una pregunta escrita en texto libre no deja rastro y su espera queda como pausa.

## 6. Script de tiempos

Construye el `work_log` de cada item a partir de dos fuentes:

- los registros JSONL de las sesiones de Claude Code;
- `git log`.

Privacidad: de cada registro usa solo la marca de tiempo, el tipo de evento y la primera línea con contenido de los mensajes de la persona. Nada más se copia ni se imprime.

```
pnpm tiempos --plan <ruta>             muestra la tabla de diferencias; no escribe nada
pnpm tiempos --plan <ruta> --aplicar   escribe el work_log en plan.json, después de validar con el esquema
```

Opciones (también en `plan-vivo.config.json`, ver README):

- `--plan <ruta>`;
- `--repo <carpeta>`: por defecto, la raíz git de la carpeta del plan;
- `--sesiones <carpeta>`: se puede repetir, por ejemplo si el proyecto cambió de carpeta y sus sesiones quedaron en dos lugares;
- `--asignaciones <ruta>`: por defecto, `asignaciones.json` junto al plan;
- `--zona <IANA>`;
- `--identificador <regex>`;
- `--config <ruta>`.

Si no se indica la carpeta de sesiones, se busca en `~/.claude/projects/` la que corresponde al repositorio: la ruta con cada carácter que no sea letra o número cambiado por un guion. Por ejemplo, `C:\proyectos\mi-app` queda como `c--proyectos-mi-app`. Con varias carpetas, las sesiones de todas se leen juntas, en orden de tiempo.

**Cómo asigna cada mensaje de la persona a un item:**

1. Si `asignaciones.json` tiene una entrada para ese mensaje, manda esa entrada.
2. Si el mensaje empieza con un identificador, por ejemplo «F2 · P4: …», abre ese item. La forma es `<fase> · <item>:`: la fase es letras, número y una letra opcional (F2, M6b); el item, igual (P4, P6b). Un id solo, sin fase («M6b:»), no se reconoce. El identificador se reconoce con la opción `identificador`, y el id debe existir en `plan.json`.
3. Si no hay ninguna de las dos cosas, el mensaje pertenece al item que esté abierto.

Para que esto funcione, cada prompt nuevo debe empezar con su identificador. Los bloques que el entorno agrega delante del mensaje no cuentan: el script salta `<browser_instruction>`, `<system-reminder>`, `<ide_selection>`, `<ide_opened_file>` e `<ide_diagnostics>` completos, y de `<pasted_content>` solo la etiqueta, así que un prompt pegado que empieza con «F1 · P2:» se reconoce. Si un prompt llega sin identificador, o con otro formato, agrega la excepción.

**Qué muestra la tabla:** cada tramo con uno de estos estados:

- `igual`;
- `distinto`;
- `solo propuesto`;
- `solo en plan.json`;
- `manual (se conserva)`.

Además lista:

- los mensajes sin asignar;
- los subagentes sin item;
- los commits fuera de todo tramo.

Revísala antes de aplicar:

- `--aplicar` reemplaza el `work_log` de cada item que tenga propuesta, así que un tramo «solo en plan.json» desaparece.
- Los tramos del orquestador (`manual (se conserva)`) son la excepción: el script no puede verlos, así que los deja tal cual. Los items sin ninguna propuesta tampoco se tocan.

**asignaciones.json** es opcional; si no existe, no hay excepciones. Por defecto va junto a `plan.json`. Tiene tres campos, todos opcionales:

```json
{
  "mensajes": { "2026-10-11T13:08:39.958Z": "P1" },
  "subagentes": { "af4b9a7807c20e57a": ["U1", "P3"] },
  "esperas": { "2026-10-11T13:45:05.369Z": "comando con sudo de P2" }
}
```

- **mensajes:** un mensaje sin identificador que abre otro item. La clave es la marca de tiempo UTC del mensaje en el JSONL, la misma que muestra la línea «Sin asignar».
  Con `null` en lugar del id, el mensaje se excluye: no abre ningún item y cierra el que estaba abierto. Sirve cuando se lee la carpeta de sesiones de otro proyecto (`--sesiones` repetido) y un mensaje de ese proyecto trae un identificador que también existe en este plan, por ejemplo su propio «F1 · P2:».
- **subagentes:** un subagente que trabajó para varios items, por el id de su archivo `agent-<id>.jsonl`.
- **esperas:** un mensaje de la persona que cierra una espera por un pedido de acción hecho sin AskUserQuestion. El hueco anterior pasa a ser un tramo `human`.

Nunca corrijas el `work_log` a mano: si la regla no resuelve un caso, agrega la excepción a `asignaciones.json` y vuelve a correr el script.

## 7. Reglas de tiempo

- **Trabajo continuo, sin horario.** No hay jornada ni días hábiles. La proyección encadena lo que falta desde ahora, las 24 horas.
- **Las pausas no se registran.** Una pausa es tiempo sin actividad: el hueco entre dos tramos. El visor las muestra como huecos: «en espera» dentro de un item y «entre prompts» entre items.
- **El tiempo real es la unión de los tramos.** Si dos actores trabajan a la vez (tú y un subagente), ese tiempo cuenta una sola vez. Vale igual para un item y para una fase: el tiempo real de una fase es la unión de los tramos de todos sus items.
- **Inicio y fin de un item:** el primer inicio y el último fin de sus tramos.
- **Calibración:**
  - factor = tiempo real total ÷ estimado medio total de los items terminados que tienen estimado y tramos;
  - lo que falta = estimado medio × factor, menos lo ya trabajado en los items en curso.
  - Sin items terminados, el factor es 1.
- **Fechas:** ISO 8601 con la zona configurada (`zonaHoraria`). El script escribe con precisión de segundos.

## 8. Comandos desde el proyecto

Todos se corren desde el kit. Desde la carpeta del proyecto, sin moverte:

```
pnpm --dir C:\xampp\htdocs\plan-vivo validar -- --plan C:\xampp\htdocs\<proyecto>\plan.json
pnpm --dir C:\xampp\htdocs\plan-vivo tiempos -- --plan C:\xampp\htdocs\<proyecto>\plan.json
pnpm --dir C:\xampp\htdocs\plan-vivo tiempos -- --plan C:\xampp\htdocs\<proyecto>\plan.json --aplicar
pnpm --dir C:\xampp\htdocs\plan-vivo migrar -- --plan C:\xampp\htdocs\<proyecto>\plan.json
pnpm --dir C:\xampp\htdocs\plan-vivo visor -- --plan C:\xampp\htdocs\<proyecto>\plan.json
```

- Usa rutas absolutas. Con `pnpm --dir`, una relativa se resuelve desde la carpeta donde llamaste (el proyecto), así que `--plan plan.json` también funciona.
- Si una ruta no existe, el comando termina con un mensaje que dice cuál falta y de dónde salió. No sigas: corrige la ruta.
- **validar** sale con código 1 si el plan no cumple el esquema, y avisa (sin fallar) si falta `schema_version`.
- **migrar** sin `--aplicar` solo muestra los cambios. Revísalos y aplica con `--aplicar`: escribe el plan, después de validar, y deja `plan.json.bak` con el original. Haz el commit del plan migrado; el `.bak` no se versiona. Migrar dos veces no cambia nada.
- **visor:** un solo visor, en 5190, sirve los planes de todos los proyectos. Si ya está abierto, el mismo comando le suma tu plan y te da su dirección (`http://localhost:5190/?plan=<carpeta del proyecto>`), sin levantar otro servidor; pásale esa dirección a la persona. No detengas el visor ni levantes otro en otro puerto.

No copies el kit al proyecto ni crees un `plan-vivo.config.json` en el proyecto: el plan se indica siempre con `--plan`.

## 9. Fallos y mejoras del kit (PENDIENTES.md)

Si encuentras un fallo del kit (el visor, tiempos, validar, migrar, el esquema o estas instrucciones) o una mejora que valdría para todos los proyectos:

- no lo arregles en el proyecto, no copies el kit para parcharlo y no edites otros archivos del kit;
- agrega una entrada al final de la sección «Abiertos» de `C:\xampp\htdocs\plan-vivo\PENDIENTES.md`, con el formato fijo del archivo: fecha, proyecto de origen, qué pasa, cómo reproducirlo y prioridad;
- dile a la persona, en una línea, que lo anotaste;
- sigue con tu trabajo con un rodeo si lo hay, y anótalo en `notes` del item.

El kit se corrige solo desde su propia sesión, en su carpeta de Windows.

En la Mac (o en cualquier copia clonada del repositorio) no edites ni hagas commit en el kit, tampoco en PENDIENTES.md: escribe la entrada con el mismo formato en tu respuesta y pídele a la persona que la pase al kit. Para actualizar la copia, `git pull` y `pnpm install` en su carpeta.
