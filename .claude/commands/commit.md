Stage all current changes and create a git commit.

## Steps

1. Run `git status` and `git diff HEAD` to understand what changed.
2. Review the current conversation to identify the user prompts that directly led to the staged changes.
3. Stage all modified and new files relevant to the changes (prefer specific file names over `git add .`; never stage `.env` or credential files).
4. Determine a concise conventional commit subject line (e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `build:`) — no scope in parentheses.
5. Create the commit with:
   - The subject line on the first line.
   - A blank line.
   - A `Prompts:` section listing the exact user messages (verbatim or closely paraphrased) that caused these changes, one per line prefixed with `>`.
   - The standard co-author trailer.

## Commit message format

```
<type>: <short description>

Prompts:
> <first relevant user prompt>
> <second relevant user prompt, if any>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Rules

- Follow the project's commit style from `CLAUDE.md` if one exists.
- Never skip pre-commit hooks (`--no-verify`).
- Never amend; always create a new commit.
- If there is nothing to commit, say so and stop.
