import crypto from "crypto";

/**
 * Cifra/descifra tokens de acceso antes de guardarlos en la base de datos.
 * Usa AES-256-GCM (autenticado, seguro para este caso de uso).
 *
 * TOKEN_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes.
 * Generarla con: openssl rand -base64 32
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está configurada. Genera una con: openssl rand -base64 32"
    );
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY debe decodificar a 32 bytes.");
  }
  return buf;
}

/**
 * Devuelve un string en formato: iv:authTag:ciphertext (todo en base64)
 */
export function encryptToken(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptToken(cipherText: string): string {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = cipherText.split(":");

  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Formato de token cifrado inválido.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
