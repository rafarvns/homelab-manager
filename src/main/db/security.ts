import { safeStorage } from 'electron';

/**
 * Encrypts a plaintext string using Electron's safeStorage.
 * Returns a base64 encoded string of the encrypted buffer.
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;
  
  // If safeStorage is not available (e.g. some obscure Linux setups without keyring),
  // we could fallback to plaintext or throw error. But standard is available.
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('safeStorage encryption is not available. Storing in plaintext.');
    return text;
  }

  try {
    const buffer = safeStorage.encryptString(text);
    return buffer.toString('base64');
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

/**
 * Decrypts a base64 encoded encrypted string.
 * If decryption fails or it's not encrypted, returns the input as-is or null.
 */
export function decrypt(encryptedBase64: string | null | undefined): string | null {
  if (!encryptedBase64) return null;

  if (!safeStorage.isEncryptionAvailable()) {
    return encryptedBase64;
  }

  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (err) {
    // If decryption fails, it might be plaintext (pre-migration)
    return encryptedBase64;
  }
}

/**
 * Checks if a string is likely encrypted with safeStorage (base64 and fails simple checks).
 * Actually, we'll use this primarily in migrations.
 */
export function isEncrypted(text: string | null | undefined): boolean {
  if (!text) return false;
  try {
    const buffer = Buffer.from(text, 'base64');
    safeStorage.decryptString(buffer);
    return true;
  } catch {
    return false;
  }
}
