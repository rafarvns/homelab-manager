import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

/**
 * Derives a strong 32-byte key from a passphrase and salt using PBKDF2
 */
export function deriveSyncKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a string/object using AES-256-GCM with a passphrase-derived key.
 * Output is a Buffer: [SALT(16)][IV(12)][TAG(16)][CIPHERTEXT]
 */
export function encryptSyncPayload(data: string, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveSyncKey(passphrase, salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine components into a single buffer
  return Buffer.concat([salt, iv, tag, encrypted]);
}

/**
 * Decrypts a buffer produced by encryptSyncPayload.
 */
export function decryptSyncPayload(payload: Buffer, passphrase: string): string {
  if (payload.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid or corrupted sync payload');
  }

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveSyncKey(passphrase, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}
