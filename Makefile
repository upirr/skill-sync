# Makefile

.PHONY: convert test sync-agents

## Run the skill converter locally (regenerates dist/)
convert:
	node scripts/convert.mjs

## Run unit tests
test:
	node scripts/convert.test.mjs

## Copy skills into a .agents/skills/ directory (Cursor Agent Skills format).
## Usage: make sync-agents AGENTS_TARGET=/path/to/project/.agents/skills
AGENTS_TARGET ?= .agents/skills

sync-agents:
	cp -r dist/opencode/* $(AGENTS_TARGET)/
