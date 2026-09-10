#!/usr/bin/env python3
"""
Patch: Adds Deals button to sidebar in ALL HTML pages + fixes sidebar overflow bug.
Run on VPS: python3 /tmp/patch_sidebar.py
"""
import os
import re
import glob

PUBLIC_DIR = "/root/scraper-campanas-app/public"
ROOT_DIR = "/root/scraper-campanas-app"
STYLE_FILE = os.path.join(PUBLIC_DIR, "style.css")

# ─── 1. Fix sidebar CSS overflow bug ───
with open(STYLE_FILE, 'r', encoding='utf-8') as f:
    css = f.read()

# Fix: Add overflow-y auto to sidebar so all buttons are visible
old_sidebar = """.sidebar {
  width: 72px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  gap: 8px;
  flex-shrink: 0;
}"""

new_sidebar = """.sidebar {
  width: 72px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  gap: 6px;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar::-webkit-scrollbar { width: 0; }"""

if old_sidebar in css:
    css = css.replace(old_sidebar, new_sidebar)
    print("✅ Sidebar CSS overflow fix applied")
else:
    # Try a more flexible match
    if "overflow-y: auto" not in css.split(".sidebar {")[1].split("}")[0] if ".sidebar {" in css else True:
        css = css.replace(
            "flex-shrink: 0;\n}\n\n.sidebar-logo",
            "flex-shrink: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n}\n\n.sidebar::-webkit-scrollbar { width: 0; }\n\n.sidebar-logo"
        )
        print("✅ Sidebar CSS overflow fix applied (alt method)")

with open(STYLE_FILE, 'w', encoding='utf-8') as f:
    f.write(css)

# ─── 2. Add Deals button to sidebar in all HTML files ───
DEALS_BUTTON = '''            <a href="/deals" class="icon-btn" title="Deals & Propuestas">
                <ion-icon name="briefcase-outline"></ion-icon>
            </a>'''

# Find all HTML files
html_files = []
html_files.extend(glob.glob(os.path.join(PUBLIC_DIR, "*.html")))
html_files.extend(glob.glob(os.path.join(ROOT_DIR, "*.html")))
# Remove duplicates
html_files = list(set(html_files))

for html_file in html_files:
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Skip if deals button already exists
        if 'href="/deals"' in html:
            print(f"⏭️  {os.path.basename(html_file)}: Deals button already present")
            continue
        
        # Skip if no sidebar
        if 'class="sidebar"' not in html:
            print(f"⏭️  {os.path.basename(html_file)}: No sidebar found, skipping")
            continue
        
        # Strategy: Insert deals button AFTER the campanas button (mail-outline) 
        # or BEFORE the settings button (margin-top:auto)
        
        # Try inserting after campanas/mail button
        campanas_pattern = r'(<a href="/campanas"[^>]*>[\s\S]*?</a>)'
        match = re.search(campanas_pattern, html)
        if match:
            insertion_point = match.end()
            html = html[:insertion_point] + '\n' + DEALS_BUTTON + html[insertion_point:]
            print(f"✅ {os.path.basename(html_file)}: Deals button added after Campañas")
        else:
            # Try inserting before settings (margin-top:auto)
            settings_pattern = r'(<div class="icon-btn" title="Configuración")'
            match = re.search(settings_pattern, html)
            if match:
                insertion_point = match.start()
                html = html[:insertion_point] + DEALS_BUTTON + '\n            ' + html[insertion_point:]
                print(f"✅ {os.path.basename(html_file)}: Deals button added before Settings")
            else:
                print(f"⚠️  {os.path.basename(html_file)}: Could not find insertion point")
                continue
        
        # Also set the active state correctly for deals.html
        if 'deals.html' in html_file:
            html = html.replace('href="/deals" class="icon-btn"', 'href="/deals" class="icon-btn active"')
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html)
            
    except Exception as e:
        print(f"❌ {os.path.basename(html_file)}: Error - {e}")

print("\n🎉 Sidebar patch complete!")
