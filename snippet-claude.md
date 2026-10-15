# Bloque para el CLAUDE.md del proyecto

Copia el bloque siguiente en el `CLAUDE.md` del proyecto. Supone que el plan del proyecto es `plan.json`, en su raíz. Cambia `<kit path>` por la carpeta donde está instalado el kit (en Windows, por ejemplo, `C:\path\to\plan-vivo`; en la Mac, `~/plan-vivo`) y `<project path>` por la carpeta del proyecto. En la Mac, los fallos del kit no se anotan en PENDIENTES.md, se le pasan a la persona (ver la sección 9 de AGENTES.md).

```markdown
## Plan vivo (plan.json)

El plan del proyecto vive en `plan.json`, en la raíz. Se mantiene con el kit plan vivo, instalado una sola vez en `<kit path>`. El kit no se copia a este proyecto. Antes de tocar el plan, lee `<kit path>\AGENTES.md`: es obligatorio seguirlo y es la fuente de verdad.

- Si `plan.json` no existe y hay un plan acordado, créalo desde `<kit path>\ejemplos\plan-inicial.json`, con `"schema_version": 1` y el formato de `<kit path>\schema\plan.schema.json`.
- Cada prompt empieza con su identificador ("F1 · P2: ..."). Lo que aparezca sin planear se agrega como item `unplanned` en la fase donde ocurrió.
- Al cerrar cada prompt, actualiza a mano:
  - del item: `status`, `summary` (una línea), `steps` (lista corta), `files_changed` y `notes`;
  - de la raíz: `updated_at`.

  Las fases no llevan `status`.
- Los comandos se corren desde el kit, apuntando a este plan con `--plan`:
  - `pnpm --dir <kit path> tiempos -- --plan <project path>\plan.json`: revisa la tabla de diferencias, los mensajes sin asignar y los commits fuera de tramo; luego aplica con el mismo comando y `--aplicar`;
  - `pnpm --dir <kit path> validar -- --plan <project path>\plan.json` después de editar el plan; si da error, corrígelo antes del commit;
  - `pnpm --dir <kit path> migrar -- --plan <project path>\plan.json` si validar avisa que falta `schema_version` o el kit cambió de versión: revisa los cambios y aplica con `--aplicar`.
- El `work_log` no se escribe a mano. Las excepciones van en `asignaciones.json`, junto a `plan.json`, nunca en el `work_log`.
- Cuando necesites que la persona haga algo (un comando, una confirmación, una decisión), pídelo con AskUserQuestion: es la señal de espera que reconoce el script.
- Visor: `pnpm --dir <kit path> visor -- --plan <project path>\plan.json` (http://localhost:5190). Un solo visor sirve todos los proyectos: si ya está abierto, el comando le suma este plan y muestra su dirección. No lo detengas ni levantes otro en otro puerto.
- Fallos o mejoras del kit: no los arregles aquí ni copies el kit a este proyecto. Anótalos en `<kit path>\PENDIENTES.md`, con el formato fijo del archivo (fecha, proyecto de origen, qué pasa, cómo reproducirlo, prioridad), avisa en una línea y sigue con tu trabajo.
```
