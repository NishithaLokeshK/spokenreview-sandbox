# SpokenReview

Review a pull request by talking while you read it.

Open a PR in the app, point at lines and say what you think: "this loop is quadratic", "rename this to userId", "where's the error handling here?". SpokenReview records your speech along with the lines your cursor rested on, matches each remark to the right line, and posts a real GitHub review with inline comments. When you ask for a rename or replacement it writes a one-click committable suggestion.

Built for the WeMakeDevs x Wispr Flow "No Hands" challenge, with the build itself done by voice.

## Try it

1. Open the app and paste a PR URL, for example `https://github.com/NishithaLokeshK/spokenreview-sandbox/pull/2`.
2. Click **Start talking** (Chrome or Edge) and hover over the code as you speak. No mic? Type or dictate into the text box instead, then hover the line you mean.
3. Click **Turn into comments**, edit anything you like, and **Submit review**.
4. Open the PR on GitHub to see the inline comments.

Reviews are always posted as `COMMENT`. The tool never approves or requests changes.

## How it works

- `src/components/useVoiceReview.ts` runs browser speech recognition and samples the cursor every 200 ms, recording which diff line it is over.
- `src/app/api/analyze` sends the diff, the timestamped utterances and the lines dwelled on to an LLM, which returns comments with anchors. Spoken cues like "line 40" outrank the noisy cursor trace.
- `src/lib/review.ts` checks every anchor against the real diff, because GitHub rejects comments outside it. Anything that doesn't fit goes into the review summary instead.
- `src/app/api/review` posts the review through the GitHub reviews API.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained token with "Pull requests: Read and write" on the repos you review |
| `GEMINI_API_KEY` | Free key from aistudio.google.com (used first when set) |
| `ANTHROPIC_API_KEY` | Alternative provider, used when no Gemini key is set |
| `ALLOWED_REPOS` | Repos the server may post to, e.g. `owner/repo,owner/*` |

Posting is restricted to `ALLOWED_REPOS` and rate limited per IP, so a public deployment can't be used to post as the token's owner on arbitrary repos.
