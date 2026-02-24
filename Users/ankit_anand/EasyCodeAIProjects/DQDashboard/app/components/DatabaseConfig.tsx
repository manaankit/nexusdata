'use client';

import { Database, Plus, TestTube } from 'lucide-react';

interface DatabaseConfigProps {
  connectionId?: string;
  onConnectionChange?: (connectionId: string) => void;
}

export default function DatabaseConfig({ connectionId, onConnectionChange }: DatabaseConfigProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Database Configuration</h2>
        <p className="card-subtitle">Configure and manage database connections</p>
      </div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Connection String</label>
          <input 
            type="text" 
            className="input-field w-full"
            placeholder="postgresql://username:password@host:port/database"
          />
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Test Connection
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Connection
          </button>
        </div>
        {connectionId && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300">Active connection: <span className="font-medium text-blue-100">{connectionId}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
