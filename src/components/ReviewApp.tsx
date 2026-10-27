"use client";

import { useState } from "react";
import { anchorOf, type CodeLine, type DiffFile, type DiffRow, type Side } from "@/lib/diff";
import type { PullRequest } from "@/lib/github";
import type { DraftComment } from "@/lib/review";
import { useVoiceReview } from "./useVoiceReview";

type Selection = { path: string; side: Side; hunk: number; start: number; end: number };
type PostResult = { url: string; inline: number; orphaned: number };

function inSelection(sel: Selection | null, path: string, row: DiffRow) {
  if (!sel || sel.path !== path || row.kind === "hunk") return false;
  const { side, line } = anchorOf(row);
  return side === sel.side && line >= sel.start && line <= sel.end;
}

function suggestionFor(file: DiffFile, sel: Selection) {
  const lines = file.rows
    .filter((r): r is CodeLine => r.kind !== "hunk" && r.kind !== "del" && inSelection(sel, file.path, r))
    .map((r) => r.text);
  return "```suggestion\n" + lines.join("\n") + "\n```";
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
  const [typed, setTyped] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

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

  function addTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    voice.addTyped(typed);
    setTyped("");
  }

  async function loadPr(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/pr?url=${encodeURIComponent(prUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPr(data);
      setDrafts([]);
      setSelection(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
      setDrafts([]);
      setSummary("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-40 pt-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">SpokenReview</h1>
        <p className="text-sm text-zinc-400">Point at a line, say what&apos;s wrong, ship a real GitHub review.</p>
      </header>

      <form onSubmit={loadPr} className="mb-6 flex gap-2">
        <input
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/1"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button
          disabled={loading}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load PR"}
        </button>
      </form>

      {error && <p className="mb-4 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>}
      {result && (
        <p className="mb-4 rounded-md border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          Review posted with {result.inline} inline comment{result.inline === 1 ? "" : "s"}
          {result.orphaned > 0 && ` and ${result.orphaned} moved to the summary`}.{" "}
          <a href={result.url} target="_blank" rel="noreferrer" className="underline">
            Open on GitHub
          </a>
        </p>
      )}

      {pr && (
        <>
          <div className="sticky top-0 z-10 mb-4 rounded-md border border-zinc-700 bg-zinc-900/95 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              {voice.supported ? (
                <button
                  onClick={voice.recording ? voice.stop : voice.start}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    voice.recording ? "bg-red-600 hover:bg-red-500" : "bg-sky-600 hover:bg-sky-500"
                  }`}
                >
                  {voice.recording ? "● Stop mic" : "🎤 Start talking"}
                </button>
              ) : (
                <span className="text-xs text-zinc-400">Voice needs Chrome or Edge. Type below instead.</span>
              )}
              <form onSubmit={addTyped} className="flex flex-1 gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="…or type/dictate here (Wispr works), then hover the line you mean and press Enter"
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
              </form>
              <button
                onClick={generateComments}
                disabled={analyzing || voice.spoken.length === 0}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {analyzing ? "Thinking…" : `Turn into comments (${voice.spoken.length})`}
              </button>
            </div>
            {voice.micError && <p className="mt-2 text-xs text-red-400">{voice.micError}</p>}
            {(voice.spoken.length > 0 || voice.interim) && (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-zinc-300">
                {voice.spoken.map((u, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex-1">“{u.text}”</span>
                    <button onClick={() => voice.removeAt(i)} className="text-zinc-500 hover:text-red-400">
                      remove
                    </button>
                  </li>
                ))}
                {voice.interim && <li className="italic text-zinc-500">“{voice.interim}”</li>}
              </ul>
            )}
          </div>
          <h2 className="mb-4 text-lg font-medium">
            <a href={pr.url} target="_blank" rel="noreferrer" className="hover:underline">
              {pr.title}
            </a>
          </h2>
          {pr.files.map((file) => (
            <section key={file.path} className="mb-6 overflow-hidden rounded-md border border-zinc-800">
              <div className="border-b border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm">
                {file.path} <span className="text-zinc-500">({file.status})</span>
              </div>
              {file.rows.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-500">No diff to show (binary or too large).</p>
              ) : (
                <div className="font-mono text-xs">
                  {file.rows.map((row, i) => {
                    if (row.kind === "hunk") {
                      return (
                        <div key={i} className="bg-sky-950/40 px-3 py-1 text-sky-300/80">
                          {row.text}
                        </div>
                      );
                    }
                    const { side, line } = anchorOf(row);
                    const selected = inSelection(selection, file.path, row);
                    const isSelectionEnd = selected && selection!.end === line;
                    const lineDrafts = drafts.filter((d) => d.path === file.path && d.side === side && d.line === line);
                    const tint =
                      row.kind === "add" ? "bg-emerald-950/50" : row.kind === "del" ? "bg-red-950/50" : "";

                    return (
                      <div key={i}>
                        <div
                          data-path={file.path}
                          data-side={side}
                          data-line={line}
                          onClick={(e) => selectRow(file.path, row, e.shiftKey)}
                          className={`flex cursor-pointer ${tint} ${selected ? "!bg-sky-900/60" : "hover:bg-zinc-800/80"}`}
                        >
                          <span className="w-12 shrink-0 select-none px-2 text-right text-zinc-600">{row.oldLine ?? ""}</span>
                          <span className="w-12 shrink-0 select-none px-2 text-right text-zinc-600">{row.newLine ?? ""}</span>
                          <span className="w-4 shrink-0 select-none text-zinc-500">
                            {row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "}
                          </span>
                          <pre className="whitespace-pre-wrap break-all pr-3">{row.text || " "}</pre>
                        </div>

                        {lineDrafts.map((d) => (
                          <div key={d.id} className="flex items-start gap-2 border-y border-zinc-800 bg-zinc-900 px-4 py-2 font-sans text-sm">
                            <pre className="flex-1 whitespace-pre-wrap font-sans">
                              {d.startLine !== undefined && <span className="text-zinc-500">Lines {d.startLine}–{d.line}: </span>}
                              {d.body}
                            </pre>
                            <button
                              onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
                              className="text-xs text-zinc-500 hover:text-red-400"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        {isSelectionEnd && (
                          <div className="border-y border-sky-800 bg-zinc-900 p-3 font-sans">
                            <textarea
                              autoFocus
                              value={composer}
                              onChange={(e) => setComposer(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setSelection(null);
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addDraft();
                              }}
                              placeholder="Say or type your comment… (Ctrl+Enter to add, Esc to cancel)"
                              rows={3}
                              className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm outline-none focus:border-sky-500"
                            />
                            <div className="mt-2 flex gap-2 text-sm">
                              <button onClick={addDraft} className="rounded-md bg-sky-600 px-3 py-1 hover:bg-sky-500">
                                Add comment
                              </button>
                              {selection!.side === "RIGHT" && (
                                <button
                                  onClick={() => setComposer((c) => (c ? c + "\n\n" : "") + suggestionFor(file, selection!))}
                                  className="rounded-md border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
                                >
                                  Insert suggestion
                                </button>
                              )}
                              <button onClick={() => setSelection(null)} className="px-3 py-1 text-zinc-400 hover:text-zinc-200">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {drafts.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-end gap-3 px-4 py-3">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Optional review summary"
              rows={2}
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-sky-500"
            />
            <button
              onClick={submitReview}
              disabled={posting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {posting ? "Posting…" : `Submit review (${drafts.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
