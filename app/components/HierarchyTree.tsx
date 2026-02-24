'use client';

import { HierarchyNode } from '@/lib/workspace/views';

interface HierarchyTreeProps {
  nodes: HierarchyNode[];
}

function HierarchyNodeView({ node, depth }: { node: HierarchyNode; depth: number }) {
  const indent = Math.max(0, depth * 14);
  return (
    <div style={{ marginLeft: indent }}>
      <details className="group" open={depth < 1}>
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 py-1 text-sm text-slate-200 hover:text-white">
          <span>{node.label}</span>
          <span className="text-xs text-slate-400">{node.count}</span>
        </summary>
        {node.children.length > 0 && (
          <div className="pl-2 border-l border-slate-700/60 ml-1">
            {node.children.map((child) => (
              <HierarchyNodeView key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

export default function HierarchyTree({ nodes }: HierarchyTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center">
        Select hierarchy columns to build the hierarchical view.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <HierarchyNodeView key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
