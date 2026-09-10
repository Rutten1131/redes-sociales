import asyncio
from main import run_agent_turn

text = (
    "¿Qué fue mi hijito? Hay que enviar una cotización aquí a una mecánica, ya me dijeron la tarjeta "
    "y el señor casi no quiere, se llama el ingeniero Alex Román, él casi no quiere la página porque "
    "realmente dice que ellos trabajan más con el Estado, con contratos, entonces pero en cambio sí quieren "
    "el sistema de fidelización, o sea un CRM de clientes entonces hay que enviarle la propuesta de eso y "
    "eso me dice eso sí envíamelo porque igual junto con lo de la página enviámelo porque yo le paso enseguida "
    "a la gerencia porque eso estamos haciendo de forma manual y realmente se nos pasa muchísimo eso "
    "entonces hay un detallito que no hay que saltar"
)

async def test():
    res = await run_agent_turn(text)
    print("=== RESPUESTA QUE HERMES DA A ESTE AUDIO ===")
    print(res)

asyncio.run(test())
