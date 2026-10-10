# Hoja de ruta del ecosistema MCP de Rocking

**Estado:** cartera de hipótesis para investigación y priorización. No implica compromiso de construir todos los proyectos. La secuencia aprobada es V1 de canales de servidor primero y V2 de historial completo de DMs personales después; V1 no completa el objetivo final.
**Propósito:** explorar herramientas abiertas cercanas a Discord MCP y a los límites de seguridad de agentes, sin diluir la validación del producto inicial.

## Método de puntuación

Cada idea recibe cuatro puntuaciones ordinales de 1 a 5: **impacto hipotético** para un usuario definido, **ajuste técnico** con las capacidades del equipo/ecosistema, **confianza en la necesidad** basada en evidencia ya disponible y **riesgo/coste de seguridad-operación** (5 = riesgo alto). La confianza inicial es baja porque todavía no hay entrevistas, uso ni análisis comparativo registrados; una puntuación alta de impacto o ajuste es una hipótesis, no una medición de mercado.

Índice de exploración = impacto + ajuste + confianza − riesgo. Sirve solo para decidir qué hipótesis investigar primero. No representa TAM, demanda, probabilidad de éxito ni retorno financiero. Revisar las puntuaciones después de entrevistas, prototipos y experimentos; conservar el historial de evidencia y el motivo de cada cambio.

| Orden inicial | Idea adyacente | Usuario y problema hipotético | Impacto | Ajuste | Confianza | Riesgo | Índice | Evidencia que falta |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | **Discord MCP: matriz de permisos y lector de canales con bot oficial** (V1 aprobada) | Desarrollador que necesita que un cliente MCP lea solo canales concedidos y pueda explicar el alcance. | 5 | 5 | 1 | 4 | 7 | Validar de punta a punta configuración, instalación, permisos/intents mínimos, límites y demanda. Este hito no cierra V2. |
| 2 | **Discord Access Auditor MCP** | Administrador que necesita comparar permisos concedidos y canales visibles con una política esperada. | 4 | 4 | 1 | 3 | 6 | Validar que las APIs oficiales expongan datos suficientes sin scopes excesivos; probar resultados comprensibles con admins. |
| 3 | **MCP Policy Linter para herramientas y scopes** | Mantenedor que quiere detectar herramientas con descripciones demasiado amplias, permisos sobrantes o falta de límites antes de publicar. | 4 | 4 | 1 | 2 | 7 | Definir reglas basadas en especificaciones y casos reales; medir falsos positivos y falsos negativos con revisores externos. |
| 4 | **Local MCP Audit Trail / consent viewer** | Usuario que busca ver qué herramienta llamó el agente, cuándo y qué recurso se autorizó, sin guardar cuerpos sensibles. | 4 | 3 | 1 | 3 | 5 | Investigar formatos de logs de clientes, amenaza de manipulación local y configuración de retención que usuarios entiendan. |
| 5 | **Secret and config scanner for MCP projects** | Desarrollador que quiere bloquear publicación accidental de tokens, URLs privadas y configuraciones inseguras en repos MCP. | 4 | 4 | 2 | 3 | 7 | Inventariar scanners existentes antes de crear otro; comparar detección, integración CI y falsos positivos sobre fixtures públicos/sintéticos. |
| 6 | **Redaction boundary proxy for MCP** | Equipo que quiere filtrar datos identificadores antes de pasar resultados de herramientas a un modelo externo. | 5 | 3 | 1 | 5 | 4 | Validar si la transformación rompe tareas, qué datos deben preservarse, y si el proxy puede prometer límites demostrables. Riesgo alto por falsa sensación de anonimización. |

El orden no es una recomendación de construir ya: las ideas 1, 2 y 3 comparten aprendizajes de permisos y policy, mientras que 4–6 requieren validaciones independientes. El análisis de scanners existentes de la idea 5 es una puerta previa a cualquier prototipo para evitar duplicación sin valor demostrado.

## Gates comunes

### Gate 0 — evidencia del problema

Antes de prototipar: definir usuario y tarea concreta; realizar entrevistas consentidas y registrar necesidad, solución actual, frecuencia declarada e impacto cualitativo; revisar herramientas existentes mediante documentación primaria y repositorios; anotar fecha y cobertura de la búsqueda. No registrar mensajes privados de Discord ni recolectar datos de usuarios sin necesidad y consentimiento. **Avanza** si al menos tres personas independientes pueden describir la misma tarea y aceptar revisar un prototipo; este umbral es una regla de aprendizaje inicial, no prueba de mercado.

**Detener o replantear** si la necesidad depende de automatizar cuentas personales de Discord fuera de OAuth2/bot API, de permisos no disponibles, de recopilar mensajes sin finalidad declarada, o si una herramienta existente resuelve el caso con menor superficie y mantenimiento.

### Gate 1 — prototipo seguro y estrecho

Construir el camino mínimo tras revisión de amenazas, scopes, límites de datos, autorización y revocación. Probar solo con datos sintéticos y cuentas/servidores de prueba consentidos. Registrar errores y casos fuera de alcance. No desplegar como servicio compartido ni anunciar soporte amplio a partir de pruebas unitarias.

**Avanza** cuando la tarea central tiene un criterio de aceptación reproducible, la matriz de permisos coincide con el comportamiento observado, y un revisor externo puede instalarlo y explicar qué datos procesa. **Detener** ante acceso no autorizado, exposición de secreto, uso de API no permitido, riesgo de que la salida se interprete como dato confiable cuando no lo es, o necesidad de permisos desproporcionados.

### Gate 2 — piloto opt-in

Invitar a un grupo pequeño de usuarios que entiendan el estado experimental. La telemetría queda apagada por defecto; recopilar éxito/fallo y contexto solo mediante reporte opt-in, sin contenidos o IDs de Discord. Definir soporte, rollback y proceso de incidentes antes de invitar.

**Avanza** si el porcentaje de éxito del flujo soportado es al menos 70% sobre diez o más ejecuciones consentidas, no hay incidentes de seguridad abiertos, y dos usuarios externos pueden completar el flujo sin asistencia directa. Si no se alcanza el denominador, el resultado es “evidencia insuficiente”. **Detener o limitar** si aparece un incidente grave, el soporte excede capacidad disponible, o la métrica solo puede calcularse recogiendo más datos de los necesarios.

### Gate 3 — mantenimiento o retiro

Después de 30 días de piloto, decidir entre mantener, integrar, archivar o retirar. Publicar compatibilidad probada, limitaciones conocidas, política de soporte y ruta de reporte. Medir uso con fuentes consentidas y denominadores; las descargas/clones no se tratan como usuarios activos. Ningún proyecto pasa a “mantenido” sin responsable, capacidad declarada y mecanismo de actualización de dependencias.

## Secuencia propuesta

1. Completar y validar V1 de punta a punta para canales de servidor autorizados. Mantener V2 como el siguiente objetivo aprobado: historial completo de DMs personales y conversaciones existentes, no mensajes seleccionados. V2 solo avanza con una vía permitida y oficialmente autorizada cuando corresponda, cobertura histórica demostrada y aceptación real. Los DMs del bot no satisfacen V2.
2. Ejecutar Gate 0 en la matriz/auditor de permisos y el linter, porque pueden validar necesidades cercanas con prototipos sin ampliar el acceso a contenido de Discord.
3. Investigar el scanner MCP antes de construir. Si un proyecto activo cubre el caso de forma adecuada, contribuir o documentar el gap restante en vez de duplicar.
4. Mantener audit trail, redaction proxy y cualquier integración más amplia en descubrimiento hasta probar demanda, amenazas, carga de soporte y límites de privacidad.

## Aspiración de cobertura total

“Cubrir el 100% del mercado” queda como aspiración no medible mientras no se definan mercado, población elegible, geografía, período, categoría de uso, usuarios activos y fuente de denominador. No usarlo como KPI ni claim externo. Una alternativa medible tras investigación sería “porcentaje de tareas definidas y probadas que el producto soporta”, con catálogo de tareas, criterios, fecha, versiones y casos excluidos publicados. Eso mide cobertura del catálogo acordado, no cuota de mercado.
