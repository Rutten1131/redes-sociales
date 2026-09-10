#!/bin/bash
# Master deploy script for Deals CRM feature
# Run on VPS: bash /tmp/deploy_deals.sh

set -e
echo "═══════════════════════════════════════════"
echo "  DEPLOYING: Deals & Propuestas CRM"
echo "═══════════════════════════════════════════"

# ─── 1. Backup current files ───
echo ""
echo "📦 Step 1: Creating backups..."
mkdir -p /root/backups/pre-deals-$(date +%Y%m%d)
cp /root/scraper-campanas-app/api.py /root/backups/pre-deals-$(date +%Y%m%d)/api.py.bak
cp /root/scraper-campanas-app/public/style.css /root/backups/pre-deals-$(date +%Y%m%d)/style.css.bak
cp /root/hermes-agent/main.py /root/backups/pre-deals-$(date +%Y%m%d)/hermes_main.py.bak
echo "  ✅ Backups saved to /root/backups/pre-deals-$(date +%Y%m%d)/"

# ─── 2. Copy deals.html to scraper public dir ───
echo ""
echo "📄 Step 2: Copying deals.html..."
cp /tmp/deals.html /root/scraper-campanas-app/public/deals.html
echo "  ✅ deals.html copied"

# ─── 3. Patch scraper API ───
echo ""
echo "🔧 Step 3: Patching Scraper API (deals endpoints)..."
python3 /tmp/patch_deals_api.py

# ─── 4. Patch sidebar in all pages + CSS fix ───
echo ""
echo "🎨 Step 4: Patching sidebar (all pages + CSS fix)..."
python3 /tmp/patch_sidebar.py

# ─── 5. Patch Hermes with crear_deal tool ───
echo ""
echo "🤖 Step 5: Patching Hermes Agent (crear_deal tool)..."
python3 /tmp/patch_hermes_deals.py

# ─── 6. Rebuild and restart scraper ───
echo ""
echo "🐳 Step 6: Rebuilding Scraper container..."
cd /root/scraper-campanas-app
docker build -t scraper-campanas-app . 2>&1 | tail -5
docker stop scraper-campanas-app 2>/dev/null || true
docker rm scraper-campanas-app 2>/dev/null || true

# Read docker-compose to preserve the run config
if [ -f docker-compose.yml ]; then
    docker compose up -d
else
    docker run -d \
        --name scraper-campanas-app \
        -p 8000:8000 \
        -v /root/scraper-campanas-app/PROSPECTOS_BD:/app/PROSPECTOS_BD \
        -v /root/scraper-campanas-app/recordings:/app/recordings \
        -v /root/scraper-campanas-app/deals.json:/app/deals.json \
        --restart unless-stopped \
        scraper-campanas-app
fi
echo "  ✅ Scraper container rebuilt and running"

# ─── 7. Rebuild and restart Hermes ───
echo ""
echo "🤖 Step 7: Rebuilding Hermes container..."
cd /root/hermes-agent
docker build -t hermes-agent . 2>&1 | tail -5
docker stop hermes-agent 2>/dev/null || true
docker rm hermes-agent 2>/dev/null || true

if [ -f docker-compose.yml ]; then
    docker compose up -d
else
    docker run -d \
        --name hermes-agent \
        -p 127.0.0.1:8090:8090 \
        --env-file .env \
        --restart unless-stopped \
        hermes-agent
fi
echo "  ✅ Hermes container rebuilt and running"

# ─── 8. Verify ───
echo ""
echo "🔍 Step 8: Verification..."
sleep 5

echo "  Checking Scraper..."
SCRAPER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/deals 2>/dev/null || echo "FAIL")
echo "    /deals page: HTTP $SCRAPER_STATUS"

DEALS_API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/deals 2>/dev/null || echo "FAIL")
echo "    /api/deals: HTTP $DEALS_API"

echo "  Checking Hermes..."
HERMES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/ 2>/dev/null || echo "FAIL")
echo "    Hermes root: HTTP $HERMES_STATUS"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo ""
echo "  Frontend: http://scraper.178.238.238.158.sslip.io/deals"
echo "  API:      http://178.238.238.158:8000/api/deals"
echo "═══════════════════════════════════════════"
