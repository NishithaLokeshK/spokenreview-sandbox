import { parsePatch, type DiffFile } from "./diff";
import type { GitHubReviewComment } from "./review";

const API = "https://api.github.com";
const MAX_FILE_PAGES = 3; // 300 files is plenty for a review UI

export type PrRef = { owner: string; repo: string; number: number };

export type PullRequest = {
  title: string;
  url: string;
  headSha: string;
  files: DiffFile[];
};

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parsePrUrl(input: string): PrRef | null {
  const m = input.trim().match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (init.body) headers["Content-Type"] = "application/json";

  const res = await fetch(API + path, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const errors = detail?.errors ? ` (${JSON.stringify(detail.errors)})` : "";
    throw new GitHubError(res.status, (detail?.message ?? res.statusText) + errors);
  }
  return res.json() as Promise<T>;
}

type ApiPull = { title: string; html_url: string; head: { sha: string } };
type ApiFile = { filename: string; status: string; patch?: string };

export async function getPullRequest({ owner, repo, number }: PrRef): Promise<PullRequest> {
  const base = `/repos/${owner}/${repo}/pulls/${number}`;
  const pr = await gh<ApiPull>(base);

  const files: ApiFile[] = [];
  for (let page = 1; page <= MAX_FILE_PAGES; page++) {
    const batch = await gh<ApiFile[]>(`${base}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }

  return {
    title: pr.title,
    url: pr.html_url,
    headSha: pr.head.sha,
    // Binary and very large files come back without a patch; they render as "no diff".
    files: files.map((f) => ({ path: f.filename, status: f.status, rows: f.patch ? parsePatch(f.patch) : [] })),
  };
}

export async function postReview(
  { owner, repo, number }: PrRef,
  review: { commitId: string; body: string; comments: GitHubReviewComment[] },
) {
  // Always COMMENT: this tool must never approve or request changes on someone's behalf.
  return gh<{ html_url: string }>(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      commit_id: review.commitId,
      event: "COMMENT",
      body: review.body,
      comments: review.comments,
    }),
  });
}
