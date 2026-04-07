# Skill Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repo that pulls skills from public sources, converts them for Cursor and OpenCode, and publishes distribution branches consumed by project repos via `git subtree`.

**Architecture:** Two public repos (`obra/superpowers`, `anthropics/claude-plugins-official`) are added as git subtrees under `sources/`. A Node.js script reads `.skillsync.json` and writes converted output to `dist/`. A GH Actions workflow keeps everything in sync weekly.

**Tech Stack:** Node.js (ESM, no deps), git subtree, GitHub Actions

---

## File Map

| File | Role |
|---|---|
| `.skillsync.json` | Allowlist config — drives both sync and conversion |
| `scripts/convert.mjs` | Reads config, copies/converts skills to `dist/` |
| `scripts/convert.test.mjs` | Unit tests for the pure `convertSkillToCursor` function |
| `.github/workflows/sync.yml` | Scheduled + manual GH Actions workflow |
| `Makefile` | `make convert` helper for local use |
| `README.md` | Installation, updating, adding skills, how sync works |
| `sources/superpowers/` | git subtree: `obra/superpowers` |
| `sources/claude-official/` | git subtree: `anthropics/claude-plugins-official` |
| `dist/cursor/` | Generated `.mdc` files (Cursor rules) |
| `dist/opencode/` | Copied `SKILL.md` files (OpenCode skills) |

---

### Task 1: Add git subtree sources

All commands run from `/home/upir/git/skill-sync`.

**Files:**
- Creates: `sources/superpowers/` (subtree)
- Creates: `sources/claude-official/` (subtree)

- [ ] **Step 1: Remove placeholder .gitkeep**

```bash
rm sources/.gitkeep
git add sources/.gitkeep
git commit -m "chore: remove sources placeholder"
```

- [ ] **Step 2: Add superpowers subtree**

```bash
git subtree add \
  --prefix=sources/superpowers \
  https://github.com/obra/superpowers.git \
  main \
  --squash
```

Expected: git commit created with message `Merge commit '...'`, files visible under `sources/superpowers/`.

- [ ] **Step 3: Add claude-official subtree**

```bash
git subtree add \
  --prefix=sources/claude-official \
  https://github.com/anthropics/claude-plugins-official.git \
  main \
  --squash
```

Expected: git commit created, files visible under `sources/claude-official/`.

- [ ] **Step 4: Verify structure**

```bash
ls sources/superpowers/skills/
ls sources/claude-official/plugins/skill-creator/skills/skill-creator/
ls sources/claude-official/plugins/commit-commands/commands/
```

Expected:
- `sources/superpowers/skills/` — directories like `brainstorming/`, `test-driven-development/`, etc.
- `sources/claude-official/plugins/skill-creator/skills/skill-creator/SKILL.md` — exists
- `sources/claude-official/plugins/commit-commands/commands/` — `commit.md`, `commit-push-pr.md`, `clean_gone.md`

---

### Task 2: Create `.skillsync.json`

**Files:**
- Create: `.skillsync.json`

- [ ] **Step 1: Write .skillsync.json**

```bash
cat > .skillsync.json << 'EOF'
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
EOF
```

- [ ] **Step 2: Commit**

```bash
git add .skillsync.json
git commit -m "chore: add skillsync config"
```

---

### Task 3: TDD for `convertSkillToCursor`

This is a pure function — takes a skill name and raw `.md` content, returns `.mdc` content. No file I/O.

Conversion rules:
- Keep only `description` from frontmatter (strip `name`, `allowed-tools`, anything else)
- Add `alwaysApply: false`
- Body (everything after `---`) is unchanged

**Files:**
- Create: `scripts/convert.test.mjs`
- Create: `scripts/convert.mjs` (export only, no main execution yet)

- [ ] **Step 1: Write failing tests**

Create `scripts/convert.test.mjs`:

```javascript
import { strict as assert } from 'assert'
import { convertSkillToCursor } from './convert.mjs'

// Test 1: keeps description, strips name and allowed-tools, adds alwaysApply
{
  const input = `---
name: my-skill
allowed-tools: Bash(git:*)
description: Use when doing something special
---

# My Skill

Content here.
`
  const result = convertSkillToCursor('my-skill', input)
  assert.ok(result.startsWith('---\n'), 'starts with frontmatter')
  assert.ok(result.includes('description: Use when doing something special'), 'keeps description')
  assert.ok(result.includes('alwaysApply: false'), 'adds alwaysApply')
  assert.ok(!result.includes('name:'), 'strips name')
  assert.ok(!result.includes('allowed-tools:'), 'strips allowed-tools')
  assert.ok(result.includes('# My Skill'), 'preserves body')
  assert.ok(result.includes('Content here.'), 'preserves body content')
  console.log('✓ strips name + allowed-tools, keeps description, adds alwaysApply: false')
}

// Test 2: handles missing name (commands format has no name field)
{
  const input = `---
allowed-tools: Bash(git add:*)
description: Create a git commit
---

## Context

Instructions here.
`
  const result = convertSkillToCursor('commit', input)
  assert.ok(result.includes('description: Create a git commit'), 'keeps description')
  assert.ok(result.includes('alwaysApply: false'), 'adds alwaysApply')
  assert.ok(!result.includes('allowed-tools:'), 'strips allowed-tools')
  assert.ok(result.includes('## Context'), 'preserves body')
  console.log('✓ handles commands format (no name field)')
}

// Test 3: throws on missing frontmatter
{
  try {
    convertSkillToCursor('bad', 'No frontmatter here\n\nJust content.')
    assert.fail('should have thrown')
  } catch (e) {
    assert.ok(e.message.includes('No frontmatter'), `expected frontmatter error, got: ${e.message}`)
    console.log('✓ throws on missing frontmatter')
  }
}

// Test 4: multiline description is preserved as-is
{
  const input = `---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality"
---

Body.
`
  const result = convertSkillToCursor('brainstorming', input)
  assert.ok(result.includes('You MUST use this before any creative work'), 'preserves quoted description content')
  console.log('✓ preserves quoted description')
}

console.log('\nAll tests passed!')
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
node scripts/convert.test.mjs
```

Expected: `Error: Cannot find module` or similar (convert.mjs doesn't exist yet).

- [ ] **Step 3: Write `convertSkillToCursor` in convert.mjs**

Create `scripts/convert.mjs`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const ROOT = join(__dirname, '..')

/**
 * Converts a CC skill's SKILL.md content to Cursor .mdc format.
 * Strips all frontmatter fields except `description`, adds `alwaysApply: false`.
 *
 * Input:  CC YAML frontmatter (name, description, allowed-tools, ...) + markdown body
 * Output: Cursor .mdc frontmatter (description, alwaysApply) + same markdown body
 */
export function convertSkillToCursor(skillName, content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/s)
  if (!match) throw new Error(`No frontmatter found in skill: ${skillName}`)

  const frontmatter = match[1]
  const body = match[2]

  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
  const description = descMatch ? descMatch[1].trim() : ''

  return `---\ndescription: ${description}\nalwaysApply: false\n---\n${body}`
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
node scripts/convert.test.mjs
```

Expected:
```
✓ strips name + allowed-tools, keeps description, adds alwaysApply: false
✓ handles commands format (no name field)
✓ throws on missing frontmatter
✓ preserves quoted description

All tests passed!
```

- [ ] **Step 5: Commit**

```bash
git add scripts/convert.mjs scripts/convert.test.mjs
git commit -m "feat: add convertSkillToCursor with tests"
```

---

### Task 4: Implement full conversion pipeline and verify

Adds the main execution block to `convert.mjs` — reads config, iterates sources, writes `dist/`.

**Files:**
- Modify: `scripts/convert.mjs` (add main execution block)

- [ ] **Step 1: Add pipeline to convert.mjs**

Append below the `convertSkillToCursor` export:

```javascript
/**
 * Builds dist/cursor and dist/opencode from all sources defined in .skillsync.json.
 *
 * .skillsync.json sources → sources/<prefix>/<dir>/
 *   skills format:   subdir per skill, each with SKILL.md
 *   commands format: flat .md files
 * →
 *   dist/cursor/<skill-name>.mdc       (converted frontmatter)
 *   dist/opencode/<skill-name>/SKILL.md (copied as-is)
 */
function buildDistribution(config) {
  // Clean and recreate dist
  rmSync(join(ROOT, 'dist/cursor'), { recursive: true, force: true })
  rmSync(join(ROOT, 'dist/opencode'), { recursive: true, force: true })
  mkdirSync(join(ROOT, 'dist/cursor'), { recursive: true })
  mkdirSync(join(ROOT, 'dist/opencode'), { recursive: true })

  for (const [sourceName, source] of Object.entries(config.sources)) {
    const sourcePath = join(ROOT, source.subtreePrefix)

    for (const plugin of source.plugins) {
      const pluginDir = join(sourcePath, plugin.dir)

      if (!existsSync(pluginDir)) {
        console.warn(`Warning: ${pluginDir} does not exist, skipping`)
        continue
      }

      if (plugin.format === 'skills') {
        for (const entry of readdirSync(pluginDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (plugin.include !== '*' && !plugin.include.includes(entry.name)) continue

          const skillDir = join(pluginDir, entry.name)
          const skillMdPath = join(skillDir, 'SKILL.md')
          if (!existsSync(skillMdPath)) continue

          // OpenCode: copy whole skill directory
          cpSync(skillDir, join(ROOT, 'dist/opencode', entry.name), { recursive: true })

          // Cursor: convert SKILL.md → .mdc
          const content = readFileSync(skillMdPath, 'utf8')
          writeFileSync(
            join(ROOT, 'dist/cursor', `${entry.name}.mdc`),
            convertSkillToCursor(entry.name, content)
          )
          console.log(`  ✓ ${entry.name}`)
        }
      } else if (plugin.format === 'commands') {
        for (const entry of readdirSync(pluginDir, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue
          const commandName = entry.name.replace(/\.md$/, '')
          if (plugin.include !== '*' && !plugin.include.includes(commandName)) continue

          const content = readFileSync(join(pluginDir, entry.name), 'utf8')

          // OpenCode: place in skill-directory structure
          const opencodeDest = join(ROOT, 'dist/opencode', commandName)
          mkdirSync(opencodeDest, { recursive: true })
          writeFileSync(join(opencodeDest, 'SKILL.md'), content)

          // Cursor: convert → .mdc
          writeFileSync(
            join(ROOT, 'dist/cursor', `${commandName}.mdc`),
            convertSkillToCursor(commandName, content)
          )
          console.log(`  ✓ ${commandName} (command)`)
        }
      }
    }
  }
}

// Main — only runs when executed directly (not when imported by tests)
if (process.argv[1] === __filename) {
  const config = JSON.parse(readFileSync(join(ROOT, '.skillsync.json'), 'utf8'))
  console.log('Building distribution...')
  buildDistribution(config)
  console.log('Done.')
}
```

- [ ] **Step 2: Re-run unit tests — verify still PASS**

```bash
node scripts/convert.test.mjs
```

Expected: `All tests passed!`

- [ ] **Step 3: Run full converter**

```bash
node scripts/convert.mjs
```

Expected output (approx):
```
Building distribution...
  ✓ brainstorming
  ✓ dispatching-parallel-agents
  ✓ executing-plans
  ... (all 14 superpowers skills)
  ✓ skill-creator
  ✓ commit (command)
  ✓ commit-push-pr (command)
  ✓ clean_gone (command)
Done.
```

- [ ] **Step 4: Verify dist output**

```bash
ls dist/cursor/
ls dist/opencode/
head -5 dist/cursor/brainstorming.mdc
head -5 dist/opencode/brainstorming/SKILL.md
```

Expected `dist/cursor/brainstorming.mdc` starts with:
```
---
description: You MUST use this before any creative work ...
alwaysApply: false
---
```

Expected `dist/opencode/brainstorming/SKILL.md` — identical to `sources/superpowers/skills/brainstorming/SKILL.md`.

- [ ] **Step 5: Commit**

```bash
git add scripts/convert.mjs dist/
git commit -m "feat: implement full conversion pipeline, generate initial dist"
```

---

### Task 5: Write GH Actions workflow

**Files:**
- Create: `.github/workflows/sync.yml`

- [ ] **Step 1: Write sync.yml**

```yaml
# .github/workflows/sync.yml
name: Sync Skills

on:
  schedule:
    - cron: '0 9 * * 1'   # Every Monday 09:00 UTC
  workflow_dispatch:        # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout with full history
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Add subtree remotes
        run: |
          git remote add superpowers https://github.com/obra/superpowers.git || true
          git remote add claude-official https://github.com/anthropics/claude-plugins-official.git || true
          git fetch superpowers
          git fetch claude-official

      - name: Pull superpowers subtree
        run: |
          git subtree pull \
            --prefix=sources/superpowers \
            superpowers main \
            --squash \
            -m "chore: sync superpowers source" || echo "No changes in superpowers"

      - name: Pull claude-official subtree
        run: |
          git subtree pull \
            --prefix=sources/claude-official \
            claude-official main \
            --squash \
            -m "chore: sync claude-official source" || echo "No changes in claude-official"

      - name: Run converter
        run: node scripts/convert.mjs

      - name: Commit dist if changed
        run: |
          git add dist/
          if git diff --cached --quiet; then
            echo "No dist changes, skipping commit"
          else
            git commit -m "chore: sync skills $(date -u +%Y-%m-%d)"
          fi

      - name: Push distribution branches
        run: |
          git subtree split --prefix=dist/cursor -b cursor-rules
          git push origin cursor-rules --force

          git subtree split --prefix=dist/opencode -b opencode-skills
          git push origin opencode-skills --force

      - name: Push main
        run: git push origin main
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync.yml
git commit -m "feat: add GH Actions sync workflow"
```

---

### Task 6: Write Makefile

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write Makefile**

```makefile
# Makefile

.PHONY: convert test sync-skills

## Run the skill converter locally (regenerates dist/)
convert:
	node scripts/convert.mjs

## Run unit tests
test:
	node scripts/convert.test.mjs

## Pull latest skills into a consuming project.
## Run this from the root of the project that has installed skill-sync via git subtree.
## Usage: make sync-skills REPO=git@github.com:upirr/skill-sync.git
REPO ?= https://github.com/upirr/skill-sync.git

sync-skills:
	git subtree pull --prefix=.cursor/rules  $(REPO) cursor-rules  --squash
	git subtree pull --prefix=.opencode/skills $(REPO) opencode-skills --squash
```

- [ ] **Step 2: Commit**

```bash
git add Makefile
git commit -m "feat: add Makefile with convert, test, and sync-skills targets"
```

---

### Task 7: Write README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

Write the following content to `README.md` (use Write tool or editor — contains nested code blocks):

````markdown
# skill-sync

Aggregates CC skills from public repos and distributes them for [Cursor](https://cursor.sh) and [OpenCode](https://opencode.ai).

**Included skills:**
- [superpowers](https://github.com/obra/superpowers) — all 14 skills (brainstorming, TDD, debugging, etc.)
- [skill-creator](https://github.com/anthropics/claude-plugins-official) — skill authoring workflow
- [commit-commands](https://github.com/anthropics/claude-plugins-official) — commit, commit-push-pr, clean_gone

---

## Installation

Run once from your project root:

```bash
# Cursor rules
git subtree add \
  --prefix=.cursor/rules \
  https://github.com/upirr/skill-sync.git cursor-rules \
  --squash

# OpenCode skills
git subtree add \
  --prefix=.opencode/skills \
  https://github.com/upirr/skill-sync.git opencode-skills \
  --squash
```

Both directories are committed to your project — teammates get them automatically on clone.

---

## Updating

Pull the latest converted skills:

```bash
git subtree pull \
  --prefix=.cursor/rules \
  https://github.com/upirr/skill-sync.git cursor-rules \
  --squash

git subtree pull \
  --prefix=.opencode/skills \
  https://github.com/upirr/skill-sync.git opencode-skills \
  --squash
```

Or add to your project's `Makefile`:

```makefile
SKILL_SYNC_REPO := https://github.com/upirr/skill-sync.git

sync-skills:
	git subtree pull --prefix=.cursor/rules  $(SKILL_SYNC_REPO) cursor-rules  --squash
	git subtree pull --prefix=.opencode/skills $(SKILL_SYNC_REPO) opencode-skills --squash
```

Then run: `make sync-skills`

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
```

````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation and usage instructions"
```

---

### Task 8: Push distribution branches and verify

- [ ] **Step 1: Push main**

```bash
git push origin main
```

- [ ] **Step 2: Create cursor-rules distribution branch**

```bash
git subtree split --prefix=dist/cursor -b cursor-rules
git push origin cursor-rules --force
```

Expected: branch `cursor-rules` appears on GitHub containing only `.mdc` files at root.

- [ ] **Step 3: Create opencode-skills distribution branch**

```bash
git subtree split --prefix=dist/opencode -b opencode-skills
git push origin opencode-skills --force
```

Expected: branch `opencode-skills` appears on GitHub containing only skill directories.

- [ ] **Step 4: Verify branches on GitHub**

```bash
gh repo view upirr/skill-sync --web
```

Or:

```bash
git ls-remote origin | grep -E 'cursor-rules|opencode-skills'
```

Expected: both refs present.

- [ ] **Step 5: Smoke test install in a temp directory**

```bash
mkdir /tmp/skill-sync-test && cd /tmp/skill-sync-test && git init && git commit --allow-empty -m "init"

git subtree add \
  --prefix=.cursor/rules \
  https://github.com/upirr/skill-sync.git cursor-rules \
  --squash

ls .cursor/rules/
```

Expected: `.mdc` files visible (e.g. `brainstorming.mdc`, `commit.mdc`, etc.)

```bash
git subtree add \
  --prefix=.opencode/skills \
  https://github.com/upirr/skill-sync.git opencode-skills \
  --squash

ls .opencode/skills/
```

Expected: skill directories (e.g. `brainstorming/`, `commit/`, etc.)

```bash
cd /home/upir/git/skill-sync
```
