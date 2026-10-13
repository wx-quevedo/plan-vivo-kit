# Plan vivo

Un plan de proyecto en un solo archivo, `plan.json`, que el agente de código mantiene al día y un visor muestra en el navegador.

El plan se divide en fases, y cada fase en items:

- **prompt:** un encargo al agente;
- **puerta (gate):** una aprobación tuya;
- **imprevisto (unplanned):** algo que apareció en el camino.

Cada item guarda su estimado, su estado y los tramos reales de trabajo de cada actor: orquestador, agente de código, subagente y humano. El visor calcula a partir de eso el estado de cada fase, el tiempo real, las pausas y una proyección del cierre. Se recarga solo cada vez que se guarda `plan.json`.

Nació en el proyecto server-monitor y aquí está separado para usarlo en cualquier proyecto.

## Qué se ve

**Fases.** Una tarjeta por fase, con el estado derivado de sus items, el avance, el estimado y el tiempo real.

![Fases](docs/capturas/fases.png)

**Zoom de una fase.** Al tocar una fase aparece la cadena de sus items. Al tocar un item se abre su consola, con:

- el estimado y el tiempo real;
- los tramos por actor;
- las pausas;
- los pasos;
- los commits.

![Zoom de una fase](docs/capturas/fase-zoom.png)

**Línea de tiempo.** Muestra, por fase:

- el estimado (barra tenue);
- los tramos reales por actor;
- las esperas y los huecos entre prompts;
- la proyección de lo que falta, calibrada con lo ya terminado;
- el cierre aproximado.

![Línea de tiempo](docs/capturas/linea-de-tiempo.png)

**Mapa.** Las fases como estaciones, con un «Estás aquí» en la fase en curso.

![Mapa](docs/capturas/mapa.png)

El visor tiene tema claro y textos en español e inglés (botones ES y EN). No tiene login ni API: lee el archivo local desde la ruta que le indiques.

## Cómo se usa: una sola instalación por máquina

En cada máquina, el kit vive en una sola carpeta (en Windows, `C:\xampp\htdocs\plan-vivo`; en la Mac, `/Users/<user>/plan-vivo`) y no se copia a ningún proyecto. Cada proyecto guarda solo su `plan.json` (y, si hace falta, su `asignaciones.json`). El visor, el script de tiempos, la validación y la migración se corren desde el kit, apuntando con `--plan` al plan del proyecto.

```
C:\xampp\htdocs\
  plan-vivo\          el kit: visor, tiempos, esquema, guías (una sola copia)
  mi-proyecto\
    plan.json         el plan de este proyecto
    asignaciones.json opcional: excepciones del script de tiempos
    CLAUDE.md         con el bloque de snippet-claude.md
```

### Instalar el kit (una vez)

Requisitos: Node 24, pnpm 11 y git; para `pnpm e2e`, además, Google Chrome. Es lo que se probó; con versiones anteriores no se probó.

```
cd C:\xampp\htdocs\plan-vivo
pnpm install
```

Para ver el ejemplo: `pnpm visor` y entra a http://localhost:5190. La configuración que trae el kit apunta a `ejemplos/plan.json`.

### Instalar el kit en la Mac

El repositorio es privado: https://github.com/wx-quevedo/plan-vivo. En la Mac, con la sesión de GitHub iniciada (`gh auth login`):

```
git clone https://github.com/wx-quevedo/plan-vivo.git /Users/<user>/plan-vivo
cd /Users/<user>/plan-vivo
pnpm install
```

Para actualizarlo: `git pull` y `pnpm install` en esa carpeta. La copia de la Mac no se edita: el kit se cambia solo desde su sesión dueña, en Windows. Los comandos son los mismos, con la ruta de la Mac en `--dir` y en `--plan`; tiempos encuentra solo las sesiones de la Mac (`~/.claude/projects/`).

### Sumar un proyecto

1. Pega el bloque de `snippet-claude.md` en el `CLAUDE.md` del proyecto.
2. El agente crea `plan.json` en la raíz del proyecto siguiendo `AGENTES.md`. Si prefieres empezar tú, copia `ejemplos/plan-inicial.json` a la raíz del proyecto como `plan.json`.
3. Abre el visor apuntando a ese plan (siguiente sección). Si ya está abierto con otro proyecto, el mismo comando le suma este plan.

No hace falta instalar nada en el proyecto ni tocar la configuración del kit.

## Comandos

Desde la carpeta del kit:

```
pnpm visor   --plan C:\xampp\htdocs\mi-proyecto\plan.json
pnpm validar --plan C:\xampp\htdocs\mi-proyecto\plan.json
pnpm tiempos --plan C:\xampp\htdocs\mi-proyecto\plan.json
pnpm migrar  --plan C:\xampp\htdocs\mi-proyecto\plan.json
```

Desde la carpeta del proyecto, sin moverse (lo que hace un agente de otro repositorio):

```
pnpm --dir C:\xampp\htdocs\plan-vivo visor -- --plan C:\xampp\htdocs\mi-proyecto\plan.json
```

Con `pnpm --dir`, una ruta relativa se resuelve desde la carpeta donde se llamó: dentro del proyecto, `--plan plan.json` también funciona. En PowerShell el `--` es opcional.

### Un solo visor para todos los proyectos

Un visor en 5190 sirve los planes de varios proyectos a la vez:

- **Sumar un plan:** si el visor ya está abierto, `pnpm visor --plan <ruta>` no levanta otro servidor: le suma el plan, muestra su dirección y termina. Si el plan ya estaba, solo muestra la dirección.
- **Una dirección por plan:** el primero en http://localhost:5190, los demás en http://localhost:5190/?plan=<id>. El id es el nombre de la carpeta del proyecto (`C:\xampp\htdocs\server-monitor\plan.json` queda como `server-monitor`). Cada uno se puede tener en su pestaña.
- **Selector:** con más de un plan, arriba aparece la lista; las pestañas abiertas ven los planes nuevos sin recargar.
- **Recarga:** cada plan se recarga solo cuando se guarda ese archivo.
- **Al levantarlo:** `--plan` se puede repetir, y `plan-vivo.config.json` acepta una lista `planes` para abrir siempre los mismos. La lista vive en memoria: al cerrar el visor se pierden los planes sumados después.

| Comando | Qué hace |
|---|---|
| `pnpm visor` | Levanta el visor en el puerto configurado (5190 por defecto), o suma el plan al visor que ya está abierto ahí. Acepta `--plan` (repetible), `--puerto`, `--zona` y `--config`. |
| `pnpm validar` | Valida el plan con el mismo esquema que el visor y lista los problemas con su ubicación. Avisa si falta `schema_version`. |
| `pnpm tiempos` | Propone el `work_log` de cada item a partir de las sesiones de Claude Code y de git. Solo muestra diferencias; con `--aplicar` escribe el plan. Ver `AGENTES.md`. |
| `pnpm migrar` | Lleva el plan a la versión actual del formato. Solo muestra los cambios; con `--aplicar` los escribe y deja una copia `.bak`. |
| `pnpm test` | Pruebas unitarias del visor y del script de tiempos. |
| `pnpm e2e` | Pruebas de punta a punta con Playwright (Chrome instalado). |
| `pnpm capturas` | Regenera las capturas de `docs/capturas/` con el ejemplo. |
| `pnpm typecheck` | Revisa los tipos de TypeScript. |
| `pnpm zip` | Arma `../plan-vivo-kit.zip` con lo que está en git (sin `node_modules`, sin el plan propio del kit). |

Si una ruta no existe, el comando termina con un mensaje que dice cuál falta, de dónde salió (argumento, variable o archivo de configuración) y cómo indicarla.

## Opciones y configuración

Cada opción se puede dar como argumento, como variable de entorno o en `plan-vivo.config.json` (en la carpeta del kit). Prioridad: argumento, luego variable, luego archivo, luego valor por defecto. Las rutas de un argumento o de una variable son relativas a la carpeta desde donde se llamó; las del archivo, a la carpeta del archivo.

| Argumento | Clave del archivo | Variable | Por defecto | Para qué |
|---|---|---|---|---|
| `--plan` | `plan` | `PLAN_VIVO_PLAN` | `plan.json` del kit | Ruta del plan. |
| | `planes` | | ninguna | Solo el visor: lista de planes que abre además de `plan`, con rutas relativas a la carpeta del archivo. |
| `--puerto` | `puerto` | `PLAN_VIVO_PUERTO` | `5190` | Puerto del visor (solo `localhost`). |
| `--zona` | `zonaHoraria` | `PLAN_VIVO_ZONA` | `America/Guayaquil` | Zona IANA para mostrar las horas y para escribir los tramos. |
| `--repo` | `repo` | `PLAN_VIVO_REPO` | la raíz git de la carpeta del plan | Repositorio del que tiempos lee los commits. |
| `--sesiones` | `sesiones` | `PLAN_VIVO_SESIONES` | `~/.claude/projects/<ruta del repo>` | Carpeta de las sesiones de Claude Code. Se puede repetir; en el archivo, una lista; en la variable, separadas por `;` (Windows) o `:`. |
| `--asignaciones` | `asignaciones` | `PLAN_VIVO_ASIGNACIONES` | `asignaciones.json` junto al plan | Excepciones de tiempos. Por defecto es opcional; si la indicas, debe existir. |
| `--identificador` | `identificador` | `PLAN_VIVO_IDENTIFICADOR` | `\b[A-Z]+\d+[a-z]?\s*·\s*([A-Za-z]+\d+[a-z]?)\s*:` | Expresión que reconoce el item al inicio de un mensaje («F1 · P4:», «M6b · P2:»). |
| `--config` | | `PLAN_VIVO_CONFIG` | `plan-vivo.config.json` del kit | Otro archivo de configuración. |

## Versión del formato

Cada `plan.json` lleva `schema_version` (entero; la versión actual es 1). Si una mejora del kit cambia el formato, el kit trae su migración:

```
pnpm migrar --plan <ruta>            muestra los cambios; no escribe nada
pnpm migrar --plan <ruta> --aplicar  los escribe, después de validar, y deja <ruta>.bak con el original
```

Correrla de nuevo no cambia nada. La primera migración lleva un plan sin versión (con el campo anterior `"schema": 1`) a la versión 1.

## Fallos y mejoras del kit

Si trabajando en otro proyecto aparece un fallo o una mejora del kit, no se arregla en ese proyecto: se anota en `PENDIENTES.md`, en esta carpeta, con el formato que trae el archivo. El kit se corrige solo aquí.

## Puertos

| Puerto | Uso |
|---|---|
| 5190 | Visor (`pnpm visor`), por defecto. |
| 5191 | Visor de las pruebas e2e, con una copia del ejemplo. |
| 5192 | Visor de las pruebas e2e desde otro proyecto y con varios planes. |

No hace falta un puerto por proyecto: un solo visor sirve todos los planes. Si 5190 está ocupado por otro programa (no por un visor), el visor no elige otro puerto: avisa y termina. Usa `--puerto`.

## Contenido

```
README.md            este archivo
AGENTES.md           instrucciones para agentes de código: cómo crear y mantener plan.json (fuente de verdad)
snippet-claude.md    bloque para pegar en el CLAUDE.md de cada proyecto
PENDIENTES.md        fallos y mejoras del kit reportados desde otros proyectos
CLAUDE.md, PROJECT.md  reglas y bitácora del mantenimiento del kit
plan-vivo.config.json
configuracion.ts     lectura de la configuración (visor, tiempos, validar, migrar)
schema/              plan.schema.json: JSON Schema del formato, con descripciones
ejemplos/            plan.json (proyecto de ejemplo) y plan-inicial.json (plantilla para empezar)
visor/               el visor (React + Vite), validar, migrar, sus pruebas y sus pruebas e2e
tiempos/             el script de tiempos y sus pruebas
docs/capturas/       capturas del visor con el ejemplo
```

Para que el editor valide y complete `plan.json`, agrega al inicio del archivo `"$schema"` con la ruta al esquema del kit, relativa a `plan.json`. Para un proyecto en `C:\xampp\htdocs\mi-proyecto`: `"$schema": "../plan-vivo/schema/plan.schema.json"`.
