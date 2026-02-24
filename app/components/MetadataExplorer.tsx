'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Download, RefreshCw, ScanSearch } from 'lucide-react';

interface ForeignKey {
  column_name: string;
  referenced_schema: string;
  referenced_table: string;
  referenced_column: string;
}

interface TableMetadata {
  id: string;
  connection_id: string;
  table_name: string;
  schema_name: string;
  column_count: number;
  row_count?: number;
  data_types: string[];
  constraints: string[];
  primary_key?: string;
  foreign_keys: ForeignKey[];
  nullable_columns: number;
  indexes: string[];
  created_at?: string;
  updated_at?: string;
}

interface MetadataExplorerProps {
  connectionId?: string;
}

export default function MetadataExplorer({ connectionId }: MetadataExplorerProps) {
  const [metadata, setMetadata] = useState<TableMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMetadata = useCallback(async () => {
    if (!connectionId) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/database/metadata/${connectionId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch metadata');
      }

      setMetadata(payload.metadata || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) {
      setMetadata([]);
      setError('');
      return;
    }

    fetchMetadata();
  }, [connectionId, fetchMetadata]);

  const extractMetadata = async () => {
    if (!connectionId) return;

    try {
      setExtracting(true);
      setError('');

      const response = await fetch(`/api/database/metadata/${connectionId}`, {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to extract metadata');
      }

      setMetadata(payload.metadata || []);
    } catch (err: any) {
      setError(err.message || 'Failed to extract metadata');
    } finally {
      setExtracting(false);
    }
  };

  const downloadSchemaReport = () => {
    if (!connectionId) return;
    window.open(`/api/database/metadata/${connectionId}/report`, '_blank');
  };

  const filteredMetadata = useMemo(() => {
    if (!searchTerm.trim()) {
      return metadata;
    }

    const normalized = searchTerm.toLowerCase();
    return metadata.filter((table) => {
      return (
        table.table_name.toLowerCase().includes(normalized) ||
        table.schema_name.toLowerCase().includes(normalized) ||
        table.data_types.some((type) => type.toLowerCase().includes(normalized))
      );
    });
  }, [metadata, searchTerm]);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Metadata Explorer</h2>
        <p className="card-subtitle">
          Extract table metadata, inspect schema health, and export analyst report
        </p>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      {!connectionId ? (
        <div className="text-center py-10 text-slate-400">
          <Database className="w-10 h-10 mx-auto mb-3" />
          Select an active database connection to inspect metadata.
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 mb-5">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="input-field flex-1"
              placeholder="Search by table, schema, or data type"
            />
            <button
              onClick={fetchMetadata}
              className="btn-secondary flex items-center justify-center gap-2"
              disabled={loading || extracting}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={extractMetadata}
              className="btn-primary flex items-center justify-center gap-2"
              disabled={loading || extracting}
            >
              <ScanSearch className="w-4 h-4" />
              {extracting ? 'Extracting...' : 'Extract Metadata'}
            </button>
            <button
              onClick={downloadSchemaReport}
              className="btn-success flex items-center justify-center gap-2"
              disabled={loading || extracting}
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          {loading ? (
            <p className="text-slate-400 py-6 text-center">Loading metadata...</p>
          ) : filteredMetadata.length === 0 ? (
            <div className="text-slate-400 py-8 text-center">
              No metadata found. Run extraction to build the analyst view.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMetadata.map((table) => (
                <div
                  key={table.id || `${table.schema_name}.${table.table_name}`}
                  className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-100">
                        {table.schema_name}.{table.table_name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Types: {table.data_types.join(', ') || 'N/A'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                        Columns: {table.column_count}
                      </span>
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300">
                        Rows: {table.row_count ?? 'Unknown'}
                      </span>
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                        FK: {table.foreign_keys.length}
                      </span>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                        Nullable: {table.nullable_columns}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
