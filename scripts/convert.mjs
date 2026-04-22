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
  mkdirSync(join(ROOT, 'dist/cursor/skill-sync'), { recursive: true })
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
            join(ROOT, 'dist/cursor/skill-sync', `${entry.name}.mdc`),
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
            join(ROOT, 'dist/cursor/skill-sync', `${commandName}.mdc`),
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
