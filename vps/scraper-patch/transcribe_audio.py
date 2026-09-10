import re
from groq import Groq

api_key = open('/root/hermes-agent/.env').read()
k = re.search(r'GROQ_API_KEY=(gsk_[a-zA-Z0-9]+)', api_key).group(1)
client = Groq(api_key=k)

with open('/tmp/audio_test.ogg', 'rb') as f:
    t = client.audio.transcriptions.create(
        file=('voice.ogg', f.read()),
        model='whisper-large-v3-turbo'
    )

print("=== TRANSCRIPCION EXACTA DEL AUDIO ===")
print(t.text)
