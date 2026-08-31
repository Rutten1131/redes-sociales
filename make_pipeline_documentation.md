# Documentación del Pipeline de Make.com (Publicación RRSS)

Este documento centraliza cómo funciona actualmente el sistema de publicación automatizada mediante Make.com. Está diseñado para ser la guía de migración y reutilización hacia el nuevo sistema.

## 🏗 Arquitectura de 3 Capas

El sistema actual divide claramente las responsabilidades en tres capas para evitar acoplamiento directo entre la IA y Make.com.

1. **Capa 1 - El Originador (Donna AI):** Genera el texto, identifica las plataformas y guarda un registro en Supabase con estado `pending` o `draft_ai`.
2. **Capa 2 - El Despachador (Scheduler):** Una tarea en segundo plano que busca posts en estado `pending` cuya fecha de publicación ha llegado. Construye el payload estructurado y realiza la petición POST al webhook de Make.com.
3. **Capa 3 - El Receptor (Make.com Blueprint):** Recibe el payload en un Custom Webhook, evalúa variables como `post_media_category` y enruta los datos a los módulos nativos de Facebook, Instagram, LinkedIn o TikTok.

---

## 📂 Archivos Clave para Migración

Para replicar este comportamiento en otro sistema, estos son los archivos que debes llevarte o usar como referencia (enlaces al proyecto actual):

- **[scheduler.ts](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/apps/rrss-objetivo/src/lib/scheduler.ts):** Contiene la lógica central (Capa 2). Aquí se mapean las URLs, se calcula la categoría del medio (`post_media_category`) y se ejecuta el `fetch` con el secreto. **(Es el archivo más importante a replicar)**.
- **[route.ts](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/apps/rrss-objetivo/src/app/api/chat/route.ts):** Contiene la herramienta `propose_post` que usa la IA (Capa 1).
- **[Automatización de RRSS Objetivo.blueprint.json](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/Automatizacio%CC%81n%20de%20RRSS%20Objetivo.blueprint.json):** El diseño visual completo del flujo en Make. Puedes importarlo directamente en tu nueva cuenta/sistema de Make.
- **[.env.local](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/apps/rrss-objetivo/.env.local):** Define los endpoints y credenciales.
- **Scripts de Prueba:** [test_insta.mjs](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/apps/rrss-objetivo/test_insta.mjs) y [test_facebook_text.mjs](file:///c:/Users/Cesar/Documents/GRUPO%20EMPRESARIAL%20REYES/PROYECTOS/RRSS_objetivo/apps/rrss-objetivo/test_facebook_text.mjs) útiles para simular el comportamiento del scheduler y probar el webhook sin usar la base de datos real.

---

## 🔗 Enlaces y Credenciales

Las credenciales que conectan el backend actual con Make.com son las siguientes (definidas en tu `.env.local`):

- **Webhook de Producción (RRSS):** `https://hook.us2.make.com/t4jmvryyv0h7f04ts6xzxp8pgywsyfq1`
- **Secreto de Webhook:** `mi_super_secreto_123` (Enviado por tu backend a Make para autorizar el request).
- **API Token (Make REST):** `b7ca6700-ef69-4962-8916-db32e2d2c029`

---

## 📦 Estructura del Payload y Lógica de Enrutamiento

El archivo `scheduler.ts` genera un payload estricto que el blueprint de Make espera recibir. Make enruta las acciones utilizando una variable clave llamada **`post_media_category`**.

### Cálculo de `post_media_category`
Esta es la lógica que el backend hace antes de enviar a Make:
- `carousel`: Si el post contiene más de 1 imagen.
- `video`: Si contiene 1 video (extensión `.mp4`).
- `image`: Si contiene exactamente 1 imagen.
- `link`: Si no hay medios o los links son genéricos.

### Estructura base del Payload
```json
{
  "api_secret": "mi_super_secreto_123",
  "post_id": "uuid-del-post",
  "text": "Contenido del post",
  "media_url": "URL_principal",
  "post_media_category": "image",
  "platforms": ["facebook", "instagram"],
  "media_urls": [
    {
      "url": "https://...",
      "media_type": "IMAGE",
      "type": "image"
    }
  ]
}
```

---

## 🚨 Errores Conocidos y Reglas (Extraídos de las Skills)

Al migrar a un nuevo sistema, debes tener en cuenta estos errores y directrices documentados por las reglas internas del ecosistema (`make-pipeline` y `errores.md`):

> [!WARNING] 
> **Pérdida de Token por Redirecciones HTTP (Error 401)**
> Al enviar un POST a un webhook, asegúrate de que la URL destino sea final (ej. si requiere `www`, inclúyelo). Las librerías de node/fetch pueden seguir redirecciones (301/302) pero, por motivos de seguridad, **eliminan el header `Authorization`**. Esto provoca un error 401 Unauthorized de forma silenciosa en la API receptora.

> [!IMPORTANT]
> **Bloqueo de Imágenes Temporales (Proxy URLs)**
> Make.com no puede leer imágenes temporales ni bloqueadas por sesión. Asegúrate de que, en la Capa 1, se guarden URLs públicas estáticas de almacenamiento (ej. Supabase Storage o BunnyCDN). Si envías una "URL proxy temporal" y el Scheduler no logra resolverla, el post publicará un "enlace roto".

> [!CAUTION]
> **Nunca Simular en Producción**
> Los scripts de simulación/prueba (como `simulate-webhook.js` o `test_insta.mjs`) nunca deben enviarse al webhook de producción de Make. Make.com no diferencia si es un request de prueba o real; publicará el post en las redes sociales oficiales. Siempre cambia el entorno a un "webhook sandbox" antes de hacer pruebas de código.

> [!NOTE]
> **La regla inmutable del Payload**
> Cualquier nuevo dato que quieras que publique Make debe agregarse primero al backend (Capa 2 / `scheduler.ts`) y documentarse. Modificar la variable enrutadora `post_media_category` sin actualizar el blueprint en Make.com **romperá todo el router**.
