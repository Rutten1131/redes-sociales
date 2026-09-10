import urllib.request
import json

payload = {
    "cliente": "Empresa Alfa (Cotización SaaS)",
    "telefono": "+593 99 123 4567",
    "email": "contacto@alfa.com",
    "servicio": "Sistema Web + IA Hermes",
    "monto": 3500,
    "moneda": "USD",
    "status": "propuesta_enviada",
    "origen": "telegram",
    "link_propuesta": "https://drive.google.com/file/d/propuesta-3500",
    "link_mvp": "https://mvp-alfa.demo.dev",
    "notas_inicial": "Cliente interesado en CRM conectado con WhatsApp. El cierre es para fin de mes.",
    "tags": ["vip", "saas", "alta-prioridad"]
}

req = urllib.request.Request(
    "http://localhost:8000/api/deals",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req) as resp:
    print("STATUS:", resp.status)
    created = json.loads(resp.read().decode("utf-8"))
    print("CREATED DEAL:")
    print(json.dumps(created, indent=2, ensure_ascii=False))

with urllib.request.urlopen("http://localhost:8000/api/deals") as resp:
    all_deals = json.loads(resp.read().decode("utf-8"))
    print(f"\nTOTAL DEALS: {len(all_deals)}")
