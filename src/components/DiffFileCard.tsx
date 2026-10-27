"use client";

import { useState } from "react";
import { anchorOf, type CodeLine, type DiffFile, type DiffRow, type Side } from "@/lib/diff";
import type { DraftComment } from "@/lib/review";
import CommentBody from "./CommentBody";
import { Icon, Kbd } from "./ui";

export type Selection = { path: string; side: Side; hunk: number; start: number; end: number };
export type HotLine = { path: string; side: Side; line: number } | null;

export function inSelection(sel: Selection | null, path: string, row: DiffRow) {
  if (!sel || sel.path !== path || row.kind === "hunk") return false;
  const { side, line } = anchorOf(row);
  return side === sel.side && line >= sel.start && line <= sel.end;
}

export function suggestionFor(file: DiffFile, sel: Selection) {
  const lines = file.rows
    .filter((r): r is CodeLine => r.kind !== "hunk" && r.kind !== "del" && inSelection(sel, file.path, r))
    .map((r) => r.text);
  return "```suggestion\n" + lines.join("\n") + "\n```";
}

function countChanges(file: DiffFile) {
  let add = 0;
  let del = 0;
  for (const r of file.rows) {
    if (r.kind === "add") add++;
    else if (r.kind === "del") del++;
  }
  return { add, del };
}

const STATUS_STYLE: Record<string, string> = {
  added: "bg-ok/15 text-ok",
  removed: "bg-live/15 text-live",
  modified: "bg-warn/15 text-warn",
  renamed: "bg-accent/15 text-accent",
};

type Props = {
  file: DiffFile;
  selection: Selection | null;
  hot: HotLine;
  recording: boolean;
  drafts: DraftComment[];
  composer: string;
  setComposer: (v: string) => void;
  onSelect: (row: CodeLine, extend: boolean) => void;
  onCancel: () => void;
  onAdd: () => void;
  onRemoveDraft: (id: string) => void;
};

export default function DiffFileCard(p: Props) {
  const { file, selection, hot, recording, drafts } = p;
  const [open, setOpen] = useState(true);
  const { add, del } = countChanges(file);
  const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/") + 1) : "";
  const name = file.path.slice(dir.length);

  // Original text for the lines a suggestion would replace, to draw the red half of the change.
  function originalFor(d: DraftComment) {
    const from = d.startLine ?? d.line;
    return file.rows
      .filter((r): r is CodeLine => r.kind !== "hunk" && r.kind !== "del" && r.newLine! >= from && r.newLine! <= d.line)
      .map((r) => r.text);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_0_rgb(255_255_255/0.03)_inset]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 border-b border-line bg-panel-2/60 px-4 py-2.5 text-left transition-colors hover:bg-panel-2"
      >
        <Icon name="chevron" className={`size-3.5 shrink-0 text-mute transition-transform ${open ? "rotate-90" : ""}`} />
        <Icon name="file" className="size-4 shrink-0 text-mute" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
          <span className="text-mute">{dir}</span>
          <span className="font-medium text-fg">{name}</span>
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[file.status] ?? "bg-line text-mute"}`}>
          {file.status}
        </span>
        <span className="font-mono text-xs">
          <span className="text-ok">+{add}</span> <span className="text-live">−{del}</span>
        </span>
      </button>

      {open &&
        (file.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-mute">No diff to show (binary or too large).</p>
        ) : (
          <div className="font-mono text-[12.5px] leading-6">
            {file.rows.map((row, i) => {
              if (row.kind === "hunk") {
                return (
                  <div key={i} className="border-y border-line/60 bg-accent/[0.07] px-4 py-1 text-xs text-accent/80">
                    {row.text}
                  </div>
                );
              }
              const { side, line } = anchorOf(row);
              const selected = inSelection(selection, file.path, row);
              const isEnd = selected && selection!.end === line;
              const isHot = recording && hot?.path === file.path && hot.side === side && hot.line === line;
              const lineDrafts = drafts.filter((d) => d.side === side && d.line === line);
              const tint = row.kind === "add" ? "bg-emerald-500/[0.09]" : row.kind === "del" ? "bg-rose-500/[0.09]" : "";

              return (
                <div key={i}>
                  <div
                    data-path={file.path}
                    data-side={side}
                    data-line={line}
                    onClick={(e) => p.onSelect(row, e.shiftKey)}
                    className={`group relative flex cursor-pointer transition-colors ${
                      selected
                        ? "bg-accent/20"
                        : isHot
                          ? "bg-live/15 shadow-[inset_3px_0_0_var(--live)]"
                          : `${tint} hover:bg-white/[0.04]`
                    }`}
                  >
                    <span className="pointer-events-none absolute left-1 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded bg-accent text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Icon name="plus" className="size-3" />
                    </span>
                    <span className="w-12 shrink-0 select-none pr-2 text-right text-xs text-mute/50">{row.oldLine ?? ""}</span>
                    <span className="w-12 shrink-0 select-none pr-2 text-right text-xs text-mute/50">{row.newLine ?? ""}</span>
                    <span
                      className={`w-5 shrink-0 select-none text-center ${
                        row.kind === "add" ? "text-ok" : row.kind === "del" ? "text-live" : "text-transparent"
                      }`}
                    >
                      {row.kind === "add" ? "+" : row.kind === "del" ? "−" : "·"}
                    </span>
                    <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-4">{row.text || " "}</pre>
                  </div>

                  {lineDrafts.map((d) => (
                    <div key={d.id} className="rise border-y border-line bg-bg/60 px-4 py-3 font-sans">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                            d.ai ? "bg-accent/20 text-accent" : "bg-line text-mute"
                          }`}
                        >
                          <Icon name={d.ai ? "sparkle" : "cursor"} className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-center gap-2 text-xs text-mute">
                            <span className="font-medium text-fg">{d.ai ? "From your voice" : "Your comment"}</span>
                            <span>
                              {d.startLine !== undefined ? `lines ${d.startLine}–${d.line}` : `line ${d.line}`}
                              {d.side === "LEFT" && " · removed code"}
                            </span>
                            <button
                              onClick={() => p.onRemoveDraft(d.id)}
                              className="ml-auto rounded px-1.5 py-0.5 text-mute transition-colors hover:bg-live/15 hover:text-live"
                            >
                              Discard
                            </button>
                          </div>
                          <CommentBody body={d.body} original={d.side === "RIGHT" ? originalFor(d) : undefined} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {isEnd && (
                    <div className="rise border-y border-accent/40 bg-panel-2 p-3 font-sans">
                      <textarea
                        autoFocus
                        value={p.composer}
                        onChange={(e) => p.setComposer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") p.onCancel();
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) p.onAdd();
                        }}
                        placeholder="Write a comment on this line…"
                        rows={3}
                        className="w-full resize-y rounded-lg border border-line bg-bg p-3 text-sm outline-none placeholder:text-mute/60 focus:border-accent"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <button
                          onClick={p.onAdd}
                          disabled={!p.composer.trim()}
                          className="rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          Add comment
                        </button>
                        {selection!.side === "RIGHT" && (
                          <button
                            onClick={() => p.setComposer((p.composer ? p.composer + "\n\n" : "") + suggestionFor(file, selection!))}
                            className="rounded-lg border border-line px-3 py-1.5 text-fg transition-colors hover:bg-panel"
                          >
                            Suggest a change
                          </button>
                        )}
                        <button onClick={p.onCancel} className="px-2 py-1.5 text-mute transition-colors hover:text-fg">
                          Cancel
                        </button>
                        <span className="ml-auto hidden items-center gap-1.5 text-xs text-mute sm:flex">
                          <Kbd>Ctrl</Kbd>
                          <Kbd>Enter</Kbd> to add · <Kbd>Shift</Kbd> click to select a range
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </section>
  );
}
