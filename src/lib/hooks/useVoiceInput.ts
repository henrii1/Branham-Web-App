"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Minimal types for the Web Speech API — not in all TS DOM lib versions.
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface WebSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognitionCtor():
  | (new () => WebSpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface UseVoiceInputOptions {
  onInterimResult: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
}

interface UseVoiceInputReturn {
  isSupported: boolean;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useVoiceInput({
  onInterimResult,
  onFinalResult,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);

  // Keep callbacks in refs so startRecording's closure never goes stale.
  const onInterimRef = useRef(onInterimResult);
  const onFinalRef = useRef(onFinalResult);
  onInterimRef.current = onInterimResult;
  onFinalRef.current = onFinalResult;

  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const isSupported = !!getSpeechRecognitionCtor();

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR || isRecording) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = Array.from({ length: event.results.length }, (_, i) =>
        event.results[i],
      );
      const transcript = results.map((r) => r[0].transcript).join("");
      const isFinal = event.results[event.results.length - 1].isFinal;
      if (isFinal) {
        onFinalRef.current(transcript);
      } else {
        onInterimRef.current(transcript);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording]);

  // Stop on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { isSupported, isRecording, startRecording, stopRecording };
}
