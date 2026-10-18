'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { GoogleGenAI } from '@google/genai';
import { Mic, Volume2, VolumeX, Heart, Settings2, Palette, Activity, X, Play, Radio, Code, BookOpen, Send, RotateCcw } from 'lucide-react';
import { useDiary } from '@/hooks/use-diary';
import { useDictation, toSpeakable } from '@/hooks/use-speech';
import ReactMarkdown from 'react-markdown';

// WebGL can't render on the server; load the 3D companion on the client only.
const SenCharacter = dynamic(() => import('@/components/sen-character'), { ssr: false });

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

const WARDROBES = [
  { id: 'rose', name: 'Rose Gold', color: '#ff0844', roughness: 0.1, metalness: 0.8 },
  { id: 'amethyst', name: 'Amethyst', color: '#a78bfa', roughness: 0.2, metalness: 0.7 },
  { id: 'sapphire', name: 'Sapphire', color: '#38bdf8', roughness: 0.1, metalness: 0.9 },
  { id: 'pearl', name: 'Pearl', color: '#f8fafc', roughness: 0.3, metalness: 0.5 },
  { id: 'obsidian', name: 'Obsidian', color: '#0f172a', roughness: 0.1, metalness: 1.0 },
];

const NEURAL_VOICES = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'];

export default function SenSide() {
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [mood, setMood] = useState('calm');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [draft, setDraft] = useState('');
  const { addEntry, getLatestContext } = useDiary();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Customization State
  const [showSettings, setShowSettings] = useState(false);
  const [motionSpeed, setMotionSpeed] = useState(1);
  const [distortion, setDistortion] = useState(1);
  const [wardrobe, setWardrobe] = useState(WARDROBES[0]);
  const [personaTone, setPersonaTone] = useState(0.5); // 0: Mentoring/Caring, 1: Flirty/Charming
  const [chatStyle, setChatStyle] = useState<'glass' | 'sharp' | 'neon'>('glass');
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [customInstructions, setCustomInstructions] = useState('');

  // Chatterbox Voice Settings
  const [voiceEngine, setVoiceEngine] = useState<'neural' | 'standard'>('neural');
  const [neuralVoice, setNeuralVoice] = useState('Kore');
  const [browserVoice, setBrowserVoice] = useState('');
  const [availableBrowserVoices, setAvailableBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePitch, setVoicePitch] = useState(1.2);
  const [voiceRate, setVoiceRate] = useState(0.95);

  useEffect(() => {
    const context = getLatestContext('Sen');
    let initialGreeting = "Hi there, beautiful. I'm Sen. I'm here to listen, guide, and maybe make you smile. Tap me and tell me how you're feeling.";
    
    if (context && context.source === 'Ren') {
      initialGreeting = `I see you've been busy in the lab with Ren. "${context.summary}". That sounds intense. Come here, take a breath with me. Tap to talk.`;
    } else if (context && context.source === 'You') {
      initialGreeting = `I read your last diary note: "${context.summary}". Want to talk about it? Tap me whenever you're ready.`;
    }
    
    setMessages([{ role: 'model', text: initialGreeting }]);
    
    // Load Browser Voices
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableBrowserVoices(voices);
        if (voices.length > 0 && !browserVoice) {
          const defaultVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha')) || voices[0];
          setBrowserVoice(defaultVoice?.name || voices[0].name);
        }
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initAudio = () => {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playPCM = async (base64Data: string) => {
    initAudio();
    if (!audioCtxRef.current) return;

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtxRef.current.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtxRef.current.destination);
      
      source.onended = () => setIsSpeaking(false);
      setIsSpeaking(true);
      source.start();
      audioSourceRef.current = source;
    } catch (e) {
      console.error("PCM Playback error:", e);
      setIsSpeaking(false);
    }
  };

  const speak = async (text: string) => {
    if (isMuted || typeof window === 'undefined') return;
    
    if (voiceEngine === 'neural') {
      try {
        setIsSpeaking(true);
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: toSpeakable(text) }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: neuralVoice },
              },
            },
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          await playPCM(base64Audio);
        } else {
          setIsSpeaking(false);
        }
      } catch (e) {
        console.error("Neural TTS error:", e);
        setIsSpeaking(false);
      }
    } else {
      // Standard Browser TTS
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
      utteranceRef.current = utterance; // Prevent GC
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      
      if (browserVoice) {
        const voice = availableBrowserVoices.find(v => v.name === browserVoice);
        if (voice) utterance.voice = voice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    
    if (!navigator.onLine) {
      setMessages(prev => [...prev, { role: 'model', text: "Oh no, it seems we've lost connection. I'm still here, but I can't reach my deeper thoughts until we're back online." }]);
      return;
    }

    setIsTyping(true);

    try {
      const context = getLatestContext('Sen');
      const personaDescription = personaTone > 0.7 
        ? "highly flirty, charming, playfully teasing, and magnetic. You are the user's ultimate distraction." 
        : personaTone < 0.3 
          ? "deeply therapeutic, professional yet warm, focused on mental clarity and growth. A wise mentor."
          : "a balanced mix of a supportive confidante and a charming companion. Warm and empathetic.";

      const systemInstruction = `
        You are Sen, a therapeutic, caring, and social AI companion. 
        You are currently interacting via PURE VOICE. Keep your responses conversational, natural, and relatively concise (like a real spoken conversation).
        Your current persona is ${personaDescription}
        You guide the user through their emotions and goals with a playful yet caring touch.
        Latest entry in the shared diary (from ${context ? context.source : 'nobody'}): ${context ? context.summary : 'None'}.
        You have access to Google Search. Use it to find comforting poems, breathing exercises, or uplifting news if needed.
        IMPORTANT: Your tone must strictly match your persona description.
        ${customInstructions ? `USER_SPECIFIC_GUIDELINES: ${customInstructions}` : ''}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [...messages, { role: 'user', text }].map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: { 
          systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });

      const modelText = response.text || "I'm always here for you.";
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
      
      if (modelText.toLowerCase().includes('happy') || modelText.toLowerCase().includes('excited') || modelText.toLowerCase().includes('wink')) setMood('energetic');
      else setMood('calm');

      addEntry('Sen', `Talked about "${clip(text, 80)}". Sen: ${clip(modelText, 100)}`, 'conversation');

      speak(modelText);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
        setMessages(prev => [...prev, { role: 'model', text: "I'm so sorry, but I've hit my thinking limit for a moment (Quota Exceeded). Please wait a little bit and try again, I'll be right here waiting for you." }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: "I'm having a little trouble processing that right now. Could you try again for me?" }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const dictation = useDictation({ onFinal: (transcript) => handleSend(transcript) });
  const isRecording = dictation.isListening;

  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsSpeaking(false);
  };

  const toggleDictation = () => {
    if (typeof window === 'undefined') return;
    initAudio(); // Initialize audio context on user gesture
    if (!isRecording) stopSpeaking();
    dictation.toggle();
  };

  const sendDraft = () => {
    const text = draft;
    setDraft('');
    initAudio();
    handleSend(text);
  };

  const testVoice = () => {
    initAudio();
    speak("Hi there. This is how I sound right now. Do you like it?");
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-slate-950">
      
      {/* Colorful Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-rose-600/40 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-fuchsia-600/40 rounded-full mix-blend-screen filter blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] bg-violet-600/30 rounded-full mix-blend-screen filter blur-[90px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] bg-orange-500/20 rounded-full mix-blend-screen filter blur-[80px] animate-pulse" style={{ animationDuration: '9s', animationDelay: '3s' }} />
      </div>

      {/* Settings Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all duration-300 ${showSettings ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'bg-black/20 text-white/60 hover:text-white hover:bg-black/40 border border-white/10'}`}
        >
          {showSettings ? <X size={20} /> : <Settings2 size={20} />}
        </button>
      </div>

      {/* Settings Panel Overlay */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-80 max-h-[80vh] overflow-y-auto custom-scrollbar glass p-5 rounded-2xl border border-rose-500/20 shadow-[0_8px_32px_rgba(225,29,72,0.15)] backdrop-blur-xl z-20 animate-in slide-in-from-right-4 fade-in duration-200">
          <h3 className="text-sm font-display uppercase tracking-widest text-rose-300 mb-4 flex items-center gap-2">
            <Settings2 size={16} /> Sen Preferences
          </h3>
          
          <div className="space-y-6">
            {/* Chatterbox Voice Engine */}
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <label className="text-xs text-rose-300 uppercase tracking-wider flex items-center justify-between mb-3 font-bold">
                <div className="flex items-center gap-1"><Radio size={14} /> Chatterbox Engine</div>
                <button onClick={testVoice} className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                  <Play size={10} /> Test
                </button>
              </label>
              
              <div className="flex bg-black/40 rounded-lg p-1 mb-4">
                <button 
                  onClick={() => setVoiceEngine('neural')}
                  className={`flex-1 text-[10px] py-1.5 rounded-md uppercase tracking-wider transition-all ${voiceEngine === 'neural' ? 'bg-rose-500 text-white shadow-md' : 'text-white/50 hover:text-white/80'}`}
                >
                  Neural (HQ)
                </button>
                <button 
                  onClick={() => setVoiceEngine('standard')}
                  className={`flex-1 text-[10px] py-1.5 rounded-md uppercase tracking-wider transition-all ${voiceEngine === 'standard' ? 'bg-rose-500 text-white shadow-md' : 'text-white/50 hover:text-white/80'}`}
                >
                  Standard
                </button>
              </div>

              {voiceEngine === 'neural' ? (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest">Neural Persona</label>
                  <div className="grid grid-cols-2 gap-2">
                    {NEURAL_VOICES.map(v => (
                      <button
                        key={v}
                        onClick={() => setNeuralVoice(v)}
                        className={`text-xs py-2 rounded-lg border transition-all ${neuralVoice === v ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-black/20 border-white/10 text-white/60 hover:border-white/30'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-white/40 mt-2 italic">* Neural voices use Gemini TTS for ultra-realistic speech.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1 block">Browser Voice</label>
                    <select 
                      value={browserVoice} 
                      onChange={(e) => setBrowserVoice(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white/80 focus:outline-none focus:border-rose-500"
                    >
                      {availableBrowserVoices.map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                      <span>Pitch</span>
                      <span>{voicePitch.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      value={voicePitch} onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                      <span>Rate</span>
                      <span>{voiceRate.toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="1.5" step="0.05" 
                      value={voiceRate} onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Wardrobe */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Palette size={12} /> Orb Wardrobe
              </label>
              <div className="flex flex-wrap gap-2">
                {WARDROBES.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setWardrobe(w)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${wardrobe.id === w.id ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: w.color }}
                    title={w.name}
                  />
                ))}
              </div>
            </div>

            {/* Motion Controls */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Activity size={12} /> Orb Dynamics
              </label>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>Pulse Speed</span>
                    <span>{motionSpeed.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="3" step="0.1" 
                    value={motionSpeed} onChange={(e) => setMotionSpeed(parseFloat(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Persona Tone */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Heart size={12} /> Persona Tone
              </label>
              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between text-[10px] text-white/40 mb-1">
                  <span>Mentoring</span>
                  <span>Flirty</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={personaTone} onChange={(e) => setPersonaTone(parseFloat(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>

            {/* Chat Appearance */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Palette size={12} /> Chat Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['glass', 'sharp', 'neon'].map(s => (
                  <button
                    key={s}
                    onClick={() => setChatStyle(s as any)}
                    className={`text-[10px] py-2 rounded-lg border transition-all uppercase tracking-widest ${chatStyle === s ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(225,29,72,0.2)]' : 'bg-black/20 border-white/10 text-white/60'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Style */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Code size={12} /> Font Identity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['sans', 'serif', 'mono'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFontStyle(f as any)}
                    className={`text-[10px] py-1 rounded-lg border transition-all uppercase tracking-widest ${fontStyle === f ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-black/20 border-white/10 text-white/60'}`}
                    style={{ fontFamily: f === 'mono' ? 'var(--font-mono)' : f === 'serif' ? 'serif' : 'var(--font-sans)' }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Persona Guidelines */}
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1 mb-2">
                <BookOpen size={12} /> Root Persona Directives
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Inject custom behavioral protocols or specific boundary definitions here..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white/80 focus:outline-none focus:border-rose-500 custom-scrollbar resize-none font-mono"
              />
              <p className="text-[9px] text-white/20 mt-2 italic tracking-tighter uppercase font-mono">Changes apply to next interaction loop.</p>
            </div>

          </div>
        </div>
      )}

      {/* 3D Companion */}
      <div className="flex-1 relative flex flex-col items-center justify-center z-10 min-h-0">
        <div
          role="button"
          tabIndex={0}
          aria-label={isRecording ? 'Stop listening' : 'Talk to Sen'}
          onClick={toggleDictation}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDictation(); } }}
          className={`relative w-full max-w-md h-full max-h-[420px] cursor-pointer transition-transform duration-500 focus:outline-none ${isRecording ? 'scale-95' : 'hover:scale-[1.02]'}`}
        >
          <div
            className={`absolute inset-[20%] rounded-full blur-[70px] opacity-50 transition-all duration-700 pointer-events-none ${isSpeaking ? 'scale-125 animate-pulse' : isRecording ? 'scale-110 animate-pulse' : 'scale-100'}`}
            style={{ backgroundColor: wardrobe.color, animationDuration: `${1 / motionSpeed}s` }}
          />
          <SenCharacter
            mood={mood}
            isSpeaking={isSpeaking}
            isListening={isRecording}
            speedMultiplier={motionSpeed}
            distortMultiplier={distortion}
            wardrobe={wardrobe}
          />
        </div>
        
        <div className="text-center z-10 px-4">
          <p className="text-white/80 font-display tracking-widest uppercase text-sm mb-1 font-bold flex items-center justify-center gap-2">
            {isRecording ? <Mic size={14} className="animate-pulse" /> : isTyping ? <Activity size={14} className="animate-spin" /> : null}
            {isRecording ? "Listening..." : isTyping ? "Thinking..." : isSpeaking ? "Speaking..." : "Tap Sen to speak"}
          </p>
          {isRecording && dictation.interim && (
            <p className="text-xs text-white/50 italic max-w-md mx-auto">{dictation.interim}</p>
          )}
        </div>
      </div>

      {/* Subtitles / Chat History */}
      <div className="h-1/3 w-full max-w-2xl mx-auto px-4 pb-6 z-10 flex flex-col justify-end">
        <div className={`p-5 rounded-3xl border shadow-[0_8px_32px_rgba(225,29,72,0.15)] backdrop-blur-xl flex flex-col h-full transition-all duration-500 
          ${chatStyle === 'glass' ? 'glass border-rose-500/20 rounded-3xl' : ''}
          ${chatStyle === 'sharp' ? 'bg-black/40 border-white/10 rounded-none' : ''}
          ${chatStyle === 'neon' ? 'bg-black/80 border-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)] rounded-xl' : ''}
        `}
        style={{ fontFamily: fontStyle === 'mono' ? 'var(--font-mono)' : fontStyle === 'serif' ? 'serif' : 'var(--font-sans)' }}
        >
          <div className="flex items-center justify-between mb-3 text-rose-400">
            <div className="flex items-center gap-2">
              <Heart size={16} fill="currentColor" className={isRecording ? "animate-pulse text-red-500" : ""} />
              <span className="text-xs font-display uppercase tracking-widest font-semibold">
                Transcript
              </span>
            </div>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded-full transition-all duration-300 ${isMuted ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white/70'}`}
              title={isMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] text-sm leading-relaxed ${m.role === 'user' ? 'text-white/40 italic' : 'text-white/90 font-medium'}`}>
                  {m.role === 'user' ? <span className="opacity-60 text-xs">— {m.text}</span> : <ReactMarkdown>{m.text}</ReactMarkdown>}
                </div>
                {m.role === 'model' && !isMuted && (
                  <button
                    onClick={() => { initAudio(); stopSpeaking(); speak(m.text); }}
                    className="shrink-0 mt-0.5 p-1 rounded-full text-white/30 hover:text-rose-300 transition-colors"
                    title="Read this back"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); sendDraft(); }}
            className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Or type to Sen..."
              className="flex-1 bg-black/30 border border-white/10 rounded-full px-4 py-2 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={isTyping || !draft.trim()}
              className="p-2 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white disabled:opacity-40 transition-colors"
              title="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function clip(text: string, max: number) {
  const flat = toSpeakable(text);
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
