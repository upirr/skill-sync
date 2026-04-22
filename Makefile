# Makefile

.PHONY: convert test sync-skills

## Run the skill converter locally (regenerates dist/)
convert:
	node scripts/convert.mjs

## Run unit tests
test:
	node scripts/convert.test.mjs

## Copy latest skills into a consuming project.
## Usage: make sync-skills TARGET=/path/to/project/.cursor/rules/personal
TARGET ?= .cursor/rules/personal

sync-skills:
	cp dist/cursor/*.mdc $(TARGET)/
