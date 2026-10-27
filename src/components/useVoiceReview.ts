"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dwell, Utterance } from "@/lib/analyze";
import type { Side } from "@/lib/diff";

const SAMPLE_MS = 200;
const LEAD_MS = 1500; // the eyes get to a line before the mouth finishes describing it
const TAIL_MS = 500;
const TYPED_LOOKBACK_MS = 4000;
const MAX_DWELL_PER_UTTERANCE = 6;

type Sample = { t: number; path: string; side: Side; line: number };
type Spoken = { text: string; startMs: number; endMs: number };

// The Web Speech API has no lib.dom typings in TS yet.
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getRecognitionCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as Record<string, new () => SpeechRec>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceReview() {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [spoken, setSpoken] = useState<Spoken[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  // The diff line under the cursor right now, so the UI can show what is being tracked.
  const [hot, setHot] = useState<{ path: string; side: Side; line: number } | null>(null);

  const hotKey = useRef("");
  const t0 = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const trace = useRef<Sample[]>([]);
  const rec = useRef<SpeechRec | null>(null);
  const wantRecording = useRef(false);
  const resultStart = useRef(new Map<number, number>());
  const now = () => Date.now() - t0.current;

  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognitionCtor() !== null,
    () => true,
  );

  // The trace runs for the whole session, not only while the mic is on, so typed comments get anchors too.
  useEffect(() => {
    t0.current = Date.now();
    const onMove = (e: PointerEvent) => (pointer.current = { x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    const timer = setInterval(() => {
      const p = pointer.current;
      if (!p) return;
      const el = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>("[data-line]");
      if (!el) {
        if (hotKey.current) {
          hotKey.current = "";
          setHot(null);
        }
        return;
      }
      const sample = {
        t: now(),
        path: el.dataset.path!,
        side: el.dataset.side as Side,
        line: Number(el.dataset.line),
      };
      trace.current.push(sample);
      const key = `${sample.path}:${sample.side}:${sample.line}`;
      if (key !== hotKey.current) {
        hotKey.current = key;
        setHot({ path: sample.path, side: sample.side, line: sample.line });
      }
      if (trace.current.length > 6000) trace.current.splice(0, 1000);
    }, SAMPLE_MS);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearInterval(timer);
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setMicError(null);
    wantRecording.current = true;

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!resultStart.current.has(i)) resultStart.current.set(i, now());
        const text = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          if (text) {
            setSpoken((s) => [...s, { text, startMs: resultStart.current.get(i)!, endMs: now() }]);
          }
          resultStart.current.delete(i);
        } else {
          live += text + " ";
        }
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRecording.current = false;
      setMicError(
        e.error === "not-allowed" ? "Microphone blocked. Allow it in the address bar, or type instead." : `Mic error: ${e.error}`,
      );
    };
    // Chrome ends continuous sessions after silence; restart while the user still wants the mic.
    r.onend = () => {
      resultStart.current.clear();
      setInterim("");
      if (wantRecording.current) {
        try {
          r.start();
          return;
        } catch {
          /* fall through to stopped */
        }
      }
      setRecording(false);
    };
    rec.current = r;
    r.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    wantRecording.current = false;
    rec.current?.stop();
  }, []);

  const addTyped = useCallback((text: string) => {
    const end = now();
    setSpoken((s) => [...s, { text: text.trim(), startMs: end - TYPED_LOOKBACK_MS, endMs: end }]);
  }, []);

  const removeAt = useCallback((i: number) => setSpoken((s) => s.filter((_, j) => j !== i)), []);
  const clear = useCallback(() => setSpoken([]), []);

  // Attach the cursor evidence to each utterance at send time.
  const buildUtterances = useCallback((): Utterance[] => {
    return spoken.map((u) => {
      const counts = new Map<string, Dwell>();
      for (const s of trace.current) {
        if (s.t < u.startMs - LEAD_MS || s.t > u.endMs + TAIL_MS) continue;
        const key = `${s.path}:${s.side}:${s.line}`;
        const d = counts.get(key) ?? { path: s.path, side: s.side, line: s.line, ms: 0 };
        d.ms += SAMPLE_MS;
        counts.set(key, d);
      }
      const dwell = [...counts.values()].sort((a, b) => b.ms - a.ms).slice(0, MAX_DWELL_PER_UTTERANCE);
      return { text: u.text, startMs: u.startMs, endMs: u.endMs, dwell };
    });
  }, [spoken]);

  return { supported, recording, interim, spoken, micError, hot, start, stop, addTyped, removeAt, clear, buildUtterances };
}
