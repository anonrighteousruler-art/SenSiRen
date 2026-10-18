'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Search, Mic, Terminal, Database, Activity, Globe, Zap, Code, LayoutDashboard, Copy, Check, Download, Settings2, X, Sliders, Cpu, Microscope, Volume2, Square, GraduationCap } from 'lucide-react';
import { useDiary, type DiaryKind } from '@/hooks/use-diary';
import { useDictation, useReadAloud, toSpeakable } from '@/hooks/use-speech';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

// Study tools turn the latest lab response into learning material.
const STUDY_TOOLS = [
  { id: 'summary', label: 'Summarize', prompt: 'Summarize your previous response as 5 key takeaways a student should remember.' },
  { id: 'flashcards', label: 'Flashcards', prompt: 'Turn your previous response into 6-8 study flashcards. Format each as **Q:** question on one line and **A:** answer on the next.' },
  { id: 'quiz', label: 'Quiz me', prompt: 'Write a 5-question multiple-choice quiz on your previous response. Put the answer key at the end under a "Answers" heading so I can test myself first.' },
  { id: 'simplify', label: 'Explain simply', prompt: 'Re-explain your previous response as if teaching a curious beginner, using one everyday analogy.' },
] as const;

export default function RenSide() {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Customization State
  const [showSettings, setShowSettings] = useState(false);
  const [verbosity, setVerbosity] = useState<'concise' | 'detailed' | 'exhaustive'>('detailed');
  const [technicalLevel, setTechnicalLevel] = useState<'fundamental' | 'advanced' | 'postdoc'>('advanced');
  const [labTheme, setLabTheme] = useState<'cyan' | 'amber' | 'emerald' | 'monochrome'>('cyan');
  const [customInstructions, setCustomInstructions] = useState('');
  
  const { addEntry, getLatestContext } = useDiary();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const context = getLatestContext('Ren');
    let initialGreeting = "REN_LAB_INIT. Workspace ready. Awaiting research parameters.";
    
    if (context) {
      initialGreeting = `SYS_LOG: Context imported from ${context.source === 'Sen' ? 'Sen' : 'your diary'}. "${context.summary}". Adjusting analytical parameters. Ready.`;
    }
    
    setMessages([{ role: 'model', text: initialGreeting }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (override?: string, kind: DiaryKind = 'research') => {
    const userMsg = (override ?? input).trim();
    if (!userMsg || isTyping) return;

    if (override === undefined) setInput('');
    dictation.stop();
    readAloud.stop();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    if (!navigator.onLine) {
      setMessages(prev => [...prev, { role: 'model', text: "ERR_OFFLINE: Network connection required for deep scan. Please reconnect." }]);
      return;
    }

    setIsTyping(true);

    try {
      const context = getLatestContext('Ren');
      const verbosityDesc = verbosity === 'concise' ? "Keep it strictly to the core facts. No fluff." : verbosity === 'exhaustive' ? "Provide a complete pedagogical breakdown with deep historical and technical context." : "Balanced, insightful analysis.";
      const techDesc = technicalLevel === 'fundamental' ? "Explain as if to someone new to the subject." : technicalLevel === 'postdoc' ? "Use highly specialized terminology and expect deep domain knowledge." : "Professional engineering level precision.";

      const systemInstruction = `
        You are REN, an interactive visual lab and advanced research workspace.
        Your style is highly technical, analytical, and structured.
        You provide data, analysis, and actionable intelligence.
        Output Verbosity: ${verbosityDesc}
        Target Technical Level: ${techDesc}
        
        You have access to web search grounding.
        You also act as a study partner: favour clear structure, worked examples and checks for understanding.
        Latest entry in the shared diary (from ${context ? context.source : 'nobody'}): ${context ? context.summary : 'None'}.
        ${deepResearch ? 'DEEP RESEARCH MODE ENABLED: Provide exhaustive, multi-faceted analysis with citations, code snippets, and structured data tables.' : 'Provide accurate data analysis and technical insights.'}
        Format your output beautifully using Markdown. Use headers, lists, code blocks, and bold text.
        ${customInstructions ? `USER_SPECIFIC_RESEARCH_PROTOCOLS: ${customInstructions}` : ''}
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

      const firstLine = toSpeakable(modelText).slice(0, 90);
      addEntry('Ren', kind === 'study'
        ? `Study session: ${userMsg.split('.')[0]}. ${firstLine}…`
        : `Researched "${userMsg.slice(0, 60)}". ${firstLine}…`, kind);
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

  // Continuous dictation: everything you say is appended to the query box until you stop.
  const dictation = useDictation({
    continuous: true,
    onFinal: (text) => setInput(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text)),
  });
  const isRecording = dictation.isListening;
  const readAloud = useReadAloud();

  const runStudyTool = (prompt: string) => handleSend(prompt, 'study');

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

  const themes: Record<string, { primary: string, border: string, bg: string, text: string }> = {
    cyan: { primary: 'text-cyan-400', border: 'border-cyan-900/50', bg: 'bg-[#020617]', text: 'prose-cyan' },
    amber: { primary: 'text-amber-400', border: 'border-amber-900/50', bg: 'bg-[#170c02]', text: 'prose-amber' },
    emerald: { primary: 'text-emerald-400', border: 'border-emerald-900/50', bg: 'bg-[#02170c]', text: 'prose-emerald' },
    monochrome: { primary: 'text-slate-200', border: 'border-slate-800', bg: 'bg-[#0a0a0a]', text: 'prose-slate' },
  };

  const currentTheme = themes[labTheme];
  const hasResponse = messages.filter(m => m.role === 'model').length > 1;

  return (
    <div className={`flex flex-col md:flex-row h-full font-mono overflow-hidden transition-colors duration-700 ${currentTheme.bg} ${currentTheme.primary}`}>
      
      {/* Left Panel: Controls & History */}
      <div className={`w-full md:w-1/3 border-b md:border-b-0 md:border-r ${currentTheme.border} flex flex-col bg-black/40 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]`}>
        <div className={`p-4 border-b ${currentTheme.border} flex justify-between items-center`}>
          <div>
            <h2 className={`text-sm font-bold tracking-widest flex items-center gap-2 ${currentTheme.primary}`}>
              <LayoutDashboard size={16} />
              REN // LAB_CTRL
            </h2>
            <div className="text-[10px] opacity-50 tracking-widest mt-1 uppercase">Research parameters set to: {technicalLevel}</div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded transition-all ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Settings2 size={16} />
            </button>
            <Activity size={14} className={`animate-pulse ${currentTheme.primary}`} />
          </div>
        </div>
        
        {/* Settings Panel Overlay */}
        {showSettings && (
          <div className={`p-4 border-b ${currentTheme.border} space-y-4 bg-black/60 animate-in slide-in-from-top duration-300 overflow-hidden`}>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500 mb-2 block uppercase">Analysis // Verbosity</label>
              <div className="grid grid-cols-3 gap-2">
                {['concise', 'detailed', 'exhaustive'].map(v => (
                  <button 
                    key={v}
                    onClick={() => setVerbosity(v as any)}
                    className={`text-[9px] py-1 transition-all border uppercase ${verbosity === v ? `border-current ${currentTheme.primary} bg-white/5` : 'border-slate-800 text-slate-600'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500 mb-2 block uppercase">Technical // Threshold</label>
              <div className="grid grid-cols-3 gap-2">
                {['fundamental', 'advanced', 'postdoc'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setTechnicalLevel(t as any)}
                    className={`text-[9px] py-1 transition-all border uppercase ${technicalLevel === t ? `border-current ${currentTheme.primary} bg-white/5` : 'border-slate-800 text-slate-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500 mb-2 block uppercase">Workspace // Environment</label>
              <div className="grid grid-cols-4 gap-1">
                {Object.keys(themes).map(t => (
                  <button 
                    key={t}
                    onClick={() => setLabTheme(t as any)}
                    className={`text-[9px] py-1 transition-all border uppercase ${labTheme === t ? `border-current ${currentTheme.primary} bg-white/5` : 'border-slate-800 text-slate-600'}`}
                  >
                    {t.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-slate-500 mb-2 block uppercase">Root // Research Protocols</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Define specific analytical constraints, mandatory citation styles, or domain-specific logic..."
                className={`w-full h-24 bg-black/40 border ${currentTheme.border} rounded p-2 text-[10px] focus:outline-none focus:border-current custom-scrollbar resize-none font-mono ${currentTheme.primary}`}
              />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className={`p-4 flex flex-col gap-3 border-b ${currentTheme.border} bg-white/[0.02]`}>
          <div className="text-[10px] text-cyan-600 font-bold tracking-widest mb-1">QUERY_PARAMETERS</div>
          <textarea 
            aria-label="Research query"
            className="w-full bg-black/40 border border-cyan-900/50 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 resize-none h-28 text-cyan-100 placeholder-cyan-800 custom-scrollbar transition-all"
            placeholder="Initialize research parameters or paste raw data..."
            value={input}
            onChange={e => setInput(e.target.value)}
            readOnly={isRecording}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          {isRecording && (
            <div className="text-[10px] text-red-400 tracking-widest -mt-1">
              DICTATING… {dictation.interim && <span className="text-red-300/70 normal-case italic">{dictation.interim}</span>}
            </div>
          )}
          <div className="flex justify-between items-center mt-1">
            <div className="flex gap-2">
              <button 
                onClick={dictation.toggle} 
                className={`p-2 rounded-md border transition-all ${isRecording ? 'bg-red-900/30 border-red-500 text-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-cyan-900/50 text-cyan-600 hover:bg-cyan-900/30 hover:text-cyan-400'}`}
                title={isRecording ? "Stop dictation" : "Dictate (continuous)"}
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
              onClick={() => handleSend()} 
              disabled={isTyping || !input.trim()} 
              className="px-4 py-2 bg-cyan-950 border border-cyan-700 hover:bg-cyan-900 hover:border-cyan-400 rounded-md text-xs font-bold tracking-widest flex items-center gap-2 text-cyan-100 transition-all disabled:opacity-50"
            >
              {isTyping ? <Activity className="animate-spin" size={14} /> : <Search size={14} />}
              EXECUTE
            </button>
          </div>
        </div>

        {/* Study Tools */}
        <div className={`p-4 border-b ${currentTheme.border}`}>
          <div className="text-[10px] font-bold mb-2 text-cyan-600 tracking-widest flex items-center gap-2">
            <GraduationCap size={12} /> STUDY_TOOLS
          </div>
          <div className="grid grid-cols-2 gap-2">
            {STUDY_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => runStudyTool(tool.prompt)}
                disabled={isTyping || !hasResponse}
                className="text-[10px] py-1.5 border border-cyan-900/50 rounded text-cyan-500 hover:bg-cyan-900/30 hover:text-cyan-300 uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                title={hasResponse ? tool.prompt : 'Run a query first'}
              >
                {tool.label}
              </button>
            ))}
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
              <button key={i} onClick={() => setInput(m.text)} title="Reuse this query" className="block w-full text-left p-2 border-l-2 border-cyan-700 bg-cyan-950/20 text-xs truncate text-cyan-300/70 hover:bg-cyan-900/40 hover:text-cyan-300 transition-colors rounded-r">
                <span className="text-cyan-600 mr-2">&gt;</span>{m.text}
              </button>
            ))}
            {messages.filter(m => m.role === 'user').length === 0 && (
              <div className="text-xs text-cyan-800 italic">No active streams.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Visual Lab Workspace */}
      <div className={`flex-1 flex flex-col relative transition-colors duration-1000 overflow-hidden`}>
        {/* Background Overlay */}
        <div className={`absolute inset-0 opacity-10 pointer-events-none ${labTheme === 'amber' ? 'bg-amber-500' : labTheme === 'emerald' ? 'bg-emerald-500' : labTheme === 'monochrome' ? 'bg-white' : 'bg-cyan-500'}`} />
        
        {/* Grid Background */}
        <div className={`absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none`} />
        
        <div className={`p-4 border-b ${currentTheme.border} flex justify-between items-center z-10 bg-black/40 backdrop-blur-md`}>
          <div className={`flex items-center gap-3 ${currentTheme.primary}`}>
            {labTheme === 'amber' ? <Sliders size={18} /> : labTheme === 'emerald' ? <Microscope size={18} /> : labTheme === 'monochrome' ? <Cpu size={18} /> : <Code size={18} />}
            <span className="font-bold tracking-widest text-sm uppercase">{labTheme}_LOG // ANALYSIS_VIEWPORT</span>
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
                  onClick={() => {
                    const last = [...messages].reverse().find(m => m.role === 'model');
                    addEntry('Ren', `Lab snapshot: ${last ? toSpeakable(last.text).slice(0, 140) : 'empty workspace'}`, 'snapshot');
                  }}
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
            <div className="h-full flex flex-col items-center justify-center">
              <div className="opacity-20 flex flex-col items-center">
                <Terminal size={64} className="mb-6 text-cyan-500" />
                <div className="tracking-widest text-lg font-bold text-cyan-500">AWAITING_INPUT</div>
                <div className="text-xs mt-2 text-cyan-600">Enter parameters in LAB_CTRL to begin.</div>
              </div>
              {messages[0] && <div className="text-xs mt-6 max-w-md text-center text-cyan-400/70">{messages[0].text}</div>}
            </div>
          ) : (
            <div className="space-y-8">
              {messages.filter(m => m.role === 'model').slice(1).map((m, i) => (
                <div key={i} className={`bg-black/40 border ${currentTheme.border} rounded-xl p-6 shadow-2xl backdrop-blur-md relative group transition-all`}>
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={() => readAloud.toggle(`ren-${i}`, m.text)}
                      className={`p-2 rounded-md border ${currentTheme.border} transition-all hover:bg-white/5 ${readAloud.speakingId === `ren-${i}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                      title={readAloud.speakingId === `ren-${i}` ? 'Stop reading' : 'Read aloud'}
                    >
                      {readAloud.speakingId === `ren-${i}` ? <Square size={14} className={currentTheme.primary} /> : <Volume2 size={14} className="text-slate-500" />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(m.text, i)}
                      className={`p-2 rounded-md border ${currentTheme.border} opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-white/5`}
                      title="Copy to Clipboard"
                    >
                      {copiedIndex === i ? <Check size={14} className={currentTheme.primary} /> : <Copy size={14} className="text-slate-500" />}
                    </button>
                  </div>
                  <div className={`prose prose-invert max-w-none prose-pre:bg-black/60 prose-pre:border ${currentTheme.border} ${currentTheme.text} prose-headings:font-bold prose-headings:tracking-tighter prose-strong:text-white`}>
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
