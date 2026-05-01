import { useState } from 'react';
import type { Extractor, ExtractorType } from '../types';
import { 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Type, 
  Hash, 
  Code2, 
  Network,
  Layers,
  ListOrdered
} from 'lucide-react';
import { createEmptyExtractor, createIndexExtractor } from '../lib/extractorUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  extractor: Extractor;
  onChange: (ext: Extractor) => void;
  onDelete: () => void;
  depth?: number;
}

const TYPE_ICONS: Record<ExtractorType, any> = {
  text: Type,
  attribute: Hash,
  html: Code2,
  nested: Network,
  index: ListOrdered
};

export function ExtractorBuilder({ extractor, onChange, onDelete, depth = 0 }: Props) {
  const [showBody, setShowBody] = useState(true);

  const updateField = (field: keyof Extractor, value: any) => {
    onChange({ ...extractor, [field]: value });
  };

  const Icon = TYPE_ICONS[extractor.type] || Type;

  return (
    <div 
      className={cn(
        "group rounded-2xl border transition-all duration-300",
        depth === 0 ? "glass-panel" : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800",
        depth > 0 ? "ml-6 mt-3 relative" : ""
      )}
    >
      {/* Visual connection line for nested */}
      {depth > 0 && (
        <div className="absolute -left-4 top-[-12px] bottom-1/2 w-4 border-l border-b border-primary-500/30 rounded-bl-xl pointer-events-none" />
      )}

      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center gap-3 rounded-t-2xl transition-colors duration-300",
        showBody ? "bg-slate-100/30 dark:bg-slate-800/30" : ""
      )}>
        <div className={cn(
          "p-1.5 rounded-lg text-white shadow-sm transition-all duration-300",
          extractor.type === 'nested' ? "bg-indigo-600 scale-110" : "bg-primary-600"
        )}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={extractor.alias}
            onChange={e => updateField('alias', e.target.value)}
            placeholder="Field Name"
            className="w-full bg-transparent border-none p-0 text-sm font-bold placeholder-slate-400 focus:ring-0 truncate dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={extractor.type}
            onChange={e => {
              const newType = e.target.value as ExtractorType;
              const updates: any = { type: newType };
              if (newType === 'nested' && (extractor.isArray === true || String(extractor.isArray) === 'true') && (!extractor.elements || extractor.elements.length === 0)) {
                updates.elements = [createIndexExtractor()];
              }
              onChange({ ...extractor, ...updates });
            }}
            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 focus:ring-0 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <option value="text">Text</option>
            <option value="attribute">Attribute</option>
            <option value="html">HTML</option>
            <option value="nested">Nested</option>
            <option value="index">Index</option>
          </select>

          <div className="flex items-center space-x-1 ml-2">
            <input
              type="checkbox"
              id={`isArray-${extractor.id}`}
              checked={extractor.isArray === true || String(extractor.isArray) === 'true'}
              onChange={e => {
                const isChecked = e.target.checked;
                const updates: any = { isArray: isChecked };
                if (isChecked && extractor.type === 'nested' && (!extractor.elements || extractor.elements.length === 0)) {
                  updates.elements = [createIndexExtractor()];
                }
                onChange({ ...extractor, ...updates });
              }}
              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500 bg-white dark:bg-slate-800 cursor-pointer"
            />
            <label htmlFor={`isArray-${extractor.id}`} className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 cursor-pointer select-none">
              Array
            </label>
          </div>

          <button 
            onClick={() => setShowBody(!showBody)}
            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {showBody ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <button 
            onClick={onDelete} 
            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {showBody && (
        <div className="p-4 space-y-4 animate-slide-up">
          <div className="relative group/input">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block group-focus-within/input:text-primary-500 transition-colors">
              CSS Selector
            </label>
            <div className="relative">
              <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={extractor.selector}
                onChange={e => updateField('selector', e.target.value)}
                placeholder="Empty to ignore..."
                className={cn(
                  "input-field pl-9 font-mono text-xs py-2.5 transition-all",
                  (!extractor.selector) && "border-slate-300/30 bg-slate-500/5 text-slate-400 italic opacity-60",
                  (extractor.selector === '.') && "border-indigo-500/50 bg-indigo-500/5 text-indigo-500"
                )}
              />
              {(!extractor.selector) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-400/20 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest border border-slate-400/30">
                  DISABLED
                </div>
              )}
              {(extractor.selector === '.') && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-indigo-500 rounded text-[8px] font-black text-white uppercase tracking-widest shadow-sm shadow-indigo-500/20">
                  SELF
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Transformations
              </label>
              <button
                type="button"
                onClick={() => {
                  const newList = [...(extractor.post_replace || []), { '^': '' }];
                  updateField('post_replace', newList);
                }}
                className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-400 transition-colors uppercase"
              >
                <Plus className="w-3 h-3" /> Add Step
              </button>
            </div>
            
            {(extractor.post_replace || []).map((t: any, i: number) => {
              // Handle string-based transformations (legacy/AI-generated)
              const transform = typeof t === 'string' ? { 'regex': t } : t;
              
              const type = transform['^'] !== undefined ? 'prefix' 
                       : transform['$'] !== undefined ? 'suffix' 
                       : (typeof transform === 'object' && transform !== null && 'regex' in transform) ? 'regex'
                       : (typeof transform === 'object' && transform !== null && 'replace' in transform) ? 'custom' : 'prefix';

              return (
                <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-fade-in bg-slate-800/30 p-2 rounded border border-slate-700/50">
                  <select
                    value={type}
                    onChange={(e) => {
                       const newType = e.target.value;
                       const newT: Record<string, string> = 
                                    newType === 'prefix' ? { '^': '' }
                                  : newType === 'suffix' ? { '$': '' }
                                  : newType === 'regex'  ? { 'regex': '' }
                                  : { 'replace': '', 'with': '' };
                       const newList = [...(extractor.post_replace || [])];
                       newList[i] = newT;
                       updateField('post_replace', newList);
                    }}
                    className="input-field text-xs py-1.5 w-[140px] border-slate-700 bg-slate-900/50"
                  >
                    <option value="prefix">Prefix (^)</option>
                    <option value="suffix">Suffix ($)</option>
                    <option value="regex">Regex Match</option>
                    <option value="custom">Replace</option>
                  </select>

                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={
                        type === 'prefix' ? "Prefix URL/Text..." :
                        type === 'suffix' ? "Suffix Text..." :
                        type === 'regex' ? "Regex Extract (e.g. (\\d+))" : 
                        "Find Pattern..."
                      }
                      value={type === 'prefix' ? transform['^'] : type === 'suffix' ? transform['$'] : type === 'regex' ? transform['regex'] : transform['replace'] || ''}
                      onChange={(e) => {
                        const newList = [...(extractor.post_replace || [])];
                        if (type === 'prefix') newList[i] = { '^': e.target.value };
                        else if (type === 'suffix') newList[i] = { '$': e.target.value };
                        else if (type === 'regex')  newList[i] = { 'regex': e.target.value };
                        else newList[i] = { ...newList[i], 'replace': e.target.value };
                        updateField('post_replace', newList);
                      }}
                      className={cn(
                        "input-field text-xs py-1.5 transition-all font-mono",
                        type === 'custom' ? "flex-[1.5]" : "flex-1"
                      )}
                    />

                    {type === 'custom' && (
                      <input
                        type="text"
                        placeholder="Replace..."
                        value={transform['with'] || ''}
                        onChange={(e) => {
                          const newList = [...(extractor.post_replace || [])];
                          newList[i] = { ...newList[i], 'with': e.target.value };
                          updateField('post_replace', newList);
                        }}
                        className="input-field text-xs py-1.5 flex-1 min-w-[70px]"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    title="Remove Step"
                    onClick={() => {
                       const newList = [...(extractor.post_replace || [])];
                       newList.splice(i, 1);
                       updateField('post_replace', newList.length > 0 ? newList : undefined);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {extractor.type === 'attribute' && (
            <div className="animate-fade-in">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">
                Attribute Name
              </label>
              <input
                type="text"
                value={extractor.attribute || ''}
                onChange={e => updateField('attribute', e.target.value)}
                placeholder="href, src, data-src..."
                className="input-field text-xs py-2.5"
              />
            </div>
          )}

          {extractor.type === 'nested' && (
            <div className="pt-2 animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                  Sub-Fields Structure
                </span>
                <button
                  onClick={() => {
                    const elements = extractor.elements || [];
                    const newElements = [...elements];
                    if (newElements.length === 0 && (extractor.isArray === true || String(extractor.isArray) === 'true')) {
                      newElements.push(createIndexExtractor());
                    }
                    newElements.push(createEmptyExtractor());
                    updateField('elements', newElements);
                  }}
                  className="px-3 py-1 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Component
                </button>
              </div>
              
              <div className="space-y-3">
                {(extractor.elements || []).map((child, idx) => (
                  <ExtractorBuilder
                    key={child.id || idx}
                    extractor={child}
                    depth={depth + 1}
                    onChange={(updated: Extractor) => {
                      const newElements = [...(extractor.elements || [])];
                      newElements[idx] = updated;
                      updateField('elements', newElements);
                    }}
                    onDelete={() => {
                      const newElements = (extractor.elements || []).filter((_: Extractor, i: number) => i !== idx);
                      updateField('elements', newElements);
                    }}
                  />
                ))}
                {(!extractor.elements || extractor.elements.length === 0) && (
                  <div className="py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                    <Layers className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Empty Container</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
