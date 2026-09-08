const fs = require('fs');
const path = require('path');

// Cargar .env manualmente
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

async function main() {
  console.log("Conectando a base de datos...");
  const businesses = await prisma.business.findMany();
  console.log("\n=== NEGOCIOS ===");
  businesses.forEach(b => {
    console.log(`ID: ${b.id} | Nombre: ${b.name} | autoReplyComments: ${b.autoReplyComments} | autoReplyDMs: ${b.autoReplyDMs}`);
  });

  const accounts = await prisma.socialAccount.findMany();
  console.log("\n=== CUENTAS SOCIALES ===");
  accounts.forEach(a => {
    console.log(`ID: ${a.id} | Plataforma: ${a.platform} | DisplayName: ${a.displayName} | ExternalId: ${a.externalId} | BusinessId: ${a.businessId}`);
  });

  const items = await prisma.inboxItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`\n=== INBOX ITEMS (Total recientes: ${items.length}) ===`);
  items.forEach(i => {
    console.log(`[${i.platform} - ${i.type}] ${i.fromName}: "${i.content}" | status: ${i.status} | aiReplied: ${i.aiReplied} | suggested: "${(i.aiSuggestedReply || '').slice(0, 40)}" | fecha: ${i.createdAt}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
