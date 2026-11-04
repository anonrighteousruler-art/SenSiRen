'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Recognition = any;

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isDictationSupported() {
  return getRecognitionCtor() !== null;
}

/**
 * Speech-to-text. In `continuous` mode it keeps listening until stopped and reports
 * interim text as you talk, for dictating notes and long queries. Otherwise it stops
 * after the first phrase.
 */
export function useDictation({
  continuous = false,
  onFinal,
}: {
  continuous?: boolean;
  onFinal: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event: any) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) onFinalRef.current(text);
        } else {
          pending += result[0].transcript;
        }
      }
      setInterim(pending);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setInterim('');
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [continuous]);

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { isListening, interim, start, stop, toggle };
}

/** Strips Markdown so read-back doesn't pronounce asterisks, hashes and code fences. */
export function toSpeakable(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/[*_~>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Browser text-to-speech read-back. Only one item reads at a time; `speakingId` says which. */
export function useReadAloud({ rate = 1, pitch = 1 }: { rate?: number; pitch?: number } = {}) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        alert('Read-back is not supported in this browser.');
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
      utterance.rate = rate;
      utterance.pitch = pitch;
      const done = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setSpeakingId(null);
        }
      };
      utterance.onend = done;
      utterance.onerror = done;
      utteranceRef.current = utterance; // keep a reference so it isn't garbage-collected mid-speech
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [rate, pitch],
  );

  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) stop();
      else speak(id, text);
    },
    [speakingId, speak, stop],
  );

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { speakingId, speak, stop, toggle };
}
