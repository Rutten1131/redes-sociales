const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '').trim();

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

async function checkBusiness() {
  const item = await prisma.inboxItem.findUnique({
    where: { id: 'cmtp2laly000f04ju76j97cxz' },
    include: {
      socialAccount: {
        include: {
          business: true
        }
      }
    }
  });
  console.log("Business name:", item.socialAccount.business.name);
  console.log("Business autoReplyComments:", item.socialAccount.business.autoReplyComments);
  console.log("Business autoReplyDMs:", item.socialAccount.business.autoReplyDMs);
  console.log("Item Type:", item.type);
}
checkBusiness().finally(() => prisma.$disconnect());
