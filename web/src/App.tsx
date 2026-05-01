import { useState, useEffect } from 'react';
import packageJson from '../package.json';

import { Scraper } from './components/Scraper';
import { ProfileManager } from './components/ProfileManager';
import { AIChat } from './components/AIChat';
import { 
  Compass, 
  Layers, 
  Moon, 
  Sun, 
  Layout
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scraper' | 'profiles'>('scraper');
  const [pendingFlight, setPendingFlight] = useState<any>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleFlightRun = (e: any) => {
      setPendingFlight(e.detail);
      setActiveTab('scraper');
    };
    window.addEventListener('EXECUTE_PROFILE_RUN', handleFlightRun);
    return () => window.removeEventListener('EXECUTE_PROFILE_RUN', handleFlightRun);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-500 overflow-hidden h-screen">
      {/* Desktop Sidebar / Header - ULTRA COMPACT */}
      <header className="hidden sm:flex glass-panel z-30 px-4 py-2 items-center justify-between shrink-0 border-b-white/10">
        <div className="flex items-center space-x-2 group cursor-pointer">
          <div className="p-1.5 bg-primary-600 rounded-lg shadow-lg shadow-primary-500/30 transition-transform duration-300">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-500 dark:from-primary-400 dark:to-indigo-300">
              SCRAPER STUDIO
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 align-middle">
                v{packageJson.version}
              </span>
            </h1>
          </div>
        </div>
        
        <nav className="flex items-center space-x-1 p-0.5 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('scraper')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center space-x-2",
              activeTab === 'scraper' 
                ? "bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-md" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Scraper</span>
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center space-x-2",
              activeTab === 'profiles' 
                ? "bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-md" 
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Profiles</span>
          </button>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-slate-700 transition-all active:scale-90"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center space-x-2 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Online</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Background blobs for premium feel */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="h-full w-full p-4 sm:p-6 lg:p-8 animate-fade-in relative z-10 overflow-auto sm:overflow-hidden flex flex-col">
          {activeTab === 'scraper' ? (
            <Scraper 
              pendingFlight={pendingFlight} 
              onFlightConsumed={() => setPendingFlight(null)} 
            />
          ) : (
            <ProfileManager />
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="sm:hidden glass-panel shrink-0 border-t border-white/10 px-6 py-3 pb-safe flex items-center justify-between">
        <button
          onClick={() => setActiveTab('scraper')}
          className={cn(
            "flex flex-col items-center space-y-1 transition-colors duration-300",
            activeTab === 'scraper' ? "text-primary-600 dark:text-primary-400" : "text-slate-400"
          )}
        >
          <Compass className={cn("w-6 h-6", activeTab === 'scraper' && "animate-pulse")} />
          <span className="text-[10px] font-black uppercase tracking-widest">Scraper</span>
        </button>
        <button
          onClick={() => setActiveTab('profiles')}
          className={cn(
            "flex flex-col items-center space-y-1 transition-colors duration-300",
            activeTab === 'profiles' ? "text-primary-600 dark:text-primary-400" : "text-slate-400"
          )}
        >
          <Layers className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Profiles</span>
        </button>
        <button
          onClick={() => setIsDark(!isDark)}
          className="flex flex-col items-center space-y-1 text-slate-400"
        >
          {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          <span className="text-[10px] font-black uppercase tracking-widest">Theme</span>
        </button>
      </nav>

      <AIChat />
    </div>
  );
}
