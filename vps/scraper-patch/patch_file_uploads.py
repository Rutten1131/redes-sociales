#!/usr/bin/env python3
"""
Adds:
1. app.mount("/deals_files", StaticFiles(directory="deals_files"), name="deals_files")
2. POST /api/deals/upload: receives UploadFile, saves to deals_files, returns public URL
3. POST /api/deals/{deal_id}/upload: receives UploadFile, saves and appends to deal's 'archivos' list
"""

API_FILE = "/root/scraper-campanas-app/api.py"

with open(API_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Mount deals_files
mount_target = 'app.mount("/public", StaticFiles(directory="public"), name="public")'
mount_replacement = """app.mount("/public", StaticFiles(directory="public"), name="public")
DEALS_FILES_DIR = os.path.join(os.path.dirname(__file__), "deals_files")
os.makedirs(DEALS_FILES_DIR, exist_ok=True)
app.mount("/deals_files", StaticFiles(directory="deals_files"), name="deals_files")"""

if 'app.mount("/deals_files"' not in content:
    if mount_target in content:
        content = content.replace(mount_target, mount_replacement, 1)
        print("OK: Added static mount for /deals_files")
    else:
        print("WARN: Mount target not found")

# 2. Add file upload endpoints before `if __name__ == "__main__":`
upload_endpoints = """
@app.post("/api/deals/upload")
async def upload_deal_file_generic(file: UploadFile = File(...)):
    \"\"\"Sube un archivo genérico para deals (PDF, imagen, doc) y retorna la URL pública.\"\"\"
    safe_filename = f"{uuid.uuid4().hex[:8]}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)}"
    dest_path = os.path.join(DEALS_FILES_DIR, safe_filename)
    
    with open(dest_path, "wb") as f_out:
        content = await file.read()
        f_out.write(content)
        
    public_url = f"/deals_files/{safe_filename}"
    logger.info(f"[DEALS] Archivo subido: {file.filename} -> {public_url}")
    return JSONResponse({
        "ok": True,
        "nombre": file.filename,
        "url": public_url,
        "size": len(content)
    })

@app.post("/api/deals/{deal_id}/upload")
async def upload_deal_file_to_deal(deal_id: str, file: UploadFile = File(...)):
    \"\"\"Sube un archivo y lo asocia directamente al deal especificado.\"\"\"
    deals = _read_deals()
    deal = next((d for d in deals if d["id"] == deal_id), None)
    if not deal:
        return JSONResponse({"error": "Deal no encontrado"}, status_code=404)
        
    safe_filename = f"{deal_id}_{uuid.uuid4().hex[:6]}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)}"
    dest_path = os.path.join(DEALS_FILES_DIR, safe_filename)
    
    with open(dest_path, "wb") as f_out:
        content = await file.read()
        f_out.write(content)
        
    file_entry = {
        "nombre": file.filename,
        "url": f"/deals_files/{safe_filename}",
        "fecha": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    }
    deal.setdefault("archivos", []).append(file_entry)
    _write_deals(deals)
    
    logger.info(f"[DEALS] Archivo {file.filename} subido y asociado a deal {deal_id}")
    return JSONResponse(file_entry, status_code=201)
"""

if "/api/deals/upload" not in content:
    target_main = 'if __name__ == "__main__":'
    if target_main in content:
        content = content.replace(target_main, upload_endpoints + "\n\n" + target_main, 1)
        print("OK: Added upload endpoints to api.py")
    else:
        content += "\n" + upload_endpoints
        print("OK: Appended upload endpoints to api.py")

with open(API_FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Finished patching api.py with file upload support.")
