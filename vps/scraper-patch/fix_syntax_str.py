#!/usr/bin/env python3
"""
Fix newlines in main.py
"""

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, "r", encoding="utf-8") as f:
    code = f.read()

bad_str = 'return "📬 **Respuestas / Correos entrantes no leídos:**\n" + "\n".join([f"• {r}" for r in res])'
good_str = 'return "📬 **Respuestas / Correos entrantes no leídos:**\\n" + "\\n".join([f"• {r}" for r in res])'

code = code.replace(bad_str, good_str)

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(code)

print("Fixed newlines in return statement")
