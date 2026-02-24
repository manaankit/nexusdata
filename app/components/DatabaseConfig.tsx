'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Plus, TestTube, Trash2, Edit, X, RefreshCw } from 'lucide-react';

interface DatabaseConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password?: string;
  schema_name: string;
  system_type?: string;
  data_source?: string;
  status?: string;
  is_active?: boolean;
}

interface DatabaseConfigProps {
  connectionId?: string;
  onConnectionChange?: (connectionId: string) => void;
}

export default function DatabaseConfig({ connectionId, onConnectionChange }: DatabaseConfigProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 5432,
    database_name: '',
    username: '',
    password: '',
    schema_name: 'public',
    system_type: 'PostgreSQL',
    data_source: 'Production'
  });
  const [error, setError] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/database-connections');
      const data = await response.json();
      const connectionList = Array.isArray(data) ? data : [];
      setConnections(connectionList);

      const active = connectionList.find((connection) => connection.is_active);
      if (active && onConnectionChange) {
        onConnectionChange(active.id);
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
      setError('Failed to load database connections');
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    if (hasMounted) {
      fetchConnections();
    }
  }, [hasMounted, fetchConnections]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const method = editingConnection ? 'PUT' : 'POST';
      const url = editingConnection
        ? `/api/database-connections/${editingConnection.id}`
        : '/api/database-connections';

      const payload = editingConnection
        ? { ...formData, id: editingConnection.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save connection');
      }

      await fetchConnections();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleTestConnection = async (id?: string) => {
    try {
      setLoading(true);
      setError('');
      const connectionId = id || editingConnection?.id;

      if (!connectionId && !formData.host) {
        throw new Error('Please provide connection details first');
      }

      const url = connectionId
        ? `/api/database-connections/${connectionId}/test`
        : '/api/ai/test-connection';

      const payload = connectionId ? {} : formData;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in and try again.');
        }
        throw new Error(data.error || 'Connection test failed');
      }

      alert('Connection successful!');
    } catch (err: any) {
      console.error('Test connection error:', err);
      setError(err.message || 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (connection: DatabaseConnection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      database_name: connection.database_name,
      username: connection.username,
      password: connection.password || '',
      schema_name: connection.schema_name,
      system_type: connection.system_type || 'PostgreSQL',
      data_source: connection.data_source || 'Production'
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const response = await fetch(`/api/database-connections/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete connection');
      }

      await fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to delete connection');
    }
  };

  const resetForm = () => {
    setEditingConnection(null);
    setFormData({
      name: '',
      host: '',
      port: 5432,
      database_name: '',
      username: '',
      password: '',
      schema_name: 'public',
      system_type: 'PostgreSQL',
      data_source: 'Production'
    });
    setShowModal(false);
  };

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/database-connections/${id}/activate`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate connection');
      }

      await fetchConnections();
      if (onConnectionChange) onConnectionChange(id);
    } catch (err: any) {
      setError(err.message || 'Failed to activate connection');
    }
  };

  if (!hasMounted) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Database Configuration</h2>
        <p className="card-subtitle">Configure and manage database connections</p>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      <div className="flex justify-between mb-4">
        <button
          onClick={() => fetchConnections()}
          className="btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      <div className="space-y-4 mt-6">
        {loading ? (
          <div className="text-center py-6 text-slate-400">
            Loading connections...
          </div>
        ) : Array.isArray(connections) && connections.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            No database connections found. Add one to get started.
          </div>
        ) : Array.isArray(connections) ? (
          connections.map(conn => (
            <div
              key={conn.id}
              className={`p-4 rounded-lg border ${conn.is_active ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800 border-slate-700'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-white">{conn.name}</h3>
                  <p className="text-sm text-slate-300">
                    {conn.system_type || 'PostgreSQL'} • {conn.data_source || 'Production'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{conn.host}:{conn.port}/{conn.database_name}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${conn.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        conn.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                      }`}>
                      {conn.status || 'Unknown'}
                    </span>
                    {conn.is_active && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestConnection(conn.id)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Test Connection"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(conn)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                {!conn.is_active && (
                  <button
                    onClick={() => handleActivate(conn.id)}
                    className="text-xs px-3 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                  >
                    Set as Active
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-red-400">
            Error loading connections. Please try again.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-white">
                {editingConnection ? 'Edit Connection' : 'Add New Connection'}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Connection Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">System Type</label>
                  <select
                    name="system_type"
                    value={formData.system_type}
                    onChange={(e: any) => handleInputChange(e)}
                    className="input-field w-full"
                  >
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="SQL Server">SQL Server</option>
                    <option value="Snowflake">Snowflake</option>
                    <option value="Oracle">Oracle</option>
                    <option value="MongoDB">MongoDB</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Data Source</label>
                  <select
                    name="data_source"
                    value={formData.data_source}
                    onChange={(e: any) => handleInputChange(e)}
                    className="input-field w-full"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Archive">Archive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Host</label>
                  <input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleInputChange}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Database Name</label>
                <input
                  type="text"
                  name="database_name"
                  value={formData.database_name}
                  onChange={handleInputChange}
                  className="input-field w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="input-field w-full"
                    required={!editingConnection}
                    placeholder={editingConnection ? '••••••••' : ''}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Schema</label>
                <input
                  type="text"
                  name="schema_name"
                  value={formData.schema_name}
                  onChange={handleInputChange}
                  className="input-field w-full"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Test Connection
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingConnection ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
