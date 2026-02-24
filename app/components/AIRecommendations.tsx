'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Check } from 'lucide-react';

interface Recommendation {
  id: string;
  connection_id: string;
  title: string;
  description: string;
  table_name: string;
  schema_name: string;
  type: string;
  severity: number;
  sql_script?: string;
  is_resolved: boolean;
  created_at: string;
}

interface AIRecommendationsProps {
  connectionId?: string;
}

export default function AIRecommendations({ connectionId }: AIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecommendations = useCallback(async () => {
    if (!connectionId) return;
  
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/ai/recommendations?connectionId=${connectionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch recommendations');
      }
      
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (connectionId) {
      fetchRecommendations();
    }
  }, [connectionId, fetchRecommendations]);

  const analyzeDataQuality = async () => {
    if (!connectionId) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze data quality');
      }
      
      await fetchRecommendations();
    } catch (err: any) {
      setError(err.message || 'Failed to analyze data quality');
      console.error('Error analyzing data quality:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (id: string) => {
    try {
      const response = await fetch(`/api/ai/recommendations/${id}/resolve`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as resolved');
      }
      
      // Update the local state
      setRecommendations(prev => 
        prev.map(rec => rec.id === id ? { ...rec, is_resolved: true } : rec)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to mark as resolved');
    }
  };

  const getRecommendationColor = (type: string, severity: number) => {
    if (type === 'error' || severity === 3) {
      return 'border-red-500/30 bg-red-500/10';
    } else if (type === 'warning' || severity === 2) {
      return 'border-yellow-500/30 bg-yellow-500/10';
    } else {
      return 'border-blue-500/30 bg-blue-500/10';
    }
  };

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <div>
          <h2 className="card-title">AI Recommendations</h2>
          <p className="card-subtitle">Database improvement suggestions</p>
          {error && <p className="text-red-500 mt-1 text-sm">{error}</p>}
        </div>
        
        <button 
          onClick={analyzeDataQuality}
          className="btn-primary flex items-center gap-2"
          disabled={loading || !connectionId}
        >
          <RefreshCw className="w-4 h-4" />
          {loading ? 'Analyzing...' : 'Analyze Data Quality'}
        </button>
      </div>
      
      <div className="space-y-4 mt-6">
        {!connectionId ? (
          <div className="text-center py-6 text-slate-400">
            Select a database connection to view recommendations
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            {loading ? 'Loading recommendations...' : 'No recommendations found. Run an analysis to get started.'}
          </div>
        ) : (
          recommendations.map(rec => (
            <div 
              key={rec.id} 
              className={`p-4 rounded-lg border ${getRecommendationColor(rec.type, rec.severity)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      rec.severity === 3 ? 'bg-red-500/20 text-red-400' :
                      rec.severity === 2 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">
                      {rec.schema_name}.{rec.table_name}
                    </span>
                  </div>
                  <h3 className="font-medium text-white mt-2">{rec.title}</h3>
                  <p className="text-sm text-slate-300 mt-1">{rec.description}</p>
                  
                  {rec.sql_script && (
                    <div className="mt-3 p-2 bg-slate-800 rounded-lg">
                      <pre className="text-xs text-green-400 overflow-x-auto">
                        {rec.sql_script}
                      </pre>
                    </div>
                  )}
                </div>
                
                {!rec.is_resolved && (
                  <button
                    onClick={() => markAsResolved(rec.id)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Mark as Resolved"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {rec.is_resolved && (
                <div className="mt-2 text-xs text-green-400">
                  ✓ Resolved
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
