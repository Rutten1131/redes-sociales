import urllib.request
import json

url = 'http://178.238.238.158:8080/instance/fetchInstances'
req = urllib.request.Request(url, headers={'apikey': '42a447c1-3d74-4b52-9571-042c174f7621'})

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for inst in data:
            print(f"Name: {inst.get('name')} | Status: {inst.get('connectionStatus')} | Owner: {inst.get('ownerJid')}")
except Exception as e:
    print("Error:", e)
