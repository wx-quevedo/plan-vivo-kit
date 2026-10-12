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

## Resueltos

(ninguno todavía)
