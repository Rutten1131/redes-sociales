#!/usr/bin/env python3
"""
Upgrades Hermes Agent with import re included.
"""
import re

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update tool_crear_deal definition if not already done
if "SESSION_LAST_DEAL = {}" not in code:
    old_deal_tool = """async def tool_crear_deal(cliente: str, servicio: str, monto: float = 0,
                          telefono: str = "", notas: str = "", 
                          link_propuesta: str = "", tags: str = "") -> str:
    \"\"\"Crea un nuevo deal/propuesta en el pipeline CRM del Scraper.\"\"\"
    try:
        payload = {
            "cliente": cliente,
            "servicio": servicio,
            "monto": monto,
            "telefono": telefono,
            "link_propuesta": link_propuesta,
            "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
            "notas_inicial": notas,
            "origen": "telegram",
            "status": "contacto_inicial"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post("http://178.238.238.158:8000/api/deals",
                                  json=payload)
            if r.status_code in (200, 201):
                deal = r.json()
                return f"✅ Deal creado exitosamente:\\n• Cliente: {deal.get('cliente')}\\n• Servicio: {deal.get('servicio')}\\n• Monto: ${deal.get('monto', 0):,.0f}\\n• ID: {deal.get('id')}\\n• Estado: Contacto Inicial\\nPuedes verlo en: http://scraper.178.238.238.158.sslip.io/deals"
            else:
                return f"❌ Error al crear deal: {r.status_code} - {r.text}"
    except Exception as e:
        return f"❌ Error de conexión al crear deal: {str(e)}" """

    new_deal_tool = """# Estado de conversación en memoria (guarda el último deal creado o consultado por chat)
SESSION_LAST_DEAL = {}

async def tool_crear_deal(cliente: str, servicio: str, monto: float = 0,
                          telefono: str = "", notas: str = "", 
                          link_propuesta: str = "", link_mvp: str = "", tags: str = "") -> str:
    \"\"\"Crea un nuevo deal/propuesta en el pipeline CRM del Scraper.\"\"\"
    try:
        payload = {
            "cliente": cliente,
            "servicio": servicio,
            "monto": monto,
            "telefono": telefono,
            "link_propuesta": link_propuesta,
            "link_mvp": link_mvp,
            "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
            "notas_inicial": notas,
            "origen": "telegram",
            "status": "propuesta_enviada" if (link_propuesta or monto > 0) else "contacto_inicial"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post("http://178.238.238.158:8000/api/deals",
                                  json=payload)
            if r.status_code in (200, 201):
                deal = r.json()
                deal_id = deal.get("id")
                SESSION_LAST_DEAL["active"] = deal
                
                resp = (
                    f"✅ **¡Deal registrado con éxito en tu CRM!**\\n\\n"
                    f"🏢 **Cliente:** {deal.get('cliente')}\\n"
                    f"💼 **Servicio:** {deal.get('servicio')}\\n"
                    f"💵 **Monto Cotizado:** ${deal.get('monto', 0):,.2f} USD\\n"
                    f"📞 **Teléfono:** {deal.get('telefono') or 'No registrado'}\\n"
                    f"🔗 **Propuesta:** {deal.get('link_propuesta') or 'Pendiente'}\\n"
                    f"🚀 **MVP Demo:** {deal.get('link_mvp') or 'Pendiente'}\\n"
                    f"📌 **Estado:** {deal.get('status')}\\n\\n"
                    f"🌐 Puedes gestionarlo en tu panel:\\n"
                    f"https://scraper.178.238.238.158.sslip.io/deals\\n\\n"
                    f"_Tip: Si tienes el PDF de la cotización o capturas, puedes reenviármelas aquí directamente y las adjuntaré a este cliente._"
                )
                return resp
            else:
                return f"❌ Error al crear deal: {r.status_code} - {r.text}"
    except Exception as e:
        return f"❌ Error de conexión al crear deal: {str(e)}"

async def tool_actualizar_deal(deal_id: str = "", cliente: str = "", monto: float = None, 
                              telefono: str = "", link_propuesta: str = "", link_mvp: str = "",
                              nota: str = "", status: str = "") -> str:
    \"\"\"Actualiza un deal existente con links, montos, notas o cambio de estado.\"\"\"
    try:
        target_id = deal_id
        if not target_id and SESSION_LAST_DEAL.get("active"):
            target_id = SESSION_LAST_DEAL["active"].get("id")
            
        if not target_id:
            return "No encontré el ID del deal a actualizar. Por favor indícame a qué cliente corresponde."
            
        update_data = {}
        if cliente: update_data["cliente"] = cliente
        if monto is not None and monto > 0: update_data["monto"] = monto
        if telefono: update_data["telefono"] = telefono
        if link_propuesta: update_data["link_propuesta"] = link_propuesta
        if link_mvp: update_data["link_mvp"] = link_mvp
        if status: update_data["status"] = status
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            if update_data:
                r = await client.put(f"http://178.238.238.158:8000/api/deals/{target_id}", json=update_data)
            if nota:
                await client.post(f"http://178.238.238.158:8000/api/deals/{target_id}/notes", json={"texto": nota, "origen": "telegram"})
                
            return f"✅ **Deal de {cliente or target_id} actualizado exitosamente.** Ver en: https://scraper.178.238.238.158.sslip.io/deals"
    except Exception as e:
        return f"❌ Error al actualizar deal: {str(e)}"
"""
    code = code.replace(old_deal_tool.strip(), new_deal_tool.strip(), 1)
    print("OK: Replaced tool_crear_deal")

# 2. Add file download function
telegram_file_handler = """
async def save_telegram_document_to_deals(file_id: str, file_name: str, caption: str = "") -> str:
    \"\"\"Descarga un documento enviado por Telegram y lo asocia al último deal o lo almacena en deals_files.\"\"\"
    try:
        url_file = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url_file)
            if r.status_code != 200:
                return "❌ No pude obtener la ubicación del archivo desde Telegram."
            tg_file_path = r.json().get("result", {}).get("file_path")
            if not tg_file_path:
                return "❌ Archivo no encontrado en Telegram."

            download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{tg_file_path}"
            file_resp = await client.get(download_url)
            if file_resp.status_code != 200:
                return "❌ Error al descargar el archivo."

            files = {"file": (file_name, file_resp.content)}
            
            target_deal = SESSION_LAST_DEAL.get("active")
            if target_deal and target_deal.get("id"):
                deal_id = target_deal["id"]
                upload_url = f"http://178.238.238.158:8000/api/deals/{deal_id}/upload"
                res = await client.post(upload_url, files=files)
                if res.status_code in (200, 201):
                    file_info = res.json()
                    public_file_url = f"https://scraper.178.238.238.158.sslip.io{file_info.get('url')}"
                    return (
                        f"📎 **¡Archivo recibido y adjuntado al deal!**\\n\\n"
                        f"📄 **Nombre:** `{file_name}`\\n"
                        f"🏢 **Cliente:** {target_deal.get('cliente')}\\n"
                        f"🔗 **Enlace directo al archivo:**\\n{public_file_url}\\n\\n"
                        f"Quedó guardado en la fila del cliente en: https://scraper.178.238.238.158.sslip.io/deals"
                    )
            
            gen_url = "http://178.238.238.158:8000/api/deals/upload"
            res = await client.post(gen_url, files=files)
            if res.status_code in (200, 201):
                file_info = res.json()
                public_file_url = f"https://scraper.178.238.238.158.sslip.io{file_info.get('url')}"
                return (
                    f"📎 **Archivo guardado en el servidor:**\\n"
                    f"📄 `{file_name}`\\n"
                    f"🔗 {public_file_url}\\n\\n"
                    f"¿A qué cliente o propuesta te gustaría que asocie este archivo?"
                )
            return "❌ Error al guardar el archivo en el sistema de deals."
    except Exception as e:
        return f"❌ Error procesando el archivo: {str(e)}"
"""

if "save_telegram_document_to_deals" not in code:
    target_pos = "async def send_telegram(chat_id: int, text: str):"
    code = code.replace(target_pos, telegram_file_handler + "\n" + target_pos, 1)
    print("OK: Added save_telegram_document_to_deals")

# 3. Update TOOLS_DEFINITIONS
new_tools = """TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "crear_deal",
            "description": "Crea un nuevo deal o propuesta en el pipeline CRM cuando César mencione una nueva propuesta, cliente, cotización o proyecto (de $1k a $4k USD). Debe registrar cliente, servicio, monto cotizado, teléfono, link de propuesta/PDF y link de MVP.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cliente": {"type": "string", "description": "Nombre completo del cliente o empresa"},
                    "servicio": {"type": "string", "description": "Descripción del servicio (ej: Plataforma Web, CRM con IA, Bot de WhatsApp, etc.)"},
                    "monto": {"type": "number", "description": "Monto cotizado en dólares USD (ej: 1500, 2800, 3500)"},
                    "telefono": {"type": "string", "description": "Teléfono o WhatsApp del cliente"},
                    "link_propuesta": {"type": "string", "description": "Enlace a la cotización, PDF o Google Drive"},
                    "link_mvp": {"type": "string", "description": "Enlace al demo interactivo, prototipo o MVP"},
                    "notas": {"type": "string", "description": "Detalles hablados con el cliente, objeciones o acuerdos"},
                    "tags": {"type": "string", "description": "Etiquetas separadas por coma (ej: vip, saas, seguimiento-largo)"}
                },
                "required": ["cliente", "servicio"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "actualizar_deal",
            "description": "Actualiza un deal ya registrado con nuevos datos como monto, teléfono, link de propuesta, link de MVP, notas o estado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "deal_id": {"type": "string", "description": "ID del deal si se conoce"},
                    "cliente": {"type": "string", "description": "Nombre del cliente"},
                    "monto": {"type": "number", "description": "Nuevo monto cotizado en USD"},
                    "telefono": {"type": "string", "description": "Teléfono del cliente"},
                    "link_propuesta": {"type": "string", "description": "URL de la cotización/PDF"},
                    "link_mvp": {"type": "string", "description": "URL del demo o MVP"},
                    "nota": {"type": "string", "description": "Nueva nota o avance de la conversación"},
                    "status": {"type": "string", "enum": ["contacto_inicial", "propuesta_enviada", "negociacion", "ganado", "perdido"]}
                }
            }
        }
    },"""

if '"name": "actualizar_deal"' not in code:
    code = re.sub(r'TOOLS_DEFINITIONS\s*=\s*\[\s*\{\s*"type":\s*"function",\s*"function":\s*\{\s*"name":\s*"crear_deal",.*?"required":\s*\["cliente",\s*"servicio"\]\s*\}\s*\},', new_tools, code, flags=re.DOTALL)
    print("OK: Updated TOOLS_DEFINITIONS")

# 4. Dispatch for actualizar_deal in run_agent_turn
if 'elif fn == "actualizar_deal":' not in code:
    code = code.replace('elif fn == "crear_deal":\n                res = await tool_crear_deal(**args)',
                        'elif fn == "crear_deal":\n                res = await tool_crear_deal(**args)\n            elif fn == "actualizar_deal":\n                res = await tool_actualizar_deal(**args)', 1)
    print("OK: Added actualizar_deal dispatch")

# 5. Enhanced SYSTEM_PROMPT for Sales Interviewing
new_prompt = '''SYSTEM_PROMPT = """Eres Hermes Master, el asistente personal de élite, director de operaciones y gestor comercial de César Reyes (también conocido como Abel o Abelito).

🌍 ZONA HORARIA OBLIGATORIA: ECUADOR (America/Guayaquil, UTC-5).
- Hora oficial actual de trabajo: Ecuador.

🎯 PROTOCOLO COMERCIAL Y REGISTRO DE DEALS / PROPUESTAS:
César presenta cotizaciones y desarrollos de $1,000 a $4,000 USD. A menudo estos proyectos tienen ciclos de decisión largos. Tu misión es tener el CRM impecable.

1. Si César te cuenta sobre un cliente nuevo o propuesta (por audio o texto):
   - Extrae todo lo que puedas: nombre del cliente, servicio/desarrollo, monto cotizado en USD, teléfono/contacto, notas clave y enlaces (propuesta PDF, demo MVP).
   - SI CÉSAR YA DIO EL NOMBRE Y SERVICIO: EJECUTA INMEDIATAMENTE `crear_deal` con los datos que tengas.
   - EN TU RESPUESTA, felicítalo por la gestión y PREGÚNTALE amablemente los datos que aún falten para completar la ficha:
     * Si no dio el monto: "¿Por cuánto fue la cotización aproximada? (ej: $1,500, $2,500, $3,500)"
     * Si no dio teléfono: "¿Cuál es el WhatsApp del cliente para guardarlo?"
     * Si no dio enlaces: "Si tienes el PDF de la propuesta o el link del MVP/Demo, envíamelo por aquí y lo adjunto de inmediato al cliente."

2. Si César te manda enlaces (Drive, Notion, link web de demo, Loom):
   - Llama a `actualizar_deal` para guardar el `link_propuesta` o `link_mvp`.

3. REGLA PARA RECORDATORIOS PERSONALES (¡NO CONFUNDIR CON CLIENTES!):
- Cuando César diga: "hazme acuerdo de...", "déjame agendando mañana a las 2 de la tarde en...", NO pidas datos de clientes. Es un recordatorio personal para él. Llama a `crear_recordatorio`.
"""'''

if "PROTOCOLO COMERCIAL Y REGISTRO DE DEALS" not in code:
    code = re.sub(r'SYSTEM_PROMPT\s*=\s*""".*?"""', new_prompt, code, flags=re.DOTALL)
    print("OK: Updated SYSTEM_PROMPT")

# 6. Telegram worker file and photo handler
new_tg_handler = """                        # Manejo de Documentos (PDF, Word, Excel, etc.) o Fotos
                        document = msg.get("document")
                        photo = msg.get("photo")
                        caption = msg.get("caption", "").strip()

                        if document and not (document.get("mime_type", "").startswith("audio/") or document.get("file_name", "").endswith(".ogg")):
                            file_id = document.get("file_id")
                            file_name = document.get("file_name", "documento.pdf")
                            await send_telegram(chat_id, f"📥 _Recibiendo archivo: {file_name}..._")
                            res_file = await save_telegram_document_to_deals(file_id, file_name, caption)
                            await send_telegram(chat_id, res_file)
                            if caption:
                                user_text = f"El usuario envió el archivo {file_name} con la siguiente nota: {caption}"
                            else:
                                continue

                        elif photo:
                            best_photo = photo[-1]
                            file_id = best_photo.get("file_id")
                            file_name = f"captura_{int(asyncio.get_event_loop().time())}.jpg"
                            await send_telegram(chat_id, "📸 _Recibiendo imagen / captura de propuesta..._")
                            res_file = await save_telegram_document_to_deals(file_id, file_name, caption)
                            await send_telegram(chat_id, res_file)
                            if caption:
                                user_text = f"El usuario envió una captura con la siguiente nota: {caption}"
                            else:
                                continue

                        if not user_text:
                            continue"""

if "Manejo de Documentos (PDF, Word, Excel, etc.)" not in code:
    code = code.replace("if not user_text:\n                            continue", new_tg_handler, 1)
    print("OK: Added Telegram document and photo handling")

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(code)

print("Hermes Agent upgrade successfully applied!")
