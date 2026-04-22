# skill-sync

Aggregates CC skills from public repos and distributes them for [Cursor](https://cursor.sh) and [OpenCode](https://opencode.ai).

**Included skills:**
- [superpowers](https://github.com/obra/superpowers) — all 14 skills (brainstorming, TDD, debugging, etc.)
- [skill-creator](https://github.com/anthropics/claude-plugins-official) — skill authoring workflow
- [commit-commands](https://github.com/anthropics/claude-plugins-official) — commit, commit-push-pr, clean_gone

---

## Installation

Clone this repo and copy skills into your project's gitignored directory:

```bash
git clone git@github.com:upirr/skill-sync.git /tmp/skill-sync
cp /tmp/skill-sync/dist/cursor/*.mdc .cursor/rules/personal/
```

Add `.cursor/rules/personal/` to `.gitignore` if not already there. Cursor picks up `.mdc` files recursively.

---

## Updating

Skills are republished weekly (Monday 09:00 UTC). To trigger an immediate sync:

```bash
gh workflow run sync.yml --repo upirr/skill-sync
```

Then pull and copy:

```bash
cd /tmp/skill-sync && git pull
cp dist/cursor/*.mdc /path/to/your/project/.cursor/rules/personal/
```

---

## Adding skills or repos

1. Edit `.skillsync.json` at the root of this repo.

**To add a skill from an existing source** (e.g. add `code-review` from `claude-official`):

```json
{ "name": "code-review", "dir": "plugins/code-review/skills", "format": "skills", "include": "*" }
```

Add it to the `plugins` array of the `claude-official` source.

**To add a new source repo:**

```json
"my-source": {
  "repo": "owner/repo",
  "subtreePrefix": "sources/my-source",
  "plugins": [
    { "name": "my-plugin", "dir": "skills", "format": "skills", "include": "*" }
  ]
}
```

Then add the subtree locally:

```bash
git subtree add \
  --prefix=sources/my-source \
  https://github.com/owner/repo.git main \
  --squash
```

2. Trigger a manual sync via **Actions → Sync Skills → Run workflow** on GitHub, or run locally:

```bash
make convert
git add dist/
git commit -m "chore: add my-plugin"
git push origin main
```

---

## How sync works

```
obra/superpowers ──────────────────────┐
anthropics/claude-plugins-official ────┤  git subtree pull (weekly GH Action)
                                       ▼
                              sources/  (in main branch)
                                       │
                              node scripts/convert.mjs
                                       │
                         ┌─────────────┴──────────────┐
                         ▼                             ▼
                   dist/cursor/                 dist/opencode/
                   (*.mdc files)                (SKILL.md files)
                         │                             │
                git subtree split              git subtree split
                         ▼                             ▼
              cursor-rules branch          opencode-skills branch
                         │                             │
                   git subtree                   git subtree
                 (consuming projects)         (consuming projects)
```

Skills are synced weekly (Monday 09:00 UTC) and can be triggered manually via GitHub Actions.

---
