# Plan de desarrollo

## Objetivo

Construir una SPA/PWA en Vanilla TypeScript para gestionar revisiones de GitHub Pull Requests y GitLab Merge Requests, tanto en servicios públicos como en instalaciones on-premise.

La aplicación descargará y analizará código fuente y ficheros de configuración de texto, mostrará propuestas de revisión asistidas por IA y permitirá que un revisor decida individualmente si cada comentario se publica o se elimina.

## Decisiones confirmadas

- Soporte para GitHub Pull Requests y GitLab Merge Requests mediante adaptadores comunes.
- Soporte para servicios públicos y despliegues on-premise.
- Soporte para repositorios privados.
- Autenticación mediante token personal introducido en cada sesión.
- Permisos de lectura y escritura en el repositorio.
- Los tokens no se persistirán en IndexedDB.
- LangGraph.js se utilizará como orquestador de agentes IA y humanos.
- Los agentes IA utilizarán SLMs ejecutados localmente mediante un runtime accesible por `localhost`.
- El runtime local podrá exponer una API compatible con OpenAI como protocolo de integración, sin utilizar servicios IA públicos.
- El análisis se limitará a ficheros de código fuente y configuración en formato texto.
- Los comentarios IA serán propuestas locales y nunca se publicarán automáticamente.
- Cada propuesta IA podrá aceptarse, editarse, publicarse o eliminarse individualmente.
- Los comentarios se gestionarán a nivel de fichero y línea.
- Se persistirá toda la información de cada instancia del proceso.
- El borrado será manual y solo eliminará los datos locales.
- La aplicación solo publicará comentarios en las MR/PR.
- No cambiará estados remotos, no aprobará, no cerrará ni fusionará MR/PR.
- La personalización visual se realizará mediante un fichero de configuración de Tailwind e instrucciones de uso.

## Estados de una revisión

### Estados de negocio

1. **Pendiente**: se está descargando la información de la MR/PR.
2. **En preparación**: la IA está preparando el análisis inicial.
3. **En curso**: revisores y desarrolladores revisan el código y las propuestas.
4. **Cerrada**: el proceso localiza su finalización sin aprobación.
5. **Aprobada**: el proceso finaliza con decisión de aprobación local; no se publica una aprobación remota.

Además, se contemplará un estado técnico de error con posibilidad de reintento.

## Fases de implementación

### 1. Base del proyecto

- Crear proyecto Vanilla TypeScript con TypeScript estricto y sistema de build.
- Configurar Tailwind CSS, Heroicons y una fuente moderna.
- Añadir manifest, service worker y estrategia de caché PWA.
- Organizar el código por dominio, infraestructura, UI y configuración.

### 2. Configuración y sesión

- Crear configuración de marca mediante Tailwind y variables CSS.
- Permitir configurar logo y cinco colores con variantes claro/oscuro.
- Documentar el fichero de configuración y validar contraste y accesibilidad.
- Crear sesión efímera para tokens de GitHub/GitLab y la configuración del runtime local.
- Configurar URL del runtime local, modelo SLM y parámetros de inferencia.
- No persistir el token personal de GitHub/GitLab en IndexedDB; solo estará disponible durante la sesión.

### 3. Dominio y persistencia local

- Modelar revisión, plataforma, instancia on-premise, MR/PR, snapshot, fichero, diff, comentario, propuesta IA, decisión, ejecución y checkpoint.
- Implementar los estados de revisión y las transiciones válidas.
- Persistir el expediente completo de cada proceso con Dexie.js e IndexedDB.
- No guardar tokens en IndexedDB.
- Versionar el esquema y preparar migraciones.

### 4. Adaptadores GitHub y GitLab

- Detectar proveedor e instancia a partir de la URL introducida.
- Soportar servicios públicos y URLs on-premise configurables.
- Definir una interfaz común para metadatos, participantes, ficheros, ramas, diffs y comentarios.
- Descargar únicamente ficheros de código fuente y configuración en formato texto.
- Excluir binarios y documentar extensiones admitidas y límites de tamaño/contexto.
- Leer comentarios existentes y publicar únicamente comentarios.
- Gestionar paginación, rate limits, permisos, reintentos, errores de red y cambios remotos.

### 5. Orquestación IA

- Crear un grafo LangGraph para coordinar la adquisición, el filtrado textual, los agentes SLM y los agentes humanos.
- Pausar y reanudar el proceso en los puntos de intervención de los revisores humanos.
- Generar propuestas con fichero, línea, severidad, explicación y sugerencia.
- Permitir aceptar, editar, publicar o eliminar cada propuesta individualmente.
- Impedir cualquier publicación automática.
- Persistir checkpoints y reanudar desde la última etapa completada.
- Requerir que el runtime SLM local esté disponible y protegido en el entorno del usuario.

### 6. Interfaz de revisión

- Mostrar revisiones activas y finalizadas.
- Crear revisiones a partir de una URL de MR/PR.
- Mostrar estado, árbol de ficheros, diff, comentarios y navegación por fichero/línea.
- Mostrar una bandeja de propuestas IA pendientes de decisión.
- Permitir comentarios humanos a nivel de fichero y línea.
- Añadir acciones para publicar o eliminar propuestas.
- Cubrir estados de carga, vacío, error, offline y conflicto de sincronización.

### 7. Sincronización y publicación

- Actualizar snapshots y comentarios remotos sin perder anotaciones locales.
- Usar identificadores idempotentes para evitar duplicados.
- Registrar el resultado de cada publicación.
- Marcar claramente el origen IA de los comentarios publicados.
- Conservar la auditoría de la decisión del revisor.
- Mantener fuera de alcance cualquier cambio de estado o merge remoto.

### 8. Documentación y pruebas

- Documentar instalación, configuración de Tailwind, branding, runtime SLM local y tokens de sesión.
- Añadir tests unitarios de URLs, estados, filtrado textual, Dexie, checkpoints e idempotencia.
- Añadir tests de contrato para GitHub/GitLab público y on-premise.
- Añadir tests del grafo para pausa, reanudación, errores y ausencia de publicación automática.
- Añadir tests de UI/E2E para aceptar, editar, publicar y eliminar propuestas.
- Validar build, PWA, accesibilidad, responsive, contraste y ausencia de credenciales en el bundle.

## Decisiones técnicas menores pendientes

- Concretar los ámbitos exactos de GitHub/GitLab y la matriz de permisos para comentarios.
- Definir las extensiones consideradas código fuente y configuración.
- Definir límites máximos por fichero y por MR/PR.
- Concretar la semántica local de `Cerrada` y `Aprobada`.
- Confirmar el soporte de hilos y respuestas según las capacidades de cada proveedor.

## Riesgos conocidos

- El expediente persistido puede contener código y respuestas IA sensibles; el usuario debe controlar el borrado manual.
- GitHub y GitLab tienen modelos de comentarios diferentes; el adaptador común debe conservar las capacidades específicas de cada proveedor.
- Las instalaciones on-premise pueden tener diferencias de versión y configuración que requieran pruebas específicas.
