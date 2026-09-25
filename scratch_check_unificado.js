// Script para obtener el Page Access Token de Agenda Cultural Loja
// Corre con: node scratch_check_unificado.js

const crypto = require('crypto');
const mysql = require('mariadb');
require('dotenv').config();

function decryptToken(cipherText) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'base64');
  const [ivB64, authTagB64, dataB64] = cipherText.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

async function main() {
  // Parsear DATABASE_URL manualmente para mariadb
  const dbUrl = process.env.DATABASE_URL || '';
  // mysql://user:pass@host:port/dbname
  const match = dbUrl.match(/mysql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('No se pudo parsear DATABASE_URL');
  const [, user, passwordEncoded, host, port, database] = match;
  const password = decodeURIComponent(passwordEncoded);

  const conn = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
  });

  const rows = await conn.query(`
    SELECT sa.displayName, sa.platform, sa.accessToken, b.name as businessName
    FROM SocialAccount sa
    JOIN Business b ON sa.businessId = b.id
    WHERE (LOWER(b.name) LIKE '%agenda%' OR LOWER(b.name) LIKE '%cultural%')
      AND sa.platform = 'FACEBOOK'
    LIMIT 5
  `);

  if (!rows.length) {
    console.log('❌ No se encontró ninguna cuenta de Facebook para Agenda Cultural.');
    console.log('   Asegúrate de haber conectado la página primero.');
    await conn.end();
    return;
  }

  for (const row of rows) {
    try {
      const token = decryptToken(row.accessToken);
      console.log('\n==================================================');
      console.log('✅ Negocio:', row.businessName);
      console.log('📄 Página:', row.displayName);
      console.log('🔑 Page Access Token (para Make.com):');
      console.log(token);
      console.log('==================================================\n');
    } catch (e) {
      console.error('Error descifrando token:', e.message);
    }
  }

  await conn.end();
}

main().catch(console.error);

