# Estrategia de lanzamiento y distribución

**Estado (2026-10-10):** borrador operativo para revisión. La [prerelease pública `v0.1.0-alpha.1`](https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1) ofrece un tarball para instalación local; no hay publicación en npm ni en el MCP Registry. Este documento no autoriza publicaciones en X, comunidades u otros canales externos.
**Alcance:** MCP abierto para Discord, con seguridad como criterio de producto y una presencia liderada por X.

## Tesis y posicionamiento

El problema que vale la pena probar no es “conectar Discord con un LLM” en abstracto. Es ofrecer una interfaz MCP pequeña y revisable para que una persona use herramientas de IA con acceso a Discord delimitado, comprensible y revocable. La hipótesis inicial es que desarrolladores de MCP, mantenedores de comunidades y equipos técnicos que ya usan Discord valorarán más poder inspeccionar el límite de acceso y la procedencia de cada operación que sumar una larga lista de herramientas.

La propuesta se expresa como criterios verificables, no como una afirmación de superioridad frente a competidores: alcance de permisos mínimo; herramientas y operaciones documentadas; configuración local y auditable; mensajes no usados para analítica ni entrenamiento; límites claros entre datos de servidor, canales y mensajes directos; y una matriz de capacidades que indique qué funciona bajo cada autorización. No hay una revisión comparativa de mercado que permita afirmar que otros wrappers carecen de estas propiedades.

Audiencia primaria: quienes construyen o adoptan clientes MCP y quieren consultar canales de Discord desde un entorno propio. Audiencia secundaria: administradores técnicos de comunidades que necesitan entender qué puede leer una integración y cómo retirarla. La comunicación será dirigida a personas técnicas; no se venderá como bot de moderación, asistente autónomo ni integración empresarial antes de validar esos usos.

**Secuencia aprobada:** V1 primero: acceso a canales autorizados mediante la aplicación/bot oficial. La prerelease acredita un alcance alpha: lectura acotada de historial, mensajes de texto y respuestas opcionales. Las escrituras están desactivadas por defecto y requieren autorización exacta del canal y aprobación humana del host. Pasaron 36 pruebas automatizadas, CI en Windows/Ubuntu y comprobaciones reales del paquete instalado en sandbox para lectura, envío, respuesta, denegación de alcance, reinicio en modo solo lectura y revocación/restauración de permisos. También se comprobó la supresión de vistas previas de menciones. Estas pruebas no acreditan adopción externa ni certificación de seguridad; los metadatos adjuntos permiten rastrear el build, pero no constituyen procedencia firmada. V2 tiene como objetivo el historial completo de los DMs personales existentes y sus conversaciones, no la selección manual de mensajes. La viabilidad, la autorización oficial, la cobertura histórica y la aceptación real de V2 siguen pendientes. No se lanzará el objetivo V2 como si estuviera resuelto ni se reemplazará por DMs del bot.

Discord documenta `dm_channels.read` como un scope que requiere aprobación y prohíbe automatizar cuentas normales fuera de la API OAuth2/bot; por eso no se diseñará un self-bot ni se presentará el acceso personal como disponible hasta tener evidencia oficial y técnica de una vía permitida ([OAuth2 de Discord](https://docs.discord.com/developers/topics/oauth2), [política sobre self-bots](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)).

## Canales y distribución

1. **X como canal editorial principal.** Publicar hilos breves con una sola idea: por qué se construye, qué puede leer el bot oficial, qué no se ha resuelto, una demo reproducible cuando exista, y cada cambio importante. Usar X para conversación y alcance; dirigir a una fuente canónica verificable (repositorio, release o documentación cuando existan). X permite redactar y guardar hilos como borradores, lo que facilita revisión previa ([guía oficial de hilos](https://help.x.com/en/using-x/create-a-thread)). No se comprará alcance ni se automatizarán respuestas o menciones.
2. **GitHub como fuente de verdad.** README, [prerelease `v0.1.0-alpha.1`](https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1), issues y, si la comunidad lo necesita, Discussions: issues para defectos/tareas concretas y Discussions para preguntas abiertas, anuncios y conversación ([guía oficial de comunicación de GitHub](https://docs.github.com/en/get-started/using-github/communicating-on-github)). Cada publicación de X debe apuntar al release real y a evidencia versionada.
3. **Official MCP Registry.** Preparar `server.json` y publicar después de contar con paquete/versionado reproducible, namespace verificado y revisión de metadatos. El registry oficial sirve como catálogo de metadatos para consumidores y directorios posteriores; su documentación indica que está en preview y que pueden ocurrir cambios o reinicios. El registry no aloja el artefacto, por lo que publicación allí no sustituye la publicación del paquete ni la documentación de instalación ([quickstart oficial](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx), [estado y propósito](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)). La entrada no se anunciará como “aprobación” o certificación de seguridad.
4. **Comunidades de desarrolladores.** Compartir una demo o pedir revisión en espacios de MCP, GitHub y Discord solo cuando las reglas del espacio lo permitan y haya una pregunta concreta para la comunidad. No hacer cross-post idéntico en masa, no comprar membresías y no enviar DMs promocionales. Mantener soporte en GitHub para que preguntas y respuestas técnicas queden accesibles.
5. **Contenido técnico reutilizable.** Un ejemplo mínimo de instalación, modelo de amenazas, matriz de permisos y nota de compatibilidad son activos de descubrimiento. Prepararlos antes de ampliar distribución; cada uno debe describir versión, entorno probado y limitaciones observadas.

## Prerrequisitos de publicación

La disponibilidad alpha limitada a la instalación local desde la prerelease puede comunicarse con el alcance comprobado. Antes de ampliar el mensaje o la distribución, revisar estos puntos y distinguir evidencia existente de aceptación pendiente:

- El repositorio público contiene licencia, README, instalación reproducible, configuración de ejemplo sin secretos, contribución, código de conducta y canal de reporte de vulnerabilidades/abusos.
- Una revisión de seguridad cubre secretos y tokens, autorización, permisos Discord, límites por canal, filtrado de datos, errores, rate limits, prompt injection en contenido externo y tratamiento de adjuntos. El acceso se deniega por defecto y el alcance efectivo se puede inspeccionar.
- Se definen retención, registros y telemetría. Por defecto no se envían contenido, identificadores de usuarios, nombres de servidor/canal ni historial a un servicio central. Logs locales deben minimizar datos y evitar tokens.
- La prerelease documenta instalación del tarball y pruebas del paquete instalado en sandbox, incluyendo denegación de alcance, reinicio en modo solo lectura y revocación/restauración; las 36 pruebas y CI Windows/Ubuntu cubren el candidato. Registrar por separado futuras pruebas de instalación limpia en otros entornos, rate limits, errores y aceptación de usuarios; una comprobación interna no es adopción externa.
- La ruta de acceso a canales mediante bot oficial está documentada con los intents y permisos requeridos. Los intents privilegiados se solicitan solo si la implementación los necesita y Discord los concede. Describir únicamente el alcance alpha validado y los canales autorizados de forma exacta.
- La ruta V2 de historial completo de DMs personales tiene una investigación y decisión documentadas: mecanismo oficial permitido, scopes/aprobaciones necesarias, cobertura de historial y conversaciones, limitaciones y aceptación. Si no aparece una vía permitida, V2 queda bloqueada y se informa así; no se usa un token de cuenta personal ni se cambia el requisito por DMs del bot o selección manual de mensajes.
- El anuncio de V1 identifica el alcance de canales como primer hito y declara que no completa el objetivo V2. Nombrar la validación interna y sus límites; no presentar `0.1.0-alpha.1` como disponible desde npm ni como release con procedencia criptográfica firmada.
- Los borradores de X pasan revisión contra el release real, sin claims de seguridad absoluta, compatibilidad universal, usuarios, descargas o capacidades no medidas. Publicar es una acción manual del responsable del proyecto.

## Métricas: definiciones, captura y cautela

El baseline de todos los indicadores es **desconocido** hasta registrar una primera ventana completa con fuente y fecha. “Desconocido” no equivale a cero. Un cero solo significa que una fuente consultada y disponible registró cero eventos en una ventana definida. No sumar números de impresiones, clones, visitas y descargas como si fueran personas únicas.

| Indicador | Definición y denominador | Fuente y ventana | Baseline |
|---|---|---|---|
| Alcance X | Impresiones reportadas por X por publicación; para interacción, (respuestas + reposts + likes) / impresiones. No deduplicar personas. | Analítica nativa por hilo a 7 días. | Desconocido hasta primera publicación. |
| Interés hacia el repositorio | Clics reportados por la plataforma de origen / impresiones de los posts que incluyen el enlace. Mantener una URL de campaña con UTM para distinguir variantes, sin asumir que GitHub muestra los clics o parámetros de campaña. Reportar visitas de referencia y visitas totales por separado solo si están disponibles. | Analítica de X y, si existe, sitio intermedio o proveedor consentido; por 7 días. Si no hay fuente de clics, marcar no medible. | Desconocido. |
| Activación técnica | Instalaciones verificadas que completan el ejemplo guiado / inicios de instalación que el usuario comparte voluntariamente. No inferir instalaciones desde clones de Git. | Encuesta opt-in corta o issue/discussion; revisión mensual. No recopilar telemetría silenciosa. | Desconocido. |
| Éxito de tarea | Ejecuciones de prueba aprobadas / ejecuciones intentadas, distinguiendo casos soportados y no soportados. | Suite automatizada versionada y prueba manual consentida; por release. | Registrar primera ejecución como baseline; no llamar a un caso no probado “fallo de usuario”. |
| Calidad de contribución | PRs aceptados / PRs cerrados en el periodo; reportar también tiempo mediano hasta primera respuesta solo si el historial permite calcularlo. | GitHub, mensual; excluir PRs aún abiertos del denominador. | Desconocido. |
| Incidentes de privacidad/seguridad | Conteo de incidentes confirmados y tiempo hasta contención. No se normaliza para minimizar impacto. | Registro privado de incidentes con acceso restringido; resumen público sanitizado si corresponde. | Desconocido; nunca presentar ausencia de reportes como prueba de ausencia de incidentes. |

**UTM y atribución:** la URL canónica es la [prerelease pública](https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1). Para cada campaña se puede añadir `utm_source` (`x`, `github`, `community`), `utm_medium` (`organic`, `discussion`, `release`), `utm_campaign` (`launch-202610` o un nombre documentado) y `utm_content` (id del hilo/variante), sin datos personales. Guardar una tabla interna de fecha, URL, variante y destino. GitHub puede no exponer los clics ni los UTM de enlaces entrantes: crear el enlace de campaña no produce por sí solo una métrica de clics. Si no hay una fuente válida, informar “no medible”. No afirmar atribución causal a partir de clics.

**Privacidad de medición:** preferir estadísticas agregadas de cada plataforma y datos que GitHub/X ya expongan a sus administradores. La instrumentación del producto será opt-in, apagada por defecto, sin cuerpo de mensajes ni identificadores Discord; explicar datos, propósito, retención y método de baja. Solicitudes de feedback no deben pedir contenido privado de Discord. Si no existe una fuente consentida para un denominador, reportar la métrica como no medible, no aproximarla con proxies.

## Cadencia experimental de 30/60/90 días

El reloj de esta cadencia empieza el **2026-10-10**, fecha de la prerelease pública. Los umbrales de abajo son hipótesis de decisión, no benchmarks de la industria. Las métricas reales siguen desconocidas hasta observar sus ventanas; las descargas internas del candidato no cuentan como adopción. Ajustar umbrales después de conocer el volumen real y el coste de soporte. Si el requisito de DMs personales es bloqueante para el público objetivo, no compensar el bloqueo con métricas de alcance.

| Ventana | Experimento y salida | Señal para continuar (hipótesis) | Pausa o cambio |
|---|---|---|---|
| Días 0–30 | Publicar, tras aprobación humana, un hilo X EN/ES sobre la prerelease alpha y preparar una demo revisable del flujo de canales ya comprobado internamente. Registrar feedback y cobertura de instalaciones externas. Mantener investigación técnica de V2 separada. | Al menos 5 instalaciones voluntariamente reportadas por personas fuera del equipo y 3 completan el flujo de canales soportado; al menos 2 revisiones accionables de seguridad/usabilidad. | Si no se puede medir instalación con consentimiento, marcar activación como desconocida. Pausar el mensaje de disponibilidad ante una falla de alcance, permisos o seguridad. |
| Días 31–60 | Cambiar una variable editorial por vez (problema/beneficio, demo/modelo de permisos, EN/ES), comparar por clics medibles y feedback de calidad. Corregir fricciones del onboarding. | Dos cohortes semanales con al menos 10 clics medidos cada una y ≥20% de clics a instalación autoinformada; tratar el resultado como señal preliminar, no como conversión de mercado. | Si la plataforma no informa clics o no se llega al denominador, extender sin declarar ganador. Si las dudas repetidas muestran una promesa mal entendida, reescribir antes de subir alcance. |
| Días 61–90 | Publicar una mejora basada en evidencia y un informe breve: qué se probó en V1, qué sigue abierto en V2, métricas con denominadores y cambios del roadmap. Probar una comunidad técnica adicional, una por vez. | Al menos 10 instalaciones reportadas acumuladas, ≥50% de éxito del flujo de canales documentado entre las reportadas, y 3 colaboradores externos con feedback o contribución útil. | Si el soporte excede la capacidad acordada, limitar nuevas invitaciones. Si no hay activación confiable, priorizar onboarding/compatibilidad sobre promoción. No presentar la investigación de V2 como historial personal disponible. |

Si los tamaños de muestra no se alcanzan, el resultado es “sin evidencia suficiente”, no fracaso ni éxito. No se cambiarán simultáneamente producto, canal y audiencia si luego se pretende atribuir la diferencia a una sola causa.

## Capacidad, operación y respuesta a incidentes

Asignar responsables, sin presuponer horas ni costos: mantenimiento técnico/release; respuesta de comunidad; revisión de seguridad y privacidad; y edición/publicación bilingüe. Antes de abrir invitaciones, publicar disponibilidad de soporte y tiempo objetivo de respuesta que el equipo pueda cumplir. Registrar la capacidad real y reducir el ritmo de difusión si la cola crece.

**Pausa inmediata de promoción y nuevas instalaciones** ante exposición de credenciales/datos, acceso fuera del alcance concedido, vulnerabilidad crítica explotable, señal creíble de automatización no autorizada, incumplimiento de términos de Discord, o discrepancia material entre el claim público y la capacidad liberada. Contener primero: retirar/rotar credenciales afectadas, detener releases/integraciones implicadas, preservar evidencia mínima sin copiar mensajes privados, notificar a responsables y seguir las obligaciones de Discord y leyes aplicables. Reanudar solo después de corregir, publicar una explicación proporcional y revisar el gate que falló.

## Borradores de hilos X para revisión

Son borradores para revisión humana del texto, del enlace y de cada canal/cuenta exactos antes de publicar. La prerelease en GitHub ya es pública; estos hilos no se han publicado. No incluir una cifra de usuarios, descargas externas o clics hasta medirla.

### English

1/ Rocking Discord MCP `v0.1.0-alpha.1` is a GitHub prerelease for local installation. It connects MCP to authorized server channels via Discord’s official bot API. Release and setup: https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1

2/ This alpha supports bounded history reads and optional plain-text sends and replies. Writes are off by default and require exact channel authorization plus human host approval. Mentions and link previews are suppressed.

3/ The candidate passed 36 tests and Windows/Ubuntu CI. Installed-package sandbox checks covered reads, sends, replies, scope denial, read-only restart, and permission revocation/restoration. Alpha evidence, not security certification or signed provenance.

4/ Install from the GitHub release tarball; this version is not published to npm or the MCP Registry. External adoption and task-success metrics are still unknown. Please follow the release setup and inspect the authorization boundary before granting access.

5/ V2 aims at full history of a person’s existing DMs. Official approval, feasibility and historical coverage remain unproven; V2 is outside this alpha. Which channel boundary or test should come next? Please don’t share private Discord content.

### Español

1/ Rocking Discord MCP `v0.1.0-alpha.1` es una prerelease de GitHub para instalación local. Conecta MCP con canales autorizados mediante la API oficial del bot de Discord. Release y guía: https://github.com/Rocking-Product/rocking-discord-mcp/releases/tag/v0.1.0-alpha.1

2/ Esta alpha lee historial acotado y permite enviar texto y respuestas opcionales. Las escrituras están apagadas por defecto: exigen autorización exacta del canal y aprobación humana del host. Se suprimen las menciones y las vistas previas de enlaces.

3/ El candidato pasó 36 pruebas y CI en Windows/Ubuntu. Las pruebas del paquete instalado en sandbox cubrieron lectura, envío, respuesta, denegación, reinicio en modo solo lectura y revocación/restauración. Evidencia alpha, sin certificación ni procedencia firmada.

4/ Se instala desde el tarball de GitHub; esta versión no está en npm ni en el MCP Registry. La adopción externa y el éxito de tarea siguen sin medirse. Sigue la guía de instalación y revisa los permisos antes de conceder acceso.

5/ V2 apunta al historial completo de los DMs personales existentes. Su aprobación oficial, viabilidad y cobertura histórica siguen sin demostrarse; V2 queda fuera de esta alpha. ¿Qué límite de canal o prueba te gustaría ver después? Evita compartir contenido privado.

## Referencias oficiales revisadas

- [Discord OAuth2 y scopes](https://docs.discord.com/developers/topics/oauth2)
- [Discord: Automated User Accounts / Self-Bots](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)
- [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [MCP Registry: publicación rápida](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
- [MCP Registry: propósito y estado](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)
- [GitHub: cómo comunicarse sobre un proyecto](https://docs.github.com/en/get-started/using-github/communicating-on-github)
- [X: crear hilos](https://help.x.com/en/using-x/create-a-thread)
