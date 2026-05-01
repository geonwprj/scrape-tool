import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { pruneHtml } from '../lib/htmlUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'bot';
  content: string;
}

const ThinkingBlock: React.FC<{ content: string }> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="mb-3 border-l-2 border-slate-300 dark:border-slate-600 pl-3">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-1"
      >
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>Thinking Process</span>
      </button>
      {isExpanded && (
        <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-2 whitespace-pre-wrap leading-relaxed animate-fade-in">
          {content}
        </div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const renderContent = () => {
    if (message.role === 'user') {
      return (
        <div className="whitespace-pre-wrap break-words overflow-hidden">{message.content}</div>
      );
    }

    const parts = message.content.split(/(<think>[\s\S]*?<\/think>)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('<think>')) {
        const thinkContent = part.replace('<think>', '').replace('</think>', '').trim();
        return <ThinkingBlock key={index} content={thinkContent} />;
      }
      return (
        <div key={index} className="whitespace-pre-wrap break-words overflow-hidden">{part}</div>
      );
    });
  };

  return (
    <div className={cn(
      "flex animate-fade-in",
      message.role === 'user' ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[90%] px-4 py-3 rounded-2xl text-sm shadow-sm border",
        message.role === 'user' 
          ? "bg-primary-600 text-white rounded-tr-none border-primary-500" 
          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-slate-700"
      )}>
        {renderContent()}
      </div>
    </div>
  );
};

export const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Hello! I am your Scraper AI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleTrigger = (e: any) => {
      const { url, site, pageType, html, pruneEnabled } = e.detail;
      setIsOpen(true);
      
      const processedHtml = pruneEnabled ? pruneHtml(html) : html;
      const prompt = `url: ${url}\nsite type: ${site}\npage type: ${pageType}\nhtml: ${processedHtml?.substring(0, 15000) || 'No HTML content available'}\n\nCRITICAL: Return ONLY the JSON configuration. DO NOT output conversational text, markdown, or guides.`;
      sendMessage(prompt, true);
    };

    window.addEventListener('AI_ANALYZE_TRIGGER', handleTrigger);
    return () => window.removeEventListener('AI_ANALYZE_TRIGGER', handleTrigger);
  }, []);

  const sendMessage = async (content: string, isAutoAnalyze = false) => {
    if (!content.trim() || isLoading) return;

    // The message we SHOW in the UI
    const displayMsg: Message = { 
      role: 'user', 
      content: isAutoAnalyze ? `🔍 Analyzing ${content.split('\n')[0]}...` : content 
    };
    
    // The message we SEND to the API (must be the full prompt for analysis)
    const apiMsg = {
      role: 'user',
      content: content
    };
    
    setMessages(prev => [...prev, displayMsg]);
    if (!isAutoAnalyze) setInput('');

    setIsLoading(true);
    
    // Add an empty bot message to stream into
    setMessages(prev => [...prev, { role: 'bot', content: '' }]);

    // Stateless Analysis: If auto-analyzing, don't send history
    const apiMessages = isAutoAnalyze 
      ? [apiMsg] 
      : [
          ...messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
          apiMsg
        ];

    try {
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!response.ok) throw new Error('Failed to connect to AI');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader found');

      const decoder = new TextDecoder();
      let fullContent = '';
      let reasoningContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last partial line in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.reasoning_content) {
                reasoningContent += data.reasoning_content;
              }
              if (data.content) {
                fullContent += data.content;
              }

              // Update the UI with both segments correctly formatted
              setMessages(prev => {
                const newMsgs = [...prev];
                let displayStr = '';
                if (reasoningContent) {
                  displayStr = `<think>\n${reasoningContent}\n</think>\n\n`;
                }
                displayStr += fullContent;
                newMsgs[newMsgs.length - 1].content = displayStr;
                return newMsgs;
              });
              
              if (data.error) throw new Error(data.error);
            } catch (e) {
              console.error('Error parsing SSE data line:', line, e);
            }
          }
        }
      }

      // If it was an auto-analysis, try to extract JSON and send back to Scraper
      if (isAutoAnalyze) {
        let jsonStr = fullContent;
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }

        try {
          // Attempt to find the first { and last }
          const start = jsonStr.indexOf('{');
          const end = jsonStr.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            const data = JSON.parse(jsonStr.substring(start, end + 1));
            // Dispatch result back to Scraper
            window.dispatchEvent(new CustomEvent('AI_ANALYZE_COMPLETE', { 
              detail: { 
                items: data.items,
                template: {
                  url: data.url,
                  query: data.query,
                  site: data.site,
                  page: data.page
                }
              } 
            }));
            
            // Auto close after success
            setTimeout(() => {
              setIsOpen(false);
              setMessages(prev => [...prev, { role: 'bot', content: '✅ Analysis complete! Rules updated in the Scraper tab.' }]);
            }, 1000);
          }
        } catch (e: any) {
          console.error('Failed to parse analysis result from stream', e);
          setMessages(prev => [...prev, { role: 'bot', content: `❌ Error parsing analysis result: ${e.message}` }]);
        }
      }

    } catch (error: any) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = `Error: ${error.message}`;
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-2xl shadow-primary-500/40 z-50 transition-all active:scale-95 group"
      >
        <Bot className="w-6 h-6" />
        <div className="absolute right-0 top-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" />
      </button>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] glass-panel z-50 flex flex-col shadow-2xl border-white/10 transition-all duration-300 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-primary-600/10 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-primary-500 rounded-lg">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">AI Agent</h3>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {isLoading && messages[messages.length-1].role === 'user' && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex space-x-1">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        <form 
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-400 text-white rounded-lg transition-all"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-[10px] text-center text-slate-500 mt-2 font-medium">
          AI can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  );
};
