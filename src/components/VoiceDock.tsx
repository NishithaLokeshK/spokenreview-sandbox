"use client";

import { useEffect, useState } from "react";
import { Icon, Kbd, Spinner, Waveform } from "./ui";
import type { useVoiceReview } from "./useVoiceReview";

type Voice = ReturnType<typeof useVoiceReview>;

const CHIP_TONES = ["border-cyan/50", "border-accent/50", "border-pink/50", "border-warn/50", "border-lime/50"];

function Timer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs tabular-nums text-live">
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
    </span>
  );
}

type Props = {
  voice: Voice;
  analyzing: boolean;
  onGenerate: () => void;
  draftCount: number;
  summary: string;
  setSummary: (v: string) => void;
  posting: boolean;
  onPost: () => void;
};

export default function VoiceDock({ voice, analyzing, onGenerate, draftCount, summary, setSummary, posting, onPost }: Props) {
  const [typed, setTyped] = useState("");
  const { recording, supported, start, stop } = voice;

  // "M" toggles the mic from anywhere outside a text field, so you never have to reach for the mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "m" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (!supported) return;
      e.preventDefault();
      if (recording) stop();
      else start();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, supported, start, stop]);

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    voice.addTyped(typed);
    setTyped("");
  }

  const count = voice.spoken.length;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="pointer-events-auto mx-auto max-w-3xl space-y-2">
        {draftCount > 0 && (
          <div className="rise flex items-end gap-3 rounded-2xl border border-line bg-panel/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <label htmlFor="summary" className="mb-1 flex items-center gap-2 text-xs text-mute">
                <span className="grid size-5 place-items-center rounded-full bg-ok/15 text-ok">
                  <Icon name="check" className="size-3" />
                </span>
                {draftCount} comment{draftCount === 1 ? "" : "s"} ready · posts as a plain review, never an approval
              </label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Review summary (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-mute/60 focus:border-accent"
              />
            </div>
            <button
              onClick={onPost}
              disabled={posting}
              className="btn-3d flex h-10 shrink-0 items-center gap-2 rounded-xl bg-ok px-4 text-sm font-semibold text-bg [--edge:#13795a] disabled:opacity-50"
            >
              {posting ? <Spinner /> : <Icon name="send" />}
              {posting ? "Posting…" : "Post review"}
            </button>
          </div>
        )}

        <div
          className={`rounded-2xl border bg-panel/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl transition-colors ${
            recording ? "conic border-transparent" : "border-line"
          }`}
        >
          {count > 0 && (
            <ul className="mb-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {voice.spoken.map((u, i) => (
                <li
                  key={i}
                  className={`pop group flex max-w-full items-center gap-1.5 rounded-full border bg-panel-2 py-1 pl-3 pr-1.5 text-xs ${CHIP_TONES[i % CHIP_TONES.length]}`}
                >
                  <span className="truncate">{u.text}</span>
                  <button
                    onClick={() => voice.removeAt(i)}
                    aria-label={`Remove “${u.text}”`}
                    className="grid size-4 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-live/20 hover:text-live"
                  >
                    <Icon name="x" className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3">
            {supported ? (
              <button
                onClick={recording ? stop : start}
                aria-label={recording ? "Stop recording" : "Start recording"}
                className="relative grid size-11 shrink-0 place-items-center"
              >
                {recording && <span className="ring-pulse absolute inset-0 rounded-full bg-live" />}
                <span
                  className={`relative grid size-11 place-items-center rounded-full text-white transition-colors ${
                    recording ? "bg-live" : "bg-gradient-to-br from-accent to-pink hover:brightness-110"
                  }`}
                >
                  <Icon name={recording ? "stop" : "mic"} className="size-5" />
                </span>
              </button>
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-panel-2 text-mute">
                <Icon name="keyboard" className="size-5" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className={`flex items-center gap-2 ${recording ? "text-live" : "text-mute"}`}>
                <Waveform active={recording} className="rainbow" />
                {recording && <Timer />}
                <span className="truncate text-sm text-fg">
                  {voice.interim ? (
                    <span className="italic text-mute">{voice.interim}</span>
                  ) : recording ? (
                    "Listening… hover a line and say what you think"
                  ) : supported ? (
                    <span className="text-mute">
                      Press <Kbd>M</Kbd> or tap the mic, then talk while you point
                    </span>
                  ) : (
                    <span className="text-mute">Voice needs Chrome or Edge. Type your remarks below.</span>
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={onGenerate}
              disabled={analyzing || count === 0}
              className="btn-3d flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#5b4be0] px-4 text-sm font-semibold text-white disabled:from-panel-2 disabled:to-panel-2 disabled:text-mute"
            >
              {analyzing ? <Spinner /> : <Icon name="sparkle" />}
              <span className="hidden sm:inline">{analyzing ? "Reading your review…" : "Turn into comments"}</span>
              {!analyzing && count > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-white/20 px-1.5 text-xs">{count}</span>
              )}
            </button>
          </div>

          {voice.micError && <p className="mt-2 text-xs text-live">{voice.micError}</p>}

          <form onSubmit={submitTyped} className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type / dictate with Wispr, then press Enter"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-mute/60 focus:border-accent"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className="rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-panel-2 disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
