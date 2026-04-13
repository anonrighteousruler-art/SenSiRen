'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Database, Settings, BookOpen, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import SenSide from '@/components/sen-side';
import RenSide from '@/components/ren-side';
import { useDiary } from '@/hooks/use-diary';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function SensirenApp() {
  const [activeSide, setActiveSide] = useState<'sen' | 'ren'>('sen');
  const [showDiary, setShowDiary] = useState(false);
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const { diary } = useDiary();

  return (
    <div className="relative h-screen w-screen bg-[#050505] overflow-hidden flex flex-col">
      {/* Top Navigation */}
      <header className="h-16 glass-smoky border-b border-white/10 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-emerald-500 animate-pulse" />
          <h1 className="font-display text-xl font-bold tracking-tighter uppercase">
            SEN<span className="text-white/30">SI</span>REN
          </h1>
          {!isOnline && (
            <div className="flex items-center gap-1 text-red-400 text-[10px] font-mono bg-red-400/10 px-2 py-0.5 rounded-full animate-pulse">
              <WifiOff size={10} />
              OFFLINE
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-full border border-white/10">
          <button 
            onClick={() => setActiveSide('sen')}
            className={`px-4 py-1.5 rounded-full text-xs font-display transition-all flex items-center gap-2 ${activeSide === 'sen' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-white/40 hover:text-white/60'}`}
          >
            <User size={14} />
            SEN
          </button>
          <button 
            onClick={() => setActiveSide('ren')}
            className={`px-4 py-1.5 rounded-full text-xs font-display transition-all flex items-center gap-2 ${activeSide === 'ren' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white/60'}`}
          >
            <Database size={14} />
            REN
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDiary(!showDiary)}
            className={`p-2 rounded-full transition-colors ${showDiary ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'}`}
          >
            <BookOpen size={20} />
          </button>
          <button className="p-2 rounded-full text-white/40 hover:text-white/60">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSide}
            initial={{ opacity: 0, x: activeSide === 'sen' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeSide === 'sen' ? 20 : -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0"
          >
            {activeSide === 'sen' ? <SenSide /> : <RenSide />}
          </motion.div>
        </AnimatePresence>

        {/* Diary Overlay */}
        <AnimatePresence>
          {showDiary && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-md glass-smoky border-l border-white/10 z-40 p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={20} className="text-white/60" />
                  Shared Datalog
                </h2>
                <button onClick={() => setShowDiary(false)} className="text-white/40 hover:text-white/60">
                  <ChevronRight size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {diary.length === 0 ? (
                  <div className="text-center py-20 text-white/20 italic text-sm">
                    No logs recorded yet.
                  </div>
                ) : (
                  diary.map((entry, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter ${entry.source === 'Sen' ? 'bg-pink-500/20 text-pink-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {entry.source}
                        </span>
                        <span className="text-[10px] text-white/20 font-mono">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed italic">
                        &quot;{entry.summary}&quot;
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
