'use client';

import { Network, Database } from 'lucide-react';

interface KnowledgeGraphProps {
  connectionId?: string;
}

export default function KnowledgeGraph({ connectionId }: KnowledgeGraphProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Knowledge Graph</h2>
        <p className="card-subtitle">Visual representation of database relationships</p>
      </div>
      <div className="h-96 bg-slate-900/50 rounded-lg flex items-center justify-center border border-slate-700/50">
        {connectionId ? (
          <div className="text-center">
            <Network className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Knowledge Graph for connection: <span className="text-blue-400 font-medium">{connectionId}</span></p>
          </div>
        ) : (
          <div className="text-center">
            <Database className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Select a database connection to view Knowledge Graph</p>
          </div>
        )}
      </div>
    </div>
  );
}
