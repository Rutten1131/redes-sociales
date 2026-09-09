const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '').trim();

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function checkAll() {
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, autoReplyComments: true, autoReplyDMs: true }
  });
  console.log("Negocios registrados:");
  businesses.forEach(b => console.log(`ID: ${b.id} | Name: ${b.name} | autoReplyComments: ${b.autoReplyComments} | autoReplyDMs: ${b.autoReplyDMs}`));
}
checkAll().finally(() => prisma.$disconnect());
