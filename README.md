# CodeReview AI

CodeReview AI es una aplicación para realizar revisiones colaborativas de código con ayuda de modelos de lenguaje pequeños (SLMs) ejecutados localmente.

La aplicación facilita la revisión de Pull Requests de GitHub y Merge Requests de GitLab, permitiendo combinar el análisis automático con la decisión y el criterio de los revisores humanos.

## ¿Qué beneficios aporta?

- Ayuda a detectar problemas de diseño, calidad y seguridad antes de integrar cambios.
- Aplica criterios de revisión basados en principios SOLID y buenas prácticas de seguridad.
- Mantiene el código analizado en el equipo del usuario mediante modelos locales.
- Permite revisar los cambios directamente por fichero y línea.
- Presenta los comentarios generados por la IA como propuestas, nunca como decisiones automáticas.
- Permite aceptar, editar, publicar o eliminar cada propuesta individualmente.
- Permite continuar una revisión en otra sesión conservando su información local.
- Admite repositorios públicos y privados, incluidos entornos GitHub y GitLab corporativos.

## ¿Cómo funciona?

1. Se introduce la URL de una Pull Request o Merge Request.
2. Se proporciona un token personal de GitHub o GitLab cuando sea necesario.
3. La aplicación obtiene los cambios y los comentarios existentes.
4. El SLM local analiza los ficheros de código y configuración seleccionados.
5. El revisor navega por los ficheros y consulta las propuestas asociadas a líneas concretas.
6. Cada propuesta se acepta, modifica, publica o elimina de forma manual.
7. Los comentarios seleccionados se publican en la Pull Request o Merge Request.

La aplicación no aprueba, cierra ni fusiona Pull Requests o Merge Requests automáticamente.

## Requisitos

- Un navegador actualizado.
- Acceso a la aplicación ejecutándose en el equipo local.
- Un repositorio GitHub o GitLab accesible mediante un token personal con permisos de lectura y escritura.
- Un modelo SLM ejecutándose localmente mediante una de estas opciones:
  - [LM Studio](https://lmstudio.ai/)
  - [Ollama](https://ollama.com/)
  - [llama.cpp](https://github.com/ggml-org/llama.cpp)
- El runtime local debe ofrecer un endpoint compatible con la API de modelos y estar accesible desde `localhost`.

No es necesario utilizar una cuenta de OpenAI ni enviar el código a un servicio de IA público.

## Configuración del SLM

Desde la sección **Configuración** se indican:

- La URL local del runtime SLM.
- El modelo que se utilizará para el análisis.
- La temperatura de generación.
- El límite máximo de tokens.
- Las instrucciones de revisión personalizables.

La lista de modelos disponibles puede actualizarse mediante la acción de refresco. Esto permite detectar modelos que se hayan cargado recientemente en LM Studio, Ollama o llama.cpp.

La aplicación incluye unas instrucciones iniciales para revisar principios SOLID, seguridad, calidad y mantenibilidad. Estas instrucciones pueden adaptarse, pero el formato de salida necesario para identificar ficheros y líneas se mantiene protegido para asegurar que las propuestas puedan mostrarse correctamente.

## Privacidad y credenciales

- El análisis del código se realiza mediante un SLM local.
- El contenido del código no se envía a servicios de IA públicos.
- El token de GitHub o GitLab se solicita durante la sesión y no se guarda como parte de la información local de la revisión.
- La información de las revisiones se conserva localmente hasta que el usuario decide eliminarla.

## Inicio de la aplicación

Para ejecutar la aplicación en un entorno local es necesario tener Node.js instalado. Desde la carpeta del proyecto:

```text
npm install
npm run dev
```

Después se puede abrir la dirección local mostrada por la aplicación, normalmente `http://localhost:5173`.

## Estado del proyecto

La aplicación se encuentra en desarrollo. Las funciones se incorporan progresivamente, empezando por la gestión local de revisiones, la configuración del SLM, la visualización de cambios y la orquestación del proceso de revisión humana e IA.
