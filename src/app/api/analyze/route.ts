import { analyzeSpokenReview, hasAiKey, type Utterance } from "@/lib/analyze";
import { GitHubError, getPullRequest } from "@/lib/github";
import { rateLimited, resolvePr } from "@/lib/guard";
import { partitionByAnchor } from "@/lib/review";

export const maxDuration = 60;

type Body = { prUrl: string; utterances: Utterance[] };

export async function POST(request: Request) {
  if (rateLimited(request, "analyze", 20)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const { prUrl, utterances } = (await request.json()) as Body;
  const resolved = resolvePr(prUrl);
  if ("error" in resolved) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { ref } = resolved;
  if (!Array.isArray(utterances) || utterances.length === 0) {
    return Response.json({ error: "Say or type something first." }, { status: 400 });
  }
  if (!hasAiKey()) {
    return Response.json({ error: "Server has no GEMINI_API_KEY or ANTHROPIC_API_KEY set." }, { status: 500 });
  }

  try {
    // The server's copy of the diff is the source of truth for anchors, not whatever the client sends.
    const pr = await getPullRequest(ref);
    const analysis = await analyzeSpokenReview(pr.title, pr.files, utterances.slice(0, 60));

    const drafts = analysis.comments.map((c) => ({ ...c, id: crypto.randomUUID(), ai: true }));
    const { inline, orphaned } = partitionByAnchor(pr.files, drafts);
    const anchored = new Set(inline.map((c) => `${c.path}:${c.side}:${c.line}`));

    // Suggestion blocks are invalid on deleted lines; strip the fence rather than lose the comment.
    const comments = drafts
      .filter((d) => anchored.has(`${d.path}:${d.side}:${d.line}`))
      .map((d) => (d.side === "LEFT" ? { ...d, body: d.body.replace(/```suggestion[\s\S]*?```/g, "").trim() } : d));

    const general = [...analysis.general, ...orphaned.map((d) => `\`${d.path}\` line ${d.line}: ${d.body}`)];
    return Response.json({ summary: analysis.summary, comments, general });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
