'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronRight, Mic, Plus, Volume2, Square, Trash2, Download } from 'lucide-react';
import { useDiary, diaryToMarkdown, type DiarySource } from '@/hooks/use-diary';
import { useDictation, useReadAloud } from '@/hooks/use-speech';

const FILTERS: Array<'All' | DiarySource> = ['All', 'You', 'Sen', 'Ren'];

const SOURCE_STYLE: Record<DiarySource, string> = {
  Sen: 'bg-pink-500/20 text-pink-400',
  Ren: 'bg-emerald-500/20 text-emerald-400',
  You: 'bg-sky-500/20 text-sky-300',
};

export default function DiaryPanel({ onClose }: { onClose: () => void }) {
  const { diary, addEntry, removeEntry, clear } = useDiary();
  const [filter, setFilter] = useState<'All' | DiarySource>('All');
  const [draft, setDraft] = useState('');
  const readAloud = useReadAloud();
  const dictation = useDictation({
    continuous: true,
    onFinal: (text) => setDraft(prev => (prev.trim() ? `${prev.trimEnd()} ${text}` : text)),
  });

  const visible = filter === 'All' ? diary : diary.filter(e => e.source === filter);

  const save = () => {
    dictation.stop();
    addEntry('You', draft, 'note');
    setDraft('');
  };

  const readAll = () => {
    if (readAloud.speakingId === 'all') return readAloud.stop();
    const text = visible
      .slice(0, 10)
      .map(e => `${e.source === 'You' ? 'You wrote' : `${e.source} logged`}: ${e.summary}`)
      .join('. ');
    readAloud.speak('all', text);
  };

  const exportMd = () => {
    const blob = new Blob([diaryToMarkdown(visible)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensiren_datalog_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-widest flex items-center gap-2">
          <BookOpen size={20} className="text-white/60" />
          Shared Datalog
        </h2>
        <button onClick={onClose} className="text-white/40 hover:text-white/60" aria-label="Close datalog">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Compose */}
      <form
        onSubmit={(e) => { e.preventDefault(); save(); }}
        className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          readOnly={dictation.isListening}
          placeholder="Write or dictate a diary note. Sen and Ren will both see it."
          aria-label="Diary note"
          className="w-full h-20 bg-transparent text-sm text-white/80 placeholder-white/30 resize-none focus:outline-none custom-scrollbar"
        />
        {dictation.isListening && dictation.interim && (
          <p className="text-xs text-white/40 italic mb-2">{dictation.interim}</p>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={dictation.toggle}
            className={`p-2 rounded-full transition-colors ${dictation.isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-white/40 hover:text-white/70'}`}
            title={dictation.isListening ? 'Stop dictation' : 'Dictate a note'}
          >
            <Mic size={16} />
          </button>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-full bg-sky-500/80 hover:bg-sky-500 text-white text-xs font-display uppercase tracking-wider flex items-center gap-1 disabled:opacity-40 transition-colors"
          >
            <Plus size={12} /> Log it
          </button>
        </div>
      </form>

      {/* Filters + actions */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider transition-colors ${filter === f ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={readAll} disabled={visible.length === 0} className="p-1.5 rounded-full text-white/40 hover:text-white/70 disabled:opacity-30" title={readAloud.speakingId === 'all' ? 'Stop reading' : 'Read latest entries aloud'}>
            {readAloud.speakingId === 'all' ? <Square size={14} /> : <Volume2 size={14} />}
          </button>
          <button onClick={exportMd} disabled={visible.length === 0} className="p-1.5 rounded-full text-white/40 hover:text-white/70 disabled:opacity-30" title="Export as Markdown">
            <Download size={14} />
          </button>
          <button
            onClick={() => { if (confirm('Clear the whole datalog? This cannot be undone.')) clear(); }}
            disabled={diary.length === 0}
            className="p-1.5 rounded-full text-white/40 hover:text-red-400 disabled:opacity-30"
            title="Clear datalog"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {visible.length === 0 ? (
          <div className="text-center py-20 text-white/20 italic text-sm">
            No logs recorded yet.
          </div>
        ) : (
          visible.map(entry => (
            <div key={entry.id} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
              <div className="flex justify-between items-center mb-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-tighter ${SOURCE_STYLE[entry.source]}`}>
                    {entry.source}
                  </span>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{entry.kind}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/20 font-mono">
                    {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => readAloud.toggle(entry.id, entry.summary)}
                    className="p-1 text-white/30 hover:text-white/70"
                    title={readAloud.speakingId === entry.id ? 'Stop reading' : 'Read aloud'}
                  >
                    {readAloud.speakingId === entry.id ? <Square size={12} /> : <Volume2 size={12} />}
                  </button>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="p-1 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete entry"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className={`text-sm text-white/70 leading-relaxed ${entry.source === 'You' ? '' : 'italic'}`}>
                {entry.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
