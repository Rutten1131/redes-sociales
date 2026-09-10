#!/usr/bin/env python3
"""
Patch: Adds crear_deal tool to Hermes Agent main.py
Run on VPS: python3 /tmp/patch_hermes_deals.py
"""

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Add the tool function ───
TOOL_FUNCTION = '''
# ─── DEAL / PROPUESTA TOOL ───
async def tool_crear_deal(cliente: str, servicio: str, monto: float = 0,
                          telefono: str = "", notas: str = "", 
                          link_propuesta: str = "", tags: str = "") -> str:
    """Crea un nuevo deal/propuesta en el pipeline CRM del Scraper."""
    try:
        payload = {
            "cliente": cliente,
            "servicio": servicio,
            "monto": monto,
            "telefono": telefono,
            "link_propuesta": link_propuesta,
            "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
            "notas_inicial": notas,
            "origen": "telegram",
            "status": "contacto_inicial"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post("http://178.238.238.158:8000/api/deals",
                                  json=payload)
            if r.status_code in (200, 201):
                deal = r.json()
                return f"✅ Deal creado exitosamente:\\n• Cliente: {deal.get('cliente')}\\n• Servicio: {deal.get('servicio')}\\n• Monto: ${deal.get('monto', 0):,.0f}\\n• ID: {deal.get('id')}\\n• Estado: Contacto Inicial\\nPuedes verlo en: http://scraper.178.238.238.158.sslip.io/deals"
            else:
                return f"❌ Error al crear deal: {r.status_code} - {r.text}"
    except Exception as e:
        return f"❌ Error de conexión al crear deal: {str(e)}"

'''

# Insert tool function before TOOLS_DEFINITIONS
if 'tool_crear_deal' not in content:
    if 'TOOLS_DEFINITIONS' in content:
        content = content.replace('TOOLS_DEFINITIONS', TOOL_FUNCTION + 'TOOLS_DEFINITIONS', 1)
        print("✅ tool_crear_deal function added")
    else:
        print("❌ Could not find TOOLS_DEFINITIONS marker")
else:
    print("⏭️  tool_crear_deal already exists")

# ─── 2. Add to TOOLS_DEFINITIONS array ───
TOOL_DEFINITION = '''    {
        "type": "function",
        "function": {
            "name": "crear_deal",
            "description": "Crea un nuevo deal o propuesta en el pipeline CRM. Úsala cuando el usuario quiera registrar una cotización, propuesta comercial, o proyecto potencial con un cliente. Incluye nombre del cliente, servicio, monto estimado y notas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cliente": {
                        "type": "string",
                        "description": "Nombre completo del cliente o empresa"
                    },
                    "servicio": {
                        "type": "string",
                        "description": "Descripción del servicio o proyecto (ej: Sitio web corporativo, App móvil, Campaña de marketing)"
                    },
                    "monto": {
                        "type": "number",
                        "description": "Monto estimado en USD del proyecto"
                    },
                    "telefono": {
                        "type": "string",
                        "description": "Teléfono de contacto del cliente"
                    },
                    "notas": {
                        "type": "string",
                        "description": "Notas o detalles adicionales de la conversación"
                    },
                    "link_propuesta": {
                        "type": "string",
                        "description": "URL de la propuesta o cotización enviada"
                    },
                    "tags": {
                        "type": "string",
                        "description": "Etiquetas separadas por coma (ej: web, urgente, marketing)"
                    }
                },
                "required": ["cliente", "servicio"]
            }
        }
    },'''

if '"crear_deal"' not in content:
    # Find TOOLS_DEFINITIONS = [ and add after the opening bracket
    pattern = r'(TOOLS_DEFINITIONS\s*=\s*\[)'
    match = __import__('re').search(pattern, content)
    if match:
        insertion_point = match.end()
        content = content[:insertion_point] + '\n' + TOOL_DEFINITION + content[insertion_point:]
        print("✅ crear_deal added to TOOLS_DEFINITIONS")
    else:
        print("❌ Could not find TOOLS_DEFINITIONS = [")
else:
    print("⏭️  crear_deal already in TOOLS_DEFINITIONS")

# ─── 3. Add tool dispatch in the agent turn function ───
# Find the tool dispatch section and add crear_deal handler
if '"crear_deal"' not in content.split('run_agent_turn')[1] if 'run_agent_turn' in content else True:
    # Find existing tool dispatches like: elif fn == "check_emails":
    dispatch_pattern = r'(elif fn == "check_emails":\s*result = await tool_check_emails\(\))'
    match = __import__('re').search(dispatch_pattern, content)
    if match:
        new_dispatch = match.group(0) + '''
                elif fn == "crear_deal":
                    result = await tool_crear_deal(**args)'''
        content = content.replace(match.group(0), new_dispatch)
        print("✅ crear_deal dispatch added to run_agent_turn")
    else:
        # Try alternative: find any elif fn == pattern
        alt_pattern = r'(elif fn == "\w+":\s*result = [^\n]+)'
        matches = list(__import__('re').finditer(alt_pattern, content))
        if matches:
            last_match = matches[-1]
            new_dispatch = last_match.group(0) + '''
                elif fn == "crear_deal":
                    result = await tool_crear_deal(**args)'''
            content = content[:last_match.start()] + new_dispatch + content[last_match.end():]
            print("✅ crear_deal dispatch added (alt method)")
        else:
            print("⚠️  Could not find tool dispatch section - manual addition needed")

with open(HERMES_FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n🎉 Hermes deals tool patch complete!")
print(f"   File: {HERMES_FILE}")
print(f"   New size: {len(content)} bytes")
