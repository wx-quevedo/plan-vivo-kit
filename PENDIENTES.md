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

- **Proyecto de origen:** plan-vivo (`C:\xampp\htdocs\plan-vivo`), revisión del propio kit.
- **Qué pasa:** en la línea de tiempo, si un cambio de horario de verano cae dentro del rango que se muestra, las marcas del eje posteriores al cambio quedan corridas una hora: en lugar de caer en horas redondas (00:00, 06:00, 12:00) caen en 01:00, 07:00, 13:00, o una hora antes según el sentido del cambio. Causa: `timeTicks` (`visor/src/lib/format.ts`) calcula el desfase de la zona una sola vez, en el inicio del rango, y avanza con un paso fijo. Los tramos y las horas de la consola están bien, porque se convierten instante por instante (`visor/src/lib/zona.ts`). Con America/Guayaquil (la zona por defecto) no pasa, porque no tiene horario de verano.
- **Cómo reproducirlo:** un plan con `zonaHoraria` `America/New_York` (o `--zona America/New_York`) y tramos entre el 2026-10-31 y el 2026-11-02, que cruzan el cambio del 1 de noviembre. Abrir el visor y comparar las marcas del eje posteriores al cambio con las horas de los tramos en la consola.
- **Prioridad:** media.

### 2026-10-12 · El identificador del prompt no se reconoce si el entorno antepone un bloque al mensaje

- **Proyecto de origen:** lanzamiento-remitex (`C:\xampp\htdocs\lanzamiento-remitex`), F1 · P1.
- **Qué pasa:** la extensión de VS Code con Claude in Chrome guarda el mensaje de la persona con un bloque `<browser_instruction>...</browser_instruction>` delante del texto. `tiempos` toma la primera línea, que es ese bloque, y no ve "F1 · P1:", así que el mensaje queda "sin asignar (sin identificador y sin item abierto)". Se resolvió en el proyecto con una entrada en `asignaciones.json`. Mejora posible: antes de buscar el identificador, saltar bloques de etiquetas del entorno (`<browser_instruction>`, `<system-reminder>`, `<ide_selection>` y similares) y líneas vacías.
- **Cómo reproducirlo:** en una sesión de la extensión de VS Code con Claude in Chrome activo, enviar un prompt que empiece con "F1 · P1: ..." y correr `pnpm tiempos -- --plan <plan>`: aparece en "Sin asignar" con el texto `"<browser_instruction># Claude in Chrome browser au"`.
- **Prioridad:** media.

### 2026-10-12 · Al abrir una fase con su primer item, se pierde el estimado del resto de la fase

- **Proyecto de origen:** server-monitor (`C:\xampp\htdocs\server-monitor`), F3 · P9.
- **Qué pasa:** F3 tenía `estimate_min: [180, 240]`, el de las alertas, que todavía no tienen prompts. Al agregar P9 (`[30, 50]`), `phaseEstimate` usa solo la suma de los items y descarta el estimado propio de la fase. La tarjeta muestra «Estimado 30 min – 50 min» y la proyección deja de contar las 3 a 4 h de alertas, así que el cierre aproximado se adelanta. AGENTES.md lo documenta («el estimate_min de la fase deja de usarse»), pero el resultado subestima cualquier fase que se abre con un solo prompt. Mejora posible: si la fase tiene `estimate_min` e items, tomar el mayor de los dos, o tratar el de la fase como el total y proyectar la diferencia como «sin items todavía».
- **Cómo reproducirlo:** una fase con `"estimate_min": [180, 240]` y un solo item pendiente con `"estimate_min": [30, 50]`; correr `pnpm visor -- --plan <plan>`: la tarjeta dice «Estimado 30 min – 50 min».
- **Prioridad:** media.

### 2026-10-12 · Cada item cerrado cambia en la corrida siguiente de tiempos

- **Proyecto de origen:** server-monitor (`C:\xampp\htdocs\server-monitor`), F3 · P9 y P10.
- **Qué pasa:** el cierre de un prompt corre `tiempos --aplicar` antes del commit final y del mensaje de cierre. En la corrida siguiente, ese trabajo posterior alarga el último tramo del item ya cerrado y le suma el commit final, que según las reglas de los proyectos no debería contarse como evidencia. Pasó con G2 (+31 s, commit bdc768a) y con P9 (+92 s, commit 156552f). Cada prompt nuevo encuentra entonces un item cerrado «distinto», y la regla «los cerrados no deben cambiar» deja de servir como control. Mejoras posibles: que `--aplicar` registre en el plan hasta dónde se cargó cada item y no lo extienda después, o que la tabla marque aparte el cambio que es solo la cola del cierre.
- **Cómo reproducirlo:** cerrar un item con `tiempos --aplicar`, hacer el commit final y escribir el mensaje de cierre. En el prompt siguiente, `tiempos` sin `--aplicar` muestra ese item como «distinto», con el fin más tarde y el commit final.
- **Prioridad:** baja.

## Resueltos

(ninguno todavía)
