import { Fragment } from "react";

const SUGGESTION = /(```suggestion\n[\s\S]*?```)/g;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code key={i} className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// Renders a review comment, drawing ```suggestion fences as a red-to-green change like GitHub will.
export default function CommentBody({ body, original }: { body: string; original?: string[] }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-fg">
      {body.split(SUGGESTION).map((part, i) => {
        if (!part.trim()) return null;
        if (part.startsWith("```suggestion")) {
          const next = part.replace(/^```suggestion\n/, "").replace(/\n?```$/, "").split("\n");
          return (
            <div key={i} className="overflow-hidden rounded-md border border-line font-mono text-xs">
              <div className="border-b border-line bg-panel-2 px-3 py-1 font-sans text-[11px] font-medium text-mute">
                Suggested change
              </div>
              {original?.map((l, j) => (
                <div key={`o${j}`} className="flex bg-rose-500/10 px-3 py-0.5 text-rose-200">
                  <span className="w-4 shrink-0 select-none text-rose-400">−</span>
                  <pre className="whitespace-pre-wrap break-all">{l || " "}</pre>
                </div>
              ))}
              {next.map((l, j) => (
                <div key={`n${j}`} className="flex bg-emerald-500/10 px-3 py-0.5 text-emerald-200">
                  <span className="w-4 shrink-0 select-none text-emerald-400">+</span>
                  <pre className="whitespace-pre-wrap break-all">{l || " "}</pre>
                </div>
              ))}
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={part.trim()} />
          </p>
        );
      })}
    </div>
  );
}
