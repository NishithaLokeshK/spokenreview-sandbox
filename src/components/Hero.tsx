import { Tilt } from "./fx";
import HeroDemo from "./HeroDemo";
import { Icon, Logo, Spinner, Waveform } from "./ui";

const DEMO_PR = "https://github.com/NishithaLokeshK/spokenreview-sandbox/pull/3";

const STEPS = [
  {
    icon: "cursor",
    title: "Point",
    text: "Hover the code you're reading. Every line your cursor rests on is noted.",
    tint: "from-cyan/25 text-cyan",
  },
  {
    icon: "mic",
    title: "Talk",
    text: "Say it like you'd tell a teammate: “this loop is quadratic, rename this to userId.”",
    tint: "from-accent/30 text-accent",
  },
  {
    icon: "git",
    title: "Ship",
    text: "Each remark lands on its line in a real GitHub review, with one-click suggestions.",
    tint: "from-pink/25 text-pink",
  },
];

const CHIPS = ["Line-anchored comments", "One-click suggestions", "Never approves for you"];

type Props = {
  prUrl: string;
  setPrUrl: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onDemo: (url: string) => void;
};

export default function Hero({ prUrl, setPrUrl, loading, onSubmit, onDemo }: Props) {
  return (
    <div className="relative isolate overflow-hidden">
      {/* backdrop: drifting colour orbs and a moving perspective floor */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="orb -left-20 -top-24 size-[28rem] bg-accent/40 [animation:drift-a_16s_ease-in-out_infinite]" />
        <div className="orb -right-24 top-10 size-[26rem] bg-cyan/25 [animation:drift-b_19s_ease-in-out_infinite]" />
        <div className="orb bottom-0 left-1/3 size-[24rem] bg-pink/25 [animation:drift-a_22s_ease-in-out_infinite]" />
        <div className="floor" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--bg)_90%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <Logo size="lg" />

        <div className="mt-12 grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-mute backdrop-blur">
              <Waveform active className="rainbow !h-3 text-accent" />
              Built by voice for the Wispr Flow challenge
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
              Review code the way <span className="rainbow-text">you&apos;d explain it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base text-mute sm:text-lg">
              Open a pull request, talk while you read, and get a proper GitHub review with every comment on the right
              line. No typing between lines.
            </p>

            <form onSubmit={onSubmit} className="conic mt-9 flex flex-col gap-2 rounded-2xl bg-panel/90 p-2 shadow-2xl shadow-black/50 backdrop-blur sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
                <Icon name="link" className="size-4 shrink-0 text-cyan" />
                <input
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/1"
                  aria-label="Pull request URL"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-mute/60"
                />
              </div>
              <button
                disabled={loading || !prUrl.trim()}
                className="btn-3d flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#5b4be0] px-6 py-3 text-sm font-semibold text-white disabled:bg-panel-2 disabled:from-panel-2 disabled:to-panel-2 disabled:text-mute"
              >
                {loading && <Spinner />}
                {loading ? "Loading…" : "Open pull request"}
              </button>
            </form>

            <button
              onClick={() => onDemo(DEMO_PR)}
              className="group mt-4 inline-flex items-center gap-2 text-sm text-mute transition-colors hover:text-fg"
            >
              <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-pink to-warn text-bg transition-transform group-hover:scale-110 group-hover:rotate-12">
                <Icon name="sparkle" className="size-3.5" />
              </span>
              No PR handy? Try the demo pull request
              <Icon name="chevron" className="size-3.5 transition-transform group-hover:translate-x-1" />
            </button>

            <ul className="mt-8 flex flex-wrap gap-2">
              {CHIPS.map((c, i) => (
                <li
                  key={c}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-fg/80"
                  style={{ borderColor: ["rgb(34 211 238/.35)", "rgb(139 123 255/.4)", "rgb(244 114 182/.4)"][i] }}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <HeroDemo />
        </div>

        <ol className="mt-28 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Tilt max={14} className="h-full rounded-2xl">
                <div className="h-full rounded-2xl border border-white/10 bg-panel/70 p-6 backdrop-blur">
                  <div className="flex items-center gap-3" style={{ transform: "translateZ(40px)" }}>
                    <span className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br to-transparent ${s.tint}`}>
                      <Icon name={s.icon} className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-mute">0{i + 1}</span>
                  </div>
                  <h2 className="mt-5 text-lg font-semibold" style={{ transform: "translateZ(30px)" }}>
                    {s.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-mute" style={{ transform: "translateZ(18px)" }}>
                    {s.text}
                  </p>
                </div>
              </Tilt>
            </li>
          ))}
        </ol>

        <p className="mt-12 text-center text-xs text-mute">
          Reviews are always posted as comments. SpokenReview never approves or requests changes for you.
        </p>
      </div>
    </div>
  );
}
