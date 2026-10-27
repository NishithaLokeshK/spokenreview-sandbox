"use client";

import { useEffect, useState } from "react";
import { Tilt } from "./fx";
import { Icon, Waveform } from "./ui";

// A looping, self-playing preview of the product: cursor on a line, a spoken remark, a comment lands.
const CODE = [
  "export async function findUser(id) {",
  "  for (let i = 0; i < users.length; i++) {",
  "    for (let j = 0; j < users.length; j++) {",
  "  const uid = id;",
  '  const res = await fetch("/api/users/" + uid);',
  "export function emailsFor(ids) {",
  "  return ids.map((id) => findUser(id).email);",
];

// step -> which line the cursor rests on (or -1), and what is being said
const STEPS = [
  { ms: 1400, line: 2, say: "this loop is quadratic" },
  { ms: 1800, line: 2, say: "this loop is quadratic", bubble: 1 },
  { ms: 1400, line: 3, say: "rename this to userId", bubble: 1 },
  { ms: 2200, line: 3, say: "rename this to userId", bubble: 2 },
  { ms: 1400, line: 6, say: "where's the await?", bubble: 2 },
  { ms: 2000, line: 6, say: "where's the await?", bubble: 3 },
  { ms: 2800, line: -1, say: "", bubble: 3, posted: true },
];

const BUBBLES: Record<number, { after: number; tone: string; body: React.ReactNode }> = {
  1: {
    after: 2,
    tone: "border-cyan/50",
    body: "Nested loop makes this O(n²). A single pass or the original `find` is enough.",
  },
  2: {
    after: 3,
    tone: "border-accent/60",
    body: (
      <>
        Rename for clarity.
        <span className="mt-1.5 block overflow-hidden rounded border border-line font-mono text-[11px]">
          <span className="block bg-rose-500/15 px-2 py-0.5 text-rose-200">− const uid = id;</span>
          <span className="block bg-emerald-500/15 px-2 py-0.5 text-emerald-200">+ const userId = id;</span>
        </span>
      </>
    ),
  },
  3: {
    after: 6,
    tone: "border-pink/60",
    body: "`findUser` is async now, so `.email` is read off a Promise. Needs an `await`.",
  },
};

export default function HeroDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step].ms);
    return () => clearTimeout(id);
  }, [step]);

  const cur = STEPS[step];
  const shown = step === 0 ? 0 : cur.bubble ?? 0;

  return (
    <div className="relative mx-auto w-full max-w-xl [perspective:1400px]">
      <Tilt max={9} className="rounded-2xl">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-panel/90 shadow-[0_40px_80px_-20px_rgb(0_0_0/0.8),0_0_80px_-20px_var(--accent)] backdrop-blur"
          style={{ transform: "rotateY(-6deg) rotateX(3deg)" }}
        >
          <div className="flex items-center gap-2 border-b border-line bg-panel-2/80 px-4 py-2.5">
            <span className="size-3 rounded-full bg-live" />
            <span className="size-3 rounded-full bg-warn" />
            <span className="size-3 rounded-full bg-ok" />
            <span className="ml-3 font-mono text-xs text-mute">demo/users.js</span>
            <span className="ml-auto rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-medium text-ok">+10 −3</span>
          </div>

          <div className="py-2 font-mono text-[12.5px] leading-7">
            {CODE.map((text, i) => {
              const active = cur.line === i;
              const bubble = Object.entries(BUBBLES).find(([n, b]) => b.after === i && Number(n) <= shown);
              return (
                <div key={i}>
                  <div
                    className={`relative flex items-center px-4 transition-colors duration-300 ${
                      active ? "bg-live/15 shadow-[inset_3px_0_0_var(--live)]" : i === 0 || i === 5 ? "" : "bg-emerald-500/[0.07]"
                    }`}
                  >
                    <span className="w-6 select-none text-mute/50">{i + 1}</span>
                    <span className="w-4 select-none text-ok/80">{i === 0 || i === 5 ? " " : "+"}</span>
                    <span className="whitespace-pre text-fg/90">{text}</span>
                    {active && (
                      <span className="pop absolute right-6 text-white drop-shadow-[0_0_8px_var(--cyan)]" key={`c${step}`}>
                        <Icon name="cursor" className="size-5 fill-white" />
                      </span>
                    )}
                  </div>
                  {bubble && (
                    <div key={bubble[0]} className={`pop mx-4 my-1.5 rounded-lg border bg-bg/80 px-3 py-2 font-sans text-xs leading-relaxed ${bubble[1].tone}`}>
                      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-accent">
                        <Icon name="sparkle" className="size-3" /> From your voice
                      </span>
                      <span className="text-fg/90">{bubble[1].body}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* floating layers, pushed toward the viewer for depth */}
        <div
          className="bob absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-bg/90 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur sm:-left-10"
          style={{ transform: "translateZ(70px)" }}
        >
          <span className={`relative grid size-9 place-items-center rounded-full ${cur.say ? "bg-live" : "bg-accent"}`}>
            {cur.say && <span className="ring-pulse absolute inset-0 rounded-full bg-live" />}
            <Icon name="mic" className="relative size-[18px] text-white" />
          </span>
          <span className={`rainbow ${cur.say ? "text-live" : "text-mute"}`}>
            <Waveform active={!!cur.say} className="rainbow" />
          </span>
          <span className="w-44 text-sm text-fg">
            {cur.say ? <span className="caret">“{cur.say}”</span> : <span className="text-mute">Review ready</span>}
          </span>
        </div>

        <div
          className={`absolute -right-3 -top-5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur transition-all duration-500 sm:-right-8 ${
            cur.posted ? "pop border-ok/60 bg-ok/20 text-ok" : "border-white/10 bg-bg/80 text-mute"
          }`}
          style={{ transform: "translateZ(90px)" }}
        >
          {cur.posted ? "✓ Posted as a review · 3 comments" : `${shown} comment${shown === 1 ? "" : "s"} drafted`}
        </div>
      </Tilt>
    </div>
  );
}
