# Bloque para el CLAUDE.md del proyecto

Copia el bloque siguiente en el `CLAUDE.md` del proyecto. Supone que el kit está en `plan-vivo/` y el plan en `plan.json`, ambos en la raíz; si usas otras rutas, ajústalas.

```markdown
## Plan vivo (plan.json)

El plan del proyecto vive en `plan.json` y se mantiene con el kit de `plan-vivo/`. Antes de tocarlo, lee `plan-vivo/AGENTES.md`: es obligatorio seguirlo.

- Si `plan.json` no existe y hay un plan acordado, créalo desde `plan-vivo/ejemplos/plan-inicial.json`, con el formato de `plan-vivo/schema/plan.schema.json`.
- Cada prompt empieza con su identificador ("F1 · P2: ..."). Lo que aparezca sin planear se agrega como item `unplanned` en la fase donde ocurrió.
- Al cerrar cada prompt, actualiza a mano:
  - del item: `status`, `summary` (una línea), `steps` (lista corta), `files_changed` y `notes`;
  - de la raíz: `updated_at`.

  Las fases no llevan `status`.
- El `work_log` no se escribe a mano. En `plan-vivo/`:
  - corre `pnpm tiempos`;
  - revisa la tabla de diferencias, los mensajes sin asignar y los commits fuera de tramo;
  - aplica con `pnpm tiempos --aplicar`.

  Las excepciones van en `asignaciones.json`, nunca en el `work_log`.
- Cuando necesites que la persona haga algo (un comando, una confirmación, una decisión), pídelo con AskUserQuestion: es la señal de espera que reconoce el script.
- Después de editar `plan.json`, valida con `pnpm validar` en `plan-vivo/`. Si da error, corrígelo antes del commit.
- Visor: `pnpm visor` en `plan-vivo/` (http://localhost:5190). Si la persona ya lo tiene abierto, no lo detengas ni levantes otro en ese puerto.
```
