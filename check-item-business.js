const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].replace(/"/g, '').trim();

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({ adapter });

const cryptoMod = require('crypto');

function decrypt(cipherText, keyBase64) {
  const buf = Buffer.from(keyBase64, 'base64');
  const [ivB64, authTagB64, dataB64] = cipherText.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = cryptoMod.createDecipheriv('aes-256-gcm', buf, iv);
  decipher.setTag ? decipher.setTag(authTag) : decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function listAllBusinesses() {
  const businesses = await prisma.business.findMany({
    include: {
      socialAccounts: { select: { id: true, platform: true, displayName: true } },
      _count: { select: { socialAccounts: true } }
    }
  });
  console.log("NEGOCIOS ACTUALES:", JSON.stringify(businesses.map(b => ({
    id: b.id,
    name: b.name,
    accountsCount: b._count.socialAccounts,
    accounts: b.socialAccounts.map(a => `${a.platform} (${a.displayName})`)
  })), null, 2));
}
listAllBusinesses().finally(() => prisma.$disconnect());
