with open("/root/hermes-agent/main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'txt = f"⏳ *RECORDATORIO: En 1 HORA tienes un compromiso*' in line:
        new_lines.append('                    txt = f"⏳ *RECORDATORIO: En 1 HORA tienes un compromiso*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Detalle:* {a[\'mensaje\']}\\n🕒 *Hora programada:* {a[\'fechaProg\']}"\n')
        skip = True
    elif 'txt = f"⚠️ *RECORDATORIO: En 30 MINUTOS es tu cita*' in line:
        new_lines.append('                    txt = f"⚠️ *RECORDATORIO: En 30 MINUTOS es tu cita*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Detalle:* {a[\'mensaje\']}\\n🕒 *Hora programada:* {a[\'fechaProg\']}\\n\\n_Ve alistándote para salir o conectarte._"\n')
        skip = True
    elif 'txt = f"🔥 *¡URGENTE! En 10 MINUTOS es tu cita*' in line:
        new_lines.append('                    txt = f"🔥 *¡URGENTE! En 10 MINUTOS es tu cita*\\n\\n📌 *{a[\'titulo\']}*\\n📍 *Lugar/Detalle:* {a[\'mensaje\']}\\n🕒 *Hora:* {a[\'fechaProg\']}"\n')
        skip = True
    elif 'txt = f"🚨 *¡ES EL MOMENTO AHORA!*' in line:
        new_lines.append('                    txt = f"🚨 *¡ES EL MOMENTO AHORA!*\\n\\n📌 *{a[\'titulo\']}*\\n📝 {a[\'mensaje\']}\\n⏰ *Hora actual:* {now_ec.strftime(\'%Y-%m-%d %H:%M:%S\')}"\n')
        skip = True
    elif skip:
        if line.strip().startswith('await tool_send_whatsapp') or line.strip().startswith('cur.execute'):
            skip = False
            new_lines.append(line)
    else:
        new_lines.append(line)

with open("/root/hermes-agent/main.py", "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("CLEAN REPLACEMENT DONE")
