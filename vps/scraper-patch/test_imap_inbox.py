import os
import imaplib
import email
from email.header import decode_header
import dotenv

dotenv.load_dotenv("/root/hermes-agent/.env")

TURISMO_HOST = os.getenv("EMAIL_TURISMO_HOST", "imap.cesarreyesjaramillo.com")
TURISMO_PORT = int(os.getenv("EMAIL_TURISMO_PORT", "993"))
TURISMO_USER = os.getenv("EMAIL_TURISMO_USER", "turismo@cesarreyesjaramillo.com")
TURISMO_PASS = os.getenv("EMAIL_TURISMO_PASS", "")

REST_HOST = os.getenv("EMAIL_RESTAURANT_HOST", "imap.activaqr.com")
REST_PORT = int(os.getenv("EMAIL_RESTAURANT_PORT", "993"))
REST_USER = os.getenv("EMAIL_RESTAURANT_USER", "restaurant@activaqr.com")
REST_PASS = os.getenv("EMAIL_RESTAURANT_PASS", "")

def test_imap(name, host, port, user, password):
    print(f"\n--- Probando IMAP para {name} ({user}) en {host}:{port} ---")
    try:
        mail = imaplib.IMAP4_SSL(host, port, timeout=15)
        mail.login(user, password)
        print(f"✅ Login exitoso en {user}!")
        mail.select("inbox")
        status, messages = mail.search(None, "ALL")
        ids = messages[0].split()
        print(f"📥 Total de correos en bandeja: {len(ids)}")
        
        status, unseen = mail.search(None, "UNSEEN")
        unseen_ids = unseen[0].split()
        print(f"🔔 Correos no leídos (UNSEEN): {len(unseen_ids)}")
        
        # Mostrar los últimos 3 correos recibidos
        if ids:
            print("Últimos correos recibidos:")
            for i in ids[-3:]:
                res, data = mail.fetch(i, "(RFC822.HEADER)")
                raw = data[0][1]
                msg = email.message_from_bytes(raw)
                sub = msg.get("Subject", "Sin Asunto")
                frm = msg.get("From", "Desconocido")
                print(f"  • De: {frm} | Asunto: {sub}")
                
        mail.close()
        mail.logout()
    except Exception as e:
        print(f"❌ Error al conectar a {name}: {e}")

test_imap("TURISMO", TURISMO_HOST, TURISMO_PORT, TURISMO_USER, TURISMO_PASS)
test_imap("RESTAURANT", REST_HOST, REST_PORT, REST_USER, REST_PASS)
