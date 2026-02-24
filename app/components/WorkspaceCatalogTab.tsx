'use client';

import { useState } from 'react';
import { Workspace } from '@/types/workspace';
import { Database, BookA, Network, Package, FileText, BadgeCheck, Search, RefreshCw } from 'lucide-react';

interface WorkspaceCatalogTabProps {
    workspace: Workspace;
    onGenerateReport?: () => void;
}

type CatalogSection = 'sources' | 'glossary' | 'reports' | 'erds' | 'products' | 'badges' | 'metadata';

const SECTIONS: { id: CatalogSection; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'sources', label: 'Data Sources', icon: Database, description: 'View and manage all active database, API, and file sources connected to this catalog.' },
    { id: 'glossary', label: 'Glossary', icon: BookA, description: 'Standardized terminology and business definitions applied across data assets.' },
    { id: 'reports', label: 'Report Catalog', icon: FileText, description: 'Discover and subscribe to pre-built analytical reports and custom dashboards.' },
    { id: 'erds', label: 'Entity Relationship Diagrams', icon: Network, description: 'Visualize database schematics, foreign keys, and referential constraints.' },
    { id: 'products', label: 'Data Products', icon: Package, description: 'Curated, ready-to-use tabular/API products optimized for business consumption.' },
    { id: 'badges', label: 'Badges', icon: BadgeCheck, description: 'Highlight priority, sensitive, or certified datasets via dynamic visual tags.' },
    { id: 'metadata', label: 'Documenting Metadata', icon: Search, description: 'Annotations, aliases, tags, and lifecycle states for catalog components.' },
];

export default function WorkspaceCatalogTab({ workspace, onGenerateReport }: WorkspaceCatalogTabProps) {
    const [activeSection, setActiveSection] = useState<CatalogSection>('sources');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDatasetForMetadata, setSelectedDatasetForMetadata] = useState('');
    const [isScanningMetadata, setIsScanningMetadata] = useState(false);
    const [scannedMetadata, setScannedMetadata] = useState<any>(null);

    const handleMetadataScan = async (datasetId: string) => {
        setIsScanningMetadata(true);
        // Simulate a metadata scan with a timeout
        setTimeout(() => {
            const dataset = workspace.datasets.find(d => d.id === datasetId);
            if (dataset) {
                setScannedMetadata(dataset);
            }
            setIsScanningMetadata(false);
        }, 800);
    };

    const renderSectionContent = () => {
        switch (activeSection) {
            case 'sources':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Data Sources in Catalog</h3>
                        {workspace.datasets.length === 0 ? (
                            <p className="text-xs text-slate-400">No data sources connected currently.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {workspace.datasets.map((dataset) => (
                                    <div key={dataset.id} className="p-3 rounded border border-slate-700 bg-slate-800">
                                        <p className="text-sm font-medium text-slate-100">{dataset.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{dataset.format?.toUpperCase() || 'UNKNOWN'} format • {dataset.rowCount} rows</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'glossary':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Business Glossary</h3>
                        <p className="text-xs text-slate-400">Standardized domain vocabulary prevents misunderstanding.</p>
                        <div className="overflow-x-auto rounded border border-slate-700 mt-2 text-xs">
                            <table className="min-w-full">
                                <thead className="bg-slate-800">
                                    <tr>
                                        <th className="text-left p-2 text-slate-300">Term</th>
                                        <th className="text-left p-2 text-slate-300">Definition</th>
                                        <th className="text-left p-2 text-slate-300">Steward</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-[1px] border-slate-700/60 p-2 text-slate-300"><td className="p-2">Client UID</td><td className="p-2">Globally unique identifier for customer accounts.</td><td className="p-2">Data Governance Guild</td></tr>
                                    <tr className="border-[1px] border-slate-700/60 p-2 text-slate-300"><td className="p-2">Active MRR</td><td className="p-2">Monthly recurring revenue from currently subscribed active user accounts.</td><td className="p-2">Finance Dept</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'reports':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Report Catalog</h3>
                        <p className="text-xs text-slate-400">Manage and access curated reports created for {workspace.name}.</p>
                        <div className="p-4 rounded border border-slate-700 bg-slate-800 flex flex-col gap-2">
                            <p className="text-sm text-slate-300">No custom reports generated yet.</p>
                            <button
                                onClick={onGenerateReport}
                                className="px-3 py-1.5 self-start text-xs rounded bg-blue-600 hover:bg-blue-500 text-white"
                            >
                                Generate Quality Report
                            </button>
                        </div>
                    </div>
                );
            case 'erds':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Entity Relationship Diagrams</h3>
                        <p className="text-xs text-slate-400">Visualize structural layout, relationships, and join keys inferred from workspace datasets.</p>
                        <div className="p-10 rounded border border-dashed border-slate-600 text-center flex flex-col items-center gap-2">
                            <Network className="w-8 h-8 text-slate-500" />
                            <p className="text-slate-300 text-sm">Entity diagrams are derived automatically when relationships are discovered in the Data Profiling phase.</p>
                        </div>
                    </div>
                );
            case 'products':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Data Products</h3>
                        <p className="text-xs text-slate-400">Packaging catalog artifacts into robust internal/external consumable products.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="p-3 rounded border border-cyan-800 bg-slate-900 border-l-4 border-l-cyan-500">
                                <p className="text-sm font-medium text-slate-200">Core References</p>
                                <p className="text-[11px] text-slate-400 mt-1">Domain dictionaries and country mapping lists.</p>
                                <span className="mt-2 inline-block px-1.5 py-0.5 rounded bg-amber-900/40 text-[10px] text-amber-200">Needs Certification</span>
                            </div>
                        </div>
                    </div>
                );
            case 'badges':
                return (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-200">Catalog Badges</h3>
                        <p className="text-xs text-slate-400">Badges communicate trust, SLA guarantees, and compliance states.</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1.5 rounded-full border border-emerald-700 bg-emerald-900/30 text-emerald-300 text-xs font-medium flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> Gold Certified</span>
                            <span className="px-3 py-1.5 rounded-full border border-red-700 bg-red-900/30 text-red-300 text-xs font-medium flex items-center gap-1">PII Sensitive</span>
                            <span className="px-3 py-1.5 rounded-full border border-blue-700 bg-blue-900/30 text-blue-300 text-xs font-medium flex items-center gap-1">High Volume</span>
                        </div>
                    </div>
                );
            case 'metadata':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-slate-200">Documenting Metadata</h3>
                                <p className="text-xs text-slate-400">Enrich tables/columns with descriptions, ownership, tags, and lifecycle notes.</p>
                            </div>
                        </div>
                        <div className="p-4 rounded border border-slate-700 bg-slate-800">
                            <p className="text-xs text-slate-300 mb-2">Select a dataset to begin annotating:</p>
                            <div className="flex items-center gap-2">
                                <select
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                                    value={selectedDatasetForMetadata}
                                    onChange={(e) => setSelectedDatasetForMetadata(e.target.value)}
                                >
                                    <option value="">-- Choose source --</option>
                                    {workspace.datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <button
                                    disabled={!selectedDatasetForMetadata || isScanningMetadata}
                                    onClick={() => handleMetadataScan(selectedDatasetForMetadata)}
                                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                                >
                                    {isScanningMetadata ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    {isScanningMetadata ? 'Scanning...' : 'Run Metadata Scan'}
                                </button>
                            </div>
                        </div>

                        {scannedMetadata && scannedMetadata.id === selectedDatasetForMetadata && (
                            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70 mt-4 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-medium text-slate-100">{scannedMetadata.name}</h3>
                                        <p className="text-sm text-slate-400 mt-1">
                                            Types: {Array.from(new Set(scannedMetadata.columns.map((c: string) => 'String'))).join(', ')}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                                            Columns: {scannedMetadata.columns.length}
                                        </span>
                                        <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300">
                                            Rows: {scannedMetadata.records.length}
                                        </span>
                                        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                                            Source: {scannedMetadata.format}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-slate-700/60 pt-4">
                                    <table className="min-w-full text-xs text-left">
                                        <thead className="bg-slate-900/50">
                                            <tr>
                                                <th className="p-2 text-slate-300 font-medium">Column Name</th>
                                                <th className="p-2 text-slate-300 font-medium">Description (Editable)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scannedMetadata.columns.map((col: string) => (
                                                <tr key={col} className="border-t border-slate-700/60">
                                                    <td className="p-2 text-slate-200">{col}</td>
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Add description..."
                                                            className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none focus:border-cyan-500"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Sidebar navigation */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col space-y-1">
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search catalog..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 border-slate-700 border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
                    />
                </div>

                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded text-left transition-colors cursor-pointer ${isActive
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium">{section.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content area */}
            <div className="flex-1 min-w-0 bg-slate-900/50 border border-slate-700/70 rounded-lg p-5">
                <div className="mb-6 pb-4 border-b border-slate-700/50">
                    <h2 className="text-lg font-semibold text-slate-100 mb-1 flex items-center gap-2">
                        {SECTIONS.find(s => s.id === activeSection)?.icon && (() => {
                            const Icon = SECTIONS.find(s => s.id === activeSection)!.icon;
                            return <Icon className="w-5 h-5 text-cyan-400" />;
                        })()}
                        {SECTIONS.find(s => s.id === activeSection)?.label}
                    </h2>
                    <p className="text-sm text-slate-400">
                        {SECTIONS.find(s => s.id === activeSection)?.description}
                    </p>
                </div>

                <div className="pb-8">
                    {renderSectionContent()}
                </div>
            </div>
        </div>
    );
}
