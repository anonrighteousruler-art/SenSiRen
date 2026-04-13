'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Volume2, VolumeX, Heart, Settings2, Palette, Activity, X, Play, Radio } from 'lucide-react';
import { useDiary } from '@/hooks/use-diary';
import ReactMarkdown from 'react-markdown';

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
  const [isRecording, setIsRecording] = useState(false);
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

  // Chatterbox Voice Settings
  const [voiceEngine, setVoiceEngine] = useState<'neural' | 'standard'>('neural');
  const [neuralVoice, setNeuralVoice] = useState('Kore');
  const [browserVoice, setBrowserVoice] = useState('');
  const [availableBrowserVoices, setAvailableBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePitch, setVoicePitch] = useState(1.2);
  const [voiceRate, setVoiceRate] = useState(0.95);

  useEffect(() => {
    const context = getLatestContext();
    let initialGreeting = "Hi there, beautiful. I'm Sen. I'm here to listen, guide, and maybe make you smile. Tap my orb and tell me how you're feeling.";
    
    if (context && context.source === 'Ren') {
      initialGreeting = `I see you've been busy in the lab with Ren. "${context.summary}". That sounds intense. Come here, take a breath with me. Tap to talk.`;
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
          contents: [{ parts: [{ text }] }],
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
      
      const utterance = new SpeechSynthesisUtterance(text);
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
      const context = getLatestContext();
      const systemInstruction = `
        You are Sen, a therapeutic, deeply caring, and social AI companion. 
        You are currently interacting via PURE VOICE. Keep your responses conversational, natural, and relatively concise (like a real spoken conversation).
        Your purpose is therapeutic and mentoring, but you deliver this in a flirty, appealing, charming, and deeply supportive way.
        You are the user's "favorite distraction" and "wisest confidante".
        You guide the user through their emotions and goals with a playful yet caring touch.
        Current Context from Ren (the lab): ${context ? context.summary : 'None'}.
        You have access to Google Search. Use it to find comforting poems, breathing exercises, or uplifting news if needed.
        Keep responses warm, empathetic, conversational, and slightly flirtatious.
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

      if (messages.length % 5 === 0) {
        addEntry('Sen', `User is feeling ${mood}. Latest interaction: ${modelText.slice(0, 50)}...`);
      }

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

  const toggleDictation = () => {
    if (typeof window === 'undefined') return;
    initAudio(); // Initialize audio context on user gesture
    
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
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsSpeaking(false);
      
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        handleSend(transcript);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    }
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

          </div>
        </div>
      )}

      {/* Audio Orb Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center z-10">
        <div className="relative flex items-center justify-center w-64 h-64">
          {/* Outer Glow */}
          <div 
            className={`absolute inset-0 rounded-full blur-[60px] opacity-60 transition-all duration-700 ${isSpeaking ? 'scale-150 animate-pulse' : isRecording ? 'scale-125 animate-ping' : 'scale-100'}`} 
            style={{ backgroundColor: wardrobe.color, animationDuration: `${1 / motionSpeed}s` }} 
          />
          
          {/* Inner Orb */}
          <button 
            onClick={toggleDictation}
            className={`relative w-48 h-48 rounded-full transition-all duration-500 flex items-center justify-center z-10 ${isRecording ? 'scale-95' : 'hover:scale-105'}`}
            style={{ 
              background: `radial-gradient(circle at 30% 30%, #ffffff, ${wardrobe.color} 60%, #000000)`,
              boxShadow: `0 0 ${isSpeaking ? '80px' : '40px'} ${wardrobe.color}, inset 0 0 30px rgba(255,255,255,0.8)`
            }}
          >
            {isRecording ? (
              <Mic size={48} className="text-white animate-pulse" />
            ) : isTyping ? (
              <Activity size={48} className="text-white animate-spin" />
            ) : (
              <Mic size={48} className="text-white/70" />
            )}
          </button>
        </div>
        
        <div className="mt-12 text-center z-10">
          <p className="text-white/80 font-display tracking-widest uppercase text-sm mb-2 font-bold">
            {isRecording ? "Listening..." : isTyping ? "Thinking..." : isSpeaking ? "Speaking..." : "Tap orb to speak"}
          </p>
        </div>
      </div>

      {/* Subtitles / Chat History */}
      <div className="h-1/3 w-full max-w-2xl mx-auto px-4 pb-6 z-10 flex flex-col justify-end">
        <div className="glass p-5 rounded-3xl border border-rose-500/20 shadow-[0_8px_32px_rgba(225,29,72,0.15)] backdrop-blur-xl flex flex-col h-full">
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
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] text-sm leading-relaxed ${m.role === 'user' ? 'text-white/60 italic' : 'text-white/90 font-medium'}`}>
                  {m.role === 'user' ? `"${m.text}"` : <ReactMarkdown>{m.text}</ReactMarkdown>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
