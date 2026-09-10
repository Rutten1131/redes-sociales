import glob
import re

files = sorted(glob.glob("/root/scraper-campanas-app/public/*.html"))
routes = ["/", "/centro", "/bd", "/enriquecer", "/campanas", "/deals"]

print("=" * 60)
for f in files:
    content = open(f, "r", encoding="utf-8").read()
    found = []
    for r in routes:
        pattern = f'href="{r}"'
        if pattern in content:
            # check if active
            is_act = f'href="{r}" class="icon-btn active"' in content or f'href="{r}" class="active"' in content or f'class="icon-btn active" href="{r}"' in content
            found.append(f"{r} ({'ACTIVE' if is_act else 'normal'})")
    print(f"{f.split('/')[-1]}: {len(found)} botones -> {', '.join(found)}")
print("=" * 60)
