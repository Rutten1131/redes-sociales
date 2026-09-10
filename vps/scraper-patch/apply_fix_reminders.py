#!/usr/bin/env python3
"""
1. Disables the duplicate/broken reminder loop in cesar-quotes-bot/bot.js.
2. Updates Hermes reminder_monitor_worker:
   - Evaluates current Ecuador time dynamically (UTC-5).
   - Handles alerts: 1h before, 30min before, 10min before, and AT EXACT TIME.
   - Marks recordatorio1hEnviado, recordatorio30minEnviado, recordatorio10minEnviado.
   - Only marks 'ENVIADO' when the event time has passed.
   - Uses instance 'agenda-cultural' for WhatsApp and Hermes Telegram bot for instant delivery.
3. Automatically creates the Deal for Ing. Alex Román (Mecánica) in the CRM.
"""

import re
import os

# 1. Disable reminder loop in bot.js
BOT_JS = "/root/cesar-quotes-bot/bot.js"
with open(BOT_JS, "r", encoding="utf-8") as f:
    b_code = f.read()

# Replace the setInterval of reminders in bot.js with a comment
if "setInterval(async () => {" in b_code and "avisos1h" in b_code:
    b_code = re.sub(
        r'setInterval\(async \(\) => \{\s*try \{\s*const now = new Date\(\);.*?\}\s*catch \(error\) \{\s*console\.error\(\'Error en notificador de avisos:\', error\.message\);\s*\}\s*\}, 30 \* 1000\);',
        '/* Recordatorios migrados a Hermes Master para evitar colisiones y usar instancia activa de WhatsApp */',
        b_code,
        flags=re.DOTALL
    )
    with open(BOT_JS, "w", encoding="utf-8") as f:
        f.write(b_code)
    print("OK: Disabled legacy reminder loop in cesar-quotes-bot")

# 2. Upgrade Hermes main.py
HERMES_FILE = "/root/hermes-agent/main.py"
with open(HERMES_FILE, "r", encoding="utf-8") as f:
    h_code = f.read()

# Make sure EVOLUTION_INSTANCE is agenda-cultural
h_code = re.sub(r'EVOLUTION_INSTANCE\s*=\s*os\.getenv\("EVOLUTION_INSTANCE",\s*"[^"]+"\)',
                'EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "agenda-cultural")',
                h_code)

# Replace reminder_monitor_worker with complete robust cascaded engine
new_reminder_worker = """
async def reminder_monitor_worker():
    \"\"\"Revisa cada 30 segundos compromisos y recordatorios de César en Hora Ecuador (UTC-5)\"\"\"
    print("[Reminder Cascading Monitor] Motor de alertas en cascada 100% activo (Ecuador UTC-5)...")
    await asyncio.sleep(5)

    while True:
        try:
            # Hora actual exacta de Ecuador
            now_utc = datetime.utcnow()
            now_ec = now_utc - timedelta(hours=5)

            in_60m = now_ec + timedelta(minutes=60)
            in_30m = now_ec + timedelta(minutes=30)
            in_10m = now_ec + timedelta(minutes=10)

            conn = get_db_connection()
            with conn.cursor() as cur:
                # 1. Alerta de 1 Hora Antes (entre 31 y 60 min)
                sql_1h = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND (recordatorio1hEnviado = 0 OR recordatorio1hEnviado IS NULL)
                      AND fechaProg > %s AND fechaProg <= %s
                \"\"\"
                cur.execute(sql_1h, (now_ec + timedelta(minutes=30), in_60m))
                for a in cur.fetchall():
                    txt = f"⏳ *RECORDATORIO: En 1 HORA tienes un compromiso*\\n\\n📌 *{a['titulo']}*\\n📍 *Detalle:* {a['mensaje']}\\n🕒 *Hora programada:* {a['fechaProg']}"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio1hEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()
                    print(f"[Aviso] 1h enviado para {a['titulo']}")

                # 2. Alerta de 30 Minutos Antes (entre 11 y 30 min)
                sql_30m = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND (recordatorio30minEnviado = 0 OR recordatorio30minEnviado IS NULL)
                      AND fechaProg > %s AND fechaProg <= %s
                \"\"\"
                cur.execute(sql_30m, (now_ec + timedelta(minutes=10), in_30m))
                for a in cur.fetchall():
                    txt = f"⚠️ *RECORDATORIO: En 30 MINUTOS es tu cita*\\n\\n📌 *{a['titulo']}*\\n📍 *Detalle:* {a['mensaje']}\\n🕒 *Hora programada:* {a['fechaProg']}\\n\\n_Ve alistándote para salir o conectarte._"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio30minEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()
                    print(f"[Aviso] 30m enviado para {a['titulo']}")

                # 3. Alerta de 10 Minutos Antes (entre 1 y 10 min)
                sql_10m = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND (recordatorio10minEnviado = 0 OR recordatorio10minEnviado IS NULL)
                      AND fechaProg > %s AND fechaProg <= %s
                \"\"\"
                cur.execute(sql_10m, (now_ec, in_10m))
                for a in cur.fetchall():
                    txt = f"🔥 *¡URGENTE! En 10 MINUTOS es tu cita*\\n\\n📌 *{a['titulo']}*\\n📍 *Lugar/Detalle:* {a['mensaje']}\\n🕒 *Hora:* {a['fechaProg']}"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET recordatorio10minEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()
                    print(f"[Aviso] 10m enviado para {a['titulo']}")

                # 4. Alerta al Minuto Exacto / Vencimiento
                sql_exacto = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND fechaProg <= %s
                \"\"\"
                cur.execute(sql_exacto, (now_ec,))
                for a in cur.fetchall():
                    txt = f"🚨 *¡ES EL MOMENTO AHORA!*\\n\\n📌 *{a['titulo']}*\\n📝 {a['mensaje']}\\n⏰ *Hora actual:* {now_ec.strftime('%Y-%m-%d %H:%M:%S')}"
                    await tool_send_whatsapp(txt)
                    await send_telegram(int(ADMIN_CHAT_ID), txt)
                    cur.execute("UPDATE Aviso SET estado = 'ENVIADO', recordatorio1hEnviado = 1, recordatorio30minEnviado = 1, recordatorio10minEnviado = 1 WHERE id = %s", (a['id'],))
                    conn.commit()
                    print(f"[Aviso] Momento exacto enviado para {a['titulo']}")

            conn.close()
        except Exception as e:
            print(f"[Reminder Cascading Error] {e}")

        await asyncio.sleep(30)
"""

h_code = re.sub(r'async def reminder_monitor_worker\(\):.*?await asyncio\.sleep\(45\)', new_reminder_worker.strip(), h_code, flags=re.DOTALL)

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(h_code)
print("OK: Upgraded Hermes reminder_monitor_worker")

# 3. Create Deal for Ing. Alex Román in Scraper Deals
import urllib.request
import json

deal_payload = {
    "cliente": "Ing. Alex Román (Mecánica Automotriz)",
    "telefono": "",
    "servicio": "Sistema de Fidelización de Clientes (CRM) + Página Web",
    "monto": 2500,
    "moneda": "USD",
    "status": "propuesta_enviada",
    "origen": "telegram",
    "notas_inicial": "El Ing. Alex Román indicó que trabajan con contratos estatales. Les interesa principalmente el CRM de fidelización porque el control manual actual se les pasa mucho. Pasar propuesta a Gerencia.",
    "tags": ["mecanica", "crm-fidelizacion", "prioridad-alta"]
}

req = urllib.request.Request(
    "http://178.238.238.158:8000/api/deals",
    data=json.dumps(deal_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print("OK: Deal para Ing. Alex Román creado en el CRM con estado 'Propuesta Enviada'!")
except Exception as e:
    print("Error creando deal:", e)
