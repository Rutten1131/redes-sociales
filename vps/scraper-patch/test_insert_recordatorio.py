import asyncio
from main import tool_crear_recordatorio

async def test():
    print("Probando ejecucion directa de tool_crear_recordatorio...")
    res = await tool_crear_recordatorio(
        "Almorzar en Costillas del Huayaco",
        "Costillas del Huayaco frente a la escuela 18 de noviembre",
        "2026-09-10 14:00:00"
    )
    print("Resultado:", res)

asyncio.run(test())
