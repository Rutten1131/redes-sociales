# 📖 DOCUMENTACIÓN DEFINITIVA: ARQUITECTURA DE INBOX, PUBLICACIONES Y MAKE

Esta guía documenta con exactitud cómo está configurado el sistema de redes sociales, el por qué de cada decisión técnica, y el estado de cada componente.

---

## 1. El Dilema de Meta App Review y la Solución Implementada

### El Problema Inicial
- Meta exige **App Review** y modo Live para:
  1. Que Meta envíe **Webhooks en tiempo real** de páginas a un servidor propio.
  2. Que usuarios desconocidos de internet concedan permisos a la app.
- Intentar hacer polling en Make con `List Posts` + `List Comments` cada 15 minutos consumía más de **5,000 operaciones al día** (inviable en el plan gratuito/básico).
- El módulo nativo de Make `Facebook Pages: Watch Comments` **exige un Post ID obligatorio**, impidiendo monitorear toda la página globalmente.

### La Solución Definitiva (Cero costo de Make para comentarios)
1. **Comentarios (Facebook & Instagram):**
   - Tu app ya almacena el `Page Access Token` de larga duración cifrado con AES-256 en la base de datos.
   - Meta permite a los dueños/administradores de la página leer posts y comentarios públicos (`/{page-id}/feed` y `/{post-id}/comments`) de **cualquier usuario** sin requerir App Review pública.
   - Creamos un **Cron Job en Vercel** (`/api/cron/sync-inbox`) que corre cada hora (o cuando tú quieras), lee los posts y comentarios con la Graph API directamente, y los guarda en la tabla `InboxItem`.
   - **Gasto en Make para comentarios: 0 operaciones.**

2. **Mensajes Directos / DMs (Facebook Messenger):**
   - Make sí tiene una app verificada por Meta y su módulo **Facebook Messenger: Watch Messages** funciona en tiempo real sin requerir Post ID ni App Review propia.
   - Make recibe el DM y hace un `HTTP POST` a tu app (`/api/webhooks/make-inbox`).

3. **Respuestas a Comentarios y DMs:**
   - La app envía la respuesta redactada (o por IA) a Make (`Escenario Respondedor`), y Make lo publica en la red social.

---

## 2. Mapa Completo de Escenarios y Componentes

| Canal / Función | Origen | Puente / Destino | Consumo Make | Estado |
|---|---|---|---|---|
| **Publicar Posts** | App (`/api/cron/publish`) | Make (Escenario Publicador) → FB/IG/YT | 1 op por post programado | ✅ Listo y funcionando |
| **Recibir Comentarios** | Meta Graph API | App Directa (`/api/cron/sync-inbox`) | **0 operaciones** | ✅ Código implementado |
| **Recibir DMs (Messenger)**| Facebook Messenger | Make (`Watch Messages`) → App (`/api/webhooks/make-inbox`) | 1 op por DM recibido | 🔧 Configuración en Make |
| **Responder Comentarios/DMs** | App (Inbox Panel) | Make (Escenario Respondedor) → Meta | ~3 ops por respuesta enviada | ✅ Escenario listo |

---

## 3. Detalle de Archivos Implementados en la App

1. **[lib/integrations/meta.ts](file:///d:/Abel%20paginas/Redess/social-scheduler/lib/integrations/meta.ts)**
   - `getFacebookRecentComments`: Consulta `/{pageId}/feed` trayendo los comentarios recientes de cada post.
   - `getInstagramRecentComments`: Consulta `/{igUserId}/media` trayendo comentarios de publicaciones de Instagram.
2. **[app/api/cron/sync-inbox/route.ts](file:///d:/Abel%20paginas/Redess/social-scheduler/app/api/cron/sync-inbox/route.ts)**
   - Endpoint GET protegido por `CRON_SECRET`.
   - Desencripta los tokens de las cuentas guardadas.
   - Inserta los nuevos comentarios en `InboxItem` con prevención de duplicados (`findUnique` por ID externo).
   - Activa el motor de IA (`processInboxItemWithAi`) para sugerencias o respuestas automáticas si está configurado.
3. **[vercel.json](file:///d:/Abel%20paginas/Redess/social-scheduler/vercel.json)**
   - Añadida la regla `"schedule": "0 * * * *"` (cada 1 hora) para ejecutar la sincronización automáticamente en Vercel.
4. **[app/api/webhooks/make-inbox/route.ts](file:///d:/Abel%20paginas/Redess/social-scheduler/app/api/webhooks/make-inbox/route.ts)**
   - Endpoint receptor para los DMs provenientes de Make.

---

## 4. Configuración en Make (Solo 1 escenario pendiente)

Para tener el 100% operativo, en Make solo debes tener:

### Escenario 1: Publicador (Ya lo tienes)
- Webhook de entrada → Publica en redes.

### Escenario 2: Respondedor (Ya lo tienes)
- Webhook de entrada de la App → Responde el comentario o DM en Meta.

### Escenario 3: Receptor de DMs (Messenger)
- **Módulo 1:** `Facebook Messenger` -> `Watch Messages`
  - Connection: Tu conexión de Facebook
  - Page: Tu Fanpage (`CesarReyes Loja`)
- **Módulo 2:** `HTTP` -> `Make a request`
  - URL: `https://redes-sociales-l5q4.vercel.app/api/webhooks/make-inbox`
  - Method: `POST`
  - Headers: `Content-Type: application/json`
  - Body:
    ```json
    {
      "platform": "FACEBOOK",
      "type": "DM",
      "externalId": "{{1.mid}}",
      "parentId": null,
      "fromName": "{{1.sender.name}}",
      "fromExternalId": "{{1.sender.id}}",
      "content": "{{1.text}}",
      "accountExternalId": "275810677566214"
    }
    ```
- **Frecuencia:** `Immediately as data arrives` (o el intervalo predeterminado de Messenger).
