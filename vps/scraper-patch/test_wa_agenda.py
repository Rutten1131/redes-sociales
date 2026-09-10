import urllib.request
import json

url = "http://178.238.238.158:8080/message/sendText/agenda-cultural"
headers = {
    "Content-Type": "application/json",
    "apikey": "42a447c1-3d74-4b52-9571-042c174f7621"
}
payload = {
    "number": "593963410409",
    "text": "🔔 [Prueba de Sistema] Hermes Master verificando conexión directa con WhatsApp de César."
}

req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print("WhatsApp agenda-cultural status:", resp.status)
        print("Respuesta:", resp.read().decode("utf-8"))
except Exception as e:
    print("WhatsApp ERROR:", e)
