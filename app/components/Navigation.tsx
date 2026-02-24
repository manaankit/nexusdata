'use client';

import { useState } from 'react';
import { Database, BarChart3, Settings, RefreshCw, GitMerge } from 'lucide-react';

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Navigation({ activeView, onViewChange }: NavigationProps) {
  const navItems = [
    { id: 'metadata', label: 'Table Metadata', icon: Database },
    { id: 'knowledge-graph', label: 'Knowledge Graph', icon: GitMerge },
    { id: 'recommendations', label: 'AI Recommendations', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="clay-morph p-3">
      <nav className="flex flex-wrap gap-2">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeView === item.id
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
