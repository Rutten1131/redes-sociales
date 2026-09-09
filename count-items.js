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

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function check() {
  const count = await prisma.inboxItem.count({ where: { status: 'PENDING' } });
  const answered = await prisma.inboxItem.count({ where: { status: 'ANSWERED', aiReplied: true } });
  console.log('Items PENDING restantes:', count);
  console.log('Items ANSWERED con IA:', answered);

  const answeredItems = await prisma.inboxItem.findMany({
    where: { aiReplied: true },
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });
  console.log('Últimos respondidos por IA:');
  answeredItems.forEach(i => console.log(`[${i.type} / ${i.platform}] "${i.content}" -> Sugerencia: "${i.aiSuggestedReply?.slice(0, 80)}..."`));
}
check().finally(() => prisma.$disconnect());
