const fs = require('fs');
const path = require('path');

// Cargar .env
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

const crypto = require('crypto');

function decryptToken(cipherText) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'base64');
  const [ivB64, authTagB64, dataB64] = cipherText.split(':');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Formato inválido');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

const { PrismaClient } = require('./node_modules/@prisma/client');
const { PrismaMariaDb } = require('./node_modules/@prisma/adapter-mariadb');

const adapter = new PrismaMariaDb(process.env.DATABASE_URL, { prepareCacheLength: 100 });
const prisma = new PrismaClient({ adapter });

async function testFetchMeta() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: 'FACEBOOK' }
  });

  for (const acc of accounts) {
    console.log(`\nProbando cuenta Facebook ID ${acc.id} (${acc.displayName}) de negocio ${acc.businessId}...`);
    try {
      const token = decryptToken(acc.accessToken);
      console.log(`Token descifrado exitosamente (primeros 15 chars: ${token.slice(0, 15)}...)`);
      
      // Probar /me con el token
      const meUrl = `https://graph.facebook.com/v19.0/me?access_token=${token}`;
      const meRes = await fetch(meUrl);
      const meData = await meRes.json();
      console.log("/me resultado:", meData);

      // Probar leer comentarios del post de la captura
      const postsUrl = `https://graph.facebook.com/v19.0/${acc.externalId}/posts?fields=id,message,created_time,comments{id,message,from,created_time}&limit=3&access_token=${token}`;
      const postsRes = await fetch(postsUrl);
      const postsData = await postsRes.json();
      if (postsData.error) {
        console.error("Posts error:", postsData.error);
      } else {
        console.log(`Posts recuperados: ${postsData.data?.length || 0}`);
        for (const p of (postsData.data || [])) {
          const comments = p.comments?.data || [];
          console.log(`- Post ${p.id} (${(p.message || '').slice(0, 30)}...): ${comments.length} comentarios`);
          comments.forEach(c => console.log(`   * Comentario de ${c.from?.name}: "${c.message}" (ID: ${c.id})`));
        }
      }

      // Probar DMs
      const dmsUrl = `https://graph.facebook.com/v19.0/${acc.externalId}/conversations?fields=id,participants,updated_time,messages{id,message,from,created_time}&limit=3&access_token=${token}`;
      const dmsRes = await fetch(dmsUrl);
      const dmsData = await dmsRes.json();
      if (dmsData.error) {
        console.error("DMs error:", dmsData.error);
      } else {
        console.log(`Conversaciones DMs recuperadas: ${dmsData.data?.length || 0}`);
        for (const c of (dmsData.data || [])) {
          const msgs = c.messages?.data || [];
          console.log(`- Convo ${c.id}: ${msgs.length} mensajes`);
          msgs.forEach(m => console.log(`   * Mensaje de ${m.from?.name}: "${m.message}"`));
        }
      }

    } catch (err) {
      console.error("Error descifrando o consultando:", err.message);
    }
  }
}

testFetchMeta().catch(console.error).finally(() => prisma.$disconnect());
