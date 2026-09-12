# Peer to Peer Code Review Asistido por IA

El objetivo de este proyecto es crear una SPA que implemente un proceso "peer to peer code review" asistido por IA.

La presentación de la interfaz de usuario debe ser clara, intuitiva y facilitar la interacción entre los revisores y el autor del código.

Se debe poder configurar el proveedor de servicios IA a utilizar en el proceso de revisión.

## Requisitos técnicos

- La aplicación será una SPA (Single Page Application) y PWA (Progressive Web Application).
- La aplicación será desarrollada con Vanilla TypeScript, HTML5.
- Para los estilos utilizaremos Tailwind CSS e iconografía usando Heroicons.
- Usaremos una fuente legible y moderna, como Roboto o Inter.
- Debe ser trivial configurar un logotipo de empresa, y 5 colores de tema a utilizar, en sus variantes claro y oscuro.
- Utilizaremos langgraph.js (https://github.com/langchain-ai/langgraphjs) para orquestar los pasos de la revisión.
La iteracion con los modelos IA se realizará utilizando el api estandar de OpenAI.
- Almacenaremos la información de estado en IndexedDB usando la libreria wrapper Dexie.js.
- Para la interación con Github se utilizará la API correspondiente para obtener información de las MR y actualizar los comentarios y el estado de la revisión.

## Requisitos de uso esperado

- La aplicación puede definir múltiples revisiones.
- No se requiere el registro de usuarios, estos residen en la definición de la MR (Merge Request).
- Al inicio se puede crear una nueva revisión introduciendo la URL de la MR correspondiente.
- O bien seleccionar una revisión existente desde la lista de revisiones ya registradas y no finalizadas.
- Las revisiones finalizadas se pueden consultar o eliminar.
- No es obligatorio finalizar una revisión en una sola sesión, se puede continuar en sesiones posteriores. Para ello se definirán estados de la revisión que permitan retomar el proceso desde donde se dejó.
- La aplicación debe representar la MR de forma similar a como lo hace Github, mostrando los cambios de código, comentarios y estado de la revisión de manera clara y accesible. Y un árbol de archivos que permita navegar fácilmente por los diferentes ficheros modificados.
- Los resultados se almacenarán en Github en la MR correspondiente, usando comentarios y actualizando el estado de la revisión.

## Proceso de Revisión de Código

Los pasos del proceso de revisión de código de nuestra organización son los siguientes:

- Identificación del código a revisar y descarga del repositorio. Se identificará por una MR (Merge Request).
- La IA realiza un análisis inicial del código, identificando posibles problemas y áreas de mejora antes de la revisión detallada por parte de los revisores humanos.
- Revisión detallada del código por parte de los revisores asignados y el equipo de desarrollo, consiste en:
  - Generación de lista comentarios y sugerencias de mejora.
  - Discusión de comentarios entre el autor del código y los revisores y generación de acuerdos sobre los cambios a realizar.
- Decisión sobre siguientes pasos:
  - Aprobación final y fusión de la MR en el repositorio principal.
  - Solicitud de cambios adicionales y reenvío de la MR para una nueva revisión si es necesario.

