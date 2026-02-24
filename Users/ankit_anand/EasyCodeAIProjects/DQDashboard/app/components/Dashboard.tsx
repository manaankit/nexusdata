'use client';

import { useState } from 'react';
import KnowledgeGraph from './KnowledgeGraph';
import DatabaseConfig from './DatabaseConfig';
import AIRecommendations from './AIRecommendations';
import AISettings from './AISettings';
import { BarChart3, Database, Bot, Settings } from 'lucide-react';

type ActiveTab = 'overview' | 'database' | 'recommendations' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [activeConnectionId, setActiveConnectionId] = useState<string | undefined>();

  const handleConnectionChange = (connectionId: string) => {
    setActiveConnectionId(connectionId);
  };

  const tabs = [
    {
      id: 'overview' as const,
      name: 'Knowledge Graph',
      icon: BarChart3,
      component: <KnowledgeGraph connectionId={activeConnectionId} />
    },
    {
      id: 'database' as const,
      name: 'Database Config',
      icon: Database,
      component: <DatabaseConfig onConnectionChange={handleConnectionChange} />
    },
    {
      id: 'recommendations' as const,
      name: 'AI Recommendations',
      icon: Bot,
      component: <AIRecommendations connectionId={activeConnectionId} />
    },
    {
      id: 'settings' as const,
      name: 'AI Settings',
      icon: Settings,
      component: <AISettings />
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Data Quality Dashboard
          </h1>
          <p className="text-white/60">
            AI-powered database analysis and recommendations
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="clay-morph p-2 mb-8">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="transition-all duration-300">
          {activeTabData?.component}
        </div>
      </div>
    </div>
  );
}
