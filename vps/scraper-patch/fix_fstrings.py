import re

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, "r", encoding="utf-8") as f:
    code = f.read()

# Fix broken newlines in f-strings:
code = re.sub(
    r'txt = f"⏳ \*RECORDATORIO: En 1 HORA tienes un compromiso\*.*?"🕒 \*Hora programada:\* \{a\[\'fechaProg\'\]\}"',
    'txt = f"⏳ *RECORDATORIO: En 1 HORA tienes un compromiso*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Detalle:* {a[\'mensaje\']}\\n🕒 *Hora programada:* {a[\'fechaProg\']}"',
    code,
    flags=re.DOTALL
)

code = re.sub(
    r'txt = f"⚠️ \*RECORDATORIO: En 30 MINUTOS es tu cita\*.*?"_Ve alistándote para salir o conectarte\._"',
    'txt = f"⚠️ *RECORDATORIO: En 30 MINUTOS es tu cita*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Detalle:* {a[\'mensaje\']}\\n🕒 *Hora programada:* {a[\'fechaProg\']}\\n\\n_Ve alistándote para salir o conectarte._"',
    code,
    flags=re.DOTALL
)

code = re.sub(
    r'txt = f"🔥 \*¡URGENTE! En 10 MINUTOS es tu cita\*.*?"🕒 \*Hora:\* \{a\[\'fechaProg\'\]\}"',
    'txt = f"🔥 *¡URGENTE! En 10 MINUTOS es tu cita*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Lugar/Detalle:* {a[\'mensaje\']}\\n🕒 *Hora:* {a[\'fechaProg\']}"',
    code,
    flags=re.DOTALL
)

code = re.sub(
    r'txt = f"🚨 \*¡ES EL MOMENTO AHORA!\*.*?"⏰ \*Hora actual:\* \{now_ec\.strftime\(\'%Y-%m-%d %H:%M:%S\'\)\}"',
    'txt = f"🚨 *¡ES EL MOMENTO AHORA!*\\n\\n📌 *{a[\'titulo\']}*\\n📝 {a[\'mensaje\']}\\n⏰ *Hora actual:* {now_ec.strftime(\'%Y-%m-%d %H:%M:%S\')}"',
    code,
    flags=re.DOTALL
)

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(code)

print("OK: Replaced and fixed f-strings in reminder worker")
