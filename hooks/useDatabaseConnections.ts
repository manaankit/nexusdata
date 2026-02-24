'use client'

import { useState, useEffect } from 'react'
import { DatabaseConnection } from '@/types/database'

export function useDatabaseConnections() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/database-connections')
      
      if (!response.ok) {
        throw new Error('Failed to fetch connections')
      }
      
      const data = await response.json()
      setConnections(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createConnection = async (connection: Omit<DatabaseConnection, 'id' | 'created_at' | 'updated_at' | 'last_tested' | 'status' | 'test_result'>) => {
    try {
      const response = await fetch('/api/database-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connection),
      })

      if (!response.ok) {
        throw new Error('Failed to create connection')
      }

      const newConnection = await response.json()
      setConnections(prev => [newConnection, ...prev])
      return newConnection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  const updateConnection = async (id: string, updates: Partial<DatabaseConnection>) => {
    try {
      const response = await fetch(`/api/database-connections/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update connection')
      }

      const updatedConnection = await response.json()
      setConnections(prev => 
        prev.map(conn => conn.id === id ? updatedConnection : conn)
      )
      return updatedConnection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  const deleteConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/database-connections/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete connection')
      }

      setConnections(prev => prev.filter(conn => conn.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  const testConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/database-connections/${id}/test`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to test connection')
      }

      const result = await response.json()
      // Refresh connections to get updated status
      fetchConnections()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  return {
    connections,
    loading,
    error,
    fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
  }
}
