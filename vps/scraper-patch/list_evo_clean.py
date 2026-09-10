import urllib.request
import json

req = urllib.request.Request(
    "http://178.238.238.158:8080/instance/fetchInstances",
    headers={"apikey": "42a447c1-3d74-4b52-9571-042c174f7621"}
)

with urllib.request.urlopen(req) as resp:
    instances = json.loads(resp.read().decode("utf-8"))
    print("=== INSTANCIAS DE EVOLUTION API EN EL VPS ===")
    for inst in instances:
        name = inst.get("name")
        status = inst.get("connectionStatus")
        number = inst.get("ownerJid")
        print(f"Instancia: {name:30} | Estado: {status:12} | Número: {number}")
