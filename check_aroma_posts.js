const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '').trim();

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function checkAroma() {
  const posts = await prisma.scheduledPost.findMany({
    where: { socialAccount: { businessId: 'cmu605zv0000004l6m4zaexri' } },
    include: {
      socialAccount: { select: { platform: true, displayName: true } },
      analytics: true
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Posts de Aroma de Montaña en BD: ${posts.length}`);
  posts.forEach(p => {
    console.log(`- ID: ${p.id} | Plataforma: ${p.platform} (${p.socialAccount.displayName}) | Estado: ${p.status} | ExternalPostId: ${p.externalPostId} | Analíticas: ${p.analytics ? 'SI' : 'NO'}`);
  });
}
checkAroma().finally(() => prisma.$disconnect());
