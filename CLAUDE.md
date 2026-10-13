# CLAUDE.md del kit plan vivo

Este repositorio es el kit plan vivo: esquema de `plan.json`, visor, script de tiempos, `pnpm validar` y `pnpm migrar`. Esta sesión es la dueña del kit: lo mantiene y lo mejora. Contexto, decisiones (K1 en adelante) y bitácora en `PROJECT.md`. La fuente de verdad para los agentes que usan el kit es `AGENTES.md`.

## Idioma y estilo

- Español latino neutro en todo: código, comentarios, documentación, mensajes de commit y respuestas. Sin voseo y sin formas de España (nada de "vosotros", "ordenador", "vale").
- Sin emojis en ningún lado: ni en archivos, ni en commits, ni en respuestas.
- Tema claro en todo lo visual (visor, capturas, páginas).

## Git

- Solo commits locales. Nunca `git push` ni pull requests.
- Cada commit con rutas explícitas (`git commit -- <rutas>` o `git add <rutas>`), nunca `git add -A` ni `git add .`.
- Washington es el único autor. Sin líneas `Co-Authored-By` ni ninguna atribución a Claude en commits o archivos.

## Mantenimiento

- Actualiza `PROJECT.md` en cada avance relevante: decisiones nuevas, bitácora, problemas y resoluciones, próximos pasos.
- El plan propio del kit es `plan.json` (con `asignaciones.json`), y se mantiene como dice `AGENTES.md`. No viajan en el zip.
- Lo que reporten agentes de otros proyectos llega a `PENDIENTES.md` (decisión K4). Revísalo al empezar cada prompt.
- Un cambio que altere el formato de `plan.json` sube `VERSION_ESQUEMA` y trae su migración en `visor/src/plan/migraciones.ts` (decisión K3).
- La skill «plan vivo» la guarda Washington en claude.ai, en cada cuenta donde la usa (también la corporativa), y no se actualiza sola: cada copia se cambia a mano. Si un cambio toca algo que ella dice (ruta del kit, nombre o argumentos de un comando, puertos, cuándo usarla, la regla de PENDIENTES.md), avísalo al cerrar con el texto exacto para pegar. Lo demás va en `AGENTES.md`, que los agentes leen en cada uso.

## Puertos

Solo 5190 a 5192:

| Puerto | Uso |
|---|---|
| 5190 | Visor (`pnpm visor`), uno solo para todos los planes. Si Washington lo tiene abierto, no lo detengas: `pnpm visor --plan <ruta>` le suma el plan. |
| 5191 | Visor de las pruebas e2e. |
| 5192 | Visor de las pruebas e2e desde otro proyecto y con varios planes, y verificaciones puntuales. |

## Subagentes

Autorizado usar subagentes cuando sea más rápido, sobre todo para pruebas (mutaciones, corridas largas, revisiones en paralelo).

## Cierre de cada respuesta

Termina cada respuesta con este resumen de 5 líneas:

1. Qué cambió.
2. Qué falta.
3. Qué decidir.
4. Commits.
5. Siguiente paso.
