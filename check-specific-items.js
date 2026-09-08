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

async function checkSpecific() {
  const comment = await prisma.inboxItem.findFirst({
    where: { externalId: '1093159079904857_1048232448018365' }
  });
  console.log("Comentario 'hola?':", comment);

  const dm = await prisma.inboxItem.findFirst({
    where: { content: { contains: "eres de maychat" } }
  });
  console.log("DM 'eres de maychat?':", dm);

  const allItems = await prisma.inboxItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Últimos 5 items en la base de datos:");
  allItems.forEach(it => console.log(`ID: ${it.id} | ExternalId: ${it.externalId} | Content: ${it.content} | Status: ${it.status} | aiReplied: ${it.aiReplied} | CreatedAt: ${it.createdAt}`));
}

checkSpecific().catch(console.error).finally(() => prisma.$disconnect());
