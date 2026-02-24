'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, RefreshCw } from 'lucide-react';

interface AISettingsProps {
  onSettingsChange?: () => void;
}

interface AISettings {
  id?: string;
  provider: 'openai' | 'gemini';
  openai_api_key?: string;
  openai_model?: string;
  gemini_api_key?: string;
  gemini_model?: string;
}

export default function AISettings({ onSettingsChange }: AISettingsProps) {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'openai',
    openai_model: 'gpt-4o',
    gemini_model: 'gemini-1.5-pro'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showKeys, setShowKeys] = useState({
    openai: false,
    gemini: false
  });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      fetchSettings();
    }
  }, [hasMounted]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/settings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI settings');
      }
      
      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      
      const data = await response.json();
      setSettings(data);
      setSuccess('Settings saved successfully');
      
      if (onSettingsChange) {
        onSettingsChange();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowKey = (provider: 'openai' | 'gemini') => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  if (!hasMounted) {
    return null; // Or a simple loading placeholder
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">AI Configuration</h2>
        <p className="card-subtitle">Configure AI settings for recommendations</p>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        {success && <p className="text-green-500 mt-2 text-sm">{success}</p>}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">AI Provider</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value="openai"
                checked={settings.provider === 'openai'}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-slate-300">OpenAI</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value="gemini"
                checked={settings.provider === 'gemini'}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-slate-300">Gemini</span>
            </label>
          </div>
        </div>
        
        {settings.provider === 'openai' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">OpenAI API Key</label>
              <div className="flex">
                <input
                  type={showKeys.openai ? "text" : "password"}
                  name="openai_api_key"
                  value={settings.openai_api_key || ''}
                  onChange={handleInputChange}
                  className="input-field flex-1"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('openai')}
                  className="ml-2 p-2 bg-slate-800 text-slate-300 rounded-md"
                >
                  {showKeys.openai ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Your API key is stored securely and never shared.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">OpenAI Model</label>
              <select
                name="openai_model"
                value={settings.openai_model || 'gpt-4o'}
                onChange={handleInputChange}
                className="input-field w-full"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
          </>
        )}
        
        {settings.provider === 'gemini' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gemini API Key</label>
              <div className="flex">
                <input
                  type={showKeys.gemini ? "text" : "password"}
                  name="gemini_api_key"
                  value={settings.gemini_api_key || ''}
                  onChange={handleInputChange}
                  className="input-field flex-1"
                  placeholder="Enter your Gemini API Key"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('gemini')}
                  className="ml-2 p-2 bg-slate-800 text-slate-300 rounded-md"
                >
                  {showKeys.gemini ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Your API key is stored securely and never shared.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gemini Model</label>
              <select
                name="gemini_model"
                value={settings.gemini_model || 'gemini-1.5-pro'}
                onChange={handleInputChange}
                className="input-field w-full"
              >
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
              </select>
            </div>
          </>
        )}
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={fetchSettings}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
