import re
from datetime import datetime, timedelta

file_path = '/root/hermes-agent/main.py'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Inyectar fecha y hora REAL de Ecuador dinámicamente en run_agent_turn
old_turn = """async def run_agent_turn(user_message: str) -> str:
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message}
        ]"""

new_turn = """async def run_agent_turn(user_message: str) -> str:
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        # Inyectar fecha y hora REAL de Ecuador en tiempo de ejecución
        now_ec = datetime.utcnow() - timedelta(hours=5)
        dias_semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        nombre_dia = dias_semana[now_ec.weekday()]
        fecha_hoy = now_ec.strftime('%Y-%m-%d')
        hora_hoy = now_ec.strftime('%H:%M:%S')
        fecha_manana = (now_ec + timedelta(days=1)).strftime('%Y-%m-%d')

        dynamic_system = (
            f"{SYSTEM_PROMPT}\\n\\n"
            f"📅 [FECHA Y HORA ACTUAL EXACTA EN ECUADOR (America/Guayaquil - UTC-5)]\\n"
            f"- Hoy es: {nombre_dia}, {fecha_hoy}\\n"
            f"- Hora actual exacta: {hora_hoy}\\n"
            f"- REGLAS DE TIEMPO:\\n"
            f"  * Si César dice 'hoy a las 17:00' (o cualquier hora de hoy), usa OBLIGATORIAMENTE la fecha {fecha_hoy} (ej: '{fecha_hoy} 17:00:00').\\n"
            f"  * Si César dice 'mañana', usa la fecha {fecha_manana}.\\n"
            f"  * ¡NUNCA uses una fecha del pasado ni hardcodeada! Usa SIEMPRE la fecha real actual: {fecha_hoy}.\\n"
        )

        messages = [
            {"role": "system", "content": dynamic_system},
            {"role": "user", "content": user_message}
        ]"""

if old_turn in code:
    code = code.replace(old_turn, new_turn, 1)
    print("SUCCESS: Patch 1 (Dynamic Ecuador Date) applied")
else:
    print("WARNING: old_turn pattern not found directly, checking regex")

# 2. Acotar la alerta exacta para que solo dispare si la fecha venció en los últimos 4 horas y no es del futuro ni de días pasados
old_exacto = """                # 4. Alerta al Minuto Exacto / Vencimiento
                sql_exacto = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND fechaProg <= %s
                \"\"\"
                cur.execute(sql_exacto, (now_ec,))"""

new_exacto = """                # 4. Alerta al Minuto Exacto / Vencimiento (solo si llegó la hora exacta y dentro de las últimas 3 horas)
                sql_exacto = \"\"\"
                    SELECT id, titulo, mensaje, fechaProg FROM Aviso 
                    WHERE estado = 'PENDIENTE' 
                      AND fechaProg <= %s
                      AND fechaProg >= %s
                \"\"\"
                cur.execute(sql_exacto, (now_ec, now_ec - timedelta(hours=3)))"""

if old_exacto in code:
    code = code.replace(old_exacto, new_exacto, 1)
    print("SUCCESS: Patch 2 (Bounded exact alert) applied")
else:
    print("WARNING: old_exacto pattern not found directly")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("FILE_UPDATED_COMPLETED")
