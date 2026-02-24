'use client';

export type AIProvider = 'openai' | 'gemini';

export interface AISettings {
  provider: AIProvider;
  openaiApiKey?: string;
  geminiApiKey?: string;
  openaiModel?: string;
  geminiModel?: string;
}

interface AISettingsProps {
  connectionId?: string;
  onSettingsChange?: (settings: AISettings) => void;
}

export default function AISettings({ connectionId, onSettingsChange }: AISettingsProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">AI Settings</h2>
        <p className="card-subtitle">Configure AI-powered analysis and recommendations</p>
      </div>
      <div className="space-y-6">
        <div className="space-y-4">
          <label className="flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer">
            <input type="checkbox" className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500" />
            <span className="text-slate-200 font-medium">Enable automated recommendations</span>
          </label>
          <label className="flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer">
            <input type="checkbox" className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500" />
            <span className="text-slate-200 font-medium">Send email notifications</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Analysis Frequency</label>
          <select className="input-field w-full">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {connectionId && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-sm text-emerald-300">Settings for connection: <span className="font-medium text-emerald-100">{connectionId}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
