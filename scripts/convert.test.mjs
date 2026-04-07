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
