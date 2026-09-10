import os
import imaplib
import email

def parse_env(file_path):
    env = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

env = parse_env("/root/hermes-agent/.env")

user = env.get("EMAIL_TURISMO_USER")
pwd = env.get("EMAIL_TURISMO_PASS")
host = env.get("EMAIL_TURISMO_HOST")
port = int(env.get("EMAIL_TURISMO_PORT", 993))

print(f"Probando conexion IMAP con {user}...")
try:
    mail = imaplib.IMAP4_SSL(host, port, timeout=12)
    mail.login(user, pwd)
    print("CONEXION Y LOGIN OK!")
    mail.select("inbox")
    _, data = mail.search(None, "ALL")
    ids = data[0].split()
    print(f"Total correos en bandeja: {len(ids)}")
    
    _, unseen = mail.search(None, "UNSEEN")
    u_ids = unseen[0].split()
    print(f"Total correos NO LEIDOS: {len(u_ids)}")
    
    if ids:
        print("\n--- ULTIMOS 3 CORREOS EN BANDEJA ---")
        for i in ids[-3:]:
            _, d = mail.fetch(i, "(RFC822.HEADER)")
            msg = email.message_from_bytes(d[0][1])
            print(f"ID: {i.decode()} | De: {msg.get('From')} | Asunto: {msg.get('Subject')}")
            
    mail.close()
    mail.logout()
except Exception as e:
    print(f"FALLO IMAP: {e}")
