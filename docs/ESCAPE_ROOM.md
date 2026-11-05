# Escape room de Lazarus

Implementación local sobre las tres zonas y los dos finales existentes. No implica publicación ni aprobación de dificultad con jugadores nuevos.

## Diseño y alcance

La instalación industrial y su interfaz de archivo mantienen su identidad. El jugador investiga, plantea una hipótesis y observa el resultado. Los objetivos describen obstáculos; las pistas opcionales explican progresivamente dónde buscar y qué relación interpretar. Ninguna deducción exige descargar el modelo.

| Zona | Investigación | Resultado observable |
| --- | --- | --- |
| Contención | Credencial y reloj para la taquilla; celda y fusible para el arranque; prioridad de servicios frente al archivo | Arranque estable, reactor activo y autorización de compuerta |
| Laboratorio | Relación C—R—A y consumo actual; manivela, lente y recorrido óptico. Ambas investigaciones pueden completarse en cualquier orden | Reguladores y cultivos estabilizados; rayo visible, receptor humano y oblea. La esclusa necesita ambos sistemas |
| Núcleo | Contrastar copia, encierro y corte con la firma independiente; decidir quién conserva autoridad | Cronología validada; circuito físico de custodia o aislamiento; confirmación humana y salida auxiliar |

La hora del cierre fue sobrescrita. El registro del lote C17 y su huella en la orden demuestran una dependencia; la portadora que transportó la confirmación desapareció con el corte. El jugador reconstruye el orden a partir de estas relaciones. La versión de ECHO queda separada visualmente de los documentos y del lector independiente. Las diecisiete voces y la nota opcional para Mara aportan contexto humano sin afirmar consciencia ni consentimiento colectivo.

## Cambios implementados

- Objetivos sin instrucciones de montaje ni ubicaciones de soluciones; tutorial limitado a controles.
- Errores que describen lecturas o inconsistencias sin entregar fórmulas ni secuencias completas.
- Pistas de tres niveles por sistema. Los mecanismos solicitan ayuda sobre su propia investigación; los sistemas resueltos o inaccesibles no consumen pistas.
- Reguladores ajustables con R ante el objeto y con controles accesibles en su panel; comprobador local sin regresar al terminal.
- Espejos girables con E ante el objeto y desde el panel. El recorrido del rayo se calcula con la misma función para el escenario y el esquema accesible.
- Diario con dos documentos comparables, estado vacío y evidencia independiente solo tras insertar la oblea. También disponible dentro de la reconstrucción del núcleo.
- Calibración válida por solución observada, sin exigir abrir documentos. La investigación narrativa conserva sus pruebas obligatorias.
- Confirmación del desenlace desde el mando independiente o el terminal, con las mismas reglas y advertencia irreversible. Ambas rutas conservan salida auxiliar.
- Señales de éxito para suministro, custodia y cronología, sin nuevas luces dinámicas ni efectos obligatorios.
- IA opcional con contexto actualizado según pruebas descubiertas, sin una hora de cierre inventada.

## Instalación viva · 29 de octubre de 2026

La evolución aprobada conecta los mandos con el escenario:

- El distribuidor incorpora tres palancas y un botón de arranque manipulables mediante la interacción 3D habitual. El panel accesible comparte su selección provisional, que persiste al cerrar el panel durante la sesión. Solo la configuración validada y los componentes instalados cambian el progreso guardado. Después del arranque, los mandos muestran el bloqueo y conservan la selección correcta.
- El núcleo del reactor gana intensidad gradualmente y las guías de suelo muestran el recorrido de energía en Medio/Alto con efectos activados. Pausa, zonas ocultas y movimiento reducido detienen esa animación. Cargar una partida ya energizada no repite el pulso de arranque.
- El banco óptico muestra soportes de espejo, carriles, emisor y dos receptores. El haz instanciado sigue `traceBeam`; sus segmentos no bloquean el raycasting de los espejos.
- El laboratorio cambia su acento al estabilizarse. Diecisiete fragmentos de memoria orbitan en el archivo; la custodia los conserva con luz cálida y el aislamiento los retira, reduce la iluminación del núcleo y mantiene la salida visible. Cada final tiene una composición de cámara propia.
- El ambiente sonoro cambia de registro entre salas con los filtros de Web Audio ya existentes. Las palancas tienen una respuesta mecánica breve; se conserva silencio, pausa y volumen del sistema.

No se modifica el formato persistido ni se añaden dependencias, modelos, sonidos descargados o luces con sombras. La selección de palancas es estado de sesión; al recargar sin haber validado el arranque vuelve al estado inicial. Las partidas antiguas con arranque validado muestran las líneas correctas.

`tests/physical-controls.test.ts` cubre selección compartida, contexto físico, validación y bloqueo. `tests/physical_ui.py` verifica palancas reales por raycasting, instalación, intento incorrecto, arranque y panel compartido en el build compilado. `tests/escape_ui.py` añade los dos encuadres finales y la llegada al estado completado; usa checkpoints y cámaras de prueba, no representa una partida completa de un jugador nuevo.

## Compatibilidad y límites

No se cambia el esquema de guardado ni se reinician partidas. La restauración acepta óptica completada antes del circuito y circuitos resueltos sin documentos abiertos; conserva las comprobaciones del resto de prerrequisitos y los finales antiguos. No se añaden dependencias, servicios, cuentas ni costes recurrentes.

La interacción 3D mantiene alternativas mediante botones, selects, teclado y toque. El diario se apila en pantallas estrechas. Se conserva movimiento reducido y la transparencia de la descarga e inferencia en la interfaz dedicada a IA y en Behind the System.

## Plan de ejecución y validación

1. Probar reglas, investigación en paralelo, ajustes inválidos, checkpoints y las dos rutas finales con Vitest.
2. Integrar comparación de pruebas, controles físicos y confirmación local manteniendo paneles accesibles.
3. Actualizar el recorrido de navegador para los seis mecanismos; probar ambos desenlaces sin IA y registrar capturas locales.
4. Ejecutar typecheck, lint, tests, build y check:release. Distinguir navegador automatizado de pruebas humanas o de dispositivos físicos.

## Pendiente de investigación con jugadores

Observar inicialmente cinco partidas de personas que no conozcan las soluciones. Anotar tiempo por sala, primer bloqueo, hipótesis antes de cada intento, pistas solicitadas y comprensión del desenlace. Preguntar por qué funcionó cada mecanismo. Ajustar la dificultad a partir de estas observaciones; no presentar los 15–20 minutos como una duración medida.

Durante la observación, no explicar las soluciones: usar las pistas del juego cuando se soliciten. Distinguir un fallo de controles o de visibilidad de una deducción pendiente. Al terminar, pedir que expliquen qué prueba contradice a ECHO, por qué funcionó cada mecanismo y qué diferencia hay entre conservar y borrar. Registrar por sesión dispositivo, motor gráfico, bloqueos, ayudas y respuestas; priorizar los bloqueos repetidos antes de añadir contenido.

El pulido final mantiene la ayuda en Contención hasta autorizar la primera compuerta, orienta a la confirmación cuando el circuito final ya está preparado y retira los controles de reconfiguración después de ejecutar la decisión.

No se añaden más salas, candados de relleno, cuenta atrás obligatoria ni penalizaciones por pedir ayuda. La publicación requiere autorización explícita.
