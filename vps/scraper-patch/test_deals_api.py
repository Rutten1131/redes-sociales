import urllib.request
import json

payload = {
    "client_name": "César Cotizaciones (Prueba)",
    "phone": "+593999999999",
    "amount": 3500,
    "status": "propuesta_enviada",
    "notes": "Desarrollo de plataforma SaaS con IA para seguimiento de clientes y automatizacion.",
    "service_type": "Desarrollo Web / SaaS",
    "mvp_link": "https://mvp.demo.dev",
    "proposal_link": "https://drive.google.com/proposal-demo"
}

req = urllib.request.Request(
    "http://localhost:8000/api/deals",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        print("STATUS:", resp.status)
        print("RESPONSE:", resp.read().decode("utf-8"))
except Exception as e:
    print("ERROR:", e)

# Test GET
with urllib.request.urlopen("http://localhost:8000/api/deals") as resp:
    data = json.loads(resp.read().decode("utf-8"))
    print(f"TOTAL DEALS IN DB: {len(data)}")
    if data:
        print("First Deal:", json.dumps(data[0], indent=2, ensure_ascii=False))
