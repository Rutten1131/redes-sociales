import urllib.request
import json

url1 = 'https://api.telegram.org/bot8276624960:AAEMP2USTrTVI1Bns7MIVXcb5saqzthIB44/sendMessage'
url2 = 'https://api.telegram.org/bot8958543593:AAFq6ngDHCun651YunhsUNcI2pSoC-k6qUI/sendMessage'

# Bot 1
req1 = urllib.request.Request(url1, data=json.dumps({'chat_id': 2126922376, 'text': 'Prueba conexion Bot Cotizador'}).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req1) as r:
        print('Bot Cotizador (bot.js): OK', r.status)
except Exception as e:
    print('Bot Cotizador (bot.js): ERROR ->', e)

# Bot 2
req2 = urllib.request.Request(url2, data=json.dumps({'chat_id': 2126922376, 'text': 'Prueba conexion Bot Hermes Master'}).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req2) as r:
        print('Bot Hermes Master: OK', r.status)
except Exception as e:
    print('Bot Hermes Master: ERROR ->', e)
