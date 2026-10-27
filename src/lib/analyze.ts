import Anthropic from "@anthropic-ai/sdk";
import { anchorOf, type DiffFile, type Side } from "./diff";
import type { DraftComment } from "./review";

const MODEL = "claude-sonnet-5-5";
const MAX_DIFF_CHARS = 60_000;

export type Dwell = { path: string; side: Side; line: number; ms: number };

export type Utterance = {
  text: string;
  startMs: number;
  endMs: number;
  // Lines the cursor rested on around this utterance, most-dwelled first.
  dwell: Dwell[];
};

export type Analysis = {
  summary: string;
  comments: Omit<DraftComment, "id">[];
  general: string[];
};

// Every code line is labelled with its anchor so the model can cite exact (path, side, line) triples.
function renderDiff(files: DiffFile[]) {
  let out = "";
  for (const file of files) {
    if (file.rows.length === 0) continue;
    out += `\n### ${file.path} (${file.status})\n`;
    for (const row of file.rows) {
      if (row.kind === "hunk") {
        out += `${row.text}\n`;
        continue;
      }
      const { side, line } = anchorOf(row);
      const mark = row.kind === "add" ? "+" : row.kind === "del" ? "-" : " ";
      out += `${side[0]}${line}\t${mark} ${row.text}\n`;
    }
    if (out.length > MAX_DIFF_CHARS) return out.slice(0, MAX_DIFF_CHARS) + "\n[diff truncated]";
  }
  return out;
}

function renderUtterances(utterances: Utterance[]) {
  return utterances
    .map((u, i) => {
      const dwell = u.dwell.length
        ? u.dwell.map((d) => `${d.path} ${d.side[0]}${d.line} (${d.ms}ms)`).join("; ")
        : "none recorded";
      return `[${i}] t=${(u.startMs / 1000).toFixed(1)}s-${(u.endMs / 1000).toFixed(1)}s\n  said: "${u.text}"\n  cursor rested on: ${dwell}`;
    })
    .join("\n");
}

const SYSTEM = `You turn a developer's spoken code review into GitHub inline review comments.

You get the PR diff and a list of utterances. Each utterance has speech-recognition text and the diff lines the reviewer's cursor rested on while speaking.

Rules:
- One comment per distinct point the reviewer made. Do not invent points they did not say, and do not add your own review.
- Anchor each comment to the line it is about. Explicit spoken cues ("line 40", "this function", a named variable or file) outrank the cursor trace; the cursor trace is noisy and only a hint.
- Anchors are (path, side, line). Lines are labelled in the diff as L<number> (old file, side LEFT, deleted lines) or R<number> (new file, side RIGHT). Only anchor to labelled lines.
- Use start_line only for a point that spans several consecutive lines of the same side.
- Rewrite speech into a crisp, polite, written review comment. Fix speech-recognition errors using identifiers from the diff. Keep the reviewer's meaning and tone.
- When the reviewer asks for a concrete replacement ("rename this to X", "make this const", "use Y here"), include a GitHub suggestion block in the body containing the full corrected replacement for exactly the anchored line(s), preserving indentation:
\`\`\`suggestion
<replacement lines>
\`\`\`
  Suggestions are only valid on RIGHT side lines (added or context lines), never on deleted lines.
  A suggestion must be correct code: only use identifiers that exist in the diff or that the reviewer said, and if the rename would also need other lines changed, say so in the comment instead of suggesting a broken one-line edit.
- Anything not tied to a line goes in general_comments. summary is one or two sentences for the review body.
- Ignore filler, false starts, and speech that is not review feedback.`;

const TOOL: Anthropic.Tool = {
  name: "post_review",
  description: "Return the review comments derived from the spoken review.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      comments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            side: { type: "string", enum: ["LEFT", "RIGHT"] },
            line: { type: "integer" },
            start_line: { type: "integer" },
            body: { type: "string" },
          },
          required: ["path", "side", "line", "body"],
        },
      },
      general_comments: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "comments", "general_comments"],
  },
};

type ToolInput = {
  summary: string;
  comments: { path: string; side: Side; line: number; start_line?: number; body: string }[];
  general_comments: string[];
};

// Gemini's free tier needs no billing; Anthropic is used when only that key is configured.
export function hasAiKey() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function userPrompt(title: string, files: DiffFile[], utterances: Utterance[]) {
  return `PR title: ${title}

DIFF (each code line is prefixed L<n> or R<n>):
${renderDiff(files)}

SPOKEN REVIEW:
${renderUtterances(utterances)}`;
}

async function callAnthropic(prompt: string): Promise<ToolInput> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error("The model returned no review.");
  return block.input as ToolInput;
}

async function callGemini(prompt: string): Promise<ToolInput> {
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: TOOL.input_schema,
        temperature: 0.2,
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Gemini: ${data?.error?.message ?? res.statusText}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no review.");
  return JSON.parse(text) as ToolInput;
}

export async function analyzeSpokenReview(
  title: string,
  files: DiffFile[],
  utterances: Utterance[],
): Promise<Analysis> {
  const prompt = userPrompt(title, files, utterances);
  const useGemini = process.env.AI_PROVIDER === "anthropic" ? false : Boolean(process.env.GEMINI_API_KEY);
  const input = useGemini ? await callGemini(prompt) : await callAnthropic(prompt);

  return {
    summary: input.summary ?? "",
    comments: (input.comments ?? []).map((c) => ({
      path: c.path,
      side: c.side,
      line: c.line,
      startLine: c.start_line,
      body: c.body,
    })),
    general: input.general_comments ?? [],
  };
}
