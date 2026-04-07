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
