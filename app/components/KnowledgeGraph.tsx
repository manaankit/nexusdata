'use client';

import { useState, useEffect, useRef } from 'react';
import { Network, Database, RefreshCw } from 'lucide-react';
import cytoscape from 'cytoscape';

interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'column';
  metadata?: any;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'foreign_key' | 'relationship';
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface KnowledgeGraphProps {
  connectionId?: string;
}

export default function KnowledgeGraph({ connectionId }: KnowledgeGraphProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);
  const layoutInstance = useRef<cytoscape.Layouts | null>(null);

  const destroyGraph = () => {
    if (layoutInstance.current) {
      try {
        layoutInstance.current.stop();
      } catch (error) {
        console.warn('Unable to stop knowledge graph layout:', error);
      } finally {
        layoutInstance.current = null;
      }
    }

    if (cyInstance.current) {
      try {
        cyInstance.current.stop();
        cyInstance.current.elements().stop();
        cyInstance.current.destroy();
      } catch (error) {
        console.warn('Unable to destroy knowledge graph instance:', error);
      } finally {
        cyInstance.current = null;
      }
    }
  };
  
  // Set mounted state after component renders on client
  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  // Fetch graph data when connectionId changes
  useEffect(() => {
    if (connectionId && hasMounted) {
      fetchGraph();
    } else if (hasMounted) {
      // Clear graph if no connectionId
      setGraph(null);
      destroyGraph();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, hasMounted]);
  
  // Initialize or update Cytoscape when graph changes
  useEffect(() => {
    if (!hasMounted || !graph || !cyRef.current) return;
    destroyGraph();
    
    // Only initialize cytoscape on the client side
    if (typeof window !== 'undefined') {
      const cy = cytoscape({
        container: cyRef.current,
        elements: [
          // Convert nodes
          ...graph.nodes.map(node => ({
            data: { 
              id: node.id, 
              label: node.label,
              type: node.type,
              ...node.metadata
            }
          })),
          // Convert edges
          ...graph.edges.map(edge => ({
            data: { 
              id: edge.id, 
              source: edge.source, 
              target: edge.target,
              label: edge.label,
              type: edge.type
            }
          }))
        ],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#4299e1',
              'label': 'data(label)',
              'color': '#f7fafc',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px'
            }
          },
          {
            selector: 'node[type="table"]',
            style: {
              'background-color': '#3182ce',
              'shape': 'rectangle',
              'width': '120px',
              'height': '40px'
            }
          },
          {
            selector: 'node[type="column"]',
            style: {
              'background-color': '#63b3ed',
              'shape': 'ellipse',
              'width': '80px',
              'height': '30px'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#718096',
              'target-arrow-color': '#718096',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier'
            }
          },
          {
            selector: 'edge[type="foreign_key"]',
            style: {
              'line-color': '#f56565',
              'target-arrow-color': '#f56565'
            }
          },
          {
            selector: 'edge[type="relationship"]',
            style: {
              'line-color': '#f59e0b',
              'target-arrow-color': '#f59e0b',
              'line-style': 'dashed'
            }
          }
        ]
      });
      cyInstance.current = cy;

      layoutInstance.current = cy.layout({
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
        animate: false,
      });
      layoutInstance.current.run();
      
      // Add click event listener
      cy.on('tap', 'node', function(evt: any) {
        const node = evt.target;
        console.log('Clicked node:', node.id(), node.data());
      });
    }
    
    // Cleanup on unmount
    return () => {
      destroyGraph();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, hasMounted]);
  
  const fetchGraph = async () => {
    if (!connectionId) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/knowledge-graph/${connectionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch graph');
      }
      
      const data = await response.json();
      setGraph(data.graph);
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge graph');
      console.error('Error fetching knowledge graph:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <div>
          <h2 className="card-title">Knowledge Graph</h2>
          <p className="card-subtitle">Visual representation of explicit and inferred table relationships</p>
          {error && <p className="text-red-500 mt-1 text-sm">{error}</p>}
        </div>
        
        {connectionId && hasMounted && (
          <button 
            onClick={fetchGraph}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        )}
      </div>
      
      <div 
        ref={cyRef}
        className="h-96 bg-slate-900/50 rounded-lg flex items-center justify-center border border-slate-700/50"
      >
        {loading ? (
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading knowledge graph...</p>
          </div>
        ) : !connectionId ? (
          <div className="text-center">
            <Database className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Select a database connection to view Knowledge Graph</p>
          </div>
        ) : graph && graph.nodes.length === 0 ? (
          <div className="text-center">
            <Network className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No relationships found in this database</p>
            {hasMounted && (
              <button 
                onClick={fetchGraph}
                className="mt-4 px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30"
              >
                Refresh
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
