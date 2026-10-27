import { analyzeSpokenReview, type Utterance } from "@/lib/analyze";
import { GitHubError, getPullRequest, parsePrUrl } from "@/lib/github";
import { partitionByAnchor } from "@/lib/review";

type Body = { prUrl: string; utterances: Utterance[] };

// Crude per-IP limiter so a public demo can't burn the Anthropic key. Resets on cold start.
const WINDOW_MS = 10 * 60_000;
const MAX_CALLS = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_CALLS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const { prUrl, utterances } = (await request.json()) as Body;
  const ref = parsePrUrl(prUrl ?? "");
  if (!ref) return Response.json({ error: "Invalid pull request URL." }, { status: 400 });
  if (!Array.isArray(utterances) || utterances.length === 0) {
    return Response.json({ error: "Say or type something first." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Server has no ANTHROPIC_API_KEY set." }, { status: 500 });
  }

  try {
    // The server's copy of the diff is the source of truth for anchors, not whatever the client sends.
    const pr = await getPullRequest(ref);
    const analysis = await analyzeSpokenReview(pr.title, pr.files, utterances.slice(0, 60));

    const drafts = analysis.comments.map((c) => ({ ...c, id: crypto.randomUUID() }));
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
