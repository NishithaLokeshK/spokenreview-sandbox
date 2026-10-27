import { Icon, Logo, Spinner, Waveform } from "./ui";

const DEMO_PR = "https://github.com/NishithaLokeshK/spokenreview-sandbox/pull/2";

const STEPS = [
  { icon: "cursor", title: "Point", text: "Hover the code you're reading. We note every line your cursor rests on." },
  { icon: "mic", title: "Talk", text: "Say it like you'd say it to a teammate: “this loop is quadratic, rename this to userId.”" },
  { icon: "git", title: "Ship", text: "AI pins each remark to its line and posts a real GitHub review, with one-click suggestions." },
];

type Props = {
  prUrl: string;
  setPrUrl: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onDemo: (url: string) => void;
};

export default function Hero({ prUrl, setPrUrl, loading, onSubmit, onDemo }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-24 pt-16 text-center sm:pt-24">
      <Logo size="lg" />

      <h1 className="mt-10 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
        Review code the way{" "}
        <span className="bg-gradient-to-r from-accent via-[#b9aeff] to-live bg-clip-text text-transparent">
          you&apos;d explain it.
        </span>
      </h1>
      <p className="mt-5 max-w-xl text-pretty text-base text-mute sm:text-lg">
        Open a pull request, talk while you read, and get a proper GitHub review with every comment on the right line.
        No typing between lines.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-10 flex w-full flex-col gap-2 rounded-2xl border border-line bg-panel/80 p-2 shadow-2xl shadow-black/40 backdrop-blur sm:flex-row"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <Icon name="link" className="size-4 shrink-0 text-mute" />
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
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#5b4be0] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading && <Spinner />}
          {loading ? "Loading…" : "Open pull request"}
        </button>
      </form>

      <button
        onClick={() => onDemo(DEMO_PR)}
        className="mt-4 inline-flex items-center gap-2 text-sm text-mute transition-colors hover:text-fg"
      >
        <Waveform active={false} className="!h-3 text-accent" />
        No PR handy? Try the demo pull request
        <Icon name="chevron" className="size-3.5" />
      </button>

      <ol className="mt-20 grid w-full gap-3 text-left sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line bg-panel/60 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
                <Icon name={s.icon} className="size-[18px]" />
              </span>
              <span className="font-mono text-xs text-mute">0{i + 1}</span>
            </div>
            <h2 className="mt-4 font-semibold">{s.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.text}</p>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-xs text-mute">
        Reviews are always posted as comments. SpokenReview never approves or requests changes for you.
      </p>
    </div>
  );
}
