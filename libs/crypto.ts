import crypto from 'crypto';

// Get encryption key from environment variables or use a default (for development only)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'db_dashboard_default_encryption_key_32ch';

// Use a consistent algorithm
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a string value
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  try {
    // Create an initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM, 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
      iv
    );
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return '';
  }
}

/**
 * Decrypts an encrypted string value
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  try {
    // Split IV and encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
      iv
    );
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}
