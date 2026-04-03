/**
 * Cloudflare D1 HTTP API client.
 * Allows the Node.js server (running in k3s) to query D1 remotely.
 */

const ACCOUNT_ID = 'e26bfe18bfa6df2cb533f24129d433ba'
const DATABASE_ID = '7d9ef15d-e02f-4bca-802f-c902cce3a91b'
const API_TOKEN = process.env.CF_API_TOKEN || 'eo7mYZSawspjLw8LZFyhnVAcQONSDOkc1YslDp8S'

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`

interface D1Result {
  results: Record<string, unknown>[]
  success: boolean
  meta: { changes: number; last_row_id: number; rows_read: number; rows_written: number }
}

interface D1Response {
  result: D1Result[]
  success: boolean
  errors: { message: string }[]
}

export async function d1Query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })

  const data = await res.json() as D1Response

  if (!data.success) {
    const errMsg = data.errors?.[0]?.message || 'D1 query failed'
    throw new Error(`D1 Error: ${errMsg}`)
  }

  return data.result?.[0]?.results || []
}

export async function d1Execute(sql: string, params: unknown[] = []): Promise<{ changes: number; lastRowId: number }> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })

  const data = await res.json() as D1Response

  if (!data.success) {
    const errMsg = data.errors?.[0]?.message || 'D1 execute failed'
    throw new Error(`D1 Error: ${errMsg}`)
  }

  const meta = data.result?.[0]?.meta || { changes: 0, last_row_id: 0 }
  return { changes: meta.changes, lastRowId: meta.last_row_id }
}
