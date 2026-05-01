import { useState, useEffect } from 'react';
import type { Profile } from '../types';
import { 
  Plus, 
  Trash2, 
  Globe, 
  Layers, 
  Search, 
  ChevronRight,
  Database,
  Play,
  Save,
  X,
  Code,
  Terminal,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

export function ProfileManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Execution Modal State
  const [execTarget, setExecTarget] = useState<{profile: Profile, pageId: string} | null>(null);
  const [execJson, setExecJson] = useState<string>('');
  const [execUrlTemplate, setExecUrlTemplate] = useState<string>('');
  const [execQuery, setExecQuery] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (execTarget) {
      const page = execTarget.profile.pages?.find((p: any) => p.id === execTarget.pageId);
      if (page) {
        setExecJson(JSON.stringify(page.items || [], null, 2));
        setExecUrlTemplate(page.url || '');
        setJsonError('');
      }
    }
  }, [execTarget]);

  const execParamsList = execUrlTemplate 
    ? Array.from(new Set(Array.from(execUrlTemplate.matchAll(/\{+([^}]+)\}+/g)).map((m: any) => m[1])))
    : [];

  const handleUpdateCheckpont = async () => {
    if (!execTarget) return;
    try {
      const parsed = JSON.parse(execJson);
      const updatedProfile = { ...execTarget.profile };
      const pageIndex = updatedProfile.pages.findIndex(p => p.id === execTarget.pageId);
      if (pageIndex > -1) {
        updatedProfile.pages[pageIndex].items = parsed;
        updatedProfile.pages[pageIndex].url = execUrlTemplate;
        
        const res = await fetch(`/api/v1/profiles/${updatedProfile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfile)
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: 'Update failed' }));
            throw new Error(errData.detail || 'Update failed');
        }

        setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? updatedProfile : p));
        alert('Profile Schema Checkpointed Successfully!');
      }
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON syntax");
    }
  };

  const handleRunFlight = () => {
    if (!execTarget) return;
    try {
      const parsedConfig = JSON.parse(execJson);
      let resolvedUrl = execUrlTemplate;
      for (const [key, value] of Object.entries(execQuery)) {
        // Match {key} or {{key}} or any depth of braces
        const regex = new RegExp(`\\{+${key}\\}+`, 'g');
        resolvedUrl = resolvedUrl.replace(regex, value);
      }
      
      window.dispatchEvent(new CustomEvent('EXECUTE_PROFILE_RUN', {
        detail: {
          profileId: execTarget.profile.id,
          pageId: execTarget.pageId,
          url: resolvedUrl,
          query: execQuery,
          config: parsedConfig,
          siteType: execTarget.profile.siteType,
          pageType: execTarget.profile.pages.find(p => p.id === execTarget.pageId)?.name || 'auto',
          toTraditional: execTarget.profile.toTraditional || execTarget.profile.pages.find(p => p.id === execTarget.pageId)?.toTraditional
        }
      }));
      setExecTarget(null);
    } catch (e: any) {
      setJsonError(e.message || "Cannot run: Invalid JSON");
    }
  };

  const getApiUrl = () => {
    try {
      const host = (window as any).process?.env?.API_ROOT || 'http://localhost:8000';
      const activePage = execTarget?.profile.pages?.find(p => p.id === execTarget.pageId);
      const profileSlug = execTarget?.profile.slug || '';
      const pageSlug = activePage?.slug || '';
      
      // Filter out empty query parameters to keep the URL clean
      const activeQueries = Object.entries(execQuery)
        .filter(([_, value]) => value !== '')
        .reduce((acc, [key, value]) => ({...acc, [key]: value}), {});

      const params = new URLSearchParams(activeQueries);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      
      return `${host}/api/v1/scrape/${profileSlug}/${pageSlug}${queryStr}`;
    } catch (e) {
      return "# URL Generation Error";
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getApiUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = () => {
    window.open(getApiUrl(), '_blank');
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/v1/profiles');
      const data = await res.json();
      setProfiles(data);
    } catch (e) {
      console.error('Failed to fetch profiles', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this scraping profile and all its associated page schemas?')) return;
    try {
      const res = await fetch(`/api/v1/profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchProfiles();
    } catch (e) {
      console.error('Delete failed', e);
      alert('Delete failed');
    }
  };

  const filteredProfiles = profiles.filter((p: Profile) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.siteType.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-pulse">
        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <Database className="w-8 h-8 text-slate-400" />
        </div>
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 animate-fade-in sm:overflow-hidden h-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black tracking-tight dark:text-white">Profile Registry</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Managing <span className="text-primary-600 dark:text-primary-400">{profiles.length}</span> scraping signatures
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Filter Profiles..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-10 py-2.5 rounded-2xl text-xs font-bold"
            />
          </div>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-2xl flex items-center space-x-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Profile</span>
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto scroll-smooth pb-10 min-h-0 pr-2">
        {filteredProfiles.length === 0 ? (
          <div className="h-full glass-panel rounded-[2.5rem] flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
              <Layers className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold dark:text-white">No Profiles Found</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                {search ? "No matches found for your current search criteria. Try a different query." : "Your profile library is currently empty. Start by creating a profile in the Scraper studio."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProfiles.map((profile: Profile) => (
              <div 
                key={profile.id} 
                onClick={() => setExecTarget({ profile, pageId: profile.pages?.[0]?.id || '' })}
                className="group glass-panel rounded-[2rem] p-6 flex flex-col transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-1 relative cursor-pointer"
              >
                {/* Visual Accent */}
                <div className="absolute top-4 right-4 text-slate-100 dark:text-slate-900 group-hover:text-primary-500/10 transition-colors duration-500">
                  <Database className="w-20 h-20" />
                </div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl group-hover:bg-primary-600 group-hover:text-white transition-colors duration-500 shadow-sm">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="px-3 py-1 bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-primary-500/20">
                    {profile.siteType}
                  </div>
                </div>

                <div className="flex-1 relative z-10">
                  <h3 className="font-black text-lg text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                    {profile.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1 text-slate-500">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {profile.pages?.length || 0} Extraction Schemas
                    </span>
                  </div>
                </div>

                {/* Sub-types preview */}
                <div className="mt-6 space-y-2 relative z-10">
                  {(profile.pages || []).slice(0, 2).map((pt: any) => (
                    <div key={pt.id} className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-slate-400 dark:text-slate-500 p-2 border border-slate-100/50 dark:border-slate-800/50 rounded-xl">
                      <span className="truncate">{pt.name}</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                  {profile.pages?.length > 2 && (
                    <p className="text-[10px] font-bold text-slate-400 pl-2">+{profile.pages.length - 2} more</p>
                  )}
                </div>

                <div className="mt-8 flex gap-2 relative z-10 transition-all duration-300 transform">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(profile.id);
                    }}
                    className="flex-1 p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm flex items-center justify-center font-black text-[10px] uppercase tracking-widest gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Purge Profile</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Execution Dialog Modal */}
      {execTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden w-full max-w-5xl shadow-2xl flex flex-col h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Play className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 m-0 dark:text-white">
                    Flight Pre-Check
                  </h3>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 flex gap-2 items-center">
                    <span className="text-primary-500">{execTarget.profile.name}</span>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <select 
                      value={execTarget.pageId}
                      onChange={(e) => setExecTarget({ ...execTarget, pageId: e.target.value })}
                      className="bg-transparent font-bold cursor-pointer outline-none border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-primary-500 pb-0.5"
                    >
                      {execTarget.profile.pages?.map((p: any) => (
                        <option key={p.id} value={p.id} className="bg-white dark:bg-slate-800">{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setExecTarget(null)} 
                className="text-slate-400 hover:text-rose-500 transition-colors p-2 bg-slate-200 dark:bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Pane: Config JSON */}
              <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 relative">
                <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 shrink-0">
                  <Code className="w-3.5 h-3.5" /> Schema Data
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <textarea
                    value={execJson}
                    onChange={e => { setExecJson(e.target.value); setJsonError(''); }}
                    className="w-full h-full p-6 bg-transparent font-mono text-[12px] leading-relaxed focus:outline-none text-slate-700 dark:text-slate-300 resize-none custom-scrollbar"
                    spellCheck={false}
                    placeholder="Extraction schema logic..."
                  />
                  {jsonError && (
                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 text-[11px] font-bold shadow-lg flex items-center justify-between">
                      <span className="truncate">{jsonError}</span>
                      <button onClick={() => setJsonError('')}><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Query parameters */}
              <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800">
                <div className="flex-[7] flex flex-col min-h-0">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                    Flight Parameters
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                        URL Template
                      </label>
                      <input
                        type="text"
                        value={execUrlTemplate}
                        readOnly
                        className="input-field py-3 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 opacity-70 cursor-not-allowed"
                        placeholder="https://.../{id}.html"
                      />
                    </div>

                  {execParamsList.length > 0 ? (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center justify-between">
                        <span>Query Variables</span>
                        <span className="bg-primary-500/10 text-primary-600 px-2 rounded-full border border-primary-500/20">{execParamsList.length} detected</span>
                      </label>
                      <div className="space-y-3 p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50">
                        {execParamsList.map(param => (
                          <div key={param} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 mx-1">{param}</label>
                            <input
                              type="text"
                              value={execQuery[param] || ''}
                              onChange={e => setExecQuery({ ...execQuery, [param]: e.target.value })}
                              placeholder={`inject ${param} value`}
                              className="input-field py-2.5 text-xs text-primary-600 dark:text-primary-400 font-bold"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-500">No Target Variables</p>
                      <p className="text-[10px] text-slate-400">Add {"{variable_name}"} to your URL template to spawn dynamic parameters.</p>
                    </div>
                  )}

                </div>
                </div>
                
                {/* Developer Toolbar (30% area) */}
                <div className="flex-[3] px-6 py-5 bg-slate-50 dark:bg-slate-950/80 border-t-2 border-slate-100 dark:border-slate-800 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary-500 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" /> Developer API
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleCopyUrl}
                        title="Copy API URL"
                        className="p-1.5 bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-500 rounded-lg border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={handleOpenNewTab}
                        title="Open in New Tab"
                        className="p-1.5 bg-primary-500 text-white hover:bg-primary-600 rounded-lg shadow-lg shadow-primary-500/20 transition-all active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative group">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter absolute top-2 left-3 pointer-events-none group-focus-within:text-primary-500 transition-colors">
                      Live Request URL
                    </label>
                    <textarea 
                      readOnly
                      value={getApiUrl()}
                      className="w-full h-full pt-6 p-3 bg-slate-900 rounded-xl font-mono text-[10px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500/50 resize-none border border-slate-800 custom-scrollbar"
                    />
                  </div>
                </div>

              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center rounded-b-3xl shrink-0">
              <button
                onClick={handleUpdateCheckpont}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" /> Quick Checkpoint
              </button>
              
              <button
                onClick={handleRunFlight}
                disabled={execParamsList.some(p => !execQuery[p])}
                className="px-10 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Launch Flight
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
