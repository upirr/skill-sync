# Skills Sync — Design Spec

**Date:** 2026-04-07
**Topic:** Aggregating public CC skills for Cursor and OpenCode team distribution

---

## Overview

A dedicated aggregator repo (`skills-sync`) pulls skills from multiple public repos, converts them for Cursor and OpenCode, and publishes clean distribution branches. Project repos consume those branches via `git subtree`.

---

## Source Skills

| Plugin | Repo | Skills included |
|---|---|---|
| superpowers | `obra/superpowers` | all 14 skills |
| commit-commands | `anthropics/claude-plugins-official` | all (`commit`, `commit-push-pr`, `clean_gone`) |
| skill-creator | `anthropics/claude-plugins-official` | all |

Tracked in `.skillsync.json` at repo root — the allowlist drives both the sync and conversion steps.

---

## Aggregator Repo Structure

```
skills-sync/
├── .github/
│   └── workflows/
│       └── sync.yml            # scheduled + manual sync
├── sources/
│   ├── superpowers/            # git subtree: obra/superpowers
│   └── claude-official/        # git subtree: anthropics/claude-plugins-official
├── scripts/
│   └── convert.mjs             # reads .skillsync.json, copies/converts to dist/
├── dist/
│   ├── cursor/                 # generated .mdc files
│   └── opencode/               # copied SKILL.md files (no conversion needed)
├── .skillsync.json             # allowlist config
└── README.md
```

---

## Conversion Rules

### OpenCode (`dist/opencode/`)
No conversion needed — OpenCode uses the identical CC skill format (YAML frontmatter + Markdown body). Files are copied as-is.

Output structure:
```
dist/opencode/
  <skill-name>/
    SKILL.md
    <supporting files>
```

### Cursor (`dist/cursor/`)
CC skills are transformed to `.mdc` format:

| CC frontmatter | Cursor .mdc frontmatter |
|---|---|
| `description` | `description` |
| `name` | dropped (filename becomes identifier) |
| *(none)* | `alwaysApply: false` |

Body: unchanged.

Output: `dist/cursor/<skill-name>.mdc`

---

## Distribution Branches

After converting, GH Actions publishes two clean branches:

| Branch | Contents | Used as |
|---|---|---|
| `cursor-rules` | only `dist/cursor/*.mdc` at root | subtree target for `.cursor/rules/` |
| `opencode-skills` | only `dist/opencode/` at root | subtree target for `.opencode/skills/` |

Published via `git subtree split` (force-push required — branch is rewritten each run, not appended):
```bash
git subtree split --prefix=dist/cursor -b cursor-rules
git push origin cursor-rules --force

git subtree split --prefix=dist/opencode -b opencode-skills
git push origin opencode-skills --force
```

---

## GH Actions Workflow (`.github/workflows/sync.yml`)

```
Trigger: weekly (Monday 09:00 UTC) + workflow_dispatch

Steps:
  1. git subtree pull --prefix=sources/superpowers obra/superpowers main --squash
  2. git subtree pull --prefix=sources/claude-official anthropics/claude-plugins-official main --squash
  3. node scripts/convert.mjs
  4. git add dist/ && git commit -m "chore: sync skills" (if changed)
  5. git subtree split → push cursor-rules branch
  6. git subtree split → push opencode-skills branch
```

Permissions: `contents: write` on the repo token.

---

## `.skillsync.json` Format

```json
{
  "sources": {
    "superpowers": {
      "repo": "obra/superpowers",
      "subtreePrefix": "sources/superpowers",
      "plugins": [
        { "name": "superpowers", "dir": "skills", "format": "skills", "include": "*" }
      ]
    },
    "claude-official": {
      "repo": "anthropics/claude-plugins-official",
      "subtreePrefix": "sources/claude-official",
      "plugins": [
        { "name": "skill-creator", "dir": "plugins/skill-creator/skills", "format": "skills", "include": "*" },
        { "name": "commit-commands", "dir": "plugins/commit-commands/commands", "format": "commands", "include": "*" }
      ]
    }
  }
}
```

**`format` field:**
- `"skills"` — directory per skill, each containing `SKILL.md` (standard CC format)
- `"commands"` — flat `.md` files, one per command (used by `commit-commands`)

`"include": "*"` means include all. An array of names means include only listed.

---

## Project Integration

### One-time setup

```bash
git subtree add \
  --prefix=.cursor/rules \
  git@github.com:team/skills-sync.git cursor-rules \
  --squash

git subtree add \
  --prefix=.opencode/skills \
  git@github.com:team/skills-sync.git opencode-skills \
  --squash
```

### Updating

```bash
git subtree pull \
  --prefix=.cursor/rules \
  git@github.com:team/skills-sync.git cursor-rules \
  --squash

git subtree pull \
  --prefix=.opencode/skills \
  git@github.com:team/skills-sync.git opencode-skills \
  --squash
```

Wrap both in a `Makefile` target (`make sync-skills`) for convenience.

---

## README Sections

The aggregator repo README must include at minimum:

1. **Installation** — the two `git subtree add` commands above, with prerequisite note about the repo URL
2. **Updating** — the two `git subtree pull` commands, with suggestion to use the Makefile target
3. **Adding skills or repos** — how to edit `.skillsync.json` (add to the `skills` array or add a new source entry), then trigger a manual sync via `workflow_dispatch`
4. **How sync works** — brief description of the pipeline: subtree pull → convert → split → push branches

---

## Out of Scope

- Bidirectional sync (pushing changes back to source repos)
- Per-project skill selection (all projects get all skills)
- Automatic PR creation on skill updates
