// Parses GitHub's per-file unified patch into rows we can render and anchor comments to.

export type Side = "LEFT" | "RIGHT";

export type CodeLine = {
  kind: "add" | "del" | "ctx";
  text: string;
  oldLine: number | null;
  newLine: number | null;
  hunk: number;
};

export type HunkHeader = { kind: "hunk"; text: string; hunk: number };

export type DiffRow = CodeLine | HunkHeader;

export type DiffFile = {
  path: string;
  status: string;
  rows: DiffRow[];
};

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hunk = -1;

  for (const raw of patch.split("\n")) {
    const header = raw.match(HUNK_RE);
    if (header) {
      hunk++;
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      rows.push({ kind: "hunk", text: raw, hunk });
      continue;
    }
    if (hunk < 0 || raw.startsWith("\\")) continue; // "\ No newline at end of file"

    const marker = raw[0];
    const text = raw.slice(1);
    if (marker === "+") {
      rows.push({ kind: "add", text, oldLine: null, newLine: newLine++, hunk });
    } else if (marker === "-") {
      rows.push({ kind: "del", text, oldLine: oldLine++, newLine: null, hunk });
    } else {
      rows.push({ kind: "ctx", text, oldLine: oldLine++, newLine: newLine++, hunk });
    }
  }
  return rows;
}

// GitHub anchors deleted lines on the LEFT (old file) and everything else on the RIGHT (new file).
export function anchorOf(row: CodeLine): { side: Side; line: number } {
  return row.kind === "del"
    ? { side: "LEFT", line: row.oldLine! }
    : { side: "RIGHT", line: row.newLine! };
}

export function anchorKey(path: string, side: Side, line: number) {
  return `${path}:${side}:${line}`;
}
