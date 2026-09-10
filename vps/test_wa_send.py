import urllib.request
import json

url = 'http://178.238.238.158:8080/message/sendText/agenda-cultural'
headers = {
    'apikey': '42a447c1-3d74-4b52-9571-042c174f7621',
    'Content-Type': 'application/json'
}
data = {
    "number": "593963410409",
    "text": "🤖 Test directo desde Hermes a tu WhatsApp (Evolution v2)",
    "options": {
        "delay": 1200,
        "presence": "composing",
        "linkPreview": True
    }
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as resp:
        print("Status code:", resp.status)
        print("Response:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
