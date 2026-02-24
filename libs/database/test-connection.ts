import { Client } from 'pg'
import { DatabaseConnection } from '@/types/database'

export async function testDatabaseConnection(connection: DatabaseConnection) {
  const client = new Client({
    host: connection.host,
    port: connection.port,
    database: connection.database_name,
    user: connection.username,
    password: connection.password_encrypted, // This should be decrypted
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    return { success: true, message: 'Connection successful' }
  } catch (error: any) {
    await client.end().catch(() => {})
    return { success: false, message: error.message }
  }
}
