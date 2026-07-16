---
name: handoff
description: End-of-session handoff — updates AGENTS.md, ai-context docs, writes a session handoff file, and generates a copy/paste prompt for the next agent. Use when user says "handoff", "wrap up", "end session", "clear context", or wants to prepare context for the next conversation.
---

# Session Handoff

Run all steps in order. Do not skip any.

## Step 1 — Discover what changed

Run these commands and study the output:

```
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

If `origin/main` is not set, use the oldest commit of the session (check conversation context for the starting commit).

Summarize:

- How many commits
- Which areas changed (api/, ui/, shared/, packages/, docs/, ai-context/)
- Key features/fixes/refactors

## Step 2 — Update project docs

For each doc below, check if this session's changes require an update. Only touch docs that are actually stale — don't rewrite for the sake of it.

| Doc                                  | Update if...                                                     |
| ------------------------------------ | ---------------------------------------------------------------- |
| `AGENTS.md`                          | Key rules, project structure, package list, or doc index changed |
| `ai-context/README.md`               | Docs were added, moved, or deleted                               |
| `ai-context/build-order.md`          | A subsystem status changed or new subsystem was added            |
| `ai-context/tech-stack.md`           | A library was added/removed or a convention changed              |
| `ai-context/auth-and-tenancy.md`     | Auth flow, RBAC, roles, or tenancy model changed                 |
| `ai-context/architecture/**`         | Architecture patterns, layer rules, or conventions changed       |
| `docs/standalone-packages/README.md` | @fundus packages were added, removed, or significantly changed   |
| `.claude/skills/api-routes/SKILL.md` | Routes were created, changed, or deleted                         |
| `.claude/skills/components/SKILL.md` | Component wrappers were added                                    |

State which docs you updated and which you skipped (with reason).

## Step 3 — Run checks

```
yarn lint:check && yarn format:check && yarn build && yarn test
```

Fix any issues. Format with `yarn format:fix` if needed.

## Step 4 — Commit all changes

Commit everything that's uncommitted. Use a descriptive message.

## Step 5 — Write handoff file

Write `docs/handoffs/YYYY-MM-DD/handoff-<slug>.md` where `<slug>` is a 2-3 word kebab-case summary of the session's main work.

Template:

```markdown
# Session Handoff — YYYY-MM-DD — <Title>

## What was done

- Bullet list of significant changes (not every commit — group by theme)
- Include commit count and test count

## Key decisions

- Any rules established or changed
- Any architectural decisions made
- Any conventions introduced

## Current state

- Branch: main
- Tests: N passed
- Build: passing/failing
- Unpushed commits: N

## What might come next

- Obvious follow-up work
- Known issues or loose ends
- Anything the user mentioned wanting to do next
```

## Step 6 — Generate handoff prompt

Output a fenced block the user can copy/paste into the next conversation. Format:

````
```
## Context — Session YYYY-MM-DD handoff

<2-3 sentence summary of what was accomplished>

### Key changes
- <grouped bullet list of what changed, with file/area references>

### Rules established
- <any new conventions or rules, with enough detail to act on>

### Current state
- Branch: main, N commits ahead of origin (not pushed)
- All checks green: lint, format, typecheck, build, N tests
- <any caveats>

### What might come next
- <prioritized list of follow-up work>
- <known issues>
```
````

Tell the user: "Copy the block above and paste it as your first message in the next conversation."
