import { useState, useRef, useEffect } from 'react';
import type { Extractor, Profile } from '../types';
import { createEmptyExtractor, generateId } from '../lib/extractorUtils';
import { ExtractorBuilder } from './ExtractorBuilder';
import { 
  Play, 
  Sparkles, 
  MousePointer2, 
  X, 
  BookOpen, 
  RefreshCcw, 
  Save, 
  Terminal,
  Code,
  Globe,
  Layers,
  Plus,
  Settings
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Scraper({ pendingFlight, onFlightConsumed }: { pendingFlight?: any, onFlightConsumed?: () => void }) {
  // Mode Selection
  const [inputMode, setInputMode] = useState<'manual' | 'profile'>('manual');

  // Manual Mode State
  const [url, setUrl] = useState('');
  const [siteType, setSiteType] = useState('auto');
  
  // Profile Mode State
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedPageTypeId, setSelectedPageTypeId] = useState('');
  const [parameters, setParameters] = useState<Record<string, string>>({});

  // Shared State
  const [html, setHtml] = useState('');
  const [extractors, setExtractors] = useState<Extractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pickerActive, setPickerActive] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Save Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
  const [saveSelectedProfileId, setSaveSelectedProfileId] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [pageTypeName, setPageTypeName] = useState('Default');
  const [urlTemplate, setUrlTemplate] = useState('');

  // Analysis settings state
  const [pageType, setPageType] = useState('auto-detect');
  const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);
  
  // JSON Editor state
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [toTraditional, setToTraditional] = useState(false);
  const [pruneEnabled, setPruneEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'result'>('preview');
  const [pageTypeMappings, setPageTypeMappings] = useState<Record<string, string[]>>({
    'auto': ['auto-detect', 'indexpage', 'chapterpage', 'searchpage', 'bookpage', 'catalog', 'productpage', 'categorypage', 'article', 'list'],
    'novel': ['auto-detect', 'indexpage', 'chapterpage'],
    'ecommerce': ['auto-detect', 'productpage', 'categorypage', 'searchpage'],
    'blog': ['auto-detect', 'article', 'list'],
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    const handleComplete = (e: any) => {
      const { items: newItems, template } = e.detail;
      
      const assignIds = (items: any[]): Extractor[] => {
        if (!Array.isArray(items)) return [];
        return items.map((item: any) => {
          let type = item.type;
          if (!type) {
            if (item.elements && item.elements.length > 0) type = 'nested';
            else if (item.attribute) type = 'attribute';
            else type = 'text';
          }
          return {
            ...item,
            id: item.id || generateId(),
            type,
            isArray: item.isArray ?? (type === 'nested'),
            elements: Array.isArray(item.elements) ? assignIds(item.elements) : undefined
          };
        });
      };
      
      if (newItems && Array.isArray(newItems)) {
        setExtractors(assignIds(newItems));
      }
      
      if (template) {
        setAnalysisResult(template);
        if (template.site_type) setSiteType(template.site_type);
        else if (template.site) setSiteType(template.site); // Back-compat

        if (template.page_type) {
          setPageType(template.page_type);
          setPageTypeName(template.page_type);
        } else if (template.page) {
          setPageType(template.page);
          setPageTypeName(template.page);
        }

        if (template.url) setUrlTemplate(template.url);
      }
    };

    window.addEventListener('AI_ANALYZE_COMPLETE', handleComplete);
    return () => window.removeEventListener('AI_ANALYZE_COMPLETE', handleComplete);
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/v1/profiles');
      if (!res.ok) {
        console.warn('[API Warning] fetchProfiles returned status:', res.status);
        setProfiles([]);
        return;
      }
      const data = await res.json();
      setProfiles(data || []);
    } catch (e) {
      console.error('[API Error] fetchProfiles failed:', e);
      setProfiles([]);
    }
  };

  // Derived Profile State
  const selectedProfile = profiles.find((p: Profile) => p.id === selectedProfileId);
  const selectedPageType = selectedProfile?.pages?.find((pt: any) => pt.id === selectedPageTypeId);
  const paramsList = selectedPageType 
    ? Array.from(selectedPageType.url.matchAll(/\{([^}]+)\}/g)).map((m: any) => m[1])
    : [];

  const fetchHtml = async (targetUrl: string) => {
    if (!targetUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/proxy?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) throw new Error('Proxy failed');
      const data = await res.text();
      setHtml(data);
      setUrl(targetUrl);
      return data; // Return data for sequential workflows
    } catch (e) {
      console.error('[API Error] fetchHtml failed:', e);
      alert('Failed to fetch HTML. Check your backend and URL.');
    } finally {
      setLoading(false);
    }
  };

  const loadFromProfile = () => {
    if (!selectedPageType) return;
    
    let resolvedUrl = selectedPageType.url;
    for (const [key, value] of Object.entries(parameters)) {
      resolvedUrl = resolvedUrl.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    
    setExtractors(selectedPageType.items || []);
    setToTraditional(selectedPageType.toTraditional || false);
    
    // Set active states for Checkpoint/Save Modal
    setSiteType(selectedProfile?.siteType || 'auto');
    setPageType(selectedPageType.name);
    setPageTypeName(selectedPageType.name);
    setSaveSelectedProfileId(selectedProfileId);
    setSaveMode('existing');
    
    fetchHtml(resolvedUrl);
  };

  useEffect(() => {
    const handleFlightRun = (e: any) => {
      const { url: eventUrl, config, query, siteType: eventSiteType, pageType: eventPageType, profileId, toTraditional: eventToTraditional } = e.detail;
      setInputMode('manual');
      setUrl(eventUrl);
      setExtractors(config);
      setAnalysisResult((prev: any) => ({ ...prev, query }));
      
      // Set active states for Checkpoint/Save Modal
      if (eventSiteType) setSiteType(eventSiteType);
      if (eventPageType) {
          setPageType(eventPageType);
          setPageTypeName(eventPageType);
      }
      if (profileId) {
          setSaveSelectedProfileId(profileId);
          setSaveMode('existing');
      }
      if (eventToTraditional !== undefined) setToTraditional(!!eventToTraditional);

      runScrape(eventUrl, config, query, eventToTraditional);
    };
    window.addEventListener('EXECUTE_PROFILE_RUN', handleFlightRun);
    return () => window.removeEventListener('EXECUTE_PROFILE_RUN', handleFlightRun);
  }, []);

  useEffect(() => {
    if (pendingFlight && onFlightConsumed) {
      const { url: eventUrl, config, query, siteType: eventSiteType, pageType: eventPageType, profileId, toTraditional: eventToTraditional } = pendingFlight;
      setInputMode('manual');
      setUrl(eventUrl);
      setExtractors(config);
      setAnalysisResult((prev: any) => ({ ...prev, query }));

      // Set active states for Checkpoint/Save Modal
      if (eventSiteType) setSiteType(eventSiteType);
      if (eventPageType) {
          setPageType(eventPageType);
          setPageTypeName(eventPageType);
      }
      if (profileId) {
          setSaveSelectedProfileId(profileId);
          setSaveMode('existing');
      }
      if (eventToTraditional !== undefined) setToTraditional(!!eventToTraditional);

      runScrape(eventUrl, config, query, eventToTraditional);
      onFlightConsumed();
    }
  }, [pendingFlight, onFlightConsumed]);

  const runScrape = async (overrideUrl?: string, overrideExtractors?: Extractor[], overrideQuery?: any, overrideToTraditional?: boolean) => {
    const targetUrl = overrideUrl || url;
    const targetExtractors = overrideExtractors || extractors;
    const targetQuery = overrideQuery || analysisResult?.query || {};
    const targetToTraditional = overrideToTraditional !== undefined ? overrideToTraditional : toTraditional;
    
    if (!targetUrl || targetExtractors.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: targetUrl, 
          extractors: targetExtractors,
          query: targetQuery,
          toTraditional: targetToTraditional
        })
      });
      const data = await res.json();
      setResult(data.data);
      setActiveTab('result'); // Auto-switch to result view
    } catch (e) {
      console.error('[API Error] runScrape failed:', e);
      alert('Scrape failed');
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!url) return alert('Enter URL first');
    
    setLoading(true);
    try {
      // 1. Predictive Fetch: Ensure we have the latest HTML before analysis
      const currentHtml = await fetchHtml(url);
      if (!currentHtml) return;

      // 2. Trigger the AI Chat Agent with fresh content
      window.dispatchEvent(new CustomEvent('AI_ANALYZE_TRIGGER', {
        detail: {
          url,
          site_type: siteType,
          page_type: pageType,
          html: currentHtml,
          pruneEnabled
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const togglePicker = () => {
    const newState = !pickerActive;
    setPickerActive(newState);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'TOGGLE_PICKER', active: newState }, '*');
    }
  };

  const saveProfile = async () => {
    if (!pageTypeName || !urlTemplate) return alert('Please fill in required fields');
    
    try {
      const payload: any = {
        id: saveMode === 'new' ? generateId() : saveSelectedProfileId,
        name: saveMode === 'new' ? newProfileName : profiles.find(p => p.id === saveSelectedProfileId)?.name || '',
        site_type: siteType,
        pages: saveMode === 'new' ? [] : profiles.find(p => p.id === saveSelectedProfileId)?.pages || []
      };

      const newPageType = {
        id: generateId(),
        name: pageTypeName,
        url: urlTemplate,
        items: extractors,
        toTraditional
      };

      let res;
      if (saveMode === 'new') {
        payload.pages = [newPageType];
        res = await fetch('/api/v1/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        const index = payload.pages.findIndex((pt: any) => pt.name === pageTypeName);
        if (index > -1) {
          payload.pages[index] = newPageType;
        } else {
          payload.pages.push(newPageType);
        }
        if (profiles.length > 0) {
          setSelectedProfileId(profiles[0].id);
          if (profiles[0].pages?.length > 0) {
            setSelectedPageTypeId(profiles[0].pages[0].id);
          }
        }
        res = await fetch(`/api/v1/profiles/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error occurred' }));
        throw new Error(errData.detail || 'Failed to save profile');
      }
      
      fetchProfiles();
      setShowSaveModal(false);
      alert('Profile saved successfully!');
    } catch (e) {
      console.error('[API Error] saveProfile failed:', e);
      alert('Failed to save profile');
    }
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'ELEMENT_PICKED') {
        setPickerActive(false);
        const newExt = createEmptyExtractor();
        newExt.selector = e.data.selector;
        newExt.alias = `field_${extractors.length + 1}`;
        setExtractors((prev: Extractor[]) => [...prev, newExt]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [extractors.length]);

  return (
    <div className="flex flex-col lg:h-full gap-3 animate-fade-in overflow-y-auto lg:overflow-hidden">
      {/* Ultra-Compact Command Row */}
      <div className="flex items-center gap-3 p-1.5 glass-panel rounded-2xl shrink-0">
        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-white/5">
          <button
            onClick={() => setInputMode('manual')}
            title="Direct Access"
            className={cn(
              "p-2 rounded-lg transition-all",
              inputMode === 'manual' ? "bg-white dark:bg-slate-800 text-primary-600 shadow-sm" : "text-slate-400"
            )}
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setInputMode('profile')}
            title="Profile Library"
            className={cn(
              "p-2 rounded-lg transition-all",
              inputMode === 'profile' ? "bg-white dark:bg-slate-800 text-primary-600 shadow-sm" : "text-slate-400"
            )}
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {inputMode === 'manual' ? (
          <>
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Target URL..."
                className="input-field py-2 pr-20 text-xs font-bold"
              />
              <button
                onClick={() => fetchHtml(url)}
                disabled={loading || !url}
                className="absolute right-1 top-1 bottom-1 px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[10px] font-black transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCcw className="w-3 h-3 animate-spin" /> : "FETCH"}
              </button>
            </div>
            
            <div className="w-32">
              <select
                value={siteType}
                onChange={e => setSiteType(e.target.value)}
                className="input-field py-2 text-[11px] font-bold cursor-pointer"
              >
                <option value="auto">Auto-detect</option>
                <option value="novel">Novel</option>
                <option value="ecommerce">Market</option>
                <option value="blog">Blog</option>
              </select>
            </div>

            <div className="w-32">
              <select
                value={pageType}
                onChange={e => setPageType(e.target.value)}
                className="input-field py-2 text-[11px] font-bold cursor-pointer"
              >
                {(pageTypeMappings[siteType] || ['auto']).map(pt => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalysisSettings(true)}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={analyzeWithAI}
                disabled={loading || !url}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Analyze</span>
              </button>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <input
                id="traditional-toggle"
                type="checkbox"
                checked={toTraditional}
                onChange={(e) => setToTraditional(e.target.checked)}
                className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded text-primary-600 cursor-pointer"
              />
              <label htmlFor="traditional-toggle" className="text-[9px] font-black text-slate-400 uppercase tracking-tighter cursor-pointer">Traditional</label>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <input
                id="prune-toggle"
                type="checkbox"
                checked={pruneEnabled}
                onChange={(e) => setPruneEnabled(e.target.checked)}
                className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded text-primary-600 cursor-pointer"
              />
              <label htmlFor="prune-toggle" className="text-[9px] font-black text-slate-400 uppercase tracking-tighter cursor-pointer">Prune</label>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex gap-2">
              <select 
                value={selectedProfileId} 
                onChange={e => { setSelectedProfileId(e.target.value); setSelectedPageTypeId(''); }}
                className="input-field py-2 text-[11px] font-bold"
              >
                <option value="">-- Choose Profile --</option>
                {profiles.map((p: Profile) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {selectedProfile && (
                <select 
                  value={selectedPageTypeId} 
                  onChange={e => setSelectedPageTypeId(e.target.value)}
                  className="input-field py-2 text-[11px] font-bold"
                >
                  <option value="">-- Schema --</option>
                  {selectedProfile.pages?.map((pt: any) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              )}
            </div>

            {selectedPageType && (
              <div className="flex gap-2 animate-fade-in">
                {paramsList.map(param => (
                  <input 
                    key={param}
                    type="text" 
                    value={parameters[param] || ''}
                    onChange={e => setParameters({...parameters, [param]: e.target.value})}
                    className="input-field py-2 text-[11px] w-32"
                    placeholder={`${param}...`}
                  />
                ))}
                <button
                  onClick={loadFromProfile}
                  disabled={loading || paramsList.some(p => !parameters[p])}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  INSTANTIATE
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left: Extractor Structure */}
        <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col glass-panel rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 border-white/5 shrink-0">
          <div className="px-6 py-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Extraction Components</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  const fullSchema = {
                    url: urlTemplate || url,
                    query: analysisResult?.query || {},
                    site_type: siteType,
                    page_type: pageTypeName || pageType,
                    to_traditional: toTraditional,
                    items: extractors
                  };
                  setJsonText(JSON.stringify(fullSchema, null, 2));
                  setJsonError('');
                  setShowJsonEditor(true);
                }}
                className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-all active:scale-90 flex items-center justify-center group"
                title="Edit Full Schema JSON"
              >
                <Code className="w-5 h-5 group-hover:text-primary-500 transition-colors" />
              </button>
              <button
                onClick={() => setExtractors([...extractors, createEmptyExtractor()])}
                className="p-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-all active:scale-90"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-4 scroll-smooth">
            {extractors.map((ext: Extractor, i: number) => (
              <ExtractorBuilder
                key={ext.id}
                extractor={ext}
                onChange={(updated: Extractor) => {
                  const newExts = [...extractors];
                  newExts[i] = updated;
                  setExtractors(newExts);
                }}
                onDelete={() => setExtractors(extractors.filter((_: Extractor, idx: number) => idx !== i))}
              />
            ))}
            {extractors.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                <Code className="w-16 h-16 mb-4 text-slate-400" />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">System Ready</p>
                <p className="text-[10px] mt-2 text-slate-400 max-w-[200px]">Define extractors manually or use the AI Analysis tool to map the page structure.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50/80 dark:bg-slate-900/80 border-t border-white/10 flex space-x-3">
            <button
              onClick={() => { setShowSaveModal(true); setUrlTemplate(url); }}
              disabled={extractors.length === 0}
              className="flex-1 py-3.5 px-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-30 border border-white/5 flex items-center justify-center space-x-2"
            >
              <Save className="w-3 h-3" />
              <span>Checkpoint</span>
            </button>
            <button
              onClick={() => runScrape()}
              disabled={loading || extractors.length === 0 || !url}
              className="flex-[2] py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-3"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>RUN EXTRATION</span>
            </button>
          </div>
        </div>

        {/* Right: Interaction Workspace */}
        <div className="flex-1 flex flex-col gap-4 min-h-[500px] lg:min-h-0">
          {/* Iframe Preview */}
          <div className="flex-1 glass-panel rounded-3xl overflow-hidden flex flex-col relative border-white/5 transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10">
            <div className="bg-slate-100/50 dark:bg-slate-900/50 border-b border-white/10 px-4 py-2 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="flex p-1 bg-slate-200 dark:bg-black rounded-xl border border-white/5 mr-2">
                  <button 
                    onClick={() => setActiveTab('preview')}
                    className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                      activeTab === 'preview' ? "bg-white dark:bg-slate-800 text-primary-600 shadow-sm" : "text-slate-400"
                    )}
                  >
                    Site Preview
                  </button>
                  <button 
                    onClick={() => setActiveTab('result')}
                    disabled={!result}
                    className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                      activeTab === 'result' ? "bg-white dark:bg-slate-800 text-emerald-500 shadow-sm" : "text-slate-400 disabled:opacity-30"
                    )}
                  >
                    Output Stream
                  </button>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate max-w-[200px]">
                  {url || 'Workspace Visualizer'}
                </span>
              </div>
              
              <button
                onClick={togglePicker}
                disabled={!html}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 transition-all group active:scale-95 border",
                  pickerActive 
                    ? "bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-500/30" 
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600"
                )}
              >
                <MousePointer2 className={cn("w-3 h-3 group-hover:scale-110 transition-transform", pickerActive && "animate-pulse")} />
                <span>{pickerActive ? 'PICKING MODE' : 'VISUAL PICKER'}</span>
              </button>
            </div>
            
            {activeTab === 'preview' ? (
              <div className="flex-1 relative bg-white">
                {html ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={`
                      <style>
                        .scraper-picker-highlight { outline: 3px solid #0ea5e9 !important; outline-offset: -3px !important; background-color: rgba(14, 165, 233, 0.2) !important; cursor: pointer !important; }
                        * { transition: outline 0.1s ease-in-out !important; }
                      </style>
                      <script>
                        let pickerEnabled = false;
                        window.addEventListener('message', e => {
                          if (e.data.type === 'TOGGLE_PICKER') {
                            pickerEnabled = e.data.active;
                            if (!pickerEnabled) {
                              document.querySelectorAll('.scraper-picker-highlight').forEach(el => el.classList.remove('scraper-picker-highlight'));
                            }
                          }
                        });

                        // Hijack XHR and Fetch to go through our proxy
                        (function() {
                          // USE PARENT ORIGIN because window.location in srcdoc is 'about:srcdoc'
                          const parentOrigin = window.parent.location.origin;
                          const PROXY_URL = parentOrigin + '/api/v1/proxy?url=';
                          const baseUrl = '${url}'; 
                          
                          // Helper to get absolute URL
                          const getAbsoluteUrl = (url) => {
                            if (!url) return url;
                            if (typeof url !== 'string') return url;
                            if (url.startsWith('http')) return url;
                            if (url.startsWith('//')) return window.location.protocol + url;
                            try {
                              return new URL(url, baseUrl || window.parent.location.href).href;
                            } catch(e) {
                              return url;
                            }
                          };

                          const originalOpen = XMLHttpRequest.prototype.open;
                          XMLHttpRequest.prototype.open = function(method, url) {
                            if (typeof url === 'string' && !url.includes('/api/v1/proxy')) {
                              url = PROXY_URL + encodeURIComponent(getAbsoluteUrl(url));
                            }
                            return originalOpen.apply(this, arguments);
                          };

                          const originalFetch = window.fetch;
                          window.fetch = function(input, init) {
                            if (typeof input === 'string' && !input.includes('/api/v1/proxy')) {
                              input = PROXY_URL + encodeURIComponent(getAbsoluteUrl(input));
                            } else if (input instanceof Request && !input.url.includes('/api/v1/proxy')) {
                              const newUrl = PROXY_URL + encodeURIComponent(getAbsoluteUrl(input.url));
                              input = new Request(newUrl, input);
                            }
                            return originalFetch.apply(this, arguments);
                          };
                        })();
                        
                        document.addEventListener('mouseover', e => {
                          if (!pickerEnabled) return;
                          e.target.classList.add('scraper-picker-highlight');
                          e.stopPropagation();
                        });
                        
                        document.addEventListener('mouseout', e => {
                          if (!pickerEnabled) return;
                          e.target.classList.remove('scraper-picker-highlight');
                          e.stopPropagation();
                        });
                        
                        document.addEventListener('click', e => {
                          if (!pickerEnabled) return;
                          e.preventDefault();
                          e.stopPropagation();
                          
                          const getSelector = (el) => {
                            if (el.id) return '#' + el.id;
                            let selector = el.tagName.toLowerCase();
                            if (el.className) {
                              const classes = Array.from(el.classList).filter(c => c !== 'scraper-picker-highlight').join('.');
                              if (classes) selector += '.' + classes;
                            }
                            return selector;
                          };
                          
                          window.parent.postMessage({
                            type: 'ELEMENT_PICKED',
                            selector: getSelector(e.target)
                          }, '*');
                        });
                      </script>
                      ${html}
                    `}
                    className="w-full h-full border-none bg-white"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                    scrolling="yes"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10 text-center animate-fade-in">
                    <Globe className="w-20 h-20 mb-6 opacity-10" />
                    <h4 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Workspace Offline</h4>
                    <p className="max-w-[300px] text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Fetch a URL or load a profile to begin visual mapping.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-8 bg-slate-950 min-h-0 relative">
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <pre className="text-xs font-mono text-emerald-400 leading-relaxed p-4 whitespace-pre-wrap break-words">
                    {JSON.stringify({ 
                      metadata: {
                        url,
                        timestamp: new Date().toISOString()
                      },
                      dataset: result 
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Profile Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="glass-panel w-full max-w-lg rounded-[2.5rem] overflow-hidden border-white/10 animate-fade-in shadow-2xl">
            <div className="flex justify-between items-center px-8 py-6 border-b border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Save className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold dark:text-white">Preserve Schema</h2>
              </div>
              <button onClick={() => setShowSaveModal(false)} className="p-2 text-slate-400 hover:text-slate-100 transition-colors bg-slate-100 dark:bg-slate-800 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setSaveMode('new')}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    saveMode === 'new' ? "bg-white dark:bg-slate-800 shadow-lg text-primary-600 dark:text-primary-400" : "text-slate-400"
                  )}
                >
                  New Origin
                </button>
                <button
                  onClick={() => setSaveMode('existing')}
                  disabled={profiles.length === 0}
                  className={cn(
                    "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    saveMode === 'existing' ? "bg-white dark:bg-slate-800 shadow-lg text-primary-600 dark:text-primary-400" : "text-slate-400 disabled:opacity-30"
                  )}
                >
                  Merge Existing
                </button>
              </div>

              {saveMode === 'new' ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Domain Handle</label>
                    {analysisResult?.site && <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">AI Suggested</span>}
                  </div>
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    className="input-field py-3.5 font-bold"
                    placeholder="e.g., BaiduCloudEngine"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Target Identity</label>
                  <select
                    value={saveSelectedProfileId}
                    onChange={e => setSaveSelectedProfileId(e.target.value)}
                    className="input-field py-3.5 font-bold appearance-none cursor-pointer"
                  >
                    <option value="">-- Choose Target --</option>
                    {profiles.map((p: Profile) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schema Type</label>
                    {analysisResult?.page && <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">AI Suggested</span>}
                  </div>
                  <input
                    type="text"
                    value={pageTypeName}
                    onChange={e => setPageTypeName(e.target.value)}
                    className="input-field py-3"
                    placeholder="e.g. Catalog Index"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Site Signature</label>
                  <input
                    type="text"
                    value={siteType}
                    disabled
                    className="input-field py-3 opacity-50 bg-slate-50 border-dashed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>URL Blueprint</span>
                    {analysisResult?.url && <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">AI Suggested</span>}
                  </div>
                  <span className="text-[8px] font-medium text-primary-500 lowercase opacity-60 italic">supports {"{dynamic_id}"}</span>
                </label>
                <input
                  type="text"
                  value={urlTemplate}
                  onChange={e => setUrlTemplate(e.target.value)}
                  className="input-field py-3.5 font-mono text-[11px]"
                  placeholder="https://example.com/item/{id}.html"
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Processing Options</label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <input
                      id="modal-traditional-toggle"
                      type="checkbox"
                      checked={toTraditional}
                      onChange={(e) => setToTraditional(e.target.checked)}
                      className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded text-primary-600 cursor-pointer"
                    />
                    <label htmlFor="modal-traditional-toggle" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer">Traditional Chinese</label>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-100/50 dark:bg-slate-900/50 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveProfile}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
              >
                Commit To DB
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Analysis Settings Modal */}
      {showAnalysisSettings && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="glass-panel w-full max-w-2xl rounded-[2.5rem] overflow-hidden border-white/10 animate-fade-in shadow-2xl">
            <div className="flex justify-between items-center px-8 py-6 border-b border-white/10 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold dark:text-white">Analysis Mapping Settings</h2>
              </div>
              <button onClick={() => setShowAnalysisSettings(false)} className="p-2 text-slate-400 hover:text-slate-100 transition-colors bg-slate-100 dark:bg-slate-800 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-medium">Define which page types are available for each site category. These will appear in the "Page Type" dropdown for analysis.</p>
              
              {Object.entries(pageTypeMappings).map(([site, types]) => (
                <div key={site} className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-500">{site}</label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {types.map((type, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold">{type}</span>
                        <button 
                          onClick={() => {
                            const newMappings = {...pageTypeMappings};
                            newMappings[site] = types.filter((_, i) => i !== idx);
                            setPageTypeMappings(newMappings);
                          }}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const newType = prompt('Enter new page type handle:');
                        if (newType) {
                          const newMappings = {...pageTypeMappings};
                          newMappings[site] = [...types, newType.trim()];
                          setPageTypeMappings(newMappings);
                        }
                      }}
                      className="px-3 py-1.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-400 hover:border-primary-500 hover:text-primary-500 transition-all"
                    >
                      + ADD TYPE
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-8 py-6 bg-slate-100/50 dark:bg-slate-900/50 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowAnalysisSettings(false)}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
              >
                Close & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw JSON Editor Modal */}
      {showJsonEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200 flex items-center gap-2"><Code className="w-4 h-4 text-primary-600" /> RAW JSON EDITOR</h3>
              <button onClick={() => setShowJsonEditor(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-6 overflow-hidden flex flex-col relative bg-slate-50 dark:bg-slate-950">
              <textarea
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
                className="w-full h-full min-h-[400px] p-4 bg-white dark:bg-slate-900 font-mono text-[12px] leading-relaxed border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-slate-700 dark:text-slate-300 resize-none custom-scrollbar"
                spellCheck={false}
                placeholder="Paste or edit extractor JSON array here..."
              />
              {jsonError && (
                <div className="absolute bottom-10 left-10 right-10 p-4 bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center text-rose-600 dark:text-rose-400 text-xs font-bold shadow-lg animate-fade-in shadow-rose-500/10 z-10 backdrop-blur-md">
                  <span className="flex-1 truncate">{jsonError}</span>
                  <button onClick={() => setJsonError('')} className="ml-2 hover:bg-rose-200 dark:hover:bg-rose-800 p-1 rounded-lg">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => setShowJsonEditor(false)}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
               >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonText);
                    let itemsArray = parsed;
                    
                    // Logic for Full Schema Object or Simple Array
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                      if (parsed.items && Array.isArray(parsed.items)) {
                        itemsArray = parsed.items;
                        // Orchestrate top-level state from JSON
                        const newSiteType = parsed.site_type || parsed.site;
                        if (newSiteType) setSiteType(newSiteType);
                        
                        const newPageType = parsed.page_type || parsed.page;
                        if (newPageType) {
                          setPageType(newPageType);
                          setPageTypeName(newPageType);
                        }
                        
                        if (parsed.url) {
                          setUrl(parsed.url);
                          setUrlTemplate(parsed.url);
                        }
                        if (parsed.query) {
                          setAnalysisResult((prev: any) => ({ ...prev, query: parsed.query }));
                        }
                        
                        const newToTraditional = parsed.to_traditional ?? parsed.toTraditional;
                        if (newToTraditional !== undefined) {
                          setToTraditional(!!newToTraditional);
                        }
                      } else {
                        throw new Error("JSON must be an array [] or a template object containing an 'items' array");
                      }
                    }

                    if (!Array.isArray(itemsArray)) {
                      throw new Error("JSON must result in an array of extractors");
                    }
                    
                    // Assign IDs and infer missing types (Attribute, Text, Nested)
                    const assignIdsWithInference = (items: any[]): Extractor[] => {
                      if (!Array.isArray(items)) return [];
                      return items.map((item: any) => {
                        let type = item.type;
                        if (!type) {
                          if (item.elements && item.elements.length > 0) type = 'nested';
                          else if (item.attribute) type = 'attribute';
                          else type = 'text';
                        }
                        return {
                          ...item,
                          id: item.id || generateId(),
                          type,
                          isArray: item.isArray ?? (type === 'nested'),
                          elements: Array.isArray(item.elements) ? assignIdsWithInference(item.elements) : undefined
                        };
                      });
                    };

                    setExtractors(assignIdsWithInference(itemsArray));
                    setShowJsonEditor(false);
                  } catch (e: any) {
                    setJsonError(e.message || "Invalid JSON syntax");
                  }
                }}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2"
              >
                <Save className="w-3 h-3" /> Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
