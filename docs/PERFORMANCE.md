# Rendimiento · actualización del 28 de octubre de 2026

Esta iteración se implementa sin ejecutar tests, navegadores ni benchmarks, por petición del usuario. La validación se limita a TypeScript, lint y compilación sin lifecycle scripts. No hay nuevas mediciones de FPS, p95, consumo ni carga; 60 FPS estables y un mínimo deseado de 30 FPS son objetivos pendientes de comprobar en el equipo real.

## Cambios y límites de esta iteración

- CPU: las colisiones reutilizan la lista estática, el raycasting reutiliza impactos, las cajas y rótulos mantienen matrices locales estáticas y los cambios de estadísticas dejan de reconstruir los racks. Los guardados periódicos de estadísticas esperan tiempo libre; las acciones siguen guardando inmediatamente.
- Render y memoria: materiales e instancias se conservan al cambiar colores de energía, rótulos de Portátil/Bajo usan lienzos de 512 px y las partículas usan un buffer directo. Medio/Alto conservan geometrías, luces, materiales y sus presupuestos visuales.
- Carga: cada zona prepara primero arquitectura y después contenido con prioridades de React y tiempo libre del navegador. Las texturas se suben en lotes de cuatro; la compilación asíncrona prepara variantes de iluminación de transición y de la sala aislada. Los recursos se conservan para revisitas y se detienen las animaciones ocultas. Si la preparación no ha terminado, el jugador espera antes del umbral, con estado de carga visible. Un fallo de precalentamiento permite el render normal y deja un aviso en consola.
- Portátil/Automático: objetivo de render de 60 FPS y máximo de 1,2 millones de píxeles; resolución nativa si cabe. Dos ventanas lentas de 4 s reducen escala hasta 0,7. Con presión persistente se pasa a sombras de 4/2 Hz y menos polvo; cinco ventanas rápidas recuperan primero detalle y luego resolución. Hay al menos 12 s entre cambios. No se evalúan pausas, menús, preparación de salas ni inferencia. No se recrean mapas de sombra al adaptar.
- Motores: WebGL 2 es el valor conservador inicial; WebGPU sigue disponible en Ajustes o con `?renderer=webgpu`, con fallback a WebGL 2 si no inicia. Se solicita GPU de alto rendimiento, una preferencia que el navegador puede ignorar. No se afirma que WebGL 2 gane en la RTX 3050: la comparación en ese equipo está pendiente. No hay cambios de motor en caliente.
- IA: no cambia el consentimiento ni se importa el runtime de inferencia fuera del Worker. No se inicia un Worker para preparar gráficos. Cerrar el terminal libera la IA; durante carga/inferencia el render sigue limitado a 10 FPS.
- Métricas: se añaden pico, cuadros de más de 50 ms, tiempo CPU/envío, límite de FPS, presupuesto de sombras, margen del heap JS y RAM aproximada si existen esas APIs. El margen del heap no es RAM libre del equipo y ninguna de esas cifras equivale a VRAM libre. La preparación explícita puede alargar la pantalla inicial a cambio de anticipar trabajo del primer recorrido; no se ha medido su duración.

## Comprobación manual en RTX 3050 Laptop de 4 GB

1. Empezar con PORTÁTIL, WebGL 2, IA liberada y métricas activadas. Medio y Alto permiten después comparar calidad sin tocar sus presupuestos.
2. Recorrer las tres salas, atravesar puertas, recoger documentos, resolver puzles, volver atrás y recargar checkpoints de laboratorio/núcleo. Comprobar que la preparación no permite entrar en geometría sin cargar ni bloquea permanentemente una salida.
3. Repetir el mismo recorrido con WebGPU y el mismo perfil, tamaño de ventana y alimentación. Hacer primero una pasada de carga y después comparar p95, pico y cuadros >50 ms, sin mezclar resultados de primera compilación con recorrido caliente. Elegir el motor con menos tirones, no solo más FPS.
4. Si Portátil mantiene margen, probar Medio. Si hay presión persistente, observar el DPR y la frecuencia de sombras; comprobar que se recuperan lentamente y que Alto conserva su detalle. Una pantalla limitada a 30 Hz puede impedir alcanzar el objetivo de 60 FPS aunque la GPU tenga margen.
5. Activar y liberar la IA por separado, abrir/cerrar pausa y ocultar la pestaña. Revisar ambos finales y el guardado. Las pruebas automáticas existentes se han actualizado/preparado, pero no se han ejecutado en esta iteración.

## Historial: mediciones documentadas el 26 de octubre de 2026

El bloque siguiente conserva la documentación anterior. Sus cifras corresponden a otra iteración y no validan los cambios del 28 de octubre, el nuevo límite de 60 FPS ni la RTX 3050 del usuario.

Cambios locales, sin publicar. Objetivo de esta iteración: p95 inferior a 33,3 ms en las cámaras de prueba con el perfil Portátil; no es una promesa de 60 FPS en cualquier equipo.

## Medición

Chrome 155.0.8059.85 headless, Windows, aceleración real Intel gen-12lp; WebGL 2 identifica ANGLE / Intel UHD Graphics / D3D11. Ventana CSS de 1920×1080, DPR del dispositivo emulado a 2, sin limitación artificial de CPU en los benchmarks. WebGPU se habilita en este entorno headless con `--enable-unsafe-webgpu`. No equivale a probar una pantalla física ni el portátil del usuario.

Build de producción servido por Vite Preview. Tres checkpoints explícitos, girando la cámara del jugador con el teclado. Cada celda representa la mediana de **tres ejecuciones de seis segundos**, precedidas por cuatro segundos de giro. Son fixtures de rendimiento, no recorridos de jugabilidad. Panel opcional cerrado, IA apagada, contexto nuevo por ejecución. Antes y después: mismo navegador, resolución y dispositivo. Medio conserva DPR 1,15 y efectos; Portátil renderiza a DPR 0,761 en este viewport: 1,2 millones de píxeles frente a 2,74 millones.

| Renderer / zona | Antes Medio: FPS / p95 ms | Después Medio: FPS / p95 ms | Después Portátil: FPS / p95 ms |
| --- | ---: | ---: | ---: |
| WebGPU / Contención | 42,1 / 46,8 | 50,8 / 41,3 | 97,2 / 22,1 |
| WebGPU / Laboratorio | 24,4 / 157,6 | 40,6 / 46,6 | 83,5 / 23,3 |
| WebGPU / Núcleo | 45,6 / 44,4 | 49,8 / 37,7 | 105,2 / 18,9 |
| WebGL 2 / Contención | 48,6 / 27,6 | 69,3 / 19,2 | 127,5 / 10,4 |
| WebGL 2 / Laboratorio | 47,6 / 27,4 | 53,0 / 25,4 | 81,8 / 15,4 |
| WebGL 2 / Núcleo | 38,7 / 34,6 | 56,5 / 20,7 | 111,1 / 11,3 |

Draw calls medianos de Portátil frente al Medio original: WebGPU 126→83, 255→140 y 177→91; WebGL 2 123→75, 247→128 y 167→81. Incluyen sombras; un cuadro que actualiza sombras tiene más llamadas que uno que reutiliza el mapa. Medio mantiene prácticamente los mismos draw calls.

Hay variación entre muestras: por ejemplo, el p95 original del laboratorio WebGPU oscila entre 138,5 y 185,1 ms; el nuevo Medio, entre 45,8 y 65,4 ms. Una captura adicional con perfilador de CPU dio 44,6 FPS antes y 36,1 después en esa zona: **no demuestra una mejora universal a igual calidad**. Son pruebas cortas, no un ensayo con temperatura/frecuencias controladas. La reducción consistente y mayor procede del presupuesto explícito de Portátil. No atribuir toda la ganancia a una optimización de código.

Las muestras que coincidieron brevemente con otro navegador de prueba se excluyeron: se repitieron aisladamente los tres ensayos de Núcleo/Medio/WebGL y Contención/Portátil/WebGPU. Los JSON originales, reemplazos y comparación están en `outputs/PERF-*.json` y `outputs/PERFORMANCE-COMPARISON.json`, ignorados por Git.

## Cuellos de botella y cambios

- **Píxeles y sombras:** la ablación inicial de diez segundos bajó únicamente el DPR de 1,15 a 0,75: p95 WebGPU 42,4→28,1 ms. Desactivar sombras redujo las llamadas medianas de 149 a 89. Son diagnósticos de una sola muestra con perfilador, separados de la tabla anterior. Portátil limita DPR/píxeles, usa sombras de 512 px a 8 Hz, 72 partículas y elimina haces, campo TSL y bump del suelo. Conserva geometría, iluminación, reflejos aproximados, interacciones y animaciones del juego.
- **Oscilación del automático:** en 40 s, el original alternó tres veces Bajo/Medio en cada checkpoint WebGPU. Se observaron pausas máximas de 1,88 s y 2,72 s, sin atribuir todas a una única causa. Ahora solo varía el DPR, en ventanas de 4 s: dos lentas para reducir, cinco rápidas para recuperar, con separación mínima de 12 s. No recompila materiales ni recrea mapas de sombra al adaptarse.
- **Trabajo invisible:** las cuatro raíces de zona omiten actualización de matrices mientras están ocultas. El raycasting excluye esos subárboles antes de buscar impactos, conservando oclusores y el hit invisible del terminal. Las animaciones comprueban visibilidad; se corrigió la actualización del halo antes de esa comprobación. Laboratorio y núcleo preparan geometrías al acercarse y se conservan después para volver sin recargarlas. Los recursos globales de Room permanecen montados.
- **Recursos:** en Contención/Medio, el checkpoint completo pasa de 415 a 338 meshes CPU, de 282 a 242 materiales y de 57 a 47 texturas de escena al posponer el núcleo. No son contadores de VRAM ni un recorte del escenario visible. La captura perfilada del laboratorio no detectó geometrías creadas/destruidas continuamente ni antes ni después: no se añadió un pool o una nueva dependencia. World se memoiza para aislarlo de cambios del HUD; sus suscripciones propias siguen actualizando el juego.
- **Telemetría:** FPS, media y p95 de intervalos entre renders completados, DPR, draw calls, triángulos, backend y memoria disponible en las APIs existentes. Ventana de aproximadamente un segundo, muestras acotadas y reiniciadas tras pausas/ocultación. No mide tiempo exclusivo de GPU, utilización porcentual ni VRAM total.
- **IA:** el Worker, su chunk de 6,15 MB y los pesos permanecen sin cargar en los checkpoints de ambos backends. No se cambió la activación voluntaria ni el presupuesto de 10 FPS durante inferencia.

En la captura adicional del núcleo, las llamadas a `updateMatrixWorld` bajaron de aproximadamente **1595 a 731 por cuadro** (54 %). El FPS perfilado apenas cambió, 55,9→55,3: reducir ese trabajo CPU no elimina por sí solo el límite gráfico observado. Tres ciclos adicionales de cámaras por las tres salas en Medio estabilizaron los recursos en 167 geometrías, 70 texturas y 132,70 MiB contabilizados por el renderer; heap JS tras GC: 19,86 / 19,97 / 19,98 MiB. Son fixtures de cámara y contadores del motor, no VRAM total ni una prueba prolongada de ausencia de fugas.

En Automático, los ensayos nuevos de 40 s no cambiaron de perfil ni DPR. WebGPU: p95 23,0 ms en Contención y 23,9 ms en Laboratorio; máximos 35,7 y **238 ms**. WebGL 2: p95 10,6 y 14,5 ms; máximos 18,8 y 31,5 ms. El pico de 238 ms sigue pendiente de reproducir y atribuir en el portátil real: no se oculta tras una media ni se declara resuelto.

Regresión ejecutada: build con TypeScript, lint y 41 pruebas; recorridos completos de conservación/WebGPU y borrado/WebGL 2, incluidos los siete documentos, tres puzles, errores deliberados, pistas, recarga y finales persistentes. Ida y vuelta física desde el núcleo al terminal inicial. Pruebas de controles gráficos, render detenido en pausa, fallback automático sin `navigator.gpu` y ajustes táctiles emulados a 390 px. La prueba sintética CDP CPU×24 redujo el DPR a los 8,5 y 25 s sin reconstruir el perfil; no se incluye como rendimiento real en la tabla.

## Reproducir

```sh
npm ci
npm run build
npm run preview
# Otra terminal; requiere Python, Playwright y Chrome instalado:
python tests/performance_benchmark.py --label medium --quality medium --runs 3 --seconds 6 --warmup 4
python tests/performance_benchmark.py --label laptop --quality laptop --runs 3 --seconds 6 --warmup 4
python tests/performance_benchmark.py --label auto --quality auto --zones containment,lab --runs 1 --seconds 40 --warmup 4
python tests/performance_benchmark.py --label memory --quality medium --zones core --renderers webgpu --runs 1 --memory-cycles 3
python tests/performance_ui.py
```

Instalar Playwright solo para QA si falta: `python -m pip install playwright`. No se incorpora al juego. `--profile` activa una captura CDP de CPU y contadores por callback; medirla aparte, porque introduce sobrecoste. `--screenshots` captura cámaras reales fuera de la muestra temporal. `--cpu-rate` aplica estrés sintético, que nunca debe presentarse como rendimiento del portátil.

En el portátil: conectar alimentación, cerrar otras aplicaciones gráficas, conservar tamaño de ventana y estado térmico similares entre comparaciones. Ejecutar las dos primeras órdenes de benchmark con las mismas dimensiones; por ejemplo, añadir `--width 1366 --height 768` a ambas. Para una comprobación rápida sin Python: Ajustes → PORTÁTIL → activar métricas, recorrer las tres salas y repetir el mismo trayecto con Medio; anotar FPS, p95, DPR y renderer. `?renderer=webgl` permite comparar el fallback. No activar IA durante la comparación.

## Mejora gráfica y agrupación de arquitectura · 29 de octubre de 2026

Esta pasada sí ejecuta validación y mediciones nuevas sobre la copia local, conservando el trabajo previo. `Room.tsx` agrupa 35 piezas fijas en tres mallas instanciadas, manteniendo sus posiciones y sombras. `materials.ts` añade desgaste, juntas con relieve visual y mapas de oclusión de contacto de 256 px para los tres suelos; `StoryRooms.tsx` aplica los mapas en laboratorio y núcleo. Los mapas se crean una vez y se liberan al desmontar. No hay assets externos, dependencias nuevas ni nuevos pases de renderizado. La oclusión es precalculada para mobiliario fijo: si cambia su ubicación hay que actualizar sus huellas.

Comparación del build compilado: Chrome 156.0.8078.48 headless, Intel UHD, 1920 × 1080, DPR solicitado 2 / interno 1,15, calidad Medio, cámara girando, partidas de prueba con zonas desbloqueadas. Dos repeticiones por renderer y zona, 3 s de calentamiento y 5 s de muestra. Se mantiene `--profile` en ambas versiones; su instrumentación introduce sobrecoste. Los valores son medias de las dos repeticiones, no una garantía de FPS ni un recorrido manual.

| Renderer / zona | FPS antes → después | p95 ms antes → después | Llamadas de dibujo antes → después |
| --- | --- | --- | --- |
| WebGPU / Contención | 52,51 → 54,73 | 42,55 → 40,25 | 135 → 114 |
| WebGPU / Laboratorio | 44,84 → 47,16 | 45,80 → 42,25 | 292,5 → 274,5 |
| WebGPU / Núcleo | 58,54 → 58,64 | 35,95 → 35,70 | 193,5 → 193 |
| WebGL 2 / Contención | 66,74 → 66,52 | 19,00 → 19,15 | 133,5 → 112 |
| WebGL 2 / Laboratorio | 50,63 → 50,31 | 26,35 → 26,55 | 274 → 240,5 |
| WebGL 2 / Núcleo | 53,08 → 53,91 | 23,80 → 22,90 | 183,5 → 183,5 |

La reducción reproducible está en las llamadas de dibujo de Contención (aproximadamente 16 %) y en las mallas presentes (462 → 430). Los FPS de WebGL 2 se mantienen prácticamente iguales; no se declara una mejora general de fluidez. La pasada intermedia con solo instancing queda en `outputs/PERF-graphics-batched.json`, para separar su efecto del acabado visual. La versión final añade tres texturas y puede enviar más triángulos visibles al agrupar objetos bajo un mismo volumen de culling. Los benchmarks no detectan creación/destrucción de geometrías durante la muestra ni inicialización del worker del modelo sin consentimiento.

Evidencia local, excluida de Git: `outputs/PERF-graphics-before.json`, `outputs/PERF-graphics-final.json` y capturas `outputs/graphics-{renderer}-{zone}.png`. Estas últimas usan cámaras fijas, simulación pausada y HUD oculto solo durante la captura; no demuestran un recorrido jugable. Reproducción:

```sh
python tests/performance_benchmark.py --label graphics-final --runs 2 --seconds 5 --warmup 3 --profile --screenshots
python tests/graphics_ui.py
python tests/performance_ui.py
```

Typecheck, lint, 58 tests de Vitest, build, licencias y auditoría local de release: PASS. La comprobación de release es estática y no valida producción. El escáner mecánico de diseño no detecta incidencias en los tres archivos gráficos modificados.

`graphics_ui.py`: PASS en WebGPU y WebGL 2; verifica colocación de instancias, tres mapas independientes, píxeles de contacto/bordes y reanudación, sin errores de consola ni peticiones externas. `performance_ui.py`: PASS en ambos renderers, perfiles de calidad, suspensión al pausar, sombras de Portátil a 8 Hz, adaptación de escala bajo estrés sintético CDP ×24 y fallback móvil emulado a 390 px sin desbordamiento. La emulación y el estrés no equivalen a pruebas físicas de móvil o portátil. No se ha vuelto a recorrer la campaña completa ni probado inferencia real en esta pasada.

## Instalación viva · validación del 29 de octubre de 2026

Las palancas físicas, los soportes ópticos, las señales de energía y los fragmentos de memoria conservan los perfiles existentes. El render usa 449 mallas en escena frente a 430 de la pasada gráfica anterior; sigue por debajo de las 462 originales. Hay dos texturas de rótulos adicionales y tres luces con sombras, como antes. No se añaden pases de postprocesado ni descargas. El build crece 5.398 bytes sin comprimir respecto a esa pasada (8.342.489 bytes totales, incluido el worker opcional sin cambios).

La primera serie `outputs/PERF-living-final.json` se conserva solo como diagnóstico: la vista previa abierta estaba renderizando a la vez y se suspendió durante la serie. Sus FPS no son una comparación controlada. La serie válida es `outputs/PERF-living-controlled.json`: vista previa en fase `technical` sin render continuo, mismo equipo y configuración de la tabla anterior, dos repeticiones por sala/renderer con `--profile`, calentamiento de 3 s y muestras de 5 s. Referencia: `outputs/PERF-graphics-final.json`.

| Renderer / zona | FPS anterior → actual | p95 ms anterior → actual | Llamadas de dibujo anterior → actual |
| --- | --- | --- | --- |
| WebGPU / Contención | 54,73 → 54,63 | 40,25 → 39,00 | 114 → 116,5 |
| WebGPU / Laboratorio | 47,16 → 46,24 | 42,25 → 41,30 | 274,5 → 280 |
| WebGPU / Núcleo | 58,64 → 58,44 | 35,70 → 35,60 | 193 → 196,5 |
| WebGL 2 / Contención | 66,52 → 67,22 | 19,15 → 18,45 | 112 → 114 |
| WebGL 2 / Laboratorio | 50,31 → 51,25 | 26,55 → 25,95 | 240,5 → 250 |
| WebGL 2 / Núcleo | 53,91 → 53,36 | 22,90 → 23,15 | 183,5 → 184,5 |

El coste gráfico aumenta ligeramente y los FPS medios se mantienen próximos en estas muestras. No se declara una mejora de velocidad ni 60 FPS estables en todos los equipos. Los doce casos no registran errores de página, worker del modelo ni creación/destrucción de geometría durante la muestra. Los resultados siguen siendo headless y con cámaras de prueba, no un recorrido físico ni una medida de VRAM o consumo energético.

Validación: typecheck, lint, 63 tests de Vitest, build, licencias y release local PASS. `physical_ui.py` verifica el suministro en el build compilado, con interacción por raycasting y panel compartido; `escape_ui.py` verifica la óptica, reguladores y llegada a completado en ambos finales con encuadres distintos, en WebGL 2 y WebGPU. Esta última usa el servidor de desarrollo y checkpoints explícitos. `graphics_ui.py` verifica los tres mapas de contacto y las instancias en el build compilado; capturas de las tres salas en ambos renderers. No hay descargas externas en estas pruebas.

## Alcance pendiente

No se ha probado el portátil concreto, Safari, Firefox, una batería ni un móvil físico. Headless permite FPS mayores que la frecuencia de una pantalla. Los p95 mejoran, pero siguen existiendo picos aislados y costes de primera compilación; no se declara que todo tirón haya desaparecido. Los snapshots de heap JS y los contadores de recursos no equivalen a una prueba prolongada de fugas de VRAM. La inferencia real no se vuelve a validar en esta iteración: sí su ausencia de carga automática y el modo determinista. No se ha desplegado ni hecho commit.
