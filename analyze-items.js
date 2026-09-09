const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(process.env.DATABASE_URL, { prepareCacheLength: 100 });
const prisma = new PrismaClient({ adapter });

async function analyze() {
  const successIds = [
    'cmtp2laly000f04ju76j97cxz',
    'cmtp2lah7000e04ju9tucsgjk',
    'cmtp2lacc000d04ju4zx8yg4t',
    'cmtp2kvgz000604jux547rm5x',
    'cmtp2kw09000a04ju0h5rns8i'
  ];
  const failedIds = [
    'cmtp2lvsh000v04ju7vzdtfzk',
    'cmtp2lvnk000u04june2gu6g5',
    'cmtp2lvip000t04ju4pq787vs',
    'cmtp2lk88000m04ju3xe30pss',
    'cmtp2lkrr000q04juuha33log'
  ];

  const successItems = await prisma.inboxItem.findMany({ where: { id: { in: successIds } } });
  const failedItems = await prisma.inboxItem.findMany({ where: { id: { in: failedIds } } });

  console.log("=== EXITOSOS ===");
  successItems.forEach(i => console.log(`[${i.type} / ${i.platform}] "${i.content}" | extId: ${i.externalId} | from: ${i.fromExternalId} | status: ${i.status}`));

  console.log("\n=== FALLIDOS EN MAKE ===");
  failedItems.forEach(i => console.log(`[${i.type} / ${i.platform}] "${i.content}" | extId: ${i.externalId} | from: ${i.fromExternalId} | status: ${i.status}`));
}

analyze().catch(console.error).finally(() => prisma.$disconnect());
