#!/usr/bin/env python3
"""
Fixes @app.on_event("startup") decorator to directly decorate the startup() function.
"""

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, "r", encoding="utf-8") as f:
    code = f.read()

# Remove stray @app.on_event("startup")
code = code.replace('@app.on_event("startup")\n\nSEEN_EMAIL_ALERT_IDS = set()', 'SEEN_EMAIL_ALERT_IDS = set()')

# Decorate async def startup():
if '@app.on_event("startup")\nasync def startup():' not in code:
    code = code.replace('async def startup():', '@app.on_event("startup")\nasync def startup():')

with open(HERMES_FILE, "w", encoding="utf-8") as f:
    f.write(code)

print("OK: Fixed startup decorator")
