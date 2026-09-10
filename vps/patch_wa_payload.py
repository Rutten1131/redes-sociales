import re

path = '/root/hermes-agent/main.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_fn = '''async def tool_send_whatsapp(message: str, recipient: Optional[str] = None) -> str:
    num = recipient or WHATSAPP_ADMIN_NUMBER
    clean_num = re.sub(r"\\D", "", num)
    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    headers = {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}
    payload = {
        "number": clean_num,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
        "textMessage": {"text": message}
    }'''

new_fn = '''async def tool_send_whatsapp(message: str, recipient: Optional[str] = None) -> str:
    num = recipient or WHATSAPP_ADMIN_NUMBER
    clean_num = re.sub(r"\\D", "", num)
    url = f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    headers = {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}
    payload = {
        "number": clean_num,
        "text": message,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True}
    }'''

if old_fn in content:
    content = content.replace(old_fn, new_fn)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: tool_send_whatsapp updated to Evolution v2 format")
else:
    # Alternative replace
    print("Exact old_fn not matched, searching pattern...")
    old_block = '''    payload = {
        "number": clean_num,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True},
        "textMessage": {"text": message}
    }'''
    new_block = '''    payload = {
        "number": clean_num,
        "text": message,
        "options": {"delay": 1200, "presence": "composing", "linkPreview": True}
    }'''
    if old_block in content:
        content = content.replace(old_block, new_block)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("SUCCESS: replaced payload block")
    else:
        print("ERROR: could not find payload block")
