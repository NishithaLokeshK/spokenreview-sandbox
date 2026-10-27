import { GitHubError, getPullRequest, parsePrUrl } from "@/lib/github";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  const ref = parsePrUrl(url);
  if (!ref) return Response.json({ error: "Paste a GitHub pull request URL." }, { status: 400 });

  try {
    return Response.json(await getPullRequest(ref));
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    return Response.json({ error: (e as Error).message }, { status });
  }
}
