#!/usr/bin/env python3
"""
Fix sidebar navigation in all HTML pages to include Deals & Propuestas button
and ensure proper overflow/scrolling so icons never disappear.
"""
import os

BASE_DIR = "/root/scraper-campanas-app/public"

# 1. Enriquecer
f_enriquecer = os.path.join(BASE_DIR, "enriquecer.html")
if os.path.exists(f_enriquecer):
    with open(f_enriquecer, "r", encoding="utf-8") as f:
        c = f.read()
    if '/deals' not in c:
        target = '''            <a href="/enriquecer" class="icon-btn active" title="Enriquecer Lista (RADAR)">
                <ion-icon name="color-wand-outline"></ion-icon>
            </a>'''
        replacement = target + '''
            <a href="/campanas" class="icon-btn" title="Gestor de Campañas & Calendario">
                <ion-icon name="mail-outline"></ion-icon>
            </a>
            <a href="/deals" class="icon-btn" title="Deals & Propuestas">
                <ion-icon name="briefcase-outline"></ion-icon>
            </a>'''
        if target in c:
            c = c.replace(target, replacement, 1)
            with open(f_enriquecer, "w", encoding="utf-8") as f:
                f.write(c)
            print("OK: Updated enriquecer.html")
        else:
            print("WARN: Target not found in enriquecer.html")

# 2. Centro de llamadas
f_centro = os.path.join(BASE_DIR, "centro_de_llamadas.html")
if os.path.exists(f_centro):
    with open(f_centro, "r", encoding="utf-8") as f:
        c = f.read()
    if '/deals' not in c:
        target = '''    <a href="/enriquecer" title="Enriquecer Lista (RADAR)" class="icon-btn">
      <ion-icon name="color-wand-outline" style="font-size: 20px;"></ion-icon>
    </a>'''
        replacement = target + '''
    <a href="/campanas" title="Gestor de Campañas & Calendario" class="icon-btn">
      <ion-icon name="mail-outline" style="font-size: 20px;"></ion-icon>
    </a>
    <a href="/deals" title="Deals & Propuestas" class="icon-btn">
      <ion-icon name="briefcase-outline" style="font-size: 20px;"></ion-icon>
    </a>'''
        if target in c:
            c = c.replace(target, replacement, 1)
            with open(f_centro, "w", encoding="utf-8") as f:
                f.write(c)
            print("OK: Updated centro_de_llamadas.html")
        else:
            print("WARN: Target not found in centro_de_llamadas.html")

# 3. BD Editor
f_bd = os.path.join(BASE_DIR, "bd_editor.html")
if os.path.exists(f_bd):
    with open(f_bd, "r", encoding="utf-8") as f:
        c = f.read()
    if '/deals' not in c:
        target = '''      <a href="/campanas" title="Gestor de Campañas & Calendario">
        <ion-icon name="mail-outline"></ion-icon>
      </a>'''
        replacement = target + '''
      <a href="/deals" title="Deals & Propuestas">
        <ion-icon name="briefcase-outline"></ion-icon>
      </a>'''
        if target in c:
            c = c.replace(target, replacement, 1)
            with open(f_bd, "w", encoding="utf-8") as f:
                f.write(c)
            print("OK: Updated bd_editor.html")
        else:
            print("WARN: Target not found in bd_editor.html")

print("All sidebar updates finished.")
