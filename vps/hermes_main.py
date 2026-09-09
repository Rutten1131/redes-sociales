import os
import json
import asyncio
import re
import imaplib
import email
from email.header import decode_header
import httpx
import pymysql
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Hermes Agent Master",
    version="2.0.0",
    description="Agente central unificado: Social Scheduler + CRM MySQL + Evolution WhatsApp + IMAP."
)

# LLM Providers
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Social Scheduler
SCHEDULER_API_URL = os.getenv("SCHEDULER_API_URL", "https://redes-sociales-l5q4.vercel.app/api/agent")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")

# Evolution API WhatsApp
WHATSAPP_ADMIN_NUMBER = os.getenv("WHATSAPP_ADMIN_NUMBER", "593963410409")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://178.238.238.158:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "42a447c1-3d74-4b52-9571-042c174f7621")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "Crm empresa aviso cesar")

# Base de datos CRM Empresa
CRM_DATABASE_URL = os.getenv("CRM_DATABASE_URL", "mysql://crmempresa-3139303493:uqz4z2aok4@mysql.us.stackcp.com:43552/crmempresa-3139303493")

# IMAP Correos
EMAIL_TURISMO_USER = os.getenv("EMAIL_TURISMO_USER", "turismo@cesarreyesjaramillo.com")
EMAIL_TURISMO_PASS = os.getenv("EMAIL_TURISMO_PASS", "^m$$Z)*dYUIKJ")
EMAIL_TURISMO_HOST = os.getenv("EMAIL_TURISMO_HOST", "imap.cesarreyesjaramillo.com")
EMAIL_TURISMO_PORT = int(os.getenv("EMAIL_TURISMO_PORT", "993"))

def get_db_connection():
    # Parse mysql://user:pass@host:port/dbname
    m = re.match(r"mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", CRM_DATABASE_URL)
    if not m:
        raise Exception("Formato de CRM_DATABASE_URL inválido")
    user, password, host, port, db = m.groups()
    return pymysql.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=db,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=8
    )

# -------------------------------------------------------------
# TOOLS IMPLEMENTATION
# -------------------------------------------------------------

# 1. WhatsApp Evolution API
async def tool_send_whatsapp(message: str, recipient: Optional[str] = None) -> str:
    """Envía un mensaje de WhatsApp mediante Evolution API."""
    num = recipient or WHATSAPP_ADMIN_NUMBER
    # Formatear número (remover + y espacios)
    num = re.sub(r"\D", "", num)
    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": num,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
        "textMessage": {"text": message}
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code in [200, 201]:
                return f"✅ Mensaje de WhatsApp enviado correctamente a {num}."
            return f"⚠️ Error Evolution API: {r.status_code} - {r.text}"
    except Exception as e:
        return f"Error enviando WhatsApp: {str(e)}"

# 2. CRM Leads
async def tool_get_crm_leads(limit: int = 5) -> str:
    """Consulta los leads más recientes o destacados en la base de datos del CRM."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "SELECT id, email, nombre, empresa, telefono, estado, score, resumenIA FROM `Lead` ORDER BY updatedAt DESC LIMIT %s"
            cursor.execute(sql, (limit,))
            rows = cursor.fetchall()
        conn.close()

        if not rows:
            return "No hay leads registrados en el CRM."

        res = [f"📋 Leads encontrados ({len(rows)}):"]
        for l in rows:
            res.append(
                f"• {l.get('nombre') or 'Sin nombre'} ({l.get('empresa') or 'Particular'}) | "
                f"Estado: {l.get('estado')} | Score: {l.get('score')} | Tel: {l.get('telefono') or 'N/A'}\n"
                f"  Resumen: {l.get('resumenIA') or 'Sin resumen'}"
            )
        return "\n".join(res)
    except Exception as e:
        return f"Error consultando leads del CRM: {str(e)}"

# 3. CRM Tareas y Avisos
async def tool_get_crm_tasks() -> str:
    """Consulta las tareas y avisos pendientes en el CRM."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Buscar avisos/tareas pendientes
            sql = "SELECT id, tipo, estado, descripcion, fechaAviso, prioridad FROM Aviso WHERE estado = 'PENDIENTE' ORDER BY fechaAviso ASC LIMIT 10"
            cursor.execute(sql)
            rows = cursor.fetchall()
        conn.close()

        if not rows:
            return "No hay avisos o tareas pendientes en el CRM."

        res = [f"📅 Tareas y Avisos pendientes ({len(rows)}):"]
        for t in rows:
            res.append(f"• [{t.get('tipo')}] {t.get('descripcion')} | Fecha: {t.get('fechaAviso')} | Prioridad: {t.get('prioridad')}")
        return "\n".join(res)
    except Exception as e:
        return f"Error consultando tareas del CRM: {str(e)}"

# 4. Social Scheduler - Cuentas
async def tool_get_accounts() -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{SCHEDULER_API_URL}?action=accounts", headers=headers)
            if r.status_code == 200:
                biz_list = r.json().get("businesses", [])
                if not biz_list:
                    return "No hay cuentas de redes sociales conectadas."
                res = []
                for b in biz_list:
                    accs = [f"{a.get('platform')}: {a.get('displayName')}" for a in b.get("socialAccounts", [])]
                    res.append(f"🏢 Negocio: {b.get('name')} | Cuentas: {', '.join(accs)}")
                return "\n".join(res)
            return f"Error consultando cuentas: {r.status_code}"
    except Exception as e:
        return f"Error de conexión: {str(e)}"

# 5. Social Scheduler - Posts Pendientes
async def tool_get_pending_posts() -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{SCHEDULER_API_URL}?action=pending-posts", headers=headers)
            if r.status_code == 200:
                posts = r.json().get("posts", [])
                if not posts:
                    return "No hay publicaciones programadas pendientes."
                res = [f"- [{p.get('platform')}] {p.get('scheduledAt')} | \"{p.get('caption')}\"" for p in posts]
                return "\n".join(res)
            return f"Error: {r.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

# 6. Social Scheduler - Programar Post
async def tool_schedule_post(caption: str, scheduled_at_iso: str, media_url: Optional[str] = None) -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    payload = {
        "action": "schedule-post",
        "caption": caption,
        "scheduledAt": scheduled_at_iso,
        "mediaUrl": media_url or "",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(SCHEDULER_API_URL, json=payload, headers=headers)
            if r.status_code == 200:
                res = r.json()
                return f"✅ Publicación programada con éxito: {res.get('message')}"
            return f"⚠️ Error al programar: {r.status_code} - {r.text}"
    except Exception as e:
        return f"Error: {str(e)}"

# 7. Social Scheduler - Inbox
async def tool_get_inbox() -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{SCHEDULER_API_URL}?action=unread-inbox", headers=headers)
            if r.status_code == 200:
                items = r.json().get("unread", [])
                if not items:
                    return "No hay mensajes ni comentarios pendientes en el inbox."
                res = [f"- {it.get('type')} en {it.get('platform')}: \"{it.get('content')}\"" for it in items]
                return "\n".join(res)
            return f"Error: {r.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

# 8. IMAP - Revisar Correos de Turismo
def tool_check_emails_sync() -> str:
    try:
        mail = imaplib.IMAP4_SSL(EMAIL_TURISMO_HOST, EMAIL_TURISMO_PORT)
        mail.login(EMAIL_TURISMO_USER, EMAIL_TURISMO_PASS)
        mail.select("inbox")
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return "No se pudo acceder a la bandeja de entrada."
        
        email_ids = messages[0].split()
        if not email_ids:
            return "✨ No hay correos nuevos no leídos en turismo@cesarreyesjaramillo.com."

        recent_ids = email_ids[-3:] # Tomar los últimos 3
        res = [f"📬 Correos nuevos en Turismo ({len(email_ids)} no leídos):"]

        for eid in reversed(recent_ids):
            _, msg_data = mail.fetch(eid, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                    sender = msg.get("From")
                    res.append(f"• De: {sender} | Asunto: {subject}")

        mail.close()
        mail.logout()
        return "\n".join(res)
    except Exception as e:
        return f"Error al revisar correos IMAP: {str(e)}"

async def tool_check_emails() -> str:
    return await asyncio.to_thread(tool_check_emails_sync)

# -------------------------------------------------------------
# ESQUEMAS DE FUNCTION CALLING PARA GROQ / GEMINI
# -------------------------------------------------------------
TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp",
            "description": "Envía un mensaje o aviso urgente al WhatsApp de César (o a otro número especificado) mediante Evolution API.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "El texto del mensaje a enviar."},
                    "recipient": {"type": "string", "description": "Número con código de país opcional. Por defecto es 593963410409."}
                },
                "required": ["message"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_crm_leads",
            "description": "Consulta clientes y prospectos registrados en el CRM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Cantidad de leads a mostrar, default 5"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_crm_tasks",
            "description": "Consulta las tareas, recordatorios y avisos pendientes en el CRM.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_emails",
            "description": "Revisa los correos nuevos no leídos en la cuenta de turismo.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_accounts",
            "description": "Obtiene las cuentas de redes sociales conectadas al sistema.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_posts",
            "description": "Consulta las publicaciones programadas pendientes.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_inbox",
            "description": "Revisa mensajes directos o comentarios pendientes en redes sociales.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_post",
            "description": "Programa una publicación en redes sociales con copy y fecha/hora ISO.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caption": {"type": "string", "description": "Copy con emojis y hashtags."},
                    "scheduled_at_iso": {"type": "string", "description": "Fecha y hora en ISO 8601 UTC."},
                    "media_url": {"type": "string", "description": "URL de la imagen o video opcional."}
                },
                "required": ["caption", "scheduled_at_iso"]
            }
        }
    }
]

SYSTEM_PROMPT = """Eres Hermes Master, el asistente y agente de operaciones central de César Reyes.
Tienes herramientas activas para:
1. WhatsApp (`send_whatsapp`): Enviar avisos y reportes directamente al WhatsApp de César vía Evolution API.
2. CRM (`get_crm_leads`, `get_crm_tasks`): Consultar leads, prospectos y tareas pendientes en la base de datos de crmempresa.
3. Correos (`check_emails`): Revisar correos entrantes de turismo.
4. Redes Sociales (`schedule_post`, `get_pending_posts`, `get_accounts`, `get_inbox`): Programar posts y monitorear redes.

Directrices:
- Si César te pide que le avises o le envíes algo a WhatsApp, ejecuta `send_whatsapp`.
- Si te pregunta por clientes, leads, cotizaciones o tareas, consulta las funciones del CRM.
- Si te pide programar un post, redacta un copy de alto impacto y programa la publicación.
- Sé profesional, claro, proactivo y ejecutivo.
"""

async def run_agent_turn(user_message: str) -> str:
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ]

        response = client.chat.completions.create(
            model=DEFAULT_GROQ_MODEL,
            messages=messages,
            tools=TOOLS_DEFINITIONS,
            tool_choice="auto",
            temperature=0.4
        )

        response_msg = response.choices[0].message
        tool_calls = response_msg.tool_calls

        if not tool_calls:
            return response_msg.content or "Entendido."

        messages.append(response_msg)

        for tc in tool_calls:
            fn = tc.function.name
            args = json.loads(tc.function.arguments or "{}")
            print(f"[Hermes Master Call] {fn} con args {args}")

            res = ""
            if fn == "send_whatsapp":
                res = await tool_send_whatsapp(args.get("message", ""), args.get("recipient"))
            elif fn == "get_crm_leads":
                res = await tool_get_crm_leads(args.get("limit", 5))
            elif fn == "get_crm_tasks":
                res = await tool_get_crm_tasks()
            elif fn == "check_emails":
                res = await tool_check_emails()
            elif fn == "get_accounts":
                res = await tool_get_accounts()
            elif fn == "get_pending_posts":
                res = await tool_get_pending_posts()
            elif fn == "get_inbox":
                res = await tool_get_inbox()
            elif fn == "schedule_post":
                res = await tool_schedule_post(args.get("caption", ""), args.get("scheduled_at_iso", ""), args.get("media_url"))
            else:
                res = f"Función {fn} desconocida."

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": fn,
                "content": res
            })

        final_resp = client.chat.completions.create(
            model=DEFAULT_GROQ_MODEL,
            messages=messages,
            temperature=0.5
        )

        return final_resp.choices[0].message.content or "Listo."

    except Exception as e:
        print(f"[Hermes Master Error] {e}")
        return f"Error en la operación: {str(e)}"

# -------------------------------------------------------------
# TELEGRAM POLLING WORKER
# -------------------------------------------------------------
async def send_telegram(chat_id: int, text: str):
    if not TELEGRAM_BOT_TOKEN:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json=payload)
    except Exception as e:
        print(f"[Telegram Send Error] {e}")

async def telegram_worker():
    if not TELEGRAM_BOT_TOKEN:
        return

    offset = 0
    print("[Telegram Master Worker] Activo...")

    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={offset}&timeout=20"
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        msg = update.get("message")
                        if not msg or "text" not in msg:
                            continue

                        chat_id = msg["chat"]["id"]
                        user_text = msg["text"].strip()
                        print(f"[Telegram Master IN] {chat_id}: {user_text}")

                        if user_text.lower() in ["/start", "start"]:
                            welcome = (
                                "👑 ¡Hola César! Soy Hermes Master, tu agente central de operaciones.\n\n"
                                "⚡ Mis superpoderes conectados:\n"
                                "📲 WhatsApp Evolution: Puedo enviar avisos y reportes a tu WhatsApp.\n"
                                "👥 CRM Empresa: Consulto tus leads, prospectos y cotizaciones.\n"
                                "📅 Tareas y Avisos: Reviso pendientes de tu agenda.\n"
                                "📬 Correos Turismo: Verifico correos de clientes no leídos.\n"
                                "🚀 Redes Sociales: Programo publicaciones y reviso DMs/comentarios.\n\n"
                                "💡 Háblame naturalmente, por ejemplo:\n"
                                "• 'Hermes, mándame al WhatsApp un saludo de prueba'\n"
                                "• '¿Cuáles son los últimos leads del CRM?'\n"
                                "• 'Revisa si llegaron correos nuevos'\n"
                                "• 'Programa un post para mañana a las 7pm sobre nuestro nuevo servicio'"
                            )
                            await send_telegram(chat_id, welcome)
                            continue

                        reply = await run_agent_turn(user_text)
                        await send_telegram(chat_id, reply)

        except Exception as e:
            print(f"[Telegram Master Loop Error] {e}")
            await asyncio.sleep(4)

@app.on_event("startup")
async def startup():
    asyncio.create_task(telegram_worker())

@app.get("/")
def root():
    return {"status": "online", "agent": "Hermes Master v2.0"}
