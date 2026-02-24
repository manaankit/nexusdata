'use client';

import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Network } from 'lucide-react';
import { Workspace } from '@/types/workspace';
import { buildWorkspaceGraph } from '@/lib/workspace/graph';

interface WorkspaceKnowledgeGraphProps {
  workspace?: Workspace;
}

export default function WorkspaceKnowledgeGraph({ workspace }: WorkspaceKnowledgeGraphProps) {
  const graph = useMemo(() => (workspace ? buildWorkspaceGraph(workspace) : null), [workspace]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutRef = useRef<cytoscape.Layouts | null>(null);

  const teardownGraph = () => {
    if (layoutRef.current) {
      try {
        layoutRef.current.stop();
      } catch (error) {
        console.warn('Unable to stop workspace graph layout:', error);
      } finally {
        layoutRef.current = null;
      }
    }

    if (cyRef.current) {
      try {
        cyRef.current.stop();
        cyRef.current.elements().stop();
        cyRef.current.destroy();
      } catch (error) {
        console.warn('Unable to destroy workspace graph instance:', error);
      } finally {
        cyRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    teardownGraph();

    if (!graph || graph.nodes.length === 0) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
          },
        })),
        ...graph.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: edge.type,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#f1f5f9',
            'font-size': '10px',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'text-valign': 'center',
            'text-halign': 'center',
          },
        },
        {
          selector: 'node[type="dataset"]',
          style: {
            'background-color': '#2563eb',
            shape: 'round-rectangle',
            width: 150,
            height: 48,
          },
        },
        {
          selector: 'node[type="column"]',
          style: {
            'background-color': '#0ea5e9',
            shape: 'ellipse',
            width: 110,
            height: 36,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'curve-style': 'bezier',
            'line-color': '#64748b',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            label: 'data(label)',
            color: '#94a3b8',
            'font-size': '8px',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge[type="contains"]',
          style: {
            'line-style': 'solid',
            'line-color': '#475569',
            'target-arrow-color': '#475569',
          },
        },
        {
          selector: 'edge[type="inferred_fk"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
          },
        },
        {
          selector: 'edge[type="shared_field"]',
          style: {
            'line-style': 'dotted',
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e',
          },
        },
      ],
    });
    cyRef.current = cy;

    // Run layout explicitly so cleanup can stop any active layout before unmount/re-render.
    layoutRef.current = cy.layout({
      name: 'cose',
      animate: false,
      fit: true,
      padding: 30,
    });
    layoutRef.current.run();

    return () => {
      teardownGraph();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  if (!workspace || !graph || graph.nodes.length === 0) {
    return (
      <div className="h-[520px] rounded-lg border border-slate-700/60 bg-slate-900/40 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Network className="w-10 h-10 mx-auto mb-3 text-slate-500" />
          Import datasets into this workspace to generate the graph layout.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[520px] rounded-lg border border-slate-700/60 bg-slate-900/40" />;
}
