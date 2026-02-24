'use client';

import { useState, useEffect } from 'react';
import KnowledgeGraph from './KnowledgeGraph';
import DatabaseConfig from './DatabaseConfig';
import MetadataExplorer from './MetadataExplorer';
import AIRecommendations from './AIRecommendations';
import AISettings from './AISettings';
import WorkspaceStudio from './WorkspaceStudio';
import { Bot, Database, FolderKanban, Network, Settings } from 'lucide-react';

type ActiveTab = 'workspaces' | 'analyst' | 'knowledge' | 'recommendations' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | undefined>();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setActiveTab('workspaces');
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;

    const fetchActiveConnection = async () => {
      try {
        const response = await fetch('/api/database-connections?is_active=true');
        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload) || payload.length === 0) {
          return;
        }

        setActiveConnectionId(payload[0].id);
      } catch (error) {
        console.error('Failed to fetch active connection:', error);
      }
    };

    fetchActiveConnection();
  }, [hasMounted]);

  const handleConnectionChange = (connectionId: string) => {
    setActiveConnectionId(connectionId);
  };

  const tabs = [
    {
      id: 'workspaces' as const,
      name: 'Workspace Studio',
      icon: FolderKanban,
      component: <WorkspaceStudio />,
    },
    {
      id: 'analyst' as const,
      name: 'Analyst Workspace',
      icon: Database,
      component: (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <MetadataExplorer connectionId={activeConnectionId} />
          </div>
          <div>
            <DatabaseConfig
              connectionId={activeConnectionId}
              onConnectionChange={handleConnectionChange}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'knowledge' as const,
      name: 'Knowledge Graph',
      icon: Network,
      component: <KnowledgeGraph connectionId={activeConnectionId} />,
    },
    {
      id: 'recommendations' as const,
      name: 'AI Recommendations',
      icon: Bot,
      component: <AIRecommendations connectionId={activeConnectionId} />,
    },
    {
      id: 'settings' as const,
      name: 'AI Settings',
      icon: Settings,
      component: (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AISettings />
          <DatabaseConfig
            connectionId={activeConnectionId}
            onConnectionChange={handleConnectionChange}
          />
        </div>
      ),
    },
  ];

  const activeTabData = hasMounted ? tabs.find((tab) => tab.id === activeTab) : null;

  if (!hasMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-3 tracking-tight">
            Data Quality Dashboard
          </h1>
          <p className="text-slate-400 text-lg">
            Unified DQAnalyst + DQDashboard workspace for metadata, graphing, and AI recommendations
          </p>
        </div>

        <div className="clay-morph-sm p-4 mb-6">
          <p className="text-sm text-slate-300">
            Active Connection:{' '}
            <span className="text-slate-100 font-medium">
              {activeConnectionId || 'Not selected'}
            </span>
          </p>
        </div>

        <div className="clay-morph p-3 mb-8">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="transition-all duration-300">
          {activeTabData?.component}
        </div>
      </div>
    </div>
  );
}
