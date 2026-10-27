import { GitHubError, getPullRequest, postReview } from "@/lib/github";
import { rateLimited, resolvePr } from "@/lib/guard";
import { buildReviewBody, partitionByAnchor, type DraftComment } from "@/lib/review";

type Body = { prUrl: string; summary?: string; comments: DraftComment[] };

export async function POST(request: Request) {
  if (rateLimited(request, "review", 10)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const { prUrl, summary = "", comments } = (await request.json()) as Body;
  const resolved = resolvePr(prUrl);
  if ("error" in resolved) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { ref } = resolved;
  if (!Array.isArray(comments) || comments.length === 0) {
    return Response.json({ error: "Add at least one comment first." }, { status: 400 });
  }
  if (!process.env.GITHUB_TOKEN) {
    return Response.json({ error: "Server has no GITHUB_TOKEN set." }, { status: 500 });
  }

  try {
    // Re-fetch so anchors are checked against the diff GitHub has now, not what the client saw.
    const pr = await getPullRequest(ref);
    const { inline, orphaned } = partitionByAnchor(pr.files, comments);
    const review = await postReview(ref, {
      commitId: pr.headSha,
      body: buildReviewBody(summary, orphaned),
      comments: inline,
    });
    return Response.json({ url: review.html_url, inline: inline.length, orphaned: orphaned.length });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
