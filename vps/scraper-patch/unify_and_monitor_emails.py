#!/usr/bin/env python3
"""
1. Fixes EMAIL_TURISMO_PASS unescaping in Hermes main.py so IMAP connects reliably.
2. Updates tool_check_emails to check BOTH inboxes (turismo and restaurant).
3. Adds automatic background email monitor worker (runs every 5 minutes):
   - Audits new incoming unread emails in both accounts.
   - Filters out Mailer-Daemon / NDR bounce noise.
   - If a real client replies or asks for information:
     * Immediately alerts César via Telegram (Hermes Master).
     * Alerts César via WhatsApp with sender, subject and preview!
4. Updates despachador_autonomo.py to send daily dispatch report to Hermes Master bot.
"""
import re

HERMES_FILE = "/root/hermes-agent/main.py"
DESPACHADOR_FILE = "/root/enviador-campanas/despachador_autonomo.py"

# ─── PART 1: Update despachador_autonomo.py bot token ───
with open(DESPACHADOR_FILE, "r", encoding="utf-8") as f:
    d_code = f.read()

# Replace telegram token to Hermes bot token so reports come from Hermes Master
hermes_bot_token = "8958543593:AAFq6ngDHCun651YunhsUNcI2pSoC-k6qUI"
old_token_pattern = r'TELEGRAM_BOT_TOKEN\s*=\s*ENV\.get\("TELEGRAM_BOT_TOKEN",\s*"[^"]+"\)'
d_code = re.sub(old_token_pattern, f'TELEGRAM_BOT_TOKEN = "{hermes_bot_token}"', d_code)

with open(DESPACHADOR_FILE, "w", encoding="utf-8") as f:
    f.write(d_code)
print("OK: despachador_autonomo.py configured to report via Hermes Master Bot!")


# ─── PART 2: Upgrade Hermes main.py with Email Monitor & Both Inboxes ───
with open(HERMES_FILE, "r", encoding="utf-8") as f:
    h_code = f.read()

# Fix Turismo pass variable:
h_code = h_code.replace('EMAIL_TURISMO_PASS = os.getenv("EMAIL_TURISMO_PASS", "^m$$Z)*dYUIKJ")',
                        'EMAIL_TURISMO_PASS = os.getenv("EMAIL_TURISMO_PASS", "^m$Z)*dYUIKJ").replace("$$", "$")')

# Add restaurant credentials if missing
if "EMAIL_RESTAURANT_USER" not in h_code:
    h_code = h_code.replace('EMAIL_TURISMO_PORT = int(os.getenv("EMAIL_TURISMO_PORT", "993"))',
                            """EMAIL_TURISMO_PORT = int(os.getenv("EMAIL_TURISMO_PORT", "993"))
EMAIL_RESTAURANT_USER = os.getenv("EMAIL_RESTAURANT_USER", "restaurant@activaqr.com")
EMAIL_RESTAURANT_PASS = os.getenv("EMAIL_RESTAURANT_PASS", "Ja3321674")
EMAIL_RESTAURANT_HOST = os.getenv("EMAIL_RESTAURANT_HOST", "imap.activaqr.com")
EMAIL_RESTAURANT_PORT = int(os.getenv("EMAIL_RESTAURANT_PORT", "993"))""")

# Replace tool_check_emails_sync with dual-inbox checking
new_check_emails_code = """
def check_single_inbox(user, pwd, host, port, label):
    clean_pwd = pwd.replace("$$", "$")
    results = []
    try:
        mail = imaplib.IMAP4_SSL(host, port, timeout=12)
        mail.login(user, clean_pwd)
        mail.select("inbox")
        status, messages = mail.search(None, "UNSEEN")
        if status == "OK" and messages[0]:
            eids = messages[0].split()
            for eid in reversed(eids[-5:]):
                _, data = mail.fetch(eid, "(RFC822.HEADER)")
                raw = data[0][1]
                msg = email.message_from_bytes(raw)
                frm = msg.get("From", "Desconocido")
                sub = msg.get("Subject", "(Sin asunto)")
                # Decode subject if needed
                dh = decode_header(sub)
                subject_text = ""
                for part, enc in dh:
                    if isinstance(part, bytes):
                        subject_text += part.decode(enc if enc else "utf-8", errors="ignore")
                    else:
                        subject_text += str(part)
                
                # Ignorar avisos de rebote automáticos del servidor
                if "mailer-daemon" in frm.lower() or "mail delivery" in subject_text.lower():
                    continue
                results.append(f"[{label}] De: {frm} | Asunto: {subject_text}")
        mail.close()
        mail.logout()
    except Exception as e:
        results.append(f"[{label}] Error IMAP: {e}")
    return results

def tool_check_emails_sync() -> str:
    res = []
    res.extend(check_single_inbox(EMAIL_TURISMO_USER, EMAIL_TURISMO_PASS, EMAIL_TURISMO_HOST, EMAIL_TURISMO_PORT, "Turismo"))
    res.extend(check_single_inbox(EMAIL_RESTAURANT_USER, EMAIL_RESTAURANT_PASS, EMAIL_RESTAURANT_HOST, EMAIL_RESTAURANT_PORT, "Restaurantes"))
    if not res:
        return "✨ No hay correos nuevos ni respuestas no leídas en tus bandejas de Turismo o Restaurantes."
    return "📬 **Respuestas / Correos entrantes no leídos:**\\n" + "\\n".join([f"• {r}" for r in res])
"""

# Replace old tool_check_emails_sync
h_code = re.sub(r'def tool_check_emails_sync\(\) -> str:.*?return "\\n"\.join\(res\)\s*except Exception as e:\s*return f"Error IMAP: \{str\(e\)\}"',
                new_check_emails_code.strip(), h_code, flags=re.DOTALL)

# Add autonomous email responder worker
email_monitor_worker = """
SEEN_EMAIL_ALERT_IDS = set()

async def email_interest_monitor_worker():
    \"\"\"Audita en segundo plano cada 5 minutos si un cliente o prospecto responde a los correos de campaña.\"\"\"
    print("[Email Monitor Worker] Activo (monitoreo de respuestas cada 5m)...")
    while True:
        try:
            accounts = [
                (EMAIL_TURISMO_USER, EMAIL_TURISMO_PASS, EMAIL_TURISMO_HOST, EMAIL_TURISMO_PORT, "Turismo (Aroma de Montaña)"),
                (EMAIL_RESTAURANT_USER, EMAIL_RESTAURANT_PASS, EMAIL_RESTAURANT_HOST, EMAIL_RESTAURANT_PORT, "Restaurantes / ActivaQR")
            ]
            
            for user, pwd, host, port, label in accounts:
                clean_pwd = pwd.replace("$$", "$")
                try:
                    def _get_unseen():
                        mail = imaplib.IMAP4_SSL(host, port, timeout=12)
                        mail.login(user, clean_pwd)
                        mail.select("inbox")
                        st, ms = mail.search(None, "UNSEEN")
                        items = []
                        if st == "OK" and ms[0]:
                            for eid in ms[0].split()[-4:]:
                                _, data = mail.fetch(eid, "(RFC822)")
                                raw = data[0][1]
                                msg = email.message_from_bytes(raw)
                                items.append((eid.decode(), msg))
                        mail.close()
                        mail.logout()
                        return items
                        
                    unseen_items = await asyncio.to_thread(_get_unseen)
                    for eid, msg in unseen_items:
                        key = f"{user}_{eid}"
                        if key in SEEN_EMAIL_ALERT_IDS:
                            continue
                        SEEN_EMAIL_ALERT_IDS.add(key)
                        
                        frm = msg.get("From", "Desconocido")
                        sub = msg.get("Subject", "(Sin asunto)")
                        dh = decode_header(sub)
                        sub_decoded = ""
                        for part, enc in dh:
                            if isinstance(part, bytes):
                                sub_decoded += part.decode(enc if enc else "utf-8", errors="ignore")
                            else:
                                sub_decoded += str(part)
                                
                        # Si es rebote técnico, no alertar
                        if "mailer-daemon" in frm.lower() or "mail delivery" in sub_decoded.lower() or "postmaster" in frm.lower():
                            continue
                            
                        # Extraer breve cuerpo
                        body_preview = ""
                        if msg.is_multipart():
                            for p in msg.walk():
                                if p.get_content_type() == "text/plain":
                                    body_preview = p.get_payload(decode=True).decode(errors="ignore")[:250]
                                    break
                        else:
                            body_preview = msg.get_payload(decode=True).decode(errors="ignore")[:250]

                        # ¡Es un cliente real respondiendo a la campaña!
                        aviso_interesado = (
                            f"🚨 **¡CLIENTE RESPONDIÓ A LA CAMPAÑA DE CORREO!**\\n\\n"
                            f"🏢 **Campaña:** {label}\\n"
                            f"👤 **De:** `{frm}`\\n"
                            f"📌 **Asunto:** *{sub_decoded}*\\n\\n"
                            f"📝 **Mensaje:**\\n_{body_preview.strip()}..._\\n\\n"
                            f"👉 _Puedes responderle directamente desde tu correo o registrar el Deal en:_\\n"
                            f"https://scraper.178.238.238.158.sslip.io/deals"
                        )
                        print(f"[Email Monitor] ¡Respuesta detectada de {frm}!")
                        await send_telegram(int(ADMIN_CHAT_ID), aviso_interesado)
                        await tool_send_whatsapp(aviso_interesado)

                except Exception as ex_acc:
                    pass

        except Exception as e:
            print(f"[Email Monitor Loop Error] {e}")

        await asyncio.sleep(300) # Chequeo cada 5 minutos
"""

if "email_interest_monitor_worker" not in h_code:
    target_pos = "async def startup():"
    h_code = h_code.replace(target_pos, email_monitor_worker + "\n" + target_pos, 1)
    # Add to startup tasks
    h_code = h_code.replace('asyncio.create_task(reminder_monitor_worker())',
                            'asyncio.create_task(reminder_monitor_worker())\n    asyncio.create_task(email_interest_monitor_worker())', 1)
    print("OK: Added email_interest_monitor_worker to startup")

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(h_code)

print("Hermes Agent & Despachador successfully unified and upgraded!")
