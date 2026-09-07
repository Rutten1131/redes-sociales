# 📚 Documentación Integral del Sistema: Redes Sociales, Inbox y Automatizaciones

## 1. Resumen del Hito Alcanzado 🎉
El sistema cuenta ahora con un ciclo operativo completo y validado en producción:
1. **Publicaciones Programadas:** Posts individuales, carruseles, historias y reels hacia Facebook, Instagram, LinkedIn y YouTube.
2. **Recepción de Inbox Híbrida y Óptima (Sin gastar operaciones de Make):**
   - Comentarios y DMs de Facebook e Instagram se extraen directamente mediante la Graph API de Meta vía **Cron Job** (`/api/cron/sync-inbox`) y endpoints de **Webhooks directos** (`/api/webhooks/meta`).
   - Se procesan y guardan automáticamente en la base de datos local (MySQL/Prisma `InboxItem`) con deduplicación por `externalId`.
3. **Respuesta Unificada a DMs y Comentarios:**
   - Desde la bandeja de entrada (`/dashboard/[id]/inbox`), el usuario puede redactar respuestas tanto para DMs como comentarios de FB e IG.
   - La respuesta se despacha vía webhook a un único escenario de Make (`RRSS - Responder Comentarios y DMs`), el cual enruta mediante un Router nativo hacia las acciones oficiales de Meta / Messenger.

---

## 2. Arquitectura del Flujo Actual

### A. Recepción (Inbound)
* **Antes:** Se pretendía crear escenarios complejos en Make para escuchar DMs y comentarios, lo cual provocaba fallos de permisos, limitaciones de webhooks de prueba y consumo masivo de créditos.
* **Ahora (Implementado y funcionando):**
  - Endpoint Cron: `GET /api/cron/sync-inbox` protegido con `CRON_SECRET`.
  - Conecta directamente con la Graph API de Meta:
    - Comentarios de FB: `/{page-id}/feed` & `/{post-id}/comments`.
    - Comentarios de IG: `/{ig-user-id}/media` & `/{media-id}/comments`.
    - DMs de FB: `/{page-id}/conversations` & `/{conversation-id}/messages`.
    - DMs de IG: `/me/conversations?platform=instagram` & `/{conversation-id}/messages`.
  - Los mensajes entrantes se guardan con estado `PENDING`.

### B. Despacho de Respuestas (Outbound)
* **Frontend:** Botón "Enviar respuesta" en el modal/hilo de Inbox.
* **Backend (`POST /api/inbox/reply`):**
  - Recupera el item y las credenciales desencriptadas de la cuenta social.
  - Envía la carga útil a `MAKE_INBOX_REPLY_WEBHOOK_URL` (`https://hook.us2.make.com/7tljgngatolk6r3106ogx8yvjgs6peg1`).
* **Make (`RRSS - Responder Comentarios y DMs`):**
  - Módulo 1 (Custom Webhook): Recibe `{ platform, type, externalId, fromExternalId, replyMessage }`.
  - Módulo 2 (Router):
    1. `platform == "FACEBOOK"` & `type == "COMMENT"` ➡️ Módulo 10 (`Facebook Pages: Create a Comment`).
    2. `platform == "FACEBOOK"` & `type == "DM"` ➡️ Módulo 20 (`Facebook Messenger: Send a Message`).
    3. `platform == "INSTAGRAM"` & `type == "COMMENT"` ➡️ Módulo 30 (`Instagram for Business: Create a reply`).
    4. `platform == "INSTAGRAM"` & `type == "DM"` ➡️ Módulo 40 (`Facebook Messenger / Instagram DM: Send a Message`).
  - Módulos 11, 21, 31, 41: `Webhook Response` (200 OK).

### C. Solución Crítica Aplicada: Meta Handover Protocol
* **Problema encontrado:** Error `OAuthException (#10): El mensaje no se pudo enviar porque otra app está controlando esta conversación`.
* **Causa:** Manychat tenía asignado el permiso `"Toma el control de las conversaciones"` en la Fan Page de Facebook.
* **Solución:** Se removió la toma de control de Manychat y se otorgó acceso prioritario a la app propia (`probando2`).

---

## 3. Hoja de Ruta: Próximos Pasos (IA Autónoma)

Para lograr que la **IA responda solita todos los comentarios y DMs sin intervención manual**:

### Paso 1: Configurar el Asistente en Base de Datos y Settings
- La app ya cuenta con la infraestructura de IA en `lib/ai/auto-responder.ts` utilizando **Groq (Llama 3.3 70B)** con `GROQ_API_KEY`.
- Necesitamos asegurar que en la configuración del negocio (`BusinessSettings` o `AiPromptConfig`):
  - El switch **Auto-responder activo** esté en `true`.
  - Se defina el **System Prompt / Personalidad del negocio** (horarios, servicios, tono de voz, FAQs, número de WhatsApp para referir).

### Paso 2: Conectar el Pipeline Autónomo
- Cuando `/api/cron/sync-inbox` o el webhook de Meta guarde un nuevo `InboxItem` en estado `PENDING`:
  1. Invocar `processInboxItemWithAi(item.id)`.
  2. La IA analiza si es comentario o DM y genera la respuesta contextual.
  3. Si la configuración está en modo **"100% Automático"**:
     - Llama internamente a `dispatchReplyViaMake(...)` inmediatamente.
     - Actualiza el estado a `ANSWERED` y guarda el texto generado en `aiSuggestedReply` o historial de chat.
  4. Si está en modo **"Borrador / Sugerencia"**:
     - Deja la respuesta lista en el panel para aprobación con un clic.

### Paso 3: Reglas de Seguridad Anti-Spam de la IA
- Filtro de sentimiento y relevancia (evitar responder a emojis repetidos o mensajes de bots).
- Control de frecuencia (no responder más de una vez por hilo si el usuario no ha vuelto a preguntar).
- Ventana de 24 horas de Meta (validar que el mensaje tenga menos de 24h antes de intentar enviar el DM).
