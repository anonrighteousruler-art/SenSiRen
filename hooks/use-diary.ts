'use client';

import { useSyncExternalStore } from 'react';

export type DiarySource = 'Sen' | 'Ren' | 'You';
export type DiaryKind = 'conversation' | 'research' | 'study' | 'note' | 'snapshot';

export interface DiaryEntry {
  id: string;
  timestamp: string;
  source: DiarySource;
  kind: DiaryKind;
  summary: string;
}

const STORAGE_KEY = 'sensiren_diary';
const MAX_ENTRIES = 200;
const EMPTY: DiaryEntry[] = [];

// One module-level store shared by every component, so an entry written by Sen
// shows up immediately in Ren and in the Datalog panel.
let entries: DiaryEntry[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<DiaryEntry>[];
    // Entries saved by older versions have no id or kind.
    entries = parsed.map(e => ({
      id: e.id || makeId(),
      timestamp: e.timestamp || new Date().toISOString(),
      source: e.source || 'You',
      kind: e.kind || (e.source === 'Ren' ? 'research' : 'conversation'),
      summary: e.summary || '',
    }));
  } catch (e) {
    console.error('Failed to parse diary', e);
  }
}

function commit(next: DiaryEntry[]) {
  entries = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save diary', e);
  }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    entries = EMPTY;
    load();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  load();
  return entries;
}

function getServerSnapshot() {
  return EMPTY;
}

export function addDiaryEntry(source: DiarySource, summary: string, kind?: DiaryKind) {
  load();
  const text = summary.trim();
  if (!text) return;
  const entry: DiaryEntry = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    source,
    kind: kind || (source === 'Ren' ? 'research' : source === 'Sen' ? 'conversation' : 'note'),
    summary: text,
  };
  commit([entry, ...entries].slice(0, MAX_ENTRIES));
}

export function removeDiaryEntry(id: string) {
  load();
  commit(entries.filter(e => e.id !== id));
}

export function clearDiary() {
  commit([]);
}

export function diaryToMarkdown(list: DiaryEntry[]) {
  return [
    '# Sensiren Shared Datalog',
    '',
    ...list.map(e => `- **${new Date(e.timestamp).toLocaleString()}** · ${e.source} · _${e.kind}_ — ${e.summary}`),
    '',
  ].join('\n');
}

export function useDiary() {
  const diary = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Latest entry written by the other persona (or by the user), used to hand context across.
  // Reads the store rather than `diary`, which is still the empty server snapshot during hydration.
  const getLatestContext = (exclude?: DiarySource) => {
    const all = getSnapshot();
    return (exclude ? all.find(e => e.source !== exclude) : all[0]) || null;
  };

  return {
    diary,
    addEntry: addDiaryEntry,
    removeEntry: removeDiaryEntry,
    clear: clearDiary,
    getLatestContext,
  };
}
