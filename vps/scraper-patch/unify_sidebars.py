#!/usr/bin/env python3
"""
Standardize sidebar across ALL HTML pages in Scraper Campanas:
- index.html (Motor de Adquisición - active on /)
- centro_de_llamadas.html (Centro de Llamadas - active on /centro)
- bd_editor.html (Editor de BD - active on /bd)
- enriquecer.html (RADAR - active on /enriquecer)
- campanas.html (Campañas - active on /campanas)
- deals.html (Deals - active on /deals)

Ensures:
1. Exact same dark glassmorphism styling
2. Exact same 6 navigation buttons in the exact same order
3. Correct 'active' class on current page
4. Proper overflow and sizing so no buttons get cut off
"""
import os
import re

PUBLIC_DIR = "/root/scraper-campanas-app/public"

NAV_BUTTONS_DEF = [
    ("/", "Motor de Adquisición", "search-outline"),
    ("/centro", "Centro de Llamadas / CRM", "call-outline"),
    ("/bd", "Editor de Prospectos (BD)", "grid-outline"),
    ("/enriquecer", "Enriquecer Lista (RADAR)", "color-wand-outline"),
    ("/campanas", "Gestor de Campañas & Calendario", "mail-outline"),
    ("/deals", "Deals & Propuestas", "briefcase-outline")
]

UNIFIED_SIDEBAR_CSS = """
/* ═══ UNIFIED GLOBAL SIDEBAR STYLING ═══ */
.sidebar, .nav-sidebar, .bd-nav-sidebar {
  width: 72px !important;
  min-width: 72px !important;
  max-width: 72px !important;
  background: rgba(6, 10, 20, 0.88) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 16px 0 !important;
  gap: 8px !important;
  flex-shrink: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  box-sizing: border-box !important;
  z-index: 100 !important;
}
.sidebar::-webkit-scrollbar, .nav-sidebar::-webkit-scrollbar, .bd-nav-sidebar::-webkit-scrollbar {
  width: 0 !important;
  display: none !important;
}
.sidebar-logo, .logo-icon, .bd-nav-sidebar .logo {
  width: 40px !important;
  height: 40px !important;
  min-height: 40px !important;
  background: linear-gradient(135deg, #3b82f6, #6366f1) !important;
  border-radius: 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif !important;
  font-size: 18px !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  margin-bottom: 12px !important;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4) !important;
}
.icon-btn, .bd-nav-sidebar a {
  width: 44px !important;
  height: 44px !important;
  min-height: 44px !important;
  border-radius: 10px !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  font-size: 21px !important;
  color: #64748b !important;
  cursor: pointer !important;
  transition: all 0.15s ease !important;
  text-decoration: none !important;
  border: 1px solid transparent !important;
  background: transparent !important;
  box-sizing: border-box !important;
}
.icon-btn:hover, .bd-nav-sidebar a:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #94a3b8 !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-1px) !important;
}
.icon-btn.active, .bd-nav-sidebar a.active {
  background: rgba(59, 130, 246, 0.18) !important;
  color: #3b82f6 !important;
  border-color: rgba(59, 130, 246, 0.35) !important;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.28) !important;
}
"""

def build_sidebar_html(active_route, container_class="sidebar", logo_class="sidebar-logo"):
    lines = [f'        <div class="{container_class}">']
    lines.append(f'            <div class="{logo_class}">Q</div>')
    for href, title, icon in NAV_BUTTONS_DEF:
        is_active = " active" if href == active_route else ""
        lines.append(f'            <a href="{href}" class="icon-btn{is_active}" title="{title}">')
        lines.append(f'                <ion-icon name="{icon}"></ion-icon>')
        lines.append('            </a>')
    lines.append('        </div>')
    return "\n".join(lines)

# 1. Update style.css with unified rules
style_css_path = os.path.join(PUBLIC_DIR, "style.css")
if os.path.exists(style_css_path):
    with open(style_css_path, "r", encoding="utf-8") as f:
        s_content = f.read()
    if "/* ═══ UNIFIED GLOBAL SIDEBAR STYLING ═══ */" not in s_content:
        s_content += "\n" + UNIFIED_SIDEBAR_CSS
        with open(style_css_path, "w", encoding="utf-8") as f:
            f.write(s_content)
        print("OK: Appended unified styling to style.css")

# Helper to inject CSS into head if style.css is not imported
def ensure_style_tag(content):
    if "/* ═══ UNIFIED GLOBAL SIDEBAR STYLING ═══ */" not in content:
        style_block = f"<style>{UNIFIED_SIDEBAR_CSS}</style>\n</head>"
        content = content.replace("</head>", style_block, 1)
    return content

# 2. Patch each page
pages_config = [
    ("index.html", "/", r'(<div class="sidebar">.*?</div>\s*</div>)', "glass-sidebar"),
    ("centro_de_llamadas.html", "/centro", r'(<div class="nav-sidebar">.*?</div>)', "nav-sidebar"),
    ("bd_editor.html", "/bd", r'(<nav class="bd-nav-sidebar">.*?</nav>)', "bd-nav-sidebar"),
    ("enriquecer.html", "/enriquecer", r'(<div class="sidebar">.*?</div>\s*</div>)', "glass-sidebar"),
    ("campanas.html", "/campanas", r'(<div class="sidebar">.*?</div>\s*</div>)', "glass-sidebar"),
    ("deals.html", "/deals", r'(<div class="sidebar">.*?</div>\s*</div>)', "glass-sidebar")
]

for filename, route, pattern, nav_type in pages_config:
    file_path = os.path.join(PUBLIC_DIR, filename)
    if not os.path.exists(file_path):
        print(f"WARN: {filename} not found")
        continue

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Always inject unified CSS
    content = ensure_style_tag(content)

    new_nav = ""
    for href, title, icon in NAV_BUTTONS_DEF:
        is_active = " active" if href == route else ""
        new_nav += f'    <a href="{href}" class="icon-btn{is_active}" title="{title}">\n'
        new_nav += f'      <ion-icon name="{icon}"></ion-icon>\n'
        new_nav += '    </a>\n'

    if filename == "centro_de_llamadas.html":
        # Match <div class="nav-sidebar">...</div>
        replacement = f'<div class="nav-sidebar">\n    <div class="sidebar-logo">Q</div>\n{new_nav}  </div>'
        content = re.sub(r'<div class="nav-sidebar">.*?</div>\s*(?=\s*<!-- Sidebar Prospectos)', replacement, content, flags=re.DOTALL)
        print(f"OK: Replaced navigation in {filename}")

    elif filename == "bd_editor.html":
        # Match <nav class="bd-nav-sidebar">...</nav>
        replacement = f'<nav class="bd-nav-sidebar">\n    <div class="sidebar-logo">Q</div>\n{new_nav}  </nav>'
        content = re.sub(r'<nav class="bd-nav-sidebar">.*?</nav>', replacement, content, flags=re.DOTALL)
        print(f"OK: Replaced navigation in {filename}")

    else:
        # index.html, enriquecer.html, campanas.html, deals.html
        # Match <div class="sidebar">...</div>
        # Keep any settings button if it exists or keep clean standard
        replacement = f'<div class="sidebar">\n    <div class="sidebar-logo">Q</div>\n{new_nav}  </div>'
        content = re.sub(r'<div class="sidebar">.*?</div>(?=\s*<div class="main-content">)', replacement, content, flags=re.DOTALL)
        print(f"OK: Replaced navigation in {filename}")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

print("ALL PAGES FULLY STANDARDIZED WITH 6 UNIFIED BUTTONS!")
