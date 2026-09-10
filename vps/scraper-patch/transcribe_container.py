import os
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

with open("/tmp/audio_test.ogg", "rb") as f:
    t = client.audio.transcriptions.create(
        file=("voice.ogg", f.read()),
        model="whisper-large-v3-turbo"
    )

print("=== AUDIO TRANSCRIPCION ===")
print(t.text)
