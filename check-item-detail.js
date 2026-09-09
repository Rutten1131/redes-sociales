const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '').trim();

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function check() {
  const item = await prisma.inboxItem.findUnique({
    where: { id: 'cmtp2laly000f04ju76j97cxz' }
  });
  console.log('STATUS:', item.status);
  console.log('AI_REPLIED:', item.aiReplied);
  console.log('SUGGESTION:', item.aiSuggestedReply);
}
check().finally(() => prisma.$disconnect());
