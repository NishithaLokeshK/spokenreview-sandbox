import { parsePrUrl, type PrRef } from "./github";

// The server token can write to anything its owner can; keep public instances on a short leash.
// ALLOWED_REPOS is a comma list of "owner/repo" or "owner/*". Unset means the owner's own repos.
const DEFAULT_ALLOWED = "NishithaLokeshK/*";

export function repoAllowed({ owner, repo }: PrRef) {
  const rules = (process.env.ALLOWED_REPOS || DEFAULT_ALLOWED).split(",").map((r) => r.trim().toLowerCase());
  const full = `${owner}/${repo}`.toLowerCase();
  return rules.some((r) => r === full || (r.endsWith("/*") && full.startsWith(r.slice(0, -1))));
}

export function resolvePr(prUrl: unknown): { ref: PrRef } | { error: string; status: number } {
  const ref = parsePrUrl(typeof prUrl === "string" ? prUrl : "");
  if (!ref) return { error: "Invalid pull request URL.", status: 400 };
  if (!repoAllowed(ref)) {
    return { error: `${ref.owner}/${ref.repo} is not enabled for this deployment.`, status: 403 };
  }
  return { ref };
}

// Crude per-IP limiter so a public demo can't burn the keys. Resets on cold start.
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

export function rateLimited(request: Request, bucket: string, max: number) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
