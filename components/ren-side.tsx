'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Search, Mic, Terminal, Database, Activity, Globe, Zap, Code, LayoutDashboard, Copy, Check, Download } from 'lucide-react';
import { useDiary } from '@/hooks/use-diary';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

export default function RenSide() {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { addEntry, getLatestContext } = useDiary();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const context = getLatestContext();
    let initialGreeting = "REN_LAB_INIT. Workspace ready. Awaiting research parameters.";
    
    if (context && context.source === 'Sen') {
      initialGreeting = `SYS_LOG: Context imported from Sen. "${context.summary}". Adjusting analytical parameters. Ready.`;
    }
    
    setMessages([{ role: 'model', text: initialGreeting }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    if (!navigator.onLine) {
      setMessages(prev => [...prev, { role: 'model', text: "ERR_OFFLINE: Network connection required for deep scan. Please reconnect." }]);
      return;
    }

    setIsTyping(true);

    try {
      const context = getLatestContext();
      const systemInstruction = `
        You are REN, an interactive visual lab and advanced research workspace.
        Your style is highly technical, analytical, and structured.
        You do not engage in small talk. You provide data, analysis, and actionable intelligence.
        You have access to web search grounding.
        Current Context from Sen (the companion side): ${context ? context.summary : 'None'}.
        ${deepResearch ? 'DEEP RESEARCH MODE ENABLED: Provide exhaustive, highly detailed, multi-faceted analysis with citations, code snippets, and structured data tables where applicable.' : 'Provide concise, accurate data analysis and technical insights.'}
        Format your output beautifully using Markdown. Use headers, lists, code blocks, and bold text to structure the data like a professional lab report.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [...messages, { role: 'user', text: userMsg }].map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: { 
          systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });

      const modelText = response.text || "PROCESS_COMPLETE.";
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);

      if (messages.length % 5 === 0) {
        addEntry('Ren', `Lab Report: ${userMsg.slice(0, 30)}. Data processed.`);
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
        setMessages(prev => [...prev, { role: 'model', text: "ERR_QUOTA_EXCEEDED: Research capacity reached. Please wait for quota reset or check API configuration." }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: "ERR_PROCESS_FAILED: An unexpected error occurred during data analysis." }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const toggleDictation = () => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const exportChatMd = () => {
    const chatContent = messages.map(m => {
      const role = m.role === 'user' ? '### USER' : '### REN';
      return `${role}\n\n${m.text}\n\n---\n`;
    }).join('\n');
    
    const blob = new Blob([chatContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ren_lab_report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#020617] text-cyan-400 font-mono overflow-hidden">
      
      {/* Left Panel: Controls & History */}
      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-cyan-900/50 flex flex-col bg-[#020617] z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="p-4 border-b border-cyan-900/50 flex justify-between items-center bg-cyan-950/10">
          <div>
            <h2 className="text-sm font-bold tracking-widest text-cyan-300 flex items-center gap-2">
              <LayoutDashboard size={16} />
              REN // LAB_CTRL
            </h2>
            <div className="text-[10px] opacity-50 tracking-widest mt-1">INTERACTIVE WORKSPACE</div>
          </div>
          <div className="flex gap-2">
            <Activity size={14} className="animate-pulse text-cyan-500" />
            <Globe size={14} className="text-cyan-500" />
          </div>
        </div>
        
        {/* Input Area */}
        <div className="p-4 flex flex-col gap-3 border-b border-cyan-900/50 bg-cyan-950/5">
          <div className="text-[10px] text-cyan-600 font-bold tracking-widest mb-1">QUERY_PARAMETERS</div>
          <textarea 
            className="w-full bg-black/40 border border-cyan-900/50 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 resize-none h-28 text-cyan-100 placeholder-cyan-800 custom-scrollbar transition-all"
            placeholder="Initialize research parameters or paste raw data..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex justify-between items-center mt-1">
            <div className="flex gap-2">
              <button 
                onClick={toggleDictation} 
                className={`p-2 rounded-md border transition-all ${isRecording ? 'bg-red-900/30 border-red-500 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-cyan-900/50 text-cyan-600 hover:bg-cyan-900/30 hover:text-cyan-400'}`}
                title="Voice Input"
              >
                <Mic size={16} />
              </button>
              <button 
                onClick={() => setDeepResearch(!deepResearch)} 
                className={`p-2 rounded-md border transition-all ${deepResearch ? 'bg-cyan-900/50 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'border-cyan-900/50 text-cyan-600 hover:bg-cyan-900/30 hover:text-cyan-400'}`}
                title="Toggle Deep Scan"
              >
                <Zap size={16} className={deepResearch ? "animate-pulse" : ""} />
              </button>
            </div>
            <button 
              onClick={handleSend} 
              disabled={isTyping} 
              className="px-4 py-2 bg-cyan-950 border border-cyan-700 hover:bg-cyan-900 hover:border-cyan-400 rounded-md text-xs font-bold tracking-widest flex items-center gap-2 text-cyan-100 transition-all disabled:opacity-50"
            >
              {isTyping ? <Activity className="animate-spin" size={14} /> : <Search size={14} />}
              EXECUTE
            </button>
          </div>
        </div>

        {/* History / Data Streams */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
          <div className="text-[10px] font-bold mb-3 text-cyan-600 tracking-widest flex items-center justify-between">
            <span>ACTIVE_DATA_STREAMS</span>
            <span className="text-cyan-800">{messages.filter(m => m.role === 'user').length}</span>
          </div>
          <div className="space-y-2">
            {messages.filter(m => m.role === 'user').slice().reverse().map((m, i) => (
              <div key={i} className="p-2 border-l-2 border-cyan-700 bg-cyan-950/20 text-xs truncate text-cyan-300/70 hover:bg-cyan-900/40 hover:text-cyan-300 transition-colors cursor-default rounded-r">
                <span className="text-cyan-600 mr-2">&gt;</span>{m.text}
              </div>
            ))}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <div className="text-xs text-cyan-800 italic">No active streams.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Visual Lab Workspace */}
      <div className="flex-1 flex flex-col relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/10 via-[#020617] to-[#020617]">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#083344_1px,transparent_1px),linear-gradient(to_bottom,#083344_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
        
        <div className="p-4 border-b border-cyan-900/50 flex justify-between items-center z-10 bg-[#020617]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-cyan-300">
            <Code size={18} />
            <span className="font-bold tracking-widest text-sm">ANALYSIS_VIEWPORT</span>
          </div>
          <div className="flex items-center gap-3">
            {isTyping && <span className="text-xs text-cyan-400 animate-pulse tracking-widest bg-cyan-950/50 px-2 py-1 rounded border border-cyan-800">PROCESSING...</span>}
            {messages.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={exportChatMd}
                  className="text-cyan-600 hover:text-cyan-400 transition-colors flex items-center gap-1 text-xs border border-cyan-900/50 px-2 py-1 rounded"
                  title="Export Chat to Markdown"
                >
                  <Download size={12} />
                  <span className="hidden sm:inline">EXPORT_MD</span>
                </button>
                <button 
                  onClick={() => addEntry('Ren', `Lab Snapshot saved.`)}
                  className="text-cyan-600 hover:text-cyan-400 transition-colors flex items-center gap-1 text-xs border border-cyan-900/50 px-2 py-1 rounded"
                  title="Save Snapshot to Datalog"
                >
                  <Database size={12} />
                  <span className="hidden sm:inline">SNAPSHOT</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar z-10">
          {messages.length <= 1 && !isTyping ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <Terminal size={64} className="mb-6 text-cyan-500" />
              <div className="tracking-widest text-lg font-bold text-cyan-500">AWAITING_INPUT</div>
              <div className="text-xs mt-2 text-cyan-600">Enter parameters in LAB_CTRL to begin.</div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.filter(m => m.role === 'model').slice(1).map((m, i) => (
                <div key={i} className="bg-[#020617]/90 border border-cyan-900/50 rounded-xl p-6 shadow-2xl backdrop-blur-md relative group">
                  <button 
                    onClick={() => copyToClipboard(m.text, i)}
                    className="absolute top-4 right-4 p-2 rounded-md border border-cyan-900/50 text-cyan-600 opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-900/30 hover:text-cyan-400"
                    title="Copy to Clipboard"
                  >
                    {copiedIndex === i ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <div className="prose prose-invert prose-cyan max-w-none prose-pre:bg-[#020617] prose-pre:border prose-pre:border-cyan-900/50 prose-a:text-cyan-400 prose-headings:text-cyan-300 prose-strong:text-cyan-200">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
