#!/usr/bin/env python3
"""
Patch script: Adds Deals API endpoints and /deals route to api.py
Run on VPS: python3 /tmp/patch_deals_api.py
"""

import re

API_FILE = "/root/scraper-campanas-app/api.py"

# Read current file
with open(API_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Add imports if missing ───
if "import uuid" not in content:
    content = content.replace("import json", "import json\nimport uuid", 1)

# ─── 2. Add deals helper functions + endpoints BEFORE the last line or after health endpoint ───

DEALS_CODE = '''

# ═══════════════════════════════════════════════════════════════
# DEALS / PROPUESTAS — Pipeline CRM
# ═══════════════════════════════════════════════════════════════

DEALS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deals.json")

def _read_deals():
    try:
        with open(DEALS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def _write_deals(deals_list):
    with open(DEALS_FILE, 'w', encoding='utf-8') as f:
        json.dump(deals_list, f, ensure_ascii=False, indent=2)

@app.get("/deals")
def read_deals_page():
    """Sirve la página de Deals & Propuestas."""
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "deals.html")
    if os.path.exists(html_path):
        return HTMLResponse(open(html_path, encoding="utf-8").read())
    return HTMLResponse("<h1>deals.html not found</h1>", status_code=404)

@app.get("/api/deals")
def get_deals(search: str = "", status: str = ""):
    """Lista todos los deals, opcionalmente filtrados."""
    deals = _read_deals()
    if status:
        deals = [d for d in deals if d.get("status") == status]
    if search:
        s = search.lower()
        deals = [d for d in deals if
                 s in (d.get("cliente") or "").lower() or
                 s in (d.get("servicio") or "").lower() or
                 any(s in t.lower() for t in (d.get("tags") or []))]
    return JSONResponse(deals)

@app.post("/api/deals")
async def create_deal(request: Request):
    """Crea un nuevo deal."""
    data = await request.json()
    deal = {
        "id": str(uuid.uuid4())[:8],
        "cliente": data.get("cliente", ""),
        "telefono": data.get("telefono", ""),
        "email": data.get("email", ""),
        "servicio": data.get("servicio", ""),
        "monto": data.get("monto", 0),
        "moneda": data.get("moneda", "USD"),
        "status": data.get("status", "contacto_inicial"),
        "origen": data.get("origen", "web"),
        "fecha_creacion": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "fecha_seguimiento": data.get("fecha_seguimiento", None),
        "link_propuesta": data.get("link_propuesta", ""),
        "link_mvp": data.get("link_mvp", ""),
        "archivos": data.get("archivos", []),
        "notas": [],
        "tags": data.get("tags", [])
    }
    # Add initial note if provided
    if data.get("notas_inicial"):
        deal["notas"].append({
            "fecha": deal["fecha_creacion"],
            "texto": data["notas_inicial"],
            "origen": data.get("origen", "web")
        })
    
    deals = _read_deals()
    deals.append(deal)
    _write_deals(deals)
    logger.info(f"[DEALS] Nuevo deal creado: {deal['cliente']} - ${deal['monto']} ({deal['origen']})")
    return JSONResponse(deal, status_code=201)

@app.put("/api/deals/{deal_id}")
async def update_deal_endpoint(deal_id: str, request: Request):
    """Actualiza un deal existente."""
    data = await request.json()
    deals = _read_deals()
    
    deal = next((d for d in deals if d["id"] == deal_id), None)
    if not deal:
        return JSONResponse({"error": "Deal no encontrado"}, status_code=404)
    
    # Update allowed fields
    for key in ["cliente", "telefono", "email", "servicio", "monto", "moneda",
                "status", "fecha_seguimiento", "link_propuesta", "link_mvp", "tags"]:
        if key in data:
            deal[key] = data[key]
    
    _write_deals(deals)
    logger.info(f"[DEALS] Deal actualizado: {deal['id']} -> {data}")
    return JSONResponse(deal)

@app.delete("/api/deals/{deal_id}")
def delete_deal_endpoint(deal_id: str):
    """Elimina un deal."""
    deals = _read_deals()
    original_len = len(deals)
    deals = [d for d in deals if d["id"] != deal_id]
    
    if len(deals) == original_len:
        return JSONResponse({"error": "Deal no encontrado"}, status_code=404)
    
    _write_deals(deals)
    logger.info(f"[DEALS] Deal eliminado: {deal_id}")
    return JSONResponse({"ok": True, "deleted": deal_id})

@app.post("/api/deals/{deal_id}/notes")
async def add_deal_note(deal_id: str, request: Request):
    """Agrega una nota/conversación a un deal."""
    data = await request.json()
    deals = _read_deals()
    
    deal = next((d for d in deals if d["id"] == deal_id), None)
    if not deal:
        return JSONResponse({"error": "Deal no encontrado"}, status_code=404)
    
    note = {
        "fecha": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "texto": data.get("texto", ""),
        "origen": data.get("origen", "web")
    }
    deal.setdefault("notas", []).append(note)
    _write_deals(deals)
    logger.info(f"[DEALS] Nota agregada a deal {deal_id}")
    return JSONResponse(note, status_code=201)

@app.post("/api/deals/{deal_id}/files")
async def add_deal_file(deal_id: str, request: Request):
    """Agrega un archivo/link a un deal."""
    data = await request.json()
    deals = _read_deals()
    
    deal = next((d for d in deals if d["id"] == deal_id), None)
    if not deal:
        return JSONResponse({"error": "Deal no encontrado"}, status_code=404)
    
    file_entry = {
        "nombre": data.get("nombre", "Archivo"),
        "url": data.get("url", "")
    }
    deal.setdefault("archivos", []).append(file_entry)
    _write_deals(deals)
    logger.info(f"[DEALS] Archivo agregado a deal {deal_id}: {file_entry['nombre']}")
    return JSONResponse(file_entry, status_code=201)

'''

# Check if deals code already exists
if "/api/deals" not in content:
    # Find the last endpoint or end of file and append
    # Insert before if __name__ or at the end
    if 'if __name__' in content:
        content = content.replace('if __name__', DEALS_CODE + '\nif __name__', 1)
    else:
        content += DEALS_CODE

# ─── 3. Make sure uuid import is at top ───
if 'import uuid' not in content:
    content = 'import uuid\n' + content

# ─── 4. Make sure datetime import exists ───
if 'from datetime import' not in content and 'import datetime' not in content:
    content = 'from datetime import datetime\n' + content

# Write back
with open(API_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ API deals endpoints added successfully!")
print(f"   File: {API_FILE}")
print(f"   New size: {len(content)} bytes")
