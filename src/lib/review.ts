import { anchorKey, anchorOf, type DiffFile, type Side } from "./diff";

export type DraftComment = {
  id: string;
  path: string;
  side: Side;
  line: number;
  startLine?: number; // set for multi-line comments; must share side and hunk with `line`
  body: string;
  ai?: boolean; // drafted by the model from speech, so the UI can badge it
};

export type GitHubReviewComment = {
  path: string;
  side: Side;
  line: number;
  start_line?: number;
  start_side?: Side;
  body: string;
};

// GitHub rejects the whole review if any inline comment points outside the diff,
// so split drafts into ones it will accept and ones we fold into the review body.
export function partitionByAnchor(files: DiffFile[], drafts: DraftComment[]) {
  const hunkByKey = new Map<string, number>();
  for (const file of files) {
    for (const row of file.rows) {
      if (row.kind === "hunk") continue;
      const { side, line } = anchorOf(row);
      hunkByKey.set(anchorKey(file.path, side, line), row.hunk);
    }
  }

  const inline: GitHubReviewComment[] = [];
  const orphaned: DraftComment[] = [];

  for (const d of drafts) {
    const endHunk = hunkByKey.get(anchorKey(d.path, d.side, d.line));
    if (endHunk === undefined) {
      orphaned.push(d);
      continue;
    }
    const comment: GitHubReviewComment = { path: d.path, side: d.side, line: d.line, body: d.body };
    if (d.startLine !== undefined && d.startLine !== d.line) {
      const startHunk = hunkByKey.get(anchorKey(d.path, d.side, d.startLine));
      if (startHunk === endHunk && d.startLine < d.line) {
        comment.start_line = d.startLine;
        comment.start_side = d.side;
      }
      // An invalid range still anchors to its last line rather than being dropped.
    }
    inline.push(comment);
  }

  return { inline, orphaned };
}

export function buildReviewBody(summary: string, orphaned: DraftComment[]) {
  const parts = [summary.trim()];
  if (orphaned.length) {
    parts.push(
      "**Comments outside the diff:**\n" +
        orphaned.map((d) => `- \`${d.path}\` line ${d.line}: ${d.body}`).join("\n"),
    );
  }
  parts.push("<sub>Reviewed by voice with SpokenReview</sub>");
  return parts.filter(Boolean).join("\n\n");
}
