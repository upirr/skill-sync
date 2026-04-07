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
