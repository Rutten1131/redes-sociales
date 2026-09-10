import imaplib
import email

pwds = ['^m$Z)*dYUIKJ', '^m$$Z)*dYUIKJ', '^mZ)*dYUIKJ']

print("--- Probando Turismo ---")
for p in pwds:
    try:
        m = imaplib.IMAP4_SSL('imap.cesarreyesjaramillo.com', 993, timeout=8)
        m.login('turismo@cesarreyesjaramillo.com', p)
        print("EXITO TURISMO CON PASSWORD:", repr(p))
        m.select("inbox")
        status, messages = m.search(None, "ALL")
        ids = messages[0].split()
        print(f"Total correos turismo: {len(ids)}")
        status, unseen = m.search(None, "UNSEEN")
        print(f"Total correos NO leidos turismo: {len(unseen[0].split())}")
        if ids:
            print("Ultimos 2 correos:")
            for i in ids[-2:]:
                _, d = m.fetch(i, "(RFC822.HEADER)")
                msg = email.message_from_bytes(d[0][1])
                print(f"  • De: {msg.get('From')} | Asunto: {msg.get('Subject')}")
        m.logout()
        break
    except Exception as e:
        print(f"Fallo turismo con {repr(p)}: {e}")

print("\n--- Probando Restaurantes (activaqr.com) ---")
try:
    m = imaplib.IMAP4_SSL('imap.activaqr.com', 993, timeout=8)
    m.login('restaurant@activaqr.com', 'Ja3321674')
    print("EXITO RESTAURANTES!")
    m.select("inbox")
    status, messages = m.search(None, "ALL")
    ids = messages[0].split()
    print(f"Total correos restaurantes: {len(ids)}")
    status, unseen = m.search(None, "UNSEEN")
    print(f"Total correos NO leidos restaurantes: {len(unseen[0].split())}")
    m.logout()
except Exception as e:
    print("Fallo restaurantes:", e)
