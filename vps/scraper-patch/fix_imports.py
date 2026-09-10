#!/usr/bin/env python3
"""
Ensure top of api.py has:
import uuid
from datetime import datetime
"""

API_FILE = "/root/scraper-campanas-app/api.py"

with open(API_FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Add imports at the very top (after first line or imports section)
import_lines = "import uuid\nfrom datetime import datetime\n"

if "from datetime import datetime" not in content[:500]:
    content = import_lines + content
    with open(API_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: Added datetime and uuid imports to top of api.py")
else:
    print("Imports already present near top.")
