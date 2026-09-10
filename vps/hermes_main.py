import os
import json
import asyncio
import re
import io
import uuid
from datetime import datetime, timedelta
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
    version="2.3.0",
    description="Agente central unificado: Agendamiento Inteligente con Hora Ecuador + Alertas en Cascada (1h, 30m, 10m) + CRM + WhatsApp + Redes."
)

# LLM Providers
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"

# Telegram
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = "2126922376"

# Social Scheduler
SCHEDULER_API_URL = os.getenv("SCHEDULER_API_URL", "https://redes-sociales-l5q4.vercel.app/api/agent")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")

# Evolution API WhatsApp
WHATSAPP_ADMIN_NUMBER = os.getenv("WHATSAPP_ADMIN_NUMBER", "+593963410409")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://178.238.238.158:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "42a447c1-3d74-4b52-9571-042c174f7621")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "agenda-cultural")

# Base de datos CRM Empresa
CRM_DATABASE_URL = os.getenv("CRM_DATABASE_URL", "mysql://crmempresa-3139303493:uqz4z2aok4@mysql.us.stackcp.com:43552/crmempresa-3139303493")

# IMAP Correos
EMAIL_TURISMO_USER = os.getenv("EMAIL_TURISMO_USER", "turismo@cesarreyesjaramillo.com")
EMAIL_TURISMO_PASS = os.getenv("EMAIL_TURISMO_PASS", "^m$$Z)*dYUIKJ")
EMAIL_TURISMO_HOST = os.getenv("EMAIL_TURISMO_HOST", "imap.cesarreyesjaramillo.com")
EMAIL_TURISMO_PORT = int(os.getenv("EMAIL_TURISMO_PORT", "993"))

def get_db_connection():
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
# AUDIO TRANSCRIPTION CON GROQ WHISPER
# -------------------------------------------------------------
async def transcribe_telegram_audio(file_id: str) -> Optional[str]:
    try:
        url_file = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(url_file)
            if r.status_code != 200:
                return None
            file_path = r.json().get("result", {}).get("file_path")
            if not file_path:
                return None

            download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
            audio_resp = await client.get(download_url)
            if audio_resp.status_code != 200:
                return None
            audio_bytes = audio_resp.content

        from groq import Groq
        client_groq = Groq(api_key=GROQ_API_KEY)
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "voice.ogg"

        transcription = client_groq.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3-turbo",
            language="es",
            response_format="text"
        )
        return str(transcription).strip()
    except Exception as e:
        print(f"[Whisper Error] {e}")
        return None

# -------------------------------------------------------------
# TOOLS IMPLEMENTATION
# -------------------------------------------------------------
async def tool_send_whatsapp(message: str, recipient: Optional[str] = None) -> str:
    num = recipient or WHATSAPP_ADMIN_NUMBER
    clean_num = re.sub(r"\D", "", num)
    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    headers = {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}
    payload = {
        "number": clean_num,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
        "textMessage": {"text": message}
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code in [200, 201]:
                return f"✅ Mensaje de WhatsApp enviado a {num}."
            return f"⚠️ Error Evolution: {r.status_code} - {r.text}"
    except Exception as e:
        return f"Error enviando WhatsApp: {str(e)}"

# Guardar recordatorio con zona horaria de Ecuador (UTC-5)
async def tool_crear_recordatorio(titulo: str, mensaje: str, fecha_hora_ecuador: str) -> str:
    """Crea un aviso en el CRM con hora local de Ecuador."""
    try:
        conn = get_db_connection()
        record_id = "c" + uuid.uuid4().hex[:24]
        fecha_clean = fecha_hora_ecuador.replace("T", " ").replace("Z", "")[:19]

        with conn.cursor() as cur:
            sql = """
                INSERT INTO Aviso (id, titulo, mensaje, telefono, fechaProg, estado, creadoPor, createdAt, recordatorio1hEnviado, recordatorio30minEnviado, recordatorio10minEnviado)
                VALUES (%s, %s, %s, %s, %s, 'PENDIENTE', 'hermes', NOW(), 0, 0, 0)
            """
            cur.execute(sql, (record_id, titulo, mensaje, WHATSAPP_ADMIN_NUMBER, fecha_clean))
            conn.commit()
        conn.close()

        # Enviar confirmación inmediata a WhatsApp de César
        wa_text = (
            f"⏰ *Recordatorio Agendado (Hora Ecuador)*\n\n"
            f"📌 *{titulo}*\n"
            f"📍 *Lugar / Detalle:* {mensaje}\n"
            f"🕒 *Hora:* {fecha_clean}\n\n"
            f"🔔 _Te avisaré automáticamente 1 hora antes, 30 min antes y 10 min antes por WhatsApp y Telegram._"
        )
        await tool_send_whatsapp(wa_text)

        return f"✅ Listo César. Agendé tu compromiso para el {fecha_clean} (Hora de Ecuador). Te envié la confirmación a tu WhatsApp y te avisaré 1h antes, 30 min antes y 10 min antes."
    except Exception as e:
        return f"Error creando el recordatorio: {str(e)}"

async def tool_get_crm_leads(limit: int = 5) -> str:
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
            res.append(f"• {l.get('nombre') or 'Sin nombre'} ({l.get('empresa') or 'Particular'}) | Estado: {l.get('estado')} | Tel: {l.get('telefono') or 'N/A'}")
        return "\n".join(res)
    except Exception as e:
        return f"Error consultando leads: {str(e)}"

async def tool_get_crm_tasks() -> str:
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            sql = "SELECT id, titulo, mensaje, fechaProg, estado FROM Aviso WHERE estado = 'PENDIENTE' ORDER BY fechaProg ASC LIMIT 10"
            cursor.execute(sql)
            rows = cursor.fetchall()
        conn.close()

        if not rows:
            return "No tienes recordatorios pendientes en tu calendario."

        res = [f"📅 Recordatorios pendientes ({len(rows)}):"]
        for t in rows:
            res.append(f"• 📌 {t.get('titulo')} | 🕒 {t.get('fechaProg')} (Ecuador) | {t.get('mensaje')}")
        return "\n".join(res)
    except Exception as e:
        return f"Error consultando avisos: {str(e)}"

async def tool_get_accounts() -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{SCHEDULER_API_URL}?action=accounts", headers=headers)
            if r.status_code == 200:
                biz_list = r.json().get("businesses", [])
                if not biz_list:
                    return "No hay cuentas conectadas."
                res = [f"🏢 {b.get('name')}: {', '.join([a.get('platform') for a in b.get('socialAccounts', [])])}" for b in biz_list]
                return "\n".join(res)
            return f"Error: {r.status_code}"
    except Exception as e:
        return f"Error de conexión: {str(e)}"

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
                return f"✅ Publicación programada: {r.json().get('message')}"
            return f"⚠️ Error: {r.status_code} - {r.text}"
    except Exception as e:
        return f"Error: {str(e)}"

async def tool_get_inbox() -> str:
    headers = {"Authorization": f"Bearer {INTERNAL_API_SECRET}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{SCHEDULER_API_URL}?action=unread-inbox", headers=headers)
            if r.status_code == 200:
                items = r.json().get("unread", [])
                if not items:
                    return "No hay mensajes pendientes."
                return "\n".join([f"• {it.get('type')}: \"{it.get('content')}\"" for it in items])
            return f"Error: {r.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

def tool_check_emails_sync() -> str:
    try:
        mail = imaplib.IMAP4_SSL(EMAIL_TURISMO_HOST, EMAIL_TURISMO_PORT)
        mail.login(EMAIL_TURISMO_USER, EMAIL_TURISMO_PASS)
        mail.select("inbox")
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return "No se pudo acceder a la bandeja."
        email_ids = messages[0].split()
        if not email_ids:
            return "✨ No hay correos nuevos no leídos en turismo@cesarreyesjaramillo.com."
        recent_ids = email_ids[-3:]
        res = [f"📬 Correos nuevos ({len(email_ids)} no leídos):"]
        for eid in reversed(recent_ids):
            _, msg_data = mail.fetch(eid, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                    res.append(f"• De: {msg.get('From')} | Asunto: {subject}")
        mail.close()
        mail.logout()
        return "\n".join(res)
    except Exception as e:
        return f"Error IMAP: {str(e)}"

async def tool_check_emails() -> str:
    return await asyncio.to_thread(tool_check_emails_sync)

# -------------------------------------------------------------
# FUNCTION CALLING DEFINITIONS
# -------------------------------------------------------------
TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "crear_recordatorio",
            "description": "Agendar un recordatorio personal para César en HORA LOCAL DE ECUADOR (UTC-5).",
            "parameters": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string", "description": "Título claro del recordatorio (ej: 'Almuerzo en Costillas del Huayaco')."},
                    "mensaje": {"type": "string", "description": "Lugar exacto o notas."},
                    "fecha_hora_ecuador": {"type": "string", "description": "Fecha y hora en formato YYYY-MM-DD HH:MM:SS en HORA LOCAL DE ECUADOR. Por ejemplo, si hoy es 9 de septiembre y dice mañana a las 2 de la tarde (14:00), es: '2026-09-10 14:00:00'."}
                },
                "required": ["titulo", "mensaje", "fecha_hora_ecuador"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp",
            "description": "Enviar un mensaje directo a WhatsApp de César.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Texto del mensaje."}
                },
                "required": ["message"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_crm_tasks",
            "description": "Ver tareas y recordatorios agendados para César.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_crm_leads",
            "description": "Consultar prospectos o clientes del CRM.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_emails",
            "description": "Revisar correos no leídos.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_post",
            "description": "Programar publicación en redes sociales.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caption": {"type": "string"},
                    "scheduled_at_iso": {"type": "string"}
                },
                "required": ["caption", "scheduled_at_iso"]
            }
        }
    }
]

SYSTEM_PROMPT = """Eres Hermes Master, el asistente personal y de operaciones de César Reyes (conocido también como Abel o Abelito).

🌍 ZONA HORARIA OBLIGATORIA: ECUADOR (America/Guayaquil, UTC-5).
- La fecha de hoy es: Miércoles 9 de Septiembre de 2026.
- Por tanto, "mañana" es Jueves 10 de Septiembre de 2026.
- Las "2 de la tarde" son las 14:00:00.

REGLA PARA RECORDATORIOS PERSONALES:
- Cuando César te diga por audio o texto: "hazme acuerdo de...", "déjame agendando mañana a las 2 de la tarde en...", NO pidas datos de clientes. ¡Es un recordatorio para él mismo!
- Llama a `crear_recordatorio` calculando la fecha en HORA DE ECUADOR (ej: `2026-09-10 14:00:00`).
- Dile que ya quedó guardado y que el sistema le avisará automáticamente 1 hora antes, 30 minutos antes y 10 minutos antes tanto por WhatsApp como por Telegram.
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
            temperature=0.2
        )

        response_msg = response.choices[0].message
        tool_calls = response_msg.tool_calls

        if not tool_calls:
            return response_msg.content or "Entendido."

        messages.append(response_msg)

        for tc in tool_calls:
            fn = tc.function.name
            args = json.loads(tc.function.arguments or "{}")
            print(f"[Hermes Master Call] {fn} -> {args}")

            res = ""
            if fn == "crear_recordatorio":
                res = await tool_crear_recordatorio(args.get("titulo", ""), args.get("mensaje", ""), args.get("fecha_hora_ecuador", ""))
            elif fn == "send_whatsapp":
                res = await tool_send_whatsapp(args.get("message", ""))
            elif fn == "get_crm_tasks":
                res = await tool_get_crm_tasks()
            elif fn == "get_crm_leads":
                res = await tool_get_crm_leads()
            elif fn == "check_emails":
                res = await tool_check_emails()
            elif fn == "schedule_post":
                res = await tool_schedule_post(args.get("caption", ""), args.get("scheduled_at_iso", ""))
            else:
                res = f"Herramienta {fn} ejecutada."

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": fn,
                "content": res
            })

        final_resp = client.chat.completions.create(
            model=DEFAULT_GROQ_MODEL,
            messages=messages,
            temperature=0.3
        )

        return final_resp.choices[0].message.content or "Listo."

    except Exception as e:
        print(f"[Hermes Master Error] {e}")
        return f"Error: {str(e)}"

# -------------------------------------------------------------
# MOTOR DE ALERTAS EN CASCADA (1h, 30m, 10m ANTES)
# -------------------------------------------------------------
async def reminder_monitor_worker():
    """Revisa cada 60 segundos si algún compromiso está a 1h, 30m o 10m de vencer (Hora Ecuador)"""
    print("[Reminder Cascading Monitor] Monitor de alertas en cascada activo...")
    await asyncio.sleep(10)

    while True:
        try:
            # Hora actual de Ecuador = UTC - 5 horas
            now_utc = datetime.utcnow()
            now_ec = now_utc - timedelta(hours=5)

            in_60m = now_ec + timedelta(minutes=60)
            in_30m = now_ec + timedelta(minutes=30)
            in_10m = now_ec + timedelta(minutes=10)

            conn = get_db_connection()
            with conn.cursor() as cur:
                # 1. Alerta de 1 Hora Antes
                sql_1h = """
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND recordatorio1hEnviado = 0 
                      AND fechaProg > %s AND fechaProg <= %s
                """
                cur.execute(sql_1h, (now_ec, in_60m))
                for a in cur.fetchall():
                    txt = f"🚨 *AVISO: En 1 HORA tienes un compromiso*\n\n📌 *{a['titulo']}*\n📍 *Detalle:* {a['mensaje']}\n🕒 *Hora:* {a['fechaProg']}"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio1hEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()

                # 2. Alerta de 30 Minutos Antes
                sql_30m = """
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND recordatorio30minEnviado = 0 
                      AND fechaProg > %s AND fechaProg <= %s
                """
                cur.execute(sql_30m, (now_ec, in_30m))
                for a in cur.fetchall():
                    txt = f"⚠️ *AVISO: En 30 MINUTOS tienes tu cita*\n\n📌 *{a['titulo']}*\n📍 *Detalle:* {a['mensaje']}\n🕒 *Hora:* {a['fechaProg']}\n\n_Ve alistándote para salir._"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio30minEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()

                # 3. Alerta de 10 Minutos Antes
                sql_10m = """
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND recordatorio10minEnviado = 0 
                      AND fechaProg > %s AND fechaProg <= %s
                """
                cur.execute(sql_10m, (now_ec, in_10m))
                for a in cur.fetchall():
                    txt = f"🔥 *¡URGENTE! En 10 MINUTOS es tu compromiso*\n\n📌 *{a['titulo']}*\n📍 *Lugar:* {a['mensaje']}\n🕒 *Hora:* {a['fechaProg']}"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio10minEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()

            conn.close()
        except Exception as e:
            print(f"[Reminder Monitor Error] {e}")

        await asyncio.sleep(45)

# -------------------------------------------------------------
# TELEGRAM WORKER
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
                        if not msg:
                            continue

                        chat_id = msg["chat"]["id"]
                        user_text = ""

                        if "text" in msg:
                            user_text = msg["text"].strip()
                        elif "voice" in msg or "audio" in msg or ("document" in msg and (msg.get("document", {}).get("mime_type", "").startswith("audio/") or msg.get("document", {}).get("file_name", "").endswith(".ogg"))):
                            file_obj = msg.get("voice") or msg.get("audio") or msg.get("document")
                            file_id = file_obj.get("file_id")
                            if file_id:
                                await send_telegram(chat_id, "🎙️ _Escuchando tu nota de voz..._")
                                transcript = await transcribe_telegram_audio(file_id)
                                if transcript:
                                    user_text = transcript
                                    await send_telegram(chat_id, f"📝 *Escuché:* \"_{transcript}_\"")
                                else:
                                    await send_telegram(chat_id, "⚠️ No pude transcribir el audio.")
                                    continue

                        if not user_text:
                            continue

                        print(f"[Telegram Master IN] {chat_id}: {user_text}")

                        if user_text.lower() in ["/start", "start"]:
                            welcome = (
                                "👑 ¡Hola César! Soy Hermes Master, tu agente y asistente personal.\n\n"
                                "⏰ *Zona horaria activa:* Ecuador (UTC-5)\n"
                                "🔔 *Sistema de Avisos en cascada:* Te avisaré automáticamente 1 hora antes, 30 min antes y 10 min antes por WhatsApp y Telegram."
                            )
                            await send_telegram(chat_id, welcome)
                            continue

                        reply = await run_agent_turn(user_text)
                        await send_telegram(chat_id, reply)

        except Exception as e:
            print(f"[Loop Error] {e}")
            await asyncio.sleep(4)

@app.on_event("startup")
async def startup():
    asyncio.create_task(telegram_worker())
    asyncio.create_task(reminder_monitor_worker())

@app.get("/")
def root():
    return {"status": "online", "agent": "Hermes Master v2.3 Ecuador-Time Active"}
