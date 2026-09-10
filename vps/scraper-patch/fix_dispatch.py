#!/usr/bin/env python3
"""Fix Hermes tool dispatch - adds crear_deal and other missing tools"""

HERMES_FILE = "/root/hermes-agent/main.py"

with open(HERMES_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''            elif fn == "schedule_post":
                res = await tool_schedule_post(args.get("caption", ""), args.get("scheduled_at_iso", ""))
            else:'''

new = '''            elif fn == "schedule_post":
                res = await tool_schedule_post(args.get("caption", ""), args.get("scheduled_at_iso", ""))
            elif fn == "crear_deal":
                res = await tool_crear_deal(**args)
            elif fn == "crear_recordatorio":
                res = await tool_crear_recordatorio(**args)
            elif fn == "get_accounts":
                res = await tool_get_accounts()
            elif fn == "get_pending_posts":
                res = await tool_get_pending_posts()
            elif fn == "get_inbox":
                res = await tool_get_inbox()
            else:'''

if old in content:
    content = content.replace(old, new)
    with open(HERMES_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK - dispatch added")
else:
    if 'crear_deal' in content.split('elif fn ==')[0] if 'elif fn ==' in content else '':
        print("SKIP - already patched")
    else:
        print("WARN - pattern not found, checking...")
        # Show what we have around schedule_post
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'schedule_post' in line and 'elif' in line:
                print(f"Line {i}: {line}")
                for j in range(i, min(i+5, len(lines))):
                    print(f"  {j}: {lines[j]}")
