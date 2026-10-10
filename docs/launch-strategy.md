# Estrategia de lanzamiento y distribución

**Estado:** borrador operativo para revisión. No autoriza ni ejecuta publicaciones externas. La versión declarada por el paquete es `0.1.0-alpha.1`; la instalación local todavía no tiene validación de extremo a extremo.
**Alcance:** MCP abierto para Discord, con seguridad como criterio de producto y una presencia liderada por X.

## Tesis y posicionamiento

El problema que vale la pena probar no es “conectar Discord con un LLM” en abstracto. Es ofrecer una interfaz MCP pequeña y revisable para que una persona use herramientas de IA con acceso a Discord delimitado, comprensible y revocable. La hipótesis inicial es que desarrolladores de MCP, mantenedores de comunidades y equipos técnicos que ya usan Discord valorarán más poder inspeccionar el límite de acceso y la procedencia de cada operación que sumar una larga lista de herramientas.

La propuesta se expresa como criterios verificables, no como una afirmación de superioridad frente a competidores: alcance de permisos mínimo; herramientas y operaciones documentadas; configuración local y auditable; mensajes no usados para analítica ni entrenamiento; límites claros entre datos de servidor, canales y mensajes directos; y una matriz de capacidades que indique qué funciona bajo cada autorización. No hay una revisión comparativa de mercado que permita afirmar que otros wrappers carecen de estas propiedades.

Audiencia primaria: quienes construyen o adoptan clientes MCP y quieren consultar canales de Discord desde un entorno propio. Audiencia secundaria: administradores técnicos de comunidades que necesitan entender qué puede leer una integración y cómo retirarla. La comunicación será dirigida a personas técnicas; no se venderá como bot de moderación, asistente autónomo ni integración empresarial antes de validar esos usos.

**Secuencia aprobada:** V1 primero: validar de punta a punta el acceso a canales autorizados mediante la aplicación/bot oficial, desde configuración e instalación hasta lectura y, si se habilita, envío explícito. V1 es un hito intermedio; el estado local `0.1.0-alpha.1` aún no acredita esa aceptación. V2 tiene como objetivo el historial completo de los DMs personales existentes y sus conversaciones, no la selección manual de mensajes. La viabilidad, la autorización oficial, la cobertura histórica y la aceptación real de V2 siguen pendientes. No se lanzará el objetivo V2 como si estuviera resuelto ni se reemplazará por DMs del bot.

Discord documenta `dm_channels.read` como un scope que requiere aprobación y prohíbe automatizar cuentas normales fuera de la API OAuth2/bot; por eso no se diseñará un self-bot ni se presentará el acceso personal como disponible hasta tener evidencia oficial y técnica de una vía permitida ([OAuth2 de Discord](https://docs.discord.com/developers/topics/oauth2), [política sobre self-bots](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)).

## Canales y distribución

1. **X como canal editorial principal.** Publicar hilos breves con una sola idea: por qué se construye, qué puede leer el bot oficial, qué no se ha resuelto, una demo reproducible cuando exista, y cada cambio importante. Usar X para conversación y alcance; dirigir a una fuente canónica verificable (repositorio, release o documentación cuando existan). X permite redactar y guardar hilos como borradores, lo que facilita revisión previa ([guía oficial de hilos](https://help.x.com/en/using-x/create-a-thread)). No se comprará alcance ni se automatizarán respuestas o menciones.
2. **GitHub como fuente de verdad.** README, releases, issues y, si la comunidad lo necesita, Discussions: issues para defectos/tareas concretas y Discussions para preguntas abiertas, anuncios y conversación ([guía oficial de comunicación de GitHub](https://docs.github.com/en/get-started/using-github/communicating-on-github)). Cada publicación de X debe apuntar a una página real del proyecto y a evidencia versionada; no se inventarán URL de repositorio o release.
3. **Official MCP Registry.** Preparar `server.json` y publicar después de contar con paquete/versionado reproducible, namespace verificado y revisión de metadatos. El registry oficial sirve como catálogo de metadatos para consumidores y directorios posteriores; su documentación indica que está en preview y que pueden ocurrir cambios o reinicios. El registry no aloja el artefacto, por lo que publicación allí no sustituye la publicación del paquete ni la documentación de instalación ([quickstart oficial](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx), [estado y propósito](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)). La entrada no se anunciará como “aprobación” o certificación de seguridad.
4. **Comunidades de desarrolladores.** Compartir una demo o pedir revisión en espacios de MCP, GitHub y Discord solo cuando las reglas del espacio lo permitan y haya una pregunta concreta para la comunidad. No hacer cross-post idéntico en masa, no comprar membresías y no enviar DMs promocionales. Mantener soporte en GitHub para que preguntas y respuestas técnicas queden accesibles.
5. **Contenido técnico reutilizable.** Un ejemplo mínimo de instalación, modelo de amenazas, matriz de permisos y nota de compatibilidad son activos de descubrimiento. Prepararlos antes de ampliar distribución; cada uno debe describir versión, entorno probado y limitaciones observadas.

## Prerrequisitos de publicación

La comunicación de lanzamiento con lenguaje de disponibilidad queda bloqueada hasta que se cumplan estos puntos:

- El repositorio público contiene licencia, README, instalación reproducible, configuración de ejemplo sin secretos, contribución, código de conducta y canal de reporte de vulnerabilidades/abusos.
- Una revisión de seguridad cubre secretos y tokens, autorización, permisos Discord, límites por canal, filtrado de datos, errores, rate limits, prompt injection en contenido externo y tratamiento de adjuntos. El acceso se deniega por defecto y el alcance efectivo se puede inspeccionar.
- Se definen retención, registros y telemetría. Por defecto no se envían contenido, identificadores de usuarios, nombres de servidor/canal ni historial a un servicio central. Logs locales deben minimizar datos y evitar tokens.
- Se prueba instalación limpia, revocación/desinstalación, permisos insuficientes, canal no autorizado, rate limits y respuestas de error; los resultados identifican versión y entorno. La documentación separa pruebas locales, pruebas con Discord real y aceptación de usuarios.
- La ruta de acceso a canales mediante bot oficial está documentada con los intents y permisos requeridos. Los intents privilegiados se solicitan solo si la implementación los necesita y Discord los concede; no se publicita el soporte antes de validarlo.
- La ruta V2 de historial completo de DMs personales tiene una investigación y decisión documentadas: mecanismo oficial permitido, scopes/aprobaciones necesarias, cobertura de historial y conversaciones, limitaciones y aceptación. Si no aparece una vía permitida, V2 queda bloqueada y se informa así; no se usa un token de cuenta personal ni se cambia el requisito por DMs del bot o selección manual de mensajes.
- El anuncio de V1 identifica el alcance de canales como primer hito y declara que no completa el objetivo V2. No publicar mensajes que presenten `0.1.0-alpha.1` como validado o disponible desde npm.
- Los borradores de X pasan revisión contra el release real, sin claims de seguridad absoluta, compatibilidad universal, usuarios, descargas o capacidades no medidas. Publicar es una acción manual del responsable del proyecto.

## Métricas: definiciones, captura y cautela

El baseline de todos los indicadores es **desconocido** hasta registrar una primera ventana completa con fuente y fecha. “Desconocido” no equivale a cero. Un cero solo significa que una fuente consultada y disponible registró cero eventos en una ventana definida. No sumar números de impresiones, clones, visitas y descargas como si fueran personas únicas.

| Indicador | Definición y denominador | Fuente y ventana | Baseline |
|---|---|---|---|
| Alcance X | Impresiones reportadas por X por publicación; para interacción, (respuestas + reposts + likes) / impresiones. No deduplicar personas. | Analítica nativa por hilo a 7 días. | Desconocido hasta primera publicación. |
| Interés hacia el repositorio | Clics con UTM / impresiones de los posts que incluyen el enlace. Reportar también visitas de referencia y visitas totales por separado. | Analítica de X más métricas disponibles del sitio/hosting o proveedor de analítica con consentimiento, por 7 días. | Desconocido. |
| Activación técnica | Instalaciones verificadas que completan el ejemplo guiado / inicios de instalación que el usuario comparte voluntariamente. No inferir instalaciones desde clones de Git. | Encuesta opt-in corta o issue/discussion; revisión mensual. No recopilar telemetría silenciosa. | Desconocido. |
| Éxito de tarea | Ejecuciones de prueba aprobadas / ejecuciones intentadas, distinguiendo casos soportados y no soportados. | Suite automatizada versionada y prueba manual consentida; por release. | Registrar primera ejecución como baseline; no llamar a un caso no probado “fallo de usuario”. |
| Calidad de contribución | PRs aceptados / PRs cerrados en el periodo; reportar también tiempo mediano hasta primera respuesta solo si el historial permite calcularlo. | GitHub, mensual; excluir PRs aún abiertos del denominador. | Desconocido. |
| Incidentes de privacidad/seguridad | Conteo de incidentes confirmados y tiempo hasta contención. No se normaliza para minimizar impacto. | Registro privado de incidentes con acceso restringido; resumen público sanitizado si corresponde. | Desconocido; nunca presentar ausencia de reportes como prueba de ausencia de incidentes. |

**UTM y atribución:** una vez que exista una URL canónica real, etiquetar links de campañas con `utm_source` (`x`, `github`, `community`), `utm_medium` (`organic`, `discussion`, `release`), `utm_campaign` (`launch-YYYYMM` o un nombre documentado) y `utm_content` (id del hilo/variante). Guardar una tabla interna de fecha, URL, variante y destino. No incluir usuario, servidor, canal, mensaje ni otra información personal en parámetros. No afirmar atribución causal a partir de atribución de clics.

**Privacidad de medición:** preferir estadísticas agregadas de cada plataforma y datos que GitHub/X ya expongan a sus administradores. La instrumentación del producto será opt-in, apagada por defecto, sin cuerpo de mensajes ni identificadores Discord; explicar datos, propósito, retención y método de baja. Solicitudes de feedback no deben pedir contenido privado de Discord. Si no existe una fuente consentida para un denominador, reportar la métrica como no medible, no aproximarla con proxies.

## Cadencia experimental de 30/60/90 días

Los umbrales de abajo son hipótesis de decisión, no benchmarks de la industria. Ajustarlos después de conocer el volumen real y el coste de soporte. Si el requisito de DMs personales es bloqueante para el público objetivo, no compensar el bloqueo con métricas de alcance.

| Ventana | Experimento y salida | Señal para continuar (hipótesis) | Pausa o cambio |
|---|---|---|---|
| Días 0–30 | Cerrar gates de V1 de canales, preparar una demo revisable y un hilo X EN/ES que la describa como primer hito. Mantener investigación técnica de V2 separada. | Al menos 5 instalaciones voluntariamente reportadas por personas fuera del equipo y 3 completan el flujo de canales soportado; al menos 2 revisiones accionables de seguridad/usabilidad. | Si no se puede medir instalación con consentimiento, marcar activación como desconocida. Pausar mensaje de disponibilidad si falla una gate o el flujo de canales oficial sigue sin validar. |
| Días 31–60 | Cambiar una variable editorial por vez (problema/beneficio, demo/modelo de permisos, EN/ES), comparar por clics UTM y feedback de calidad. Corregir fricciones del onboarding. | Dos cohortes semanales con al menos 10 clics cada una y ≥20% de clics a instalación autoinformada; tratar el resultado como señal preliminar, no como conversión de mercado. | Si no se llega a denominador, extender sin declarar ganador. Si las dudas repetidas muestran una promesa mal entendida, reescribir antes de subir alcance. |
| Días 61–90 | Publicar una mejora basada en evidencia y un informe breve: qué se probó en V1, qué sigue abierto en V2, métricas con denominadores y cambios del roadmap. Probar una comunidad técnica adicional, una por vez. | Al menos 10 instalaciones reportadas acumuladas, ≥50% de éxito del flujo de canales documentado entre las reportadas, y 3 colaboradores externos con feedback o contribución útil. | Si el soporte excede la capacidad acordada, limitar nuevas invitaciones. Si no hay activación confiable, priorizar onboarding/compatibilidad sobre promoción. No presentar la investigación de V2 como historial personal disponible. |

Si los tamaños de muestra no se alcanzan, el resultado es “sin evidencia suficiente”, no fracaso ni éxito. No se cambiarán simultáneamente producto, canal y audiencia si luego se pretende atribuir la diferencia a una sola causa.

## Capacidad, operación y respuesta a incidentes

Asignar responsables, sin presuponer horas ni costos: mantenimiento técnico/release; respuesta de comunidad; revisión de seguridad y privacidad; y edición/publicación bilingüe. Antes de abrir invitaciones, publicar disponibilidad de soporte y tiempo objetivo de respuesta que el equipo pueda cumplir. Registrar la capacidad real y reducir el ritmo de difusión si la cola crece.

**Pausa inmediata de promoción y nuevas instalaciones** ante exposición de credenciales/datos, acceso fuera del alcance concedido, vulnerabilidad crítica explotable, señal creíble de automatización no autorizada, incumplimiento de términos de Discord, o discrepancia material entre el claim público y la capacidad liberada. Contener primero: retirar/rotar credenciales afectadas, detener releases/integraciones implicadas, preservar evidencia mínima sin copiar mensajes privados, notificar a responsables y seguir las obligaciones de Discord y leyes aplicables. Reanudar solo después de corregir, publicar una explicación proporcional y revisar el gate que falló.

## Borradores de hilos X para revisión

Son propuestas sobre la intención y el estado de investigación del proyecto. Antes de publicar, actualizar “estamos evaluando” si el estado cambió y añadir solo el enlace canónico real. No insertan un URL ficticio.

### English

1/ We’re building an open-source MCP server for Discord in two steps. V1 is the end-to-end path for authorized server channels. V2’s goal is complete history across a person’s existing DMs and conversations, subject to official feasibility and approval.

2/ V1 uses Discord’s official bot/app authorization for channels where the bot is installed and granted access. Scope and permissions should be explicit and reviewable; end-to-end acceptance is still pending.

3/ The V2 personal-DM goal means complete conversation history, not a user-selected-message shortcut. Its official feasibility, authorization, and history coverage are unresolved. Bot DMs are not a substitute.

4/ V1 is an intermediate milestone, not completion of V2. The current package is 0.1.0-alpha.1 and has not yet been validated end to end. We’ll publish capability claims only with release evidence.

5/ If this problem matters to your MCP or Discord workflow, tell us which access boundary you need and what evidence you’d expect before trusting it. We’ll share the repository and release details when they’re ready.

### Español

1/ Estamos construyendo un servidor MCP abierto para Discord en dos pasos. V1 busca completar de punta a punta el acceso a canales de servidor autorizados. V2 apunta al historial completo de los DMs y conversaciones existentes de una persona, sujeto a viabilidad y aprobación oficiales.

2/ V1 usa la autorización oficial de una aplicación/bot de Discord para canales donde esté instalado y tenga acceso concedido. El alcance y los permisos deben quedar explícitos y ser revisables; la aceptación de punta a punta sigue pendiente.

3/ El objetivo de DMs personales de V2 significa historial completo de conversaciones, no una alternativa de mensajes seleccionados por el usuario. La viabilidad oficial, la autorización y la cobertura histórica siguen sin resolverse. Los DMs del bot no son un reemplazo.

4/ V1 es un hito intermedio, no la finalización de V2. El paquete actual es 0.1.0-alpha.1 y aún no tiene validación de punta a punta. Publicaremos capacidades solo con evidencia del release.

5/ Si este problema importa en tu flujo de MCP o Discord, cuéntanos qué límite de acceso necesitas y qué evidencia pedirías antes de confiar en una integración. Compartiremos el repositorio y los detalles de release cuando estén listos.

## Referencias oficiales revisadas

- [Discord OAuth2 y scopes](https://docs.discord.com/developers/topics/oauth2)
- [Discord: Automated User Accounts / Self-Bots](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)
- [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [MCP Registry: publicación rápida](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [MCP Registry: propósito y estado](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)
- [GitHub: cómo comunicarse sobre un proyecto](https://docs.github.com/en/get-started/using-github/communicating-on-github)
- [X: crear hilos](https://help.x.com/en/using-x/create-a-thread)
