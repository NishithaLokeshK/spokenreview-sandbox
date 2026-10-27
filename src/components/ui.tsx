import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-3-7-7-1z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  git: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <path d="M6 8.2v7.6M18 11.2c0 4-6 2-11 5" />
    </>
  ),
  cursor: <path d="M5 3l14 7-6 2-2 6L5 3z" />,
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </>
  ),
};

export function Icon({ name, className = "size-4" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

const BAR_DELAYS = [0.0, 0.25, 0.1, 0.4, 0.15, 0.35, 0.05];
const BAR_HEIGHTS = [0.45, 0.85, 0.6, 1, 0.7, 0.9, 0.5];

export function Waveform({ active, className = "" }: { active: boolean; className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-[3px] ${active ? "is-live" : ""} ${className}`} aria-hidden>
      {BAR_DELAYS.map((d, i) => (
        <span
          key={i}
          className="wave-bar h-full w-[3px] rounded-full bg-current"
          style={{ ["--d" as string]: `${d}s`, ["--h" as string]: BAR_HEIGHTS[i] }}
        />
      ))}
    </span>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${size === "lg" ? "text-xl" : "text-base"}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#5b4be0] text-white shadow-[0_0_24px_-4px_var(--accent)]">
        <Waveform active={false} className="!h-4" />
      </span>
      SpokenReview
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-mute">{children}</kbd>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
