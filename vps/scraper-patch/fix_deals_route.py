#!/usr/bin/env python3
"""Fix deals page route to use FileResponse instead of HTMLResponse"""

API_FILE = "/root/scraper-campanas-app/api.py"

with open(API_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

old_route = '''@app.get("/deals")
def read_deals_page():
    """Sirve la página de Deals & Propuestas."""
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "deals.html")
    if os.path.exists(html_path):
        return HTMLResponse(open(html_path, encoding="utf-8").read())
    return HTMLResponse("<h1>deals.html not found</h1>", status_code=404)'''

new_route = '''@app.get("/deals")
def read_deals_page():
    """Sirve la página de Deals & Propuestas."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "deals.html")
    if not os.path.exists(path):
        path = "public/deals.html"
    return FileResponse(path)'''

if old_route in content:
    content = content.replace(old_route, new_route)
    print("OK - Fixed deals route to use FileResponse")
else:
    print("WARN - Could not find exact pattern, trying alt...")
    content = content.replace(
        'return HTMLResponse(open(html_path, encoding="utf-8").read())',
        'return FileResponse(html_path)'
    ).replace(
        'return HTMLResponse("<h1>deals.html not found</h1>", status_code=404)',
        'return FileResponse("public/deals.html")'
    )
    print("OK - Applied alt fix")

with open(API_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
