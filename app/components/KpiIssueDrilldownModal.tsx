'use client';

import { useState, useMemo } from 'react';
import { ImportedDataset } from '@/types/workspace';
import { X, TableProperties, AlertCircle, Download } from 'lucide-react';

function downloadText(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

interface KpiIssueDrilldownModalProps {
    helpId: string;
    scope: 'workspace' | 'dataset';
    datasets: ImportedDataset[];
    activeDatasetId?: string;
    onClose: () => void;
}

export default function KpiIssueDrilldownModal({
    helpId,
    scope,
    datasets,
    activeDatasetId,
    onClose,
}: KpiIssueDrilldownModalProps) {
    const targetDatasets = scope === 'dataset' && activeDatasetId
        ? datasets.filter(d => d.id === activeDatasetId)
        : datasets;

    const problematicRecords = useMemo(() => {
        let results: { datasetName: string; row: Record<string, unknown>; reason: string }[] = [];

        // Depending on helpId, we filter the rows differently
        targetDatasets.forEach(dataset => {
            const rows = dataset.records || [];
            const columns = dataset.columns || [];

            if (helpId === 'empty_values' || helpId === 'completeness') {
                rows.forEach(row => {
                    const emptyCols = columns.filter(col => row[col] === null || row[col] === undefined || String(row[col]).trim() === '');
                    if (emptyCols.length > 0) {
                        results.push({ datasetName: dataset.name, row, reason: `Empty in: ${emptyCols.join(', ')}` });
                    }
                });
            }
            else if (helpId === 'duplication' || helpId === 'uniqueness') {
                const seen = new Set<string>();
                rows.forEach(row => {
                    const serialized = JSON.stringify(row);
                    if (seen.has(serialized)) {
                        results.push({ datasetName: dataset.name, row, reason: 'Duplicate Record' });
                    } else {
                        seen.add(serialized);
                    }
                });
            }
            else if (helpId === 'email_bounce_rates') {
                const emailCols = columns.filter(col => col.toLowerCase().includes('email'));
                const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                rows.forEach(row => {
                    const invalidEmails = emailCols.filter(col => {
                        const val = row[col];
                        if (!val || String(val).trim() === '') return false;
                        return !EMAIL_REGEX.test(String(val).trim().toLowerCase());
                    });
                    if (invalidEmails.length > 0) {
                        results.push({ datasetName: dataset.name, row, reason: `Invalid email format in: ${invalidEmails.join(', ')}` });
                    }
                });
            }
            else if (helpId === 'transformation_errors') {
                // Generic approximation for rows that fail semantic business checks or have completely unparseable formats 
                rows.forEach(row => {
                    const invalidBizCols = columns.filter(col => {
                        const colLower = col.toLowerCase();
                        const text = String(row[col] ?? '').trim();
                        if (!text) return false;
                        if ((colLower.includes('amount') || colLower.includes('price')) && isNaN(Number(text))) return true;
                        return false;
                    });
                    if (invalidBizCols.length > 0) {
                        results.push({ datasetName: dataset.name, row, reason: `Format mismatch in: ${invalidBizCols.join(', ')}` });
                    }
                });
            }
        });

        return results.slice(0, 100); // Limit to 100 to avoid UI freeze
    }, [helpId, targetDatasets]);

    const exportReport = () => {
        if (problematicRecords.length === 0) return;

        // Collect all unique headers across all datasets in the results
        const headerSet = new Set<string>();
        problematicRecords.forEach(record => {
            Object.keys(record.row).forEach(key => headerSet.add(key));
        });
        const headers = Array.from(headerSet);

        // Build CSV string
        const csvRows = [];
        // Header row
        csvRows.push(['Dataset', 'Issue Description', ...headers].map(h => `"${h}"`).join(','));

        // Data rows
        problematicRecords.forEach(record => {
            const rowData = headers.map(h => {
                const val = record.row[h];
                return val !== undefined && val !== null ? `"${String(val).replace(/"/g, '""')}"` : '""';
            });
            csvRows.push([
                `"${record.datasetName}"`,
                `"${record.reason}"`,
                ...rowData
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        const filename = `dq-issue-${helpId}-${new Date().toISOString().slice(0, 10)}.csv`;
        downloadText(filename, csvContent, 'text/csv');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Issue Drilldown: {helpId.replace(/_/g, ' ')}</h3>
                            <p className="text-sm text-slate-400">Showing top {problematicRecords.length} problematic records</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {problematicRecords.length > 0 && (
                            <button
                                onClick={exportReport}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-slate-950/50">
                    {problematicRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <TableProperties className="w-12 h-12 mb-4 opacity-20" />
                            <p>No specific records could be isolated for this KPI issue.</p>
                            <p className="text-xs mt-1">(Only certain KPI rules support row-level drilldown)</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(
                                problematicRecords.reduce((acc, current) => {
                                    const dsName = current.datasetName || 'Unknown Dataset';
                                    if (!acc[dsName]) acc[dsName] = [];
                                    acc[dsName].push(current);
                                    return acc;
                                }, {} as Record<string, typeof problematicRecords>)
                            ).map(([dsName, records]) => {
                                const sampleRow = records[0]?.row;
                                if (!sampleRow) return null;
                                const headers = Object.keys(sampleRow);
                                return (
                                    <div key={dsName} className="border border-slate-700/50 rounded-lg overflow-hidden">
                                        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex justify-between">
                                            <h4 className="font-medium text-slate-200">{dsName}</h4>
                                            <span className="text-xs text-rose-400 font-medium">{records.length} issues</span>
                                        </div>
                                        <div className="overflow-x-auto max-h-[400px]">
                                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                                <thead className="bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                                                    <tr>
                                                        <th className="p-3 text-slate-300 font-medium border-b border-slate-700 border-r w-48 bg-rose-500/10 text-rose-300">Issue Description</th>
                                                        {headers.map((h, i) => (
                                                            <th key={i} className="p-3 text-slate-300 font-medium border-b border-slate-700">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-700/50">
                                                    {records.map((rec, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-3 text-rose-300 bg-rose-500/5 font-medium border-r border-slate-700/50">{rec.reason}</td>
                                                            {headers.map((h, cIdx) => (
                                                                <td key={cIdx} className="p-3 text-slate-400">{String(rec.row[h] ?? '')}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
