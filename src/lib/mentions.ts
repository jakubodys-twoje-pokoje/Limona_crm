import type { Profile, Task } from '@/types/database'

export interface ParsedMention {
  type: 'user'
  userId: string
  name: string
  start: number
  end: number
}

export interface ParsedTaskRef {
  type: 'task'
  taskTitle: string
  taskId: string | null
  start: number
  end: number
}

/**
 * Parse @mentions from text. Matches @"Full Name" or @FirstName.
 */
export function parseMentions(text: string, profiles: Profile[]): ParsedMention[] {
  const mentions: ParsedMention[] = []
  const regex = /@"([^"]+)"|@(\S+)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const name = match[1] || match[2]
    const profile = profiles.find(
      p => p.full_name.toLowerCase() === name.toLowerCase()
        || p.full_name.split(' ')[0].toLowerCase() === name.toLowerCase()
    )
    if (profile) {
      mentions.push({
        type: 'user',
        userId: profile.id,
        name: profile.full_name,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  return mentions
}

/**
 * Parse #task references from text. Matches #"Task Title" or #TaskWord.
 */
export function parseTaskRefs(text: string, tasks: Task[]): ParsedTaskRef[] {
  const refs: ParsedTaskRef[] = []
  const regex = /#"([^"]+)"|#(\S+)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const title = match[1] || match[2]
    const task = tasks.find(
      t => t.title.toLowerCase() === title.toLowerCase()
        || t.title.toLowerCase().startsWith(title.toLowerCase())
    )
    refs.push({
      type: 'task',
      taskTitle: task?.title || title,
      taskId: task?.id || null,
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return refs
}

export function extractMentionedUserIds(text: string, profiles: Profile[]): string[] {
  return parseMentions(text, profiles).map(m => m.userId)
}

/**
 * Check if a task is visible to a given user based on visibility rules.
 */
export function isTaskVisibleToUser(
  task: Task,
  viewerUserId: string,
  visibleUserIds: string[] | null
): boolean {
  if (visibleUserIds === null) return true
  return (
    task.created_by === viewerUserId ||
    task.assigned_to === viewerUserId ||
    (task.created_by !== null && visibleUserIds.includes(task.created_by)) ||
    (task.assigned_to !== null && visibleUserIds.includes(task.assigned_to))
  )
}
