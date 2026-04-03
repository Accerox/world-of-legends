import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'wol-secret-key-change-in-production'
const TOKEN_EXPIRY = '7d'

interface TokenPayload {
  accountId: string
}

/**
 * Sign a JWT token for the given account ID.
 */
export function signToken(accountId: string): string {
  return jwt.sign({ accountId } satisfies TokenPayload, SECRET, { expiresIn: TOKEN_EXPIRY })
}

/**
 * Verify a JWT token and return the payload, or null if invalid/expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as TokenPayload
    if (decoded && typeof decoded.accountId === 'string') {
      return decoded
    }
    return null
  } catch {
    return null
  }
}
