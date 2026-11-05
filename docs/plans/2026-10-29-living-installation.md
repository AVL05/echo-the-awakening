# Living Installation Implementation Plan

> **For agentic workers:** Use executing-plans. Trabajo secuencial en la rama actual; sin delegación, worktree ni commits por las instrucciones del usuario.

**Goal:** Convertir las acciones existentes en una experiencia física y audiovisual coherente.

**Architecture:** Reutilizar Zustand y el puerto determinista de acciones. La selección de suministro es provisional; el estado guardado conserva su esquema. React Three Fiber refleja progreso y selección mediante los componentes actuales, con animaciones suspendidas por visibilidad y fase.

**Tech Stack:** React, TypeScript, Zustand, Three.js/R3F, Web Audio, Vitest y Playwright local existente.

## 1. Suministro físico compartido

- Añadir regresiones de autorización, selección provisional, validación y bloqueo tras arranque en `tests/physical-controls.test.ts` y ejecutarlas antes de implementar.
- Modificar `src/game/store.ts`, `src/game/actions.ts`, `src/EscapePanels.tsx` y `src/scene/EscapeProps.tsx`; integrar los nuevos objetivos con el distribuidor de `Room.tsx`.
- Ejecutar el test específico; verificar que panel y escena comparten selección y que no se alteran guardados.

## 2. Instalación reactiva

- Reutilizar `BoxInstances`, materiales, visibilidad y perfiles de calidad. Añadir líneas de energía, soportes ópticos y memorias; relacionar su aspecto con progreso real.
- Modificar `Room.tsx`, `EscapeProps.tsx`, `StoryRooms.tsx`, `Industrial.tsx` y `Cinematics.tsx` solo donde corresponda. Usar sonido sintetizado existente.
- Mantener pausa, efectos reducidos, sombra y presupuestos de los perfiles actuales.

## 3. Validación y cierre

- Ejecutar `npm run typecheck`, `npm run build` (incluye lint, tests y checks), `npm run check:release`.
- Añadir prueba de controles reales por raycasting y panel compartido. Ejecutar regresión gráfica y controles en ambos renderers, con movimiento reducido.
- Comparar benchmark compilado con los resultados de la pasada anterior. Documentar resultados y límites reales en `docs/PERFORMANCE.md` y actualizar `docs/ESCAPE_ROOM.md`.
- Revisar cambios y conservar todo el trabajo previo. Sin publicación.

## Resultado de ejecución

- PASS: cinco regresiones nuevas (incluida la colisión del banco óptico ampliado), 63 tests totales, TypeScript, lint, build y release local.
- PASS: controles 3D y panel compartido en el build; óptica, reguladores y ambos finales en desarrollo; WebGL 2 y WebGPU. Se usan cámaras/checkpoints de prueba.
- PASS: regresión gráfica y doce muestras de rendimiento del build final. Resultados, costes y límites en `docs/PERFORMANCE.md`.
- Se conservan rama, historia, guardados, modo sin IA y trabajo previo. No se realizan commits, push ni despliegue. Queda pendiente evaluación humana en dispositivos físicos y escucha manual del sonido.
