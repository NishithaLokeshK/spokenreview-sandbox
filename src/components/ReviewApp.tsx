"use client";

import { useEffect, useState } from "react";
import { anchorOf, type CodeLine } from "@/lib/diff";
import type { PullRequest } from "@/lib/github";
import type { DraftComment } from "@/lib/review";
import DiffFileCard, { type Selection } from "./DiffFileCard";
import { Confetti, CursorGlow } from "./fx";
import Hero from "./Hero";
import { Icon, Logo, Spinner } from "./ui";
import VoiceDock from "./VoiceDock";
import { useVoiceReview } from "./useVoiceReview";

type PostResult = { url: string; inline: number; orphaned: number };

function Banner({ tone, children, onClose }: { tone: "error" | "ok"; children: React.ReactNode; onClose: () => void }) {
  const styles = tone === "error" ? "border-live/40 bg-live/10 text-red-200" : "border-ok/40 bg-ok/10 text-emerald-200";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rise mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <Icon name={tone === "error" ? "x" : "check"} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      <button onClick={onClose} aria-label="Dismiss" className="opacity-60 transition-opacity hover:opacity-100">
        <Icon name="x" className="size-4" />
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-2/3 rounded-lg" />
      <div className="skeleton h-5 w-1/3 rounded-lg" />
      {[0, 1].map((i) => (
        <div key={i} className="skeleton h-64 rounded-xl" />
      ))}
    </div>
  );
}

export default function ReviewApp() {
  const [prUrl, setPrUrl] = useState("");
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<DraftComment[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [composer, setComposer] = useState("");
  const [summary, setSummary] = useState("");
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);

  const voice = useVoiceReview();
  const [analyzing, setAnalyzing] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  async function loadPr(e?: React.FormEvent, urlOverride?: string) {
    e?.preventDefault();
    const url = urlOverride ?? prUrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/pr?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPr(data);
      setDrafts([]);
      setSelection(null);
      setSummary("");
      voice.clear();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // A shared link like /?pr=<github pr url> opens straight into the review screen.
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("pr");
    if (!url) return;
    const id = setTimeout(() => {
      setPrUrl(url);
      void loadPr(undefined, url);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startDemo(url: string) {
    setPrUrl(url);
    loadPr(undefined, url);
  }

  async function generateComments() {
    if (voice.recording) voice.stop();
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl, utterances: voice.buildUtterances() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((ds) => [...ds, ...(data.comments as DraftComment[])]);
      const extra = (data.general as string[]).map((g) => `- ${g}`).join("\n");
      setSummary((s) => [s, data.summary, extra].filter(Boolean).join("\n\n"));
      voice.clear();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  function selectRow(path: string, row: CodeLine, extend: boolean) {
    const { side, line } = anchorOf(row);
    if (extend && selection && selection.path === path && selection.side === side && selection.hunk === row.hunk) {
      setSelection({
        ...selection,
        start: Math.min(selection.start, line),
        end: Math.max(selection.end, line),
      });
      return;
    }
    setSelection({ path, side, hunk: row.hunk, start: line, end: line });
    setComposer("");
  }

  function addDraft() {
    if (!selection || !composer.trim()) return;
    setDrafts((ds) => [
      ...ds,
      {
        id: crypto.randomUUID(),
        path: selection.path,
        side: selection.side,
        line: selection.end,
        startLine: selection.start < selection.end ? selection.start : undefined,
        body: composer.trim(),
      },
    ]);
    setSelection(null);
    setComposer("");
  }

  async function submitReview() {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl, summary, comments: drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setCelebrate((c) => c + 1);
      setDrafts([]);
      setSummary("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  const banners = (
    <>
      {error && <Banner tone="error" onClose={() => setError(null)}>{error}</Banner>}
      {result && (
        <Banner tone="ok" onClose={() => setResult(null)}>
          Review posted with {result.inline} inline comment{result.inline === 1 ? "" : "s"}
          {result.orphaned > 0 && ` and ${result.orphaned} moved to the summary`}.{" "}
          <a href={result.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
            Open on GitHub
          </a>
        </Banner>
      )}
    </>
  );

  if (!pr && !loading) {
    return (
      <>
        <div className="mx-auto w-full max-w-3xl px-4 pt-6">{banners}</div>
        <Hero prUrl={prUrl} setPrUrl={setPrUrl} loading={loading} onSubmit={(e) => loadPr(e)} onDemo={startDemo} />
      </>
    );
  }

  const adds = pr?.files.reduce((n, f) => n + f.rows.filter((r) => r.kind === "add").length, 0) ?? 0;
  const dels = pr?.files.reduce((n, f) => n + f.rows.filter((r) => r.kind === "del").length, 0) ?? 0;
  const repo = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);

  return (
    <div className="w-full">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="orb -left-32 top-20 size-[26rem] bg-accent/20 [animation:drift-a_20s_ease-in-out_infinite]" />
        <div className="orb -right-32 top-1/2 size-[24rem] bg-cyan/15 [animation:drift-b_24s_ease-in-out_infinite]" />
        <div className="orb bottom-0 left-1/3 size-[22rem] bg-pink/15 [animation:drift-a_26s_ease-in-out_infinite]" />
      </div>
      <Confetti fire={celebrate} />
      <CursorGlow active={voice.recording} />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="rainbow-bar h-0.5" />
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <button onClick={() => { setPr(null); setError(null); }} aria-label="Back to start">
            <Logo />
          </button>
          <form onSubmit={(e) => loadPr(e)} className="ml-auto flex min-w-0 max-w-md flex-1 items-center gap-2">
            <input
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              aria-label="Pull request URL"
              placeholder="https://github.com/owner/repo/pull/1"
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm outline-none placeholder:text-mute/60 focus:border-accent"
            />
            <button
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-panel-2 disabled:opacity-50"
            >
              {loading && <Spinner className="size-3.5" />}
              Load
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-[26rem] pt-8">
        {banners}

        {loading || !pr ? (
          <Skeleton />
        ) : (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-mute">
                <Icon name="git" className="size-4" />
                <span className="font-mono">{repo ? `${repo[1]} #${repo[2]}` : "pull request"}</span>
                <span className="font-mono text-xs">· {pr.headSha.slice(0, 7)}</span>
              </div>
              <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                <a href={pr.url} target="_blank" rel="noreferrer" className="hover:underline hover:underline-offset-4">
                  {pr.title}
                </a>
              </h1>
              <p className="mt-2 text-sm text-mute">
                {pr.files.length} file{pr.files.length === 1 ? "" : "s"} changed ·{" "}
                <span className="font-mono text-ok">+{adds}</span> <span className="font-mono text-live">−{dels}</span>
              </p>
            </div>

            <div className="space-y-5">
              {pr.files.map((file) => (
                <DiffFileCard
                  key={file.path}
                  file={file}
                  selection={selection}
                  hot={voice.hot}
                  recording={voice.recording}
                  drafts={drafts.filter((d) => d.path === file.path)}
                  composer={composer}
                  setComposer={setComposer}
                  onSelect={(row, extend) => selectRow(file.path, row, extend)}
                  onCancel={() => setSelection(null)}
                  onAdd={addDraft}
                  onRemoveDraft={(id) => setDrafts((ds) => ds.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {pr && (
        <VoiceDock
          voice={voice}
          analyzing={analyzing}
          onGenerate={generateComments}
          draftCount={drafts.length}
          summary={summary}
          setSummary={setSummary}
          posting={posting}
          onPost={submitReview}
        />
      )}
    </div>
  );
}
