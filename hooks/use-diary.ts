'use client';

import React, { useState, useEffect } from 'react';

export interface DiaryEntry {
  timestamp: string;
  source: 'Sen' | 'Ren';
  summary: string;
}

export function useDiary() {
  const [diary, setDiary] = useState<DiaryEntry[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sensiren_diary');
      if (saved) {
        try {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDiary(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse diary', e);
        }
      }
    }
  }, []);

  const addEntry = (source: 'Sen' | 'Ren', summary: string) => {
    const newEntry: DiaryEntry = {
      timestamp: new Date().toISOString(),
      source,
      summary,
    };
    const updated = [newEntry, ...diary].slice(0, 50); // Keep last 50
    setDiary(updated);
    localStorage.setItem('sensiren_diary', JSON.stringify(updated));
  };

  const getLatestContext = () => {
    return diary[0] || null;
  };

  return { diary, addEntry, getLatestContext };
}
