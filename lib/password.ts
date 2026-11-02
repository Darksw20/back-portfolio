import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PASSWORD_ALGORITHM = "scrypt";
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 128;

type ParsedPasswordHash = {
  salt: Buffer;
  hash: Buffer;
};

function assertPasswordIsValid(password: string): void {
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (password.length < MIN_PASSWORD_LENGTH || passwordBytes > MAX_PASSWORD_BYTES) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} UTF-8 bytes.`
    );
  }
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      }
    );
  });
}

function parsePasswordHash(storedHash: string): ParsedPasswordHash | null {
  const [algorithm, n, r, p, salt, hash] = storedHash.split("$");
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    n !== String(SCRYPT_N) ||
    r !== String(SCRYPT_R) ||
    p !== String(SCRYPT_P) ||
    !salt ||
    !hash
  ) {
    return null;
  }

  try {
    const decodedSalt = Buffer.from(salt, "base64url");
    const decodedHash = Buffer.from(hash, "base64url");
    if (decodedSalt.length !== SALT_LENGTH || decodedHash.length !== KEY_LENGTH) {
      return null;
    }
    return { salt: decodedSalt, hash: decodedHash };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordIsValid(password);
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveKey(password, salt);
  return [
    PASSWORD_ALGORITHM,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return false;
  }

  const candidateHash = await deriveKey(password, parsed.salt);
  return timingSafeEqual(candidateHash, parsed.hash);
}
